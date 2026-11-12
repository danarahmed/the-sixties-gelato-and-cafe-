-- =============================================================================
-- 0099 — Security fixes (OPEN_PLANS plan 7, the owner's decisions of 7 November)
-- =============================================================================
--  * 8. Clocking in or out from a phone is only near the shop or inside it:
--    each place may be given where it is (location.clock_lat, clock_lng) and
--    how near is near (clock_radius_m, 150 metres by default), by the owner on
--    Settings → Places; the phone sends where it is, and a phone farther away,
--    or one that will not say, is refused. A place not given its spot clocks
--    as before. Not tied to the shop's Wi-Fi.
--  * 9. Alerts: a screen that fails (note_app_error, from the app) is kept a
--    month and is an alert for the owner while it keeps happening; a sign-in
--    from a device a person has not used before (note_device) is an alert for
--    the owner when that person may see the books.
--  * 10. The till's lock when nobody touches it (the café's rule
--    till_lock_minutes, 0 is off, the default): the person unlocks it with
--    their clock PIN or their approval PIN (unlock_till), with the same limits
--    on wrong PINs; anyone else signs out and in as themselves.
--  * 11. A fixed search_path for the rarely called helpers that had none (they
--    run with the caller's own rights). The few called for every line of a
--    sale or a report keep none: a fixed one would stop them being inlined,
--    and slow every sale. citext stays where it is: email matching rests on
--    it.
-- Nothing recorded changes. Rehearsed with tests/sql/security_fixes.test.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 8. Clocking from a phone: near the shop, or inside it
-- -----------------------------------------------------------------------------
alter table location add column if not exists clock_lat double precision;
alter table location add column if not exists clock_lng double precision;
alter table location add column if not exists clock_radius_m int not null default 150;
alter table location drop constraint if exists location_clock_spot;
alter table location add constraint location_clock_spot check (
  (clock_lat is null) = (clock_lng is null)
  and (clock_lat is null or (clock_lat between -90 and 90 and clock_lng between -180 and 180))
  and clock_radius_m between 20 and 2000);

-- How far apart two points on the earth are, in metres.
create or replace function geo_metres(p_lat1 double precision, p_lng1 double precision,
                                      p_lat2 double precision, p_lng2 double precision)
returns double precision language sql immutable set search_path = public as $$
  select 2 * 6371000 * asin(sqrt(
           power(sin(radians(p_lat2 - p_lat1) / 2), 2)
           + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)))
$$;

-- (settings.manage) Where a place is, and how near a phone must be to clock
-- there; no spot, and phones clock there as before.
create or replace function set_place_clock_spot(p_place uuid, p_lat double precision, p_lng double precision,
                                                p_radius int default 150)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage'); l location;
begin
  select * into l from location where id = p_place and business_id = v_business for update;
  if not found then raise exception 'That place is not one of the café''s'; end if;
  if (p_lat is null) <> (p_lng is null) then raise exception 'Give both where it is north and east, or neither'; end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then
    raise exception 'That is not a place on the map';
  end if;
  if coalesce(p_radius, 150) not between 20 and 2000 then
    raise exception 'How near is 20 to 2,000 metres';
  end if;
  update location set clock_lat = p_lat, clock_lng = p_lng, clock_radius_m = coalesce(p_radius, 150)
   where id = l.id;
  perform audit_event(v_business, 'place.clock_spot', 'location', l.id::text, null,
    jsonb_build_object('name', l.name, 'lat', l.clock_lat, 'lng', l.clock_lng, 'radius', l.clock_radius_m),
    jsonb_build_object('name', l.name, 'lat', p_lat, 'lng', p_lng, 'radius', coalesce(p_radius, 150)));
  return jsonb_build_object('place_id', l.id, 'lat', p_lat, 'lng', p_lng, 'radius', coalesce(p_radius, 150));
end $$;

-- 0068's clock by phone, with where the phone is.
drop function if exists clock_by_phone(text, text, text, uuid);
drop function if exists clock_by_phone__run(text, text, text);
create function clock_by_phone__run(p_phone text, p_code text, p_direction text,
                                    p_lat double precision default null, p_lng double precision default null,
                                    p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p staff_phone; e employee; s clock_screen; l location;
  v_now timestamptz := clock_timestamp();
  v_window bigint := clock_window(v_now);
  v_code text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  v_far double precision;
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
  -- Near the shop, or inside it (0099), where the place has its spot.
  select * into l from location where id = s.location_id;
  if l.clock_lat is not null then
    if p_lat is null or p_lng is null then
      return jsonb_build_object('ok', false, 'where', true, 'error',
        'Let this phone say where it is: clocking from a phone is at the shop');
    end if;
    v_far := geo_metres(l.clock_lat, l.clock_lng, p_lat, p_lng);
    if v_far > l.clock_radius_m + least(greatest(coalesce(p_accuracy, 0), 0), 100) then
      return jsonb_build_object('ok', false, 'where', true, 'error',
        format('This phone is about %s m from %s: clock in or out there', round(v_far)::bigint, l.name));
    end if;
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

create function clock_by_phone(p_phone text, p_code text, p_direction text,
                               p_idempotency_key uuid default null, p_lat double precision default null,
                               p_lng double precision default null, p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (select business_id from staff_phone
                       where key_hash = clock_key_hash(p_phone) and ended_at is null and p_phone is not null);
  v_req jsonb := jsonb_build_object('p_phone', clock_key_hash(p_phone), 'p_code', p_code,
                                    'p_direction', p_direction);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'clock_by_phone', v_req);
  if v is not null then return v; end if;
  v := clock_by_phone__run(p_phone => p_phone, p_code => p_code, p_direction => p_direction,
                           p_lat => p_lat, p_lng => p_lng, p_accuracy => p_accuracy);
  -- Each answer is kept for its retry, but for "not at the shop": the person
  -- tries again from nearer, with the same scan.
  if not coalesce((v ->> 'where')::boolean, false) then
    perform idem_finish(v_business, p_idempotency_key, 'clock_by_phone', v_req, v);
  end if;
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 10. The till locks when nobody touches it
-- -----------------------------------------------------------------------------
create or replace function rule_definitions() returns jsonb
language sql immutable set search_path = public as $$
  select '{
    "daily_sales_target":    {"kind": "amount", "min": 0, "max": 1000000000, "whole": true,
                              "scopes": ["business", "location"],
                              "label": "A day''s net sales target (0: none)"},
    "labour_target_percent": {"kind": "percent", "min": 0, "max": 100, "whole": false,
                              "scopes": ["business", "location"],
                              "label": "Labour cost the café aims for (% of net sales; 0: none)"},
    "discount_cap_percent":  {"kind": "percent", "min": 0, "max": 100, "whole": false,
                              "scopes": ["business", "role"],
                              "label": "Discounts a manager approves, over (% of the bill)"},
    "discount_round_to":     {"kind": "amount", "min": 1, "max": 100000, "whole": true,
                              "scopes": ["business"],
                              "label": "A discount given as a percentage is rounded to"},
    "refund_approval_over":  {"kind": "amount", "min": 0, "max": 100000000, "whole": true,
                              "scopes": ["business", "role"],
                              "label": "Refunds a second person approves, over"},
    "waste_approval_over":   {"kind": "amount", "min": 0, "max": 100000000, "whole": true,
                              "scopes": ["business", "role"],
                              "label": "Losses a manager approves, over"},
    "waste_approval_window": {"kind": "choice", "choices": ["entry", "session", "day"],
                              "scopes": ["business"],
                              "label": "One person''s losses are added up over"},
    "negative_stock":        {"kind": "choice", "choices": ["block", "approve", "alert", "allow"],
                              "scopes": ["business", "item_type", "item"],
                              "label": "Using more stock than the books hold"},
    "usd_rate_max_age_hours": {"kind": "hours", "min": 1, "max": 168, "whole": true,
                              "scopes": ["business"],
                              "label": "Dollars are taken at a rate set within the last"},
    "usd_round_to":          {"kind": "amount", "min": 1, "max": 100000, "whole": true,
                              "scopes": ["business"],
                              "label": "Dollars are counted in dinars to the nearest"},
    "po_approve_up_to":      {"kind": "amount", "min": 0, "max": 1000000000, "whole": true,
                              "scopes": ["business", "role"],
                              "label": "Purchase orders a manager approves, up to"},
    "overtime_percent":      {"kind": "percent", "min": 100, "max": 300, "whole": false,
                              "scopes": ["business"],
                              "label": "Overtime is paid at (% of an hour''s pay)"},
    "late_after_minutes":    {"kind": "minutes", "min": 0, "max": 120, "whole": true,
                              "scopes": ["business"],
                              "label": "Late, or leaving early, by more than"},
    "clocked_in_alert_hours": {"kind": "hours", "min": 4, "max": 24, "whole": true,
                              "scopes": ["business"],
                              "label": "Someone still clocked in after"},
    "payday":                {"kind": "day", "min": 1, "max": 28, "whole": true,
                              "scopes": ["business"],
                              "label": "Salaries are paid on the day of the month"},
    "loyalty":               {"kind": "choice", "choices": ["on", "off"],
                              "scopes": ["business"],
                              "label": "Customers earn points, and take rewards"},
    "loyalty_point_per":     {"kind": "amount", "min": 1, "max": 1000000, "whole": true,
                              "scopes": ["business"],
                              "label": "A customer earns a point for every"},
    "loyalty_reward_points": {"kind": "points", "min": 1, "max": 100000, "whole": true,
                              "scopes": ["business"],
                              "label": "A reward takes"},
    "loyalty_reward_value":  {"kind": "amount", "min": 1, "max": 10000000, "whole": true,
                              "scopes": ["business"],
                              "label": "A reward is worth"},
    "transfer_markup_percent": {"kind": "percent", "min": 0, "max": 100, "whole": false,
                              "scopes": ["business", "location"],
                              "label": "Stock sent to another branch is charged at cost plus (%; 0: at cost)"},
    "expired_sale":          {"kind": "choice", "choices": ["warn", "refuse"],
                              "scopes": ["business", "location"],
                              "label": "Selling stock past its use-by"},
    "use_by_warn_hours":     {"kind": "hours", "min": 1, "max": 168, "whole": true,
                              "scopes": ["business"],
                              "label": "Warn of a use-by this many hours ahead"},
    "till_lock_minutes":     {"kind": "minutes", "min": 0, "max": 60, "whole": true,
                              "scopes": ["business", "location"],
                              "label": "Lock a till nobody touches after this many minutes (0: never)"}
  }'::jsonb
$$;
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rule_defaults_0098') then
    execute 'alter function rule_defaults(uuid) rename to rule_defaults_0098';
  end if;
end $$;
create or replace function rule_defaults(p_business uuid)
returns table (key text, scope_type text, scope_id text, value jsonb)
language sql stable set search_path = public as $$
  select d.key, d.scope_type, d.scope_id, d.value from rule_defaults_0098(p_business) d
  union all
  select 'till_lock_minutes', 'business', '', to_jsonb(0)
$$;

-- How long a till here may sit untouched before it locks (0 is never), for
-- those who sell.
create or replace function till_lock_minutes(p_location uuid default null) returns int
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create');
begin
  return coalesce((rule_value(v_business, 'till_lock_minutes', null, null,
                              resolve_location(v_business, p_location)) #>> '{}')::int, 0);
end $$;

create table if not exists till_unlock_attempt (
  id          bigint generated always as identity primary key,
  business_id uuid not null references business (id) on delete cascade,
  app_user_id uuid not null references app_user (id),
  ok          boolean not null,
  at          timestamptz not null default now()
);
create index if not exists till_unlock_attempt_by on till_unlock_attempt (app_user_id, at desc);
alter table till_unlock_attempt enable row level security;
alter table till_unlock_attempt force row level security;

-- The person signed in unlocks their till with their clock PIN or their
-- approval PIN; five wrong in fifteen minutes and only signing in again does.
create or replace function unlock_till(p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me app_user := current_member();
  e employee; v_wrong int; v_ok boolean := false;
begin
  if v_me.id is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select count(*) into v_wrong from till_unlock_attempt
   where app_user_id = v_me.id and not ok and at > now() - interval '15 minutes';
  if v_wrong >= 5 then
    return jsonb_build_object('ok', false, 'error', 'Too many wrong PINs: sign out, and sign in again');
  end if;
  select * into e from employee where app_user_id = v_me.id and business_id = v_me.business_id
   order by created_at limit 1;
  if e.clock_pin_hash is null and v_me.pin_hash is null then
    return jsonb_build_object('ok', false, 'error',
      'You have no PIN yet: sign out and in again, or a manager sets your clock PIN on Staff');
  end if;
  v_ok := (e.clock_pin_hash is not null
           and extensions.crypt(coalesce(p_pin, ''), e.clock_pin_hash) = e.clock_pin_hash)
       or (v_me.pin_hash is not null and extensions.crypt(coalesce(p_pin, ''), v_me.pin_hash) = v_me.pin_hash);
  insert into till_unlock_attempt (business_id, app_user_id, ok) values (v_me.business_id, v_me.id, v_ok);
  if not v_ok then return jsonb_build_object('ok', false, 'error', 'That PIN is not right'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- -----------------------------------------------------------------------------
-- 9. Screens that fail, and sign-ins from a new device
-- -----------------------------------------------------------------------------
-- A screen that failed is a note of its own kind (0097's), on the report of
-- where people get stuck.
alter table stuck_event drop constraint if exists stuck_event_kind_check;
alter table stuck_event add constraint stuck_event_kind_check check (kind in ('refused', 'help', 'error'));
create or replace function note_stuck(p_path text, p_kind text, p_message text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := real_member_id();
  v_business uuid := (select business_id from app_user where id = v_me);
  v_path text := stuck_path(p_path);
  v_message text := nullif(left(trim(p_message), 300), '');
begin
  if v_me is null or p_kind not in ('refused', 'help', 'error') or v_path !~ '^/[a-z0-9/_-]{0,80}$' then return; end if;
  if exists (select 1 from stuck_event where app_user_id = v_me and path = v_path and kind = p_kind
                and message is not distinct from v_message and practice = practicing()
                and at > now() - interval '1 minute') then
    return;
  end if;
  insert into stuck_event (business_id, app_user_id, path, kind, message, practice)
  values (v_business, v_me, v_path, p_kind, v_message, practicing());
  delete from stuck_event where business_id = v_business and at < now() - interval '180 days';
end $$;

-- The report counts the screens that failed, beside the refusals and the help.
create or replace function stuck_report(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_from timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 180));
begin
  if v_business is null or not current_has_role('owner') then
    raise exception 'Only the owner reads where people get stuck' using errcode = '42501';
  end if;
  return jsonb_build_object('days', least(greatest(coalesce(p_days, 30), 1), 180), 'screens', coalesce((
    select jsonb_agg(s order by (s ->> 'errors')::int + (s ->> 'refused')::int + (s ->> 'help')::int desc, s ->> 'path')
      from (select jsonb_build_object(
                     'path', e.path,
                     'refused', count(*) filter (where e.kind = 'refused' and not e.practice),
                     'help', count(*) filter (where e.kind = 'help' and not e.practice),
                     'errors', count(*) filter (where e.kind = 'error' and not e.practice),
                     'practice', count(*) filter (where e.practice),
                     'people', count(distinct e.app_user_id),
                     'roles', (select jsonb_agg(distinct ur.role) from user_role ur
                                where ur.app_user_id = any (array_agg(e.app_user_id))),
                     'messages', (select coalesce(jsonb_agg(jsonb_build_object('message', m.message, 'times', m.n)
                                                            order by m.n desc, m.message), '[]'::jsonb)
                                    from (select x.message, count(*) n from stuck_event x
                                           where x.business_id = v_business and x.path = e.path and x.at >= v_from
                                             and x.kind = 'refused' and x.message is not null
                                           group by x.message order by count(*) desc, x.message limit 5) m)) s
              from stuck_event e
             where e.business_id = v_business and e.at >= v_from
             group by e.path) q), '[]'::jsonb));
end $$;

create table if not exists member_device (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business (id) on delete cascade,
  app_user_id uuid not null references app_user (id),
  device_hash text not null,
  agent       text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  unique (app_user_id, device_hash)
);
alter table member_device enable row level security;
alter table member_device force row level security;

-- The app says which device a person signed in on (a key the device keeps,
-- kept here as its hash): a device new to someone who had used another is a
-- new device. Read by no one but the alerts.
create or replace function note_device(p_key text, p_agent text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := real_member_id();
  v_business uuid := (select business_id from app_user where id = v_me);
  v_hash text := encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  v_new boolean;
begin
  if v_me is null or length(coalesce(p_key, '')) < 16 or length(p_key) > 200 then
    return jsonb_build_object('new', false);
  end if;
  update member_device set last_seen = now() where app_user_id = v_me and device_hash = v_hash;
  if found then return jsonb_build_object('new', false); end if;
  v_new := exists (select 1 from member_device where app_user_id = v_me);
  insert into member_device (business_id, app_user_id, device_hash, agent)
  values (v_business, v_me, v_hash, nullif(left(trim(p_agent), 120), ''));
  return jsonb_build_object('new', v_new);
end $$;

alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0098;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0098(p_business, p_now) c
  union all
  -- Screens failing for the people using them: three or more in the last hour.
  select 'app_errors'::text, 'app'::text, case when count(*) >= 10 then 'red' else 'orange' end,
         format('%s screens failed in the last hour', count(*)),
         'Something on a screen failed for the people using it: what they were doing may not have been recorded.',
         'Open Reports → Where people get stuck to see which screen, and tell whoever looks after the app.',
         'high', '/reports/stuck', jsonb_build_object('errors', count(*))
    from stuck_event x
   where x.business_id = p_business and x.kind = 'error' and not x.practice and x.at > p_now - interval '1 hour'
  having count(*) >= 3
  union all
  -- A sign-in from a device new to someone who may see the books: one alert a
  -- person, naming the newest device and how many there were in the day.
  select 'new_device'::text, au.id::text, 'orange',
         format('%s signed in from a new device: %s', au.full_name, coalesce(n.agent, '?')),
         'If it was not them, someone else knows their password.',
         'Ask them. If it was not them, deactivate them in Settings → People, then set a new password.',
         'high', '/settings#people', jsonb_build_object('member_id', au.id, 'first_seen', n.first_seen, 'devices', n.devices)
    from (select distinct on (d.app_user_id) d.app_user_id, d.agent, d.first_seen,
                 count(*) over (partition by d.app_user_id) as devices
            from member_device d
           where d.business_id = p_business and d.first_seen > p_now - interval '1 day'
             and exists (select 1 from member_device o where o.app_user_id = d.app_user_id and o.first_seen < d.first_seen)
           order by d.app_user_id, d.first_seen desc) n
    join app_user au on au.id = n.app_user_id
   where true
     and (member_has_permission(au.id, 'profit.view') or member_has_permission(au.id, 'settings.manage'))
$$;

-- -----------------------------------------------------------------------------
-- 11. A fixed search_path for the rarely called helpers
-- -----------------------------------------------------------------------------
alter function allocate_landed(uuid,numeric[],numeric) set search_path = public, extensions;
alter function assert_safe_can_pay(uuid,numeric) set search_path = public, extensions;
alter function assert_sale_total(jsonb,numeric) set search_path = public, extensions;
alter function carry_cash_since_last_close() set search_path = public, extensions;
alter function day_cash_totals(uuid,uuid,date) set search_path = public, extensions;
alter function ensure_period(uuid,date) set search_path = public, extensions;
alter function journal_reversible_by_hand(text) set search_path = public, extensions;
alter function journal_source_hint(text) set search_path = public, extensions;
alter function legacy_unposted_internal(uuid) set search_path = public, extensions;
alter function manual_journal_blocked(text) set search_path = public, extensions;
alter function next_document_no(uuid,text,bigint) set search_path = public, extensions;
alter function pay_out_of(uuid,uuid,text,numeric,text,uuid,uuid) set search_path = public, extensions;
alter function payroll_month_text(date) set search_path = public, extensions;
alter function post_journal(uuid,timestamp with time zone,text,text,uuid,jsonb,uuid,text) set search_path = public, extensions;
alter function post_year_end_close(uuid,date) set search_path = public, extensions;
alter function practice_task_list() set search_path = public, extensions;
alter function provision_chart_of_accounts(uuid) set search_path = public, extensions;
alter function receipt_legacy_payable(uuid,timestamp with time zone) set search_path = public, extensions;
alter function receipt_link(jsonb,text) set search_path = public, extensions;
alter function receipt_text(jsonb,text,integer) set search_path = public, extensions;
alter function reverse_entry_internal(uuid,timestamp with time zone,text) set search_path = public, extensions;
alter function staff_paid_from(text) set search_path = public, extensions;
alter function stuck_path(text) set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------
revoke execute on function geo_metres(double precision, double precision, double precision, double precision),
  clock_by_phone__run(text, text, text, double precision, double precision, double precision),
  rule_definitions(), rule_defaults(uuid), rule_defaults_0098(uuid),
  alert_conditions_0098(uuid, timestamptz), alert_conditions(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function set_place_clock_spot(uuid, double precision, double precision, int), unlock_till(text),
  till_lock_minutes(uuid), note_device(text, text), note_stuck(text, text, text) from public, anon;
grant execute on function set_place_clock_spot(uuid, double precision, double precision, int), unlock_till(text),
  till_lock_minutes(uuid), note_device(text, text), note_stuck(text, text, text) to authenticated;
revoke execute on function clock_by_phone(text, text, text, uuid, double precision, double precision, double precision)
  from public;
grant execute on function clock_by_phone(text, text, text, uuid, double precision, double precision, double precision)
  to anon, authenticated;
