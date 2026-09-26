-- =============================================================================
-- Turn numbers (0034): every order takes the next number of its day, printed
-- on the customer's check and on the barista's ticket. A bill takes its number
-- when it is opened, and its sale keeps it; a quick sale takes one when it is
-- paid. Numbers come from the database, so two tills never share one, and an
-- order that is refused takes none.
-- Golden catalogue: espresso 2,500 dine-in, water 1,000 dine-in only.
-- =============================================================================
select test.golden_catalogue();
create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
create temp table got (k text primary key, r jsonb);
grant all on got to public;
create or replace function pg_temp.r(p text) returns jsonb language sql as $$ select r from got where k = p $$;

select test.act_as('owner@example.com');
insert into ids values ('t1', save_table(null, 'Table 1', null, 4, 1));
insert into ids values ('t2', save_table(null, 'Table 2', null, 2, 2));

-- ------------------------------------------------------------- quick sales
select test.act_as('cashier@example.com');
insert into got select 's1', record_sale('30000000-0000-0000-0000-000000000001', 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]');
insert into got select 's2', record_sale('30000000-0000-0000-0000-000000000002', 'dine_in', 'card',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":2}]');
select test.eq((pg_temp.r('s1') ->> 'turn_no')::int, 1, 'the day''s first order is number 1');
select test.eq((pg_temp.r('s2') ->> 'turn_no')::int, 2, 'the next is number 2');
select test.as_admin();
select test.eq((select string_agg(turn_no::text, ',' order by turn_no) from sales_order), '1,2',
  'each sale keeps its number');

-- A payment sent again after a lost answer is the sale already recorded, with its number.
select test.act_as('cashier@example.com');
select test.eq((record_sale('30000000-0000-0000-0000-000000000001', 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') ->> 'turn_no')::int, 1,
  'a retried payment keeps its number');

-- A sale the database refuses takes no number: none is skipped.
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', p_expected_net => 9999)$$,
  '%not the 9999 shown%', 'a sale at a total the customer was not shown is refused');
select test.throws($$select record_sale(gen_random_uuid(), 'takeaway', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]')$$,
  '%No takeaway price is set%', 'a sale with no price on its channel is refused');
insert into got select 's3', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]');
select test.eq((pg_temp.r('s3') ->> 'turn_no')::int, 3, 'after two refusals the next sale is number 3');

-- ------------------------------------------------------------------- bills
-- A bill takes its number when it is opened: its ticket goes to the bar when
-- it is saved, long before it is paid.
insert into ids select 'b1', (open_tab('dine_in', pg_temp.id('t1')) ->> 'tab_id')::uuid;
select test.eq((select turn_no from pos_open_bills() where tab_id = pg_temp.id('b1')), 4,
  'a bill takes the next number as it is opened');
select save_tab(pg_temp.id('b1'), 1,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]');
select test.eq((select turn_no from pos_open_bills() where tab_id = pg_temp.id('b1')), 4,
  'saving it keeps its number');
insert into got select 's4', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]');
select test.eq((pg_temp.r('s4') ->> 'turn_no')::int, 5, 'a quick sale meanwhile takes the next');

-- A bill opened with an order that is refused leaves no bill, and takes no number.
select test.throws(format($$select open_tab('dine_in', null, 'Bad order', null, '[{"variant_id":"%s","qty":0}]')$$,
  'd1000000-0000-0000-0000-000000000001'), '%positive quantity%', 'a refused first order is refused');
insert into ids select 'b2', (open_tab('takeaway', null, 'Sara', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') ->> 'tab_id')::uuid;
select test.eq((select turn_no from pos_open_bills() where tab_id = pg_temp.id('b2')), 6,
  'the next bill is number 6: the refused one took none');

-- Paid, the bill's sale keeps the bill's number.
select test.throws(format('select settle_tab(%L, 1, gen_random_uuid(), %L)', pg_temp.id('b1'), 'cash'),
  '%changed on another till%', 'a stale bill is not charged');
insert into got select 'p1', settle_tab(pg_temp.id('b1'), 2, '30000000-0000-0000-0000-000000000011', 'cash');
select test.eq((pg_temp.r('p1') ->> 'turn_no')::int, 4, 'a paid bill''s sale keeps the bill''s number');
select test.eq((settle_tab(pg_temp.id('b1'), 2, '30000000-0000-0000-0000-000000000011', 'cash') ->> 'turn_no')::int, 4,
  'a retried payment of the bill keeps it too');
select test.as_admin();
select test.eq((select turn_no from sales_order where id = (pg_temp.r('p1') ->> 'order_id')::uuid), 4,
  'the sale is recorded with it');
select test.eq((select turn_no from pos_tab where id = pg_temp.id('b1')), 4, 'and so is the paid bill');

-- The part of a bill split off to be paid on its own keeps the bill's number.
select test.act_as('cashier@example.com');
insert into ids select 'b3', (open_tab('dine_in', pg_temp.id('t2')) ->> 'tab_id')::uuid;
select save_tab(pg_temp.id('b3'), 1,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":2}]');
insert into ids select 'b3.l1', (lines -> 0 ->> 'line_id')::uuid from pos_open_bills() where tab_id = pg_temp.id('b3');
insert into got select 'split', split_tab(pg_temp.id('b3'), 2,
  format('[{"line_id":"%s","qty":1}]', pg_temp.id('b3.l1'))::jsonb, 'Table 2 · Ali');
select test.eq((select string_agg(coalesce(label, '-') || ':' || turn_no, ',' order by label nulls first)
                  from pos_open_bills() where table_id = pg_temp.id('t2')),
  '-:7,Table 2 · Ali:7', 'a split bill keeps the number of the bill it came from');
select test.eq((settle_tab((pg_temp.r('split') ->> 'tab_id')::uuid, 1, gen_random_uuid(), 'card') ->> 'turn_no')::int, 7,
  'and its sale keeps it');
select test.eq((record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') ->> 'turn_no')::int, 8,
  'a split takes no number of its own');

-- A bill opened before numbers were given takes one when it is paid.
select test.as_admin();
update pos_tab set turn_no = null where id = pg_temp.id('b2');
select test.act_as('cashier@example.com');
select test.eq((settle_tab(pg_temp.id('b2'), 2, gen_random_uuid(), 'cash') ->> 'turn_no')::int, 9,
  'a bill from before numbers takes the next one when paid');

-- ----------------------------------------------------------- days, businesses
-- Each day starts again at 1, and each business has its own numbers.
select test.as_admin();
select test.eq(take_turn_no('00000000-0000-0000-0000-0000000000b1', test.today() + 1), 1,
  'tomorrow starts again at 1');
select test.eq(take_turn_no('00000000-0000-0000-0000-0000000000b1', test.today()), 10,
  'while today goes on from where it was');
select test.eq(take_turn_no('00000000-0000-0000-0000-0000000000b2', test.today()), 1,
  'another business has numbers of its own');

-- --------------------------------------------------------------------- access
-- Numbers are taken by the till's own functions, never by hand.
select test.act_as('owner@example.com');
select test.throws($$select take_turn_no('00000000-0000-0000-0000-0000000000b1', current_date)$$, '%permission denied%',
  'not even the owner takes a number by hand');
select test.act_as_anon();
select test.throws($$select * from pos_open_bills()$$, '%permission denied%', 'the public cannot read open bills');
select test.act_as('cashier@example.com');
select test.succeeds($$select * from pos_open_bills()$$, 'a signed-in cashier can');
