-- =============================================================================
-- Stock: opening balances, waste (G8) and its threshold, corrections, and the
-- blind two-person stock count (audit H-12). Every movement is journaled.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
-- A barista: may record waste, may not approve it.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000e', 'barista@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000000e');
insert into user_role (app_user_id, role) select id, 'barista' from app_user where email = 'barista@example.com';
create temp table loc as select default_location('00000000-0000-0000-0000-0000000000b1') id;
grant select on loc to public;

-- Opening stock goes into the books: Dr Inventory / Cr Owner equity.
select test.act_as('manager@example.com');
create temp table it as select create_item('Oat milk', 'ingredient', 'ml', 'volume', p_units => '[{"code":"carton","label":"1L carton","factor":1000}]',
  p_opening_qty => 12000, p_opening_unit_cost => 3) as r;
select test.eq((select (r->>'opening_value')::numeric from it), 36000::numeric, '12 L at 3/ml');
select test.eq(test.lines_of((select id from inventory_movement where item_id = (select (r->>'item_id')::uuid from it))),
  '1200 Dr 36000 | 3000 Cr 36000', 'opening stock is journaled');

-- G8 — waste: 100 g beans at 10/g.
select test.act_as('cashier@example.com');
select test.throws($$select record_waste('c0000000-0000-0000-0000-000000000001', 100, 'g', 'waste', 'dropped')$$,
  '%permission%', 'a cashier cannot write off stock');
select test.act_as('barista@example.com');
create temp table w as select record_waste('c0000000-0000-0000-0000-000000000001', 100, 'g', 'spoilage', 'left out overnight') as r;
select test.eq(test.lines_of((select (r->>'movement_id')::uuid from w)), '1200 Cr 1000 | 5300 Dr 1000', 'G8 waste journal');
select test.throws($$select record_waste('c0000000-0000-0000-0000-000000000001', 100, 'g', 'waste', '   ')$$,
  '%why%', 'waste needs a reason');
select test.throws($$select record_waste('c0000000-0000-0000-0000-000000000001', 100, 'g', 'sale_consumption', 'x')$$,
  '%Not a waste type%', 'only waste types may be written off');

-- Above the threshold, only someone with waste.approve can record it.
select test.as_admin();
update business set waste_approval_threshold = 500 where id = '00000000-0000-0000-0000-0000000000b1';
select test.act_as('barista@example.com');
select test.throws($$select record_waste('c0000000-0000-0000-0000-000000000001', 100, 'g', 'waste', 'bag split')$$,
  '%needs a manager%', 'large waste needs a manager');
select test.act_as('manager@example.com');
select record_waste('c0000000-0000-0000-0000-000000000001', 100, 'g', 'waste', 'bag split');

-- Corrections outside a count go to 5400.
create temp table adj as select adjust_stock('c0000000-0000-0000-0000-000000000001', -50, 'g', 'miscount at delivery') as r;
select test.eq(test.lines_of((select (r->>'movement_id')::uuid from adj)), '1200 Cr 500 | 5400 Dr 500', 'correction journal');
select test.act_as('cashier@example.com');
select test.throws($$select adjust_stock('c0000000-0000-0000-0000-000000000001', 10, 'g', 'x')$$, '%permission%',
  'a cashier cannot correct stock');

-- H-12 — the blind two-person count. Beans on hand now: 1000 - 100 - 100 - 50 = 750 g.
select test.act_as('counter@example.com');
create temp table c as select start_stock_count(array['c0000000-0000-0000-0000-000000000001'::uuid]) as id;
grant select on c to public;
select test.throws($$select * from review_stock_count((select id from c))$$, '%permission%',
  'the counter cannot see what the system expects (blind count)');
select test.throws($$update stock_count_line set expected_base = 700 where stock_count_id = (select id from c)$$,
  '%permission denied%', 'nor change the expectation');
select record_count((select id from c), 'c0000000-0000-0000-0000-000000000001', 0.7, 'kg');
select submit_stock_count((select id from c));
select test.throws($$select approve_stock_count((select id from c))$$, '%permission%', 'the counter cannot approve');

select test.act_as('manager@example.com');
select test.eq((select string_agg(expected::text || '/' || counted::text || '/' || variance::text || '/' || variance_value::text, ',')
                from review_stock_count((select id from c))), '750/700/-50/-500', 'the reviewer sees expected, counted, variance and value');
create temp table ap as select approve_stock_count((select id from c)) as r;
select test.eq((select (r->>'loss')::numeric from ap), 500::numeric, '50 g short at 10/g');
select test.as_admin();
select test.eq(test.lines_of((select id from c)), '1200 Cr 500 | 5400 Dr 500', 'count variance journal');
select test.eq((item_position('00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-000000000001', (select id from loc))).qty,
  700::numeric, 'the ledger now says 700 g, what was counted');

-- A person may not approve a count they did themselves.
select test.act_as('manager@example.com');
create temp table c2 as select start_stock_count(array['c0000000-0000-0000-0000-000000000002'::uuid]) as id;
grant select on c2 to public;
select record_count((select id from c2), 'c0000000-0000-0000-0000-000000000002', 100);
select submit_stock_count((select id from c2));
select test.throws($$select approve_stock_count((select id from c2))$$, '%someone other than%', 'no approving your own count');

select test.as_admin();
select test.eq((select sum(value * sign(base_quantity_signed)) from inventory_movement where business_id = '00000000-0000-0000-0000-0000000000b1'),
  test.balance('1200'), 'every stock change is in the books: ledger reconciles to 1200');
