-- =============================================================================
-- Production: what the café makes in batches, both ways of working — a base
-- made first and flavoured, and a flavour straight from its ingredients — the
-- batch's ingredients out at their average cost and what came out in at
-- exactly that cost, in any unit or as the recipe says; a made item sold in a
-- product; a batch cancelled; and a product's recipe changed from a date.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
-- A barista, who makes the gelato.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000e', 'barista@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000000e');
insert into user_role (app_user_id, role) select id, 'barista' from app_user where email = 'barista@example.com';

-- Ingredients, with opening stock: milk at 1.5 a ml, sugar at 1.2 a g, paste at 30 a g.
select test.act_as('owner@example.com');
select create_item('Golden milk', 'ingredient', 'ml', 'volume', p_units => '[{"code":"L","label":"L","factor":1000}]',
  p_opening_qty => 20000, p_opening_unit_cost => 1.5, p_opening_reason => 'the opening count');
select create_item('Golden sugar', 'ingredient', 'g', 'mass', p_units => '[{"code":"kg","label":"kg","factor":1000}]',
  p_opening_qty => 10000, p_opening_unit_cost => 1.2, p_opening_reason => 'the opening count');
select create_item('Golden paste', 'ingredient', 'g', 'mass', p_opening_qty => 2000, p_opening_unit_cost => 30,
  p_opening_reason => 'the opening count');
select test.as_admin();
create temp table ids as
select (select id from item where name = 'Golden milk') milk, (select id from item where name = 'Golden sugar') sugar,
       (select id from item where name = 'Golden paste') paste;
create temp table journals_before as select count(*) n from journal_entry;
grant select on ids, journals_before to public;

-- ------------------------------------------------------------------ recipes
-- Only those who edit recipes set up what is made.
select test.act_as('barista@example.com');
select test.throws($$select save_batch_recipe(null, 'Golden base', '{"measure":"volume"}', 5, 'L',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 4, 'unit_code', 'L')))$$,
  '%permission%', 'a barista cannot set up a batch recipe');

-- A base, measured by volume: 5 L a batch, from 4 L of milk and 800 g of sugar.
select test.act_as('owner@example.com');
create temp table base as select save_batch_recipe(null, 'Golden base', '{"measure":"volume"}', 5, 'L',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 4, 'unit_code', 'L'),
                    jsonb_build_object('item_id', (select sugar from ids), 'qty', 800, 'unit_code', 'g')),
  'Heat to 85°C, cool overnight') r;
-- Pistachio gelato, weighed, kept in pans of 5 kg: one pan a batch, from 4.5 L of the base and 500 g of paste.
create temp table pist as select save_batch_recipe(null, 'Golden pistachio gelato',
  '{"measure":"weight","container":"Pan","container_qty":5,"container_unit":"kg"}', 1, 'pan',
  jsonb_build_array(jsonb_build_object('item_id', (select (r->>'item_id')::uuid from base), 'qty', 4.5, 'unit_code', 'L'),
                    jsonb_build_object('item_id', (select paste from ids), 'qty', 500, 'unit_code', 'g'))) r;
grant select on base, pist to public;
select test.as_admin();
select test.eq((select item_type::text || '/' || base_unit_code || '/' || dimension::text from item
                 where id = (select (r->>'item_id')::uuid from base)), 'finished_good/ml/volume',
  'the base is a new item, made here, measured in ml');
select test.eq((select string_agg(code || '=' || trim_scale(factor_to_base), ',' order by code) from item_unit
                 where item_id = (select (r->>'item_id')::uuid from pist)), 'kg=1000,pan=5000',
  'the gelato is weighed in g and kg, and kept in pans of 5 kg');
select test.eq((select batch_yield_base || ' ' || batch_yield_unit from recipe where id = (select (r->>'recipe_id')::uuid from pist)),
  '5000 pan', 'one batch makes one pan: 5,000 g');
select test.act_as('barista@example.com');
select test.eq((select jsonb_array_length(lines) || ' lines, ' || trim_scale(yield_base) || ' ' || yield_unit
                  from production_recipes() where name = 'Golden base'), '2 lines, 5000 L',
  'the barista sees what goes into a batch');
select test.eq((select string_agg((l->>'name') || ' ' || (l->>'base_qty'), ', ' order by l->>'name')
                  from production_recipes() p, jsonb_array_elements(p.lines) l where p.name = 'Golden base'),
  'Golden milk 4000, Golden sugar 800', 'with each ingredient in its base unit');

select test.act_as('owner@example.com');
select test.throws($$select save_batch_recipe(null, 'Golden paste', '{"measure":"weight"}', 1, 'g',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 1)))$$,
  '%already keep an item called Golden paste%', 'no second item of the same name');
select test.throws($$select save_batch_recipe(null, 'Golden syrup', '{"measure":"volume","container":"kg","container_qty":1}',
  1, 'L', jsonb_build_array(jsonb_build_object('item_id', (select sugar from ids), 'qty', 1)))$$,
  '%already a unit%', 'a container is not named like a unit');
select test.throws($$select save_batch_recipe((select (r->>'recipe_id')::uuid from base), 'Golden base', null, 5, 'L',
  jsonb_build_array(jsonb_build_object('item_id', (select (r->>'item_id')::uuid from base), 'qty', 1, 'unit_code', 'L')))$$,
  '%cannot use what it makes%', 'a batch cannot use what it makes');
select test.throws($$select save_batch_recipe(null, 'Golden foam', '{"measure":"volume"}', 0, 'L',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 1)))$$,
  '%how much one batch makes%', 'a batch makes something');
select test.throws($$select save_batch_recipe(null, 'Golden foam', '{"measure":"volume"}', 1, 'L', '[]')$$,
  '%what goes into it%', 'and is made from something');

-- ------------------------------------------------------------------ batches
select test.act_as('cashier@example.com');
select test.throws($$select record_production((select (r->>'recipe_id')::uuid from base), 1)$$,
  '%permission%', 'a cashier records no batches');
select test.throws($$select * from production_batches()$$, '%permission%', 'nor sees them');

-- Two batches of base, as the recipe says: 8 L of milk (12,000) and 1.6 kg of sugar (1,920) make 10 L.
select test.act_as('barista@example.com');
create temp table b1 as select record_production((select (r->>'recipe_id')::uuid from base), 2) r;
grant select on b1 to public;
select test.ok(not (select r ? 'value' from b1), 'the barista is not shown what the batch cost');
select test.eq((select (r->>'actual')::numeric from b1), 10000::numeric, 'what came out: as the recipe says');

-- One batch of pistachio gelato, weighed at 4.6 kg (a pan was planned): 4.5 L of base at
-- 1.392 a ml (6,264) and 500 g of paste (15,000).
select test.act_as('manager@example.com');
create temp table b2 as select record_production((select (r->>'recipe_id')::uuid from pist), 1, 4.6, 'kg',
  'a little short') r;
grant select on b2 to public;
select test.eq((select (r->>'value')::numeric from b2), 21264::numeric, 'a manager is shown the batch''s cost');

select test.as_admin();
select test.eq((select string_agg(i.name || ' ' || trim_scale(m.base_quantity_signed) || ' = ' || m.value, '; '
                                  order by m.base_quantity_signed, i.name)
                  from inventory_movement m join item i on i.id = m.item_id
                 where m.reference_type = 'production_batch' and m.reference_id = (select (r->>'batch_id')::uuid from b1)),
  'Golden milk -8000 = 12000; Golden sugar -1600 = 1920; Golden base 10000 = 13920',
  'the ingredients out at their average cost, the base in at exactly their sum');
select test.eq((select string_agg(i.name || ' ' || trim_scale(m.base_quantity_signed) || ' = ' || m.value, '; '
                                  order by m.base_quantity_signed, i.name)
                  from inventory_movement m join item i on i.id = m.item_id
                 where m.reference_type = 'production_batch' and m.reference_id = (select (r->>'batch_id')::uuid from b2)),
  'Golden base -4500 = 6264; Golden paste -500 = 15000; Golden pistachio gelato 4600 = 21264',
  'the gelato is made from the base at the base''s own cost');
select test.eq((select trim_scale(planned_yield_base) || ' planned, ' || trim_scale(actual_yield_base) || ' came out, in '
                       || output_unit_code || ', ' || quality_note
                  from production_batch where id = (select (r->>'batch_id')::uuid from b2)),
  '5000 planned, 4600 came out, in kg, a little short', 'the batch keeps what was planned and what came out');
select test.eq(item_issue_cost('00000000-0000-0000-0000-0000000000b1',
                               (select (r->>'item_id')::uuid from pist), default_location('00000000-0000-0000-0000-0000000000b1')),
  21264::numeric / 4600, 'a gram of the gelato costs what the batch cost, over what came out');
select test.eq((select count(*) from journal_entry) - (select n from journals_before), 0::bigint,
  'value only moves inside Inventory: no journal');
select test.act_as('manager@example.com');
select test.eq((select difference from report_reconciliation(test.today()) where check_key = 'inventory'), 0::numeric,
  'and the stock ledger still agrees with Inventory (1200)');

select test.act_as('barista@example.com');
select test.eq((select count(*) || ' batches, ' || count(value) || ' costs' from production_batches()), '2 batches, 0 costs',
  'the barista sees the batches, without their cost');
select test.act_as('manager@example.com');
select test.eq((select value from production_batches() where recipe_name = 'Golden pistachio gelato'), 21264::numeric,
  'a manager sees their cost');
select test.eq((select entered_unit || ' ' || made_by from production_batches() where recipe_name = 'Golden pistachio gelato'),
  'kg Demo Manager', 'and who made it, in the unit it was weighed in');

select test.throws($$select record_production((select (r->>'recipe_id')::uuid from base), 0)$$,
  '%how many batches%', 'a batch count above zero');
select test.throws($$select record_production((select (r->>'recipe_id')::uuid from base), 1, 0, 'L')$$,
  '%what came out%', 'something came out');
select test.throws($$select record_production((select (r->>'recipe_id')::uuid from base), 1, 2, 'tray')$$,
  '%not defined for this item%', 'in one of the item''s units');
select test.throws($$select record_production('d2000000-0000-0000-0000-000000000001', 1)$$,
  '%Choose what was made%', 'a product''s recipe is not a batch recipe');

-- A recipe no longer made is hidden, and cannot be recorded until shown again.
select test.act_as('owner@example.com');
select save_batch_recipe((select (r->>'recipe_id')::uuid from base), 'Golden base', null, 5, 'L', null,
  'Heat to 85°C, cool overnight', false);
select test.act_as('manager@example.com');
select test.throws($$select record_production((select (r->>'recipe_id')::uuid from base), 1)$$,
  '%not made any more%', 'a hidden recipe is not recorded');
select test.act_as('owner@example.com');
select save_batch_recipe((select (r->>'recipe_id')::uuid from base), 'Golden base', null, 5, 'L', null, null, true);
select test.eq((select count(*) from recipe_version where recipe_id = (select (r->>'recipe_id')::uuid from base))::int, 1,
  'hiding and showing it keeps its ingredients as they were');

-- ------------------------------------------------------------------ selling what was made
-- A cup of the gelato: 120 g of it and a cup. 120 g at 21,264 / 4,600 is 554.71: 555, and the cup 50.
create temp table cupp as select create_product('Golden pistachio cup', '{"dine_in": 3000}',
  jsonb_build_array(jsonb_build_object('item_id', (select (r->>'item_id')::uuid from pist), 'qty', 120, 'unit_code', 'g'),
                    jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000002', 'qty', 1))) r;
grant select on cupp to public;
select test.eq((select unit_cost from menu_costing() where variant_id = (select (r->>'variant_id')::uuid from cupp)),
  605::numeric, 'the cup is costed from the gelato made');
select test.act_as('cashier@example.com');
create temp table sale as select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  jsonb_build_array(jsonb_build_object('variant_id', (select (r->>'variant_id')::uuid from cupp), 'qty', 1))) r;
select test.as_admin();
select test.eq((select value from inventory_movement where type = 'sale_consumption'
                 and item_id = (select (r->>'item_id')::uuid from pist)), 555::numeric,
  'and a sale takes the gelato out at what it cost to make');

-- ------------------------------------------------------------------ cancelling
select test.act_as('barista@example.com');
select test.throws($$select cancel_production((select (r->>'batch_id')::uuid from b2), 'wrong flavour')$$,
  '%permission%', 'a barista cannot cancel a batch');
select test.act_as('manager@example.com');
select test.throws($$select cancel_production((select (r->>'batch_id')::uuid from b2), ' ')$$,
  '%why%', 'a cancellation needs a reason');
select cancel_production((select (r->>'batch_id')::uuid from b2), 'recorded twice');
select test.throws($$select cancel_production((select (r->>'batch_id')::uuid from b2), 'again')$$,
  '%already cancelled%', 'a batch is cancelled once');
select test.as_admin();
select test.eq((select string_agg(i.name || ' ' || trim_scale(m.base_quantity_signed) || ' = ' || m.value, '; '
                                  order by m.base_quantity_signed, i.name)
                  from inventory_movement m join item i on i.id = m.item_id
                 where m.reference_type = 'production_cancel' and m.reference_id = (select (r->>'batch_id')::uuid from b2)),
  'Golden pistachio gelato -4600 = 21264; Golden paste 500 = 15000; Golden base 4500 = 6264',
  'every movement reversed at the value it had');
select test.eq((select status::text || ': ' || cancel_reason from production_batch
                 where id = (select (r->>'batch_id')::uuid from b2)), 'cancelled: recorded twice',
  'the batch is kept, marked cancelled, with the reason');
select test.eq((select count(*) from audit_log where action = 'production.cancel')::int, 1, 'and on the audit trail');
select test.eq((select sum(base_quantity_signed) from inventory_movement where item_id = (select (r->>'item_id')::uuid from base)),
  10000::numeric, 'the base is back');
select test.act_as('manager@example.com');
select test.eq((select difference from report_reconciliation(test.today()) where check_key = 'inventory'), 0::numeric,
  'and the stock ledger still agrees with Inventory (1200)');
select test.eq((select count(*) from legacy_unposted())::int, 0, 'nothing awaits a journal');

-- ------------------------------------------------------------------ a product's recipe, changed
-- The espresso takes 18 g from today, and its cup only for takeaway.
select test.act_as('owner@example.com');
create temp table ch as select change_product_recipe('d1000000-0000-0000-0000-000000000001',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":18,"unit_code":"g"},
    {"item_id":"c0000000-0000-0000-0000-000000000002","qty":1,"unit_code":"each","channels":["takeaway"]}]') r;
grant select on ch to public;
select test.eq((select (r->>'version_no')::int from ch), 2, 'a new version of the recipe');
select test.eq((select string_agg(channel || '=' || unit_cost, ',' order by channel) from menu_costing()
                 where variant_id = 'd1000000-0000-0000-0000-000000000001'),
  'dine_in=180,takeaway=230,talabat=180', 'in force today: 18 g everywhere, the cup only for takeaway');
select test.eq((select count(*) from menu_recipe_lines()
                 where variant_id = 'd1000000-0000-0000-0000-000000000001' and item_id is not null and version_no = 2)::int, 2,
  'the recipe in force names each line''s item');
select test.eq((select count(*) from audit_log where action = 'recipe.change')::int, 1, 'the change is on the audit trail');
select test.throws($$select change_product_recipe('d1000000-0000-0000-0000-000000000001',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":18}]', test.today() - 1)$$,
  '%cannot start in the past%', 'a recipe change cannot start in the past');
select test.throws($$select change_product_recipe('d1000000-0000-0000-0000-000000000001',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":0}]')$$, '%needs a quantity%', 'every line has a quantity');
select test.throws($$select change_product_recipe('d1000000-0000-0000-0000-000000000002',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1}]')$$, '%sold as bought%', 'a product sold as bought has no recipe');
select test.as_admin();
insert into item (id, business_id, name, item_type, base_unit_code, dimension)
values ('c0000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b2', 'Their beans', 'ingredient', 'g', 'mass');
select test.act_as('owner@example.com');
select test.throws($$select change_product_recipe('d1000000-0000-0000-0000-000000000001',
  '[{"item_id":"c0000000-0000-0000-0000-0000000000f2","qty":18}]')$$, '%Unknown item%', 'nor another business''s item');
select test.throws($$select new_recipe_version('d2000000-0000-0000-0000-000000000001',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":18}]')$$, '%permission denied%',
  'and the older way in, which bypassed the audit trail, is closed (0027)');
select test.act_as('manager@example.com');
select test.throws($$select change_product_recipe('d1000000-0000-0000-0000-000000000001',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":18}]')$$, '%permission%',
  'a manager who does not edit recipes cannot change one');
