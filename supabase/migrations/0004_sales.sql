-- =============================================================================
-- 0004_sales.sql — POS sales, order lines, tenders, shifts, cash sessions.
-- Financial rows are append-only; corrections are voids/refunds/reversals.
-- Offline sales carry a UUID idempotency key with a UNIQUE constraint so a
-- re-sync can never double-insert (spec §3, §9 acceptance scenario 10).
-- =============================================================================

create type order_status as enum ('open','completed','voided','refunded','partially_refunded');
create type tender_type  as enum ('cash','card','platform_paid','mixed','other');

create table sales_order (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references business(id) on delete cascade,
  location_id       uuid not null references location(id),
  channel           sales_channel not null,
  status            order_status not null default 'completed',
  -- Idempotency: client-generated UUID for offline-created orders. UNIQUE means
  -- applying the same offline transaction twice is impossible at the DB level.
  idempotency_key   uuid not null,
  device_id         text,
  -- Money fields (business currency). Gross before discounts, discount, net.
  gross_amount      numeric not null default 0,
  discount_amount   numeric not null default 0,
  net_amount        numeric not null default 0,
  -- Cost snapshot at time of sale — never rewritten by later cost changes.
  cogs_amount       numeric,
  cashier_id        uuid references app_user(id),
  shift_id          uuid,
  -- If this order came from a delivery platform, link to the platform order.
  platform_order_id uuid,
  note              text,
  placed_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (business_id, idempotency_key)
);
create index on sales_order (business_id, placed_at);
create index on sales_order (channel);

-- Financial immutability: a completed order cannot be edited or deleted.
-- Status transitions (void/refund) are recorded as NEW rows/movements, and
-- the app performs them; direct UPDATE/DELETE of the money fields is blocked.
create or replace function forbid_financial_edit() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'sales_order is append-only; use a void/refund, not DELETE';
  end if;
  -- Allow status/cogs updates but freeze monetary amounts once completed.
  if OLD.status in ('completed','refunded','partially_refunded','voided') then
    if NEW.gross_amount <> OLD.gross_amount
       or NEW.discount_amount <> OLD.discount_amount
       or NEW.net_amount <> OLD.net_amount then
      raise exception 'Monetary amounts of a finalized sales_order are immutable';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger sales_order_financial_guard
  before update or delete on sales_order
  for each row execute function forbid_financial_edit();

create table sales_order_line (
  id                 uuid primary key default gen_random_uuid(),
  sales_order_id     uuid not null references sales_order(id) on delete cascade,
  product_variant_id uuid not null references product_variant(id),
  quantity           numeric not null check (quantity > 0),
  unit_price         numeric not null check (unit_price >= 0),
  line_discount      numeric not null default 0,
  line_net           numeric not null,
  cogs_amount        numeric,                 -- cost snapshot for this line
  -- Modifiers/add-ons chosen, as structured data (name + price delta).
  modifiers          jsonb not null default '[]'::jsonb,
  note               text
);
create index on sales_order_line (sales_order_id);

create table sales_tender (
  id             uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_order(id) on delete cascade,
  tender_type    tender_type not null,
  amount         numeric not null check (amount >= 0),
  reference      text
);

-- Discounts / comps / refunds with reason + approver (permission-limited).
create type adjustment_kind as enum ('discount','complimentary','void','refund');

create table sale_adjustment (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business(id) on delete cascade,
  sales_order_id uuid not null references sales_order(id) on delete cascade,
  kind           adjustment_kind not null,
  amount         numeric not null default 0,
  reason         text not null,
  requested_by   uuid references app_user(id),
  approved_by    uuid references app_user(id),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shifts and cash drawer sessions (spec §9)
-- ---------------------------------------------------------------------------
create table work_shift (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  location_id  uuid not null references location(id),
  opened_by    uuid references app_user(id),
  opened_at    timestamptz not null default now(),
  closed_at    timestamptz,
  opening_float numeric not null default 0,
  counted_cash  numeric,                  -- cash counted at close
  expected_cash numeric,                  -- derived from cash tenders + float
  variance      numeric                   -- counted - expected
);

-- ---------------------------------------------------------------------------
-- Offline sync queue mirror (server-side visibility of client IndexedDB queue)
-- The authoritative dedupe is the sales_order UNIQUE(idempotency_key); this
-- table records sync attempts and statuses for auditing and reconciliation.
-- ---------------------------------------------------------------------------
create type sync_status as enum ('pending','applied','duplicate','failed');

create table sync_log (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references business(id) on delete cascade,
  idempotency_key uuid not null,
  device_id       text not null,
  entity_type     text not null,          -- 'sales_order','platform_order',...
  status          sync_status not null default 'pending',
  client_created_at timestamptz,
  applied_at      timestamptz,
  error_detail    text,
  unique (business_id, idempotency_key, entity_type)
);
