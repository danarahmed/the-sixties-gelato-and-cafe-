-- =============================================================================
-- 0080 — Two-step sign-in (round twenty-three)
-- =============================================================================
-- The owner (or anyone) turns on a second step on their Account page: after
-- the password, a six-digit code from an authenticator app on their phone.
-- Supabase Auth keeps the app's key (auth.mfa_factors) and says in each
-- session's token whether the code was given (aal2). The app asks for the
-- code before any page; and here the database itself refuses a session that
-- has a second step but has not taken it, so a password alone, used against
-- the database directly, opens nothing:
--
--  * two_step_pending(): the person has a verified second step and this
--    session's token is not aal2.
--  * require_permission refuses such a session ("Finish signing in…"), and
--    current_business_id and current_has_permission give nothing, so the
--    tables' rules show nothing.
--
-- Nothing recorded changes. Nobody has a second step until they turn it on.
-- =============================================================================

create or replace function two_step_pending() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
     and exists (select 1 from auth.mfa_factors f
                  where f.user_id = auth.uid() and f.status::text = 'verified')
$$;

-- 0016's current_business_id, giving nothing to a session not signed in all the way.
create or replace function current_business_id() returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from app_user
   where auth_user_id = auth.uid() and is_active and not two_step_pending()
   limit 1
$$;

-- 0015's current_has_permission, likewise.
create or replace function current_has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select not two_step_pending() and exists (
    select 1 from app_user au
    join user_role ur on ur.app_user_id = au.id
    join role_permission rp on rp.role = ur.role
    where au.auth_user_id = auth.uid() and au.is_active and rp.permission = p_permission
  )
$$;

-- 0015's require_permission: a session with its second step to take is told so.
create or replace function require_permission(variadic p_any text[]) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare m app_user; p text;
begin
  m := current_member();
  if m.id is null then
    raise exception 'Sign in to continue' using errcode = '28000';
  end if;
  if two_step_pending() then
    raise exception 'Finish signing in: type the code from your authenticator app' using errcode = '28000';
  end if;
  foreach p in array p_any loop
    if current_has_permission(p) then return m.business_id; end if;
  end loop;
  raise exception 'You do not have permission to do this (needs %)', array_to_string(p_any, ' or ')
    using errcode = '42501';
end $$;

revoke execute on function two_step_pending() from public, anon, authenticated;
