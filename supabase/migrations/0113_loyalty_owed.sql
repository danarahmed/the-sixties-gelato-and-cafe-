-- 0113: loyalty points as money owed (plan 6, item 7; the owner, 8 November:
-- optional for each café).
--
--   * Off, a reward is a discount when it is taken (4100), as before.
--   * On, the points customers hold are owed: each point at the reward's value
--     (the reward's dinars over its points, 5,000 / 100 = 50). Points earned or
--     given back: their value is a cost now (Dr 6150 Loyalty points, Cr 2150
--     Loyalty points owed). Points spent on a reward or taken back: owed no
--     more (Dr 2150, Cr 6150): the reward's discount is on 4100 as before, so
--     a point's cost is counted once, when it was earned.
--   * Turned on, the points already held are booked as owed; turned off, what
--     is owed is cleared. Turned on again (or the reward's value changed), the
--     books are brought to the points held at the reward's value now.
--
-- Nothing recorded changes; off until the owner turns it on.

create table if not exists loyalty_owed_setup (
  business_id uuid primary key references business(id) on delete cascade,
  enabled     boolean not null default false,
  set_by      uuid references app_user(id),
  set_at      timestamptz not null default now()
);
alter table loyalty_owed_setup enable row level security;
alter table loyalty_owed_setup force row level security;

create or replace function loyalty_owed_on(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from loyalty_owed_setup where business_id = p_business), false)
$$;

-- A point's value: the reward's dinars over its points.
create or replace function loyalty_point_value(p_business uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select loyalty_rule(p_business, 'loyalty_reward_value') / nullif(loyalty_rule(p_business, 'loyalty_reward_points'), 0)
$$;

-- What the books say is owed for points (2150's balance), and what the points held are worth.
create or replace function loyalty_owed_books(p_business uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(l.credit - l.debit), 0)
    from journal_line l join journal_entry e on e.id = l.journal_entry_id
    join gl_account g on g.id = l.account_id
   where e.business_id = p_business and g.business_id = p_business and g.code = '2150'
$$;

create or replace function loyalty_points_held(p_business uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(greatest(p, 0)), 0)::bigint
    from (select sum(points) as p from loyalty_ledger where business_id = p_business group by customer_id) x
$$;

-- The books brought to a figure owed: the difference, Dr 6150 / Cr 2150 (or back).
create or replace function loyalty_owed_true_up(p_business uuid, p_target numeric, p_why text)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_diff numeric := money_round(p_business, p_target - loyalty_owed_books(p_business));
begin
  if v_diff = 0 then return 0; end if;
  perform post_journal(p_business, now(), p_why, 'loyalty_owed', gen_random_uuid(),
    case when v_diff > 0
         then jsonb_build_array(jsonb_build_object('code', '6150', 'debit', v_diff),
                                jsonb_build_object('code', '2150', 'credit', v_diff))
         else jsonb_build_array(jsonb_build_object('code', '2150', 'debit', -v_diff),
                                jsonb_build_object('code', '6150', 'credit', -v_diff)) end);
  return v_diff;
end $$;

-- Each change to a customer's points, while points are owed: its value booked.
create or replace function trg_loyalty_owed() returns trigger
language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  if not loyalty_owed_on(new.business_id) then return null; end if;
  v := money_round(new.business_id, abs(new.points) * coalesce(loyalty_point_value(new.business_id), 0));
  if v <= 0 then return null; end if;
  perform post_journal(new.business_id, new.created_at,
    case when new.points > 0 then 'Loyalty points owed' else 'Loyalty points no longer owed' end,
    'loyalty_points', new.id,
    case when new.points > 0
         then jsonb_build_array(jsonb_build_object('code', '6150', 'debit', v),
                                jsonb_build_object('code', '2150', 'credit', v))
         else jsonb_build_array(jsonb_build_object('code', '2150', 'debit', v),
                                jsonb_build_object('code', '6150', 'credit', v)) end);
  return null;
end $$;

drop trigger if exists loyalty_owed on loyalty_ledger;
create trigger loyalty_owed after insert on loyalty_ledger
  for each row execute function trg_loyalty_owed();

-- (the owner) Points as money owed, on or off; on again brings the books to the points held.
create or replace function set_loyalty_owed(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('loyalty.adjust'); v_was boolean; v_moved numeric;
begin
  if not current_has_role('owner') then
    raise exception 'Only the owner books points as money owed' using errcode = '42501';
  end if;
  if p_enabled is null then raise exception 'Choose on or off'; end if;
  v_was := loyalty_owed_on(v_business);
  if p_enabled then
    insert into gl_account (business_id, code, name, account_type, normal_balance, is_active, is_system)
    values (v_business, '6150', 'Loyalty points', 'expense', 'debit', true, true),
           (v_business, '2150', 'Loyalty points owed', 'liability', 'credit', true, true)
    on conflict do nothing;
    v_moved := loyalty_owed_true_up(v_business,
      loyalty_points_held(v_business) * coalesce(loyalty_point_value(v_business), 0),
      'Loyalty points held, owed at the reward''s value');
  elsif v_was then
    v_moved := loyalty_owed_true_up(v_business, 0, 'Loyalty points no longer booked as owed');
  end if;
  insert into loyalty_owed_setup (business_id, enabled, set_by, set_at)
  values (v_business, p_enabled, (current_member()).id, now())
  on conflict (business_id) do update set enabled = excluded.enabled, set_by = excluded.set_by, set_at = excluded.set_at;
  perform audit_event(v_business, 'loyalty.owed', 'business', v_business::text, null,
    jsonb_build_object('enabled', v_was), jsonb_build_object('enabled', p_enabled, 'moved', coalesce(v_moved, 0)));
  return loyalty_owed();
end $$;

-- (loyalty.adjust or reports) Whether points are owed, a point's value, the points held, and what is owed.
create or replace function loyalty_owed() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('loyalty.adjust', 'profit.view'); v_value numeric; v_held bigint;
begin
  v_value := coalesce(loyalty_point_value(v_business), 0);
  v_held := loyalty_points_held(v_business);
  return jsonb_build_object('enabled', loyalty_owed_on(v_business), 'point_value', v_value,
    'points_held', v_held, 'worth', money_round(v_business, v_held * v_value),
    'owed', loyalty_owed_books(v_business));
end $$;

revoke execute on function loyalty_owed_on(uuid), loyalty_point_value(uuid), loyalty_owed_books(uuid),
  loyalty_points_held(uuid), loyalty_owed_true_up(uuid, numeric, text), trg_loyalty_owed()
  from public, anon, authenticated;
revoke execute on function set_loyalty_owed(boolean), loyalty_owed() from public, anon;
grant execute on function set_loyalty_owed(boolean), loyalty_owed() to authenticated;
