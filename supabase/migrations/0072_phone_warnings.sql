-- =============================================================================
-- 0072 — Warnings on your phone (round eleven)
--
-- The owner's choice: the warnings the dashboard shows under "Needs you" (the
-- alerts of 0029) come to the phones of those who turn them on, in their own
-- language, without opening the app.
--
--   * The owner (settings.manage) turns phone warnings on for the café once,
--     on Settings. The app makes the café's pair of keys for sending (VAPID)
--     and gives the database its own address; the database makes a secret of
--     its own, which never leaves it but in its calls to that address.
--   * Each person who sees the warnings (profit.view, as the dashboard) turns
--     them on on a phone, on My account: all of them, or the urgent (red) ones
--     only; and may send that phone a test.
--   * Every five minutes the database's timer (pg_cron) brings the alerts up to
--     date, puts each new one — or one turned red — in a phone's queue, and,
--     when a queue has something, calls the app's address with its secret
--     (pg_net). The app takes the queue with that secret, translates each
--     warning into the phone's language, sends it, and says which phones are
--     gone. More than three at once for a phone become one: "N new warnings".
--   * An alert answered or snoozed on the dashboard is not sent; one is sent
--     once, and again only if it turns red.
--
-- Without pg_cron and pg_net (a database that has neither), everything is kept
-- but nothing is sent; Settings says so.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The database's timer and its calls out (Supabase has both; a database
--    without them keeps working)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
exception when others then
  raise notice 'Phone warnings: the timer or the calls out could not be turned on (%)', sqlerrm;
end $$;

-- -----------------------------------------------------------------------------
-- 2. What is kept: the café's settings, the phones, their queue
-- -----------------------------------------------------------------------------
-- One row a café. Its keys and secret are read by these functions only.
create table if not exists push_config (
  business_id   uuid primary key references business (id) on delete cascade,
  enabled       boolean not null default false,
  site_url      text,
  vapid_public  text,
  vapid_private text,
  secret        text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  turned_on_at  timestamptz,
  turned_on_by  uuid references app_user (id),
  last_tick_at  timestamptz
);

-- A phone (a browser's push subscription) and whose it is.
create table if not exists push_device (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  member_id    uuid not null references app_user (id) on delete cascade,
  endpoint     text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh       text not null check (length(p256dh) between 20 and 200),
  auth         text not null check (length(auth) between 8 and 100),
  locale       text not null default 'en' check (locale ~ '^[a-z]{2,3}$'),
  urgent_only  boolean not null default false,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists push_device_member on push_device (business_id, member_id);

-- What waits to be sent to a phone. The title and body are as the database
-- writes them (English); the app translates them into the phone's language.
create table if not exists push_message (
  id          bigserial primary key,
  business_id uuid not null references business (id) on delete cascade,
  device_id   uuid not null references push_device (id) on delete cascade,
  title       text not null,
  body        text,
  url         text not null default '/dashboard',
  tag         text,
  urgent      boolean not null default false,
  created_at  timestamptz not null default now(),
  taken_at    timestamptz,
  attempts    int not null default 0,
  sent_at     timestamptz
);
create index if not exists push_message_waiting on push_message (business_id, id) where sent_at is null;

-- What an alert was last sent as: null (not yet), orange or red.
alter table alert add column if not exists pushed_urgency text check (pushed_urgency in ('red', 'orange'));

alter table push_config enable row level security;
alter table push_device enable row level security;
alter table push_message enable row level security;
revoke all on push_config, push_device, push_message from public, anon, authenticated;
revoke all on sequence push_message_id_seq from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Helpers
-- -----------------------------------------------------------------------------
-- Whether a member (not the caller) holds a permission: who a warning goes to.
create or replace function member_has_permission(p_member uuid, p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_user au
    join user_role ur on ur.app_user_id = au.id
    join role_permission rp on rp.role = ur.role
    where au.id = p_member and au.is_active and rp.permission = p_permission
  )
$$;

-- Whether the database can send at all: its timer and its calls out.
create or replace function push_can_send() returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'net' and p.proname = 'http_post')
$$;

-- -----------------------------------------------------------------------------
-- 4. What a person sees: is it on for the café, and on this phone?
-- -----------------------------------------------------------------------------
create or replace function phone_warnings(p_endpoint text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m app_user := current_member();
  c push_config;
  d push_device;
begin
  if m.id is null then raise exception 'Sign in to continue' using errcode = '28000'; end if;
  select * into c from push_config where business_id = m.business_id;
  if p_endpoint is not null then
    select * into d from push_device where endpoint = p_endpoint and member_id = m.id;
  end if;
  return jsonb_build_object(
    'on', coalesce(c.enabled, false),
    'public_key', case when c.enabled then c.vapid_public end,
    'can_send', push_can_send(),
    'may_receive', current_has_permission('profit.view'),
    'may_turn_on', current_has_permission('settings.manage'),
    'turned_on_at', c.turned_on_at,
    'phones', case when current_has_permission('settings.manage')
                   then (select count(*) from push_device where business_id = m.business_id) end,
    'this_phone', case when d.id is null then null
                       else jsonb_build_object('urgent_only', d.urgent_only, 'since', d.created_at) end);
end $$;

-- -----------------------------------------------------------------------------
-- 5. The owner turns them on, or off, for the café
-- -----------------------------------------------------------------------------
-- The keys are kept from the first time: phones turned on with them keep
-- working. The address is where the app answers (its production address).
create or replace function turn_on_phone_warnings__run(p_site_url text, p_public text, p_private text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_url text := rtrim(trim(coalesce(p_site_url, '')), '/');
  c push_config;
begin
  if v_url !~ '^https://[a-z0-9.-]+(:[0-9]+)?$' and v_url !~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$' then
    raise exception 'The app''s address must be its https address';
  end if;
  if coalesce(p_public, '') !~ '^[A-Za-z0-9_-]{80,100}$' or coalesce(p_private, '') !~ '^[A-Za-z0-9_-]{40,50}$' then
    raise exception 'The keys for sending are not valid';
  end if;
  insert into push_config (business_id) values (v_business) on conflict (business_id) do nothing;
  select * into c from push_config where business_id = v_business for update;
  update push_config
     set enabled = true, site_url = v_url,
         vapid_public = coalesce(c.vapid_public, p_public), vapid_private = coalesce(c.vapid_private, p_private),
         turned_on_at = now(), turned_on_by = current_app_user_id()
   where business_id = v_business;
  -- What is open already was seen on the dashboard: only what comes next is sent.
  update alert set pushed_urgency = urgency
   where business_id = v_business and resolved_at is null and pushed_urgency is distinct from urgency;
  perform audit_event(v_business, 'phone_warnings.on', 'business', v_business::text, null,
                      jsonb_build_object('enabled', coalesce(c.enabled, false)),
                      jsonb_build_object('enabled', true, 'site_url', v_url));
  return jsonb_build_object('on', true, 'site_url', v_url, 'can_send', push_can_send());
end $$;

create or replace function turn_on_phone_warnings(p_site_url text, p_public text, p_private text,
                                                  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  -- The private key is not kept with the request's record.
  v_req jsonb := jsonb_build_object('p_site_url', p_site_url, 'p_public', p_public);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'turn_on_phone_warnings', v_req);
  if v is not null then return v; end if;
  v := turn_on_phone_warnings__run(p_site_url => p_site_url, p_public => p_public, p_private => p_private);
  perform idem_finish(v_business, p_idempotency_key, 'turn_on_phone_warnings', v_req, v);
  return v;
end $$;

create or replace function turn_off_phone_warnings__run() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage');
begin
  update push_config set enabled = false where business_id = v_business and enabled;
  if found then
    delete from push_message where business_id = v_business and sent_at is null;
    perform audit_event(v_business, 'phone_warnings.off', 'business', v_business::text, null,
                        jsonb_build_object('enabled', true), jsonb_build_object('enabled', false));
  end if;
  return jsonb_build_object('on', false);
end $$;

create or replace function turn_off_phone_warnings(p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := current_business_id(); v_req jsonb := '{}'::jsonb; v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'turn_off_phone_warnings', v_req);
  if v is not null then return v; end if;
  v := turn_off_phone_warnings__run();
  perform idem_finish(v_business, p_idempotency_key, 'turn_off_phone_warnings', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 6. A person turns them on, or off, on a phone; and sends it a test
-- -----------------------------------------------------------------------------
-- A phone already kept for someone else (the same phone, another person
-- signed in) becomes the caller's.
create or replace function save_push_device__run(p_endpoint text, p_push_key text, p_push_auth text,
                                                 p_locale text, p_urgent_only boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  v_me uuid := current_app_user_id();
  v_id uuid;
begin
  if not exists (select 1 from push_config where business_id = v_business and enabled) then
    raise exception 'Phone warnings are not turned on for the café: the owner turns them on in Settings';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or length(p_endpoint) > 1000 then
    raise exception 'This phone''s browser gave no address to send to';
  end if;
  insert into push_device (business_id, member_id, endpoint, p256dh, auth, locale, urgent_only)
  values (v_business, v_me, p_endpoint, p_push_key, p_push_auth,
          case when p_locale in ('en', 'ar', 'ckb') then p_locale else 'en' end, coalesce(p_urgent_only, false))
  on conflict (endpoint) do update
     set business_id = excluded.business_id, member_id = excluded.member_id, p256dh = excluded.p256dh,
         auth = excluded.auth, locale = excluded.locale, urgent_only = excluded.urgent_only
  returning id into v_id;
  return jsonb_build_object('device_id', v_id, 'urgent_only', coalesce(p_urgent_only, false));
end $$;

create or replace function save_push_device(p_endpoint text, p_push_key text, p_push_auth text, p_locale text,
                                            p_urgent_only boolean, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_endpoint', p_endpoint, 'p_locale', p_locale, 'p_urgent_only', p_urgent_only);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_push_device', v_req);
  if v is not null then return v; end if;
  v := save_push_device__run(p_endpoint => p_endpoint, p_push_key => p_push_key, p_push_auth => p_push_auth,
                             p_locale => p_locale, p_urgent_only => p_urgent_only);
  perform idem_finish(v_business, p_idempotency_key, 'save_push_device', v_req, v);
  return v;
end $$;

-- Only one's own phone is turned off here; a phone that is gone is dropped by itself.
create or replace function remove_push_device(p_endpoint text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m app_user := current_member();
begin
  if m.id is null then raise exception 'Sign in to continue' using errcode = '28000'; end if;
  delete from push_device where endpoint = p_endpoint and member_id = m.id;
  return jsonb_build_object('removed', found);
end $$;

-- A test to one's own phone: sent at once, if the database can call out.
create or replace function send_test_warning(p_endpoint text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  d push_device;
begin
  select * into d from push_device where endpoint = p_endpoint and member_id = current_app_user_id();
  if not found then raise exception 'Warnings are not turned on on this phone'; end if;
  if (select count(*) from push_message where device_id = d.id and tag = 'test'
                                       and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'A test was sent a moment ago: wait a minute';
  end if;
  insert into push_message (business_id, device_id, title, body, url, tag)
  values (v_business, d.id, 'A test from the café: warnings come to this phone',
          'They come within about five minutes of being seen.', '/account', 'test');
  perform push_kick(v_business);
  return jsonb_build_object('queued', true, 'can_send', push_can_send());
end $$;

-- -----------------------------------------------------------------------------
-- 7. The queue: new warnings for each phone, and the call to the app
-- -----------------------------------------------------------------------------
-- Puts each new alert (or one turned red) in the queue of every phone whose
-- person sees warnings — red only for a phone that asked for the urgent ones.
-- More than three for a phone at once are one. The timer brings the alerts up
-- to date first.
create or replace function push_queue(p_business uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record;
begin
  create temporary table if not exists push_new (id uuid, urgency text, title text, why text, link text)
    on commit drop;
  truncate push_new;
  with fresh as (
    update alert a set pushed_urgency = a.urgency
     where a.business_id = p_business and a.resolved_at is null
       and (a.pushed_urgency is null or (a.pushed_urgency = 'orange' and a.urgency = 'red'))
       and a.acknowledged_at is null and (a.snoozed_until is null or a.snoozed_until <= now())
    returning a.id, a.urgency, a.title, a.why, a.link
  )
  insert into push_new select * from fresh;
  for r in
    select d.id as device_id,
           count(*) as n,
           jsonb_agg(jsonb_build_object('id', f.id, 'title', f.title, 'why', f.why, 'link', f.link,
                                        'urgency', f.urgency) order by (f.urgency = 'red') desc, f.title) as items
      from push_device d
      join push_new f on (not d.urgent_only or f.urgency = 'red')
     where d.business_id = p_business and member_has_permission(d.member_id, 'profit.view')
     group by d.id
  loop
    if r.n > 3 then
      insert into push_message (business_id, device_id, title, body, url, tag, urgent)
      values (p_business, r.device_id, format('%s new warnings at the café', r.n),
              (select string_agg(i->>'title', '; ') from jsonb_array_elements(r.items) i), '/dashboard', 'alerts',
              exists (select 1 from jsonb_array_elements(r.items) i where i->>'urgency' = 'red'));
      v_n := v_n + 1;
    else
      insert into push_message (business_id, device_id, title, body, url, tag, urgent)
      select p_business, r.device_id, i->>'title', i->>'why',
             coalesce(nullif(i->>'link', ''), '/dashboard'), 'alert-' || (i->>'id'), i->>'urgency' = 'red'
        from jsonb_array_elements(r.items) i;
      v_n := v_n + r.n::int;
    end if;
  end loop;
  return v_n;
end $$;

-- Calls the app's address, with the secret, when something waits: through
-- pg_net, which sends after the transaction ends. Nothing without pg_net.
create or replace function push_kick(p_business uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare c push_config;
begin
  select * into c from push_config where business_id = p_business and enabled and site_url is not null;
  if not found or not push_can_send() then return false; end if;
  if not exists (select 1 from push_message where business_id = p_business and sent_at is null
                    and (taken_at is null or taken_at < now() - interval '10 minutes') and attempts < 3) then
    return false;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using c.site_url || '/api/push/send', jsonb_build_object('business', p_business),
          jsonb_build_object('Content-Type', 'application/json', 'x-push-key', c.secret);
  return true;
end $$;

-- What the timer runs every five minutes, for every café that has them on.
create or replace function push_tick() returns int
language plpgsql security definer set search_path = public as $$
declare b uuid; v_n int := 0;
begin
  for b in select business_id from push_config where enabled loop
    perform refresh_alerts(b);
    v_n := v_n + push_queue(b);
    perform push_kick(b);
    update push_config set last_tick_at = now() where business_id = b;
  end loop;
  -- What could not be sent in a day is let go.
  delete from push_message where created_at < now() - interval '1 day';
  return v_n;
end $$;

-- -----------------------------------------------------------------------------
-- 8. The app takes the queue, with the secret, and says what was sent
-- -----------------------------------------------------------------------------
-- Called by the app's address with the secret the database gave it: no one
-- signed in. Gives the keys and up to 200 waiting messages, each with its
-- phone; a message taken and not answered for is offered again after ten
-- minutes, three times at most.
create or replace function push_take(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c push_config; v jsonb;
begin
  select * into c from push_config where secret = coalesce(p_key, '') and enabled and length(coalesce(p_key, '')) >= 32;
  if not found then raise exception 'Not allowed' using errcode = '42501'; end if;
  with taken as (
    update push_message m set taken_at = now(), attempts = m.attempts + 1
     where m.id in (select id from push_message
                     where business_id = c.business_id and sent_at is null and attempts < 3
                       and (taken_at is null or taken_at < now() - interval '10 minutes')
                     order by id limit 200
                       for update skip locked)
    returning m.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'endpoint', d.endpoint, 'p256dh', d.p256dh, 'auth', d.auth, 'locale', d.locale,
           'title', t.title, 'body', t.body, 'url', t.url, 'tag', t.tag, 'urgent', t.urgent) order by t.id), '[]'::jsonb)
    into v
    from taken t join push_device d on d.id = t.device_id;
  return jsonb_build_object('subject', c.site_url, 'public_key', c.vapid_public, 'private_key', c.vapid_private,
                            'messages', v);
end $$;

-- What was sent, and the phones that are gone (the push service said 404 or
-- 410): those are dropped, with whatever waited for them.
create or replace function push_done(p_key text, p_sent bigint[], p_gone text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c push_config; v_sent int; v_gone int;
begin
  select * into c from push_config where secret = coalesce(p_key, '') and length(coalesce(p_key, '')) >= 32;
  if not found then raise exception 'Not allowed' using errcode = '42501'; end if;
  update push_message set sent_at = now()
   where business_id = c.business_id and id = any(coalesce(p_sent, '{}')) and sent_at is null;
  get diagnostics v_sent = row_count;
  update push_device d set last_sent_at = now()
   where d.business_id = c.business_id
     and exists (select 1 from push_message m where m.device_id = d.id and m.id = any(coalesce(p_sent, '{}')));
  delete from push_device where business_id = c.business_id and endpoint = any(coalesce(p_gone, '{}'));
  get diagnostics v_gone = row_count;
  return jsonb_build_object('sent', v_sent, 'gone', v_gone);
end $$;

-- -----------------------------------------------------------------------------
-- 9. The timer: every five minutes (where the database has one)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sixties-phone-warnings';
    perform cron.schedule('sixties-phone-warnings', '*/5 * * * *', 'select public.push_tick()');
  end if;
exception when others then
  raise notice 'Phone warnings: the timer could not be set (%)', sqlerrm;
end $$;

-- -----------------------------------------------------------------------------
-- 10. Who may call what
-- -----------------------------------------------------------------------------
revoke execute on function member_has_permission(uuid, text), push_can_send(), push_queue(uuid), push_kick(uuid),
  push_tick(), turn_on_phone_warnings__run(text, text, text), turn_off_phone_warnings__run(),
  save_push_device__run(text, text, text, text, boolean)
  from public, anon, authenticated;
revoke execute on function phone_warnings(text), turn_on_phone_warnings(text, text, text, uuid),
  turn_off_phone_warnings(uuid), save_push_device(text, text, text, text, boolean, uuid), remove_push_device(text),
  send_test_warning(text), push_take(text), push_done(text, bigint[], text[])
  from public, anon;
grant execute on function phone_warnings(text), turn_on_phone_warnings(text, text, text, uuid),
  turn_off_phone_warnings(uuid), save_push_device(text, text, text, text, boolean, uuid), remove_push_device(text),
  send_test_warning(text)
  to authenticated;
-- The app's address calls these two with no one signed in; each answers only to the secret.
grant execute on function push_take(text), push_done(text, bigint[], text[]) to anon;
grant execute on function push_take(text), push_done(text, bigint[], text[]) to authenticated;
