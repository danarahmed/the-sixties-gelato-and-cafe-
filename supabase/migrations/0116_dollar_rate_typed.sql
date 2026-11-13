-- 0116: the dollar's rate typed with each payment (plan 6, item 11 c; the
-- owner, 12 November).
--
--   * There is no daily rate: the rate changes by the minute, so a dollar
--     payment at the till takes the rate typed for it, the last one a manager
--     used offered to start from. Bills and payments in dollars already take
--     their own (0103), and an exchange is the dinars received (0043).
--   * A cashier's rate within a small band of the last one a manager used
--     (2% unless the owner sets another, 0 to 20) is taken; beyond it, a
--     manager approves it with their PIN. A manager's own rate is taken, and
--     is the last one a manager used from then on.
--   * Every rate used is kept, with who used it and who approved it: a report
--     of the rates each person used.
--
-- Nothing recorded changes. A rate set on Sales → Dollars is the last one a
-- manager used, as before; how old it is no longer stops dollars being taken.

create table if not exists usd_rate_setup (
  business_id  uuid primary key references business(id) on delete cascade,
  band_percent numeric(5, 2) not null default 2 check (band_percent >= 0 and band_percent <= 20),
  set_by       uuid references app_user(id),
  set_at       timestamptz not null default now()
);
alter table usd_rate_setup enable row level security;
alter table usd_rate_setup force row level security;

create table if not exists usd_rate_used (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  rate         numeric not null check (rate > 0),
  -- The last rate a manager used when this one was typed; null when none was.
  last_rate    numeric,
  within_band  boolean not null,
  used_by      uuid references app_user(id),
  approved_by  uuid references app_user(id),
  created_at   timestamptz not null default now()
);
create index if not exists usd_rate_used_recent on usd_rate_used (business_id, created_at desc);
alter table usd_rate_used enable row level security;
alter table usd_rate_used force row level security;

create or replace function usd_rate_band(p_business uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select band_percent from usd_rate_setup where business_id = p_business), 2)
$$;

-- A manager approves a rate beyond the band with their PIN, as a discount over its cap.
alter table approval drop constraint if exists approval_kind_check;
alter table approval add constraint approval_kind_check
  check (kind in ('discount', 'void', 'refund', 'waste', 'negative_stock', 'usd_rate'));
create or replace function approval_permission(p_kind text) returns text
language sql immutable set search_path = public as $$
  select case p_kind when 'discount' then 'discount.approve' when 'void' then 'sale.void'
                     when 'refund' then 'sale.refund' when 'waste' then 'waste.approve'
                     when 'negative_stock' then 'inventory.adjust.approve' when 'usd_rate' then 'fx.rate' end
$$;

-- The rate a dollar payment is taken at: the one typed, as the band and the
-- person allow; kept with who used it.
create or replace function usd_rate_take(p_business uuid, p_rate numeric, p_approval uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_rate numeric := usd_rate_ok(p_rate); r fx_rate := usd_rate_row(p_business);
  v_band numeric := usd_rate_band(p_business); v_me uuid := (current_member()).id; a approval;
  v_within boolean;
begin
  v_within := r.id is not null and abs(v_rate - r.rate) <= r.rate * v_band / 100;
  if current_has_permission('fx.rate') then
    if r.id is null or r.rate <> v_rate then
      insert into fx_rate (business_id, currency, rate, set_by, reason)
      values (p_business, 'USD', v_rate, v_me, 'Typed with a payment');
    end if;
  elsif not v_within then
    if p_approval is null then
      if r.id is null then
        raise exception '%', format('No manager has used a dollar rate yet: a manager approves %s with their PIN',
                                    trim_scale(v_rate));
      end if;
      raise exception '%', format('%s is more than %s%% from %s, the last rate a manager used: a manager approves it with their PIN',
                                  trim_scale(v_rate), trim_scale(v_band), trim_scale(r.rate));
    end if;
    a := use_approval(p_business, p_approval, 'usd_rate', 'usd_rate ' || trim_scale(v_rate));
    if (a.scope ->> 'rate')::numeric is distinct from v_rate then
      raise exception 'That approval was for another rate: ask again';
    end if;
  end if;
  insert into usd_rate_used (business_id, rate, last_rate, within_band, used_by, approved_by)
  values (p_business, v_rate, r.rate, coalesce(v_within, false), v_me, a.approver_id);
  return v_rate;
end $$;

-- 0043's dollars among a sale's payments: at the rate typed for them (the
-- same for each), as usd_rate_take allows, worth at least the part they pay.
create or replace function sale_dollars(p_business uuid, p_pay jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare x jsonb; v_out jsonb := '[]'; v_rate numeric; v_value numeric;
begin
  for x in select e.x from jsonb_array_elements(p_pay) with ordinality e(x, o) order by e.o loop
    if x ->> 'currency' = 'USD' then
      if v_rate is null then
        v_rate := usd_rate_take(p_business, (x ->> 'rate')::numeric, nullif(x ->> 'approval', '')::uuid);
      elsif (x ->> 'rate')::numeric <> v_rate then
        raise exception 'The dollars of one sale are taken at one rate';
      end if;
      v_value := usd_value(p_business, (x ->> 'usd')::numeric, v_rate);
      if (x ->> 'amount')::numeric > v_value then
        raise exception '$% come to %, less than the % they pay', trim_scale((x ->> 'usd')::numeric),
          trim_scale(v_value), trim_scale((x ->> 'amount')::numeric);
      end if;
      x := x || jsonb_build_object('received', v_value);
    end if;
    v_out := v_out || x;
  end loop;
  return v_out;
end $$;

-- 0076's payments as the database reads them, keeping a dollar payment's
-- approval (the manager's PIN for its rate) for sale_dollars.
do $$
begin
  if to_regprocedure('sale_payments_0115(uuid, sales_channel, tender_type, jsonb)') is null then
    alter function sale_payments(uuid, sales_channel, tender_type, jsonb) rename to sale_payments_0115;
  end if;
end $$;
create or replace function sale_payments(p_business uuid, p_channel sales_channel, p_tender tender_type,
                                         p_tenders jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare v jsonb := sale_payments_0115(p_business, p_channel, p_tender, p_tenders); v_approval text;
begin
  select x ->> 'approval' into v_approval
    from jsonb_array_elements(case when jsonb_typeof(p_tenders) = 'array' then p_tenders else '[]'::jsonb end) x
   where x ->> 'currency' = 'USD'
     and x ->> 'approval' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   limit 1;
  if v_approval is null then return v; end if;
  return (select jsonb_agg(case when e ->> 'currency' = 'USD' then e || jsonb_build_object('approval', v_approval)
                                else e end order by o)
            from jsonb_array_elements(v) with ordinality t(e, o));
end $$;

-- 0043's status of the dollar, for the till and Settings: the last rate a
-- manager used is offered to start from, however old; the band beside it.
do $$
begin
  if to_regprocedure('fx_status_0115()') is null then
    alter function fx_status() rename to fx_status_0115;
  end if;
end $$;
revoke execute on function fx_status_0115() from public, anon, authenticated;
create or replace function fx_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb := fx_status_0115();
begin
  return v || jsonb_build_object('usable', (v ->> 'rate') is not null, 'typed', true,
                                 'band_percent', usd_rate_band(current_business_id()));
end $$;

-- (the owner) How far from the last manager's rate a cashier's may be.
create or replace function set_usd_rate_band(p_percent numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('fx.rate'); v_was numeric;
begin
  if not current_has_role('owner') then
    raise exception 'Only the owner sets how far a cashier''s rate may be' using errcode = '42501';
  end if;
  if p_percent is null or p_percent < 0 or p_percent > 20 then
    raise exception 'The band is from 0%% to 20%%';
  end if;
  v_was := usd_rate_band(v_business);
  insert into usd_rate_setup (business_id, band_percent, set_by, set_at)
  values (v_business, p_percent, (current_member()).id, now())
  on conflict (business_id) do update set band_percent = excluded.band_percent, set_by = excluded.set_by,
                                          set_at = excluded.set_at;
  perform audit_event(v_business, 'fx.rate.band', 'business', v_business::text, null,
    jsonb_build_object('band_percent', v_was), jsonb_build_object('band_percent', p_percent));
  return jsonb_build_object('band_percent', p_percent);
end $$;

-- (fx.rate or cost.view) The rates each person used between two days.
create or replace function usd_rates_used(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('fx.rate', 'cost.view'); b record;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose the dates, the first before the last';
  end if;
  b := local_day_bounds(v_business, p_from, p_to);
  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'band_percent', usd_rate_band(v_business),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(u.full_name, '—'), 'times', x.times,
                                          'lowest', x.lowest, 'highest', x.highest, 'average', x.average,
                                          'beyond_band', x.beyond, 'approved', x.approved)
                       order by u.full_name)
        from (select used_by, count(*) as times, min(rate) as lowest, max(rate) as highest,
                     round(avg(rate), 2) as average, count(*) filter (where not within_band) as beyond,
                     count(*) filter (where approved_by is not null) as approved
                from usd_rate_used
               where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts
               group by used_by) x
        left join app_user u on u.id = x.used_by), '[]'::jsonb),
    'rates', coalesce((
      select jsonb_agg(jsonb_build_object('at', r.created_at, 'rate', r.rate, 'last_rate', r.last_rate,
                                          'within_band', r.within_band, 'by', u.full_name, 'approved_by', a.full_name)
                       order by r.created_at desc)
        from (select * from usd_rate_used
               where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts
               order by created_at desc limit 200) r
        left join app_user u on u.id = r.used_by
        left join app_user a on a.id = r.approved_by), '[]'::jsonb));
end $$;

revoke execute on function usd_rate_band(uuid), usd_rate_take(uuid, numeric, uuid), sale_dollars(uuid, jsonb),
  sale_payments(uuid, sales_channel, tender_type, jsonb), sale_payments_0115(uuid, sales_channel, tender_type, jsonb)
  from public, anon, authenticated;
revoke execute on function set_usd_rate_band(numeric), usd_rates_used(date, date), fx_status() from public, anon;
grant execute on function set_usd_rate_band(numeric), usd_rates_used(date, date), fx_status() to authenticated;
