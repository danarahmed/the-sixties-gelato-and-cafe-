-- 0100: speed (plan 8, steps 1 and 2).
--
--   * The alerts worked out once a minute, not each time a screen asks. The
--     dashboard (current_alerts) and the daily brief both brought every alert
--     up to date before answering: 0.5 to 0.6 s on average, seconds at worst
--     (measured 6 November). Now an answer worked out in the last minute is
--     used as it is; the phones' timer (0072) and the next screen keep it
--     fresh. `sixties.alerts_fresh_seconds` (60 by default; 0 works them out
--     every time, as the tests do).
--   * The voids and refunds of a day found by their own index (the brief and
--     the reports read them by day).
--   * The system's administrators (the owner of the system, not of a café):
--     `system_admin`, and the Speed page's measurements, kept so they can be
--     sent. A café's owner is not one.
--
-- Nothing recorded changes.

-- -----------------------------------------------------------------------------
-- 1. The alerts, worked out once a minute
-- -----------------------------------------------------------------------------
create table if not exists alert_refresh (
  business_id uuid primary key references business (id) on delete cascade,
  at          timestamptz not null
);
alter table alert_refresh enable row level security;
alter table alert_refresh force row level security;
revoke all on alert_refresh from public, anon, authenticated;

-- How long an answer stays fresh, in seconds: 60, or what the connection says.
create or replace function alerts_fresh_seconds() returns int
language sql stable set search_path = public as $$
  select case when coalesce(current_setting('sixties.alerts_fresh_seconds', true), '') ~ '^\d{1,5}$'
              then current_setting('sixties.alerts_fresh_seconds', true)::int else 60 end
$$;

alter function refresh_alerts(uuid) rename to refresh_alerts_0099;
create or replace function refresh_alerts(p_business uuid) returns void
language plpgsql set search_path = public as $$
declare v_fresh int := alerts_fresh_seconds();
begin
  if p_business is null then return; end if;
  if v_fresh > 0 and exists (select 1 from alert_refresh
                              where business_id = p_business
                                and at > clock_timestamp() - make_interval(secs => v_fresh)) then
    return;
  end if;
  perform refresh_alerts_0099(p_business);
  insert into alert_refresh (business_id, at) values (p_business, clock_timestamp())
  on conflict (business_id) do update set at = excluded.at;
end $$;
revoke execute on function refresh_alerts(uuid), refresh_alerts_0099(uuid), alerts_fresh_seconds()
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. A day's voids and refunds, by their own index
-- -----------------------------------------------------------------------------
create index if not exists sale_adjustment_day on sale_adjustment (business_id, kind, created_at);

-- -----------------------------------------------------------------------------
-- 3. The system's administrators, and the Speed page
-- -----------------------------------------------------------------------------
create table if not exists system_admin (
  auth_user_id uuid primary key,
  added_at     timestamptz not null default now()
);
alter table system_admin enable row level security;
alter table system_admin force row level security;
revoke all on system_admin from public, anon, authenticated;

-- The system's own owner: the owner of the first café it was built for.
insert into system_admin (auth_user_id)
select au.auth_user_id
  from app_user au
  join user_role ur on ur.app_user_id = au.id and ur.role = 'owner'
  join business b on b.id = au.business_id
 where au.auth_user_id is not null and b.practice_of is null
 order by b.created_at, au.created_at
 limit 1
on conflict do nothing;

create or replace function is_system_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from system_admin where auth_user_id = auth.uid())
$$;

create or replace function require_system_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_system_admin() then
    raise exception 'Only the system''s administrators see this' using errcode = '42501';
  end if;
end $$;

create table if not exists speed_sample (
  id           uuid primary key default gen_random_uuid(),
  at           timestamptz not null default now(),
  auth_user_id uuid not null,
  device_ms    int check (device_ms between 0 and 600000),
  database_ms  int check (database_ms between 0 and 600000),
  calls        jsonb not null default '[]'::jsonb,
  agent        text,
  note         text
);
alter table speed_sample enable row level security;
alter table speed_sample force row level security;
revoke all on speed_sample from public, anon, authenticated;

-- The trip from the app to the database and back, for the Speed page.
create or replace function speed_ping() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_system_admin();
  return jsonb_build_object('ok', true, 'at', now());
end $$;

-- A measurement, kept: the device's trip, the database's, and each call's time.
create or replace function save_speed_sample(p_device_ms int, p_database_ms int, p_calls jsonb,
                                             p_agent text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform require_system_admin();
  if p_calls is null or jsonb_typeof(p_calls) <> 'array' or jsonb_array_length(p_calls) > 40 then
    raise exception 'The measurement cannot be read';
  end if;
  insert into speed_sample (auth_user_id, device_ms, database_ms, calls, agent, note)
  values (auth.uid(), p_device_ms, p_database_ms, p_calls, left(p_agent, 120), nullif(left(trim(p_note), 300), ''))
  returning id into v;
  delete from speed_sample where at < now() - interval '180 days';
  return v;
end $$;

create or replace function speed_samples(p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_system_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'at', s.at, 'device_ms', s.device_ms,
                                        'database_ms', s.database_ms, 'calls', s.calls,
                                        'agent', s.agent, 'note', s.note) order by s.at desc)
      from (select * from speed_sample order by at desc limit least(greatest(coalesce(p_limit, 30), 1), 100)) s
  ), '[]'::jsonb);
end $$;

revoke execute on function is_system_admin(), require_system_admin(), speed_ping(),
  save_speed_sample(int, int, jsonb, text, text), speed_samples(int) from public, anon;
grant execute on function is_system_admin(), speed_ping(), save_speed_sample(int, int, jsonb, text, text),
  speed_samples(int) to authenticated;
revoke execute on function require_system_admin() from authenticated;
