-- =============================================================================
-- Security fixes (0099): clocking from a phone only near the shop or inside
-- it; the till's lock, unlocked with the person's PIN; screens that fail and
-- sign-ins from a new device, as alerts; a fixed search_path for the helpers.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.k(p text) returns text language sql as $$ select v ->> 'key' from res where k = p $$;
create function pg_temp.person(p_name text) returns uuid language sql security definer as $$
  select id from employee where full_name = p_name
$$;
create function pg_temp.main() returns uuid language sql security definer as $$
  select default_location('00000000-0000-0000-0000-0000000000b1')
$$;
create function pg_temp.code(p_screen text) returns text language sql as $$
  select clock_screen_code(pg_temp.k(p_screen)) ->> 'code'
$$;
create function pg_temp.alerts(p_rule text) returns text language sql security definer as $$
  select string_agg(title, ' | ' order by title) from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
   where rule = p_rule
$$;

-- ------------------------------------------------------------------ near the shop
select test.act_as('manager@example.com');
select save_employee(null, 'Rana', null, 'Barista', pg_temp.main(), test.today() - 30, null, gen_random_uuid());
select set_clock_pin(pg_temp.person('Rana'), '4826');
insert into res select 'link', link_phone_start(pg_temp.person('Rana'));
select test.act_as('owner@example.com');
insert into res select 'till', register_clock_screen(null, 'The till');
select test.act_as_anon();
insert into res select 'phone', link_phone_finish(pg_temp.k('link'));

-- No spot for the shop yet: a phone clocks from anywhere, as before.
select test.ok((clock_by_phone(pg_temp.k('phone'), pg_temp.code('till'), 'in', gen_random_uuid()) ->> 'ok')::boolean,
  'no spot: clocked in, as before');
select test.ok((clock_by_phone(pg_temp.k('phone'), pg_temp.code('till'), 'out', gen_random_uuid()) ->> 'ok')::boolean,
  'and out');

select test.act_as('manager@example.com');
select test.throws($$select set_place_clock_spot(pg_temp.main(), 36.19, 44.01)$$, '%settings.manage%',
  'a branch manager does not set where the shop is');
select test.act_as('owner@example.com');
select test.throws($$select set_place_clock_spot(pg_temp.main(), 36.19, null)$$, '%both%', 'north and east, both');
select test.throws($$select set_place_clock_spot(pg_temp.main(), 36.19, 44.01, 5)$$, '%20 to 2,000 metres%',
  'near is 20 to 2,000 metres');
select set_place_clock_spot(pg_temp.main(), 36.1900, 44.0100, 100);

select test.act_as_anon();
select test.eq(clock_by_phone(pg_temp.k('phone'), pg_temp.code('till'), 'in', gen_random_uuid()) ->> 'error',
  'Let this phone say where it is: clocking from a phone is at the shop', 'a phone that will not say where it is');
-- About 1.1 km away: refused, with how far.
insert into res select 'scan', to_jsonb(pg_temp.code('till'));
select test.ok(clock_by_phone(pg_temp.k('phone'), pg_temp.r('scan') #>> '{}', 'in', 'd0000000-0000-0000-0000-000000000099',
                              36.2000, 44.0100, 20) ->> 'error' like 'This phone is about 11__ m from %',
  'a phone at home, a kilometre off, is refused: the code sent by a colleague is no use');
-- About 50 m away, the same scan sent again: in (the refusal was not kept).
select test.ok((clock_by_phone(pg_temp.k('phone'), pg_temp.r('scan') #>> '{}', 'in', 'd0000000-0000-0000-0000-000000000099',
                               36.19045, 44.0100, 15) ->> 'ok')::boolean, 'at the shop, the same scan: clocked in');
-- 150 m off, but the phone is unsure by 60 m: given the benefit of it.
select test.ok((clock_by_phone(pg_temp.k('phone'), pg_temp.code('till'), 'out', gen_random_uuid(),
                               36.19135, 44.0100, 60) ->> 'ok')::boolean,
  'just outside, with the phone''s own margin: clocked out');

-- ------------------------------------------------------------------ the till's lock
select test.as_admin();
select test.eq(rule_value('00000000-0000-0000-0000-0000000000b1', 'till_lock_minutes') #>> '{}', '0',
  'the lock is off by default');
select test.act_as('owner@example.com');
select set_business_rule('till_lock_minutes', 'business', '', '5', 'Lock the till after five minutes');
select test.as_admin();
update employee set app_user_id = (select id from app_user where email = 'cashier@example.com')
 where id = pg_temp.person('Rana');
select test.act_as('cashier@example.com');
select test.eq(unlock_till('1111') ->> 'error', 'That PIN is not right', 'a wrong PIN does not unlock it');
select test.eq(unlock_till('4826') ->> 'ok', 'true', 'the cashier''s own clock PIN does');
select unlock_till('0000'), unlock_till('0000'), unlock_till('0000'), unlock_till('0000'), unlock_till('0000');
select test.eq(unlock_till('4826') ->> 'error', 'Too many wrong PINs: sign out, and sign in again',
  'five wrong: only signing in again');
select test.act_as('counter@example.com');
select test.ok(unlock_till('1234') ->> 'error' like 'You have no PIN yet%', 'someone with no PIN is told how');

-- ------------------------------------------------------------------ screens that fail
select test.act_as('cashier@example.com');
select note_stuck('/pos', 'error', 'Cannot read the menu');
select note_stuck('/inventory', 'error', 'Failed to fetch');
select test.eq(pg_temp.alerts('app_errors'), null::text, 'two failures are not an alert');
select note_stuck('/purchasing', 'error', 'Failed to fetch');
select test.eq(pg_temp.alerts('app_errors'), '3 screens failed in the last hour', 'three in an hour are');
select test.act_as('owner@example.com');
select test.eq((select string_agg((x ->> 'path') || ' ' || (x ->> 'errors'), ', ' order by x ->> 'path')
                  from jsonb_array_elements(stuck_report(30) -> 'screens') x),
  '/inventory 1, /pos 1, /purchasing 1', 'the owner sees which screens failed');

-- ------------------------------------------------------------------ a new device
select test.act_as('owner@example.com');
select test.eq(note_device('the-owner''s-laptop-key-0001', 'Chrome on Windows') ->> 'new', 'false',
  'the first device someone uses is not news');
select test.eq(note_device('the-owner''s-laptop-key-0001', 'Chrome on Windows') ->> 'new', 'false', 'nor that one again');
select test.eq(note_device('a-phone-never-seen-before-01', 'Safari on iPhone') ->> 'new', 'true', 'another one is');
select test.ok(pg_temp.alerts('new_device') like '% signed in from a new device: Safari on iPhone',
  'an alert for the owner, who may see the books');
select test.act_as('cashier@example.com');
select note_device('cashier-till-key-000000001', 'Chrome'), note_device('cashier-phone-key-0000001', 'Safari');
select test.ok(pg_temp.alerts('new_device') not like '%Demo Cashier%', 'a cashier''s new phone is not an alert');
select test.as_admin();
select test.eq((select count(*)::int from member_device d where d.device_hash like '%laptop%'), 0,
  'a device''s key is kept as its hash');

-- ------------------------------------------------------------------ the guards
select test.ok(not has_function_privilege('authenticated', 'geo_metres(double precision, double precision, double precision, double precision)', 'execute'),
  'the distance is worked out inside');
select test.eq((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.prosecdef
                   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')), 0,
  'every security-definer function has a fixed search_path');
select test.eq((select string_agg(x, ',') from (values ('post_journal'), ('next_document_no')) v(x)
                 where not exists (select 1 from pg_proc p where p.proname = v.x
                   and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'))),
  null::text, 'and the rarely called helpers have one now');
