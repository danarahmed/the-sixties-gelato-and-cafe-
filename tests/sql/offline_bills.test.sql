-- =============================================================================
-- A bill on a table paid without internet (0082, G1): the till keeps the
-- payment with the bill's version and sends it when the connection is back.
-- Paid once whatever happens, at the time the money was taken, marked sold
-- offline; refused when another till changed the bill or paid it meanwhile.
-- Espresso: 2,500 dine-in. The fixtures opened the drawer.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.espressos(n int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', n))
$$;
create function pg_temp.tab(p text) returns pos_tab language sql security definer as $$
  select * from pos_tab where id = (select (v ->> 'tab_id')::uuid from res where k = p)
$$;
create function pg_temp.sale(p text) returns sales_order language sql security definer as $$
  select * from sales_order where id = (select (v ->> 'order_id')::uuid from res where k = p)
$$;
create function pg_temp.orders() returns bigint language sql security definer as $$
  select count(*) from sales_order
$$;
create function pg_temp.member(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
-- Earlier today, in the café's own day.
create function pg_temp.earlier() returns timestamptz language sql stable security definer as $$
  select greatest(now() - interval '20 minutes',
                  (test.today()::timestamp + interval '1 minute') at time zone
                    (select timezone from business where id = '00000000-0000-0000-0000-0000000000b1'))
$$;
create temp table t0 as select pg_temp.earlier() as at;
grant select on t0 to public;

-- ------------------------------------------------------------ a table's bill, paid while offline
select test.act_as('cashier@example.com');
insert into res select 'B', open_tab('dine_in', p_label => 'Table 4', p_lines => pg_temp.espressos(2));
insert into res select 'P', settle_tab_offline((pg_temp.r('B') ->> 'tab_id')::uuid, (pg_temp.tab('B')).version,
  '82000000-0000-0000-0000-000000000001', (select at from t0),
  '[{"type": "cash", "amount": 5000, "received": 5000}]', 5000,
  pg_temp.member('cashier@example.com'), 'till-2');
select test.eq((pg_temp.r('P') ->> 'net')::numeric, 5000::numeric, 'paid at what the bill showed');
select test.eq((pg_temp.tab('B')).status::text, 'paid', 'the bill is paid');
select test.eq((pg_temp.sale('P')).placed_at, (select at from t0), 'at the time the money was taken');
select test.eq((pg_temp.sale('P')).sold_offline_at, (select at from t0), 'marked as sold offline');
select test.eq((pg_temp.sale('P')).device_id, 'till-2', 'on the till it was taken on');

-- ------------------------------------------------------------ sent again: paid once
create temp table n0 as select pg_temp.orders() as n;
grant select on n0 to public;
insert into res select 'P2', settle_tab_offline((pg_temp.r('B') ->> 'tab_id')::uuid, (pg_temp.tab('B')).version,
  '82000000-0000-0000-0000-000000000001', (select at from t0),
  '[{"type": "cash", "amount": 5000, "received": 5000}]', 5000);
select test.eq(pg_temp.r('P2') ->> 'order_id', pg_temp.r('P') ->> 'order_id', 'sent twice: the same sale');
select test.eq(pg_temp.orders(), (select n from n0), 'and no second sale');

-- ------------------------------------------------------------ another till paid it meanwhile
insert into res select 'C', open_tab('dine_in', p_label => 'Table 5', p_lines => pg_temp.espressos(1));
insert into res select 'C1', settle_tab((pg_temp.r('C') ->> 'tab_id')::uuid, (pg_temp.tab('C')).version,
  gen_random_uuid(), 'card');
select test.throws(format('select settle_tab_offline(%L, %s, %L, %L, %L)',
  pg_temp.r('C') ->> 'tab_id', (pg_temp.tab('C')).version, gen_random_uuid(), (select at from t0),
  '[{"type": "cash", "amount": 2500, "received": 2500}]'),
  '%paid on another till%', 'paid on another till too: refused, not taken as sent');

-- ------------------------------------------------------------ another till changed it meanwhile
insert into res select 'D', open_tab('dine_in', p_label => 'Table 6', p_lines => pg_temp.espressos(1));
create temp table v0 as select (pg_temp.tab('D')).version as v;
grant select on v0 to public;
select save_tab((pg_temp.r('D') ->> 'tab_id')::uuid, (select v from v0), pg_temp.espressos(3));
select test.throws(format('select settle_tab_offline(%L, %s, %L, %L, %L, 2500)',
  pg_temp.r('D') ->> 'tab_id', (select v from v0), gen_random_uuid(), (select at from t0),
  '[{"type": "cash", "amount": 2500, "received": 2500}]'),
  null, 'changed on another till since: refused, for a manager');
select test.eq((pg_temp.tab('D')).status::text, 'open', 'and the bill stays open');

-- ------------------------------------------------------------ what a till may not send
select test.throws(format('select settle_tab_offline(%L, %s, %L, %L, %L)',
  pg_temp.r('D') ->> 'tab_id', (pg_temp.tab('D')).version, gen_random_uuid(), now() + interval '1 hour',
  '[{"type": "cash", "amount": 7500, "received": 7500}]'),
  '%later than now%', 'dated later than now: the till''s clock is wrong');
select test.throws(format('select settle_tab_offline(%L, %s, %L, %L, %L)',
  pg_temp.r('D') ->> 'tab_id', (pg_temp.tab('D')).version, gen_random_uuid(), now(),
  '[{"type": "cash", "amount": 5, "currency": "USD"}]'),
  '%dollars%', 'dollars are not taken offline');
select test.throws(format('select settle_tab_offline(%L, %s, %L, %L, %L)',
  gen_random_uuid(), 1, gen_random_uuid(), now(), '[{"type": "cash", "amount": 1}]'),
  '%Bill not found%', 'a bill that is not the café''s');
