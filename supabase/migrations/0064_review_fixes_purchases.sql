-- =============================================================================
-- 0064 — What a review of the releases since 0035 found, put right (2 of 2)
-- =============================================================================
-- The rest of what 0063 began, each finding checked against the code before it
-- was put right:
--
--  * Purchases (0038, 0044, 0049): a delivery's share still on the shelf
--    forgot what was used before a correction, and counted what went back as
--    used; a bill dated before its delivery put goods received not invoiced
--    below nothing for those days; a supplier settled by a credit could not be
--    taken out of use; an order whose delivery was reversed could not be
--    cancelled.
--  * The till (0024, 0055): an expense from the till or the safe dated an
--    earlier day put that day's drawer or safe out for good.
--  * Reports (0057): the café's staff cost counted the year-end close.
-- No table changes, and nothing recorded changes.

-- =============================================================================
-- 1. Purchases
-- =============================================================================
-- 0038's share of a delivery still on the shelf, from where its units first
-- came in: a correction's top-up started it again at all of it, forgetting
-- what was used before; and what went back to the supplier, from it or from
-- another delivery, was counted as used. Its own corrections and returns
-- change the delivery, not the share; another delivery's change neither.

create or replace function receipt_share_on_hand(p_business uuid, p_receipt uuid, p_item uuid, p_location uuid)
returns numeric language plpgsql stable set search_path = public as $$
declare k record; m record; v_s numeric; v_mine numeric; v_size numeric;
begin
  -- Where the delivery's units of the item first came in.
  select mv.occurred_at, mv.created_at, mv.id, mv.base_quantity_signed as q into k
    from inventory_movement mv
   where mv.business_id = p_business and mv.item_id = p_item and mv.location_id = p_location
     and mv.base_quantity_signed > 0
     and ((mv.reference_type = 'goods_receipt' and mv.reference_id = p_receipt)
          or (mv.reference_type = 'receipt_correction'
              and mv.reference_id in (select c.id from receipt_correction c where c.goods_receipt_id = p_receipt)
              and mv.type::text = 'receipt_correction'))
   order by mv.occurred_at, mv.created_at, mv.id
   limit 1;
  if not found then return 1; end if;
  v_mine := k.q; v_size := k.q;
  select coalesce(sum(base_quantity_signed), 0) into v_s
    from inventory_movement
   where business_id = p_business and item_id = p_item and location_id = p_location
     and (occurred_at, created_at, id) <= (k.occurred_at, k.created_at, k.id);
  for m in
    select mv.base_quantity_signed as q, mv.type::text as t,
           (mv.reference_type = 'goods_receipt' and mv.reference_id = p_receipt)
           or (mv.reference_type = 'receipt_correction' and mv.type::text = 'receipt_correction'
               and mv.reference_id in (select c.id from receipt_correction c where c.goods_receipt_id = p_receipt))
           or (mv.reference_type = 'supplier_return'
               and mv.reference_id in (select sr.id from supplier_return sr where sr.goods_receipt_id = p_receipt))
             as own,
           mv.reference_type = 'supplier_return'
             and mv.reference_id in (select sr.id from supplier_return sr
                                      where sr.goods_receipt_id is not null and sr.goods_receipt_id <> p_receipt)
             as other
      from inventory_movement mv
     where mv.business_id = p_business and mv.item_id = p_item and mv.location_id = p_location
       and (mv.occurred_at, mv.created_at, mv.id) > (k.occurred_at, k.created_at, k.id)
     order by mv.occurred_at, mv.created_at, mv.id
  loop
    if m.own then
      -- The delivery itself changed: corrected, or some of it sent back. Its
      -- units on the shelf and its size change with it; nothing was used.
      v_mine := greatest(v_mine + m.q, 0);
      v_size := v_size + m.q;
    elsif m.q < 0 and m.t not in ('cost_adjustment', 'receipt_correction') and not m.other then
      -- A use takes its share of every unit on the shelf. Another delivery's
      -- units sent back were that delivery's, as its corrections are.
      v_mine := case when v_s <= 0 then 0 else v_mine * greatest(0, (v_s + m.q) / v_s) end;
    end if;
    v_s := v_s + m.q;
  end loop;
  return case when v_size <= 0 then 0 else least(greatest(v_mine / v_size, 0), 1) end;
end $$;

-- 0049's supplier credit: checked against where the person works, and shared
-- over what of the delivery stayed (what went back is taken off each item).

create or replace function record_supplier_credit__run(p_supplier uuid, p_kind text, p_amount numeric,
                                                       p_supplier_ref text, p_reason text, p_receipt uuid,
                                                       p_bill uuid, p_account_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_me uuid := (current_member()).id;
  v_kind text := lower(nullif(trim(p_kind), '')); v_ref text := nullif(trim(p_supplier_ref), '');
  v_reason text := nullif(trim(p_reason), ''); v_amount numeric; v_day date; v_account text;
  r goods_receipt; v_state jsonb; b purchase_invoice; acct gl_account;
  v_id uuid := gen_random_uuid(); v_no bigint; v_journal uuid; v_lines jsonb; v_alloc numeric := 0;
  v_items uuid[]; v_values numeric[]; v_after numeric[]; v_worth numeric; v_taken numeric; i int; p record;
  v_share numeric; v_on numeric; v_stock numeric := 0; v_part numeric; v_moves jsonb := '[]'; x jsonb;
begin
  if v_kind is null or v_kind not in ('price', 'other', 'goods_return') then
    raise exception 'Say what the credit is for: a price, or other';
  end if;
  if v_kind = 'goods_return' then
    raise exception 'A return makes its own credit: record the supplier''s note on it instead';
  end if;
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business) then
    raise exception 'Choose a supplier';
  end if;
  if v_ref is null then raise exception 'Type the number on the supplier''s credit note'; end if;
  if exists (select 1 from supplier_credit where business_id = v_business and supplier_id = p_supplier
               and lower(supplier_ref) = lower(v_ref)) then
    raise exception 'Credit note % from this supplier is already recorded', v_ref;
  end if;
  if v_reason is null then raise exception 'Say what the credit is for'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  v_day := business_local_date(v_business, now());
  if p_bill is not null then
    select * into b from purchase_invoice where id = p_bill and business_id = v_business;
    if not found then raise exception 'Bill not found'; end if;
    if b.supplier_id <> p_supplier then raise exception 'That bill is from another supplier'; end if;
    if b.cancelled_at is not null then raise exception 'That bill was cancelled; it is not owed'; end if;
  end if;

  if v_kind = 'price' then
    if p_receipt is null then raise exception 'Choose the delivery the price was for'; end if;
    select * into r from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Delivery not found'; end if;
    -- Recorded by someone who works at the delivery's place (0055), stock moved or not (0063).
    perform assert_works_at(r.location_id);
    v_state := receipt_state(p_receipt);
    if (v_state ->> 'supplier_id')::uuid is distinct from p_supplier then
      raise exception 'Delivery % came from another supplier', coalesce(r.receipt_no::text, '');
    end if;
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'Delivery % was reversed: there is no price to reduce', r.receipt_no;
    end if;
    if p_bill is null then
      select * into b from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null;
    elsif b.goods_receipt_id is distinct from p_receipt then
      raise exception 'Bill % is not for delivery %', b.invoice_no, r.receipt_no;
    end if;
    if b.id is null then
      raise exception 'Delivery % is not billed yet: correct its price on Purchasing instead', r.receipt_no;
    end if;
    -- What the delivery is still worth to the supplier: each item's value less
    -- what of it went back (the credit is shared over what stayed, 0063), less
    -- earlier credits.
    select array_agg(g.item_id order by g.item_id), array_agg(g.v order by g.item_id), coalesce(sum(g.v), 0)
      into v_items, v_values, v_worth
      from (select d.item_id,
                   d.v - coalesce((select sum(sl.value) from supplier_return_line sl
                                     join supplier_return sr on sr.id = sl.supplier_return_id
                                    where sr.goods_receipt_id = p_receipt and sl.item_id = d.item_id), 0) as v
              from (select (e ->> 'item_id')::uuid as item_id, sum((e ->> 'landed')::numeric) as v
                      from jsonb_array_elements(v_state -> 'lines') e group by 1) d) g
     where g.v > 0;
    v_taken := coalesce((select sum(amount) from supplier_credit where goods_receipt_id = p_receipt and kind = 'price'), 0);
    if v_worth - v_taken <= 0 or v_amount > v_worth - v_taken then
      raise exception 'That is more than delivery % is still worth (%)', r.receipt_no,
        trim_scale(greatest(v_worth - v_taken, 0));
    end if;
    -- Shared over its items by value; each item's share still on hand revalues it, the rest is variance.
    v_after := allocate_landed(v_business, v_values, -v_amount);
    perform lock_items(v_items);
    for i in 1 .. cardinality(v_items) loop
      v_share := v_values[i] - v_after[i];
      p := item_position(v_business, v_items[i], r.location_id);
      v_on := receipt_share_on_hand(v_business, p_receipt, v_items[i], r.location_id);
      v_part := case when p.qty > 0 and p.value > 0
                     then least(money_round(v_business, v_share * v_on), p.value) else 0 end;
      if v_part > 0 then
        v_moves := v_moves || jsonb_build_object('item_id', v_items[i], 'qty', p.qty, 'from', p.value,
                                                 'to', p.value - v_part);
      end if;
      v_stock := v_stock + v_part;
    end loop;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line('1200', -v_stock),
                                 signed_line('5050', v_stock - v_amount));
  else
    v_account := coalesce(nullif(trim(p_account_code), ''), b.expense_account_code);
    if v_account is null then raise exception 'Choose the account the credit is taken off'; end if;
    select * into acct from gl_account where business_id = v_business and code = v_account and is_active;
    if not found or acct.account_type not in ('expense', 'asset')
       or v_account in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '1300', '5000', '5300', '5310',
                       '5400') then
      raise exception 'Account % cannot take a supplier''s credit', v_account;
    end if;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line(v_account, -v_amount));
  end if;

  v_no := next_document_no(v_business, 'supplier_credit', 1);
  v_journal := post_journal(v_business, now(),
    'Credit ' || v_no || ' from ' || (select name from supplier where id = p_supplier) || ' (' || v_ref || '): ' || v_reason,
    'supplier_credit', v_id, v_lines, null, v_ref);
  insert into supplier_credit (id, business_id, credit_no, supplier_id, kind, amount, credit_date, supplier_ref, reason,
                               goods_receipt_id, purchase_invoice_id, account_code, journal_entry_id, matched_at,
                               matched_by, created_by)
  values (v_id, v_business, v_no, p_supplier, v_kind, v_amount, v_day, v_ref, v_reason, p_receipt, b.id, v_account,
          v_journal, now(), v_me, v_me);
  for x in select * from jsonb_array_elements(v_moves) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, (x ->> 'item_id')::uuid, r.location_id, 'cost_adjustment', -(x ->> 'qty')::numeric,
            (x ->> 'from')::numeric / (x ->> 'qty')::numeric, (x ->> 'from')::numeric,
            'supplier_credit', v_id, v_me, 'Revalued: credit ' || v_no || ' on delivery ' || r.receipt_no),
           (v_business, (x ->> 'item_id')::uuid, r.location_id, 'cost_adjustment', (x ->> 'qty')::numeric,
            (x ->> 'to')::numeric / (x ->> 'qty')::numeric, (x ->> 'to')::numeric,
            'supplier_credit', v_id, v_me, 'Revalued: credit ' || v_no || ' on delivery ' || r.receipt_no);
  end loop;
  if b.id is not null then
    v_alloc := set_credit_against(v_business, v_id, b.id, null, v_me, false);
  end if;
  perform audit_event(v_business, 'purchase.credit', 'supplier_credit', v_id::text, v_reason, null,
    jsonb_build_object('credit_no', v_no, 'supplier', p_supplier, 'credit_kind', v_kind, 'amount', v_amount,
                       'supplier_ref', v_ref, 'receipt_no', r.receipt_no, 'bill', b.invoice_no,
                       'account', v_account, 'stock_change', -v_stock, 'set_against_bill', v_alloc));
  return jsonb_build_object('credit_id', v_id, 'credit_no', v_no, 'kind', v_kind, 'amount', v_amount,
    'stock', -v_stock, 'variance', case when v_kind = 'price' then v_stock - v_amount else 0 end,
    'set_against_bill', v_alloc, 'bill_no', b.invoice_no,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- 0049's bill, dated no earlier than the delivery it is for came.

create or replace function record_bill__run(
  p_supplier uuid, p_invoice_no text, p_invoice_date date, p_amount numeric, p_term_days int default 0,
  p_receipt uuid default null, p_account_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_amount numeric; v_grni numeric; v_legacy numeric; v_ppv numeric; v_bill uuid; v_journal uuid; v_lines jsonb;
  v_acct gl_account; v_state jsonb;
  v_no text := nullif(trim(p_invoice_no), '');
begin
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business) then
    raise exception 'Choose a supplier';
  end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if (p_receipt is null) = (p_account_code is null) then
    raise exception 'A bill is either for a goods receipt or for an expense account — choose one';
  end if;
  if v_no is null then
    v_no := bill_number_take(v_business);
  elsif is_own_bill_number(v_business, v_no) then
    raise exception 'Numbers like % are the café''s own and are given automatically: leave the box as it is, or type the supplier''s invoice number', v_no;
  end if;
  -- Against every bill ever entered, including those before the controls (M-07).
  if exists (select 1 from purchase_invoice where business_id = v_business and supplier_id = p_supplier
               and lower(invoice_no) = lower(v_no) and cancelled_at is null) then
    raise exception 'Invoice % from this supplier is already recorded', v_no;
  end if;

  v_bill := gen_random_uuid();
  if p_receipt is not null then
    perform 1 from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Receipt not found'; end if;
    v_state := receipt_state(p_receipt);
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'That delivery was reversed: there is nothing to bill';
    end if;
    -- The old app did not record the supplier on a receipt; any supplier may bill those.
    if (v_state ->> 'supplier_id') is not null and (v_state ->> 'supplier_id')::uuid <> p_supplier then
      raise exception 'That receipt is from a different supplier';
    end if;
    if exists (select 1 from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null) then
      raise exception 'That receipt has already been billed';
    end if;
    -- Not dated before the goods came: it clears what their receipt raised,
    -- and before it there is nothing to clear (0063).
    if coalesce(p_invoice_date, business_local_date(v_business, now())) < (v_state ->> 'received_on')::date then
      raise exception 'Delivery % came on %: date its bill that day or later',
        (select receipt_no from goods_receipt where id = p_receipt), v_state ->> 'received_on';
    end if;
    v_grni := receipt_grni_value(p_receipt);
    if v_grni <= 0 and exists (select 1 from supplier_return where goods_receipt_id = p_receipt and against = 'delivery') then
      raise exception 'Everything delivery % brought went back to the supplier: there is nothing to bill',
        (select receipt_no from goods_receipt where id = p_receipt);
    end if;
    if v_grni > 0 then
      v_ppv := v_amount - v_grni;
      v_lines := jsonb_build_array(
        jsonb_build_object('code', '2050', 'debit', v_grni),
        jsonb_build_object('code', '5050', 'debit', greatest(v_ppv, 0), 'credit', greatest(-v_ppv, 0)),
        jsonb_build_object('code', '2000', 'credit', v_amount));
    else
      v_legacy := receipt_legacy_payable(p_receipt);
      if v_legacy <= 0 then
        raise exception 'That receipt has no payable to bill against: its journal was reversed or never written (see docs/REMEDIATION.md)';
      end if;
      v_ppv := v_amount - v_legacy;
      v_lines := case when v_ppv <> 0 then jsonb_build_array(
        jsonb_build_object('code', '5050', 'debit', greatest(v_ppv, 0), 'credit', greatest(-v_ppv, 0)),
        jsonb_build_object('code', '2000', 'debit', greatest(-v_ppv, 0), 'credit', greatest(v_ppv, 0))) end;
    end if;
  else
    select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
    if not found or v_acct.account_type not in ('expense', 'asset')
       or p_account_code in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '1300', '5000', '5050',
                          '5300', '5310', '5400') then
      raise exception 'Account % cannot take a bill; stock is billed against its goods receipt', p_account_code;
    end if;
    v_lines := jsonb_build_array(
      jsonb_build_object('code', p_account_code, 'debit', v_amount),
      jsonb_build_object('code', '2000', 'credit', v_amount));
  end if;

  if v_lines is not null then
    v_journal := post_journal(v_business, (coalesce(p_invoice_date, business_local_date(v_business, now())) + time '12:00')
                                            at time zone (select timezone from business where id = v_business),
      'Bill ' || v_no, 'purchase_invoice', v_bill, v_lines, null, v_no);
  end if;
  insert into purchase_invoice (id, business_id, supplier_id, invoice_no, invoice_date, due_date, amount_total,
                                goods_receipt_id, expense_account_code, journal_entry_id)
  values (v_bill, v_business, p_supplier, v_no,
          coalesce(p_invoice_date, business_local_date(v_business, now())),
          coalesce(p_invoice_date, business_local_date(v_business, now())) + greatest(coalesce(p_term_days, 0), 0),
          v_amount, p_receipt, p_account_code, v_journal);
  return jsonb_build_object('bill_id', v_bill, 'invoice_no', v_no,
                            'journal_no', (select journal_no from journal_entry where id = v_journal),
                            'price_variance', coalesce(v_ppv, 0));
end $$;

-- 0029's supplier change: what is owed is what the bills still owe, credits
-- set against them counted as payments are.

create or replace function update_supplier(p_supplier uuid, p_name text, p_contact text default null,
                                           p_phone text default null, p_is_active boolean default true,
                                           p_reason text default null, p_lead_time_days int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('purchase.create'); s supplier; v_owed numeric;
begin
  select * into s from supplier where id = p_supplier and business_id = v_business for update;
  if not found then raise exception 'Unknown supplier'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Name the supplier'; end if;
  if p_lead_time_days is not null and p_lead_time_days not between 0 and 30 then
    raise exception 'A delivery takes 0 to 30 days';
  end if;
  if coalesce(p_is_active, true) then perform assert_name_free(v_business, 'supplier', p_name, p_supplier); end if;
  if not coalesce(p_is_active, true) and s.is_active then
    -- What the bills still owe: payments and credits set against them both count (0063).
    select coalesce(sum(amount_total - paid_amount), 0) into v_owed
      from purchase_invoice where supplier_id = p_supplier and cancelled_at is null;
    if v_owed > 0 then
      raise exception '% is still owed %: pay or cancel their bills before taking them out of use', s.name, trim_scale(v_owed);
    end if;
  end if;
  perform set_config('audit.reason', coalesce(trim(p_reason), ''), true);
  update supplier
     set name = trim(p_name), contact = nullif(trim(p_contact), ''), phone = nullif(trim(p_phone), ''),
         is_active = coalesce(p_is_active, true), lead_time_days = p_lead_time_days
   where id = p_supplier;
  perform set_config('audit.reason', '', true);
end $$;

-- 0044's order: how far it has come, and whether it can be cancelled, by what
-- came and stayed, not by whether a delivery was ever recorded against it.

create or replace function po_view(p_po uuid) returns jsonb
language sql stable set search_path = public as $$
  with po as (select * from purchase_order where id = p_po),
  lines as (
    select l.*, i.name as item_name, i.base_unit_code, coalesce(g.base_qty, 0) as received_base,
           greatest(l.base_qty - coalesce(g.base_qty, 0), 0) as outstanding_base
      from purchase_order_line l join item i on i.id = l.item_id
      left join po_received(p_po) g on g.item_id = l.item_id
     where l.purchase_order_id = p_po
  )
  select jsonb_build_object(
    'id', po.id, 'po_no', po.po_no, 'status', po.status,
    'receiving', case when not exists (select 1 from po_received(p_po) g where g.base_qty > 0) then 'none'
                      when exists (select 1 from lines where outstanding_base > 0) then 'part'
                      else 'all' end,
    'supplier_id', po.supplier_id, 'supplier', (select name from supplier where id = po.supplier_id),
    'location_id', po.location_id, 'location', (select name from location where id = po.location_id),
    'expected_on', po.expected_on, 'note', po.note, 'total', po.total,
    'created_at', po.ordered_at, 'created_by', (select full_name from app_user where id = po.created_by),
    'approved_at', po.approved_at, 'approved_by', (select full_name from app_user where id = po.approved_by),
    'sent_at', po.sent_at, 'sent_by', (select full_name from app_user where id = po.sent_by),
    'closed_at', po.closed_at, 'closed_by', (select full_name from app_user where id = po.closed_by),
    'close_reason', po.close_reason,
    'cancelled_at', po.cancelled_at, 'cancelled_by', (select full_name from app_user where id = po.cancelled_by),
    'cancel_reason', po.cancel_reason,
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
                'line_id', l.id, 'line_no', l.line_no, 'item_id', l.item_id, 'item', l.item_name,
                'qty', l.order_qty, 'unit_code', l.order_unit_code, 'unit_price', l.unit_price,
                'amount', money_round(po.business_id, l.order_qty * l.unit_price),
                'base_qty', l.base_qty, 'base_unit', l.base_unit_code,
                'received_base', l.received_base, 'outstanding_base', l.outstanding_base)
              order by l.line_no) from lines l), '[]'::jsonb),
    'unexpected', coalesce((select jsonb_agg(jsonb_build_object('item_id', g.item_id, 'item', i.name,
                                                                'base_qty', g.base_qty, 'base_unit', i.base_unit_code)
                                             order by i.name)
                              from po_received(p_po) g join item i on i.id = g.item_id
                             where not exists (select 1 from lines l where l.item_id = g.item_id)
                               and g.base_qty <> 0), '[]'::jsonb),
    'deliveries', coalesce((select jsonb_agg(jsonb_build_object('receipt_id', r.id, 'receipt_no', r.receipt_no,
                                                                'received_at', r.received_at)
                                             order by r.received_at, r.receipt_no)
                              from goods_receipt r where r.purchase_order_id = p_po), '[]'::jsonb))
  from po
$$;

create or replace function cancel_po__run(p_po uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'purchase.approve');
  v_me uuid := (current_member()).id;
  o purchase_order; v_reason text := nullif(trim(p_reason), '');
begin
  if v_reason is null then raise exception 'Say why the order is being cancelled'; end if;
  select * into o from purchase_order where id = p_po and business_id = v_business for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status in ('closed', 'cancelled') then raise exception 'Order % is not open', o.po_no; end if;
  -- What came and stayed: a delivery reversed brought nothing (0063).
  if exists (select 1 from po_received(o.id) g where g.base_qty > 0) then
    raise exception 'Goods have come against order %: close it instead', o.po_no;
  end if;
  update purchase_order set status = 'cancelled', cancelled_by = v_me, cancelled_at = now(),
                            cancel_reason = v_reason, updated_at = now()
   where id = o.id;
  perform audit_event(v_business, 'purchase.order.cancel', 'purchase_order', o.id::text, v_reason,
    jsonb_build_object('status', o.status), jsonb_build_object('po_no', o.po_no, 'total', o.total));
  return jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'status', 'cancelled');
end $$;

-- =============================================================================
-- 2. Money from the till or the safe, recorded the day it is taken out
-- =============================================================================
-- The drawer's and the safe's own records are written when the money moves;
-- the journal took the date chosen. An expense from either dated an earlier
-- day, or the reversal of a journal that moved their cash dated so, put that
-- day out for good, and its month could not be locked.
alter function record_expense__run(text, numeric, text, text, date, uuid) rename to record_expense__run_0055;
create function record_expense__run(p_description text, p_amount numeric, p_account_code text,
                                    p_paid_from text default 'cash', p_date date default null,
                                    p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(p_paid_from, '')) in ('cash', 'till', 'safe') and p_date is not null
     and p_date <> business_local_date(current_business_id(), now()) then
    raise exception 'Money from the till or the safe is recorded the day it is taken out: today';
  end if;
  return record_expense__run_0055(p_description, p_amount, p_account_code, p_paid_from, p_date, p_location);
end $$;

alter function reverse_journal__run(uuid, text, date) rename to reverse_journal__run_0035;
create function reverse_journal__run(p_entry uuid, p_reason text, p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_date is not null and p_date <> business_local_date(current_business_id(), now())
     and exists (select 1 from journal_line l join gl_account a on a.id = l.account_id
                  where l.journal_entry_id = p_entry and a.code in ('1000', '1001', '1005', '1006')) then
    raise exception 'A journal that moved the till''s or the safe''s cash is reversed today, when they count it';
  end if;
  return reverse_journal__run_0035(p_entry, p_reason, p_date);
end $$;

-- =============================================================================
-- 3. The staff's cost without the year-end close
-- =============================================================================
-- 0057's staff report: the café's whole cost of staff left the year-end
-- close out, as each place's did, so December's is not minus the year's.

create or replace function report_staff(p_from date, p_to date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage', 'attendance.edit', 'payroll.view');
  v_pay boolean := current_has_permission('payroll.view');
  v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Choose the dates, the first before the last'; end if;
  if p_to - p_from > 366 then raise exception 'Choose up to a year'; end if;
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
               'employee_id', e.id, 'name', e.full_name, 'title', e.title,
               'days_scheduled', x.scheduled, 'days_worked', x.worked, 'minutes', x.minutes,
               'overtime_minutes', x.overtime, 'times_late', x.late, 'minutes_late', x.late_minutes,
               'times_early', x.early, 'minutes_early', x.early_minutes, 'days_absent', x.absent)
             order by e.full_name)
        from (select d.employee_id, count(*) filter (where d.shift_starts is not null) as scheduled,
                     count(*) filter (where d.minutes > 0) as worked, coalesce(sum(d.minutes), 0) as minutes,
                     coalesce(sum(d.overtime_minutes), 0) as overtime,
                     count(*) filter (where d.late_minutes is not null) as late,
                     coalesce(sum(d.late_minutes), 0) as late_minutes,
                     count(*) filter (where d.early_minutes is not null) as early,
                     coalesce(sum(d.early_minutes), 0) as early_minutes,
                     count(*) filter (where d.absent) as absent
                from staff_days(v_business, p_from, p_to) d group by d.employee_id) x
        join employee e on e.id = x.employee_id
       where v_loc is null or e.location_id = v_loc), '[]'::jsonb),
    -- What staff cost (6100, by the month its journals are dated in) against
    -- the month's sales: only for those who see payroll.
    'labour', case when v_pay then coalesce((
      select jsonb_agg(jsonb_build_object('month', m.month, 'cost', m.cost, 'sales', m.sales,
                                          'percent', case when m.sales > 0 then round(100 * m.cost / m.sales, 1) end)
                       order by m.month)
        from (select mm.month,
                     case when v_loc is null
                          then coalesce((select sum(l.debit - l.credit) from journal_line l
                                           join journal_entry j on j.id = l.journal_entry_id
                                           join gl_account g on g.id = l.account_id
                                          where j.business_id = v_business and j.status = 'published' and g.code = '6100'
                                            and not year_end_entry(j)
                                            and business_local_date(v_business, j.occurred_at)
                                                between mm.month and (mm.month + interval '1 month - 1 day')::date), 0)
                          -- A place's: its share of each payroll (0056).
                          else coalesce((select sum(p.amount)
                                           from local_day_bounds(v_business, mm.month,
                                                                 (mm.month + interval '1 month - 1 day')::date) lb,
                                                pnl_by_place(v_business, lb.from_ts, lb.to_ts) p
                                           join gl_account g on g.id = p.account_id
                                          where g.code = '6100' and p.location_id = v_loc), 0) end as cost,
                     coalesce((select sum(o.net_amount) from sales_order o
                                where o.business_id = v_business and o.status not in ('voided', 'open')
                                  and (v_loc is null or o.location_id = v_loc)
                                  and business_local_date(v_business, o.placed_at)
                                      between mm.month and (mm.month + interval '1 month - 1 day')::date), 0)
                     - coalesce((select sum(a.amount) from sale_adjustment a
                                  where a.business_id = v_business and a.kind = 'refund'
                                    and (v_loc is null or exists (select 1 from sales_order o
                                                                   where o.id = a.sales_order_id and o.location_id = v_loc))
                                    and business_local_date(v_business, a.created_at)
                                        between mm.month and (mm.month + interval '1 month - 1 day')::date), 0) as sales
                from (select generate_series(date_trunc('month', p_from), date_trunc('month', p_to),
                                             interval '1 month')::date as month) mm) m), '[]'::jsonb) end);
end $$;

-- =============================================================================
-- 4. Who may call what
-- =============================================================================
-- The work behind each keyed write, and the helpers, are called inside the
-- database only; the old versions kept their closed doors when renamed.
revoke execute on function
  receipt_share_on_hand(uuid, uuid, uuid, uuid),
  record_supplier_credit__run(uuid, text, numeric, text, text, uuid, uuid, text),
  record_bill__run(uuid, text, date, numeric, int, uuid, text),
  po_view(uuid),
  cancel_po__run(uuid, text),
  record_expense__run(text, numeric, text, text, date, uuid),
  reverse_journal__run(uuid, text, date)
  from public, anon, authenticated;
