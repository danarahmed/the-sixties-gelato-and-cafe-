-- =============================================================================
-- 0029 — The system speaks: alerts, an exception-first dashboard, and the
--        owner's daily brief
-- =============================================================================
-- The September 2026 audit's P1-8 (docs/SYSTEM_AUDIT_2026-09.md §6, §7): the
-- system recorded well but told the owner little — a low-stock list and a
-- reconciliation badge, no alerts, no brief.
--
--  * alert_conditions: the rules of §7, version 1. Each is deterministic and
--    reads only: it says what happened, why it matters, how urgent it is (red
--    or orange), what to do, and how sure it is. A rule that needs history
--    stays quiet until it has a week of it.
--  * alert: the alerts as they are kept — one open alert per rule and subject,
--    first and last seen, resolved by itself once the condition clears,
--    acknowledged with a note, or snoozed with a reason. An alert that turns
--    from orange to red asks again. These rows are signals beside the books:
--    nothing in the books is written by them.
--  * current_alerts: the alerts now, for the dashboard (profit.view).
--  * daily_brief: a day's facts, then calculations, then what needs doing —
--    kept apart, as the audit asks.
--  * Thresholds are settings the owner changes (alert_thresholds,
--    set_alert_thresholds), each with its default; a supplier may say how many
--    days it takes to deliver, for "running out".
--
-- Rules the system cannot check yet wait for what they need: a late sale can
-- no longer happen (0024), and use-by dates come with P2-7.

-- =============================================================================
-- 1. Thresholds, and how numbers read in an alert
-- =============================================================================
alter table business add column if not exists alert_settings jsonb not null default '{}'::jsonb;
-- How many days this supplier takes to deliver; empty: the café's default.
alter table supplier add column if not exists lead_time_days int check (lead_time_days between 0 and 30);

-- Every threshold, its default and its limits, in one place.
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
                                 "label": "Price typo: times another channel''s price"}
  }'::jsonb
$$;

-- A threshold in force: the café's own, or the default.
create or replace function alert_setting(p_business uuid, p_key text) returns numeric
language sql stable set search_path = public as $$
  select coalesce((select (alert_settings ->> p_key)::numeric from business where id = p_business),
                  (alert_threshold_rules() -> p_key ->> 'default')::numeric)
$$;

-- Whole dinars with thousands separators: 150000 -> "150,000".
create or replace function alert_money(p_amount numeric) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(round(coalesce(p_amount, 0))::text, '(\d)(?=(\d{3})+$)', '\1,', 'g')
$$;

-- A quantity as it reads: 1500.0000 -> "1500", 2.50 -> "2.5".
create or replace function alert_qty(p_qty numeric) returns text
language sql immutable set search_path = public as $$
  select trim_scale(round(coalesce(p_qty, 0), 2))::text
$$;

-- A channel as the screens name it: dine_in -> "Dine-in".
create or replace function alert_channel(p_channel sales_channel) returns text
language sql immutable set search_path = public as $$
  select replace(initcap(replace(p_channel::text, '_', ' ')), 'Dine In', 'Dine-in')
$$;

-- =============================================================================
-- 2. Alerts as they are kept
-- =============================================================================
create table if not exists alert (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references business (id) on delete cascade,
  rule            text not null,
  subject         text not null,
  urgency         text not null check (urgency in ('red', 'orange')),
  title           text not null,
  why             text,
  action          text,
  confidence      text not null check (confidence in ('high', 'medium', 'low')),
  link            text,
  facts           jsonb not null default '{}'::jsonb,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  resolved_at     timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references app_user (id),
  ack_note        text,
  snoozed_until   timestamptz,
  snoozed_by      uuid references app_user (id),
  snooze_reason   text
);
-- One open alert per rule and subject.
create unique index if not exists alert_open_one on alert (business_id, rule, subject) where resolved_at is null;
create index if not exists alert_business_idx on alert (business_id, resolved_at);
alter table alert enable row level security;
alter table alert force row level security;

-- =============================================================================
-- 3. The rules (the audit's §7, version 1)
-- =============================================================================
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language plpgsql stable set search_path = public as $$
declare
  v_tz text; v_today date; v_loc uuid;
  v_use_types movement_type[] := array['sale_consumption', 'production_consumption', 'waste', 'spoilage',
    'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling', 'damaged', 'expired']::movement_type[];
  v_lead numeric := alert_setting(p_business, 'lead_time_days');
  v_target numeric := alert_setting(p_business, 'margin_target_percent');
  v_running uuid[] := '{}';
  v_seen text[] := '{}';
  v_costs jsonb;                                       -- item id -> its cost now, and whether it is a fallback
  v_nocost jsonb := '{}';                              -- item id -> the products that use it
  r record; v_daily numeric; v_cost numeric; v_n int; v_zero uuid[]; v_fallback boolean; v_broken boolean;
  v_item uuid; v_pname text;
begin
  select timezone into v_tz from business where id = p_business;
  v_today := business_local_date(p_business, p_now);
  v_loc := default_location(p_business);

  -- Cash below zero: a till, safe or bank balance under nothing.
  return query
    select 'cash_negative'::text, a.code::text, 'red'::text,
           format('%s is %s IQD: below zero', a.name, alert_money(a.bal)),
           'Money cannot leave a place before it is there: a payment was recorded from the wrong place, or takings are missing.'::text,
           'Open the account''s journal lines and record where the money really came from.'::text,
           'high'::text, '/journals?account=' || a.code,
           jsonb_build_object('account', a.code, 'balance', a.bal)
      from (select g.code, g.name, gl_balance_at(p_business, g.code, 'infinity') as bal
              from gl_account g
             where g.business_id = p_business and g.code in ('1000', '1005', '1020')) a
     where a.bal < 0;

  -- A drawer not counted: days before today whose cash no count has covered.
  return query
    select 'drawer_uncounted'::text, u.location_id::text,
           case when count(*) >= 2 then 'red' else 'orange' end::text,
           case when count(*) = 1
                then format('The drawer at %s has not been counted for %s', l.name, to_char(min(u.day), 'DD Mon'))
                else format('The drawer at %s has not been counted for %s days, since %s', l.name, count(*),
                            to_char(min(u.day), 'DD Mon')) end,
           'Until the drawer is counted, nobody knows whether the cash is all there.'::text,
           'Count the drawer on Sales.'::text, 'high'::text, '/sales'::text,
           jsonb_build_object('days', jsonb_agg(u.day order by u.day))
      from uncounted_days(p_business) u join location l on l.id = u.location_id
     where u.day < v_today
     group by u.location_id, l.name;

  -- A stock count left open.
  return query
    select 'count_stale'::text, c.id::text, 'orange'::text,
           format('A stock count has been open since %s', to_char(c.started_at at time zone v_tz, 'DD Mon HH24:MI')),
           'An open count is not in the books yet, and the longer it stays open the harder it is to finish honestly.'::text,
           'Finish it, or cancel it, on Stock Count.'::text, 'high'::text, '/count'::text,
           jsonb_build_object('count_id', c.id, 'status', c.status, 'started_at', c.started_at)
      from stock_count c
     where c.business_id = p_business and c.status in ('draft', 'counting', 'submitted')
       and c.started_at < p_now - make_interval(hours => alert_setting(p_business, 'count_stale_hours')::int);

  -- Running out: days of cover (on hand ÷ average daily use over the last 14
  -- days) under the time a delivery takes plus a day — the item's last
  -- supplier's own, or the café's. Quiet with under 7 days of history, and on
  -- a day the item was received.
  for r in
    with hist as (
      select m.item_id, min(business_local_date(p_business, m.occurred_at)) as first_day,
             -sum(m.base_quantity_signed) filter (
                where m.occurred_at >= p_now - interval '14 days'
                  and (m.type = any (v_use_types) or m.type = 'refund_return_to_stock'
                       or (m.type = 'reversal' and m.reference_type = 'sale_void')
                       or (m.type = 'reversal' and m.reference_type = 'production_cancel' and m.base_quantity_signed > 0)))
               as used,
             bool_or(m.type = 'purchase_receipt' and business_local_date(p_business, m.occurred_at) = v_today) as received_today
        from inventory_movement m
       where m.business_id = p_business
       group by m.item_id
    ),
    onhand as (
      select cs.item_id, sum(cs.quantity_base) as qty from current_stock cs where cs.business_id = p_business group by 1
    ),
    supplied as (
      select distinct on (m.item_id) m.item_id, s.lead_time_days
        from inventory_movement m
        join goods_receipt g on g.id = m.reference_id
        join supplier s on s.id = g.supplier_id
       where m.business_id = p_business and m.type = 'purchase_receipt' and m.reference_type = 'goods_receipt'
       order by m.item_id, m.occurred_at desc, m.created_at desc
    )
    select i.id, i.name, i.base_unit_code, coalesce(o.qty, 0) as qty, h.used,
           least(14, v_today - h.first_day) as window_days, v_today - h.first_day as history_days, h.received_today,
           coalesce(sp.lead_time_days, v_lead) as lead,
           exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active) as made
      from item i join hist h on h.item_id = i.id
      left join onhand o on o.item_id = i.id
      left join supplied sp on sp.item_id = i.id
     where i.business_id = p_business and i.is_active
  loop
    continue when r.history_days < 7 or r.received_today or coalesce(r.used, 0) <= 0;
    v_daily := r.used / r.window_days;                  -- average use a day
    continue when r.qty / v_daily >= r.lead + 1;
    v_running := v_running || r.id;
    rule := 'running_out'; subject := r.id::text;
    urgency := case when r.qty / v_daily < 1 then 'red' else 'orange' end;
    title := format('%s runs out in %s: %s %s left, using about %s a day', r.name,
                    case when r.qty <= 0 then 'no time' when r.qty / v_daily < 1 then 'under a day'
                         else trim_scale(round(r.qty / v_daily, 1)) || ' days' end,
                    alert_qty(r.qty), r.base_unit_code, alert_qty(v_daily));
    why := 'What is sold without stock is costed wrongly, and customers are turned away.';
    action := case when r.made then 'Make a batch on Production.'
                   else format('Order about %s %s (a week of use).', alert_qty(ceil(v_daily * 7)), r.base_unit_code) end;
    confidence := case when r.history_days >= 28 then 'high' when r.history_days >= 14 then 'medium' else 'low' end;
    link := '/inventory/' || r.id;
    facts := jsonb_build_object('on_hand', r.qty, 'daily_use', round(v_daily, 4), 'history_days', r.history_days,
                                'lead_time_days', r.lead);
    return next;
  end loop;

  -- Below its reorder level, items never moved included (unless running out says it already).
  return query
    select 'below_minimum'::text, i.id::text, 'orange'::text,
           format('%s: %s %s on hand, below its reorder level of %s', i.name, alert_qty(coalesce(o.qty, 0)),
                  i.base_unit_code, alert_qty(i.min_level_base)),
           'Below the reorder level there may not be enough until the next delivery.'::text,
           case when exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active)
                then 'Make a batch on Production.' else 'Order it.' end,
           'high'::text, '/inventory/' || i.id,
           jsonb_build_object('on_hand', coalesce(o.qty, 0), 'min_level', i.min_level_base)
      from item i
      left join (select cs.item_id, sum(cs.quantity_base) as qty from current_stock cs
                  where cs.business_id = p_business group by 1) o on o.item_id = i.id
     where i.business_id = p_business and i.is_active and i.min_level_base > 0
       and coalesce(o.qty, 0) < i.min_level_base and not (i.id = any (v_running));

  -- A delivery price far from the cost now, confirmed in the last week (0027).
  return query
    select 'price_confirmed'::text, a.id::text, 'orange'::text,
           coalesce(a.reason, 'A delivery price was confirmed') || coalesce(' — confirmed by ' || u.full_name, ''),
           'A price typed wrongly changes the cost of everything made from the item until it is corrected.'::text,
           'Check it against the supplier''s invoice.'::text, 'high'::text, '/purchasing'::text,
           jsonb_build_object('receipt_id', a.entity_id, 'confirmed_at', a.occurred_at)
      from audit_log a left join app_user u on u.id = a.app_user_id
     where a.business_id = p_business and a.action = 'purchase.price_confirmed'
       and a.occurred_at >= p_now - interval '7 days';

  -- Margins: sold below cost (red), or under the target margin (orange); a
  -- product sold with no recipe; and an ingredient with no cost yet, named
  -- once with the products that use it. Every item is costed once, as a sale
  -- would take it off the shelf now; a cost from the last delivery, for an
  -- item with none on hand, makes the margin less sure.
  select coalesce(jsonb_object_agg(i.id, jsonb_build_object(
           'c', item_issue_cost(p_business, i.id, v_loc), 'f', not (p.qty > 0 and p.value > 0))), '{}')
    into v_costs
    from item i cross join lateral item_position(p_business, i.id, v_loc) p
   where i.business_id = p_business;
  for r in
    select pv.id as vid, p.name as pname, pv.name as vname, ch, price_on(pv.id, ch, v_loc, v_today) as price
      from product_variant pv join product p on p.id = pv.product_id
      cross join unnest(enum_range(null::sales_channel)) ch
     where pv.business_id = p_business and pv.is_active and p.is_active and pv.no_stock_reason is null
  loop
    continue when r.price is null or r.price <= 0;
    v_pname := r.pname || case when r.vname <> r.pname then ' — ' || r.vname else '' end;
    v_broken := false;
    begin
      select count(*), coalesce(sum(money_round(p_business, (v_costs -> e.item_id::text ->> 'c')::numeric * e.base_qty)), 0),
             coalesce(array_agg(e.item_id) filter (
               where coalesce((v_costs -> e.item_id::text ->> 'c')::numeric, 0) <= 0 and e.base_qty > 0), '{}'),
             coalesce(bool_or((v_costs -> e.item_id::text ->> 'f')::boolean), false)
        into v_n, v_cost, v_zero, v_fallback
        from expand_variant(r.vid, r.ch, 1, v_today) e;
    exception when others then
      v_n := 0; v_broken := true;                      -- its recipe cannot be read today
    end;
    if v_n = 0 then
      subject := r.vid::text;
      continue when subject = any (v_seen);            -- once, whichever channels it is sold on
      v_seen := v_seen || subject;
      rule := 'no_recipe'; urgency := 'orange'; confidence := 'high'; link := '/products';
      title := case when v_broken then format('%s cannot be sold: its recipe has no version in force today', v_pname)
                    else format('%s is sold with no recipe: its sales are costed at nothing', v_pname) end;
      why := 'A sale costed at nothing overstates the profit, and its stock is never taken off the shelf.';
      action := 'Give it its recipe on Products, or say why it uses no stock.';
      facts := jsonb_build_object('variant_id', r.vid);
      return next;
      continue;
    end if;
    if cardinality(v_zero) > 0 then
      foreach v_item in array v_zero loop
        if not coalesce(v_nocost -> v_item::text, '[]'::jsonb) ? v_pname then
          v_nocost := jsonb_set(v_nocost, array[v_item::text],
                                coalesce(v_nocost -> v_item::text, '[]'::jsonb) || to_jsonb(v_pname));
        end if;
      end loop;
      continue;                                        -- its margin waits for every ingredient's cost
    end if;
    if r.price < v_cost or (r.price - v_cost) / r.price * 100 < v_target then
      rule := 'margin'; subject := r.vid || ':' || r.ch;
      urgency := case when r.price < v_cost then 'red' else 'orange' end;
      title := format('%s (%s): %s at %s IQD, costing %s', v_pname, alert_channel(r.ch),
                      case when r.price < v_cost then 'sold below cost'
                           else round((r.price - v_cost) / r.price * 100) || '% margin' end,
                      alert_money(r.price), alert_money(v_cost));
      why := case when r.price < v_cost then 'Every one sold loses money.'
                  else format('Under the %s%% target, the price no longer covers what the recipe costs now.', trim_scale(v_target)) end;
      action := 'Review the price, or the recipe, on Products.';
      confidence := case when v_fallback then 'medium' else 'high' end;
      link := '/products';
      facts := jsonb_build_object('variant_id', r.vid, 'channel', r.ch, 'price', r.price, 'cost', v_cost,
                                  'target_percent', v_target, 'cost_from_last_delivery', v_fallback);
      return next;
    end if;
  end loop;

  return query
    select 'no_cost'::text, i.id::text, 'orange'::text,
           format('%s has no cost yet, and %s use%s it: %s', i.name,
                  case when jsonb_array_length(x.v) = 1 then '1 product' else jsonb_array_length(x.v) || ' products' end,
                  case when jsonb_array_length(x.v) = 1 then 's' else '' end,
                  (select string_agg(n, ', ' order by n) from (select jsonb_array_elements_text(x.v) n order by 1 limit 4) q)
                  || case when jsonb_array_length(x.v) > 4 then format(' and %s more', jsonb_array_length(x.v) - 4) else '' end),
           'Every sale that uses it is costed at nothing for it, so its profit is overstated.'::text,
           case when exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active)
                then 'Make a batch on Production: its cost comes from its ingredients.'
                else 'Receive it with its cost, or give it its opening stock, on Inventory.' end,
           'high'::text, '/inventory/' || i.id,
           jsonb_build_object('item_id', i.id, 'products', x.v)
      from jsonb_each(v_nocost) x(k, v) join item i on i.id = x.k::uuid;

  -- Waste well above its usual: the last 7 days against the weeks before.
  return query
    with w as (
      select coalesce(sum(l.debit - l.credit) filter (where e.occurred_at >= p_now - interval '7 days'), 0) as last7,
             coalesce(sum(l.debit - l.credit) filter (where e.occurred_at < p_now - interval '7 days'
                                                        and e.occurred_at >= p_now - interval '35 days'), 0) as prior,
             (select v_today - min(business_local_date(p_business, e2.occurred_at))
                from journal_entry e2 where e2.business_id = p_business and e2.status = 'published') as history_days
        from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
       where e.business_id = p_business and e.status = 'published' and g.code = '5300'
         and e.occurred_at >= p_now - interval '35 days' and e.occurred_at < p_now
    ), x as (
      select w.*, least(28, w.history_days - 7) as prior_days from w
    )
    select 'waste_spike'::text, 'waste'::text, 'orange'::text,
           format('Waste of %s IQD in the last 7 days, against about %s in a usual week', alert_money(x.last7),
                  alert_money(x.prior / x.prior_days * 7)),
           'Waste well above its usual is money leaving through the bin: a delivery gone off, a recipe, or a habit.'::text,
           'Look at the waste on Inventory: which items, and who recorded them.'::text,
           (case when x.prior_days >= 28 then 'medium' else 'low' end)::text, '/inventory'::text,
           jsonb_build_object('last7', x.last7, 'usual_week', round(x.prior / x.prior_days * 7), 'prior_days', x.prior_days)
      from x
     where x.prior_days >= 7 and x.prior > 0
       and x.last7 > alert_setting(p_business, 'waste_spike_factor') * (x.prior / x.prior_days * 7)
       and x.last7 > alert_setting(p_business, 'waste_spike_min');

  -- One person's voids, refunds, discounts and cancelled bills in the last 7
  -- days: more than a share of their own sales, or more than a set number.
  return query
    with ex as (
      select sa.requested_by as person, sa.amount, 1 as n
        from sale_adjustment sa
       where sa.business_id = p_business and sa.kind in ('void', 'refund') and sa.created_at >= p_now - interval '7 days'
      union all
      select coalesce(o.discount_by, o.cashier_id), o.discount_amount, 1
        from sales_order o
       where o.business_id = p_business and o.discount_amount > 0 and o.status <> 'open'
         and o.placed_at >= p_now - interval '7 days'
      union all
      select a.app_user_id, 0, 1
        from audit_log a
       where a.business_id = p_business and a.action = 'bill.cancel'
         and jsonb_typeof(a.before_state -> 'lines') = 'array' and a.occurred_at >= p_now - interval '7 days'
    ), per as (
      select ex.person, sum(ex.amount) as amount, sum(ex.n) as n,
             (select coalesce(sum(o.gross_amount), 0) from sales_order o
               where o.business_id = p_business and o.cashier_id = ex.person and o.status <> 'open'
                 and o.placed_at >= p_now - interval '7 days') as own_sales
        from ex where ex.person is not null group by ex.person
    )
    select 'exceptions_person'::text, per.person::text, 'orange'::text,
           format('%s: %s void(s), refund(s), discount(s) or cancelled bill(s) in 7 days, %s IQD%s', u.full_name, per.n,
                  alert_money(per.amount),
                  case when per.own_sales > 0 then format(' (%s%% of their sales)', trim_scale(round(per.amount / per.own_sales * 100, 1)))
                       else '' end),
           'Most exceptions have good reasons; a pattern is worth a look. This is evidence, not an accusation.'::text,
           'Review them on Reports → Exceptions.'::text, 'medium'::text, '/reports#exceptions'::text,
           jsonb_build_object('count', per.n, 'amount', per.amount, 'own_sales', per.own_sales)
      from per join app_user u on u.id = per.person
     where per.n >= alert_setting(p_business, 'exceptions_count')
        or (per.own_sales > 0 and per.amount > 0
            and per.amount / per.own_sales * 100 > alert_setting(p_business, 'exceptions_share_percent'));

  -- Card money not banked, and platform money not received: what the clearing
  -- account holds beyond the takings of the last few days (settlements clear
  -- the oldest first). Platform money is less sure until sales carry the
  -- platform's order number (P1-9).
  return query
    select c.rule, c.code, 'orange'::text,
           format('%s IQD of %s is more than %s days old and not yet %s', alert_money(c.old), c.what, c.days,
                  c.verb),
           c.why, c.action, c.confidence, '/journals?account=' || c.code,
           jsonb_build_object('balance', c.bal, 'older_than_days', c.days, 'amount', c.old)
      from (
        select t.rule, t.code, t.what, t.verb, t.why, t.action, t.confidence, t.days, t.bal,
               t.bal - coalesce((select sum(l.debit) from journal_line l
                                   join journal_entry e on e.id = l.journal_entry_id
                                   join gl_account g on g.id = l.account_id
                                  where e.business_id = p_business and e.status = 'published' and g.code = t.code
                                    and e.occurred_at >= p_now - make_interval(days => t.days)), 0) as old
          from (select 'card_not_banked'::text as rule, '1010'::text as code, 'card money'::text as what,
                       'recorded as settled'::text as verb,
                       'Card takings should reach the bank within a few days; money that does not may never have been taken.'::text as why,
                       'Record the card settlement from the bank statement, with any fee.'::text as action,
                       'high'::text as confidence,
                       alert_setting(p_business, 'card_days')::int as days, gl_balance_at(p_business, '1010', 'infinity') as bal
                union all
                select 'platform_not_received', '1100', 'delivery-platform money', 'received',
                       'Platform payouts come on a cycle; money past it may be missing from a statement.',
                       'Check the platform''s statement and record the payout.', 'medium',
                       alert_setting(p_business, 'platform_days')::int, gl_balance_at(p_business, '1100', 'infinity')) t
      ) c
     where c.old > 0;

  -- Supplier bills due within a few days, or overdue.
  return query
    select 'bill_due'::text, pi.id::text, 'orange'::text,
           format('%s: %s IQD %s', coalesce(s.name, 'A supplier'), alert_money(pi.amount_total - pi.paid_amount),
                  case when pi.due_date < v_today then format('overdue by %s day(s)', v_today - pi.due_date)
                       when pi.due_date = v_today then 'due today'
                       else format('due on %s', to_char(pi.due_date, 'DD Mon')) end),
           'Bills paid late cost goodwill, and sometimes a late fee.'::text,
           'Pay it, or agree a date with the supplier, on Vendors.'::text, 'high'::text, '/vendors'::text,
           jsonb_build_object('bill_id', pi.id, 'invoice_no', pi.invoice_no, 'due_date', pi.due_date,
                              'owed', pi.amount_total - pi.paid_amount)
      from purchase_invoice pi left join supplier s on s.id = pi.supplier_id
     where pi.business_id = p_business and pi.cancelled_at is null and pi.amount_total - pi.paid_amount > 0
       and pi.due_date is not null and pi.due_date <= v_today + alert_setting(p_business, 'bill_due_days')::int;

  -- A price that looks typed wrongly: one channel more than 3× another.
  return query
    with pr as (
      select pv.id as vid, p.name || case when pv.name <> p.name then ' — ' || pv.name else '' end as pname,
             ch, price_on(pv.id, ch, v_loc, v_today) as price
        from product_variant pv join product p on p.id = pv.product_id
        cross join unnest(enum_range(null::sales_channel)) ch
       where pv.business_id = p_business and pv.is_active and p.is_active
    ), mm as (
      select vid, pname, max(price) as hi, min(price) as lo,
             (array_agg(ch order by price desc))[1] as hi_ch, (array_agg(ch order by price))[1] as lo_ch
        from pr where price > 0 group by vid, pname having count(*) >= 2
    )
    select 'price_typo'::text, mm.vid::text, 'orange'::text,
           format('%s is %s IQD on %s but %s on %s', mm.pname, alert_money(mm.hi), alert_channel(mm.hi_ch),
                  alert_money(mm.lo), alert_channel(mm.lo_ch)),
           'A price more than three times another channel''s is usually a missing or extra zero.'::text,
           'Confirm it on Products.'::text, 'medium'::text, '/products'::text,
           jsonb_build_object('variant_id', mm.vid, 'high', mm.hi, 'low', mm.lo)
      from mm
     where mm.hi > alert_setting(p_business, 'price_typo_factor') * mm.lo;

  -- A payment that may have been recorded twice: two expenses, bills or
  -- journals to the same running-cost account, for the same amount, within 3 days.
  return query
    with pay as (
      select e.id, e.journal_no, e.occurred_at, g.code, g.name as account, l.debit as amount
        from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
       where e.business_id = p_business and e.status = 'published' and e.reverses_entry is null
         and not exists (select 1 from journal_entry rv where rv.reverses_entry = e.id and rv.status = 'published')
         and e.reference_type in ('manual', 'expense', 'purchase_invoice', 'correction')
         and g.code like '6%' and l.debit > 0 and e.occurred_at >= p_now - interval '30 days'
    )
    select 'duplicate_payment'::text, a.id::text || ':' || b.id::text, 'orange'::text,
           format('Possible duplicate: %s %s IQD in journal %s (%s) and journal %s (%s)', a.account, alert_money(a.amount),
                  a.journal_no, to_char(a.occurred_at at time zone v_tz, 'DD Mon'),
                  b.journal_no, to_char(b.occurred_at at time zone v_tz, 'DD Mon')),
           'The same amount to the same account twice in a few days is sometimes paid twice.'::text,
           'Confirm both are right, or reverse one on Journals.'::text, 'medium'::text,
           '/journals?account=' || a.code,
           jsonb_build_object('entries', jsonb_build_array(a.journal_no, b.journal_no), 'amount', a.amount)
      from pay a join pay b on b.code = a.code and b.amount = a.amount and a.journal_no < b.journal_no
                           and abs(extract(epoch from b.occurred_at - a.occurred_at)) <= 3 * 86400;
end $$;

-- =============================================================================
-- 4. Keeping them: refresh, list, acknowledge, snooze
-- =============================================================================
-- New conditions open an alert, open ones are brought up to date, and any
-- whose condition has cleared resolve themselves. An alert that turns from
-- orange to red is no longer acknowledged or snoozed: it asks again. One
-- refresh at a time.
create or replace function refresh_alerts(p_business uuid) returns void
language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('alerts:' || p_business::text));
  with now_ as materialized (
    select * from alert_conditions(p_business, now())
  ), kept as (
    update alert a
       set urgency = n.urgency, title = n.title, why = n.why, action = n.action, confidence = n.confidence,
           link = n.link, facts = n.facts, last_seen_at = now(),
           acknowledged_at = case when a.urgency = 'orange' and n.urgency = 'red' then null else a.acknowledged_at end,
           acknowledged_by = case when a.urgency = 'orange' and n.urgency = 'red' then null else a.acknowledged_by end,
           ack_note        = case when a.urgency = 'orange' and n.urgency = 'red' then null else a.ack_note end,
           snoozed_until   = case when a.urgency = 'orange' and n.urgency = 'red' then null else a.snoozed_until end,
           snoozed_by      = case when a.urgency = 'orange' and n.urgency = 'red' then null else a.snoozed_by end,
           snooze_reason   = case when a.urgency = 'orange' and n.urgency = 'red' then null else a.snooze_reason end
      from now_ n
     where a.business_id = p_business and a.resolved_at is null and a.rule = n.rule and a.subject = n.subject
    returning a.id
  ), opened as (
    insert into alert (business_id, rule, subject, urgency, title, why, action, confidence, link, facts)
    select p_business, n.rule, n.subject, n.urgency, n.title, n.why, n.action, n.confidence, n.link, n.facts
      from now_ n
     where not exists (select 1 from alert a where a.business_id = p_business and a.resolved_at is null
                                              and a.rule = n.rule and a.subject = n.subject)
    returning id
  )
  update alert a set resolved_at = now()
   where a.business_id = p_business and a.resolved_at is null
     and not exists (select 1 from now_ n where n.rule = a.rule and n.subject = a.subject);
end $$;

-- The alerts now, red first: refreshed, then read (profit.view, as the dashboard).
create or replace function current_alerts()
returns table (id uuid, rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb, first_seen_at timestamptz, last_seen_at timestamptz,
               acknowledged_at timestamptz, acknowledged_by text, ack_note text,
               snoozed_until timestamptz, snoozed_by text, snooze_reason text)
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('profit.view');
begin
  perform refresh_alerts(v_business);
  return query
    select a.id, a.rule, a.subject, a.urgency, a.title, a.why, a.action, a.confidence, a.link, a.facts,
           a.first_seen_at, a.last_seen_at, a.acknowledged_at, ack.full_name, a.ack_note,
           case when a.snoozed_until > now() then a.snoozed_until end,
           case when a.snoozed_until > now() then sn.full_name end,
           case when a.snoozed_until > now() then a.snooze_reason end
      from alert a
      left join app_user ack on ack.id = a.acknowledged_by
      left join app_user sn on sn.id = a.snoozed_by
     where a.business_id = v_business and a.resolved_at is null
     order by (a.urgency = 'red') desc, a.first_seen_at, a.title;
end $$;

-- An alert someone may act on: open, this business's, and not about themselves.
create or replace function alert_to_act_on(p_business uuid, p_alert uuid) returns alert
language plpgsql set search_path = public as $$
declare a alert;
begin
  select * into a from alert where id = p_alert and business_id = p_business and resolved_at is null for update;
  if not found then raise exception 'That alert has cleared already'; end if;
  if a.rule = 'exceptions_person' and a.subject = (current_member()).id::text then
    raise exception 'An alert about your own exceptions is for someone else to review';
  end if;
  return a;
end $$;

-- Seen, with a note: the alert stays until its condition clears.
create or replace function acknowledge_alert(p_alert uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.void', 'accounting.post'); a alert;
begin
  a := alert_to_act_on(v_business, p_alert);
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Say what was done about it, or why it is fine'; end if;
  update alert set acknowledged_at = now(), acknowledged_by = (current_member()).id, ack_note = left(trim(p_note), 300)
   where id = p_alert;
  perform audit_event(v_business, 'alert.acknowledge', 'alert', p_alert::text, left(trim(p_note), 300), null,
                      jsonb_build_object('rule', a.rule, 'title', a.title));
end $$;

-- Out of sight until a day, with a reason; it comes back then if still true.
create or replace function snooze_alert(p_alert uuid, p_until date, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.void', 'accounting.post'); a alert; v_today date;
begin
  v_today := business_local_date(v_business, now());
  a := alert_to_act_on(v_business, p_alert);
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why it can wait'; end if;
  if p_until is null or p_until <= v_today or p_until > v_today + 30 then
    raise exception 'Snooze it until a day in the next 30';
  end if;
  update alert
     set snoozed_until = (p_until::timestamp) at time zone (select timezone from business where id = v_business),
         snoozed_by = (current_member()).id, snooze_reason = left(trim(p_reason), 300)
   where id = p_alert;
  perform audit_event(v_business, 'alert.snooze', 'alert', p_alert::text, left(trim(p_reason), 300), null,
                      jsonb_build_object('rule', a.rule, 'title', a.title, 'until', p_until));
end $$;

-- =============================================================================
-- 5. The daily brief
-- =============================================================================
-- A day's facts, then the calculations made from them, then what needs doing:
-- kept apart. Revenue and costs are the ledger's, as the P&L has them.
create or replace function daily_brief(p_day date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  b record; v_rev numeric; v_cos numeric; v_cogs numeric; v_waste numeric; v_counts record; v_sales record;
  v_voids record; v_refunds record; v_disc record; v_lastweek numeric; v_avg numeric;
  v_alerts jsonb; v_recs jsonb; v_uncosted bigint;
begin
  if p_day is null or p_day > business_local_date(v_business, now()) then
    raise exception 'Choose a day that has happened';
  end if;
  perform refresh_alerts(v_business);
  b := local_day_bounds(v_business, p_day, p_day);
  select coalesce(sum(case when g.account_type = 'revenue' then l.credit - l.debit end), 0),
         coalesce(sum(case when g.code like '5%' then l.debit - l.credit end), 0),
         coalesce(sum(case when g.code = '5000' then l.debit - l.credit end), 0),
         coalesce(sum(case when g.code = '5300' then l.debit - l.credit end), 0)
    into v_rev, v_cos, v_cogs, v_waste
    from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
   where e.business_id = v_business and e.status = 'published' and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts
     and e.reference_type is distinct from 'year_end_close';
  select count(*) as n into v_sales
    from sales_order o
   where o.business_id = v_business and o.status not in ('voided', 'open')
     and o.placed_at >= b.from_ts and o.placed_at < b.to_ts;
  select count(*) as n, coalesce(sum(sa.amount), 0) as amount into v_voids
    from sale_adjustment sa where sa.business_id = v_business and sa.kind = 'void'
     and sa.created_at >= b.from_ts and sa.created_at < b.to_ts;
  select count(*) as n, coalesce(sum(sa.amount), 0) as amount into v_refunds
    from sale_adjustment sa where sa.business_id = v_business and sa.kind = 'refund'
     and sa.created_at >= b.from_ts and sa.created_at < b.to_ts;
  select count(*) as n, coalesce(sum(o.discount_amount), 0) as amount into v_disc
    from sales_order o
   where o.business_id = v_business and o.discount_amount > 0 and o.status not in ('voided', 'open')
     and o.placed_at >= b.from_ts and o.placed_at < b.to_ts;
  select count(*) as n, coalesce(sum(w.variance), 0) as variance into v_counts
    from work_shift w where w.business_id = v_business and w.kind = 'drawer'
     and w.closed_at >= b.from_ts and w.closed_at < b.to_ts;
  select count(*) into v_uncosted from uncosted_sales(v_business, p_day, p_day);

  -- The same weekday last week, and the average of the four before that had sales.
  select coalesce(sum(case when g.account_type = 'revenue' then l.credit - l.debit end), 0) into v_lastweek
    from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id,
         local_day_bounds(v_business, p_day - 7, p_day - 7) lw
   where e.business_id = v_business and e.status = 'published' and e.occurred_at >= lw.from_ts and e.occurred_at < lw.to_ts
     and e.reference_type is distinct from 'year_end_close';
  select avg(x.rev) into v_avg from (
    select d, (select coalesce(sum(case when g.account_type = 'revenue' then l.credit - l.debit end), 0)
                 from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id,
                      local_day_bounds(v_business, d, d) db
                where e.business_id = v_business and e.status = 'published'
                  and e.occurred_at >= db.from_ts and e.occurred_at < db.to_ts
                  and e.reference_type is distinct from 'year_end_close') as rev
      from unnest(array[p_day - 7, p_day - 14, p_day - 21, p_day - 28]) d
     where exists (select 1 from sales_order o, local_day_bounds(v_business, d, d) db2
                    where o.business_id = v_business and o.placed_at >= db2.from_ts and o.placed_at < db2.to_ts)) x;

  select coalesce(jsonb_agg(jsonb_build_object('urgency', a.urgency, 'title', a.title, 'action', a.action,
                                               'link', a.link, 'acknowledged', a.acknowledged_at is not null)
                            order by (a.urgency = 'red') desc, a.first_seen_at, a.title), '[]'::jsonb)
    into v_alerts
    from alert a
   where a.business_id = v_business and a.resolved_at is null and (a.snoozed_until is null or a.snoozed_until <= now());
  select coalesce(jsonb_agg(x.action order by x.action), '[]'::jsonb) into v_recs
    from (select distinct a.action from alert a
           where a.business_id = v_business and a.resolved_at is null and a.acknowledged_at is null
             and (a.snoozed_until is null or a.snoozed_until <= now()) and a.urgency = 'red') x;

  return jsonb_build_object(
    'day', p_day,
    'facts', jsonb_build_object(
      'sales', v_sales.n, 'net_sales', v_rev, 'voids', v_voids.n, 'voided', v_voids.amount,
      'refunds', v_refunds.n, 'refunded', v_refunds.amount, 'discounts', v_disc.n, 'discounted', v_disc.amount,
      'waste', v_waste, 'drawer_counts', v_counts.n, 'drawer_difference', v_counts.variance,
      'uncosted_sales', v_uncosted),
    'calculations', jsonb_build_object(
      'cost_of_goods', v_cogs,
      'cost_of_goods_percent', case when v_rev > 0 then round(v_cogs / v_rev * 100, 1) end,
      'gross_profit', v_rev - v_cos,
      'gross_margin_percent', case when v_rev > 0 then round((v_rev - v_cos) / v_rev * 100, 1) end,
      'same_day_last_week', v_lastweek,
      'change_from_last_week_percent', case when v_lastweek > 0 then round((v_rev - v_lastweek) / v_lastweek * 100, 1) end,
      'usual_for_the_weekday', round(v_avg)),
    'alerts', v_alerts,
    'red', (select count(*) from jsonb_array_elements(v_alerts) x where x ->> 'urgency' = 'red'),
    'orange', (select count(*) from jsonb_array_elements(v_alerts) x where x ->> 'urgency' = 'orange'),
    'recommendations', v_recs);
end $$;

-- =============================================================================
-- 6. The thresholds, on Settings; a supplier's delivery time
-- =============================================================================
-- Every threshold with its default, its limits and the value in force.
create or replace function alert_thresholds() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage');
begin
  return (select jsonb_object_agg(k.key, k.value || jsonb_build_object('value', alert_setting(v_business, k.key)))
            from jsonb_each(alert_threshold_rules()) k);
end $$;

-- The owner or general manager changes thresholds; an empty one, or one set
-- to its default, follows the default. On the audit trail as a change to the
-- business.
create or replace function set_alert_thresholds(p_settings jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_rules jsonb := alert_threshold_rules(); v_new jsonb; k text; v jsonb; n numeric; x jsonb;
begin
  if jsonb_typeof(p_settings) is distinct from 'object' then raise exception 'No thresholds given'; end if;
  select alert_settings into v_new from business where id = v_business for update;
  for k, v in select key, value from jsonb_each(p_settings) loop
    x := v_rules -> k;
    if x is null then raise exception 'Unknown threshold: %', k; end if;
    if jsonb_typeof(v) = 'null' or trim(v #>> '{}') = '' then
      v_new := v_new - k;
      continue;
    end if;
    begin
      n := trim(v #>> '{}')::numeric;
    exception when others then
      raise exception '%: enter a number', x ->> 'label';
    end;
    if n < (x ->> 'min')::numeric or n > (x ->> 'max')::numeric
       or ((x ->> 'whole')::boolean and n <> trunc(n)) then
      raise exception '%: enter a % from % to %', x ->> 'label',
        case when (x ->> 'whole')::boolean then 'whole number' else 'number' end,
        trim_scale((x ->> 'min')::numeric), trim_scale((x ->> 'max')::numeric);
    end if;
    v_new := case when n = (x ->> 'default')::numeric then v_new - k
                  else v_new || jsonb_build_object(k, trim_scale(n)) end;
  end loop;
  update business set alert_settings = v_new where id = v_business and alert_settings is distinct from v_new;
  return alert_thresholds();
end $$;

-- 0027's update_supplier, with the days a delivery takes (empty: the café's default).
drop function if exists update_supplier(uuid, text, text, text, boolean, text);
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
    select coalesce((select sum(amount_total) from purchase_invoice
                      where supplier_id = p_supplier and cancelled_at is null), 0)
           - coalesce((select sum(amount) from supplier_payment where supplier_id = p_supplier), 0)
      into v_owed;
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

-- =============================================================================
-- 7. Who may call what
-- =============================================================================
revoke execute on function
  alert_threshold_rules(), alert_setting(uuid, text), alert_money(numeric), alert_qty(numeric),
  alert_channel(sales_channel), alert_conditions(uuid, timestamptz), refresh_alerts(uuid),
  alert_to_act_on(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function
  current_alerts(), acknowledge_alert(uuid, text), snooze_alert(uuid, date, text), daily_brief(date),
  alert_thresholds(), set_alert_thresholds(jsonb),
  update_supplier(uuid, text, text, text, boolean, text, int)
  from public, anon;
grant execute on function
  current_alerts(), acknowledge_alert(uuid, text), snooze_alert(uuid, date, text), daily_brief(date),
  alert_thresholds(), set_alert_thresholds(jsonb),
  update_supplier(uuid, text, text, text, boolean, text, int)
  to authenticated;
