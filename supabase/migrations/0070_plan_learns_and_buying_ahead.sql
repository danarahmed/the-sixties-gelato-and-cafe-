-- =============================================================================
-- 0070 — The plan learns, What to buy looks ahead, and a week's waste (round ten)
-- =============================================================================
-- The owner's answer on waste, as chosen: the production plan learns from
-- what was thrown away and what sold out; What to buy looks at the days ahead,
-- the day's plan and how long things keep; and a weekly look at what was
-- thrown away, on Reports → Waste. Each only recommends: what is made and
-- bought is still the café's to record.
--
--  * The day's plan (production_plan) still judges by the same weekdays of the
--    weeks before (four to eight), what went: sold, into other batches, sent
--    away. Now it also reads, for each of those days, what was thrown away
--    unsold (waste, spoilage, expired) and whether it sold out (next to
--    nothing left at the day's end, and none thrown away). Sold out on half
--    those days or more, and never thrown away, it could have sold more: the
--    plan makes for more, a batch for every day it sold out out of the days
--    judged (sold out every time: a whole batch more). Thrown away on half the
--    days or more, and never sold out, it makes what was thrown away on
--    average the less, half a batch at most and never below one batch. It
--    says which it learnt.
--  * What to buy (buying_list) judges use without what was thrown away unsold
--    (shown apart), so waste is not bought again. With four weeks behind an
--    item, the days a delivery takes are judged each by its weekday, a Friday
--    as a Friday. What today's plan needs of an ingredient beyond what its
--    weekday's batches use is added. An item given how many days it keeps
--    (set on What to buy) is ordered up to no more than those days will use,
--    unless the order must be more to last until the next comes.
--  * A week's waste (waste_coach): what was thrown away unsold in the seven
--    days to a day, item by item, against the seven before, on which
--    weekdays, whether the café makes it or buys it, and how long it keeps.
--
-- Nothing recorded changes: these read, and the one new value (how long an
-- item keeps) is set with its own function, on the audit trail.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. How long a bought item keeps
-- -----------------------------------------------------------------------------
alter table item add column if not exists keeps_days int;
alter table item drop constraint if exists item_keeps_days;
alter table item add constraint item_keeps_days check (keeps_days between 1 and 365);

-- Set (p_days 1 to 365) or taken away (null): what keeps only so many days is
-- ordered up to no more than they will use.
create or replace function set_item_keeps__run(p_item uuid, p_days int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  i item;
begin
  select * into i from item where id = p_item and business_id = v_business for update;
  if not found then raise exception 'Unknown item'; end if;
  if p_days is not null and (p_days < 1 or p_days > 365) then
    raise exception 'An item keeps 1 to 365 days, or say nothing';
  end if;
  if p_days is distinct from i.keeps_days then
    update item set keeps_days = p_days where id = p_item;
    perform audit_event(v_business, 'item.keeps', 'item', p_item::text, null,
      jsonb_build_object('name', i.name, 'keeps_days', i.keeps_days),
      jsonb_build_object('name', i.name, 'keeps_days', p_days));
  end if;
  return jsonb_build_object('item_id', p_item, 'keeps_days', p_days);
end $$;

create or replace function set_item_keeps(p_item uuid, p_days int, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_item', p_item, 'p_days', p_days);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_item_keeps', v_req);
  if v is not null then return v; end if;
  v := set_item_keeps__run(p_item => p_item, p_days => p_days);
  perform idem_finish(v_business, p_idempotency_key, 'set_item_keeps', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 2. The day's plan learns from what was thrown away and what sold out
-- -----------------------------------------------------------------------------
-- 0055's production_plan, learning (0070): each day it judges by says what was
-- thrown away unsold and whether it sold out. Sold out on half those days or
-- more, never thrown away, it makes for a batch more for every day it sold
-- out out of the days judged ('bump'); thrown away on half or more, never
-- sold out, what was thrown away on average the less, half a batch at most
-- and never below one batch ('trim'). 'seen' is what went on average,
-- 'demand' what the plan makes for, 'learned' which it learnt.
create or replace function production_plan(p_day date default null, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record', 'cost.view');
  v_loc uuid := resolve_location(v_business, p_location);
  v_tz text := (select timezone from business where id = v_business);
  v_day date := coalesce(p_day, business_local_date(v_business, now()));
  v_day_end timestamptz;
  r record; v_out jsonb := '[]'; v_first date; v_history int; v_weeks int; v_days jsonb; v_demand numeric;
  v_seen numeric; v_sold_out int; v_waste_days int; v_waste_avg numeric; v_bump numeric; v_trim numeric;
  v_learned text;
  v_on_hand numeric; v_due numeric; v_good numeric; v_make numeric; v_batches numeric; v_status text;
  v_needs jsonb; v_plan_recipes uuid[] := '{}'; v_plan_batches numeric[] := '{}'; v_all jsonb;
begin
  v_day_end := (v_day + 1)::timestamp at time zone v_tz;
  for r in
    select rc.id, rc.name, rc.output_item_id as item_id, i.name as item, i.base_unit_code as unit,
           rc.batch_yield_base as yield, coalesce(rc.batch_yield_unit, i.base_unit_code) as yield_unit
      from recipe rc join item i on i.id = rc.output_item_id
     where rc.business_id = v_business and rc.is_active and rc.output_item_id is not null
       and rc.batch_yield_base > 0
     order by rc.name
  loop
    select business_local_date(v_business, min(m.occurred_at)) into v_first
      from inventory_movement m
     where m.business_id = v_business and m.item_id = r.item_id and m.location_id = v_loc;
    v_history := case when v_first is not null then v_day - v_first end;
    v_weeks := least(8, greatest(coalesce(v_history, 0), 0) / 7);
    v_days := '[]'; v_demand := null; v_seen := null; v_sold_out := 0; v_waste_days := 0;
    v_waste_avg := 0; v_bump := 0; v_trim := 0; v_learned := null;
    if v_weeks >= 4 then
      -- Each of the same weekdays before: what went (sold, into batches, sent
      -- away), what was thrown away unsold (0070), and whether it sold out:
      -- next to nothing left at the day's end (under 5% of a batch), none thrown.
      select jsonb_agg(jsonb_build_object('day', x.d, 'used', trim_scale(x.u), 'wasted', trim_scale(x.wst),
                                          'sold_out', x.out) order by x.d desc),
             avg(x.u), count(*) filter (where x.out), count(*) filter (where x.wst > 0), avg(x.wst)
        into v_days, v_seen, v_sold_out, v_waste_days, v_waste_avg
        from (select y.d, y.u, y.wst, (y.u > 0 and y.wst = 0 and y.left_at_close < 0.05 * r.yield) as out
                from (select (v_day - 7 * k) as d,
                             coalesce((select -sum(m.base_quantity_signed) from inventory_movement m
                                        where m.business_id = v_business and m.item_id = r.item_id
                                          and m.location_id = v_loc
                                          and m.occurred_at >= (v_day - 7 * k)::timestamp at time zone v_tz
                                          and m.occurred_at < (v_day - 7 * k + 1)::timestamp at time zone v_tz
                                          and (stock_card_kind(m.type, m.reference_type, m.base_quantity_signed)
                                                 in ('sold', 'batches') or sent_away(m))), 0) as u,
                             coalesce((select -sum(m.base_quantity_signed) from inventory_movement m
                                        where m.business_id = v_business and m.item_id = r.item_id
                                          and m.location_id = v_loc
                                          and m.occurred_at >= (v_day - 7 * k)::timestamp at time zone v_tz
                                          and m.occurred_at < (v_day - 7 * k + 1)::timestamp at time zone v_tz
                                          and m.type in ('waste', 'spoilage', 'expired')
                                          and not exists (select 1 from loss_review lr where lr.movement_id = m.id
                                                             and lr.decision = 'reversed')), 0) as wst,
                             coalesce((select sum(m.base_quantity_signed) from inventory_movement m
                                        where m.business_id = v_business and m.item_id = r.item_id
                                          and m.location_id = v_loc
                                          and m.occurred_at < (v_day - 7 * k + 1)::timestamp at time zone v_tz), 0)
                               as left_at_close
                        from generate_series(1, v_weeks) k) y) x;
      -- What it could have sold (0070). Sold out on half the days or more, and
      -- never thrown away: a batch more for every day it sold out out of the
      -- days judged (sold out every time, a whole batch more). Thrown away on
      -- half the days or more, and never sold out: what was thrown away on
      -- average the less, half a batch at most (below, never the one batch).
      v_demand := v_seen;
      if v_sold_out * 2 >= v_weeks and v_waste_days = 0 then
        v_bump := r.yield * v_sold_out / v_weeks;
        v_demand := v_seen + v_bump;
        v_learned := 'sold_out';
      elsif v_waste_days * 2 >= v_weeks and v_sold_out = 0 then
        v_trim := least(coalesce(v_waste_avg, 0), r.yield / 2);
      end if;
    end if;
    v_on_hand := (item_position(v_business, r.item_id, v_loc)).qty;
    select coalesce(sum(lot.left_base), 0) into v_due
      from item_lot lot
     where lot.business_id = v_business and lot.item_id = r.item_id and lot.location_id = v_loc
       and lot.left_base > 0 and lot.use_by < v_day_end;
    v_good := greatest(v_on_hand - v_due, 0);
    if v_demand is null then
      v_status := 'no_history'; v_make := null; v_batches := 0;
    else
      v_make := greatest(v_demand - v_good, 0);
      -- Thrown away often (0070): the less, but never below the one batch.
      v_trim := least(v_trim, greatest(v_make - r.yield, 0));
      v_make := v_make - v_trim;
      if v_trim > 0 then v_learned := 'waste'; end if;
      v_batches := case when v_make > 0 then ceil(v_make / r.yield) else 0 end;
      v_status := case when v_batches > 0 then 'make' else 'enough' end;
    end if;
    v_needs := '[]';
    if v_batches > 0 then
      v_plan_recipes := v_plan_recipes || r.id;
      v_plan_batches := v_plan_batches || v_batches;
      select coalesce(jsonb_agg(jsonb_build_object(
               'item_id', n.item_id, 'item', i.name, 'base_unit', i.base_unit_code,
               'needed', trim_scale(n.qty), 'on_hand', trim_scale(n.on_hand),
               'short', trim_scale(greatest(n.qty - greatest(n.on_hand, 0), 0))) order by i.name), '[]'::jsonb)
        into v_needs
        from (select e.item_id, sum(e.base_qty) as qty, (item_position(v_business, e.item_id, v_loc)).qty as on_hand
                from expand_recipe(r.id, 'dine_in', v_batches, v_day) e group by e.item_id) n
        join item i on i.id = n.item_id;
    end if;
    v_out := v_out || jsonb_build_object(
      'recipe_id', r.id, 'recipe', r.name, 'item_id', r.item_id, 'item', r.item, 'base_unit', r.unit,
      'batch_yield', trim_scale(r.yield), 'yield_unit', r.yield_unit, 'status', v_status,
      'history_days', v_history, 'weeks', case when v_weeks >= 4 then v_weeks end, 'days', v_days,
      'demand', trim_scale(round(v_demand, 3)), 'seen', trim_scale(round(v_seen, 3)),
      'sold_out_days', v_sold_out, 'waste_days', v_waste_days, 'wasted_avg', trim_scale(round(v_waste_avg, 3)),
      'bump', trim_scale(round(v_bump, 3)), 'trim', trim_scale(round(v_trim, 3)), 'learned', v_learned,
      'on_hand', trim_scale(v_on_hand), 'due', trim_scale(v_due),
      'good', trim_scale(v_good), 'to_make', trim_scale(round(v_make, 3)), 'batches', v_batches,
      'makes', trim_scale(v_batches * r.yield), 'ingredients', v_needs);
  end loop;
  -- All the batches to make together: what each ingredient is short of.
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', n.item_id, 'item', i.name, 'base_unit', i.base_unit_code,
           'needed', trim_scale(n.qty), 'on_hand', trim_scale(n.on_hand),
           'short', trim_scale(greatest(n.qty - greatest(n.on_hand, 0), 0))) order by i.name), '[]'::jsonb)
    into v_all
    from (select e.item_id, sum(e.base_qty) as qty, (item_position(v_business, e.item_id, v_loc)).qty as on_hand
            from unnest(v_plan_recipes, v_plan_batches) p(recipe_id, batches),
                 lateral expand_recipe(p.recipe_id, 'dine_in', p.batches, v_day) e
           group by e.item_id) n
    join item i on i.id = n.item_id;
  return jsonb_build_object('day', v_day, 'weekday', extract(isodow from v_day)::int,
                            'location_id', v_loc, 'location', (select name from location where id = v_loc),
                            'recipes', v_out, 'ingredients', v_all);
end $$;

-- -----------------------------------------------------------------------------
-- 3. What to buy looks at the days ahead
-- -----------------------------------------------------------------------------
-- What was thrown away unsold (0070): wasted, spoilt or expired, and the
-- taking back of one on review, so the two come to nothing together.
create or replace function thrown_unsold(m inventory_movement) returns boolean
language sql stable set search_path = public as $$
  select m.type in ('waste', 'spoilage', 'expired')
         or (m.type = 'reversal' and m.reference_type = 'loss_review'
             and exists (select 1 from loss_review r join inventory_movement o on o.id = r.movement_id
                          where r.id = m.reference_id and o.type in ('waste', 'spoilage', 'expired')))
$$;

-- What a movement used of an item, not counting what was thrown away unsold
-- (0070): sold, into batches, sent away, and the other losses (eaten by the
-- staff, given away, spilt), which the café goes on using.
create or replace function use_not_waste(m inventory_movement) returns boolean
language sql stable set search_path = public as $$
  select (stock_card_kind(m.type, m.reference_type, m.base_quantity_signed) in ('sold', 'batches', 'wasted')
          or sent_away(m))
         and not thrown_unsold(m)
$$;

-- 0055's buying_list, looking ahead (0070): use without what was thrown away
-- unsold ('wasted', shown apart); the days a delivery takes each by its
-- weekday ('lead_use'), with four weeks behind the item; what today's plan
-- needs beyond its weekday's batches ('plan_extra'; reorder_from 'plan' for
-- an item with no use yet); and what keeps only a few days ordered up to no
-- more than they will use ('capped', 'cap_level').
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
  v_tz text := (select timezone from business where id = v_business);
  v_plan jsonb; v_wd numeric[]; v_forecast text; v_lead_use numeric; v_plan_need numeric; v_plan_extra numeric;
  v_wd_batches numeric; v_cap numeric; v_capped boolean;
begin
  -- What today's plan needs of each ingredient (0070).
  v_plan := coalesce(production_plan(v_today, v_loc) -> 'ingredients', '[]'::jsonb);
  for x in
    with moves as (
      select m.item_id, sum(m.base_quantity_signed) as on_hand, min(m.occurred_at) as first_at,
             -sum(m.base_quantity_signed) filter (
                where m.occurred_at >= v_now - interval '28 days' and use_not_waste(m))
               as used,
             -sum(m.base_quantity_signed) filter (
                where m.occurred_at >= v_now - interval '28 days' and thrown_unsold(m))
               as wasted
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
    -- What another place has sent here and is on its way (0055).
    on_way as (
      select l.item_id, sum(l.base_qty) as base_qty
        from stock_transfer t join stock_transfer_line l on l.transfer_id = t.id
       where t.business_id = v_business and t.to_location_id = v_loc and t.status = 'sent'
       group by l.item_id
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
           coalesce(m.wasted, 0) as wasted, i.keeps_days,
           coalesce(cg.on_order, 0) as on_order, coalesce(cg.in_draft, 0) as in_draft,
           coalesce(ow.base_qty, 0) as on_way,
           coalesce(cg.orders, '[]'::jsonb) as orders, coalesce(ch.list, '[]'::jsonb) as choices
      from item i
      left join moves m on m.item_id = i.id
      left join coming cg on cg.item_id = i.id
      left join on_way ow on ow.item_id = i.id
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
    -- The days a delivery takes, each as its weekday used it over four weeks,
    -- a Friday as a Friday; with less behind it, a day on average (0070).
    v_wd := null; v_forecast := null; v_lead_use := null; v_plan_extra := 0;
    if v_daily > 0 then
      if v_history >= 28 then
        select array_agg(coalesce(u.qty, 0) / 4 order by d.wd) into v_wd
          from generate_series(1, 7) d(wd)
          left join (select extract(isodow from m.occurred_at at time zone v_tz)::int as wd,
                            -sum(m.base_quantity_signed) as qty
                       from inventory_movement m
                      where m.business_id = v_business and m.location_id = v_loc and m.item_id = x.id
                        and m.occurred_at >= v_now - interval '28 days' and use_not_waste(m)
                      group by 1) u on u.wd = d.wd;
        v_forecast := 'weekday';
      else
        v_forecast := 'average';
      end if;
      v_lead_use := (select coalesce(sum(coalesce(v_wd[extract(isodow from v_today + t)::int], v_daily)), 0)
                       from generate_series(0, floor(v_lead)::int) t)
                    + (v_lead - floor(v_lead))
                      * coalesce(v_wd[extract(isodow from v_today + floor(v_lead)::int + 1)::int], v_daily);
    end if;
    -- Today's plan: what it needs of this beyond what its weekday's batches use.
    v_plan_need := coalesce((select sum((e ->> 'needed')::numeric) from jsonb_array_elements(v_plan) e
                              where (e ->> 'item_id')::uuid = x.id), 0);
    if v_plan_need > 0 then
      select coalesce(-sum(m.base_quantity_signed), 0)
             / case when v_history >= 28 then 4 else greatest(coalesce(v_days, 1), 1) end
        into v_wd_batches
        from inventory_movement m
       where m.business_id = v_business and m.location_id = v_loc and m.item_id = x.id
         and m.occurred_at >= v_now - make_interval(days => case when v_history >= 28 then 28
                                                               else greatest(coalesce(v_days, 1), 1) end)
         and stock_card_kind(m.type, m.reference_type, m.base_quantity_signed) = 'batches'
         and (v_history < 28 or extract(isodow from m.occurred_at at time zone v_tz) = extract(isodow from v_today));
      v_plan_extra := greatest(v_plan_need - v_wd_batches, 0);
    end if;
    v_reorder := null; v_reorder_from := null; v_target := null; v_target_from := null;
    if x.min_level_base > 0 then
      v_reorder := x.min_level_base + v_plan_extra; v_reorder_from := 'item';
    elsif v_daily > 0 then
      v_reorder := v_lead_use + v_plan_extra + coalesce(greatest(x.safety_stock_base, 0), 0);
      v_reorder_from := 'use';
    elsif v_plan_need > 0 then
      v_reorder := v_plan_need + coalesce(greatest(x.safety_stock_base, 0), 0); v_reorder_from := 'plan';
    end if;
    if v_reorder is not null then
      if x.par_level_base > 0 then v_target := x.par_level_base; v_target_from := 'par';
      elsif x.max_level_base > 0 then v_target := x.max_level_base; v_target_from := 'max';
      elsif v_daily > 0 then v_target := v_reorder + 7 * v_daily; v_target_from := 'week';
      else v_target := v_reorder; v_target_from := 'reorder';
      end if;
      v_target := greatest(v_target, v_reorder);
    end if;
    -- What keeps only a few days: up to no more than those days will use, and
    -- what today's plan needs of it, unless the order must be more to last
    -- until the next one comes (0070).
    v_cap := null; v_capped := false;
    if v_reorder is not null and x.keeps_days is not null then
      v_cap := (select coalesce(sum(coalesce(v_wd[extract(isodow from v_today + t)::int], v_daily, 0)), 0)
                  from generate_series(0, x.keeps_days - 1) t)
               + case when v_reorder_from = 'plan' then v_plan_need else v_plan_extra end;
      if v_target > greatest(v_cap, v_reorder) then
        v_target := greatest(v_cap, v_reorder); v_capped := true;
      end if;
    end if;
    v_position := x.on_hand + x.on_order + x.in_draft + x.on_way;
    v_status := case when v_reorder is null and coalesce(v_history, 0) < 7 then 'no_history'
                     when v_reorder is null then 'not_used'
                     when v_position < v_reorder then 'order'
                     else 'enough' end;
    -- Whole packs; under a cap of what keeps, rounded down, but enough to
    -- reach the reorder level, and one at least.
    v_packs := case when v_status <> 'order' then 0
                    when v_capped then greatest(floor((v_target - v_position) / v_factor),
                                                ceil((v_reorder - v_position) / v_factor), 1)
                    else greatest(ceil((v_target - v_position) / v_factor), 1) end;
    v_out := v_out || jsonb_build_object(
      'item_id', x.id, 'item', x.name, 'base_unit', x.base_unit_code, 'item_type', x.item_type,
      'status', v_status,
      'on_hand', trim_scale(x.on_hand), 'on_order', trim_scale(x.on_order), 'in_draft', trim_scale(x.in_draft),
      'on_way', trim_scale(x.on_way),
      'position', trim_scale(v_position), 'orders', x.orders,
      'history_days', v_history, 'days', v_days, 'used', trim_scale(x.used), 'wasted', trim_scale(x.wasted),
      'forecast', v_forecast, 'lead_use', trim_scale(round(v_lead_use, 3)),
      'plan_need', trim_scale(v_plan_need), 'plan_extra', trim_scale(round(v_plan_extra, 3)),
      'keeps_days', x.keeps_days, 'capped', v_capped, 'cap_level', trim_scale(round(v_cap, 3)),
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

-- -----------------------------------------------------------------------------
-- 4. A week's waste
-- -----------------------------------------------------------------------------
-- What was thrown away unsold (waste, spoilage, expired) in the seven days to
-- p_to (today by default) and the seven before, item by item, the costliest
-- first: how much, what it cost, how many times and on which weekdays (1
-- Monday … 7 Sunday), whether the café makes it (a batch recipe's output) and
-- how long it keeps; and the weeks' totals. A loss reversed on review is not
-- counted.
create or replace function waste_coach(p_to date default null, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_loc uuid;
  v_to date := coalesce(p_to, business_local_date(v_business, now()));
  v_tz text := (select timezone from business where id = v_business);
  w record; p record;
begin
  v_loc := report_place(v_business, p_location);
  select from_ts, to_ts into w from local_day_bounds(v_business, v_to - 6, v_to);
  select from_ts, to_ts into p from local_day_bounds(v_business, v_to - 13, v_to - 7);
  return (
    with thrown as (
      select m.item_id, -m.base_quantity_signed as qty, coalesce(m.value, 0) as value, m.occurred_at,
             (m.occurred_at >= w.from_ts) as this_week
        from inventory_movement m
       where m.business_id = v_business and m.type in ('waste', 'spoilage', 'expired')
         and m.base_quantity_signed < 0
         and m.occurred_at >= p.from_ts and m.occurred_at < w.to_ts
         and (v_loc is null or m.location_id = v_loc)
         and not exists (select 1 from loss_review r where r.movement_id = m.id and r.decision = 'reversed')
    ),
    by_item as (
      select t.item_id,
             coalesce(sum(t.qty) filter (where t.this_week), 0) as qty,
             coalesce(sum(t.value) filter (where t.this_week), 0) as value,
             count(*) filter (where t.this_week) as times,
             coalesce(sum(t.qty) filter (where not t.this_week), 0) as qty_before,
             coalesce(sum(t.value) filter (where not t.this_week), 0) as value_before,
             coalesce(jsonb_agg(distinct extract(isodow from t.occurred_at at time zone v_tz)::int)
                        filter (where t.this_week), '[]'::jsonb) as weekdays
        from thrown t group by t.item_id
    )
    select jsonb_build_object(
      'from', v_to - 6, 'to', v_to,
      'value', coalesce((select sum(value) from by_item), 0),
      'value_before', coalesce((select sum(value_before) from by_item), 0),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'item_id', b.item_id, 'item', i.name, 'unit', i.base_unit_code,
                 'qty', trim_scale(b.qty), 'value', b.value, 'times', b.times, 'weekdays', b.weekdays,
                 'qty_before', trim_scale(b.qty_before), 'value_before', b.value_before,
                 'made', exists (select 1 from recipe rc where rc.output_item_id = b.item_id and rc.is_active),
                 'keeps_days', i.keeps_days)
               order by b.value desc, b.value_before desc, i.name)
          from by_item b join item i on i.id = b.item_id), '[]'::jsonb)));
end $$;

-- -----------------------------------------------------------------------------
-- 5. Who may call what
-- -----------------------------------------------------------------------------
revoke execute on function set_item_keeps__run(uuid, int), use_not_waste(inventory_movement),
  thrown_unsold(inventory_movement) from public, anon, authenticated;
revoke execute on function set_item_keeps(uuid, int, uuid), waste_coach(date, uuid) from public, anon;
grant execute on function set_item_keeps(uuid, int, uuid), waste_coach(date, uuid) to authenticated;
