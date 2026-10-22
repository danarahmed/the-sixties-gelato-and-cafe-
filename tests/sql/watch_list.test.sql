-- =============================================================================
-- The watch list (0094, SMART_PLAN part 2): over four weeks, each person set
-- against the others who sold at the same hours. Bea voids far more than the
-- other evening cashier; Ana gives 9% "regular customer" discounts again and
-- again; Bea's drawer is short every Thursday. The evening's honest voids, a
-- promotion everyone gives, and a new cashier's beginner's voids are left
-- alone. Kept, settled, not raised again; the alert names nobody; who may read.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create function pg_temp.loc() returns uuid language sql security definer as $$
  select default_location('00000000-0000-0000-0000-0000000000b1')
$$;
create function pg_temp.person(p_name text) returns uuid language sql security definer as $$
  select id from app_user where business_id = '00000000-0000-0000-0000-0000000000b1' and full_name = p_name
$$;
create function pg_temp.at(p_days_ago int, p_time text) returns timestamptz language sql as $$
  select ((test.today() - p_days_ago)::timestamp + p_time::time) at time zone 'Asia/Baghdad'
$$;
create function pg_temp.says() returns text language sql security definer as $$
  select coalesce(string_agg(who || ' ' || kind || coalesce(nullif(' (' || detail_key || ')', ' ()'), ''), ', '
                             order by who, kind), 'nothing')
    from watch_scan('00000000-0000-0000-0000-0000000000b1', now())
$$;

-- Three cashiers besides the demo one: Ana (mornings), Bea (evenings), and
-- Cy, new ten days ago (mornings).
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000a1', 'ana@example.com'),
  ('a0000000-0000-0000-0000-0000000000a2', 'bea@example.com'),
  ('a0000000-0000-0000-0000-0000000000a3', 'cy@example.com');
insert into app_user (business_id, full_name, email, auth_user_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'Watch Ana', 'ana@example.com', 'a0000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b1', 'Watch Bea', 'bea@example.com', 'a0000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b1', 'Watch Cy', 'cy@example.com', 'a0000000-0000-0000-0000-0000000000a3');
insert into user_role (app_user_id, role)
select id, 'cashier' from app_user where email in ('ana@example.com', 'bea@example.com', 'cy@example.com');

-- Four weeks of sales, written straight in (the till's own rules and the
-- books are not what is tested here).
set session_replication_role = replica;
create temp table sale_plan as
select d, who, hour, n, coalesce(disc, null::numeric) as disc, reason
  from generate_series(1, 27) d
  cross join lateral (values
    ('Watch Ana', '10:00', 20, null::numeric, null::text),
    ('Watch Bea', '18:00', 20, null, null),
    ('Demo Cashier', '18:00', 20, null, null)) v(who, hour, n, disc, reason)
union all
-- Cy, from ten days ago.
select d, 'Watch Cy', '10:00', 20, null, null from generate_series(1, 10) d
union all
-- The others have worked here for months: a sale each two months ago.
select 60, w, '12:00', 1, null, null from unnest(array['Watch Ana', 'Watch Bea', 'Demo Cashier']) w;
insert into sales_order (business_id, location_id, channel, status, idempotency_key, gross_amount, net_amount,
                         cashier_id, placed_at, discount_percent, discount_reason)
select '00000000-0000-0000-0000-0000000000b1', pg_temp.loc(), 'dine_in', 'completed', gen_random_uuid(), 4000, 4000,
       pg_temp.person(p.who), pg_temp.at(p.d, p.hour) + make_interval(mins => k), null, null
  from sale_plan p cross join generate_series(1, p.n) k;
-- Ana: a 9% "regular customer" discount on three sales a day.
update sales_order o set discount_percent = 9, discount_reason = 'Regular customer'
 where o.cashier_id = pg_temp.person('Watch Ana') and extract(minute from o.placed_at at time zone 'Asia/Baghdad') in (1, 2, 3);
-- The evening's promotion: Bea and the demo cashier each give 8% on two sales a day.
update sales_order o set discount_percent = 8, discount_reason = 'Promotion'
 where o.cashier_id in (pg_temp.person('Watch Bea'), pg_temp.person('Demo Cashier'))
   and extract(minute from o.placed_at at time zone 'Asia/Baghdad') in (5, 6);
-- Voids: the demo cashier one every other evening (the evening's honest
-- rate); Bea three every evening; Cy, new, five every morning.
insert into sale_adjustment (business_id, sales_order_id, kind, amount, reason, reason_code, created_at)
select o.business_id, o.id, 'void', o.net_amount, 'test', 'customer_left', o.placed_at + interval '5 minutes'
  from sales_order o
 where o.business_id = '00000000-0000-0000-0000-0000000000b1'
   and ((o.cashier_id = pg_temp.person('Demo Cashier') and extract(minute from o.placed_at at time zone 'Asia/Baghdad') = 10
         and extract(day from o.placed_at at time zone 'Asia/Baghdad')::int % 2 = 0)
     or (o.cashier_id = pg_temp.person('Watch Bea') and extract(minute from o.placed_at at time zone 'Asia/Baghdad') in (10, 11, 12))
     or (o.cashier_id = pg_temp.person('Watch Cy') and extract(minute from o.placed_at at time zone 'Asia/Baghdad') between 10 and 14));
update sales_order o set status = 'voided' where exists (select 1 from sale_adjustment a where a.sales_order_id = o.id);
-- Drawers: one a day for each; Bea's short by 8,000 every Thursday.
insert into work_shift (business_id, location_id, kind, cashier_id, opened_at, closed_at, variance, drawer_id,
                        session_no, opening_counted)
select '00000000-0000-0000-0000-0000000000b1', pg_temp.loc(), 'session', pg_temp.person(p.who),
       pg_temp.at(p.d, p.hour), pg_temp.at(p.d, p.hour) + interval '6 hours',
       case when p.who = 'Watch Bea' and extract(isodow from test.today() - p.d) = 4 then -8000 else 0 end,
       (select id from cash_drawer where business_id = '00000000-0000-0000-0000-0000000000b1' order by id limit 1),
       90000 + row_number() over (order by p.d, p.who), 0
  from (select distinct d, who, hour from sale_plan where d <= 27) p;
set session_replication_role = origin;

-- ------------------------------------------------------------ what stands out
select test.eq(pg_temp.says(),
  'Watch Ana discounts (Regular customer), Watch Bea drawer_short, Watch Bea voids',
  'Bea''s voids against the other evening cashier''s, Ana''s 9% discounts, Bea''s Thursdays; not the evening''s honest voids, not the promotion, not Cy while new');
select test.ok((select chance < 1e-6 from watch_scan('00000000-0000-0000-0000-0000000000b1', now()) where who = 'Watch Bea' and kind = 'voids'),
  'Bea''s voids: far beyond luck');
select test.eq((select (evidence ->> 'same_weekday')::int >= 2 from watch_scan('00000000-0000-0000-0000-0000000000b1', now())
                 where who = 'Watch Bea' and kind = 'drawer_short'), true, 'short on the same weekday, again and again');

-- ------------------------------------------------------------ who may read it
select test.act_as('cashier@example.com');
select test.throws('select watch_list()', 'The watch list is for the owner', 'a cashier reads no watch list');
select test.act_as('manager@example.com');
select test.ok(not watch_may_see(), 'a branch manager does not see it');
select test.act_as('owner@example.com');
select test.ok(watch_may_see(), 'the owner sees it');
select test.eq((select count(*)::int from jsonb_array_elements(watch_list() -> 'findings') f where f ->> 'status' = 'open'),
  3, 'the owner reads three findings, raised as the list is opened');
select test.as_admin();
select test.eq(watch_refresh('00000000-0000-0000-0000-0000000000b1'), 0, 'looked again: nothing new, the three kept');

-- A general manager, once the owner allows it.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000a4', 'gm@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Watch GM', 'gm@example.com', 'a0000000-0000-0000-0000-0000000000a4');
insert into user_role (app_user_id, role) select id, 'general_manager' from app_user where email = 'gm@example.com';
select test.act_as('gm@example.com');
select test.throws('select watch_list()', 'The watch list is for the owner', 'not yet');
select test.throws('select set_watch_visibility(true)', 'Only the owner says who reads the watch list', 'only the owner says');
select test.act_as('owner@example.com');
select set_watch_visibility(true);
select test.act_as('gm@example.com');
select test.eq(jsonb_array_length(watch_list() -> 'findings'), 3, 'allowed, the general manager reads it');

-- ------------------------------------------------------------ settled
select test.act_as('owner@example.com');
create temp table f as
select (f ->> 'id')::uuid as id from jsonb_array_elements(watch_list() -> 'findings') f
 where f ->> 'person' = 'Watch Ana';
grant select on f to public;
select test.throws($$select settle_watch_finding((select id from f), 'forgiven', null, gen_random_uuid())$$,
  'Mark it explained or looked into', 'explained or looked into');
select settle_watch_finding((select id from f), 'explained', 'The regulars'' discount, agreed with me', gen_random_uuid());
select test.throws($$select settle_watch_finding((select id from f), 'looked_into', null, gen_random_uuid())$$,
  'That finding is settled already', 'once');
select test.eq((select f ->> 'status' || ' ' || (f ->> 'note') from jsonb_array_elements(watch_list() -> 'findings') f
                 where f ->> 'person' = 'Watch Ana'),
  'explained The regulars'' discount, agreed with me', 'kept as settled, with the note');
select test.as_admin();
select test.eq(watch_refresh('00000000-0000-0000-0000-0000000000b1'), 0, 'settled: not raised again for two weeks');

-- ------------------------------------------------------------ the alert names nobody
select test.eq((select rule || ' ' || title || ' ' || link from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'watch_strong'),
  'watch_strong ' || (select count(*) from watch_finding where status = 'open' and strength = 'strong')
    || ' thing(s) on the watch list worth a look /reports/watch', 'the strong ones open counted, and no name');
select test.ok((select count(*) from watch_finding where status = 'open' and strength = 'strong') >= 1, 'Bea''s voids among them');
