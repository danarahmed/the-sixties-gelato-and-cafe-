-- =============================================================================
-- Master data (0027, the audit's P1-1, P1-3 and P1-4): who changed what, with
-- the values before and after; a sale keeps the name it was sold under; names
-- unique among those in use; items, pack units and suppliers corrected, and
-- taken out of use only when nothing needs them; a delivery's price checked
-- against what the item costs now, and each item's price history.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table ids (k text primary key, id uuid);
create temp table sup as select id from supplier
 where business_id = '00000000-0000-0000-0000-0000000000b1' and name = 'Kurdistan Coffee Imports';
grant select, insert on ids, sup to public;
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from ids where k = p $$;
-- An audit row as one line: "{before} → {after} by who (why)".
create or replace function pg_temp.said(a audit_log) returns text language sql as $$
  select coalesce(a.before_state::text, '-') || ' → ' || coalesce(a.after_state::text, '-') || ' by '
         || coalesce((select email::text from app_user where id = a.app_user_id), 'no one')
         || coalesce(' (' || a.reason || ')', '')
$$;

-- ------------------------------------------------------------------- prices
-- Every price set is on the trail, with the price it replaces and who set it.
select test.act_as('owner@example.com');
select set_price('d1000000-0000-0000-0000-000000000001', 'dine_in', 3000);
select test.as_admin();
select test.eq((select pg_temp.said(a) from audit_log a
                 where action = 'price.set' and after_state ->> 'variant' = 'd1000000-0000-0000-0000-000000000001'
                   and after_state ->> 'channel' = 'dine_in' and after_state ->> 'price' = '3000'),
  '{"price": 2500, "channel": "dine_in", "variant": "d1000000-0000-0000-0000-000000000001"} → '
  '{"price": 3000, "channel": "dine_in", "variant": "d1000000-0000-0000-0000-000000000001", "effective_from": "'
  || test.today() || '"} by owner@example.com',
  'a price set: what it was, what it became, from when, and who set it');
select test.eq((select u.email::text from channel_price cp join app_user u on u.id = cp.created_by
                 where cp.product_variant_id = 'd1000000-0000-0000-0000-000000000001' and cp.channel = 'dine_in'
                   and cp.price = 3000),
  'owner@example.com', 'and the price itself says who set it');

-- However it is set: in SQL too, with no person, which is itself worth seeing.
insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
values ('00000000-0000-0000-0000-0000000000b1', 'd1000000-0000-0000-0000-000000000002', 'takeaway', 1500, test.today());
select test.eq((select (after_state ->> 'price') || ' by ' || coalesce(app_user_id::text, 'no one') from audit_log
                 where action = 'price.set' and after_state ->> 'variant' = 'd1000000-0000-0000-0000-000000000002'
                   and after_state ->> 'channel' = 'takeaway'),
  '1500 by no one', 'a price set in SQL is on the trail, with no one against it');
update channel_price set price = 1600
 where product_variant_id = 'd1000000-0000-0000-0000-000000000002' and channel = 'takeaway';
select test.eq((select pg_temp.said(a) from audit_log a where action = 'price.update'),
  '{"price": 1500, "channel": "takeaway", "variant": "d1000000-0000-0000-0000-000000000002"} → '
  '{"price": 1600, "channel": "takeaway", "variant": "d1000000-0000-0000-0000-000000000002"} by no one',
  'as is a price changed in SQL: what changed, and which price it is');

-- A scheduled price withdrawn: on the trail once, with why.
select test.act_as('owner@example.com');
select set_price('d1000000-0000-0000-0000-000000000001', 'talabat', 3500, test.today() + 3);
select test.as_admin();
insert into ids select 'sched', id from channel_price
 where product_variant_id = 'd1000000-0000-0000-0000-000000000001' and channel = 'talabat' and price = 3500;
select test.act_as('owner@example.com');
select cancel_scheduled_price(pg_temp.id('sched'), 'Talabat kept the old price');
select test.as_admin();
select test.eq((select count(*) || ': ' || max(before_state ->> 'price') || ' by ' || max(u.email::text) || ' (' || max(reason) || ')'
                  from audit_log a join app_user u on u.id = a.app_user_id where action = 'price.cancel'),
  '1: 3500 by owner@example.com (Talabat kept the old price)', 'a scheduled price withdrawn: once, with who and why');

-- ------------------------------------------- products, and what a sale is called
-- Each sale keeps the name it was sold under: renaming a product does not relabel history.
select test.act_as('cashier@example.com');
insert into ids select 'sale1', (record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') ->> 'order_id')::uuid;
select test.act_as('owner@example.com');
select set_product_details('d0000000-0000-0000-0000-000000000001', 'Golden ristretto');
select test.act_as('cashier@example.com');
insert into ids select 'sale2', (record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') ->> 'order_id')::uuid;
select test.as_admin();
select test.eq((select string_agg(l.product_name, ' | ' order by o.placed_at)
                  from sales_order_line l join sales_order o on o.id = l.sales_order_id
                 where o.id in (pg_temp.id('sale1'), pg_temp.id('sale2'))),
  'Golden espresso — Single | Golden ristretto — Single',
  'each sale line keeps the product''s name as it was sold');
select test.eq((select pg_temp.said(a) from audit_log a
                 where action = 'product.update' and entity_id = 'd0000000-0000-0000-0000-000000000001'),
  '{"name": "Golden espresso"} → {"name": "Golden ristretto"} by owner@example.com',
  'a product renamed: only what changed, before and after, and who');

-- A new product: the product, what the till sells and each price, all on the trail.
select test.act_as('owner@example.com');
insert into ids select 'mocha', (create_product('Golden mocha', '{"dine_in": 4000, "takeaway": 4500}',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":18,"unit_code":"g"}]') ->> 'product_id')::uuid;
select test.as_admin();
insert into ids select 'mocha_v', id from product_variant where product_id = pg_temp.id('mocha');
select test.eq((select string_agg(action || ' ' || coalesce(after_state ->> 'name', after_state ->> 'price'), ', ' order by action, after_state ->> 'price')
                  from audit_log where entity_id in (pg_temp.id('mocha')::text, pg_temp.id('mocha_v')::text)
                     or after_state ->> 'variant' = pg_temp.id('mocha_v')::text),
  'price.set 4000, price.set 4500, product.create Golden mocha, product_variant.create Golden mocha',
  'a new product, its variant and its prices are on the trail');

-- Names are unique among products in use, ignoring case, spaces and punctuation.
select test.act_as('owner@example.com');
select test.throws($$select create_product('golden  MOCHA.', '{"dine_in": 4000}', p_no_stock_reason => 'a test')$$,
  '%There is already a product called golden  MOCHA.%', 'a second "Golden mocha" is refused');
select test.throws($$select set_product_details('d0000000-0000-0000-0000-000000000002', 'Golden-Mocha')$$,
  '%There is already a product called Golden-Mocha%', 'as is renaming another product to it');
-- Hidden, its name is free again; and it cannot come back while the name is taken.
select set_product_details(pg_temp.id('mocha'), 'Golden mocha', null, false);
select test.as_admin();
select test.eq((select pg_temp.said(a) from audit_log a
                 where action = 'product.update' and entity_id = pg_temp.id('mocha')::text),
  '{"is_active": true} → {"is_active": false} by owner@example.com', 'hiding a product is on the trail');
select test.act_as('owner@example.com');
select test.succeeds($$select create_product('Golden mocha', '{"dine_in": 4500}', p_no_stock_reason => 'a test')$$,
  'a hidden product''s name can be used again');
select test.throws($$select set_product_details(pg_temp.id('mocha'), 'Golden mocha', null, true)$$,
  '%There is already a product called Golden mocha%', 'and the hidden one cannot come back under it');

-- ---------------------------------------------------------------- stock items
select test.act_as('manager@example.com');
select test.throws($$select create_item('golden BEANS', 'ingredient', 'g', 'mass')$$,
  '%There is already an item called golden BEANS%', 'item names are unique too: two "Milk"s split the stock');
insert into ids select 'straw', (create_item('Golden straw', 'packaging', 'each', 'count') ->> 'item_id')::uuid;
select test.as_admin();
select test.eq((select (after_state ->> 'name') || ', ' || (after_state ->> 'base_unit_code') || ' by ' || u.email
                  from audit_log a join app_user u on u.id = a.app_user_id
                 where action = 'item.create' and entity_id = pg_temp.id('straw')::text),
  'Golden straw, each by manager@example.com', 'a new item is on the trail');
select test.throws($$insert into item (business_id, name, item_type, base_unit_code, dimension)
                     values ('00000000-0000-0000-0000-0000000000b1', 'GOLDEN straw', 'packaging', 'each', 'count')$$,
  '%item_name_in_use%', 'and the database itself refuses a duplicate, however it is added');

-- An item corrected: its name, type and levels, with why. Its base unit stays: its history is counted in it.
select test.act_as('cashier@example.com');
select test.throws($$select update_item(pg_temp.id('straw'), 'Golden paper straw', 'packaging')$$,
  '%permission%', 'a cashier cannot change an item');
select test.act_as('manager@example.com');
select test.throws($$select update_item(pg_temp.id('straw'), 'Golden straw', 'packaging', p_min_level => -1)$$,
  '%cannot be negative%', 'levels are not negative');
select test.throws($$select update_item(pg_temp.id('straw'), 'Golden beans', 'packaging')$$,
  '%There is already an item called Golden beans%', 'nor is an item renamed to another''s name');
select update_item(pg_temp.id('straw'), 'Golden paper straw', 'packaging', p_min_level => 50, p_par_level => 200,
                   p_reason => 'paper, not plastic');
select test.as_admin();
select test.eq((select pg_temp.said(a) from audit_log a
                 where action = 'item.update' and entity_id = pg_temp.id('straw')::text),
  '{"name": "Golden straw", "min_level_base": null, "par_level_base": null} → '
  '{"name": "Golden paper straw", "min_level_base": 50, "par_level_base": 200} by manager@example.com (paper, not plastic)',
  'an item corrected: what changed, who, and why');
-- A change that changes nothing adds nothing.
create temp table n_before as select count(*) n from audit_log;
update item set name = name where id = 'c0000000-0000-0000-0000-000000000001';
select test.eq((select count(*) from audit_log), (select n from n_before), 'saving an item unchanged writes nothing');

-- Taken out of use only when nothing needs it: not with stock on the shelf, ...
select test.act_as('manager@example.com');
select test.throws($$select update_item('c0000000-0000-0000-0000-000000000001', 'Golden beans', 'ingredient', p_is_active => false)$$,
  '%Golden beans still has % g in stock%', 'an item with stock stays in use');
-- ... nor while a recipe in force or to come uses it, ...
insert into ids select 'lid', (create_item('Golden lid', 'packaging', 'each', 'count') ->> 'item_id')::uuid;
select test.act_as('owner@example.com');
select change_product_recipe('d1000000-0000-0000-0000-000000000001', jsonb_build_array(
  jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 20, 'unit_code', 'g'),
  jsonb_build_object('item_id', pg_temp.id('lid'), 'qty', 1, 'unit_code', 'each', 'channels', jsonb_build_array('takeaway'))),
  test.today() + 7);
select test.act_as('manager@example.com');
select test.throws($$select update_item(pg_temp.id('lid'), 'Golden lid', 'packaging', p_is_active => false)$$,
  '%Golden lid is in a recipe in force or to come%', 'an item next week''s recipe uses stays in use');
-- ... nor while the till sells it as bought, ...
insert into ids select 'cola', (create_item('Golden cola', 'resale', 'each', 'count') ->> 'item_id')::uuid;
select test.as_admin();
update product_variant set resale_item_id = pg_temp.id('cola') where id = 'd1000000-0000-0000-0000-000000000002';
select test.act_as('manager@example.com');
select test.throws($$select update_item(pg_temp.id('cola'), 'Golden cola', 'resale', p_is_active => false)$$,
  '%Golden cola is sold as bought on the till%', 'an item the till sells as bought stays in use');
-- ... nor while a batch recipe makes it.
select test.act_as('owner@example.com');
create temp table batch as select save_batch_recipe(null, 'Golden gelato base', '{"measure":"weight"}', 2, 'kg',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":100,"unit_code":"g"}]') r;
insert into ids select 'base', (r ->> 'item_id')::uuid from batch;
insert into ids select 'base_recipe', (r ->> 'recipe_id')::uuid from batch;
select test.throws($$select update_item(pg_temp.id('base'), 'Golden gelato base', 'finished_good', p_is_active => false)$$,
  '%Golden gelato base is what a batch recipe makes%', 'an item a batch recipe makes stays in use');
-- Nothing needs the straws: out of use, and their name is free again.
select test.act_as('manager@example.com');
select update_item(pg_temp.id('straw'), 'Golden paper straw', 'packaging', p_min_level => 50, p_par_level => 200,
                   p_is_active => false, p_reason => 'we stopped using straws');
select test.succeeds($$select create_item('Golden paper straw', 'packaging', 'each', 'count')$$,
  'an item out of use gives up its name');
select test.throws($$select update_item(pg_temp.id('straw'), 'Golden paper straw', 'packaging', p_is_active => true)$$,
  '%There is already an item called Golden paper straw%', 'so it cannot come back under it');
select test.throws(format($$select receive_goods((select id from sup), '[{"item_id":"%s","qty":10,"unit_price":5}]')$$,
                          pg_temp.id('straw')),
  '%Golden paper straw is out of use: bring it back into use first%', 'nothing more is received of an item out of use');
select test.as_admin();
select test.eq((select pg_temp.said(a) from audit_log a where action = 'item.update'
                   and entity_id = pg_temp.id('straw')::text order by id desc limit 1),
  '{"is_active": true} → {"is_active": false} by manager@example.com (we stopped using straws)',
  'taking an item out of use is on the trail, with why');

-- ------------------------------------------------------------------ batch recipes
-- A batch recipe made and changed: on the trail, with its ingredients before and after.
select test.eq((select pg_temp.said(a) from audit_log a where action = 'recipe.batch.create'),
  '- → {"name": "Golden gelato base", "unit": "kg", "lines": [{"qty": 100, "item": "Golden beans", "unit": "g"}], '
  '"yield": 2000, "is_active": true} by owner@example.com', 'a batch recipe made is on the trail');
select test.act_as('owner@example.com');
select save_batch_recipe(pg_temp.id('base_recipe'), 'Golden gelato base', null,
  2, 'kg', '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":150,"unit_code":"g"}]');
select test.as_admin();
select test.eq((select (before_state -> 'lines' -> 0 ->> 'qty') || ' g → ' || (after_state -> 'lines' -> 0 ->> 'qty') || ' g'
                  from audit_log where action = 'recipe.batch.change'),
  '100 g → 150 g', 'and changed, with the ingredients before and after');
-- The older recipe change, which bypassed the audit trail, is retired.
select test.ok(not has_function_privilege('authenticated', 'new_recipe_version(uuid, jsonb, date)', 'execute'),
  'no one signed in can call the older recipe change');

-- ---------------------------------------------------------------- pack units
-- A pack size added; a unit in use keeps its size: a new size is a new unit.
select test.act_as('cashier@example.com');
select test.throws($$select add_item_unit('c0000000-0000-0000-0000-000000000002', 'case_1000', 'Case of 1,000', 1000)$$,
  '%permission%', 'a cashier cannot add a unit');
select test.act_as('manager@example.com');
select add_item_unit('c0000000-0000-0000-0000-000000000002', 'case_1000', 'Case of 1,000', 1000);
select test.throws($$select add_item_unit('c0000000-0000-0000-0000-000000000002', 'SLEEVE_50', 'Sleeve', 40)$$,
  '%Golden cup already has a unit called SLEEVE_50: a unit in use keeps its size%',
  'a sleeve is 50 cups for good: 40 would re-count every sleeve already received');
select test.throws($$select add_item_unit('c0000000-0000-0000-0000-000000000002', 'each', 'Each', 2)$$,
  '%already has a unit called each%', 'nor is the base unit redefined');
select test.throws($$select add_item_unit('c0000000-0000-0000-0000-000000000002', 'box', 'Box', 0)$$,
  '%Say how many items one box holds%', 'a unit holds something');
insert into ids select 'cream', (create_item('Golden cream', 'ingredient', 'ml', 'volume') ->> 'item_id')::uuid;
select test.throws($$select add_item_unit(pg_temp.id('cream'), 'L', 'Litre', 100)$$,
  '%One L is 1000 ml%', 'a litre is a litre');
select add_item_unit(pg_temp.id('cream'), 'L', 'Litre', 1000);
select test.as_admin();
select test.eq((select (after_state ->> 'code') || ' = ' || (after_state ->> 'factor_to_base') || ' by ' || u.email
                  from audit_log a join app_user u on u.id = a.app_user_id
                 where action = 'item_unit.create' and after_state ->> 'item_id' = 'c0000000-0000-0000-0000-000000000002'
                   and after_state ->> 'code' = 'case_1000'),
  'case_1000 = 1000 by manager@example.com', 'a unit added is on the trail');
-- Received by the case: 1 case is 1,000 cups.
select test.act_as('manager@example.com');
create temp table rc as select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":1,"unit_code":"case_1000","unit_price":50000}]') r;
grant select on rc to public;
select test.as_admin();
select test.eq((select trim_scale(base_quantity_signed) || ' cups at ' || trim_scale(unit_cost) from inventory_movement
                 where reference_id = (select (r ->> 'receipt_id')::uuid from rc)),
  '1000 cups at 50', 'a case received is 1,000 cups');

-- ------------------------------------------------------------- deliveries (P1-3)
-- A price per unit, times the quantity; the landed cost shares out the freight.
select test.act_as('manager@example.com');
create temp table rb as select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":2,"unit_code":"kg","unit_price":9000}]', 2000) r;
grant select on rb to public;
select test.eq((select (r ->> 'value')::numeric from rb), 20000::numeric, '2 kg at 9,000 a kg, and 2,000 freight');
-- 2.5 or 50? A price far from the item's cost now is asked about before the stock is costed.
create temp table receipts_before as select count(*) n from goods_receipt;
grant select on receipts_before to public;
select test.throws($$select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":1000,"unit_price":2.5}]')$$,
  'Check the price: Golden cup at 2.5 each is 95% below its cost now (50 each). If it is right, confirm it and receive again',
  'cups at 2.5 each when they cost 50: asked before anything is recorded');
select test.throws($$select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1,"unit_code":"kg","goods_value":10000},
    {"item_id":"c0000000-0000-0000-0000-000000000002","qty":100,"goods_value":10000}]')$$,
  'Check the price: Golden cup at 100 each is 100% above its cost now (50 each). If it is right, confirm it and receive again',
  'only the line that is off is named');
select test.eq((select count(*) from goods_receipt), (select n from receipts_before), 'nothing was received');
-- Confirmed, it is received, and the confirmation is on the trail.
create temp table rconf as select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":1000,"unit_price":2.5}]', p_confirm => true) r;
grant select on rconf to public;
select test.as_admin();
select test.eq((select pg_temp.said(a) from audit_log a where action = 'purchase.price_confirmed'),
  '- → {"receipt_no": ' || (select r ->> 'receipt_no' from rconf) || '} by manager@example.com '
  '(Golden cup at 2.5 each is 95% below its cost now (50 each))',
  'a price confirmed: who confirmed it, and what they were told');
-- With none on the shelf, the check is against the last delivery.
select test.act_as('manager@example.com');
select receive_goods((select id from sup), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id('cream'), 'qty', 2, 'unit_code', 'L', 'unit_price', 5000)));
select record_waste(pg_temp.id('cream'), 2, 'L', 'spoilage', 'soured');
select test.throws(format($$select receive_goods((select id from sup),
  '[{"item_id":"%s","qty":1,"unit_code":"L","unit_price":15000}]')$$, pg_temp.id('cream')),
  '%Golden cream at 15 a ml is 200% above its cost now (5 a ml)%', 'none on the shelf: checked against its last delivery');
-- A line needs a price, one way or the other.
select test.throws($$select receive_goods((select id from sup), '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1}]')$$,
  '%Every received line needs a price%', 'a line with no price is refused');

-- Each item's price history, delivery by delivery, newest first.
select test.act_as('cashier@example.com');
select test.throws($$select * from item_price_history('c0000000-0000-0000-0000-000000000001')$$, '%permission%',
  'a cashier is not shown what things cost');
select test.act_as('manager@example.com');
select test.eq((select string_agg(supplier || ': ' || trim_scale(qty) || ' ' || unit || ' for ' || goods_value || ', '
                                  || trim_scale(cost_per_base) || ' a g, ' || trim_scale(landed_per_base) || ' landed', ' | '
                                  order by receipt_no desc)
                  from item_price_history('c0000000-0000-0000-0000-000000000001')),
  'Kurdistan Coffee Imports: 2 kg for 18000, 9 a g, 10 landed', 'the beans'' deliveries, with what each cost a gram');
select test.eq((select string_agg(trim_scale(cost_per_base)::text, ' then ' order by receipt_no desc)
                  from item_price_history('c0000000-0000-0000-0000-000000000002')),
  '2.5 then 50', 'the cups: 2.5 each most recently, 50 before');

-- ------------------------------------------------------------------ suppliers
select test.act_as('manager@example.com');
select test.throws($$select create_supplier('kurdistan coffee imports.')$$,
  '%There is already a supplier called kurdistan coffee imports.%',
  'supplier names are unique: "Dairy Co" and "Dairy Co." are one supplier, billed once');
insert into ids select 'farm', create_supplier('Golden Farm', 'Hama', '0750 000 0000');
select test.throws($$select update_supplier(pg_temp.id('farm'), 'Kurdistan Coffee Imports')$$,
  '%There is already a supplier called Kurdistan Coffee Imports%', 'nor is a supplier renamed to another''s name');
select update_supplier(pg_temp.id('farm'), 'Golden Farms Ltd', 'Hama', '0750 111 1111', p_reason => 'their registered name');
select test.as_admin();
select test.eq((select pg_temp.said(a) from audit_log a where action = 'supplier.update'),
  '{"name": "Golden Farm", "phone": "0750 000 0000"} → {"name": "Golden Farms Ltd", "phone": "0750 111 1111"} '
  'by manager@example.com (their registered name)', 'a supplier corrected: what changed, who, and why');
-- Not taken out of use while they are owed money.
select test.act_as('manager@example.com');
create temp table rf as select receive_goods(pg_temp.id('farm'), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id('cream'), 'qty', 2, 'unit_code', 'L', 'unit_price', 5000))) r;
create temp table bf as select record_bill(pg_temp.id('farm'), 'GF-1', test.today(), 10000, 0,
  (select (r ->> 'receipt_id')::uuid from rf)) r;
grant select on rf, bf to public;
select test.throws($$select update_supplier(pg_temp.id('farm'), 'Golden Farms Ltd', p_is_active => false)$$,
  '%Golden Farms Ltd is still owed 10000%', 'a supplier who is owed stays in use');
select test.act_as('owner@example.com');
select pay_bill((select (r ->> 'bill_id')::uuid from bf), 10000, 'bank');
select test.act_as('manager@example.com');
select update_supplier(pg_temp.id('farm'), 'Golden Farms Ltd', 'Hama', '0750 111 1111', false, 'no longer delivers');
select test.throws($$select receive_goods(pg_temp.id('farm'), '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1}]')$$,
  '%Choose an active supplier%', 'paid up, they are out of use: nothing more is received from them');

-- ------------------------------------------------- settings, places, categories
-- A business setting, a location or a category: changed in SQL or on a screen, it is on the trail.
select test.as_admin();
update business set discount_round_to = 250 where id = '00000000-0000-0000-0000-0000000000b1';
select test.eq((select pg_temp.said(a) from audit_log a where action = 'business.update' and after_state ? 'discount_round_to'),
  '{"discount_round_to": 500} → {"discount_round_to": 250} by no one', 'a setting changed in SQL, by no one signed in');
update location set name = 'Golden branch'
 where business_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'branch';
select test.eq((select after_state ->> 'name' from audit_log where action = 'location.update' order by id desc limit 1),
  'Golden branch',
  'a location renamed');
select test.act_as('owner@example.com');
insert into ids select 'cakes', save_category(null, 'Golden cakes', null, null, 5, true);
select test.as_admin();
select test.eq((select (after_state ->> 'name') || ' by ' || u.email from audit_log a join app_user u on u.id = a.app_user_id
                 where action = 'product_category.create' and entity_id = pg_temp.id('cakes')::text),
  'Golden cakes by owner@example.com', 'a category added on the Products screen');
-- Deleted in SQL: what was there, on the trail.
delete from product_category where id = pg_temp.id('cakes');
select test.eq((select (before_state ->> 'name') || ' deleted by ' || coalesce(app_user_id::text, 'no one') from audit_log
                 where action = 'product_category.delete'),
  'Golden cakes deleted by no one', 'a record deleted in SQL leaves what it was');

