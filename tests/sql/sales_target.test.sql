-- =============================================================================
-- A day's net sales target (0067): a rule like the others, set on Settings with
-- a reason and kept with its history, none by default; read by whoever sees the
-- profits, for the café or for one of its places. A branch's own target first,
-- then the café's while the café has one branch; a place that sells nothing,
-- or one branch of several, has none of the café's.
-- =============================================================================
select test.as_admin();
create function pg_temp.place(p_kind text, p_name text default null) returns uuid
language sql security definer as $$
  select id from location where business_id = '00000000-0000-0000-0000-0000000000b1' and kind::text = p_kind
     and (p_name is null or name = p_name) order by created_at, id limit 1
$$;

-- ------------------------------------------------------------ none, to start with
select test.act_as('owner@example.com');
select test.eq(daily_sales_target(), 0::numeric, 'no target until one is set');
select test.eq((select x ->> 'value' || case when (x ->> 'is_default')::boolean then ' (default)' else '' end
                  from jsonb_array_elements(list_business_rules() -> 'rows') x
                 where x ->> 'key' = 'daily_sales_target'),
  '0 (default)', 'Settings lists it, at no target');
select test.eq(list_business_rules() #>> '{definitions,daily_sales_target,scopes}', '["business", "location"]',
  'set for the café, or for a place');

-- ------------------------------------------------------------ set, and read back
select set_business_rule('daily_sales_target', 'business', null, '450000', 'What a good day brings in');
select test.eq(daily_sales_target(), 450000::numeric, 'the owner sets the café''s day at 450,000');
select test.throws($$select set_business_rule('daily_sales_target', 'business', null, '-1', 'less than none')$$,
  'Enter a number from 0 to 1000000000', 'no target below nothing');
select test.throws($$select set_business_rule('daily_sales_target', 'business', null, '450000.5', 'halves')$$,
  'Enter a whole number', 'a target is a whole amount');
select test.throws($$select set_business_rule('daily_sales_target', 'business', null, '"lots"', 'words')$$,
  'Enter a number', 'a number, not words');
select test.throws($$select set_business_rule('daily_sales_target', 'role', 'cashier', '100000', 'per role')$$,
  'This rule is not set that way', 'a target is not a role''s');
select test.throws($$select set_business_rule('daily_sales_target', 'location', 'b0000000-0000-0000-0000-00000000dead', '1', 'x')$$,
  'Unknown location', 'only the café''s own places');

-- Whoever sees the profits reads it; nobody else.
select test.act_as('manager@example.com');
select test.eq(daily_sales_target(), 450000::numeric, 'a branch manager reads it');
select test.throws($$select set_business_rule('daily_sales_target', 'business', null, '1', 'mine')$$,
  '%needs settings.manage%', 'and does not set it');
select test.act_as('cashier@example.com');
select test.throws($$select daily_sales_target()$$, '%needs profit.view%', 'a cashier does not read it');
select test.act_as_anon();
select test.throws($$select daily_sales_target()$$, '%permission denied%', 'nor does the public');

-- ------------------------------------------------------------ a place's day
select test.act_as('owner@example.com');
select test.eq(daily_sales_target(pg_temp.place('branch')), 450000::numeric,
  'the only branch''s day is measured against the café''s target');
select test.eq(daily_sales_target(pg_temp.place('central_kitchen')), 0::numeric,
  'the kitchen sells nothing: no target of the café''s');
select test.throws($$select daily_sales_target('b0000000-0000-0000-0000-00000000dead')$$,
  'Unknown location', 'only the café''s own places are read');
select set_business_rule('daily_sales_target', 'location', pg_temp.place('branch')::text, '300000',
  'The branch''s own, while the garden is closed');
select test.eq(daily_sales_target(pg_temp.place('branch')) || '/' || daily_sales_target(),
  '300000/450000', 'a branch''s own target is its own; the café''s stays');

-- A second branch: the café's target is no one branch's.
select test.as_admin();
insert into location (business_id, kind, name) values ('00000000-0000-0000-0000-0000000000b1', 'branch', 'Garden Branch');
select test.act_as('owner@example.com');
select test.eq(daily_sales_target(pg_temp.place('branch', 'Garden Branch')), 0::numeric,
  'a second branch has none of the café''s');
select set_business_rule('daily_sales_target', 'location', pg_temp.place('branch')::text, null, 'As the café''s');
select test.eq(daily_sales_target(pg_temp.place('branch')), 0::numeric,
  'nor the first, once its own is gone and there are two');
select test.eq(daily_sales_target(), 450000::numeric, 'the café''s day keeps the café''s target');
select set_business_rule('daily_sales_target', 'location', pg_temp.place('branch', 'Garden Branch')::text, '120000',
  'The garden opens');
select test.eq(daily_sales_target(pg_temp.place('branch', 'Garden Branch')), 120000::numeric,
  'the second branch''s own target');
select test.as_admin();
update location set is_active = false where name = 'Garden Branch';
select test.act_as('owner@example.com');
select test.eq(daily_sales_target(pg_temp.place('branch')), 450000::numeric,
  'the garden closed, the café has one branch again: the café''s target is the first''s');

-- ------------------------------------------------------------ kept like every rule
select test.eq((select string_agg(coalesce(x ->> 'scope_name', 'the café') || ': '
                                  || coalesce(x ->> 'old_value', '-') || '>' || coalesce(x ->> 'new_value', 'default')
                                  || ' (' || (x ->> 'reason') || ')', '; ' order by x ->> 'changed_at')
                  from jsonb_array_elements(list_business_rules() -> 'history') x
                 where x ->> 'key' = 'daily_sales_target'),
  'the café: ->450000 (What a good day brings in); '
  'Main Branch: ->300000 (The branch''s own, while the garden is closed); '
  'Main Branch: 300000>default (As the café''s); '
  'Garden Branch: ->120000 (The garden opens)',
  'each change kept, with why, from what to what');
select test.as_admin();
select test.eq((select count(*) from audit_log
                 where action = 'rule.set' and entity_id like 'daily_sales_target%')::int, 4,
  'each on the audit trail');
