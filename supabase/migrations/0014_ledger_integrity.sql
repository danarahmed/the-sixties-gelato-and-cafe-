-- =============================================================================
-- 0014_ledger_integrity.sql — make the books tamper-evident at the database.
--
-- Closes the database-level findings of the August 2026 audit, every one of
-- which was reproduced against real PostgreSQL before this was written
-- (tests/sql/harness/reproduce_audit.sql):
--
--   C-02  published journals could be edited, demoted, rewritten and deleted
--   C-05  no goods-received-not-invoiced account (receipt + bill double count)
--   C-07  the period lock was bypassable four ways
--   H-02  journal numbering collided (NULLS FIRST) and raced
--   H-06  child tables had no tenant column, so RLS could not isolate them
--   H-10  stock_board hid negative stock and negative value behind abs()
--   H-11  auto-posted journals could be duplicated; bills overpaid under a race
--   L-01  a published journal could have zero lines
--   L-02  a completed sale's COGS, lines and tenders could be rewritten
--   M-05  no retained earnings; M-06 incomplete chart; M-07 duplicate invoices
--
-- The rule that makes the journal controls airtight: a journal entry is born a
-- DRAFT, receives its lines, then is PUBLISHED. Lines may only be written while
-- their entry is a draft, and a published entry can never change again. There
-- is no path that attaches lines to, or edits, a published entry.
--
-- Records that already exist are marked `legacy`: they were posted under the
-- old, unenforced rules. They are kept exactly as they are (history is not
-- rewritten) and listed for review by docs/REMEDIATION.md.
-- =============================================================================

-- Into Supabase's extensions schema, where it belongs.
create extension if not exists btree_gist with schema extensions;

-- =============================================================================
-- 1. Helpers
-- =============================================================================

-- The calendar date of a moment in the business's own timezone. Every period
-- and trading-day boundary goes through this (audit H-09).
create or replace function business_local_date(p_business uuid, p_at timestamptz)
returns date language sql stable as $$
  select (p_at at time zone coalesce(
    (select timezone from business where id = p_business), 'UTC'))::date
$$;

-- The monthly accounting period containing a date; created (open) if missing.
create or replace function ensure_period(p_business uuid, p_date date)
returns uuid language plpgsql as $$
declare
  v_start date := date_trunc('month', p_date)::date;
  v_id uuid;
begin
  select id into v_id from accounting_period
   where business_id = p_business and p_date between starts_on and ends_on;
  if v_id is not null then return v_id; end if;

  insert into accounting_period (business_id, name, starts_on, ends_on, status)
  values (p_business, to_char(v_start, 'YYYY-MM'), v_start,
          (v_start + interval '1 month - 1 day')::date, 'open')
  on conflict (business_id, name) do nothing;

  select id into v_id from accounting_period
   where business_id = p_business and p_date between starts_on and ends_on;
  return v_id;
end $$;

-- Gapless, concurrency-safe document numbers. The counter row is locked by the
-- UPDATE, so concurrent callers queue; a rolled-back caller rolls its number
-- back too, so published journals number without gaps (audit H-02).
create table if not exists document_counter (
  business_id uuid not null references business(id) on delete cascade,
  doc_type    text not null,
  next_no     bigint not null,
  primary key (business_id, doc_type)
);

create or replace function next_document_no(p_business uuid, p_type text, p_start bigint default 1001)
returns bigint language plpgsql as $$
declare v bigint;
begin
  update document_counter set next_no = next_no + 1
   where business_id = p_business and doc_type = p_type
  returning next_no - 1 into v;
  if v is null then
    insert into document_counter (business_id, doc_type, next_no)
    values (p_business, p_type, p_start + 1)
    on conflict (business_id, doc_type) do update set next_no = document_counter.next_no + 1
    returning next_no - 1 into v;
  end if;
  return v;
end $$;

-- Append to the immutable audit trail as the calling person (audit M-03).
create or replace function audit_event(
  p_business uuid, p_action text, p_entity_type text, p_entity_id text,
  p_reason text default null, p_before jsonb default null, p_after jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (business_id, app_user_id, action, entity_type, entity_id, reason, before_state, after_state)
  values (p_business, current_app_user_id(), p_action, p_entity_type, p_entity_id, p_reason, p_before, p_after);
end $$;

-- =============================================================================
-- 2. Chart of accounts: complete, and provisioned for every business
--    (audit C-05, M-05, M-06). Existing accounts are never altered.
-- =============================================================================
alter table gl_account add column if not exists is_system boolean not null default false;

create or replace function provision_chart_of_accounts(p_business uuid)
returns void language plpgsql as $$
begin
  insert into gl_account (business_id, code, name, account_type, normal_balance, is_system)
  select p_business, a.code, a.name, a.t::account_type, a.nb::normal_balance, true
  from (values
    ('1000','Cash on hand',               'asset',     'debit'),
    ('1010','Card clearing',              'asset',     'debit'),
    ('1020','Bank',                       'asset',     'debit'),
    ('1100','Platform receivable',        'asset',     'debit'),
    ('1200','Inventory',                  'asset',     'debit'),
    ('1500','Equipment',                  'asset',     'debit'),
    ('1590','Accumulated depreciation',   'asset',     'credit'),
    ('2000','Accounts payable',           'liability', 'credit'),
    ('2050','Goods received not invoiced','liability', 'credit'),
    ('3000','Owner equity',               'equity',    'credit'),
    ('3100','Retained earnings',          'equity',    'credit'),
    ('3200','Owner drawings',             'equity',    'debit'),
    ('4000','Sales revenue',              'revenue',   'credit'),
    ('4100','Merchant-funded discount',   'revenue',   'debit'),
    ('4200','Sales returns & refunds',    'revenue',   'debit'),
    ('5000','Cost of goods sold',         'expense',   'debit'),
    ('5050','Purchase price variance',    'expense',   'debit'),
    ('5100','Platform commission',        'expense',   'debit'),
    ('5200','Platform fees',              'expense',   'debit'),
    ('5300','Waste & spoilage',           'expense',   'debit'),
    ('5400','Inventory count variance',   'expense',   'debit'),
    ('6000','Rent',                       'expense',   'debit'),
    ('6100','Salaries',                   'expense',   'debit'),
    ('6200','Utilities',                  'expense',   'debit'),
    ('6300','Cash over / short',          'expense',   'debit'),
    ('6400','Depreciation',               'expense',   'debit'),
    ('6900','Other expenses',             'expense',   'debit')
  ) as a(code, name, t, nb)
  on conflict (business_id, code) do update set is_system = true;
end $$;

create or replace function trg_business_provision() returns trigger
language plpgsql as $$
begin
  perform provision_chart_of_accounts(NEW.id);
  return NEW;
end $$;

drop trigger if exists business_provision_accounts on business;
create trigger business_provision_accounts
  after insert on business
  for each row execute function trg_business_provision();

select provision_chart_of_accounts(id) from business;

-- A system account carries postings the application depends on: it can be
-- renamed but never deleted, re-typed or re-coded.
create or replace function trg_gl_account_guard() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.is_system or exists (select 1 from journal_line where account_id = OLD.id) then
      raise exception 'Account % is in use and cannot be deleted; deactivate it instead', OLD.code;
    end if;
    return OLD;
  end if;
  if OLD.is_system and (NEW.code, NEW.account_type, NEW.normal_balance, NEW.business_id)
       is distinct from (OLD.code, OLD.account_type, OLD.normal_balance, OLD.business_id) then
    raise exception 'System account % may be renamed but not re-coded or re-typed', OLD.code;
  end if;
  if not NEW.is_active and OLD.is_system then
    raise exception 'System account % cannot be deactivated', OLD.code;
  end if;
  return NEW;
end $$;

drop trigger if exists gl_account_guard on gl_account;
create trigger gl_account_guard
  before update or delete on gl_account
  for each row execute function trg_gl_account_guard();

-- =============================================================================
-- 3. Tenant column on every child table (audit H-06). Filled from the parent
--    on insert and checked, so it can neither be omitted nor spoofed.
-- =============================================================================
create or replace function trg_inherit_business_id() returns trigger
language plpgsql as $$
declare
  v_parent_id uuid := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
  v_business uuid;
begin
  if v_parent_id is null then
    if NEW.business_id is null then
      raise exception '%.%: cannot determine the business (no %)', TG_TABLE_NAME, 'business_id', TG_ARGV[1];
    end if;
    return NEW;
  end if;
  execute format('select business_id from %I where id = $1', TG_ARGV[0])
     into v_business using v_parent_id;
  if NEW.business_id is not null and NEW.business_id is distinct from v_business then
    raise exception '%: business_id does not match its parent %', TG_TABLE_NAME, TG_ARGV[0];
  end if;
  NEW.business_id := v_business;
  return NEW;
end $$;

do $$
declare
  r record;
  -- (child, parent, parent_fk). Parents that are themselves children come
  -- first, so their business_id is populated before their children read it.
  pairs text[][] := array[
    ['goods_receipt_line',       'goods_receipt',       'goods_receipt_id'],
    ['item_unit',                'item',                'item_id'],
    ['journal_line',             'journal_entry',       'journal_entry_id'],
    ['platform_product_map',     'delivery_platform',   'platform_id'],
    ['platform_settlement_line', 'platform_settlement', 'settlement_id'],
    ['platform_store_map',       'delivery_platform',   'platform_id'],
    ['product_variant',          'product',             'product_id'],
    ['purchase_order_line',      'purchase_order',      'purchase_order_id'],
    ['recipe_version',           'recipe',              'recipe_id'],
    ['reconciliation_issue',     'platform_settlement', 'settlement_id'],
    ['sales_order_line',         'sales_order',         'sales_order_id'],
    ['sales_tender',             'sales_order',         'sales_order_id'],
    ['stock_count_line',         'stock_count',         'stock_count_id'],
    ['user_role',                'app_user',            'app_user_id'],
    ['recipe_line',              'recipe_version',      'recipe_version_id'],
    ['variant_recipe',           'product_variant',     'product_variant_id']
  ];
  i int;
  c text; p text; fk text;
begin
  for i in 1 .. array_length(pairs, 1) loop
    c := pairs[i][1]; p := pairs[i][2]; fk := pairs[i][3];
    execute format('alter table %I add column if not exists business_id uuid', c);
    execute format('update %I x set business_id = y.business_id from %I y where y.id = x.%I and x.business_id is null', c, p, fk);
    -- The UPDATE queues deferred balance checks on journal_line; PostgreSQL
    -- refuses ALTER TABLE while events are pending, so flush them first.
    set constraints all immediate;
    execute format('alter table %I alter column business_id set not null', c);
    execute format('alter table %I drop constraint if exists %I', c, c || '_business_fk');
    execute format('alter table %I add constraint %I foreign key (business_id) references business(id) on delete cascade', c, c || '_business_fk');
    execute format('create index if not exists %I on %I (business_id)', c || '_business_idx', c);
    execute format('drop trigger if exists inherit_business_id on %I', c);
    execute format('create trigger inherit_business_id before insert or update of business_id, %I on %I for each row execute function trg_inherit_business_id(%L, %L)', fk, c, p, fk);
  end loop;
end $$;

-- =============================================================================
-- 4. Journal: periods, numbering, legacy marker (audit C-07, H-02)
-- =============================================================================
-- Rows that exist now were posted before any of these controls; mark them.
-- ADD COLUMN ... DEFAULT true stamps existing rows without an UPDATE; new rows
-- then default to false, and the insert trigger forces false regardless.
alter table journal_entry add column if not exists legacy boolean not null default true;
alter table journal_entry alter column legacy set default false;

-- Every legacy entry gets the period its date falls in.
update journal_entry je
   set period_id = ensure_period(je.business_id, business_local_date(je.business_id, je.occurred_at))
 where je.period_id is null;
set constraints all immediate;
alter table journal_entry alter column period_id set not null;

-- Number the published legacy entries the old code left unnumbered, then
-- start each business's counter after its highest number.
with numbered as (
  select id, business_id,
         coalesce((select max(journal_no) from journal_entry m where m.business_id = je.business_id), 1000)
           + row_number() over (partition by business_id order by occurred_at, created_at, id) as n
    from journal_entry je
   where journal_no is null and status = 'published'
)
update journal_entry je set journal_no = numbered.n from numbered where numbered.id = je.id;
set constraints all immediate;

insert into document_counter (business_id, doc_type, next_no)
select business_id, 'journal', max(journal_no) + 1 from journal_entry where journal_no is not null group by business_id
on conflict (business_id, doc_type) do update set next_no = greatest(document_counter.next_no, excluded.next_no);

-- Periods may not overlap, and a period's identity never changes.
alter table accounting_period drop constraint if exists accounting_period_no_overlap;
alter table accounting_period add constraint accounting_period_no_overlap
  exclude using gist (business_id with =, daterange(starts_on, ends_on, '[]') with &&);
alter table accounting_period drop constraint if exists accounting_period_dates_chk;
alter table accounting_period add constraint accounting_period_dates_chk check (ends_on >= starts_on);

-- Auto-posted journals: one per source record (audit H-11). Legacy rows are
-- excluded; any duplicates among them are listed by the remediation report.
create unique index if not exists journal_entry_one_per_source
  on journal_entry (business_id, reference_type, reference_id)
  where reference_id is not null and not legacy and reverses_entry is null;

-- An entry may be reversed at most once.
create unique index if not exists journal_entry_one_reversal
  on journal_entry (reverses_entry) where reverses_entry is not null;

-- Entries are born drafts (see the header); publishing is a separate step.
alter table journal_entry alter column status set default 'draft';

alter table journal_entry drop constraint if exists journal_entry_published_numbered;
alter table journal_entry add constraint journal_entry_published_numbered
  check (status = 'draft' or journal_no is not null) not valid;

-- =============================================================================
-- 5. Journal controls (audit C-02, C-07, L-01)
-- =============================================================================
drop trigger if exists journal_entry_period_guard on journal_entry;
drop trigger if exists journal_entry_publish_guard on journal_entry;
drop function if exists assert_publish_balanced();
drop function if exists forbid_locked_period();

create or replace function period_is_locked(p_period uuid) returns boolean
language sql stable as $$
  select coalesce((select status = 'locked' from accounting_period where id = p_period), false)
$$;

create or replace function trg_journal_entry_guard() returns trigger
language plpgsql as $$
declare v_name text;
begin
  if TG_OP = 'DELETE' then
    if OLD.status <> 'draft' then
      raise exception 'Journal % is published and cannot be deleted; post a reversing entry instead', OLD.journal_no
        using errcode = 'check_violation';
    end if;
    if period_is_locked(OLD.period_id) then
      raise exception 'Accounting period is locked; this draft cannot be discarded' using errcode = 'check_violation';
    end if;
    return OLD;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.status = 'published' then
      raise exception 'Journal % is published and cannot be changed; post a reversing entry instead', OLD.journal_no
        using errcode = 'check_violation';
    end if;
    if NEW.business_id is distinct from OLD.business_id or NEW.legacy is distinct from OLD.legacy then
      raise exception 'A journal entry cannot change business or legacy status' using errcode = 'check_violation';
    end if;
    if period_is_locked(OLD.period_id) then
      raise exception 'Accounting period is locked; this draft cannot be changed' using errcode = 'check_violation';
    end if;
  else
    NEW.legacy := false;   -- nobody may create a record that dodges the controls
  end if;

  -- The period is always the one the entry's date falls in; it is never chosen.
  NEW.period_id := ensure_period(NEW.business_id, business_local_date(NEW.business_id, NEW.occurred_at));
  if period_is_locked(NEW.period_id) then
    select name into v_name from accounting_period where id = NEW.period_id;
    raise exception 'Accounting period % is locked; post into an open period or reverse in the current one', v_name
      using errcode = 'check_violation';
  end if;

  -- Who posted it is the signed-in person, never a value the caller supplies.
  NEW.posted_by := coalesce(current_app_user_id(), NEW.posted_by);

  -- Numbers belong to the database: a draft has none, and the next number in
  -- the sequence is taken at the moment of publishing. A caller can neither
  -- supply one nor reuse a gap (audit H-02).
  if NEW.status = 'draft' then
    NEW.journal_no := null;
  elsif TG_OP = 'INSERT' or OLD.status = 'draft' then
    NEW.journal_no := next_document_no(NEW.business_id, 'journal');
  end if;
  return NEW;
end $$;

drop trigger if exists journal_entry_guard on journal_entry;
create trigger journal_entry_guard
  before insert or update or delete on journal_entry
  for each row execute function trg_journal_entry_guard();

create or replace function trg_journal_line_guard() returns trigger
language plpgsql as $$
declare
  v_entry uuid := case when TG_OP = 'DELETE' then OLD.journal_entry_id else NEW.journal_entry_id end;
  v_status text;
  v_period uuid;
begin
  select status, period_id into v_status, v_period from journal_entry where id = v_entry;
  if not found then
    if TG_OP = 'DELETE' then return OLD; end if;   -- cascade from a discarded draft
    raise exception 'Journal entry % does not exist', v_entry;
  end if;
  if v_status <> 'draft' then
    raise exception 'Lines of a published journal cannot be added, changed or removed; post a reversing entry instead'
      using errcode = 'check_violation';
  end if;
  if period_is_locked(v_period) then
    raise exception 'Accounting period is locked; journal lines cannot change' using errcode = 'check_violation';
  end if;
  if TG_OP = 'UPDATE' and NEW.journal_entry_id is distinct from OLD.journal_entry_id then
    raise exception 'A journal line cannot be moved to another entry' using errcode = 'check_violation';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

drop trigger if exists journal_line_guard on journal_line;
create trigger journal_line_guard
  before insert or update or delete on journal_line
  for each row execute function trg_journal_line_guard();

-- Deferred to COMMIT: a published entry has at least two lines, debits equal
-- credits, and it moves a non-zero amount (audit L-01).
create or replace function validate_journal_entry(p_entry uuid) returns void
language plpgsql as $$
declare v_status text; v_legacy boolean; n int; d numeric; c numeric;
begin
  select status, legacy into v_status, v_legacy from journal_entry where id = p_entry;
  -- Drafts may be incomplete. Legacy entries are history posted under the old
  -- rules: immutable from here on, reported for review, never re-judged.
  if v_status is distinct from 'published' or v_legacy then return; end if;
  select count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0) into n, d, c
    from journal_line where journal_entry_id = p_entry;
  if n < 2 then
    raise exception 'Journal entry % cannot be published with % line(s); it needs at least two', p_entry, n;
  end if;
  if d <> c then
    raise exception 'Journal entry % is unbalanced: debit % <> credit %', p_entry, d, c;
  end if;
  if d = 0 then
    raise exception 'Journal entry % moves no amount', p_entry;
  end if;
end $$;

create or replace function assert_entry_balanced() returns trigger
language plpgsql as $$
begin
  perform validate_journal_entry(coalesce(NEW.journal_entry_id, OLD.journal_entry_id));
  return null;
end $$;

create or replace function trg_journal_entry_validate() returns trigger
language plpgsql as $$
begin
  perform validate_journal_entry(NEW.id);
  return null;
end $$;

drop trigger if exists journal_entry_validate on journal_entry;
create constraint trigger journal_entry_validate
  after insert or update on journal_entry
  deferrable initially deferred
  for each row execute function trg_journal_entry_validate();

-- Every lock and unlock is recorded, with who did it.
create or replace function trg_period_guard() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Accounting periods cannot be deleted' using errcode = 'check_violation';
  end if;
  if (NEW.business_id, NEW.name, NEW.starts_on, NEW.ends_on)
       is distinct from (OLD.business_id, OLD.name, OLD.starts_on, OLD.ends_on) then
    raise exception 'An accounting period''s dates and name cannot change' using errcode = 'check_violation';
  end if;
  if NEW.status is distinct from OLD.status then
    if NEW.status = 'locked' then
      NEW.locked_by := coalesce(current_app_user_id(), NEW.locked_by);
      NEW.locked_at := now();
    else
      NEW.locked_by := null;
      NEW.locked_at := null;
    end if;
    perform audit_event(NEW.business_id, 'period.' || NEW.status::text, 'accounting_period', NEW.id::text,
      nullif(current_setting('ledger.reason', true), ''),
      jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status));
  end if;
  return NEW;
end $$;

drop trigger if exists accounting_period_guard on accounting_period;
create trigger accounting_period_guard
  before update or delete on accounting_period
  for each row execute function trg_period_guard();

-- =============================================================================
-- 6. Sales, purchasing, expenses: append-only (audit L-02, M-07, H-11)
-- =============================================================================
-- A finalized sale may only move along its lifecycle; nothing else changes.
create or replace function forbid_financial_edit() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'sales_order is append-only; use a void or refund, not DELETE' using errcode = 'check_violation';
  end if;
  if OLD.status = 'open' then return NEW; end if;
  if (to_jsonb(NEW) - 'status') is distinct from (to_jsonb(OLD) - 'status') then
    raise exception 'A finalized sale is immutable; only its status may move to voided or refunded'
      using errcode = 'check_violation';
  end if;
  if NEW.status is distinct from OLD.status and not (
       (OLD.status = 'completed' and NEW.status in ('voided', 'refunded', 'partially_refunded'))
    or (OLD.status = 'partially_refunded' and NEW.status in ('refunded', 'partially_refunded'))) then
    raise exception 'A sale cannot move from % to %', OLD.status, NEW.status using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

do $$
declare t text;
begin
  foreach t in array array['sales_order_line', 'sales_tender', 'sale_adjustment', 'expense',
                           'supplier_payment', 'goods_receipt', 'goods_receipt_line'] loop
    execute format('drop trigger if exists %I on %I', t || '_append_only', t);
    execute format('create trigger %I before update or delete on %I for each row execute function forbid_mutation()',
                   t || '_append_only', t);
  end loop;
end $$;

-- Receipts carry their supplier properly (the old code kept the name in `note`).
alter table goods_receipt add column if not exists supplier_id uuid references supplier(id);
alter table goods_receipt add column if not exists receipt_no bigint;

-- Bills: the amount and identity are fixed at entry; what has been paid is
-- recomputed from the payments themselves, so it can neither drift nor be set
-- by hand, and payments can never exceed the bill (audit H-11, M-08).
alter table purchase_invoice add column if not exists legacy boolean not null default true;
alter table purchase_invoice alter column legacy set default false;
alter table purchase_invoice add column if not exists expense_account_code text;
-- A bill entered in error is cancelled, never deleted: the row stays, its
-- journal is reversed, and it stops counting as owed (cancel_bill, 0015).
alter table purchase_invoice add column if not exists cancelled_at timestamptz;
alter table purchase_invoice add column if not exists cancel_reason text;

create unique index if not exists purchase_invoice_unique_no
  on purchase_invoice (business_id, supplier_id, lower(invoice_no))
  where invoice_no is not null and not legacy and cancelled_at is null;
create unique index if not exists purchase_invoice_one_per_receipt
  on purchase_invoice (goods_receipt_id) where goods_receipt_id is not null and not legacy and cancelled_at is null;

create or replace function trg_purchase_invoice_guard() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Bills are append-only; record a credit note instead' using errcode = 'check_violation';
  end if;
  if TG_OP = 'INSERT' then
    NEW.legacy := false;
    NEW.cancelled_at := null;
    NEW.cancel_reason := null;
  elsif (to_jsonb(NEW) - 'paid_amount' - 'is_paid' - 'cancelled_at' - 'cancel_reason')
        is distinct from (to_jsonb(OLD) - 'paid_amount' - 'is_paid' - 'cancelled_at' - 'cancel_reason') then
    raise exception 'A bill''s supplier, number, date and amount cannot change' using errcode = 'check_violation';
  elsif (NEW.cancelled_at, NEW.cancel_reason) is distinct from (OLD.cancelled_at, OLD.cancel_reason) then
    -- Cancelling is one-way, needs a reason, and only for a bill nothing was paid on.
    if OLD.cancelled_at is not null then
      raise exception 'This bill is already cancelled' using errcode = 'check_violation';
    end if;
    if NEW.cancelled_at is null or nullif(trim(NEW.cancel_reason), '') is null then
      raise exception 'Cancelling a bill needs a date and a reason' using errcode = 'check_violation';
    end if;
    if exists (select 1 from supplier_payment where purchase_invoice_id = NEW.id) then
      raise exception 'A bill with payments against it cannot be cancelled' using errcode = 'check_violation';
    end if;
  end if;
  NEW.paid_amount := coalesce((select sum(amount) from supplier_payment where purchase_invoice_id = NEW.id), 0);
  NEW.is_paid := NEW.paid_amount >= NEW.amount_total;
  if NEW.paid_amount > NEW.amount_total then
    raise exception 'Payments of % would exceed the bill total of %', NEW.paid_amount, NEW.amount_total
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

drop trigger if exists purchase_invoice_guard on purchase_invoice;
create trigger purchase_invoice_guard
  before insert or update or delete on purchase_invoice
  for each row execute function trg_purchase_invoice_guard();

-- A payment immediately re-totals its bill. The bill row is locked by that
-- UPDATE, so two concurrent payments serialise and the second sees the first.
create or replace function trg_supplier_payment_retotal() returns trigger
language plpgsql as $$
begin
  if NEW.purchase_invoice_id is not null then
    update purchase_invoice set paid_amount = paid_amount where id = NEW.purchase_invoice_id;
  end if;
  return null;
end $$;

drop trigger if exists supplier_payment_retotal on supplier_payment;
create trigger supplier_payment_retotal
  after insert on supplier_payment
  for each row execute function trg_supplier_payment_retotal();

-- =============================================================================
-- 7. Stock counts: two people, blind, server-side expectation (audit H-12)
-- =============================================================================
alter table stock_count add column if not exists legacy boolean not null default true;
alter table stock_count alter column legacy set default false;
alter table stock_count add column if not exists rejected_reason text;

create or replace function trg_stock_count_guard() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.status in ('draft', 'counting') then return OLD; end if;
    raise exception 'A submitted stock count cannot be deleted' using errcode = 'check_violation';
  end if;
  if TG_OP = 'INSERT' then
    NEW.legacy := false;
    if NEW.status not in ('draft', 'counting') then
      raise exception 'A stock count starts open; it is submitted and approved separately' using errcode = 'check_violation';
    end if;
    return NEW;
  end if;
  if OLD.status in ('approved', 'rejected') then
    raise exception 'Stock count is % and cannot change', OLD.status using errcode = 'check_violation';
  end if;
  if OLD.status = 'submitted' then
    if (to_jsonb(NEW) - 'status' - 'approved_by' - 'approved_at' - 'rejected_reason')
         is distinct from (to_jsonb(OLD) - 'status' - 'approved_by' - 'approved_at' - 'rejected_reason')
       or NEW.status not in ('approved', 'rejected') then
      raise exception 'A submitted count may only be approved or rejected' using errcode = 'check_violation';
    end if;
    if NEW.approved_by is null or NEW.approved_by = OLD.counted_by then
      raise exception 'A stock count must be approved by someone other than the person who counted it'
        using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists stock_count_guard on stock_count;
create trigger stock_count_guard
  before insert or update or delete on stock_count
  for each row execute function trg_stock_count_guard();

create or replace function trg_stock_count_line_guard() returns trigger
language plpgsql as $$
declare v_status count_status; v_legacy boolean;
begin
  select status, legacy into v_status, v_legacy from stock_count
   where id = coalesce(NEW.stock_count_id, OLD.stock_count_id);
  if v_legacy then return coalesce(NEW, OLD); end if;
  if v_status in ('draft', 'counting') then
    if TG_OP = 'UPDATE' and NEW.expected_base is distinct from OLD.expected_base then
      raise exception 'The expected quantity is recorded by the system and cannot be edited' using errcode = 'check_violation';
    end if;
    return coalesce(NEW, OLD);
  end if;
  -- After submission only the approval may attach the adjustment it posted.
  if TG_OP = 'UPDATE' and v_status = 'submitted'
     and (to_jsonb(NEW) - 'adjustment_movement_id') = (to_jsonb(OLD) - 'adjustment_movement_id')
     and OLD.adjustment_movement_id is null then
    return NEW;
  end if;
  raise exception 'Lines of a % stock count cannot change', v_status using errcode = 'check_violation';
end $$;

drop trigger if exists stock_count_line_guard on stock_count_line;
create trigger stock_count_line_guard
  before insert or update or delete on stock_count_line
  for each row execute function trg_stock_count_line_guard();

-- =============================================================================
-- 8. Day close: once per trading day per location (audit C-06 day-close gap)
-- =============================================================================
alter table work_shift add column if not exists business_day date;
-- Days the old app closed still count as closed. Where it closed a day twice,
-- the first close stands; the duplicate keeps no day, so it can never count
-- twice (and stays on record for review).
update work_shift w set business_day = business_local_date(w.business_id, w.opened_at)
 where w.closed_at is not null and w.business_day is null
   and w.id = (select w2.id from work_shift w2
                where w2.business_id = w.business_id and w2.location_id = w.location_id
                  and w2.closed_at is not null
                  and business_local_date(w2.business_id, w2.opened_at) = business_local_date(w.business_id, w.opened_at)
                order by w2.closed_at, w2.id limit 1);
set constraints all immediate;
create unique index if not exists work_shift_one_close_per_day
  on work_shift (business_id, location_id, business_day)
  where business_day is not null and closed_at is not null;

create or replace function trg_work_shift_guard() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'A closed trading day cannot be deleted' using errcode = 'check_violation';
  end if;
  if OLD.closed_at is not null then
    raise exception 'This trading day is already closed and cannot change' using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

drop trigger if exists work_shift_guard on work_shift;
create trigger work_shift_guard
  before update or delete on work_shift
  for each row execute function trg_work_shift_guard();

-- =============================================================================
-- 9. Inventory: honest stock board (audit H-10) and consistent values (M-12)
-- =============================================================================
alter table inventory_movement drop constraint if exists inventory_movement_value_consistent;
alter table inventory_movement add constraint inventory_movement_value_consistent check (
  value is null or unit_cost is null
  or (value >= 0 and abs(value - unit_cost * abs(base_quantity_signed)) < 1)
) not valid;

-- Signed quantity and value, so a negative position is shown as negative.
create or replace view stock_board with (security_invoker = on) as
select
  cs.business_id,
  cs.item_id,
  cs.location_id,
  i.name,
  i.name_ar,
  i.name_ckb,
  i.item_type,
  i.base_unit_code,
  cs.quantity_base,
  cs.value_signed as value,
  case when cs.quantity_base > 0 then round(cs.value_signed / cs.quantity_base, 4) end as unit_cost,
  i.min_level_base,
  i.par_level_base,
  i.track_expiry,
  (cs.quantity_base < coalesce(i.min_level_base, 0)) as is_low,
  (cs.quantity_base < 0) as is_negative
from current_stock cs
join item i on i.id = cs.item_id;

-- =============================================================================
-- 10. Invariants run with full visibility, whoever triggers them
-- =============================================================================
-- DEFERRED triggers (the balance check) fire at COMMIT, after the posting
-- function has returned — so they run as the committing role, e.g. a cashier
-- who cannot read the ledger under row-level security. A validator that
-- cannot see the entry finds nothing and would pass it unchecked. Running
-- every trigger function as its owner means each check always sees the truth.
-- (Trigger functions cannot be called through the API, so this exposes
-- nothing.)
do $$
declare f text;
begin
  foreach f in array array[
    'trg_journal_entry_guard()', 'trg_journal_line_guard()', 'assert_entry_balanced()',
    'trg_journal_entry_validate()', 'validate_journal_entry(uuid)', 'trg_period_guard()',
    'trg_purchase_invoice_guard()', 'trg_supplier_payment_retotal()', 'trg_stock_count_guard()',
    'trg_stock_count_line_guard()', 'trg_work_shift_guard()', 'trg_inherit_business_id()',
    'trg_gl_account_guard()', 'trg_business_provision()', 'forbid_financial_edit()'] loop
    execute format('alter function %s security definer set search_path = public', f);
  end loop;
end $$;
