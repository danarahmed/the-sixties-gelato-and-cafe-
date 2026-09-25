-- =============================================================================
-- The till (0018): tables, categories, product photos, and bills that are paid
-- later. A bill is not a sale: nothing reaches the books until it is paid, and
-- then it posts exactly as record_sale posts a sale at the counter.
-- Golden catalogue: espresso 2,500 dine-in (20 g beans at 10 IQD/g = 200 COGS),
-- bottled water 1,000 dine-in only (250 COGS).
-- =============================================================================
select test.golden_catalogue();
create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
create temp table vers (k text primary key, v int);
grant all on vers to public;

-- ------------------------------------------------------------------- tables
select test.act_as('owner@example.com');
insert into ids values ('t1', save_table(null, 'Table 1', 'Garden', 4, 1));
select test.throws($$select save_table(null, ' table 1 ')$$, '%already a table called table 1%',
  'two tables cannot share a name');
select test.throws($$select save_table(null, '  ')$$, '%Name the table%', 'a table needs a name');
select test.act_as('manager@example.com');
insert into ids values ('t2', save_table(null, 'Table 2', null, 2, 2));
insert into ids values ('t3', save_table(null, 'Table 3', null, 2, 3));
select test.act_as('cashier@example.com');
select test.throws($$select save_table(null, 'Table 9')$$, '%permission%', 'a cashier cannot add tables');
select test.eq((select string_agg(name, ',' order by sort_order) from dining_table where is_active), 'Table 1,Table 2,Table 3',
  'every member can read the tables, in order');

-- --------------------------------------------------------------- categories
select test.act_as('owner@example.com');
insert into ids values ('hot', save_category(null, 'Hot drinks', 'مشروبات ساخنة', null, 1));
insert into ids values ('cold', save_category(null, 'Cold drinks', null, null, 2));
select test.throws($$select save_category(null, 'HOT DRINKS')$$, '%already a category called%',
  'two categories cannot share a name');
select test.throws($$select save_category(gen_random_uuid(), 'Ghost')$$, '%Category not found%',
  'an unknown category cannot be edited');
select test.act_as('manager@example.com');
select test.throws($$select save_category(null, 'Snacks')$$, '%permission%', 'the menu is not a branch manager''s to edit');

-- ---------------------------------------------------------- product details
select test.act_as('owner@example.com');
select set_product_details('d0000000-0000-0000-0000-000000000001', 'Golden espresso', pg_temp.id('hot'), true, true,
                           'اسبريسو', null);
select set_product_details('d0000000-0000-0000-0000-000000000002', 'Golden water', pg_temp.id('cold'), true, false);
select test.throws($$select set_product_details('d0000000-0000-0000-0000-000000000001', 'X', gen_random_uuid())$$,
  '%Unknown category%', 'a product cannot be put in a category that does not exist');
-- A product made on the Products screen has one variant of the same name; renaming the product renames it too.
insert into ids select 'latte', (create_product('Golden latte', '{"dine_in": 3000}', p_no_stock_reason => 'a test product') ->> 'product_id')::uuid;
select set_product_details(pg_temp.id('latte'), 'Caffè latte', pg_temp.id('hot'));
select test.eq((select string_agg(name, ',') from product_variant where product_id = pg_temp.id('latte')), 'Caffè latte',
  'renaming a single-variant product renames what the till sells');
-- The golden espresso's variant is called "Single": it keeps its own name.
select test.eq((select name from product_variant where id = 'd1000000-0000-0000-0000-000000000001'), 'Single',
  'a variant with its own name keeps it');
select test.act_as('manager@example.com');
select test.throws($$select set_product_details('d0000000-0000-0000-0000-000000000001', 'Cheap espresso')$$,
  '%permission%', 'a branch manager cannot rename products');

-- The till's menu: categories in their order, favourites flagged, uncategorised last.
select test.act_as('cashier@example.com');
select test.eq((select string_agg(product_name || '/' || coalesce(category, '-'), ',') from pos_catalogue()
                 where product_id in ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
                                      pg_temp.id('latte'))),
  'Caffè latte/Hot drinks,Golden espresso/Hot drinks,Golden water/Cold drinks', 'the menu is in category order');
select test.eq((select row(is_favourite, category_sort, name_ar, category_ar, prices ->> 'dine_in')::text
                  from pos_catalogue() where variant_id = 'd1000000-0000-0000-0000-000000000001'),
  '(t,1,اسبريسو,"مشروبات ساخنة",2500)', 'the menu carries favourites, sort order, names and prices');

-- Hiding a category hides its products from the menu; hiding a product takes it off sale.
select test.act_as('owner@example.com');
select save_category(pg_temp.id('cold'), 'Cold drinks', null, null, 2, false);
select test.act_as('cashier@example.com');
select test.eq((select count(*) from pos_catalogue() where variant_id = 'd1000000-0000-0000-0000-000000000002')::int, 0,
  'a hidden category''s products leave the menu');
select test.act_as('owner@example.com');
select save_category(pg_temp.id('cold'), 'Cold drinks', null, null, 2, true);
select set_product_details(pg_temp.id('latte'), 'Caffè latte', pg_temp.id('hot'), false);
select test.act_as('cashier@example.com');
select test.eq((select count(*) from pos_catalogue() where product_id = pg_temp.id('latte'))::int, 0,
  'a hidden product leaves the menu');

-- ------------------------------------------------------------------ photos
select test.act_as('owner@example.com');
-- The first bytes are what count: a PNG signature, a JPEG marker, a RIFF…WEBP header.
select test.ok(set_product_image('d0000000-0000-0000-0000-000000000001', 'image/png',
                 encode('\x89504e470d0a1a0a0000000d49484452'::bytea, 'base64'))
               like '/api/product-image/d0000000-0000-0000-0000-000000000001?v=%', 'a PNG is stored and addressed');
select test.eq((select image_url from product where id = 'd0000000-0000-0000-0000-000000000001')
                 like '/api/product-image/%', true, 'the product points at its photo');
select test.succeeds($$select set_product_image('d0000000-0000-0000-0000-000000000002', 'image/webp',
                        encode('\x52494646240000005745425056503820'::bytea, 'base64'))$$, 'a WebP is accepted');
select test.succeeds($$select set_product_image('d0000000-0000-0000-0000-000000000002', 'image/jpeg',
                        encode('\xffd8ffe000104a464946'::bytea, 'base64'))$$, 'a JPEG replaces the old photo');
select test.eq((select content_type from product_image where product_id = 'd0000000-0000-0000-0000-000000000002'),
  'image/jpeg', 'one photo per product: the newest');
select test.throws($$select set_product_image('d0000000-0000-0000-0000-000000000001', 'image/svg+xml',
                     encode(convert_to('<svg onload="alert(1)"/>', 'UTF8'), 'base64'))$$,
  '%PNG, JPEG or WebP%', 'an SVG is refused: it could carry a script');
select test.throws($$select set_product_image('d0000000-0000-0000-0000-000000000001', 'image/png',
                     encode(convert_to('<html><script>alert(1)</script>', 'UTF8'), 'base64'))$$,
  '%not a PNG, JPEG or WebP%', 'a file is judged by its bytes, not by what it claims to be');
select test.throws($$select set_product_image('d0000000-0000-0000-0000-000000000001', 'image/jpeg',
                     encode('\x89504e470d0a1a0a'::bytea, 'base64'))$$,
  '%not a PNG, JPEG or WebP%', 'a PNG sent as a JPEG is refused');
select test.throws($$select set_product_image('d0000000-0000-0000-0000-000000000001', 'image/png', 'not base64 at all!')$$,
  '%could not be read%', 'garbage is refused');
select test.throws($$select set_product_image('d0000000-0000-0000-0000-000000000001', 'image/png',
                     encode('\x89504e470d0a1a0a'::bytea || decode(repeat('00', 300000), 'hex'), 'base64'))$$,
  '%smaller than 300 KB%', 'a photo over 300 KB is refused');
select test.act_as('cashier@example.com');
select test.throws($$select set_product_image('d0000000-0000-0000-0000-000000000001', 'image/png',
                     encode('\x89504e470d0a1a0a'::bytea, 'base64'))$$, '%permission%', 'a cashier cannot change photos');
select test.eq((select count(*) from product_image)::int, 2, 'the till can read the photos it shows');
select test.act_as('owner@example.com');
select clear_product_image('d0000000-0000-0000-0000-000000000002');
select test.eq((select image_url from product where id = 'd0000000-0000-0000-0000-000000000002'), null::text,
  'a photo can be removed');
select test.act_as('cashier@example.com');
select test.eq((select count(*) from product_image)::int, 1, 'and it is gone');

-- -------------------------------------------------------------------- bills
select test.act_as('cashier@example.com');
insert into ids select 'b1', (open_tab('dine_in', pg_temp.id('t1')) ->> 'tab_id')::uuid;
select test.throws($$select open_tab('dine_in')$$, '%a table or a name%', 'a bill is for a table or a named customer');
select test.throws($$select open_tab('dine_in', gen_random_uuid())$$, '%not in use%', 'an unknown table is refused');

insert into vers select 'b1', (save_tab(pg_temp.id('b1'), 1,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1,"note":"  cold please  "}]') ->> 'version')::int;
select test.eq((select v from vers where k = 'b1'), 2, 'saving a bill moves it to the next version');
select test.throws($$select save_tab(pg_temp.id('b1'), 1, '[]')$$, '%changed on another till%',
  'a till working from an old copy of the bill is refused');
select test.throws(format($$select save_tab(%L, 2, '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":0}]')$$,
  pg_temp.id('b1')), '%positive quantity%', 'a line needs a quantity');
select test.throws(format($$select save_tab(%L, 2, '[{"variant_id":"%s","qty":1}]')$$,
  pg_temp.id('b1'), (select id from product_variant where product_id = pg_temp.id('latte'))),
  '%not on sale%', 'a hidden product cannot go on a bill');

-- A takeaway bill cannot hold water: it has no takeaway price. Refused now, not at payment.
insert into ids select 'tw', (open_tab('takeaway', null, 'Walk-in Ali') ->> 'tab_id')::uuid;
select test.throws(format($$select save_tab(%L, 1, '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]')$$,
  pg_temp.id('tw')), '%No takeaway price is set for Golden water%', 'a product with no price for the bill is refused');

select test.eq((select row(table_name, total, jsonb_array_length(lines), lines -> 1 ->> 'note',
                           lines -> 0 ->> 'product_name', (lines -> 0 ->> 'price')::numeric, opened_by)::text
                  from pos_open_bills() where tab_id = pg_temp.id('b1')),
  '("Table 1",6000,2,"cold please","Golden espresso",2500,"Demo Cashier")',
  'the open bill shows its table, lines, prices and total');
select test.as_admin();
select test.eq((select count(*) from sales_order)::int, 0, 'an open bill is not a sale');
select test.eq(test.balance('4000'), 0::numeric, 'and nothing has reached the books');

-- Before the customer has seen the bill, it can be reduced freely.
select test.act_as('cashier@example.com');
select save_tab(pg_temp.id('b1'), 2,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]');
select test.throws(format('select mark_bill_printed(%L, 2)', pg_temp.id('b1')), '%changed on another till%',
  'a stale bill is not printed');
select test.eq((mark_bill_printed(pg_temp.id('b1'), 3) ->> 'print_count')::int, 1, 'printing the bill is recorded');

-- Once printed, adding is fine but taking anything off needs a manager.
select test.throws(format($$select save_tab(%L, 3, '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]')$$,
  pg_temp.id('b1')), '%Only a manager can take items off%', 'a cashier cannot strike items off a printed bill');
select test.throws(format($$select save_tab(%L, 3, '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1},
  {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":0.5}]')$$, pg_temp.id('b1')),
  '%Only a manager%', 'nor reduce a quantity');
select save_tab(pg_temp.id('b1'), 3,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]');
select test.act_as('manager@example.com');
select save_tab(pg_temp.id('b1'), 4,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1},
    {"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]');
select test.as_admin();
select test.eq((select count(*) from audit_log where action = 'bill.reduce' and entity_id = pg_temp.id('b1')::text)::int, 1,
  'a manager''s reduction of a printed bill is on the audit trail');

select test.act_as('cashier@example.com');
select test.throws(format('select cancel_tab(%L, 5, %L)', pg_temp.id('b1'), 'changed mind'),
  '%Only a manager can cancel%', 'a cashier cannot cancel a bill with items on it');
select test.throws(format('select settle_tab(%L, 4, gen_random_uuid(), %L)', pg_temp.id('b1'), 'cash'),
  '%changed on another till%', 'a stale bill cannot be charged');

-- Payment: the bill becomes one sale, posted exactly as a sale at the counter.
create temp table paid as select settle_tab(pg_temp.id('b1'), 5, '20000000-0000-0000-0000-000000000001', 'cash') as r;
grant all on paid to public;
select test.eq((select (r ->> 'net')::numeric from paid), 3500::numeric, 'the bill is charged at today''s prices');
select test.eq(test.lines_of((select (r ->> 'order_id')::uuid from paid)),
  '1000 Dr 3500 | 1200 Cr 450 | 4000 Cr 3500 | 5000 Dr 450', 'a paid bill posts like any cash sale');
-- The till retries, or a second till presses Pay at the same moment: still one sale.
select test.eq((settle_tab(pg_temp.id('b1'), 5, '20000000-0000-0000-0000-000000000001', 'cash') ->> 'order_id')::uuid,
  (select (r ->> 'order_id')::uuid from paid), 'a retried payment returns the same sale');
select test.eq((settle_tab(pg_temp.id('b1'), 5, gen_random_uuid(), 'card') ->> 'replayed')::boolean, true,
  'a second till paying the same bill gets the sale already recorded');
select test.as_admin();
select test.eq((select count(*) from sales_order)::int, 1, 'one bill, one sale');
select test.eq((select row(status, bill_print_count, closed_by is not null)::text from pos_tab where id = pg_temp.id('b1')),
  '(paid,1,t)', 'the bill is closed as paid');

-- A paid bill never changes again, and no bill is ever deleted.
select test.act_as('cashier@example.com');
select test.throws(format($$select save_tab(%L, 5, '[]')$$, pg_temp.id('b1')), '%already paid%',
  'a paid bill cannot be edited');
select test.as_admin();
select test.throws(format('update pos_tab set label = %L where id = %L', 'x', pg_temp.id('b1')), '%paid and cannot change%',
  'not even directly in the database');
select test.throws(format('delete from pos_tab where id = %L', pg_temp.id('b1')), '%never deleted%', 'a bill is never deleted');
select test.throws(format('delete from pos_tab_line where tab_id = %L', pg_temp.id('b1')), '%paid bill cannot change%',
  'nor are its lines');

-- A payment key already spent on another sale is never attached to a bill.
select test.act_as('cashier@example.com');
select record_sale('20000000-0000-0000-0000-000000000002', 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]');
select save_tab(pg_temp.id('tw'), 1, '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]');
select test.throws(format('select settle_tab(%L, 2, %L, %L)', pg_temp.id('tw'), '20000000-0000-0000-0000-000000000002', 'cash'),
  '%already used for another sale%', 'a reused payment key is refused');
select test.eq((select count(*) from pos_open_bills() where tab_id = pg_temp.id('tw'))::int, 1,
  'and the bill is still open, waiting for its money');
select test.succeeds(format('select settle_tab(%L, 2, gen_random_uuid(), %L)', pg_temp.id('tw'), 'card'),
  'it is paid with a fresh key');

-- -------------------------------------------------------------------- split
-- Table 2 pays separately: Sara pays for one espresso and both waters now.
insert into ids select 'b2', (open_tab('dine_in', pg_temp.id('t2')) ->> 'tab_id')::uuid;
select save_tab(pg_temp.id('b2'), 1,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":2}]');
select mark_bill_printed(pg_temp.id('b2'), 2);
insert into ids select 'b2.l1', (lines -> 0 ->> 'line_id')::uuid from pos_open_bills() where tab_id = pg_temp.id('b2');
insert into ids select 'b2.l2', (lines -> 1 ->> 'line_id')::uuid from pos_open_bills() where tab_id = pg_temp.id('b2');
select test.throws(format($$select split_tab(%L, 2, '[{"line_id":"%s","qty":4}]')$$, pg_temp.id('b2'), pg_temp.id('b2.l1')),
  '%Move between 1 and 3 of Golden espresso%', 'no more can move than is on the bill');
select test.throws(format($$select split_tab(%L, 2, '[{"line_id":"%s","qty":1},{"line_id":"%s","qty":1}]')$$,
  pg_temp.id('b2'), pg_temp.id('b2.l1'), pg_temp.id('b2.l1')), '%moved once%', 'a line is moved once');
select test.throws(format($$select split_tab(%L, 2, '[{"line_id":"%s","qty":1}]')$$, pg_temp.id('tw'), pg_temp.id('b2.l1')),
  '%already paid%', 'a paid bill cannot be split');
create temp table split as select split_tab(pg_temp.id('b2'), 2,
  format('[{"line_id":"%s","qty":1},{"line_id":"%s","qty":2}]', pg_temp.id('b2.l1'), pg_temp.id('b2.l2'))::jsonb,
  'Table 2 · Sara') as r;
grant all on split to public;
insert into ids select 'b3', (r ->> 'tab_id')::uuid from split;
select test.eq((select string_agg(coalesce(label, '-') || ':' || total, ',' order by total)
                  from pos_open_bills() where table_id = pg_temp.id('t2')),
  'Table 2 · Sara:4500,-:5000', 'the cashier splits a printed bill without a manager: nothing leaves the table');
select test.eq((select (r ->> 'from_version')::int from split), 3, 'the original bill moves to its next version');
select test.throws(format($$select save_tab(%L, 1, '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]')$$,
  pg_temp.id('b3')), '%Only a manager%', 'the new bill counts as printed too');
select test.as_admin();
select test.eq((select count(*) from audit_log where action = 'bill.split')::int, 1, 'the split is on the audit trail');
select test.act_as('cashier@example.com');
select settle_tab(pg_temp.id('b3'), 1, gen_random_uuid(), 'card');
select test.eq((select count(*) from pos_open_bills() where table_id = pg_temp.id('t2'))::int, 1,
  'the rest of the table''s bill waits for its money');

-- A bill can be opened with its first order in one step; if the order is refused, no bill is left behind.
select test.act_as('cashier@example.com');
insert into ids select 'b5', (open_tab('dine_in', null, 'Sara', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') ->> 'tab_id')::uuid;
select test.eq((select row(version, total)::text from pos_open_bills() where tab_id = pg_temp.id('b5')), '(2,2500)',
  'a bill opened with its order holds it');
select test.throws(format($$select open_tab('dine_in', null, 'Bad order', null, '[{"variant_id":"%s","qty":1}]')$$,
  (select id from product_variant where product_id = pg_temp.id('latte'))), '%not on sale%', 'a refused first order is refused');
select test.eq((select count(*) from pos_open_bills() where label = 'Bad order')::int, 0, 'and leaves no empty bill open');
select test.throws($$select open_tab('talabat', null, 'Rider 12')$$, '%paid through the platform%',
  'a delivery-platform order is a sale, not a bill');

-- ------------------------------------------------------------------- cancel
select test.act_as('cashier@example.com');
insert into ids select 'empty', (open_tab('takeaway', null, 'Walked out') ->> 'tab_id')::uuid;
select test.succeeds(format('select cancel_tab(%L, 1)', pg_temp.id('empty')), 'an empty bill can be cancelled by anyone');
insert into ids select 'b4', (open_tab('dine_in', pg_temp.id('t3')) ->> 'tab_id')::uuid;
select save_tab(pg_temp.id('b4'), 1, '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]');
select test.act_as('manager@example.com');
select test.throws(format('select save_table(%L, %L, null, 2, 3, false)', pg_temp.id('t3'), 'Table 3'),
  '%has an open bill%', 'a table with an open bill cannot be taken out of use');
select test.throws(format('select cancel_tab(%L, 2, %L)', pg_temp.id('b4'), ' '), '%Say why%',
  'cancelling a bill with items needs a reason');
select cancel_tab(pg_temp.id('b4'), 2, 'Customer left before it was made');
select cancel_tab(pg_temp.id('b5'), 2, 'Opened on the wrong table');
select test.as_admin();
select test.eq((select reason from audit_log where action = 'bill.cancel' and entity_id = pg_temp.id('b4')::text),
  'Customer left before it was made', 'a cancelled bill is on the audit trail with its reason');

-- ---------------------------------------------------------------- permissions
select test.act_as('counter@example.com');
select test.throws($$select open_tab('dine_in', null, 'x')$$, '%permission%', 'a stock counter cannot open bills');
select test.throws($$select * from pos_open_bills()$$, '%permission%', 'nor see them');
select test.act_as('cashier@example.com');
select test.throws(format('update pos_tab set status = %L where id = %L', 'cancelled', pg_temp.id('b2')), '%permission denied%',
  'nobody writes to bills except through the till''s functions');
select test.throws(format('insert into pos_tab_line (tab_id, business_id, product_variant_id, qty) values (%L, %L, %L, 1)',
  pg_temp.id('b2'), '00000000-0000-0000-0000-0000000000b1', 'd1000000-0000-0000-0000-000000000001'), '%permission denied%',
  'nor to their lines');
select test.throws($$update product_image set content_type = 'image/png'$$, '%permission denied%', 'nor to photos');

-- ------------------------------------------------------------------ the day
-- Table 2 still owes 5,000: the drawer is not counted until it is paid or cancelled.
select test.as_admin();
create temp table today as select business_local_date('00000000-0000-0000-0000-0000000000b1', now()) as d;
grant all on today to public;
select test.act_as('manager@example.com');
select test.eq((drawer_status() ->> 'open_bills')::int, 1, 'the drawer shows the open bills');
select test.throws('select count_drawer(0)',
  '%1 bill(s) are still open%', 'the drawer is not counted with a bill still open');
select settle_tab(pg_temp.id('b2'), 3, gen_random_uuid(), 'cash');
select test.succeeds(format('select count_drawer(%s)', drawer_status() ->> 'expected'),
  'once every bill is settled, the drawer is counted');
select test.as_admin();
select test.eq((select count(*) from sales_order)::int, 5, 'four bills and one counter sale: five sales');
select test.eq(test.balance('4000'), -(3500 + 1000 + 2500 + 4500 + 5000)::numeric,
  'revenue is exactly what the bills and the counter sale came to');
