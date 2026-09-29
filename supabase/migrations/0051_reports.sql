-- =============================================================================
-- 0051 — The sales analysis, the stock's value on a day, and what was bought
-- (release Y)
--
-- The reports answered set questions: sales by channel, by payment, by size
-- and add-on; the P&L. None said which hours are busy, what sells on a
-- Friday, who sold what, or what a product brings in once its refunds are
-- taken off (docs/COMPLETION_PLAN.md, B17). Nor what the stock was worth on a
-- given day, nor what was bought from whom.
--   * report_sales_analysis: the sales of the dates by one thing and,
--     optionally, a second — the hour, the weekday, the date, the product,
--     its category, its size, an add-on, the person who took the money, the
--     payment, the channel or the branch — narrowed to a channel, a branch, a
--     category or a person. Each sale counts as it was paid, and what its
--     refunds gave back since is taken off the sale it gave back, so every
--     way of looking at the dates adds up to the same sales. Voided sales are
--     left out, and counted apart with the bills cancelled.
--   * inventory_valuation: every item's stock and its value at the end of a
--     day, from the stock ledger, against what 1200 held then.
--   * report_purchases: what came in the dates, by supplier and by item, at
--     the value its corrections left it, and what went back.
-- Reading only: nothing is written, and no table changes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The name a key of the analysis goes by, in the three languages
-- ---------------------------------------------------------------------------
-- The hour, the weekday (the café's week starts on Saturday: 0), the date,
-- the payment and the channel are named by the screens from their key.
create or replace function sales_dim_names(p_dim text, p_key text) returns jsonb
language plpgsql stable set search_path = public as $$
declare r record;
begin
  if p_key is null then return jsonb_build_object('en', null); end if;
  case p_dim
    when 'product' then
      select name as en, name_ar as ar, name_ckb as ckb into r from product where id = p_key::uuid;
    when 'category' then
      if p_key = 'none' then return jsonb_build_object('en', 'No category'); end if;
      select name as en, name_ar as ar, name_ckb as ckb into r from product_category where id = p_key::uuid;
    when 'size' then
      select p.name || ' · ' || v.name as en,
             case when p.name_ar is not null or v.name_ar is not null
                  then coalesce(p.name_ar, p.name) || ' · ' || coalesce(v.name_ar, v.name) end as ar,
             case when p.name_ckb is not null or v.name_ckb is not null
                  then coalesce(p.name_ckb, p.name) || ' · ' || coalesce(v.name_ckb, v.name) end as ckb
        into r from product_variant v join product p on p.id = v.product_id where v.id = p_key::uuid;
    when 'addon' then
      select name as en, name_ar as ar, name_ckb as ckb into r from modifier where id = p_key::uuid;
    when 'employee' then
      if p_key = 'none' then return jsonb_build_object('en', 'No one'); end if;
      select full_name as en, null::text as ar, null::text as ckb into r from app_user where id = p_key::uuid;
    when 'branch' then
      select name as en, null::text as ar, null::text as ckb into r from location where id = p_key::uuid;
    else
      return jsonb_build_object('en', p_key);
  end case;
  return jsonb_strip_nulls(jsonb_build_object('en', coalesce(r.en, p_key), 'ar', r.ar, 'ckb', r.ckb));
end $$;

-- ---------------------------------------------------------------------------
-- 2. A sale's key by each thing it is seen by
-- ---------------------------------------------------------------------------
-- The hour (00–23) and the weekday (0 Saturday … 6 Friday) by the café's
-- clock, the date, and the rest by their id: 'none' for a product with no
-- category, or a sale nobody is named on.
create or replace function sales_dim_key(p_dim text, p_tz text, p_at timestamptz, p_channel sales_channel,
                                         p_location uuid, p_cashier uuid, p_product uuid, p_category uuid,
                                         p_variant uuid, p_modifier uuid, p_tender tender_type) returns text
language sql stable set search_path = public as $$
  select case p_dim
    when 'hour' then lpad(extract(hour from p_at at time zone p_tz)::int::text, 2, '0')
    when 'weekday' then ((extract(isodow from p_at at time zone p_tz)::int + 1) % 7)::text
    when 'date' then to_char(p_at at time zone p_tz, 'YYYY-MM-DD')
    when 'product' then p_product::text
    when 'category' then coalesce(p_category::text, 'none')
    when 'size' then p_variant::text
    when 'addon' then p_modifier::text
    when 'employee' then coalesce(p_cashier::text, 'none')
    when 'payment' then p_tender::text
    when 'channel' then p_channel::text
    when 'branch' then p_location::text
  end
$$;

-- A row of the analysis: its key and names by the first thing, and by the
-- second when there is one, with its figures.
create or replace function sales_analysis_row(p_by text, p_then text, p_k1 text, p_k2 text, p_figures jsonb)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('key', p_k1, 'names', sales_dim_names(p_by, p_k1))
         || case when p_then is not null
                 then jsonb_build_object('key2', p_k2, 'names2', sales_dim_names(p_then, p_k2))
                 else '{}'::jsonb end
         || p_figures
$$;

-- ---------------------------------------------------------------------------
-- 3. The sales analysis
-- ---------------------------------------------------------------------------
-- p_by, and p_then when given: hour, weekday, date, product, category, size,
-- addon, employee, payment, channel or branch. The rows are
--   * the lines sold (every way but the add-ons and the payments): each line
--     as it was sold, its add-ons with it, so the products, the categories and
--     the sizes add up to the sales; and what refunds gave back of it since.
--     A refund from before refunds by the item (0037) gave back the whole
--     sale; the cost it put back is shared over the lines by their cost;
--   * the add-ons (addon): each as it was sold on its line, its share of the
--     discount taken off; refunds are not taken off here;
--   * the payments (payment): what each way of paying took of the sales, and
--     what their refunds gave back that way (a refund from before 0037, its
--     sale's first payment's way). A payment pays for a whole sale, so it goes
--     with the hour, the weekday, the date, the person, the channel and the
--     branch, and with no category.
-- Times are in the order they come; everything else the most first. At most
-- 2,000 rows, with the totals of all of them.
create or replace function report_sales_analysis(p_from date, p_to date, p_by text, p_then text default null,
                                                 p_channel sales_channel default null, p_location uuid default null,
                                                 p_category uuid default null, p_cashier uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  b record; v_tz text; v_grain text; v_then text := nullif(trim(coalesce(p_then, '')), '');
  v_rows jsonb; v_total jsonb; v_count int; v_limit constant int := 2000;
  c_dims constant text[] := array['hour', 'weekday', 'date', 'product', 'category', 'size', 'addon', 'employee',
                                  'payment', 'channel', 'branch'];
  c_line_dims constant text[] := array['product', 'category', 'size', 'addon'];
  c_time_dims constant text[] := array['hour', 'weekday', 'date'];
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose the dates, the first on or before the last';
  end if;
  if p_to - p_from > 366 then raise exception 'Choose at most a year of dates'; end if;
  if p_by is null or not (p_by = any (c_dims)) then raise exception 'Choose what to see the sales by'; end if;
  if v_then is not null and (not (v_then = any (c_dims)) or v_then = p_by) then
    raise exception 'Choose something else to see them by next';
  end if;
  v_grain := case when 'payment' in (p_by, coalesce(v_then, '')) then 'payment'
                  when 'addon' in (p_by, coalesce(v_then, '')) then 'addon'
                  else 'line' end;
  if v_grain = 'payment' and (p_by = any (c_line_dims) or coalesce(v_then, '') = any (c_line_dims)
                              or p_category is not null) then
    raise exception 'A payment pays for a whole sale: see the payments by the hour, the day, the person, the channel or the branch';
  end if;
  select * into b from local_day_bounds(v_business, p_from, p_to);
  v_tz := (select timezone from business where id = v_business);

  if v_grain = 'line' then
    with o as (
      select o.id, o.placed_at, o.channel, o.location_id, o.cashier_id, o.cogs_amount
        from sales_order o
       where o.business_id = v_business and o.status not in ('voided', 'open')
         and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
         and (p_channel is null or o.channel = p_channel)
         and (p_location is null or o.location_id = p_location)
         and (p_cashier is null or o.cashier_id = p_cashier)
    ),
    l as (
      select l.id, l.sales_order_id, o.placed_at, o.channel, o.location_id, o.cashier_id, o.cogs_amount as order_cogs,
             l.product_variant_id, v.product_id, p.category_id, l.quantity,
             l.line_net + l.line_discount as gross, l.line_discount, l.line_net, l.cogs_amount
        from o join sales_order_line l on l.sales_order_id = o.id
        join product_variant v on v.id = l.product_variant_id
        join product p on p.id = v.product_id
       where p_category is null or p.category_id = p_category
    ),
    back as (
      select rl.sales_order_line_id as line_id, rl.amount as refunded, rl.cost_returned as cost_back
        from sale_refund_line rl join l on l.id = rl.sales_order_line_id
      union all
      select l.id, l.line_net,
             case when l.order_cogs > 0
                  then coalesce((select sum(m.value) from inventory_movement m
                                  where m.reference_type = 'sale_refund' and m.reference_id = a.id
                                    and m.type = 'refund_return_to_stock'), 0) * l.cogs_amount / l.order_cogs
                  else 0 end
        from sale_adjustment a join l on l.sales_order_id = a.sales_order_id
       where a.kind = 'refund' and not exists (select 1 from sale_refund r where r.id = a.id)
    ),
    f as (
      select l.*, coalesce(k.refunded, 0) as refunded, coalesce(k.cost_back, 0) as cost_back,
             sales_dim_key(p_by, v_tz, l.placed_at, l.channel, l.location_id, l.cashier_id, l.product_id,
                           l.category_id, l.product_variant_id, null, null) as k1,
             case when v_then is not null
                  then sales_dim_key(v_then, v_tz, l.placed_at, l.channel, l.location_id, l.cashier_id, l.product_id,
                                     l.category_id, l.product_variant_id, null, null) end as k2
        from l left join (select line_id, sum(refunded) as refunded, sum(cost_back) as cost_back
                            from back group by line_id) k on k.line_id = l.id
    ),
    g as (
      select k1, k2, count(distinct sales_order_id) as orders, sum(quantity) as qty, sum(gross) as gross,
             sum(line_discount) as discount, sum(line_net) as net, sum(cogs_amount) as cost,
             sum(refunded) as refunded, sum(cost_back) as cost_back
        from f group by k1, k2
    ),
    g2 as (select g.*, sum(g.net) over (partition by g.k1) as k1_total from g),
    ranked as (
      select g2.*, row_number() over (
               order by case when p_by = any (c_time_dims) then g2.k1 end, g2.k1_total desc, g2.k1,
                        case when v_then = any (c_time_dims) then g2.k2 end, g2.net desc, g2.k2) as n
        from g2
    )
    select (select coalesce(jsonb_agg(sales_analysis_row(p_by, v_then, r.k1, r.k2,
                      jsonb_build_object('orders', r.orders, 'qty', r.qty, 'gross', r.gross, 'discount', r.discount,
                                         'net', r.net, 'cost', money_round(v_business, r.cost),
                                         'margin', r.net - money_round(v_business, r.cost),
                                         'refunded', r.refunded, 'cost_back', money_round(v_business, r.cost_back),
                                         'kept', r.net - r.refunded,
                                         'margin_kept', r.net - r.refunded
                                                        - money_round(v_business, r.cost - r.cost_back)))
                      order by r.n), '[]'::jsonb)
              from ranked r where r.n <= v_limit),
           (select count(*) from g),
           (select jsonb_build_object('orders', count(distinct sales_order_id), 'qty', coalesce(sum(quantity), 0),
                                      'gross', coalesce(sum(gross), 0), 'discount', coalesce(sum(line_discount), 0),
                                      'net', coalesce(sum(line_net), 0),
                                      'cost', money_round(v_business, coalesce(sum(cogs_amount), 0)),
                                      'margin', coalesce(sum(line_net), 0)
                                                - money_round(v_business, coalesce(sum(cogs_amount), 0)),
                                      'refunded', coalesce(sum(refunded), 0),
                                      'cost_back', money_round(v_business, coalesce(sum(cost_back), 0)),
                                      'kept', coalesce(sum(line_net), 0) - coalesce(sum(refunded), 0),
                                      'margin_kept', coalesce(sum(line_net), 0) - coalesce(sum(refunded), 0)
                                                     - money_round(v_business, coalesce(sum(cogs_amount), 0)
                                                                               - coalesce(sum(cost_back), 0)))
              from f)
      into v_rows, v_count, v_total;

  elsif v_grain = 'addon' then
    with m as (
      select lm.id, lm.sales_order_id, o.placed_at, o.channel, o.location_id, o.cashier_id, v.product_id,
             p.category_id, l.product_variant_id, lm.modifier_id, lm.qty, lm.amount, lm.net_amount, lm.cost
        from sales_order o
        join sales_order_line l on l.sales_order_id = o.id
        join sales_order_line_modifier lm on lm.sales_order_line_id = l.id
        join product_variant v on v.id = l.product_variant_id
        join product p on p.id = v.product_id
       where o.business_id = v_business and o.status not in ('voided', 'open')
         and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
         and (p_channel is null or o.channel = p_channel)
         and (p_location is null or o.location_id = p_location)
         and (p_cashier is null or o.cashier_id = p_cashier)
         and (p_category is null or p.category_id = p_category)
    ),
    f as (
      select m.*,
             sales_dim_key(p_by, v_tz, m.placed_at, m.channel, m.location_id, m.cashier_id, m.product_id,
                           m.category_id, m.product_variant_id, m.modifier_id, null) as k1,
             case when v_then is not null
                  then sales_dim_key(v_then, v_tz, m.placed_at, m.channel, m.location_id, m.cashier_id, m.product_id,
                                     m.category_id, m.product_variant_id, m.modifier_id, null) end as k2
        from m
    ),
    g as (
      select k1, k2, count(*) as lines, count(distinct sales_order_id) as orders, sum(qty) as qty,
             sum(amount) as gross, sum(amount - net_amount) as discount, sum(net_amount) as net, sum(cost) as cost
        from f group by k1, k2
    ),
    g2 as (select g.*, sum(g.net) over (partition by g.k1) as k1_total from g),
    ranked as (
      select g2.*, row_number() over (
               order by case when p_by = any (c_time_dims) then g2.k1 end, g2.k1_total desc, g2.k1,
                        case when v_then = any (c_time_dims) then g2.k2 end, g2.net desc, g2.k2) as n
        from g2
    )
    select (select coalesce(jsonb_agg(sales_analysis_row(p_by, v_then, r.k1, r.k2,
                      jsonb_build_object('lines', r.lines, 'orders', r.orders, 'qty', r.qty, 'gross', r.gross,
                                         'discount', r.discount, 'net', r.net, 'cost', money_round(v_business, r.cost),
                                         'margin', r.net - money_round(v_business, r.cost)))
                      order by r.n), '[]'::jsonb)
              from ranked r where r.n <= v_limit),
           (select count(*) from g),
           (select jsonb_build_object('lines', count(*), 'orders', count(distinct sales_order_id),
                                      'qty', coalesce(sum(qty), 0), 'gross', coalesce(sum(amount), 0),
                                      'discount', coalesce(sum(amount - net_amount), 0),
                                      'net', coalesce(sum(net_amount), 0),
                                      'cost', money_round(v_business, coalesce(sum(cost), 0)),
                                      'margin', coalesce(sum(net_amount), 0)
                                                - money_round(v_business, coalesce(sum(cost), 0)))
              from f)
      into v_rows, v_count, v_total;

  else
    with o as (
      select o.id, o.placed_at, o.channel, o.location_id, o.cashier_id
        from sales_order o
       where o.business_id = v_business and o.status not in ('voided', 'open')
         and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
         and (p_channel is null or o.channel = p_channel)
         and (p_location is null or o.location_id = p_location)
         and (p_cashier is null or o.cashier_id = p_cashier)
    ),
    t as (
      select o.id as order_id, o.placed_at, o.channel, o.location_id, o.cashier_id, st.tender_type,
             sum(st.amount) as paid
        from o join sales_tender st on st.sales_order_id = o.id
       group by o.id, o.placed_at, o.channel, o.location_id, o.cashier_id, st.tender_type
    ),
    back as (
      select r.sales_order_id as order_id, rt.tender_type, rt.amount as refunded
        from sale_refund r join sale_refund_tender rt on rt.refund_id = r.id
       where r.sales_order_id in (select id from o)
      union all
      select a.sales_order_id, (select st.tender_type from sales_tender st where st.sales_order_id = a.sales_order_id
                                 order by st.position, st.id limit 1), a.amount
        from sale_adjustment a
       where a.kind = 'refund' and a.sales_order_id in (select id from o)
         and not exists (select 1 from sale_refund r where r.id = a.id)
    ),
    f as (
      select t.*, coalesce(k.refunded, 0) as refunded,
             sales_dim_key(p_by, v_tz, t.placed_at, t.channel, t.location_id, t.cashier_id, null, null, null, null,
                           t.tender_type) as k1,
             case when v_then is not null
                  then sales_dim_key(v_then, v_tz, t.placed_at, t.channel, t.location_id, t.cashier_id, null, null,
                                     null, null, t.tender_type) end as k2
        from t left join (select order_id, tender_type, sum(refunded) as refunded from back
                           group by order_id, tender_type) k
               on k.order_id = t.order_id and k.tender_type = t.tender_type
    ),
    g as (
      select k1, k2, count(distinct order_id) as orders, sum(paid) as paid, sum(refunded) as refunded
        from f group by k1, k2
    ),
    g2 as (select g.*, sum(g.paid) over (partition by g.k1) as k1_total from g),
    ranked as (
      select g2.*, row_number() over (
               order by case when p_by = any (c_time_dims) then g2.k1 end, g2.k1_total desc, g2.k1,
                        case when v_then = any (c_time_dims) then g2.k2 end, g2.paid desc, g2.k2) as n
        from g2
    )
    select (select coalesce(jsonb_agg(sales_analysis_row(p_by, v_then, r.k1, r.k2,
                      jsonb_build_object('orders', r.orders, 'paid', r.paid, 'refunded', r.refunded,
                                         'kept', r.paid - r.refunded))
                      order by r.n), '[]'::jsonb)
              from ranked r where r.n <= v_limit),
           (select count(*) from g),
           (select jsonb_build_object('orders', count(distinct order_id), 'paid', coalesce(sum(paid), 0),
                                      'refunded', coalesce(sum(refunded), 0),
                                      'kept', coalesce(sum(paid), 0) - coalesce(sum(refunded), 0))
              from f)
      into v_rows, v_count, v_total;
  end if;

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'by', p_by, 'then', v_then, 'grain', v_grain,
    'filters', jsonb_strip_nulls(jsonb_build_object('channel', p_channel, 'location', p_location,
                                                    'category', p_category, 'cashier', p_cashier)),
    'rows', v_rows, 'row_count', v_count, 'truncated', v_count > v_limit, 'total', v_total,
    -- What the analysis leaves out: the sales voided, and the bills cancelled.
    'voided', (select jsonb_build_object('orders', count(*), 'net', coalesce(sum(o.net_amount), 0))
                 from sales_order o
                where o.business_id = v_business and o.status = 'voided'
                  and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
                  and (p_channel is null or o.channel = p_channel)
                  and (p_location is null or o.location_id = p_location)
                  and (p_cashier is null or o.cashier_id = p_cashier)),
    'cancelled_bills', (select count(*) from pos_tab t
                         where t.business_id = v_business and t.status = 'cancelled'
                           and t.closed_at >= b.from_ts and t.closed_at < b.to_ts
                           and (p_channel is null or t.channel = p_channel)
                           and (p_location is null or t.location_id = p_location)),
    -- What the screen offers to narrow it to: those who have taken money, the
    -- categories and the branches.
    'choices', jsonb_build_object(
      'people', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.full_name)
                                           order by lower(u.full_name))
                            from app_user u
                           where u.business_id = v_business
                             and exists (select 1 from sales_order o where o.cashier_id = u.id)), '[]'::jsonb),
      'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'names',
                                                 jsonb_strip_nulls(jsonb_build_object('en', c.name, 'ar', c.name_ar,
                                                                                      'ckb', c.name_ckb)))
                                               order by c.sort_order, lower(c.name))
                                from product_category c where c.business_id = v_business and c.is_active),
                             '[]'::jsonb),
      'branches', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name)
                              from location l where l.business_id = v_business and l.kind = 'branch'), '[]'::jsonb)));
end $$;

-- ---------------------------------------------------------------------------
-- 4. The stock's value at the end of a day
-- ---------------------------------------------------------------------------
-- Every item's stock and value from the stock ledger as they stood when the
-- day ended by the café's clock, at one branch or everywhere; and, for
-- everywhere, what 1200 Inventory held then (the books check's two sides).
create or replace function inventory_valuation(p_as_of date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_end timestamptz; v_items jsonb; v_types jsonb; v_stock numeric; v_ledger numeric;
begin
  if p_as_of is null then raise exception 'Choose the day'; end if;
  if p_as_of > business_local_date(v_business, now()) then
    raise exception 'Choose today or a day before it';
  end if;
  if p_location is not null
     and not exists (select 1 from location where id = p_location and business_id = v_business) then
    raise exception 'Location not found';
  end if;
  select to_ts into v_end from local_day_bounds(v_business, p_as_of, p_as_of);
  with s as (
    select m.item_id, sum(m.base_quantity_signed) as qty, sum(m.value * sign(m.base_quantity_signed)) as value
      from inventory_movement m
     where m.business_id = v_business and m.occurred_at < v_end
       and (p_location is null or m.location_id = p_location)
     group by m.item_id
    having sum(m.base_quantity_signed) <> 0 or sum(m.value * sign(m.base_quantity_signed)) <> 0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', i.id, 'name', i.name, 'name_ar', i.name_ar, 'name_ckb', i.name_ckb, 'type', i.item_type,
           'unit', i.base_unit_code, 'qty', s.qty, 'value', money_round(v_business, s.value),
           'unit_cost', case when s.qty > 0 then round(s.value / s.qty, 4) end)
         order by s.value desc, lower(i.name)), '[]'::jsonb),
         coalesce(sum(s.value), 0),
         (select coalesce(jsonb_agg(jsonb_build_object('type', x.item_type, 'items', x.n,
                                                       'value', money_round(v_business, x.value))
                                    order by x.value desc), '[]'::jsonb)
            from (select i2.item_type, count(*) as n, sum(s2.value) as value
                    from s s2 join item i2 on i2.id = s2.item_id group by i2.item_type) x)
    into v_items, v_stock, v_types
    from s join item i on i.id = s.item_id;
  if p_location is null then
    v_ledger := gl_balance_at(v_business, '1200', v_end);
  end if;
  return jsonb_build_object(
    'as_of', p_as_of, 'location', p_location, 'items', v_items, 'by_type', v_types,
    'stock', money_round(v_business, v_stock), 'ledger', v_ledger,
    'difference', case when p_location is null then money_round(v_business, v_stock - v_ledger) end);
end $$;

-- ---------------------------------------------------------------------------
-- 5. What was bought in the dates
-- ---------------------------------------------------------------------------
-- The deliveries received in the dates by the café's clock, as their latest
-- correction left them (a delivery reversed whole counts nothing), their
-- landed costs shared in: by supplier and by item. Beside them what went back
-- to the suppliers in the dates, the credits for price they gave, and the
-- bills dated in the dates.
create or replace function report_purchases(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose the dates, the first on or before the last';
  end if;
  select * into b from local_day_bounds(v_business, p_from, p_to);
  return (
    with st as (
      select g.id, receipt_state(g.id) as s from goods_receipt g where g.business_id = v_business
    ),
    got as (
      select st.id, (st.s ->> 'supplier_id')::uuid as supplier_id, st.s -> 'lines' as lines
        from st
       where (st.s ->> 'received_on')::date between p_from and p_to
         and not coalesce((st.s ->> 'reversed')::boolean, false)
    ),
    lines as (
      select got.id as receipt_id, got.supplier_id, (x ->> 'item_id')::uuid as item_id,
             (x ->> 'base_qty')::numeric as qty, coalesce((x ->> 'landed')::numeric, (x ->> 'goods_value')::numeric) as value
        from got cross join lateral jsonb_array_elements(got.lines) x
    ),
    back as (
      select r.id as return_id, r.supplier_id, l.item_id, l.base_qty as qty, l.value
        from supplier_return r join supplier_return_line l on l.supplier_return_id = r.id
       where r.business_id = v_business and r.created_at >= b.from_ts and r.created_at < b.to_ts
    ),
    price as (
      select c.supplier_id, sum(c.amount) as amount from supplier_credit c
       where c.business_id = v_business and c.kind = 'price' and c.credit_date between p_from and p_to
       group by c.supplier_id
    ),
    billed as (
      select i.supplier_id, count(*) as bills, sum(i.amount_total) as amount from purchase_invoice i
       where i.business_id = v_business and i.cancelled_at is null
         and coalesce(i.invoice_date, business_local_date(v_business, i.created_at)) between p_from and p_to
       group by i.supplier_id
    ),
    sup as (
      select s.id, s.name,
             (select count(distinct l.receipt_id) from lines l where l.supplier_id = s.id) as deliveries,
             coalesce((select sum(l.value) from lines l where l.supplier_id = s.id), 0) as received,
             coalesce((select sum(k.value) from back k where k.supplier_id = s.id), 0) as returned,
             coalesce((select p.amount from price p where p.supplier_id = s.id), 0) as price_credits,
             coalesce((select bi.bills from billed bi where bi.supplier_id = s.id), 0) as bills,
             coalesce((select bi.amount from billed bi where bi.supplier_id = s.id), 0) as billed
        from supplier s
       where s.business_id = v_business
         and (exists (select 1 from lines l where l.supplier_id = s.id)
              or exists (select 1 from back k where k.supplier_id = s.id)
              or exists (select 1 from price p where p.supplier_id = s.id)
              or exists (select 1 from billed bi where bi.supplier_id = s.id))
    ),
    itm as (
      select i.id, i.name, i.name_ar, i.name_ckb, i.base_unit_code,
             coalesce((select sum(l.qty) from lines l where l.item_id = i.id), 0) as qty,
             coalesce((select sum(l.value) from lines l where l.item_id = i.id), 0) as received,
             (select count(distinct l.supplier_id) from lines l where l.item_id = i.id) as suppliers,
             coalesce((select sum(k.qty) from back k where k.item_id = i.id), 0) as qty_back,
             coalesce((select sum(k.value) from back k where k.item_id = i.id), 0) as returned
        from item i
       where i.business_id = v_business
         and (exists (select 1 from lines l where l.item_id = i.id) or exists (select 1 from back k where k.item_id = i.id))
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to,
      'suppliers', coalesce((select jsonb_agg(jsonb_build_object(
                       'supplier_id', sup.id, 'name', sup.name, 'deliveries', sup.deliveries,
                       'received', money_round(v_business, sup.received), 'returned', sup.returned,
                       'price_credits', sup.price_credits,
                       'net', money_round(v_business, sup.received) - sup.returned - sup.price_credits,
                       'bills', sup.bills, 'billed', sup.billed)
                     order by sup.received desc, lower(sup.name)) from sup), '[]'::jsonb),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
                   'item_id', itm.id, 'name', itm.name, 'name_ar', itm.name_ar, 'name_ckb', itm.name_ckb,
                   'unit', itm.base_unit_code, 'qty', itm.qty, 'received', money_round(v_business, itm.received),
                   'unit_cost', case when itm.qty > 0 then round(itm.received / itm.qty, 4) end,
                   'suppliers', itm.suppliers, 'qty_back', itm.qty_back, 'returned', itm.returned,
                   'net', money_round(v_business, itm.received) - itm.returned)
                 order by itm.received desc, lower(itm.name)) from itm), '[]'::jsonb),
      'total', jsonb_build_object(
        'deliveries', (select count(distinct receipt_id) from lines),
        'received', money_round(v_business, coalesce((select sum(value) from lines), 0)),
        'returns', (select count(distinct return_id) from back),
        'returned', coalesce((select sum(value) from back), 0),
        'price_credits', coalesce((select sum(amount) from price), 0),
        'net', money_round(v_business, coalesce((select sum(value) from lines), 0))
               - coalesce((select sum(value) from back), 0) - coalesce((select sum(amount) from price), 0),
        'bills', coalesce((select sum(bills) from billed), 0),
        'billed', coalesce((select sum(amount) from billed), 0)))
  );
end $$;

-- ---------------------------------------------------------------------------
-- 6. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  sales_dim_names(text, text),
  sales_dim_key(text, text, timestamptz, sales_channel, uuid, uuid, uuid, uuid, uuid, uuid, tender_type),
  sales_analysis_row(text, text, text, text, jsonb)
  from public, anon, authenticated;
revoke execute on function
  report_sales_analysis(date, date, text, text, sales_channel, uuid, uuid, uuid),
  inventory_valuation(date, uuid), report_purchases(date, date)
  from public, anon;
grant execute on function
  report_sales_analysis(date, date, text, text, sales_channel, uuid, uuid, uuid),
  inventory_valuation(date, uuid), report_purchases(date, date)
  to authenticated;
