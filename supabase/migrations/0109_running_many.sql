-- 0109: running many businesses (plan 9, the technical rest). The owner
-- (12 November): one shared system; the administrators' console, every
-- business on one page; "report a problem" reaching the system's support with
-- the screen, the time and the error; support access only with the business's
-- permission, recorded; a pilot group that has a new part a few days before
-- the rest; a business that stops paying has 7 days' grace, then the system is
-- read-only, then closed; its data can be exported at any time.
--
-- How it is kept:
--   * business.pilot: in the pilot group. A part marked "pilot" in the
--     catalogue is on only for the pilot group until it is released.
--   * business.paid_until and business.closed_at: paid until a day (none: no
--     end, as The Sixty's); up to 7 days after it, grace (the screens say so);
--     then read-only (only the permissions that read are held); closed by an
--     administrator: nothing but signing in and the export.
--   * support_grant: the owner gives the system's support access for 1 to 72
--     hours, with why, and may take it back. While it lasts, an administrator
--     may look at the business as "System support", a read-only member of it
--     (the auditor's role); each visit is on the business's audit trail and in
--     support_visit. When it runs out, the administrator is simply themselves
--     again.
--   * problem_report.for_support: the person reporting a problem chose to send
--     it to the system's support too; only those are seen by the
--     administrators.
--   * export_business_data(): the owner's copy of the business's records, at
--     any time, closed or not.
--
-- Nothing recorded changes. Every business here is paid with no end, not in
-- the pilot group, and open.

alter table business add column if not exists pilot boolean not null default false;
alter table business add column if not exists paid_until date;
alter table business add column if not exists closed_at timestamptz;

-- -----------------------------------------------------------------------------
-- 1. Paying: grace, read-only, closed
-- -----------------------------------------------------------------------------
create or replace function subscription_state(p_business uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when b.practice_of is not null then 'active'
    when b.closed_at is not null then 'closed'
    when b.paid_until is null then 'active'
    when business_local_date(b.id, now()) <= b.paid_until then 'active'
    when business_local_date(b.id, now()) <= b.paid_until + 7 then 'grace'
    else 'read_only' end
    from business b where b.id = p_business
$$;

-- The permissions that only read: held while the system is read-only.
create or replace function permission_reads(p_permission text) returns boolean
language sql immutable set search_path = public as $$
  select p_permission in ('cost.view', 'profit.view', 'audit.view', 'cash.view_expected', 'payroll.view',
                          'customer.view', 'inventory.count.view_expected', 'ai.view')
$$;

-- 0108's require_permission: also refused while the business is read-only or closed (0109).
create or replace function require_permission(variadic p_any text[]) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare m app_user; p text; v_off text; v_state text;
begin
  m := current_member();
  if m.id is null then
    raise exception 'Sign in to continue' using errcode = '28000';
  end if;
  if two_step_pending() then
    raise exception 'Finish signing in: type the code from your authenticator app' using errcode = '28000';
  end if;
  v_state := subscription_state(m.business_id);
  if v_state = 'closed' then
    raise exception 'This business is closed. Its owner can still download its data'
      using errcode = '42501';
  end if;
  foreach p in array p_any loop
    if current_has_permission(p) and (v_state <> 'read_only' or permission_reads(p)) then
      return m.business_id;
    end if;
  end loop;
  if v_state = 'read_only' and exists (select 1 from unnest(p_any) x where current_has_permission(x)) then
    raise exception 'The payment is overdue: the system only shows what is kept until it is paid'
      using errcode = '42501';
  end if;
  -- Held by their role, but the part is off for this business (0108).
  select permission_part(x) into v_off from unnest(p_any) x
   where permission_part(x) is not null and not part_on(m.business_id, permission_part(x))
     and exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                  where ur.app_user_id = m.id and rp.permission = x)
   limit 1;
  if v_off is not null then
    raise exception '%', format('That part is off for this business: %s', part_catalogue() -> v_off ->> 'label')
      using errcode = '42501';
  end if;
  raise exception 'You do not have permission to do this (needs %)', array_to_string(p_any, ' or ')
    using errcode = '42501';
end $$;

-- -----------------------------------------------------------------------------
-- 2. The pilot group
-- -----------------------------------------------------------------------------
-- 0108's part_on: a part still being tried ("stage": "pilot") is on only for the pilot group.
create or replace function part_on(p_business uuid, p_part text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when not (part_catalogue() -> p_part -> 'plans') ? b.plan then false
      when part_catalogue() -> p_part ->> 'stage' = 'pilot' and not b.pilot then false
      else coalesce((select bp.enabled from business_part bp where bp.business_id = b.id and bp.part = p_part),
                    (part_catalogue() -> p_part -> 'on_for') ? b.business_type)
    end
      from business b where b.id = p_business), true)
$$;

-- -----------------------------------------------------------------------------
-- 3. Support access, only with the business's permission
-- -----------------------------------------------------------------------------
create table if not exists support_grant (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  granted_by  uuid not null references app_user(id),
  granted_at  timestamptz not null default now(),
  until       timestamptz not null,
  reason      text not null,
  revoked_at  timestamptz,
  revoked_by  uuid references app_user(id)
);
create index if not exists support_grant_business on support_grant (business_id, until);
alter table support_grant enable row level security;
alter table support_grant force row level security;

-- The administrator's read-only member in each business they have visited.
create table if not exists support_twin (
  auth_user_id uuid not null,
  business_id  uuid not null references business(id) on delete cascade,
  twin_id      uuid not null references app_user(id) on delete cascade,
  primary key (auth_user_id, business_id)
);
alter table support_twin enable row level security;
alter table support_twin force row level security;

create table if not exists support_visit (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  auth_user_id uuid not null,
  at           timestamptz not null default now()
);
create index if not exists support_visit_business on support_visit (business_id, at);
alter table support_visit enable row level security;
alter table support_visit force row level security;

create or replace function support_open(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from support_grant g where g.business_id = p_business and g.revoked_at is null
                    and g.until > now())
$$;

-- The business a support request is for, from its header; none when absent or not an id.
create or replace function supporting() returns uuid
language sql stable as $$
  select case when x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then x::uuid end
    from (select coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-sixties-support', '') as x) h
$$;

-- 0096's session_member_id: an administrator with the business's permission
-- acts as its read-only support member; without it, as themselves (0109).
create or replace function session_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select case
    when practicing()
      then (select t.twin_id from practice_twin t join app_user w on w.id = t.twin_id and w.is_active
             where t.app_user_id = r.id)
    when supporting() is not null
      then coalesce((select st.twin_id from support_twin st join app_user w on w.id = st.twin_id and w.is_active
                      where st.auth_user_id = auth.uid() and st.business_id = supporting()
                        and is_system_admin() and support_open(st.business_id)), r.id)
    else r.id end
    from (select real_member_id() as id) r
$$;

-- (the owner) Support access for some hours, with why.
create or replace function grant_support_access(p_hours int, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m app_user := current_member();
  v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
  g support_grant;
begin
  if m.id is null then raise exception 'Sign in to continue' using errcode = '28000'; end if;
  if not current_has_role('owner') then
    raise exception 'Only the owner gives the system''s support access' using errcode = '42501';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 72 then
    raise exception 'Support access is for 1 to 72 hours';
  end if;
  if v_reason is null or length(v_reason) < 6 then raise exception 'Say why, in a few words'; end if;
  update support_grant set revoked_at = now(), revoked_by = m.id
   where business_id = m.business_id and revoked_at is null and until > now();
  insert into support_grant (business_id, granted_by, until, reason)
  values (m.business_id, m.id, now() + make_interval(hours => p_hours), v_reason) returning * into g;
  perform audit_event(m.business_id, 'support.grant', 'business', m.business_id::text, v_reason, null,
    jsonb_build_object('until', g.until, 'hours', p_hours));
  return support_access();
end $$;

-- (the owner) Support access taken back now.
create or replace function revoke_support_access() returns jsonb
language plpgsql security definer set search_path = public as $$
declare m app_user := current_member();
begin
  if m.id is null then raise exception 'Sign in to continue' using errcode = '28000'; end if;
  if not current_has_role('owner') then
    raise exception 'Only the owner gives the system''s support access' using errcode = '42501';
  end if;
  if not support_open(m.business_id) then raise exception 'Support has no access now'; end if;
  update support_grant set revoked_at = now(), revoked_by = m.id
   where business_id = m.business_id and revoked_at is null and until > now();
  perform audit_event(m.business_id, 'support.revoke', 'business', m.business_id::text, null, null, null);
  return support_access();
end $$;

-- (the owner) Support's access now, and each visit.
create or replace function support_access() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'open_until', (select max(until) from support_grant g where g.business_id = current_business_id()
                      and g.revoked_at is null and g.until > now()),
    'grants', coalesce((select jsonb_agg(jsonb_build_object('granted_at', g.granted_at, 'until', g.until,
                          'reason', g.reason, 'revoked_at', g.revoked_at,
                          'by', (select full_name from app_user where id = g.granted_by))
                        order by g.granted_at desc)
                          from (select * from support_grant where business_id = current_business_id()
                                 order by granted_at desc limit 10) g), '[]'::jsonb),
    'visits', coalesce((select jsonb_agg(v.at order by v.at desc)
                          from (select at from support_visit where business_id = current_business_id()
                                 order by at desc limit 20) v), '[]'::jsonb))
   where current_has_role('owner')
$$;

-- (the system's administrators) Looking at a business that gave access: as
-- its read-only support member, recorded on its audit trail.
create or replace function support_enter(p_business uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_twin uuid; v_until timestamptz;
begin
  perform require_system_admin();
  select max(until) into v_until from support_grant
   where business_id = p_business and revoked_at is null and until > now();
  if v_until is null then
    raise exception 'That business has not given support access, or it has run out';
  end if;
  select twin_id into v_twin from support_twin where auth_user_id = auth.uid() and business_id = p_business;
  if v_twin is null then
    insert into app_user (business_id, full_name) values (p_business, 'System support') returning id into v_twin;
    insert into user_role (app_user_id, role, business_id) values (v_twin, 'auditor', p_business);
    insert into support_twin (auth_user_id, business_id, twin_id) values (auth.uid(), p_business, v_twin);
  else
    update app_user set is_active = true where id = v_twin;
  end if;
  insert into support_visit (business_id, auth_user_id) values (p_business, auth.uid());
  perform audit_event(p_business, 'support.enter', 'business', p_business::text, null, null,
    jsonb_build_object('until', v_until));
  return jsonb_build_object('business_id', p_business, 'until', v_until);
end $$;

-- -----------------------------------------------------------------------------
-- 4. "Report a problem", to the system's support too
-- -----------------------------------------------------------------------------
alter table problem_report add column if not exists for_support boolean not null default false;
create or replace function problem_for_support() returns trigger
language plpgsql set search_path = public as $$
begin
  new.for_support := coalesce((new.context ->> 'for_support')::boolean, false);
  return new;
exception when others then
  new.for_support := false;
  return new;
end $$;
drop trigger if exists problem_report_for_support on problem_report;
create trigger problem_report_for_support before insert on problem_report
  for each row execute function problem_for_support();

-- (the system's administrators) The problems sent to support, the open ones first.
create or replace function admin_problem_reports() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_system_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'business', b.name, 'business_id', b.id, 'page', r.page, 'what', r.what,
      'error', coalesce(r.context ->> 'lastError', r.context ->> 'error'), 'status', r.status, 'at', r.created_at,
      'by', (select full_name from app_user where id = r.reported_by))
    order by (r.status = 'open') desc, r.created_at desc)
      from (select * from problem_report where for_support order by created_at desc limit 200) r
      join business b on b.id = r.business_id), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 5. The administrators' console: every business on one page
-- -----------------------------------------------------------------------------
-- 0108's admin_businesses, with how each business is doing (0109).
create or replace function admin_businesses() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_system_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', b.id, 'name', b.name, 'plan', b.plan, 'business_type', b.business_type,
      'places', (select count(*) from location l where l.business_id = b.id),
      'people', (select count(*) from app_user u where u.business_id = b.id and u.auth_user_id is not null),
      'practice', b.practice_of is not null,
      'pilot', b.pilot, 'paid_until', b.paid_until, 'state', subscription_state(b.id),
      'last_sale_at', (select max(o.placed_at) from sales_order o where o.business_id = b.id),
      'sales_today', (select count(*) from sales_order o where o.business_id = b.id and o.status <> 'open'
                        and o.placed_at >= (business_local_date(b.id, now())::timestamp at time zone b.timezone)),
      'errors_today', (select count(*) from stuck_event e where e.business_id = b.id and e.kind = 'error'
                         and e.at > now() - interval '24 hours'),
      'tills_waiting', (select count(*) from till_kept k where k.business_id = b.id and k.waiting > 0),
      'problems_open', (select count(*) from problem_report r where r.business_id = b.id and r.for_support
                          and r.status = 'open'),
      'support_until', (select max(until) from support_grant g where g.business_id = b.id
                          and g.revoked_at is null and g.until > now()))
    order by b.practice_of is not null, b.name) from business b), '[]'::jsonb);
end $$;

-- (the system's administrators) Paid until a day (none: no end), with why.
create or replace function set_business_paid_until(p_business uuid, p_paid_until date, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_before date; v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
begin
  perform require_system_admin();
  if v_reason is null or length(v_reason) < 6 then raise exception 'Say why, in a few words'; end if;
  if not exists (select 1 from business where id = p_business) then raise exception 'That business is not found'; end if;
  select paid_until into v_before from business where id = p_business;
  update business set paid_until = p_paid_until where id = p_business;
  perform audit_event(p_business, 'business.paid_until', 'business', p_business::text, v_reason,
    jsonb_build_object('paid_until', v_before), jsonb_build_object('paid_until', p_paid_until));
  return admin_businesses();
end $$;

-- (the system's administrators) In the pilot group or not, with why.
create or replace function set_business_pilot(p_business uuid, p_pilot boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
begin
  perform require_system_admin();
  if p_pilot is null then raise exception 'Choose on or off'; end if;
  if v_reason is null or length(v_reason) < 6 then raise exception 'Say why, in a few words'; end if;
  if not exists (select 1 from business where id = p_business) then raise exception 'That business is not found'; end if;
  update business set pilot = p_pilot where id = p_business;
  perform audit_event(p_business, 'business.pilot', 'business', p_business::text, v_reason, null,
    jsonb_build_object('pilot', p_pilot));
  return admin_businesses();
end $$;

-- (the system's administrators) Closed, or opened again, with why. Nothing is deleted.
create or replace function set_business_closed(p_business uuid, p_closed boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
begin
  perform require_system_admin();
  if p_closed is null then raise exception 'Choose on or off'; end if;
  if v_reason is null or length(v_reason) < 6 then raise exception 'Say why, in a few words'; end if;
  if not exists (select 1 from business where id = p_business) then raise exception 'That business is not found'; end if;
  update business set closed_at = case when p_closed then coalesce(closed_at, now()) end where id = p_business;
  perform audit_event(p_business, case when p_closed then 'business.close' else 'business.reopen' end, 'business',
    p_business::text, v_reason, null, null);
  return admin_businesses();
end $$;

-- -----------------------------------------------------------------------------
-- 6. The profile says how paying stands and whose support view it is
-- -----------------------------------------------------------------------------
alter function my_profile() rename to my_profile_0108;
create or replace function my_profile() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb := my_profile_0108(); b business; v_state text;
begin
  if v is null then return null; end if;
  select * into b from business where id = (v ->> 'business_id')::uuid;
  v_state := subscription_state(b.id);
  return v || jsonb_build_object(
    -- Read-only: only the permissions that read are held (0109).
    'permissions', case when v_state in ('read_only', 'closed')
                        then coalesce((select jsonb_agg(p order by p) from jsonb_array_elements_text(v -> 'permissions') p
                                        where permission_reads(p) or p like 'off:%'), '[]'::jsonb)
                        else v -> 'permissions' end,
    'subscription', jsonb_build_object('state', v_state, 'paid_until', b.paid_until,
                                       'grace_left', case when v_state = 'grace'
                                         then b.paid_until + 7 - business_local_date(b.id, now()) end),
    'support', session_member_id() is distinct from real_member_id() and not practicing());
end $$;
grant execute on function my_profile() to authenticated;

-- -----------------------------------------------------------------------------
-- 7. The business's data, for its owner, at any time
-- -----------------------------------------------------------------------------
create or replace function export_business_data() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := current_business_id();
begin
  if v_business is null then raise exception 'Sign in to continue' using errcode = '28000'; end if;
  if not current_has_role('owner') or session_member_id() is distinct from real_member_id() then
    raise exception 'Only the owner exports the business''s data' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'business', (select to_jsonb(b) - 'practice_of' from business b where b.id = v_business),
    'places', (select coalesce(jsonb_agg(to_jsonb(l)), '[]') from location l where l.business_id = v_business),
    'accounts', (select coalesce(jsonb_agg(to_jsonb(g)), '[]') from gl_account g where g.business_id = v_business),
    'categories', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from product_category c where c.business_id = v_business),
    'products', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from product p where p.business_id = v_business),
    'sizes', (select coalesce(jsonb_agg(to_jsonb(v)), '[]') from product_variant v
               join product p on p.id = v.product_id where p.business_id = v_business),
    'prices', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from channel_price x where x.business_id = v_business),
    'items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from item i where i.business_id = v_business),
    'suppliers', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from supplier s where s.business_id = v_business),
    'customers', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from customer c where c.business_id = v_business),
    'people', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'name', u.full_name, 'active', u.is_active)), '[]')
                 from app_user u where u.business_id = v_business),
    'sales', (select coalesce(jsonb_agg(to_jsonb(o)), '[]') from sales_order o where o.business_id = v_business),
    'sale_lines', (select coalesce(jsonb_agg(to_jsonb(l)), '[]') from sales_order_line l
                    join sales_order o on o.id = l.sales_order_id where o.business_id = v_business),
    'stock_movements', (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from inventory_movement m
                         where m.business_id = v_business),
    'journals', (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from journal_entry e where e.business_id = v_business),
    'journal_lines', (select coalesce(jsonb_agg(to_jsonb(l)), '[]') from journal_line l
                       join journal_entry e on e.id = l.journal_entry_id where e.business_id = v_business));
end $$;

revoke execute on function subscription_state(uuid), permission_reads(text), support_open(uuid), supporting(),
  problem_for_support(), my_profile_0108() from public, anon, authenticated;
revoke execute on function grant_support_access(int, text), revoke_support_access(), support_access(),
  support_enter(uuid), admin_problem_reports(), set_business_paid_until(uuid, date, text),
  set_business_pilot(uuid, boolean, text), set_business_closed(uuid, boolean, text), export_business_data()
  from public, anon;
grant execute on function grant_support_access(int, text), revoke_support_access(), support_access(),
  support_enter(uuid), admin_problem_reports(), set_business_paid_until(uuid, date, text),
  set_business_pilot(uuid, boolean, text), set_business_closed(uuid, boolean, text), export_business_data()
  to authenticated;
