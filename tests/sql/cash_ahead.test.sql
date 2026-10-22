-- =============================================================================
-- Cash ahead (0093, SMART_PLAN part 5): the next days of the café's money
-- from what it holds now, each weekday's usual takings, bills by when the café
-- would pay them, and regular payments when they come again; a warning for a
-- spell the bank would be short, with what to do (move from the safe, or ask
-- a supplier to take a bill later); the alert; who may read it.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.sup(p_name text) returns uuid language sql security definer as $$
  select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' and name = p_name
$$;
create function pg_temp.ahead(p_days int default 30) returns jsonb language sql security definer as $$
  select cash_ahead_for('00000000-0000-0000-0000-0000000000b1', now(), p_days)
$$;
create function pg_temp.day(p_n int) returns jsonb language sql as $$
  select pg_temp.ahead() -> 'days' -> (p_n - 1)
$$;
\set E '''[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]'''

-- ------------------------------------------------------------ who may read it
select test.act_as('cashier@example.com');
select test.throws('select cash_ahead()', '%profit.view%', 'a cashier sees no cash ahead');
select test.act_as('owner@example.com');
select test.throws('select cash_ahead(200)', 'Look 1 to 92 days ahead', '1 to 92 days');
select test.eq(jsonb_array_length(cash_ahead() -> 'days'), 30, 'the owner reads the next 30 days');

-- ------------------------------------------------------------ the takings
-- Two espressos in cash, and the drawer closed with all of it to the safe:
-- this weekday's cash into the safe is a quarter of it (four weeks of it).
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', :E);
select test.as_admin();
insert into res select 'expected', to_jsonb(coalesce(s.opening_counted, 0) + (session_figures(s.id)).moved)
  from work_shift s where s.business_id = '00000000-0000-0000-0000-0000000000b1' and s.kind = 'session'
   and s.closed_at is null order by s.opened_at desc limit 1;
select test.act_as('cashier@example.com');
select close_cash_session((select v::numeric from res where k = 'expected'), null, 0, 'safe');
select test.as_admin();
insert into res select 'to_safe', to_jsonb(sum(l.debit))
  from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
 where e.business_id = '00000000-0000-0000-0000-0000000000b1' and a.code = '1005' and e.reference_type = 'cash_transfer'
   and (e.occurred_at at time zone 'Asia/Baghdad')::date = test.today();
select test.eq((pg_temp.ahead() -> 'learnt' -> 'cash_in' ->> (extract(isodow from test.today())::int - 1))::numeric,
  (select v::numeric from res where k = 'to_safe') / 4,
  'this weekday brings a quarter of today''s cash to the safe: four of it in the four weeks');
select test.eq((pg_temp.day(7) ->> 'safe')::numeric - (pg_temp.day(6) ->> 'safe')::numeric,
  (select v::numeric from res where k = 'to_safe') / 4,
  'a week on, the same weekday puts as much into the safe (it is not banked: no banking days yet)');

-- ------------------------------------------------------------ regular payments
-- The rent paid twice, a month apart: it comes again a month after the last.
select test.act_as('owner@example.com');
select record_expense('Rent', 500000, '6000', 'bank', test.today() - 45);
select record_expense('Rent', 500000, '6000', 'bank', test.today() - 15);
select test.eq((select (x ->> 'day') || ' ' || (x ->> 'amount') || ' ' || (x ->> 'every')
                  from jsonb_array_elements(pg_temp.ahead() -> 'events') x
                 where x ->> 'kind' = 'regular' and x ->> 'label' like '%Rent%'),
  ((test.today() - 15) + interval '1 month')::date || ' -500000 month', 'the rent again, a month after the last');
-- Paid once only: not regular.
select record_expense('A new fridge', 900000, '6900', 'bank', test.today() - 20);
select test.eq((select count(*)::int from jsonb_array_elements(pg_temp.ahead() -> 'events') x
                 where x ->> 'label' like '%fridge%'), 0, 'something paid once is not expected again');

-- ------------------------------------------------------------ a bill, and a short bank
-- 8,000,000 in the bank, 5,000,000 of it moved to the safe; a dairy bill of
-- 3,000,000 due in 10 days.
select test.act_as('owner@example.com');
select save_journal(test.today(), 'Capital for the test', jsonb_build_array(
  jsonb_build_object('code', '1020', 'debit', 8000000), jsonb_build_object('code', '3000', 'credit', 8000000)),
  true, null, null, gen_random_uuid());
select move_cash('bank', 'safe', 5000000, 'For the test');
select record_bill(pg_temp.sup('Sulaymaniyah Dairy Co.'), 'CA-1', test.today(), 3000000, 10, null, '6200');
select test.eq((select x ->> 'kind' || ' ' || (x ->> 'day') || ' ' || (x ->> 'amount') || ' ' || (x ->> 'from')
                  from jsonb_array_elements(pg_temp.ahead() -> 'events') x where x ->> 'ref' = 'CA-1'),
  'bill ' || (test.today() + 10) || ' -3000000 bank',
  'the bill is paid on its due date, from the bank (no payments yet to learn the café''s days from)');
insert into res select 'bank_before', to_jsonb((pg_temp.day(9) ->> 'bank')::numeric);
select test.ok((select v::numeric from res where k = 'bank_before') < 3000000, 'the bank holds less than the bill');
select test.eq((pg_temp.ahead() -> 'warnings' -> 0 ->> 'from')::date, test.today() + 10, 'short from the day it is due');
select test.eq(pg_temp.ahead() -> 'warnings' -> 0 ->> 'account', 'bank', 'the bank');
select test.eq(pg_temp.ahead() -> 'warnings' -> 0 ->> 'action', 'move', 'the safe holds enough: move it to the bank');
select test.eq((pg_temp.ahead() -> 'warnings' -> 0 ->> 'move')::numeric,
  ceil(-(pg_temp.ahead() -> 'warnings' -> 0 ->> 'lowest')::numeric / 100000) * 100000,
  'how much: the shortfall, rounded up to 100,000');
select test.eq((pg_temp.ahead() -> 'warnings' -> 0 ->> 'move_by')::date, test.today() + 9, 'by the day before');
select test.eq(pg_temp.ahead() -> 'warnings' -> 0 -> 'due' -> 0 ->> 'ref', 'CA-1', 'what is due then: the bill');

-- The alert says so, on the Dashboard and the phone (the books go back
-- four weeks: the rent of 45 days ago).
select test.as_admin();
select test.eq((select rule || ' ' || urgency || ' ' || link from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'cash_short_ahead'),
  'cash_short_ahead orange /reports/cash-ahead', 'the alert, ten days ahead: orange, leading to Cash ahead');
select test.ok((select action from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'cash_short_ahead') like 'Move % from the safe to the bank by %.', 'with what to do');

-- A second, bigger bill two days later: more than the safe holds. Ask the supplier.
select test.act_as('owner@example.com');
select record_bill(pg_temp.sup('Kurdistan Coffee Imports'), 'CA-2', test.today(), 20000000, 12, null, '6200');
select test.eq(pg_temp.ahead() -> 'warnings' -> 0 ->> 'action', 'later', 'more than the safe holds: ask for later');
select test.eq(pg_temp.ahead() -> 'warnings' -> 0 -> 'later' ->> 'ref', 'CA-2', 'the biggest bill in the spell');
select test.as_admin();
select test.ok((select action from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'cash_short_ahead') = 'Ask Kurdistan Coffee Imports to take 20000000 later.',
  'the alert names the supplier and the bill');

-- As at a past moment: what was not recorded yet is not in it.
select test.as_admin();
select test.ok((select count(*) from jsonb_array_elements(
                  cash_ahead_for('00000000-0000-0000-0000-0000000000b1', now() - interval '1 hour', 30) -> 'events') x
                 where x ->> 'ref' = 'CA-1') = 0, 'an hour ago the bill was not recorded yet');
