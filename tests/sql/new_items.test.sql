-- =============================================================================
-- An item added while its delivery is received (0033): the pack it is bought
-- in given with it, and checked as a pack added later is; its stock comes in
-- with the delivery, entered by the pack; the same name is still refused.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table sup as select id from supplier
 where business_id = '00000000-0000-0000-0000-0000000000b1' and name = 'Kurdistan Coffee Imports';
create temp table counts_before as select (select count(*) from item) as items, (select count(*) from item_unit) as units;
grant select on sup, counts_before to public;

-- ---------------------------------------------------------------- who may
select test.act_as('cashier@example.com');
select test.throws($$select create_item('Golden soda', 'resale', 'each', 'count',
  p_units => '[{"code":"carton_24","label":"Carton of 24","factor":24}]')$$,
  '%permission%', 'a cashier does not add items');

-- ------------------------------------------------- a pack, checked as it is added
select test.act_as('manager@example.com');
select test.throws($$select create_item('Golden soda', 'resale', 'each', 'count',
  p_units => '[{"code":"each","label":"Each","factor":24}]')$$,
  '%Golden soda already has a unit called each: a unit in use keeps its size%', 'a pack is not the base unit');
select test.throws($$select create_item('Golden soda', 'resale', 'each', 'count',
  p_units => '[{"code":"carton","label":"Carton","factor":0}]')$$,
  '%Say how many items one carton holds%', 'a pack holds something');
select test.throws($$select create_item('Golden soda', 'resale', 'each', 'count',
  p_units => '[{"code":"carton","factor":24},{"code":"CARTON","factor":12}]')$$,
  '%Golden soda already has a unit called CARTON%', 'no two packs of one name');
select test.throws($$select create_item('Golden sugar', 'ingredient', 'g', 'mass',
  p_units => '[{"code":"kg","label":"Kilogram","factor":500}]')$$,
  '%One kg is 1000 g%', 'a kilogram is 1000 grams');
select test.throws($$select create_item('Golden soda', 'resale', 'each', 'count',
  p_units => '[{"code":" ","factor":24}]')$$,
  '%Name the unit, such as case_24%', 'a pack has a name');
select test.throws($$select create_item('Golden soda', 'resale', 'each', 'count', p_min_level => -5)$$,
  '%Levels cannot be negative%', 'a reorder level is not negative');
select test.as_admin();
select test.eq((select (select count(*) from item) || ' items, ' || (select count(*) from item_unit) || ' units'),
  (select items || ' items, ' || units || ' units' from counts_before), 'each refused, nothing was added');

-- ------------------------------------------- added with its carton, received by it
select test.act_as('manager@example.com');
create temp table w as select (create_item('Golden soda', 'resale', 'each', 'count', p_min_level => 24,
  p_units => '[{"code":"carton_24","label":"Carton of 24","factor":24}]') ->> 'item_id')::uuid as id;
grant select on w to public;
select test.as_admin();
select test.eq((select code || ' ' || label || ' = ' || trim_scale(factor_to_base) || ' each' from item_unit
                 where item_id = (select id from w)),
  'carton_24 Carton of 24 = 24 each', 'the carton is kept with the item');
select test.eq((select count(*)::int from inventory_movement where item_id = (select id from w)), 0,
  'no opening stock: its stock comes in with the delivery');
select test.act_as('manager@example.com');
create temp table rc as select receive_goods((select id from sup),
  jsonb_build_array(jsonb_build_object('item_id', (select id from w), 'qty', 2, 'unit_code', 'carton_24',
                                       'unit_price', 6000))) as r;
grant select on rc to public;
select test.as_admin();
select test.eq((select trim_scale(base_quantity_signed) || ' each at ' || trim_scale(unit_cost) from inventory_movement
                 where item_id = (select id from w)),
  '48 each at 250', '2 cartons at 6,000 a carton are 48 cans at 250 each');
select test.eq((select (r ->> 'value')::numeric from rc), 12000::numeric, 'and 12,000 into stock');
select test.eq((select string_agg(action, ', ' order by id) from audit_log
                 where (action = 'item.create' and entity_id = (select id from w)::text)
                    or (action = 'item_unit.create' and after_state ->> 'item_id' = (select id from w)::text)),
  'item.create, item_unit.create', 'the item and its carton are on the audit trail');

-- ------------------------------------------------- a pack added later: the same rule
select test.act_as('manager@example.com');
select test.throws($$select add_item_unit((select id from w), 'CARTON_24', 'Carton', 12)$$,
  '%Golden soda already has a unit called CARTON_24: a unit in use keeps its size%', 'the carton keeps its size');
select test.throws($$select add_item_unit((select id from w), 'Each', 'Each', 6)$$,
  '%already has a unit called Each%', 'nor is the base unit redefined');
select test.throws($$select add_item_unit((select id from w), 'crate', 'Crate', -12)$$,
  '%Say how many items one crate holds%', 'a pack holds something');
select add_item_unit((select id from w), 'crate_12', '', 12);
select test.as_admin();
select test.eq((select label from item_unit where item_id = (select id from w) and code = 'crate_12'), 'crate_12',
  'a pack with no label is shown by its name');

-- ------------------------------------------------------------ the same name
select test.act_as('manager@example.com');
select test.throws($$select create_item('golden  SODA!', 'resale', 'each', 'count')$$,
  '%There is already an item called golden  SODA!%', 'the same name, however it is typed, is refused');

-- --------------------------------------------------------------- who calls the rule
select test.as_admin();
select test.ok(not has_function_privilege('authenticated', 'assert_unit_ok(text, text, text, numeric)', 'execute')
               and not has_function_privilege('anon', 'assert_unit_ok(text, text, text, numeric)', 'execute'),
  'the pack rule is the functions'' to use, not anyone''s to call');
select test.ok(has_function_privilege('authenticated',
                 'create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric, numeric, boolean, text)',
                 'execute')
               and not has_function_privilege('anon',
                 'create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric, numeric, boolean, text)',
                 'execute'),
  'adding an item: signed-in people with the permission, and no one else');
