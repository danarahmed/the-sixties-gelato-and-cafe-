-- =============================================================================
-- Sizes and add-ons (0041, release P): a size added with its prices and a
-- recipe copied or its own, renamed, retired and brought back; add-on groups
-- that ask for a choice, add-ons with prices by channel and recipes for every
-- size or one; a sale whose lines carry add-ons, priced, discounted, costed and
-- taken from stock with them; a bill that keeps, freezes, splits and settles
-- them; refunds and voids that take them back; and the report. Fixtures: beans
-- 1,000 g at 10, cups 100 at 50; an espresso (Single: 20 g of beans, and a cup
-- to take away) is 2,500. The fixtures opened the drawer.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
-- The café's day (Baghdad's): the scratch database's own date is UTC's.
create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'Asia/Baghdad')::date $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;
create function pg_temp.on_hand(p_item text) returns numeric language sql security definer as $$
  select trim_scale((item_position('00000000-0000-0000-0000-0000000000b1', p_item::uuid,
                                   default_location('00000000-0000-0000-0000-0000000000b1'))).qty)
$$;
create function pg_temp.size(p_name text) returns uuid language sql security definer as $$
  select id from product_variant where product_id = 'd0000000-0000-0000-0000-000000000001' and name = p_name
$$;
-- A size's recipe in force today, line by line.
create function pg_temp.recipe(p_size text) returns text language sql security definer as $$
  select string_agg(i.name || ' ' || trim_scale(rl.quantity) || ' ' || rl.unit_code
                    || coalesce(' ' || rl.applies_to_channels::text, ''), '; ' order by i.name)
    from recipe_line rl join item i on i.id = rl.item_id
   where rl.recipe_version_id = recipe_version_on((select recipe_id from variant_recipe
                                                    where product_variant_id = pg_temp.size(p_size)), pg_temp.today())
$$;
create function pg_temp.price(p_size text) returns numeric language sql security definer as $$
  select price_on(pg_temp.size(p_size), 'dine_in', null, pg_temp.today())
$$;
create function pg_temp.addon(p_name text) returns uuid language sql security definer as $$
  select id from modifier where name = p_name and is_active
$$;
create function pg_temp.grp(p_name text) returns uuid language sql security definer as $$
  select id from modifier_group where name = p_name and is_active
$$;
create function pg_temp.line(p_size text, p_qty int, p_mods jsonb default '[]') returns jsonb language sql as $$
  select jsonb_build_object('variant_id', pg_temp.size(p_size), 'qty', p_qty, 'modifiers',
           (select coalesce(jsonb_agg(jsonb_build_object('modifier_id', pg_temp.addon(m ->> 0), 'qty', (m ->> 1)::int)), '[]')
              from jsonb_array_elements(p_mods) m))
$$;

-- Oat milk and vanilla syrup, in millilitres: 5,000 at 2 and 1,000 at 5.
insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock)
values ('c0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'G-OAT', 'Golden oat milk',
        'ingredient', 'ml', 'volume', false),
       ('c0000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', 'G-VAN', 'Golden vanilla',
        'ingredient', 'ml', 'volume', false);
select test.act_as('owner@example.com');
select record_opening_stock('c0000000-0000-0000-0000-0000000000a1', 5000, 'ml', 2, 'Opening stock');
select record_opening_stock('c0000000-0000-0000-0000-0000000000a2', 1000, 'ml', 5, 'Opening stock');

-- ------------------------------------------------------------ sizes
select test.act_as('cashier@example.com');
select test.throws($$select add_variant('d0000000-0000-0000-0000-000000000001', 'Double', '{"dine_in": 4000}', p_copy_from => 'd1000000-0000-0000-0000-000000000001')$$,
  '%needs recipe.edit%', 'a cashier does not add sizes');
select test.act_as('owner@example.com');
-- The one size is named in the same step; the new one copies its recipe.
insert into res select 'double', add_variant('d0000000-0000-0000-0000-000000000001', 'Double',
  '{"dine_in": 4000, "takeaway": 4000}', p_copy_from => 'd1000000-0000-0000-0000-000000000001',
  p_rename_existing => 'Regular', p_idempotency_key => '11111111-0000-0000-0000-000000000001');
select test.eq((select string_agg(name, ', ' order by name) from product_variant
                 where product_id = 'd0000000-0000-0000-0000-000000000001'), 'Double, Regular',
  'the espresso is sold as Regular and Double');
select test.eq(pg_temp.recipe('Double'), 'Golden beans 20 g; Golden cup 1 each {takeaway,talabat}',
  'the Double copies the Regular''s recipe, the cup to take away with it');
select test.eq(pg_temp.price('Double'), 4000::numeric, 'at its own price');
select test.eq((add_variant('d0000000-0000-0000-0000-000000000001', 'Double', '{"dine_in": 4000, "takeaway": 4000}',
                            p_copy_from => 'd1000000-0000-0000-0000-000000000001', p_rename_existing => 'Regular',
                            p_idempotency_key => '11111111-0000-0000-0000-000000000001') ->> 'replayed')::boolean, true,
  'added twice with one key, it is added once');
select test.eq((select count(*) from product_variant where product_id = 'd0000000-0000-0000-0000-000000000001')::int, 2,
  'and there are still two sizes');
insert into res select 'triple', add_variant('d0000000-0000-0000-0000-000000000001', 'Triple', '{"dine_in": 5000}',
  '[{"item_id": "c0000000-0000-0000-0000-000000000001", "qty": 60, "unit_code": "g"}]');
select test.throws($$select add_variant('d0000000-0000-0000-0000-000000000001', ' double ', '{}', p_copy_from => pg_temp.size('Regular'))$$,
  'This product already has a size called Double', 'two sizes are not called the same');
select test.throws($$select add_variant('d0000000-0000-0000-0000-000000000001', 'Quad', '{}')$$,
  'List what one serving of the size uses, copy another size''s recipe, or say why it uses no stock',
  'a size says what it uses');
select test.throws($$select add_variant('d0000000-0000-0000-0000-000000000001', 'Quad', '{}', p_copy_from => pg_temp.size('Regular'), p_no_stock_reason => 'x')$$,
  'List what one serving of the size uses%', 'and only one way');
select test.throws($$select add_variant('d0000000-0000-0000-0000-000000000001', 'Quad', '{}', p_copy_from => 'd1000000-0000-0000-0000-000000000002')$$,
  'Copy the recipe of one of this product''s sizes', 'a recipe is copied from the product''s own sizes');
select test.throws($$select add_variant('d0000000-0000-0000-0000-000000000002', 'Big bottle', '{}', p_no_stock_reason => 'x')$$,
  '%is sold as bought: add the other size as a product of its own', 'a product sold as bought gets no second size');
select test.throws($$select add_variant('d0000000-0000-0000-0000-000000000001', 'Quad', '{}', p_copy_from => pg_temp.size('Regular'), p_rename_existing => 'Small')$$,
  'This product already has several sizes: rename each on its own', 'the one size is renamed only while it is the one');
select update_variant(pg_temp.size('Triple'), 'Triple shot', p_name_ar => 'ثلاثي');
select test.eq((select name || ' / ' || name_ar from product_variant where id = pg_temp.id('triple', 'variant_id')),
  'Triple shot / ثلاثي', 'a size is renamed, in Arabic too');
select test.throws($$select update_variant(pg_temp.size('Triple shot'), 'regular')$$,
  'This product already has a size called Regular', 'not to another size''s name');
select update_variant(pg_temp.size('Triple shot'), 'Triple');
-- Retired, off the till, and back.
select test.throws($$select retire_variant(pg_temp.size('Triple'))$$, 'Say why the size is retired', 'retired with a reason');
select retire_variant(pg_temp.size('Triple'), true, 'Nobody drinks three');
select test.act_as('cashier@example.com');
select test.eq((select count(*) from pos_catalogue() where product_id = 'd0000000-0000-0000-0000-000000000001')::int, 2,
  'a retired size leaves the till');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card', jsonb_build_array(pg_temp.line('Triple', 1)))$$,
  'That product is not on sale', 'and is not sold');
select test.act_as('owner@example.com');
select test.throws($$select add_variant('d0000000-0000-0000-0000-000000000001', 'triple', '{}', p_copy_from => pg_temp.size('Regular'))$$,
  'This product has a retired size called Triple: bring it back instead', 'its name is kept for it');
select retire_variant(pg_temp.size('Triple'), false);
select test.eq((select is_active from product_variant where id = pg_temp.size('Triple')), true, 'brought back');
select test.as_admin();
select test.eq((select reason || ' | ' || (after_state ->> 'is_active') from audit_log
                 where action = 'product_variant.update' and after_state ? 'is_active' order by id limit 1),
  'Nobody drinks three | false', 'retiring it is on the audit trail with its reason');
select test.eq((select count(*) from audit_log where action = 'product_variant.create'
                   and entity_id in (pg_temp.size('Double')::text, pg_temp.size('Triple')::text))::int, 2,
  'and each size added');
select test.act_as('owner@example.com');
insert into res select 'solo', create_product('Golden tea', '{"dine_in": 1000}', p_no_stock_reason => 'Tea bags are not stocked');
select test.throws($$select retire_variant(pg_temp.id('solo', 'variant_id'), true, 'x')$$,
  'Golden tea is the product''s only size on sale: hide the product instead', 'the last size on sale stays');

-- ------------------------------------------------------------ add-ons
select test.throws($$select save_modifier_group(null, 'Milk', 2, 1)$$,
  'The most to choose is a number from 1 to 20, and no fewer than the fewest', 'a group asks for sensible numbers');
insert into res select 'milk', save_modifier_group(null, 'Milk', 1, 1, 1, p_name_ar => 'حليب');
insert into res select 'extras', save_modifier_group(null, 'Extras', 0, 3, 2);
insert into res select 'toppings', save_modifier_group(null, 'Toppings', 0, null, 3);
select test.throws($$select save_modifier_group(null, 'milk', 0, 1)$$, 'There is already a group of add-ons called milk',
  'one group of a name');
select save_modifier(null, pg_temp.grp('Milk'), 'Whole milk', 1, p_prices => '{"dine_in": 0, "takeaway": 0}');
insert into res select 'oat', save_modifier(null, pg_temp.grp('Milk'), 'Oat milk', 2,
  p_prices => '{"dine_in": 500, "takeaway": 500}',
  p_recipe => '[{"item_id": "c0000000-0000-0000-0000-0000000000a1", "qty": 150, "unit_code": "ml"}]',
  p_idempotency_key => '11111111-0000-0000-0000-000000000002');
select test.eq((save_modifier(null, pg_temp.grp('Milk'), 'Oat milk', 2, p_prices => '{"dine_in": 500, "takeaway": 500}',
                  p_recipe => '[{"item_id": "c0000000-0000-0000-0000-0000000000a1", "qty": 150, "unit_code": "ml"}]',
                  p_idempotency_key => '11111111-0000-0000-0000-000000000002') ->> 'replayed')::boolean, true,
  'an add-on sent twice with one key is added once');
select save_modifier(null, pg_temp.grp('Extras'), 'Extra shot', 1, p_prices => '{"dine_in": 750, "takeaway": 750}',
  p_recipe => '[{"item_id": "c0000000-0000-0000-0000-000000000001", "qty": 20, "unit_code": "g"}]');
select save_modifier(null, pg_temp.grp('Extras'), 'Vanilla', 2, p_prices => '{"dine_in": 500, "takeaway": 500}',
  p_recipe => '[{"item_id": "c0000000-0000-0000-0000-0000000000a2", "qty": 10, "unit_code": "ml"}]');
select save_modifier(null, pg_temp.grp('Extras'), 'Whipped cream', 3, p_prices => '{"dine_in": 250}');
select save_modifier(null, pg_temp.grp('Toppings'), 'Cocoa', 1, p_prices => '{"dine_in": 0}');
select test.throws($$select save_modifier(null, pg_temp.grp('Extras'), 'extra shot', 4)$$,
  'The group already has an add-on called extra shot', 'one add-on of a name in a group');
-- A Double's vanilla is 15 ml; every other size's, 10.
select set_modifier_recipe(pg_temp.addon('Vanilla'), pg_temp.size('Double'),
  '[{"item_id": "c0000000-0000-0000-0000-0000000000a2", "qty": 15, "unit_code": "ml"}]');
select test.as_admin();
select test.eq((select string_agg(e.base_qty::text, ',') from expand_modifier(pg_temp.addon('Vanilla'), pg_temp.size('Double'), 'dine_in', 2) e),
  '30', 'a size''s own quantity replaces the one for every size');
select test.eq((select string_agg(e.base_qty::text, ',') from expand_modifier(pg_temp.addon('Vanilla'), pg_temp.size('Regular'), 'dine_in', 2) e),
  '20', 'which every other size keeps');
select test.act_as('owner@example.com');
select set_product_modifiers('d0000000-0000-0000-0000-000000000001',
  jsonb_build_array(jsonb_build_object('group_id', pg_temp.grp('Milk')), jsonb_build_object('group_id', pg_temp.grp('Extras'))));
select test.throws($$select set_product_modifiers('d0000000-0000-0000-0000-000000000001',
  jsonb_build_array(jsonb_build_object('group_id', pg_temp.grp('Milk')), jsonb_build_object('group_id', pg_temp.grp('Milk'), 'variant_id', pg_temp.size('Double'))))$$,
  'Golden espresso offers each group once: for all its sizes, or for some', 'a group is offered once');
select test.act_as('cashier@example.com');
select test.eq((select string_agg(g ->> 'name' || ' (' || (g ->> 'min') || '-' || coalesce(g ->> 'max', '') || '): '
                                  || (select string_agg((m ->> 'name') || ' ' || coalesce(m -> 'prices' ->> 'dine_in', '-'), ', ')
                                        from jsonb_array_elements(g -> 'modifiers') m), ' | ')
                  from jsonb_array_elements(pos_addons() -> 'groups') g),
  'Milk (1-1): Whole milk 0, Oat milk 500 | Extras (0-3): Extra shot 750, Vanilla 500, Whipped cream 250 | Toppings (0-): Cocoa 0',
  'the till reads each group, its add-ons and their prices');
select test.eq((select count(*) from jsonb_array_elements(pos_addons() -> 'offers') o
                 where o ->> 'product_id' = 'd0000000-0000-0000-0000-000000000001')::int, 2,
  'and which groups the espresso offers');

-- ------------------------------------------------------------ a sale with add-ons
-- Two Triples with oat milk, an extra shot and vanilla (6,750 each), and a
-- Regular with whole milk (2,500): 16,000, less 1,600.
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card', jsonb_build_array(pg_temp.line('Triple', 1)))$$,
  'Choose Milk for Golden espresso — Triple', 'a group that asks for a choice is chosen');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card', jsonb_build_array(pg_temp.line('Triple', 1, '[["Oat milk",1],["Whole milk",1]]')))$$,
  'Choose at most 1 from Milk for Golden espresso — Triple', 'and no more than it takes');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card', jsonb_build_array(pg_temp.line('Triple', 1, '[["Oat milk",1],["Extra shot",3],["Vanilla",1]]')))$$,
  'Choose at most 3 from Extras for Golden espresso — Triple', 'quantities count toward the most');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card', jsonb_build_array(pg_temp.line('Triple', 1, '[["Oat milk",1],["Cocoa",1]]')))$$,
  'Cocoa is not offered with Golden espresso — Triple', 'an add-on is sold with what offers it');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card', jsonb_build_array(pg_temp.line('Triple', 1, '[["Oat milk",1],["Vanilla",1],["Vanilla",1]]')))$$,
  'Vanilla is added twice: give it a quantity instead', 'once, with a quantity');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card', jsonb_build_array(pg_temp.line('Triple', 1, '[["Oat milk",21]]')))$$,
  'Add Oat milk 1 to 20 times', 'from 1 to 20 of it');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card', jsonb_build_array(jsonb_build_object('variant_id', pg_temp.size('Triple'), 'qty', 1, 'modifiers', jsonb_build_array(jsonb_build_object('modifier_id', gen_random_uuid())))))$$,
  'Unknown add-on', 'an add-on that does not exist is refused');
select test.throws($$select record_sale(gen_random_uuid(), 'takeaway', 'card', jsonb_build_array(pg_temp.line('Regular', 1, '[["Oat milk",1],["Whipped cream",1]]')))$$,
  'No takeaway price is set for Whipped cream', 'an add-on sells where it has a price');
insert into res select 's1', record_sale(gen_random_uuid(), 'dine_in', 'card',
  jsonb_build_array(pg_temp.line('Triple', 2, '[["Oat milk",1],["Extra shot",1],["Vanilla",1]]'),
                    pg_temp.line('Regular', 1, '[["Whole milk",1]]')),
  p_discount_amount => 1600, p_expected_net => 14400, p_discount_reason => 'regular');
select test.as_admin();
select test.eq((select (v ->> 'gross') || ' - ' || (v ->> 'discount') || ' = ' || (v ->> 'net') from res where k = 's1'),
  '16000 - 1600 = 14400', 'the lines are sold at their sizes'' prices and their add-ons''');
select test.eq((select string_agg(pv.name || ' ' || trim_scale(sl.quantity) || ' x ' || trim_scale(sl.unit_price) || ' net '
                                  || trim_scale(sl.line_net) || ' cost ' || trim_scale(sl.cogs_amount), '; ' order by pv.name desc)
                  from sales_order_line sl join product_variant pv on pv.id = sl.product_variant_id
                 where sl.sales_order_id = pg_temp.id('s1', 'order_id')),
  'Triple 2 x 6750 net 12150 cost 2300; Regular 1 x 2500 net 2250 cost 200',
  'each line at its size and add-ons, its share of the discount, and what it all cost');
select test.eq((select string_agg(m.name || ' ' || trim_scale(m.qty) || ' x ' || trim_scale(m.unit_price) || ' = '
                                  || trim_scale(m.amount) || ', net ' || trim_scale(m.net_amount) || ', cost ' || trim_scale(m.cost),
                                  '; ' order by m.name)
                  from sales_order_line_modifier m where m.sales_order_id = pg_temp.id('s1', 'order_id')),
  'Extra shot 2 x 750 = 1500, net 1350, cost 400; Oat milk 2 x 500 = 1000, net 900, cost 600; Vanilla 2 x 500 = 1000, net 900, cost 100; Whole milk 1 x 0 = 0, net 0, cost 0',
  'each add-on as sold: how many, its price, its share of the discount, and its cost');
select test.eq((pg_temp.on_hand('c0000000-0000-0000-0000-000000000001') || ' g, ' || pg_temp.on_hand('c0000000-0000-0000-0000-0000000000a1')
                || ' ml, ' || pg_temp.on_hand('c0000000-0000-0000-0000-0000000000a2') || ' ml'),
  '820 g, 4700 ml, 980 ml', 'the add-ons'' recipes are used with their lines: beans for the extra shots, the oat milk and the vanilla');
select test.eq((select string_agg(a.code || case when l.debit > 0 then ' Dr ' || trim_scale(l.debit) else ' Cr ' || trim_scale(l.credit) end,
                                  ' | ' order by a.code)
                  from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
                 where e.reference_type = 'sales_order' and e.reference_id = pg_temp.id('s1', 'order_id')),
  '1010 Dr 14400 | 1200 Cr 2500 | 4000 Cr 16000 | 4100 Dr 1600 | 5000 Dr 2500', 'the add-ons are revenue and cost as the sale is');
select test.eq((select string_agg(m.name, ', ' order by pv.name desc, m.position)
                  from sales_order_line_modifier m join sales_order_line sl on sl.id = m.sales_order_line_id
                  join product_variant pv on pv.id = sl.product_variant_id
                 where m.sales_order_id = pg_temp.id('s1', 'order_id')),
  'Oat milk, Extra shot, Vanilla, Whole milk', 'each in the place it was given on its line');
select test.throws($$update sales_order_line_modifier set net_amount = 0$$, 'Table sales_order_line_modifier is append-only%',
  'an add-on as sold is never changed');
-- Stock below zero: an add-on's item follows its rule.
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-0000000000a1', '"block"', 'Oat milk is counted');
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card', jsonb_build_array(pg_temp.line('Regular', 40, '[["Oat milk",1]]')))$$,
  'Only 4700 ml of Golden oat milk is in stock: record the delivery or the batch first, or count it',
  'an add-on''s stock is checked with the line''s');

-- ------------------------------------------------------------ a bill with add-ons
insert into res select 'b1', open_tab('dine_in', null, 'Add-on bill', null,
  jsonb_build_array(pg_temp.line('Double', 1, '[["Oat milk",1],["Vanilla",2]]')));
select test.eq((select b.subtotal::text || ' | ' || (b.lines -> 0 ->> 'price') || ' + '
                       || (select string_agg((m ->> 'name') || ' x' || (m ->> 'qty') || ' @ ' || (m ->> 'price'), ', ')
                             from jsonb_array_elements(b.lines -> 0 -> 'modifiers') m)
                  from pos_open_bills() b where b.tab_id = pg_temp.id('b1', 'tab_id')),
  '5500 | 4000 + Oat milk x1 @ 500, Vanilla x2 @ 500', 'the bill keeps each line''s add-ons, priced');
select mark_bill_printed(pg_temp.id('b1', 'tab_id'), 2);
select test.act_as('owner@example.com');
select set_modifier_price(pg_temp.addon('Oat milk'), 'dine_in', 700);
select test.act_as('cashier@example.com');
select test.eq((select b.subtotal from pos_open_bills() b where b.tab_id = pg_temp.id('b1', 'tab_id')), 5500::numeric,
  'a printed bill keeps its add-ons at the price the customer saw');
select save_tab(pg_temp.id('b1', 'tab_id'), 2,
  jsonb_build_array(pg_temp.line('Double', 1, '[["Oat milk",1],["Vanilla",2]]'), pg_temp.line('Double', 1, '[["Oat milk",1]]')));
select test.eq((select b.subtotal from pos_open_bills() b where b.tab_id = pg_temp.id('b1', 'tab_id')), 10000::numeric,
  'and more of the same at that price: 5,500 and 4,500');
select test.throws($$select save_tab(pg_temp.id('b1', 'tab_id'), 3,
  jsonb_build_array(pg_temp.line('Double', 1, '[["Oat milk",1]]'), pg_temp.line('Double', 1, '[["Oat milk",1]]')))$$,
  'Only a manager can take items off a bill that has been printed', 'an add-on taken off a printed bill is taken off it');
select test.act_as('manager@example.com');
select save_tab(pg_temp.id('b1', 'tab_id'), 3,
  jsonb_build_array(pg_temp.line('Double', 1, '[["Oat milk",1],["Vanilla",1]]'), pg_temp.line('Double', 1, '[["Oat milk",1]]')));
select test.as_admin();
select test.eq((select (before_state -> 'lines' -> 0 -> 'modifiers' -> 1 ->> 'qty') || ' -> '
                       || (after_state -> 'lines' -> 0 -> 'modifiers' -> 1 ->> 'qty')
                  from audit_log where action = 'bill.reduce' order by id desc limit 1),
  '2 -> 1', 'by a manager, on the audit trail');
select test.act_as('owner@example.com');
select test.throws($$select save_modifier(pg_temp.addon('Oat milk'), null, 'Oat milk', 2, false)$$,
  'Oat milk is on the open bill Add-on bill: take it off, or settle the bill, first', 'an add-on on an open bill stays on sale');
select test.act_as('cashier@example.com');
insert into res select 'b2', split_tab(pg_temp.id('b1', 'tab_id'), 4,
  jsonb_build_array(jsonb_build_object('line_id', (select id from pos_tab_line where tab_id = pg_temp.id('b1', 'tab_id') and position = 2), 'qty', 1)));
select test.eq((select string_agg(b.subtotal::text, ', ' order by b.subtotal) from pos_open_bills() b
                 where b.tab_id in (pg_temp.id('b1', 'tab_id'), pg_temp.id('b2', 'tab_id'))),
  '4500, 5000', 'split, a line takes its add-ons and their prices with it');
insert into res select 'p1', settle_tab(pg_temp.id('b1', 'tab_id'), 5, gen_random_uuid(), 'card', 5000);
insert into res select 'p2', settle_tab(pg_temp.id('b2', 'tab_id'), 1, gen_random_uuid(), 'card', 4500);
select test.as_admin();
select test.eq((select string_agg(m.name || ' ' || trim_scale(m.unit_price), ', ' order by m.name)
                  from sales_order_line_modifier m where m.sales_order_id in (pg_temp.id('p1', 'order_id'), pg_temp.id('p2', 'order_id'))),
  'Oat milk 500, Oat milk 500, Vanilla 500', 'paid at the prices the bill froze, not today''s 700');
select test.eq(pg_temp.on_hand('c0000000-0000-0000-0000-0000000000a2'), 965::numeric,
  'a Double''s vanilla is its own 15 ml');

-- ------------------------------------------------------------ refunds and voids
select test.act_as('manager@example.com');
insert into res select 'rf', refund_sale_lines(pg_temp.id('s1', 'order_id'),
  jsonb_build_array(jsonb_build_object('line_id', (select id from sales_order_line where sales_order_id = pg_temp.id('s1', 'order_id')
                                                       and unit_price = 6750), 'qty', 1)), 'changed_mind');
select test.eq((pg_temp.r('rf') ->> 'refunded')::numeric, 6075::numeric, 'a refund gives back a line with its add-ons: half of 12,150');
select void_sale(pg_temp.id('p1', 'order_id'), 'Rang twice', 'rang_twice');
select test.as_admin();
select test.eq(pg_temp.on_hand('c0000000-0000-0000-0000-0000000000a2'), 980::numeric,
  'a void puts back what the add-ons used');

-- ------------------------------------------------------------ a group taken off the till
select test.act_as('owner@example.com');
select set_product_modifiers(pg_temp.id('solo', 'product_id'),
  jsonb_build_array(jsonb_build_object('group_id', pg_temp.id('toppings', 'group_id'))));
select save_modifier_group(pg_temp.id('toppings', 'group_id'), 'Toppings', 0, null, 3, false);
select set_product_modifiers(pg_temp.id('solo', 'product_id'),
  jsonb_build_array(jsonb_build_object('group_id', pg_temp.id('toppings', 'group_id')),
                    jsonb_build_object('group_id', pg_temp.grp('Milk'))));
select test.eq((select string_agg(g.name, ', ' order by o.sort_order) from product_modifier_group o
                  join modifier_group g on g.id = o.group_id where o.product_id = pg_temp.id('solo', 'product_id')),
  'Toppings, Milk', 'a product keeps a group taken off the till as its other groups change');
select test.throws($$select set_product_modifiers('d0000000-0000-0000-0000-000000000001',
  jsonb_build_array(jsonb_build_object('group_id', pg_temp.grp('Milk')), jsonb_build_object('group_id', pg_temp.grp('Extras')),
                    jsonb_build_object('group_id', pg_temp.id('toppings', 'group_id'))))$$,
  'Choose a group of add-ons in use', 'but no product takes it up anew');
select test.act_as('cashier@example.com');
select test.eq((select count(*) from jsonb_array_elements(pos_addons() -> 'groups') g where g ->> 'name' = 'Toppings')::int
               + (select count(*) from jsonb_array_elements(pos_addons() -> 'offers') o
                   where (o ->> 'group_id')::uuid = pg_temp.id('toppings', 'group_id'))::int, 0,
  'and the till no longer offers it');

-- ------------------------------------------------------------ keyed as every write is (0035)
select test.as_admin();
select test.eq((select string_agg(k.name, ', ' order by k.name)
                  from unnest(array['add_variant', 'update_variant', 'retire_variant', 'save_modifier_group', 'save_modifier',
                                    'set_modifier_price', 'set_modifier_recipe', 'set_product_modifiers']) k(name)
                 where not exists (
                   select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = k.name
                      and p.proargnames[array_length(p.proargnames, 1)] = 'p_idempotency_key' and p.pronargdefaults > 0
                      and p.prosrc like '%idem_begin(v_business, p_idempotency_key, ''' || k.name || '''%'
                      and p.prosrc like '%idem_finish(v_business, p_idempotency_key, ''' || k.name || '''%'
                      and has_function_privilege('authenticated', p.oid, 'execute')
                      and not has_function_privilege('anon', p.oid, 'execute'))
                    or exists (
                   select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = k.name || '__run'
                      and (has_function_privilege('authenticated', p.oid, 'execute')
                           or has_function_privilege('anon', p.oid, 'execute')))), null,
  'each write of sizes and add-ons takes its key last, and its work cannot be called from outside');

-- ------------------------------------------------------------ the report
select test.act_as('owner@example.com');
select test.eq((select string_agg(r.kind || ' ' || r.product || ' / ' || r.name || ': ' || trim_scale(r.qty) || ' on ' || r.lines
                                  || ', ' || trim_scale(r.sales) || ' less ' || trim_scale(r.cost)
                                  || coalesce(', offered on ' || r.offered, ''), '; ')
                  from report_sizes_and_addons(pg_temp.today(), pg_temp.today()) r),
  'size Golden espresso / Double: 1 on 1, 4000 less 200; size Golden espresso / Regular: 1 on 1, 2250 less 200; size Golden espresso / Triple: 2 on 1, 9000 less 1200; '
  || 'addon Extras / Extra shot: 2 on 1, 1350 less 400, offered on 3; addon Extras / Vanilla: 2 on 1, 900 less 100, offered on 3; '
  || 'addon Milk / Oat milk: 3 on 2, 1400 less 900, offered on 3; addon Milk / Whole milk: 1 on 1, 0 less 0, offered on 3',
  'what sold by size and by add-on, voids left out');
select test.as_admin();
select test.eq((select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
                  from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', pg_temp.today()) where difference <> 0),
  null, 'the books still tie');
