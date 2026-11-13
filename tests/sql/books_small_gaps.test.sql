-- =============================================================================
-- Three of the books' smaller gaps (0114).
--   d. Yesterday's drawer closed 2,000 short; the ice paid from it, 1,500,
--      recorded today, explains 1,500 of the short: a cost of yesterday
--      (Dr 6900, Cr 6300), today's drawer untouched. Another 1,000 is more
--      than the 500 left of it: recorded today, as before, out of today's drawer.
--   e. Next month's rent, paid ahead for three months, is changed before its
--      first share (six months, another name); started this month, its share
--      is posted at once and it is changed no more. The night's round posts
--      nothing early.
--   f. Sara clocked 24 hours at the first branch and 8 at the second in the
--      month: her 400,000 is shared 300,000 and 100,000; Dara, with no hours,
--      at the place she works.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.bal(p text) returns numeric language sql security definer as $$ select test.balance(p) $$;
create function pg_temp.shift() returns uuid language sql security definer as $$
  select id from work_shift where kind = 'session' order by opened_at desc limit 1 $$;
create function pg_temp.paid_out() returns int language sql security definer as $$
  select count(*)::int from cash_event where kind = 'paid_out' $$;
grant execute on function pg_temp.r(text), pg_temp.bal(text), pg_temp.shift(), pg_temp.paid_out() to public;
insert into location (business_id, kind, name) values ('00000000-0000-0000-0000-0000000000b1', 'branch', 'Second Branch');
create temp table places as
  select (select id from location where business_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'branch'
           order by created_at limit 1) as first,
         (select id from location where name = 'Second Branch') as second;
grant select on places to public;

-- ------------------------------------------------------------------ d. a late payment
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 4)));
select close_cash_session(8000, null, 8000);
select test.as_admin();
-- That was yesterday's drawer (a closed day never changes: its guard stands aside for the test).
set session_replication_role = replica;
update work_shift set business_day = test.today() - 1 where id = pg_temp.shift();
set session_replication_role = origin;
select test.eq(pg_temp.bal('6300')::int, 2000, 'the drawer closed 2,000 short');
create temp table before as select pg_temp.bal('1000') as till, pg_temp.paid_out() as outs;
grant select on before to public;

select test.act_as('manager@example.com');
insert into res select 'ice', record_expense('Ice', 1500, '6900', 'till', test.today() - 1);
select test.eq((pg_temp.r('ice') -> 'explains_short' ->> 'amount')::int, 1500, 'the ice explains 1,500 of the short');
select test.eq(pg_temp.bal('6300')::int, 500, '500 of it left');
select test.eq(pg_temp.bal('6900')::int, 1500, 'the ice a cost');
select test.eq(pg_temp.bal('1000'), (select till from before), 'the till''s account as counted');
select test.eq(pg_temp.paid_out(), (select outs from before), 'and nothing paid out of today''s drawer');
select test.as_admin();
select test.eq((select incurred_on from expense where id = (pg_temp.r('ice') ->> 'expense_id')::uuid), test.today() - 1,
  'a cost of the day it was paid');
select test.eq((select count(*)::int from audit_log where action = 'expense.explains_short'), 1, 'on the audit trail');

select test.act_as('cashier@example.com');
select open_cash_session(8000);
select test.act_as('manager@example.com');
select test.throws(format('select record_expense(%L, 1000, %L, %L, %L)', 'Milk', '6900', 'till', test.today() - 1),
  'Money from the till or the safe is recorded the day it is taken out: today',
  'more than is left of the short: recorded as before, today');
insert into res select 'milk', record_expense('Milk', 1000, '6900', 'till');
select test.eq(pg_temp.r('milk') -> 'explains_short', null, 'today''s, as any');
select test.eq(pg_temp.paid_out(), (select outs from before) + 1, 'out of today''s drawer');
select test.eq(pg_temp.bal('6300')::int, 500, 'the short as it was');

-- ------------------------------------------------------------------ e. a prepaid expense
select test.act_as('owner@example.com');
create temp table m as select date_trunc('month', test.today())::date as this,
                              (date_trunc('month', test.today()) + interval '1 month')::date as next;
grant select on m to public;
insert into res select 'rent', record_prepaid_expense('Rent', 300000, '6000', 'bank', (select next from m), 3);
select test.eq(jsonb_array_length(pg_temp.r('rent') -> 'released'), 0, 'next month''s: nothing posted yet');
select update_prepaid_expense((pg_temp.r('rent') ->> 'prepaid_id')::uuid, 'Rent, the shop', '6000', (select next from m), 6);
select test.as_admin();
select test.eq((select description || ' ' || months from prepaid_expense where id = (pg_temp.r('rent') ->> 'prepaid_id')::uuid),
  'Rent, the shop 6', 'changed before its first share');
select test.eq(prepaid_tick(), 0, 'the night''s round posts nothing before its month');
select test.act_as('owner@example.com');
insert into res select 'now', update_prepaid_expense((pg_temp.r('rent') ->> 'prepaid_id')::uuid, 'Rent, the shop', '6000',
                                                     (select this from m), 6);
select test.eq(jsonb_array_length(pg_temp.r('now') -> 'released'), 1, 'started this month: its share is posted');
select test.throws(format('select update_prepaid_expense(%L, %L, %L, %L, 3)', pg_temp.r('rent') ->> 'prepaid_id',
                          'Rent', '6000', (select next from m)),
  'A prepaid expense stays as it was recorded once a share is posted%', 'and it is changed no more');
select test.eq(pg_temp.bal('6000')::int, 50000, 'a sixth of it, this month''s rent');

-- ------------------------------------------------------------------ f. a payroll by the hours
select save_employee(null, 'Sara', null, 'Barista', (select first from places), test.today() - 90, null, gen_random_uuid());
select save_employee(null, 'Dara', null, 'Barista', (select second from places), test.today() - 90, null, gen_random_uuid());
select test.as_admin();
create temp table lm as select (date_trunc('month', test.today()) - interval '1 month')::date as d;
grant select on lm to public;
select test.act_as('owner@example.com');
select set_employee_pay((select id from employee where full_name = 'Sara'), 'monthly', 400000, 8, null, 'Pay', gen_random_uuid());
select set_employee_pay((select id from employee where full_name = 'Dara'), 'monthly', 200000, 8, null, 'Pay', gen_random_uuid());
select test.as_admin();
insert into attendance (business_id, employee_id, location_id, clock_in, clock_out, work_day, source)
select e.business_id, e.id, g.place, (g.d + time '09:00') at time zone 'Asia/Baghdad',
       (g.d + time '17:00') at time zone 'Asia/Baghdad', g.d, 'till'
  from employee e,
       (select (select d from lm) + 1 as d, (select first from places) as place
        union all select (select d from lm) + 2, (select first from places)
        union all select (select d from lm) + 3, (select first from places)
        union all select (select d from lm) + 4, (select second from places)) g(d, place)
 where e.full_name = 'Sara';
select test.act_as('owner@example.com');
insert into res select 'run', draft_payroll((select d from lm), gen_random_uuid());
select test.as_admin();
select test.eq((payroll_gross_by_place((pg_temp.r('run') ->> 'run_id')::uuid) ->> ((select first from places)::text))::int,
  300000, 'Sara''s 24 hours at the first branch: 300,000');
select test.eq((payroll_gross_by_place((pg_temp.r('run') ->> 'run_id')::uuid) ->> ((select second from places)::text))::int,
  300000, 'her 8 at the second, 100,000, with Dara''s 200,000 where she works');
