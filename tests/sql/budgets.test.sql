-- =============================================================================
-- Budgets (0117): this month's rent budgeted at 3,000,000 and sales at
-- 30,000,000; read for the first ten days of a thirty-day month, a third of
-- each; set again, changed; 0 takes it off; who may.
-- =============================================================================
select test.golden_catalogue();
create temp table m as select date_trunc('month', test.today())::date as d,
  ((date_trunc('month', test.today()) + interval '1 month')::date - date_trunc('month', test.today())::date) as days;
grant select on m to public;
create temp table res (k text primary key, v jsonb);
grant all on res to public;

select test.act_as('owner@example.com');
select test.throws(format('select set_budget(%L, %L)', (select d from m), '{"1000": 5}'),
  'Account 1000 is not a revenue or a cost', 'only revenue and costs');
select test.throws(format('select set_budget(%L, %L)', (select d from m), '{"6000": -1}'), 'A budget is 0 or more',
  'never below 0');
select set_budget((select d from m), '{"6000": 3000000, "4000": 30000000}');
select test.eq((budget_month((select d from m)) ->> '6000')::int, 3000000, 'rent budgeted');
select test.eq((select amount::int from budget_for((select d from m), (select d from m) + 9) where code = '6000'),
  round(3000000 * 10.0 / (select days from m))::int, 'ten days of it: their share of the month');
select test.eq((select amount::int from budget_for((select d from m), (select d from m) + (select days from m) - 1)
                 where code = '4000'), 30000000, 'the whole month: all of it');
select set_budget((select d from m), '{"6000": 3500000, "4000": 0}');
select test.eq(budget_month((select d from m)), '{"6000": 3500000}'::jsonb, 'set again: changed, and 0 takes it off');
select test.as_admin();
select test.eq((select count(*)::int from audit_log where action = 'budget.set'), 2, 'each change on the audit trail');

select test.act_as('manager@example.com');
select test.throws(format('select set_budget(%L, %L)', (select d from m), '{"6000": 1}'),
  '%', 'a manager does not set it');
select test.act_as('cashier@example.com');
select test.throws(format('select * from budget_for(%L, %L)', (select d from m), (select d from m)), '%permission%',
  'nor does a cashier read it');
