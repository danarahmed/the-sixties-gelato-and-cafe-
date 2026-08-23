-- =============================================================================
-- 0005_platform.sql — delivery-platform integration layer (spec §10).
-- Generic across Talabat / Careem / Toters / direct web. The customer payment
-- is NOT assumed equal to revenue or payout — every component is stored.
-- =============================================================================

create table delivery_platform (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  code         text not null,            -- 'talabat','careem','toters','web'
  name         text not null,
  is_active    boolean not null default true,
  unique (business_id, code)
);

-- Mappings between internal and external identifiers (spec §10)
create table platform_store_map (
  id            uuid primary key default gen_random_uuid(),
  platform_id   uuid not null references delivery_platform(id) on delete cascade,
  location_id   uuid not null references location(id),
  external_store_id text not null,
  unique (platform_id, external_store_id)
);

create table platform_product_map (
  id                 uuid primary key default gen_random_uuid(),
  platform_id        uuid not null references delivery_platform(id) on delete cascade,
  product_variant_id uuid not null references product_variant(id),
  external_product_id text not null,
  external_variant_id text,
  unique (platform_id, external_product_id, external_variant_id)
);

-- Promotions / campaigns (spec §10, §11)
create type discount_sponsor as enum ('merchant','platform','shared');

create table promotion (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  platform_id   uuid references delivery_platform(id),
  name          text not null,
  sponsor       discount_sponsor not null default 'merchant',
  starts_on     date,
  ends_on       date,
  note          text
);

-- ---------------------------------------------------------------------------
-- Platform orders: every economic component stored SEPARATELY (spec §10)
-- ---------------------------------------------------------------------------
create type platform_order_status as enum ('received','accepted','completed','cancelled','refunded');

create table platform_order (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references business(id) on delete cascade,
  platform_id            uuid not null references delivery_platform(id),
  location_id            uuid not null references location(id),
  external_order_id      text not null,
  status                 platform_order_status not null default 'received',
  -- Pricing (all in business currency)
  store_list_value       numeric not null default 0,   -- merchant list price sum
  original_price_before_promo numeric,                 -- pre-promotion reference
  item_level_discounts   numeric not null default 0,
  order_level_discounts  numeric not null default 0,
  merchant_funded_discount numeric not null default 0,
  platform_funded_discount numeric not null default 0,
  promotion_id           uuid references promotion(id),
  -- Money movement
  customer_payment       numeric not null default 0,
  delivery_fee           numeric not null default 0,
  service_fee            numeric not null default 0,    -- borne by merchant portion
  commission             numeric not null default 0,
  payment_processing_fee numeric not null default 0,
  advertising_fee        numeric not null default 0,
  refunds                numeric not null default 0,
  other_adjustments      numeric not null default 0,    -- signed
  -- Payout
  expected_payout        numeric,                        -- computed deterministically
  actual_payout          numeric,                        -- from settlement statement
  settlement_id          uuid,
  settlement_reference   text,
  settled_at             timestamptz,
  -- Link to the internal sale created from this platform order (idempotent).
  sales_order_id         uuid references sales_order(id),
  placed_at              timestamptz not null default now(),
  imported_at            timestamptz not null default now(),
  import_source          text not null default 'manual', -- 'api','webhook','csv','manual'
  -- Natural idempotency key: same external order can never be imported twice.
  unique (business_id, platform_id, external_order_id)
);
create index on platform_order (business_id, status);
create index on platform_order (settlement_id);

-- ---------------------------------------------------------------------------
-- Settlement statements + lines + reconciliation results
-- ---------------------------------------------------------------------------
create table platform_settlement (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  platform_id   uuid not null references delivery_platform(id),
  reference     text not null,
  period_start  date,
  period_end    date,
  statement_total numeric not null default 0,
  imported_at   timestamptz not null default now(),
  import_source text not null default 'csv'
);

create table platform_settlement_line (
  id             uuid primary key default gen_random_uuid(),
  settlement_id  uuid not null references platform_settlement(id) on delete cascade,
  external_order_id text,
  reported_payout   numeric not null default 0,
  reported_commission numeric not null default 0,
  adjustment_note   text
);

create type reconciliation_issue_type as enum (
  'missing_payout','unmatched_settlement_line','duplicate_settlement_line',
  'payout_difference','incorrect_commission','cancelled_still_charged',
  'unexplained_adjustment'
);

create table reconciliation_issue (
  id             uuid primary key default gen_random_uuid(),
  settlement_id  uuid not null references platform_settlement(id) on delete cascade,
  issue_type     reconciliation_issue_type not null,
  external_order_id text,
  detail         text,
  delta_amount   numeric,
  resolved       boolean not null default false,
  resolved_by    uuid references app_user(id),
  created_at     timestamptz not null default now()
);

-- Wire deferred FKs from earlier migrations now that targets exist.
alter table channel_price
  add constraint channel_price_promotion_fk
  foreign key (promotion_id) references promotion(id);

alter table sales_order
  add constraint sales_order_platform_order_fk
  foreign key (platform_order_id) references platform_order(id);

alter table platform_order
  add constraint platform_order_settlement_fk
  foreign key (settlement_id) references platform_settlement(id);
