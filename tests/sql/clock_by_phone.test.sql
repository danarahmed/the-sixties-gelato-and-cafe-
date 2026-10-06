-- =============================================================================
-- Clocking in on your own phone, with the shop's code (0068, round eight).
--
-- Before the café has a clock screen nothing changes. The owner makes the
-- till one ("The till", at the main branch) and a tablet another ("Door
-- tablet", at the second branch); each shows a code of 6 digits that changes
-- every half-minute, told only to the device holding its key. A manager links
-- Rana's and Shna's phones; Dara has none and clocks at the till with her PIN,
-- on a clock screen only. Rana clocks in and out with the code, from her phone;
-- an old code, a wrong one, another café's, a removed screen's are refused,
-- and five wrong codes pause the phone. Phones are unlinked, screens removed,
-- and only the keys' hashes are kept.
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
create function pg_temp.member(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
create function pg_temp.main() returns uuid language sql security definer as $$
  select default_location('00000000-0000-0000-0000-0000000000b1')
$$;
create function pg_temp.main_name() returns text language sql security definer as $$
  select name from location where id = default_location('00000000-0000-0000-0000-0000000000b1')
$$;
create function pg_temp.second() returns uuid language sql security definer as $$
  select id from location where business_id = '00000000-0000-0000-0000-0000000000b1' and name = 'Second Branch'
$$;
-- A screen's code now (as the screen asks for it), some half-minutes ago, or
-- in a given half-minute.
create function pg_temp.code(p_screen text) returns text language sql as $$
  select clock_screen_code(pg_temp.k(p_screen)) ->> 'code'
$$;
create function pg_temp.code_at(p_screen text, p_window bigint) returns text language sql security definer as $$
  select clock_code_of(s.business_id, s.id, p_window)
    from clock_screen s where s.id = (select (v ->> 'id')::uuid from res where k = p_screen)
$$;
create function pg_temp.code_before(p_screen text, p_windows int) returns text language sql security definer as $$
  select pg_temp.code_at(p_screen, clock_window(clock_timestamp()) - p_windows)
$$;
create function pg_temp.phone(p_name text) returns staff_phone language sql security definer as $$
  select p.* from staff_phone p join employee e on e.id = p.employee_id where e.full_name = p_name and p.ended_at is null
$$;
create function pg_temp.last_hours(p_name text) returns attendance language sql security definer as $$
  select a.* from attendance a join employee e on e.id = a.employee_id where e.full_name = p_name
   order by a.clock_in desc limit 1
$$;
create function pg_temp.audit(p_action text) returns audit_log language sql security definer as $$
  select * from audit_log where action = p_action order by id desc limit 1
$$;
create function pg_temp.wrong_pins() returns int language sql security definer as $$
  select count(*)::int from clock_attempt where not ok
$$;

insert into location (business_id, kind, name) values ('00000000-0000-0000-0000-0000000000b1', 'branch', 'Second Branch');
-- Another café, with an owner and a place of its own.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000f1', 'other.owner@example.com');
insert into app_user (business_id, full_name, email, auth_user_id) values
  ('00000000-0000-0000-0000-0000000000b2', 'Other Owner', 'other.owner@example.com', 'a0000000-0000-0000-0000-0000000000f1');
insert into user_role (app_user_id, role) select id, 'owner' from app_user where email = 'other.owner@example.com';
insert into location (business_id, kind, name) values ('00000000-0000-0000-0000-0000000000b2', 'branch', 'Other Branch');

-- The people: Rana and Shna will have phones, Dara will not, Kawa leaves.
select test.act_as('manager@example.com');
select save_employee(null, 'Rana', null, 'Barista', pg_temp.main(), test.today() - 30, null, gen_random_uuid());
select save_employee(null, 'Shna', null, 'Kitchen', pg_temp.second(), test.today() - 30, null, gen_random_uuid());
select save_employee(null, 'Dara', null, 'Barista', pg_temp.main(), test.today() - 30, null, gen_random_uuid());
select save_employee(null, 'Kawa', null, 'Driver', pg_temp.main(), test.today() - 30, null, gen_random_uuid());
select set_clock_pin(pg_temp.person('Rana'), '4826');
select set_clock_pin(pg_temp.person('Dara'), '7391');

-- =============================================================================
-- 1. Before the café has a clock screen, nothing changes
-- =============================================================================
select test.act_as('cashier@example.com');
select test.eq(clock_screen_check(null), '{"in_use": false, "screen": null}'::jsonb, 'no clock screen yet');
select test.ok((clock_in(pg_temp.person('Dara'), '7391', null, null, gen_random_uuid()) ->> 'ok')::boolean,
               'the till clocks Dara in with her PIN, as before');
select test.ok((clock_out(pg_temp.person('Dara'), '7391', null, gen_random_uuid()) ->> 'ok')::boolean,
               'and out');
select test.ok((clock_in(pg_temp.person('Dara'), '7391', p_idempotency_key => gen_random_uuid()) ->> 'ok')::boolean,
               'a till not yet updated, sending no screen, clocks as before');
select test.ok((clock_out(pg_temp.person('Dara'), '7391', p_idempotency_key => gen_random_uuid()) ->> 'ok')::boolean,
               'in and out');
select test.as_admin();
select test.eq((select string_agg(source || ':' || coalesce(screen_id::text, '-'), ',') from attendance
                 where employee_id = pg_temp.person('Dara')), 'till:-,till:-', 'clocked at the till, on no screen');

-- =============================================================================
-- 2. The owner makes a device the shop's clock screen
-- =============================================================================
select test.act_as('cashier@example.com');
select test.throws($$select register_clock_screen(null, 'The till')$$, '%needs settings.manage%',
                   'a cashier does not make clock screens');
select test.act_as('manager@example.com');
select test.throws($$select register_clock_screen(null, 'The till')$$, '%needs settings.manage%',
                   'nor a branch manager: the owner or the general manager does');
select test.act_as('owner@example.com');
select test.throws($$select register_clock_screen(null, '  ')$$, 'Name the clock screen, such as The till',
                   'a clock screen has a name');
select test.throws($$select register_clock_screen(null, repeat('x', 61))$$,
                   'A clock screen''s name is at most 60 letters', 'of 60 letters at most');
insert into res select 'till', register_clock_screen(null, ' The till ');
insert into res select 'door', register_clock_screen(pg_temp.second(), 'Door tablet');
select test.ok(pg_temp.k('till') ~ '^[0-9a-f]{48}$' and pg_temp.k('door') ~ '^[0-9a-f]{48}$'
               and pg_temp.k('till') <> pg_temp.k('door'), 'each screen is given a key of its own, once');
select test.eq((pg_temp.r('till') ->> 'name') || ' at ' || (select name from location where id = (pg_temp.r('till') ->> 'location_id')::uuid),
               'The till at ' || pg_temp.main_name(), 'at the main branch when no place is said');
select test.eq((pg_temp.r('door') ->> 'location_id')::uuid, pg_temp.second(), 'the door tablet at the second branch');
select test.as_admin();
select test.eq((select key_hash from clock_screen where name = 'The till'),
               encode(extensions.digest(pg_temp.k('till'), 'sha256'), 'hex'), 'the key is kept as its hash');
select test.eq((select count(*)::int from clock_screen s where s::text like '%' || pg_temp.k('till') || '%'), 0,
               'and never as it is');
select test.eq((select (after_state ->> 'name') || ' by ' || (app_user_id = pg_temp.member('owner@example.com'))::text
                  from pg_temp.audit('staff.clock_screen') where entity_id = pg_temp.r('door') ->> 'id'),
               'Door tablet by true', 'a clock screen made is on the audit trail');
select test.eq((select count(*)::int from clock_secret), 1, 'the café has a secret for its codes');

-- Who sees them: those who keep the staff or the settings.
select test.act_as('manager@example.com');
select test.eq((select string_agg(x ->> 'name' || '@' || (x ->> 'location'), ',' order by x ->> 'name')
                  from jsonb_array_elements(clock_screens()) x),
               'Door tablet@Second Branch,The till@' || pg_temp.main_name(),
               'the manager sees the café''s clock screens');
select test.act_as('cashier@example.com');
select test.throws($$select clock_screens()$$, '%needs settings.manage%', 'a cashier does not list them');
-- The till asks what it is.
select test.eq(clock_screen_check(pg_temp.k('till')) #>> '{screen,name}', 'The till', 'the till knows it is a clock screen');
select test.eq(clock_screen_check(pg_temp.k('till')) ->> 'in_use', 'true', 'and that the café has them');
select test.eq(clock_screen_check('not a key'), '{"in_use": true, "screen": null}'::jsonb,
               'another device is not one');
select test.eq(clock_screen_check(null) -> 'screen', 'null'::jsonb, 'nor one with no key');

-- Another café's screen is its own.
select test.act_as('other.owner@example.com');
insert into res select 'other', register_clock_screen(null, 'Their till');
select test.act_as('cashier@example.com');
select test.eq(clock_screen_check(pg_temp.k('other')) -> 'screen', 'null'::jsonb,
               'another café''s screen is not one of this café''s');

-- =============================================================================
-- 3. The code a clock screen shows
-- =============================================================================
select test.act_as_anon();
insert into res select 'shown', clock_screen_code(pg_temp.k('till'));
select test.ok((pg_temp.r('shown') ->> 'ok')::boolean and pg_temp.r('shown') ->> 'code' ~ '^[0-9]{6}$',
               'the screen is told its code, 6 digits, signed in or not');
select test.ok((pg_temp.r('shown') ->> 'until')::timestamptz > now()
               and (pg_temp.r('shown') ->> 'until')::timestamptz <= now() + interval '30 seconds',
               'and until when it holds: the half-minute''s end');
select test.eq((pg_temp.r('shown') ->> 'name'), 'The till', 'with the screen''s name');
select test.eq(clock_screen_code('not a key'),
               '{"ok": false, "error": "This device is not one of the shop''s clock screens"}'::jsonb,
               'a device without a screen''s key is told no code');
select test.eq(clock_screen_code(null) ->> 'ok', 'false', 'nor one with no key');
select test.as_admin();
select test.ok((select last_seen_at is not null from clock_screen where name = 'The till'), 'the screen is seen');
select test.eq(pg_temp.code_at('till', 59000001), pg_temp.code_at('till', 59000001), 'the same code all the half-minute');
select test.ok(pg_temp.code_at('till', 59000001) ~ '^[0-9]{6}$', 'of 6 digits');
select test.ok(pg_temp.code_at('till', 59000001) <> pg_temp.code_at('door', 59000001)
               or pg_temp.code_at('till', 59000002) <> pg_temp.code_at('door', 59000002),
               'each screen its own code');
select test.ok(pg_temp.code_at('till', 59000001) <> pg_temp.code_at('till', 59000002)
               or pg_temp.code_at('till', 59000002) <> pg_temp.code_at('till', 59000003),
               'a new code every half-minute');
select test.eq(clock_window('2026-10-06 10:00:29.999+00'), clock_window('2026-10-06 10:00:00+00'), 'a half-minute');
select test.eq(clock_window('2026-10-06 10:00:30+00'), clock_window('2026-10-06 10:00:00+00') + 1, 'then the next');

-- =============================================================================
-- 4. A manager links a person's phone
-- =============================================================================
select test.act_as('cashier@example.com');
select test.throws($$select link_phone_start(pg_temp.person('Rana'))$$, '%needs staff.manage%',
                   'a cashier does not link phones');
select test.act_as('manager@example.com');
insert into res select 'link', link_phone_start(pg_temp.person('Rana'));
select test.ok(pg_temp.k('link') ~ '^[0-9a-f]{48}$' and pg_temp.r('link') ->> 'name' = 'Rana',
               'a link to open on Rana''s phone');
select test.ok((pg_temp.r('link') ->> 'until')::timestamptz between now() + interval '9 minutes' and now() + interval '10 minutes',
               'good for ten minutes');
select test.as_admin();
select test.eq((select count(*)::int from phone_link where key_hash = encode(extensions.digest(pg_temp.k('link'), 'sha256'), 'hex')),
               1, 'kept as its hash');
select test.act_as_anon();
select test.eq(link_phone_finish('not a link'),
               '{"ok": false, "error": "This link is not one of the café''s: ask a manager for a new one"}'::jsonb,
               'a link that is not one');
insert into res select 'rana_phone', link_phone_finish(pg_temp.k('link'));
select test.ok((pg_temp.r('rana_phone') ->> 'ok')::boolean and pg_temp.k('rana_phone') ~ '^[0-9a-f]{48}$'
               and pg_temp.k('rana_phone') <> pg_temp.k('link'),
               'opened on the phone, the phone is given a key of its own');
select test.eq(pg_temp.r('rana_phone') ->> 'name', 'Rana', 'and whose it is');
select test.eq(link_phone_finish(pg_temp.k('link')) ->> 'error', 'This link was used already: ask a manager for a new one',
               'a link works once');
select test.as_admin();
select test.eq((select (app_user_id = pg_temp.member('manager@example.com'))::text || ' ' || (after_state ->> 'name')
                  from pg_temp.audit('staff.phone_linked')), 'true Rana',
               'on the audit trail, by the manager who made the link');
-- A link too old, and someone who has left.
select test.act_as('manager@example.com');
insert into res select 'old_link', link_phone_start(pg_temp.person('Dara'));
select test.as_admin();
update phone_link set expires_at = now() - interval '1 second'
 where key_hash = encode(extensions.digest(pg_temp.k('old_link'), 'sha256'), 'hex');
select test.act_as_anon();
select test.eq(link_phone_finish(pg_temp.k('old_link')) ->> 'error',
               'This link is more than ten minutes old: ask a manager for a new one', 'a link lasts ten minutes');
select test.act_as('manager@example.com');
insert into res select 'kawa_link', link_phone_start(pg_temp.person('Kawa'));
insert into res select 'kawa_left', set_employee_left(pg_temp.person('Kawa'), test.today() - 1, 'moved away', gen_random_uuid());
select test.throws($$select link_phone_start(pg_temp.person('Kawa'))$$, 'Kawa does not work here now',
                   'no link for someone who has left');
select test.act_as_anon();
select test.eq(link_phone_finish(pg_temp.k('kawa_link')) ->> 'error', 'Kawa does not work here now',
               'nor is a link made before they left of use');
-- Shna's phone too.
select test.act_as('manager@example.com');
insert into res select 'shna_link', link_phone_start(pg_temp.person('Shna'));
select test.act_as_anon();
insert into res select 'shna_phone', link_phone_finish(pg_temp.k('shna_link'));

-- What a phone is, by its key.
select test.eq(phone_status(pg_temp.k('rana_phone')) - 'business' - 'timezone',
               '{"linked": true, "name": "Rana", "title": "Barista", "works": true, "in_since": null, "in_at": null}'::jsonb,
               'the phone knows whose it is, and that she is not in');
select test.eq(phone_status('not a key'), '{"linked": false}'::jsonb, 'another phone is no one''s');
select test.eq(phone_status(null), '{"linked": false}'::jsonb, 'nor one with no key');
select test.act_as('manager@example.com');
select test.eq((select count(*)::int from jsonb_array_elements(staff_phones())), 2, 'the manager sees whose phones are linked');
select test.act_as('cashier@example.com');
select test.throws($$select staff_phones()$$, '%needs staff.manage%', 'a cashier does not');

-- A second phone for Rana ends the first.
select test.act_as('manager@example.com');
insert into res select 'link2', link_phone_start(pg_temp.person('Rana'));
select test.act_as_anon();
insert into res select 'rana_phone2', link_phone_finish(pg_temp.k('link2'));
select test.eq(phone_status(pg_temp.k('rana_phone')), '{"linked": false}'::jsonb, 'the first phone is hers no longer');
select test.eq(phone_status(pg_temp.k('rana_phone2')) ->> 'name', 'Rana', 'the second is');
select test.as_admin();
select test.eq((select count(*)::int from staff_phone where employee_id = pg_temp.person('Rana') and ended_at is null), 1,
               'one phone a person');
select test.ok((select ended_by = pg_temp.member('manager@example.com') from staff_phone
                 where employee_id = pg_temp.person('Rana') and ended_at is not null), 'ended by the one who linked the next');

-- =============================================================================
-- 5. Clocking in and out on the phone, with the code
-- =============================================================================
select test.act_as_anon();
-- The code as scanned, kept for the retry: sent again, it is the same scan.
insert into res select 'scanned', to_jsonb(pg_temp.code('till'));
insert into res select 'in', clock_by_phone(pg_temp.k('rana_phone2'), pg_temp.r('scanned') #>> '{}', 'in',
                                            'c0000000-0000-0000-0000-000000000001');
select test.ok((pg_temp.r('in') ->> 'ok')::boolean and pg_temp.r('in') ->> 'name' = 'Rana', 'Rana clocks in on her phone');
select test.eq(pg_temp.r('in') ->> 'location', pg_temp.main_name(),
               'at the till''s place');
select test.eq((clock_by_phone(pg_temp.k('rana_phone2'), pg_temp.r('scanned') #>> '{}', 'in',
                               'c0000000-0000-0000-0000-000000000001') ->> 'attendance_id'),
               pg_temp.r('in') ->> 'attendance_id', 'sent twice, clocked in once');
select test.ok(clock_by_phone(pg_temp.k('rana_phone2'), pg_temp.code('till'), 'in', gen_random_uuid()) ->> 'error'
               like 'Rana is clocked in already, since %', 'nobody clocks in twice');
select test.as_admin();
select test.eq((select source || ' ' || (phone_id = (pg_temp.phone('Rana')).id)::text || ' '
                       || (screen_id = (pg_temp.r('till') ->> 'id')::uuid)::text || ' ' || (location_id = pg_temp.main())::text
                       || ' ' || coalesce(recorded_by::text, 'no login')
                  from attendance where id = (pg_temp.r('in') ->> 'attendance_id')::uuid),
               'phone true true true no login', 'the hours say the phone, the screen whose code it was, and its place');
select test.ok((select last_used_at is not null from pg_temp.phone('Rana')), 'the phone was last used now');
select test.eq((select count(*)::int from request_log where operation = 'clock_by_phone'), 2,
               'each answer kept for its retry');
select test.eq((select count(*)::int from request_log where operation = 'clock_by_phone'
                   and result::text like '%' || pg_temp.k('rana_phone2') || '%'), 0, 'without the phone''s key');
select test.act_as_anon();
select test.eq(phone_status(pg_temp.k('rana_phone2')) ->> 'in_at', pg_temp.main_name(),
               'the phone shows she is in, and where');
select test.ok(phone_status(pg_temp.k('rana_phone2')) ->> 'in_since' is not null, 'since when');

-- Codes that are not the screen's now.
select test.eq(clock_by_phone(pg_temp.k('rana_phone2'), '000000', 'out', gen_random_uuid()) ->> 'error',
               'That code has changed: scan the shop''s code again', 'a wrong code');
select test.eq(clock_by_phone(pg_temp.k('rana_phone2'), pg_temp.code_before('till', 3), 'out', gen_random_uuid()) ->> 'error',
               'That code has changed: scan the shop''s code again', 'a code from a minute and a half ago');
select test.eq(clock_by_phone(pg_temp.k('rana_phone2'), (select clock_screen_code(pg_temp.k('other')) ->> 'code'), 'out',
                              gen_random_uuid()) ->> 'error',
               'That code has changed: scan the shop''s code again', 'another café''s code');
select test.eq(clock_by_phone(pg_temp.k('rana_phone2'), null, 'out', gen_random_uuid()) ->> 'error',
               'That code has changed: scan the shop''s code again', 'no code');
select test.as_admin();
select test.eq((pg_temp.phone('Rana')).wrong_codes, 4, 'each wrong code counted');
-- The code the screen showed the half-minute before still works: scanned just as it changed.
select test.act_as_anon();
insert into res select 'out', clock_by_phone(pg_temp.k('rana_phone2'), ' ' || pg_temp.code_before('till', 1) || ' ', 'out',
                                             gen_random_uuid());
select test.ok((pg_temp.r('out') ->> 'ok')::boolean and (pg_temp.r('out') ->> 'minutes')::int = 0,
               'Rana clocks out with the code shown just before, spaces and all');
select test.eq(clock_by_phone(pg_temp.k('rana_phone2'), pg_temp.code('till'), 'out', gen_random_uuid()) ->> 'error',
               'Rana is not clocked in', 'nobody clocks out twice');
select test.as_admin();
select test.eq((pg_temp.phone('Rana')).wrong_codes, 0, 'a right code clears the wrong ones');
select test.ok((select clock_out is not null and out_recorded_by is null from attendance
                 where id = (pg_temp.r('in') ->> 'attendance_id')::uuid), 'the hours are closed');
select test.act_as_anon();
select test.throws($$select clock_by_phone(pg_temp.k('rana_phone2'), pg_temp.code('till'), 'sideways', gen_random_uuid())$$,
                   'Clock in, or out', 'in or out, nothing else');
select test.eq(clock_by_phone('not a key', pg_temp.code('till'), 'in', gen_random_uuid()),
               '{"ok": false, "error": "This phone is not linked to anyone: a manager links it on Staff"}'::jsonb,
               'a phone not linked clocks no one');
select test.eq(clock_by_phone(pg_temp.k('rana_phone'), pg_temp.code('till'), 'in', gen_random_uuid()) ->> 'error',
               'This phone is not linked to anyone: a manager links it on Staff', 'nor a phone linked before');

-- Shna, at the door tablet: her hours at its place.
insert into res select 'shna_in', clock_by_phone(pg_temp.k('shna_phone'), pg_temp.code('door'), 'in', gen_random_uuid());
select test.eq(pg_temp.r('shna_in') ->> 'location', 'Second Branch', 'Shna''s hours at the door tablet''s place');
select test.eq(clock_by_phone(pg_temp.k('shna_phone'), pg_temp.code('door'), 'out', gen_random_uuid()) ->> 'ok', 'true',
               'and out');

-- Five wrong codes in ten minutes pause the phone.
select clock_by_phone(pg_temp.k('shna_phone'), '111111', 'in', gen_random_uuid()) from generate_series(1, 5);
select test.eq(clock_by_phone(pg_temp.k('shna_phone'), pg_temp.code('door'), 'in', gen_random_uuid()) ->> 'error',
               'Too many wrong codes from this phone: try again in 10 minutes', 'five wrong codes pause the phone');
select test.as_admin();
update staff_phone set wrong_since = now() - interval '11 minutes' where id = (pg_temp.phone('Shna')).id;
select test.act_as_anon();
select test.eq(clock_by_phone(pg_temp.k('shna_phone'), pg_temp.code('door'), 'in', gen_random_uuid()) ->> 'ok', 'true',
               'for ten minutes');
select test.eq(clock_by_phone(pg_temp.k('shna_phone'), pg_temp.code('door'), 'out', gen_random_uuid()) ->> 'ok', 'true',
               'then out');

-- Someone who has left does not clock in.
select test.as_admin();
insert into staff_phone (business_id, employee_id, key_hash)
values ('00000000-0000-0000-0000-0000000000b1', pg_temp.person('Kawa'), encode(extensions.digest('kawa-phone', 'sha256'), 'hex'));
select test.act_as_anon();
select test.eq(clock_by_phone('kawa-phone', pg_temp.code('till'), 'in', gen_random_uuid()) ->> 'error',
               'Kawa does not work here now', 'someone who has left does not clock in');
select test.eq(phone_status('kawa-phone') ->> 'works', 'false', 'and their phone says so');

-- =============================================================================
-- 6. The till's clock, once the café has clock screens
-- =============================================================================
select test.act_as('cashier@example.com');
select test.eq((select string_agg(x ->> 'name' || ':' || (x ->> 'has_phone'), ',' order by x ->> 'name')
                  from jsonb_array_elements(clock_board()) x),
               'Dara:false,Rana:true', 'the till''s list says who clocks on their own phone');
select test.eq(clock_in(pg_temp.person('Dara'), '7391', null, null, gen_random_uuid()),
               '{"ok": false, "error": "Clocking in and out is on the shop''s clock screen"}'::jsonb,
               'a till that is not a clock screen does not clock anyone');
select test.eq(clock_in(pg_temp.person('Dara'), '7391', p_idempotency_key => gen_random_uuid()) ->> 'error',
               'Clocking in and out is on the shop''s clock screen', 'nor a till not yet updated');
select test.eq(clock_in(pg_temp.person('Dara'), '7391', null, 'not a key', gen_random_uuid()) ->> 'error',
               'Clocking in and out is on the shop''s clock screen', 'nor one with a key that is not a screen''s');
select test.eq(clock_in(pg_temp.person('Dara'), '7391', null, pg_temp.k('other'), gen_random_uuid()) ->> 'error',
               'Clocking in and out is on the shop''s clock screen', 'nor another café''s screen');
select test.eq(pg_temp.wrong_pins(), 0, 'refused before the PIN is tried: no PIN attempt kept');
select test.eq(clock_in(pg_temp.person('Dara'), '0000', null, pg_temp.k('door'), gen_random_uuid()) ->> 'error',
               'That PIN is not right', 'on a clock screen, the PIN still counts');
insert into res select 'dara_in', clock_in(pg_temp.person('Dara'), '7391', null, pg_temp.k('door'), gen_random_uuid());
select test.eq(pg_temp.r('dara_in') ->> 'location', 'Second Branch',
               'on the door tablet, Dara''s hours are at its place, whatever the till says');
select test.eq(clock_out(pg_temp.person('Dara'), '7391', null, gen_random_uuid()) ->> 'error',
               'Clocking in and out is on the shop''s clock screen', 'clocking out too');
select test.eq(clock_out(pg_temp.person('Dara'), '7391', pg_temp.k('till'), gen_random_uuid()) ->> 'ok', 'true',
               'on any of the café''s clock screens');
select test.eq(clock_in(pg_temp.person('Rana'), '4826', null, pg_temp.k('till'), gen_random_uuid()),
               '{"ok": false, "error": "Rana clocks in and out on their own phone, with the shop''s code"}'::jsonb,
               'someone whose phone is linked clocks with it, not with a PIN another could type');
select test.as_admin();
select test.eq((select source || ':' || (screen_id = (pg_temp.r('door') ->> 'id')::uuid)::text
                  from attendance where id = (pg_temp.r('dara_in') ->> 'attendance_id')::uuid),
               'till:true', 'clocked at the till, on the door tablet');

-- =============================================================================
-- 7. A phone unlinked, a screen taken out of use
-- =============================================================================
select test.act_as('cashier@example.com');
select test.throws($$select unlink_phone(pg_temp.person('Rana'), 'lost it')$$, '%needs staff.manage%',
                   'a cashier does not unlink phones');
select test.act_as('manager@example.com');
select test.throws($$select unlink_phone(pg_temp.person('Rana'), ' ')$$, 'Say why the phone is no longer theirs',
                   'a phone unlinked has a why');
select unlink_phone(pg_temp.person('Rana'), 'lost it');
select test.throws($$select unlink_phone(pg_temp.person('Rana'), 'lost it')$$, 'Rana has no phone linked',
                   'once');
select test.eq((select count(*)::int from jsonb_array_elements(staff_phones()) x
                 where (x ->> 'employee_id')::uuid = pg_temp.person('Rana')), 0, 'Rana''s phone is not listed');
select test.as_admin();
select test.eq((select reason || ' ' || (after_state ->> 'name') from pg_temp.audit('staff.phone_unlinked')),
               'lost it Rana', 'on the audit trail, with why');
select test.act_as_anon();
select test.eq(clock_by_phone(pg_temp.k('rana_phone2'), pg_temp.code('till'), 'in', gen_random_uuid()) ->> 'error',
               'This phone is not linked to anyone: a manager links it on Staff', 'the lost phone clocks no one');
select test.act_as('cashier@example.com');
select test.eq(clock_in(pg_temp.person('Rana'), '4826', null, pg_temp.k('till'), gen_random_uuid()) ->> 'ok', 'true',
               'without a phone, Rana clocks at the till''s clock screen with her PIN');
select test.eq(clock_out(pg_temp.person('Rana'), '4826', pg_temp.k('till'), gen_random_uuid()) ->> 'ok', 'true', 'and out');

select test.act_as('manager@example.com');
select test.throws(format('select remove_clock_screen(%L, %L)', pg_temp.r('till') ->> 'id', 'replaced'),
                   '%needs settings.manage%', 'a branch manager does not take a screen out of use');
select test.act_as('owner@example.com');
select test.throws(format('select remove_clock_screen(%L, %L)', pg_temp.r('till') ->> 'id', ''),
                   'Say why the clock screen is taken out of use', 'a screen taken out of use has a why');
select test.throws(format('select remove_clock_screen(%L, %L)', pg_temp.r('other') ->> 'id', 'not ours'),
                   'That clock screen is not in use', 'not another café''s');
select remove_clock_screen((pg_temp.r('till') ->> 'id')::uuid, 'replaced');
select test.throws(format('select remove_clock_screen(%L, %L)', pg_temp.r('till') ->> 'id', 'replaced'),
                   'That clock screen is not in use', 'once');
select test.as_admin();
select test.eq((select reason || ' ' || (after_state ->> 'name') from pg_temp.audit('staff.clock_screen_removed')),
               'replaced The till', 'on the audit trail, with why');
select test.act_as_anon();
select test.eq(clock_screen_code(pg_temp.k('till')) ->> 'ok', 'false', 'its key no longer shows a code');
select test.eq(clock_by_phone(pg_temp.k('shna_phone'), pg_temp.code_before('till', 0), 'in', gen_random_uuid()) ->> 'error',
               'That code has changed: scan the shop''s code again', 'nor does its last code clock anyone');
select test.act_as('cashier@example.com');
select test.eq(clock_in(pg_temp.person('Dara'), '7391', null, pg_temp.k('till'), gen_random_uuid()) ->> 'error',
               'Clocking in and out is on the shop''s clock screen', 'the till is no longer one');
select test.act_as('owner@example.com');
select remove_clock_screen((pg_temp.r('door') ->> 'id')::uuid, 'not needed');
select test.act_as('cashier@example.com');
select test.eq(clock_screen_check(pg_temp.k('door')), '{"in_use": false, "screen": null}'::jsonb,
               'with no clock screen left');
select test.eq(clock_in(pg_temp.person('Dara'), '7391', null, null, gen_random_uuid()) ->> 'ok', 'true',
               'the till clocks as before');
select test.eq(clock_out(pg_temp.person('Dara'), '7391', null, gen_random_uuid()) ->> 'ok', 'true', 'in and out');

-- =============================================================================
-- 8. Who may call what, and what is kept
-- =============================================================================
select test.act_as_anon();
select test.throws($$select register_clock_screen(null, 'Mine')$$, '%permission denied%', 'the public makes no screen');
select test.throws($$select clock_screens()$$, '%permission denied%', 'nor lists them');
select test.throws($$select clock_screen_check(null)$$, '%permission denied%', 'nor asks the till''s question');
select test.throws($$select link_phone_start(gen_random_uuid())$$, '%permission denied%', 'nor makes a link');
select test.throws($$select unlink_phone(gen_random_uuid(), 'x')$$, '%permission denied%', 'nor unlinks a phone');
select test.throws($$select staff_phones()$$, '%permission denied%', 'nor sees whose phones are linked');
select test.throws($$select clock_in(gen_random_uuid(), '1234')$$, '%permission denied%', 'nor uses the till''s clock');
select test.throws($$select clock_code_of('00000000-0000-0000-0000-0000000000b1', gen_random_uuid(), 1)$$,
                   '%permission denied%', 'nor works out a code');
select test.throws($$select clock_by_phone__run('x', 'y', 'in')$$, '%permission denied%', 'nor skips the key''s check');
select test.throws($$select * from clock_secret$$, '%permission denied%', 'nor reads the secret');
select test.act_as('owner@example.com');
select test.throws($$select * from clock_screen$$, '%permission denied%', 'not even the owner reads the screens'' table');
select test.throws($$select * from staff_phone$$, '%permission denied%', 'nor the phones''');
select test.throws($$select * from phone_link$$, '%permission denied%', 'nor the links''');
select test.throws($$select * from clock_secret$$, '%permission denied%', 'nor the secret');
select test.throws($$select clock_code_of('00000000-0000-0000-0000-0000000000b1', gen_random_uuid(), 1)$$,
                   '%permission denied%', 'nor works out a code by hand');
select test.throws($$select till_clock_gate('00000000-0000-0000-0000-0000000000b1', null::employee, null)$$,
                   '%permission denied%', 'nor calls the till''s gate');
select test.as_admin();
select test.eq((select count(*)::int from staff_phone p where p::text like '%' || pg_temp.k('rana_phone2') || '%'
                   or p::text like '%' || pg_temp.k('shna_phone') || '%'), 0, 'no phone''s key is kept as it is');
select test.eq((select count(*)::int from phone_link l where l::text like '%' || pg_temp.k('link') || '%'), 0,
               'nor a link''s');
select test.eq((select count(*)::int from audit_log a
                 where a::text like '%' || pg_temp.k('till') || '%' or a::text like '%' || pg_temp.k('rana_phone2') || '%'), 0,
               'nor any key on the audit trail');
select test.eq((select string_agg(distinct source, ',' order by source) from attendance), 'phone,till',
               'the hours say where they were clocked');
