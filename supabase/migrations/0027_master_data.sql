-- =============================================================================
-- 0027 — Master data: who changed what, prices checked at delivery, items and
--        suppliers kept right
-- =============================================================================
-- The September 2026 audit's P1-1, P1-3 and P1-4 (docs/SYSTEM_AUDIT_2026-09.md):
--
--  * P1-1. Changes to prices and master data left no trace of who. Now every
--    change to a product or its variants, a category, a stock item or its units,
--    a supplier, a location or a business setting writes an audit row, by
--    trigger, with the values before and after and the person — a change made
--    in SQL too, with no person, which is itself worth seeing. Every price set is
--    audited the same way and says who set it. Opening stock is the owner's,
--    with a reason. A batch recipe change is audited. The older
--    new_recipe_version, which bypassed the audited "Change the recipe", is
--    retired. Each sale line keeps the product's name as it was sold, so
--    renaming a product does not relabel history.
--  * P1-3. A delivery line can be given as a price per unit. A cost more than
--    25% away from the item's cost now (or its last delivery) is refused unless
--    the person confirms it: "2.5 or 50?" is asked before the stock is costed,
--    not found afterwards. Each item's price history, supplier by supplier.
--  * P1-4. Items and suppliers can be corrected (name, type, levels, in use),
--    pack units added (a unit in use keeps its size), and names are unique,
--    ignoring case, spaces and punctuation, among those in use.
--
-- Nothing recorded before this migration changes.

-- =============================================================================
-- 1. Who changed what (P1-1)
-- =============================================================================
-- A row created or deleted, or the columns that changed and their values
-- before and after. The person is whoever is signed in (none for SQL); a
-- function may give a reason in the transaction's audit.reason.
create or replace function audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_business uuid;
  v_before jsonb;
  v_after jsonb;
  k text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_business := case when tg_table_name = 'business' then (v_row ->> 'id')::uuid
                     else (v_row ->> 'business_id')::uuid end;
  if tg_op = 'INSERT' then
    v_after := v_row - 'created_at';
  elsif tg_op = 'DELETE' then
    -- Deleted with its business: nothing is left to hold the record.
    if not exists (select 1 from business where id = v_business) then return null; end if;
    v_before := v_row - 'created_at';
  else
    v_old := to_jsonb(old);
    v_before := '{}'::jsonb;
    v_after := '{}'::jsonb;
    for k in select jsonb_object_keys(v_row) loop
      if k <> 'created_at' and (v_old -> k) is distinct from (v_row -> k) then
        v_before := v_before || jsonb_build_object(k, v_old -> k);
        v_after := v_after || jsonb_build_object(k, v_row -> k);
      end if;
    end loop;
    if v_after = '{}'::jsonb then return null; end if;
  end if;
  perform audit_event(v_business,
    tg_table_name || case tg_op when 'INSERT' then '.create' when 'DELETE' then '.delete' else '.update' end,
    tg_table_name, v_row ->> 'id', nullif(current_setting('audit.reason', true), ''), v_before, v_after);
  return null;
end $$;

create trigger audit_change after insert or update or delete on product
  for each row execute function audit_row_change();
create trigger audit_change after insert or update or delete on product_variant
  for each row execute function audit_row_change();
create trigger audit_change after insert or update or delete on product_category
  for each row execute function audit_row_change();
create trigger audit_change after insert or update or delete on item
  for each row execute function audit_row_change();
create trigger audit_change after insert or update or delete on item_unit
  for each row execute function audit_row_change();
create trigger audit_change after insert or update or delete on supplier
  for each row execute function audit_row_change();
create trigger audit_change after insert or update or delete on business
  for each row execute function audit_row_change();
create trigger audit_change after insert or update or delete on location
  for each row execute function audit_row_change();

-- Every price set, however it is set, with the price it replaces; and who set
-- it. A price withdrawn, or changed in SQL, is on the trail too.
alter table channel_price add column if not exists created_by uuid references app_user (id)
  default current_app_user_id();

create or replace function audit_price_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_was numeric; v_reason text := nullif(current_setting('audit.reason', true), '');
  v_old jsonb; v_new jsonb; v_before jsonb := '{}'; v_after jsonb := '{}'; k text;
begin
  if tg_op = 'INSERT' then
    select cp.price into v_was from channel_price cp
     where cp.product_variant_id = new.product_variant_id and cp.channel = new.channel and cp.id <> new.id
       and cp.effective_from <= new.effective_from
       and (cp.effective_to is null or cp.effective_to >= new.effective_from)
       and (cp.location_id is null or cp.location_id is not distinct from new.location_id)
     order by (cp.location_id is not null) desc, cp.effective_from desc, cp.created_at desc limit 1;
    perform audit_event(new.business_id, 'price.set', 'channel_price', new.id::text, v_reason,
      jsonb_build_object('variant', new.product_variant_id, 'channel', new.channel, 'price', v_was),
      jsonb_build_object('variant', new.product_variant_id, 'channel', new.channel, 'price', new.price,
                         'effective_from', new.effective_from));
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    for k in select jsonb_object_keys(v_new) loop
      if (v_old -> k) is distinct from (v_new -> k) then
        v_before := v_before || jsonb_build_object(k, v_old -> k);
        v_after := v_after || jsonb_build_object(k, v_new -> k);
      end if;
    end loop;
    if v_after <> '{}' then
      perform audit_event(new.business_id, 'price.update', 'channel_price', new.id::text, v_reason,
        v_before || jsonb_build_object('variant', new.product_variant_id, 'channel', new.channel),
        v_after || jsonb_build_object('variant', new.product_variant_id, 'channel', new.channel));
    end if;
  elsif exists (select 1 from business where id = old.business_id) then
    perform audit_event(old.business_id, 'price.cancel', 'channel_price', old.id::text, v_reason, to_jsonb(old), null);
  end if;
  return null;
end $$;

create trigger audit_price after insert or update or delete on channel_price
  for each row execute function audit_price_change();

-- 0025's set_price: its audit is now the trigger's, for every way a price is set.
create or replace function set_price(p_variant uuid, p_channel sales_channel, p_price numeric, p_effective_from date default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); v_today date; v_from date;
begin
  if not exists (select 1 from product_variant where id = p_variant and business_id = v_business) then
    raise exception 'Unknown product';
  end if;
  if p_price is null or p_price < 0 then raise exception 'Enter a price'; end if;
  v_today := business_local_date(v_business, now());
  v_from := coalesce(p_effective_from, v_today);
  if v_from < v_today then
    raise exception 'A price cannot start in the past: every sale keeps the price it was made at';
  end if;
  insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
  values (v_business, p_variant, p_channel, p_price, v_from);
end $$;

-- 0025's cancel_scheduled_price: audited by the trigger too, with the reason.
create or replace function cancel_scheduled_price(p_price uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); cp channel_price;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the change is cancelled'; end if;
  select * into cp from channel_price where id = p_price and business_id = v_business for update;
  if not found then raise exception 'Price not found'; end if;
  if cp.effective_from <= business_local_date(v_business, now()) then
    raise exception 'That price is already in force: set a new price instead';
  end if;
  perform set_config('audit.reason', trim(p_reason), true);
  delete from channel_price where id = p_price;
  perform set_config('audit.reason', '', true);
end $$;

-- Each sale line keeps the product's name as it was sold.
alter table sales_order_line add column if not exists product_name text;

create or replace function name_sale_line() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.product_name is null then
    select p.name || case when pv.name is distinct from p.name then ' — ' || pv.name else '' end
      into new.product_name
      from product_variant pv join product p on p.id = pv.product_id
     where pv.id = new.product_variant_id;
  end if;
  return new;
end $$;

create trigger name_sale_line before insert on sales_order_line for each row execute function name_sale_line();

-- 0025's uncosted_sales, naming each sale's products as they were sold.
create or replace function uncosted_sales(p_business uuid, p_from date, p_to date)
returns table (order_id uuid, placed_at timestamptz, channel sales_channel, products text, net numeric,
               cogs numeric, reasons text)
language sql stable set search_path = public as $$
  with b as (select * from local_day_bounds(p_business, p_from, p_to)),
  s as (
    select o.id, o.placed_at, o.channel, o.net_amount, o.cogs_amount
      from sales_order o, b
     where o.business_id = p_business and o.status not in ('voided', 'open')
       and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
  ),
  zero_lines as (
    select sl.sales_order_id, string_agg(distinct coalesce(sl.product_name, p.name), ', ') as names
      from sales_order_line sl join s on s.id = sl.sales_order_id
      join product_variant pv on pv.id = sl.product_variant_id
      join product p on p.id = pv.product_id
     where sl.cogs_amount = 0 and sl.quantity > 0 and pv.no_stock_reason is null
     group by 1
  ),
  free_items as (
    select m.reference_id as sales_order_id, string_agg(distinct i.name, ', ') as names
      from inventory_movement m join s on s.id = m.reference_id join item i on i.id = m.item_id
     where m.reference_type = 'sales_order' and m.type = 'sale_consumption'
       and m.value = 0 and m.base_quantity_signed <> 0
       and not exists (select 1 from inventory_movement c
                        where c.item_id = m.item_id and c.base_quantity_signed > 0 and c.unit_cost > 0
                          and c.occurred_at <= m.occurred_at)
     group by 1
  )
  select s.id, s.placed_at, s.channel,
         (select string_agg(coalesce(sl.product_name, p.name), ', ' order by coalesce(sl.product_name, p.name))
            from sales_order_line sl
            join product_variant pv on pv.id = sl.product_variant_id join product p on p.id = pv.product_id
           where sl.sales_order_id = s.id),
         s.net_amount, s.cogs_amount,
         concat_ws('; ', case when z.names is not null then 'Costed at nothing: ' || z.names end,
                         case when f.names is not null then 'Used before it had a cost: ' || f.names end)
    from s left join zero_lines z on z.sales_order_id = s.id left join free_items f on f.sales_order_id = s.id
   where z.names is not null or f.names is not null
   order by s.placed_at
$$;

-- =============================================================================
-- 2. Names unique among those in use (P1-4)
-- =============================================================================
-- "Oat milk", "oat milk" and "Oat-Milk" are one name, as are "Dairy Co" and
-- "Dairy Co.": case, spaces and punctuation are ignored, letters never.
create or replace function name_key(p text) returns text
language sql immutable set search_path = public as $$
  select lower(regexp_replace(coalesce(p, ''), '[[:space:][:punct:]]+', '', 'g'))
$$;

create unique index if not exists item_name_in_use on item (business_id, name_key(name)) where is_active;
create unique index if not exists supplier_name_in_use on supplier (business_id, name_key(name)) where is_active;
create unique index if not exists product_name_in_use on product (business_id, name_key(name)) where is_active;

-- The same rule, said plainly before the index would refuse it.
create or replace function assert_name_free(p_business uuid, p_kind text, p_name text, p_self uuid default null)
returns void language plpgsql stable set search_path = public as $$
begin
  if p_kind = 'item' and exists (select 1 from item where business_id = p_business and is_active
                                   and name_key(name) = name_key(p_name) and id is distinct from p_self) then
    raise exception 'There is already an item called %', trim(p_name);
  elsif p_kind = 'supplier' and exists (select 1 from supplier where business_id = p_business and is_active
                                          and name_key(name) = name_key(p_name) and id is distinct from p_self) then
    raise exception 'There is already a supplier called %', trim(p_name);
  elsif p_kind = 'product' and exists (select 1 from product where business_id = p_business and is_active
                                         and name_key(name) = name_key(p_name) and id is distinct from p_self) then
    raise exception 'There is already a product called %', trim(p_name);
  end if;
end $$;

-- =============================================================================
-- 3. Opening stock is the owner's, with a reason (P1-1)
-- =============================================================================
-- It is capital the owner puts into the business (Dr 1200 / Cr 3000).
create or replace function assert_owner_opening(p_reason text) returns void
language plpgsql stable set search_path = public as $$
begin
  if not current_has_role('owner') then
    raise exception 'Only the owner records opening stock: it is capital the owner puts in' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Say where this stock came from (the opening count, say)';
  end if;
end $$;

-- 0024's opening stock for an item with no stock history, now the owner's, with a reason.
drop function if exists record_opening_stock(uuid, numeric, text, numeric, uuid);
create or replace function record_opening_stock(p_item uuid, p_qty numeric, p_unit_code text, p_unit_cost numeric,
                                                p_reason text, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  v_item item; v_location uuid; v_base numeric; v_value numeric; v_mv uuid; v_journal uuid;
begin
  perform assert_owner_opening(p_reason);
  select * into v_item from item where id = p_item and business_id = v_business;
  if not found then raise exception 'Unknown item'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Enter the quantity on the shelf'; end if;
  if p_unit_cost is null or p_unit_cost <= 0 then
    raise exception 'Enter what one % of % cost', coalesce(nullif(trim(p_unit_code), ''), v_item.base_unit_code), v_item.name;
  end if;
  v_base := to_base_qty(p_item, p_qty, nullif(trim(p_unit_code), ''));
  v_location := resolve_location(v_business, p_location);
  perform lock_items(array[p_item]);
  if exists (select 1 from inventory_movement
              where business_id = v_business and item_id = p_item and location_id = v_location) then
    raise exception '% already has stock recorded here. Correct it with a count or a stock correction', v_item.name;
  end if;
  v_value := money_round(v_business, p_qty * p_unit_cost);
  if v_value <= 0 then raise exception 'That stock is worth nothing at this cost: check the quantity and the cost'; end if;
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, app_user_id, reason)
  values (v_business, p_item, v_location, 'opening_balance', v_base, p_qty * p_unit_cost / v_base, v_value,
          'opening_balance', v_me, 'Opening balance: ' || trim(p_reason))
  returning id into v_mv;
  v_journal := post_journal(v_business, now(), 'Opening stock: ' || v_item.name, 'inventory_movement', v_mv,
    jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_value),
                      jsonb_build_object('code', '3000', 'credit', v_value)));
  perform audit_event(v_business, 'inventory.opening', 'inventory_movement', v_mv::text, trim(p_reason), null,
                      jsonb_build_object('item', p_item, 'qty', v_base, 'value', v_value));
  return jsonb_build_object('movement_id', v_mv, 'qty', v_base, 'value', v_value,
                            'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- 0015's create_item: a name no item in use has; opening stock the owner's, with a reason.
drop function if exists create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric, numeric, boolean);
create or replace function create_item(
  p_name text, p_item_type item_type, p_base_unit text, p_dimension unit_dimension,
  p_name_ar text default null, p_name_ckb text default null, p_min_level numeric default null,
  p_units jsonb default '[]', p_opening_qty numeric default null, p_opening_unit_cost numeric default null,
  p_returnable boolean default false, p_opening_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  v_item uuid; u jsonb; v_value numeric; v_mv uuid; v_journal uuid; v_location uuid;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the item'; end if;
  if nullif(trim(p_base_unit), '') is null then raise exception 'Give the item a base unit'; end if;
  perform assert_name_free(v_business, 'item', p_name);
  if coalesce(p_opening_qty, 0) > 0 then perform assert_owner_opening(p_opening_reason); end if;
  insert into item (business_id, name, name_ar, name_ckb, item_type, base_unit_code, dimension,
                    min_level_base, returnable_to_stock)
  values (v_business, trim(p_name), nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''), p_item_type,
          trim(p_base_unit), p_dimension, p_min_level, coalesce(p_returnable, false))
  returning id into v_item;
  for u in select * from jsonb_array_elements(coalesce(p_units, '[]')) loop
    if coalesce((u ->> 'factor')::numeric, 0) <= 0 then raise exception 'Unit % needs a positive factor', u ->> 'code'; end if;
    insert into item_unit (item_id, code, label, dimension, factor_to_base)
    values (v_item, u ->> 'code', coalesce(u ->> 'label', u ->> 'code'), p_dimension, (u ->> 'factor')::numeric);
  end loop;
  if coalesce(p_opening_qty, 0) > 0 then
    if p_opening_unit_cost is null or p_opening_unit_cost < 0 then
      raise exception 'Opening stock needs a unit cost';
    end if;
    v_location := resolve_location(v_business, null);
    v_value := money_round(v_business, p_opening_qty * p_opening_unit_cost);
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, app_user_id, reason)
    values (v_business, v_item, v_location, 'opening_balance', p_opening_qty, p_opening_unit_cost, v_value,
            'opening_balance', v_me, 'Opening balance: ' || trim(p_opening_reason))
    returning id into v_mv;
    if v_value > 0 then
      v_journal := post_journal(v_business, now(), 'Opening stock: ' || trim(p_name), 'inventory_movement', v_mv,
        jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_value),
                          jsonb_build_object('code', '3000', 'credit', v_value)));
    end if;
    perform audit_event(v_business, 'inventory.opening', 'inventory_movement', v_mv::text, trim(p_opening_reason),
                        null, jsonb_build_object('item', v_item, 'qty', p_opening_qty, 'value', v_value));
  end if;
  return jsonb_build_object('item_id', v_item, 'opening_value', coalesce(v_value, 0));
end $$;

-- =============================================================================
-- 4. Items, units and suppliers corrected (P1-4)
-- =============================================================================
-- An item's name, type, levels and whether it is in use. Its base unit is not
-- changed: its whole history is counted in it. Taken out of use only when it
-- has no stock and nothing in force uses it.
create or replace function update_item(p_item uuid, p_name text, p_item_type item_type,
                                       p_name_ar text default null, p_name_ckb text default null,
                                       p_min_level numeric default null, p_par_level numeric default null,
                                       p_is_active boolean default true, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  i item; v_qty numeric; v_today date;
begin
  select * into i from item where id = p_item and business_id = v_business for update;
  if not found then raise exception 'Unknown item'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Name the item'; end if;
  if coalesce(p_min_level, 0) < 0 or coalesce(p_par_level, 0) < 0 then raise exception 'Levels cannot be negative'; end if;
  if coalesce(p_is_active, true) then perform assert_name_free(v_business, 'item', p_name, p_item); end if;
  if not coalesce(p_is_active, true) and i.is_active then
    select coalesce(sum(base_quantity_signed), 0) into v_qty
      from inventory_movement where business_id = v_business and item_id = p_item;
    if v_qty <> 0 then
      raise exception '% still has % % in stock: count it to nothing or write it off before taking it out of use',
        i.name, trim_scale(v_qty), i.base_unit_code;
    end if;
    v_today := business_local_date(v_business, now());
    if exists (select 1 from recipe r
                 join recipe_version rv on rv.recipe_id = r.id
                 join recipe_line rl on rl.recipe_version_id = rv.id
                where r.business_id = v_business and r.is_active and rl.item_id = p_item
                  and (rv.effective_to is null or rv.effective_to >= v_today)) then
      raise exception '% is in a recipe in force or to come: change the recipe first', i.name;
    end if;
    if exists (select 1 from recipe where business_id = v_business and is_active and output_item_id = p_item) then
      raise exception '% is what a batch recipe makes: stop using that batch recipe first', i.name;
    end if;
    if exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                where pv.resale_item_id = p_item and pv.is_active and p.is_active) then
      raise exception '% is sold as bought on the till: hide that product first', i.name;
    end if;
  end if;
  perform set_config('audit.reason', coalesce(trim(p_reason), ''), true);
  update item
     set name = trim(p_name), name_ar = nullif(trim(p_name_ar), ''), name_ckb = nullif(trim(p_name_ckb), ''),
         item_type = p_item_type, min_level_base = p_min_level, par_level_base = p_par_level,
         is_active = coalesce(p_is_active, true)
   where id = p_item;
  perform set_config('audit.reason', '', true);
end $$;

-- A pack size (a case of 24, a sleeve of 50). A unit in use keeps its size:
-- a different size is a new unit, under its own name.
create or replace function add_item_unit(p_item uuid, p_code text, p_label text, p_factor numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  i item; v_code text := trim(p_code);
begin
  select * into i from item where id = p_item and business_id = v_business;
  if not found then raise exception 'Unknown item'; end if;
  if nullif(v_code, '') is null then raise exception 'Name the unit, such as case_24'; end if;
  if p_factor is null or p_factor <= 0 then
    raise exception 'Say how many % one % holds',
      case when i.base_unit_code = 'each' then 'items' else i.base_unit_code end, v_code;
  end if;
  if lower(v_code) = lower(i.base_unit_code)
     or exists (select 1 from item_unit where item_id = p_item and lower(code) = lower(v_code)) then
    raise exception '% already has a unit called %: a unit in use keeps its size, so give a new size its own name',
      i.name, v_code;
  end if;
  if (lower(v_code), i.base_unit_code) in (('kg', 'g'), ('l', 'ml')) and p_factor <> 1000 then
    raise exception 'One % is 1000 %', v_code, i.base_unit_code;
  end if;
  insert into item_unit (item_id, code, label, dimension, factor_to_base)
  values (p_item, v_code, coalesce(nullif(trim(p_label), ''), v_code), i.dimension, p_factor);
end $$;

-- 0015's create_supplier, with a name no supplier in use has.
create or replace function create_supplier(p_name text, p_contact text default null, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('purchase.create'); v_id uuid;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the supplier'; end if;
  perform assert_name_free(v_business, 'supplier', p_name);
  insert into supplier (business_id, name, contact, phone)
  values (v_business, trim(p_name), nullif(trim(p_contact), ''), nullif(trim(p_phone), ''))
  returning id into v_id;
  return v_id;
end $$;

-- A supplier's name and contacts, and whether they are in use: not taken out
-- of use while they are owed money.
create or replace function update_supplier(p_supplier uuid, p_name text, p_contact text default null,
                                           p_phone text default null, p_is_active boolean default true,
                                           p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('purchase.create'); s supplier; v_owed numeric;
begin
  select * into s from supplier where id = p_supplier and business_id = v_business for update;
  if not found then raise exception 'Unknown supplier'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Name the supplier'; end if;
  if coalesce(p_is_active, true) then perform assert_name_free(v_business, 'supplier', p_name, p_supplier); end if;
  if not coalesce(p_is_active, true) and s.is_active then
    select coalesce((select sum(amount_total) from purchase_invoice
                      where supplier_id = p_supplier and cancelled_at is null), 0)
           - coalesce((select sum(amount) from supplier_payment where supplier_id = p_supplier), 0)
      into v_owed;
    if v_owed > 0 then
      raise exception '% is still owed %: pay or cancel their bills before taking them out of use', s.name, trim_scale(v_owed);
    end if;
  end if;
  perform set_config('audit.reason', coalesce(trim(p_reason), ''), true);
  update supplier
     set name = trim(p_name), contact = nullif(trim(p_contact), ''), phone = nullif(trim(p_phone), ''),
         is_active = coalesce(p_is_active, true)
   where id = p_supplier;
  perform set_config('audit.reason', '', true);
end $$;

-- 0025's create_product, with a name no product in use has.
drop function if exists create_product(text, jsonb, jsonb, text, text, uuid, text);
create or replace function create_product(
  p_name text, p_prices jsonb, p_recipe jsonb default '[]',
  p_name_ar text default null, p_name_ckb text default null, p_category uuid default null,
  p_no_stock_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_today date; v_product uuid; v_variant uuid; v_recipe uuid; v_version uuid; l jsonb; k text; v numeric;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the product'; end if;
  perform assert_name_free(v_business, 'product', p_name);
  v_today := business_local_date(v_business, now());
  insert into product (business_id, name, name_ar, name_ckb, category_id)
  values (v_business, trim(p_name), nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''), p_category)
  returning id into v_product;
  insert into product_variant (product_id, name) values (v_product, trim(p_name)) returning id into v_variant;
  insert into recipe (business_id, name) values (v_business, trim(p_name)) returning id into v_recipe;
  insert into recipe_version (recipe_id, version_no, effective_from) values (v_recipe, 1, v_today) returning id into v_version;
  for l in select * from jsonb_array_elements(coalesce(p_recipe, '[]')) loop
    if not exists (select 1 from item where id = (l ->> 'item_id')::uuid and business_id = v_business) then
      raise exception 'Unknown item in the recipe';
    end if;
    if coalesce((l ->> 'qty')::numeric, 0) <= 0 then raise exception 'Every recipe line needs a quantity'; end if;
    perform to_base_qty((l ->> 'item_id')::uuid, 1, l ->> 'unit_code');   -- validates the unit
    insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
    values (v_version, 'item', (l ->> 'item_id')::uuid, (l ->> 'qty')::numeric,
            coalesce(l ->> 'unit_code', (select base_unit_code from item where id = (l ->> 'item_id')::uuid)),
            case when jsonb_typeof(l -> 'channels') = 'array' and jsonb_array_length(l -> 'channels') > 0
                 then array(select jsonb_array_elements_text(l -> 'channels'))::sales_channel[] end);
  end loop;
  -- Every product takes its stock through its recipe, or says why it takes none (0025).
  if not exists (select 1 from recipe_line where recipe_version_id = v_version) then
    if nullif(trim(p_no_stock_reason), '') is null then
      raise exception 'List what one serving uses, or say why it uses no stock';
    end if;
    update product_variant set no_stock_reason = trim(p_no_stock_reason) where id = v_variant;
  end if;
  insert into variant_recipe (product_variant_id, recipe_id) values (v_variant, v_recipe);
  for k, v in select key, value::numeric from jsonb_each_text(coalesce(p_prices, '{}')) loop
    if v is not null and v > 0 then
      insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
      values (v_business, v_variant, k::sales_channel, v, v_today);
    end if;
  end loop;
  return jsonb_build_object('product_id', v_product, 'variant_id', v_variant, 'recipe_id', v_recipe);
end $$;

-- 0018's set_product_details, with a name no other product in use has.
create or replace function set_product_details(p_product uuid, p_name text, p_category uuid default null,
                                               p_is_active boolean default true, p_is_favourite boolean default false,
                                               p_name_ar text default null, p_name_ckb text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); v_old text;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the product'; end if;
  select name into v_old from product where id = p_product and business_id = v_business for update;
  if not found then raise exception 'Product not found'; end if;
  if coalesce(p_is_active, true) then perform assert_name_free(v_business, 'product', p_name, p_product); end if;
  if p_category is not null
     and not exists (select 1 from product_category where id = p_category and business_id = v_business) then
    raise exception 'Unknown category';
  end if;
  update product
     set name = trim(p_name), name_ar = nullif(trim(p_name_ar), ''), name_ckb = nullif(trim(p_name_ckb), ''),
         category_id = p_category, is_active = coalesce(p_is_active, true),
         is_favourite = coalesce(p_is_favourite, false)
   where id = p_product;
  update product_variant set name = trim(p_name), name_ar = nullif(trim(p_name_ar), ''),
         name_ckb = nullif(trim(p_name_ckb), '')
   where product_id = p_product and name = v_old
     and (select count(*) from product_variant where product_id = p_product) = 1;
end $$;

-- =============================================================================
-- 5. Batch recipes audited; the unaudited path retired (P1-1)
-- =============================================================================
-- A recipe's ingredients as the audit trail shows them.
create or replace function recipe_lines_json(p_version uuid) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('item', i.name, 'qty', rl.quantity, 'unit', rl.unit_code)
                            order by i.name), '[]'::jsonb)
    from recipe_line rl join item i on i.id = rl.item_id
   where rl.recipe_version_id = p_version
$$;

-- 0023's save_batch_recipe, now on the audit trail with what it was and what it became.
create or replace function save_batch_recipe(
  p_recipe uuid, p_name text, p_output jsonb, p_yield numeric, p_yield_unit text, p_lines jsonb,
  p_instructions text default null, p_is_active boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  r recipe; v_item uuid; v_yield numeric; v_unit text; v_dim unit_dimension; v_base text;
  v_container text; v_code text; v_factor numeric; v_version uuid; v_new boolean := p_recipe is null;
  v_before jsonb;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name what the batch makes'; end if;
  if not v_new then
    select * into r from recipe where id = p_recipe and business_id = v_business for update;
    if not found or r.output_item_id is null then raise exception 'Batch recipe not found'; end if;
    v_item := r.output_item_id;
    v_before := jsonb_build_object('name', r.name, 'yield', r.batch_yield_base, 'unit', r.batch_yield_unit,
      'is_active', r.is_active,
      'lines', recipe_lines_json(recipe_version_on(r.id, business_local_date(v_business, now()))));
  elsif nullif(p_output ->> 'item_id', '') is not null then
    v_item := (p_output ->> 'item_id')::uuid;
    if not exists (select 1 from item where id = v_item and business_id = v_business and is_active) then
      raise exception 'Unknown item';
    end if;
  else
    v_dim := case p_output ->> 'measure' when 'weight' then 'mass' when 'volume' then 'volume'
                                         when 'pieces' then 'count' end::unit_dimension;
    if v_dim is null then raise exception 'Say whether it is weighed, measured or counted in pieces'; end if;
    if exists (select 1 from item where business_id = v_business and is_active and name_key(name) = name_key(p_name)) then
      raise exception 'You already keep an item called %: choose it as what the batch makes', trim(p_name);
    end if;
    v_base := case v_dim when 'mass' then 'g' when 'volume' then 'ml' else 'each' end;
    insert into item (business_id, name, item_type, base_unit_code, dimension)
    values (v_business, trim(p_name), 'finished_good', v_base, v_dim)
    returning id into v_item;
    if v_dim = 'mass' then
      insert into item_unit (item_id, code, label, dimension, factor_to_base) values (v_item, 'kg', 'kg', 'mass', 1000);
    elsif v_dim = 'volume' then
      insert into item_unit (item_id, code, label, dimension, factor_to_base) values (v_item, 'L', 'L', 'volume', 1000);
    end if;
    -- A container it is kept or counted in: a pan, a tray, a tub.
    v_container := nullif(trim(p_output ->> 'container'), '');
    if v_container is not null then
      v_code := lower(v_container);
      if v_code in ('g', 'kg', 'ml', 'l', 'each') then
        raise exception '"%" is already a unit: name the container, such as pan or tray', v_container;
      end if;
      v_factor := to_base_qty(v_item, (p_output ->> 'container_qty')::numeric, nullif(p_output ->> 'container_unit', ''));
      if v_factor is null or v_factor <= 0 then raise exception 'Say how much one % holds', v_container; end if;
      insert into item_unit (item_id, code, label, dimension, factor_to_base)
      values (v_item, v_code, v_container, v_dim, v_factor);
    end if;
  end if;

  v_unit := coalesce(nullif(p_yield_unit, ''), (select base_unit_code from item where id = v_item));
  v_yield := to_base_qty(v_item, p_yield, v_unit);
  if v_yield is null or v_yield <= 0 then raise exception 'Say how much one batch makes'; end if;

  if v_new then
    insert into recipe (business_id, name, output_item_id, batch_yield_base, batch_yield_unit, prep_instructions, is_active)
    values (v_business, trim(p_name), v_item, v_yield, v_unit, nullif(trim(p_instructions), ''), coalesce(p_is_active, true))
    returning * into r;
  else
    update recipe set name = trim(p_name), batch_yield_base = v_yield, batch_yield_unit = v_unit,
                      prep_instructions = nullif(trim(p_instructions), ''), is_active = coalesce(p_is_active, true)
     where id = r.id
    returning * into r;
  end if;
  if v_new or p_lines is not null then
    -- A batch uses the ingredients in force when it is made: a change counts from today.
    v_version := start_recipe_version(r.id, business_local_date(v_business, now()));
    perform write_recipe_lines(v_business, v_version, p_lines, v_item, false);
  end if;
  perform audit_event(v_business, case when v_new then 'recipe.batch.create' else 'recipe.batch.change' end,
    'recipe', r.id::text, null, v_before,
    jsonb_build_object('name', r.name, 'yield', r.batch_yield_base, 'unit', r.batch_yield_unit,
      'is_active', r.is_active,
      'lines', recipe_lines_json(recipe_version_on(r.id, business_local_date(v_business, now())))));
  return jsonb_build_object('recipe_id', r.id, 'item_id', v_item);
end $$;

-- =============================================================================
-- 6. Deliveries at a price per unit, and checked (P1-3)
-- =============================================================================
-- What an item costs per base unit now: its average cost here, or, with none
-- on hand, what it cost at its last delivery. Null when it has never had one.
create or replace function item_reference_cost(p_business uuid, p_item uuid, p_location uuid) returns numeric
language plpgsql stable set search_path = public as $$
declare p record; v numeric;
begin
  p := item_position(p_business, p_item, p_location);
  if p.qty > 0 and p.value > 0 then return p.value / p.qty; end if;
  select unit_cost into v from inventory_movement
   where business_id = p_business and item_id = p_item and type = 'purchase_receipt' and unit_cost > 0
   order by occurred_at desc, created_at desc limit 1;
  return v;
end $$;

-- 0015's receive_goods: a line may give its price per unit instead of its
-- total; a cost more than 25% away from the item's cost now is refused until
-- the person confirms it, and the confirmation is audited.
drop function if exists receive_goods(uuid, jsonb, numeric, numeric, numeric, text, uuid);
create or replace function receive_goods(
  p_supplier uuid, p_lines jsonb, p_freight numeric default 0, p_other numeric default 0,
  p_rebate numeric default 0, p_note text default null, p_location uuid default null,
  p_confirm boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.receive');
  v_me uuid := (current_member()).id;
  v_location uuid; v_receipt uuid; v_no bigint;
  v_goods numeric[] := '{}'; v_landed numeric[]; v_items uuid[] := '{}';
  l jsonb; i int := 0; v_item uuid; v_base numeric; v_mv uuid; v_total numeric := 0; v_journal uuid;
  v_value numeric; v_cost numeric; v_ref numeric; v_warn text[] := '{}'; v_per text; it item;
begin
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business and is_active) then
    raise exception 'Choose an active supplier';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one line'; end if;
  if coalesce(p_freight, 0) < 0 or coalesce(p_other, 0) < 0 or coalesce(p_rebate, 0) < 0 then
    raise exception 'Freight, other costs and rebates cannot be negative';
  end if;
  v_location := resolve_location(v_business, p_location);

  for l in select * from jsonb_array_elements(p_lines) loop
    v_item := (l ->> 'item_id')::uuid;
    select * into it from item where id = v_item and business_id = v_business;
    if not found then raise exception 'Unknown item on the receipt'; end if;
    if not it.is_active then raise exception '% is out of use: bring it back into use first', it.name; end if;
    if coalesce((l ->> 'qty')::numeric, 0) <= 0 then raise exception 'Every received line needs a quantity'; end if;
    -- A price per unit (of the unit received), or the line's total.
    v_value := case when nullif(l ->> 'unit_price', '') is not null
                    then (l ->> 'unit_price')::numeric * (l ->> 'qty')::numeric
                    else (l ->> 'goods_value')::numeric end;
    if coalesce(v_value, -1) < 0 then raise exception 'Every received line needs a price'; end if;
    v_goods := v_goods || money_round(v_business, v_value);
    v_items := v_items || v_item;
    -- Its cost per base unit, against what the item costs now.
    v_base := to_base_qty(v_item, (l ->> 'qty')::numeric, l ->> 'unit_code');
    v_cost := v_value / v_base;
    v_ref := item_reference_cost(v_business, v_item, v_location);
    if v_ref > 0 and abs(v_cost - v_ref) > 0.25 * v_ref then
      v_per := case when it.base_unit_code = 'each' then ' each' else ' a ' || it.base_unit_code end;
      v_warn := v_warn || format('%s at %s%s is %s%% %s its cost now (%s%s)', it.name,
        trim_scale(round(v_cost, 4)), v_per, round(abs(v_cost - v_ref) / v_ref * 100),
        case when v_cost > v_ref then 'above' else 'below' end, trim_scale(round(v_ref, 4)), v_per);
    end if;
  end loop;
  if cardinality(v_warn) > 0 and not coalesce(p_confirm, false) then
    raise exception 'Check the price: %. If it is right, confirm it and receive again', array_to_string(v_warn, '; ');
  end if;
  perform lock_items(v_items);
  v_landed := allocate_landed(v_business, v_goods, coalesce(p_freight, 0) + coalesce(p_other, 0) - coalesce(p_rebate, 0));

  v_no := next_document_no(v_business, 'receipt', 1);
  insert into goods_receipt (business_id, location_id, supplier_id, receipt_no, freight_total,
                             other_landed_total, rebate_total, received_by, note)
  values (v_business, v_location, p_supplier, v_no, coalesce(p_freight, 0), coalesce(p_other, 0),
          coalesce(p_rebate, 0), v_me, nullif(trim(p_note), ''))
  returning id into v_receipt;

  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    v_item := (l ->> 'item_id')::uuid;
    v_base := to_base_qty(v_item, (l ->> 'qty')::numeric, l ->> 'unit_code');
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, app_user_id, reason)
    values (v_business, v_item, v_location, 'purchase_receipt', v_base, v_landed[i] / v_base, v_landed[i],
            'goods_receipt', v_receipt, v_me, 'Goods received')
    returning id into v_mv;
    insert into goods_receipt_line (goods_receipt_id, item_id, received_qty, received_unit_code, goods_value, movement_id)
    values (v_receipt, v_item, (l ->> 'qty')::numeric,
            coalesce(l ->> 'unit_code', (select base_unit_code from item where id = v_item)), v_goods[i], v_mv);
    v_total := v_total + v_landed[i];
  end loop;

  v_journal := post_journal(v_business, now(), 'Goods received — receipt ' || v_no, 'goods_receipt', v_receipt,
    jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_total),
                      jsonb_build_object('code', '2050', 'credit', v_total)));
  if cardinality(v_warn) > 0 then
    perform audit_event(v_business, 'purchase.price_confirmed', 'goods_receipt', v_receipt::text,
                        array_to_string(v_warn, '; '), null, jsonb_build_object('receipt_no', v_no));
  end if;
  return jsonb_build_object('receipt_id', v_receipt, 'receipt_no', v_no, 'value', v_total,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- What an item has cost, delivery by delivery: the price paid per base unit,
-- and what it cost landed (with freight and other costs shared out).
create or replace function item_price_history(p_item uuid)
returns table (received_at timestamptz, receipt_no bigint, supplier text, qty numeric, unit text,
               goods_value numeric, cost_per_base numeric, landed_per_base numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  if not exists (select 1 from item where id = p_item and business_id = v_business) then
    raise exception 'Item not found';
  end if;
  return query
    select r.received_at, r.receipt_no, s.name, gl.received_qty, gl.received_unit_code, gl.goods_value,
           gl.goods_value / nullif(m.base_quantity_signed, 0), m.unit_cost
      from goods_receipt_line gl
      join goods_receipt r on r.id = gl.goods_receipt_id
      left join supplier s on s.id = r.supplier_id
      left join inventory_movement m on m.id = gl.movement_id
     where r.business_id = v_business and gl.item_id = p_item
     order by r.received_at desc, r.receipt_no desc
     limit 50;
end $$;

-- =============================================================================
-- 7. Who may call what
-- =============================================================================
revoke execute on function
  audit_row_change(), audit_price_change(), name_sale_line(), name_key(text),
  assert_name_free(uuid, text, text, uuid), assert_owner_opening(text), recipe_lines_json(uuid),
  item_reference_cost(uuid, uuid, uuid)
  from public, anon, authenticated;

-- Retired: it bypassed the audited "Change the recipe" (and nothing in the app calls it).
revoke execute on function new_recipe_version(uuid, jsonb, date) from public, anon, authenticated;

revoke execute on function
  record_opening_stock(uuid, numeric, text, numeric, text, uuid),
  create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric, numeric, boolean, text),
  update_item(uuid, text, item_type, text, text, numeric, numeric, boolean, text),
  add_item_unit(uuid, text, text, numeric),
  update_supplier(uuid, text, text, text, boolean, text),
  create_product(text, jsonb, jsonb, text, text, uuid, text),
  receive_goods(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean),
  item_price_history(uuid)
  from public, anon;
grant execute on function
  record_opening_stock(uuid, numeric, text, numeric, text, uuid),
  create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric, numeric, boolean, text),
  update_item(uuid, text, item_type, text, text, numeric, numeric, boolean, text),
  add_item_unit(uuid, text, text, numeric),
  update_supplier(uuid, text, text, text, boolean, text),
  create_product(text, jsonb, jsonb, text, text, uuid, text),
  receive_goods(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean),
  item_price_history(uuid)
to authenticated;
