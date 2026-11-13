-- =============================================================================
-- Plans, parts and the type of business (0108): a café on the Business plan
-- has every part; moved to Starter, the accounting, staff, purchasing, recipe
-- and places parts go off, the screens are told, and the database refuses
-- their work, while a sale still posts its journal. Complete brings them
-- back, and the owner may switch one off with a reason. A supplier has no
-- till. Only the system's administrators change a plan.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
\set ESP '''[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]'''
\set JE '''[{"code":"6200","debit":5},{"code":"1020","credit":5}]'''

select test.act_as('owner@example.com');
select test.eq(my_profile() ->> 'plan', 'business', 'a café is on the Business plan');
select test.eq(my_profile() ->> 'business_type', 'cafe', 'and a café');
select test.ok(not exists (select 1 from jsonb_array_elements_text(my_profile() -> 'permissions') p where p like 'off:%'
                   and p not in ('off:kitchen', 'off:courses', 'off:reservations')),
  'with every part on');
select test.throws($$select set_business_plan('00000000-0000-0000-0000-0000000000b1', 'starter', 'Smaller café')$$,
  'Only the system''s administrators see this', 'a café''s owner does not change its plan');

-- The system's administrator moves it to Starter.
select test.as_admin();
insert into system_admin (auth_user_id) select auth_user_id from app_user where email = 'owner@example.com';
select test.act_as('owner@example.com');
select test.ok(jsonb_array_length(admin_businesses()) >= 1, 'the administrator sees every business');
select set_business_plan('00000000-0000-0000-0000-0000000000b1', 'starter', 'Starting small');
select test.eq((select string_agg(p, ',' order by p) from jsonb_array_elements_text(my_profile() -> 'permissions') p
                 where p like 'off:%'
                   and p not in ('off:kitchen', 'off:courses', 'off:reservations')), 'off:accounting,off:branches,off:purchasing,off:recipes,off:staff,off:wholesale',
  'Starter: those parts are off, and the screens are told');
select test.ok(not (my_profile() -> 'permissions') ? 'accounting.post', 'their permissions are not held');
select test.eq(current_has_permission('accounting.post'), false, 'nor by the database');
select test.throws(format('select save_journal(current_date, %L, %L, true)', 'Utilities', :JE),
  'That part is off for this business: The full accounting screens: journals, the bank, the balance sheet',
  'a journal by hand is refused, saying why');
select test.throws($$select set_business_part('accounting', true, 'We want the books')$$,
  'That part is not in the Starter plan', 'a part not in the plan is not switched on');
select test.act_as('cashier@example.com');
insert into res select 'sale', record_sale(gen_random_uuid(), 'dine_in', 'cash', :ESP);
select test.ok((select v ->> 'journal_no' from res where k = 'sale') is not null,
  'a sale on Starter still posts its journal: the books run underneath');
select test.act_as('owner@example.com');
select test.throws($$select add_place('central_kitchen', 'Second kitchen')$$,
  'A central kitchen is in the Business plan', 'no central kitchen on Starter');
select test.throws($$select add_place('branch', 'Second branch')$$,
  'More than one branch or store is in the Business plan', 'one branch on Starter');

-- Complete: they are back; the owner switches one off, with a reason.
select set_business_plan('00000000-0000-0000-0000-0000000000b1', 'complete', 'Growing');
select test.eq(current_has_permission('accounting.post'), true, 'Complete: the books are back at once');
select test.throws($$select set_business_part('staff', false, 'x')$$, 'Say why, in a few words', 'with a reason');
select set_business_part('staff', false, 'No staff on the system yet');
select test.eq(current_has_permission('payroll.view'), false, 'the owner switched staff off');
select set_business_part('staff', true, 'The team is joining now');
select test.eq(current_has_permission('payroll.view'), true, 'and on again');
select test.act_as('manager@example.com');
select test.throws($$select set_business_part('staff', false, 'Not needed now')$$,
  '%permission%', 'a manager does not switch a part');

-- A supplier has no till.
select test.act_as('owner@example.com');
select test.throws($$select set_business_type('shop', 'A shop now')$$,
  'Choose the type of business: a café, a bakery, a restaurant or a supplier', 'one of the four');
select set_business_type('supplier', 'We sell to other cafés');
select test.eq((select x ->> 'on' from jsonb_array_elements(business_parts() -> 'parts') x where x ->> 'part' = 'till'),
  'false', 'a supplier''s till is off by default');
select test.act_as('cashier@example.com');
select test.throws(format('select record_sale(%L, %L, %L, %L)', gen_random_uuid(), 'dine_in', 'cash', :ESP),
  'That part is off for this business: The till: menu, tables, open bills, offline sales', 'no sale at a till');
select test.act_as('owner@example.com');
select set_business_type('cafe', 'Back to the café');
select set_business_plan('00000000-0000-0000-0000-0000000000b1', 'business', 'Everything again');
select test.ok(not exists (select 1 from jsonb_array_elements_text(my_profile() -> 'permissions') p where p like 'off:%'
                   and p not in ('off:kitchen', 'off:courses', 'off:reservations')),
  'the Business plan: every part on again, nothing lost');
select test.as_admin();
select test.eq((select count(*)::int from audit_log where action in ('business.plan', 'business.part', 'business.type')),
  7, 'each change on the audit trail');
