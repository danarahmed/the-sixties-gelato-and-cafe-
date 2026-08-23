-- =============================================================================
-- 0006_accounting.sql — double-entry management ledger (spec §11).
-- Configurable chart of accounts, balanced journal entries, period locking,
-- expenses. Posting is append-only; corrections are reversing entries.
-- =============================================================================

create type account_type as enum ('asset','liability','equity','revenue','expense');
create type normal_balance as enum ('debit','credit');

create table gl_account (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  code          text not null,
  name          text not null,
  account_type  account_type not null,
  normal_balance normal_balance not null,
  is_active     boolean not null default true,
  unique (business_id, code)
);

create type period_status as enum ('open','locked');

create table accounting_period (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  name         text not null,            -- e.g. '2026-08'
  starts_on    date not null,
  ends_on      date not null,
  status       period_status not null default 'open',
  locked_by    uuid references app_user(id),
  locked_at    timestamptz,
  unique (business_id, name)
);

create table journal_entry (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business(id) on delete cascade,
  period_id      uuid references accounting_period(id),
  description    text not null,
  reference_type text,
  reference_id   uuid,
  occurred_at    timestamptz not null default now(),
  posted_by      uuid references app_user(id),
  reverses_entry uuid references journal_entry(id),
  created_at     timestamptz not null default now()
);
create index on journal_entry (business_id, occurred_at);

create table journal_line (
  id               uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entry(id) on delete cascade,
  account_id       uuid not null references gl_account(id),
  debit            numeric not null default 0 check (debit >= 0),
  credit           numeric not null default 0 check (credit >= 0),
  memo             text,
  check (not (debit > 0 and credit > 0))   -- a line is debit XOR credit
);
create index on journal_line (journal_entry_id);

-- Enforce balanced entries: after a change to an entry's lines, debits=credits.
create or replace function assert_entry_balanced() returns trigger
language plpgsql as $$
declare
  eid uuid := coalesce(NEW.journal_entry_id, OLD.journal_entry_id);
  d numeric;
  c numeric;
begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into d, c
  from journal_line where journal_entry_id = eid;
  -- Allow transient zero-line state during construction; only reject imbalance
  -- once there is at least one line.
  if (d <> c) then
    raise exception 'Journal entry % is unbalanced: debit % <> credit %', eid, d, c;
  end if;
  return null;
end;
$$;

-- Deferred constraint trigger so multi-line inserts within a transaction are
-- checked once at COMMIT, not after each line.
create constraint trigger journal_line_balance_check
  after insert or update or delete on journal_line
  deferrable initially deferred
  for each row execute function assert_entry_balanced();

-- Block posting into a locked period.
create or replace function forbid_locked_period() returns trigger
language plpgsql as $$
declare st period_status;
begin
  if NEW.period_id is not null then
    select status into st from accounting_period where id = NEW.period_id;
    if st = 'locked' then
      raise exception 'Accounting period is locked; cannot post entry';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger journal_entry_period_guard
  before insert on journal_entry
  for each row execute function forbid_locked_period();

-- ---------------------------------------------------------------------------
-- Expenses (spec §11)
-- ---------------------------------------------------------------------------
create table expense_category (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  name         text not null,
  gl_account_id uuid references gl_account(id)
);

create table expense (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  category_id   uuid references expense_category(id),
  location_id   uuid references location(id),
  amount        numeric not null check (amount >= 0),
  incurred_on   date not null default current_date,
  description   text,
  journal_entry_id uuid references journal_entry(id),
  created_by    uuid references app_user(id),
  created_at    timestamptz not null default now()
);
