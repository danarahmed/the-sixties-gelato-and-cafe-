-- =============================================================================
-- Running many businesses (0109): support looks at a business only while its
-- owner allows it, read-only and recorded; problems can be sent to support;
-- the console shows each business; an unpaid business has 7 days' grace, is
-- then read-only, then closed, and its owner can export its data at any time.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
\set ESP '''[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]'''
-- The manager is also one of the system's administrators here.
insert into system_admin (auth_user_id) select auth_user_id from app_user where email = 'manager@example.com';
create function pg_temp.support(p_on boolean) returns void language plpgsql as $$
begin
  perform set_config('request.headers', case when p_on
    then '{"x-sixties-support": "00000000-0000-0000-0000-0000000000b1"}' else '' end, false);
end $$;
grant execute on function pg_temp.support(boolean) to public;

-- ------------------------------------------------------------ support access
select test.act_as('manager@example.com');
select test.throws($$select support_enter('00000000-0000-0000-0000-0000000000b1')$$,
  'That business has not given support access, or it has run out', 'no access without the owner''s word');
select test.throws($$select grant_support_access(2, 'Help with the menu')$$,
  'Only the owner gives the system''s support access', 'only the owner gives it');
select test.act_as('owner@example.com');
select test.throws($$select grant_support_access(100, 'Help with the menu')$$,
  'Support access is for 1 to 72 hours', 'for 1 to 72 hours');
select test.throws($$select grant_support_access(2, 'x')$$, 'Say why, in a few words', 'with why');
select grant_support_access(2, 'Help setting up the menu');
select test.ok(support_access() ->> 'open_until' is not null, 'open for two hours');

select test.act_as('manager@example.com');
select support_enter('00000000-0000-0000-0000-0000000000b1');
select pg_temp.support(true);
select test.eq(my_profile() ->> 'name', 'System support', 'support sees it as System support');
select test.eq(my_profile() -> 'roles', '["auditor"]'::jsonb, 'read-only: the auditor''s role');
select test.eq((my_profile() ->> 'support')::boolean, true, 'and the screens are told');
select test.throws(format('select record_sale(%L, %L, %L, %L)', gen_random_uuid(), 'dine_in', 'cash', :ESP),
  '%permission%', 'support changes nothing');
select test.ok((select count(*) from report_daily_sales(test.today(), test.today())) >= 0, 'but may read');
select pg_temp.support(false);

select test.act_as('owner@example.com');
select revoke_support_access();
select test.eq(jsonb_array_length(support_access() -> 'visits'), 1, 'the owner sees the visit');
select test.act_as('manager@example.com');
select pg_temp.support(true);
select test.eq(my_profile() ->> 'name', 'Demo Manager', 'taken back: support is only themselves again');
select pg_temp.support(false);
select test.as_admin();
select test.eq((select string_agg(action, ',' order by occurred_at) from audit_log where action like 'support.%'),
  'support.grant,support.enter,support.revoke', 'each step on the business''s audit trail');

-- ------------------------------------------------------------ problems to support
select test.act_as('cashier@example.com');
select report_problem('/pos', 'The printer did not print', '{"for_support": true, "error": "timeout"}');
select report_problem('/pos', 'A question for the manager', '{}');
select test.act_as('manager@example.com');
select test.eq(jsonb_array_length(admin_problem_reports()), 1, 'support sees only what was sent to it');
select test.eq(admin_problem_reports() -> 0 ->> 'error', 'timeout', 'with the error');

-- ------------------------------------------------------------ the console
insert into res select 'console', admin_businesses();
select test.ok((select (x ->> 'problems_open')::int from res, jsonb_array_elements(v) x
                 where x ->> 'id' = '00000000-0000-0000-0000-0000000000b1') = 1, 'the console counts it');
select test.eq((select x ->> 'state' from res, jsonb_array_elements(v) x
                 where x ->> 'id' = '00000000-0000-0000-0000-0000000000b1'), 'active', 'paid with no end');
select set_business_pilot('00000000-0000-0000-0000-0000000000b1', true, 'First to try new parts');
select test.as_admin();
select test.eq((select pilot from business where id = '00000000-0000-0000-0000-0000000000b1'), true, 'in the pilot group');

-- ------------------------------------------------------------ paying
select test.act_as('manager@example.com');
select set_business_paid_until('00000000-0000-0000-0000-0000000000b1', test.today() - 3, 'Paid to the 10th');
select test.act_as('cashier@example.com');
select test.eq(my_profile() -> 'subscription' ->> 'state', 'grace', 'three days late: grace');
select test.eq((my_profile() -> 'subscription' ->> 'grace_left')::int, 4, 'four days left');
select test.succeeds(format('select record_sale(%L, %L, %L, %L)', gen_random_uuid(), 'dine_in', 'cash', :ESP),
  'grace: the till sells as before');
select test.act_as('manager@example.com');
select set_business_paid_until('00000000-0000-0000-0000-0000000000b1', test.today() - 10, 'Not paid');
select test.act_as('cashier@example.com');
select test.throws(format('select record_sale(%L, %L, %L, %L)', gen_random_uuid(), 'dine_in', 'cash', :ESP),
  'The payment is overdue: the system only shows what is kept until it is paid', 'after the grace: read-only');
select test.act_as('owner@example.com');
select test.ok(not (my_profile() -> 'permissions') ? 'sale.create', 'the screens offer no writing');
select test.ok((select count(*) from report_daily_sales(test.today(), test.today())) >= 0, 'reports still read');
select test.act_as('manager@example.com');
select set_business_closed('00000000-0000-0000-0000-0000000000b1', true, 'Stopped paying');
select test.act_as('owner@example.com');
select test.throws($$select report_daily_sales(test.today(), test.today())$$,
  'This business is closed. Its owner can still download its data', 'closed: nothing');
select test.ok(jsonb_array_length(export_business_data() -> 'sales') >= 1, 'but the owner exports its data');
select test.act_as('cashier@example.com');
select test.throws($$select export_business_data()$$, 'Only the owner exports the business''s data',
  'only the owner');
select test.act_as('manager@example.com');
select set_business_closed('00000000-0000-0000-0000-0000000000b1', false, 'Paid again');
select set_business_paid_until('00000000-0000-0000-0000-0000000000b1', null, 'Paid with no end');
select test.act_as('cashier@example.com');
select test.succeeds(format('select record_sale(%L, %L, %L, %L)', gen_random_uuid(), 'dine_in', 'cash', :ESP),
  'paid again: the till sells, nothing lost');
