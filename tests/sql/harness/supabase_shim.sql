-- =============================================================================
-- Local-only stand-in for the parts of Supabase the migrations depend on.
--
-- Loaded into a scratch PostgreSQL database BEFORE the migrations, so they run
-- unmodified. Never apply this to a real Supabase project: there the `auth`
-- schema and these roles already exist and are managed by the platform.
--
-- auth.uid() is implemented exactly as Supabase does: it reads the `sub` claim
-- from the request's JWT claims, which PostgREST places in a session setting.
-- Tests impersonate a caller with:
--     set role authenticated;
--     select set_config('request.jwt.claims', '{"sub":"<uuid>"}', false);
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- Supabase installs extensions into their own schema, ahead of migrations.
create schema if not exists extensions;
create extension if not exists pgcrypto   with schema extensions;
create extension if not exists citext     with schema extensions;
create extension if not exists btree_gist with schema extensions;
grant usage on schema extensions to public;

-- The role migrations run as. On Supabase, `postgres` is NOT a superuser, but
-- it bypasses row-level security, which is what makes SECURITY DEFINER
-- functions work on FORCE RLS tables. Running the migrations as a role shaped
-- the same way (instead of as a local superuser) means anything that would
-- only work with superuser rights fails here, not in production.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sb_admin') then
    create role sb_admin login nosuperuser bypassrls;
  end if;
  execute format('grant create on database %I to sb_admin', current_database());
end $$;
grant anon, authenticated, service_role to sb_admin;
alter schema public owner to sb_admin;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id                 uuid primary key,
  email              text,
  email_confirmed_at timestamptz default now()
);
grant usage on schema auth to sb_admin;
grant select, references, trigger on auth.users to sb_admin;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant execute on function auth.uid(), auth.role() to public;
