-- =============================================================================
-- 0068 — Clocking in on your own phone, with the shop's code (round eight)
-- =============================================================================
-- The owner's answer to clocking in from outside the shop, as chosen (scan the
-- shop's code, and only your own phone):
--
--  * The shop's clock screen. The owner marks a device at the shop — the till,
--    or a tablet by the door — once. It is given a key of its own, kept on it,
--    and shows a code of 6 digits, and its square to scan, that changes every
--    30 seconds. Only a device holding such a key is told the code, so it is
--    seen only at the shop. A key can be taken back.
--  * Only your own phone. A manager links one phone to a person, once: a link
--    shown on Staff, opened on the phone within ten minutes. That phone keeps
--    a key of its own and clocks its person in or out with the shop's current
--    code — no PIN, no queue. Linking another phone ends the first. Five wrong
--    codes in ten minutes pause the phone for ten minutes.
--  * Once a café has a clock screen, the till's name-and-PIN clock (for those
--    without a phone) works only on a clock screen, and someone whose phone
--    is linked clocks only with it. Before then, nothing changes.
--
-- A key is kept as its SHA-256, never as it is. The code is an HMAC of the
-- screen and the half-minute under a secret of the café's that nothing reads
-- but these functions. A clock-in from a phone is recorded as from the phone,
-- with the screen whose code it gave, at that screen's place.
--
-- The till's clock_in and clock_out each stay one function: they take the
-- clock screen's key too (none by default, so a screen not yet updated still
-- clocks until the café has a clock screen).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. What is kept
-- -----------------------------------------------------------------------------
create table if not exists clock_screen (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  location_id  uuid not null references location (id),
  name         text not null,
  key_hash     text not null unique,
  created_by   uuid references app_user (id),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  removed_at   timestamptz,
  removed_by   uuid references app_user (id),
  remove_reason text,
  constraint clock_screen_name check (length(trim(name)) between 1 and 60)
);
create index if not exists clock_screen_in_use on clock_screen (business_id) where removed_at is null;

create table if not exists staff_phone (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  employee_id  uuid not null references employee (id),
  key_hash     text not null unique,
  linked_by    uuid references app_user (id),
  linked_at    timestamptz not null default now(),
  last_used_at timestamptz,
  -- Wrong codes since the first of them, ten minutes ago at most.
  wrong_codes  int not null default 0,
  wrong_since  timestamptz,
  ended_at     timestamptz,
  ended_by     uuid references app_user (id)
);
-- One phone a person.
create unique index if not exists staff_phone_one on staff_phone (employee_id) where ended_at is null;

create table if not exists phone_link (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business (id) on delete cascade,
  employee_id uuid not null references employee (id),
  key_hash    text not null unique,
  created_by  uuid references app_user (id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create table if not exists clock_secret (
  business_id uuid primary key references business (id) on delete cascade,
  secret      bytea not null default extensions.gen_random_bytes(32),
  created_at  timestamptz not null default now()
);

-- Nobody reads or writes these but the functions below.
alter table clock_screen enable row level security;
alter table staff_phone enable row level security;
alter table phone_link enable row level security;
alter table clock_secret enable row level security;
revoke all on clock_screen, staff_phone, phone_link, clock_secret from anon, authenticated;

-- A record of hours says the phone it was clocked on, and the clock screen
-- whose code (or on which) it was clocked.
alter table attendance add column if not exists phone_id uuid references staff_phone (id);
alter table attendance add column if not exists screen_id uuid references clock_screen (id);
alter table attendance drop constraint if exists attendance_source;
alter table attendance add constraint attendance_source check (source in ('till', 'manager', 'phone'));

-- -----------------------------------------------------------------------------
-- 2. Keys and codes
-- -----------------------------------------------------------------------------
-- A key as it is kept.
create or replace function clock_key_hash(p_key text) returns text
language sql immutable set search_path = public as $$
  select encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
$$;

-- A new key: 48 hex digits, 192 bits.
create or replace function clock_new_key() returns text
language sql volatile set search_path = public as $$
  select encode(extensions.gen_random_bytes(24), 'hex')
$$;

-- The café's secret for its codes, made the first time it is needed.
create or replace function clock_secret_of(p_business uuid) returns bytea
language plpgsql security definer set search_path = public as $$
declare v bytea;
begin
  select secret into v from clock_secret where business_id = p_business;
  if v is null then
    insert into clock_secret (business_id) values (p_business) on conflict (business_id) do nothing;
    select secret into v from clock_secret where business_id = p_business;
  end if;
  return v;
end $$;

-- The half-minute a moment falls in.
create or replace function clock_window(p_at timestamptz) returns bigint
language sql immutable as $$
  select floor(extract(epoch from p_at) / 30)::bigint
$$;

-- A clock screen's code in a half-minute: 6 digits, from an HMAC.
create or replace function clock_code_of(p_business uuid, p_screen uuid, p_window bigint) returns text
language sql security definer set search_path = public as $$
  select lpad((('x' || substr(encode(extensions.hmac(convert_to(p_screen::text || ':' || p_window::text, 'UTF8'),
                                                      clock_secret_of(p_business), 'sha256'), 'hex'), 1, 8)
               )::bit(32)::bigint % 1000000)::text, 6, '0')
$$;

-- Whether a café has a clock screen in use: then the rules of section 5 hold.
create or replace function clock_screens_in_use(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clock_screen where business_id = p_business and removed_at is null)
$$;

-- The clock screen a key is, if it is one in use.
create or replace function clock_screen_by_key(p_key text) returns clock_screen
language sql stable security definer set search_path = public as $$
  select * from clock_screen where key_hash = clock_key_hash(p_key) and removed_at is null and p_key is not null
$$;

-- -----------------------------------------------------------------------------
-- 3. The shop's clock screens
-- -----------------------------------------------------------------------------
-- This device made a clock screen at a place: its key, given once.
create or replace function register_clock_screen(p_location uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_me uuid := (current_member()).id;
  v_loc uuid := resolve_location(v_business, p_location);
  v_key text := clock_new_key();
  v_id uuid;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the clock screen, such as The till'; end if;
  if length(trim(p_name)) > 60 then raise exception 'A clock screen''s name is at most 60 letters'; end if;
  insert into clock_screen (business_id, location_id, name, key_hash, created_by)
  values (v_business, v_loc, trim(p_name), clock_key_hash(v_key), v_me)
  returning id into v_id;
  perform clock_secret_of(v_business);
  perform audit_event(v_business, 'staff.clock_screen', 'clock_screen', v_id::text, null, null,
                      jsonb_build_object('name', trim(p_name),
                                         'location', (select name from location where id = v_loc)));
  return jsonb_build_object('id', v_id, 'key', v_key, 'name', trim(p_name), 'location_id', v_loc);
end $$;

-- A clock screen taken out of use, with why: its key no longer works.
create or replace function remove_clock_screen(p_screen uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_me uuid := (current_member()).id;
  s clock_screen;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the clock screen is taken out of use'; end if;
  select * into s from clock_screen where id = p_screen and business_id = v_business and removed_at is null for update;
  if not found then raise exception 'That clock screen is not in use'; end if;
  update clock_screen set removed_at = now(), removed_by = v_me, remove_reason = trim(p_reason) where id = s.id;
  perform audit_event(v_business, 'staff.clock_screen_removed', 'clock_screen', s.id::text, trim(p_reason), null,
                      jsonb_build_object('name', s.name));
end $$;

-- The café's clock screens in use, for those who keep the staff or the settings.
create or replace function clock_screens() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage', 'staff.manage');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'name', s.name, 'location_id', s.location_id, 'location', l.name,
             'created_at', s.created_at, 'created_by', u.full_name, 'last_seen_at', s.last_seen_at)
           order by l.name, s.name)
      from clock_screen s
      join location l on l.id = s.location_id
      left join app_user u on u.id = s.created_by
     where s.business_id = v_business and s.removed_at is null), '[]'::jsonb);
end $$;

-- What a device is, by its key (or none): a clock screen in use, and whether
-- its café has any. Read by the till, which may be anyone's device.
create or replace function clock_screen_check(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  s clock_screen := clock_screen_by_key(p_key);
begin
  return jsonb_build_object(
    'in_use', v_business is not null and clock_screens_in_use(v_business),
    'screen', case when s.id is not null and s.business_id is not distinct from v_business then
                jsonb_build_object('id', s.id, 'name', s.name, 'location_id', s.location_id,
                                   'location', (select name from location where id = s.location_id))
              end);
end $$;

-- The code a clock screen shows now, and until when. Asked by the screen
-- itself, signed in or not: its key is what lets it see the code.
create or replace function clock_screen_code(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s clock_screen := clock_screen_by_key(p_key);
  v_now timestamptz := clock_timestamp();
  v_window bigint := clock_window(v_now);
begin
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'This device is not one of the shop''s clock screens');
  end if;
  -- Seen, kept to a minute so a screen asking every few seconds writes little.
  if s.last_seen_at is null or s.last_seen_at < v_now - interval '1 minute' then
    update clock_screen set last_seen_at = v_now where id = s.id;
  end if;
  return jsonb_build_object(
    'ok', true, 'code', clock_code_of(s.business_id, s.id, v_window),
    'until', to_timestamp((v_window + 1) * 30), 'name', s.name,
    'location', (select name from location where id = s.location_id));
end $$;

-- -----------------------------------------------------------------------------
-- 4. Each person's own phone
-- -----------------------------------------------------------------------------
-- A link to make a phone someone's, good for ten minutes and once.
create or replace function link_phone_start(p_employee uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage');
  v_me uuid := (current_member()).id;
  e employee := staff_member(v_business, p_employee);
  v_key text := clock_new_key();
  v_until timestamptz := now() + interval '10 minutes';
begin
  if not works_on(e, business_local_date(v_business, now())) then
    raise exception '% does not work here now', e.full_name;
  end if;
  insert into phone_link (business_id, employee_id, key_hash, created_by, expires_at)
  values (v_business, e.id, clock_key_hash(v_key), v_me, v_until);
  return jsonb_build_object('key', v_key, 'until', v_until, 'name', e.full_name);
end $$;

-- The link opened on the phone: the phone is the person's now, its key given
-- once; a phone linked before for them is theirs no longer.
create or replace function link_phone_finish(p_link text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k phone_link; e employee;
  v_key text := clock_new_key();
  v_id uuid;
begin
  select * into k from phone_link where key_hash = clock_key_hash(p_link) for update;
  if not found or p_link is null then
    return jsonb_build_object('ok', false, 'error', 'This link is not one of the café''s: ask a manager for a new one');
  end if;
  if k.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'This link was used already: ask a manager for a new one');
  end if;
  if k.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'This link is more than ten minutes old: ask a manager for a new one');
  end if;
  select * into e from employee where id = k.employee_id;
  if not works_on(e, business_local_date(k.business_id, now())) then
    return jsonb_build_object('ok', false, 'error', format('%s does not work here now', e.full_name));
  end if;
  update phone_link set used_at = now() where id = k.id;
  update staff_phone set ended_at = now(), ended_by = k.created_by where employee_id = e.id and ended_at is null;
  insert into staff_phone (business_id, employee_id, key_hash, linked_by)
  values (k.business_id, e.id, clock_key_hash(v_key), k.created_by)
  returning id into v_id;
  insert into audit_log (business_id, app_user_id, action, entity_type, entity_id, after_state)
  values (k.business_id, k.created_by, 'staff.phone_linked', 'employee', e.id::text,
          jsonb_build_object('name', e.full_name));
  return jsonb_build_object('ok', true, 'key', v_key, 'name', e.full_name);
end $$;

-- A person's phone theirs no longer (lost, or changed), with why.
create or replace function unlink_phone(p_employee uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage');
  v_me uuid := (current_member()).id;
  e employee := staff_member(v_business, p_employee);
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the phone is no longer theirs'; end if;
  update staff_phone set ended_at = now(), ended_by = v_me where employee_id = e.id and ended_at is null;
  if not found then raise exception '% has no phone linked', e.full_name; end if;
  perform audit_event(v_business, 'staff.phone_unlinked', 'employee', e.id::text, trim(p_reason), null,
                      jsonb_build_object('name', e.full_name));
end $$;

-- Whose phones are linked, for Staff.
create or replace function staff_phones() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('staff.manage', 'attendance.edit', 'payroll.view');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('employee_id', p.employee_id, 'linked_at', p.linked_at,
                                        'last_used_at', p.last_used_at))
      from staff_phone p
     where p.business_id = v_business and p.ended_at is null), '[]'::jsonb);
end $$;

-- What a phone is, by its key: whose, and whether they are in.
create or replace function phone_status(p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p staff_phone; e employee; a attendance;
begin
  select * into p from staff_phone where key_hash = clock_key_hash(p_phone) and ended_at is null and p_phone is not null;
  if not found then return jsonb_build_object('linked', false); end if;
  select * into e from employee where id = p.employee_id;
  select * into a from attendance x where x.employee_id = e.id and x.clock_out is null and x.cancelled_at is null;
  return jsonb_build_object(
    'linked', true, 'name', e.full_name, 'title', e.title,
    'works', works_on(e, business_local_date(p.business_id, now())),
    'in_since', a.clock_in,
    'in_at', (select name from location where id = a.location_id),
    'business', (select name from business where id = p.business_id),
    'timezone', (select timezone from business where id = p.business_id));
end $$;

-- -----------------------------------------------------------------------------
-- 5. Clocking in and out
-- -----------------------------------------------------------------------------
-- In: a record of hours begun now at a place; late against the shift, if so.
create or replace function clock_in_record(p_business uuid, e employee, p_location uuid, p_source text,
                                           p_by uuid, p_phone uuid, p_screen uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tz text := (select timezone from business where id = p_business);
  v_now timestamptz := clock_timestamp();
  v_day date := business_local_date(p_business, v_now);
  a attendance; s shift_schedule; v_id uuid; v_late int; v_grace numeric;
begin
  select * into a from attendance x where x.employee_id = e.id and x.clock_out is null and x.cancelled_at is null;
  if found then
    return jsonb_build_object('ok', false,
      'error', format('%s is clocked in already, since %s', e.full_name,
                      to_char(a.clock_in at time zone v_tz, 'DD Mon HH24:MI')));
  end if;
  if attendance_overlap(e.id, v_now, null, null) is not null then
    return jsonb_build_object('ok', false,
      'error', format('%s has hours recorded until later today: a manager corrects them on Staff', e.full_name));
  end if;
  insert into attendance (business_id, employee_id, location_id, clock_in, work_day, source, recorded_by,
                          phone_id, screen_id)
  values (p_business, e.id, p_location, v_now, v_day, p_source, p_by, p_phone, p_screen)
  returning id into v_id;
  select * into s from shift_schedule x where x.employee_id = e.id and x.day = v_day;
  v_grace := staff_rule(p_business, 'late_after_minutes');
  if s.id is not null and v_now > s.starts_at + make_interval(mins => v_grace::int) then
    v_late := floor(extract(epoch from v_now - s.starts_at) / 60)::int;
  end if;
  return jsonb_build_object('ok', true, 'attendance_id', v_id, 'employee_id', e.id, 'name', e.full_name,
                            'clock_in', v_now, 'shift_starts', s.starts_at, 'shift_ends', s.ends_at,
                            'late_minutes', v_late,
                            'location', (select name from location where id = p_location));
end $$;

-- Out: the open record of hours closed now; early against the shift, if so.
create or replace function clock_out_record(p_business uuid, e employee, p_by uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := clock_timestamp();
  a attendance; s shift_schedule; v_minutes int; v_early int; v_grace numeric;
begin
  select * into a from attendance x where x.employee_id = e.id and x.clock_out is null and x.cancelled_at is null
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', format('%s is not clocked in', e.full_name));
  end if;
  if v_now > a.clock_in + interval '24 hours' then
    return jsonb_build_object('ok', false,
      'error', format('%s has been clocked in for more than a day: a manager corrects the hours on Staff', e.full_name));
  end if;
  update attendance set clock_out = v_now, out_recorded_by = p_by where id = a.id;
  v_minutes := floor(extract(epoch from v_now - a.clock_in) / 60)::int;
  select * into s from shift_schedule x where x.employee_id = e.id and x.day = a.work_day;
  v_grace := staff_rule(p_business, 'late_after_minutes');
  if s.id is not null and v_now < s.ends_at - make_interval(mins => v_grace::int) then
    v_early := floor(extract(epoch from s.ends_at - v_now) / 60)::int;
  end if;
  return jsonb_build_object('ok', true, 'attendance_id', a.id, 'employee_id', e.id, 'name', e.full_name,
                            'clock_in', a.clock_in, 'clock_out', v_now, 'minutes', v_minutes,
                            'shift_ends', s.ends_at, 'early_minutes', v_early);
end $$;

-- Whether the till may clock someone in or out with their PIN here: once the
-- café has a clock screen, only on one, and not someone whose phone is linked.
-- The clock screen it is on, or null; or an answer refusing.
create or replace function till_clock_gate(p_business uuid, e employee, p_screen text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s clock_screen;
begin
  if not clock_screens_in_use(p_business) then return null; end if;
  s := clock_screen_by_key(p_screen);
  if s.id is null or s.business_id <> p_business then
    return jsonb_build_object('ok', false, 'error', 'Clocking in and out is on the shop''s clock screen');
  end if;
  if exists (select 1 from staff_phone where employee_id = e.id and ended_at is null) then
    return jsonb_build_object('ok', false,
      'error', format('%s clocks in and out on their own phone, with the shop''s code', e.full_name));
  end if;
  return jsonb_build_object('ok', true, 'screen_id', s.id, 'location_id', s.location_id);
end $$;

-- Who clocks at the till (0049's), and who of them clocks on their own phone.
create or replace function clock_board(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'staff.manage', 'attendance.edit');
  v_loc uuid := resolve_location(v_business, p_location);
  v_today date := business_local_date(v_business, now());
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'employee_id', e.id, 'name', e.full_name, 'title', e.title, 'has_pin', e.clock_pin_hash is not null,
             'has_phone', exists (select 1 from staff_phone p where p.employee_id = e.id and p.ended_at is null),
             'in_since', a.clock_in, 'shift_starts', s.starts_at, 'shift_ends', s.ends_at)
           order by (a.id is null), e.full_name)
      from employee e
      left join attendance a on a.employee_id = e.id and a.clock_out is null and a.cancelled_at is null
      left join shift_schedule s on s.employee_id = e.id and s.day = v_today
     where e.business_id = v_business and works_on(e, v_today)
       and (e.location_id = v_loc or s.location_id = v_loc or a.location_id = v_loc)), '[]'::jsonb);
end $$;

-- The till's clock, with a name and a PIN (0049), and now the clock screen it
-- is on (its key, or none): on a clock screen, the hours are at the screen's
-- place. Each stays one function under its name, the screen's key added.
drop function if exists clock_in(uuid, text, uuid, uuid);
drop function if exists clock_out(uuid, text, uuid);
drop function if exists clock_in__run(uuid, text, uuid);
drop function if exists clock_out__run(uuid, text);

create or replace function clock_in__run(p_employee uuid, p_pin text, p_location uuid, p_screen text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'staff.manage', 'attendance.edit');
  v_me uuid := (current_member()).id;
  v_loc uuid := resolve_location(v_business, p_location);
  e employee; v_gate jsonb; v_err text;
begin
  e := staff_member(v_business, p_employee, true);
  if not works_on(e, business_local_date(v_business, clock_timestamp())) then
    raise exception '% does not work here on %', e.full_name, business_local_date(v_business, clock_timestamp());
  end if;
  v_gate := till_clock_gate(v_business, e, p_screen);
  if v_gate is not null and not (v_gate ->> 'ok')::boolean then return v_gate; end if;
  v_err := clock_pin_check(v_business, e, p_pin, v_me);
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  return clock_in_record(v_business, e, coalesce((v_gate ->> 'location_id')::uuid, v_loc), 'till', v_me,
                         null, (v_gate ->> 'screen_id')::uuid);
end $$;

create or replace function clock_out__run(p_employee uuid, p_pin text, p_screen text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'staff.manage', 'attendance.edit');
  v_me uuid := (current_member()).id;
  e employee; v_gate jsonb; v_err text;
begin
  e := staff_member(v_business, p_employee, true);
  v_gate := till_clock_gate(v_business, e, p_screen);
  if v_gate is not null and not (v_gate ->> 'ok')::boolean then return v_gate; end if;
  v_err := clock_pin_check(v_business, e, p_pin, v_me);
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  return clock_out_record(v_business, e, v_me);
end $$;

create or replace function clock_in(p_employee uuid, p_pin text, p_location uuid default null,
                                    p_screen text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  -- Neither the PIN nor the screen's key is kept: a retry is the same person, the same key.
  v_req jsonb := jsonb_build_object('p_employee', p_employee, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'clock_in', v_req);
  if v is not null then return v; end if;
  v := clock_in__run(p_employee => p_employee, p_pin => p_pin, p_location => p_location, p_screen => p_screen);
  perform idem_finish(v_business, p_idempotency_key, 'clock_in', v_req, v);
  return v;
end $$;

create or replace function clock_out(p_employee uuid, p_pin text, p_screen text default null,
                                     p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_employee', p_employee);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'clock_out', v_req);
  if v is not null then return v; end if;
  v := clock_out__run(p_employee => p_employee, p_pin => p_pin, p_screen => p_screen);
  perform idem_finish(v_business, p_idempotency_key, 'clock_out', v_req, v);
  return v;
end $$;

-- On a phone: its key, the shop's code it was given, and in or out. The code
-- is the one a clock screen shows now, or showed the half-minute before; the
-- hours are at that screen's place. Five wrong codes in ten minutes pause the
-- phone for the rest of the ten.
create or replace function clock_by_phone__run(p_phone text, p_code text, p_direction text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p staff_phone; e employee; s clock_screen;
  v_now timestamptz := clock_timestamp();
  v_window bigint := clock_window(v_now);
  v_code text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
begin
  if p_direction is null or p_direction not in ('in', 'out') then raise exception 'Clock in, or out'; end if;
  select * into p from staff_phone
   where key_hash = clock_key_hash(p_phone) and ended_at is null and p_phone is not null for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This phone is not linked to anyone: a manager links it on Staff');
  end if;
  if p.wrong_codes >= 5 and p.wrong_since > v_now - interval '10 minutes' then
    return jsonb_build_object('ok', false, 'error', 'Too many wrong codes from this phone: try again in 10 minutes');
  end if;
  select x.* into s from clock_screen x
   where x.business_id = p.business_id and x.removed_at is null
     and v_code in (clock_code_of(p.business_id, x.id, v_window), clock_code_of(p.business_id, x.id, v_window - 1))
   order by x.created_at
   limit 1;
  if s.id is null then
    update staff_phone
       set wrong_codes = case when wrong_since > v_now - interval '10 minutes' then wrong_codes + 1 else 1 end,
           wrong_since = case when wrong_since > v_now - interval '10 minutes' then wrong_since else v_now end
     where id = p.id;
    return jsonb_build_object('ok', false, 'error', 'That code has changed: scan the shop''s code again');
  end if;
  select * into e from employee where id = p.employee_id for update;
  if not works_on(e, business_local_date(p.business_id, v_now)) then
    return jsonb_build_object('ok', false, 'error', format('%s does not work here now', e.full_name));
  end if;
  update staff_phone set last_used_at = v_now, wrong_codes = 0, wrong_since = null where id = p.id;
  if p_direction = 'in' then
    return clock_in_record(p.business_id, e, s.location_id, 'phone', e.app_user_id, p.id, s.id);
  end if;
  return clock_out_record(p.business_id, e, e.app_user_id);
end $$;

create or replace function clock_by_phone(p_phone text, p_code text, p_direction text,
                                          p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (select business_id from staff_phone
                       where key_hash = clock_key_hash(p_phone) and ended_at is null and p_phone is not null);
  -- The phone's key is kept as its hash, the code as it was: a retry is the same scan.
  v_req jsonb := jsonb_build_object('p_phone', clock_key_hash(p_phone), 'p_code', p_code,
                                    'p_direction', p_direction);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'clock_by_phone', v_req);
  if v is not null then return v; end if;
  v := clock_by_phone__run(p_phone => p_phone, p_code => p_code, p_direction => p_direction);
  perform idem_finish(v_business, p_idempotency_key, 'clock_by_phone', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Who may call what
-- -----------------------------------------------------------------------------
revoke execute on function
  clock_key_hash(text), clock_new_key(), clock_secret_of(uuid), clock_window(timestamptz),
  clock_code_of(uuid, uuid, bigint), clock_screens_in_use(uuid), clock_screen_by_key(text),
  clock_in_record(uuid, employee, uuid, text, uuid, uuid, uuid), clock_out_record(uuid, employee, uuid),
  till_clock_gate(uuid, employee, text),
  clock_in__run(uuid, text, uuid, text), clock_out__run(uuid, text, text),
  clock_by_phone__run(text, text, text)
from public, anon, authenticated;

-- Signed in: the screens, the links, and the till's clock.
revoke execute on function
  register_clock_screen(uuid, text), remove_clock_screen(uuid, text), clock_screens(),
  clock_screen_check(text), link_phone_start(uuid), unlink_phone(uuid, text), staff_phones(),
  clock_in(uuid, text, uuid, text, uuid), clock_out(uuid, text, text, uuid)
from public, anon;
grant execute on function
  register_clock_screen(uuid, text), remove_clock_screen(uuid, text), clock_screens(),
  clock_screen_check(text), link_phone_start(uuid), unlink_phone(uuid, text), staff_phones(),
  clock_in(uuid, text, uuid, text, uuid), clock_out(uuid, text, text, uuid)
to authenticated;

-- Signed in or not: a clock screen and a phone are known by their keys. The
-- only functions the public may call; each answers only to a key it gave out.
revoke execute on function
  clock_screen_code(text), link_phone_finish(text), phone_status(text), clock_by_phone(text, text, text, uuid)
from public;
grant execute on function
  clock_screen_code(text), link_phone_finish(text), phone_status(text), clock_by_phone(text, text, text, uuid)
to authenticated;
grant execute on function
  clock_screen_code(text), link_phone_finish(text), phone_status(text), clock_by_phone(text, text, text, uuid)
to anon;
