-- =============================================================================
-- 0097 — Where people get stuck
-- =============================================================================
-- Each time a screen is refused by the database, or someone opens its help,
-- it is noted: the screen, what was said, who, and whether it was practice.
-- The owner reads, by screen, what stops people most, so the screens that
-- trip people up are the ones made plainer. Kept 180 days.
--
-- Nothing recorded changes. Rehearsed with tests/sql/stuck.test.sql.
-- =============================================================================

create table if not exists stuck_event (
  id          bigint generated always as identity primary key,
  business_id uuid not null references business(id),
  app_user_id uuid not null references app_user(id),
  at          timestamptz not null default now(),
  path        text not null check (path ~ '^/[a-z0-9/_-]{0,80}$'),
  kind        text not null check (kind in ('refused', 'help')),
  message     text check (length(message) <= 300),
  practice    boolean not null default false
);
create index if not exists stuck_event_business_at on stuck_event (business_id, at);
alter table stuck_event enable row level security;
revoke all on stuck_event from public, anon, authenticated;

-- A screen's address as one screen: ids in it are one screen, not many.
create or replace function stuck_path(p_path text) returns text
language sql immutable as $$
  select left(regexp_replace(regexp_replace(lower(coalesce(p_path, '/')), '[?#].*$', ''),
                             '/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]+)(?=/|$)',
                             '/x', 'g'), 80)
$$;

-- (anyone) Noted: refused on a screen, or its help opened. Under the person's
-- own café, practice or not; the same note within a minute is one.
create or replace function note_stuck(p_path text, p_kind text, p_message text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := real_member_id();
  v_business uuid := (select business_id from app_user where id = v_me);
  v_path text := stuck_path(p_path);
  v_message text := nullif(left(trim(p_message), 300), '');
begin
  if v_me is null or p_kind not in ('refused', 'help') or v_path !~ '^/[a-z0-9/_-]{0,80}$' then return; end if;
  if exists (select 1 from stuck_event where app_user_id = v_me and path = v_path and kind = p_kind
                and message is not distinct from v_message and practice = practicing()
                and at > now() - interval '1 minute') then
    return;
  end if;
  insert into stuck_event (business_id, app_user_id, path, kind, message, practice)
  values (v_business, v_me, v_path, p_kind, v_message, practicing());
  delete from stuck_event where business_id = v_business and at < now() - interval '180 days';
end $$;

-- (owner) Over the last days: each screen's refusals and help opened, the
-- people and roles, and what was said most; practice apart.
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
    select jsonb_agg(s order by (s ->> 'refused')::int + (s ->> 'help')::int desc, s ->> 'path')
      from (select jsonb_build_object(
                     'path', e.path,
                     'refused', count(*) filter (where e.kind = 'refused' and not e.practice),
                     'help', count(*) filter (where e.kind = 'help' and not e.practice),
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

revoke execute on function stuck_path(text) from public, anon, authenticated;
revoke execute on function note_stuck(text, text, text), stuck_report(int) from public, anon;
grant execute on function note_stuck(text, text, text), stuck_report(int) to authenticated;
