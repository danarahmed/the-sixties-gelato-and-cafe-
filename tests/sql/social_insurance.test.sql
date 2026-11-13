-- =============================================================================
-- Social insurance (0112): Sara earns 600,000 a month and is insured; Dara is
-- on a trial and is not. Approving last month's payroll takes Sara's 5%
-- (30,000) from her pay and owes it with the café's 12% (72,000) to the
-- government; paying the government clears it; reopening undoes it. Her
-- payslip says so.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.person(p text) returns uuid language sql security definer as $$
  select id from employee where full_name = p $$;
create function pg_temp.bal(p text) returns numeric language sql security definer as $$ select test.balance(p) $$;
grant execute on function pg_temp.r(text), pg_temp.person(text), pg_temp.bal(text) to public;
create temp table d as select (date_trunc('month', test.today()) - interval '1 month')::date as lm;
grant select on d to public;
create temp table main as select default_location('00000000-0000-0000-0000-0000000000b1') as id;
grant select on main to public;

select test.act_as('owner@example.com');
select save_employee(null, 'Sara', null, 'Barista', (select id from main),
                     (select lm from d) - 30, null, gen_random_uuid());
select save_employee(null, 'Dara', null, 'Barista', (select id from main),
                     (select lm from d) - 30, null, gen_random_uuid());
select set_employee_pay(pg_temp.person('Sara'), 'monthly', 600000, 8, null, 'Her salary', gen_random_uuid());
select set_employee_pay(pg_temp.person('Dara'), 'monthly', 500000, 8, null, 'His salary', gen_random_uuid());

select test.throws($$select set_social_insurance(true, 60, 5)$$, 'Each part is from 0% to 50% of the salary',
  'a sensible percentage');
select set_social_insurance(true, 12, 5);
select set_employee_social_insurance(pg_temp.person('Dara'), false);
select test.eq(jsonb_array_length(social_insurance() -> 'off_for'), 1, 'Dara is on a trial');
select test.act_as('manager@example.com');
select test.throws($$select set_social_insurance(false)$$, '%permission%', 'a manager does not turn it off');

-- Last month's payroll.
select test.act_as('owner@example.com');
insert into res select 'run', draft_payroll((select lm from d), gen_random_uuid());
insert into res select 'ok', approve_payroll((pg_temp.r('run') ->> 'run_id')::uuid, gen_random_uuid());
select test.eq((pg_temp.r('ok') -> 'social_insurance' ->> 'employee')::numeric, 30000::numeric, 'Sara''s 5%: 30,000');
select test.eq((pg_temp.r('ok') -> 'social_insurance' ->> 'employer')::numeric, 72000::numeric, 'the café''s 12%: 72,000');
select test.as_admin();
select test.eq((select net::int from payroll_line where employee_id = pg_temp.person('Sara')), 570000,
  'Sara is paid 570,000');
select test.eq((select net::int from payroll_line where employee_id = pg_temp.person('Dara')), 500000,
  'Dara, on a trial, is paid all of it');
select test.eq(pg_temp.bal('2110')::int, -102000, '102,000 owed to the government');
select test.eq(pg_temp.bal('6120')::int, 72000, 'the café''s part is its cost');
select test.eq(pg_temp.bal('2100')::int, -1070000, 'what is owed to the staff is their nets');

-- Reopened, then approved again: counted once.
select test.act_as('owner@example.com');
select reopen_payroll((pg_temp.r('run') ->> 'run_id')::uuid, 'A day was missed', gen_random_uuid());
select test.as_admin();
select test.eq((select net::int || ' ' || si_employee::int from payroll_line where employee_id = pg_temp.person('Sara')),
  '600000 0', 'reopened: her pay as before it');
select test.eq(pg_temp.bal('2110')::int, 0, 'and nothing owed for it');
select test.act_as('owner@example.com');
select approve_payroll((pg_temp.r('run') ->> 'run_id')::uuid, gen_random_uuid());
select test.as_admin();
select test.eq((select net::int from payroll_line where employee_id = pg_temp.person('Sara')), 570000,
  'approved again: 570,000, counted once');
select test.eq(pg_temp.bal('2110')::int, -102000, '102,000 owed again');

-- The payslip.
select test.act_as('owner@example.com');
insert into res select 'slip', payslip((select id from payroll_line where employee_id = pg_temp.person('Sara')));
select test.eq((pg_temp.r('slip') ->> 'si_employee')::int, 30000, 'her payslip shows her 5%');
select test.eq((pg_temp.r('slip') ->> 'net')::int, 570000, 'and what she is paid');

-- The month's report, and paying the government.
select test.eq((social_insurance_month((select lm from d)) ->> 'left')::int, 102000, 'the month: 102,000 to pay');
select test.throws(format('select pay_social_insurance(%L, 200000, %L)', (select lm from d), 'bank'),
  '102000 is owed for that month: a payment is at most that', 'no more than is owed');
select pay_social_insurance((select lm from d), 102000, 'bank', 'Receipt 77', gen_random_uuid());
select test.eq((social_insurance_month((select lm from d)) ->> 'left')::int, 0, 'paid: nothing left');
select test.as_admin();
select test.eq(pg_temp.bal('2110')::int, 0, 'what was owed is cleared');
