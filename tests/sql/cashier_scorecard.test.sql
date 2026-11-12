-- =============================================================================
-- Comparing cashiers (0104): the cashier rings up two sales and the manager
-- one; the cashier was clocked in two hours. The scorecard has each, with
-- their bills, sales, items and hours; the cashier does not see it.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.row(p_email text) returns jsonb language sql security definer as $$
  select x from res, jsonb_array_elements(v -> 'cashiers') x
   where k = 'card' and x ->> 'member_id' = (select id::text from app_user where email = p_email)
$$;
grant execute on function pg_temp.row(text) to public;
\set E '''[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2}]'''

-- Rana is the cashier, clocked in for the last two hours.
create temp table main as select default_location('00000000-0000-0000-0000-0000000000b1') as id;
grant select on main to public;
select test.act_as('owner@example.com');
select save_employee(null, 'Rana', null, 'Barista', (select id from main), test.today() - 30, null, gen_random_uuid());
select test.as_admin();
update employee set app_user_id = (select id from app_user where email = 'cashier@example.com')
 where full_name = 'Rana';
insert into attendance (business_id, employee_id, location_id, clock_in, clock_out, work_day, source)
select e.business_id, e.id, (select id from location where business_id = e.business_id and kind = 'branch'
                                order by created_at limit 1),
       now() - interval '2 hours', now(), test.today(), 'till'
  from employee e where e.full_name = 'Rana';
select test.eq((select count(*)::int from attendance a join employee e on e.id = a.employee_id
                 where e.app_user_id = (select id from app_user where email = 'cashier@example.com')
                   and a.cancelled_at is null), 1, 'the cashier''s two hours are on the clock');

select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', :E);
select record_sale(gen_random_uuid(), 'dine_in', 'cash', :E);
select test.throws($$select report_cashier_scorecard(test.today(), test.today())$$, '%permission%',
  'a cashier does not see the scorecard');
select test.act_as('manager@example.com');
select record_sale(gen_random_uuid(), 'takeaway', 'cash',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]');

insert into res select 'card', report_cashier_scorecard(test.today(), test.today());
select test.eq((pg_temp.row('cashier@example.com') ->> 'bills')::int, 2, 'the cashier: two bills');
select test.eq((pg_temp.row('cashier@example.com') ->> 'sales')::numeric, 10000::numeric, 'for 10,000');
select test.eq((pg_temp.row('cashier@example.com') ->> 'average_bill')::numeric, 5000::numeric, 'an average bill of 5,000');
select test.eq((pg_temp.row('cashier@example.com') ->> 'items_per_bill')::numeric, 2::numeric, 'two items a bill');
select test.eq((pg_temp.row('cashier@example.com') ->> 'hours')::numeric, 2::numeric, 'two hours worked, by the clock');
select test.eq((pg_temp.row('cashier@example.com') ->> 'sales_per_hour')::numeric, 5000::numeric, '5,000 an hour');
select test.ok(pg_temp.row('cashier@example.com') ->> 'against_usual' is null,
  'no weeks before to set it against: no comparison is made up');
select test.eq((pg_temp.row('manager@example.com') ->> 'bills')::int, 1, 'the manager: one bill');
select test.eq((pg_temp.row('manager@example.com') ->> 'hours')::numeric, 0::numeric, 'not clocked in');
select test.throws($$select report_cashier_scorecard(test.today(), test.today() - 1)$$,
  'Choose the days, from and to', 'from before to');
