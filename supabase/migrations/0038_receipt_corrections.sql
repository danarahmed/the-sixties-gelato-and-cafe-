-- =============================================================================
-- 0038 — Correcting a delivery, and the books checked account by account
--        (release M)
--
-- Until now a delivery entered wrongly (its quantities, prices or items, its
-- supplier or its date) could only be put right by hand, and the books were
-- checked against four subledgers (docs/COMPLETION_PLAN.md, B18, D10). Now:
--   * A delivery is corrected by a document of its own, numbered, keeping the
--     delivery as it was and as it is now, the reason and what it moved; what
--     was entered first is never changed. Stock moves by what the correction
--     changes, goods received not invoiced (2050) by the difference in value,
--     and the part of a price difference whose stock has been used already
--     goes to purchase price variance (5050): those costs are posted.
--   * A delivery that should not exist is reversed the same way.
--   * A billed delivery is corrected once its bill is cancelled; an item
--     counted since keeps the count's quantity; a delivery in a locked month
--     is not corrected; stock taken below zero needs a confirmation.
--   * The books are checked against the card takings (1010), what the
--     platforms owe (1100), what the drawers should hold (1000), the safe
--     (1005), and the records themselves: every record has its one journal
--     and every automatic journal its record. The month's checklist blocks
--     the lock on each. The safe takes no manual journal.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Two kinds of stock movement
-- ---------------------------------------------------------------------------
-- receipt_correction: stock in or out because a delivery was corrected.
-- cost_adjustment: stock revalued, as a pair at one moment: what is on hand
-- out at its value, and back in at its corrected value. Nothing that adds up
-- stock by quantity and value needs to know about it. (Added here, used from
-- the next transaction on: nothing in this migration writes them.)
alter type movement_type add value if not exists 'receipt_correction';
alter type movement_type add value if not exists 'cost_adjustment';

-- ---------------------------------------------------------------------------
-- 2. Corrections, as documents
-- ---------------------------------------------------------------------------
create table if not exists receipt_correction (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business (id) on delete cascade,
  correction_no    bigint not null,
  goods_receipt_id uuid not null references goods_receipt (id),
  -- What changed: quantity, price, item, supplier, date, or reversed.
  kinds            text[] not null,
  reason           text not null,
  -- The delivery as it stood before, and as it stands after: its supplier,
  -- date, landed costs and lines (each with its quantity, base quantity,
  -- goods value and landed value).
  before_state     jsonb not null,
  after_state      jsonb not null,
  -- Item by item: the stock, its value, 2050 and 5050 as the correction moved them.
  effects          jsonb not null default '[]'::jsonb,
  journal_entry_id uuid references journal_entry (id),
  created_by       uuid references app_user (id),
  created_at       timestamptz not null default now()
);
create unique index if not exists receipt_correction_no on receipt_correction (business_id, correction_no);
create index if not exists receipt_correction_receipt_idx on receipt_correction (goods_receipt_id, correction_no);

alter table receipt_correction enable row level security;
alter table receipt_correction force row level security;
drop policy if exists cost_read on receipt_correction;
create policy cost_read on receipt_correction for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
grant select on receipt_correction to authenticated;
drop trigger if exists receipt_correction_append_only on receipt_correction;
create trigger receipt_correction_append_only before update or delete on receipt_correction
  for each row execute function forbid_mutation();

-- ---------------------------------------------------------------------------
-- 3. A delivery as it stands
-- ---------------------------------------------------------------------------
-- As it was received: each line with its quantity in the base unit and its
-- landed value, as its stock movement recorded them.
create or replace function receipt_original_state(p_receipt uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'supplier_id', r.supplier_id,
    'received_on', business_local_date(r.business_id, r.received_at),
    'freight', r.freight_total, 'other', r.other_landed_total, 'rebate', r.rebate_total,
    'reversed', false,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'line_id', gl.id, 'item_id', gl.item_id, 'qty', gl.received_qty, 'unit_code', gl.received_unit_code,
               'base_qty', coalesce(m.base_quantity_signed, to_base_qty(gl.item_id, gl.received_qty, gl.received_unit_code)),
               'goods_value', gl.goods_value, 'landed', coalesce(m.value, gl.goods_value))
             order by gl.id)
        from goods_receipt_line gl left join inventory_movement m on m.id = gl.movement_id
       where gl.goods_receipt_id = r.id), '[]'::jsonb))
    from goods_receipt r where r.id = p_receipt
$$;

-- As its latest correction left it, or as it was received.
create or replace function receipt_state(p_receipt uuid) returns jsonb
language sql stable set search_path = public as $$
  select coalesce((select c.after_state from receipt_correction c where c.goods_receipt_id = p_receipt
                    order by c.correction_no desc limit 1),
                  receipt_original_state(p_receipt))
$$;

-- The GRNI a delivery has raised (what its bill must clear), its corrections
-- included, as of a moment.
create or replace function receipt_grni_value_at(p_receipt uuid, p_at timestamptz) returns numeric
language sql stable set search_path = public as $$
  select coalesce((select sum(jl.credit)
                     from journal_entry je
                     join journal_line jl on jl.journal_entry_id = je.id
                     join gl_account a on a.id = jl.account_id and a.code = '2050'
                    where je.reference_type = 'goods_receipt' and je.reference_id = p_receipt
                      and je.status = 'published' and je.reverses_entry is null and je.occurred_at < p_at), 0)
       + coalesce((select sum(jl.credit - jl.debit)
                     from receipt_correction c
                     join journal_entry je on je.id = c.journal_entry_id
                     join journal_line jl on jl.journal_entry_id = je.id
                     join gl_account a on a.id = jl.account_id and a.code = '2050'
                    where c.goods_receipt_id = p_receipt and je.status = 'published' and je.occurred_at < p_at), 0)
$$;

create or replace function receipt_grni_value(p_receipt uuid) returns numeric
language sql stable set search_path = public as $$
  select receipt_grni_value_at(p_receipt, 'infinity')
$$;

-- ---------------------------------------------------------------------------
-- 4. The correction
-- ---------------------------------------------------------------------------
-- How much of the value a delivery brought in is still on the shelf, as the
-- moving average carries it: every unit used since took its share of every
-- cost in the stock, so the share left is the product, over each use, of
-- what it left of the stock before it. 1 when nothing has been used; 0 once
-- the stock ran out. Revaluations and corrections are not uses.
create or replace function receipt_share_on_hand(p_business uuid, p_receipt uuid, p_item uuid, p_location uuid)
returns numeric language plpgsql stable set search_path = public as $$
declare k record; m record; v_s numeric; v_share numeric := 1;
begin
  select mv.occurred_at, mv.created_at, mv.id into k
    from inventory_movement mv
   where mv.business_id = p_business and mv.item_id = p_item and mv.location_id = p_location
     and mv.base_quantity_signed > 0
     and ((mv.reference_type = 'goods_receipt' and mv.reference_id = p_receipt)
          or (mv.reference_type = 'receipt_correction'
              and mv.reference_id in (select c.id from receipt_correction c where c.goods_receipt_id = p_receipt)
              and mv.type::text = 'receipt_correction'))
   order by mv.occurred_at desc, mv.created_at desc, mv.id desc
   limit 1;
  if not found then return 1; end if;
  select coalesce(sum(base_quantity_signed), 0) into v_s
    from inventory_movement
   where business_id = p_business and item_id = p_item and location_id = p_location
     and (occurred_at, created_at, id) <= (k.occurred_at, k.created_at, k.id);
  for m in
    select base_quantity_signed as q, type::text as t
      from inventory_movement
     where business_id = p_business and item_id = p_item and location_id = p_location
       and (occurred_at, created_at, id) > (k.occurred_at, k.created_at, k.id)
     order by occurred_at, created_at, id
  loop
    if m.q < 0 and m.t not in ('cost_adjustment', 'receipt_correction') then
      if v_s <= 0 then
        v_share := 0;
      else
        v_share := v_share * greatest(0, (v_s + m.q) / v_s);
      end if;
    end if;
    v_s := v_s + m.q;
    exit when v_share = 0;
  end loop;
  return v_share;
end $$;

-- The delivery as corrected, from the lines typed: checked as a delivery's
-- are, with the landed costs shared out again over the lines by value.
create or replace function receipt_after_state(p_business uuid, p_receipt uuid, p_before jsonb, p_lines jsonb,
                                              p_supplier uuid, p_received_on date)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  r goods_receipt; l jsonb; it item; v_old jsonb; v_line uuid; v_ids uuid[] := '{}';
  v_value numeric; v_unit text; v_lines jsonb := '[]'; v_goods numeric[] := '{}'; v_landed numeric[];
  v_supplier uuid; v_on date; v_recorded date;
begin
  select * into r from goods_receipt where id = p_receipt;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A delivery keeps at least one line: to undo all of it, reverse it';
  end if;
  v_supplier := coalesce(p_supplier, (p_before ->> 'supplier_id')::uuid);
  if v_supplier is distinct from (p_before ->> 'supplier_id')::uuid
     and not exists (select 1 from supplier where id = v_supplier and business_id = p_business and is_active) then
    raise exception 'Choose an active supplier';
  end if;
  v_recorded := business_local_date(p_business, r.received_at);
  v_on := coalesce(p_received_on, (p_before ->> 'received_on')::date);
  if v_on > business_local_date(p_business, now()) then
    raise exception 'A delivery cannot have arrived after today';
  end if;
  if date_trunc('month', v_on) <> date_trunc('month', v_recorded) then
    raise exception 'A delivery''s date is corrected within the month it was entered (%): one from another month is reversed and received again',
      to_char(v_recorded, 'YYYY-MM');
  end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(l) <> 'object' then raise exception 'The lines cannot be read'; end if;
    select * into it from item where id = nullif(l ->> 'item_id', '')::uuid and business_id = p_business;
    if not found then raise exception 'Unknown item on the delivery'; end if;
    v_line := nullif(l ->> 'line_id', '')::uuid;
    v_old := null;
    if v_line is not null then
      select x into v_old from jsonb_array_elements(p_before -> 'lines') x where (x ->> 'line_id')::uuid = v_line;
      if v_old is null then raise exception 'That line is not on this delivery'; end if;
      if v_line = any (v_ids) then raise exception 'A line is named twice'; end if;
    else
      v_line := gen_random_uuid();
    end if;
    -- An item already on the line may since have gone out of use; a new one may not.
    if not it.is_active and (v_old is null or (v_old ->> 'item_id')::uuid <> it.id) then
      raise exception '% is out of use: bring it back into use first', it.name;
    end if;
    v_ids := v_ids || v_line;
    if coalesce(nullif(l ->> 'qty', '')::numeric, 0) <= 0 then
      raise exception 'Every line needs a quantity: to take a line off, leave it out';
    end if;
    v_value := case when nullif(l ->> 'unit_price', '') is not null
                    then (l ->> 'unit_price')::numeric * (l ->> 'qty')::numeric
                    else nullif(l ->> 'goods_value', '')::numeric end;
    if coalesce(v_value, -1) < 0 then raise exception 'Every line needs a price'; end if;
    v_unit := coalesce(nullif(l ->> 'unit_code', ''), it.base_unit_code);
    v_goods := v_goods || money_round(p_business, v_value);
    v_lines := v_lines || jsonb_build_object(
      'line_id', v_line, 'item_id', it.id, 'qty', (l ->> 'qty')::numeric, 'unit_code', v_unit,
      'base_qty', to_base_qty(it.id, (l ->> 'qty')::numeric, v_unit), 'goods_value', money_round(p_business, v_value));
  end loop;
  v_landed := allocate_landed(p_business, v_goods,
                              coalesce((p_before ->> 'freight')::numeric, 0) + coalesce((p_before ->> 'other')::numeric, 0)
                              - coalesce((p_before ->> 'rebate')::numeric, 0));
  select jsonb_agg(x || jsonb_build_object('landed', v_landed[n]::numeric) order by n) into v_lines
    from jsonb_array_elements(v_lines) with ordinality as t(x, n);
  return jsonb_build_object('supplier_id', v_supplier, 'received_on', v_on,
    'freight', p_before -> 'freight', 'other', p_before -> 'other', 'rebate', p_before -> 'rebate',
    'reversed', false, 'lines', v_lines);
end $$;

-- What changed between two states of a delivery.
create or replace function receipt_change_kinds(p_before jsonb, p_after jsonb) returns text[]
language plpgsql immutable set search_path = public as $$
declare v text[] := '{}'; b jsonb; a jsonb;
begin
  if coalesce((p_after ->> 'reversed')::boolean, false) then return array['reversed']; end if;
  if (p_after ->> 'supplier_id') is distinct from (p_before ->> 'supplier_id') then v := v || 'supplier'::text; end if;
  if (p_after ->> 'received_on') is distinct from (p_before ->> 'received_on') then v := v || 'date'::text; end if;
  for b in select * from jsonb_array_elements(p_before -> 'lines') loop
    select x into a from jsonb_array_elements(p_after -> 'lines') x where x ->> 'line_id' = b ->> 'line_id';
    if a is null then
      v := v || 'quantity'::text;
    else
      if a ->> 'item_id' <> b ->> 'item_id' then v := v || 'item'::text;
      else
        if (a ->> 'base_qty')::numeric <> (b ->> 'base_qty')::numeric then v := v || 'quantity'::text; end if;
        -- The price of one, as typed.
        if (a ->> 'goods_value')::numeric * (b ->> 'qty')::numeric
           <> (b ->> 'goods_value')::numeric * (a ->> 'qty')::numeric
           or (a ->> 'unit_code') <> (b ->> 'unit_code') and (a ->> 'goods_value') <> (b ->> 'goods_value') then
          v := v || 'price'::text;
        end if;
      end if;
    end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_after -> 'lines') x
              where not exists (select 1 from jsonb_array_elements(p_before -> 'lines') y where y ->> 'line_id' = x ->> 'line_id')) then
    v := v || 'quantity'::text;
  end if;
  return (select coalesce(array_agg(distinct k order by k), '{}') from unnest(v) k);
end $$;

-- What a correction does, item by item, as the stock stands now. For each
-- item on the delivery before or after:
--   * the price of what was received changes by dp = (what the old quantity
--     comes to at the new price) - (its old value); the share of it still on
--     the shelf revalues the stock, the rest goes to 5050;
--   * the quantity changes by dq units, moved at the new price where the
--     delivery's stock is still on the shelf, and at the stock's average where
--     it has been used (the average is what it was used at);
--   * the stock is never left with a value below nothing, nor with a value
--     when nothing is left: what cannot stay in the stock goes to 5050;
--   * 2050 changes by the difference in landed value; 5050 takes what 2050
--     moved and the stock did not.
create or replace function receipt_correction_plan(p_business uuid, p_receipt uuid, p_before jsonb, p_after jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  r goods_receipt; x record; p record; v_share numeric; c numeric; c1 numeric; cs numeric;
  dp numeric; dq numeric; a_now numeric; u numeric; s_price numeric; s_qty numeric;
  q1 numeric; v_nat numeric; v1 numeric; m numeric; v_mid numeric; v_moves jsonb; v_ds numeric; v_dg numeric;
  v_items jsonb := '[]'; v_below jsonb := '[]'; v_counted jsonb := '[]'; t_s numeric := 0; t_g numeric := 0;
begin
  select * into r from goods_receipt where id = p_receipt;
  for x in
    with b as (select (e ->> 'item_id')::uuid as item_id, sum((e ->> 'base_qty')::numeric) as q,
                      sum((e ->> 'landed')::numeric) as v
                 from jsonb_array_elements(coalesce(p_before -> 'lines', '[]'::jsonb)) e group by 1),
         a as (select (e ->> 'item_id')::uuid as item_id, sum((e ->> 'base_qty')::numeric) as q,
                      sum((e ->> 'landed')::numeric) as v
                 from jsonb_array_elements(coalesce(p_after -> 'lines', '[]'::jsonb)) e group by 1)
    select i.id as item_id, i.name, i.base_unit_code as unit,
           coalesce(b.q, 0) as bq, coalesce(b.v, 0) as bv, coalesce(a.q, 0) as aq, coalesce(a.v, 0) as av
      from a full join b on b.item_id = a.item_id
      join item i on i.id = coalesce(a.item_id, b.item_id)
     order by i.name, i.id
  loop
    continue when x.bq = x.aq and x.bv = x.av;
    p := item_position(p_business, x.item_id, r.location_id);
    v_share := case when x.bq > 0 then receipt_share_on_hand(p_business, p_receipt, x.item_id, r.location_id) else 1 end;
    c := case when x.bq > 0 then x.bv / x.bq end;
    c1 := case when x.aq > 0 then x.av / x.aq end;
    cs := coalesce(c1, c);
    dp := case when x.bq > 0 and x.aq > 0 then money_round(p_business, x.bq * c1) - x.bv else 0 end;
    dq := x.aq - x.bq;
    a_now := case when p.qty > 0 then greatest(p.value, 0) / p.qty end;
    u := case when a_now is not null then v_share * cs + (1 - v_share) * a_now else cs end;
    s_price := money_round(p_business, dp * v_share);
    s_qty := money_round(p_business, abs(dq) * u);
    q1 := p.qty + dq;
    v_nat := p.value + s_price + sign(dq) * s_qty;
    v1 := case when q1 > 0 then greatest(v_nat, 0)
               when q1 = 0 then 0
               else money_round(p_business, q1 * cs) end;
    v_moves := '[]';
    if dq <> 0 then
      if q1 > 0 then
        m := s_qty;
        if dq < 0 then m := least(m, greatest(p.value, 0)); end if;
        v_mid := p.value + sign(dq) * m;
        v_moves := v_moves || jsonb_build_object('type', 'receipt_correction', 'qty', dq, 'value', m);
        if v1 <> v_mid then
          if v_mid >= 0 and v1 >= 0 then
            v_moves := v_moves || jsonb_build_object('type', 'cost_adjustment', 'qty', -q1, 'value', v_mid)
                                || jsonb_build_object('type', 'cost_adjustment', 'qty', q1, 'value', v1);
          else
            v1 := v_mid;
          end if;
        end if;
      else
        m := sign(dq) * (v1 - p.value);
        if m < 0 then
          m := s_qty;
          v1 := p.value + sign(dq) * m;
        end if;
        v_moves := v_moves || jsonb_build_object('type', 'receipt_correction', 'qty', dq, 'value', m);
      end if;
    elsif v1 <> p.value then
      if p.qty > 0 and p.value >= 0 and v1 >= 0 then
        v_moves := v_moves || jsonb_build_object('type', 'cost_adjustment', 'qty', -p.qty, 'value', p.value)
                            || jsonb_build_object('type', 'cost_adjustment', 'qty', p.qty, 'value', v1);
      else
        v1 := p.value;
      end if;
    end if;
    v_ds := v1 - p.value;
    v_dg := x.av - x.bv;
    v_items := v_items || jsonb_build_object(
      'item_id', x.item_id, 'name', x.name, 'unit', x.unit,
      'qty_before', x.bq, 'qty_after', x.aq, 'qty_change', dq,
      'value_before', x.bv, 'value_after', x.av,
      'on_hand', p.qty, 'on_hand_after', q1, 'stock_value', p.value, 'stock_value_after', v1,
      'still_on_hand', round(v_share, 4),
      'stock_change', v_ds, 'grni_change', v_dg, 'variance', v_dg - v_ds, 'moves', v_moves);
    if dq < 0 and q1 < 0 then
      v_below := v_below || jsonb_build_object('item_id', x.item_id, 'name', x.name, 'on_hand_after', q1, 'unit', x.unit);
    end if;
    if dq <> 0 and exists (
         select 1 from stock_count sc join stock_count_line cl on cl.stock_count_id = sc.id
          where sc.business_id = p_business and sc.location_id = r.location_id and sc.status = 'approved'
            and cl.item_id = x.item_id
            and coalesce(cl.counted_at, sc.submitted_at, sc.started_at) > r.received_at) then
      v_counted := v_counted || jsonb_build_object('item_id', x.item_id, 'name', x.name);
    end if;
    t_s := t_s + v_ds;
    t_g := t_g + v_dg;
  end loop;
  return jsonb_build_object('items', v_items, 'stock', t_s, 'grni', t_g, 'variance', t_g - t_s,
                            'below_zero', v_below, 'counted_since', v_counted);
end $$;

-- Correct a delivery, or reverse it (p_reverse): the checks, the stock, the
-- journal, the document and the audit trail, in one step.
create or replace function correct_receipt__run(p_receipt uuid, p_lines jsonb, p_supplier uuid, p_received_on date,
                                               p_reason text, p_confirm boolean, p_reverse boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  r goods_receipt; v_before jsonb; v_after jsonb; v_kinds text[]; v_plan jsonb; v_reason text := trim(p_reason);
  v_id uuid := gen_random_uuid(); v_no bigint; v_journal uuid; x jsonb; mv jsonb; v_items uuid[]; v_period text;
  v_desc text;
begin
  if nullif(v_reason, '') is null then raise exception 'Say why the delivery is being corrected'; end if;
  select * into r from goods_receipt where id = p_receipt and business_id = v_business for update;
  if not found then raise exception 'Delivery not found'; end if;
  if not exists (select 1 from journal_entry where reference_type = 'goods_receipt' and reference_id = p_receipt
                   and status = 'published' and not legacy) then
    raise exception 'Delivery % was received before the controls: the owner corrects it on Reports', coalesce(r.receipt_no::text, '');
  end if;
  if exists (select 1 from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null) then
    raise exception 'Delivery % has been billed: cancel its bill on Vendors first, then correct the delivery', r.receipt_no;
  end if;
  select name into v_period from accounting_period
   where business_id = v_business and status = 'locked'
     and business_local_date(v_business, r.received_at) between starts_on and ends_on;
  if v_period is not null then
    raise exception 'Delivery % is in %, a locked month: it is no longer corrected', r.receipt_no, v_period;
  end if;
  v_before := receipt_state(p_receipt);
  if coalesce((v_before ->> 'reversed')::boolean, false) then
    raise exception 'Delivery % was reversed: receive it again instead', r.receipt_no;
  end if;

  if p_reverse then
    v_after := (v_before - 'lines') || jsonb_build_object('lines', '[]'::jsonb, 'reversed', true);
  else
    v_after := receipt_after_state(v_business, p_receipt, v_before, p_lines, p_supplier, p_received_on);
  end if;
  v_kinds := receipt_change_kinds(v_before, v_after);
  if cardinality(v_kinds) = 0 then raise exception 'Nothing was changed'; end if;

  -- Every item the delivery had or has, locked in one order, then the stock read.
  select array_agg(distinct (e ->> 'item_id')::uuid) into v_items
    from (select jsonb_array_elements(v_before -> 'lines') e
          union all select jsonb_array_elements(v_after -> 'lines')) s;
  if v_items is not null then perform lock_items(v_items); end if;
  v_plan := receipt_correction_plan(v_business, p_receipt, v_before, v_after);

  if jsonb_array_length(v_plan -> 'counted_since') > 0 then
    raise exception '% counted after this delivery, and the count set its stock: correct only its price',
      (select string_agg(e ->> 'name', ', ') from jsonb_array_elements(v_plan -> 'counted_since') e);
  end if;
  if jsonb_array_length(v_plan -> 'below_zero') > 0 and not coalesce(p_confirm, false) then
    raise exception 'This leaves % below zero: confirm to correct it all the same',
      (select string_agg(format('%s (%s %s)', e ->> 'name', trim_scale((e ->> 'on_hand_after')::numeric), e ->> 'unit'), ', ')
         from jsonb_array_elements(v_plan -> 'below_zero') e);
  end if;

  v_no := next_document_no(v_business, 'receipt_correction', 1);
  v_desc := case when p_reverse then 'Delivery ' || r.receipt_no || ' reversed (correction ' || v_no || '): '
                 else 'Correction ' || v_no || ' of delivery ' || r.receipt_no || ': ' end || v_reason;
  if (v_plan ->> 'stock')::numeric <> 0 or (v_plan ->> 'grni')::numeric <> 0 then
    v_journal := post_journal(v_business, now(), v_desc, 'receipt_correction', v_id,
      jsonb_build_array(signed_line('1200', (v_plan ->> 'stock')::numeric),
                        signed_line('2050', -(v_plan ->> 'grni')::numeric),
                        signed_line('5050', (v_plan ->> 'variance')::numeric)));
  end if;
  insert into receipt_correction (id, business_id, correction_no, goods_receipt_id, kinds, reason, before_state,
                                  after_state, effects, journal_entry_id, created_by)
  values (v_id, v_business, v_no, p_receipt, v_kinds, v_reason, v_before, v_after, v_plan -> 'items', v_journal, v_me);
  for x in select * from jsonb_array_elements(v_plan -> 'items') loop
    for mv in select * from jsonb_array_elements(x -> 'moves') loop
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                      reference_type, reference_id, app_user_id, reason)
      values (v_business, (x ->> 'item_id')::uuid, r.location_id, (mv ->> 'type')::movement_type,
              (mv ->> 'qty')::numeric, (mv ->> 'value')::numeric / abs((mv ->> 'qty')::numeric), (mv ->> 'value')::numeric,
              'receipt_correction', v_id, v_me,
              case when mv ->> 'type' = 'cost_adjustment' then 'Revalued: ' else '' end || v_desc);
    end loop;
  end loop;

  perform audit_event(v_business, case when p_reverse then 'purchase.reverse' else 'purchase.correct' end,
    'goods_receipt', p_receipt::text, v_reason,
    jsonb_build_object('receipt_no', r.receipt_no, 'supplier', v_before -> 'supplier_id',
                       'received_on', v_before -> 'received_on', 'delivery_lines', v_before -> 'lines'),
    jsonb_build_object('correction_no', v_no, 'kinds', to_jsonb(v_kinds), 'supplier', v_after -> 'supplier_id',
                       'received_on', v_after -> 'received_on', 'delivery_lines', v_after -> 'lines',
                       'stock_change', v_plan -> 'stock', 'grni_change', v_plan -> 'grni',
                       'price_variance', v_plan -> 'variance'));
  return jsonb_build_object('correction_id', v_id, 'correction_no', v_no, 'receipt_no', r.receipt_no,
    'kinds', to_jsonb(v_kinds), 'reversed', p_reverse,
    'stock', v_plan -> 'stock', 'grni', v_plan -> 'grni', 'variance', v_plan -> 'variance',
    'items', v_plan -> 'items',
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- ---------------------------------------------------------------------------
-- 5. What Purchasing calls
-- ---------------------------------------------------------------------------
-- What a correction would do, before it is made: nothing is written.
create or replace function preview_receipt_correction(p_receipt uuid, p_lines jsonb default null,
                                                      p_supplier uuid default null, p_received_on date default null,
                                                      p_reverse boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  r goods_receipt; v_before jsonb; v_after jsonb; v_plan jsonb; v_blocked text; v_period text;
begin
  select * into r from goods_receipt where id = p_receipt and business_id = v_business;
  if not found then raise exception 'Delivery not found'; end if;
  v_before := receipt_state(p_receipt);
  if not exists (select 1 from journal_entry where reference_type = 'goods_receipt' and reference_id = p_receipt
                   and status = 'published' and not legacy) then
    v_blocked := 'Received before the controls: the owner corrects it on Reports';
  elsif exists (select 1 from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null) then
    v_blocked := 'Billed: cancel its bill on Vendors first, then correct the delivery';
  elsif coalesce((v_before ->> 'reversed')::boolean, false) then
    v_blocked := 'Reversed: receive it again instead';
  else
    select name into v_period from accounting_period
     where business_id = v_business and status = 'locked'
       and business_local_date(v_business, r.received_at) between starts_on and ends_on;
    if v_period is not null then v_blocked := 'In a locked month: it is no longer corrected'; end if;
  end if;
  if p_reverse then
    v_after := (v_before - 'lines') || jsonb_build_object('lines', '[]'::jsonb, 'reversed', true);
  elsif p_lines is null then
    v_after := v_before;
  else
    v_after := receipt_after_state(v_business, p_receipt, v_before, p_lines, p_supplier, p_received_on);
  end if;
  v_plan := receipt_correction_plan(v_business, p_receipt, v_before, v_after);
  return v_plan || jsonb_build_object('receipt_no', r.receipt_no, 'before', v_before, 'after', v_after,
                                      'kinds', to_jsonb(receipt_change_kinds(v_before, v_after)), 'blocked', v_blocked);
end $$;

-- Correct a delivery: its lines ([{line_id, item_id, qty, unit_code, unit_price | goods_value}], a line
-- without line_id is new; a line left out is taken off), its supplier, its date. Keyed (0035).
create or replace function correct_receipt(p_receipt uuid, p_lines jsonb, p_supplier uuid default null,
                                           p_received_on date default null, p_reason text default null,
                                           p_confirm boolean default false, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_receipt', p_receipt, 'p_lines', p_lines, 'p_supplier', p_supplier,
                                    'p_received_on', p_received_on, 'p_reason', p_reason, 'p_confirm', p_confirm);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'correct_receipt', v_req);
  if v is not null then return v; end if;
  v := correct_receipt__run(p_receipt, p_lines, p_supplier, p_received_on, p_reason, p_confirm, false);
  perform idem_finish(v_business, p_idempotency_key, 'correct_receipt', v_req, v);
  return v;
end $$;

-- Reverse a delivery that should not exist. Keyed (0035).
create or replace function reverse_receipt(p_receipt uuid, p_reason text default null, p_confirm boolean default false,
                                           p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_receipt', p_receipt, 'p_reason', p_reason, 'p_confirm', p_confirm);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'reverse_receipt', v_req);
  if v is not null then return v; end if;
  v := correct_receipt__run(p_receipt, null, null, null, p_reason, p_confirm, true);
  perform idem_finish(v_business, p_idempotency_key, 'reverse_receipt', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 6. A bill is for the delivery as it stands
-- ---------------------------------------------------------------------------
-- 0021's record_bill (its work, since 0035): the supplier is the delivery's
-- as corrected, and a reversed delivery has nothing to bill.
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
    v_grni := receipt_grni_value(p_receipt);
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
       or p_account_code in ('1000', '1010', '1020', '1100', '1200', '5000', '5050', '5300', '5400') then
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

-- ---------------------------------------------------------------------------
-- 7. Prices and the stock card know corrections
-- ---------------------------------------------------------------------------
-- 0027's price history: each delivery as it stands now.
create or replace function item_price_history(p_item uuid)
returns table (received_at timestamptz, receipt_no bigint, supplier text, qty numeric, unit text,
               goods_value numeric, cost_per_base numeric, landed_per_base numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  if not exists (select 1 from item where id = p_item and business_id = v_business) then
    raise exception 'Item not found';
  end if;
  return query
    select r.received_at, r.receipt_no, s.name, (l ->> 'qty')::numeric, l ->> 'unit_code', (l ->> 'goods_value')::numeric,
           (l ->> 'goods_value')::numeric / nullif((l ->> 'base_qty')::numeric, 0),
           (l ->> 'landed')::numeric / nullif((l ->> 'base_qty')::numeric, 0)
      from goods_receipt r
      cross join lateral receipt_state(r.id) st
      cross join lateral jsonb_array_elements(st -> 'lines') l
      left join supplier s on s.id = (st ->> 'supplier_id')::uuid
     where r.business_id = v_business and (l ->> 'item_id')::uuid = p_item
     order by r.received_at desc, r.receipt_no desc
     limit 50;
end $$;

-- 0027's reference cost: with nothing on hand, the item's last delivery as it stands now.
create or replace function item_reference_cost(p_business uuid, p_item uuid, p_location uuid) returns numeric
language plpgsql stable set search_path = public as $$
declare p record; v numeric;
begin
  p := item_position(p_business, p_item, p_location);
  if p.qty > 0 and p.value > 0 then return p.value / p.qty; end if;
  select (l ->> 'landed')::numeric / nullif((l ->> 'base_qty')::numeric, 0) into v
    from goods_receipt r
    cross join lateral jsonb_array_elements(receipt_state(r.id) -> 'lines') l
   where r.business_id = p_business and (l ->> 'item_id')::uuid = p_item and (l ->> 'landed')::numeric > 0
   order by r.received_at desc, r.receipt_no desc nulls last
   limit 1;
  if v is null then
    select unit_cost into v from inventory_movement
     where business_id = p_business and item_id = p_item and type = 'purchase_receipt' and unit_cost > 0
     order by occurred_at desc, created_at desc limit 1;
  end if;
  return v;
end $$;

-- 0026's kinds: a delivery's correction is part of what was received; a
-- revaluation is its own.
create or replace function stock_card_kind(p_type movement_type, p_reference text, p_qty numeric) returns text
language sql immutable set search_path = public as $$
  select case
    when p_type = 'opening_balance' then 'opening_stock'
    when p_type in ('purchase_receipt', 'supplier_return') then 'received'
    when p_type::text = 'receipt_correction' then 'received'
    when p_type::text = 'cost_adjustment' then 'revalued'
    when p_type in ('sale_consumption', 'refund_return_to_stock') then 'sold'
    when p_type = 'reversal' and p_reference in ('sale_void', 'sales_order') then 'sold'
    when p_type = 'production_consumption' then 'batches'
    when p_type = 'reversal' and p_reference = 'production_cancel' and p_qty > 0 then 'batches'
    when p_type = 'production_output' then 'made'
    when p_type = 'reversal' and p_reference = 'production_cancel' then 'made'
    when p_type in ('waste', 'spoilage', 'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling',
                    'damaged', 'expired') then 'wasted'
    when p_type = 'count_adjustment' then 'counted'
    when p_type in ('transfer_in', 'transfer_out') then 'transferred'
    else 'corrected'
  end
$$;

-- ---------------------------------------------------------------------------
-- 8. The books, checked account by account
-- ---------------------------------------------------------------------------
-- What a drawer should have held at a moment: the session open then (its
-- opening count and its cash since), or what the last count left and the
-- cash since. Unknown for a drawer never counted that has taken cash.
create or replace function drawer_position_at(p_business uuid, p_location uuid, p_at timestamptz,
                                              out known boolean, out amount numeric)
language plpgsql stable set search_path = public as $$
declare s work_shift; w work_shift;
begin
  select * into s from work_shift
   where business_id = p_business and location_id = p_location and kind = 'session'
     and opened_at < p_at and (closed_at is null or closed_at >= p_at)
   order by opened_at desc limit 1;
  if found then
    known := true;
    amount := s.opening_counted + coalesce((select sum(e.amount) from cash_event e
                                             where e.work_shift_id = s.id and e.created_at < p_at), 0);
    return;
  end if;
  select * into w from work_shift
   where business_id = p_business and location_id = p_location and kind in ('drawer', 'session') and closed_at < p_at
   order by closed_at desc, id desc limit 1;
  if found then
    known := true;
    amount := coalesce(w.left_in_drawer, 0)
              + coalesce((select sum(e.amount) from cash_event e
                           where e.business_id = p_business and e.location_id = p_location
                             and e.created_at >= w.closed_at and e.created_at < p_at
                             and e.work_shift_id is distinct from w.id), 0);
    return;
  end if;
  known := not exists (select 1 from cash_event e
                        where e.business_id = p_business and e.location_id = p_location and e.created_at < p_at)
       and not exists (select 1 from sales_order o join sales_tender t on t.sales_order_id = o.id and t.tender_type = 'cash'
                        where o.business_id = p_business and o.location_id = p_location and o.placed_at < p_at);
  amount := 0;
end $$;

-- Records that should have their one journal and do not, and automatic
-- journals whose record does not exist, up to a moment. Only what was
-- recorded under the controls (from the business's first journal of its
-- own); what came before them is the remediation's (docs/REMEDIATION.md).
create or replace function document_problems(p_business uuid, p_before timestamptz)
returns table (kind text, record_id uuid, at timestamptz, problem text)
language plpgsql stable set search_path = public as $$
declare v_start timestamptz;
begin
  select min(created_at) into v_start from journal_entry where business_id = p_business and not legacy;
  if v_start is null then return; end if;
  return query
  with j as (
    select e.id, e.reference_type, e.reference_id, e.reverses_entry, e.occurred_at, e.created_at
      from journal_entry e
     where e.business_id = p_business and e.status = 'published' and not e.legacy
  ),
  has as (select distinct reference_type, reference_id from j where reverses_entry is null and reference_id is not null)
  -- Records without their journal.
  select 'sale'::text, o.id, o.placed_at, 'A sale with no journal'::text
    from sales_order o
   where o.business_id = p_business and o.status <> 'open' and o.created_at >= v_start and o.placed_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'sales_order' and h.reference_id = o.id)
  union all
  select 'void', a.id, a.created_at, 'A void whose sale''s journal was not reversed'
    from sale_adjustment a
   where a.business_id = p_business and a.kind = 'void' and a.created_at >= v_start and a.created_at < p_before
     and not exists (select 1 from j s join j rv on rv.reverses_entry = s.id
                      where s.reference_type = 'sales_order' and s.reference_id = a.sales_order_id)
  union all
  select 'refund', a.id, a.created_at, 'A refund with no journal'
    from sale_adjustment a
   where a.business_id = p_business and a.kind = 'refund' and a.created_at >= v_start and a.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'sale_refund' and h.reference_id = a.id)
  union all
  select 'delivery', r.id, r.received_at, 'A delivery with no journal'
    from goods_receipt r
   where r.business_id = p_business and r.received_at >= v_start and r.received_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'goods_receipt' and h.reference_id = r.id)
  union all
  select 'correction', c.id, c.created_at, 'A delivery''s correction with no journal'
    from receipt_correction c
   where c.business_id = p_business and c.created_at < p_before and c.journal_entry_id is null
     and exists (select 1 from jsonb_array_elements(c.effects) e
                  where (e ->> 'stock_change')::numeric <> 0 or (e ->> 'grni_change')::numeric <> 0)
  union all
  select 'bill', b.id, b.created_at, 'A bill with no journal'
    from purchase_invoice b
   where b.business_id = p_business and not b.legacy and b.created_at >= v_start and b.created_at < p_before
     and b.journal_entry_id is null
     -- A bill for a delivery the old app posted to payables posts only a difference in price.
     and not (b.goods_receipt_id is not null and receipt_legacy_payable(b.goods_receipt_id) > 0)
  union all
  select 'payment', p.id, p.created_at, 'A payment with no journal'
    from supplier_payment p
   where p.business_id = p_business and p.created_at >= v_start and p.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'supplier_payment' and h.reference_id = p.id)
  union all
  select 'expense', x.id, x.created_at, 'An expense with no journal'
    from expense x
   where x.business_id = p_business and x.created_at >= v_start and x.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'expense' and h.reference_id = x.id)
  union all
  select 'stock', m.id, m.created_at, 'A loss, stock correction or opening stock with no journal'
    from inventory_movement m
   where m.business_id = p_business and m.created_at >= v_start and m.created_at < p_before and m.value > 0
     and m.type in ('waste', 'spoilage', 'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling',
                    'damaged', 'expired', 'manual_correction', 'opening_balance')
     and m.reference_id is null
     and not exists (select 1 from has h where h.reference_type = 'inventory_movement' and h.reference_id = m.id)
  union all
  select 'count', c.id, c.approved_at, 'An approved count with no journal'
    from stock_count c
   where c.business_id = p_business and c.status = 'approved' and not c.legacy
     and c.approved_at >= v_start and c.approved_at < p_before
     and exists (select 1 from stock_count_line l join inventory_movement m on m.id = l.adjustment_movement_id
                  where l.stock_count_id = c.id and m.value > 0)
     and not exists (select 1 from has h where h.reference_type = 'stock_count' and h.reference_id = c.id)
  union all
  select 'cash', t.id, t.created_at, 'Cash moved with no journal'
    from cash_transfer t
   where t.business_id = p_business and t.created_at >= v_start and t.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'cash_transfer' and h.reference_id = t.id)
  union all
  select 'session', w.id, w.closed_at, 'A drawer counted over or short with no journal'
    from work_shift w
   where w.business_id = p_business and w.kind in ('session', 'drawer') and coalesce(w.variance, 0) <> 0
     and w.closed_at >= v_start and w.closed_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'work_shift' and h.reference_id = w.id)
  union all
  select 'session', w.id, w.opened_at, 'A drawer opened over or short with no journal'
    from work_shift w
   where w.business_id = p_business and w.kind = 'session' and coalesce(w.opening_variance, 0) <> 0
     and w.opened_at >= v_start and w.opened_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'session_opening' and h.reference_id = w.id)
  union all
  select 'card', s.id, s.created_at, 'A card settlement with no journal'
    from card_settlement s
   where s.business_id = p_business and s.created_at < p_before and s.journal_entry_id is null
  union all
  select 'platform', s.id, s.imported_at, 'A platform statement posted with no journal'
    from platform_settlement s
   where s.business_id = p_business and s.imported_at < p_before and s.journal_entry_id is null
     and exists (select 1 from platform_settlement_line l where l.settlement_id = s.id and l.status = 'matched')
  union all
  -- Automatic journals whose record does not exist (and that are not reversed).
  select 'journal', j.id, j.occurred_at,
         'A journal whose ' || case j.reference_type
           when 'sales_order' then 'sale' when 'goods_receipt' then 'delivery'
           when 'receipt_correction' then 'delivery correction' when 'purchase_invoice' then 'bill'
           when 'supplier_payment' then 'payment' when 'inventory_movement' then 'stock movement'
           when 'sale_refund' then 'refund' when 'cash_transfer' then 'cash movement'
           when 'work_shift' then 'drawer count' when 'session_opening' then 'drawer opening'
           when 'platform_settlement' then 'platform statement'
           else replace(j.reference_type, '_', ' ') end || ' does not exist'
    from j
   where j.created_at < p_before and j.reverses_entry is null and j.reference_id is not null
     and not exists (select 1 from j rv where rv.reverses_entry = j.id and rv.created_at < p_before)
     and case j.reference_type
           when 'sales_order' then not exists (select 1 from sales_order x where x.id = j.reference_id)
           when 'goods_receipt' then not exists (select 1 from goods_receipt x where x.id = j.reference_id)
           when 'receipt_correction' then not exists (select 1 from receipt_correction x where x.id = j.reference_id)
           when 'purchase_invoice' then not exists (select 1 from purchase_invoice x where x.id = j.reference_id)
           when 'supplier_payment' then not exists (select 1 from supplier_payment x where x.id = j.reference_id)
           when 'expense' then not exists (select 1 from expense x where x.id = j.reference_id)
           when 'inventory_movement' then not exists (select 1 from inventory_movement x where x.id = j.reference_id)
           when 'stock_count' then not exists (select 1 from stock_count x where x.id = j.reference_id)
           when 'sale_refund' then not exists (select 1 from sale_adjustment x where x.id = j.reference_id)
           when 'cash_transfer' then not exists (select 1 from cash_transfer x where x.id = j.reference_id)
           when 'work_shift' then not exists (select 1 from work_shift x where x.id = j.reference_id)
           when 'session_opening' then not exists (select 1 from work_shift x where x.id = j.reference_id)
           when 'card_settlement' then not exists (select 1 from card_settlement x where x.id = j.reference_id)
           when 'platform_settlement' then not exists (select 1 from platform_settlement x where x.id = j.reference_id)
           else false end;
end $$;

-- Each subledger against its control account, as at the end of a day.
create or replace function reconciliation_checks(p_business uuid, p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable set search_path = public as $$
declare
  v_end timestamptz; v_settled date; v_known boolean := true; v_sum numeric := 0; d record; l record;
  v_unnumbered numeric; v_by_hand numeric;
begin
  v_end := (local_day_bounds(p_business, p_as_of, p_as_of)).to_ts;

  check_key := 'inventory'; label := 'Stock ledger vs Inventory (1200)';
  select coalesce(sum(value * sign(base_quantity_signed)), 0) into subledger
    from inventory_movement where business_id = p_business and occurred_at < v_end;
  ledger := gl_balance_at(p_business, '1200', v_end);
  difference := subledger - ledger; return next;

  check_key := 'payables'; label := 'Unpaid bills vs Accounts payable (2000)';
  select coalesce(sum(amount_total), 0) into subledger
    from purchase_invoice where business_id = p_business and invoice_date < p_as_of + 1
                            and (cancelled_at is null or cancelled_at >= v_end);
  subledger := subledger - coalesce((select sum(amount) from supplier_payment
                                      where business_id = p_business and paid_on < p_as_of + 1), 0);
  -- Receipts the old app posted straight to A/P are owed until their bill is recorded.
  subledger := subledger + coalesce((select sum(receipt_legacy_payable(r.id, v_end)) from goods_receipt r
                                      where r.business_id = p_business and r.received_at < v_end
                                        and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id
                                                          and p.invoice_date < p_as_of + 1
                                                          and (p.cancelled_at is null or p.cancelled_at >= v_end))), 0);
  ledger := -gl_balance_at(p_business, '2000', v_end);
  difference := subledger - ledger; return next;

  check_key := 'grni'; label := 'Unbilled receipts vs Goods received not invoiced (2050)';
  select coalesce(sum(receipt_grni_value_at(r.id, v_end)), 0) into subledger
    from goods_receipt r
   where r.business_id = p_business and r.received_at < v_end
     and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id and p.invoice_date < p_as_of + 1
                        and (p.cancelled_at is null or p.cancelled_at >= v_end));
  ledger := -gl_balance_at(p_business, '2050', v_end);
  difference := subledger - ledger; return next;

  check_key := 'sales'; label := 'Sales recorded vs net revenue in the ledger (4000 less 4100 and 4200)';
  select coalesce(sum(net_amount), 0) into subledger
    from sales_order where business_id = p_business and status <> 'voided' and status <> 'open' and placed_at < v_end;
  subledger := subledger - coalesce((select sum(amount) from sale_adjustment
                                      where business_id = p_business and kind = 'refund' and created_at < v_end), 0);
  ledger := -(gl_balance_at(p_business, '4000', v_end) + gl_balance_at(p_business, '4100', v_end)
              + gl_balance_at(p_business, '4200', v_end));
  difference := subledger - ledger; return next;

  -- Card: what the till took by card on the days not yet settled (0030),
  -- against Card clearing. What else sits in 1010 was posted on a day
  -- already settled, and no settlement will ever take it.
  check_key := 'card'; label := 'Card takings not yet settled vs Card clearing (1010)';
  select max(s.covers_to) into v_settled
    from card_settlement s join journal_entry j on j.id = s.journal_entry_id
   where s.business_id = p_business and j.occurred_at < v_end
     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end);
  select coalesce(sum(jl.debit - jl.credit), 0) into subledger
    from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
   where e.business_id = p_business and e.status = 'published' and g.code = '1010' and e.occurred_at < v_end
     and e.reference_type is distinct from 'card_settlement'
     and not (e.reference_type = 'reversal'
              and exists (select 1 from journal_entry o where o.id = e.reverses_entry and o.reference_type = 'card_settlement'))
     and (v_settled is null or business_local_date(p_business, e.occurred_at) > v_settled);
  ledger := gl_balance_at(p_business, '1010', v_end);
  difference := subledger - ledger; return next;

  -- Platforms: each platform order not voided, less what was refunded of it
  -- and what a statement has paid out for it, against what they owe (1100).
  -- The platform sales from before order numbers (0030) are on no statement:
  -- a payout typed by hand into 1100 is what explains them, as far as they
  -- go (docs/LIMITATIONS.md). A payout typed by hand beyond them is flagged.
  check_key := 'platform'; label := 'Orders the platforms owe vs Receivable from platforms (1100)';
  select coalesce(sum(o.net_amount
                      - coalesce((select sum(a.amount) from sale_adjustment a
                                   where a.sales_order_id = o.id and a.kind = 'refund' and a.created_at < v_end), 0)
                      - coalesce((select sum(sl.expected) from platform_settlement_line sl
                                    join platform_settlement s on s.id = sl.settlement_id
                                    join journal_entry j on j.id = s.journal_entry_id
                                   where sl.sales_order_id = o.id and sl.status = 'matched' and j.occurred_at < v_end
                                     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id
                                                       and rv.occurred_at < v_end)), 0)), 0)
    into subledger
    from platform_order po join sales_order o on o.id = po.sales_order_id
   where po.business_id = p_business and o.placed_at < v_end and o.status <> 'open'
     and not exists (select 1 from sale_adjustment a where a.sales_order_id = o.id and a.kind = 'void'
                       and a.created_at < v_end);
  select coalesce(sum(o.net_amount - coalesce((select sum(a.amount) from sale_adjustment a
                                                where a.sales_order_id = o.id and a.kind = 'refund'
                                                  and a.created_at < v_end), 0)), 0)
    into v_unnumbered
    from sales_order o
   where o.business_id = p_business and o.placed_at < v_end and o.status <> 'open'
     and exists (select 1 from sales_tender t where t.sales_order_id = o.id and t.tender_type = 'platform_paid')
     and not exists (select 1 from platform_order po where po.sales_order_id = o.id)
     and not exists (select 1 from sale_adjustment a where a.sales_order_id = o.id and a.kind = 'void'
                       and a.created_at < v_end);
  select coalesce(sum(jl.debit - jl.credit), 0) into v_by_hand
    from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
   where e.business_id = p_business and e.status = 'published' and g.code = '1100' and e.occurred_at < v_end
     and e.reference_type is distinct from 'sales_order' and e.reference_type is distinct from 'sale_refund'
     and e.reference_type is distinct from 'platform_settlement'
     and not (e.reference_type = 'reversal'
              and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                            and o.reference_type in ('sales_order', 'sale_refund', 'platform_settlement')));
  subledger := subledger + greatest(v_unnumbered + v_by_hand, 0);
  ledger := gl_balance_at(p_business, '1100', v_end);
  difference := subledger - ledger; return next;

  -- The drawers: what each should hold, from its counts and its cash since,
  -- against Cash in the till. Before a drawer is first counted in a session,
  -- the books are all there is (the first opening settles the difference, 0036).
  for l in select id from location where business_id = p_business loop
    d := drawer_position_at(p_business, l.id, v_end);
    if not d.known then v_known := false; end if;
    v_sum := v_sum + coalesce(d.amount, 0);
  end loop;
  -- Nothing to hold the books to until some drawer has been counted.
  if not exists (select 1 from work_shift w
                  where w.business_id = p_business
                    and ((w.kind = 'session' and w.opened_at < v_end) or (w.kind = 'drawer' and w.closed_at < v_end))) then
    v_known := false;
  end if;
  check_key := 'drawer';
  ledger := gl_balance_at(p_business, '1000', v_end);
  if v_known then
    label := 'What the drawers should hold vs Cash in the till (1000)';
    subledger := v_sum;
  else
    label := 'What the drawers should hold vs Cash in the till (1000): not yet counted, the first opening settles it';
    subledger := ledger;
  end if;
  difference := subledger - ledger; return next;

  -- The safe: cash moved in and out of it, and expenses and bills paid from
  -- it, against the Safe (1005).
  check_key := 'safe'; label := 'Cash moved in and out of the safe vs Safe (1005)';
  select coalesce(sum(case when t.to_place = 'safe' then t.amount else -t.amount end), 0) into subledger
    from cash_transfer t join journal_entry j on j.id = t.journal_entry_id
   where t.business_id = p_business and 'safe' in (t.from_place, t.to_place) and j.occurred_at < v_end;
  subledger := subledger + coalesce((
    select sum(jl.debit - jl.credit)
      from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
     where e.business_id = p_business and e.status = 'published' and g.code = '1005' and e.occurred_at < v_end
       and (e.reference_type in ('expense', 'supplier_payment')
            or (e.reference_type = 'reversal'
                and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                              and o.reference_type in ('expense', 'supplier_payment'))))), 0);
  ledger := gl_balance_at(p_business, '1005', v_end);
  difference := subledger - ledger; return next;

  -- The records themselves: how many lack their journal, or are journals
  -- lacking their record.
  check_key := 'documents'; label := 'Every record has its one journal, and every automatic journal its record';
  select count(*) into subledger from document_problems(p_business, v_end);
  ledger := 0;
  difference := subledger; return next;
end $$;

-- 0019's reconciliation, through the checks above.
create or replace function report_reconciliation(p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  return query select * from reconciliation_checks(v_business, p_as_of);
end $$;

-- The records the last check counts, to be looked into.
create or replace function report_document_problems(p_as_of date)
returns table (kind text, record_id uuid, at timestamptz, problem text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  return query
    select * from document_problems(v_business, (local_day_bounds(v_business, p_as_of, p_as_of)).to_ts) x
     order by x.at, x.kind;
end $$;

-- ---------------------------------------------------------------------------
-- 9. The month's checklist blocks on every check
-- ---------------------------------------------------------------------------
-- 0025's checklist, with the reconciliation's checks, each blocking.
create or replace function period_close_checklist(p_period uuid)
returns table (check_key text, label text, ok boolean, detail text, blocks boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.period.lock', 'accounting.post', 'audit.view');
  p accounting_period; v numeric; n int; v_days text; c record;
begin
  select * into p from accounting_period where id = p_period and business_id = v_business;
  if not found then raise exception 'Period not found'; end if;
  blocks := true;

  select count(*) into n from accounting_period
   where business_id = v_business and ends_on < p.starts_on and status = 'open';
  check_key := 'prior_periods'; label := 'Earlier periods are locked'; ok := n = 0;
  detail := case when n > 0 then n || ' earlier period(s) still open' end; return next;

  select count(*) into n from journal_entry where period_id = p_period and status = 'draft';
  check_key := 'drafts'; label := 'No draft journals'; ok := n = 0;
  detail := case when n > 0 then n || ' draft journal(s) must be published or discarded' end; return next;

  select string_agg(d::text, ', ' order by d) into v_days from (
    select distinct u.day d from uncounted_days(v_business) u where u.day between p.starts_on and p.ends_on
  ) x;
  check_key := 'days_closed'; label := 'Every trading day''s cash is counted'; ok := v_days is null;
  detail := case when v_days is not null then 'Not counted: ' || v_days end; return next;

  select count(*) into n from stock_count where business_id = v_business and status = 'submitted';
  check_key := 'counts'; label := 'No stock count awaiting approval'; ok := n = 0;
  detail := case when n > 0 then n || ' count(s) submitted and not yet approved or rejected' end; return next;

  -- Each subledger against its account, as at the month's last day.
  for c in select * from reconciliation_checks(v_business, p.ends_on) loop
    check_key := c.check_key;
    ok := c.difference = 0;
    label := case c.check_key
      when 'inventory' then 'Stock ledger agrees with Inventory (1200)'
      when 'payables' then 'Unpaid bills agree with Accounts payable (2000)'
      when 'grni' then 'Unbilled receipts agree with GRNI (2050)'
      when 'sales' then 'Sales agree with net revenue (4000 less 4100 and 4200)'
      when 'card' then 'Card takings not yet settled agree with Card clearing (1010)'
      when 'platform' then 'Orders the platforms owe agree with their receivable (1100)'
      when 'drawer' then 'What the drawers should hold agrees with Cash in the till (1000)'
      when 'safe' then 'Cash moved through the safe agrees with the Safe (1005)'
      when 'documents' then 'Every record has its one journal'
      else c.label end;
    detail := case when c.difference = 0 then null
      when c.check_key = 'documents' then c.difference || ' record(s) to look into: see Reports, Do the books tie?'
      else format(case c.check_key
                    when 'inventory' then 'stock ledger %s, account 1200 %s, difference %s'
                    when 'payables' then 'unpaid bills %s, account 2000 %s, difference %s'
                    when 'grni' then 'unbilled receipts %s, account 2050 %s, difference %s'
                    when 'sales' then 'sales %s, net revenue %s, difference %s'
                    when 'card' then 'card takings %s, account 1010 %s, difference %s'
                    when 'platform' then 'orders owed %s, account 1100 %s, difference %s'
                    when 'drawer' then 'the drawers %s, account 1000 %s, difference %s'
                    when 'safe' then 'the safe''s records %s, account 1005 %s, difference %s'
                    else 'records %s, account %s, difference %s' end,
                  c.subledger, c.ledger, c.difference) end;
    return next;
  end loop;

  select coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0) into v
    from journal_line l join journal_entry e on e.id = l.journal_entry_id
   where e.period_id = p_period and e.status = 'published';
  check_key := 'trial_balance'; label := 'The period''s journals balance'; ok := v = 0;
  detail := case when v <> 0 then 'out by ' || v end; return next;

  -- A warning, not a lock: a sale costed at nothing cannot be costed again, but
  -- the owner should know its profit is overstated, and why (0025).
  select count(*) into n from uncosted_sales(v_business, p.starts_on, p.ends_on);
  check_key := 'uncosted'; label := 'No sale costed at nothing'; ok := n = 0; blocks := false;
  detail := case when n > 0 then n || ' sale(s) costed at nothing or in part at nothing: see Reports, Uncosted sales. '
                                 || 'Their profit is overstated. The month can still be locked' end; return next;
end $$;

-- ---------------------------------------------------------------------------
-- 10. The safe takes no manual journal; a correction's journal is corrected
--     through the delivery
-- ---------------------------------------------------------------------------
-- 0024's list, with the safe: its subledger is now checked (section 8).
create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$ select p_code in ('1000', '1005', '1200', '2000', '2050', '3100') $$;

-- 0037's hints, with a delivery's correction.
create or replace function journal_source_hint(p_ref_type text) returns text
language sql immutable as $$
  select case p_ref_type
    when 'sales_order' then 'a sale (void or refund it on Orders)'
    when 'sale_adjustment' then 'a refund'
    when 'sale_refund' then 'a refund (refund the rest of the sale on Orders if more should go back)'
    when 'goods_receipt' then 'a goods receipt (correct it on Purchasing)'
    when 'receipt_correction' then 'a delivery''s correction (correct the delivery again on Purchasing)'
    when 'purchase_invoice' then 'a bill (cancel it on Vendors)'
    when 'supplier_payment' then 'a supplier payment'
    when 'inventory_movement' then 'a stock record (correct stock with a count or a stock correction)'
    when 'stock_count' then 'a stock count (correct stock with a new count)'
    when 'work_shift' then 'a drawer count'
    when 'session_opening' then 'the opening count of a cash session'
    when 'cash_transfer' then 'a movement of cash (move it back instead)'
    when 'reversal' then 'a reversal (post the entry again instead)'
    when 'card_settlement' then 'a card settlement (cancel it on Sales)'
    when 'platform_settlement' then 'a platform settlement (cancel it on Delivery Platforms)'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- ---------------------------------------------------------------------------
-- 11. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  receipt_original_state(uuid), receipt_state(uuid), receipt_grni_value_at(uuid, timestamptz),
  receipt_grni_value(uuid), receipt_share_on_hand(uuid, uuid, uuid, uuid),
  receipt_after_state(uuid, uuid, jsonb, jsonb, uuid, date), receipt_change_kinds(jsonb, jsonb),
  receipt_correction_plan(uuid, uuid, jsonb, jsonb),
  correct_receipt__run(uuid, jsonb, uuid, date, text, boolean, boolean),
  record_bill__run(uuid, text, date, numeric, integer, uuid, text),
  item_reference_cost(uuid, uuid, uuid), stock_card_kind(movement_type, text, numeric),
  drawer_position_at(uuid, uuid, timestamptz), document_problems(uuid, timestamptz),
  reconciliation_checks(uuid, date), manual_journal_blocked(text), journal_source_hint(text)
  from public, anon, authenticated;
revoke execute on function
  preview_receipt_correction(uuid, jsonb, uuid, date, boolean),
  correct_receipt(uuid, jsonb, uuid, date, text, boolean, uuid),
  reverse_receipt(uuid, text, boolean, uuid),
  item_price_history(uuid), report_reconciliation(date), report_document_problems(date),
  period_close_checklist(uuid)
  from public, anon;
grant execute on function
  preview_receipt_correction(uuid, jsonb, uuid, date, boolean),
  correct_receipt(uuid, jsonb, uuid, date, text, boolean, uuid),
  reverse_receipt(uuid, text, boolean, uuid),
  item_price_history(uuid), report_reconciliation(date), report_document_problems(date),
  period_close_checklist(uuid)
  to authenticated;
