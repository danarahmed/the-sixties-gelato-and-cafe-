-- =============================================================================
-- 0025: the recipe and price in force (P1-5), a printed bill paid at its
-- printed prices (P1-7), and sales costed at nothing (P1-6).
-- Golden catalogue: espresso (variant d1..01, recipe d2..01) 2,500 dine-in,
-- 20 g of beans at 10 IQD/g.
-- =============================================================================
select test.golden_catalogue();
create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
create function pg_temp.recipe_on(d date) returns text language sql security definer as $$
  select string_agg(i.name || ' ' || trim_scale(rl.quantity), ', ' order by i.name)
    from recipe_line rl join item i on i.id = rl.item_id
   where rl.recipe_version_id = recipe_version_on('d2000000-0000-0000-0000-000000000001', d)
$$;
create function pg_temp.lines(p_qty int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p_qty))
$$;

-- --------------------------------------------------- P1-5: the recipe in force
-- Next week's change is scheduled first; then today's recipe is changed.
select test.act_as('owner@example.com');
select change_product_recipe('d1000000-0000-0000-0000-000000000001',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":22,"unit_code":"g"}]', test.today() + 7);
select change_product_recipe('d1000000-0000-0000-0000-000000000001',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":18,"unit_code":"g"}]', test.today());
select test.eq(pg_temp.recipe_on(test.today()), 'Golden beans 18', 'today''s change is in force today');
select test.eq(pg_temp.recipe_on(test.today() + 6), 'Golden beans 18', 'up to the day before the scheduled change');
select test.eq(pg_temp.recipe_on(test.today() + 7), 'Golden beans 22',
  'and the change scheduled for next week still takes over on its date (it used to stay hidden for ever)');
select test.eq(pg_temp.recipe_on(test.today() + 90), 'Golden beans 22', 'and stays');
select test.as_admin();
select test.eq((select effective_to from recipe_version
                 where recipe_id = 'd2000000-0000-0000-0000-000000000001' and effective_from = test.today()
                 order by version_no desc limit 1), test.today() + 6,
  'today''s version ends the day before the one scheduled after it');

-- A second change for the same date replaces the first; the list shows one.
select test.act_as('owner@example.com');
select change_product_recipe('d1000000-0000-0000-0000-000000000001',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":24,"unit_code":"g"}]', test.today() + 7);
select test.eq(pg_temp.recipe_on(test.today() + 7), 'Golden beans 24', 'a second change for the same date replaces the first');
select test.eq((select string_agg(kind || ' ' || (effective_from - test.today()), ',') from menu_scheduled()), 'recipe 7',
  'the scheduled changes list shows the one that will happen');

-- A scheduled recipe can be withdrawn, with a reason; today's carries on.
select test.throws($$select cancel_scheduled_recipe((select id from menu_scheduled() where kind = 'recipe'), ' ')$$,
  '%Say why%', 'withdrawing a change needs a reason');
select cancel_scheduled_recipe((select id from menu_scheduled() where kind = 'recipe'), 'changed our mind');
select test.eq(pg_temp.recipe_on(test.today() + 7), 'Golden beans 18', 'withdrawn: today''s recipe carries on');
select test.eq(pg_temp.recipe_on(test.today() + 400), 'Golden beans 18', 'for good');
select test.eq((select count(*) from menu_scheduled())::int, 0, 'nothing is left scheduled');
select test.as_admin();
create temp table in_force as select recipe_version_on('d2000000-0000-0000-0000-000000000001', test.today()) id;
grant select on in_force to public;
select test.ok(exists (select 1 from audit_log where action = 'recipe.cancel' and jsonb_array_length(before_state -> 'lines') = 1),
  'the withdrawn recipe is on the audit trail, lines and all');
select test.act_as('owner@example.com');
select test.throws($$select cancel_scheduled_recipe((select id from in_force), 'x')$$, '%already in force%',
  'a recipe already in force is not withdrawn: it is changed');

-- ------------------------------------------------------------ P1-5: prices
select test.throws($$select set_price('d1000000-0000-0000-0000-000000000001', 'dine_in', 2000, test.today() - 1)$$,
  '%cannot start in the past%', 'a price cannot be dated in the past');
select set_price('d1000000-0000-0000-0000-000000000001', 'dine_in', 2800, test.today() + 3);
select test.eq((select string_agg(kind || ' ' || trim_scale(price), ',') from menu_scheduled()), 'price 2800',
  'a price set for a later date is listed as scheduled');
select test.act_as('manager@example.com');
select test.throws($$select cancel_scheduled_price((select id from menu_scheduled() where kind = 'price'), 'x')$$,
  '%permission%', 'only those who edit the menu withdraw a change');
select test.act_as('owner@example.com');
select cancel_scheduled_price((select id from menu_scheduled() where kind = 'price'), 'typed the wrong price');
select test.as_admin();
select test.eq(price_on('d1000000-0000-0000-0000-000000000001', 'dine_in', null, test.today() + 3), 2500::numeric,
  'withdrawn: the price stays 2,500');
select test.ok(exists (select 1 from audit_log where action = 'price.set' and (before_state ->> 'price')::numeric = 2500
                                               and (after_state ->> 'price')::numeric = 2800),
  'setting a price is on the audit trail, with the price before it');
select test.ok(exists (select 1 from audit_log where action = 'price.cancel' and reason = 'typed the wrong price'),
  'and so is withdrawing one');
create temp table todays_price as
  select id from channel_price where product_variant_id = 'd1000000-0000-0000-0000-000000000001' and channel = 'dine_in'
   order by effective_from desc limit 1;
grant select on todays_price to public;
select test.act_as('owner@example.com');
select test.throws($$select cancel_scheduled_price((select id from todays_price), 'x')$$, '%already in force%',
  'a price in force is not withdrawn: a new one is set');

-- ------------------------------------------------ P1-7: printed bills and totals
-- Two espressos on a bill, printed at 2,500; then the price goes up to 3,000.
select test.act_as('cashier@example.com');
insert into ids select 'bill', (open_tab('dine_in', null, 'Printed bill', null, pg_temp.lines(2)) ->> 'tab_id')::uuid;
select mark_bill_printed(pg_temp.id('bill'), 2);
select test.act_as('owner@example.com');
select set_price('d1000000-0000-0000-0000-000000000001', 'dine_in', 3000);
select test.act_as('cashier@example.com');
select test.eq((select total from pos_open_bills() where tab_id = pg_temp.id('bill')), 5000::numeric,
  'the printed bill still shows what the customer was shown: 2 × 2,500');
-- A third espresso added after printing is charged like the two printed.
select save_tab(pg_temp.id('bill'), 2, pg_temp.lines(3));
select test.eq((select total from pos_open_bills() where tab_id = pg_temp.id('bill')), 7500::numeric,
  'one more of the same, added after printing, at the printed price');
create temp table pb as select settle_tab(pg_temp.id('bill'), 3, gen_random_uuid(), 'cash', 7500) r;
grant select on pb to public;
select test.eq((select (r ->> 'net')::numeric from pb), 7500::numeric,
  'paid at the printed prices, not today''s 3,000 (the books record what the customer paid)');

-- An unprinted bill is paid at today's price; a till still showing the old one is stopped.
insert into ids select 'plain', (open_tab('dine_in', null, 'Unprinted bill', null, pg_temp.lines(1)) ->> 'tab_id')::uuid;
select test.throws(format('select settle_tab(%L, 2, gen_random_uuid(), %L, 2500)', pg_temp.id('plain'), 'cash'),
  '%The total is 3000 now, not the 2500 shown%', 'an unprinted bill is paid at today''s price, and a till showing another is stopped');
select test.eq((settle_tab(pg_temp.id('plain'), 2, gen_random_uuid(), 'cash', 3000) ->> 'net')::numeric, 3000::numeric,
  'shown the right total, it is paid');

-- A quick sale from a till with an old menu is stopped before the customer pays the wrong amount.
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.lines(1), p_expected_net => 2500)$$,
  '%The total is 3000 now, not the 2500 shown%', 'a quick sale at an old price is refused, and nothing is recorded');
select record_sale('30000000-0000-0000-0000-000000000001', 'dine_in', 'cash', pg_temp.lines(1), p_expected_net => 3000);
select test.eq((record_sale('30000000-0000-0000-0000-000000000001', 'dine_in', 'cash', pg_temp.lines(1),
                            p_expected_net => 2500) ->> 'replayed')::boolean, true,
  'a retried sale is returned as it was recorded, whatever the till shows now');
select test.succeeds($$select record_sale(gen_random_uuid(), 'dine_in', 'card', pg_temp.lines(1))$$,
  'a till that says nothing about the total is served as before');

-- A printed line moved to a bill of its own keeps its printed price.
insert into ids select 'split', (open_tab('dine_in', null, 'Split bill', null, pg_temp.lines(2)) ->> 'tab_id')::uuid;
select mark_bill_printed(pg_temp.id('split'), 2);
select test.act_as('owner@example.com');
select set_price('d1000000-0000-0000-0000-000000000001', 'dine_in', 3500);
select test.act_as('cashier@example.com');
insert into ids select 'part', (split_tab(pg_temp.id('split'), 2,
  jsonb_build_array(jsonb_build_object('line_id', (select id from pos_tab_line where tab_id = pg_temp.id('split')), 'qty', 1)))
  ->> 'tab_id')::uuid;
select test.eq((select string_agg(trim_scale(total)::text, ',' order by label, opened_at) from pos_open_bills()
                 where tab_id in (pg_temp.id('split'), pg_temp.id('part'))), '3000,3000',
  'both parts of a split bill keep the printed 3,000, not today''s 3,500');

-- ------------------------------------------------ P1-6: sales costed at nothing
select test.act_as('owner@example.com');
select test.throws($$select create_product('Tap water', '{"dine_in": 500}')$$, '%say why it uses no stock%',
  'a new product lists what it uses, or says why it uses no stock');
insert into ids select 'svc', (create_product('Service charge', '{"dine_in": 1000}',
  p_no_stock_reason => 'a charge, not a product') ->> 'variant_id')::uuid;
insert into ids select 'syrup', (create_item('Golden vanilla syrup', 'ingredient', 'ml', 'volume') ->> 'item_id')::uuid;
insert into ids select 'salt', (create_item('Sea salt', 'ingredient', 'g', 'mass', p_opening_qty => 100,
                                            p_opening_unit_cost => 0.2, p_opening_reason => 'the opening count')
                                ->> 'item_id')::uuid;
insert into ids select 'vl', (create_product('Golden vanilla latte', '{"dine_in": 4000}', jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id('syrup'), 'qty', 20, 'unit_code', 'ml'),
  jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 20, 'unit_code', 'g'))) ->> 'variant_id')::uuid;
insert into ids select 'salted', (create_product('Salted espresso', '{"dine_in": 3000}', jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id('salt'), 'qty', 1, 'unit_code', 'g'),
  jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 20, 'unit_code', 'g'))) ->> 'variant_id')::uuid;
-- A product made before 0025 with no recipe.
select test.as_admin();
insert into product (id, business_id, name) values ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'Old tea');
insert into product_variant (id, product_id, name) values ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Old tea');
insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
values ('00000000-0000-0000-0000-0000000000b1', 'e1000000-0000-0000-0000-000000000001', 'dine_in', 1500, '2020-01-01');
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', jsonb_build_array(jsonb_build_object('variant_id', pg_temp.id('svc'), 'qty', 1)));
select record_sale(gen_random_uuid(), 'dine_in', 'cash', jsonb_build_array(jsonb_build_object('variant_id', pg_temp.id('vl'), 'qty', 1)));
select record_sale(gen_random_uuid(), 'dine_in', 'cash', jsonb_build_array(jsonb_build_object('variant_id', pg_temp.id('salted'), 'qty', 1)));
select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"e1000000-0000-0000-0000-000000000001","qty":1}]');
select test.throws($$select * from report_uncosted_sales(test.today(), test.today())$$, '%permission%',
  'a cashier is not shown costs');
select test.act_as('manager@example.com');
select test.eq((select string_agg(products || ': ' || reasons, ' | ' order by placed_at) from report_uncosted_sales(test.today(), test.today())),
  'Golden vanilla latte: Used before it had a cost: Golden vanilla syrup | Old tea: Costed at nothing: Old tea',
  'listed: the syrup used before it had any cost, and the old product with no recipe; not the service charge, nor the salt whose share rounds to nothing');
select test.act_as('owner@example.com');
create temp table cl as select * from period_close_checklist(
  (select id from accounting_period where business_id = '00000000-0000-0000-0000-0000000000b1'
      and test.today() between starts_on and ends_on));
select test.eq((select ok::text || ' ' || blocks::text from cl where check_key = 'uncosted'), 'false false',
  'the month-end checklist warns of them, without stopping the lock');
select test.ok((select bool_and(blocks) from cl where check_key <> 'uncosted'), 'every other check still blocks');

-- Marked as using no stock, with a reason, the old product is no longer listed.
select test.act_as('owner@example.com');
select test.throws($$select set_no_stock('d1000000-0000-0000-0000-000000000001', 'x')$$, '%has a recipe in force%',
  'a product with a recipe takes its stock through it');
select set_no_stock('e1000000-0000-0000-0000-000000000001', 'loose tea the owner brings in');
select test.act_as('manager@example.com');
select test.eq((select count(*) from report_uncosted_sales(test.today(), test.today()) where products like '%Old tea%')::int, 0,
  'once it says why it uses no stock, it is not listed');
select test.as_admin();
select test.ok(exists (select 1 from audit_log where action = 'product.no_stock' and reason = 'loose tea the owner brings in'),
  'and that is on the audit trail');
-- Given a recipe, a product no longer "uses no stock".
select test.act_as('owner@example.com');
select change_product_recipe('e1000000-0000-0000-0000-000000000001',
  '[{"item_id":"c0000000-0000-0000-0000-000000000003","qty":1}]');
select test.as_admin();
select test.eq((select no_stock_reason from product_variant where id = 'e1000000-0000-0000-0000-000000000001'), null::text,
  'a product given a recipe takes its stock through it');
select test.eq((select sum(value * sign(base_quantity_signed)) from inventory_movement where business_id = '00000000-0000-0000-0000-0000000000b1'),
  test.balance('1200'), 'the stock ledger still reconciles to 1200');
