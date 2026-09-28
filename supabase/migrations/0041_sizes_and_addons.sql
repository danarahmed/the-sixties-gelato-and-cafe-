-- =============================================================================
-- 0041 — Sizes and add-ons (release P)
--
-- A product could be sold in several sizes, each with its own recipe and
-- prices, but only the database could add one; and a drink could not be sold
-- with oat milk or an extra shot: the sale line's add-ons column was never
-- used (docs/COMPLETION_PLAN.md, B3 and B4).
--   * Sizes: a size is added on the product's card, with its name, its prices
--     and its recipe (its own, another size's copied, or why it uses none);
--     renamed; retired, and brought back. A retired size stays on past sales.
--   * Add-ons: groups (Milk: choose one; Extras: up to three), each add-on with
--     its prices by channel from a date, and what it uses: for every size, or
--     a size's own quantities. A product offers groups, for all its sizes or
--     for one.
--   * The till sells a line as its size and its add-ons: the price is the
--     size's and the add-ons', a discount is shared over them, and their
--     recipes are used with the line. A bill keeps its add-ons, freezes their
--     prices when it is printed, and moves them when it is split. Refunds and
--     voids take them back with their line.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Sizes
-- ---------------------------------------------------------------------------
-- A size's name is its own within its product, retired sizes included.
create or replace function assert_size_name_free(p_product uuid, p_name text, p_self uuid default null)
returns void language plpgsql stable set search_path = public as $$
declare v record;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the size'; end if;
  select pv.name, pv.is_active into v from product_variant pv
   where pv.product_id = p_product and name_key(pv.name) = name_key(p_name) and pv.id is distinct from p_self
   limit 1;
  if found then
    if v.is_active then raise exception 'This product already has a size called %', v.name; end if;
    raise exception 'This product has a retired size called %: bring it back instead', v.name;
  end if;
end $$;

-- A new size: its name, its prices, and what one serving uses — its own
-- recipe, another size's copied, or why it uses no stock. The product's one
-- size may be renamed in the same step (Latte becomes Regular).
create or replace function add_variant__run(p_product uuid, p_name text, p_prices jsonb default '{}'::jsonb,
                                          p_recipe jsonb default null, p_copy_from uuid default null,
                                          p_no_stock_reason text default null, p_name_ar text default null,
                                          p_name_ckb text default null, p_rename_existing text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  p product; v_only uuid; v_copy product_variant; v_today date; v_variant uuid; v_recipe uuid; v_version uuid;
  v_lines int := 0; v_reason text := nullif(trim(p_no_stock_reason), ''); k text; v numeric;
begin
  select * into p from product where id = p_product and business_id = v_business for update;
  if not found then raise exception 'Product not found'; end if;
  if exists (select 1 from product_variant where product_id = p_product and resale_item_id is not null) then
    raise exception '% is sold as bought: add the other size as a product of its own', p.name;
  end if;
  v_today := business_local_date(v_business, now());
  if nullif(trim(p_rename_existing), '') is not null then
    if (select count(*) from product_variant where product_id = p_product and is_active) <> 1 then
      raise exception 'This product already has several sizes: rename each on its own';
    end if;
    select id into v_only from product_variant where product_id = p_product and is_active;
    perform assert_size_name_free(p_product, p_rename_existing, v_only);
    update product_variant set name = trim(p_rename_existing) where id = v_only;
  end if;
  perform assert_size_name_free(p_product, p_name);
  if (case when jsonb_typeof(p_recipe) = 'array' and jsonb_array_length(p_recipe) > 0 then 1 else 0 end)
     + (case when p_copy_from is not null then 1 else 0 end) + (case when v_reason is not null then 1 else 0 end) <> 1 then
    raise exception 'List what one serving of the size uses, copy another size''s recipe, or say why it uses no stock';
  end if;
  if p_copy_from is not null then
    select * into v_copy from product_variant where id = p_copy_from and product_id = p_product;
    if not found then raise exception 'Copy the recipe of one of this product''s sizes'; end if;
  end if;

  insert into product_variant (product_id, name, name_ar, name_ckb)
  values (p_product, trim(p_name), nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''))
  returning id into v_variant;
  insert into recipe (business_id, name) values (v_business, p.name || ' — ' || trim(p_name)) returning id into v_recipe;
  insert into recipe_version (recipe_id, version_no, effective_from) values (v_recipe, 1, v_today)
  returning id into v_version;
  if p_copy_from is not null then
    -- The recipe the other size has today, line for line.
    insert into recipe_line (recipe_version_id, component_type, item_id, sub_recipe_id, quantity, unit_code,
                             applies_to_channels, note)
    select v_version, rl.component_type, rl.item_id, rl.sub_recipe_id, rl.quantity, rl.unit_code,
           rl.applies_to_channels, rl.note
      from recipe_line rl
     where rl.recipe_version_id = recipe_version_on((select vr.recipe_id from variant_recipe vr
                                                       where vr.product_variant_id = p_copy_from), v_today);
    get diagnostics v_lines = row_count;
    if v_lines = 0 then
      if v_copy.no_stock_reason is null then raise exception '% has no recipe in force to copy', v_copy.name; end if;
      v_reason := v_copy.no_stock_reason;
    end if;
  elsif v_reason is null then
    v_lines := write_recipe_lines(v_business, v_version, p_recipe, null, true);
  end if;
  if v_lines = 0 then
    update product_variant set no_stock_reason = v_reason where id = v_variant;
  end if;
  insert into variant_recipe (product_variant_id, recipe_id) values (v_variant, v_recipe);
  for k, v in select key, nullif(value, '')::numeric from jsonb_each_text(coalesce(p_prices, '{}')) loop
    if v is not null and v > 0 then
      insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
      values (v_business, v_variant, k::sales_channel, v, v_today);
    end if;
  end loop;
  perform audit_event(v_business, 'recipe.change', 'product_variant', v_variant::text, null, null,
    jsonb_build_object('effective_from', v_today, 'copied_from', v_copy.name, 'no_stock_reason',
                       case when v_lines = 0 then v_reason end,
                       'lines', (select coalesce(jsonb_agg(jsonb_build_object('item_id', rl.item_id,
                                                   'qty', trim_scale(rl.quantity), 'unit_code', rl.unit_code,
                                                   'channels', rl.applies_to_channels) order by rl.id), '[]')
                                   from recipe_line rl where rl.recipe_version_id = v_version)));
  return jsonb_build_object('product_id', p_product, 'variant_id', v_variant, 'recipe_id', v_recipe);
end $$;

create or replace function add_variant(p_product uuid, p_name text, p_prices jsonb default '{}'::jsonb,
                                     p_recipe jsonb default null, p_copy_from uuid default null,
                                     p_no_stock_reason text default null, p_name_ar text default null,
                                     p_name_ckb text default null, p_rename_existing text default null,
                                     p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_product', p_product, 'p_name', p_name, 'p_prices', p_prices,
                                    'p_recipe', p_recipe, 'p_copy_from', p_copy_from,
                                    'p_no_stock_reason', p_no_stock_reason, 'p_name_ar', p_name_ar,
                                    'p_name_ckb', p_name_ckb, 'p_rename_existing', p_rename_existing);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'add_variant', v_req);
  if v is not null then return v; end if;
  v := add_variant__run(p_product, p_name, p_prices, p_recipe, p_copy_from, p_no_stock_reason, p_name_ar, p_name_ckb,
                        p_rename_existing);
  perform idem_finish(v_business, p_idempotency_key, 'add_variant', v_req, v);
  return v;
end $$;

-- A size renamed, in the three languages.
create or replace function update_variant__run(p_variant uuid, p_name text, p_name_ar text default null,
                                             p_name_ckb text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); pv product_variant;
begin
  select * into pv from product_variant where id = p_variant and business_id = v_business for update;
  if not found then raise exception 'Size not found'; end if;
  perform assert_size_name_free(pv.product_id, p_name, p_variant);
  update product_variant
     set name = trim(p_name), name_ar = nullif(trim(p_name_ar), ''), name_ckb = nullif(trim(p_name_ckb), '')
   where id = p_variant;
  return jsonb_build_object('variant_id', p_variant, 'name', trim(p_name));
end $$;

create or replace function update_variant(p_variant uuid, p_name text, p_name_ar text default null,
                                        p_name_ckb text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_variant', p_variant, 'p_name', p_name, 'p_name_ar', p_name_ar,
                                    'p_name_ckb', p_name_ckb);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'update_variant', v_req);
  if v is not null then return v; end if;
  v := update_variant__run(p_variant, p_name, p_name_ar, p_name_ckb);
  perform idem_finish(v_business, p_idempotency_key, 'update_variant', v_req, v);
  return v;
end $$;

-- A size taken off the till, with a reason, or brought back. Past sales keep
-- it; the product keeps at least one size on sale; a size on an open bill
-- stays until the bill is settled or it is taken off it.
create or replace function retire_variant__run(p_variant uuid, p_retire boolean default true, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  pv product_variant; v_reason text := nullif(trim(p_reason), ''); v_retire boolean := coalesce(p_retire, true);
  v_bill text;
begin
  select * into pv from product_variant where id = p_variant and business_id = v_business;
  if not found then raise exception 'Size not found'; end if;
  perform 1 from product where id = pv.product_id for update;
  select * into pv from product_variant where id = p_variant for update;
  if v_retire then
    if not pv.is_active then raise exception '% is retired already', pv.name; end if;
    if v_reason is null then raise exception 'Say why the size is retired'; end if;
    if not exists (select 1 from product_variant where product_id = pv.product_id and is_active and id <> p_variant) then
      raise exception '% is the product''s only size on sale: hide the product instead', pv.name;
    end if;
    select coalesce(dt.name, t.label, '') into v_bill
      from pos_tab_line tl join pos_tab t on t.id = tl.tab_id left join dining_table dt on dt.id = t.table_id
     where tl.product_variant_id = p_variant and t.status = 'open'
     order by t.opened_at limit 1;
    if found then
      raise exception '% is on the open bill %: take it off, or settle the bill, first', pv.name, v_bill;
    end if;
  elsif pv.is_active then
    raise exception '% is on sale already', pv.name;
  end if;
  perform set_config('audit.reason', coalesce(v_reason, ''), true);
  update product_variant set is_active = not v_retire where id = p_variant;
  perform set_config('audit.reason', '', true);
  return jsonb_build_object('variant_id', p_variant, 'is_active', not v_retire);
end $$;

create or replace function retire_variant(p_variant uuid, p_retire boolean default true, p_reason text default null,
                                        p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_variant', p_variant, 'p_retire', p_retire, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'retire_variant', v_req);
  if v is not null then return v; end if;
  v := retire_variant__run(p_variant, p_retire, p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'retire_variant', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Add-ons: groups, add-ons, their prices and recipes, and who offers them
-- ---------------------------------------------------------------------------
-- A group asks for the fewest and the most add-ons a line may have from it:
-- Milk, choose one (1 and 1); Extras, up to three (0 and 3).
create table if not exists modifier_group (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  name_ar     text,
  name_ckb    text,
  min_select  int not null default 0 check (min_select between 0 and 20),
  max_select  int check (max_select is null or (max_select between 1 and 20 and max_select >= min_select)),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists modifier_group_name_in_use on modifier_group (business_id, name_key(name))
  where is_active;

create table if not exists modifier (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business (id) on delete cascade,
  group_id    uuid not null references modifier_group (id),
  name        text not null check (length(trim(name)) > 0),
  name_ar     text,
  name_ckb    text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists modifier_name_in_use on modifier (group_id, name_key(name)) where is_active;

-- Prices by channel from a date, as for products: the newest in force wins,
-- and a price is never changed, only followed by another.
create table if not exists modifier_price (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business (id) on delete cascade,
  modifier_id    uuid not null references modifier (id),
  channel        sales_channel not null,
  location_id    uuid references location (id),
  price          numeric not null check (price >= 0),
  effective_from date not null,
  created_at     timestamptz not null default now(),
  created_by     uuid references app_user (id) default current_app_user_id()
);
create index if not exists modifier_price_lookup on modifier_price (modifier_id, channel, effective_from desc);

-- What an add-on uses: lines for every size (no size named), or a size's own
-- lines, which then replace them for that size.
create table if not exists modifier_recipe_line (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references business (id) on delete cascade,
  modifier_id         uuid not null references modifier (id),
  product_variant_id  uuid references product_variant (id),
  item_id             uuid not null references item (id),
  quantity            numeric not null check (quantity > 0),
  unit_code           text not null,
  applies_to_channels sales_channel[],
  created_at          timestamptz not null default now()
);
create index if not exists modifier_recipe_line_lookup on modifier_recipe_line (modifier_id, product_variant_id);

-- The groups a product offers: for all its sizes (no size named), or for some.
create table if not exists product_modifier_group (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references business (id) on delete cascade,
  product_id         uuid not null references product (id) on delete cascade,
  group_id           uuid not null references modifier_group (id),
  product_variant_id uuid references product_variant (id) on delete cascade,
  sort_order         int not null default 0,
  unique nulls not distinct (product_id, group_id, product_variant_id)
);
create index if not exists product_modifier_group_group on product_modifier_group (group_id);

-- A bill line's add-ons, per one of the line: priced when the bill is
-- printed, as the line is.
create table if not exists pos_tab_line_modifier (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business (id) on delete cascade,
  tab_id      uuid not null references pos_tab (id) on delete cascade,
  tab_line_id uuid not null references pos_tab_line (id) on delete cascade,
  modifier_id uuid not null references modifier (id),
  qty         int not null check (qty between 1 and 20),
  unit_price  numeric check (unit_price >= 0),
  position    int not null default 0
);
create index if not exists pos_tab_line_modifier_line on pos_tab_line_modifier (tab_line_id);
create index if not exists pos_tab_line_modifier_tab on pos_tab_line_modifier (tab_id);
drop trigger if exists pos_tab_line_modifier_guard on pos_tab_line_modifier;
create trigger pos_tab_line_modifier_guard before insert or update or delete on pos_tab_line_modifier
  for each row execute function trg_pos_tab_line_guard();

-- A sold line's add-ons, as they were sold: the name, how many in all, the
-- price each, the amount, its share of the discount taken off (net) and what
-- its recipe cost. Written once, with the line.
create table if not exists sales_order_line_modifier (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references business (id) on delete cascade,
  sales_order_id      uuid not null references sales_order (id) on delete cascade,
  sales_order_line_id uuid not null references sales_order_line (id) on delete cascade,
  modifier_id         uuid not null references modifier (id),
  group_id            uuid references modifier_group (id),
  name                text not null,
  qty                 numeric not null check (qty > 0),
  unit_price          numeric not null check (unit_price >= 0),
  amount              numeric not null check (amount >= 0),
  net_amount          numeric not null check (net_amount >= 0),
  cost                numeric not null default 0,
  -- Its place on the line: the order the add-ons were given in.
  position            int not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists sales_order_line_modifier_line on sales_order_line_modifier (sales_order_line_id);
create index if not exists sales_order_line_modifier_order on sales_order_line_modifier (sales_order_id);
create index if not exists sales_order_line_modifier_modifier on sales_order_line_modifier (modifier_id);
drop trigger if exists sales_order_line_modifier_append_only on sales_order_line_modifier;
create trigger sales_order_line_modifier_append_only before update or delete on sales_order_line_modifier
  for each row execute function forbid_mutation();

-- Who changed a group or an add-on, and how, is on the audit trail.
drop trigger if exists audit_change on modifier_group;
create trigger audit_change after insert or update or delete on modifier_group
  for each row execute function audit_row_change();
drop trigger if exists audit_change on modifier;
create trigger audit_change after insert or update or delete on modifier
  for each row execute function audit_row_change();

-- Read by the business's members (recipes and sold lines with cost.view, as
-- recipe_line and sales_order_line are); written only through the functions below.
do $$
declare t text;
begin
  foreach t in array array['modifier_group', 'modifier', 'modifier_price', 'product_modifier_group',
                           'pos_tab_line_modifier', 'modifier_recipe_line', 'sales_order_line_modifier'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists member_read on %I', t);
    execute format('drop policy if exists cost_read on %I', t);
    if t in ('modifier_recipe_line', 'sales_order_line_modifier') then
      execute format('create policy cost_read on %I for select to authenticated using (business_id = (select current_business_id()) and (select current_has_permission(''cost.view'')))', t);
    else
      execute format('create policy member_read on %I for select to authenticated using (business_id = (select current_business_id()))', t);
    end if;
    execute format('revoke all on %I from anon, authenticated', t);
    execute format('grant select on %I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. An add-on's price, what it uses, and a line's add-ons checked
-- ---------------------------------------------------------------------------
-- The price in force on a day, on a channel (a branch's own first), as price_on.
create or replace function modifier_price_on(p_modifier uuid, p_channel sales_channel, p_location uuid, p_on date)
returns numeric language sql stable set search_path = public as $$
  select price from modifier_price
   where modifier_id = p_modifier and channel = p_channel and effective_from <= p_on
     and (location_id is null or location_id = p_location)
   order by (location_id is not null) desc, effective_from desc, created_at desc
   limit 1
$$;

-- What p_qty of an add-on uses with one size, in base units: the size's own
-- lines when it has some, otherwise those for every size; a line tagged to
-- channels only on them.
create or replace function expand_modifier(p_modifier uuid, p_variant uuid, p_channel sales_channel, p_qty numeric)
returns table (item_id uuid, base_qty numeric) language sql stable set search_path = public as $$
  select l.item_id, sum(to_base_qty(l.item_id, l.quantity * p_qty, l.unit_code))
    from modifier_recipe_line l
   where l.modifier_id = p_modifier
     and l.product_variant_id is not distinct from
         (select p_variant where exists (select 1 from modifier_recipe_line o
                                          where o.modifier_id = p_modifier and o.product_variant_id = p_variant))
     and (l.applies_to_channels is null or cardinality(l.applies_to_channels) = 0
          or p_channel = any (l.applies_to_channels))
   group by l.item_id
$$;

-- A line's add-ons as the product offers them: each on sale and offered with
-- this size, once, 1 to 20 of it for each one of the line, priced (a bill's
-- frozen price when trusted, otherwise the price in force); and each group the
-- size offers given no fewer and no more than it asks. Returns them as
-- [{modifier_id, group_id, name, qty, price}], in the order given.
create or replace function line_modifiers(p_business uuid, p_variant uuid, p_mods jsonb, p_channel sales_channel,
                                          p_location uuid, p_on date, p_trust_prices boolean default false)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_product uuid; v_what text; m jsonb; md record; g record; v_qty numeric; v_price numeric; v_n numeric;
  v_out jsonb := '[]';
begin
  if p_mods is not null and jsonb_typeof(p_mods) not in ('array', 'null') then
    raise exception 'The add-ons cannot be read';
  end if;
  select pv.product_id, p.name || case when pv.name is distinct from p.name then ' — ' || pv.name else '' end
    into v_product, v_what
    from product_variant pv join product p on p.id = pv.product_id where pv.id = p_variant;
  for m in select * from jsonb_array_elements(case when jsonb_typeof(p_mods) = 'array' then p_mods else '[]' end) loop
    if jsonb_typeof(m) <> 'object' or coalesce(m ->> 'modifier_id', '')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'The add-ons cannot be read';
    end if;
    select x.id, x.name, x.group_id, x.is_active and g2.is_active as on_sale into md
      from modifier x join modifier_group g2 on g2.id = x.group_id
     where x.id = (m ->> 'modifier_id')::uuid and x.business_id = p_business;
    if not found then raise exception 'Unknown add-on'; end if;
    if not md.on_sale then raise exception '% is no longer offered', md.name; end if;
    if not exists (select 1 from product_modifier_group o
                    where o.product_id = v_product and o.group_id = md.group_id
                      and (o.product_variant_id is null or o.product_variant_id = p_variant)) then
      raise exception '% is not offered with %', md.name, v_what;
    end if;
    if v_out @> jsonb_build_array(jsonb_build_object('modifier_id', md.id)) then
      raise exception '% is added twice: give it a quantity instead', md.name;
    end if;
    if coalesce(m ->> 'qty', '1') !~ '^[0-9]+$' then raise exception 'Add % 1 to 20 times', md.name; end if;
    v_qty := coalesce(m ->> 'qty', '1')::numeric;
    if v_qty < 1 or v_qty > 20 then raise exception 'Add % 1 to 20 times', md.name; end if;
    v_price := case when p_trust_prices and nullif(m ->> 'price', '') is not null then (m ->> 'price')::numeric
                    else modifier_price_on(md.id, p_channel, p_location, p_on) end;
    if v_price is null then raise exception 'No % price is set for %', p_channel, md.name; end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('modifier_id', md.id, 'group_id', md.group_id,
                                                           'name', md.name, 'qty', v_qty, 'price', v_price));
  end loop;
  -- Each group offered with this size: no fewer, and no more, than it asks.
  for g in select distinct mg.id, mg.name, mg.min_select, mg.max_select
             from product_modifier_group o join modifier_group mg on mg.id = o.group_id
            where o.product_id = v_product and (o.product_variant_id is null or o.product_variant_id = p_variant)
              and mg.is_active
            order by mg.name, mg.id loop
    select coalesce(sum((x ->> 'qty')::numeric), 0) into v_n
      from jsonb_array_elements(v_out) x where (x ->> 'group_id')::uuid = g.id;
    if v_n < g.min_select then
      if g.min_select = 1 then raise exception 'Choose % for %', g.name, v_what; end if;
      raise exception 'Choose at least % from % for %', g.min_select, g.name, v_what;
    end if;
    if g.max_select is not null and v_n > g.max_select then
      raise exception 'Choose at most % from % for %', g.max_select, g.name, v_what;
    end if;
  end loop;
  return v_out;
end $$;

-- Where an add-on, a group, or a product's add-ons are on a bill still open:
-- the bill's name, or null. What is on an open bill stays offered until it is
-- paid or taken off it.
create or replace function modifier_open_bill(p_business uuid, p_modifier uuid, p_group uuid, p_product uuid)
returns text language sql stable set search_path = public as $$
  select coalesce(dt.name, t.label, '')
    from pos_tab_line_modifier lm
    join modifier md on md.id = lm.modifier_id
    join pos_tab_line tl on tl.id = lm.tab_line_id
    join product_variant pv on pv.id = tl.product_variant_id
    join pos_tab t on t.id = lm.tab_id
    left join dining_table dt on dt.id = t.table_id
   where lm.business_id = p_business and t.status = 'open'
     and (p_modifier is null or lm.modifier_id = p_modifier)
     and (p_group is null or md.group_id = p_group)
     and (p_product is null or pv.product_id = p_product)
   order by t.opened_at
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- 4. Setting up add-ons (recipe.edit), and what the till reads (sale.create)
-- ---------------------------------------------------------------------------
-- A group, new or changed: its names, the fewest and the most a line takes
-- from it, and its place on the till. Taken off the till while nothing of it
-- is on an open bill.
create or replace function save_modifier_group__run(p_group uuid, p_name text, p_min int default 0, p_max int default null,
                                                  p_sort int default 0, p_is_active boolean default true,
                                                  p_name_ar text default null, p_name_ckb text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  g modifier_group; v_id uuid; v_active boolean := coalesce(p_is_active, true); v_bill text;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the group of add-ons'; end if;
  if p_min is null or p_min < 0 or p_min > 20 then
    raise exception 'The fewest to choose is a number from 0 to 20';
  end if;
  if p_max is not null and (p_max < 1 or p_max > 20 or p_max < p_min) then
    raise exception 'The most to choose is a number from 1 to 20, and no fewer than the fewest';
  end if;
  if p_group is not null then
    select * into g from modifier_group where id = p_group and business_id = v_business for update;
    if not found then raise exception 'Group of add-ons not found'; end if;
  end if;
  if v_active and exists (select 1 from modifier_group where business_id = v_business and is_active
                            and name_key(name) = name_key(p_name) and id is distinct from p_group) then
    raise exception 'There is already a group of add-ons called %', trim(p_name);
  end if;
  if p_group is null then
    insert into modifier_group (business_id, name, name_ar, name_ckb, min_select, max_select, sort_order, is_active)
    values (v_business, trim(p_name), nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''), p_min, p_max,
            coalesce(p_sort, 0), v_active)
    returning id into v_id;
  else
    if g.is_active and not v_active then
      v_bill := modifier_open_bill(v_business, null, p_group, null);
      if v_bill is not null then
        raise exception '% is on the open bill %: take it off, or settle the bill, first', g.name, v_bill;
      end if;
    end if;
    update modifier_group
       set name = trim(p_name), name_ar = nullif(trim(p_name_ar), ''), name_ckb = nullif(trim(p_name_ckb), ''),
           min_select = p_min, max_select = p_max, sort_order = coalesce(p_sort, 0), is_active = v_active
     where id = p_group;
    v_id := p_group;
  end if;
  return jsonb_build_object('group_id', v_id);
end $$;

create or replace function save_modifier_group(p_group uuid, p_name text, p_min int default 0, p_max int default null,
                                             p_sort int default 0, p_is_active boolean default true,
                                             p_name_ar text default null, p_name_ckb text default null,
                                             p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_group', p_group, 'p_name', p_name, 'p_min', p_min, 'p_max', p_max,
                                    'p_sort', p_sort, 'p_is_active', p_is_active, 'p_name_ar', p_name_ar,
                                    'p_name_ckb', p_name_ckb);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_modifier_group', v_req);
  if v is not null then return v; end if;
  v := save_modifier_group__run(p_group, p_name, p_min, p_max, p_sort, p_is_active, p_name_ar, p_name_ckb);
  perform idem_finish(v_business, p_idempotency_key, 'save_modifier_group', v_req, v);
  return v;
end $$;

-- An add-on's price on a channel from a date, on the audit trail with the
-- price it follows.
create or replace function put_modifier_price(p_business uuid, p_modifier uuid, p_channel sales_channel, p_price numeric,
                                            p_from date)
returns void language plpgsql set search_path = public as $$
declare v_was numeric; v_id uuid;
begin
  v_was := modifier_price_on(p_modifier, p_channel, null, p_from);
  insert into modifier_price (business_id, modifier_id, channel, price, effective_from)
  values (p_business, p_modifier, p_channel, p_price, p_from)
  returning id into v_id;
  perform audit_event(p_business, 'modifier_price.set', 'modifier_price', v_id::text, null,
    jsonb_build_object('modifier', p_modifier, 'channel', p_channel, 'price', v_was),
    jsonb_build_object('modifier', p_modifier, 'channel', p_channel, 'price', p_price, 'effective_from', p_from));
end $$;

-- What an add-on uses, for every size (no size) or one size's own lines,
-- replacing what that one had.
create or replace function put_modifier_recipe(p_business uuid, p_modifier uuid, p_variant uuid, p_lines jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare l jsonb; v_item uuid; v_qty numeric; v_out jsonb := '[]';
begin
  if p_lines is not null and jsonb_typeof(p_lines) not in ('array', 'null') then
    raise exception 'The recipe cannot be read';
  end if;
  delete from modifier_recipe_line where modifier_id = p_modifier and product_variant_id is not distinct from p_variant;
  for l in select * from jsonb_array_elements(case when jsonb_typeof(p_lines) = 'array' then p_lines else '[]' end) loop
    v_item := nullif(l ->> 'item_id', '')::uuid;
    if v_item is null or not exists (select 1 from item where id = v_item and business_id = p_business) then
      raise exception 'Unknown item in the recipe';
    end if;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Every recipe line needs a quantity'; end if;
    perform to_base_qty(v_item, 1, nullif(l ->> 'unit_code', ''));   -- validates the unit
    insert into modifier_recipe_line (business_id, modifier_id, product_variant_id, item_id, quantity, unit_code,
                                      applies_to_channels)
    values (p_business, p_modifier, p_variant, v_item, v_qty,
            coalesce(nullif(l ->> 'unit_code', ''), (select base_unit_code from item where id = v_item)),
            case when jsonb_typeof(l -> 'channels') = 'array' and jsonb_array_length(l -> 'channels') > 0
                 then array(select jsonb_array_elements_text(l -> 'channels'))::sales_channel[] end);
    v_out := v_out || jsonb_build_array(jsonb_build_object('item_id', v_item, 'qty', trim_scale(v_qty),
                                                           'unit_code', nullif(l ->> 'unit_code', ''),
                                                           'channels', l -> 'channels'));
  end loop;
  return v_out;
end $$;

-- An add-on, new or changed. A new one takes its prices by channel from today
-- (0 for one that costs nothing) and what it uses for every size; later
-- changes to those go through set_modifier_price and set_modifier_recipe.
create or replace function save_modifier__run(p_modifier uuid, p_group uuid, p_name text, p_sort int default 0,
                                            p_is_active boolean default true, p_prices jsonb default null,
                                            p_recipe jsonb default null, p_name_ar text default null,
                                            p_name_ckb text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  md modifier; v_group uuid; v_id uuid; v_active boolean := coalesce(p_is_active, true); v_bill text; v_today date;
  k text; v text;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the add-on'; end if;
  if p_modifier is not null then
    select * into md from modifier where id = p_modifier and business_id = v_business for update;
    if not found then raise exception 'Add-on not found'; end if;
    if p_group is not null and p_group <> md.group_id then
      raise exception 'An add-on stays in its group: add it to the other group instead';
    end if;
    v_group := md.group_id;
  else
    select id into v_group from modifier_group where id = p_group and business_id = v_business and is_active;
    if not found then raise exception 'Choose a group of add-ons in use'; end if;
  end if;
  if v_active and exists (select 1 from modifier where group_id = v_group and is_active
                            and name_key(name) = name_key(p_name) and id is distinct from p_modifier) then
    raise exception 'The group already has an add-on called %', trim(p_name);
  end if;
  if p_modifier is null then
    insert into modifier (business_id, group_id, name, name_ar, name_ckb, sort_order, is_active)
    values (v_business, v_group, trim(p_name), nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''),
            coalesce(p_sort, 0), v_active)
    returning id into v_id;
    v_today := business_local_date(v_business, now());
    if p_prices is not null and jsonb_typeof(p_prices) <> 'object' then raise exception 'The prices cannot be read'; end if;
    for k, v in select key, value from jsonb_each_text(coalesce(p_prices, '{}')) loop
      if nullif(trim(v), '') is not null then
        if trim(v) !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Enter a price'; end if;
        perform put_modifier_price(v_business, v_id, k::sales_channel, trim(v)::numeric, v_today);
      end if;
    end loop;
    if jsonb_typeof(p_recipe) = 'array' and jsonb_array_length(p_recipe) > 0 then
      perform audit_event(v_business, 'modifier.recipe', 'modifier', v_id::text, null, null,
        jsonb_build_object('size', null, 'lines', put_modifier_recipe(v_business, v_id, null, p_recipe)));
    end if;
  else
    if md.is_active and not v_active then
      v_bill := modifier_open_bill(v_business, p_modifier, null, null);
      if v_bill is not null then
        raise exception '% is on the open bill %: take it off, or settle the bill, first', md.name, v_bill;
      end if;
    end if;
    update modifier
       set name = trim(p_name), name_ar = nullif(trim(p_name_ar), ''), name_ckb = nullif(trim(p_name_ckb), ''),
           sort_order = coalesce(p_sort, 0), is_active = v_active
     where id = p_modifier;
    v_id := p_modifier;
  end if;
  return jsonb_build_object('modifier_id', v_id, 'group_id', v_group);
end $$;

create or replace function save_modifier(p_modifier uuid, p_group uuid, p_name text, p_sort int default 0,
                                       p_is_active boolean default true, p_prices jsonb default null,
                                       p_recipe jsonb default null, p_name_ar text default null,
                                       p_name_ckb text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_modifier', p_modifier, 'p_group', p_group, 'p_name', p_name, 'p_sort', p_sort,
                                    'p_is_active', p_is_active, 'p_prices', p_prices, 'p_recipe', p_recipe,
                                    'p_name_ar', p_name_ar, 'p_name_ckb', p_name_ckb);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_modifier', v_req);
  if v is not null then return v; end if;
  v := save_modifier__run(p_modifier, p_group, p_name, p_sort, p_is_active, p_prices, p_recipe, p_name_ar, p_name_ckb);
  perform idem_finish(v_business, p_idempotency_key, 'save_modifier', v_req, v);
  return v;
end $$;

-- A new price for an add-on on a channel, from today or a later day: every
-- sale keeps the price it was made at.
create or replace function set_modifier_price__run(p_modifier uuid, p_channel sales_channel, p_price numeric,
                                                 p_effective_from date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); v_today date; v_from date;
begin
  if not exists (select 1 from modifier where id = p_modifier and business_id = v_business) then
    raise exception 'Add-on not found';
  end if;
  if p_channel is null then raise exception 'Choose the channel'; end if;
  if p_price is null or p_price < 0 then raise exception 'Enter a price'; end if;
  v_today := business_local_date(v_business, now());
  v_from := coalesce(p_effective_from, v_today);
  if v_from < v_today then
    raise exception 'A price cannot start in the past: every sale keeps the price it was made at';
  end if;
  perform put_modifier_price(v_business, p_modifier, p_channel, p_price, v_from);
  return jsonb_build_object('modifier_id', p_modifier, 'channel', p_channel, 'price', p_price, 'effective_from', v_from);
end $$;

create or replace function set_modifier_price(p_modifier uuid, p_channel sales_channel, p_price numeric,
                                            p_effective_from date default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_modifier', p_modifier, 'p_channel', p_channel, 'p_price', p_price,
                                    'p_effective_from', p_effective_from);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_modifier_price', v_req);
  if v is not null then return v; end if;
  v := set_modifier_price__run(p_modifier, p_channel, p_price, p_effective_from);
  perform idem_finish(v_business, p_idempotency_key, 'set_modifier_price', v_req, v);
  return v;
end $$;

-- What an add-on uses from now on: for every size (no size), or a size's own
-- quantities; none for a size puts it back on the lines for every size.
create or replace function set_modifier_recipe__run(p_modifier uuid, p_variant uuid, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit'); md modifier; v_size text; v_before jsonb; v_after jsonb;
begin
  select * into md from modifier where id = p_modifier and business_id = v_business for update;
  if not found then raise exception 'Add-on not found'; end if;
  if p_variant is not null then
    select p.name || ' — ' || pv.name into v_size from product_variant pv join product p on p.id = pv.product_id
     where pv.id = p_variant and pv.business_id = v_business;
    if not found then raise exception 'Size not found'; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('item_id', l.item_id, 'qty', trim_scale(l.quantity),
                                               'unit_code', l.unit_code, 'channels', l.applies_to_channels)
                            order by l.created_at, l.id), '[]')
    into v_before from modifier_recipe_line l
   where l.modifier_id = p_modifier and l.product_variant_id is not distinct from p_variant;
  v_after := put_modifier_recipe(v_business, p_modifier, p_variant, p_lines);
  if v_before = '[]'::jsonb and v_after = '[]'::jsonb then raise exception 'Nothing was changed'; end if;
  perform audit_event(v_business, 'modifier.recipe', 'modifier', p_modifier::text, null,
    jsonb_build_object('size', v_size, 'lines', v_before), jsonb_build_object('size', v_size, 'lines', v_after));
  return jsonb_build_object('modifier_id', p_modifier, 'variant_id', p_variant, 'lines', jsonb_array_length(v_after));
end $$;

create or replace function set_modifier_recipe(p_modifier uuid, p_variant uuid, p_lines jsonb,
                                             p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_modifier', p_modifier, 'p_variant', p_variant, 'p_lines', p_lines);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_modifier_recipe', v_req);
  if v is not null then return v; end if;
  v := set_modifier_recipe__run(p_modifier, p_variant, p_lines);
  perform idem_finish(v_business, p_idempotency_key, 'set_modifier_recipe', v_req, v);
  return v;
end $$;

-- The groups a product offers, in the till's order: [{group_id, variant_id}],
-- a group for all its sizes (no size) or for the sizes named. A group taken
-- away while its add-ons are on an open bill of the product is refused.
create or replace function set_product_modifiers__run(p_product uuid, p_groups jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  p product; x jsonb; i int := 0; v_group uuid; v_variant uuid; v_before jsonb; v_after jsonb; r record; v_bill text;
  v_new jsonb := '[]';
begin
  select * into p from product where id = p_product and business_id = v_business for update;
  if not found then raise exception 'Product not found'; end if;
  if p_groups is not null and jsonb_typeof(p_groups) not in ('array', 'null') then
    raise exception 'The groups cannot be read';
  end if;
  for x in select * from jsonb_array_elements(case when jsonb_typeof(p_groups) = 'array' then p_groups else '[]' end) loop
    v_group := nullif(x ->> 'group_id', '')::uuid;
    v_variant := nullif(x ->> 'variant_id', '')::uuid;
    -- A group taken off the till may stay where it is offered already; it is not offered anew.
    if not exists (select 1 from modifier_group g where g.id = v_group and g.business_id = v_business
                      and (g.is_active or exists (select 1 from product_modifier_group o
                                                   where o.product_id = p_product and o.group_id = g.id))) then
      raise exception 'Choose a group of add-ons in use';
    end if;
    if v_variant is not null
       and not exists (select 1 from product_variant where id = v_variant and product_id = p_product) then
      raise exception 'Choose one of %''s sizes', p.name;
    end if;
    if v_new @> jsonb_build_array(jsonb_build_object('group_id', v_group, 'variant_id', v_variant))
       or (v_variant is null and v_new @> jsonb_build_array(jsonb_build_object('group_id', v_group)))
       or v_new @> jsonb_build_array(jsonb_build_object('group_id', v_group, 'variant_id', null)) then
      raise exception '% offers each group once: for all its sizes, or for some', p.name;
    end if;
    v_new := v_new || jsonb_build_array(jsonb_build_object('group_id', v_group, 'variant_id', v_variant));
  end loop;
  -- What is on an open bill stays offered: a group taken away, or narrowed to
  -- other sizes, must not be on one for a size it leaves.
  for r in select o.group_id, o.product_variant_id from product_modifier_group o where o.product_id = p_product loop
    if not exists (select 1 from jsonb_array_elements(v_new) n
                    where (n ->> 'group_id')::uuid = r.group_id
                      and (n ->> 'variant_id' is null or (n ->> 'variant_id')::uuid = r.product_variant_id)) then
      select coalesce(dt.name, t.label, '') into v_bill
        from pos_tab_line_modifier lm join modifier md on md.id = lm.modifier_id
        join pos_tab_line tl on tl.id = lm.tab_line_id join pos_tab t on t.id = lm.tab_id
        join product_variant pv on pv.id = tl.product_variant_id
        left join dining_table dt on dt.id = t.table_id
       where t.status = 'open' and md.group_id = r.group_id and pv.product_id = p_product
         and not exists (select 1 from jsonb_array_elements(v_new) n
                          where (n ->> 'group_id')::uuid = r.group_id
                            and (n ->> 'variant_id' is null or (n ->> 'variant_id')::uuid = tl.product_variant_id))
       order by t.opened_at limit 1;
      if found then
        raise exception '%', format('%s''s add-ons are on the open bill %s: take them off, or settle the bill, first',
                                    p.name, v_bill);
      end if;
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('group', g.name, 'size', pv.name) order by o.sort_order, g.name), '[]')
    into v_before
    from product_modifier_group o join modifier_group g on g.id = o.group_id
    left join product_variant pv on pv.id = o.product_variant_id
   where o.product_id = p_product;
  delete from product_modifier_group where product_id = p_product;
  for x in select * from jsonb_array_elements(v_new) loop
    i := i + 1;
    insert into product_modifier_group (business_id, product_id, group_id, product_variant_id, sort_order)
    values (v_business, p_product, (x ->> 'group_id')::uuid, nullif(x ->> 'variant_id', '')::uuid, i);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('group', g.name, 'size', pv.name) order by o.sort_order, g.name), '[]')
    into v_after
    from product_modifier_group o join modifier_group g on g.id = o.group_id
    left join product_variant pv on pv.id = o.product_variant_id
   where o.product_id = p_product;
  if v_before = v_after then raise exception 'Nothing was changed'; end if;
  perform audit_event(v_business, 'product.modifiers', 'product', p_product::text, null,
    jsonb_build_object('groups', v_before), jsonb_build_object('groups', v_after));
  return jsonb_build_object('product_id', p_product, 'groups', i);
end $$;

create or replace function set_product_modifiers(p_product uuid, p_groups jsonb, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_product', p_product, 'p_groups', p_groups);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_product_modifiers', v_req);
  if v is not null then return v; end if;
  v := set_product_modifiers__run(p_product, p_groups);
  perform idem_finish(v_business, p_idempotency_key, 'set_product_modifiers', v_req, v);
  return v;
end $$;

-- The till's add-ons: each group in use, in its order, with its add-ons on
-- sale and their prices today by channel; and which products (and sizes)
-- offer which groups. Never a cost.
create or replace function pos_addons() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date; v_location uuid;
begin
  v_today := business_local_date(v_business, now());
  v_location := default_location(v_business);
  return jsonb_build_object(
    'groups', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', g.id, 'name', g.name, 'name_ar', g.name_ar, 'name_ckb', g.name_ckb,
                  'min', g.min_select, 'max', g.max_select,
                  'modifiers', (select coalesce(jsonb_agg(jsonb_build_object(
                                   'id', m.id, 'name', m.name, 'name_ar', m.name_ar, 'name_ckb', m.name_ckb,
                                   'prices', (select coalesce(jsonb_object_agg(ch, pr), '{}')
                                                from (select ch, modifier_price_on(m.id, ch, v_location, v_today) pr
                                                        from unnest(enum_range(null::sales_channel)) ch) z
                                               where pr is not null))
                                   order by m.sort_order, m.name), '[]')
                                  from modifier m where m.group_id = g.id and m.is_active))
                 order by g.sort_order, g.name), '[]')
                 from modifier_group g where g.business_id = v_business and g.is_active),
    'offers', (select coalesce(jsonb_agg(jsonb_build_object('product_id', o.product_id, 'variant_id', o.product_variant_id,
                                                           'group_id', o.group_id)
                                         order by o.product_id, o.sort_order), '[]')
                 from product_modifier_group o join modifier_group g on g.id = o.group_id
                where o.business_id = v_business and g.is_active));
end $$;

-- ---------------------------------------------------------------------------
-- 5. A sale's lines with their add-ons
-- ---------------------------------------------------------------------------
-- 0040's post_sale. Each line may carry its add-ons ([{modifier_id, qty,
-- price}], price only from a bill): a line is sold at its size's price and its
-- add-ons', the discount is shared over both, and what the add-ons use is
-- taken with the line, locked, checked against the stock rules and costed.
-- The line keeps its add-ons as they were sold.
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric,
  p_trust_line_prices boolean default false, p_discount jsonb default null, p_turn_no int default null,
  p_stock_approval uuid default null)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_business uuid := p_business;
  v_me uuid := p_me;
  v_location uuid;
  v_order uuid;
  v_existing record;
  v_today date;
  v_needs jsonb; v_stock_by uuid;
  l jsonb; v_variant uuid; v_qty numeric; v_price numeric;
  v_variants uuid[] := '{}'; v_qtys numeric[] := '{}'; v_prices numeric[] := '{}'; v_gross_lines numeric[] := '{}';
  v_nets numeric[]; v_gross numeric := 0; v_discount numeric := 0; v_net numeric; v_cogs numeric := 0;
  d record; v_cost numeric; v_value numeric; v_line_cogs numeric; n int; i int;
  v_items uuid[];
  v_journal uuid;
  v_disc_by uuid; v_disc_approved uuid; v_disc_reason text; v_turn int; v_line uuid;
  v_mods jsonb[] := '{}'; v_mod jsonb; v_mod_costs numeric[]; v_amounts numeric[]; v_shares numeric[];
  v_part numeric; v_mod_cost numeric; j int; k int;
begin
  if p_idempotency_key is null then
    raise exception 'A sale needs its idempotency key';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  if p_tender not in ('cash', 'card', 'platform_paid') then
    raise exception 'Tender % is not supported', p_tender;
  end if;
  if is_platform_channel(p_channel) <> (p_tender = 'platform_paid') then
    raise exception 'Delivery-platform orders are platform-paid, and only they are';
  end if;

  -- Replay: the same key returns the sale it already recorded.
  select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
    from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'turn_no', v_existing.turn_no)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  if (p_discount_percent is not null or p_discount_amount is not null) and is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets its own discounts; none is given at the till';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, now());

  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
                           gross_amount, discount_amount, net_amount, cogs_amount, cashier_id)
  values (v_business, v_location, p_channel, 'open', p_idempotency_key, 0, 0, 0, 0, v_me)
  on conflict (business_id, idempotency_key) do nothing
  returning id into v_order;
  if v_order is null then
    -- A concurrent request with this key won the race; return its sale.
    select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
      from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'turn_no', v_existing.turn_no)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  -- Each line: a product on sale, a quantity, and its add-ons as the product
  -- offers them, priced (0041).
  for l in select * from jsonb_array_elements(p_lines) loop
    v_variant := (l ->> 'variant_id')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = v_variant and pv.business_id = v_business and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    v_variants := v_variants || v_variant;
    v_qtys := v_qtys || v_qty;
    v_mods := array_append(v_mods, line_modifiers(v_business, v_variant, l -> 'modifiers', p_channel, v_location,
                                                  v_today, p_trust_line_prices));
  end loop;
  n := cardinality(v_variants);

  -- What the sale uses, its add-ons' included: locked in a stable order, then
  -- sold as each item's rule says (0040): refused, sold with a manager's
  -- approval, or sold and shown as an alert.
  select jsonb_agg(jsonb_build_object('item_id', u.item_id, 'qty', u.base_qty)) into v_needs
    from (select e.item_id, e.base_qty
            from generate_series(1, n) s(ix), lateral expand_variant(v_variants[s.ix], p_channel, v_qtys[s.ix], v_today) e
          union all
          select e.item_id, e.base_qty
            from generate_series(1, n) s(ix), lateral jsonb_array_elements(v_mods[s.ix]) a(m),
                 lateral expand_modifier((a.m ->> 'modifier_id')::uuid, v_variants[s.ix], p_channel,
                                         v_qtys[s.ix] * (a.m ->> 'qty')::numeric) e) u;
  select array_agg(distinct (x ->> 'item_id')::uuid) into v_items from jsonb_array_elements(v_needs) x;
  if v_items is not null then
    perform lock_items(v_items);
    v_stock_by := stock_rules(v_business, v_location, v_needs, v_me, p_stock_approval, 'negative_stock',
                              v_order::text);
  end if;

  -- Price every line first: its size and its add-ons, each one of the line;
  -- the discount is shared out over the whole bill.
  for i in 1 .. n loop
    l := p_lines -> (i - 1);
    -- A bill's printed price, passed by settle_tab alone (0025); otherwise today's.
    v_price := case when p_trust_line_prices and nullif(l ->> 'price', '') is not null
                    then (l ->> 'price')::numeric
                    else price_on(v_variants[i], p_channel, v_location, v_today) end;
    if v_price is null then
      raise exception 'No % price is set for this product', p_channel;
    end if;
    v_price := v_price + coalesce((select sum((x ->> 'price')::numeric * (x ->> 'qty')::numeric)
                                     from jsonb_array_elements(v_mods[i]) x), 0);
    v_prices := v_prices || v_price;
    v_gross_lines := v_gross_lines || money_round(v_business, v_price * v_qtys[i]);
    v_gross := v_gross + money_round(v_business, v_price * v_qtys[i]);
  end loop;

  -- Each line's share of the discount, in proportion to its value, adding up
  -- to the discount exactly (the rounding method receipts use for landed costs).
  v_discount := sale_discount(v_business, v_gross, p_discount_percent, p_discount_amount);
  if v_discount > 0 then
    v_nets := allocate_landed(v_business, v_gross_lines, -v_discount);
    -- Who gave it, why, and who approved it (0028).
    if coalesce((p_discount ->> 'checked')::boolean, false) then
      v_disc_by := (p_discount ->> 'by')::uuid;
      v_disc_approved := (p_discount ->> 'approved_by')::uuid;
      v_disc_reason := p_discount ->> 'reason';
    else
      v_disc_reason := reason_text('discount', p_discount ->> 'reason', p_discount ->> 'note');
      v_disc_by := v_me;
      v_disc_approved := discount_approver(v_business, v_gross, p_discount_percent, p_discount_amount,
                                           (p_discount ->> 'approval')::uuid, v_order::text);
    end if;
  else
    v_nets := v_gross_lines;
  end if;
  v_net := v_gross - v_discount;

  for i in 1 .. n loop
    -- One costed movement per component per line, and per add-on, so every
    -- figure ties: line COGS = its movements; order COGS = all movements =
    -- the journal. Cost first, then write the line once: lines are
    -- append-only. Each movement names its line (0037), so a refund of the
    -- line takes back its own stock, its add-ons' included.
    v_line := gen_random_uuid();
    v_line_cogs := 0;
    for d in select * from expand_variant(v_variants[i], p_channel, v_qtys[i], v_today) loop
      v_cost := item_issue_cost(v_business, d.item_id, v_location);
      v_value := money_round(v_business, v_cost * d.base_qty);
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                      unit_cost, value, reference_type, reference_id, app_user_id, reason,
                                      sales_order_line_id)
      values (v_business, d.item_id, v_location, 'sale_consumption', -d.base_qty,
              case when d.base_qty > 0 then v_value / d.base_qty end, v_value,
              'sales_order', v_order, v_me, 'Sale', v_line);
      v_line_cogs := v_line_cogs + v_value;
    end loop;
    v_mod_costs := '{}';
    v_amounts := '{}';
    k := coalesce(jsonb_array_length(v_mods[i]), 0);
    for j in 1 .. k loop
      v_mod := v_mods[i] -> (j - 1);
      v_mod_cost := 0;
      for d in select * from expand_modifier((v_mod ->> 'modifier_id')::uuid, v_variants[i], p_channel,
                                             v_qtys[i] * (v_mod ->> 'qty')::numeric) loop
        v_cost := item_issue_cost(v_business, d.item_id, v_location);
        v_value := money_round(v_business, v_cost * d.base_qty);
        insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                        unit_cost, value, reference_type, reference_id, app_user_id, reason,
                                        sales_order_line_id)
        values (v_business, d.item_id, v_location, 'sale_consumption', -d.base_qty,
                case when d.base_qty > 0 then v_value / d.base_qty end, v_value,
                'sales_order', v_order, v_me, 'Sale: ' || (v_mod ->> 'name'), v_line);
        v_mod_cost := v_mod_cost + v_value;
      end loop;
      v_mod_costs := v_mod_costs || v_mod_cost;
      v_line_cogs := v_line_cogs + v_mod_cost;
      v_amounts := v_amounts || money_round(v_business, (v_mod ->> 'price')::numeric * (v_mod ->> 'qty')::numeric
                                                        * v_qtys[i]);
    end loop;

    insert into sales_order_line (id, sales_order_id, product_variant_id, quantity, unit_price, line_discount, line_net,
                                  cogs_amount)
    values (v_line, v_order, v_variants[i], v_qtys[i], v_prices[i], v_gross_lines[i] - v_nets[i], v_nets[i],
            v_line_cogs);
    v_cogs := v_cogs + v_line_cogs;

    -- The add-ons as they were sold: each its amount and its share of the
    -- line's discount, the size keeping the rest.
    if k > 0 then
      v_part := v_gross_lines[i] - (select coalesce(sum(a), 0) from unnest(v_amounts) a);
      if v_nets[i] < v_gross_lines[i] then
        v_shares := allocate_landed(v_business, array[v_part] || v_amounts, v_nets[i] - v_gross_lines[i]);
      else
        v_shares := array[v_part] || v_amounts;
      end if;
      for j in 1 .. k loop
        v_mod := v_mods[i] -> (j - 1);
        insert into sales_order_line_modifier (business_id, sales_order_id, sales_order_line_id, modifier_id, group_id,
                                               name, qty, unit_price, amount, net_amount, cost, position)
        values (v_business, v_order, v_line, (v_mod ->> 'modifier_id')::uuid, (v_mod ->> 'group_id')::uuid,
                v_mod ->> 'name', (v_mod ->> 'qty')::numeric * v_qtys[i], (v_mod ->> 'price')::numeric,
                v_amounts[j], v_shares[j + 1], v_mod_costs[j], j);
      end loop;
    end if;
  end loop;

  insert into sales_tender (sales_order_id, tender_type, amount) values (v_order, p_tender, v_net);

  -- Its turn number (0034): the bill's own, or the next of the day. Taken in
  -- the sale's own transaction, so a sale refused takes none.
  v_turn := coalesce(p_turn_no, take_turn_no(v_business, v_today));
  update sales_order
     set gross_amount = v_gross, discount_amount = v_discount, net_amount = v_net, cogs_amount = v_cogs,
         discount_percent = case when v_discount > 0 then p_discount_percent end,
         discount_by = v_disc_by, discount_approved_by = v_disc_approved, discount_reason = v_disc_reason,
         status = 'completed', turn_no = v_turn
   where id = v_order;

  -- Revenue at the full price; the discount on its own line (none posts when it is zero).
  v_journal := post_journal(v_business, now(), 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
    jsonb_build_array(
      jsonb_build_object('code', tender_account(p_tender), 'debit', v_net),
      jsonb_build_object('code', '4100', 'debit', v_discount),
      jsonb_build_object('code', '4000', 'credit', v_gross),
      jsonb_build_object('code', '5000', 'debit', v_cogs),
      jsonb_build_object('code', '1200', 'credit', v_cogs)));

  if v_discount > 0 then
    perform audit_event(v_business, 'sale.discount', 'sales_order', v_order::text, v_disc_reason, null,
      jsonb_build_object('gross', v_gross, 'discount', v_discount, 'percent', p_discount_percent,
                         'amount', p_discount_amount, 'given_by', v_disc_by, 'approved_by', v_disc_approved));
  end if;

  return jsonb_build_object('order_id', v_order, 'gross', v_gross, 'discount', v_discount, 'net', v_net,
    'journal_no', (select journal_no from journal_entry where id = v_journal), 'replayed', false,
    'turn_no', v_turn)
    || sale_cost_view(v_cogs);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Bills: a line's add-ons saved, frozen, split and paid with it
-- ---------------------------------------------------------------------------
-- 0040's settle_tab: each line's add-ons go with it, at the prices the bill
-- froze when it was printed (today's otherwise).
create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type,
                                      p_expected_net numeric default null, p_stock_approval uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); t pos_tab; v_lines jsonb; r jsonb;
begin
  select * into t from pos_tab where id = p_tab and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if t.status = 'paid' then
    return (select jsonb_build_object(
              'tab_id', t.id, 'order_id', o.id, 'replayed', true,
              'gross', o.gross_amount, 'discount', o.discount_amount, 'net', o.net_amount,
              'journal_no', (select journal_no from journal_entry
                              where reference_type = 'sales_order' and reference_id = o.id
                                and reverses_entry is null limit 1),
              'turn_no', o.turn_no)
              from sales_order o where o.id = t.sales_order_id);
  end if;
  t := lock_open_tab(v_business, p_tab, p_version);
  select jsonb_agg(jsonb_build_object('variant_id', tl.product_variant_id, 'qty', tl.qty, 'price', tl.unit_price,
                     'modifiers', (select coalesce(jsonb_agg(jsonb_build_object('modifier_id', lm.modifier_id,
                                                             'qty', lm.qty, 'price', lm.unit_price)
                                                           order by lm.position, lm.id), '[]')
                                     from pos_tab_line_modifier lm where lm.tab_line_id = tl.id))
                   order by tl.position)
    into v_lines from pos_tab_line tl where tl.tab_id = p_tab;
  if v_lines is null then raise exception 'The bill is empty'; end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, t.channel, p_tender, v_lines,
                 t.location_id, t.discount_percent, t.discount_amount, true,
                 jsonb_build_object('checked', true, 'by', t.discount_by, 'approved_by', t.discount_approved_by,
                                    'reason', t.discount_reason),
                 t.turn_no, p_stock_approval);
  if coalesce((r ->> 'replayed')::boolean, false) then
    -- That key already paid for something else: never attach its sale to this bill.
    raise exception 'That payment was already used for another sale. Try again.';
  end if;
  perform assert_sale_total(r, p_expected_net);
  update pos_tab
     set status = 'paid', sales_order_id = (r ->> 'order_id')::uuid, closed_at = now(),
         closed_by = (current_member()).id, turn_no = (r ->> 'turn_no')::int
   where id = p_tab;
  return r || jsonb_build_object('tab_id', p_tab);
end $$;

-- 0040's save_tab (0035's __run): each line's add-ons checked as the sale
-- checks them, priced at what the bill froze for them or today's, and kept; an
-- add-on taken off a printed bill is something taken off it.
create or replace function save_tab__run(p_tab uuid, p_version int, p_lines jsonb, p_label text default null,
                                    p_table uuid default null, p_discount_percent numeric default null,
                                    p_discount_amount numeric default null, p_discount_reason text default null,
                                    p_discount_note text default null, p_approval uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  t pos_tab; l jsonb; i int := 0; v_before jsonb; v_today date; v_was jsonb; v_now jsonb; v_frozen jsonb;
  v_gross numeric := 0; v_price numeric; v_reduced boolean;
  v_disc_by uuid; v_disc_approved uuid; v_disc_reason text; v_share numeric; v_allowed numeric;
  v_frozen_mods jsonb; v_in jsonb; v_mods jsonb[] := '{}'; v_all_mods jsonb := '[]'; v_tab_line uuid; v_m jsonb;
  j int;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  v_today := business_local_date(v_business, now());
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'The bill has no lines'; end if;
  -- What the customer was shown keeps its printed price (0025); anything not
  -- yet printed is priced when the bill is printed, or paid. So are add-ons.
  select coalesce(jsonb_object_agg(v, p), '{}'::jsonb) into v_frozen
    from (select product_variant_id::text v, min(unit_price) p from pos_tab_line
           where tab_id = p_tab and unit_price is not null group by 1) x;
  select coalesce(jsonb_object_agg(v, p), '{}'::jsonb) into v_frozen_mods
    from (select modifier_id::text v, min(unit_price) p from pos_tab_line_modifier
           where tab_id = p_tab and unit_price is not null group by 1) x;
  for l in select * from jsonb_array_elements(p_lines) loop
    if coalesce((l ->> 'qty')::numeric, 0) <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = (l ->> 'variant_id')::uuid and pv.business_id = v_business
                      and pv.is_active and p.is_active) then
      raise exception 'A product on the bill is not on sale';
    end if;
    -- Refused now, not when the customer comes to pay.
    v_price := coalesce((v_frozen ->> (l ->> 'variant_id'))::numeric,
                        price_on((l ->> 'variant_id')::uuid, t.channel, t.location_id, v_today));
    if v_price is null then
      raise exception 'No % price is set for %', t.channel,
        (select p.name from product_variant pv join product p on p.id = pv.product_id
          where pv.id = (l ->> 'variant_id')::uuid);
    end if;
    -- Its add-ons, at the prices the bill froze for them (none sent by the till is taken).
    if jsonb_typeof(l -> 'modifiers') not in ('array', 'null') then raise exception 'The add-ons cannot be read'; end if;
    select coalesce(jsonb_agg(case when jsonb_typeof(a) = 'object'
                                   then a || jsonb_build_object('price', v_frozen_mods -> (a ->> 'modifier_id'))
                                   else a end), '[]')
      into v_in
      from jsonb_array_elements(case when jsonb_typeof(l -> 'modifiers') = 'array' then l -> 'modifiers' else '[]' end) a;
    v_mods := array_append(v_mods, line_modifiers(v_business, (l ->> 'variant_id')::uuid, v_in, t.channel,
                                                  t.location_id, v_today, true));
    v_price := v_price + coalesce((select sum((w ->> 'price')::numeric * (w ->> 'qty')::numeric)
                                     from jsonb_array_elements(v_mods[cardinality(v_mods)]) w), 0);
    v_all_mods := v_all_mods || coalesce((select jsonb_agg(jsonb_build_object('v', w ->> 'modifier_id',
                                                   'q', (w ->> 'qty')::numeric * (l ->> 'qty')::numeric))
                                            from jsonb_array_elements(v_mods[cardinality(v_mods)]) w), '[]');
    v_gross := v_gross + money_round(v_business, v_price * (l ->> 'qty')::numeric);
  end loop;
  if p_table is not null and p_table is distinct from t.table_id
     and not exists (select 1 from dining_table where id = p_table and business_id = v_business
                       and is_active and location_id = t.location_id) then
    raise exception 'That table is not in use';
  end if;

  -- A discount is given only by someone allowed to, with its reason, and above
  -- the cap with a manager's approval (0028). Once the customer has seen the
  -- bill, changing it is a manager's call; taking it off never is.
  v_disc_by := t.discount_by; v_disc_approved := t.discount_approved_by; v_disc_reason := t.discount_reason;
  v_was := jsonb_build_object('percent', t.discount_percent, 'amount', t.discount_amount);
  v_now := jsonb_build_object('percent', p_discount_percent, 'amount', p_discount_amount);
  if v_now is distinct from v_was then
    if p_discount_percent is not null or p_discount_amount is not null then
      if not current_has_permission('discount.apply') then
        raise exception 'You do not have permission to give discounts' using errcode = '42501';
      end if;
      perform sale_discount(v_business, 0, p_discount_percent, p_discount_amount);
      if t.bill_printed_at is not null and not current_has_permission('sale.void') then
        raise exception 'Only a manager can change the discount on a bill that has been printed' using errcode = '42501';
      end if;
      v_disc_reason := reason_text('discount', p_discount_reason, p_discount_note);
      v_disc_approved := discount_approver(v_business, v_gross, p_discount_percent, p_discount_amount,
                                           p_approval, p_tab::text);
      v_disc_by := v_me;
    else
      v_disc_by := null; v_disc_approved := null; v_disc_reason := null;
    end if;
    if t.bill_printed_at is not null or t.discount_percent is not null or t.discount_amount is not null then
      perform audit_event(v_business, 'bill.discount', 'pos_tab', p_tab::text, v_disc_reason, v_was,
                          v_now || jsonb_build_object('approved_by', v_disc_approved));
    end if;
  elsif p_discount_amount is not null and not current_has_permission('discount.approve') then
    -- An amount stays as it was given while the bill changes: taking things
    -- off must not make it more of the bill than the cap, or than a manager
    -- approved (a manager's own discount is theirs, whatever the bill).
    v_share := discount_share(v_gross, null, p_discount_amount);
    v_allowed := member_rule_number(v_business, 'discount_cap_percent', coalesce(t.discount_by, v_me));
    if t.discount_approved_by is not null then
      v_allowed := greatest(v_allowed, coalesce((
        select (a.scope ->> 'percent')::numeric from approval a
         where a.business_id = v_business and a.kind = 'discount' and a.used_for = p_tab::text
           and a.approver_id = t.discount_approved_by
         order by a.used_at desc limit 1), 0));
    elsif t.discount_by is not null and member_has_permission(t.discount_by, 'discount.approve') then
      v_allowed := 100;
    end if;
    if v_share > v_allowed then
      raise exception '%', format('The %s off would be %s%% of the bill, over the %s%% allowed: take the discount off first, or ask a manager',
        trim_scale(p_discount_amount), trim_scale(v_share), trim_scale(v_allowed));
    end if;
  end if;

  -- Anything taken off the bill, an add-on included, is recorded; once the
  -- customer has seen it, taking anything off is a manager's call.
  select exists (
       select 1
         from (select product_variant_id v, sum(qty) q from pos_tab_line where tab_id = p_tab group by 1) was
         left join (select (x ->> 'variant_id')::uuid v, sum((x ->> 'qty')::numeric) q
                      from jsonb_array_elements(p_lines) x group by 1) now_ on now_.v = was.v
        where coalesce(now_.q, 0) < was.q)
      or exists (
       select 1
         from (select lm.modifier_id::text v, sum(lm.qty * tl.qty) q
                 from pos_tab_line_modifier lm join pos_tab_line tl on tl.id = lm.tab_line_id
                where lm.tab_id = p_tab group by 1) was
         left join (select w ->> 'v' v, sum((w ->> 'q')::numeric) q from jsonb_array_elements(v_all_mods) w group by 1) now_
           on now_.v = was.v
        where coalesce(now_.q, 0) < was.q)
    into v_reduced;
  if v_reduced then
    if t.bill_printed_at is not null and not current_has_permission('sale.void') then
      raise exception 'Only a manager can take items off a bill that has been printed' using errcode = '42501';
    end if;
    select jsonb_agg(jsonb_build_object('variant_id', tl.product_variant_id, 'qty', tl.qty,
                       'modifiers', (select coalesce(jsonb_agg(jsonb_build_object('modifier_id', lm.modifier_id,
                                                               'qty', lm.qty) order by lm.position, lm.id), '[]')
                                       from pos_tab_line_modifier lm where lm.tab_line_id = tl.id))
                     order by tl.position)
      into v_before from pos_tab_line tl where tl.tab_id = p_tab;
    perform audit_event(v_business, case when t.bill_printed_at is not null then 'bill.reduce' else 'bill.line_remove' end,
                        'pos_tab', p_tab::text, null,
                        jsonb_build_object('lines', v_before), jsonb_build_object('lines', p_lines));
  end if;

  delete from pos_tab_line where tab_id = p_tab;
  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    insert into pos_tab_line (tab_id, business_id, product_variant_id, qty, note, position, added_by, unit_price)
    values (p_tab, v_business, (l ->> 'variant_id')::uuid, (l ->> 'qty')::numeric,
            left(nullif(trim(l ->> 'note'), ''), 200), i, v_me, (v_frozen ->> (l ->> 'variant_id'))::numeric)
    returning id into v_tab_line;
    j := 0;
    for v_m in select * from jsonb_array_elements(v_mods[i]) loop
      j := j + 1;
      insert into pos_tab_line_modifier (business_id, tab_id, tab_line_id, modifier_id, qty, unit_price, position)
      values (v_business, p_tab, v_tab_line, (v_m ->> 'modifier_id')::uuid, (v_m ->> 'qty')::int,
              (v_frozen_mods ->> (v_m ->> 'modifier_id'))::numeric, j);
    end loop;
  end loop;
  update pos_tab
     set version = version + 1,
         label = coalesce(nullif(trim(p_label), ''), label),
         table_id = coalesce(p_table, table_id),
         discount_percent = p_discount_percent,
         discount_amount = p_discount_amount,
         discount_by = v_disc_by,
         discount_approved_by = v_disc_approved,
         discount_reason = v_disc_reason
   where id = p_tab;
  return jsonb_build_object('tab_id', p_tab, 'version', t.version + 1);
end $$;

-- 0035's split_tab__run: a line moved to the new bill takes its add-ons, at
-- the prices it carries.
create or replace function split_tab__run(p_tab uuid, p_version int, p_move jsonb, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  t pos_tab; m jsonb; v_line pos_tab_line; v_qty numeric; v_new uuid; i int := 0; v_new_line uuid;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  if p_move is null or jsonb_typeof(p_move) <> 'array' or jsonb_array_length(p_move) = 0 then
    raise exception 'Choose what to move to the new bill';
  end if;
  if (select count(distinct x ->> 'line_id') from jsonb_array_elements(p_move) x) <> jsonb_array_length(p_move) then
    raise exception 'Each line can be moved once';
  end if;
  insert into pos_tab (business_id, location_id, table_id, label, channel, business_day, opened_by,
                       bill_printed_at, discount_percent, discount_by, discount_approved_by, discount_reason,
                       turn_no)
  values (v_business, t.location_id, t.table_id,
          coalesce(nullif(trim(p_label), ''), t.label), t.channel, t.business_day, v_me, t.bill_printed_at,
          t.discount_percent,
          case when t.discount_percent is not null then t.discount_by end,
          case when t.discount_percent is not null then t.discount_approved_by end,
          case when t.discount_percent is not null then t.discount_reason end,
          t.turn_no)
  returning id into v_new;
  for m in select * from jsonb_array_elements(p_move) loop
    select * into v_line from pos_tab_line where id = (m ->> 'line_id')::uuid and tab_id = p_tab;
    if not found then raise exception 'That line is not on this bill'; end if;
    v_qty := (m ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > v_line.qty then
      raise exception 'Move between 1 and % of %', v_line.qty,
        (select p.name from product_variant pv join product p on p.id = pv.product_id where pv.id = v_line.product_variant_id);
    end if;
    i := i + 1;
    insert into pos_tab_line (tab_id, business_id, product_variant_id, qty, note, position, added_by, unit_price)
    values (v_new, v_business, v_line.product_variant_id, v_qty, v_line.note, i, v_me, v_line.unit_price)
    returning id into v_new_line;
    insert into pos_tab_line_modifier (business_id, tab_id, tab_line_id, modifier_id, qty, unit_price, position)
    select lm.business_id, v_new, v_new_line, lm.modifier_id, lm.qty, lm.unit_price, lm.position
      from pos_tab_line_modifier lm where lm.tab_line_id = v_line.id;
    if v_qty = v_line.qty then
      delete from pos_tab_line where id = v_line.id;
    else
      update pos_tab_line set qty = qty - v_qty where id = v_line.id;
    end if;
  end loop;
  update pos_tab set version = version + 1 where id = p_tab;
  perform audit_event(v_business, 'bill.split', 'pos_tab', p_tab::text, null, null,
                      jsonb_build_object('new_tab', v_new, 'moved', p_move));
  return jsonb_build_object('tab_id', v_new, 'version', 1, 'from_tab', p_tab, 'from_version', t.version + 1);
end $$;

-- 0035's mark_bill_printed__run: the add-ons' prices are frozen with the lines'.
create or replace function mark_bill_printed__run(p_tab uuid, p_version int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); t pos_tab; v_today date;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  if not exists (select 1 from pos_tab_line where tab_id = p_tab) then
    raise exception 'The bill is empty';
  end if;
  v_today := business_local_date(v_business, now());
  -- The customer now holds these prices: the bill is paid at them (0025).
  update pos_tab_line tl
     set unit_price = price_on(tl.product_variant_id, t.channel, t.location_id, v_today)
   where tl.tab_id = p_tab and tl.unit_price is null;
  update pos_tab_line_modifier lm
     set unit_price = modifier_price_on(lm.modifier_id, t.channel, t.location_id, v_today)
   where lm.tab_id = p_tab and lm.unit_price is null;
  update pos_tab set bill_printed_at = now(), bill_print_count = bill_print_count + 1
   where id = p_tab;
  return jsonb_build_object('tab_id', p_tab, 'version', t.version, 'print_count', t.bill_print_count + 1);
end $$;

-- 0034's pos_open_bills: each line with its add-ons, priced as the bill has
-- them (a line's price is its size's; each add-on has its own).
create or replace function pos_open_bills()
returns table (tab_id uuid, version integer, table_id uuid, table_name text, label text, channel sales_channel,
               business_day date, opened_at timestamptz, opened_by text, bill_printed_at timestamptz,
               bill_print_count integer, lines jsonb, total numeric, subtotal numeric, discount numeric,
               discount_percent numeric, discount_amount numeric, discount_reason text, discount_by text,
               discount_approved_by text, turn_no integer)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    with l as (
      select tl.tab_id, tl.id, tl.position, tl.product_variant_id, tl.qty, tl.note, p.name as product_name,
             pv.name as variant_name,
             coalesce(tl.unit_price, price_on(tl.product_variant_id, t.channel, t.location_id, v_today)) as price,
             (select coalesce(jsonb_agg(jsonb_build_object(
                        'modifier_id', lm.modifier_id, 'name', md.name, 'name_ar', md.name_ar,
                        'name_ckb', md.name_ckb, 'qty', lm.qty,
                        'price', coalesce(lm.unit_price, modifier_price_on(lm.modifier_id, t.channel, t.location_id,
                                                                           v_today)))
                      order by lm.position, lm.id), '[]')
                from pos_tab_line_modifier lm join modifier md on md.id = lm.modifier_id
               where lm.tab_line_id = tl.id) as modifiers
        from pos_tab t
        join pos_tab_line tl on tl.tab_id = t.id
        join product_variant pv on pv.id = tl.product_variant_id
        join product p on p.id = pv.product_id
       where t.business_id = v_business and t.status = 'open'
    ),
    b as (
      select t.*,
             coalesce((select sum(money_round(v_business,
                                  (l.price + coalesce((select sum((a ->> 'price')::numeric * (a ->> 'qty')::numeric)
                                                         from jsonb_array_elements(l.modifiers) a), 0)) * l.qty))
                         from l where l.tab_id = t.id), 0) as gross
        from pos_tab t
       where t.business_id = v_business and t.status = 'open'
    )
    select b.id, b.version, b.table_id, dt.name, b.label, b.channel, b.business_day, b.opened_at, au.full_name,
           b.bill_printed_at, b.bill_print_count,
           coalesce((select jsonb_agg(jsonb_build_object(
                               'line_id', l.id, 'variant_id', l.product_variant_id, 'qty', l.qty, 'note', l.note,
                               'product_name', l.product_name, 'variant_name', l.variant_name, 'price', l.price,
                               'modifiers', l.modifiers)
                             order by l.position)
                       from l where l.tab_id = b.id), '[]'::jsonb),
           b.gross - sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.gross,
           sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.discount_percent, b.discount_amount,
           b.discount_reason, db.full_name, dab.full_name, b.turn_no
      from b
      left join dining_table dt on dt.id = b.table_id
      left join app_user au on au.id = b.opened_by
      left join app_user db on db.id = b.discount_by
      left join app_user dab on dab.id = b.discount_approved_by
     order by b.opened_at;
end $$;

-- ---------------------------------------------------------------------------
-- 7. What sold, by size and by add-on
-- ---------------------------------------------------------------------------
-- Each size and each add-on sold between two days (voids left out; refunds are
-- in Sales by Channel): how many, on how many lines, for how much after
-- discounts, at what cost of its recipe, and the margin. An add-on is also
-- set against the lines of the products that offer its group now.
create or replace function report_sizes_and_addons(p_from date, p_to date)
returns table (kind text, product text, name text, qty numeric, lines bigint, sales numeric, cost numeric,
               margin numeric, offered bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_start timestamptz; v_end timestamptz;
begin
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Choose the dates, the first before the last'; end if;
  select bd.from_ts, bd.to_ts into v_start, v_end from local_day_bounds(v_business, p_from, p_to) bd;
  return query
    with sold as (
      select sl.id as line_id, sl.product_variant_id as variant_id, pv.product_id as product_id,
             sl.quantity as line_qty, sl.line_net as line_net, coalesce(sl.cogs_amount, 0) as line_cost
        from sales_order_line sl
        join sales_order so on so.id = sl.sales_order_id
        join product_variant pv on pv.id = sl.product_variant_id
       where so.business_id = v_business and so.status not in ('voided', 'open')
         and so.placed_at >= v_start and so.placed_at < v_end),
    added as (
      select lm.sales_order_line_id as line_id, lm.modifier_id as modifier_id, lm.group_id as group_id,
             lm.name as addon_name, lm.qty as addon_qty, lm.net_amount as addon_net, lm.cost as addon_cost
        from sales_order_line_modifier lm join sold s on s.line_id = lm.sales_order_line_id),
    per_line as (
      select a.line_id, sum(a.addon_net) as addon_net, sum(a.addon_cost) as addon_cost
        from added a group by a.line_id)
    select 'size'::text, pr.name, pv.name, sum(s.line_qty), count(*),
           sum(s.line_net - coalesce(pl.addon_net, 0)),
           sum(s.line_cost - coalesce(pl.addon_cost, 0)),
           sum(s.line_net - coalesce(pl.addon_net, 0)) - sum(s.line_cost - coalesce(pl.addon_cost, 0)),
           null::bigint
      from sold s
      join product_variant pv on pv.id = s.variant_id
      join product pr on pr.id = pv.product_id
      left join per_line pl on pl.line_id = s.line_id
     group by pr.id, pr.name, pv.id, pv.name
    union all
    select 'addon'::text, coalesce(g.name, ''), a.addon_name, sum(a.addon_qty), count(distinct a.line_id),
           sum(a.addon_net), sum(a.addon_cost), sum(a.addon_net) - sum(a.addon_cost),
           (select count(*) from sold s2
             where exists (select 1 from product_modifier_group o
                            where o.group_id = a.group_id and o.product_id = s2.product_id
                              and (o.product_variant_id is null or o.product_variant_id = s2.variant_id)))
      from added a
      left join modifier_group g on g.id = a.group_id
     group by a.modifier_id, a.group_id, g.name, a.addon_name
     order by 1 desc, 2, 3;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  assert_size_name_free(uuid, text, uuid),
  add_variant__run(uuid, text, jsonb, jsonb, uuid, text, text, text, text),
  update_variant__run(uuid, text, text, text),
  retire_variant__run(uuid, boolean, text),
  modifier_price_on(uuid, sales_channel, uuid, date),
  expand_modifier(uuid, uuid, sales_channel, numeric),
  line_modifiers(uuid, uuid, jsonb, sales_channel, uuid, date, boolean),
  modifier_open_bill(uuid, uuid, uuid, uuid),
  save_modifier_group__run(uuid, text, int, int, int, boolean, text, text),
  put_modifier_price(uuid, uuid, sales_channel, numeric, date),
  put_modifier_recipe(uuid, uuid, uuid, jsonb),
  save_modifier__run(uuid, uuid, text, int, boolean, jsonb, jsonb, text, text),
  set_modifier_price__run(uuid, sales_channel, numeric, date),
  set_modifier_recipe__run(uuid, uuid, jsonb),
  set_product_modifiers__run(uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function
  add_variant(uuid, text, jsonb, jsonb, uuid, text, text, text, text, uuid),
  update_variant(uuid, text, text, text, uuid),
  retire_variant(uuid, boolean, text, uuid),
  save_modifier_group(uuid, text, int, int, int, boolean, text, text, uuid),
  save_modifier(uuid, uuid, text, int, boolean, jsonb, jsonb, text, text, uuid),
  set_modifier_price(uuid, sales_channel, numeric, date, uuid),
  set_modifier_recipe(uuid, uuid, jsonb, uuid),
  set_product_modifiers(uuid, jsonb, uuid),
  pos_addons(),
  report_sizes_and_addons(date, date)
  from public, anon;
grant execute on function
  add_variant(uuid, text, jsonb, jsonb, uuid, text, text, text, text, uuid),
  update_variant(uuid, text, text, text, uuid),
  retire_variant(uuid, boolean, text, uuid),
  save_modifier_group(uuid, text, int, int, int, boolean, text, text, uuid),
  save_modifier(uuid, uuid, text, int, boolean, jsonb, jsonb, text, text, uuid),
  set_modifier_price(uuid, sales_channel, numeric, date, uuid),
  set_modifier_recipe(uuid, uuid, jsonb, uuid),
  set_product_modifiers(uuid, jsonb, uuid),
  pos_addons(),
  report_sizes_and_addons(date, date)
  to authenticated;
