-- =============================================================================
-- Loyalty points as money owed (0113): a point is worth the reward's 5,000
-- over its 100 points, 50. Hawre's 10 points, earned before it is on, are
-- booked as owed (500) when the owner turns it on; points earned after it are
-- a cost as they are earned (Dr 6150, Cr 2150); a reward spends 100 points,
-- owed no more, its 5,000 still the bill's discount (4100); a void gives them
-- back; turned off, nothing is owed. The books tie throughout.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.espressos(n int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', n))
$$;
create function pg_temp.hawre() returns uuid language sql security definer as $$
  select id from customer where full_name = 'Hawre' $$;
create function pg_temp.bal(p text) returns numeric language sql security definer as $$ select test.balance(p) $$;
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
$$;
grant execute on function pg_temp.r(text), pg_temp.hawre(), pg_temp.bal(text), pg_temp.checks() to public;
create temp table before as select pg_temp.checks() as checks;
grant select on before to public;

select test.act_as('cashier@example.com');
select save_customer(null, 'Hawre', '0770 123 4567');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(4), p_customer => pg_temp.hawre());
select test.eq(pg_temp.bal('2150'), 0::numeric, 'off: points are not owed');

-- --------------------------------------------------------------- turned on
select test.act_as('manager@example.com');
select test.throws($$select set_loyalty_owed(true)$$, 'Only the owner books points as money owed',
  'the owner''s to turn on');
select test.act_as('owner@example.com');
insert into res select 'on', set_loyalty_owed(true);
select test.eq((pg_temp.r('on') ->> 'point_value')::numeric, 50::numeric, 'a point is worth 50');
select test.eq((pg_temp.r('on') ->> 'owed')::int, 500, 'the 10 points held: 500 owed');
select test.eq(pg_temp.bal('2150')::int, -500, 'on 2150');
select test.eq(pg_temp.bal('6150')::int, 500, 'their cost on 6150');

-- --------------------------------------------------------------- earned, given, spent
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(4), p_customer => pg_temp.hawre());
select test.eq(pg_temp.bal('2150')::int, -1000, 'ten more earned: 1,000 owed');
select test.act_as('manager@example.com');
select adjust_points(pg_temp.hawre(), 80, 'A birthday', gen_random_uuid());
select test.eq(pg_temp.bal('2150')::int, -5000, 'eighty given by hand: 5,000 owed for 100 points');
select test.act_as('cashier@example.com');
insert into res select 'S', record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(3),
                                        p_customer => pg_temp.hawre(), p_rewards => 1);
select test.eq(pg_temp.bal('2150')::int, -100,
  'a reward spends 100 points (5,000 owed no more); the 2,500 paid earns 2 (100)');
select test.eq(pg_temp.bal('6150')::int, 100, 'the cost is the points still held');
select test.as_admin();
select test.eq((select sum(l.debit)::int from journal_line l join journal_entry e on e.id = l.journal_entry_id
                  join gl_account g on g.id = l.account_id
                 where g.code = '4100' and e.reference_type = 'sales_order'
                   and e.reference_id = (pg_temp.r('S') ->> 'order_id')::uuid), 5000,
  'the reward is still the bill''s discount, on 4100');

-- --------------------------------------------------------------- a void gives them back
select test.act_as('manager@example.com');
select void_sale((pg_temp.r('S') ->> 'order_id')::uuid, null, 'rang_twice');
select test.eq(pg_temp.bal('2150')::int, -5000, 'voided: its 100 points back, its 2 taken: 5,000 owed');
select test.act_as('owner@example.com');
select test.eq((loyalty_owed() ->> 'worth')::int, (loyalty_owed() ->> 'owed')::int,
  'what the books owe is what the points held are worth');
select test.eq(pg_temp.checks(), (select checks from before), 'the books still tie');

-- --------------------------------------------------------------- turned off
insert into res select 'off', set_loyalty_owed(false);
select test.eq(pg_temp.bal('2150')::int, 0, 'off: nothing owed');
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(4), p_customer => pg_temp.hawre());
select test.eq(pg_temp.bal('2150')::int, 0, 'and points earned are not booked');
