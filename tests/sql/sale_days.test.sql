-- =============================================================================
-- Sale days (0106): the owner sets "20% off, today to the day after"; the till
-- sees it; the cashier (whose own cap is 10%) gives it with no manager; it is
-- kept as "Sale day: name" and counted in its result against the week before.
-- Two sale days are never on at once; one that has begun is stopped, not
-- changed; a stopped one is over, and the cap is the cashier's own again.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
grant execute on function pg_temp.r(text) to public;
\set E '''[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2}]'''

-- A sale in the same hour last week: what the sale day is set against.
select test.act_as('cashier@example.com');
insert into res select 'last_week', record_sale(gen_random_uuid(), 'dine_in', 'cash', :E);
select test.as_admin();
alter table sales_order disable trigger user;
update sales_order set placed_at = placed_at - interval '7 days'
 where id = (pg_temp.r('last_week') ->> 'order_id')::uuid;
alter table sales_order enable trigger user;

-- ------------------------------------------------------------ setting one up
select test.act_as('owner@example.com');
select test.throws($$select save_sale_day(null, ' ', 20, test.today(), test.today() + 1)$$,
  'Give the sale day a name', 'it has a name');
select test.throws($$select save_sale_day(null, 'Too much', 95, test.today(), test.today() + 1)$$,
  'A sale day takes from 1% to 90% off', 'from 1% to 90%');
select test.throws($$select save_sale_day(null, 'Backwards', 20, test.today() + 1, test.today())$$,
  'Choose the days, from and to', 'from before to');
select test.throws($$select save_sale_day(null, 'Yesterday', 20, test.today() - 1, test.today())$$,
  'A sale day begins today or later', 'not in the past');
select test.throws($$select save_sale_day(null, 'Hours', 20, test.today(), test.today(), '18:00', '09:00')$$,
  'Choose the hours, from and to, on the same day', 'hours from before to');
insert into res select 'sd', save_sale_day(null, 'Autumn sale', 20, test.today(), test.today() + 1);
select test.eq(pg_temp.r('sd') ->> 'status', 'on', 'it is on now');
select test.throws($$select save_sale_day(null, 'Another', 15, test.today() + 1, test.today() + 2)$$,
  'Another sale day is on then: Autumn sale', 'two sale days are never on at once');
select test.throws(format('select save_sale_day(%L, %L, 30, test.today(), test.today() + 1)',
  pg_temp.r('sd') ->> 'id', 'Autumn sale'),
  'A sale day that has begun is not changed: stop it, and start another', 'one that has begun is not changed');
select test.act_as('cashier@example.com');
select test.throws($$select save_sale_day(null, 'Mine', 50, test.today() + 10, test.today() + 11)$$,
  '%permission%', 'a cashier does not set one');

-- ------------------------------------------------------------ at the till
select test.eq(sale_day_now() ->> 'name', 'Autumn sale', 'the till sees the sale day on now');
select test.eq((sale_day_now() ->> 'percent')::numeric, 20::numeric, 'and its percentage');
-- 20% of 5,000 is 1,000: over the cashier's own 10%, within the sale day's.
insert into res select 'sale', record_sale(gen_random_uuid(), 'dine_in', 'cash', :E,
  p_discount_amount => 1000, p_discount_reason => 'sale_day', p_discount_note => 'Autumn sale');
select test.eq(pg_temp.r('sale') ->> 'discount', '1000', 'the cashier gives the sale day''s 20% with no manager');
select test.as_admin();
select test.eq((select discount_reason from sales_order where id = (pg_temp.r('sale') ->> 'order_id')::uuid),
  'Sale day: Autumn sale', 'kept as the sale day, by name');
select test.eq((select gross_amount::int || ' ' || discount_amount::int || ' ' || net_amount::int from sales_order
                 where id = (pg_temp.r('sale') ->> 'order_id')::uuid), '5000 1000 4000',
  'the full price and the discount apart');
select test.act_as('cashier@example.com');
select test.throws(format('select record_sale(%L, %L, %L, %L, p_discount_amount => 1500, p_discount_reason => %L)',
  gen_random_uuid(), 'dine_in', 'cash', :E, 'regular'),
  'A discount over 20% needs a manager''s approval', 'more than the sale day''s still needs a manager');

-- ------------------------------------------------------------ its result
select test.act_as('cashier@example.com');
select test.throws(format('select report_sale_day(%L)', pg_temp.r('sd') ->> 'id'), '%permission%',
  'a cashier does not see its result');
select test.act_as('owner@example.com');
insert into res select 'rep', report_sale_day((pg_temp.r('sd') ->> 'id')::uuid);
select test.eq((pg_temp.r('rep') -> 'during' ->> 'bills')::int, 1, 'one bill while it was on');
select test.eq((pg_temp.r('rep') -> 'during' ->> 'full_price')::numeric, 5000::numeric, 'at 5,000 full price');
select test.eq((pg_temp.r('rep') -> 'during' ->> 'sale_day_discount')::numeric, 1000::numeric, 'the sale day gave 1,000');
select test.eq((pg_temp.r('rep') -> 'before' ->> 'bills')::int, 1, 'the same hours of the week before: one bill');
select test.eq((pg_temp.r('rep') -> 'before' ->> 'sales')::numeric, 5000::numeric, 'for 5,000');
select test.eq((pg_temp.r('rep') ->> 'sales_change')::numeric, -1000::numeric, 'sales 1,000 less than the week before');
select test.eq((pg_temp.r('rep') ->> 'weeks_before')::int, 1, 'set against one week before');
select test.eq(jsonb_array_length(sale_days()), 1, 'the owner sees the sale days');

-- ------------------------------------------------------------ stopped
select stop_sale_day((pg_temp.r('sd') ->> 'id')::uuid);
select test.throws(format('select stop_sale_day(%L)', pg_temp.r('sd') ->> 'id'), 'That sale day is over already',
  'stopped once');
select test.eq(sale_days() -> 0 ->> 'status', 'stopped', 'it shows as stopped');
select test.act_as('cashier@example.com');
select test.ok(sale_day_now() is null, 'the till has no sale day now');
select test.throws(format('select record_sale(%L, %L, %L, %L, p_discount_amount => 1000, p_discount_reason => %L)',
  gen_random_uuid(), 'dine_in', 'cash', :E, 'sale_day'),
  'A discount over 10% needs a manager''s approval', 'the cashier''s own cap again');

-- A planned one is changed, and stopping it means it never begins.
select test.act_as('owner@example.com');
insert into res select 'next', save_sale_day(null, 'Eid', 15, test.today() + 5, test.today() + 7, '16:00', '22:00',
  array[(select id from product_category where business_id = '00000000-0000-0000-0000-0000000000b1' order by name limit 1)]);
select test.eq(pg_temp.r('next') ->> 'status', 'planned', 'a sale day to come');
select test.eq(jsonb_array_length(pg_temp.r('next') -> 'excluded_categories'), 1, 'one category left out');
select test.eq(save_sale_day((pg_temp.r('next') ->> 'id')::uuid, 'Eid sale', 25, test.today() + 5, test.today() + 7)
                 ->> 'name', 'Eid sale', 'changed before it begins');
select test.eq(stop_sale_day((pg_temp.r('next') ->> 'id')::uuid) ->> 'status', 'stopped', 'and stopped: it never begins');
select test.as_admin();
select test.eq((select count(*)::int from audit_log where action like 'sale_day.%'), 5, 'each on the audit trail');
