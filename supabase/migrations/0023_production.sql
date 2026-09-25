-- =============================================================================
-- 0023_production.sql — batches made in the café, and a product's recipe
-- changed from a date.
--
-- A batch recipe says what the café makes, how much one batch makes, and from
-- what. Its ingredients may be bought or made here, so both ways of working
-- fit: pistachio gelato straight from milk, sugar and paste; or a white base
-- made first, and pistachio gelato made from the base and the paste. A bakery's
-- dough and the croissants baked from it are the same.
--
-- Recording a batch takes its ingredients out of stock at their average cost
-- and puts what came out into stock at exactly that cost. Value only moves
-- inside Inventory (1200): the books' total does not change, so no journal is
-- written, and the stock ledger still agrees with 1200 to the dinar. What came
-- out may be counted in any of the item's units (weighed, or in pans, trays or
-- pieces), or left as the recipe says; each batch keeps both. A batch recorded
-- in error is cancelled by a manager: its movements are reversed at the values
-- they had, and the reason is kept.
--
-- Baristas may record batches (they make them), as they record waste; they are
-- not shown what anything costs.
-- =============================================================================

insert into role_permission (role, permission)
select r::app_role, p from (values
  ('owner','production.record'),('general_manager','production.record'),
  ('branch_manager','production.record'),('barista','production.record')
) as v(r, p)
on conflict do nothing;

alter table recipe add column if not exists is_active boolean not null default true;
alter table recipe add column if not exists batch_yield_unit text;
alter table production_batch add column if not exists output_item_id uuid references item(id);
alter table production_batch add column if not exists output_unit_code text;
alter table production_batch add column if not exists cancelled_at timestamptz;
alter table production_batch add column if not exists cancelled_by uuid references app_user(id);
alter table production_batch add column if not exists cancel_reason text;

-- A recipe version's lines, checked: items of this business, a quantity, a unit
-- the item has; channels only where the recipe is a product's.
create or replace function write_recipe_lines(
  p_business uuid, p_version uuid, p_lines jsonb, p_forbid uuid, p_channels boolean)
returns int language plpgsql set search_path = public as $$
declare l jsonb; n int := 0; v_item uuid; v_qty numeric;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'List what goes into it';
  end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    v_item := nullif(l ->> 'item_id', '')::uuid;
    if v_item is null or not exists (select 1 from item where id = v_item and business_id = p_business) then
      raise exception 'Unknown item in the recipe';
    end if;
    if v_item = p_forbid then raise exception 'A batch cannot use what it makes'; end if;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Every recipe line needs a quantity'; end if;
    perform to_base_qty(v_item, 1, nullif(l ->> 'unit_code', ''));   -- validates the unit
    insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
    values (p_version, 'item', v_item, v_qty,
            coalesce(nullif(l ->> 'unit_code', ''), (select base_unit_code from item where id = v_item)),
            case when p_channels and jsonb_typeof(l -> 'channels') = 'array' and jsonb_array_length(l -> 'channels') > 0
                 then array(select jsonb_array_elements_text(l -> 'channels'))::sales_channel[] end);
    n := n + 1;
  end loop;
  return n;
end $$;

-- A new version of a recipe from a date: the one before it ends the day before.
create or replace function start_recipe_version(p_recipe uuid, p_from date) returns uuid
language plpgsql set search_path = public as $$
declare v_no int; v_version uuid;
begin
  update recipe_version set effective_to = p_from - 1
   where recipe_id = p_recipe and (effective_to is null or effective_to >= p_from) and effective_from < p_from;
  select coalesce(max(version_no), 0) + 1 into v_no from recipe_version where recipe_id = p_recipe;
  insert into recipe_version (recipe_id, version_no, effective_from) values (p_recipe, v_no, p_from)
  returning id into v_version;
  return v_version;
end $$;

-- 0015's new_recipe_version, now checking its lines as every other recipe does.
create or replace function new_recipe_version(p_recipe uuid, p_lines jsonb, p_effective_from date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_from date; v_version uuid;
begin
  if not exists (select 1 from recipe where id = p_recipe and business_id = v_business) then raise exception 'Unknown recipe'; end if;
  v_from := coalesce(p_effective_from, business_local_date(v_business, now()));
  if v_from < business_local_date(v_business, now()) then
    raise exception 'A new recipe version cannot start in the past';
  end if;
  v_version := start_recipe_version(p_recipe, v_from);
  perform write_recipe_lines(v_business, v_version, p_lines, null, true);
  return v_version;
end $$;

-- A product's recipe, changed from a date (today or later): past sales keep the
-- recipe they were made with.
create or replace function change_product_recipe(p_variant uuid, p_lines jsonb, p_effective_from date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_today date; v_from date; v_recipe uuid; v_version uuid; v_resale uuid;
begin
  select resale_item_id into v_resale from product_variant where id = p_variant and business_id = v_business;
  if not found then raise exception 'Unknown product'; end if;
  if v_resale is not null then raise exception 'This product is sold as bought: it has no recipe to change'; end if;
  v_today := business_local_date(v_business, now());
  v_from := coalesce(p_effective_from, v_today);
  if v_from < v_today then raise exception 'A recipe change cannot start in the past'; end if;
  select recipe_id into v_recipe from variant_recipe where product_variant_id = p_variant;
  if v_recipe is null then
    insert into recipe (business_id, name)
    select v_business, p.name from product_variant pv join product p on p.id = pv.product_id where pv.id = p_variant
    returning id into v_recipe;
    insert into variant_recipe (product_variant_id, recipe_id) values (p_variant, v_recipe);
  end if;
  v_version := start_recipe_version(v_recipe, v_from);
  perform write_recipe_lines(v_business, v_version, p_lines, null, true);
  perform audit_event(v_business, 'recipe.change', 'product_variant', p_variant::text, null, null,
    jsonb_build_object('effective_from', v_from, 'lines', p_lines));
  return jsonb_build_object('recipe_id', v_recipe, 'effective_from', v_from,
    'version_no', (select version_no from recipe_version where id = v_version));
end $$;

-- What the café makes: a new batch recipe (and, if it is new, the item it
-- makes), or a change to one. p_output, for a new recipe: {"item_id": uuid} for
-- an item already kept, or {"measure": "weight"|"volume"|"pieces",
-- "container": "pan", "container_qty": 5, "container_unit": "kg"} for a new one
-- (the container is optional). The yield may be given in any of the item's
-- units. p_lines null keeps the ingredients as they are.
create or replace function save_batch_recipe(
  p_recipe uuid, p_name text, p_output jsonb, p_yield numeric, p_yield_unit text, p_lines jsonb,
  p_instructions text default null, p_is_active boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  r recipe; v_item uuid; v_yield numeric; v_unit text; v_dim unit_dimension; v_base text;
  v_container text; v_code text; v_factor numeric; v_version uuid; v_new boolean := p_recipe is null;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name what the batch makes'; end if;
  if not v_new then
    select * into r from recipe where id = p_recipe and business_id = v_business for update;
    if not found or r.output_item_id is null then raise exception 'Batch recipe not found'; end if;
    v_item := r.output_item_id;
  elsif nullif(p_output ->> 'item_id', '') is not null then
    v_item := (p_output ->> 'item_id')::uuid;
    if not exists (select 1 from item where id = v_item and business_id = v_business and is_active) then
      raise exception 'Unknown item';
    end if;
  else
    v_dim := case p_output ->> 'measure' when 'weight' then 'mass' when 'volume' then 'volume'
                                         when 'pieces' then 'count' end::unit_dimension;
    if v_dim is null then raise exception 'Say whether it is weighed, measured or counted in pieces'; end if;
    if exists (select 1 from item where business_id = v_business and is_active and lower(name) = lower(trim(p_name))) then
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
  return jsonb_build_object('recipe_id', r.id, 'item_id', v_item);
end $$;

-- A batch made: its ingredients out at their average cost, what came out in at
-- exactly that cost. p_output_qty in any of the made item's units; empty means
-- it came out as the recipe says.
create or replace function record_production(
  p_recipe uuid, p_batches numeric default 1, p_output_qty numeric default null, p_output_unit text default null,
  p_note text default null, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record');
  v_me uuid := (current_member()).id;
  r recipe; v_today date; v_location uuid; v_planned numeric; v_actual numeric; v_unit text;
  v_batch uuid := gen_random_uuid(); v_items uuid[]; l record; v_cost numeric; v_value numeric; v_total numeric := 0;
begin
  select * into r from recipe where id = p_recipe and business_id = v_business;
  if not found or r.output_item_id is null then raise exception 'Choose what was made'; end if;
  if not r.is_active then raise exception '% is not made any more: show it again to record a batch', r.name; end if;
  if p_batches is null or p_batches <= 0 then raise exception 'Enter how many batches were made'; end if;
  v_today := business_local_date(v_business, now());
  if recipe_version_on(r.id, v_today) is null then raise exception '% has no ingredients in force today', r.name; end if;
  v_planned := trim_scale(r.batch_yield_base * p_batches);
  if p_output_qty is null then
    v_actual := v_planned;
    v_unit := r.batch_yield_unit;
  else
    v_unit := coalesce(nullif(p_output_unit, ''), (select base_unit_code from item where id = r.output_item_id));
    v_actual := to_base_qty(r.output_item_id, p_output_qty, v_unit);
    if v_actual is null or v_actual <= 0 then
      raise exception 'Enter what came out, or leave it empty if it came out as the recipe says';
    end if;
  end if;
  v_location := resolve_location(v_business, p_location);

  select array_agg(distinct e.item_id) into v_items from expand_recipe(r.id, 'dine_in', p_batches, v_today) e;
  if v_items is null then raise exception '% has no ingredients', r.name; end if;
  if r.output_item_id = any(v_items) then raise exception 'A batch cannot use what it makes'; end if;
  perform lock_items(v_items || r.output_item_id);

  for l in select e.item_id, sum(e.base_qty) as qty from expand_recipe(r.id, 'dine_in', p_batches, v_today) e
            group by e.item_id order by e.item_id loop
    v_cost := item_issue_cost(v_business, l.item_id, v_location);
    v_value := money_round(v_business, v_cost * l.qty);
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, l.item_id, v_location, 'production_consumption', -l.qty, v_cost, v_value,
            'production_batch', v_batch, v_me, r.name);
    v_total := v_total + v_value;
  end loop;

  insert into production_batch (id, business_id, recipe_id, location_id, status, batches, planned_yield_base,
                                actual_yield_base, produced_at, responsible_user, quality_note, total_consumed_value,
                                output_item_id, output_unit_code)
  values (v_batch, v_business, r.id, v_location, 'completed', p_batches, v_planned, v_actual, now(), v_me,
          nullif(trim(p_note), ''), v_total, r.output_item_id, v_unit);
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, reference_id, app_user_id, reason)
  values (v_business, r.output_item_id, v_location, 'production_output', v_actual, v_total / v_actual, v_total,
          'production_batch', v_batch, v_me, r.name);

  return jsonb_build_object('batch_id', v_batch, 'planned', v_planned, 'actual', v_actual)
    || case when current_has_permission('cost.view')
            then jsonb_build_object('value', v_total, 'unit_cost', v_total / v_actual) else '{}' end;
end $$;

-- A batch recorded in error: every movement it made is reversed at the value it
-- had, and the batch is kept, marked cancelled, with the reason.
create or replace function cancel_production(p_batch uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  b production_batch; m record; v_items uuid[];
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the batch is cancelled'; end if;
  select * into b from production_batch where id = p_batch and business_id = v_business for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.status = 'cancelled' then raise exception 'This batch is already cancelled'; end if;
  if b.status <> 'completed' then raise exception 'Only a recorded batch can be cancelled'; end if;
  select array_agg(distinct item_id) into v_items from inventory_movement
   where reference_type = 'production_batch' and reference_id = p_batch;
  if v_items is not null then perform lock_items(v_items); end if;
  for m in select * from inventory_movement
            where reference_type = 'production_batch' and reference_id = p_batch
              and type in ('production_consumption', 'production_output') loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'reversal', -m.base_quantity_signed, m.unit_cost, m.value,
            'production_cancel', p_batch, v_me, 'Cancelled: ' || trim(p_reason));
  end loop;
  update production_batch set status = 'cancelled', cancelled_at = now(), cancelled_by = v_me,
                              cancel_reason = trim(p_reason)
   where id = p_batch;
  perform audit_event(v_business, 'production.cancel', 'production_batch', p_batch::text, trim(p_reason),
    jsonb_build_object('status', b.status), jsonb_build_object('status', 'cancelled'));
  return jsonb_build_object('batch_id', p_batch);
end $$;

-- What the café makes, with the ingredients in force today. Quantities only:
-- whoever records batches is not shown what anything costs.
create or replace function production_recipes()
returns table (recipe_id uuid, name text, output_item_id uuid, output_name text, output_unit text,
               yield_base numeric, yield_unit text, instructions text, is_active boolean, lines jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record', 'recipe.edit', 'cost.view');
  v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    select r.id, r.name, r.output_item_id, i.name, i.base_unit_code, r.batch_yield_base,
           coalesce(r.batch_yield_unit, i.base_unit_code), r.prep_instructions, r.is_active,
           coalesce((select jsonb_agg(jsonb_build_object(
                              'item_id', rl.item_id, 'name', li.name, 'quantity', rl.quantity,
                              'unit_code', rl.unit_code, 'base_qty', to_base_qty(rl.item_id, rl.quantity, rl.unit_code))
                            order by li.name)
                       from recipe_line rl join item li on li.id = rl.item_id
                      where rl.recipe_version_id = recipe_version_on(r.id, v_today)), '[]'::jsonb)
      from recipe r join item i on i.id = r.output_item_id
     where r.business_id = v_business and r.output_item_id is not null
     order by r.is_active desc, r.name;
end $$;

-- The batches made, newest first. Their cost only for those who see costs.
create or replace function production_batches(p_limit int default 50)
returns table (batch_id uuid, recipe_id uuid, recipe_name text, output_item_id uuid, output_name text,
               output_unit text, batches numeric, planned_base numeric, actual_base numeric, entered_unit text,
               status text, produced_at timestamptz, made_by text, note text, cancelled_at timestamptz,
               cancelled_by text, cancel_reason text, value numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record', 'cost.view');
  v_costs boolean := current_has_permission('cost.view');
begin
  return query
    select b.id, b.recipe_id, r.name, coalesce(b.output_item_id, r.output_item_id), i.name, i.base_unit_code,
           b.batches, b.planned_yield_base, b.actual_yield_base, coalesce(b.output_unit_code, i.base_unit_code),
           b.status::text, coalesce(b.produced_at, b.created_at), mk.full_name, b.quality_note,
           b.cancelled_at, cx.full_name, b.cancel_reason,
           case when v_costs then b.total_consumed_value end
      from production_batch b
      join recipe r on r.id = b.recipe_id
      left join item i on i.id = coalesce(b.output_item_id, r.output_item_id)
      left join app_user mk on mk.id = b.responsible_user
      left join app_user cx on cx.id = b.cancelled_by
     where b.business_id = v_business
     order by coalesce(b.produced_at, b.created_at) desc
     limit greatest(coalesce(p_limit, 50), 1);
end $$;

-- 0017's menu_recipe_lines, now naming each line's item, so a recipe can be
-- changed starting from the one in force.
drop function if exists menu_recipe_lines();
create or replace function menu_recipe_lines()
returns table (variant_id uuid, version_no int, effective_from date, component text,
               quantity numeric, unit_code text, channels sales_channel[], item_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    select vr.product_variant_id, rv.version_no, rv.effective_from,
           coalesce(i.name, sr.name, '—'), rl.quantity, rl.unit_code, rl.applies_to_channels, rl.item_id
      from variant_recipe vr
      join product_variant pv on pv.id = vr.product_variant_id and pv.business_id = v_business
      join recipe_version rv on rv.id = recipe_version_on(vr.recipe_id, v_today)
      join recipe_line rl on rl.recipe_version_id = rv.id
      left join item i on i.id = rl.item_id
      left join recipe sr on sr.id = rl.sub_recipe_id
     order by vr.product_variant_id, coalesce(i.name, sr.name);
end $$;

revoke execute on function write_recipe_lines(uuid, uuid, jsonb, uuid, boolean), start_recipe_version(uuid, date)
  from public, anon, authenticated;
revoke execute on function change_product_recipe(uuid, jsonb, date),
  save_batch_recipe(uuid, text, jsonb, numeric, text, jsonb, text, boolean),
  record_production(uuid, numeric, numeric, text, text, uuid), cancel_production(uuid, text),
  production_recipes(), production_batches(int), menu_recipe_lines()
  from public, anon;
grant execute on function
  change_product_recipe(uuid, jsonb, date),
  save_batch_recipe(uuid, text, jsonb, numeric, text, jsonb, text, boolean),
  record_production(uuid, numeric, numeric, text, text, uuid),
  cancel_production(uuid, text),
  production_recipes(),
  production_batches(int),
  menu_recipe_lines()
  to authenticated;
