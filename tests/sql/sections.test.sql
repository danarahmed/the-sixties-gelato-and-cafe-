-- =============================================================================
-- The café and the bakery on one till, and a menu for each place (0074, round
-- sixteen): sections named by the owner, a category's section carried by its
-- products, and a branch that sells only some sections showing only those on
-- its till. Espresso and water from the golden catalogue; a croissant added.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table ids (k text primary key, id uuid);
grant all on ids to public;
create function pg_temp.id(p text) returns uuid language sql as $$ select id from ids where k = p $$;
create function pg_temp.branch() returns uuid language sql security definer as $$
  select id from location where business_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'branch'
   order by created_at, name limit 1
$$;
create function pg_temp.kitchen() returns uuid language sql security definer as $$
  select id from location where business_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'central_kitchen' limit 1
$$;
-- What the till offers, by product and section.
create function pg_temp.menu() returns text language sql as $$
  select string_agg(product_name || '/' || coalesce(section, '-'), ', ' order by product_name)
    from pos_catalogue(pg_temp.branch()) where product_name like 'Golden%'
$$;
insert into product (id, business_id, name) values
  ('d0000000-0000-0000-0000-000000000074', '00000000-0000-0000-0000-0000000000b1', 'Golden croissant');
insert into product_variant (id, product_id, name, resale_item_id)
values ('d1000000-0000-0000-0000-000000000074', 'd0000000-0000-0000-0000-000000000074', 'One',
        'c0000000-0000-0000-0000-000000000003');
insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
values ('00000000-0000-0000-0000-0000000000b1', 'd1000000-0000-0000-0000-000000000074', 'dine_in', 1500, '2020-01-01');

-- ------------------------------------------------------------ naming sections
select test.act_as('owner@example.com');
insert into ids values ('cafe', save_section(null, 'Café', 'المقهى', 'کافێ', p_idempotency_key => '74000000-0000-0000-0000-000000000001'));
insert into ids values ('cafe2', save_section(null, 'Café', 'المقهى', 'کافێ', p_idempotency_key => '74000000-0000-0000-0000-000000000001'));
select test.eq(pg_temp.id('cafe2'), pg_temp.id('cafe'), 'sent again with its key, the section is the one made');
insert into ids values ('bakery', save_section(null, 'Bakery', 'المخبز', 'نانەواخانە'));
select test.throws($$select save_section(null, 'bakery')$$, 'There is already a section called bakery',
  'a name is used once, whatever its letters');
select test.throws($$select save_section(null, '  ')$$, 'Name the section', 'a section needs a name');
select test.eq((select string_agg(name || ' ' || position, ', ' order by position) from menu_section),
  'Café 1, Bakery 2', 'each comes after the last');
select test.eq(pg_temp.menu(), 'Golden croissant/-, Golden espresso/-, Golden water/-',
  'before any category has a section, the till''s menu is as it was');

-- ------------------------------------------------------------ a category's section
insert into ids values ('coffee', save_category(null, 'Golden coffee'));
insert into ids values ('pastry', save_category(null, 'Golden pastry'));
select test.as_admin();
update product set category_id = pg_temp.id('coffee') where id = 'd0000000-0000-0000-0000-000000000001';
update product set category_id = pg_temp.id('pastry') where id = 'd0000000-0000-0000-0000-000000000074';
select test.act_as('owner@example.com');
select set_category_section(pg_temp.id('coffee'), pg_temp.id('cafe'));
select set_category_section(pg_temp.id('pastry'), pg_temp.id('bakery'));
select test.eq(pg_temp.menu(), 'Golden croissant/Bakery, Golden espresso/Café, Golden water/-',
  'a product is of its category''s section; one with no category, of none');
select test.eq((select string_agg(section_ar || '/' || section_ckb, ', ' order by section_position)
                  from pos_catalogue(pg_temp.branch()) where section is not null and product_name like 'Golden%'),
  'المقهى/کافێ, المخبز/نانەواخانە', 'each section in the three languages, in its order');

-- ------------------------------------------------------------ a branch that sells only the bakery
select test.eq(set_place_sections(pg_temp.branch(), array[pg_temp.id('bakery')]) -> 'sections',
  jsonb_build_array(pg_temp.id('bakery')), 'the branch sells the bakery''s section');
select test.eq(pg_temp.menu(), 'Golden croissant/Bakery, Golden water/-',
  'its till shows the bakery''s products, and those of no section');
select set_place_sections(pg_temp.branch(), array[pg_temp.id('bakery'), pg_temp.id('cafe')]);
select test.eq(pg_temp.menu(), 'Golden croissant/Bakery, Golden espresso/Café, Golden water/-',
  'both sections: everything again');
select set_place_sections(pg_temp.branch(), '{}');
select test.eq(pg_temp.menu(), 'Golden croissant/Bakery, Golden espresso/Café, Golden water/-',
  'none: the branch sells everything, as before');
-- A section taken out of use: its products are of none, sold everywhere.
select set_place_sections(pg_temp.branch(), array[pg_temp.id('bakery')]);
select save_section(pg_temp.id('cafe'), 'Café', 'المقهى', 'کافێ', p_is_active => false);
select test.eq(pg_temp.menu(), 'Golden croissant/Bakery, Golden espresso/-, Golden water/-',
  'a section out of use: its products show as of none');
select save_section(pg_temp.id('cafe'), 'Café', 'المقهى', 'کافێ', p_is_active => true);
select set_place_sections(pg_temp.branch(), '{}');

-- ------------------------------------------------------------ refused
select test.throws($$select set_place_sections(pg_temp.kitchen(), '{}')$$,
  '% does not sell: the till is at a branch', 'only a branch sells');
select test.throws($$select set_category_section(pg_temp.id('coffee'), gen_random_uuid())$$, 'Section not found',
  'a section the café does not have');
select test.throws($$select set_place_sections(pg_temp.branch(), array[gen_random_uuid()])$$, 'Section not found',
  'nor for a branch');
select test.act_as('cashier@example.com');
select test.throws($$select save_section(null, 'Drinks')$$, '%permission%', 'a cashier names no section');
select test.throws($$select set_category_section(pg_temp.id('coffee'), null)$$, '%permission%',
  'nor sets a category''s');
select test.throws($$select set_place_sections(pg_temp.branch(), '{}')$$, '%permission%',
  'nor a branch''s');
select test.eq((select count(*)::int from menu_section), 2, 'a cashier reads the sections the till groups by');
select test.act_as_anon();
select test.throws($$select save_section(null, 'Drinks')$$, '%permission denied%', 'the public names none');
select test.as_admin();
select test.eq((select string_agg(action, ',' order by action) from audit_log
                 where action in ('section.add', 'section.change', 'category.section', 'place.sections')
),
  'category.section,category.section,place.sections,place.sections,place.sections,place.sections,place.sections,section.add,section.add,section.change,section.change',
  'every change is on the audit trail');
