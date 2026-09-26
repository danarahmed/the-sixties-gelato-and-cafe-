-- =============================================================================
-- 0033 — A new item added while its delivery is received, with its pack size
-- =============================================================================
-- The owner asked that whoever does the purchasing can add an item that is not
-- in Inventory yet from the receipt itself, instead of leaving it for Inventory
-- and coming back. The screen now offers it on every line of a receipt, and on
-- Inventory, with the size of the pack the item is bought in (a carton of 24, a
-- sack of 25 kg), so the delivery is entered as the invoice has it.
--
--  * create_item() already took pack units, but did not check them as
--    add_item_unit() does. One rule now serves both: a pack has a name of its
--    own, not the base unit's; it holds something; a kilogram is 1000 grams and
--    a litre 1000 ml; and no two packs of one item share a name. A reorder
--    level is not negative, as update_item() already says.
--  * Who may add an item is unchanged: the owner and managers, and whoever does
--    the purchasing (purchase.create), as on Inventory. An item added on a
--    receipt has no opening stock: its stock comes in with the delivery.
--  * A name that only looks like another item's ("Botled water" beside
--    "Bottled water") is the screen's to warn about; the same name, whatever
--    its capitals, spaces or punctuation, is still refused here (0027).

-- =============================================================================
-- 1. One rule for a pack unit
-- =============================================================================
create or replace function assert_unit_ok(p_item_name text, p_base text, p_code text, p_factor numeric)
returns void language plpgsql immutable set search_path = public as $$
declare v_code text := trim(p_code);
begin
  if nullif(v_code, '') is null then raise exception 'Name the unit, such as case_24'; end if;
  if p_factor is null or p_factor <= 0 then
    raise exception 'Say how many % one % holds', case when p_base = 'each' then 'items' else p_base end, v_code;
  end if;
  if lower(v_code) = lower(p_base) then
    raise exception '% already has a unit called %: a unit in use keeps its size, so give a new size its own name',
      p_item_name, v_code;
  end if;
  if (lower(v_code), p_base) in (('kg', 'g'), ('l', 'ml')) and p_factor <> 1000 then
    raise exception 'One % is 1000 %', v_code, p_base;
  end if;
end $$;

-- =============================================================================
-- 2. create_item (0027): its pack units checked as add_item_unit's are
-- =============================================================================
create or replace function create_item(
  p_name text, p_item_type item_type, p_base_unit text, p_dimension unit_dimension,
  p_name_ar text default null, p_name_ckb text default null, p_min_level numeric default null,
  p_units jsonb default '[]', p_opening_qty numeric default null, p_opening_unit_cost numeric default null,
  p_returnable boolean default false, p_opening_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  v_item uuid; u jsonb; v_code text; v_value numeric; v_mv uuid; v_journal uuid; v_location uuid;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the item'; end if;
  if nullif(trim(p_base_unit), '') is null then raise exception 'Give the item a base unit'; end if;
  if coalesce(p_min_level, 0) < 0 then raise exception 'Levels cannot be negative'; end if;
  perform assert_name_free(v_business, 'item', p_name);
  if coalesce(p_opening_qty, 0) > 0 then perform assert_owner_opening(p_opening_reason); end if;
  insert into item (business_id, name, name_ar, name_ckb, item_type, base_unit_code, dimension,
                    min_level_base, returnable_to_stock)
  values (v_business, trim(p_name), nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''), p_item_type,
          trim(p_base_unit), p_dimension, p_min_level, coalesce(p_returnable, false))
  returning id into v_item;
  for u in select * from jsonb_array_elements(coalesce(p_units, '[]')) loop
    v_code := trim(u ->> 'code');
    perform assert_unit_ok(trim(p_name), trim(p_base_unit), v_code, (u ->> 'factor')::numeric);
    if exists (select 1 from item_unit where item_id = v_item and lower(code) = lower(v_code)) then
      raise exception '% already has a unit called %: a unit in use keeps its size, so give a new size its own name',
        trim(p_name), v_code;
    end if;
    insert into item_unit (item_id, code, label, dimension, factor_to_base)
    values (v_item, v_code, coalesce(nullif(trim(u ->> 'label'), ''), v_code), p_dimension, (u ->> 'factor')::numeric);
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
-- 3. add_item_unit (0027), by the same rule
-- =============================================================================
create or replace function add_item_unit(p_item uuid, p_code text, p_label text, p_factor numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  i item; v_code text := trim(p_code);
begin
  select * into i from item where id = p_item and business_id = v_business;
  if not found then raise exception 'Unknown item'; end if;
  perform assert_unit_ok(i.name, i.base_unit_code, v_code, p_factor);
  if exists (select 1 from item_unit where item_id = p_item and lower(code) = lower(v_code)) then
    raise exception '% already has a unit called %: a unit in use keeps its size, so give a new size its own name',
      i.name, v_code;
  end if;
  insert into item_unit (item_id, code, label, dimension, factor_to_base)
  values (p_item, v_code, coalesce(nullif(trim(p_label), ''), v_code), i.dimension, p_factor);
end $$;

-- =============================================================================
-- 4. Who may call what: the rule is the two functions', not anyone's to call
-- =============================================================================
revoke execute on function assert_unit_ok(text, text, text, numeric) from public, anon, authenticated;
