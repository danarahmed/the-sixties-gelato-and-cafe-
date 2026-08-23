-- =============================================================================
-- 0001_core.sql — extensions, org structure, users/roles, audit log
-- The Sixty's Gelato & Café
--
-- Conventions:
--   * All money and quantities are NUMERIC (exact). Never float/double.
--   * All timestamps are timestamptz, stored in UTC.
--   * Every business table carries business_id for multi-tenant isolation and
--     to keep this project's data separate from anything else.
-- =============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";         -- case-insensitive text

-- ---------------------------------------------------------------------------
-- Business (tenant) and configurable defaults
-- ---------------------------------------------------------------------------
create table business (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  -- Currency + precision are configurable (spec §1). IQD default, 0 decimals.
  currency_code     text not null default 'IQD',
  currency_symbol   text not null default 'IQD',
  currency_decimals smallint not null default 0 check (currency_decimals between 0 and 6),
  timezone          text not null default 'Asia/Baghdad',
  default_locale    text not null default 'en' check (default_locale in ('en','ar','ckb')),
  -- Prevent negative stock when true (spec §6 configurable prevention).
  prevent_negative_stock boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Locations: branches, warehouses, central production kitchen
-- ---------------------------------------------------------------------------
create type location_kind as enum ('branch', 'warehouse', 'central_kitchen');

create table location (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  kind         location_kind not null,
  name         text not null,
  name_ar      text,
  name_ckb     text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on location (business_id);

-- ---------------------------------------------------------------------------
-- App users mapped to auth (Supabase auth.users) + roles
-- ---------------------------------------------------------------------------
create type app_role as enum (
  'owner','general_manager','branch_manager','cashier','barista',
  'inventory_counter','purchasing','accountant','auditor'
);

-- One profile row per authenticated user. auth_user_id links to Supabase auth.
create table app_user (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  auth_user_id  uuid unique,                 -- references auth.users(id) in Supabase
  full_name     text not null,
  email         citext,
  -- Optional numeric PIN (hashed) for fast POS user switching on a shared device.
  pin_hash      text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on app_user (business_id);

-- A user may hold a role globally (location_id null) or scoped to a location.
create table user_role (
  id           uuid primary key default gen_random_uuid(),
  app_user_id  uuid not null references app_user(id) on delete cascade,
  role         app_role not null,
  location_id  uuid references location(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (app_user_id, role, location_id)
);

-- ---------------------------------------------------------------------------
-- Immutable audit log (spec §4): who / what / when / device / reason
-- ---------------------------------------------------------------------------
create table audit_log (
  id            bigint generated always as identity primary key,
  business_id   uuid not null references business(id) on delete cascade,
  app_user_id   uuid references app_user(id),
  action        text not null,               -- e.g. 'sale.void', 'inventory.adjust.approve'
  entity_type   text not null,
  entity_id     text,
  device_id     text,
  reason        text,
  before_state  jsonb,
  after_state   jsonb,
  occurred_at   timestamptz not null default now()
);
create index on audit_log (business_id, occurred_at);
create index on audit_log (entity_type, entity_id);

-- Forbid updates/deletes on the audit log: it is append-only.
create or replace function forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'Table % is append-only; % is not permitted', TG_TABLE_NAME, TG_OP;
end;
$$;

create trigger audit_log_immutable
  before update or delete on audit_log
  for each row execute function forbid_mutation();
