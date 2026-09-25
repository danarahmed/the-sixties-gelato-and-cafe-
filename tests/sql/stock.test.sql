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

-- Opening stock goes into the books: Dr Inventory / Cr Owner equity. It is
-- capital the owner puts in, so it is the owner's, with a reason (0027).
select test.act_as('manager@example.com');
select test.throws($$select create_item('Oat milk', 'ingredient', 'ml', 'volume', p_opening_qty => 12000,
                                        p_opening_unit_cost => 3, p_opening_reason => 'the opening count')$$,
  '%Only the owner records opening stock%', 'a manager may create an item, but not give it opening stock');
select test.act_as('owner@example.com');
select test.throws($$select create_item('Oat milk', 'ingredient', 'ml', 'volume', p_opening_qty => 12000,
                                        p_opening_unit_cost => 3)$$,
  '%Say where this stock came from%', 'the owner says where it came from');
create temp table it as select create_item('Oat milk', 'ingredient', 'ml', 'volume', p_units => '[{"code":"carton","label":"1L carton","factor":1000}]',
  p_opening_qty => 12000, p_opening_unit_cost => 3, p_opening_reason => 'the opening count') as r;
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
select test.ok(not (select r ? 'value' from w), 'a barista records waste without being shown its cost');
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
select test.act_as('owner@example.com');
select test.eq((select count(*) from legacy_unposted())::int, 0,
  'everything the app records is journaled as it happens: nothing awaits a journal');

-- 0024 (audit P0-1) — trading during a count is not counted twice. The count
-- opens with beans at 700 g; an espresso (20 g) is sold and 1,000 g received
-- before the counter weighs them at 1,680 g, the true shelf: nothing is missing.
select test.act_as('owner@example.com');
select reject_stock_count((select id from c2), 'Counted by the manager alone; count again');
select test.act_as('counter@example.com');
create temp table c3 as select start_stock_count(array['c0000000-0000-0000-0000-000000000001'::uuid]) as id;
grant select on c3 to public;
select test.throws($$select start_stock_count(array['c0000000-0000-0000-0000-000000000002'::uuid])$$,
  '%already open here%', 'one count at a time: a second would post the same difference twice');
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]');
select test.act_as('manager@example.com');
select receive_goods((select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' limit 1),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1000,"goods_value":10000}]');
select test.act_as('counter@example.com');
select record_count((select id from c3), 'c0000000-0000-0000-0000-000000000001', 1680);
select submit_stock_count((select id from c3));
select test.act_as('manager@example.com');
select test.eq((select expected::text || '/' || counted::text || '/' || variance::text from review_stock_count((select id from c3))),
  '1680/1680/0', 'the reviewer sees the stock when it was counted: no difference');
create temp table ap3 as select approve_stock_count((select id from c3)) as r;
select test.eq((select (r->>'loss')::numeric + (r->>'gain')::numeric from ap3), 0::numeric, 'and nothing is posted');
select test.as_admin();
select test.eq((item_position('00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-000000000001', (select id from loc))).qty,
  1680::numeric, 'the ledger still says 1,680 g, what is on the shelf');
select test.eq((select count(*) from stock_count_line where stock_count_id = (select id from c3) and expected_at_count is not null)::int, 1,
  'the stock at the moment of counting is recorded with the line');

-- An open count can be cancelled, with a reason, by its counter or a manager.
select test.act_as('counter@example.com');
create temp table c4 as select start_stock_count(array['c0000000-0000-0000-0000-000000000002'::uuid]) as id;
grant select on c4 to public;
select test.throws($$select cancel_stock_count((select id from c4), ' ')$$, '%Say why%', 'cancelling needs a reason');
select test.act_as('cashier@example.com');
select test.throws($$select cancel_stock_count((select id from c4), 'x')$$, '%permission%', 'a cashier cannot cancel a count');
select test.act_as('counter@example.com');
select cancel_stock_count((select id from c4), 'Started by mistake');
select test.as_admin();
select test.eq((select status::text || ': ' || rejected_reason from stock_count where id = (select id from c4)),
  'rejected: Cancelled: Started by mistake', 'the count stays on record, cancelled, with the reason');
select test.ok(exists (select 1 from audit_log where action = 'inventory.count.cancel'), 'and the cancelling is on the audit trail');
select test.act_as('counter@example.com');
select test.succeeds($$select start_stock_count()$$, 'a new count can then be opened');
select test.as_admin();
select test.eq((select sum(value * sign(base_quantity_signed)) from inventory_movement where business_id = '00000000-0000-0000-0000-0000000000b1'),
  test.balance('1200'), 'the stock ledger still reconciles to 1200');

-- Opening stock for an item with no stock history, at what it cost (0024):
-- as a new item's opening stock, Dr Inventory / Cr Owner equity. Once the
-- item's stock has moved, only a count or a correction changes it.
select test.act_as('manager@example.com');
create temp table milk as
  select (create_item('Fresh milk', 'ingredient', 'ml', 'volume',
                      p_units => '[{"code":"l","label":"Litre","factor":1000}]'::jsonb) ->> 'item_id')::uuid as id;
grant select on milk to public;
select test.act_as('cashier@example.com');
select test.throws($$select record_opening_stock((select id from milk), 12, 'l', 1500, 'the opening count')$$, '%permission%',
  'a cashier cannot give stock an opening balance');
select test.act_as('manager@example.com');
select test.throws($$select record_opening_stock((select id from milk), 12, 'l', 1500, 'the opening count')$$,
  '%Only the owner records opening stock%', 'nor can a manager: it is capital the owner puts in (0027)');
select test.act_as('owner@example.com');
select test.throws($$select record_opening_stock((select id from milk), 12, 'l', 1500, '  ')$$,
  '%Say where this stock came from%', 'and the owner says where it came from');
select test.throws($$select record_opening_stock((select id from milk), 0, 'l', 1500, 'the opening count')$$, '%quantity on the shelf%',
  'the quantity must be more than zero');
select test.throws($$select record_opening_stock((select id from milk), 12, 'l', 0, 'the opening count')$$, '%Enter what one l of Fresh milk cost%',
  'and it needs its cost: stock at no cost would be sold at no cost');
select test.throws($$select record_opening_stock((select id from milk), 12, 'crate', 1500, 'the opening count')$$, '%not defined for this item%',
  'only in a unit the item has');
create temp table op as select record_opening_stock((select id from milk), 12.5, 'l', 1500, 'the opening count') as r;
select test.eq((select (r->>'qty')::numeric || ' ml worth ' || (r->>'value')::numeric from op), '12500 ml worth 18750',
  '12.5 litres at 1,500 a litre is 12,500 ml worth 18,750');
select test.as_admin();
select test.eq(test.lines_of((select (r->>'movement_id')::uuid from op)), '1200 Dr 18750 | 3000 Cr 18750',
  'journaled as a new item''s opening stock: Dr Inventory, Cr Owner equity');
select test.eq(item_issue_cost('00000000-0000-0000-0000-0000000000b1', (select id from milk), (select id from loc)), 1.5::numeric,
  'the milk is now issued at 1.5 a millilitre, not at nothing');
select test.eq((select reason || ' by ' || u.email from audit_log a join app_user u on u.id = a.app_user_id
                 where action = 'inventory.opening' and entity_id = (select r ->> 'movement_id' from op)),
  'the opening count by owner@example.com', 'the opening balance is on the audit trail, with who and why');
select test.act_as('owner@example.com');
select test.throws($$select record_opening_stock((select id from milk), 1, 'l', 1500, 'the opening count')$$, '%already has stock recorded here%',
  'a second opening balance is refused');
select test.throws($$select record_opening_stock('c0000000-0000-0000-0000-000000000001', 1, 'kg', 10000, 'the opening count')$$,
  '%Golden beans already has stock recorded here%', 'as is one for an item whose stock has moved');
select test.as_admin();
select test.eq((select sum(value * sign(base_quantity_signed)) from inventory_movement where business_id = '00000000-0000-0000-0000-0000000000b1'),
  test.balance('1200'), 'the stock ledger still reconciles to 1200');
