-- =============================================================================
-- 0028 — Exceptions under control: reasons from a list, discounts within a cap
--        or approved by a manager, a second person for voids and refunds,
--        everything taken off a bill recorded, and an exceptions report
-- =============================================================================
-- The September 2026 audit's P1-10 (docs/SYSTEM_AUDIT_2026-09.md): discounts,
-- voids, refunds and bill edits were lightly controlled — up to 100% off with
-- no reason, the person asking for a void also approving it, unprinted bills
-- emptied without a trace, and any text accepted as a reason ("hjjjhjjk").
--
--  * Every void, refund, discount and cancelled bill takes a reason from a
--    list; "Other" needs a few real words.
--  * A discount above the business's cap (10% unless the owner sets another)
--    needs a manager's approval: the manager chooses their name and types
--    their PIN on the till. A percentage is judged as it was asked, an amount
--    by the share of the bill it takes off — checked again as a bill changes,
--    so taking things off cannot make it more of the bill than was allowed.
--    Who gave each discount, why, and who approved it is kept with the sale.
--  * A void or refund may be approved by a second person the same way;
--    without one it goes on the owner's review.
--  * Every line taken off a bill, printed or not, is on the audit trail.
--  * report_exceptions: every void, refund, discount, cancelled bill, line
--    taken off and wrong PIN, by person.
--
-- A PIN is checked in its own step (request_approval), so a wrong one is
-- counted even though nothing else happens: five wrong PINs for a manager in
-- fifteen minutes lock their approvals for the rest of those fifteen minutes.
-- Nothing recorded before this migration changes.

-- =============================================================================
-- 1. Reasons from a list
-- =============================================================================
create table if not exists reason_code (
  kind       text not null check (kind in ('void', 'refund', 'discount', 'bill_cancel')),
  code       text not null check (code ~ '^[a-z_]+$'),
  label      text not null,
  sort_order int not null default 0,
  primary key (kind, code)
);
alter table reason_code enable row level security;
alter table reason_code force row level security;
create policy reason_code_read on reason_code for select to authenticated using (true);
grant select on reason_code to authenticated;

insert into reason_code (kind, code, label, sort_order) values
  ('void', 'rang_wrong_item', 'Rang the wrong item', 1),
  ('void', 'rang_twice', 'Rang twice', 2),
  ('void', 'wrong_channel', 'Wrong channel or table', 3),
  ('void', 'customer_left', 'Customer left before it was made', 4),
  ('void', 'other', 'Other', 9),
  ('refund', 'changed_mind', 'Customer changed their mind', 1),
  ('refund', 'quality', 'Something was wrong with it', 2),
  ('refund', 'wrong_order', 'Wrong order made', 3),
  ('refund', 'overcharged', 'Charged too much', 4),
  ('refund', 'other', 'Other', 9),
  ('discount', 'staff_meal', 'Staff meal', 1),
  ('discount', 'on_the_house', 'On the house', 2),
  ('discount', 'regular', 'Regular customer', 3),
  ('discount', 'complaint', 'To make up for a complaint', 4),
  ('discount', 'promotion', 'Promotion', 5),
  ('discount', 'other', 'Other', 9),
  ('bill_cancel', 'customer_left', 'Customer left without ordering', 1),
  ('bill_cancel', 'opened_by_mistake', 'Opened by mistake', 2),
  ('bill_cancel', 'moved', 'Moved to another bill', 3),
  ('bill_cancel', 'other', 'Other', 9)
on conflict (kind, code) do nothing;

-- A reason as it is kept: the chosen reason, and a note if one was given.
-- "Other" (or a note with no code, as the screens before 0028 sent) needs a
-- few real words: two or more, with at least six letters.
create or replace function reason_text(p_kind text, p_code text, p_note text) returns text
language plpgsql stable set search_path = public as $$
declare v_label text; v_code text := coalesce(nullif(trim(p_code), ''), 'other');
        v_note text := nullif(regexp_replace(trim(coalesce(p_note, '')), '\s+', ' ', 'g'), '');
begin
  if nullif(trim(p_code), '') is null and v_note is null then
    raise exception 'Choose a reason from the list';
  end if;
  select label into v_label from reason_code where kind = p_kind and code = v_code;
  if v_label is null then raise exception 'Choose a reason from the list'; end if;
  if v_code = 'other' then
    if v_note is null or array_length(string_to_array(v_note, ' '), 1) < 2
       or length(regexp_replace(v_note, '[[:space:][:punct:][:digit:]]', '', 'g')) < 6 then
      raise exception 'Say what happened, in a few words';
    end if;
    return left(v_note, 300);
  end if;
  return left(v_label || coalesce(': ' || v_note, ''), 300);
end $$;

-- =============================================================================
-- 2. Approvals: a manager's name and PIN, checked in its own step
-- =============================================================================
-- The most a person without discount.approve may take off a sale on their own.
alter table business add column if not exists discount_cap_percent numeric not null default 10;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'business_discount_cap_ok') then
    alter table business add constraint business_discount_cap_ok
      check (discount_cap_percent >= 0 and discount_cap_percent <= 100);
  end if;
end $$;

insert into role_permission (role, permission)
select r::app_role, p from (values
  ('owner','discount.approve'),('general_manager','discount.approve'),('branch_manager','discount.approve')
) as v(r, p)
on conflict do nothing;

create table if not exists approval (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  kind         text not null check (kind in ('discount', 'void', 'refund')),
  approver_id  uuid not null references app_user (id),
  requested_by uuid not null references app_user (id),
  -- What was approved: {"percent": 15} for a discount, {"order_id": …} for a void or refund.
  scope        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  used_at      timestamptz,
  used_for     text
);
create index if not exists approval_business_idx on approval (business_id, created_at);

create table if not exists pin_attempt (
  id           bigint generated always as identity primary key,
  business_id  uuid not null references business (id) on delete cascade,
  approver_id  uuid not null references app_user (id),
  requested_by uuid references app_user (id),
  ok           boolean not null,
  at           timestamptz not null default now()
);
create index if not exists pin_attempt_approver_idx on pin_attempt (approver_id, at);

-- Only the functions below read or write these.
alter table approval enable row level security;
alter table approval force row level security;
alter table pin_attempt enable row level security;
alter table pin_attempt force row level security;

-- The permission that approves each kind.
create or replace function approval_permission(p_kind text) returns text
language sql immutable set search_path = public as $$
  select case p_kind when 'discount' then 'discount.approve' when 'void' then 'sale.void'
                     when 'refund' then 'sale.refund' end
$$;

create or replace function member_has_permission(p_member uuid, p_permission text) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                  where ur.app_user_id = p_member and rp.permission = p_permission)
$$;

-- A manager sets the PIN they approve with (4 to 8 digits), kept only as a hash.
create or replace function set_my_pin(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
declare v_me app_user := current_member();
begin
  if v_me.id is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not (current_has_permission('discount.approve') or current_has_permission('sale.void')
          or current_has_permission('sale.refund')) then
    raise exception 'Only those who approve discounts, voids or refunds have a PIN' using errcode = '42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then raise exception 'A PIN is 4 to 8 digits'; end if;
  if p_pin ~ '^(.)\1+$' or '0123456789' like '%' || p_pin || '%' or '9876543210' like '%' || p_pin || '%' then
    raise exception 'Choose a PIN that is harder to guess';
  end if;
  update app_user set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)) where id = v_me.id;
  perform audit_event(v_me.business_id, 'member.pin_set', 'app_user', v_me.id::text, null, null, null);
end $$;

-- Who else may approve a kind of exception on this till: names only.
create or replace function list_approvers(p_kind text)
returns table (id uuid, name text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_perm text := approval_permission(p_kind);
begin
  if v_perm is null then raise exception 'Unknown approval'; end if;
  return query
    select au.id, au.full_name from app_user au
     where au.business_id = v_business and au.is_active and au.pin_hash is not null
       and au.id is distinct from (current_member()).id
       and member_has_permission(au.id, v_perm)
     order by au.full_name;
end $$;

-- A manager approves on the till: their name and PIN. A wrong PIN is counted
-- (the answer says so rather than failing, so the count is kept), and five in
-- fifteen minutes lock that manager's approvals until they have passed.
create or replace function request_approval(p_kind text, p_approver uuid, p_pin text, p_scope jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  v_perm text := approval_permission(p_kind);
  a app_user; v_fails int; v_ok boolean; v_id uuid;
begin
  if v_perm is null then raise exception 'Unknown approval'; end if;
  select * into a from app_user where id = p_approver and business_id = v_business and is_active;
  if not found or not member_has_permission(a.id, v_perm) then
    raise exception 'Choose someone who may approve this';
  end if;
  if a.id = v_me then raise exception 'Someone else approves it: that is the point of asking'; end if;
  if a.pin_hash is null then
    return jsonb_build_object('ok', false, 'error', format('%s has not set a PIN yet (My account)', a.full_name));
  end if;
  select count(*) into v_fails from pin_attempt
   where approver_id = a.id and not ok and at > now() - interval '15 minutes';
  if v_fails >= 5 then
    return jsonb_build_object('ok', false,
      'error', format('Too many wrong PINs for %s: try again in 15 minutes', a.full_name));
  end if;
  v_ok := extensions.crypt(coalesce(p_pin, ''), a.pin_hash) = a.pin_hash;
  insert into pin_attempt (business_id, approver_id, requested_by, ok) values (v_business, a.id, v_me, v_ok);
  if not v_ok then
    perform audit_event(v_business, 'approval.refused', 'app_user', a.id::text, 'wrong PIN', null,
      jsonb_build_object('kind', p_kind, 'approver', a.id, 'requested_by', v_me));
    return jsonb_build_object('ok', false, 'error', 'That PIN is not right');
  end if;
  insert into approval (business_id, kind, approver_id, requested_by, scope, expires_at)
  values (v_business, p_kind, a.id, v_me, coalesce(p_scope, '{}'::jsonb), now() + interval '10 minutes')
  returning id into v_id;
  perform audit_event(v_business, 'approval.granted', 'approval', v_id::text, null, null,
    jsonb_build_object('kind', p_kind, 'approver', a.id, 'requested_by', v_me, 'scope', p_scope));
  return jsonb_build_object('ok', true, 'approval_id', v_id, 'approver', a.full_name);
end $$;

-- An approval is used once, by the person it was given to, within ten minutes.
create or replace function use_approval(p_business uuid, p_approval uuid, p_kind text, p_for text)
returns approval language plpgsql set search_path = public as $$
declare a approval; v_me uuid := (current_member()).id;
begin
  select * into a from approval where id = p_approval and business_id = p_business for update;
  if not found or a.kind <> p_kind then raise exception 'That approval is not for this'; end if;
  if a.used_at is not null then raise exception 'That approval has been used: ask again'; end if;
  if a.expires_at < now() then raise exception 'That approval has run out: ask again'; end if;
  if a.requested_by is distinct from v_me then raise exception 'That approval was given to someone else'; end if;
  update approval set used_at = now(), used_for = p_for where id = p_approval;
  return a;
end $$;

-- The share of a bill a discount comes to, to two places: a percentage as it
-- was asked (rounding it to the business's step is the business's doing, not
-- the cashier's), an amount as the part of the bill it takes off.
create or replace function discount_share(p_gross numeric, p_percent numeric, p_amount numeric) returns numeric
language sql immutable set search_path = public as $$
  select round(coalesce(p_percent, case when coalesce(p_gross, 0) > 0 and p_amount is not null
                                        then least(p_amount, p_gross) / p_gross * 100 else 0 end), 2)
$$;

-- Whether a discount may be given as it stands, and who approved it: none
-- needed within the cap, or for someone who approves discounts themselves;
-- above it, an approval covering at least that share.
create or replace function discount_approver(p_business uuid, p_gross numeric, p_percent numeric, p_amount numeric,
                                             p_approval uuid, p_for text) returns uuid
language plpgsql set search_path = public as $$
declare v_cap numeric; v_pct numeric; a approval;
begin
  if p_percent is null and p_amount is null then return null; end if;
  if current_has_permission('discount.approve') then return null; end if;
  select discount_cap_percent into v_cap from business where id = p_business;
  v_pct := discount_share(p_gross, p_percent, p_amount);
  if v_pct <= v_cap then return null; end if;
  if p_approval is null then
    raise exception '%', format('A discount over %s%% needs a manager''s approval', trim_scale(v_cap));
  end if;
  a := use_approval(p_business, p_approval, 'discount', p_for);
  if coalesce((a.scope ->> 'percent')::numeric, 0) < v_pct then
    raise exception '%', format('The manager approved up to %s%%: ask again for this one',
                                trim_scale(coalesce((a.scope ->> 'percent')::numeric, 0)));
  end if;
  return a.approver_id;
end $$;

-- =============================================================================
-- 3. Discounts: who gave them, why, and who approved them
-- =============================================================================
alter table sales_order add column if not exists discount_percent numeric;
alter table sales_order add column if not exists discount_by uuid references app_user (id);
alter table sales_order add column if not exists discount_approved_by uuid references app_user (id);
alter table sales_order add column if not exists discount_reason text;
alter table pos_tab add column if not exists discount_by uuid references app_user (id);
alter table pos_tab add column if not exists discount_approved_by uuid references app_user (id);
alter table pos_tab add column if not exists discount_reason text;
alter table pos_tab add column if not exists cancel_reason_code text;
alter table sale_adjustment add column if not exists reason_code text;

-- 0025's post_sale, now given the discount's reason and approval (p_discount,
-- {"reason", "note", "approval"}); a bill's, already checked when it was put
-- on the bill, comes as {"checked": true, "by", "approved_by", "reason"} (who
-- and why are unknown for a discount put on a bill before 0028).
drop function if exists post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean);
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric,
  p_trust_line_prices boolean default false, p_discount jsonb default null)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_business uuid := p_business;
  v_me uuid := p_me;
  v_location uuid;
  v_order uuid;
  v_existing record;
  v_today date;
  v_prevent_negative boolean;
  l jsonb; v_variant uuid; v_qty numeric; v_price numeric;
  v_variants uuid[] := '{}'; v_qtys numeric[] := '{}'; v_prices numeric[] := '{}'; v_gross_lines numeric[] := '{}';
  v_nets numeric[]; v_gross numeric := 0; v_discount numeric := 0; v_net numeric; v_cogs numeric := 0;
  d record; v_cost numeric; v_value numeric; v_line_cogs numeric; n int; i int;
  v_items uuid[];
  v_journal uuid;
  v_disc_by uuid; v_disc_approved uuid; v_disc_reason text;
begin
  if p_idempotency_key is null then
    raise exception 'A sale needs its idempotency key';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  if p_tender not in ('cash', 'card', 'platform_paid') then
    raise exception 'Tender % is not supported', p_tender;
  end if;
  if is_platform_channel(p_channel) <> (p_tender = 'platform_paid') then
    raise exception 'Delivery-platform orders are platform-paid, and only they are';
  end if;

  -- Replay: the same key returns the sale it already recorded.
  select id, gross_amount, discount_amount, net_amount, cogs_amount into v_existing
    from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  if (p_discount_percent is not null or p_discount_amount is not null) and is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets its own discounts; none is given at the till';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, now());
  select prevent_negative_stock into v_prevent_negative from business where id = v_business;

  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
                           gross_amount, discount_amount, net_amount, cogs_amount, cashier_id)
  values (v_business, v_location, p_channel, 'open', p_idempotency_key, 0, 0, 0, 0, v_me)
  on conflict (business_id, idempotency_key) do nothing
  returning id into v_order;
  if v_order is null then
    -- A concurrent request with this key won the race; return its sale.
    select id, gross_amount, discount_amount, net_amount, cogs_amount into v_existing
      from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  -- Lock every item this sale touches, in a stable order.
  select array_agg(distinct e.item_id) into v_items
    from jsonb_array_elements(p_lines) x,
         lateral expand_variant((x ->> 'variant_id')::uuid, p_channel, (x ->> 'qty')::numeric, v_today) e;
  if v_items is not null then perform lock_items(v_items); end if;

  -- Refuse to sell what is not there, when the business asks for that.
  if v_prevent_negative and v_items is not null then
    for d in
      select e.item_id, sum(e.base_qty) as need, i2.name
        from jsonb_array_elements(p_lines) x,
             lateral expand_variant((x ->> 'variant_id')::uuid, p_channel, (x ->> 'qty')::numeric, v_today) e
        join item i2 on i2.id = e.item_id
       group by e.item_id, i2.name
    loop
      if (item_position(v_business, d.item_id, v_location)).qty < d.need then
        raise exception 'Not enough % in stock to make this sale', d.name;
      end if;
    end loop;
  end if;

  -- Price every line first: the discount is shared out over the whole bill.
  for l in select * from jsonb_array_elements(p_lines) loop
    v_variant := (l ->> 'variant_id')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = v_variant and pv.business_id = v_business and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    -- A bill's printed price, passed by settle_tab alone (0025); otherwise today's.
    v_price := case when p_trust_line_prices and nullif(l ->> 'price', '') is not null
                    then (l ->> 'price')::numeric
                    else price_on(v_variant, p_channel, v_location, v_today) end;
    if v_price is null then
      raise exception 'No % price is set for this product', p_channel;
    end if;
    v_variants := v_variants || v_variant;
    v_qtys := v_qtys || v_qty;
    v_prices := v_prices || v_price;
    v_gross_lines := v_gross_lines || money_round(v_business, v_price * v_qty);
    v_gross := v_gross + money_round(v_business, v_price * v_qty);
  end loop;

  -- Each line's share of the discount, in proportion to its value, adding up
  -- to the discount exactly (the rounding method receipts use for landed costs).
  v_discount := sale_discount(v_business, v_gross, p_discount_percent, p_discount_amount);
  if v_discount > 0 then
    v_nets := allocate_landed(v_business, v_gross_lines, -v_discount);
    -- Who gave it, why, and who approved it (0028).
    if coalesce((p_discount ->> 'checked')::boolean, false) then
      v_disc_by := (p_discount ->> 'by')::uuid;
      v_disc_approved := (p_discount ->> 'approved_by')::uuid;
      v_disc_reason := p_discount ->> 'reason';
    else
      v_disc_reason := reason_text('discount', p_discount ->> 'reason', p_discount ->> 'note');
      v_disc_by := v_me;
      v_disc_approved := discount_approver(v_business, v_gross, p_discount_percent, p_discount_amount,
                                           (p_discount ->> 'approval')::uuid, v_order::text);
    end if;
  else
    v_nets := v_gross_lines;
  end if;
  v_net := v_gross - v_discount;

  n := cardinality(v_variants);
  for i in 1 .. n loop
    -- One costed movement per component per line, so every figure ties:
    -- line COGS = its movements; order COGS = all movements = the journal.
    -- Cost first, then write the line once: lines are append-only.
    v_line_cogs := 0;
    for d in select * from expand_variant(v_variants[i], p_channel, v_qtys[i], v_today) loop
      v_cost := item_issue_cost(v_business, d.item_id, v_location);
      v_value := money_round(v_business, v_cost * d.base_qty);
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                      unit_cost, value, reference_type, reference_id, app_user_id, reason)
      values (v_business, d.item_id, v_location, 'sale_consumption', -d.base_qty,
              case when d.base_qty > 0 then v_value / d.base_qty end, v_value,
              'sales_order', v_order, v_me, 'Sale');
      v_line_cogs := v_line_cogs + v_value;
    end loop;

    insert into sales_order_line (sales_order_id, product_variant_id, quantity, unit_price, line_discount, line_net, cogs_amount)
    values (v_order, v_variants[i], v_qtys[i], v_prices[i], v_gross_lines[i] - v_nets[i], v_nets[i], v_line_cogs);
    v_cogs := v_cogs + v_line_cogs;
  end loop;

  insert into sales_tender (sales_order_id, tender_type, amount) values (v_order, p_tender, v_net);

  update sales_order
     set gross_amount = v_gross, discount_amount = v_discount, net_amount = v_net, cogs_amount = v_cogs,
         discount_percent = case when v_discount > 0 then p_discount_percent end,
         discount_by = v_disc_by, discount_approved_by = v_disc_approved, discount_reason = v_disc_reason,
         status = 'completed'
   where id = v_order;

  -- Revenue at the full price; the discount on its own line (none posts when it is zero).
  v_journal := post_journal(v_business, now(), 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
    jsonb_build_array(
      jsonb_build_object('code', tender_account(p_tender), 'debit', v_net),
      jsonb_build_object('code', '4100', 'debit', v_discount),
      jsonb_build_object('code', '4000', 'credit', v_gross),
      jsonb_build_object('code', '5000', 'debit', v_cogs),
      jsonb_build_object('code', '1200', 'credit', v_cogs)));

  if v_discount > 0 then
    perform audit_event(v_business, 'sale.discount', 'sales_order', v_order::text, v_disc_reason, null,
      jsonb_build_object('gross', v_gross, 'discount', v_discount, 'percent', p_discount_percent,
                         'amount', p_discount_amount, 'given_by', v_disc_by, 'approved_by', v_disc_approved));
  end if;

  return jsonb_build_object('order_id', v_order, 'gross', v_gross, 'discount', v_discount, 'net', v_net,
    'journal_no', (select journal_no from journal_entry where id = v_journal), 'replayed', false)
    || sale_cost_view(v_cogs);
end $$;

-- 0025's record_sale, with the discount's reason and any approval.
drop function if exists record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric);
create or replace function record_sale(
  p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid default null,
  p_discount_percent numeric default null, p_discount_amount numeric default null,
  p_expected_net numeric default null, p_discount_reason text default null, p_discount_note text default null,
  p_approval uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); r jsonb;
begin
  if (p_discount_percent is not null or p_discount_amount is not null)
     and not current_has_permission('discount.apply') then
    raise exception 'You do not have permission to give discounts' using errcode = '42501';
  end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, p_channel, p_tender, p_lines,
                 p_location, p_discount_percent, p_discount_amount, false,
                 jsonb_build_object('reason', p_discount_reason, 'note', p_discount_note, 'approval', p_approval));
  perform assert_sale_total(r, p_expected_net);
  return r;
end $$;

-- 0025's settle_tab: the bill's discount was checked when it was put on the bill.
create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type,
                                      p_expected_net numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); t pos_tab; v_lines jsonb; r jsonb;
begin
  select * into t from pos_tab where id = p_tab and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if t.status = 'paid' then
    return (select jsonb_build_object(
              'tab_id', t.id, 'order_id', o.id, 'replayed', true,
              'gross', o.gross_amount, 'discount', o.discount_amount, 'net', o.net_amount,
              'journal_no', (select journal_no from journal_entry
                              where reference_type = 'sales_order' and reference_id = o.id
                                and reverses_entry is null limit 1))
              from sales_order o where o.id = t.sales_order_id);
  end if;
  t := lock_open_tab(v_business, p_tab, p_version);
  select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty, 'price', unit_price)
                   order by position)
    into v_lines from pos_tab_line where tab_id = p_tab;
  if v_lines is null then raise exception 'The bill is empty'; end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, t.channel, p_tender, v_lines,
                 t.location_id, t.discount_percent, t.discount_amount, true,
                 jsonb_build_object('checked', true, 'by', t.discount_by, 'approved_by', t.discount_approved_by,
                                    'reason', t.discount_reason));
  if coalesce((r ->> 'replayed')::boolean, false) then
    -- That key already paid for something else: never attach its sale to this bill.
    raise exception 'That payment was already used for another sale. Try again.';
  end if;
  perform assert_sale_total(r, p_expected_net);
  update pos_tab
     set status = 'paid', sales_order_id = (r ->> 'order_id')::uuid, closed_at = now(),
         closed_by = (current_member()).id
   where id = p_tab;
  return r || jsonb_build_object('tab_id', p_tab);
end $$;

-- 0025's save_tab: a discount put on the bill takes its reason, and above the
-- cap an approval; every line taken off, printed or not, is recorded.
drop function if exists save_tab(uuid, int, jsonb, text, uuid, numeric, numeric);
create or replace function save_tab(p_tab uuid, p_version int, p_lines jsonb, p_label text default null,
                                    p_table uuid default null, p_discount_percent numeric default null,
                                    p_discount_amount numeric default null, p_discount_reason text default null,
                                    p_discount_note text default null, p_approval uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  t pos_tab; l jsonb; i int := 0; v_before jsonb; v_today date; v_was jsonb; v_now jsonb; v_frozen jsonb;
  v_gross numeric := 0; v_price numeric; v_reduced boolean;
  v_disc_by uuid; v_disc_approved uuid; v_disc_reason text; v_share numeric; v_allowed numeric;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  v_today := business_local_date(v_business, now());
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'The bill has no lines'; end if;
  -- What the customer was shown keeps its printed price (0025); anything not
  -- yet printed is priced when the bill is printed, or paid.
  select coalesce(jsonb_object_agg(v, p), '{}'::jsonb) into v_frozen
    from (select product_variant_id::text v, min(unit_price) p from pos_tab_line
           where tab_id = p_tab and unit_price is not null group by 1) x;
  for l in select * from jsonb_array_elements(p_lines) loop
    if coalesce((l ->> 'qty')::numeric, 0) <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = (l ->> 'variant_id')::uuid and pv.business_id = v_business
                      and pv.is_active and p.is_active) then
      raise exception 'A product on the bill is not on sale';
    end if;
    -- Refused now, not when the customer comes to pay.
    v_price := coalesce((v_frozen ->> (l ->> 'variant_id'))::numeric,
                        price_on((l ->> 'variant_id')::uuid, t.channel, t.location_id, v_today));
    if v_price is null then
      raise exception 'No % price is set for %', t.channel,
        (select p.name from product_variant pv join product p on p.id = pv.product_id
          where pv.id = (l ->> 'variant_id')::uuid);
    end if;
    v_gross := v_gross + money_round(v_business, v_price * (l ->> 'qty')::numeric);
  end loop;
  if p_table is not null and p_table is distinct from t.table_id
     and not exists (select 1 from dining_table where id = p_table and business_id = v_business
                       and is_active and location_id = t.location_id) then
    raise exception 'That table is not in use';
  end if;

  -- A discount is given only by someone allowed to, with its reason, and above
  -- the cap with a manager's approval (0028). Once the customer has seen the
  -- bill, changing it is a manager's call; taking it off never is.
  v_disc_by := t.discount_by; v_disc_approved := t.discount_approved_by; v_disc_reason := t.discount_reason;
  v_was := jsonb_build_object('percent', t.discount_percent, 'amount', t.discount_amount);
  v_now := jsonb_build_object('percent', p_discount_percent, 'amount', p_discount_amount);
  if v_now is distinct from v_was then
    if p_discount_percent is not null or p_discount_amount is not null then
      if not current_has_permission('discount.apply') then
        raise exception 'You do not have permission to give discounts' using errcode = '42501';
      end if;
      perform sale_discount(v_business, 0, p_discount_percent, p_discount_amount);
      if t.bill_printed_at is not null and not current_has_permission('sale.void') then
        raise exception 'Only a manager can change the discount on a bill that has been printed' using errcode = '42501';
      end if;
      v_disc_reason := reason_text('discount', p_discount_reason, p_discount_note);
      v_disc_approved := discount_approver(v_business, v_gross, p_discount_percent, p_discount_amount,
                                           p_approval, p_tab::text);
      v_disc_by := v_me;
    else
      v_disc_by := null; v_disc_approved := null; v_disc_reason := null;
    end if;
    if t.bill_printed_at is not null or t.discount_percent is not null or t.discount_amount is not null then
      perform audit_event(v_business, 'bill.discount', 'pos_tab', p_tab::text, v_disc_reason, v_was,
                          v_now || jsonb_build_object('approved_by', v_disc_approved));
    end if;
  elsif p_discount_amount is not null and not current_has_permission('discount.approve') then
    -- An amount stays as it was given while the bill changes: taking things
    -- off must not make it more of the bill than the cap, or than a manager
    -- approved (a manager's own discount is theirs, whatever the bill).
    v_share := discount_share(v_gross, null, p_discount_amount);
    select discount_cap_percent into v_allowed from business where id = v_business;
    if t.discount_approved_by is not null then
      v_allowed := greatest(v_allowed, coalesce((
        select (a.scope ->> 'percent')::numeric from approval a
         where a.business_id = v_business and a.kind = 'discount' and a.used_for = p_tab::text
           and a.approver_id = t.discount_approved_by
         order by a.used_at desc limit 1), 0));
    elsif t.discount_by is not null and member_has_permission(t.discount_by, 'discount.approve') then
      v_allowed := 100;
    end if;
    if v_share > v_allowed then
      raise exception '%', format('The %s off would be %s%% of the bill, over the %s%% allowed: take the discount off first, or ask a manager',
        trim_scale(p_discount_amount), trim_scale(v_share), trim_scale(v_allowed));
    end if;
  end if;

  -- Anything taken off the bill is recorded; once the customer has seen it,
  -- taking anything off is a manager's call.
  select exists (
       select 1
         from (select product_variant_id v, sum(qty) q from pos_tab_line where tab_id = p_tab group by 1) was
         left join (select (x ->> 'variant_id')::uuid v, sum((x ->> 'qty')::numeric) q
                      from jsonb_array_elements(p_lines) x group by 1) now_ on now_.v = was.v
        where coalesce(now_.q, 0) < was.q) into v_reduced;
  if v_reduced then
    if t.bill_printed_at is not null and not current_has_permission('sale.void') then
      raise exception 'Only a manager can take items off a bill that has been printed' using errcode = '42501';
    end if;
    select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty) order by position)
      into v_before from pos_tab_line where tab_id = p_tab;
    perform audit_event(v_business, case when t.bill_printed_at is not null then 'bill.reduce' else 'bill.line_remove' end,
                        'pos_tab', p_tab::text, null,
                        jsonb_build_object('lines', v_before), jsonb_build_object('lines', p_lines));
  end if;

  delete from pos_tab_line where tab_id = p_tab;
  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    insert into pos_tab_line (tab_id, business_id, product_variant_id, qty, note, position, added_by, unit_price)
    values (p_tab, v_business, (l ->> 'variant_id')::uuid, (l ->> 'qty')::numeric,
            left(nullif(trim(l ->> 'note'), ''), 200), i, v_me, (v_frozen ->> (l ->> 'variant_id'))::numeric);
  end loop;
  update pos_tab
     set version = version + 1,
         label = coalesce(nullif(trim(p_label), ''), label),
         table_id = coalesce(p_table, table_id),
         discount_percent = p_discount_percent,
         discount_amount = p_discount_amount,
         discount_by = v_disc_by,
         discount_approved_by = v_disc_approved,
         discount_reason = v_disc_reason
   where id = p_tab;
  return jsonb_build_object('tab_id', p_tab, 'version', t.version + 1);
end $$;

-- 0019's open_tab, passing a discount's reason and approval to save_tab.
drop function if exists open_tab(sales_channel, uuid, text, uuid, jsonb, numeric, numeric);
create or replace function open_tab(p_channel sales_channel, p_table uuid default null, p_label text default null,
                                    p_location uuid default null, p_lines jsonb default null,
                                    p_discount_percent numeric default null, p_discount_amount numeric default null,
                                    p_discount_reason text default null, p_discount_note text default null,
                                    p_approval uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_location uuid; v_tab uuid;
begin
  if is_platform_channel(p_channel) then
    raise exception 'Delivery-platform orders are paid through the platform: ring them up as a sale, not a bill';
  end if;
  if p_table is not null then
    select location_id into v_location from dining_table
     where id = p_table and business_id = v_business and is_active;
    if not found then raise exception 'That table is not in use'; end if;
  else
    if nullif(trim(p_label), '') is null then raise exception 'Give the bill a table or a name'; end if;
    v_location := resolve_location(v_business, p_location);
  end if;
  insert into pos_tab (business_id, location_id, table_id, label, channel, business_day, opened_by)
  values (v_business, v_location, p_table, nullif(trim(p_label), ''), p_channel,
          business_local_date(v_business, now()), (current_member()).id)
  returning id into v_tab;
  if p_lines is not null and jsonb_typeof(p_lines) = 'array' and jsonb_array_length(p_lines) > 0 then
    return save_tab(v_tab, 1, p_lines, null, null, p_discount_percent, p_discount_amount,
                    p_discount_reason, p_discount_note, p_approval);
  end if;
  if p_discount_percent is not null or p_discount_amount is not null then
    raise exception 'Add something to the bill before giving a discount';
  end if;
  return jsonb_build_object('tab_id', v_tab, 'version', 1);
end $$;

-- 0025's split_tab: the new bill carries the discount as it was given and approved.
create or replace function split_tab(p_tab uuid, p_version int, p_move jsonb, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  t pos_tab; m jsonb; v_line pos_tab_line; v_qty numeric; v_new uuid; i int := 0;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  if p_move is null or jsonb_typeof(p_move) <> 'array' or jsonb_array_length(p_move) = 0 then
    raise exception 'Choose what to move to the new bill';
  end if;
  if (select count(distinct x ->> 'line_id') from jsonb_array_elements(p_move) x) <> jsonb_array_length(p_move) then
    raise exception 'Each line can be moved once';
  end if;
  insert into pos_tab (business_id, location_id, table_id, label, channel, business_day, opened_by,
                       bill_printed_at, discount_percent, discount_by, discount_approved_by, discount_reason)
  values (v_business, t.location_id, t.table_id,
          coalesce(nullif(trim(p_label), ''), t.label), t.channel, t.business_day, v_me, t.bill_printed_at,
          t.discount_percent,
          case when t.discount_percent is not null then t.discount_by end,
          case when t.discount_percent is not null then t.discount_approved_by end,
          case when t.discount_percent is not null then t.discount_reason end)
  returning id into v_new;
  for m in select * from jsonb_array_elements(p_move) loop
    select * into v_line from pos_tab_line where id = (m ->> 'line_id')::uuid and tab_id = p_tab;
    if not found then raise exception 'That line is not on this bill'; end if;
    v_qty := (m ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > v_line.qty then
      raise exception 'Move between 1 and % of %', v_line.qty,
        (select p.name from product_variant pv join product p on p.id = pv.product_id where pv.id = v_line.product_variant_id);
    end if;
    i := i + 1;
    insert into pos_tab_line (tab_id, business_id, product_variant_id, qty, note, position, added_by, unit_price)
    values (v_new, v_business, v_line.product_variant_id, v_qty, v_line.note, i, v_me, v_line.unit_price);
    if v_qty = v_line.qty then
      delete from pos_tab_line where id = v_line.id;
    else
      update pos_tab_line set qty = qty - v_qty where id = v_line.id;
    end if;
  end loop;
  update pos_tab set version = version + 1 where id = p_tab;
  perform audit_event(v_business, 'bill.split', 'pos_tab', p_tab::text, null, null,
                      jsonb_build_object('new_tab', v_new, 'moved', p_move));
  return jsonb_build_object('tab_id', v_new, 'version', 1, 'from_tab', p_tab, 'from_version', t.version + 1);
end $$;

-- 0018's cancel_tab: a bill with anything on it is cancelled by a manager,
-- with a reason from the list.
drop function if exists cancel_tab(uuid, int, text);
create or replace function cancel_tab(p_tab uuid, p_version int, p_reason text default null,
                                      p_reason_code text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); t pos_tab; v_lines jsonb; v_reason text;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty) order by position)
    into v_lines from pos_tab_line where tab_id = p_tab;
  if v_lines is not null then
    if not current_has_permission('sale.void') then
      raise exception 'Only a manager can cancel a bill with items on it' using errcode = '42501';
    end if;
    v_reason := reason_text('bill_cancel', p_reason_code, p_reason);
  elsif nullif(trim(p_reason_code), '') is not null or nullif(trim(p_reason), '') is not null then
    v_reason := reason_text('bill_cancel', p_reason_code, p_reason);
  end if;
  update pos_tab
     set status = 'cancelled', cancel_reason = v_reason, cancel_reason_code = nullif(trim(p_reason_code), ''),
         closed_at = now(), closed_by = (current_member()).id
   where id = p_tab;
  perform audit_event(v_business, 'bill.cancel', 'pos_tab', p_tab::text, v_reason,
                      jsonb_build_object('lines', v_lines, 'table_id', t.table_id, 'label', t.label), null);
end $$;

-- 0025's pos_open_bills, with each bill's discount reason and who gave it.
drop function if exists pos_open_bills();
create or replace function pos_open_bills()
returns table (tab_id uuid, version int, table_id uuid, table_name text, label text, channel sales_channel,
               business_day date, opened_at timestamptz, opened_by text, bill_printed_at timestamptz,
               bill_print_count int, lines jsonb, total numeric,
               subtotal numeric, discount numeric, discount_percent numeric, discount_amount numeric,
               discount_reason text, discount_by text, discount_approved_by text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    with l as (
      select tl.tab_id, tl.id, tl.position, tl.product_variant_id, tl.qty, tl.note, p.name as product_name,
             pv.name as variant_name,
             coalesce(tl.unit_price, price_on(tl.product_variant_id, t.channel, t.location_id, v_today)) as price
        from pos_tab t
        join pos_tab_line tl on tl.tab_id = t.id
        join product_variant pv on pv.id = tl.product_variant_id
        join product p on p.id = pv.product_id
       where t.business_id = v_business and t.status = 'open'
    ),
    b as (
      select t.*,
             coalesce((select sum(money_round(v_business, l.price * l.qty)) from l where l.tab_id = t.id), 0) as gross
        from pos_tab t
       where t.business_id = v_business and t.status = 'open'
    )
    select b.id, b.version, b.table_id, dt.name, b.label, b.channel, b.business_day, b.opened_at, au.full_name,
           b.bill_printed_at, b.bill_print_count,
           coalesce((select jsonb_agg(jsonb_build_object(
                               'line_id', l.id, 'variant_id', l.product_variant_id, 'qty', l.qty, 'note', l.note,
                               'product_name', l.product_name, 'variant_name', l.variant_name, 'price', l.price)
                             order by l.position)
                       from l where l.tab_id = b.id), '[]'::jsonb),
           b.gross - sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.gross,
           sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.discount_percent, b.discount_amount,
           b.discount_reason, db.full_name, dab.full_name
      from b
      left join dining_table dt on dt.id = b.table_id
      left join app_user au on au.id = b.opened_by
      left join app_user db on db.id = b.discount_by
      left join app_user dab on dab.id = b.discount_approved_by
     order by b.opened_at;
end $$;

-- =============================================================================
-- 4. Voids and refunds: a reason from the list, and a second person
-- =============================================================================
-- 0024's void_sale. p_reason is the note (the screens before 0028 sent only
-- it, as "Other"); an approval by a second person, if given, is kept as
-- approved_by, and without one the void is its requester's own.
drop function if exists void_sale(uuid, text);
create or replace function void_sale(p_order uuid, p_reason text default null, p_reason_code text default null,
                                     p_approval uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.void');
  v_me uuid := (current_member()).id;
  o sales_order; v_day date; v_journal uuid; v_rev uuid; m record; v_reason text; v_approver uuid := v_me; a approval;
begin
  select * into o from sales_order where id = p_order and business_id = v_business for update;
  if not found then raise exception 'Sale not found'; end if;
  if o.status <> 'completed' then
    raise exception 'Only a completed sale can be voided; this one is %', o.status;
  end if;
  v_day := business_local_date(v_business, o.placed_at);
  if exists (select 1 from work_shift w where w.business_id = v_business and w.location_id = o.location_id
               and w.closed_at is not null
               and ((w.kind = 'day' and w.business_day = v_day) or (w.kind = 'drawer' and w.closed_at > o.created_at))) then
    raise exception 'The drawer has been counted since this sale; refund it instead of voiding it';
  end if;
  select id into v_journal from journal_entry
   where business_id = v_business and reference_type = 'sales_order' and reference_id = p_order
     and reverses_entry is null and status = 'published';
  if v_journal is null then
    raise exception 'This sale has no journal to reverse (it predates the controls); refund it instead';
  end if;
  v_reason := reason_text('void', p_reason_code, p_reason);
  if p_approval is not null then
    a := use_approval(v_business, p_approval, 'void', p_order::text);
    if a.scope ->> 'order_id' is distinct from p_order::text then
      raise exception 'That approval is for another sale';
    end if;
    v_approver := a.approver_id;
  end if;

  v_rev := reverse_entry_internal(v_journal, now(), 'Void of sale ' || left(p_order::text, 8) || ': ' || v_reason);
  for m in select * from inventory_movement
            where reference_type = 'sales_order' and reference_id = p_order and type = 'sale_consumption' loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'reversal', -m.base_quantity_signed,
            m.unit_cost, m.value, 'sale_void', p_order, v_me, 'Void: ' || v_reason);
  end loop;
  insert into sale_adjustment (business_id, sales_order_id, kind, amount, reason, reason_code, requested_by, approved_by)
  values (v_business, p_order, 'void', o.net_amount, v_reason, coalesce(nullif(trim(p_reason_code), ''), 'other'),
          v_me, v_approver);
  update sales_order set status = 'voided' where id = p_order;
  perform audit_event(v_business, 'sale.void', 'sales_order', p_order::text, v_reason,
    jsonb_build_object('status', o.status, 'net', o.net_amount),
    jsonb_build_object('status', 'voided', 'approved_by', v_approver));
  return jsonb_build_object('order_id', p_order,
    'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- 0015's refund_sale, the same way.
drop function if exists refund_sale(uuid, text);
create or replace function refund_sale(p_order uuid, p_reason text default null, p_reason_code text default null,
                                       p_approval uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.refund');
  v_me uuid := (current_member()).id;
  o sales_order; v_tender tender_type; v_adj uuid; v_returned numeric := 0; v_journal uuid; m record;
  v_reason text; v_approver uuid := v_me; a approval;
begin
  select * into o from sales_order where id = p_order and business_id = v_business for update;
  if not found then raise exception 'Sale not found'; end if;
  if o.status <> 'completed' then
    raise exception 'Only a completed sale can be refunded; this one is %', o.status;
  end if;
  select tender_type into v_tender from sales_tender where sales_order_id = p_order limit 1;
  if tender_account(v_tender) is null then raise exception 'This sale''s tender cannot be refunded here'; end if;
  v_reason := reason_text('refund', p_reason_code, p_reason);
  if p_approval is not null then
    a := use_approval(v_business, p_approval, 'refund', p_order::text);
    if a.scope ->> 'order_id' is distinct from p_order::text then
      raise exception 'That approval is for another sale';
    end if;
    v_approver := a.approver_id;
  end if;

  insert into sale_adjustment (business_id, sales_order_id, kind, amount, reason, reason_code, requested_by, approved_by)
  values (v_business, p_order, 'refund', o.net_amount, v_reason, coalesce(nullif(trim(p_reason_code), ''), 'other'),
          v_me, v_approver)
  returning id into v_adj;

  for m in select mv.* from inventory_movement mv join item i on i.id = mv.item_id
            where mv.reference_type = 'sales_order' and mv.reference_id = p_order
              and mv.type = 'sale_consumption' and i.returnable_to_stock loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'refund_return_to_stock', -m.base_quantity_signed,
            m.unit_cost, m.value, 'sale_refund', v_adj, v_me, 'Refund: ' || v_reason);
    v_returned := v_returned + coalesce(m.value, 0);
  end loop;

  v_journal := post_journal(v_business, now(), 'Refund of sale ' || left(p_order::text, 8) || ': ' || v_reason,
    'sale_refund', v_adj, jsonb_build_array(
      jsonb_build_object('code', '4200', 'debit', o.net_amount),
      jsonb_build_object('code', tender_account(v_tender), 'credit', o.net_amount),
      jsonb_build_object('code', '1200', 'debit', v_returned),
      jsonb_build_object('code', '5000', 'credit', v_returned)));
  update sales_order set status = 'refunded' where id = p_order;
  perform audit_event(v_business, 'sale.refund', 'sales_order', p_order::text, v_reason,
    jsonb_build_object('status', o.status, 'net', o.net_amount),
    jsonb_build_object('status', 'refunded', 'returned_to_stock', v_returned, 'approved_by', v_approver));
  return jsonb_build_object('order_id', p_order, 'refunded', o.net_amount, 'returned_to_stock', v_returned,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- =============================================================================
-- 5. The exceptions report, by person
-- =============================================================================
-- Every void, refund, discount, cancelled bill with items, line taken off a
-- bill and wrong PIN in the dates, with who did it, why, who approved it, and
-- whether it waits for the owner's review: a void or refund nobody else
-- approved, a wrong PIN, or a discount over the cap given before 0028 checked
-- it (since then one over the cap cannot be given without an approval).
create or replace function report_exceptions(p_from date, p_to date)
returns table (at timestamptz, kind text, person_id uuid, person text, amount numeric, reason text,
               approved_by text, needs_review boolean, reference text, detail text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('audit.view'); b record; v_cap numeric;
begin
  select * into b from local_day_bounds(v_business, p_from, p_to);
  select discount_cap_percent into v_cap from business where id = v_business;
  return query
    select sa.created_at, sa.kind::text, sa.requested_by, rq.full_name, sa.amount, sa.reason,
           case when sa.approved_by is distinct from sa.requested_by then ap.full_name end,
           sa.approved_by is null or sa.approved_by = sa.requested_by,
           'Sale ' || left(o.id::text, 8),
           'Rung by ' || coalesce(ca.full_name, 'someone') ||
             case when o.cashier_id = sa.requested_by then ' (their own sale)' else '' end
      from sale_adjustment sa
      join sales_order o on o.id = sa.sales_order_id
      left join app_user rq on rq.id = sa.requested_by
      left join app_user ap on ap.id = sa.approved_by
      left join app_user ca on ca.id = o.cashier_id
     where sa.business_id = v_business and sa.kind in ('void', 'refund')
       and sa.created_at >= b.from_ts and sa.created_at < b.to_ts
    union all
    select o.placed_at, 'discount', coalesce(o.discount_by, o.cashier_id), gv.full_name, o.discount_amount,
           coalesce(o.discount_reason, 'No reason kept (given before reasons were asked)'), dap.full_name,
           o.discount_reason is null and o.discount_approved_by is null
             and discount_share(o.gross_amount, o.discount_percent, o.discount_amount) > v_cap
             and not member_has_permission(coalesce(o.discount_by, o.cashier_id), 'discount.approve'),
           'Sale ' || left(o.id::text, 8),
           coalesce(trim_scale(o.discount_percent) || '% asked, ', '')
             || trim_scale(round(o.discount_amount / nullif(o.gross_amount, 0) * 100, 1)) || '% of '
             || trim_scale(o.gross_amount)
             || case when o.discount_by is null then ', given before who gave it was kept' else '' end
             || case when o.status = 'voided' then ', later voided'
                     when o.status = 'refunded' then ', later refunded' else '' end
      from sales_order o
      left join app_user gv on gv.id = coalesce(o.discount_by, o.cashier_id)
      left join app_user dap on dap.id = o.discount_approved_by
     where o.business_id = v_business and o.discount_amount > 0 and o.status <> 'open'
       and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
    union all
    select a.occurred_at,
           case a.action when 'bill.cancel' then 'bill_cancel' when 'bill.reduce' then 'printed_bill_reduced'
                         when 'bill.line_remove' then 'line_removed' else 'wrong_pin' end,
           a.app_user_id, u.full_name, null::numeric, a.reason, null::text,
           a.action = 'approval.refused',
           case when a.action = 'approval.refused' then 'Approval by ' || coalesce(ap.full_name, 'someone')
                else 'Bill ' || left(a.entity_id, 8) end,
           case when a.action = 'bill.cancel'
                  then coalesce(jsonb_array_length(a.before_state -> 'lines'), 0) || ' line(s) on it'
                when a.action in ('bill.reduce', 'bill.line_remove')
                  then (select coalesce(sum(greatest(bq.q - coalesce(nq.q, 0), 0)), 0)
                          from (select x ->> 'variant_id' v, sum((x ->> 'qty')::numeric) q
                                  from jsonb_array_elements(a.before_state -> 'lines') x group by 1) bq
                          left join (select x ->> 'variant_id' v, sum((x ->> 'qty')::numeric) q
                                       from jsonb_array_elements(a.after_state -> 'lines') x group by 1) nq
                            on nq.v = bq.v) || ' item(s) taken off'
                else a.after_state ->> 'kind' end
      from audit_log a
      left join app_user u on u.id = a.app_user_id
      left join app_user ap on ap.id::text = a.entity_id and a.action = 'approval.refused'
     where a.business_id = v_business
       and (a.action in ('bill.reduce', 'bill.line_remove', 'approval.refused')
            or (a.action = 'bill.cancel' and jsonb_typeof(a.before_state -> 'lines') = 'array'))
       and a.occurred_at >= b.from_ts and a.occurred_at < b.to_ts
     order by 1;
end $$;

-- The cap, and whether the signed-in person has a PIN, on their profile.
create or replace function my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when m.id is null then null else jsonb_build_object(
    'id', m.id, 'name', m.full_name, 'business_id', m.business_id,
    'business_name', (select name from business where id = m.business_id),
    'timezone', (select timezone from business where id = m.business_id),
    'currency', (select currency_code from business where id = m.business_id),
    'currency_decimals', (select currency_decimals from business where id = m.business_id),
    'discount_round_to', (select discount_round_to from business where id = m.business_id),
    'discount_cap_percent', (select discount_cap_percent from business where id = m.business_id),
    'has_pin', m.pin_hash is not null,
    'roles', coalesce((select jsonb_agg(role order by role) from user_role where app_user_id = m.id), '[]'),
    'permissions', coalesce((select jsonb_agg(distinct rp.permission order by rp.permission)
                               from user_role ur join role_permission rp on rp.role = ur.role
                              where ur.app_user_id = m.id), '[]'))
  end
  from (select * from app_user where auth_user_id = auth.uid() and is_active limit 1) m
  right join (select 1) one on true
$$;

-- =============================================================================
-- 6. Who may call what
-- =============================================================================
revoke execute on function
  reason_text(text, text, text), approval_permission(text), member_has_permission(uuid, text),
  use_approval(uuid, uuid, text, text), discount_share(numeric, numeric, numeric),
  discount_approver(uuid, numeric, numeric, numeric, uuid, text),
  post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb)
  from public, anon, authenticated;

revoke execute on function
  set_my_pin(text), list_approvers(text), request_approval(text, uuid, text, jsonb),
  report_exceptions(date, date),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid),
  save_tab(uuid, int, jsonb, text, uuid, numeric, numeric, text, text, uuid),
  open_tab(sales_channel, uuid, text, uuid, jsonb, numeric, numeric, text, text, uuid),
  cancel_tab(uuid, int, text, text), pos_open_bills(),
  void_sale(uuid, text, text, uuid), refund_sale(uuid, text, text, uuid)
  from public, anon;
grant execute on function
  set_my_pin(text), list_approvers(text), request_approval(text, uuid, text, jsonb),
  report_exceptions(date, date),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid),
  save_tab(uuid, int, jsonb, text, uuid, numeric, numeric, text, text, uuid),
  open_tab(sales_channel, uuid, text, uuid, jsonb, numeric, numeric, text, text, uuid),
  cancel_tab(uuid, int, text, text), pos_open_bills(),
  void_sale(uuid, text, text, uuid), refund_sale(uuid, text, text, uuid)
to authenticated;
