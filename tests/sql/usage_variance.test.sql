-- =============================================================================
-- Usage variance (0039, release N): each item between its first and its last
-- approved count, what came in, what the recipes used, what was recorded as
-- lost, and what the counts say went. Fixtures: beans 1,000 g at 10/g, cups
-- 100 at 50, water 24 at 250; an espresso takes 20 g of beans, and a cup when
-- it is taken away.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.id(p text) returns uuid language sql as $$ select (v ->> 'id')::uuid from res where k = p $$;
create function pg_temp.sale(p text) returns uuid language sql as $$ select (v ->> 'order_id')::uuid from res where k = p $$;
create function pg_temp.line(p_sale text, p_variant text) returns uuid language sql security definer as $$
  select id from sales_order_line
   where sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p_sale) and product_variant_id = p_variant::uuid
$$;
create function pg_temp.row(p_item text) returns text language sql security definer as $$
  select trim_scale(opening) || ' +' || trim_scale(received) || ' ±' || trim_scale(corrected) || ' -' || trim_scale(closing)
         || ' -' || trim_scale(lost) || ' = ' || trim_scale(actual) || ' vs ' || trim_scale(theoretical)
         || ': ' || trim_scale(variance) || ' (' || coalesce(trim_scale(variance_percent)::text, '—') || '%, '
         || trim_scale(variance_value) || ' IQD)'
    from report_usage_variance(test.today(), test.today()) where item_id = p_item::uuid
$$;

-- ------------------------------------------------------------ the first count
-- Beans and water are counted; the cups are not. 10 g of beans are missing.
select test.act_as('counter@example.com');
insert into res select 'C1', jsonb_build_object('id', start_stock_count(
  array['c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003']::uuid[]));
select record_count(pg_temp.id('C1'), 'c0000000-0000-0000-0000-000000000001', 990, 'g');
select record_count(pg_temp.id('C1'), 'c0000000-0000-0000-0000-000000000003', 24);
select submit_stock_count(pg_temp.id('C1'));
select test.act_as('manager@example.com');
select approve_stock_count(pg_temp.id('C1'));

-- ------------------------------------------------------------ the days between
-- 500 g of beans come in; fifteen espressos sell (300 g, five cups); two more
-- are rung up and voided; 30 g of beans spoil. Three bottles of water sell,
-- one comes back, and a bottle is found.
select receive_goods((select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' order by name, id limit 1),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":500,"unit_price":10}]', p_confirm => true);
select test.act_as('cashier@example.com');
insert into res select 'S1', record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":10}]');
insert into res select 'S2', record_sale(gen_random_uuid(), 'takeaway', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":5}]');
insert into res select 'S3', record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]');
insert into res select 'S4', record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":3}]');
select test.act_as('manager@example.com');
select void_sale(pg_temp.sale('S3'), null, 'rang_twice');
select refund_sale_lines(pg_temp.sale('S4'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('S4', 'd1000000-0000-0000-0000-000000000002'), 'qty', 1)),
  'changed_mind');
select record_waste('c0000000-0000-0000-0000-000000000001', 30, 'g', 'spoilage', 'left out overnight');
select adjust_stock('c0000000-0000-0000-0000-000000000003', 1, 'each', 'found behind the fridge');

-- ------------------------------------------------------------ the second count
-- The ledger expects 1,160 g of beans; 1,130 are there. The water and the cups
-- are as expected.
select test.act_as('counter@example.com');
insert into res select 'C2', jsonb_build_object('id', start_stock_count(
  array['c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
        'c0000000-0000-0000-0000-000000000003']::uuid[]));
select record_count(pg_temp.id('C2'), 'c0000000-0000-0000-0000-000000000001', 1130, 'g');
select record_count(pg_temp.id('C2'), 'c0000000-0000-0000-0000-000000000002', 95);
select record_count(pg_temp.id('C2'), 'c0000000-0000-0000-0000-000000000003', 23);
select submit_stock_count(pg_temp.id('C2'));
select test.act_as('manager@example.com');
select approve_stock_count(pg_temp.id('C2'));

-- ------------------------------------------------------------ the report
select test.act_as('owner@example.com');
select test.eq(pg_temp.row('c0000000-0000-0000-0000-000000000001'),
  '990 +500 ±0 -1130 -30 = 330 vs 300: 30 (10%, 300 IQD)',
  'beans: 990 counted, 500 in, 1,130 counted, 30 spoiled: 330 used where the recipes say 300');
select test.eq((select trim_scale(sold) || '/' || trim_scale(batches) || '/' || (losses ->> 'spoilage')
                  from report_usage_variance(test.today(), test.today())
                 where item_id = 'c0000000-0000-0000-0000-000000000001'),
  '300/0/30', 'the fifteen espressos sold, net of the two voided; the loss by its kind');
select test.eq((select string_agg((p ->> 'name') || ' ' || (p ->> 'sold') || ' used ' || (p ->> 'used'), '; ')
                  from report_usage_variance(test.today(), test.today()) r, jsonb_array_elements(r.products) p
                 where r.item_id = 'c0000000-0000-0000-0000-000000000001'),
  'Golden espresso — Single 15 used 300', 'the product that used it, the voided sale left out');
select test.eq((select array_to_string(factors, ' | ') from report_usage_variance(test.today(), test.today())
                 where item_id = 'c0000000-0000-0000-0000-000000000001'),
  'More was used than the recipes say: bigger portions, waste not recorded, or sales not rung up | '
  'Sales that used it were voided: if they had been made, what they used is gone',
  'and what may explain it');
select test.eq(pg_temp.row('c0000000-0000-0000-0000-000000000003'),
  '24 +0 ±1 -23 -0 = 2 vs 2: 0 (0%, 0 IQD)',
  'water: three sold, one back on the shelf, one found: two used, as the sales say');
select test.eq((select array_to_string(factors, ' | ') from report_usage_variance(test.today(), test.today())
                 where item_id = 'c0000000-0000-0000-0000-000000000003'),
  'Its stock was corrected by hand between the counts', 'the bottle found is named');
select test.eq((select counts || '/' || coalesce(trim_scale(variance)::text, 'none') || '/' || trim_scale(opening)
                  from report_usage_variance(test.today(), test.today())
                 where item_id = 'c0000000-0000-0000-0000-000000000002'),
  '1/none/95', 'the cups, counted once in these dates, wait for a second count');
select test.eq((select count(*) from report_usage_variance(test.today() - 1, test.today() - 1))::int, 0,
  'a day with no count has nothing to show');
select test.throws($$select * from report_usage_variance(test.today(), test.today() - 1)$$,
  'Choose the dates, the first before the last', 'dates the wrong way round are refused');

-- ------------------------------------------------------------ who may see it
select test.act_as('cashier@example.com');
select test.throws($$select * from report_usage_variance(test.today(), test.today())$$, '%needs cost.view%',
  'a cashier does not see it');
select test.act_as('counter@example.com');
select test.throws($$select * from report_usage_variance(test.today(), test.today())$$, '%needs cost.view%',
  'nor does the counter: the counts stay blind');

-- ------------------------------------------------------------ the alert
select test.as_admin();
select test.eq((select count(*) from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'usage_variance')::int, 0,
  '300 IQD is under the 5,000 the alert waits for');
select test.act_as('owner@example.com');
select set_alert_thresholds('{"usage_variance_min": 100}');
select test.as_admin();
select test.eq((select urgency || ' ' || confidence || ': ' || title from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'usage_variance'),
  format('orange medium: Golden beans: 30 g more used than the recipes say between the counts of %s and %s (10%%, 300 IQD)',
         to_char(now() at time zone 'Asia/Baghdad', 'DD Mon'), to_char(now() at time zone 'Asia/Baghdad', 'DD Mon')),
  'past the owner''s thresholds, the beans are named');
select test.act_as('owner@example.com');
select set_alert_thresholds('{"usage_variance_percent": 11}');
select test.as_admin();
select test.eq((select count(*) from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'usage_variance')::int, 0, 'and not under the percentage');
