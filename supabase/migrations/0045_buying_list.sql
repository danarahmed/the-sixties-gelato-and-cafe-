-- =============================================================================
-- 0045 — The buying list (release T)
--
-- Nothing said what to buy: the running-out and reorder-level alerts named an
-- item at a time, with no supplier, no pack, and nothing already on order
-- counted (docs/COMPLETION_PLAN.md, B10).
--   * item_supplier: who an item is bought from, in what pack, at what price
--     last, and which of them is its usual supplier.
--   * buying_list(location): each item bought (one made here is made on
--     Production), with what is on hand, on order and in draft orders; its use
--     a day over the last 28 days and the days a delivery takes; its reorder
--     level and the level it is ordered up to; how much to order, in whole
--     packs; the supplier and a pack's price; and the numbers each rests on.
--   * purchase_orders_from_list(lines): a draft order for each supplier, as
--     save_po makes one; each line's pack and price remembered.
--   * Running out and below the reorder level, for an item bought, lead to
--     What to buy.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Who an item is bought from
-- ---------------------------------------------------------------------------
-- The pack is one of the item's units (its base unit, or a case of 24); the
-- price is a pack's, agreed last, and the day it was. One usual supplier an
-- item at most.
create table if not exists item_supplier (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business (id) on delete cascade,
  item_id        uuid not null references item (id) on delete cascade,
  supplier_id    uuid not null references supplier (id) on delete cascade,
  pack_unit_code text not null,
  last_price     numeric check (last_price >= 0),
  last_price_on  date,
  preferred      boolean not null default false,
  updated_by     uuid references app_user (id),
  updated_at     timestamptz not null default now(),
  constraint item_supplier_once unique (item_id, supplier_id),
  constraint item_supplier_price check ((last_price is null) = (last_price_on is null))
);
create unique index if not exists item_supplier_usual on item_supplier (item_id) where preferred;
create index if not exists item_supplier_business on item_supplier (business_id);
create index if not exists item_supplier_supplier on item_supplier (supplier_id);

alter table item_supplier enable row level security;
alter table item_supplier force row level security;
drop policy if exists cost_read on item_supplier;
create policy cost_read on item_supplier for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
grant select on item_supplier to authenticated;

-- What one of an item's units holds of its base unit; null for a unit it has not.
create or replace function unit_factor(p_item uuid, p_unit text) returns numeric
language sql stable set search_path = public as $$
  select case when p_unit = i.base_unit_code then 1::numeric
              else (select u.factor_to_base from item_unit u where u.item_id = i.id and u.code = p_unit) end
    from item i where i.id = p_item
$$;

-- A supplier of an item as the audit trail keeps it, before a change and after.
create or replace function item_supplier_snapshot(p_item uuid, p_supplier uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('supplier', s.supplier_id, 'pack_unit', s.pack_unit_code, 'last_price', s.last_price,
                            'usual', s.preferred)
    from item_supplier s where s.item_id = p_item and s.supplier_id = p_supplier
$$;

-- An item's supplier kept: the pack, and the price when one is given (a
-- pack's, on the day). p_usual true makes it the usual supplier, in place of
-- the one before; false makes it not; null leaves it. On the audit trail: a
-- supplier new to the item, one made usual or not, and, set by hand
-- (p_reason not null), any change; a pack or price kept from an order is on
-- that order's own trail. Two changes to one item's suppliers are taken one
-- after the other (the item is locked), so one usual supplier stays one.
create or replace function remember_item_supplier(p_business uuid, p_item uuid, p_supplier uuid, p_pack_unit text,
                                                  p_price numeric, p_usual boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := (current_member()).id;
  v_before jsonb; v_was uuid; v_after jsonb;
begin
  perform 1 from item where id = p_item for update;
  v_before := item_supplier_snapshot(p_item, p_supplier);
  if p_usual then
    select supplier_id into v_was from item_supplier where item_id = p_item and preferred and supplier_id <> p_supplier;
    update item_supplier set preferred = false, updated_by = v_me, updated_at = now()
     where item_id = p_item and preferred and supplier_id <> p_supplier;
  end if;
  insert into item_supplier (business_id, item_id, supplier_id, pack_unit_code, last_price, last_price_on, preferred,
                             updated_by)
  values (p_business, p_item, p_supplier, p_pack_unit, trim_scale(p_price),
          case when p_price is not null then business_local_date(p_business, now()) end, coalesce(p_usual, false), v_me)
  on conflict (item_id, supplier_id) do update
     set pack_unit_code = excluded.pack_unit_code,
         last_price = coalesce(excluded.last_price, item_supplier.last_price),
         last_price_on = coalesce(excluded.last_price_on, item_supplier.last_price_on),
         preferred = case when p_usual is null then item_supplier.preferred else excluded.preferred end,
         updated_by = excluded.updated_by, updated_at = now();
  v_after := item_supplier_snapshot(p_item, p_supplier);
  if v_before is null or (v_before -> 'usual') is distinct from (v_after -> 'usual')
     or (p_reason is not null and v_before is distinct from v_after) then
    perform audit_event(p_business, 'item.supplier.set', 'item', p_item::text, nullif(trim(p_reason), ''), v_before,
                        v_after || case when v_was is not null then jsonb_build_object('instead_of', v_was)
                                        else '{}'::jsonb end);
  end if;
  return v_after || jsonb_build_object('item_id', p_item, 'instead_of', v_was);
end $$;

-- ---------------------------------------------------------------------------
-- 2. An item's suppliers set, and removed
-- ---------------------------------------------------------------------------
-- (purchase.create) A supplier of an item set: the pack it comes in, a pack's
-- price (kept as it was when none is given), and whether it is the usual one.
-- On the audit trail, whatever changed.
create or replace function set_item_supplier__run(p_item uuid, p_supplier uuid, p_pack_unit text, p_price numeric,
                                                  p_usual boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create');
  it item; v_unit text;
begin
  select * into it from item where id = p_item and business_id = v_business;
  if not found then raise exception 'Item not found'; end if;
  if not it.is_active then raise exception '% is out of use: bring it back into use first', it.name; end if;
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business and is_active) then
    raise exception 'Choose an active supplier';
  end if;
  v_unit := coalesce(nullif(trim(p_pack_unit), ''), it.base_unit_code);
  if unit_factor(it.id, v_unit) is null then raise exception '% is not bought in %', it.name, v_unit; end if;
  if p_price < 0 then raise exception 'A price is zero or more'; end if;
  return remember_item_supplier(v_business, it.id, p_supplier, v_unit, p_price, coalesce(p_usual, false), '');
end $$;

create or replace function set_item_supplier(p_item uuid, p_supplier uuid, p_pack_unit text default null,
                                             p_price numeric default null, p_usual boolean default false,
                                             p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_item', p_item, 'p_supplier', p_supplier, 'p_pack_unit', p_pack_unit,
                                    'p_price', p_price, 'p_usual', p_usual);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_item_supplier', v_req);
  if v is not null then return v; end if;
  v := set_item_supplier__run(p_item => p_item, p_supplier => p_supplier, p_pack_unit => p_pack_unit,
                              p_price => p_price, p_usual => p_usual);
  perform idem_finish(v_business, p_idempotency_key, 'set_item_supplier', v_req, v);
  return v;
end $$;

-- (purchase.create) A supplier the item is no longer bought from.
create or replace function remove_item_supplier__run(p_item uuid, p_supplier uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create');
  v_before jsonb;
begin
  if not exists (select 1 from item where id = p_item and business_id = v_business) then
    raise exception 'Item not found';
  end if;
  v_before := item_supplier_snapshot(p_item, p_supplier);
  if v_before is null then raise exception 'That supplier is not one the item is bought from'; end if;
  delete from item_supplier where item_id = p_item and supplier_id = p_supplier;
  perform audit_event(v_business, 'item.supplier.remove', 'item', p_item::text, null, v_before, null);
  return jsonb_build_object('item_id', p_item, 'supplier_id', p_supplier, 'removed', true);
end $$;

create or replace function remove_item_supplier(p_item uuid, p_supplier uuid, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_item', p_item, 'p_supplier', p_supplier);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'remove_item_supplier', v_req);
  if v is not null then return v; end if;
  v := remove_item_supplier__run(p_item => p_item, p_supplier => p_supplier);
  perform idem_finish(v_business, p_idempotency_key, 'remove_item_supplier', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 3. The buying list
-- ---------------------------------------------------------------------------
-- (cost.view) What to buy for a location (the first branch when none is
-- named), for each item in use that is bought, not made here:
--
--   on hand        the location's stock now;
--   on order       what its approved and sent orders still wait for;
--   in draft       what its draft orders hold;
--   use a day      what was sold, used in batches, wasted or given away over
--                  the last 28 days (or since the item was first there, when
--                  that is less), a day: voids, refunds back on the shelf and
--                  losses taken back netted off, as the stock card counts them;
--   lead time      the days a delivery takes: the supplier's own, or the café's;
--   reorder level  the item's own, when it has one; else the use until a
--                  delivery comes and a day more (as running out judges), and
--                  the safety stock;
--   order up to    the item's par level, else the most it holds, else the
--                  reorder level and a week of use.
--
-- An item is to order when what it has and what is coming (on hand, on order
-- and in draft) is below its reorder level, as the alert says: up to the level
-- it is ordered up to, in whole packs, one at least. Under 7 days of history and no
-- reorder level of its own, there is not enough history to judge by; not used
-- in the last 28 days and no reorder level, nothing is needed.
--
-- The supplier: the item's usual one, else the one its last delivery came
-- from (in the last year), else the one it was last set with. The pack: the
-- one it is bought in from them, else the unit of their last delivery of it,
-- else the item's base unit. A pack's price: the newer of the one agreed last
-- with them and their last delivery's, else what the item costs now. Every
-- supplier it has come from, or is set with, is there to choose from, each
-- with its own pack and price.
create or replace function buying_list(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_loc uuid := resolve_location(v_business, p_location);
  v_now timestamptz := now();
  v_today date := business_local_date(v_business, now());
  v_lead_cafe numeric := alert_setting(v_business, 'lead_time_days');
  v_out jsonb := '[]';
  x record; c jsonb;
  v_history int; v_days int; v_daily numeric; v_lead numeric; v_reorder numeric; v_reorder_from text;
  v_target numeric; v_target_from text; v_position numeric; v_status text; v_factor numeric; v_pack text;
  v_packs numeric; v_price numeric; v_price_from text; v_price_on date;
begin
  for x in
    with moves as (
      select m.item_id, sum(m.base_quantity_signed) as on_hand, min(m.occurred_at) as first_at,
             -sum(m.base_quantity_signed) filter (
                where m.occurred_at >= v_now - interval '28 days'
                  and stock_card_kind(m.type, m.reference_type, m.base_quantity_signed) in ('sold', 'batches', 'wasted'))
               as used
        from inventory_movement m
       where m.business_id = v_business and m.location_id = v_loc
       group by m.item_id
    ),
    open_po as (
      select o.id, o.po_no, o.status from purchase_order o
       where o.business_id = v_business and o.location_id = v_loc and o.status in ('draft', 'approved', 'sent')
    ),
    came as (
      select o.id as po_id, g.item_id, g.base_qty from open_po o cross join lateral po_received(o.id) g
    ),
    waiting as (
      select o.id, o.po_no, o.status, l.item_id, greatest(l.base_qty - coalesce(cm.base_qty, 0), 0) as base_qty
        from open_po o join purchase_order_line l on l.purchase_order_id = o.id
        left join came cm on cm.po_id = o.id and cm.item_id = l.item_id
    ),
    coming as (
      select w.item_id,
             coalesce(sum(w.base_qty) filter (where w.status <> 'draft'), 0) as on_order,
             coalesce(sum(w.base_qty) filter (where w.status = 'draft'), 0) as in_draft,
             coalesce(jsonb_agg(jsonb_build_object('po_id', w.id, 'po_no', w.po_no, 'status', w.status,
                                                   'base_qty', w.base_qty) order by w.po_no)
                        filter (where w.base_qty > 0), '[]'::jsonb) as orders
        from waiting w group by w.item_id
    ),
    delivered as (
      select distinct on (d.item_id, d.supplier_id) d.*
        from (select (l ->> 'item_id')::uuid as item_id, (st ->> 'supplier_id')::uuid as supplier_id,
                     l ->> 'unit_code' as unit_code, (l ->> 'base_qty')::numeric as base_qty,
                     (l ->> 'goods_value')::numeric as goods_value, (st ->> 'received_on')::date as received_on,
                     g.received_at, g.receipt_no
                from goods_receipt g cross join lateral receipt_state(g.id) st
                cross join lateral jsonb_array_elements(st -> 'lines') l
               where g.business_id = v_business and g.received_at >= v_now - interval '365 days') d
       where d.supplier_id is not null and d.base_qty > 0
       order by d.item_id, d.supplier_id, d.received_at desc, d.receipt_no desc
    ),
    terms as (
      select t.item_id, t.supplier_id, sp.name as supplier, sp.lead_time_days, coalesce(s.preferred, false) as usual,
             s.updated_at as set_at, d.received_at as delivered_at, pk.unit as pack_unit,
             unit_factor(t.item_id, pk.unit) as factor, s.last_price, s.last_price_on,
             d.goods_value, d.base_qty as delivered_base, d.received_on
        from (select s.item_id, s.supplier_id from item_supplier s where s.business_id = v_business
              union
              select d.item_id, d.supplier_id from delivered d) t
        join supplier sp on sp.id = t.supplier_id and sp.is_active
        join item i on i.id = t.item_id
        left join item_supplier s on s.item_id = t.item_id and s.supplier_id = t.supplier_id
        left join delivered d on d.item_id = t.item_id and d.supplier_id = t.supplier_id
        cross join lateral (select case when unit_factor(i.id, s.pack_unit_code) is not null then s.pack_unit_code
                                        when unit_factor(i.id, d.unit_code) is not null then d.unit_code
                                        else i.base_unit_code end as unit) pk
    ),
    priced as (
      select t.*,
             case when t.last_price is not null and (t.received_on is null or t.last_price_on >= t.received_on)
                  then 'agreed' when t.received_on is not null then 'delivery' end as price_from
        from terms t
    ),
    choices as (
      select p.item_id,
             jsonb_agg(jsonb_build_object(
               'supplier_id', p.supplier_id, 'supplier', p.supplier, 'usual', p.usual,
               'lead_time', p.lead_time_days, 'pack_unit', p.pack_unit, 'pack_factor', p.factor,
               'price', case p.price_from when 'agreed' then p.last_price
                                          when 'delivery' then trim_scale(round(p.goods_value / p.delivered_base
                                                                                * p.factor, 2)) end,
               'price_from', p.price_from,
               'price_on', case p.price_from when 'agreed' then p.last_price_on when 'delivery' then p.received_on end,
               'from', case when p.usual then 'usual' when p.delivered_at is not null then 'last_delivery'
                            else 'set' end)
               order by p.usual desc, p.delivered_at desc nulls last, p.set_at desc nulls last, p.supplier)
               as list
        from priced p group by p.item_id
    )
    select i.id, i.name, i.base_unit_code, i.item_type, i.min_level_base, i.max_level_base, i.par_level_base,
           i.safety_stock_base, coalesce(m.on_hand, 0) as on_hand, m.first_at, coalesce(m.used, 0) as used,
           coalesce(cg.on_order, 0) as on_order, coalesce(cg.in_draft, 0) as in_draft,
           coalesce(cg.orders, '[]'::jsonb) as orders, coalesce(ch.list, '[]'::jsonb) as choices
      from item i
      left join moves m on m.item_id = i.id
      left join coming cg on cg.item_id = i.id
      left join choices ch on ch.item_id = i.id
     where i.business_id = v_business and i.is_active
       and not exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active)
     order by i.name, i.id
  loop
    -- The history there is, and the use a day over it.
    v_history := case when x.first_at is not null then v_today - business_local_date(v_business, x.first_at) end;
    v_days := case when v_history is not null then least(28, v_history) end;
    v_daily := case when v_history >= 7 then greatest(x.used, 0) / v_days end;
    -- The supplier, its pack and a pack's price.
    c := x.choices -> 0;
    v_lead := coalesce((c ->> 'lead_time')::numeric, v_lead_cafe);
    v_pack := coalesce(c ->> 'pack_unit', x.base_unit_code);
    v_factor := coalesce((c ->> 'pack_factor')::numeric, 1);
    v_price := (c ->> 'price')::numeric;
    v_price_from := c ->> 'price_from';
    v_price_on := (c ->> 'price_on')::date;
    if v_price is null then
      v_price := trim_scale(round(item_reference_cost(v_business, x.id, v_loc) * v_factor, 2));
      v_price_from := case when v_price is not null then 'cost' end;
      v_price_on := null;
    end if;
    -- The levels.
    v_reorder := null; v_reorder_from := null; v_target := null; v_target_from := null;
    if x.min_level_base > 0 then
      v_reorder := x.min_level_base; v_reorder_from := 'item';
    elsif v_daily > 0 then
      v_reorder := v_daily * (v_lead + 1) + coalesce(greatest(x.safety_stock_base, 0), 0); v_reorder_from := 'use';
    end if;
    if v_reorder is not null then
      if x.par_level_base > 0 then v_target := x.par_level_base; v_target_from := 'par';
      elsif x.max_level_base > 0 then v_target := x.max_level_base; v_target_from := 'max';
      elsif v_daily > 0 then v_target := v_reorder + 7 * v_daily; v_target_from := 'week';
      else v_target := v_reorder; v_target_from := 'reorder';
      end if;
      v_target := greatest(v_target, v_reorder);
    end if;
    v_position := x.on_hand + x.on_order + x.in_draft;
    v_status := case when v_reorder is null and coalesce(v_history, 0) < 7 then 'no_history'
                     when v_reorder is null then 'not_used'
                     when v_position < v_reorder then 'order'
                     else 'enough' end;
    v_packs := case when v_status = 'order' then greatest(ceil((v_target - v_position) / v_factor), 1) else 0 end;
    v_out := v_out || jsonb_build_object(
      'item_id', x.id, 'item', x.name, 'base_unit', x.base_unit_code, 'item_type', x.item_type,
      'status', v_status,
      'on_hand', trim_scale(x.on_hand), 'on_order', trim_scale(x.on_order), 'in_draft', trim_scale(x.in_draft),
      'position', trim_scale(v_position), 'orders', x.orders,
      'history_days', v_history, 'days', v_days, 'used', trim_scale(x.used),
      'daily_use', trim_scale(round(v_daily, 3)),
      'lead_time', v_lead, 'lead_from', case when c ->> 'lead_time' is not null then 'supplier' else 'cafe' end,
      'reorder_level', trim_scale(round(v_reorder, 3)), 'reorder_from', v_reorder_from,
      'safety_stock', case when v_reorder_from = 'use' and x.safety_stock_base > 0 then x.safety_stock_base end,
      'target_level', trim_scale(round(v_target, 3)), 'target_from', v_target_from,
      'supplier_id', c ->> 'supplier_id', 'supplier', c ->> 'supplier', 'supplier_from', c ->> 'from',
      'pack_unit', v_pack, 'pack_factor', v_factor,
      'packs', v_packs, 'qty_base', trim_scale(v_packs * v_factor),
      'price', v_price, 'price_from', v_price_from, 'price_on', v_price_on,
      'choices', x.choices);
  end loop;
  return jsonb_build_object(
    'location_id', v_loc, 'location', (select name from location where id = v_loc),
    'as_of', v_today, 'window_days', 28, 'lead_time', v_lead_cafe,
    'items', v_out);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Orders drafted from the list
-- ---------------------------------------------------------------------------
-- (purchase.create) The lines chosen from the list, each with its supplier:
-- a draft order for each supplier, as save_po makes one (on the audit trail
-- as it puts it), for the location, expected in the days the supplier's
-- deliveries take (the café's when it has none), with no note: an order's
-- note is for its supplier. Then each line's pack and price kept for that
-- supplier, and the supplier made the item's usual one where the line asks.
create or replace function purchase_orders_from_list__run(p_lines jsonb, p_location uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create');
  v_loc uuid := resolve_location(v_business, p_location);
  v_today date := business_local_date(v_business, now());
  v_lead numeric := alert_setting(v_business, 'lead_time_days');
  l jsonb; s record; v_po jsonb; v_orders jsonb := '[]'; v_name text;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Choose at least one item to order';
  end if;
  if jsonb_array_length(p_lines) > 300 then raise exception 'At most 300 lines at once'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if nullif(l ->> 'supplier_id', '') is null then
      select name into v_name from item where id = (l ->> 'item_id')::uuid and business_id = v_business;
      raise exception 'Choose a supplier for %', coalesce(v_name, 'every line');
    end if;
  end loop;
  for s in
    select (e.line ->> 'supplier_id')::uuid as supplier_id, min(sp.name) as supplier,
           min(coalesce(sp.lead_time_days, v_lead))::int as lead,
           jsonb_agg(e.line - 'supplier_id' - 'usual' order by e.n) as lines
      from jsonb_array_elements(p_lines) with ordinality e(line, n)
      left join supplier sp on sp.id = (e.line ->> 'supplier_id')::uuid and sp.business_id = v_business
     group by 1
     order by 2 nulls last, 1
  loop
    v_po := save_po__run(null, s.supplier_id, s.lines, v_today + s.lead, null, v_loc);
    v_orders := v_orders || jsonb_build_object('po_id', v_po -> 'po_id', 'po_no', v_po -> 'po_no',
                                               'supplier_id', s.supplier_id, 'supplier', s.supplier,
                                               'expected_on', v_today + s.lead, 'total', v_po -> 'total',
                                               'lines', jsonb_array_length(s.lines));
  end loop;
  -- The lines are checked now: their packs and prices kept.
  for l in select * from jsonb_array_elements(p_lines) loop
    perform remember_item_supplier(v_business, (l ->> 'item_id')::uuid, (l ->> 'supplier_id')::uuid,
                                   coalesce(nullif(l ->> 'unit_code', ''),
                                            (select base_unit_code from item where id = (l ->> 'item_id')::uuid)),
                                   (l ->> 'unit_price')::numeric,
                                   case when coalesce((l ->> 'usual')::boolean, false) then true end, null);
  end loop;
  return jsonb_build_object('orders', v_orders, 'count', jsonb_array_length(v_orders));
end $$;

create or replace function purchase_orders_from_list(p_lines jsonb, p_location uuid default null,
                                                     p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_lines', p_lines, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'purchase_orders_from_list', v_req);
  if v is not null then return v; end if;
  v := purchase_orders_from_list__run(p_lines => p_lines, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'purchase_orders_from_list', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Running out, and below the reorder level, lead to What to buy
-- ---------------------------------------------------------------------------
-- 0040's rules stay as they are. An item bought, not made here, that is
-- running out or below its reorder level is ordered on What to buy, so the
-- alert leads there rather than to its stock card; one made here still leads
-- to its card (the alert says to make a batch).
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0040;
revoke execute on function alert_conditions_0040(uuid, timestamptz) from public, anon, authenticated;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence,
         case when c.rule in ('running_out', 'below_minimum')
                   and not exists (select 1 from recipe rc where rc.output_item_id::text = c.subject and rc.is_active)
              then '/purchasing/buying-list' else c.link end,
         c.facts
    from alert_conditions_0040(p_business, p_now) c
$$;

-- ---------------------------------------------------------------------------
-- 6. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  alert_conditions(uuid, timestamptz),
  unit_factor(uuid, text), item_supplier_snapshot(uuid, uuid),
  remember_item_supplier(uuid, uuid, uuid, text, numeric, boolean, text),
  set_item_supplier__run(uuid, uuid, text, numeric, boolean), remove_item_supplier__run(uuid, uuid),
  purchase_orders_from_list__run(jsonb, uuid)
  from public, anon, authenticated;
revoke execute on function
  set_item_supplier(uuid, uuid, text, numeric, boolean, uuid), remove_item_supplier(uuid, uuid, uuid),
  buying_list(uuid), purchase_orders_from_list(jsonb, uuid, uuid)
  from public, anon;
grant execute on function
  set_item_supplier(uuid, uuid, text, numeric, boolean, uuid), remove_item_supplier(uuid, uuid, uuid),
  buying_list(uuid), purchase_orders_from_list(jsonb, uuid, uuid)
  to authenticated;
