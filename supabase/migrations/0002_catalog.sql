-- =============================================================================
-- 0002_catalog.sql — items, units, products, recipes (versioned), channel prices
-- =============================================================================

create type item_type as enum (
  'ingredient','packaging','consumable','finished_good','resale','sub_recipe_output'
);

create type unit_dimension as enum ('count','mass','volume');

create type sales_channel as enum (
  'dine_in','takeaway','direct_delivery','talabat','careem','toters'
);

-- ---------------------------------------------------------------------------
-- Items: everything held in stock, including one straw / lid / napkin
-- ---------------------------------------------------------------------------
create table item (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references business(id) on delete cascade,
  sku                text,
  name               text not null,
  name_ar            text,
  name_ckb           text,
  item_type          item_type not null,
  base_unit_code     text not null,             -- e.g. 'each','g','ml'
  dimension          unit_dimension not null,
  -- Inventory policy
  returnable_to_stock boolean not null default false,  -- refunds only re-stock these
  track_lot          boolean not null default false,
  track_expiry       boolean not null default false,
  min_level_base     numeric,                   -- reorder thresholds, in base units
  max_level_base     numeric,
  safety_stock_base  numeric,
  par_level_base     numeric,
  barcode            text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  unique (business_id, sku)
);
create index on item (business_id, item_type);

-- Alternate purchase/consumption units for an item. The base unit has factor 1.
create table item_unit (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references item(id) on delete cascade,
  code           text not null,                 -- 'carton_1000','case_12x1L','kg'...
  label          text not null,
  dimension      unit_dimension not null,
  factor_to_base numeric not null check (factor_to_base > 0),
  unique (item_id, code)
);

-- ---------------------------------------------------------------------------
-- Product catalog (sellable). Categories, products, variants (size/flavour)
-- ---------------------------------------------------------------------------
create table product_category (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  name         text not null,
  name_ar      text,
  name_ckb     text,
  sort_order   int not null default 0,
  is_active    boolean not null default true
);

create table product (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  category_id   uuid references product_category(id),
  name          text not null,
  name_ar       text,
  name_ckb      text,
  description   text,
  image_url     text,
  allergens     text[],                          -- e.g. {milk,nuts}
  is_favourite  boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on product (business_id, category_id);

-- A variant is the actually-priced, actually-sold unit (size + flavour + type).
create table product_variant (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references product(id) on delete cascade,
  name          text not null,                   -- e.g. 'Medium / Pistachio'
  name_ar       text,
  name_ckb      text,
  sku           text,
  -- If this variant is simply a resale item, it can point straight at an item.
  resale_item_id uuid references item(id),
  is_active     boolean not null default true,
  unique (product_id, name)
);

-- ---------------------------------------------------------------------------
-- Recipes with versioning + effective dates (spec §5)
-- ---------------------------------------------------------------------------
create table recipe (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business(id) on delete cascade,
  name           text not null,
  -- For production recipes: the finished good produced and planned batch yield.
  output_item_id uuid references item(id),
  batch_yield_base numeric,                      -- output base units per batch
  prep_instructions text,
  created_at     timestamptz not null default now()
);

-- A variant uses a recipe; the version in force depends on the sale date.
create table recipe_version (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipe(id) on delete cascade,
  version_no    int not null,
  effective_from date not null,
  effective_to  date,                            -- null = still in force
  note          text,
  created_at    timestamptz not null default now(),
  unique (recipe_id, version_no)
);

create type component_type as enum ('item','sub_recipe');

create table recipe_line (
  id                 uuid primary key default gen_random_uuid(),
  recipe_version_id  uuid not null references recipe_version(id) on delete cascade,
  component_type     component_type not null,
  item_id            uuid references item(id),          -- when component_type='item'
  sub_recipe_id      uuid references recipe(id),         -- when component_type='sub_recipe'
  quantity           numeric not null check (quantity >= 0),
  unit_code          text not null,
  -- null/empty = applies to every channel; else gates packaging by channel.
  applies_to_channels sales_channel[],
  note               text,
  check (
    (component_type = 'item' and item_id is not null) or
    (component_type = 'sub_recipe' and sub_recipe_id is not null)
  )
);
create index on recipe_line (recipe_version_id);

-- Which recipe (and thus version chain) a variant uses. Different recipe by
-- size is expressed as different variants each pointing at their own recipe.
create table variant_recipe (
  id                uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references product_variant(id) on delete cascade,
  recipe_id         uuid not null references recipe(id),
  unique (product_variant_id)
);

-- ---------------------------------------------------------------------------
-- Channel / branch / promotion pricing (spec §5, §10)
-- ---------------------------------------------------------------------------
create table channel_price (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references business(id) on delete cascade,
  product_variant_id uuid not null references product_variant(id) on delete cascade,
  channel            sales_channel not null,
  location_id        uuid references location(id),   -- null = all branches
  price              numeric not null check (price >= 0),
  effective_from     date not null default current_date,
  effective_to       date,
  promotion_id       uuid,                           -- set in 0005 (platform/promotions)
  created_at         timestamptz not null default now()
);
create index on channel_price (product_variant_id, channel);
