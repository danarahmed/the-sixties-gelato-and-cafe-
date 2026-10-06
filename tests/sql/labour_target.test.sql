-- =============================================================================
-- The labour cost the café aims for (0071, round ten): a rule like the others,
-- set on Settings with a reason and kept with its history, none by default; a
-- share of net sales, from 0 to 100, for the café or for a place. Its reader
-- gives a place's own target, else the café's (a share is every branch's
-- alike), to whoever sees pay or sets the rules, and to nobody else.
-- =============================================================================
select test.as_admin();
create function pg_temp.place(p_kind text, p_name text default null) returns uuid
language sql security definer as $$
  select id from location where business_id = '00000000-0000-0000-0000-0000000000b1' and kind::text = p_kind
     and (p_name is null or name = p_name) order by created_at, id limit 1
$$;
-- An accountant, who sees pay and sets no rules.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000a7', 'accountant@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Demo Accountant', 'accountant@example.com',
        'a0000000-0000-0000-0000-0000000000a7');
insert into user_role (app_user_id, role) select id, 'accountant' from app_user where email = 'accountant@example.com';

-- ------------------------------------------------------------ none, to start with
select test.act_as('owner@example.com');
select test.eq(labour_target(), 0::numeric, 'no target until one is set');
select test.eq((select x ->> 'value' || case when (x ->> 'is_default')::boolean then ' (default)' else '' end
                  from jsonb_array_elements(list_business_rules() -> 'rows') x
                 where x ->> 'key' = 'labour_target_percent'),
  '0 (default)', 'Settings lists it, at no target');
select test.eq(list_business_rules() #>> '{definitions,labour_target_percent,kind}', 'percent', 'a share of sales');
select test.eq(list_business_rules() #>> '{definitions,labour_target_percent,scopes}', '["business", "location"]',
  'set for the café, or for a place');

-- ------------------------------------------------------------ set, and read back
select set_business_rule('labour_target_percent', 'business', null, '25', 'A quarter of what we sell, at most');
select test.eq(labour_target(), 25::numeric, 'the owner aims for 25%');
select test.eq(labour_target(pg_temp.place('branch')), 25::numeric, 'a branch with none of its own has the café''s');
select test.eq(labour_target(pg_temp.place('central_kitchen')), 25::numeric, 'and so does the kitchen');
select test.throws($$select set_business_rule('labour_target_percent', 'business', null, '-1', 'less than none')$$,
  'Enter a number from 0 to 100', 'no share below nothing');
select test.throws($$select set_business_rule('labour_target_percent', 'business', null, '101', 'more than all')$$,
  'Enter a number from 0 to 100', 'nor above all of it');
select test.throws($$select set_business_rule('labour_target_percent', 'business', null, '"lots"', 'words')$$,
  'Enter a number', 'a number, not words');
select test.throws($$select set_business_rule('labour_target_percent', 'role', 'cashier', '10', 'per role')$$,
  'This rule is not set that way', 'a target is not a role''s');
select set_business_rule('labour_target_percent', 'business', null, '27.5', 'Ramadan hours');
select test.eq(labour_target(), 27.5::numeric, 'a share may have a half');
select test.eq((select count(*) from business_rule_history
                 where key = 'labour_target_percent')::int, 2, 'each change kept, with why');

-- ------------------------------------------------------------ a place's own
select set_business_rule('labour_target_percent', 'location', pg_temp.place('branch')::text, '30',
  'The branch is short-handed this month');
select test.eq(labour_target(pg_temp.place('branch')) || '/' || labour_target() || '/'
               || labour_target(pg_temp.place('central_kitchen')),
  '30/27.5/27.5', 'a place''s own target is its own; the café''s stays, and the kitchen keeps it');
select test.throws($$select labour_target('b0000000-0000-0000-0000-00000000dead')$$,
  'Unknown location', 'only the café''s own places are read');
select set_business_rule('labour_target_percent', 'location', pg_temp.place('branch')::text, null, 'As the café''s');
select test.eq(labour_target(pg_temp.place('branch')), 27.5::numeric, 'its own taken away: the café''s again');

-- ------------------------------------------------------------ who reads it
select test.act_as('accountant@example.com');
select test.eq(labour_target(), 27.5::numeric, 'an accountant, who sees pay, reads it');
select test.throws($$select set_business_rule('labour_target_percent', 'business', null, '1', 'mine')$$,
  '%needs settings.manage%', 'and does not set it');
select test.act_as('manager@example.com');
select test.throws($$select labour_target()$$, '%needs payroll.view or settings.manage%',
  'a branch manager, who sees no pay, does not read it');
select test.act_as('cashier@example.com');
select test.throws($$select labour_target()$$, '%needs payroll.view or settings.manage%', 'nor a cashier');
select test.act_as_anon();
select test.throws($$select labour_target()$$, '%permission denied%', 'nor the public');
