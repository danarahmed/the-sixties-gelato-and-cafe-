-- =============================================================================
-- 0083 — "Something's wrong" (G5)
-- =============================================================================
-- Whoever is signed in, on any screen, says in a word or two what went wrong.
-- The screen and what the app knew then (the page, the till, the connection,
-- the last error it saw) are kept with it, so it can be put right without
-- asking. The owner and the managers see the list, mark each one dealt with,
-- and can copy one to send on.
--
--  * problem_report: what was said, where, by whom, when, and what the app
--    knew; open until someone marks it dealt with, with a note.
--  * report_problem: anyone signed in; keyed, so a report sent twice is one.
--  * problem_reports: the list, newest first (those who see the audit trail
--    or change the settings).
--  * settle_problem: marked dealt with, or opened again, with a note.
--
-- Nothing recorded changes.
-- =============================================================================

create table if not exists problem_report (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business (id) on delete cascade,
  location_id   uuid references location (id),
  reported_by   uuid references app_user (id),
  page          text not null,
  what          text not null,
  context       jsonb not null default '{}'::jsonb,
  status        text not null default 'open',
  note          text,
  settled_by    uuid references app_user (id),
  settled_at    timestamptz,
  created_at    timestamptz not null default now(),
  constraint problem_report_what check (length(trim(what)) between 2 and 500),
  constraint problem_report_page check (length(page) between 1 and 200),
  constraint problem_report_status check (status in ('open', 'done')),
  constraint problem_report_note check (note is null or length(note) <= 300)
);
create index if not exists problem_report_open on problem_report (business_id, created_at desc)
  where status = 'open';

alter table problem_report enable row level security;
alter table problem_report force row level security;
drop policy if exists problem_read on problem_report;
create policy problem_read on problem_report for select to authenticated
  using (business_id = (select current_business_id())
         and ((select current_has_permission('audit.view')) or (select current_has_permission('settings.manage'))));
grant select on problem_report to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Saying what went wrong
-- -----------------------------------------------------------------------------
create or replace function report_problem(p_page text, p_what text, p_context jsonb default '{}'::jsonb,
  p_location uuid default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m app_user := current_member();
  v_req jsonb := jsonb_build_object('page', p_page, 'what', p_what, 'location', p_location);
  v jsonb; v_id uuid := gen_random_uuid(); v_what text := btrim(coalesce(p_what, ''));
  v_context jsonb := case when jsonb_typeof(p_context) = 'object' then p_context else '{}'::jsonb end;
begin
  if m.id is null then raise exception 'Sign in to continue' using errcode = '28000'; end if;
  v := idem_begin(m.business_id, p_idempotency_key, 'report_problem', v_req);
  if v is not null then return v; end if;
  if length(v_what) < 2 then raise exception 'Say in a word or two what went wrong'; end if;
  if length(v_what) > 500 then raise exception 'At most 500 letters'; end if;
  -- What the app knew is kept small: a page of it at most.
  if length(v_context::text) > 4000 then v_context := jsonb_build_object('cut', true); end if;
  insert into problem_report (id, business_id, location_id, reported_by, page, what, context)
  values (v_id, m.business_id,
          (select id from location where id = p_location and business_id = m.business_id),
          m.id, left(coalesce(nullif(btrim(p_page), ''), '/'), 200), v_what, v_context);
  v := jsonb_build_object('report_id', v_id);
  perform idem_finish(m.business_id, p_idempotency_key, 'report_problem', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 2. The list, and dealing with one
-- -----------------------------------------------------------------------------
create or replace function problem_reports(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('audit.view', 'settings.manage');
begin
  return jsonb_build_object(
    'open', (select count(*) from problem_report where business_id = v_business and status = 'open'),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'page', r.page, 'what', r.what, 'context', r.context, 'status', r.status,
               'note', r.note, 'created_at', r.created_at,
               'by', (select u.full_name from app_user u where u.id = r.reported_by),
               'place', (select l.name from location l where l.id = r.location_id),
               'settled_by', (select u.full_name from app_user u where u.id = r.settled_by),
               'settled_at', r.settled_at)
             order by r.status = 'done', r.created_at desc)
        from (select * from problem_report
               where business_id = v_business and (p_status is null or status = p_status)
               order by status = 'done', created_at desc limit 200) r), '[]'::jsonb));
end $$;

create or replace function settle_problem(p_report uuid, p_done boolean default true, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('audit.view', 'settings.manage');
  v_me uuid := (current_member()).id; r problem_report; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into r from problem_report where id = p_report and business_id = v_business for update;
  if not found then raise exception 'That report is not here'; end if;
  if v_note is not null and length(v_note) > 300 then raise exception 'A note is at most 300 letters'; end if;
  update problem_report
     set status = case when p_done then 'done' else 'open' end,
         note = coalesce(v_note, note),
         settled_by = case when p_done then v_me end,
         settled_at = case when p_done then now() end
   where id = r.id;
  perform audit_event(v_business, case when p_done then 'problem.done' else 'problem.reopen' end,
    'problem_report', r.id::text, null, null, jsonb_build_object('what', r.what, 'note', v_note));
  return jsonb_build_object('report_id', r.id, 'status', case when p_done then 'done' else 'open' end);
end $$;

revoke execute on function report_problem(text, text, jsonb, uuid, uuid) from public, anon;
grant execute on function report_problem(text, text, jsonb, uuid, uuid) to authenticated;
revoke execute on function problem_reports(text) from public, anon;
grant execute on function problem_reports(text) to authenticated;
revoke execute on function settle_problem(uuid, boolean, text) from public, anon;
grant execute on function settle_problem(uuid, boolean, text) to authenticated;
