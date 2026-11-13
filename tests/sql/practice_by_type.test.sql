-- =============================================================================
-- Practice for each type of business (0120): a café sees no kitchen or quote
-- tasks; turned into a restaurant, its staff practise sending to the kitchen
-- and taking a reservation, in a practice café that is a restaurant too.
-- =============================================================================
select test.golden_catalogue();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.tasks() returns text language sql as $$
  select string_agg(x ->> 'task', ',' order by x ->> 'task') from res r, jsonb_array_elements(r.v -> 'tasks') x
   where r.k = 'p' $$;
grant execute on function pg_temp.tasks() to public;

select test.act_as('manager@example.com');
insert into res select 'p', practice_tasks();
select test.eq(position('kitchen_send' in pg_temp.tasks()) = 0 and position('quote' in pg_temp.tasks()) = 0, true,
  'a café: no kitchen, no quotes to practise');
select test.act_as('owner@example.com');
select set_business_type('restaurant', 'We serve at tables');
select test.act_as('manager@example.com');
delete from res;
insert into res select 'p', practice_start();
select test.eq(position('kitchen_send' in pg_temp.tasks()) > 0 and position('reservation' in pg_temp.tasks()) > 0, true,
  'a restaurant: sending to the kitchen and a reservation to practise');
select test.as_admin();
select test.eq((select b.business_type from practice_twin t join app_user w on w.id = t.twin_id
                  join business b on b.id = w.business_id
                  join app_user u on u.id = t.app_user_id where u.email = 'manager@example.com'), 'restaurant',
  'in a practice café that is a restaurant too');
