-- =============================================================================
-- Day close (G9, H-09) and period close (H-08, C-07): the close refuses while
-- anything is unresolved, and a locked period refuses every route in.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table today as select business_local_date('00000000-0000-0000-0000-0000000000b1', now()) d;
create temp table per as select id, name from accounting_period
  where business_id = '00000000-0000-0000-0000-0000000000b1' and (select d from today) between starts_on and ends_on;
grant select on today, per to public;

-- H-09 — trading days are in Baghdad time. 21:30 UTC on the 24th is 00:30 on the 25th.
select test.eq(business_local_date('00000000-0000-0000-0000-0000000000b1', '2026-08-24 21:30:00+00'),
  '2026-08-25'::date, 'a sale at 00:30 Baghdad belongs to the 25th, not the UTC 24th');

select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]');

-- The close refuses while a trading day is open and a draft is parked.
select test.act_as('owner@example.com');
create temp table dr as select save_journal((select d from today), 'Unfinished accrual',
  '[{"code":"6200","debit":1000},{"code":"1000","credit":1000}]', false) as r;
grant select on dr to public;
select test.throws($$select lock_period((select id from per))$$, '%Every trading day is closed%Not closed%', 'an unclosed day blocks the close');
select test.throws($$select lock_period((select id from per))$$, '%No draft journals%', 'a parked draft blocks the close');

-- G9 — close the day 2,000 short: Dr Cash over/short, Cr Cash.
select test.act_as('cashier@example.com');
select test.throws($$select close_day((select d from today), 3000)$$, '%permission%', 'a cashier does not close their own till');
select test.act_as('manager@example.com');
create temp table cl as select close_day((select d from today), 3000) as r;
select test.eq((select (r->>'expected')::numeric from cl), 5000::numeric, 'expected 5,000 cash');
select test.eq((select (r->>'variance')::numeric from cl), -2000::numeric, '2,000 short');
select test.as_admin();
select test.eq(test.lines_of((select id from work_shift where business_day = (select d from today))),
  '1000 Cr 2000 | 6300 Dr 2000', 'G9: the shortage is expensed');
select test.act_as('manager@example.com');
select test.throws($$select close_day((select d from today), 3000)$$, '%already closed%', 'a day closes once — no double-posted shortage');
select test.throws($$select close_day((select d from today) + 1, 0)$$, '%has happened%', 'a future day cannot be closed');

-- Resolve the blockers, then lock. Only someone with the lock permission may.
select test.act_as('owner@example.com');
select discard_journal((select (r->>'id')::uuid from dr));
select test.throws($$select discard_journal((select (r->>'id')::uuid from dr))$$, '%Only a draft%',
  'discarding something that is not a draft says so, instead of claiming success (M-09)');
select test.act_as('manager@example.com');
select test.throws($$select lock_period((select id from per))$$, '%permission%', 'a manager cannot lock the books');
select test.act_as('owner@example.com');
select test.ok(not exists (select 1 from period_close_checklist((select id from per)) where not ok), 'every close check passes');
select lock_period((select id from per), 'Month end');

-- C-07 — every route into a locked period is refused, and a refused sale
-- leaves nothing behind (C-06): no order, no movement, no journal.
select test.as_admin();
create temp table n0 as select (select count(*) from sales_order) o, (select count(*) from inventory_movement) m,
                               (select count(*) from journal_entry) j;
grant select on n0 to public;
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]')$$,
  '%is locked%', 'a sale into a locked period is refused');
select test.as_admin();
select test.eq((select count(*) from sales_order), (select o from n0), 'the refused sale left no order');
select test.eq((select count(*) from inventory_movement), (select m from n0), 'nor any stock movement');
select test.eq((select count(*) from journal_entry), (select j from n0), 'nor any journal');
select test.act_as('owner@example.com');
select test.throws($$select save_journal((select d from today), 'late entry', '[{"code":"6200","debit":5},{"code":"1000","credit":5}]', true)$$,
  '%is locked%', 'a manual journal into a locked period is refused');
select test.throws($$select record_expense('late rent', 100, '6000', 'cash', (select d from today))$$, '%is locked%', 'an expense too');
select test.as_admin();
select test.throws($$update accounting_period set name = 'renamed' where id = (select id from per)$$, '%cannot change%', 'a period''s identity is fixed');

-- Reopening: owner only, with a reason, recorded.
select test.act_as('manager@example.com');
select test.throws($$select unlock_period((select id from per), 'mistake')$$, '%permission%', 'a manager cannot reopen');
select test.act_as('owner@example.com');
select test.throws($$select unlock_period((select id from per), '')$$, '%why%', 'reopening needs a reason');
select unlock_period((select id from per), 'Supplier credit note arrived late');
select test.as_admin();
select test.eq((select reason from audit_log where action = 'period.open'), 'Supplier credit note arrived late',
  'the reopening and its reason are in the audit trail');
select test.ok((select app_user_id is not null from audit_log where action = 'period.locked'), 'and so is who locked it');

-- Year end: revenue and expenses close into retained earnings (M-05).
-- This year: revenue 5,000; COGS 400; shortage 2,000 -> profit 2,600.
select post_year_end_close('00000000-0000-0000-0000-0000000000b1', make_date(extract(year from (select d from today))::int, 12, 31));
select test.eq(test.balance('4000') + test.balance('5000') + test.balance('6300'), 0::numeric, 'P&L accounts are zero after the close');
select test.eq(test.balance('3100'), -2600::numeric, 'retained earnings holds the 2,600 profit');
