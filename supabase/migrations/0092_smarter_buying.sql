-- =============================================================================
-- 0092 — Smarter buying (SMART_PLAN part 3, step 8)
-- =============================================================================
-- What to buy learns from the café's own orders and deliveries, and the orders
-- it suggests are drafted in one press, for a manager to approve and send.
--
--  * Each supplier's real delivery time, learnt: from each order sent to it
--    in the last six months to the day its first delivery came, the usual
--    days (the middle one) once there are three, how many came later than
--    usual, and the most days late lately (the last three months). With
--    fewer, the days set on the supplier, else the café's. How often it
--    delivers ("every 2 days") is set on the supplier, else read from the
--    days its deliveries came over three months, else a week
--    (supplier_terms, supplier_records).
--  * What to buy orders what would run out before the next delivery could
--    come: an item is to order when what it has and has coming would not
--    last until this order arrives, late as the supplier has come lately,
--    with enough over for its use straying from its weekday's (met 19 times
--    in 20); and is ordered up to what lasts until the delivery after it could
--    come. These suggested levels are shown beside any set by hand, which
--    still rule. An item with enough, but less than halfway to that, is
--    topped up when its supplier is ordered from anyway.
--  * A cheaper supplier: another's price for the same quantity, agreed or
--    delivered in the last six months, 3% or more below the one suggested.
--  * The drafts, ready to approve: draft_purchase_orders makes a draft order
--    for each supplier from what is to order and to top up, expected as the
--    supplier's deliveries are learnt to take. Approving and sending stay as
--    they were (approve_po, send_po), each by whoever may.
--  * Drafted orders are expected when the supplier's deliveries usually come.
--
-- Nothing recorded changes. One column: supplier.delivers_every_days.
-- =============================================================================

-- =============================================================================
-- 1. How often a supplier delivers
-- =============================================================================
alter table supplier add column if not exists delivers_every_days int;
alter table supplier drop constraint if exists supplier_delivers_every_days;
alter table supplier add constraint supplier_delivers_every_days check (delivers_every_days between 1 and 60);

-- 0066's update_supplier, with how often the supplier delivers (null: learnt
-- from its deliveries; left out, as it was).
drop function if exists update_supplier(uuid, text, text, text, boolean, text, int);
create or replace function update_supplier(p_supplier uuid, p_name text, p_contact text default null,
                                           p_phone text default null, p_is_active boolean default true,
                                           p_reason text default null, p_lead_time_days int default null,
                                           p_delivers_every_days int default -1)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('purchase.create'); s supplier; v_owed numeric;
begin
  select * into s from supplier where id = p_supplier and business_id = v_business for update;
  if not found then raise exception 'Unknown supplier'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Name the supplier'; end if;
  if p_lead_time_days is not null and p_lead_time_days not between 0 and 30 then
    raise exception 'A delivery takes 0 to 30 days';
  end if;
  if p_delivers_every_days is not null and p_delivers_every_days <> -1 and p_delivers_every_days not between 1 and 60 then
    raise exception 'A supplier delivers every 1 to 60 days';
  end if;
  if coalesce(p_is_active, true) then perform assert_name_free(v_business, 'supplier', p_name, p_supplier); end if;
  if not coalesce(p_is_active, true) and s.is_active then
    -- What the bills still owe: payments and credits set against them both count (0066).
    select coalesce(sum(amount_total - paid_amount), 0) into v_owed
      from purchase_invoice where supplier_id = p_supplier and cancelled_at is null;
    if v_owed > 0 then
      raise exception '% is still owed %: pay or cancel their bills before taking them out of use', s.name, trim_scale(v_owed);
    end if;
  end if;
  perform set_config('audit.reason', coalesce(trim(p_reason), ''), true);
  update supplier
     set name = trim(p_name), contact = nullif(trim(p_contact), ''), phone = nullif(trim(p_phone), ''),
         is_active = coalesce(p_is_active, true), lead_time_days = p_lead_time_days,
         delivers_every_days = case when p_delivers_every_days = -1 then delivers_every_days
                                    else p_delivers_every_days end
   where id = p_supplier;
  perform set_config('audit.reason', '', true);
end $$;

-- =============================================================================
-- 2. A supplier's terms, as its deliveries have shown them
-- =============================================================================
-- (internal) As at p_now: the orders sent to it in the six months before and
-- the day the first delivery against each came (in the café's days); the
-- usual days (the middle one), how many came later than usual and the most
-- days late in the last three months, once there are three such orders. The
-- days used ('lead'): the usual once learnt, else the supplier's own, else
-- the café's ('lead_from': learned, supplier, cafe). The days late allowed
-- for ('late_days'): the most it came after its usual lately, once learnt.
-- How often it delivers ('every'): its own, else the middle gap between the
-- days its deliveries came over three months (four days or more), else 7
-- ('every_from': supplier, learned, default).
create or replace function supplier_terms(p_business uuid, p_supplier uuid, p_now timestamptz default now())
returns jsonb language plpgsql stable set search_path = public as $$
declare
  s supplier;
  v_tz text := (select timezone from business where id = p_business);
  v_today date := (p_now at time zone v_tz)::date;
  v_n int; v_usual int; v_late int; v_worst int; v_gaps int; v_gap numeric;
  v_lead numeric; v_lead_from text; v_late_days int; v_every int; v_every_from text;
begin
  select * into s from supplier where id = p_supplier and business_id = p_business;
  if not found then return null; end if;
  with took as (
    select ((min(r.received_at) at time zone v_tz)::date - (o.sent_at at time zone v_tz)::date) as days,
           (min(r.received_at) at time zone v_tz)::date as came_on
      from purchase_order o join goods_receipt r on r.purchase_order_id = o.id
     where o.business_id = p_business and o.supplier_id = p_supplier and o.sent_at is not null
       and o.sent_at >= p_now - interval '183 days' and o.sent_at < p_now and r.received_at < p_now
     group by o.id, o.sent_at
  ), ok as (select * from took where days >= 0)
  select count(*), percentile_disc(0.5) within group (order by days)
    into v_n, v_usual from ok;
  if v_n >= 3 then
    with took as (
      select ((min(r.received_at) at time zone v_tz)::date - (o.sent_at at time zone v_tz)::date) as days,
             (min(r.received_at) at time zone v_tz)::date as came_on
        from purchase_order o join goods_receipt r on r.purchase_order_id = o.id
       where o.business_id = p_business and o.supplier_id = p_supplier and o.sent_at is not null
         and o.sent_at >= p_now - interval '183 days' and o.sent_at < p_now and r.received_at < p_now
       group by o.id, o.sent_at
    )
    select count(*) filter (where days > v_usual),
           coalesce(max(days) filter (where came_on >= v_today - 91), v_usual)
      into v_late, v_worst from took where days >= 0;
    v_lead := v_usual; v_lead_from := 'learned'; v_late_days := greatest(v_worst - v_usual, 0);
  else
    v_lead := coalesce(s.lead_time_days, alert_setting(p_business, 'lead_time_days'));
    v_lead_from := case when s.lead_time_days is not null then 'supplier' else 'cafe' end;
    v_late_days := 0;
  end if;
  if s.delivers_every_days is not null then
    v_every := s.delivers_every_days; v_every_from := 'supplier';
  else
    with days as (
      select distinct (r.received_at at time zone v_tz)::date as d
        from goods_receipt r
       where r.business_id = p_business and r.supplier_id = p_supplier
         and r.received_at >= p_now - interval '91 days' and r.received_at < p_now
    ), gaps as (select d - lag(d) over (order by d) as gap from days)
    select count(*), percentile_disc(0.5) within group (order by gap) into v_gaps, v_gap
      from gaps where gap is not null;
    if v_gaps >= 3 then
      v_every := greatest(least(v_gap, 60), 1)::int; v_every_from := 'learned';
    else
      v_every := 7; v_every_from := 'default';
    end if;
  end if;
  return jsonb_build_object(
    'supplier_id', s.id, 'supplier', s.name,
    'lead', v_lead, 'lead_from', v_lead_from, 'own_lead', s.lead_time_days,
    'orders', coalesce(v_n, 0), 'usual', v_usual, 'late', v_late, 'worst', v_worst,
    'late_days', v_late_days,
    'every', v_every, 'every_from', v_every_from, 'own_every', s.delivers_every_days);
end $$;

-- (cost.view) Each supplier in use: its terms as above, as Purchasing shows
-- them ("usually 1 day, late 1 in 6, delivers every 2 days").
create or replace function supplier_records() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  return coalesce((
    select jsonb_agg(supplier_terms(v_business, s.id, now()) order by s.name)
      from supplier s
     where s.business_id = v_business and s.is_active), '[]'::jsonb);
end $$;

-- =============================================================================
-- 3. What to buy, learning from the supplier
-- =============================================================================
-- 0070's list, with the supplier's learnt terms, the levels they suggest, a
-- top-up and a cheaper supplier (above). The rest is as it was.
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
  -- The use judged: from the start of the day four weeks ago (0092), so the
  -- same at any hour of today.
  v_use_from timestamptz := (v_today - 28)::timestamp at time zone v_tz;
  v_plan jsonb; v_wd numeric[]; v_forecast text; v_lead_use numeric; v_plan_need numeric; v_plan_extra numeric;
  v_wd_batches numeric; v_cap numeric; v_capped boolean; v_back uuid[];
  -- 0092: each supplier's terms as its deliveries have shown them, read once.
  v_terms_by jsonb := '{}'; v_terms jsonb; v_late numeric; v_every numeric; v_cycle_use numeric;
  v_late_use numeric; v_sd numeric; v_suggest_reorder numeric; v_suggest_target numeric;
  v_top_up boolean; v_top_packs numeric; v_cheaper jsonb; v_per_base numeric;
begin
  -- What today's plan needs of each ingredient (0070).
  v_plan := coalesce(production_plan(v_today, v_loc) -> 'ingredients', '[]'::jsonb);
  -- The losses taken back on review that had been thrown away unsold (0070).
  select coalesce(array_agg(r.id), '{}') into v_back
    from loss_review r join inventory_movement o on o.id = r.movement_id
   where r.business_id = v_business and r.decision = 'reversed'
     and o.type in ('waste', 'spoilage', 'expired');
  for x in
    with moves as (
      select m.item_id, sum(m.base_quantity_signed) as on_hand, min(m.occurred_at) as first_at,
             -sum(m.base_quantity_signed) filter (
                where m.occurred_at >= v_use_from
                  and ((stock_card_kind(m.type, m.reference_type, m.base_quantity_signed) in ('sold', 'batches', 'wasted')
                        or sent_away(m))
                       and not (m.type in ('waste', 'spoilage', 'expired')
                       or (m.type = 'reversal' and m.reference_type = 'loss_review'
                           and m.reference_id = any(v_back)))))
               as used,
             -sum(m.base_quantity_signed) filter (
                where m.occurred_at >= v_use_from
                  and (m.type in ('waste', 'spoilage', 'expired')
                       or (m.type = 'reversal' and m.reference_type = 'loss_review'
                           and m.reference_id = any(v_back))))
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
    -- The supplier's delivery time learnt from its orders, its own when it
    -- has too few, the café's without a supplier (0092); the days late it
    -- has been at worst lately, and how often it delivers.
    v_terms := null;
    if c ->> 'supplier_id' is not null then
      v_terms := v_terms_by -> (c ->> 'supplier_id');
      if v_terms is null then
        v_terms := supplier_terms(v_business, (c ->> 'supplier_id')::uuid, v_now);
        v_terms_by := v_terms_by || jsonb_build_object(c ->> 'supplier_id', v_terms);
      end if;
    end if;
    v_lead := coalesce((v_terms ->> 'lead')::numeric, v_lead_cafe);
    v_late := coalesce((v_terms ->> 'late_days')::numeric, 0);
    v_every := coalesce((v_terms ->> 'every')::numeric, 7);
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
                        and m.occurred_at >= v_use_from
                        and ((stock_card_kind(m.type, m.reference_type, m.base_quantity_signed) in ('sold', 'batches', 'wasted')
                        or sent_away(m))
                       and not (m.type in ('waste', 'spoilage', 'expired')
                       or (m.type = 'reversal' and m.reference_type = 'loss_review'
                           and m.reference_id = any(v_back))))
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
    -- 0092: the use of the days after the delivery until the next could come
    -- (the supplier delivers every so many days), the days it may come late,
    -- and how much a day's use strays from its weekday's (over the days
    -- judged, to yesterday): enough kept for it to be met 19 times in 20.
    v_cycle_use := null; v_late_use := null; v_sd := 0;
    if v_daily > 0 then
      v_cycle_use := (select coalesce(sum(coalesce(v_wd[extract(isodow from v_today + t)::int], v_daily)), 0)
                        from generate_series(floor(v_lead)::int + 1, floor(v_lead)::int + v_every::int) t);
      v_late_use := v_late * v_daily;
      if v_history >= 14 then
        select coalesce(stddev_samp(coalesce(u.qty, 0) - coalesce(v_wd[extract(isodow from d.day)::int], v_daily)), 0)
          into v_sd
          from generate_series(v_today - v_days, v_today - 1, interval '1 day') d(day)
          left join (select (m.occurred_at at time zone v_tz)::date as day, -sum(m.base_quantity_signed) as qty
                       from inventory_movement m
                      where m.business_id = v_business and m.location_id = v_loc and m.item_id = x.id
                        and m.occurred_at >= v_now - make_interval(days => v_days + 1)
                        and ((stock_card_kind(m.type, m.reference_type, m.base_quantity_signed) in ('sold', 'batches', 'wasted')
                        or sent_away(m))
                       and not (m.type in ('waste', 'spoilage', 'expired')
                       or (m.type = 'reversal' and m.reference_type = 'loss_review'
                           and m.reference_id = any(v_back))))
                      group by 1) u on u.day = d.day::date;
      end if;
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
    -- The levels its use and its supplier suggest (0092), beside any set by
    -- hand: to last until this order comes, late as it has come lately; and up
    -- to that and what is used until the one after it could come (the margin
    -- for a busier day kept once, at the reorder level).
    v_suggest_reorder := null; v_suggest_target := null;
    if v_daily > 0 then
      v_suggest_reorder := v_lead_use + v_late_use + 1.65 * v_sd * sqrt(v_lead + 1) + v_plan_extra
                           + coalesce(greatest(x.safety_stock_base, 0), 0);
      v_suggest_target := v_suggest_reorder + v_cycle_use;
    end if;
    if x.min_level_base > 0 then
      v_reorder := x.min_level_base + v_plan_extra; v_reorder_from := 'item';
    elsif v_daily > 0 then
      v_reorder := v_suggest_reorder;
      v_reorder_from := 'use';
    elsif v_plan_need > 0 then
      v_reorder := v_plan_need + coalesce(greatest(x.safety_stock_base, 0), 0); v_reorder_from := 'plan';
    end if;
    if v_reorder is not null then
      if x.par_level_base > 0 then v_target := x.par_level_base; v_target_from := 'par';
      elsif x.max_level_base > 0 then v_target := x.max_level_base; v_target_from := 'max';
      elsif v_daily > 0 and v_reorder_from = 'use' then v_target := v_suggest_target; v_target_from := 'cover';
      elsif v_daily > 0 then v_target := v_reorder + v_cycle_use; v_target_from := 'cover';
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
    -- Topped up with an order to its supplier (0092): an item with enough,
    -- but less than halfway from its reorder level to what it is ordered up
    -- to, so one delivery brings what would otherwise need another soon.
    v_top_up := v_status = 'enough' and v_target is not null and v_target > v_reorder
                and v_position < v_reorder + (v_target - v_reorder) / 2;
    v_top_packs := case when v_top_up then greatest(case when v_capped then floor((v_target - v_position) / v_factor)
                                                         else ceil((v_target - v_position) / v_factor) end, 0)
                        else 0 end;
    v_top_up := v_top_up and v_top_packs > 0;
    -- A cheaper supplier (0092): another's price for the same quantity, from
    -- a delivery or an agreement in the last six months, 3% or more below.
    v_cheaper := null;
    v_per_base := case when v_price is not null and v_factor > 0 and c ->> 'price' is not null
                       then v_price / v_factor end;
    if v_per_base is not null then
      select jsonb_build_object('supplier_id', e ->> 'supplier_id', 'supplier', e ->> 'supplier',
                                'pack_unit', e ->> 'pack_unit',
                                'price', (e ->> 'price')::numeric,
                                'per_base', round((e ->> 'price')::numeric / (e ->> 'pack_factor')::numeric, 4),
                                'chosen_per_base', round(v_per_base, 4),
                                'saves', round(1 - (e ->> 'price')::numeric / (e ->> 'pack_factor')::numeric / v_per_base, 3))
        into v_cheaper
        from jsonb_array_elements(x.choices) e
       where e ->> 'supplier_id' is distinct from c ->> 'supplier_id'
         and e ->> 'price' is not null and coalesce((e ->> 'pack_factor')::numeric, 0) > 0
         and coalesce((e ->> 'price_on')::date, v_today) >= v_today - 183
         and (e ->> 'price')::numeric / (e ->> 'pack_factor')::numeric <= v_per_base * 0.97
       order by (e ->> 'price')::numeric / (e ->> 'pack_factor')::numeric, e ->> 'supplier'
       limit 1;
    end if;
    v_out := v_out || (jsonb_build_object(
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
      'lead_time', v_lead,
      'lead_from', case when v_terms ->> 'lead_from' in ('learned', 'supplier') then v_terms ->> 'lead_from'
                        else 'cafe' end,
      'reorder_level', trim_scale(round(v_reorder, 3)), 'reorder_from', v_reorder_from,
      'safety_stock', case when v_reorder_from = 'use' and x.safety_stock_base > 0 then x.safety_stock_base end,
      'target_level', trim_scale(round(v_target, 3)), 'target_from', v_target_from,
      'supplier_id', c ->> 'supplier_id', 'supplier', c ->> 'supplier', 'supplier_from', c ->> 'from',
      'pack_unit', v_pack, 'pack_factor', v_factor,
      'packs', v_packs, 'qty_base', trim_scale(v_packs * v_factor),
      'price', v_price, 'price_from', v_price_from, 'price_on', v_price_on,
      'choices', x.choices)
      -- 0092's (a function takes at most 100 arguments).
      || jsonb_build_object(
      'late_days', v_late, 'every_days', v_every, 'every_from', coalesce(v_terms ->> 'every_from', 'default'),
      'cycle_use', trim_scale(round(v_cycle_use, 3)), 'late_use', trim_scale(round(v_late_use, 3)),
      'spread', trim_scale(round(v_sd, 3)),
      'suggested_reorder', trim_scale(round(v_suggest_reorder, 3)),
      'suggested_target', trim_scale(round(v_suggest_target, 3)),
      'own_reorder', case when x.min_level_base > 0 then trim_scale(x.min_level_base) end,
      'top_up', v_top_up, 'top_up_packs', v_top_packs, 'cheaper', v_cheaper));
  end loop;
  return jsonb_build_object(
    'location_id', v_loc, 'location', (select name from location where id = v_loc),
    'as_of', v_today, 'window_days', 28, 'lead_time', v_lead_cafe,
    'items', v_out);
end $$;


-- =============================================================================
-- 4. Drafted orders expected when the supplier's deliveries usually come
-- =============================================================================
-- 0045's drafting from the list, the same but for the day each order is
-- expected: the supplier's days as learnt (supplier_terms).
create or replace function purchase_orders_from_list__run(p_lines jsonb, p_location uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create');
  v_loc uuid := resolve_location(v_business, p_location);
  v_today date := business_local_date(v_business, now());
  l jsonb; s record; v_po jsonb; v_orders jsonb := '[]'; v_name text; v_lead int;
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
           jsonb_agg(e.line - 'supplier_id' - 'usual' order by e.n) as lines
      from jsonb_array_elements(p_lines) with ordinality e(line, n)
      left join supplier sp on sp.id = (e.line ->> 'supplier_id')::uuid and sp.business_id = v_business
     group by 1
     order by 2 nulls last, 1
  loop
    v_lead := coalesce((supplier_terms(v_business, s.supplier_id, now()) ->> 'lead')::numeric,
                       alert_setting(v_business, 'lead_time_days'))::int;
    v_po := save_po__run(null, s.supplier_id, s.lines, v_today + v_lead, null, v_loc);
    v_orders := v_orders || jsonb_build_object('po_id', v_po -> 'po_id', 'po_no', v_po -> 'po_no',
                                               'supplier_id', s.supplier_id, 'supplier', s.supplier,
                                               'expected_on', v_today + v_lead, 'total', v_po -> 'total',
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

-- =============================================================================
-- 5. The drafts, ready to approve
-- =============================================================================
-- (purchase.create, and cost.view to read the list) What to buy at the place,
-- drafted: every item to order that has a supplier and a price, in the packs
-- suggested; and with them, for each supplier ordered from, the items it
-- would top up. A draft order for each supplier, as the list's own button
-- makes them. Items to order without a supplier or a price are returned
-- apart ('left'), for someone to choose. Nothing to order: no orders.
create or replace function draft_purchase_orders__run(p_location uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create');
  v_list jsonb := buying_list(p_location);
  v_lines jsonb; v_left jsonb; v jsonb;
begin
  with i as (select e from jsonb_array_elements(v_list -> 'items') e),
  ordering as (
    select distinct e ->> 'supplier_id' as supplier_id from i
     where e ->> 'status' = 'order' and e ->> 'supplier_id' is not null and e ->> 'price' is not null
  ),
  chosen as (
    select e, case when e ->> 'status' = 'order' then (e ->> 'packs')::numeric
                   else (e ->> 'top_up_packs')::numeric end as packs
      from i
     where e ->> 'supplier_id' is not null and e ->> 'price' is not null
       and (e ->> 'status' = 'order'
            or (coalesce((e ->> 'top_up')::boolean, false)
                and e ->> 'supplier_id' in (select supplier_id from ordering)))
  )
  select coalesce(jsonb_agg(jsonb_build_object('item_id', e ->> 'item_id', 'supplier_id', e ->> 'supplier_id',
                                               'qty', packs, 'unit_code', e ->> 'pack_unit',
                                               'unit_price', (e ->> 'price')::numeric)
                            order by e ->> 'supplier', e ->> 'item'), '[]'::jsonb)
    into v_lines from chosen where packs > 0;
  select coalesce(jsonb_agg(jsonb_build_object('item_id', e ->> 'item_id', 'item', e ->> 'item')
                            order by e ->> 'item'), '[]'::jsonb)
    into v_left from jsonb_array_elements(v_list -> 'items') e
   where e ->> 'status' = 'order' and (e ->> 'supplier_id' is null or e ->> 'price' is null);
  if jsonb_array_length(v_lines) = 0 then
    return jsonb_build_object('orders', '[]'::jsonb, 'count', 0, 'left', v_left);
  end if;
  v := purchase_orders_from_list__run(v_lines, p_location);
  return v || jsonb_build_object('left', v_left);
end $$;

create or replace function draft_purchase_orders(p_location uuid default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'draft_purchase_orders', v_req);
  if v is not null then return v; end if;
  v := draft_purchase_orders__run(p_location);
  perform idem_finish(v_business, p_idempotency_key, 'draft_purchase_orders', v_req, v);
  return v;
end $$;

-- =============================================================================
-- 6. Who may call what
-- =============================================================================
revoke execute on function supplier_terms(uuid, uuid, timestamptz), draft_purchase_orders__run(uuid),
  purchase_orders_from_list__run(jsonb, uuid)
  from public, anon, authenticated;
revoke execute on function
  update_supplier(uuid, text, text, text, boolean, text, int, int), supplier_records(), buying_list(uuid),
  draft_purchase_orders(uuid, uuid)
  from public, anon;
grant execute on function
  update_supplier(uuid, text, text, text, boolean, text, int, int), supplier_records(), buying_list(uuid),
  draft_purchase_orders(uuid, uuid)
  to authenticated;
