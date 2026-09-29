-- =============================================================================
-- Staff, their hours and their pay (0049, release W): the people who work
-- here and their pay, seen only by those who see payroll; the schedule;
-- clocking in and out at the till with a name and a PIN; a record of hours
-- added, corrected or cancelled with why; lateness, leaving early, absence
-- and overtime; advances; a month's payroll drafted, adjusted, approved once
-- the month is over, reopened, and paid; the books checked; the alerts.
--
-- Last month, on its 10th to 12th: Sara (600,000 a month, 8 hours a day) is
-- on 08:00–16:00, in at 08:20 and out at 16:30, then 08:00–15:30, then absent;
-- Ali (3,000 an hour) works 14:00 to midnight; Noor (25,000 a day) works
-- 09:00–17:00 and 09:00–18:00; Omar (450,000 a month) started on the 16th;
-- Layla's pay is set late.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;
create function pg_temp.member(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
create function pg_temp.person(p_name text) returns uuid language sql security definer as $$
  select id from employee where full_name = p_name
$$;
-- The café's time on a day: pg_temp.at(day, '08:20').
create function pg_temp.at(p_day date, p_time text) returns timestamptz language sql as $$
  select (p_day + p_time::time) at time zone 'Asia/Baghdad'
$$;
create function pg_temp.alerts(p_rule text) returns text language sql security definer as $$
  select string_agg(urgency || ': ' || title, ' | ' order by title)
    from alert_conditions('00000000-0000-0000-0000-0000000000b1', now()) where rule = p_rule
$$;
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
$$;
create function pg_temp.line(p_run uuid, p_name text) returns payroll_line language sql security definer as $$
  select l.* from payroll_line l join employee e on e.id = l.employee_id where l.run_id = p_run and e.full_name = p_name
$$;
create function pg_temp.journal(p_ref_type text, p_ref uuid) returns text language sql security definer as $$
  select string_agg(a.code || case when l.debit > 0 then ' Dr ' || l.debit::text else ' Cr ' || l.credit::text end,
                    ' | ' order by a.code, l.debit desc, l.credit desc)
    from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
   where e.reference_type = p_ref_type and e.reference_id = p_ref and e.reverses_entry is null
     and not exists (select 1 from journal_entry rv where rv.reverses_entry = e.id)
$$;
create function pg_temp.owed(p_name text) returns numeric language sql security definer as $$
  select advance_owed('00000000-0000-0000-0000-0000000000b1', (select id from employee where full_name = p_name))
$$;
create function pg_temp.wrong_pins() returns int language sql security definer as $$
  select count(*)::int from clock_attempt where not ok
$$;
-- Orange until a week after payday, red after it.
create function pg_temp.due_urgency() returns text language sql as $$
  select case when test.today() > date_trunc('month', test.today())::date + 7 then 'red' else 'orange' end
$$;
create function pg_temp.main() returns uuid language sql security definer as $$
  select default_location('00000000-0000-0000-0000-0000000000b1')
$$;
-- A payroll's journal: its live approval's.
create function pg_temp.run_journal(p_run uuid) returns text language sql security definer as $$
  select string_agg(a.code || case when l.debit > 0 then ' Dr ' || l.debit::text else ' Cr ' || l.credit::text end,
                    ' | ' order by a.code, l.debit desc, l.credit desc)
    from payroll_run r join journal_line l on l.journal_entry_id = r.journal_entry_id
    join gl_account a on a.id = l.account_id
   where r.id = p_run
$$;
create function pg_temp.drawer() returns numeric language sql security definer as $$
  select (drawer_position_at('00000000-0000-0000-0000-0000000000b1',
                             default_location('00000000-0000-0000-0000-0000000000b1'), 'infinity')).amount
$$;

-- An accountant and an auditor, who sign in.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000e1', 'accountant@example.com'),
  ('a0000000-0000-0000-0000-0000000000e2', 'auditor@example.com');
insert into app_user (business_id, full_name, email, auth_user_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Accountant', 'accountant@example.com', 'a0000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Auditor', 'auditor@example.com', 'a0000000-0000-0000-0000-0000000000e2');
insert into user_role (app_user_id, role) select id, 'accountant' from app_user where email = 'accountant@example.com';
insert into user_role (app_user_id, role) select id, 'auditor' from app_user where email = 'auditor@example.com';

-- The days: last month's 10th, 11th and 12th, and the month two months back.
create temp table d as
select test.today() as today,
       (date_trunc('month', test.today()) - interval '1 month')::date as lm,
       (date_trunc('month', test.today()) - interval '1 month')::date + 9 as d1,
       (date_trunc('month', test.today()) - interval '1 month')::date + 10 as d2,
       (date_trunc('month', test.today()) - interval '1 month')::date + 11 as d3,
       (date_trunc('month', test.today()) - interval '2 month')::date as hired,
       (date_trunc('month', test.today()) - interval '1 month')::date + 15 as omar_hired,
       (date_trunc('month', test.today()) - interval '1 day')::date as lm_end;
grant select on d to public;

-- =============================================================================
-- 1. The accounts, the rules and who may
-- =============================================================================
select test.eq((select string_agg(code || ' ' || name || ' ' || account_type, '; ' order by code) from gl_account
                 where business_id = '00000000-0000-0000-0000-0000000000b1' and code in ('1300', '2100', '6100')),
               '1300 Employee advances asset; 2100 Salaries payable liability; 6100 Salaries expense',
               'advances and salaries owed have their accounts');
select test.ok(manual_journal_blocked('1300') and manual_journal_blocked('2100'),
               'advances and salaries owed take no manual journal');
select test.eq((select string_agg(k || '=' || (rule_value('00000000-0000-0000-0000-0000000000b1', k) #>> '{}'), ',' order by k)
                  from unnest(array['clocked_in_alert_hours', 'late_after_minutes', 'overtime_percent', 'payday']) k),
               'clocked_in_alert_hours=16,late_after_minutes=5,overtime_percent=150,payday=1',
               'the rules'' defaults: 16 hours, 5 minutes, 150%, the 1st');
select test.eq((select string_agg(role::text || ':' || permission, ',' order by role, permission) from role_permission
                 where permission in ('staff.manage', 'attendance.edit', 'payroll.view', 'payroll.run')),
               'owner:attendance.edit,owner:payroll.run,owner:payroll.view,owner:staff.manage,'
               || 'general_manager:attendance.edit,general_manager:payroll.run,general_manager:payroll.view,general_manager:staff.manage,'
               || 'branch_manager:attendance.edit,branch_manager:staff.manage,'
               || 'accountant:payroll.run,accountant:payroll.view,auditor:payroll.view',
               'who may look after staff, their hours and their pay');

-- =============================================================================
-- 2. The people, and their pay
-- =============================================================================
select test.act_as('cashier@example.com');
select test.throws($$select save_employee(null, 'Sara', null, null, pg_temp.main(), test.today(), null, gen_random_uuid())$$,
                   '%needs staff.manage%', 'a cashier does not add people');
select test.act_as('manager@example.com');
insert into res select 'sara', save_employee(null, ' Sara ', '0750 123 4567', 'Barista',
                                             pg_temp.main(),
                                             (select hired from d), null, gen_random_uuid());
select test.throws($$select save_employee(null, 'sara', null, null, pg_temp.main(), test.today(), null, gen_random_uuid())$$,
                   'Someone here is called sara already%', 'two people are not called the same');
select test.throws($$select save_employee(null, '  ', null, null, pg_temp.main(), test.today(), null, gen_random_uuid())$$,
                   'Type the person''s name', 'a person has a name');
select test.throws($$select save_employee(null, 'Tara', null, null, pg_temp.main(), null, null, gen_random_uuid())$$,
                   'Say when they started', 'a person has a start');
select save_employee(null, 'Ali', null, 'Night bar', pg_temp.main(),
                     (select hired from d), null, gen_random_uuid());
select save_employee(null, 'Noor', null, 'Kitchen', pg_temp.main(),
                     (select hired from d), null, gen_random_uuid());
select save_employee(null, 'Omar', null, 'Barista', pg_temp.main(),
                     (select omar_hired from d), null, gen_random_uuid());
select save_employee(null, 'Layla', null, 'Cleaning', pg_temp.main(),
                     (select hired from d), null, gen_random_uuid());
-- Dana is the cashier's login, starting today; Karim starts today too.
select save_employee(null, 'Dana', null, 'Cashier', pg_temp.main(),
                     test.today(), pg_temp.member('cashier@example.com'), gen_random_uuid());
select test.throws($$select save_employee(null, 'Karim', null, null, pg_temp.main(), test.today(), pg_temp.member('cashier@example.com'), gen_random_uuid())$$,
                   'Demo Cashier is the login of someone else already', 'a login is one person''s');
select save_employee(null, 'Karim', null, 'Runner', pg_temp.main(),
                     test.today(), null, gen_random_uuid());
-- The manager sees no pay, and sets none.
select test.throws($$select set_employee_pay(pg_temp.person('Sara'), 'monthly', 600000, 8, null, null, gen_random_uuid())$$,
                   '%needs payroll.run%', 'a branch manager does not set pay');
select test.ok((select bool_and(not (x ? 'rate') and not (x ? 'pay_basis') and (x ->> 'pay_set') = 'false')
                  from jsonb_array_elements(staff_list()) x), 'a branch manager sees nobody''s pay');
select test.throws($$select rate from employee$$, '%permission denied%', 'a person''s pay is not read from the table');
select test.throws($$select clock_pin_hash from employee$$, '%permission denied%', 'nor their PIN');
select test.eq((select count(*)::int from employee), 7, 'the people are read from the table');

select test.act_as('owner@example.com');
select test.throws($$select set_employee_pay(pg_temp.person('Sara'), 'weekly', 600000, 8, null, null, gen_random_uuid())$$,
                   'Choose how they are paid%', 'paid by the month, the day or the hour');
select test.throws($$select set_employee_pay(pg_temp.person('Sara'), 'monthly', 600000, 0, null, null, gen_random_uuid())$$,
                   'A day''s hours are more than 0 and at most 16', 'a day has hours');
select test.throws($$select set_employee_pay(pg_temp.person('Sara'), 'monthly', 600000, 8, 90, null, gen_random_uuid())$$,
                   'Overtime is paid at 100% to 300%%', 'overtime is paid at least as an hour');
select set_employee_pay(pg_temp.person('Sara'), 'monthly', 600000, 8, null, 'started', gen_random_uuid());
select set_employee_pay(pg_temp.person('Ali'), 'hourly', 3000, 8, null, null, gen_random_uuid());
select set_employee_pay(pg_temp.person('Noor'), 'daily', 25000, 8, null, null, gen_random_uuid());
select set_employee_pay(pg_temp.person('Omar'), 'monthly', 450000, 8, null, null, gen_random_uuid());
select test.eq((select x ->> 'rate' from jsonb_array_elements(staff_list()) x where x ->> 'name' = 'Sara'), '600000',
               'the owner sees the pay');
-- What someone is paid is on the audit trail for those who see payroll only.
select test.eq((select count(*)::int from audit_log where action = 'staff.pay'), 4, 'the owner reads the pay''s changes');
select test.act_as('manager@example.com');
select test.eq((select count(*)::int from audit_log where action = 'staff.pay'), 0,
               'a branch manager, who reads the audit trail, does not read what anyone is paid');
select test.eq((select count(*)::int from audit_log where action = 'staff.save'), 7, 'but reads who was added');
select test.act_as('accountant@example.com');
select test.eq((select count(*)::int from audit_log where action = 'staff.pay'), 4, 'the accountant does');

-- PINs: set by a manager, or by the person their login is.
select test.act_as('cashier@example.com');
select test.throws($$select set_clock_pin(pg_temp.person('Sara'), '2580')$$, '%needs staff.manage%',
                   'a cashier does not set someone else''s PIN');
select set_clock_pin(pg_temp.person('Dana'), '3690');
select test.act_as('manager@example.com');
select test.throws($$select set_clock_pin(pg_temp.person('Sara'), '12')$$, 'A PIN is 4 to 8 digits', 'a PIN is 4 to 8 digits');
select test.throws($$select set_clock_pin(pg_temp.person('Sara'), '1111')$$, 'Choose a PIN that is harder to guess', 'not one digit');
select test.throws($$select set_clock_pin(pg_temp.person('Sara'), '4567')$$, 'Choose a PIN that is harder to guess', 'not a run');
select set_clock_pin(pg_temp.person('Ali'), '7391');
select set_clock_pin(pg_temp.person('Karim'), '8264');

-- =============================================================================
-- 3. The schedule
-- =============================================================================
select test.act_as('manager@example.com');
insert into res select 'week', save_schedule(pg_temp.main(),
  (select d1 from d), (select d3 from d),
  jsonb_build_array(
    jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d1 from d), 'starts', '08:00', 'ends', '16:00'),
    jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d2 from d), 'starts', '08:00', 'ends', '16:00'),
    jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d3 from d), 'starts', '08:00', 'ends', '16:00',
                       'note', 'opening'),
    jsonb_build_object('employee_id', pg_temp.person('Ali'), 'day', (select d1 from d), 'starts', '14:00', 'ends', '00:00')),
  gen_random_uuid());
select test.eq((pg_temp.r('week') ->> 'shifts')::int, 4, 'four stretches of hours');
select test.eq((select ends_at - starts_at from shift_schedule where employee_id = pg_temp.person('Ali')),
               interval '10 hours', 'hours ending at midnight end the next day');
select test.throws($$select save_schedule(null, (select d1 from d), (select d1 from d),
                      jsonb_build_array(jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d1 from d), 'starts', '08:00', 'ends', '12:00'),
                                        jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d1 from d), 'starts', '14:00', 'ends', '18:00')),
                      gen_random_uuid())$$,
                   'Sara has one stretch of hours on % at most', 'one stretch of hours a day');
select test.throws($$select save_schedule(null, (select d1 from d), (select d1 from d),
                      jsonb_build_array(jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d2 from d), 'starts', '08:00', 'ends', '12:00')),
                      gen_random_uuid())$$,
                   'Each day of the hours is within the dates chosen', 'the hours are within the dates');
select test.throws($$select save_schedule(null, (select d1 from d), (select d1 from d),
                      jsonb_build_array(jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d1 from d), 'starts', 'eight', 'ends', '12:00')),
                      gen_random_uuid())$$,
                   'Give the hours as 08:00 to 16:00', 'hours are read as times');
select test.throws($$select save_schedule(null, (select d1 from d), (select d1 from d),
                      jsonb_build_array(jsonb_build_object('employee_id', pg_temp.person('Omar'), 'day', (select d1 from d), 'starts', '08:00', 'ends', '12:00')),
                      gen_random_uuid())$$,
                   'Omar does not work here on %', 'nobody is on the schedule before they start');
-- Hours at the kitchen the same day as the branch's.
select test.throws($$select save_schedule((select id from location where name = 'Central Kitchen'), (select d1 from d), (select d1 from d),
                      jsonb_build_array(jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d1 from d), 'starts', '17:00', 'ends', '20:00')),
                      gen_random_uuid())$$,
                   'Sara works at Main Branch on % already', 'one place a day');
-- Hours running into the next day's.
select test.throws($$select save_schedule(null, (select d1 from d) - 1, (select d1 from d) - 1,
                      jsonb_build_array(jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d1 from d) - 1, 'starts', '22:00', 'ends', '09:00')),
                      gen_random_uuid())$$,
                   'Sara''s hours overlap on %', 'hours do not overlap');
select test.eq((select count(*)::int from jsonb_array_elements(staff_schedule((select d1 from d), (select d3 from d)) -> 'shifts')),
               4, 'the schedule reads back');
select test.act_as('cashier@example.com');
select test.throws($$select staff_schedule(test.today(), test.today())$$, '%needs staff.manage%', 'a cashier does not read the schedule');

-- =============================================================================
-- 4. Clocking at the till
-- =============================================================================
select test.act_as('cashier@example.com');
select test.eq((select string_agg(x ->> 'name' || ':' || (x ->> 'has_pin'), ',' order by x ->> 'name')
                  from jsonb_array_elements(clock_board()) x),
               'Ali:true,Dana:true,Karim:true,Layla:false,Noor:false,Omar:false,Sara:false',
               'the till lists who works here today');
select test.eq(clock_in(pg_temp.person('Sara'), '2580', null, gen_random_uuid()) ->> 'error',
               'Sara has no PIN yet: a manager sets one on Staff', 'no PIN, no clocking');
select test.eq(clock_in(pg_temp.person('Ali'), '0000', null, gen_random_uuid()) ->> 'error', 'That PIN is not right',
               'a wrong PIN');
select test.eq(pg_temp.wrong_pins(), 1, 'the wrong PIN is kept');
select clock_in(pg_temp.person('Ali'), '0001', null, gen_random_uuid());
select clock_in(pg_temp.person('Ali'), '0002', null, gen_random_uuid());
select test.eq(clock_in(pg_temp.person('Ali'), '7391', null, gen_random_uuid()) ->> 'error',
               'Too many wrong PINs from this login: try again in 15 minutes', 'three wrong from one login pause it');
select test.as_admin();
delete from clock_attempt;
select test.act_as('cashier@example.com');
insert into res select 'ali_in', clock_in(pg_temp.person('Ali'), '7391', null, 'b0000000-0000-0000-0000-000000000001');
select test.ok((pg_temp.r('ali_in') ->> 'ok')::boolean and pg_temp.r('ali_in') ? 'attendance_id', 'Ali clocks in');
select test.eq((clock_in(pg_temp.person('Ali'), '7391', null, 'b0000000-0000-0000-0000-000000000001')
                ->> 'attendance_id')::uuid, pg_temp.id('ali_in', 'attendance_id'), 'sent twice, clocked in once');
select test.ok(clock_in(pg_temp.person('Ali'), '7391', null, gen_random_uuid()) ->> 'error' like 'Ali is clocked in already, since %',
               'nobody clocks in twice');
select test.as_admin();
select test.eq((select count(*)::int from attendance where employee_id = pg_temp.person('Ali')), 1, 'one record');
select test.act_as('cashier@example.com');
select test.eq((select x ->> 'in_since' is not null from jsonb_array_elements(clock_board()) x where x ->> 'name' = 'Ali'),
               true, 'the till shows who is in');
select test.eq(clock_out(pg_temp.person('Ali'), '0000', gen_random_uuid()) ->> 'error', 'That PIN is not right',
               'clocking out takes the PIN too');
insert into res select 'ali_out', clock_out(pg_temp.person('Ali'), '7391', gen_random_uuid());
select test.ok((pg_temp.r('ali_out') ->> 'ok')::boolean and (pg_temp.r('ali_out') ->> 'minutes')::int = 0, 'Ali clocks out');
select test.eq(clock_out(pg_temp.person('Ali'), '7391', gen_random_uuid()) ->> 'error', 'Ali is not clocked in',
               'nobody clocks out twice');
select test.as_admin();
select test.eq((select source || ':' || (recorded_by = pg_temp.member('cashier@example.com'))::text
                  from attendance where employee_id = pg_temp.person('Ali')), 'till:true', 'the till''s login is kept');
-- Twenty wrong PINs for one person in a day pause them until a new PIN.
insert into clock_attempt (business_id, employee_id, requested_by, ok)
select '00000000-0000-0000-0000-0000000000b1', pg_temp.person('Karim'), pg_temp.member('owner@example.com'), false
  from generate_series(1, 20);
select test.act_as('cashier@example.com');
select test.eq(clock_in(pg_temp.person('Karim'), '8264', null, gen_random_uuid()) ->> 'error',
               'Clocking by PIN is paused for Karim after too many wrong PINs today: a manager sets a new PIN on Staff',
               'twenty wrong PINs pause that person');
select test.act_as('manager@example.com');
select set_clock_pin(pg_temp.person('Karim'), '8265');
select test.act_as('cashier@example.com');
select test.ok((clock_in(pg_temp.person('Karim'), '8265', null, gen_random_uuid()) ->> 'ok')::boolean,
               'a new PIN lifts the pause');
-- Someone clocked in does not leave; their last day takes them off the schedule after it.
select test.act_as('manager@example.com');
select test.throws($$select set_employee_left(pg_temp.person('Karim'), test.today(), 'moved away', gen_random_uuid())$$,
                   'Karim is clocked in: clock them out first', 'someone clocked in has not left');
select test.act_as('cashier@example.com');
select clock_out(pg_temp.person('Karim'), '8265', gen_random_uuid());
select test.act_as('manager@example.com');
select save_schedule(null, test.today() + 1, test.today() + 1,
                     jsonb_build_array(jsonb_build_object('employee_id', pg_temp.person('Karim'), 'day', test.today() + 1,
                                                          'starts', '09:00', 'ends', '13:00')), gen_random_uuid());
select test.throws($$select set_employee_left(pg_temp.person('Karim'), test.today(), '', gen_random_uuid())$$,
                   'Say why they leave', 'a last day has a why');
select test.throws($$select set_employee_left(pg_temp.person('Karim'), test.today() - 1, 'moved away', gen_random_uuid())$$,
                   'They cannot leave before they started%', 'nobody leaves before they start');
insert into res select 'karim_left', set_employee_left(pg_temp.person('Karim'), test.today(), 'moved away', gen_random_uuid());
select test.eq((pg_temp.r('karim_left') ->> 'shifts_removed')::int, 1, 'their hours after their last day go');
select test.act_as('cashier@example.com');
select test.eq((select count(*)::int from jsonb_array_elements(clock_board()) x where x ->> 'name' = 'Karim'), 1,
               'someone works here on their last day');

-- =============================================================================
-- 5. Records of hours added, corrected and cancelled
-- =============================================================================
select test.act_as('cashier@example.com');
select test.throws($$select add_attendance(pg_temp.person('Sara'), pg_temp.at((select d1 from d), '08:20'), pg_temp.at((select d1 from d), '16:30'), 'forgot', null, gen_random_uuid())$$,
                   '%needs attendance.edit%', 'a cashier does not add hours');
select test.act_as('manager@example.com');
select test.throws($$select add_attendance(pg_temp.person('Sara'), pg_temp.at((select d1 from d), '08:20'), pg_temp.at((select d1 from d), '16:30'), ' ', null, gen_random_uuid())$$,
                   'Say why the hours are added', 'hours added have a why');
insert into res select 'sara1', add_attendance(pg_temp.person('Sara'), pg_temp.at((select d1 from d), '08:20'),
                                               pg_temp.at((select d1 from d), '16:30'), 'the till was down', null,
                                               gen_random_uuid());
select add_attendance(pg_temp.person('Sara'), pg_temp.at((select d2 from d), '08:00'), pg_temp.at((select d2 from d), '15:30'),
                      'the till was down', null, gen_random_uuid());
select add_attendance(pg_temp.person('Ali'), pg_temp.at((select d1 from d), '14:00'), pg_temp.at((select d1 from d) + 1, '00:00'),
                      'the till was down', null, gen_random_uuid());
select add_attendance(pg_temp.person('Noor'), pg_temp.at((select d1 from d), '09:00'), pg_temp.at((select d1 from d), '17:00'),
                      'the till was down', null, gen_random_uuid());
insert into res select 'noor2', add_attendance(pg_temp.person('Noor'), pg_temp.at((select d2 from d), '09:00'),
                                               pg_temp.at((select d2 from d), '17:30'), 'the till was down', null,
                                               gen_random_uuid());
select test.throws($$select add_attendance(pg_temp.person('Sara'), pg_temp.at((select d1 from d), '16:00'), pg_temp.at((select d1 from d), '18:00'), 'twice', null, gen_random_uuid())$$,
                   'Sara has other hours recorded then, from %', 'hours do not overlap');
select test.throws($$select add_attendance(pg_temp.person('Sara'), pg_temp.at((select d3 from d), '18:00'), pg_temp.at((select d3 from d), '08:00'), 'x', null, gen_random_uuid())$$,
                   'They clock out after they clock in', 'out after in');
select test.throws($$select add_attendance(pg_temp.person('Sara'), now() + interval '1 hour', null, 'x', null, gen_random_uuid())$$,
                   'The hours cannot be in the future', 'not in the future');
select test.throws($$select add_attendance(pg_temp.person('Sara'), pg_temp.at((select d3 from d), '06:00'), pg_temp.at((select d3 from d) + 1, '08:00'), 'x', null, gen_random_uuid())$$,
                   'One record is a day of hours at most', 'a day at most');
select test.throws($$select add_attendance(pg_temp.person('Omar'), pg_temp.at((select d1 from d), '09:00'), pg_temp.at((select d1 from d), '17:00'), 'x', null, gen_random_uuid())$$,
                   'Omar does not work here on %', 'nobody works before they start');
-- Corrected, with why: Noor left at 18:00, not 17:30.
select test.throws(format($$select correct_attendance(%L, pg_temp.at((select d2 from d), '09:00'), pg_temp.at((select d2 from d), '18:00'), '', gen_random_uuid())$$,
                          pg_temp.id('noor2', 'attendance_id')),
                   'Say why the hours are corrected', 'a correction has a why');
select correct_attendance(pg_temp.id('noor2', 'attendance_id'), pg_temp.at((select d2 from d), '09:00'),
                          pg_temp.at((select d2 from d), '18:00'), 'stayed to close', gen_random_uuid());
select test.eq((select edit_reason || ' ' || to_char(clock_out at time zone 'Asia/Baghdad', 'HH24:MI') from attendance
                 where id = pg_temp.id('noor2', 'attendance_id')), 'stayed to close 18:00', 'the correction and its why');
-- A mistake cancelled: someone clocked in wrongly.
insert into res select 'wrong', add_attendance(pg_temp.person('Layla'), pg_temp.at((select d3 from d), '10:00'),
                                               pg_temp.at((select d3 from d), '11:00'), 'clocked the wrong person', null,
                                               gen_random_uuid());
select test.throws(format($$select cancel_attendance(%L, '', gen_random_uuid())$$, pg_temp.id('wrong', 'attendance_id')),
                   'Say why the record is cancelled', 'a cancellation has a why');
select cancel_attendance(pg_temp.id('wrong', 'attendance_id'), 'it was Noor''s card', gen_random_uuid());
select test.throws(format($$select cancel_attendance(%L, 'again', gen_random_uuid())$$, pg_temp.id('wrong', 'attendance_id')),
                   'That record was cancelled', 'cancelled once');
select test.throws(format($$select correct_attendance(%L, pg_temp.at((select d3 from d), '10:00'), pg_temp.at((select d3 from d), '12:00'), 'x', gen_random_uuid())$$,
                          pg_temp.id('wrong', 'attendance_id')),
                   'That record was cancelled', 'a cancelled record is not corrected');
select test.as_admin();
select test.throws(format($$delete from attendance where id = %L$$, pg_temp.id('wrong', 'attendance_id')),
                   'A record of hours is cancelled, not deleted', 'hours are never deleted');
select test.eq((select string_agg(action, ',' order by action) from audit_log where action like 'attendance.%'),
               'attendance.add,attendance.add,attendance.add,attendance.add,attendance.add,attendance.add,attendance.cancel,attendance.correct',
               'every change of hours is on the audit trail');

-- =============================================================================
-- 6. Late, early, absent, overtime
-- =============================================================================
select test.as_admin();
create temp table days as
select e.full_name as name, x.* from staff_days('00000000-0000-0000-0000-0000000000b1', (select d1 from d), (select d3 from d)) x
  join employee e on e.id = x.employee_id;
select test.eq((select string_agg(name || ' ' || to_char(day, 'DD') || ': ' || minutes || 'm, late ' || coalesce(late_minutes::text, '-')
                                  || ', early ' || coalesce(early_minutes::text, '-') || ', over ' || overtime_minutes
                                  || case when absent then ', absent' else '' end, '; ' order by name, day)
                  from days),
               format('Ali %s: 600m, late -, early -, over 120; Noor %s: 480m, late -, early -, over 0; '
                      || 'Noor %s: 540m, late -, early -, over 60; Sara %s: 490m, late 20, early -, over 10; '
                      || 'Sara %s: 450m, late -, early 30, over 0; Sara %s: 0m, late -, early -, over 0, absent',
                      to_char((select d1 from d), 'DD'), to_char((select d1 from d), 'DD'), to_char((select d2 from d), 'DD'),
                      to_char((select d1 from d), 'DD'), to_char((select d2 from d), 'DD'), to_char((select d3 from d), 'DD')),
               'late, early, absent and overtime, day by day');
select test.act_as('manager@example.com');
insert into res select 'report', report_staff((select d1 from d), (select d3 from d));
select test.eq((select x ->> 'days_worked' || '/' || (x ->> 'days_scheduled') || ' ' || (x ->> 'minutes') || 'm late '
                       || (x ->> 'times_late') || ' early ' || (x ->> 'times_early') || ' absent ' || (x ->> 'days_absent')
                  from jsonb_array_elements(pg_temp.r('report') -> 'people') x where x ->> 'name' = 'Sara'),
               '2/3 940m late 1 early 1 absent 1', 'the report adds them up');
select test.ok(pg_temp.r('report') -> 'labour' = 'null'::jsonb, 'a branch manager does not see what staff cost');
select test.eq((select count(*)::int from jsonb_array_elements(attendance_list((select d1 from d), (select d3 from d)) -> 'records')), 6,
               'the records of hours, the cancelled one with them');

-- =============================================================================
-- 7. Advances
-- =============================================================================
select test.act_as('manager@example.com');
select test.throws($$select record_advance(pg_temp.person('Sara'), 50000, 'bank', 'rent', gen_random_uuid())$$,
                   '%needs payroll.run%', 'a branch manager gives no advance');
select test.act_as('owner@example.com');
select test.throws($$select record_advance(pg_temp.person('Sara'), 0, 'bank', 'rent', gen_random_uuid())$$,
                   'Enter an amount greater than zero', 'an advance is money');
select test.throws($$select record_advance(pg_temp.person('Sara'), 50000, 'bank', ' ', gen_random_uuid())$$,
                   'Say what the advance is for', 'an advance has a why');
select test.throws($$select record_advance(pg_temp.person('Sara'), 50000, 'card', 'rent', gen_random_uuid())$$,
                   'Say where the money came from: the till, the safe, the bank or the owner', 'from a place money is kept');
select test.throws($$select record_advance(pg_temp.person('Sara'), 50000, 'safe', 'rent', gen_random_uuid())$$,
                   'The safe holds only%', 'not from an empty safe');
insert into res select 'adv_bank', record_advance(pg_temp.person('Sara'), 100000, 'bank', 'rent', 'b0000000-0000-0000-0000-000000000002');
select test.eq((record_advance(pg_temp.person('Sara'), 100000, 'bank', 'rent', 'b0000000-0000-0000-0000-000000000002')
                ->> 'advance_id')::uuid, pg_temp.id('adv_bank', 'advance_id'), 'sent twice, given once');
select test.eq(pg_temp.journal('employee_advance', pg_temp.id('adv_bank', 'advance_id')), '1020 Cr 100000 | 1300 Dr 100000',
               'an advance from the bank: Dr 1300, Cr 1020');
-- From the till: the drawer holds what the owner put in it.
select move_cash('owner', 'till', 200000, 'float', null, gen_random_uuid());
select test.eq(pg_temp.drawer(), 200000::numeric, 'the drawer holds 200,000');
insert into res select 'adv_till', record_advance(pg_temp.person('Sara'), 50000, 'till', 'doctor', gen_random_uuid());
select test.eq(pg_temp.drawer(), 150000::numeric, 'an advance from the till leaves the drawer');
select test.eq((pg_temp.r('adv_till') ->> 'owed')::numeric, 150000::numeric, 'Sara owes 150,000 of advances');
select test.throws(format($$select cancel_advance(%L, '', gen_random_uuid())$$, pg_temp.id('adv_till', 'advance_id')),
                   'Say why the advance is cancelled', 'a cancellation has a why');
insert into res select 'adv_cancel', cancel_advance(pg_temp.id('adv_till', 'advance_id'), 'given twice', gen_random_uuid());
select test.eq(pg_temp.drawer(), 200000::numeric, 'the cash is back in the drawer');
select test.eq((pg_temp.r('adv_cancel') ->> 'owed')::numeric, 100000::numeric, 'Sara owes 100,000 again');
select test.eq(pg_temp.journal('employee_advance', pg_temp.id('adv_till', 'advance_id')), null,
               'its journal is reversed');
select test.throws(format($$select cancel_advance(%L, 'again', gen_random_uuid())$$, pg_temp.id('adv_till', 'advance_id')),
                   'This advance was cancelled already', 'cancelled once');
select test.as_admin();
select test.throws(format($$update employee_advance set amount = 1 where id = %L$$, pg_temp.id('adv_bank', 'advance_id')),
                   'An advance is not changed: cancel it and give it again', 'an advance is not changed');
select test.act_as('auditor@example.com');
select test.eq((select string_agg(x ->> 'name' || ' ' || (x ->> 'owed'), ',') from jsonb_array_elements(employee_advances() -> 'owed') x),
               'Sara 100000', 'the auditor reads the advances');
select test.throws($$select record_advance(pg_temp.person('Sara'), 1000, 'bank', 'x', gen_random_uuid())$$,
                   '%needs payroll.run%', 'and gives none');

-- =============================================================================
-- 8. Someone still clocked in, and last month's payroll, on the alerts
-- =============================================================================
select test.act_as('manager@example.com');
insert into res select 'long', add_attendance(pg_temp.person('Dana'), greatest(now() - interval '17 hours', pg_temp.at(test.today(), '00:00')),
                                              null, 'came in early', null, gen_random_uuid());
select test.as_admin();
-- In since 17 hours ago, or since midnight when that was later: an alert once
-- in for the rule's 16 hours (after 16:00 by the café's clock, even from midnight).
create temp table long_in as
  select floor(extract(epoch from now() - greatest(now() - interval '17 hours', pg_temp.at(test.today(), '00:00')))
               / 3600)::int as hours;
grant select on long_in to public;
select test.ok(coalesce(pg_temp.alerts('clocked_in_long'), '') like case when (select hours from long_in) >= 16
                                                                    then 'orange: Dana has been clocked in for '
                                                                         || (select hours from long_in) || ' hours, since %'
                                                                    else '' end,
               'someone clocked in for 17 hours is an alert');
select test.act_as('manager@example.com');
select cancel_attendance(pg_temp.id('long', 'attendance_id'), 'a test', gen_random_uuid());
select test.as_admin();
select test.eq(pg_temp.alerts('clocked_in_long'), null, 'clocked out, no alert');
select test.eq(pg_temp.alerts('payroll_due'),
               format('%s: The payroll for %s is not approved: salaries were due on %s', pg_temp.due_urgency(),
                      to_char((select lm from d), 'YYYY-MM'), to_char(date_trunc('month', test.today()), 'DD Mon')),
               'last month''s payroll, not approved on payday, is an alert');

-- =============================================================================
-- 9. Last month's payroll
-- =============================================================================
select test.act_as('manager@example.com');
select test.throws($$select draft_payroll((select lm from d), gen_random_uuid())$$, '%needs payroll.run%',
                   'a branch manager drafts no payroll');
select test.act_as('accountant@example.com');
select test.throws($$select draft_payroll(test.today() + 40, gen_random_uuid())$$, 'Choose a month that has begun',
                   'no payroll for a month to come');
insert into res select 'run', draft_payroll((select lm from d), 'b0000000-0000-0000-0000-000000000003');
select test.eq((draft_payroll((select lm from d), gen_random_uuid()) ->> 'run_id')::uuid, pg_temp.id('run', 'run_id'),
               'one payroll a month: drafted again, the same');
select test.eq((select count(*)::int from payroll_run), 1, 'one payroll');
select test.eq((pg_temp.r('run') ->> 'run_no')::int, 1, 'payrolls are numbered from 1');
select test.as_admin();
select test.eq((select string_agg(e.full_name, ',' order by e.full_name) from payroll_line l join employee e on e.id = l.employee_id
                 where l.run_id = pg_temp.id('run', 'run_id')),
               'Ali,Layla,Noor,Omar,Sara', 'everyone who worked here in the month, and nobody else');
select test.eq((select l.base_pay || '+' || l.overtime_pay || ' ' || l.minutes_worked || 'm/' || l.overtime_minutes || 'm owed '
                       || l.advance_owed || ' back ' || l.advance_recovered || ' net ' || l.net
                  from pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara') l),
               '600000+625 940m/10m owed 100000 back 100000 net 500625',
               'Sara: a month''s pay, 10 minutes over at 1.5 × 2,500 an hour, her advance taken back');
select test.eq((select l.base_pay || '+' || l.overtime_pay from pg_temp.line(pg_temp.id('run', 'run_id'), 'Ali') l), '24000+9000',
               'Ali: 8 hours at 3,000, and 2 over at 4,500');
select test.eq((select l.base_pay || '+' || l.overtime_pay || ' ' || l.days_worked from pg_temp.line(pg_temp.id('run', 'run_id'), 'Noor') l),
               '50000+4688 2', 'Noor: two days at 25,000, and an hour over at 1.5 × 3,125');
select test.eq((select l.base_pay || ' ' || l.days_employed || '/' || l.days_in_month from pg_temp.line(pg_temp.id('run', 'run_id'), 'Omar') l),
               (select money_round('00000000-0000-0000-0000-0000000000b1', 450000.0 * (lm_end - omar_hired + 1) / (lm_end - lm + 1))
                       || ' ' || (lm_end - omar_hired + 1) || '/' || (lm_end - lm + 1) from d),
               'Omar: the part of the month he worked here');
select test.eq((select coalesce(l.rate::text, 'none') || ' ' || l.gross from pg_temp.line(pg_temp.id('run', 'run_id'), 'Layla') l),
               'none 0', 'Layla''s pay is not set');
-- Adjusted, with why.
select test.act_as('accountant@example.com');
select test.throws(format($$select adjust_payroll_line(%L, 0, null, 20000, ' ', null, gen_random_uuid())$$,
                          (pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id),
                   'Say what the deduction is for', 'a deduction has a why');
select test.throws(format($$select adjust_payroll_line(%L, 5000, '', 0, null, null, gen_random_uuid())$$,
                          (pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id),
                   'Say what the addition is for', 'an addition has a why');
select test.throws(format($$select adjust_payroll_line(%L, 0, null, 700000, 'absent', null, gen_random_uuid())$$,
                          (pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id),
                   'The deductions are more than Sara earned (600625)', 'no more deducted than earned');
select test.throws(format($$select adjust_payroll_line(%L, 0, null, 0, null, 150000, gen_random_uuid())$$,
                          (pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id),
                   'Sara owes 100000 of advances: take back no more than that', 'no more taken back than owed');
select adjust_payroll_line((pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id, 0, null, 20000,
                           'absent on the 12th', 60000, gen_random_uuid());
select test.eq((select l.gross || ' back ' || l.advance_recovered || ' net ' || l.net
                  from pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara') l),
               '580625 back 60000 net 520625', 'Sara: 20,000 deducted, 60,000 of her advance taken back');
-- Approval waits for everyone's pay, for everyone clocked out, and for a draft that says what the hours say.
select test.throws(format($$select approve_payroll(%L, gen_random_uuid())$$, pg_temp.id('run', 'run_id')),
                   'Set Layla''s pay on Staff, then draft the payroll again', 'everyone''s pay is set first');
select test.act_as('owner@example.com');
select set_employee_pay(pg_temp.person('Layla'), 'monthly', 300000, 8, null, null, gen_random_uuid());
select test.act_as('accountant@example.com');
select test.throws(format($$select approve_payroll(%L, gen_random_uuid())$$, pg_temp.id('run', 'run_id')),
                   'Set Layla''s pay on Staff, then draft the payroll again', 'the draft still has no pay for her');
select draft_payroll((select lm from d), gen_random_uuid());
select test.eq((select l.deductions || ' ' || l.deductions_note || ' back ' || l.advance_recovered
                  from pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara') l),
               '20000 absent on the 12th back 60000', 'drafted again, what was adjusted stays');
select test.act_as('manager@example.com');
insert into res select 'open', add_attendance(pg_temp.person('Noor'), pg_temp.at((select d3 from d), '09:00'), null,
                                              'still at work', null, gen_random_uuid());
select test.act_as('accountant@example.com');
select test.throws(format($$select approve_payroll(%L, gen_random_uuid())$$, pg_temp.id('run', 'run_id')),
                   'Noor is still clocked in since %: clock them out or correct the hours first', 'everyone clocked out first');
select test.act_as('manager@example.com');
select correct_attendance(pg_temp.id('open', 'attendance_id'), pg_temp.at((select d3 from d), '09:00'),
                          pg_temp.at((select d3 from d), '13:00'), 'forgot to clock out', gen_random_uuid());
select test.act_as('accountant@example.com');
select test.throws(format($$select approve_payroll(%L, gen_random_uuid())$$, pg_temp.id('run', 'run_id')),
                   'The hours or the pay changed since this draft: draft it again, check it, then approve it',
                   'a draft behind the hours is not approved');
select draft_payroll((select lm from d), gen_random_uuid());
select test.eq((select l.base_pay || ' ' || l.days_worked from pg_temp.line(pg_temp.id('run', 'run_id'), 'Noor') l), '75000 3',
               'Noor: three days now');
-- This month's is drafted, and not approved before the month is over.
insert into res select 'this_month', draft_payroll(test.today(), gen_random_uuid());
select test.throws(format($$select approve_payroll(%L, gen_random_uuid())$$, pg_temp.id('this_month', 'run_id')),
                   'The pay for % is approved once the month is over', 'a month is paid once it is over');
select test.throws(format($$select pay_payroll(%L, 'bank', gen_random_uuid())$$, pg_temp.id('this_month', 'run_id')),
                   'Approve the payroll first', 'a draft is not paid');
-- Approved.
select test.as_admin();
create temp table totals as
select sum(gross) as gross, sum(net) as net, sum(advance_recovered) as back from payroll_line
 where run_id = (select (v ->> 'run_id')::uuid from res where k = 'run');
grant select on totals to public;
select test.act_as('accountant@example.com');
insert into res select 'approved', approve_payroll(pg_temp.id('run', 'run_id'), 'b0000000-0000-0000-0000-000000000004');
select test.eq((approve_payroll(pg_temp.id('run', 'run_id'), 'b0000000-0000-0000-0000-000000000004') ->> 'journal_no'),
               pg_temp.r('approved') ->> 'journal_no', 'sent twice, approved once');
select test.throws(format($$select approve_payroll(%L, gen_random_uuid())$$, pg_temp.id('run', 'run_id')),
                   'This payroll is approved already', 'approved once');
select test.eq(pg_temp.run_journal(pg_temp.id('run', 'run_id')),
               (select format('1300 Cr %s | 2100 Cr %s | 6100 Dr %s', back, net, gross) from totals),
               'approved: Dr 6100 the pay, Cr 2100 what is to be paid, Cr 1300 the advance taken back');
select test.as_admin();
select test.eq((select business_local_date('00000000-0000-0000-0000-0000000000b1', j.occurred_at)
                  from payroll_run r join journal_entry j on j.id = r.journal_entry_id
                 where r.id = pg_temp.id('run', 'run_id')),
               (select lm_end from d), 'on the month''s last day');
select test.eq(pg_temp.owed('Sara'), 40000::numeric, 'Sara owes 40,000 of her advance now');
-- The month's hours are settled now.
select test.act_as('manager@example.com');
select test.throws(format($$select correct_attendance(%L, pg_temp.at((select d3 from d), '09:00'), pg_temp.at((select d3 from d), '14:00'), 'x', gen_random_uuid())$$,
                          pg_temp.id('open', 'attendance_id')),
                   'The pay for % is approved: its hours can no longer change', 'approved hours do not change');
select test.throws($$select add_attendance(pg_temp.person('Sara'), pg_temp.at((select d3 from d), '08:00'), pg_temp.at((select d3 from d), '16:00'), 'x', null, gen_random_uuid())$$,
                   'The pay for % is approved: its hours can no longer change', 'nor are hours added to them');
select test.throws($$select save_schedule(null, (select d3 from d), (select d3 from d), '[]'::jsonb, gen_random_uuid())$$,
                   'The pay for % is approved: its hours can no longer change', 'nor is the schedule changed');
select save_schedule(null, (select d1 from d), (select d3 from d),
  jsonb_build_array(
    jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d1 from d), 'starts', '08:00', 'ends', '16:00'),
    jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d2 from d), 'starts', '08:00', 'ends', '16:00'),
    jsonb_build_object('employee_id', pg_temp.person('Sara'), 'day', (select d3 from d), 'starts', '08:00', 'ends', '16:00'),
    jsonb_build_object('employee_id', pg_temp.person('Ali'), 'day', (select d1 from d), 'starts', '14:00', 'ends', '00:00')),
  gen_random_uuid());
select test.eq((select count(*)::int from shift_schedule where day between (select d1 from d) and (select d3 from d)), 4,
               'the same hours again change nothing');
select test.act_as('accountant@example.com');
select test.throws(format($$select adjust_payroll_line(%L, 0, null, 0, null, null, gen_random_uuid())$$,
                          (pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id),
                   'Only a draft payroll changes: this one is approved', 'an approved payroll does not change');
select test.throws($$select draft_payroll((select lm from d), gen_random_uuid())$$, 'The pay for % is approved already',
                   'nor is it drafted again');
select test.act_as('owner@example.com');
select test.throws(format($$select cancel_advance(%L, 'mistake', gen_random_uuid())$$, pg_temp.id('adv_bank', 'advance_id')),
                   'Some of this advance was taken back from a salary already: it cannot be cancelled',
                   'an advance taken back is not cancelled');
select test.as_admin();
select test.eq(pg_temp.alerts('payroll_due'),
               (select format('%s: Salaries for %s: %s IQD not paid yet', pg_temp.due_urgency(), to_char(lm, 'YYYY-MM'),
                              alert_money(net)) from d, totals),
               'approved and not paid: an alert still');

-- =============================================================================
-- 10. Paid
-- =============================================================================
select test.act_as('accountant@example.com');
select test.throws(format($$select pay_salary(%L, 600000, 'bank', gen_random_uuid())$$, (pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id),
                   'That is more than is owed to Sara (520625)', 'no more paid than owed');
insert into res select 'pay_sara', pay_salary((pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id, 100000, 'bank',
                                              'b0000000-0000-0000-0000-000000000005');
select test.eq((pay_salary((pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id, 100000, 'bank',
                           'b0000000-0000-0000-0000-000000000005') ->> 'payment_id')::uuid,
               pg_temp.id('pay_sara', 'payment_id'), 'sent twice, paid once');
select test.eq(pg_temp.journal('salary_payment', pg_temp.id('pay_sara', 'payment_id')), '1020 Cr 100000 | 2100 Dr 100000',
               'a salary paid: Dr 2100, Cr 1020');
select test.eq((pg_temp.r('pay_sara') ->> 'owed')::numeric, 420625::numeric, 'Sara is owed 420,625 still');
select test.throws(format($$select reopen_payroll(%L, 'wrong', gen_random_uuid())$$, pg_temp.id('run', 'run_id')),
                   'Salaries were paid from this payroll: cancel the payments first', 'a payroll paid from is not reopened');
-- From the till, the rest of Sara's; then everyone else from the bank.
select test.throws(format($$select pay_salary(%L, null, 'till', gen_random_uuid())$$, (pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id),
                   '%', 'the drawer holds 200,000 only');
insert into res select 'pay_sara2', pay_salary((pg_temp.line(pg_temp.id('run', 'run_id'), 'Sara')).id, 150000, 'till', gen_random_uuid());
select test.eq(pg_temp.drawer(), 50000::numeric, 'salaries from the till leave the drawer');
insert into res select 'pay_all', pay_payroll(pg_temp.id('run', 'run_id'), 'bank', gen_random_uuid());
select test.eq((pg_temp.r('pay_all') ->> 'people')::int, 5, 'everyone still owed is paid at once');
select test.eq(pg_temp.r('pay_all') ->> 'status', 'paid', 'the payroll is paid');
select test.throws(format($$select pay_payroll(%L, 'bank', gen_random_uuid())$$, pg_temp.id('run', 'run_id')),
                   'Everyone is paid in full already', 'paid once');
select test.eq((select sum(amount) from salary_payment where run_id = pg_temp.id('run', 'run_id') and cancelled_at is null),
               (select net from totals), 'paid what was owed');
select test.eq(pg_temp.alerts('payroll_due'), null, 'paid: no alert');
-- A payment cancelled: the cash back, the payroll owed again.
select test.throws(format($$select cancel_salary_payment(%L, '', gen_random_uuid())$$, pg_temp.id('pay_sara2', 'payment_id')),
                   'Say why the payment is cancelled', 'a cancellation has a why');
select cancel_salary_payment(pg_temp.id('pay_sara2', 'payment_id'), 'paid the wrong person', gen_random_uuid());
select test.eq(pg_temp.drawer(), 200000::numeric, 'its cash is back in the drawer');
select test.eq((select status from payroll_run where id = pg_temp.id('run', 'run_id')), 'approved', 'the payroll is owed again');
select test.throws(format($$select cancel_salary_payment(%L, 'again', gen_random_uuid())$$, pg_temp.id('pay_sara2', 'payment_id')),
                   'This payment was cancelled already', 'cancelled once');
select test.as_admin();
select test.throws(format($$update salary_payment set amount = 1 where id = %L$$, pg_temp.id('pay_sara', 'payment_id')),
                   'A salary payment is not changed: cancel it and pay again', 'a payment is not changed');
select test.throws(format($$delete from payroll_run where id = %L$$, pg_temp.id('run', 'run_id')), '%', 'a payroll is never deleted');
-- Reopened once nothing is paid from it: its journal reversed; approved again.
select test.act_as('accountant@example.com');
select cancel_salary_payment(p.id, 'reopening', gen_random_uuid()) from salary_payment p
 where p.run_id = pg_temp.id('run', 'run_id') and p.cancelled_at is null;
select test.throws(format($$select reopen_payroll(%L, '', gen_random_uuid())$$, pg_temp.id('run', 'run_id')),
                   'Say why the payroll is reopened', 'a reopening has a why');
select reopen_payroll(pg_temp.id('run', 'run_id'), 'Omar''s start was wrong', gen_random_uuid());
select test.eq((select status from payroll_run where id = pg_temp.id('run', 'run_id')), 'draft', 'back to a draft');
select test.eq(pg_temp.run_journal(pg_temp.id('run', 'run_id')), null, 'its journal reversed');
select test.eq((select count(*)::int from payroll_approval a join journal_entry rv on rv.reverses_entry = a.journal_entry_id
                 where a.run_id = pg_temp.id('run', 'run_id') and a.reopened_at is not null
                   and rv.id = a.reopen_journal_id), 1, 'the approval kept, with the journal that reversed it');
select test.eq(pg_temp.owed('Sara'), 100000::numeric, 'what it took back of the advance is owed again');
-- A locked month takes no payroll.
select test.act_as('owner@example.com');
select test.eq((select string_agg(check_key || ':' || ok, ',') from period_close_checklist(
                  (select id from accounting_period where business_id = '00000000-0000-0000-0000-0000000000b1'
                      and starts_on = (select lm from d)))
                 where check_key in ('payroll', 'advances', 'payroll_approved')),
               'payroll:true,advances:true,payroll_approved:false', 'locking the month warns the payroll is not approved');
select lock_period((select id from accounting_period where business_id = '00000000-0000-0000-0000-0000000000b1'
                      and starts_on = (select lm from d)), 'month end', gen_random_uuid());
select test.act_as('accountant@example.com');
select test.throws(format($$select approve_payroll(%L, gen_random_uuid())$$, pg_temp.id('run', 'run_id')),
                   'Accounting period % is locked%', 'a locked month takes no payroll');
select test.act_as('owner@example.com');
select unlock_period((select id from accounting_period where business_id = '00000000-0000-0000-0000-0000000000b1'
                        and starts_on = (select lm from d)), 'the payroll', gen_random_uuid());
select test.act_as('accountant@example.com');
select approve_payroll(pg_temp.id('run', 'run_id'), gen_random_uuid());
select pay_payroll(pg_temp.id('run', 'run_id'), 'bank', gen_random_uuid());
select test.eq((select status from payroll_run where id = pg_temp.id('run', 'run_id')), 'paid', 'approved and paid again');

-- =============================================================================
-- 11. The books
-- =============================================================================
select test.as_admin();
select test.eq(pg_temp.checks(),
               'advances=0,card=0,documents=0,dollars=0,drawer=0,grni=0,inventory=0,payables=0,payroll=0,platform=0,safe=0,sales=0,transit=0',
               'every check at zero: salaries owed against 2100, advances against 1300');
select test.eq(test.balance('2100'), 0::numeric, 'nothing owed in salaries');
select test.eq(test.balance('1300'), (select 100000 - back from totals), 'the advance not taken back is in 1300');
-- The safe: an advance from it is counted with it.
select test.act_as('owner@example.com');
select move_cash('owner', 'safe', 80000, 'for the week', null, gen_random_uuid());
select record_advance(pg_temp.person('Ali'), 30000, 'safe', 'bus fare', gen_random_uuid());
select test.as_admin();
select test.ok(pg_temp.checks() like '%,safe=0,%' and pg_temp.checks() like 'advances=0,%', 'the safe and the advances agree');
select test.eq((select count(*)::int from document_problems('00000000-0000-0000-0000-0000000000b1', now() + interval '1 minute')), 0,
               'every record has its journal');
select test.act_as('accountant@example.com');
select test.throws($$select save_journal(test.today(), 'x', '[{"code":"2100","debit":100},{"code":"6100","credit":100}]'::jsonb, true, null, null, gen_random_uuid())$$,
                   'Account 2100 has a subledger and cannot take a manual journal%', 'salaries owed take no manual journal');
select test.throws($$select record_bill((select id from supplier limit 1), 'X-1', test.today(), 1000, 0, null, '1300', gen_random_uuid())$$,
                   'Account 1300 cannot take a bill%', 'advances take no bill');
select test.throws(format($$select reverse_journal((select id from journal_entry where reference_type = 'employee_advance' and reference_id = %L), 'x', null, gen_random_uuid())$$,
                          pg_temp.id('adv_bank', 'advance_id')),
                   'Journal % was written by an advance to someone who works here (cancel it on Payroll)%',
                   'an advance''s journal is not reversed by hand');

-- =============================================================================
-- 12. Who reads what
-- =============================================================================
select test.act_as('manager@example.com');
select test.eq((select count(*)::int from payroll_run), 0, 'a branch manager reads no payroll');
select test.throws($$select payroll_runs()$$, '%needs payroll.view%', 'nor through the screens');
select test.ok((select count(*) from attendance) > 0, 'but reads the hours');
select test.act_as('auditor@example.com');
select test.eq(jsonb_array_length(payroll_runs()), 2, 'the auditor reads the payrolls');
select test.eq((select (x ->> 'lines') from (select payroll_detail(pg_temp.id('run', 'run_id')) as x) y)::jsonb ->> 0 is not null, true,
               'and each payroll''s lines');
select test.throws($$select approve_payroll(gen_random_uuid(), gen_random_uuid())$$, '%needs payroll.run%', 'and approves none');
select test.ok((staff_list() -> 0) ? 'rate', 'the auditor reads the people, with their pay');
select test.act_as('counter@example.com');
select test.throws($$select clock_board()$$, '%needs sale.create or staff.manage or attendance.edit%', 'a counter does not clock people');
select test.eq((select count(*)::int from employee), 0, 'nor reads who works here');
select test.act_as_anon();
select test.throws($$select clock_board()$$, '%permission denied%', 'the public reaches nothing');
