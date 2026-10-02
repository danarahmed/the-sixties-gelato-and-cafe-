-- =============================================================================
-- 0065 — What a review of the releases since 0035 found, put right (3 of 4)
-- =============================================================================
-- Five reviews, one for each part of what 0035 to 0057 built, each finding
-- checked against the code before it was put right. 0063 to 0066 put right
-- what they found, each small enough to apply in one call; this one:
--
--  * Purchases (0038, 0049, 0055): a delivery's share still on the shelf forgot
--    what was used before a correction, and counted what went back as used; a
--    supplier's credit on its price was shared over what went back too, and
--    a credit on a delivery checked nothing of where the person works.
-- No table changes, and nothing recorded changes.

-- =============================================================================
-- 1. A delivery's share still on the shelf, and a supplier's credit on it
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

-- =============================================================================
-- 2. Who may call what
-- =============================================================================
-- The work behind each keyed write, and the helpers, are called inside the
-- database only.
revoke execute on function
  receipt_share_on_hand(uuid, uuid, uuid, uuid),
  record_supplier_credit__run(uuid, text, numeric, text, text, uuid, uuid, text)
  from public, anon, authenticated;
