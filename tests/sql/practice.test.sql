-- =============================================================================
-- Practice (0096): the same app with pretend money and stock. A person's twin
-- in a practice café of their own; while the request says it is practice,
-- the database answers as the twin, and nothing reaches the real books.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
-- The request saying it is practice, or not.
create function pg_temp.practise(p_on boolean) returns void language sql as $$
  select set_config('request.headers', case when p_on then '{"x-sixties-practice": "1"}' else '' end, false)
$$;
create function pg_temp.real_count(p_table text) returns bigint language plpgsql security definer as $$
declare n bigint;
begin
  execute format('select count(*) from %I where business_id = %L', p_table, '00000000-0000-0000-0000-0000000000b1') into n;
  return n;
end $$;
create function pg_temp.practice_cafe(p_email text) returns uuid language sql security definer as $$
  select w.business_id from practice_twin t join app_user u on u.id = t.app_user_id
    join auth.users a on a.id = u.auth_user_id join app_user w on w.id = t.twin_id where a.email = p_email
$$;
create function pg_temp.variant(p_business uuid, p_product text, p_size text) returns uuid language sql security definer as $$
  select v.id from product_variant v join product p on p.id = v.product_id
   where p.business_id = p_business and p.name = p_product and v.name = p_size
$$;
create function pg_temp.done(p_task text) returns boolean language sql as $$
  select (select t ->> 'done_at' from jsonb_array_elements(practice_tasks() -> 'tasks') t where t ->> 'task' = p_task) is not null
$$;

insert into res select 'sales', to_jsonb(pg_temp.real_count('sales_order'));
insert into res select 'journals', to_jsonb(pg_temp.real_count('journal_entry'));
insert into res select 'moves', to_jsonb(pg_temp.real_count('inventory_movement'));

-- ------------------------------------------------------------ before practice
select test.act_as('cashier@example.com');
select pg_temp.practise(false);
select test.eq(practice_tasks() ->> 'started', 'false', 'not begun');
select test.eq((select string_agg(t ->> 'task', ',') from jsonb_array_elements(practice_tasks() -> 'tasks') t),
  'open_drawer,sell_card,sell_cash,discount,table_bill,close_drawer', 'a cashier''s six tasks, in the order they are learnt');
select pg_temp.practise(true);
select test.eq(current_business_id(), null::uuid, 'practising with no practice café is no one');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card',
    '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]'::jsonb)$$, '%Sign in%',
  'and can sell nothing, rather than sell for real');

-- ------------------------------------------------------------ begun
select pg_temp.practise(false);
select test.eq(practice_start() ->> 'started', 'true', 'practice begun');
insert into res select 'cafe', to_jsonb(pg_temp.practice_cafe('cashier@example.com'));
select test.ok(pg_temp.practice_cafe('cashier@example.com') <> '00000000-0000-0000-0000-0000000000b1',
  'in a practice café of their own');
select test.eq(practice_start() ->> 'started', 'true', 'begun twice: the same one');
select test.eq(pg_temp.practice_cafe('cashier@example.com'), (pg_temp.r('cafe') #>> '{}')::uuid, 'not a second café');
select test.eq(current_business_id(), '00000000-0000-0000-0000-0000000000b1'::uuid, 'without the word, the real café');

select pg_temp.practise(true);
select test.eq(current_business_id(), (pg_temp.r('cafe') #>> '{}')::uuid, 'practising: the practice café');
select test.eq(my_profile() ->> 'practice', 'true', 'the app is told it is practice');
select test.eq(my_profile() ->> 'business_name', 'Practice café', 'by its name');
select test.eq((select count(*) from product)::int, 4, 'its own menu: espresso, latte, croissant, water');
select test.eq((select count(*) from sales_order)::int, 0, 'and none of the café''s sales');

-- The cashier's day, in practice.
select open_cash_session(p_counted => 0);
select record_sale(p_idempotency_key => gen_random_uuid(), p_channel => 'dine_in', p_tender => 'card',
  p_lines => jsonb_build_array(jsonb_build_object('variant_id',
    pg_temp.variant((pg_temp.r('cafe') #>> '{}')::uuid, 'Latte', 'Small'), 'qty', 2)));
select test.ok(pg_temp.done('open_drawer'), 'the drawer opened: ticked');
select test.ok(pg_temp.done('sell_card'), 'two lattes by card: ticked');
select test.ok(not pg_temp.done('close_drawer'), 'the drawer not closed yet: not ticked');

select pg_temp.practise(false);
select test.eq(pg_temp.real_count('sales_order'), (pg_temp.r('sales') #>> '{}')::bigint, 'no sale reached the café');
select test.eq(pg_temp.real_count('journal_entry'), (pg_temp.r('journals') #>> '{}')::bigint, 'nor its books');
select test.eq(pg_temp.real_count('inventory_movement'), (pg_temp.r('moves') #>> '{}')::bigint, 'nor its stock');
select test.ok(pg_temp.done('sell_card'), 'the tick is there outside practice too');

-- ------------------------------------------------------------ a manager
select test.act_as('manager@example.com');
select pg_temp.practise(false);
select practice_start();
select pg_temp.practise(true);
insert into res select 'count', to_jsonb((select id from stock_count where status = 'submitted'));
select test.ok(pg_temp.r('count') is not null, 'a count from Omar waits for a manager');
select approve_stock_count((pg_temp.r('count') #>> '{}')::uuid, gen_random_uuid());
select test.ok(pg_temp.done('approve_count'), 'approved: ticked');
select pg_temp.practise(false);
select test.act_as('cashier@example.com');
select test.throws($$select practice_team()$$, '%staff.manage%', 'a cashier does not see the team''s practice');

select test.as_admin();
insert into res select 'cashier', to_jsonb((select full_name from app_user where email = 'cashier@example.com'));
select test.act_as('owner@example.com');
select pg_temp.practise(false);
insert into res select 'team', practice_team();
select test.eq((select (p ->> 'done')::int from jsonb_array_elements(pg_temp.r('team')) p
                 where p ->> 'name' = pg_temp.r('cashier') #>> '{}'),
  2, 'the owner sees the cashier''s two done');
select test.eq((select (p ->> 'tasks')::int from jsonb_array_elements(pg_temp.r('team')) p
                 where p ->> 'name' = pg_temp.r('cashier') #>> '{}'),
  6, 'of six');
select test.ok(not exists (select 1 from jsonb_array_elements(pg_temp.r('team')) p where p ->> 'name' like '%(practice)'),
  'practice colleagues are not the café''s people');

-- ------------------------------------------------------------ again, from the start
select test.act_as('cashier@example.com');
select pg_temp.practise(false);
select practice_reset();
select test.ok(pg_temp.practice_cafe('cashier@example.com') <> (pg_temp.r('cafe') #>> '{}')::uuid, 'a fresh practice café');
select pg_temp.practise(true);
select test.eq((select count(*) from sales_order)::int, 0, 'with nothing sold yet');
select test.ok(pg_temp.done('sell_card'), 'and the ticks kept');

-- ------------------------------------------------------------ the guards
select pg_temp.practise(false);
select test.as_admin();
select test.ok(not has_function_privilege('authenticated', 'practice_seed(uuid)', 'execute'),
  'no one makes a practice café but practice_start');
select test.ok(not has_function_privilege('authenticated', 'session_member_id()', 'execute'), 'nor asks who is who');
