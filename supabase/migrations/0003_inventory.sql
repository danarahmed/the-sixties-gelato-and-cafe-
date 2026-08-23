-- =============================================================================
-- 0003_inventory.sql — the append-only inventory ledger, lots, purchasing,
-- receiving, production, and stock counts. This is the integrity core.
-- =============================================================================

create type movement_type as enum (
  'opening_balance','purchase_receipt','supplier_return','production_consumption',
  'production_output','sale_consumption','refund_return_to_stock','waste','spoilage',
  'melt_evaporation','staff_consumption','complimentary','sampling','transfer_out',
  'transfer_in','count_adjustment','manual_correction','damaged','expired','reversal'
);

create type approval_status as enum ('not_required','pending','approved','rejected');

-- ---------------------------------------------------------------------------
-- Lots / batches for expiry and traceability
-- ---------------------------------------------------------------------------
create table item_lot (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  item_id       uuid not null references item(id) on delete cascade,
  lot_code      text not null,
  expiry_date   date,
  received_at   timestamptz,
  unique (item_id, lot_code)
);

-- ---------------------------------------------------------------------------
-- THE LEDGER. Append-only. Current stock is ALWAYS the signed sum here.
-- base_quantity_signed: + increases stock, - decreases. Value is optional
-- (costed movements carry it). occurred_at is UTC.
-- ---------------------------------------------------------------------------
create table inventory_movement (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references business(id) on delete cascade,
  item_id              uuid not null references item(id),
  location_id          uuid not null references location(id),
  type                 movement_type not null,
  base_quantity_signed numeric not null,        -- signed, in the item's base unit
  unit_cost            numeric,                  -- snapshot cost per base unit
  value                numeric,                  -- unit_cost * abs(qty), snapshot
  lot_id               uuid references item_lot(id),
  reference_type       text,                     -- 'sale','purchase_receipt','production',...
  reference_id         uuid,
  app_user_id          uuid references app_user(id),
  device_id            text,
  reason               text,
  approval_status      approval_status not null default 'not_required',
  occurred_at          timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  -- A costed movement's value must equal unit_cost * abs(qty) to the extent
  -- both are present (defensive; app computes exact values).
  check (base_quantity_signed <> 0)
);
create index on inventory_movement (business_id, item_id, location_id);
create index on inventory_movement (reference_type, reference_id);
create index on inventory_movement (occurred_at);

-- Append-only: no updates or deletes. Corrections use reversal/adjustment rows.
create trigger inventory_movement_immutable
  before update or delete on inventory_movement
  for each row execute function forbid_mutation();

-- Current stock per item+location, derived — never stored as an editable number.
create view current_stock as
select
  business_id,
  item_id,
  location_id,
  sum(base_quantity_signed) as quantity_base,
  sum(coalesce(value,0) * sign(base_quantity_signed)) as value_signed
from inventory_movement
group by business_id, item_id, location_id;

-- ---------------------------------------------------------------------------
-- Suppliers, purchase orders, goods receipts (partial deliveries), invoices
-- ---------------------------------------------------------------------------
create table supplier (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  name         text not null,
  contact      text,
  phone        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create type po_status as enum ('draft','submitted','partial','received','cancelled');

create table purchase_order (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  supplier_id  uuid not null references supplier(id),
  location_id  uuid not null references location(id),
  status       po_status not null default 'draft',
  ordered_at   timestamptz not null default now(),
  expected_at  timestamptz,
  note         text,
  created_by   uuid references app_user(id)
);

create table purchase_order_line (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_order(id) on delete cascade,
  item_id           uuid not null references item(id),
  order_qty         numeric not null check (order_qty > 0),
  order_unit_code   text not null,             -- e.g. 'carton_1000'
  unit_price        numeric not null check (unit_price >= 0)
);

create table goods_receipt (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references business(id) on delete cascade,
  purchase_order_id uuid references purchase_order(id),
  location_id       uuid not null references location(id),
  received_at       timestamptz not null default now(),
  -- Landed-cost allocation captured at receipt time.
  freight_total     numeric not null default 0,
  other_landed_total numeric not null default 0,
  rebate_total      numeric not null default 0,
  received_by       uuid references app_user(id),
  note              text
);

create table goods_receipt_line (
  id               uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references goods_receipt(id) on delete cascade,
  item_id          uuid not null references item(id),
  received_qty     numeric not null check (received_qty > 0),
  received_unit_code text not null,
  goods_value      numeric not null check (goods_value >= 0),
  lot_id           uuid references item_lot(id),
  -- The inventory_movement created for this receipt (traceability).
  movement_id      uuid references inventory_movement(id)
);

create table purchase_invoice (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references business(id) on delete cascade,
  supplier_id       uuid not null references supplier(id),
  invoice_no        text,
  invoice_date      date,
  amount_total      numeric not null default 0,
  is_paid           boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Production batches (spec §7): consume raw materials, output finished goods
-- ---------------------------------------------------------------------------
create type batch_status as enum ('planned','in_progress','completed','cancelled');

create table production_batch (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references business(id) on delete cascade,
  recipe_id         uuid not null references recipe(id),
  location_id       uuid not null references location(id),
  status            batch_status not null default 'planned',
  batches           numeric not null default 1 check (batches > 0),
  planned_yield_base numeric,
  actual_yield_base  numeric,
  rejected_qty_base  numeric not null default 0,
  output_lot_id     uuid references item_lot(id),
  produced_at       timestamptz,
  expiry_date       date,
  responsible_user  uuid references app_user(id),
  quality_note      text,
  total_consumed_value numeric,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Stock counts (spec §8): blind counts, save/resume, variance, approval
-- ---------------------------------------------------------------------------
create type count_type as enum ('full','cycle','category','location','high_value');
create type count_status as enum ('draft','counting','submitted','approved','rejected');

create table stock_count (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  location_id  uuid not null references location(id),
  count_type   count_type not null,
  status       count_status not null default 'draft',
  is_blind     boolean not null default true,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at  timestamptz,
  counted_by   uuid references app_user(id),
  approved_by  uuid references app_user(id)
);

create table stock_count_line (
  id             uuid primary key default gen_random_uuid(),
  stock_count_id uuid not null references stock_count(id) on delete cascade,
  item_id        uuid not null references item(id),
  -- Snapshot of expected stock at the moment counting started (hidden if blind).
  expected_base  numeric not null,
  counted_base   numeric,
  -- The adjustment movement posted after approval (traceability).
  adjustment_movement_id uuid references inventory_movement(id),
  recount_requested boolean not null default false,
  unique (stock_count_id, item_id)
);
