-- =============================================================================
-- 0039 — Usage variance: what each item should have used, against what its
--        counts say it did (release N)
--
-- Between two approved counts of an item, the stock ledger says what came in
-- (deliveries, batches made, stock moved, opening stock, corrections by hand),
-- what the recipes used (the sales that took it, net of voids and of what
-- refunds put back, and the batches it went into) and what was recorded as
-- lost. The two counts say what was really there. So:
--
--   actual use = opening count + what came in - closing count - recorded losses
--   variance   = actual use - what the recipes used
--
-- A variance above nothing is stock gone that no recipe and no recorded loss
-- explains: bigger portions, waste not recorded, sales not rung up, or theft.
-- Below nothing, less went than the recipes say: smaller portions, or a
-- delivery that was never entered. Each count compares an item with the
-- ledger at the moment it is counted (0024), so the window of each item runs
-- from its line in the first count to its line in the last; what the counts'
-- own adjustments moved is not use. Nothing new is recorded.
--
-- An alert (usage_variance) names an item whose last two counts, the later in
-- the last fortnight, show a variance past both of the owner's thresholds.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. One item between two of its counts
-- ---------------------------------------------------------------------------
create or replace function usage_variance_between(p_business uuid, p_location uuid, p_item uuid,
                                                  p_open uuid, p_close uuid)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  o record; c record; it item; k record; p record;
  v_received numeric := 0; v_made numeric := 0; v_moved numeric := 0; v_opening numeric := 0;
  v_corrected numeric := 0; v_sold numeric := 0; v_batches numeric := 0; v_lost numeric := 0;
  v_losses jsonb := '{}'; v_voided numeric := 0; v_fixed boolean := false;
  v_theory numeric; v_actual numeric; v_var numeric; v_pct numeric; v_cost numeric;
  v_products jsonb; v_recipes jsonb; v_factors text[] := '{}';
begin
  select cl.counted_at, cl.counted_base into o from stock_count_line cl where cl.id = p_open;
  select cl.counted_at, cl.counted_base, cl.expected_at_count into c from stock_count_line cl where cl.id = p_close;
  select * into it from item where id = p_item;

  for k in
    select stock_card_kind(m.type, m.reference_type, m.base_quantity_signed) as kind, m.type::text as t,
           m.reference_type as ref, sum(m.base_quantity_signed) as q
      from inventory_movement m
     where m.business_id = p_business and m.item_id = p_item and m.location_id = p_location
       and m.created_at > o.counted_at and m.created_at <= c.counted_at
     group by 1, 2, 3
  loop
    case k.kind
      when 'received' then v_received := v_received + k.q;
      when 'made' then v_made := v_made + k.q;
      when 'transferred' then v_moved := v_moved + k.q;
      when 'opening_stock' then v_opening := v_opening + k.q;
      when 'sold' then v_sold := v_sold - k.q;
      when 'batches' then v_batches := v_batches - k.q;
      when 'wasted' then
        v_lost := v_lost - k.q;
        v_losses := v_losses || jsonb_build_object(k.t, coalesce((v_losses ->> k.t)::numeric, 0) - k.q);
      -- What the counts themselves set, and revaluations, move no stock that was used.
      when 'counted' then null;
      when 'revalued' then v_fixed := true;
      else v_corrected := v_corrected + k.q;
    end case;
    if k.t = 'reversal' and k.ref = 'sale_void' then v_voided := v_voided + k.q; end if;
    if k.t in ('receipt_correction', 'cost_adjustment') then v_fixed := true; end if;
  end loop;

  v_theory := v_sold + v_batches;
  v_actual := o.counted_base + v_received + v_made + v_moved + v_opening + v_corrected - c.counted_base - v_lost;
  v_var := v_actual - v_theory;
  v_pct := case when v_theory <> 0 then round(v_var / v_theory * 100, 1) end;

  -- What a unit cost when it was last counted: the stock's average then, or
  -- what the item costs now when there was none.
  select coalesce(sum(base_quantity_signed), 0) as q, coalesce(sum(value * sign(base_quantity_signed)), 0) as v into p
    from inventory_movement
   where business_id = p_business and item_id = p_item and location_id = p_location and created_at <= c.counted_at;
  v_cost := case when p.q > 0 and p.v > 0 then p.v / p.q else item_reference_cost(p_business, p_item, p_location) end;

  -- The products whose sales used it, and the batches it went into.
  select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'sold', x.sold, 'used', x.used)
                            order by x.used desc, x.name), '[]')
    into v_products
    from (select l.name, sum(l.qty) as sold, sum(l.used) as used
            from (select coalesce(max(sl.product_name), max(pr.name || ' — ' || pv.name)) as name,
                         max(sl.quantity) as qty, -sum(m.base_quantity_signed) as used
                    from inventory_movement m
                    join sales_order_line sl on sl.id = m.sales_order_line_id
                    join sales_order so on so.id = sl.sales_order_id and so.status <> 'voided'
                    left join product_variant pv on pv.id = sl.product_variant_id
                    left join product pr on pr.id = pv.product_id
                   where m.business_id = p_business and m.item_id = p_item and m.location_id = p_location
                     and m.type = 'sale_consumption'
                     and m.created_at > o.counted_at and m.created_at <= c.counted_at
                   group by sl.id) l
           group by l.name) x;
  select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'batches', x.batches, 'used', x.used)
                            order by x.used desc, x.name), '[]')
    into v_recipes
    from (select r.name, count(distinct b.id) as batches, -sum(m.base_quantity_signed) as used
            from inventory_movement m
            join production_batch b on b.id = m.reference_id
            join recipe r on r.id = b.recipe_id
           where m.business_id = p_business and m.item_id = p_item and m.location_id = p_location
             and m.type = 'production_consumption' and m.reference_type = 'production_batch'
             and m.created_at > o.counted_at and m.created_at <= c.counted_at
           group by r.name) x;

  -- What may explain it.
  if v_var > 0 then
    v_factors := v_factors || 'More was used than the recipes say: bigger portions, waste not recorded, or sales not rung up'::text;
  elsif v_var < 0 then
    v_factors := v_factors || 'Less was used than the recipes say: smaller portions, or a delivery that was not entered'::text;
  end if;
  if v_theory = 0 and v_actual > 0 then
    v_factors := v_factors || 'No recipe used it in these days: what went is not explained by sales'::text;
  end if;
  if exists (select 1 from recipe_line rl join recipe_version rv on rv.id = rl.recipe_version_id
              where rl.item_id = p_item
                and rv.effective_from > business_local_date(p_business, o.counted_at)
                and rv.effective_from <= business_local_date(p_business, c.counted_at)) then
    v_factors := v_factors || 'A recipe that uses it changed between the counts'::text;
  end if;
  if v_voided > 0 then
    v_factors := v_factors || 'Sales that used it were voided: if they had been made, what they used is gone'::text;
  end if;
  if v_fixed then
    v_factors := v_factors || 'A delivery of it was corrected between the counts'::text;
  end if;
  if v_corrected <> 0 then
    v_factors := v_factors || 'Its stock was corrected by hand between the counts'::text;
  end if;
  if c.expected_at_count < 0 then
    v_factors := v_factors || 'The books had it below zero when it was counted: a delivery may not have been entered'::text;
  end if;

  return jsonb_build_object(
    'item_id', p_item, 'name', it.name, 'unit', it.base_unit_code,
    'opened_at', o.counted_at, 'closed_at', c.counted_at, 'opening', o.counted_base, 'closing', c.counted_base,
    'received', v_received, 'made', v_made, 'transferred', v_moved, 'opening_stock', v_opening,
    'corrected', v_corrected, 'sold', v_sold, 'batches', v_batches, 'theoretical', v_theory,
    'lost', v_lost, 'losses', v_losses, 'actual', v_actual, 'variance', v_var, 'variance_percent', v_pct,
    'unit_cost', round(v_cost, 4), 'variance_value', money_round(p_business, v_var * coalesce(v_cost, 0)),
    'products', v_products, 'recipes', v_recipes, 'factors', to_jsonb(v_factors));
end $$;

-- ---------------------------------------------------------------------------
-- 2. The report: each item between its first and last count in the dates
-- ---------------------------------------------------------------------------
create or replace function report_usage_variance(p_from date, p_to date, p_location uuid default null)
returns table (item_id uuid, name text, unit text, counts int, opened_at timestamptz, closed_at timestamptz,
               opening numeric, closing numeric, received numeric, made numeric, transferred numeric,
               opening_stock numeric, corrected numeric, sold numeric, batches numeric, theoretical numeric,
               lost numeric, losses jsonb, actual numeric, variance numeric, variance_percent numeric,
               unit_cost numeric, variance_value numeric, products jsonb, recipes jsonb, factors text[])
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_location uuid; v_start timestamptz; v_end timestamptz; x record; v jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Choose the dates, the first before the last'; end if;
  v_location := resolve_location(v_business, p_location);
  select b.from_ts, b.to_ts into v_start, v_end from local_day_bounds(v_business, p_from, p_to) b;
  for x in
    with l as (
      select cl.item_id, cl.id, cl.counted_at,
             row_number() over (partition by cl.item_id order by cl.counted_at, cl.id) as first_rank,
             row_number() over (partition by cl.item_id order by cl.counted_at desc, cl.id desc) as last_rank,
             count(*) over (partition by cl.item_id) as n
        from stock_count_line cl join stock_count sc on sc.id = cl.stock_count_id
       where sc.business_id = v_business and sc.location_id = v_location and sc.status = 'approved' and not sc.legacy
         and cl.counted_at is not null and cl.counted_base is not null
         and cl.counted_at >= v_start and cl.counted_at < v_end)
    select f.item_id, f.id as open_line, z.id as close_line, f.n, i.name as item_name, i.base_unit_code
      from l f join l z on z.item_id = f.item_id and z.last_rank = 1
      join item i on i.id = f.item_id
     where f.first_rank = 1
     order by i.name, i.id
  loop
    item_id := x.item_id; counts := x.n;
    if x.n < 2 then
      -- Counted once in these dates: a second count gives what it used.
      name := x.item_name; unit := x.base_unit_code;
      select cl.counted_at, cl.counted_base into opened_at, opening from stock_count_line cl where cl.id = x.open_line;
      closed_at := null; closing := null; received := null; made := null; transferred := null; opening_stock := null;
      corrected := null; sold := null; batches := null; theoretical := null; lost := null; losses := null;
      actual := null; variance := null; variance_percent := null; unit_cost := null; variance_value := null;
      products := null; recipes := null; factors := null;
      return next;
      continue;
    end if;
    v := usage_variance_between(v_business, v_location, x.item_id, x.open_line, x.close_line);
    name := v ->> 'name'; unit := v ->> 'unit';
    opened_at := (v ->> 'opened_at')::timestamptz; closed_at := (v ->> 'closed_at')::timestamptz;
    opening := (v ->> 'opening')::numeric; closing := (v ->> 'closing')::numeric;
    received := (v ->> 'received')::numeric; made := (v ->> 'made')::numeric;
    transferred := (v ->> 'transferred')::numeric; opening_stock := (v ->> 'opening_stock')::numeric;
    corrected := (v ->> 'corrected')::numeric; sold := (v ->> 'sold')::numeric; batches := (v ->> 'batches')::numeric;
    theoretical := (v ->> 'theoretical')::numeric; lost := (v ->> 'lost')::numeric; losses := v -> 'losses';
    actual := (v ->> 'actual')::numeric; variance := (v ->> 'variance')::numeric;
    variance_percent := (v ->> 'variance_percent')::numeric; unit_cost := (v ->> 'unit_cost')::numeric;
    variance_value := (v ->> 'variance_value')::numeric; products := v -> 'products'; recipes := v -> 'recipes';
    factors := array(select jsonb_array_elements_text(v -> 'factors'));
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. The alert
-- ---------------------------------------------------------------------------
-- 0036's thresholds, with the usage variance's.
create or replace function alert_threshold_rules() returns jsonb
language sql immutable set search_path = public as $$
  select '{
    "lead_time_days":           {"default": 1,     "min": 0,   "max": 30,        "whole": true,
                                 "label": "Days a delivery takes (vendors without their own)"},
    "margin_target_percent":    {"default": 70,    "min": 0,   "max": 95,        "whole": false,
                                 "label": "Margin target (%)"},
    "count_stale_hours":        {"default": 8,     "min": 1,   "max": 72,        "whole": true,
                                 "label": "Hours a stock count may stay open"},
    "waste_spike_factor":       {"default": 1.5,   "min": 1,   "max": 10,        "whole": false,
                                 "label": "Waste spike: times a usual week"},
    "waste_spike_min":          {"default": 20000, "min": 0,   "max": 100000000, "whole": true,
                                 "label": "Waste spike: at least (IQD)"},
    "exceptions_count":         {"default": 10,    "min": 1,   "max": 1000,      "whole": true,
                                 "label": "Exceptions by one person in 7 days"},
    "exceptions_share_percent": {"default": 3,     "min": 0.1, "max": 100,       "whole": false,
                                 "label": "Exceptions as a share of their sales (%)"},
    "card_days":                {"default": 3,     "min": 1,   "max": 30,        "whole": true,
                                 "label": "Days card money takes to reach the bank"},
    "platform_days":            {"default": 7,     "min": 1,   "max": 60,        "whole": true,
                                 "label": "Days a delivery platform takes to pay"},
    "bill_due_days":            {"default": 3,     "min": 0,   "max": 30,        "whole": true,
                                 "label": "Days before a bill is due to warn"},
    "price_typo_factor":        {"default": 3,     "min": 1.5, "max": 20,        "whole": false,
                                 "label": "Price typo: times another channel''s price"},
    "session_open_hours":       {"default": 14,    "min": 1,   "max": 72,        "whole": true,
                                 "label": "Hours a cash session may stay open"},
    "session_short_min":        {"default": 5000,  "min": 0,   "max": 100000000, "whole": true,
                                 "label": "A cash session short by at least (IQD)"},
    "usage_variance_percent":   {"default": 10,    "min": 1,   "max": 100,       "whole": false,
                                 "label": "Usage unlike the recipes by at least (%)"},
    "usage_variance_min":       {"default": 5000,  "min": 0,   "max": 100000000, "whole": true,
                                 "label": "Usage unlike the recipes by at least (IQD)"}
  }'::jsonb
$$;

-- 0036's rules stay as they are; the usage variance's follows.
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0036;
revoke execute on function alert_conditions_0036(uuid, timestamptz) from public, anon, authenticated;

create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language plpgsql stable set search_path = public as $$
declare
  v_tz text; v_pct numeric := alert_setting(p_business, 'usage_variance_percent');
  v_min numeric := greatest(alert_setting(p_business, 'usage_variance_min'), 1);
  x record; v jsonb; v_value numeric; v_var numeric;
begin
  select timezone into v_tz from business where id = p_business;

  return query
    select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
      from alert_conditions_0036(p_business, p_now) c;

  -- Usage unlike the recipes: each item's last two approved counts at a
  -- location, the later in the last fortnight.
  for x in
    with l as (
      select sc.location_id, cl.item_id, cl.id, cl.counted_at,
             row_number() over (partition by sc.location_id, cl.item_id order by cl.counted_at desc, cl.id desc) as rn
        from stock_count_line cl join stock_count sc on sc.id = cl.stock_count_id
       where sc.business_id = p_business and sc.status = 'approved' and not sc.legacy
         and cl.counted_at is not null and cl.counted_base is not null and cl.counted_at <= p_now)
    select z.location_id, z.item_id, f.id as open_line, z.id as close_line
      from l z join l f on f.location_id = z.location_id and f.item_id = z.item_id and f.rn = 2
     where z.rn = 1 and z.counted_at >= p_now - interval '14 days'
  loop
    v := usage_variance_between(p_business, x.location_id, x.item_id, x.open_line, x.close_line);
    v_value := (v ->> 'variance_value')::numeric;
    v_var := (v ->> 'variance')::numeric;
    continue when (v ->> 'variance_percent') is null or abs((v ->> 'variance_percent')::numeric) < v_pct
               or abs(v_value) < v_min;
    rule := 'usage_variance';
    subject := x.location_id || ':' || x.item_id;
    urgency := case when abs(v_value) >= v_min * 5 then 'red' else 'orange' end;
    title := format('%s: %s %s %s than the recipes say between the counts of %s and %s (%s%%, %s IQD)',
                    v ->> 'name', alert_qty(abs(v_var)), v ->> 'unit',
                    case when v_var > 0 then 'more used' else 'less used' end,
                    to_char((v ->> 'opened_at')::timestamptz at time zone v_tz, 'DD Mon'),
                    to_char((v ->> 'closed_at')::timestamptz at time zone v_tz, 'DD Mon'),
                    trim_scale(abs((v ->> 'variance_percent')::numeric)), alert_money(abs(v_value)));
    why := case when v_var > 0
                then 'What the counts say went, less the losses recorded, is more than the recipes of what was sold and made.'
                else 'What the counts say went, less the losses recorded, is less than the recipes of what was sold and made.' end;
    action := 'Open Usage on Inventory: it shows what came in, what was sold, made and lost between the counts, and what may explain it.';
    confidence := 'medium';
    link := '/inventory/usage';
    facts := v - 'products' - 'recipes';
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  usage_variance_between(uuid, uuid, uuid, uuid, uuid), alert_conditions(uuid, timestamptz),
  alert_threshold_rules()
  from public, anon, authenticated;
revoke execute on function report_usage_variance(date, date, uuid) from public, anon;
grant execute on function report_usage_variance(date, date, uuid) to authenticated;
