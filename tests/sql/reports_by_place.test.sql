-- =============================================================================
-- Every report at a place (0057, release AB): the café has two branches and
-- the central kitchen. The first branch sells two espressos by card and voids
-- one; the second sells one by card to a customer with a discount and
-- refunds another; the kitchen takes a delivery, returns part of it, makes a
-- batch and spills beans; the second branch orders cups. Each report read for
-- a place holds only that place's; read for the café, all of them. The second
-- branch's manager reads the second branch's, whichever they ask for, and is
-- refused the first's: the reports, the sales analysis, the stock's value
-- and the dashboard.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
insert into location (business_id, kind, name) values ('00000000-0000-0000-0000-0000000000b1', 'branch', 'Second Branch');
create temp table ids as
select (select id from location where name = 'Main Branch') branch1, (select id from location where name = 'Second Branch') branch2,
       (select id from location where name = 'Central Kitchen') kitchen,
       'd1000000-0000-0000-0000-000000000001'::uuid espresso, 'c0000000-0000-0000-0000-000000000001'::uuid beans,
       'c0000000-0000-0000-0000-000000000002'::uuid cups, test.today() as today,
       (select id from supplier order by name limit 1) as supplier;
grant select on ids to public;
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000f2', 'manager2@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Second Manager', 'manager2@example.com', 'a0000000-0000-0000-0000-0000000000f2');
insert into user_role (app_user_id, role, location_id)
select id, 'branch_manager', (select branch2 from ids) from app_user where email = 'manager2@example.com';

create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;
create function pg_temp.sale(p_place uuid, p_qty int, p_discount numeric default null, p_customer uuid default null)
returns jsonb language sql as $$
  select record_sale(gen_random_uuid(), 'dine_in', 'card',
                     jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p_qty)),
                     p_location => p_place, p_discount_amount => p_discount,
                     p_discount_reason => case when p_discount is not null then 'regular' end, p_customer => p_customer)
$$;
create function pg_temp.place(p uuid) returns text language sql as $$
  select coalesce((select name from location where id = p), 'the café')
$$;

-- ------------------------------------------------------------------ the day at each place
select test.act_as('owner@example.com');
select send_stock_transfer((select branch1 from ids), (select branch2 from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select beans from ids), 'qty', 300, 'unit_code', 'g')),
  'The second branch opens', p_idempotency_key => gen_random_uuid());
select receive_stock_transfer((select id from stock_transfer order by transfer_no desc limit 1), null, 'All there', gen_random_uuid());
insert into res select 'm1', pg_temp.sale((select branch1 from ids), 2);
insert into res select 'm2', pg_temp.sale((select branch1 from ids), 1);
select void_sale(pg_temp.id('m2', 'order_id'), null, 'rang_twice', null, gen_random_uuid());
insert into res select 'c', save_customer(null, 'Hawre', '0750 111 2222', null, true, gen_random_uuid());
insert into res select 's1', pg_temp.sale((select branch2 from ids), 2, 500, pg_temp.id('c', 'customer_id'));
insert into res select 's2', pg_temp.sale((select branch2 from ids), 1);
select refund_sale(pg_temp.id('s2', 'order_id'), 'Too cold', null, null, gen_random_uuid());
-- The kitchen: a delivery of beans, part of it sent back; a batch of syrup; a spill.
insert into res select 'g', receive_goods((select supplier from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select beans from ids), 'qty', 1000, 'unit_code', 'g', 'unit_price', 12)),
  p_location => (select kitchen from ids), p_idempotency_key => gen_random_uuid());
select return_to_supplier((select supplier from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select beans from ids), 'qty', 100, 'unit_code', 'g')),
  'Split bag', pg_temp.id('g', 'receipt_id'), (select kitchen from ids), false, gen_random_uuid());
insert into res select 'syrup', save_batch_recipe(null, 'Coffee syrup', '{"measure":"volume"}'::jsonb, 1, 'L',
  jsonb_build_array(jsonb_build_object('item_id', (select beans from ids), 'qty', 50, 'unit_code', 'g')));
select record_production(pg_temp.id('syrup', 'recipe_id'), 1, p_location => (select kitchen from ids));
select record_loss('waste', (select beans from ids), null, 20, 'g', 'Spilt', null, (select kitchen from ids), null,
                   false, gen_random_uuid());
-- The second branch orders cups.
select save_po(null, (select supplier from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select cups from ids), 'qty', 50, 'unit_code', 'each', 'unit_price', 50)),
  null, 'For the second branch', (select branch2 from ids), gen_random_uuid());
-- A person at each branch, each with yesterday's hours.
select save_employee(null, 'Rana', null, 'Barista', (select branch1 from ids), test.today() - 30, null, gen_random_uuid());
select save_employee(null, 'Sami', null, 'Barista', (select branch2 from ids), test.today() - 30, null, gen_random_uuid());
select add_attendance((select id from employee where full_name = p.name),
                      ((test.today() - 1) + time '08:00') at time zone 'Asia/Baghdad',
                      ((test.today() - 1) + time '16:00') at time zone 'Asia/Baghdad', 'Kept on paper', p.place,
                      gen_random_uuid())
  from (values ('Rana', (select branch1 from ids)), ('Sami', (select branch2 from ids))) p (name, place);

-- ------------------------------------------------------------------ each report, at each place
create function pg_temp.daily(p uuid) returns text language sql as $$
  select coalesce(string_agg(orders || ' ' || trim_scale(net) || ' ' || trim_scale(refunds), ', '), '')
    from report_daily_sales(test.today(), test.today(), p)
$$;
select test.eq(pg_temp.daily((select branch1 from ids)), '1 5000 0', 'the first branch''s day: one sale left, 5,000');
select test.eq(pg_temp.daily((select branch2 from ids)), '2 7000 2500',
  'the second''s: two sales, 7,000 after the discount, 2,500 refunded');
select test.eq(pg_temp.daily((select kitchen from ids)), '', 'the kitchen sells nothing');
select test.eq(pg_temp.daily(null), '3 12000 2500', 'the café''s: both branches');
select test.eq((select string_agg(method || ' ' || trim_scale(taken) || ' ' || trim_scale(refunded), ', ')
                  from report_payments(test.today(), test.today(), (select branch2 from ids))),
  'card 7000 2500', 'the second branch''s card takings, and what went back');
select test.eq((select string_agg(kind || ' ' || name || ' ' || trim_scale(qty), ', ')
                  from report_sizes_and_addons(test.today(), test.today(), (select branch1 from ids))),
  'size Single 2', 'the first branch''s sizes: its two espressos, the void left out');
select test.eq((select string_agg(kind, ', ' order by kind) from report_exceptions(test.today(), test.today(), (select branch1 from ids))),
  'void', 'the first branch''s exceptions: its void');
select test.eq((select string_agg(kind, ', ' order by kind) from report_exceptions(test.today(), test.today(), (select branch2 from ids))),
  'discount, refund', 'the second''s: its discount and its refund');
select test.eq((select count(*) from report_uncosted_sales(test.today(), test.today(), (select branch2 from ids)))::int, 0,
  'no sale of the second branch''s is costed at nothing');
select test.eq((report_losses(test.today(), test.today(), (select kitchen from ids)) -> 'total' ->> 'count')
               || ' ' || (report_losses(test.today(), test.today(), (select branch1 from ids)) -> 'total' ->> 'count'),
  '1 0', 'the losses: the kitchen''s spill, none at the first branch');
select test.eq((report_purchases(test.today(), test.today(), (select kitchen from ids)) -> 'total' ->> 'deliveries')
               || ' ' || (report_purchases(test.today(), test.today(), (select kitchen from ids)) -> 'total' ->> 'returns')
               || ' ' || (report_purchases(test.today(), test.today(), (select branch2 from ids)) -> 'total' ->> 'deliveries'),
  '1 1 0', 'what was bought: the kitchen''s delivery and its return, nothing at the second branch');
select test.eq(jsonb_array_length(report_purchasing(test.today(), test.today(), (select branch2 from ids)) -> 'orders')
               || ' ' || jsonb_array_length(report_purchasing(test.today(), test.today(), (select branch1 from ids)) -> 'orders')
               || ' ' || jsonb_array_length(report_purchasing(test.today(), test.today(), (select kitchen from ids)) -> 'returns'),
  '1 0 1', 'purchasing: the second branch''s order, none at the first, the kitchen''s return');
select test.eq(jsonb_array_length(report_production(test.today(), test.today(), (select kitchen from ids)) -> 'batches')
               || ' ' || jsonb_array_length(report_production(test.today(), test.today(), (select branch1 from ids)) -> 'batches'),
  '1 0', 'production: the kitchen''s batch');
select test.eq((select string_agg(x ->> 'name', ', ') from jsonb_array_elements(
                  report_staff(test.today() - 1, test.today(), (select branch2 from ids)) -> 'people') x),
  'Sami', 'the staff: the person who works at the second branch');
select test.eq((report_customers(test.today(), test.today(), (select branch2 from ids)) -> 'sales' ->> 'orders')
               || ' ' || (report_customers(test.today(), test.today(), (select branch1 from ids)) -> 'sales' ->> 'orders'),
  '1 0', 'the customers: Hawre''s sale at the second branch');
select test.ok((report_customers(test.today(), test.today(), (select branch2 from ids)) -> 'points' ->> 'earned')::int > 0
               and (report_customers(test.today(), test.today(), (select branch1 from ids)) -> 'points' ->> 'earned')::int = 0,
  'and the points earned there');
select test.eq((report_dollars(test.today(), test.today(), (select branch2 from ids)) -> 'taken' ->> 'sales'), '0',
  'the dollars: none taken at the second branch');
select test.throws(format('select report_losses(%L, %L, %L)', test.today(), test.today(), 'f0000000-0000-0000-0000-0000000000b2'),
  'Choose one of the café''s places', 'a place of the café''s own');

-- ------------------------------------------------------------------ someone who works at one place
select test.act_as('manager2@example.com');
select test.eq(pg_temp.daily(null), '2 7000 2500', 'the second branch''s manager reads the second branch''s day');
select test.throws(format('select * from report_daily_sales(%L, %L, %L)', test.today(), test.today(), (select branch1 from ids)),
  'You work at Second Branch, not at Main Branch', 'and not the first''s');
select test.eq((select string_agg(x ->> 'key', ', ') from jsonb_array_elements(
                  report_sales_analysis(test.today(), test.today(), 'branch') -> 'rows') x),
  (select branch2::text from ids), 'the sales analysis: by branch, only theirs');
select test.throws(format('select report_sales_analysis(%L, %L, %L, null, null, %L)', test.today(), test.today(), 'product',
                          (select branch1 from ids)),
  'You work at Second Branch, not at Main Branch', 'and not the first''s');
select test.eq(inventory_valuation(test.today()) ->> 'location', (select branch2::text from ids),
  'the stock''s value: the second branch''s');
select test.eq((dashboard_summary(test.today()) ->> 'location') || ' ' || (dashboard_summary(test.today()) ->> 'orders'),
  'Second Branch 2', 'the dashboard: the second branch''s day');
select test.act_as('owner@example.com');
select test.eq((dashboard_summary(test.today()) ->> 'location') is null and (dashboard_summary(test.today()) ->> 'orders') = '3',
  true, 'the owner''s dashboard is the café''s');
select test.act_as('cashier@example.com');
select test.throws(format('select * from report_daily_sales(%L, %L)', test.today(), test.today()),
  '%needs cost.view%', 'a cashier reads no report');
