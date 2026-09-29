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

-- Supabase Storage, as far as the migrations use it (0053): the buckets and
-- the objects in them, owned by the storage service's own role with row-level
-- security on, and the helper its rules use to read a path's folders. The
-- files themselves live outside the database; here only their rows. On
-- Supabase the migrations' role may add rules to storage.objects and buckets
-- to storage.buckets; the membership below gives sb_admin the same.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') then
    create role supabase_storage_admin nologin noinherit bypassrls;
  end if;
end $$;
create schema if not exists storage authorization supabase_storage_admin;
grant usage on schema storage to anon, authenticated, service_role, sb_admin;
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create table if not exists storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets (id),
  name             text,
  owner            uuid,
  owner_id         text,
  metadata         jsonb,
  user_metadata    jsonb,
  version          text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.buckets owner to supabase_storage_admin;
alter table storage.objects owner to supabase_storage_admin;
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant select on storage.buckets to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
alter function storage.foldername(text) owner to supabase_storage_admin;
grant execute on function storage.foldername(text) to public;
grant supabase_storage_admin to sb_admin;
