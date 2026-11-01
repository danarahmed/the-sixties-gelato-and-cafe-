-- =============================================================================
-- 0095 — What writing the guide found, put right (the owner's choices of
-- 1 November 2026; docs/guide/src/FINDINGS.md)
-- =============================================================================
--  A1  A pre-order collected, or a customer invoiced, is a sale already agreed:
--      when it takes more than the books hold and the rule says a manager
--      approves, it goes ahead without one and is noted (as a sale made
--      offline is). A rule that refuses still refuses.
--  A2  One phone, one person: a phone linked to someone new ends the link it
--      held before, as a person's new phone ends their old one.
--  A3  A delivery worth nothing (samples, a free replacement) is received at
--      no cost; only freight on it, with nothing to share it by, is refused.
--  B1  The café's details on a screen, for the owner: its name and default
--      language at any time; the currency, the time zone and how bill numbers
--      start only while nothing has been sold or posted.
--  B2  Places added, renamed, closed and opened again on Settings: a new
--      branch, kitchen or store has its till drawer at once, and every
--      screen, report and the books by place count it as they do the others.
--  B5  Backup codes for the second step: eight, shown once when it is turned
--      on; one of them, when the phone is lost, takes the second step off so
--      the person can sign in and turn it on again with a new phone.
--  D1  "Runs out" says how much a day with its unit, and rounds as people do
--      (88 each, not 88.07).
--
-- Nothing recorded changes. Rehearsed with tests/sql/findings.test.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A1. A sale already agreed is not held for a manager
-- -----------------------------------------------------------------------------
-- 0073's stock_rules: collect_pre_order (sixties.pre_order) and
-- invoice_customer (sixties.on_account) say which sale this is; for those, an
-- item the rule would have a manager approve is noted on the audit trail with
-- why, and the sale goes on. 'block' still refuses: that is the café's choice
-- that nothing is sold without stock.
create or replace function stock_rules(p_business uuid, p_location uuid, p_needs jsonb, p_member uuid,
                                       p_approval uuid, p_kind text, p_for text, p_approved_by uuid default null)
returns uuid language plpgsql set search_path = public as $$
declare s record; v_names text; v_have numeric; v_unit text; v_name text; v_by uuid; a approval;
  v_offline boolean := current_setting('sixties.sale_offline', true) = 'on';
  v_agreed text := case
    when nullif(current_setting('sixties.pre_order', true), '') is not null then 'Pre-order collected'
    when nullif(current_setting('sixties.on_account', true), '') is not null then 'Customer invoiced' end;
begin
  for s in select * from stock_shortfalls(p_business, p_location, p_needs) loop
    if v_offline then
      if s.policy in ('block', 'approve') then
        v_names := concat_ws(', ', v_names, format('%s ×%s %s', s.name, trim_scale(s.need), s.unit));
      end if;
      continue;
    end if;
    if s.policy = 'block' then
      raise exception '%', format('Only %s %s of %s is in stock: record the delivery or the batch first, or count it',
                                  trim_scale(greatest(s.have, 0)), s.unit, s.name);
    end if;
    if s.policy = 'approve' then
      v_names := concat_ws(', ', v_names, format('%s ×%s %s', s.name, trim_scale(s.need), s.unit));
      if v_name is null then
        v_have := greatest(s.have, 0); v_unit := s.unit; v_name := s.name;
      end if;
    end if;
  end loop;
  if v_offline then
    if v_names is not null then
      perform audit_event(p_business, 'stock.below_zero', 'stock', p_for, 'Sold offline', null,
        jsonb_build_object('items', v_names, 'approved_by', null, 'offline', true));
    end if;
    return null;
  end if;
  if v_name is null then return null; end if;
  if v_agreed is not null then
    perform audit_event(p_business, 'stock.below_zero', 'stock', p_for, v_agreed, null,
      jsonb_build_object('items', v_names, 'approved_by', null, 'agreed', v_agreed));
    return null;
  end if;
  if p_approved_by is not null then
    v_by := p_approved_by;
  elsif member_has_permission(p_member, approval_permission(p_kind)) then
    v_by := p_member;
  elsif p_approval is not null then
    a := use_approval(p_business, p_approval, p_kind, p_for);
    v_by := a.approver_id;
  else
    raise exception '%', format('Only %s %s of %s is in stock: a manager approves using more than that',
                                trim_scale(v_have), v_unit, v_name);
  end if;
  perform audit_event(p_business, 'stock.below_zero', 'stock', p_for, null, null,
    jsonb_build_object('items', v_names, 'approved_by', v_by));
  return v_by;
end $$;

-- -----------------------------------------------------------------------------
-- A2. One phone, one person
-- -----------------------------------------------------------------------------
-- 0068's link_phone_finish, told the key the phone held before (p_previous):
-- that link ends too, and the answer names whose it was.
drop function if exists link_phone_finish(text);
create or replace function link_phone_finish(p_link text, p_previous text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k phone_link; e employee; v_before staff_phone; v_before_name text;
  v_key text := clock_new_key();
  v_id uuid;
begin
  select * into k from phone_link where key_hash = clock_key_hash(p_link) for update;
  if not found or p_link is null then
    return jsonb_build_object('ok', false, 'error', 'This link is not one of the café''s: ask a manager for a new one');
  end if;
  if k.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'This link was used already: ask a manager for a new one');
  end if;
  if k.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'This link is more than ten minutes old: ask a manager for a new one');
  end if;
  select * into e from employee where id = k.employee_id;
  if not works_on(e, business_local_date(k.business_id, now())) then
    return jsonb_build_object('ok', false, 'error', format('%s does not work here now', e.full_name));
  end if;
  update phone_link set used_at = now() where id = k.id;
  -- This phone was someone else's: theirs no longer.
  if p_previous is not null then
    select * into v_before from staff_phone
     where key_hash = clock_key_hash(p_previous) and business_id = k.business_id and ended_at is null
       and employee_id <> e.id
     for update;
    if found then
      update staff_phone set ended_at = now(), ended_by = k.created_by where id = v_before.id;
      select full_name into v_before_name from employee where id = v_before.employee_id;
      insert into audit_log (business_id, app_user_id, action, entity_type, entity_id, reason, after_state)
      values (k.business_id, k.created_by, 'staff.phone_unlinked', 'employee', v_before.employee_id::text,
              'The phone was linked to someone else', jsonb_build_object('name', v_before_name, 'now', e.full_name));
    end if;
  end if;
  -- And the person's own phone before this one.
  update staff_phone set ended_at = now(), ended_by = k.created_by where employee_id = e.id and ended_at is null;
  insert into staff_phone (business_id, employee_id, key_hash, linked_by)
  values (k.business_id, e.id, clock_key_hash(v_key), k.created_by)
  returning id into v_id;
  insert into audit_log (business_id, app_user_id, action, entity_type, entity_id, after_state)
  values (k.business_id, k.created_by, 'staff.phone_linked', 'employee', e.id::text,
          jsonb_build_object('name', e.full_name));
  return jsonb_build_object('ok', true, 'key', v_key, 'name', e.full_name, 'replaced', v_before_name);
end $$;
revoke execute on function link_phone_finish(text, text) from public;
grant execute on function link_phone_finish(text, text) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- A3. A delivery worth nothing
-- -----------------------------------------------------------------------------
-- 0015's allocate_landed: lines worth nothing in all are received at nothing;
-- freight or other costs on them have nothing to be shared by.
create or replace function allocate_landed(p_business uuid, p_goods numeric[], p_extra numeric)
returns numeric[] language plpgsql stable as $$
declare
  d int := coalesce((select currency_decimals from business where id = p_business), 0);
  u numeric := power(10::numeric, d);
  n int := cardinality(p_goods);
  total numeric := 0; g numeric;
  exact numeric[] := '{}'; floors numeric[] := '{}';
  target numeric; leftover int; i int; r record;
begin
  foreach g in array p_goods loop total := total + g; end loop;
  if total <= 0 then
    if coalesce(p_extra, 0) = 0 then
      return array_fill(0::numeric, array[n]);
    end if;
    raise exception 'Freight and other costs are shared by what the lines are worth: give the lines their prices';
  end if;
  for i in 1 .. n loop
    exact := exact || (p_goods[i] + p_extra * p_goods[i] / total);
    floors := floors || (floor(exact[i] * u) / u);
  end loop;
  target := round_half_even(total + p_extra, d);
  leftover := ((target - (select sum(f) from unnest(floors) f)) * u)::int;
  for r in select idx from generate_series(1, n) idx
            order by (exact[idx] * u - floor(exact[idx] * u)) desc, idx limit greatest(leftover, 0) loop
    floors[r.idx] := floors[r.idx] + 1 / u;
  end loop;
  for i in 1 .. n loop
    if floors[i] < 0 then raise exception 'The rebate exceeds the value of a received line'; end if;
    floors[i] := round(floors[i], d);
  end loop;
  return floors;
end $$;

-- 0044's receive_goods__run, but a delivery worth nothing posts no journal
-- (a journal that moves nothing is refused, audit L-01).
create or replace function receive_goods__run(
  p_supplier uuid, p_lines jsonb, p_freight numeric default 0, p_other numeric default 0,
  p_rebate numeric default 0, p_note text default null, p_location uuid default null,
  p_confirm boolean default false, p_purchase_order uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.receive');
  v_me uuid := (current_member()).id;
  v_location uuid; v_receipt uuid; v_no bigint;
  v_goods numeric[] := '{}'; v_landed numeric[]; v_items uuid[] := '{}'; v_po_lines uuid[] := '{}';
  l jsonb; i int := 0; v_item uuid; v_base numeric; v_mv uuid; v_total numeric := 0; v_journal uuid;
  v_value numeric; v_cost numeric; v_ref numeric; v_warn text[] := '{}'; v_more text[] := '{}'; v_per text; it item;
  o purchase_order; pl purchase_order_line; v_line uuid; v_came numeric; v_now jsonb := '{}';
begin
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business and is_active) then
    raise exception 'Choose an active supplier';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one line'; end if;
  if coalesce(p_freight, 0) < 0 or coalesce(p_other, 0) < 0 or coalesce(p_rebate, 0) < 0 then
    raise exception 'Freight, other costs and rebates cannot be negative';
  end if;
  if p_purchase_order is not null then
    select * into o from purchase_order where id = p_purchase_order and business_id = v_business for update;
    if not found then raise exception 'Order not found'; end if;
    if o.status = 'draft' then
      raise exception 'Order % is not approved yet: approve it, or receive without it', o.po_no;
    end if;
    if o.status = 'closed' then raise exception 'Order % is closed: receive without it', o.po_no; end if;
    if o.status = 'cancelled' then raise exception 'Order % was cancelled: receive without it', o.po_no; end if;
    if o.supplier_id <> p_supplier then
      raise exception 'Order % is from %: receive it from them', o.po_no,
        (select name from supplier where id = o.supplier_id);
    end if;
    if p_location is not null and p_location <> o.location_id then
      raise exception 'Order % is for %: receive it there', o.po_no, (select name from location where id = o.location_id);
    end if;
    v_location := o.location_id;
  else
    v_location := resolve_location(v_business, p_location);
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    v_item := (l ->> 'item_id')::uuid;
    select * into it from item where id = v_item and business_id = v_business;
    if not found then raise exception 'Unknown item on the receipt'; end if;
    if not it.is_active then raise exception '% is out of use: bring it back into use first', it.name; end if;
    if coalesce((l ->> 'qty')::numeric, 0) <= 0 then raise exception 'Every received line needs a quantity'; end if;
    -- A price per unit (of the unit received), or the line's total.
    v_value := case when nullif(l ->> 'unit_price', '') is not null
                    then (l ->> 'unit_price')::numeric * (l ->> 'qty')::numeric
                    else (l ->> 'goods_value')::numeric end;
    if coalesce(v_value, -1) < 0 then raise exception 'Every received line needs a price'; end if;
    v_goods := v_goods || money_round(v_business, v_value);
    v_items := v_items || v_item;
    -- Its cost per base unit, against what the item costs now.
    v_base := to_base_qty(v_item, (l ->> 'qty')::numeric, l ->> 'unit_code');
    v_cost := v_value / v_base;
    v_ref := item_reference_cost(v_business, v_item, v_location);
    v_per := case when it.base_unit_code = 'each' then ' each' else ' a ' || it.base_unit_code end;
    if v_ref > 0 and abs(v_cost - v_ref) > 0.25 * v_ref then
      v_warn := v_warn || format('%s at %s%s is %s%% %s its cost now (%s%s)', it.name,
        trim_scale(round(v_cost, 4)), v_per, round(abs(v_cost - v_ref) / v_ref * 100),
        case when v_cost > v_ref then 'above' else 'below' end, trim_scale(round(v_ref, 4)), v_per);
    end if;
    -- Its line on the order, and more of it than is still on order.
    v_line := null;
    if o.id is not null then
      if nullif(l ->> 'po_line_id', '') is not null then
        select * into pl from purchase_order_line
         where id = (l ->> 'po_line_id')::uuid and purchase_order_id = o.id;
        if not found or pl.item_id <> v_item then raise exception 'That line is not on order %', o.po_no; end if;
        v_line := pl.id;
      else
        select * into pl from purchase_order_line where purchase_order_id = o.id and item_id = v_item;
        if found then v_line := pl.id; end if;
      end if;
      if v_line is not null then
        v_came := coalesce((select g.base_qty from po_received(o.id) g where g.item_id = v_item), 0)
                  + coalesce((v_now ->> v_item::text)::numeric, 0) + v_base;
        if v_came > pl.base_qty then
          v_more := v_more || format('%s: %s %s ordered, %s with this delivery', it.name,
            trim_scale(round(pl.base_qty, 3)), it.base_unit_code, trim_scale(round(v_came, 3)));
        end if;
      end if;
      v_now := v_now || jsonb_build_object(v_item::text, coalesce((v_now ->> v_item::text)::numeric, 0) + v_base);
    end if;
    v_po_lines := v_po_lines || v_line;
  end loop;
  if not coalesce(p_confirm, false) then
    if cardinality(v_warn) > 0 and cardinality(v_more) > 0 then
      raise exception 'Check the price and the quantity: %. If it is right, confirm it and receive again',
        array_to_string(v_warn || v_more, '; ');
    elsif cardinality(v_warn) > 0 then
      raise exception 'Check the price: %. If it is right, confirm it and receive again', array_to_string(v_warn, '; ');
    elsif cardinality(v_more) > 0 then
      raise exception 'Check the quantity: %. If it is right, confirm it and receive again',
        array_to_string(v_more, '; ');
    end if;
  end if;
  perform lock_items(v_items);
  v_landed := allocate_landed(v_business, v_goods, coalesce(p_freight, 0) + coalesce(p_other, 0) - coalesce(p_rebate, 0));

  v_no := next_document_no(v_business, 'receipt', 1);
  insert into goods_receipt (business_id, location_id, supplier_id, receipt_no, freight_total,
                             other_landed_total, rebate_total, received_by, note, purchase_order_id)
  values (v_business, v_location, p_supplier, v_no, coalesce(p_freight, 0), coalesce(p_other, 0),
          coalesce(p_rebate, 0), v_me, nullif(trim(p_note), ''), o.id)
  returning id into v_receipt;

  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    v_item := (l ->> 'item_id')::uuid;
    v_base := to_base_qty(v_item, (l ->> 'qty')::numeric, l ->> 'unit_code');
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, app_user_id, reason)
    values (v_business, v_item, v_location, 'purchase_receipt', v_base, v_landed[i] / v_base, v_landed[i],
            'goods_receipt', v_receipt, v_me, 'Goods received')
    returning id into v_mv;
    insert into goods_receipt_line (goods_receipt_id, item_id, received_qty, received_unit_code, goods_value, movement_id,
                                    purchase_order_line_id)
    values (v_receipt, v_item, (l ->> 'qty')::numeric,
            coalesce(l ->> 'unit_code', (select base_unit_code from item where id = v_item)), v_goods[i], v_mv,
            v_po_lines[i]);
    v_total := v_total + v_landed[i];
  end loop;

  -- A delivery worth nothing moves nothing in the books: it has no journal.
  if v_total > 0 then
    v_journal := post_journal(v_business, now(), 'Goods received — receipt ' || v_no, 'goods_receipt', v_receipt,
      jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_total),
                        jsonb_build_object('code', '2050', 'credit', v_total)));
  end if;
  if cardinality(v_warn) > 0 then
    perform audit_event(v_business, 'purchase.price_confirmed', 'goods_receipt', v_receipt::text,
                        array_to_string(v_warn, '; '), null, jsonb_build_object('receipt_no', v_no));
  end if;
  if cardinality(v_more) > 0 then
    perform audit_event(v_business, 'purchase.quantity_confirmed', 'goods_receipt', v_receipt::text,
                        array_to_string(v_more, '; '), null, jsonb_build_object('receipt_no', v_no, 'po_no', o.po_no));
  end if;
  return jsonb_build_object('receipt_id', v_receipt, 'receipt_no', v_no, 'value', v_total,
    'journal_no', (select journal_no from journal_entry where id = v_journal))
    || case when o.id is not null
            then jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'po_receiving', po_view(o.id) ->> 'receiving')
            else '{}'::jsonb end;
end $$;

-- A delivery that came free: worth nothing, so it has no journal.
create or replace function receipt_is_free(p_receipt uuid) returns boolean
language sql stable set search_path = public as $$
  select coalesce((select sum(m.value) from inventory_movement m
                    where m.reference_type = 'goods_receipt' and m.reference_id = p_receipt
                      and m.type = 'purchase_receipt'), 0) = 0
     and not exists (select 1 from journal_entry j
                      where j.reference_type = 'goods_receipt' and j.reference_id = p_receipt)
$$;

-- The books' checks do not look for its journal.
alter function document_problems(uuid, timestamptz) rename to document_problems_0094;
create function document_problems(p_business uuid, p_before timestamptz)
returns table (kind text, record_id uuid, at timestamptz, problem text)
language sql stable set search_path = public as $$
  select d.kind, d.record_id, d.at, d.problem from document_problems_0094(p_business, p_before) d
   where not (d.kind = 'delivery' and receipt_is_free(d.record_id))
$$;

-- It has nothing to correct: its goods go back, or are recorded as a loss.
alter function preview_receipt_correction(uuid, jsonb, uuid, date, boolean) rename to preview_receipt_correction_0094;
create function preview_receipt_correction(p_receipt uuid, p_lines jsonb default null,
                                           p_supplier uuid default null, p_received_on date default null,
                                           p_reverse boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb := preview_receipt_correction_0094(p_receipt, p_lines, p_supplier, p_received_on, p_reverse);
begin
  if receipt_is_free(p_receipt) then
    v := v || jsonb_build_object('blocked', 'It came free: nothing to correct. Send its goods back, or record them as a loss');
  end if;
  return v;
end $$;

alter function correct_receipt__run(uuid, jsonb, uuid, date, text, boolean, boolean) rename to correct_receipt__run_0094;
create function correct_receipt__run(p_receipt uuid, p_lines jsonb, p_supplier uuid, p_received_on date,
                                     p_reason text, p_confirm boolean, p_reverse boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if receipt_is_free(p_receipt) then
    raise exception 'Delivery % came free: nothing to correct. Send its goods back, or record them as a loss',
      coalesce((select receipt_no::text from goods_receipt where id = p_receipt), '');
  end if;
  return correct_receipt__run_0094(p_receipt, p_lines, p_supplier, p_received_on, p_reason, p_confirm, p_reverse);
end $$;

-- Its goods go back without naming it, at what they cost now.
alter function return_to_supplier__run(uuid, jsonb, text, uuid, uuid, boolean) rename to return_to_supplier__run_0094;
create function return_to_supplier__run(p_supplier uuid, p_lines jsonb, p_reason text, p_receipt uuid,
                                        p_location uuid, p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_receipt is not null and receipt_is_free(p_receipt) then
    raise exception 'Delivery % came free: send its goods back without naming it',
      coalesce((select receipt_no::text from goods_receipt where id = p_receipt), '');
  end if;
  return return_to_supplier__run_0094(p_supplier, p_lines, p_reason, p_receipt, p_location, p_confirm);
end $$;

revoke execute on function receipt_is_free(uuid), document_problems(uuid, timestamptz),
  correct_receipt__run(uuid, jsonb, uuid, date, text, boolean, boolean),
  return_to_supplier__run(uuid, jsonb, text, uuid, uuid, boolean),
  preview_receipt_correction(uuid, jsonb, uuid, date, boolean) from public, anon, authenticated;
grant execute on function preview_receipt_correction(uuid, jsonb, uuid, date, boolean) to authenticated;
revoke execute on function preview_receipt_correction_0094(uuid, jsonb, uuid, date, boolean),
  document_problems_0094(uuid, timestamptz), correct_receipt__run_0094(uuid, jsonb, uuid, date, text, boolean, boolean),
  return_to_supplier__run_0094(uuid, jsonb, text, uuid, uuid, boolean) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- B1. The café's details
-- -----------------------------------------------------------------------------
-- Whether the café has made a sale or posted anything: the currency, the time
-- zone and bill numbers are fixed from then on, as every record reads by them.
create or replace function business_has_records(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sales_order where business_id = p_business)
      or exists (select 1 from journal_entry where business_id = p_business)
$$;

-- (owner) The details as they are, and which may still change.
create or replace function business_details() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage'); b business;
begin
  select * into b from business where id = v_business;
  return jsonb_build_object(
    'name', b.name, 'currency_code', b.currency_code, 'currency_symbol', b.currency_symbol,
    'currency_decimals', b.currency_decimals, 'timezone', b.timezone, 'default_locale', b.default_locale,
    'bill_prefix', b.bill_prefix, 'fixed', business_has_records(v_business),
    'owner', current_has_role('owner'));
end $$;

-- (owner) Changed. A value left null stays as it is.
create or replace function update_business_details(
  p_name text default null, p_default_locale text default null, p_currency_code text default null,
  p_currency_symbol text default null, p_currency_decimals int default null, p_timezone text default null,
  p_bill_prefix text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id(); b business; v_after business; v_fixed boolean;
begin
  if v_business is null or not current_has_role('owner') then
    raise exception 'Only the owner changes the café''s details' using errcode = '42501';
  end if;
  select * into b from business where id = v_business for update;
  v_fixed := business_has_records(v_business);
  if p_name is not null and (length(trim(p_name)) < 2 or length(trim(p_name)) > 80) then
    raise exception 'The café''s name is 2 to 80 letters';
  end if;
  if p_default_locale is not null and p_default_locale not in ('en', 'ar', 'ckb')
     and not exists (select 1 from app_language where business_id = v_business and code = p_default_locale
                                                   and is_active) then
    raise exception 'Choose one of the café''s languages';
  end if;
  if v_fixed and (
       (p_currency_code is not null and p_currency_code <> b.currency_code)
    or (p_currency_symbol is not null and p_currency_symbol <> b.currency_symbol)
    or (p_currency_decimals is not null and p_currency_decimals <> b.currency_decimals)
    or (p_timezone is not null and p_timezone <> b.timezone)
    or (p_bill_prefix is not null and upper(p_bill_prefix) <> b.bill_prefix)) then
    raise exception 'The currency, the time zone and bill numbers are fixed once the café has sold or posted anything';
  end if;
  if p_currency_code is not null and p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'A currency is three capital letters, e.g. IQD';
  end if;
  if p_currency_symbol is not null and (length(trim(p_currency_symbol)) < 1 or length(p_currency_symbol) > 6) then
    raise exception 'The currency''s sign is 1 to 6 letters';
  end if;
  if p_currency_decimals is not null and p_currency_decimals not between 0 and 3 then
    raise exception 'A currency has 0 to 3 decimal places';
  end if;
  if p_timezone is not null and not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'That is not a time zone, e.g. Asia/Baghdad';
  end if;
  if p_bill_prefix is not null and upper(p_bill_prefix) !~ '^[A-Z][A-Z0-9]{1,7}$' then
    raise exception 'Bill numbers start with 2 to 8 capital letters or digits, a letter first';
  end if;
  update business set
    name = coalesce(nullif(trim(p_name), ''), name),
    default_locale = coalesce(p_default_locale, default_locale),
    currency_code = coalesce(p_currency_code, currency_code),
    currency_symbol = coalesce(nullif(trim(p_currency_symbol), ''), currency_symbol),
    currency_decimals = coalesce(p_currency_decimals, currency_decimals),
    timezone = coalesce(p_timezone, timezone),
    bill_prefix = coalesce(upper(p_bill_prefix), bill_prefix)
  where id = v_business returning * into v_after;
  perform audit_event(v_business, 'settings.business_details', 'business', v_business::text, null,
    jsonb_build_object('name', b.name, 'default_locale', b.default_locale, 'currency_code', b.currency_code,
                       'timezone', b.timezone, 'bill_prefix', b.bill_prefix),
    jsonb_build_object('name', v_after.name, 'default_locale', v_after.default_locale,
                       'currency_code', v_after.currency_code, 'timezone', v_after.timezone,
                       'bill_prefix', v_after.bill_prefix));
  return business_details();
end $$;

-- -----------------------------------------------------------------------------
-- B2. Places
-- -----------------------------------------------------------------------------
-- A place's names, checked: 2 to 60 letters, not another active place's.
create or replace function place_name_ok(p_business uuid, p_name text, p_except uuid) returns text
language plpgsql stable set search_path = public as $$
declare v text := trim(coalesce(p_name, ''));
begin
  if length(v) < 2 or length(v) > 60 then raise exception 'A place''s name is 2 to 60 letters'; end if;
  if exists (select 1 from location where business_id = p_business and lower(name) = lower(v)
                                       and id is distinct from p_except) then
    raise exception 'There is a place called % already', v;
  end if;
  return v;
end $$;

-- (settings.manage) A new branch, central kitchen or store. Its till drawer
-- is made with it (0036's trigger); it sells the whole menu at the menu's
-- prices until told otherwise, and has no stock until some is sent or
-- received there.
create or replace function add_place(p_kind location_kind, p_name text, p_name_ar text default null,
                                     p_name_ckb text default null, p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_name text; v_id uuid; v_prior jsonb;
  v_req jsonb := jsonb_build_object('kind', p_kind, 'name', p_name);
begin
  if p_kind is null then raise exception 'Choose what kind of place it is'; end if;
  v_prior := idem_begin(v_business, p_idempotency_key, 'add_place', v_req);
  if v_prior is not null then return (v_prior ->> 'id')::uuid; end if;
  v_name := place_name_ok(v_business, p_name, null);
  insert into location (business_id, kind, name, name_ar, name_ckb)
  values (v_business, p_kind, v_name, nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''))
  returning id into v_id;
  perform audit_event(v_business, 'place.add', 'location', v_id::text, null, null,
    jsonb_build_object('kind', p_kind, 'name', v_name));
  perform idem_finish(v_business, p_idempotency_key, 'add_place', v_req, jsonb_build_object('id', v_id));
  return v_id;
end $$;

-- (settings.manage) Its names in the three languages.
create or replace function rename_place(p_place uuid, p_name text, p_name_ar text default null,
                                        p_name_ckb text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage'); l location; v_name text;
begin
  select * into l from location where id = p_place and business_id = v_business for update;
  if not found then raise exception 'That place is not one of the café''s'; end if;
  v_name := place_name_ok(v_business, p_name, p_place);
  update location set name = v_name, name_ar = nullif(trim(p_name_ar), ''), name_ckb = nullif(trim(p_name_ckb), '')
   where id = p_place;
  perform audit_event(v_business, 'place.rename', 'location', p_place::text, null,
    jsonb_build_object('name', l.name, 'name_ar', l.name_ar, 'name_ckb', l.name_ckb),
    jsonb_build_object('name', v_name, 'name_ar', nullif(trim(p_name_ar), ''), 'name_ckb', nullif(trim(p_name_ckb), '')));
end $$;

-- (settings.manage) Closed, or open again. A place closes only when nothing
-- is left running there: no drawer open, no stock, no table's bill open, no
-- pre-order waiting, and the café keeps at least one branch open.
create or replace function set_place_active(p_place uuid, p_active boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage'); l location; v_stock numeric;
begin
  select * into l from location where id = p_place and business_id = v_business for update;
  if not found then raise exception 'That place is not one of the café''s'; end if;
  if coalesce(p_active, true) = l.is_active then return; end if;
  if not coalesce(p_active, true) then
    if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why the place closes'; end if;
    if l.kind = 'branch' and not exists (select 1 from location where business_id = v_business and kind = 'branch'
                                                                  and is_active and id <> p_place) then
      raise exception 'The café keeps at least one branch open';
    end if;
    if exists (select 1 from work_shift where location_id = p_place and kind = 'session' and closed_at is null) then
      raise exception '% has a drawer open: close it first', l.name;
    end if;
    select coalesce(sum(abs(q)), 0) into v_stock from (
      select sum(base_quantity_signed) as q from inventory_movement where location_id = p_place group by item_id) s;
    if v_stock > 0 then
      raise exception '% still holds stock: send it to another place, or record it as a loss, first', l.name;
    end if;
    if exists (select 1 from pos_tab where location_id = p_place and status = 'open') then
      raise exception '% has a table''s bill open: settle or cancel it first', l.name;
    end if;
    if exists (select 1 from pre_order where location_id = p_place and status not in ('collected', 'cancelled')) then
      raise exception '% has a pre-order waiting: collect or cancel it first', l.name;
    end if;
  end if;
  update location set is_active = coalesce(p_active, true) where id = p_place;
  update cash_drawer set is_active = coalesce(p_active, true) where location_id = p_place;
  perform audit_event(v_business, case when coalesce(p_active, true) then 'place.open' else 'place.close' end,
    'location', p_place::text, nullif(trim(p_reason), ''), null, jsonb_build_object('name', l.name));
end $$;

-- -----------------------------------------------------------------------------
-- B5. Backup codes for the second step
-- -----------------------------------------------------------------------------
create table if not exists two_step_backup_code (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists two_step_backup_code_user on two_step_backup_code (user_id) where used_at is null;
alter table two_step_backup_code enable row level security;
revoke all on two_step_backup_code from anon, authenticated;

-- Tries that failed, so a code cannot be guessed: five an hour.
create table if not exists two_step_backup_try (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists two_step_backup_try_user on two_step_backup_try (user_id, at);
alter table two_step_backup_try enable row level security;
revoke all on two_step_backup_try from anon, authenticated;

-- A code as typed, made comparable: capitals, no spaces or dashes.
create or replace function two_step_code_hash(p_code text) returns text
language sql immutable set search_path = public as $$
  select encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$$;

-- (signed in all the way, with a second step) Eight new codes, shown once:
-- the ones before them no longer work.
create or replace function make_two_step_codes() returns text[]
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user uuid := auth.uid(); v_codes text[] := '{}'; v_code text; i int; j int;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_user is null then raise exception 'Sign in to continue' using errcode = '28000'; end if;
  if not exists (select 1 from auth.mfa_factors where user_id = v_user and status::text = 'verified') then
    raise exception 'Turn on the second step first';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Finish signing in: type the code from your authenticator app' using errcode = '28000';
  end if;
  delete from two_step_backup_code where user_id = v_user;
  for i in 1 .. 8 loop
    v_code := '';
    for j in 1 .. 10 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
    end loop;
    v_code := substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5);
    v_codes := v_codes || v_code;
    insert into two_step_backup_code (user_id, code_hash) values (v_user, two_step_code_hash(v_code));
  end loop;
  insert into audit_log (business_id, app_user_id, action, entity_type, entity_id)
  select au.business_id, au.id, 'account.two_step_codes', 'app_user', au.id::text
    from app_user au where au.auth_user_id = v_user;
  return v_codes;
end $$;

-- (signed in) How many unused codes this person has.
create or replace function two_step_codes_left() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from two_step_backup_code where user_id = auth.uid() and used_at is null
$$;

-- (signed in with the password, the phone lost) One code, once: the second
-- step comes off, so the person signs in and turns it on with a new phone.
create or replace function use_two_step_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Sign in to continue' using errcode = '28000'; end if;
  if (select count(*) from two_step_backup_try where user_id = v_user and at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'Too many tries: wait an hour, then try again');
  end if;
  select id into v_id from two_step_backup_code
   where user_id = v_user and used_at is null and code_hash = two_step_code_hash(p_code)
   for update;
  if v_id is null then
    insert into two_step_backup_try (user_id) values (v_user);
    return jsonb_build_object('ok', false, 'error', 'That backup code is not right, or was used already');
  end if;
  update two_step_backup_code set used_at = now() where id = v_id;
  delete from two_step_backup_code where user_id = v_user and used_at is null;
  delete from auth.mfa_factors where user_id = v_user;
  delete from two_step_backup_try where user_id = v_user;
  insert into audit_log (business_id, app_user_id, action, entity_type, entity_id, reason)
  select au.business_id, au.id, 'account.two_step_off', 'app_user', au.id::text, 'A backup code was used'
    from app_user au where au.auth_user_id = v_user;
  return jsonb_build_object('ok', true);
end $$;

-- (signed in all the way) The second step turned off on Account: its codes go with it.
create or replace function forget_two_step_codes() returns void
language sql security definer set search_path = public as $$
  delete from two_step_backup_code where user_id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- D1. "Runs out": how much a day, with its unit, rounded as people do
-- -----------------------------------------------------------------------------
-- 0029's alert_qty: ten or more whole, under ten to one place, under one to two.
create or replace function alert_qty(p_qty numeric) returns text
language sql immutable set search_path = public as $$
  select trim_scale(round(coalesce(p_qty, 0),
    case when abs(coalesce(p_qty, 0)) >= 10 then 0 when abs(coalesce(p_qty, 0)) >= 1 then 1 else 2 end))::text
$$;

alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0094;
revoke execute on function alert_conditions_0094(uuid, timestamptz) from public, anon, authenticated;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency,
         case when c.rule = 'running_out'
              then regexp_replace(c.title, ' (\S+) (\S+) left, using about (\S+) a day$',
                                  ' \1 \2 left, using about \3 \2 a day')
              else c.title end,
         c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0094(p_business, p_now) c
$$;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------
revoke execute on function business_has_records(uuid), place_name_ok(uuid, text, uuid), two_step_code_hash(text),
  alert_conditions(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function business_details(),
  update_business_details(text, text, text, text, int, text, text),
  add_place(location_kind, text, text, text, uuid), rename_place(uuid, text, text, text),
  set_place_active(uuid, boolean, text), make_two_step_codes(), two_step_codes_left(), use_two_step_code(text),
  forget_two_step_codes()
  from public, anon;
grant execute on function business_details(),
  update_business_details(text, text, text, text, int, text, text),
  add_place(location_kind, text, text, text, uuid), rename_place(uuid, text, text, text),
  set_place_active(uuid, boolean, text), make_two_step_codes(), two_step_codes_left(), use_two_step_code(text),
  forget_two_step_codes()
  to authenticated;
