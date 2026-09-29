-- =============================================================================
-- The sales analysis, the stock's value on a day, and what was bought (0051,
-- release Y). Espresso: 2,500 in or away, 20 g of beans at 10 (and a cup away);
-- water: 1,000, 250 each; an extra shot: 750. The sales of today:
--   S1 the cashier, dine-in, card: 2 espressos, 5,000; one given back later.
--   S2 the cashier, dine-in, cash: an espresso and 2 waters, 4,500 less 450
--      (10%): 4,050, the discount shared 250 and 200.
--   S3 the manager, takeaway, card: an espresso with an extra shot, 3,250.
--   S4 the cashier, dine-in, card: a water, voided.
--   S5 the cashier, dine-in: 2 espressos, 2,000 in cash and 3,000 by card.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.sale(p text) returns uuid language sql as $$ select (v ->> 'order_id')::uuid from res where k = p $$;
create function pg_temp.lines(p_variant text, n int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', p_variant, 'qty', n))
$$;
create function pg_temp.esp() returns text language sql as $$ select 'd1000000-0000-0000-0000-000000000001' $$;
create function pg_temp.wat() returns text language sql as $$ select 'd1000000-0000-0000-0000-000000000002' $$;
-- A row's figures, as "key: net" (or as the figure named).
create function pg_temp.rows(a jsonb, f text default 'net') returns text language sql as $$
  select string_agg(coalesce(x -> 'names' ->> 'en', x ->> 'key')
                    || coalesce(' / ' || coalesce(x -> 'names2' ->> 'en', x ->> 'key2'), '') || ': ' || (x ->> f),
                    ', ' order by o)
    from jsonb_array_elements(a -> 'rows') with ordinality e(x, o)
$$;
create function pg_temp.an(p_by text, p_then text default null, p_channel sales_channel default null,
                           p_location uuid default null, p_category uuid default null, p_cashier uuid default null)
returns jsonb language sql as $$
  select report_sales_analysis(test.today(), test.today(), p_by, p_then, p_channel, p_location, p_category, p_cashier)
$$;
create function pg_temp.person(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
create function pg_temp.branch() returns uuid language sql security definer as $$
  select id from location where business_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'branch' limit 1
$$;
create function pg_temp.hot() returns uuid language sql security definer as $$
  select id from product_category where name = 'Hot drinks'
$$;
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
$$;
create function pg_temp.hour_of(p_sale text) returns text language sql security definer as $$
  select lpad(extract(hour from o.placed_at at time zone 'Asia/Baghdad')::int::text, 2, '0')
    from sales_order o where o.id = (select (v ->> 'order_id')::uuid from res where k = p_sale)
$$;
create temp table before as select pg_temp.checks() as checks;
grant select on before to public;

-- ------------------------------------------------------------------ the catalogue
select test.act_as('owner@example.com');
insert into res select 'hot', jsonb_build_object('id', save_category(null, 'Hot drinks', 'مشروبات ساخنة', null, 1));
select test.as_admin();
update product set category_id = pg_temp.hot() where id = 'd0000000-0000-0000-0000-000000000001';
select test.act_as('owner@example.com');
insert into res select 'extras', save_modifier_group(null, 'Extras', 0, 3, 1);
insert into res select 'shot', save_modifier(null, (pg_temp.r('extras') ->> 'group_id')::uuid, 'Extra shot', 1,
                                             p_prices => '{"dine_in": 750, "takeaway": 750}');
select set_product_modifiers('d0000000-0000-0000-0000-000000000001',
  jsonb_build_array(jsonb_build_object('group_id', (pg_temp.r('extras') ->> 'group_id')::uuid)));

-- ------------------------------------------------------------------ the sales
select test.act_as('cashier@example.com');
insert into res select 'S1', record_sale(gen_random_uuid(), 'dine_in', 'card', pg_temp.lines(pg_temp.esp(), 2));
insert into res select 'S2', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  jsonb_build_array(jsonb_build_object('variant_id', pg_temp.esp(), 'qty', 1),
                    jsonb_build_object('variant_id', pg_temp.wat(), 'qty', 2)),
  p_discount_amount => 450, p_discount_reason => 'promotion');
insert into res select 'S4', record_sale(gen_random_uuid(), 'dine_in', 'card', pg_temp.lines(pg_temp.wat(), 1));
insert into res select 'S5', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines(pg_temp.esp(), 2),
  p_tenders => '[{"type": "cash", "amount": 2000}, {"type": "card", "amount": 3000}]');
select test.act_as('manager@example.com');
insert into res select 'S3', record_sale(gen_random_uuid(), 'takeaway', 'card',
  jsonb_build_array(jsonb_build_object('variant_id', pg_temp.esp(), 'qty', 1, 'modifiers',
    jsonb_build_array(jsonb_build_object('modifier_id', (pg_temp.r('shot') ->> 'modifier_id')::uuid, 'qty', 1)))));
select void_sale(pg_temp.sale('S4'), null, 'rang_twice');
select refund_sale_lines(pg_temp.sale('S1'),
  (select jsonb_build_array(jsonb_build_object('line_id', l.id, 'qty', 1))
     from sales_order_line l where l.sales_order_id = pg_temp.sale('S1')), 'changed_mind');
-- A bill for a table, cancelled.
insert into res select 'B1', open_tab('dine_in', p_label => 'Guest', p_lines => pg_temp.lines(pg_temp.wat(), 1));
select cancel_tab((pg_temp.r('B1') ->> 'tab_id')::uuid,
                  (select version from pos_open_bills() b where b.tab_id = (pg_temp.r('B1') ->> 'tab_id')::uuid),
                  null, 'customer_left');
select test.eq((select string_agg(k || ' ' || (v ->> 'net'), ', ' order by k) from res where k like 'S_'),
  'S1 5000, S2 4050, S3 3250, S4 1000, S5 5000', 'the five sales, as the till recorded them');

-- ------------------------------------------------------------------ every way adds up to the sales
select test.act_as('owner@example.com');
select test.eq((select (t ->> 'orders') || ' orders, ' || (t ->> 'qty') || ' items, ' || (t ->> 'gross') || ' less '
                       || (t ->> 'discount') || ' = ' || (t ->> 'net') || ', cost ' || (t ->> 'cost') || ', margin '
                       || (t ->> 'margin') || '; given back ' || (t ->> 'refunded') || ', kept ' || (t ->> 'kept')
                       || ', margin kept ' || (t ->> 'margin_kept')
                  from (select pg_temp.an('product') -> 'total' as t) x),
  '4 orders, 8 items, 17750 less 450 = 17300, cost 1750, margin 15550; given back 2500, kept 14800, margin kept 13050',
  'the sales of the day: the void left out, the refund taken off the sale it gave back');
select test.eq(pg_temp.rows(pg_temp.an('product')), 'Golden espresso: 15500, Golden water: 1800',
  'by product, the most first; each line with its add-ons');
select test.eq((select (x ->> 'qty') || ' sold, ' || (x ->> 'discount') || ' off, ' || (x ->> 'cost') || ' cost, '
                       || (x ->> 'refunded') || ' back, ' || (x ->> 'orders') || ' orders'
                  from jsonb_array_elements(pg_temp.an('product') -> 'rows') x where x ->> 'key' = 'd0000000-0000-0000-0000-000000000001'),
  '6 sold, 250 off, 1250 cost, 2500 back, 4 orders', 'the espresso: its share of the discount, and the one given back');
select test.eq(pg_temp.rows(pg_temp.an('category')), 'Hot drinks: 15500, No category: 1800',
  'by category, a product with none apart');
select test.eq((select x -> 'names' ->> 'ar' from jsonb_array_elements(pg_temp.an('category') -> 'rows') x
                 where x ->> 'key' = pg_temp.hot()::text), 'مشروبات ساخنة', 'with its Arabic name');
select test.eq(pg_temp.rows(pg_temp.an('size')), 'Golden espresso · Single: 15500, Golden water · Bottle: 1800', 'by size');
select test.eq(pg_temp.rows(pg_temp.an('employee')), 'Demo Cashier: 14050, Demo Manager: 3250', 'by the person who took the money');
select test.eq(pg_temp.rows(pg_temp.an('channel')), 'dine_in: 14050, takeaway: 3250', 'by channel');
select test.eq((select jsonb_array_length(a -> 'rows')::text || ' ' || (a -> 'rows' -> 0 ->> 'net')
                  from (select pg_temp.an('branch') as a) x),
  '1 17300', 'by branch: the one');
select test.eq(pg_temp.rows(pg_temp.an('date')), test.today()::text || ': 17300', 'by date');
select test.eq((select sum((x ->> 'net')::numeric)::text || ' in ' || count(*) || ' hour(s), '
                       || bool_or(x ->> 'key' = pg_temp.hour_of('S1'))::text
                  from jsonb_array_elements(pg_temp.an('hour') -> 'rows') x),
  '17300 in 1 hour(s), true', 'by the hour, by the café''s clock');
select test.eq((select (x ->> 'key') from jsonb_array_elements(pg_temp.an('weekday') -> 'rows') x),
  ((extract(isodow from now() at time zone 'Asia/Baghdad')::int + 1) % 7)::text,
  'by the weekday: the café''s week starts on Saturday (0)');

-- ------------------------------------------------------------------ two ways at once, and narrowed
select test.eq(pg_temp.rows(pg_temp.an('product', 'channel')),
  'Golden espresso / dine_in: 12250, Golden espresso / takeaway: 3250, Golden water / dine_in: 1800',
  'by product, then by channel');
select test.eq(pg_temp.rows(pg_temp.an('channel', 'product')),
  'dine_in / Golden espresso: 12250, dine_in / Golden water: 1800, takeaway / Golden espresso: 3250',
  'by channel, then by product');
select test.eq((pg_temp.an('product', null, 'takeaway') -> 'total' ->> 'net'), '3250', 'only the takeaway');
select test.eq((select (t ->> 'net') || ' in ' || (t ->> 'orders') from (select pg_temp.an('product', null, null, null, pg_temp.hot()) -> 'total' as t) x),
  '15500 in 4', 'only the hot drinks: their lines, in the four sales that had them');
select test.eq((pg_temp.an('product', null, null, null, null, pg_temp.person('manager@example.com')) -> 'total' ->> 'net'),
  '3250', 'only the manager''s');
select test.eq((pg_temp.an('product', null, null, pg_temp.branch()) -> 'total' ->> 'net'), '17300', 'only the branch');

-- ------------------------------------------------------------------ the add-ons and the payments
select test.eq((select (x -> 'names' ->> 'en') || ': ' || (x ->> 'lines') || ' line, ' || (x ->> 'gross') || ', cost ' || (x ->> 'cost')
                  from jsonb_array_elements(pg_temp.an('addon') -> 'rows') x),
  'Extra shot: 1 line, 750, cost 0', 'by add-on');
select test.eq(pg_temp.rows(pg_temp.an('addon', 'product'), 'net'), 'Extra shot / Golden espresso: 750', 'an add-on by product');
select test.eq(pg_temp.rows(pg_temp.an('payment'), 'paid'), 'card: 11250, cash: 6050', 'by payment: what each took');
select test.eq((select (x ->> 'orders') || ' sales, ' || (x ->> 'refunded') || ' back, ' || (x ->> 'kept') || ' kept'
                  from jsonb_array_elements(pg_temp.an('payment') -> 'rows') x where x ->> 'key' = 'card'),
  '3 sales, 2500 back, 8750 kept', 'the card: the refund went back that way');
select test.eq((select (t ->> 'paid') || ' ' || (t ->> 'refunded') || ' ' || (t ->> 'kept') from (select pg_temp.an('payment') -> 'total' as t) x),
  '17300 2500 14800', 'the payments come to the sales');
select test.eq(pg_temp.rows(pg_temp.an('payment', 'employee'), 'paid'),
  'card / Demo Cashier: 8000, card / Demo Manager: 3250, cash / Demo Cashier: 6050', 'payments by person');

-- ------------------------------------------------------------------ what it leaves out
select test.eq((select (a -> 'voided' ->> 'orders') || ' voided (' || (a -> 'voided' ->> 'net') || '), '
                       || (a ->> 'cancelled_bills') || ' bill cancelled'
                  from (select pg_temp.an('product') as a) x),
  '1 voided (1000), 1 bill cancelled', 'the void and the cancelled bill, counted apart');

select test.eq((select (select string_agg(x ->> 'name', ', ') from jsonb_array_elements(c -> 'people') x) || '; '
                       || (select bool_or(x -> 'names' ->> 'en' = 'Hot drinks')::text
                             from jsonb_array_elements(c -> 'categories') x)
                       || '; ' || jsonb_array_length(c -> 'branches') || ' branch'
                  from (select pg_temp.an('product') -> 'choices' as c) x),
  'Demo Cashier, Demo Manager; true; 1 branch', 'what it can be narrowed to: who took money, the categories, the branches');

-- ------------------------------------------------------------------ refused
select test.throws($$select pg_temp.an('colour')$$, 'Choose what to see the sales by', 'a way it does not know');
select test.throws($$select pg_temp.an('product', 'product')$$, 'Choose something else to see them by next', 'the same way twice');
select test.throws($$select pg_temp.an('payment', 'product')$$, 'A payment pays for a whole sale%', 'payments by product');
select test.throws(format('select pg_temp.an(%L, null, null, null, %L)', 'payment', pg_temp.hot()),
  'A payment pays for a whole sale%', 'payments of a category');
select test.throws($$select report_sales_analysis(test.today(), test.today() - 1, 'product')$$,
  'Choose the dates, the first on or before the last', 'dates the wrong way round');
select test.throws($$select report_sales_analysis(test.today() - 400, test.today(), 'product')$$,
  'Choose at most a year of dates', 'more than a year');
select test.act_as('cashier@example.com');
select test.throws($$select pg_temp.an('product')$$, '%needs cost.view%', 'the cashier reads no analysis');

-- ------------------------------------------------------------------ the stock's value on a day
select test.act_as('owner@example.com');
select test.eq((select (v ->> 'stock') || ' = ' || (v ->> 'ledger') || ', difference ' || (v ->> 'difference')
                  from (select inventory_valuation(test.today()) as v) x),
  '19250 = 19250, difference 0', 'today: beans 880 g (8,800), 99 cups (4,950), 22 waters (5,500), as 1200 holds');
select test.eq((select string_agg((i ->> 'name') || ' ' || (i ->> 'qty') || ' ' || (i ->> 'value'), ', ')
                  from jsonb_array_elements(inventory_valuation(test.today()) -> 'items') i),
  'Golden beans 880 8800, Golden water 22 5500, Golden cup 99 4950', 'item by item, the most valuable first');
select test.eq((select (v ->> 'stock') || ' ' || coalesce(v ->> 'ledger', 'no ledger')
                  from (select inventory_valuation(test.today(), pg_temp.branch()) as v) x),
  '19250 no ledger', 'at the branch: its stock alone, 1200 being the whole café''s');
select test.throws($$select inventory_valuation(test.today() + 1)$$, 'Choose today or a day before it', 'not tomorrow');

-- ------------------------------------------------------------------ what was bought
insert into res select 'R1', receive_goods(
  (select id from supplier where name = 'Kurdistan Coffee Imports'),
  jsonb_build_array(jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 2, 'unit_code', 'kg',
                                       'unit_price', 9000)),
  p_idempotency_key => gen_random_uuid());
insert into res select 'X1', return_to_supplier(
  (select id from supplier where name = 'Kurdistan Coffee Imports'),
  jsonb_build_array(jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 1, 'unit_code', 'kg')),
  'Damp sacks', (pg_temp.r('R1') ->> 'receipt_id')::uuid, null, false, gen_random_uuid());
select test.eq((select string_agg((s ->> 'name') || ': ' || (s ->> 'deliveries') || ' delivery, ' || (s ->> 'received')
                                  || ' received, ' || (s ->> 'returned') || ' back, ' || (s ->> 'net') || ' net', '; ')
                  from jsonb_array_elements(report_purchases(test.today(), test.today()) -> 'suppliers') s),
  'Kurdistan Coffee Imports: 1 delivery, 18000 received, 9000 back, 9000 net', 'by supplier');
select test.eq((select string_agg((i ->> 'name') || ': ' || (i ->> 'qty') || ' ' || (i ->> 'unit') || ' at ' || (i ->> 'unit_cost')
                                  || ', ' || (i ->> 'qty_back') || ' back', '; ')
                  from jsonb_array_elements(report_purchases(test.today(), test.today()) -> 'items') i),
  'Golden beans: 2000 g at 9.0000, 1000 back', 'by item, at what a gram came to');
select test.eq((select (t ->> 'deliveries') || ' ' || (t ->> 'received') || ' ' || (t ->> 'returns') || ' ' || (t ->> 'net')
                  from (select report_purchases(test.today(), test.today()) -> 'total' as t) x),
  '1 18000 1 9000', 'the totals');
select test.eq((report_purchases(test.today() - 1, test.today() - 1) -> 'total' ->> 'deliveries'), '0',
  'nothing the day before');
select test.act_as('cashier@example.com');
select test.throws($$select report_purchases(test.today(), test.today())$$, '%needs cost.view%', 'the cashier reads none');
select test.throws($$select inventory_valuation(test.today())$$, '%needs cost.view%', 'nor the stock''s value');

select test.as_admin();
select test.eq(pg_temp.checks(), (select checks from before), 'the books still tie: the reports change nothing');

-- ------------------------------------------------------------------ a refund from before refunds by the item
-- (0037): it gave back the whole sale, with no lines of its own.
select test.act_as('cashier@example.com');
insert into res select 'S6', record_sale(gen_random_uuid(), 'dine_in', 'card', pg_temp.lines(pg_temp.esp(), 1));
select test.as_admin();
insert into sale_adjustment (business_id, sales_order_id, kind, amount, reason)
values ('00000000-0000-0000-0000-0000000000b1', pg_temp.sale('S6'), 'refund', 2500, 'before 0037');
select test.act_as('owner@example.com');
select test.eq((select (t ->> 'net') || ' ' || (t ->> 'refunded') || ' ' || (t ->> 'kept')
                  from (select pg_temp.an('product') -> 'total' as t) x),
  '19800 5000 14800', 'the old refund takes off its whole sale');
select test.eq((select (x ->> 'refunded') from jsonb_array_elements(pg_temp.an('payment') -> 'rows') x
                 where x ->> 'key' = 'card'), '5000', 'and went back by its sale''s payment');

