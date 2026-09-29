-- =============================================================================
-- Customers and loyalty (0050, release X): a customer found at the till by
-- their number however it is typed, added there, with addresses for the café's
-- own deliveries; a point for every 1,000 IQD a sale comes to once it is paid;
-- 100 points a reward of 5,000 off, the bill's discount (Dr 4100); a void
-- takes back what the sale earned and gives back what it spent, a refund in
-- proportion; points given or taken by hand with why; the list, a customer's
-- history and the loyalty report; who may. Espresso: 2,500 dine-in, 3,000 by
-- the café's own driver (set below), 20 g of beans at 10; water: 1,000.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
values ('00000000-0000-0000-0000-0000000000b1', 'd1000000-0000-0000-0000-000000000001', 'direct_delivery', 3000,
        '2020-01-01');
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.sale(p text) returns uuid language sql as $$ select (v ->> 'order_id')::uuid from res where k = p $$;
create function pg_temp.id(p text) returns uuid language sql as $$ select (v ->> 'customer_id')::uuid from res where k = p $$;
create function pg_temp.k(p_n int) returns uuid language sql immutable as $$
  select ('c5000000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
create function pg_temp.espressos(n int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', n))
$$;
create function pg_temp.water(n int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000002', 'qty', n))
$$;
-- The tests' own view, whoever they act as.
create function pg_temp.cust(p_name text) returns uuid language sql security definer as $$
  select id from customer where full_name = p_name
$$;
create function pg_temp.points(p_name text) returns int language sql security definer as $$
  select customer_points(id) from customer where full_name = p_name
$$;
create function pg_temp.moves(p_sale text) returns text language sql security definer as $$
  select string_agg(kind || ' ' || points, ', ' order by created_at, kind)
    from loyalty_ledger where sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p_sale)
$$;
create function pg_temp.sale_row(p_sale text) returns sales_order language sql security definer as $$
  select * from sales_order where id = (select (v ->> 'order_id')::uuid from res where k = p_sale)
$$;
create function pg_temp.line(p_sale text) returns uuid language sql security definer as $$
  select sl.id from sales_order_line sl
   where sl.sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p_sale)
$$;
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
$$;
create function pg_temp.sales() returns int language sql security definer as $$ select count(*)::int from sales_order $$;
create function pg_temp.tab(p text) returns pos_tab language sql security definer as $$
  select * from pos_tab where id = (select (v ->> 'tab_id')::uuid from res where k = p)
$$;
create temp table before as select pg_temp.checks() as checks;
grant select on before to public;

-- ------------------------------------------------- a customer, found by their number
select test.act_as('cashier@example.com');
select test.eq(find_customer('0770 123 4567'), null, 'nobody has that number yet');
insert into res select 'H', save_customer(null, 'Hawre', '0770 123 4567', 'Likes it strong', true, pg_temp.k(1));
insert into res select 'H2', save_customer(null, 'Hawre', '0770 123 4567', 'Likes it strong', true, pg_temp.k(1));
select test.eq(pg_temp.r('H2') ->> 'customer_id', pg_temp.r('H') ->> 'customer_id',
  'added at the till, sent twice with one key: one customer');
select test.eq(pg_temp.r('H') ->> 'phone', '+9647701234567', 'the number is kept one way');
select test.throws($$select save_customer(null, 'Someone', '+964 770 123 4567')$$, 'That number is Hawre''s already',
  'one number, one customer, however it is typed');
select test.throws($$select save_customer(null, 'Someone', '12345')$$, 'That is not a phone number%',
  'a number too short to be one is refused');
select test.throws($$select save_customer(null, ' ', '0750 000 1111')$$, 'Type the customer''s name', 'a name is needed');
select test.eq(find_customer('٠٧٧٠١٢٣٤٥٦٧') ->> 'name', 'Hawre', 'found by the number typed in Arabic digits');
select test.eq(find_customer('00964 770 123 4567') ->> 'points', '0', 'and with its country code: no points yet');
insert into res select 'A1', save_customer_address(pg_temp.id('H'), null, 'Home', 'Salim Street, house 12',
                                                   'the blue door', true, pg_temp.k(2));
select test.eq(find_customer('07701234567') -> 'addresses' -> 0 ->> 'address', 'Salim Street, house 12',
  'an address for the café''s deliveries');
insert into res select 'R', save_customer(null, 'Rozh', '0750 222 3333');
select test.throws($$select customer_list()$$, '%needs customer.view%', 'the till does not list the customers');
select test.eq((select count(*) from customer)::int, 0, 'nor reads them from the table');
select test.act_as('counter@example.com');
select test.throws($$select find_customer('0770 123 4567')$$, '%permission%', 'a counter finds no customer');

-- ------------------------------------------------------------------ a sale earns points
select test.act_as('cashier@example.com');
insert into res select 'S1', record_sale(pg_temp.k(10), 'dine_in', 'cash', pg_temp.espressos(4),
                                         p_customer => pg_temp.id('H'));
select test.eq((pg_temp.r('S1') -> 'customer' ->> 'earned') || ' earned, ' || (pg_temp.r('S1') -> 'customer' ->> 'points'),
  '10 earned, 10', 'a sale of 10,000 earns 10 points');
insert into res select 'S1b', record_sale(pg_temp.k(10), 'dine_in', 'cash', pg_temp.espressos(4),
                                          p_customer => pg_temp.id('H'));
select test.eq((pg_temp.r('S1b') ->> 'replayed') || ' ' || (pg_temp.r('S1b') -> 'customer' ->> 'earned') || ' '
               || pg_temp.points('Hawre'), 'true 10 10',
  'sent again: the sale recorded, with what it earned, counted once');
select test.eq((pg_temp.sale_row('S1')).customer_id, pg_temp.id('H'), 'the sale names its customer');
select test.eq(test.lines_of(pg_temp.sale('S1')), '1000 Dr 10000 | 1200 Cr 800 | 4000 Cr 10000 | 5000 Dr 800',
  'points are no entry in the books');

-- ------------------------------------------------------------------ points by hand
select test.throws(format('select adjust_points(%L, 95, %L)', pg_temp.id('H'), 'Paper card'), '%needs loyalty.adjust%',
  'a cashier gives no points by hand');
select test.act_as('manager@example.com');
select test.throws(format('select adjust_points(%L, 95, null)', pg_temp.id('H')), 'Say why the points change',
  'points by hand, with why');
select test.throws(format('select adjust_points(%L, 0, %L)', pg_temp.id('H'), 'none'),
  'Enter the points to give, or with a minus to take', 'some points');
insert into res select 'P1', adjust_points(pg_temp.id('H'), 95, 'Points from his paper card', pg_temp.k(20));
insert into res select 'P1b', adjust_points(pg_temp.id('H'), 95, 'Points from his paper card', pg_temp.k(20));
select test.eq(pg_temp.points('Hawre'), 105, 'given by hand, sent twice with one key: once');
select test.throws(format('select adjust_points(%L, -200, %L)', pg_temp.id('H'), 'Too many'),
  'Hawre has 105 points: no more can be taken', 'no more taken than he has');
select test.as_admin();
select test.eq((select count(*) from audit_log where action = 'loyalty.adjust')::int, 1, 'on the audit trail, once');

-- ------------------------------------------------------------------ a reward at the till
select test.act_as('cashier@example.com');
insert into res select 'S2', record_sale(pg_temp.k(11), 'dine_in', 'cash', pg_temp.espressos(3),
                                         p_customer => pg_temp.id('H'), p_rewards => 1);
select test.eq((pg_temp.r('S2') ->> 'discount') || ' off, ' || (pg_temp.r('S2') ->> 'net') || ' to pay',
  '5000 off, 2500 to pay', 'a reward: 5,000 off, the bill''s discount');
select test.eq(test.lines_of(pg_temp.sale('S2')), '1000 Dr 2500 | 1200 Cr 600 | 4000 Cr 7500 | 4100 Dr 5000 | 5000 Dr 600',
  'revenue at the full price, the reward on 4100, as any discount');
select test.eq((pg_temp.sale_row('S2')).discount_reason || ', approved by '
               || coalesce((pg_temp.sale_row('S2')).discount_approved_by::text, 'nobody'),
  'Loyalty reward, approved by nobody', 'a loyalty reward, given by the cashier with no manager, over the 10% cap');
select test.eq((pg_temp.r('S2') -> 'customer' ->> 'spent') || ' spent, ' || (pg_temp.r('S2') -> 'customer' ->> 'earned')
               || ' earned, ' || (pg_temp.r('S2') -> 'customer' ->> 'points'),
  '100 spent, 2 earned, 7', 'the reward takes 100 points; the 2,500 paid earns 2');
select test.throws(format('select record_sale(%L, ''dine_in'', ''cash'', %L, p_customer => %L, p_rewards => 1)',
                          gen_random_uuid(), pg_temp.espressos(3), pg_temp.id('H')),
  'Not enough points: Hawre has 7, and this takes 100', 'not enough points');
select test.throws(format('select record_sale(%L, ''dine_in'', ''cash'', %L, p_rewards => 1)', gen_random_uuid(),
                          pg_temp.espressos(3)),
  'Choose the customer to take their reward', 'a reward is someone''s');
select test.throws(format('select record_sale(%L, ''dine_in'', ''cash'', %L, p_discount_amount => 500, p_customer => %L, p_rewards => 1)',
                          gen_random_uuid(), pg_temp.espressos(3), pg_temp.id('H')),
  'A reward is the bill''s discount: take the other discount off first', 'one discount on a bill');
select test.act_as('manager@example.com');
select adjust_points(pg_temp.id('H'), 100, 'Birthday');
select test.act_as('cashier@example.com');
select test.eq(pg_temp.sales(), 2, 'two sales so far');
select test.throws(format('select record_sale(%L, ''dine_in'', ''cash'', %L, p_customer => %L, p_rewards => 1)',
                          gen_random_uuid(), pg_temp.water(1), pg_temp.id('H')),
  'The bill comes to less than the reward (5,000): add to it, or keep the points for later',
  'a reward is taken whole, never cut to what the bill comes to');
select test.eq(pg_temp.sales() || ' sales, ' || pg_temp.points('Hawre') || ' points', '2 sales, 107 points',
  'and the sale is not recorded, nor the points spent');
insert into res select 'S3', record_sale(pg_temp.k(12), 'dine_in', 'cash', pg_temp.espressos(2),
                                         p_customer => pg_temp.id('H'), p_rewards => 1);
select test.eq((pg_temp.r('S3') ->> 'net') || ' to pay, ' || (pg_temp.r('S3') -> 'customer' ->> 'points'),
  '0 to pay, 7', 'a reward the whole bill: nothing to pay, nothing earned');
select test.eq(test.lines_of(pg_temp.sale('S3')), '1200 Cr 400 | 4000 Cr 5000 | 4100 Dr 5000 | 5000 Dr 400',
  'and the books have revenue, the reward and the cost');

-- ------------------------------------------------------------------ a bill for a customer
select test.act_as('manager@example.com');
select adjust_points(pg_temp.id('H'), 100, 'Makes up for a late order');
select test.act_as('cashier@example.com');
insert into res select 'B1', open_tab('dine_in', null, null, null, pg_temp.espressos(3),
                                      p_customer => jsonb_build_object('id', pg_temp.id('H')),
                                      p_idempotency_key => pg_temp.k(30));
select test.eq((pg_temp.tab('B1')).label || ', ' || (pg_temp.tab('B1')).customer_id::text,
  'Hawre, ' || pg_temp.id('H'), 'a bill for a customer, named after them');
select test.eq((select customer_name || ' ' || customer_points from pos_open_bills()
                 where tab_id = (pg_temp.r('B1') ->> 'tab_id')::uuid), 'Hawre 107',
  'the open bills show the customer and their points');
insert into res select 'B1s', save_tab((pg_temp.r('B1') ->> 'tab_id')::uuid, (pg_temp.tab('B1')).version, pg_temp.espressos(3),
                                       p_customer => '{}'::jsonb);
select test.eq((pg_temp.tab('B1')).customer_id, null, 'taken off the bill');
insert into res select 'B1t', save_tab((pg_temp.r('B1') ->> 'tab_id')::uuid, (pg_temp.tab('B1')).version, pg_temp.espressos(3),
                                       p_customer => jsonb_build_object('id', pg_temp.id('H')));
insert into res select 'B1u', save_tab((pg_temp.r('B1') ->> 'tab_id')::uuid, (pg_temp.tab('B1')).version, pg_temp.espressos(4));
select test.eq((pg_temp.tab('B1')).customer_id, pg_temp.id('H'), 'put back, and kept when a save names nobody');
insert into res select 'S4', settle_tab((pg_temp.r('B1') ->> 'tab_id')::uuid, (pg_temp.tab('B1')).version, pg_temp.k(31), 'cash',
                                        p_rewards => 1);
select test.eq((pg_temp.r('S4') ->> 'net') || ' to pay, ' || (pg_temp.r('S4') -> 'customer' ->> 'earned') || ' earned, '
               || (pg_temp.r('S4') -> 'customer' ->> 'points'),
  '5000 to pay, 5 earned, 12', 'the bill paid with a reward: 10,000 less 5,000, earning 5');
insert into res select 'S4b', settle_tab((pg_temp.r('B1') ->> 'tab_id')::uuid, (pg_temp.tab('B1')).version, pg_temp.k(31), 'cash',
                                         p_rewards => 1);
select test.eq((pg_temp.r('S4b') ->> 'replayed') || ' ' || pg_temp.points('Hawre'), 'true 12',
  'paid again with its key: the sale it was, its points counted once');
select test.eq((pg_temp.sale_row('S4')).customer_id, pg_temp.id('H'), 'the sale names the bill''s customer');

-- ------------------------------------------------------------------ the café's own delivery
select test.throws(format('select record_sale(%L, ''direct_delivery'', ''cash'', %L)', gen_random_uuid(),
                          pg_temp.espressos(1)),
  'A delivery by the café''s own driver needs the customer and their address', 'a delivery goes to a customer');
select test.throws(format('select record_sale(%L, ''direct_delivery'', ''cash'', %L, p_customer => %L)',
                          gen_random_uuid(), pg_temp.espressos(1), pg_temp.id('H')),
  'A delivery by the café''s own driver needs the customer and their address', 'at their address');
select test.throws(format('select record_sale(%L, ''direct_delivery'', ''cash'', %L, p_customer => %L, p_address => %L)',
                          gen_random_uuid(), pg_temp.espressos(1), pg_temp.id('R'),
                          (pg_temp.r('A1') ->> 'address_id')),
  'Choose one of the customer''s addresses', 'an address of their own');
select test.throws(format('select record_sale(%L, ''direct_delivery'', ''cash'', %L)', gen_random_uuid(),
                          pg_temp.water(1)),
  '%No direct_delivery price%', 'a product with no delivery price is refused first, as before');
select test.eq(pg_temp.sales(), 4, 'none of them recorded');
insert into res select 'S5', record_sale(pg_temp.k(13), 'direct_delivery', 'cash', pg_temp.espressos(1),
                                         p_customer => pg_temp.id('H'),
                                         p_address => (pg_temp.r('A1') ->> 'address_id')::uuid);
select test.eq((pg_temp.sale_row('S5')).delivery_address || ' / ' || (pg_temp.r('S5') -> 'customer' ->> 'earned'),
  'Salim Street, house 12 (the blue door) / 3', 'delivered to his address, kept on the sale as it was; 3,000 earns 3');
select test.throws(format('select record_sale(%L, ''talabat'', ''platform_paid'', %L, p_platform_order_no => %L, p_customer => %L)',
                          gen_random_uuid(), pg_temp.espressos(1), 'T-1', pg_temp.id('H')),
  'A delivery platform''s customers are its own: none is added at the till', 'a platform''s customers are its own');

-- ------------------------------------------------------------------ a void, and refunds
select test.act_as('manager@example.com');
select void_sale(pg_temp.sale('S1'), null, 'rang_twice');
select test.eq(pg_temp.moves('S1') || ' / ' || pg_temp.points('Hawre'), 'earn 10, earn_back -10 / 5',
  'a void takes back what the sale earned');
select void_sale(pg_temp.sale('S2'), null, 'rang_twice');
select test.eq(pg_temp.moves('S2') || ' / ' || pg_temp.points('Hawre'),
  'earn 2, redeem -100, earn_back -2, redeem_back 100 / 103', 'and gives back what it spent');

-- 4 espressos, 10,000, earning 10: given back one at a time.
select test.act_as('cashier@example.com');
insert into res select 'S6', record_sale(pg_temp.k(14), 'dine_in', 'cash', pg_temp.espressos(4),
                                         p_customer => pg_temp.id('R'));
select test.act_as('manager@example.com');
select refund_sale_lines(pg_temp.sale('S6'), jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('S6'), 'qty', 1)),
                         'changed_mind');
select test.eq(pg_temp.points('Rozh'), 7, 'one of four given back: the 7,500 kept earns 7');
select refund_sale_lines(pg_temp.sale('S6'), jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('S6'), 'qty', 2)),
                         'changed_mind');
select test.eq(pg_temp.points('Rozh'), 2, 'three of four: the 2,500 kept earns 2');
select refund_sale_lines(pg_temp.sale('S6'), jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('S6'), 'qty', 1)),
                         'changed_mind');
select test.eq(pg_temp.moves('S6') || ' / ' || pg_temp.points('Rozh'), 'earn 10, earn_back -3, earn_back -5, earn_back -2 / 0',
  'all given back: all it earned taken back');

-- 4 espressos with a reward: 10,000 less 5,000, earning 5 and spending 100; half given back.
select adjust_points(pg_temp.id('R'), 100, 'Welcome');
select test.act_as('cashier@example.com');
insert into res select 'S7', record_sale(pg_temp.k(15), 'dine_in', 'cash', pg_temp.espressos(4),
                                         p_customer => pg_temp.id('R'), p_rewards => 1);
select test.eq(pg_temp.points('Rozh'), 5, 'a reward taken: 100 spent, 5 earned');
select test.act_as('manager@example.com');
select refund_sale_lines(pg_temp.sale('S7'), jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('S7'), 'qty', 2)),
                         'changed_mind');
select test.eq(pg_temp.points('Rozh'), 52, 'half given back: 3 of the 5 earned taken back, 50 of the 100 spent given back');
select refund_sale_lines(pg_temp.sale('S7'), jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('S7'), 'qty', 2)),
                         'changed_mind');
select test.eq(pg_temp.points('Rozh'), 100, 'all of it: the points are as they were before the sale');

-- ------------------------------------------------------------------ put away, brought back
select test.act_as('cashier@example.com');
select save_customer(pg_temp.id('R'), 'Rozh', '0750 222 3333', null, false);
select test.throws(format('select record_sale(%L, ''dine_in'', ''cash'', %L, p_customer => %L)', gen_random_uuid(),
                          pg_temp.espressos(1), pg_temp.id('R')),
  'Rozh is no longer a customer here: bring them back on Customers first', 'a customer put away is put on no sale');
select test.eq(find_customer('0750 222 3333') ->> 'active', 'false', 'found, as put away');
select save_customer(pg_temp.id('R'), 'Rozh', '0750 222 3333', null, true);

-- ------------------------------------------------------------------ loyalty off
select test.act_as('owner@example.com');
select set_business_rule('loyalty', 'business', null, '"off"', 'Not this month');
select test.act_as('cashier@example.com');
insert into res select 'S8', record_sale(pg_temp.k(16), 'dine_in', 'cash', pg_temp.espressos(2),
                                         p_customer => pg_temp.id('R'));
select test.eq((pg_temp.r('S8') -> 'customer' ->> 'earned') || ' / ' || pg_temp.points('Rozh'), '0 / 100',
  'loyalty off: the customer is on the sale, earning nothing');
select test.throws(format('select record_sale(%L, ''dine_in'', ''cash'', %L, p_customer => %L, p_rewards => 1)',
                          gen_random_uuid(), pg_temp.espressos(3), pg_temp.id('R')),
  'Customers earn no points now: loyalty is off on Settings', 'and taking no reward');
select test.act_as('owner@example.com');
select set_business_rule('loyalty', 'business', null, null, 'Back on');

-- ------------------------------------------------------------------ the list, a history, the report
select test.act_as('manager@example.com');
select test.eq((select string_agg((c ->> 'name') || ' ' || (c ->> 'points') || ' points, ' || (c ->> 'orders') || ' orders, '
                                  || (c ->> 'spent'), '; ' order by c ->> 'name')
                  from jsonb_array_elements(customer_list()) c),
  'Hawre 103 points, 3 orders, 8000; Rozh 100 points, 3 orders, 5000',
  'the customers, their points, and what they bought (voids left out, refunds taken off)');
select test.eq((select string_agg((o ->> 'status') || ' ' || (o ->> 'net') || ' +' || (o ->> 'earned') || ' -' || (o ->> 'spent'),
                                  '; ' order by o ->> 'placed_at')
                  from jsonb_array_elements(customer_detail(pg_temp.id('H')) -> 'orders') o),
  'voided 10000 +10 -0; voided 2500 +2 -100; completed 0 +0 -100; completed 5000 +5 -100; completed 3000 +3 -0',
  'a customer''s history, sale by sale');
select test.eq((select string_agg(l ->> 'kind', ',' order by l ->> 'at', l ->> 'kind')
                  from jsonb_array_elements(customer_detail(pg_temp.id('H')) -> 'ledger') l
                 where l ->> 'kind' = 'adjust'), 'adjust,adjust,adjust', 'and every point given by hand, with why');
select test.eq((select (r -> 'points' ->> 'earned') || ' earned, ' || (r -> 'points' ->> 'spent') || ' spent, '
                       || (r -> 'points' ->> 'rewards') || ' rewards worth ' || (r -> 'points' ->> 'rewards_value')
                       || ', ' || (r ->> 'outstanding') || ' held, worth ' || (r ->> 'outstanding_value')
                  from report_customers(test.today(), test.today()) r),
  '35 earned, 400 spent, 4 rewards worth 20000, 203 held, worth 10150',
  'the loyalty report: points earned and spent, the rewards, and what the points held would take off');
select test.throws($$select report_customers(current_date, current_date - 1)$$, 'Choose the dates%', 'dates in order');
select test.act_as('cashier@example.com');
select test.throws($$select report_customers(current_date, current_date)$$, '%needs customer.view%',
  'the report is for those who see customers');

-- ------------------------------------------------------------------ the books
select test.as_admin();
select test.eq(pg_temp.checks(), (select checks from before), 'every check is where it was');
select test.eq((select count(*) from document_problems('00000000-0000-0000-0000-0000000000b1', now() + interval '1 minute'))::int,
  0, 'no record without its journal');
select test.throws($$update loyalty_ledger set points = 1000$$, '%append-only%', 'points once written stay written');
