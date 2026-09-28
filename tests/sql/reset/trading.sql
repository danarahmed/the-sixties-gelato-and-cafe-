-- =============================================================================
-- A day of test trading, touching every kind of record the reset clears
-- (scripts/test-sql.sh, phase "reset"): the drawer open, a float, cash and
-- card sales, a sale paid in dollars at the rate a manager set, a void
-- approved by the owner's PIN (after a wrong one) and a refund, a delivery
-- billed and paid, a bill for a service under the
-- café's own number, an expense, waste, a blind count, a production batch,
-- the drawer's session closed with the takings to the safe and its dollars
-- counted, the dollars exchanged into the bank, cash banked, a
-- manual journal and its reversal, and a bill left open. Set-up made along the way (a table, a
-- batch recipe) is set-up, and stays.
-- =============================================================================
\set ON_ERROR_STOP 1
select test.golden_catalogue();
create function pg_temp.sell(p_tender text default 'cash') returns jsonb language sql as $$
  select record_sale(gen_random_uuid(), 'dine_in', p_tender::tender_type,
    '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb)
$$;

select test.act_as('owner@example.com');
select move_cash('owner', 'till', 20000, 'Float for the till');

select test.act_as('cashier@example.com');
create temp table s as select pg_temp.sell() r union all select pg_temp.sell() union all select pg_temp.sell() union all select pg_temp.sell('card');
grant select on s to public;
select test.act_as('manager@example.com');
select set_fx_rate('USD', 1310, 'Market rate this morning');
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', null, '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
  p_tenders => '[{"type":"cash","currency":"USD","usd":2,"rate":1310,"amount":2500}]'::jsonb);

-- The void approved by the owner's PIN (a wrong one first); the refund on the manager's word alone.
select test.as_admin();
create temp table owner_id as select id from app_user where email = 'owner@example.com';
grant select on owner_id to public;
select test.act_as('owner@example.com');
select set_my_pin('2468');
select test.act_as('manager@example.com');
select request_approval('void', (select id from owner_id), '1111',
  jsonb_build_object('order_id', (select r ->> 'order_id' from s limit 1)));
create temp table ap as select request_approval('void', (select id from owner_id), '2468',
  jsonb_build_object('order_id', (select r ->> 'order_id' from s limit 1))) r;
grant select on ap to public;
select void_sale((select (r ->> 'order_id')::uuid from s limit 1), null, 'rang_twice', (select (r ->> 'approval_id')::uuid from ap));
select refund_sale((select (r ->> 'order_id')::uuid from s offset 1 limit 1), 'did not like it');

create temp table sup as select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' order by name limit 1;
grant select on sup to public;
create temp table rcv as select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1,"unit_code":"kg","goods_value":10000}]'::jsonb) r;
grant select on rcv to public;
create temp table bill as select record_bill((select id from sup), 'TEST-INV-1', test.today(), 10000, 15,
  (select (r ->> 'receipt_id')::uuid from rcv)) r;
grant select on bill to public;
select test.act_as('owner@example.com');
select pay_bill((select (r ->> 'bill_id')::uuid from bill), 10000, 'bank');
select record_bill((select id from sup), null, test.today(), 3000, 0, null, '6200');
select record_expense('Cleaning products', 1500, '6900', 'bank');
select record_waste('c0000000-0000-0000-0000-000000000003', 1, null, 'damaged', 'dropped a bottle');
select save_table(null, 'Table 9', 'Garden', 4, 9);

select test.act_as('counter@example.com');
create temp table cnt as select start_stock_count(array['c0000000-0000-0000-0000-000000000002'::uuid]) id;
grant select on cnt to public;
select record_count((select id from cnt), 'c0000000-0000-0000-0000-000000000002', 97);
select submit_stock_count((select id from cnt));
select test.act_as('manager@example.com');
select approve_stock_count((select id from cnt));

select test.act_as('owner@example.com');
create temp table syrup as select save_batch_recipe(null, 'Golden syrup', '{"measure":"volume"}'::jsonb, 1, 'L',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":50,"unit_code":"g"}]'::jsonb) r;
grant select on syrup to public;
select record_production((select (r ->> 'recipe_id')::uuid from syrup), 1);

select test.act_as('manager@example.com');
select close_cash_session(25000, null, 20000, 'safe', p_usd_counted => 2);
select move_cash('safe', 'bank', 5000, 'Deposit');
select exchange_dollars('safe', 2, 2600, 'bank', 'Exchange office');

select test.act_as('owner@example.com');
create temp table mj as select save_journal(test.today(), 'Generator fuel',
  '[{"code":"6200","debit":2000},{"code":"1020","credit":2000}]'::jsonb, true) r;
grant select on mj to public;
select reverse_journal((select id from journal_entry where description = 'Generator fuel'), 'paid by the landlord');

select test.act_as('cashier@example.com');
select open_tab('dine_in', (select id from dining_table where name = 'Table 9'), 'Late customer', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb, null, null);

-- Someone who works here: their schedule and hours, a wrong PIN at the till,
-- an advance, and last month's payroll approved and paid (0049).
select test.act_as('owner@example.com');
create temp table rana as select save_employee(null, 'Rana', null, 'Barista',
  (select id from location where name = 'Main Branch'), (date_trunc('month', test.today()) - interval '1 month')::date, null) r;
grant select on rana to public;
select set_employee_pay((select (r ->> 'employee_id')::uuid from rana), 'monthly', 500000);
select set_clock_pin((select (r ->> 'employee_id')::uuid from rana), '2580');
select save_schedule(null, test.today(), test.today(), jsonb_build_array(jsonb_build_object(
  'employee_id', (select (r ->> 'employee_id')::uuid from rana), 'day', test.today(), 'starts', '08:00', 'ends', '16:00')));
select add_attendance((select (r ->> 'employee_id')::uuid from rana),
  ((date_trunc('month', test.today()) - interval '1 month')::date + 2 + time '08:00') at time zone 'Asia/Baghdad',
  ((date_trunc('month', test.today()) - interval '1 month')::date + 2 + time '16:00') at time zone 'Asia/Baghdad',
  'the till was down');
select test.act_as('cashier@example.com');
select clock_in((select (r ->> 'employee_id')::uuid from rana), '2580');
select clock_in((select (r ->> 'employee_id')::uuid from rana), '0000');
select test.act_as('owner@example.com');
select record_advance((select (r ->> 'employee_id')::uuid from rana), 20000, 'bank', 'rent');
create temp table pr as select draft_payroll((date_trunc('month', test.today()) - interval '1 month')::date) r;
grant select on pr to public;
select approve_payroll((select (r ->> 'run_id')::uuid from pr));
select pay_payroll((select (r ->> 'run_id')::uuid from pr), 'bank');

-- The owner opens the dashboard: its alerts are kept, one acknowledged; and a
-- threshold is changed.
select test.act_as('owner@example.com');
select acknowledge_alert((select id from current_alerts() where rule <> 'exceptions_person' limit 1), 'seen while testing');
select set_alert_thresholds('{"margin_target_percent": 65}');
-- And the café adds a language, and corrects an Arabic word.
select save_language('tr', 'Türkçe');
select save_phrases('tr', '{"Save": "Kaydet"}');
select save_phrases('ar', '{"Save": "احفظ"}');
select test.as_admin();
