-- =============================================================================
-- 0015_posting_functions.sql — every business operation is one atomic function.
--
-- The August audit found that the application posted through several separate
-- requests (C-06), ignored journal failures (C-04), did its money arithmetic in
-- floating point (H-07), generated idempotency keys on the server (H-01),
-- debited card takings to Cash (H-03), and raced on payments and auto-posting
-- (H-11). All of that lived in the application, where the database could not
-- see it.
--
-- Here each operation is a single PostgreSQL function, so it runs as ONE
-- transaction: the order, its lines, the stock movements and the balanced
-- journal commit together or not at all. Each function:
--   * acts only for the caller's own business (never a business passed in),
--   * checks the caller's permission (role_permission mirrors
--     src/domain/auth/permissions.ts; a test keeps the two identical),
--   * does all money in NUMERIC with banker's rounding, as the domain core does,
--   * posts through post_journal(), which builds draft -> lines -> publish.
--
-- They are SECURITY DEFINER: the caller needs no write access to any table.
-- 0016 removes every direct write grant, so these functions become the only
-- way in.
-- =============================================================================

-- =============================================================================
-- 1. Permissions — the database copy of src/domain/auth/permissions.ts
-- =============================================================================
create table if not exists role_permission (
  role       app_role not null,
  permission text     not null,
  primary key (role, permission)
);

truncate role_permission;
insert into role_permission (role, permission)
select r::app_role, p from (values
  -- owner and general_manager hold every permission
  ('owner','sale.create'),('owner','sale.refund'),('owner','sale.void'),('owner','discount.apply'),
  ('owner','recipe.edit'),('owner','cost.view'),('owner','profit.view'),('owner','inventory.count'),
  ('owner','inventory.count.view_expected'),('owner','inventory.adjust.approve'),('owner','waste.record'),
  ('owner','waste.approve'),('owner','purchase.create'),('owner','purchase.receive'),('owner','expense.record'),
  ('owner','day.close'),('owner','accounting.post'),('owner','accounting.period.lock'),
  ('owner','accounting.period.unlock'),('owner','platform.reconcile'),('owner','ai.view'),
  ('owner','audit.view'),('owner','settings.manage'),
  ('general_manager','sale.create'),('general_manager','sale.refund'),('general_manager','sale.void'),
  ('general_manager','discount.apply'),('general_manager','recipe.edit'),('general_manager','cost.view'),
  ('general_manager','profit.view'),('general_manager','inventory.count'),
  ('general_manager','inventory.count.view_expected'),('general_manager','inventory.adjust.approve'),
  ('general_manager','waste.record'),('general_manager','waste.approve'),('general_manager','purchase.create'),
  ('general_manager','purchase.receive'),('general_manager','expense.record'),('general_manager','day.close'),
  ('general_manager','accounting.post'),('general_manager','accounting.period.lock'),
  ('general_manager','platform.reconcile'),('general_manager','ai.view'),('general_manager','audit.view'),
  ('general_manager','settings.manage'),
  ('branch_manager','sale.create'),('branch_manager','sale.refund'),('branch_manager','sale.void'),
  ('branch_manager','discount.apply'),('branch_manager','cost.view'),('branch_manager','profit.view'),
  ('branch_manager','inventory.count'),('branch_manager','inventory.count.view_expected'),
  ('branch_manager','inventory.adjust.approve'),('branch_manager','waste.record'),('branch_manager','waste.approve'),
  ('branch_manager','purchase.create'),('branch_manager','purchase.receive'),('branch_manager','expense.record'),
  ('branch_manager','day.close'),('branch_manager','platform.reconcile'),('branch_manager','ai.view'),
  ('branch_manager','audit.view'),
  ('cashier','sale.create'),('cashier','discount.apply'),
  ('barista','sale.create'),('barista','waste.record'),
  ('inventory_counter','inventory.count'),
  ('purchasing','purchase.create'),('purchasing','purchase.receive'),('purchasing','cost.view'),
  ('accountant','cost.view'),('accountant','profit.view'),('accountant','expense.record'),
  ('accountant','accounting.post'),('accountant','accounting.period.lock'),('accountant','platform.reconcile'),
  ('accountant','audit.view'),
  ('auditor','cost.view'),('auditor','profit.view'),('auditor','audit.view')
) as v(r, p);

-- The signed-in person's active membership, or nothing.
create or replace function current_member() returns app_user
language sql stable security definer set search_path = public as $$
  select * from app_user where auth_user_id = auth.uid() and is_active limit 1
$$;

create or replace function current_has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_user au
    join user_role ur on ur.app_user_id = au.id
    join role_permission rp on rp.role = ur.role
    where au.auth_user_id = auth.uid() and au.is_active and rp.permission = p_permission
  )
$$;

-- Returns the caller's business, or raises if they may not do this.
create or replace function require_permission(variadic p_any text[]) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare m app_user; p text;
begin
  m := current_member();
  if m.id is null then
    raise exception 'Sign in to continue' using errcode = '28000';
  end if;
  foreach p in array p_any loop
    if current_has_permission(p) then return m.business_id; end if;
  end loop;
  raise exception 'You do not have permission to do this (needs %)', array_to_string(p_any, ' or ')
    using errcode = '42501';
end $$;

-- Cost and profit are for managers and above (audit C-01: costs were public).
create or replace function current_can_view_costs() returns boolean
language sql stable security definer set search_path = public as $$
  select current_has_permission('cost.view')
$$;

-- =============================================================================
-- 2. Exact money and quantities
-- =============================================================================
-- Banker's rounding, identical to the domain core's ROUND_HALF_EVEN (H-07).
create or replace function round_half_even(v numeric, places int) returns numeric
language plpgsql immutable as $$
declare
  f numeric := power(10::numeric, places);
  x numeric := v * f;
  t numeric := trunc(x);
begin
  -- Only an exact tie differs from ordinary rounding; the final round() also
  -- fixes the scale, so 5000 is stored as 5000 and not 5000.0000000000000000.
  if abs(x - t) = 0.5 then
    return round((case when mod(t, 2) = 0 then t else t + sign(x) end) / f, places);
  end if;
  return round(v, places);
end $$;

create or replace function money_round(p_business uuid, v numeric) returns numeric
language sql stable as $$
  select round_half_even(v, coalesce((select currency_decimals from business where id = p_business), 0))
$$;

-- A quantity in any of an item's units, converted to its base unit. The factor
-- comes from item_unit, never from the caller (the old receiving form trusted
-- a factor sent by the browser).
create or replace function to_base_qty(p_item uuid, p_qty numeric, p_unit text) returns numeric
language plpgsql stable as $$
declare v_base text; v_factor numeric;
begin
  select base_unit_code into v_base from item where id = p_item;
  if v_base is null then raise exception 'Unknown item %', p_item; end if;
  -- trim_scale keeps quantities canonical: 0.7 kg is stored as 700, not 700.0.
  if p_unit is null or p_unit = v_base then return trim_scale(p_qty); end if;
  select factor_to_base into v_factor from item_unit where item_id = p_item and code = p_unit;
  if v_factor is null then
    raise exception 'Unit "%" is not defined for this item (base unit is %)', p_unit, v_base;
  end if;
  return trim_scale(p_qty * v_factor);
end $$;

-- =============================================================================
-- 3. Locations, periods, costing
-- =============================================================================
create or replace function default_location(p_business uuid) returns uuid
language sql stable as $$
  select id from location
   where business_id = p_business and is_active and kind = 'branch'
   order by created_at, id limit 1
$$;

create or replace function resolve_location(p_business uuid, p_location uuid) returns uuid
language plpgsql stable as $$
declare v uuid;
begin
  if p_location is null then
    v := default_location(p_business);
  else
    select id into v from location where id = p_location and business_id = p_business and is_active;
  end if;
  if v is null then raise exception 'No active location for this business'; end if;
  return v;
end $$;

-- Quantity and value on hand, straight from the append-only ledger.
create or replace function item_position(p_business uuid, p_item uuid, p_location uuid,
                                         out qty numeric, out value numeric)
language sql stable as $$
  select coalesce(sum(base_quantity_signed), 0),
         coalesce(sum(coalesce(value, 0) * sign(base_quantity_signed)), 0)
    from inventory_movement
   where business_id = p_business and item_id = p_item and location_id = p_location
$$;

-- The moving-average cost an issue is valued at. With stock on hand it is
-- value / quantity. With none (or a negative position) it falls back to the
-- last known purchase cost — never to zero, which silently priced sales at
-- nothing and overstated margin (audit H-10).
create or replace function item_issue_cost(p_business uuid, p_item uuid, p_location uuid) returns numeric
language plpgsql stable as $$
declare p record; v_last numeric;
begin
  p := item_position(p_business, p_item, p_location);
  if p.qty > 0 and p.value > 0 then
    return p.value / p.qty;
  end if;
  select unit_cost into v_last from inventory_movement
   where business_id = p_business and item_id = p_item
     and base_quantity_signed > 0 and unit_cost > 0
   order by occurred_at desc, created_at desc limit 1;
  return coalesce(v_last, 0);
end $$;

-- Serialise concurrent postings against the same items: lock their rows in id
-- order (a consistent order cannot deadlock). Issues therefore read a settled
-- average and a settled quantity.
create or replace function lock_items(p_items uuid[]) returns void
language sql as $$
  select 1 from item where id = any(p_items) order by id for update
$$;

-- =============================================================================
-- 4. The one journal builder
-- =============================================================================
-- Lines: [{"code":"1000","debit":n,"credit":n,"memo":"..."}]. Amounts are
-- rounded once, here, to the business currency. Zero lines are dropped. The
-- entry is built as a draft, given its lines, then published; the database
-- then checks it at commit (0014).
create or replace function post_journal(
  p_business uuid, p_at timestamptz, p_description text,
  p_ref_type text, p_ref_id uuid, p_lines jsonb,
  p_reverses uuid default null, p_reference_no text default null)
returns uuid language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  l jsonb; v_account uuid; v_dr numeric; v_cr numeric;
  v_total_dr numeric := 0; v_total_cr numeric := 0;
begin
  insert into journal_entry (id, business_id, description, reference_type, reference_id,
                             occurred_at, status, reverses_entry, reference_no)
  values (v_id, p_business, p_description, p_ref_type, p_ref_id,
          coalesce(p_at, now()), 'draft', p_reverses, p_reference_no);

  for l in select * from jsonb_array_elements(p_lines) loop
    v_dr := money_round(p_business, coalesce((l ->> 'debit')::numeric, 0));
    v_cr := money_round(p_business, coalesce((l ->> 'credit')::numeric, 0));
    if v_dr < 0 or v_cr < 0 then
      raise exception 'Journal line amounts cannot be negative (account %)', l ->> 'code';
    end if;
    continue when v_dr = 0 and v_cr = 0;
    select id into v_account from gl_account
     where business_id = p_business and code = l ->> 'code' and is_active;
    if v_account is null then
      raise exception 'Account % is missing or inactive', l ->> 'code';
    end if;
    insert into journal_line (journal_entry_id, account_id, debit, credit, memo)
    values (v_id, v_account, v_dr, v_cr, nullif(l ->> 'memo', ''));
    v_total_dr := v_total_dr + v_dr;
    v_total_cr := v_total_cr + v_cr;
  end loop;

  if v_total_dr <> v_total_cr then
    raise exception 'Entry "%" does not balance: debits % <> credits %', p_description, v_total_dr, v_total_cr;
  end if;

  update journal_entry set status = 'published' where id = v_id;
  return v_id;
end $$;

-- =============================================================================
-- 5. Recipes: channel-aware expansion, honouring effective dates (audit M-04)
-- =============================================================================
create or replace function recipe_version_on(p_recipe uuid, p_on date) returns uuid
language sql stable as $$
  select id from recipe_version
   where recipe_id = p_recipe and effective_from <= p_on
     and (effective_to is null or effective_to >= p_on)
   order by version_no desc limit 1
$$;

create or replace function expand_recipe(p_recipe uuid, p_channel sales_channel, p_scale numeric,
                                         p_on date, p_depth int default 0)
returns table (item_id uuid, base_qty numeric)
language plpgsql stable as $$
declare v_version uuid; l record;
begin
  if p_depth > 10 then
    raise exception 'Recipe nesting is too deep or cyclic (recipe %)', p_recipe;
  end if;
  v_version := recipe_version_on(p_recipe, p_on);
  if v_version is null then
    raise exception 'Recipe % has no version in force on %', p_recipe, p_on;
  end if;
  for l in
    select * from recipe_line rl
     where rl.recipe_version_id = v_version
       and (rl.applies_to_channels is null or cardinality(rl.applies_to_channels) = 0
            or p_channel = any(rl.applies_to_channels))
  loop
    if l.component_type = 'item' then
      item_id := l.item_id;
      base_qty := to_base_qty(l.item_id, l.quantity * p_scale, l.unit_code);
      return next;
    else
      return query select * from expand_recipe(l.sub_recipe_id, p_channel, l.quantity * p_scale, p_on, p_depth + 1);
    end if;
  end loop;
end $$;

-- What one line of a sale takes out of stock, merged by item.
create or replace function expand_variant(p_variant uuid, p_channel sales_channel, p_qty numeric, p_on date)
returns table (item_id uuid, base_qty numeric)
language plpgsql stable as $$
declare v_resale uuid; v_recipe uuid;
begin
  select resale_item_id into v_resale from product_variant where id = p_variant;
  if v_resale is not null then
    item_id := v_resale; base_qty := p_qty; return next; return;
  end if;
  select recipe_id into v_recipe from variant_recipe where product_variant_id = p_variant;
  if v_recipe is null then return; end if;
  return query
    select e.item_id, sum(e.base_qty) from expand_recipe(v_recipe, p_channel, p_qty, p_on) e group by e.item_id;
end $$;

-- The price in force today for a variant on a channel: a location-specific
-- price wins over the business-wide one; a future-dated price does not apply
-- yet (audit M-04).
create or replace function price_on(p_variant uuid, p_channel sales_channel, p_location uuid, p_on date)
returns numeric language sql stable as $$
  select price from channel_price
   where product_variant_id = p_variant and channel = p_channel
     and effective_from <= p_on and (effective_to is null or effective_to >= p_on)
     and (location_id is null or location_id = p_location)
   order by (location_id is not null) desc, effective_from desc, created_at desc
   limit 1
$$;

-- =============================================================================
-- 6. Sales
-- =============================================================================
create or replace function tender_account(p_tender tender_type) returns text
language sql immutable as $$
  -- Card takings clear through 1010, not Cash (audit H-03).
  select case p_tender when 'cash' then '1000' when 'card' then '1010' when 'platform_paid' then '1100' end
$$;

create or replace function is_platform_channel(p_channel sales_channel) returns boolean
language sql immutable as $$ select p_channel in ('talabat', 'careem', 'toters') $$;

-- What a sale cost, for those allowed to see costs. A cashier is told the
-- price they charged, never the margin behind it.
create or replace function sale_cost_view(p_cogs numeric) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when current_has_permission('cost.view') then jsonb_build_object('cogs', p_cogs) else '{}'::jsonb end
$$;

-- Record a sale. p_idempotency_key is minted by the till when the cart is
-- created and reused on every retry, so a retried or double-submitted sale
-- returns the original instead of posting twice (audit H-01).
-- p_lines: [{"variant_id": uuid, "qty": n}]
create or replace function record_sale(
  p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  v_location uuid;
  v_order uuid;
  v_existing record;
  v_today date;
  v_prevent_negative boolean;
  l jsonb; v_variant uuid; v_qty numeric; v_price numeric; v_line_net numeric;
  v_net numeric := 0; v_cogs numeric := 0;
  d record; v_cost numeric; v_value numeric; v_line_cogs numeric;
  v_items uuid[];
  v_journal uuid;
begin
  if p_idempotency_key is null then
    raise exception 'A sale needs its idempotency key';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  if p_tender not in ('cash', 'card', 'platform_paid') then
    raise exception 'Tender % is not supported', p_tender;
  end if;
  if is_platform_channel(p_channel) <> (p_tender = 'platform_paid') then
    raise exception 'Delivery-platform orders are platform-paid, and only they are';
  end if;

  -- Replay: the same key returns the sale it already recorded.
  select id, net_amount, cogs_amount into v_existing
    from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'net', v_existing.net_amount, 'replayed', true)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, now());
  select prevent_negative_stock into v_prevent_negative from business where id = v_business;

  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
                           gross_amount, discount_amount, net_amount, cogs_amount, cashier_id)
  values (v_business, v_location, p_channel, 'open', p_idempotency_key, 0, 0, 0, 0, v_me)
  on conflict (business_id, idempotency_key) do nothing
  returning id into v_order;
  if v_order is null then
    -- A concurrent request with this key won the race; return its sale.
    select id, net_amount, cogs_amount into v_existing
      from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', v_existing.id, 'net', v_existing.net_amount, 'replayed', true)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  -- Lock every item this sale touches, in a stable order.
  select array_agg(distinct e.item_id) into v_items
    from jsonb_array_elements(p_lines) x,
         lateral expand_variant((x ->> 'variant_id')::uuid, p_channel, (x ->> 'qty')::numeric, v_today) e;
  if v_items is not null then perform lock_items(v_items); end if;

  -- Refuse to sell what is not there, when the business asks for that.
  if v_prevent_negative and v_items is not null then
    for d in
      select e.item_id, sum(e.base_qty) as need, i.name
        from jsonb_array_elements(p_lines) x,
             lateral expand_variant((x ->> 'variant_id')::uuid, p_channel, (x ->> 'qty')::numeric, v_today) e
        join item i on i.id = e.item_id
       group by e.item_id, i.name
    loop
      if (item_position(v_business, d.item_id, v_location)).qty < d.need then
        raise exception 'Not enough % in stock to make this sale', d.name;
      end if;
    end loop;
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    v_variant := (l ->> 'variant_id')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = v_variant and pv.business_id = v_business and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    v_price := price_on(v_variant, p_channel, v_location, v_today);
    if v_price is null then
      raise exception 'No % price is set for this product', p_channel;
    end if;
    v_line_net := money_round(v_business, v_price * v_qty);

    -- One costed movement per component per line, so every figure ties:
    -- line COGS = its movements; order COGS = all movements = the journal.
    -- Cost first, then write the line once: lines are append-only.
    v_line_cogs := 0;
    for d in select * from expand_variant(v_variant, p_channel, v_qty, v_today) loop
      v_cost := item_issue_cost(v_business, d.item_id, v_location);
      v_value := money_round(v_business, v_cost * d.base_qty);
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                      unit_cost, value, reference_type, reference_id, app_user_id, reason)
      values (v_business, d.item_id, v_location, 'sale_consumption', -d.base_qty,
              case when d.base_qty > 0 then v_value / d.base_qty end, v_value,
              'sales_order', v_order, v_me, 'Sale');
      v_line_cogs := v_line_cogs + v_value;
    end loop;

    insert into sales_order_line (sales_order_id, product_variant_id, quantity, unit_price, line_discount, line_net, cogs_amount)
    values (v_order, v_variant, v_qty, v_price, 0, v_line_net, v_line_cogs);

    v_net := v_net + v_line_net;
    v_cogs := v_cogs + v_line_cogs;
  end loop;

  insert into sales_tender (sales_order_id, tender_type, amount) values (v_order, p_tender, v_net);

  update sales_order
     set gross_amount = v_net, net_amount = v_net, cogs_amount = v_cogs, status = 'completed'
   where id = v_order;

  v_journal := post_journal(v_business, now(), 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
    jsonb_build_array(
      jsonb_build_object('code', tender_account(p_tender), 'debit', v_net),
      jsonb_build_object('code', '4000', 'credit', v_net),
      jsonb_build_object('code', '5000', 'debit', v_cogs),
      jsonb_build_object('code', '1200', 'credit', v_cogs)));

  return jsonb_build_object('order_id', v_order, 'net', v_net,
    'journal_no', (select journal_no from journal_entry where id = v_journal), 'replayed', false)
    || sale_cost_view(v_cogs);
end $$;

-- Reverse a published entry line for line, dated when the reversal happens.
-- An entry can be reversed once (0014's unique index enforces it).
create or replace function reverse_entry_internal(p_entry uuid, p_at timestamptz, p_description text)
returns uuid language plpgsql as $$
declare e journal_entry; v_lines jsonb;
begin
  select * into e from journal_entry where id = p_entry;
  if not found then raise exception 'Journal entry not found'; end if;
  if e.status <> 'published' then raise exception 'Only a published entry can be reversed'; end if;
  if exists (select 1 from journal_entry where reverses_entry = p_entry) then
    raise exception 'Journal % has already been reversed', e.journal_no;
  end if;
  select jsonb_agg(jsonb_build_object('code', a.code, 'debit', l.credit, 'credit', l.debit, 'memo', l.memo))
    into v_lines
    from journal_line l join gl_account a on a.id = l.account_id
   where l.journal_entry_id = p_entry;
  return post_journal(e.business_id, p_at, p_description, 'reversal', p_entry, v_lines, p_entry, e.reference_no);
end $$;

-- Void: the sale was rung in error. Same trading day only, before the day is
-- closed. Revenue, tender, COGS and stock all come back exactly (audit H-05).
create or replace function void_sale(p_order uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.void');
  v_me uuid := (current_member()).id;
  o sales_order; v_day date; v_journal uuid; v_rev uuid; m record;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason for the void'; end if;
  select * into o from sales_order where id = p_order and business_id = v_business for update;
  if not found then raise exception 'Sale not found'; end if;
  if o.status <> 'completed' then
    raise exception 'Only a completed sale can be voided; this one is %', o.status;
  end if;
  v_day := business_local_date(v_business, o.placed_at);
  if exists (select 1 from work_shift where business_id = v_business and location_id = o.location_id
               and business_day = v_day and closed_at is not null) then
    raise exception 'Trading day % is closed; refund the sale instead of voiding it', v_day;
  end if;
  select id into v_journal from journal_entry
   where business_id = v_business and reference_type = 'sales_order' and reference_id = p_order
     and reverses_entry is null and status = 'published';
  if v_journal is null then
    raise exception 'This sale has no journal to reverse (it predates the controls); refund it instead';
  end if;

  v_rev := reverse_entry_internal(v_journal, now(), 'Void of sale ' || left(p_order::text, 8) || ': ' || p_reason);
  for m in select * from inventory_movement
            where reference_type = 'sales_order' and reference_id = p_order and type = 'sale_consumption' loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'reversal', -m.base_quantity_signed,
            m.unit_cost, m.value, 'sale_void', p_order, v_me, 'Void: ' || p_reason);
  end loop;
  insert into sale_adjustment (business_id, sales_order_id, kind, amount, reason, requested_by, approved_by)
  values (v_business, p_order, 'void', o.net_amount, p_reason, v_me, v_me);
  update sales_order set status = 'voided' where id = p_order;
  perform audit_event(v_business, 'sale.void', 'sales_order', p_order::text, p_reason,
    jsonb_build_object('status', o.status, 'net', o.net_amount), jsonb_build_object('status', 'voided'));
  return jsonb_build_object('order_id', p_order,
    'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- Refund: money goes back to the customer. Revenue is reversed through
-- 4200 Sales returns, the tender is paid out, and only goods flagged
-- returnable go back on the shelf — a used cup or poured milk never does.
create or replace function refund_sale(p_order uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.refund');
  v_me uuid := (current_member()).id;
  o sales_order; v_tender tender_type; v_adj uuid; v_returned numeric := 0; v_journal uuid; m record;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason for the refund'; end if;
  select * into o from sales_order where id = p_order and business_id = v_business for update;
  if not found then raise exception 'Sale not found'; end if;
  if o.status <> 'completed' then
    raise exception 'Only a completed sale can be refunded; this one is %', o.status;
  end if;
  select tender_type into v_tender from sales_tender where sales_order_id = p_order limit 1;
  if tender_account(v_tender) is null then raise exception 'This sale''s tender cannot be refunded here'; end if;

  insert into sale_adjustment (business_id, sales_order_id, kind, amount, reason, requested_by, approved_by)
  values (v_business, p_order, 'refund', o.net_amount, p_reason, v_me, v_me) returning id into v_adj;

  for m in select mv.* from inventory_movement mv join item i on i.id = mv.item_id
            where mv.reference_type = 'sales_order' and mv.reference_id = p_order
              and mv.type = 'sale_consumption' and i.returnable_to_stock loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'refund_return_to_stock', -m.base_quantity_signed,
            m.unit_cost, m.value, 'sale_refund', v_adj, v_me, 'Refund: ' || p_reason);
    v_returned := v_returned + coalesce(m.value, 0);
  end loop;

  v_journal := post_journal(v_business, now(), 'Refund of sale ' || left(p_order::text, 8) || ': ' || p_reason,
    'sale_refund', v_adj, jsonb_build_array(
      jsonb_build_object('code', '4200', 'debit', o.net_amount),
      jsonb_build_object('code', tender_account(v_tender), 'credit', o.net_amount),
      jsonb_build_object('code', '1200', 'debit', v_returned),
      jsonb_build_object('code', '5000', 'credit', v_returned)));
  update sales_order set status = 'refunded' where id = p_order;
  perform audit_event(v_business, 'sale.refund', 'sales_order', p_order::text, p_reason,
    jsonb_build_object('status', o.status, 'net', o.net_amount),
    jsonb_build_object('status', 'refunded', 'returned_to_stock', v_returned));
  return jsonb_build_object('order_id', p_order, 'refunded', o.net_amount, 'returned_to_stock', v_returned,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- =============================================================================
-- 7. Purchasing: receipt -> GRNI -> bill -> payment (audit C-05)
-- =============================================================================
alter table business add column if not exists waste_approval_threshold numeric not null default 50000;

-- Split `p_extra` (freight + other - rebate) across lines in proportion to
-- their goods value, so the landed values add up to the rounded total EXACTLY:
-- floor every share to the currency unit, then hand the leftover units to the
-- largest remainders.
create or replace function allocate_landed(p_business uuid, p_goods numeric[], p_extra numeric)
returns numeric[] language plpgsql stable as $$
declare
  d int := coalesce((select currency_decimals from business where id = p_business), 0);
  u numeric := power(10::numeric, d);
  n int := cardinality(p_goods);
  total numeric := 0; g numeric;
  exact numeric[] := '{}'; floors numeric[] := '{}';
  target numeric; leftover int; i int; r record;
begin
  foreach g in array p_goods loop total := total + g; end loop;
  if total <= 0 then raise exception 'Goods value must be greater than zero to allocate landed costs'; end if;
  for i in 1 .. n loop
    exact := exact || (p_goods[i] + p_extra * p_goods[i] / total);
    floors := floors || (floor(exact[i] * u) / u);
  end loop;
  target := round_half_even(total + p_extra, d);
  leftover := ((target - (select sum(f) from unnest(floors) f)) * u)::int;
  for r in select idx from generate_series(1, n) idx
            order by (exact[idx] * u - floor(exact[idx] * u)) desc, idx limit greatest(leftover, 0) loop
    floors[r.idx] := floors[r.idx] + 1 / u;
  end loop;
  for i in 1 .. n loop
    if floors[i] < 0 then raise exception 'The rebate exceeds the value of a received line'; end if;
    floors[i] := round(floors[i], d);
  end loop;
  return floors;
end $$;

-- Receive stock: Dr Inventory / Cr Goods received not invoiced. The payable is
-- recognised by the bill, not here, so receiving and billing never both
-- credit Accounts payable (audit C-05).
-- p_lines: [{"item_id": uuid, "qty": n, "unit_code": "kg", "goods_value": n}]
create or replace function receive_goods(
  p_supplier uuid, p_lines jsonb, p_freight numeric default 0, p_other numeric default 0,
  p_rebate numeric default 0, p_note text default null, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.receive');
  v_me uuid := (current_member()).id;
  v_location uuid; v_receipt uuid; v_no bigint;
  v_goods numeric[] := '{}'; v_landed numeric[]; v_items uuid[] := '{}';
  l jsonb; i int := 0; v_item uuid; v_base numeric; v_mv uuid; v_total numeric := 0; v_journal uuid;
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
    if not exists (select 1 from item where id = v_item and business_id = v_business) then
      raise exception 'Unknown item on the receipt';
    end if;
    if coalesce((l ->> 'qty')::numeric, 0) <= 0 then raise exception 'Every received line needs a quantity'; end if;
    if coalesce((l ->> 'goods_value')::numeric, -1) < 0 then raise exception 'Every received line needs a value'; end if;
    v_goods := v_goods || money_round(v_business, (l ->> 'goods_value')::numeric);
    v_items := v_items || v_item;
  end loop;
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
  return jsonb_build_object('receipt_id', v_receipt, 'receipt_no', v_no, 'value', v_total,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- The GRNI a receipt raised (what its bill must clear).
create or replace function receipt_grni_value(p_receipt uuid) returns numeric
language sql stable as $$
  select coalesce(sum(jl.credit), 0)
    from journal_entry je
    join journal_line jl on jl.journal_entry_id = je.id
    join gl_account a on a.id = jl.account_id and a.code = '2050'
   where je.reference_type = 'goods_receipt' and je.reference_id = p_receipt
     and je.status = 'published' and je.reverses_entry is null
$$;

-- Record a supplier's bill. Either it is for a receipt (stock): Dr GRNI for
-- what the receipt raised, the difference to Purchase price variance, Cr A/P;
-- or it is for something that is not stock: Dr the chosen account, Cr A/P.
-- A bill never debits Inventory on its own (audit C-05).
create or replace function record_bill(
  p_supplier uuid, p_invoice_no text, p_invoice_date date, p_amount numeric, p_term_days int default 0,
  p_receipt uuid default null, p_account_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_amount numeric; v_grni numeric; v_ppv numeric; v_bill uuid; v_journal uuid; v_lines jsonb;
  v_acct gl_account;
begin
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business) then
    raise exception 'Choose a supplier';
  end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if nullif(trim(p_invoice_no), '') is null then raise exception 'Enter the supplier''s invoice number'; end if;
  if (p_receipt is null) = (p_account_code is null) then
    raise exception 'A bill is either for a goods receipt or for an expense account — choose one';
  end if;
  -- Against every bill ever entered, including those before the controls (M-07).
  if exists (select 1 from purchase_invoice where business_id = v_business and supplier_id = p_supplier
               and lower(invoice_no) = lower(trim(p_invoice_no)) and cancelled_at is null) then
    raise exception 'Invoice % from this supplier is already recorded', trim(p_invoice_no);
  end if;

  v_bill := gen_random_uuid();
  if p_receipt is not null then
    perform 1 from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Receipt not found'; end if;
    if exists (select 1 from goods_receipt where id = p_receipt and supplier_id is distinct from p_supplier) then
      raise exception 'That receipt is from a different supplier';
    end if;
    if exists (select 1 from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null) then
      raise exception 'That receipt has already been billed';
    end if;
    v_grni := receipt_grni_value(p_receipt);
    if v_grni = 0 then
      raise exception 'That receipt was recorded before goods-received-not-invoiced existed; its payable is already in Accounts payable (see docs/REMEDIATION.md)';
    end if;
    v_ppv := v_amount - v_grni;
    v_lines := jsonb_build_array(
      jsonb_build_object('code', '2050', 'debit', v_grni),
      jsonb_build_object('code', '5050', 'debit', greatest(v_ppv, 0), 'credit', greatest(-v_ppv, 0)),
      jsonb_build_object('code', '2000', 'credit', v_amount));
  else
    select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
    if not found or v_acct.account_type not in ('expense', 'asset')
       or p_account_code in ('1000', '1010', '1020', '1100', '1200', '5000', '5050', '5300', '5400') then
      raise exception 'Account % cannot take a bill; stock is billed against its goods receipt', p_account_code;
    end if;
    v_lines := jsonb_build_array(
      jsonb_build_object('code', p_account_code, 'debit', v_amount),
      jsonb_build_object('code', '2000', 'credit', v_amount));
  end if;

  v_journal := post_journal(v_business, (coalesce(p_invoice_date, business_local_date(v_business, now())) + time '12:00')
                                          at time zone (select timezone from business where id = v_business),
    'Bill ' || trim(p_invoice_no), 'purchase_invoice', v_bill, v_lines, null, trim(p_invoice_no));
  insert into purchase_invoice (id, business_id, supplier_id, invoice_no, invoice_date, due_date, amount_total,
                                goods_receipt_id, expense_account_code, journal_entry_id)
  values (v_bill, v_business, p_supplier, trim(p_invoice_no),
          coalesce(p_invoice_date, business_local_date(v_business, now())),
          coalesce(p_invoice_date, business_local_date(v_business, now())) + greatest(coalesce(p_term_days, 0), 0),
          v_amount, p_receipt, p_account_code, v_journal);
  return jsonb_build_object('bill_id', v_bill, 'journal_no', (select journal_no from journal_entry where id = v_journal),
                            'price_variance', coalesce(v_ppv, 0));
end $$;

create or replace function payment_account(p_method text) returns text
language sql immutable as $$
  select case lower(p_method) when 'cash' then '1000' when 'card' then '1010'
                              when 'bank' then '1020' when 'transfer' then '1020' end
$$;

-- Pay a bill: Dr A/P, Cr the account the money left. The bill is locked for
-- the duration, and 0014 makes overpayment impossible even under a race.
create or replace function pay_bill(p_bill uuid, p_amount numeric, p_method text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  b purchase_invoice; v_amount numeric; v_pay uuid := gen_random_uuid(); v_journal uuid;
begin
  select * into b from purchase_invoice where id = p_bill and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if b.cancelled_at is not null then raise exception 'That bill was cancelled; it is not owed'; end if;
  if payment_account(p_method) is null then raise exception 'Pay by cash, card or bank transfer'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if v_amount > b.amount_total - b.paid_amount then
    raise exception 'That is more than the % outstanding on this bill', b.amount_total - b.paid_amount;
  end if;
  v_journal := post_journal(v_business, now(), 'Payment — bill ' || coalesce(b.invoice_no, ''), 'supplier_payment', v_pay,
    jsonb_build_array(jsonb_build_object('code', '2000', 'debit', v_amount),
                      jsonb_build_object('code', payment_account(p_method), 'credit', v_amount)));
  insert into supplier_payment (id, business_id, supplier_id, purchase_invoice_id, amount, paid_on, method, journal_entry_id)
  values (v_pay, v_business, b.supplier_id, b.id, v_amount, business_local_date(v_business, now()), lower(p_method), v_journal);
  return jsonb_build_object('payment_id', v_pay, 'journal_no', (select journal_no from journal_entry where id = v_journal),
    'outstanding', (select amount_total - paid_amount from purchase_invoice where id = p_bill));
end $$;

-- Cancel a bill entered in error — a duplicate, the wrong amount, the wrong
-- supplier. Nothing is deleted: the bill stays on record with its reason, its
-- journal is reversed as of the day the cancellation takes effect, it stops
-- counting as owed, and its invoice number and receipt are free to be billed
-- correctly (audit M-07). A bill with payments against it cannot be cancelled.
create or replace function cancel_bill(p_bill uuid, p_reason text, p_date date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  b purchase_invoice; v_day date; v_at timestamptz; v_rev uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the bill is being cancelled'; end if;
  select * into b from purchase_invoice where id = p_bill and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if b.cancelled_at is not null then raise exception 'This bill is already cancelled'; end if;
  if exists (select 1 from supplier_payment where purchase_invoice_id = p_bill) then
    raise exception 'This bill has payments against it, so it cannot be cancelled';
  end if;
  v_day := coalesce(p_date, business_local_date(v_business, now()));
  if v_day < b.invoice_date then raise exception 'A bill cannot be cancelled before its own date'; end if;
  v_at := (v_day + time '12:00') at time zone (select timezone from business where id = v_business);
  if b.journal_entry_id is not null
     and exists (select 1 from journal_entry where id = b.journal_entry_id and status = 'published')
     and not exists (select 1 from journal_entry where reverses_entry = b.journal_entry_id) then
    v_rev := reverse_entry_internal(b.journal_entry_id, v_at,
                                    'Cancelled bill ' || coalesce(b.invoice_no, '') || ': ' || trim(p_reason));
  end if;
  update purchase_invoice set cancelled_at = v_at, cancel_reason = trim(p_reason) where id = p_bill;
  perform audit_event(v_business, 'bill.cancel', 'purchase_invoice', p_bill::text, p_reason,
    jsonb_build_object('invoice_no', b.invoice_no, 'amount', b.amount_total, 'legacy', b.legacy),
    jsonb_build_object('reversal', v_rev));
  return jsonb_build_object('journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- =============================================================================
-- 8. Expenses, waste and stock corrections
-- =============================================================================
-- The account is proposed by the app's classification rules and confirmed by
-- the person; the database only checks it is an account an expense may use.
create or replace function record_expense(
  p_description text, p_amount numeric, p_account_code text, p_paid_from text default 'cash', p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('expense.record');
  v_me uuid := (current_member()).id;
  v_amount numeric; v_date date; v_acct gl_account; v_exp uuid := gen_random_uuid(); v_journal uuid;
begin
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Describe the expense'; end if;
  select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
  if not found or v_acct.account_type <> 'expense' or p_account_code in ('5000', '5050', '5300', '5400') then
    raise exception 'Account % cannot take an expense (stock costs come from their own records)', p_account_code;
  end if;
  if payment_account(p_paid_from) is null then raise exception 'Paid from cash, card or bank'; end if;
  v_date := coalesce(p_date, business_local_date(v_business, now()));

  v_journal := post_journal(v_business, (v_date + time '12:00') at time zone (select timezone from business where id = v_business),
    'Expense: ' || trim(p_description), 'expense', v_exp,
    jsonb_build_array(jsonb_build_object('code', p_account_code, 'debit', v_amount),
                      jsonb_build_object('code', payment_account(p_paid_from), 'credit', v_amount)));
  insert into expense (id, business_id, amount, incurred_on, description, journal_entry_id, created_by)
  values (v_exp, v_business, v_amount, v_date, trim(p_description), v_journal, v_me);
  return jsonb_build_object('expense_id', v_exp, 'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- Waste, spoilage and the like: stock out at average cost, Dr Waste / Cr
-- Inventory, in one step. Above the business's threshold the person must hold
-- waste.approve themselves (audit M-13).
create or replace function record_waste(
  p_item uuid, p_qty numeric, p_unit_code text, p_type movement_type, p_reason text, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('waste.record');
  v_me uuid := (current_member()).id;
  v_location uuid; v_base numeric; v_cost numeric; v_value numeric; v_mv uuid; v_journal uuid;
begin
  if p_type not in ('waste', 'spoilage', 'expired', 'damaged', 'melt_evaporation',
                    'staff_consumption', 'complimentary', 'sampling') then
    raise exception 'Not a waste type: %', p_type;
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the stock was lost'; end if;
  if not exists (select 1 from item where id = p_item and business_id = v_business) then raise exception 'Unknown item'; end if;
  v_base := to_base_qty(p_item, p_qty, p_unit_code);
  if v_base is null or v_base <= 0 then raise exception 'Enter a quantity greater than zero'; end if;
  v_location := resolve_location(v_business, p_location);
  perform lock_items(array[p_item]);
  v_cost := item_issue_cost(v_business, p_item, v_location);
  v_value := money_round(v_business, v_cost * v_base);
  if v_value > (select waste_approval_threshold from business where id = v_business)
     and not current_has_permission('waste.approve') then
    -- Not saying the value: whoever lacks waste.approve may also lack cost.view.
    raise exception 'This much waste needs a manager to record it' using errcode = '42501';
  end if;

  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, app_user_id, reason, approval_status)
  values (v_business, p_item, v_location, p_type, -v_base, v_cost, v_value, 'waste', v_me, trim(p_reason),
          case when current_has_permission('waste.approve') then 'approved' else 'not_required' end::approval_status)
  returning id into v_mv;
  v_journal := post_journal(v_business, now(), initcap(replace(p_type::text, '_', ' ')) || ': ' || trim(p_reason),
    'inventory_movement', v_mv,
    jsonb_build_array(jsonb_build_object('code', '5300', 'debit', v_value),
                      jsonb_build_object('code', '1200', 'credit', v_value)));
  return jsonb_build_object('movement_id', v_mv,
    'journal_no', (select journal_no from journal_entry where id = v_journal))
    || case when current_has_permission('cost.view') then jsonb_build_object('value', v_value) else '{}' end;
end $$;

-- A manager's stock correction outside a count. Losses at average cost; gains
-- at a stated cost or the average. Posted against 5400 Inventory count variance.
create or replace function adjust_stock(
  p_item uuid, p_delta numeric, p_unit_code text, p_reason text,
  p_unit_cost numeric default null, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  v_location uuid; v_base numeric; v_cost numeric; v_value numeric; v_mv uuid; v_journal uuid; v_lines jsonb;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the stock is being corrected'; end if;
  if not exists (select 1 from item where id = p_item and business_id = v_business) then raise exception 'Unknown item'; end if;
  v_base := to_base_qty(p_item, p_delta, p_unit_code);
  if v_base is null or v_base = 0 then raise exception 'The correction cannot be zero'; end if;
  v_location := resolve_location(v_business, p_location);
  perform lock_items(array[p_item]);
  v_cost := case when v_base > 0 and p_unit_cost is not null then p_unit_cost
                 else item_issue_cost(v_business, p_item, v_location) end;
  if v_cost < 0 then raise exception 'Unit cost cannot be negative'; end if;
  v_value := money_round(v_business, v_cost * abs(v_base));
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, app_user_id, reason, approval_status)
  values (v_business, p_item, v_location, 'manual_correction', v_base, v_cost, v_value, 'adjustment', v_me,
          trim(p_reason), 'approved')
  returning id into v_mv;
  v_lines := case when v_base < 0
    then jsonb_build_array(jsonb_build_object('code', '5400', 'debit', v_value), jsonb_build_object('code', '1200', 'credit', v_value))
    else jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_value), jsonb_build_object('code', '5400', 'credit', v_value)) end;
  if v_value > 0 then
    v_journal := post_journal(v_business, now(), 'Stock correction: ' || trim(p_reason), 'inventory_movement', v_mv, v_lines);
  end if;
  perform audit_event(v_business, 'inventory.adjust', 'inventory_movement', v_mv::text, p_reason, null,
                      jsonb_build_object('item', p_item, 'delta', v_base, 'value', v_value));
  return jsonb_build_object('movement_id', v_mv, 'value', v_value,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- =============================================================================
-- 9. Master data, created atomically (a half-made product is its own C-06)
-- =============================================================================
create or replace function create_supplier(p_name text, p_contact text default null, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('purchase.create'); v_id uuid;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the supplier'; end if;
  insert into supplier (business_id, name, contact, phone)
  values (v_business, trim(p_name), nullif(trim(p_contact), ''), nullif(trim(p_phone), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Create a stock item, its alternate units, and (optionally) its opening stock:
-- Dr Inventory / Cr Owner equity, so the books know the stock exists.
-- p_units: [{"code":"kg","label":"Kilogram","factor":1000}]
create or replace function create_item(
  p_name text, p_item_type item_type, p_base_unit text, p_dimension unit_dimension,
  p_name_ar text default null, p_name_ckb text default null, p_min_level numeric default null,
  p_units jsonb default '[]', p_opening_qty numeric default null, p_opening_unit_cost numeric default null,
  p_returnable boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  v_item uuid; u jsonb; v_value numeric; v_mv uuid; v_journal uuid; v_location uuid;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the item'; end if;
  if nullif(trim(p_base_unit), '') is null then raise exception 'Give the item a base unit'; end if;
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
            'opening_balance', v_me, 'Opening balance')
    returning id into v_mv;
    if v_value > 0 then
      v_journal := post_journal(v_business, now(), 'Opening stock: ' || trim(p_name), 'inventory_movement', v_mv,
        jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_value),
                          jsonb_build_object('code', '3000', 'credit', v_value)));
    end if;
  end if;
  return jsonb_build_object('item_id', v_item, 'opening_value', coalesce(v_value, 0));
end $$;

-- p_prices: {"dine_in": 2500, "takeaway": 2500}
-- p_recipe: [{"item_id": uuid, "qty": n, "unit_code": "g", "channels": ["takeaway"]}]
create or replace function create_product(
  p_name text, p_prices jsonb, p_recipe jsonb default '[]',
  p_name_ar text default null, p_name_ckb text default null, p_category uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_today date; v_product uuid; v_variant uuid; v_recipe uuid; v_version uuid; l jsonb; k text; v numeric;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the product'; end if;
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
  insert into variant_recipe (product_variant_id, recipe_id) values (v_variant, v_recipe);
  for k, v in select key, value::numeric from jsonb_each_text(coalesce(p_prices, '{}')) loop
    if v is not null and v > 0 then
      insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
      values (v_business, v_variant, k::sales_channel, v, v_today);
    end if;
  end loop;
  return jsonb_build_object('product_id', v_product, 'variant_id', v_variant, 'recipe_id', v_recipe);
end $$;

-- A new price from a date; history is kept, and a sale uses the price in force
-- on its own date (audit M-04).
create or replace function set_price(p_variant uuid, p_channel sales_channel, p_price numeric, p_effective_from date default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit');
begin
  if not exists (select 1 from product_variant where id = p_variant and business_id = v_business) then
    raise exception 'Unknown product';
  end if;
  if p_price is null or p_price < 0 then raise exception 'Enter a price'; end if;
  insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
  values (v_business, p_variant, p_channel, p_price, coalesce(p_effective_from, business_local_date(v_business, now())));
end $$;

-- A new recipe version from a date (today or later — past sales keep the
-- version they were made with).
create or replace function new_recipe_version(p_recipe uuid, p_lines jsonb, p_effective_from date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_from date; v_no int; v_version uuid; l jsonb;
begin
  if not exists (select 1 from recipe where id = p_recipe and business_id = v_business) then raise exception 'Unknown recipe'; end if;
  v_from := coalesce(p_effective_from, business_local_date(v_business, now()));
  if v_from < business_local_date(v_business, now()) then
    raise exception 'A new recipe version cannot start in the past';
  end if;
  update recipe_version set effective_to = v_from - 1
   where recipe_id = p_recipe and (effective_to is null or effective_to >= v_from) and effective_from < v_from;
  select coalesce(max(version_no), 0) + 1 into v_no from recipe_version where recipe_id = p_recipe;
  insert into recipe_version (recipe_id, version_no, effective_from) values (p_recipe, v_no, v_from) returning id into v_version;
  for l in select * from jsonb_array_elements(p_lines) loop
    perform to_base_qty((l ->> 'item_id')::uuid, 1, l ->> 'unit_code');
    insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
    values (v_version, 'item', (l ->> 'item_id')::uuid, (l ->> 'qty')::numeric,
            coalesce(l ->> 'unit_code', (select base_unit_code from item where id = (l ->> 'item_id')::uuid)),
            case when jsonb_typeof(l -> 'channels') = 'array' and jsonb_array_length(l -> 'channels') > 0
                 then array(select jsonb_array_elements_text(l -> 'channels'))::sales_channel[] end);
  end loop;
  return v_version;
end $$;

-- =============================================================================
-- 10. Stock counts: blind, two-person, server-side expectation (audit H-12)
-- =============================================================================
-- Opening a count snapshots what the ledger expects, server-side. The counter
-- never sees it and can never supply it.
create or replace function start_stock_count(p_items uuid[] default null, p_location uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.count');
  v_me uuid := (current_member()).id;
  v_location uuid; v_count uuid;
begin
  v_location := resolve_location(v_business, p_location);
  insert into stock_count (business_id, location_id, count_type, status, is_blind, counted_by)
  values (v_business, v_location, case when p_items is null then 'full' else 'cycle' end::count_type,
          'counting', true, v_me)
  returning id into v_count;
  insert into stock_count_line (stock_count_id, item_id, expected_base)
  select v_count, i.id, (item_position(v_business, i.id, v_location)).qty
    from item i where i.business_id = v_business and i.is_active
     and (p_items is null or i.id = any(p_items));
  return v_count;
end $$;

create or replace function record_count(p_count uuid, p_item uuid, p_counted numeric, p_unit_code text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('inventory.count'); c stock_count;
begin
  select * into c from stock_count where id = p_count and business_id = v_business;
  if not found then raise exception 'Count not found'; end if;
  if c.counted_by is distinct from (current_member()).id then raise exception 'Only the person counting can enter counts'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'Enter what you counted'; end if;
  update stock_count_line set counted_base = to_base_qty(p_item, p_counted, p_unit_code)
   where stock_count_id = p_count and item_id = p_item;
  if not found then raise exception 'That item is not in this count'; end if;
end $$;

create or replace function submit_stock_count(p_count uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('inventory.count'); c stock_count;
begin
  select * into c from stock_count where id = p_count and business_id = v_business for update;
  if not found then raise exception 'Count not found'; end if;
  if c.counted_by is distinct from (current_member()).id then raise exception 'Only the person counting can submit'; end if;
  if c.status <> 'counting' then raise exception 'This count is already %', c.status; end if;
  if exists (select 1 from stock_count_line where stock_count_id = p_count and counted_base is null) then
    raise exception 'Some items have not been counted yet';
  end if;
  update stock_count set status = 'submitted', submitted_at = now() where id = p_count;
end $$;

-- What a reviewer sees: expected, counted, variance and its value. Only for
-- people allowed to see expected quantities; counters cannot call this.
create or replace function review_stock_count(p_count uuid)
returns table (item_id uuid, item_name text, expected numeric, counted numeric, variance numeric, variance_value numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('inventory.count.view_expected'); c stock_count;
begin
  select * into c from stock_count where id = p_count and business_id = v_business;
  if not found then raise exception 'Count not found'; end if;
  return query
    select l.item_id, i.name, l.expected_base, l.counted_base, l.counted_base - l.expected_base,
           money_round(v_business, (l.counted_base - l.expected_base) * item_issue_cost(v_business, l.item_id, c.location_id))
      from stock_count_line l join item i on i.id = l.item_id
     where l.stock_count_id = p_count
     order by i.name;
end $$;

-- A different person approves; the variance is posted as of the moment the
-- count was submitted: Dr/Cr 5400 Inventory count variance against 1200.
create or replace function approve_stock_count(p_count uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  c stock_count; l record; v_delta numeric; v_cost numeric; v_value numeric; v_mv uuid;
  v_loss numeric := 0; v_gain numeric := 0; v_journal uuid; v_items uuid[];
begin
  select * into c from stock_count where id = p_count and business_id = v_business for update;
  if not found then raise exception 'Count not found'; end if;
  if c.status <> 'submitted' then raise exception 'Only a submitted count can be approved; this one is %', c.status; end if;
  if c.counted_by = v_me then
    raise exception 'A count must be approved by someone other than the person who counted it' using errcode = '42501';
  end if;
  select array_agg(item_id) into v_items from stock_count_line where stock_count_id = p_count;
  if v_items is not null then perform lock_items(v_items); end if;

  for l in select * from stock_count_line where stock_count_id = p_count loop
    v_delta := l.counted_base - l.expected_base;
    continue when v_delta = 0;
    v_cost := item_issue_cost(v_business, l.item_id, c.location_id);
    v_value := money_round(v_business, v_cost * abs(v_delta));
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason, approval_status, occurred_at)
    values (v_business, l.item_id, c.location_id, 'count_adjustment', v_delta, v_cost, v_value,
            'stock_count', p_count, v_me, 'Count variance', 'approved', c.submitted_at)
    returning id into v_mv;
    update stock_count_line set adjustment_movement_id = v_mv where id = l.id;
    if v_delta < 0 then v_loss := v_loss + v_value; else v_gain := v_gain + v_value; end if;
  end loop;

  if v_loss > 0 or v_gain > 0 then
    v_journal := post_journal(v_business, c.submitted_at, 'Stock count variance', 'stock_count', p_count,
      jsonb_build_array(
        jsonb_build_object('code', '5400', 'debit', v_loss), jsonb_build_object('code', '1200', 'credit', v_loss),
        jsonb_build_object('code', '1200', 'debit', v_gain), jsonb_build_object('code', '5400', 'credit', v_gain)));
  end if;
  update stock_count set status = 'approved', approved_by = v_me, approved_at = now() where id = p_count;
  perform audit_event(v_business, 'inventory.count.approve', 'stock_count', p_count::text, null, null,
                      jsonb_build_object('loss', v_loss, 'gain', v_gain));
  return jsonb_build_object('loss', v_loss, 'gain', v_gain,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

create or replace function reject_stock_count(p_count uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('inventory.adjust.approve'); v_me uuid := (current_member()).id; c stock_count;
begin
  select * into c from stock_count where id = p_count and business_id = v_business for update;
  if not found then raise exception 'Count not found'; end if;
  if c.status <> 'submitted' then raise exception 'Only a submitted count can be rejected'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the count is rejected'; end if;
  update stock_count set status = 'rejected', approved_by = v_me, approved_at = now(), rejected_reason = trim(p_reason)
   where id = p_count;
end $$;

-- =============================================================================
-- 11. Closing the trading day (audit H-09: in the business's own timezone)
-- =============================================================================
create or replace function day_cash_totals(p_business uuid, p_location uuid, p_day date,
                                           out cash_sales numeric, out cash_refunds numeric, out orders int)
language sql stable as $$
  select
    coalesce((select sum(t.amount) from sales_order o join sales_tender t on t.sales_order_id = o.id
               where o.business_id = p_business and o.location_id = p_location and t.tender_type = 'cash'
                 and o.status in ('completed', 'refunded', 'partially_refunded')
                 and business_local_date(p_business, o.placed_at) = p_day), 0),
    coalesce((select sum(a.amount) from sale_adjustment a join sales_order o on o.id = a.sales_order_id
               join sales_tender t on t.sales_order_id = o.id and t.tender_type = 'cash'
               where a.business_id = p_business and o.location_id = p_location and a.kind = 'refund'
                 and business_local_date(p_business, a.created_at) = p_day), 0),
    (select count(*)::int from sales_order o
      where o.business_id = p_business and o.location_id = p_location and o.status <> 'voided'
        and business_local_date(p_business, o.placed_at) = p_day)
$$;

-- Count the drawer against what the day should hold. Once per day; the
-- difference posts to 6300 Cash over/short, dated on the day itself.
create or replace function close_day(p_day date, p_counted_cash numeric, p_opening_float numeric default 0,
                                     p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close');
  v_me uuid := (current_member()).id;
  v_location uuid; t record; v_expected numeric; v_counted numeric; v_variance numeric;
  v_shift uuid; v_at timestamptz; v_journal uuid;
begin
  if p_day is null or p_day > business_local_date(v_business, now()) then
    raise exception 'Choose a trading day that has happened';
  end if;
  v_location := resolve_location(v_business, p_location);
  if exists (select 1 from work_shift where business_id = v_business and location_id = v_location
               and business_day = p_day and closed_at is not null) then
    raise exception 'Trading day % is already closed', p_day;
  end if;
  t := day_cash_totals(v_business, v_location, p_day);
  v_expected := money_round(v_business, coalesce(p_opening_float, 0) + t.cash_sales - t.cash_refunds);
  v_counted := money_round(v_business, p_counted_cash);
  if v_counted is null or v_counted < 0 then raise exception 'Enter the cash you counted'; end if;
  v_variance := v_counted - v_expected;
  v_at := (p_day + time '23:59') at time zone (select timezone from business where id = v_business);

  insert into work_shift (business_id, location_id, opened_by, opened_at, closed_at, opening_float,
                          counted_cash, expected_cash, variance, business_day)
  values (v_business, v_location, v_me, (p_day + time '00:00') at time zone (select timezone from business where id = v_business),
          now(), coalesce(p_opening_float, 0), v_counted, v_expected, v_variance, p_day)
  returning id into v_shift;
  if v_variance <> 0 then
    v_journal := post_journal(v_business, v_at, 'Cash over/short — ' || p_day, 'work_shift', v_shift,
      case when v_variance < 0
        then jsonb_build_array(jsonb_build_object('code', '6300', 'debit', -v_variance), jsonb_build_object('code', '1000', 'credit', -v_variance))
        else jsonb_build_array(jsonb_build_object('code', '1000', 'debit', v_variance), jsonb_build_object('code', '6300', 'credit', v_variance)) end);
  end if;
  return jsonb_build_object('expected', v_expected, 'counted', v_counted, 'variance', v_variance,
    'orders', t.orders, 'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- =============================================================================
-- 12. Manual journals: controlled (audit "manual journals cannot bypass controls")
-- =============================================================================
-- Accounts with a subledger behind them are closed to manual journals: posting
-- straight to them would break the reconciliation that proves the books.
create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$ select p_code in ('1200', '2000', '2050', '3100') $$;

-- p_lines: [{"code":"6200","debit":25000,"credit":0,"memo":"..."}]
create or replace function save_journal(p_date date, p_description text, p_lines jsonb, p_publish boolean,
                                        p_reference_no text default null, p_reverse_on date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_id uuid := gen_random_uuid(); v_at timestamptz; l jsonb; v_account uuid; v_rev uuid;
  v_dr numeric := 0; v_cr numeric := 0; n int := 0;
begin
  if nullif(trim(p_description), '') is null then raise exception 'Narrate the journal'; end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one line'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if manual_journal_blocked(l ->> 'code') then
      raise exception 'Account % has a subledger and cannot take a manual journal; use a receipt, bill, count or payment', l ->> 'code';
    end if;
  end loop;
  v_at := (coalesce(p_date, business_local_date(v_business, now())) + time '12:00')
            at time zone (select timezone from business where id = v_business);

  insert into journal_entry (id, business_id, description, reference_type, reference_no, occurred_at, status, reverse_on)
  values (v_id, v_business, trim(p_description), 'manual', nullif(trim(p_reference_no), ''), v_at, 'draft', p_reverse_on);
  for l in select * from jsonb_array_elements(p_lines) loop
    continue when coalesce((l ->> 'debit')::numeric, 0) = 0 and coalesce((l ->> 'credit')::numeric, 0) = 0;
    select id into v_account from gl_account where business_id = v_business and code = l ->> 'code' and is_active;
    if v_account is null then raise exception 'Account % is missing or inactive', l ->> 'code'; end if;
    insert into journal_line (journal_entry_id, account_id, debit, credit, memo)
    values (v_id, v_account, money_round(v_business, coalesce((l ->> 'debit')::numeric, 0)),
            money_round(v_business, coalesce((l ->> 'credit')::numeric, 0)), nullif(l ->> 'memo', ''));
    n := n + 1;
  end loop;
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0) into v_dr, v_cr from journal_line where journal_entry_id = v_id;

  if p_publish then
    if v_dr <> v_cr then
      raise exception 'Cannot publish: debits % and credits % differ by %', v_dr, v_cr, abs(v_dr - v_cr);
    end if;
    update journal_entry set status = 'published' where id = v_id;
    if p_reverse_on is not null then
      if p_reverse_on <= coalesce(p_date, business_local_date(v_business, now())) then
        raise exception 'The reversal date must be after the journal date';
      end if;
      v_rev := reverse_entry_internal(v_id, (p_reverse_on + time '12:00') at time zone (select timezone from business where id = v_business),
                                      'Scheduled reversal of: ' || trim(p_description));
    end if;
  end if;
  return jsonb_build_object('id', v_id, 'status', case when p_publish then 'published' else 'draft' end,
    'journal_no', (select journal_no from journal_entry where id = v_id),
    'reversal_journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

create or replace function publish_journal(p_entry uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('accounting.post');
begin
  update journal_entry set status = 'published' where id = p_entry and business_id = v_business and status = 'draft';
  if not found then raise exception 'No draft journal with that id'; end if;
  return jsonb_build_object('journal_no', (select journal_no from journal_entry where id = p_entry));
end $$;

-- Discard a draft. Reports failure plainly (the old action said "done" when
-- it had deleted nothing — audit M-09).
create or replace function discard_journal(p_entry uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('accounting.post');
begin
  if not exists (select 1 from journal_entry where id = p_entry and business_id = v_business and status = 'draft') then
    raise exception 'Only a draft can be discarded; a published journal is corrected by reversing it';
  end if;
  delete from journal_entry where id = p_entry;
end $$;

-- The one way to correct any published entry, including legacy ones.
create or replace function reverse_journal(p_entry uuid, p_reason text, p_date date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_rev uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the journal is being reversed'; end if;
  if not exists (select 1 from journal_entry where id = p_entry and business_id = v_business) then
    raise exception 'Journal not found';
  end if;
  v_rev := reverse_entry_internal(p_entry,
    (coalesce(p_date, business_local_date(v_business, now())) + time '12:00') at time zone (select timezone from business where id = v_business),
    'Reversal: ' || trim(p_reason));
  perform audit_event(v_business, 'journal.reverse', 'journal_entry', p_entry::text, p_reason, null,
                      jsonb_build_object('reversal', v_rev));
  return jsonb_build_object('journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- The only way to post to a control account (1200, 2000, 2050, 3100) by hand:
-- the owner alone, with a reason that goes on the audit trail. It exists to
-- correct history recorded before the controls (docs/REMEDIATION.md); every
-- other change to stock, payables or goods received goes through its own
-- record, so the subledgers keep proving the ledger.
create or replace function post_control_correction(p_date date, p_description text, p_lines jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.period.unlock');
  v_entry uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why a control account is being corrected'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Narrate the correction'; end if;
  if p_lines is null or jsonb_array_length(p_lines) < 2 then raise exception 'A correction needs at least two lines'; end if;
  v_entry := post_journal(v_business,
    (coalesce(p_date, business_local_date(v_business, now())) + time '12:00')
      at time zone (select timezone from business where id = v_business),
    'Correction: ' || trim(p_description), 'correction', null, p_lines);
  perform audit_event(v_business, 'journal.control_correction', 'journal_entry', v_entry::text, p_reason, null,
                      jsonb_build_object('lines', p_lines));
  return jsonb_build_object('journal_no', (select journal_no from journal_entry where id = v_entry));
end $$;

-- =============================================================================
-- 13. Closing a period (audit H-08: the close blocks unresolved differences)
-- =============================================================================
create or replace function gl_balance_at(p_business uuid, p_code text, p_at timestamptz) returns numeric
language sql stable as $$
  select coalesce(sum(l.debit - l.credit), 0)
    from journal_line l
    join journal_entry e on e.id = l.journal_entry_id
    join gl_account a on a.id = l.account_id
   where e.business_id = p_business and a.code = p_code and e.status = 'published' and e.occurred_at < p_at
$$;

-- Every check a period must pass before it may be locked. Each row says what
-- was checked and, when it fails, what is wrong.
create or replace function period_close_checklist(p_period uuid)
returns table (check_key text, label text, ok boolean, detail text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.period.lock', 'accounting.post', 'audit.view');
  p accounting_period; tz text; v_end timestamptz; v numeric; g numeric; n int; v_days text;
begin
  select * into p from accounting_period where id = p_period and business_id = v_business;
  if not found then raise exception 'Period not found'; end if;
  select timezone into tz from business where id = v_business;
  v_end := ((p.ends_on + 1)::timestamp) at time zone tz;

  select count(*) into n from accounting_period
   where business_id = v_business and ends_on < p.starts_on and status = 'open';
  check_key := 'prior_periods'; label := 'Earlier periods are locked'; ok := n = 0;
  detail := case when n > 0 then n || ' earlier period(s) still open' end; return next;

  select count(*) into n from journal_entry where period_id = p_period and status = 'draft';
  check_key := 'drafts'; label := 'No draft journals'; ok := n = 0;
  detail := case when n > 0 then n || ' draft journal(s) must be published or discarded' end; return next;

  select string_agg(d::text, ', ' order by d) into v_days from (
    select distinct business_local_date(v_business, o.placed_at) d from sales_order o
     where o.business_id = v_business and o.status <> 'voided'
       and business_local_date(v_business, o.placed_at) between p.starts_on and p.ends_on
    except
    select business_day from work_shift where business_id = v_business and closed_at is not null and business_day is not null
  ) x;
  check_key := 'days_closed'; label := 'Every trading day is closed'; ok := v_days is null;
  detail := case when v_days is not null then 'Not closed: ' || v_days end; return next;

  select count(*) into n from stock_count where business_id = v_business and status = 'submitted';
  check_key := 'counts'; label := 'No stock count awaiting approval'; ok := n = 0;
  detail := case when n > 0 then n || ' count(s) submitted and not yet approved or rejected' end; return next;

  select coalesce(sum(value * sign(base_quantity_signed)), 0) into v from inventory_movement
   where business_id = v_business and occurred_at < v_end;
  g := gl_balance_at(v_business, '1200', v_end);
  check_key := 'inventory'; label := 'Stock ledger agrees with Inventory (1200)'; ok := v = g;
  detail := case when v <> g then format('stock ledger %s, account 1200 %s, difference %s', v, g, v - g) end; return next;

  select coalesce(sum(b.amount_total), 0)
         - coalesce((select sum(sp.amount) from supplier_payment sp where sp.business_id = v_business
                      and sp.paid_on < p.ends_on + 1), 0)
    into v from purchase_invoice b where b.business_id = v_business and b.invoice_date <= p.ends_on
                                    and (b.cancelled_at is null or b.cancelled_at >= v_end);
  g := -gl_balance_at(v_business, '2000', v_end);
  check_key := 'payables'; label := 'Unpaid bills agree with Accounts payable (2000)'; ok := v = g;
  detail := case when v <> g then format('unpaid bills %s, account 2000 %s, difference %s', v, g, v - g) end; return next;

  select coalesce(sum(receipt_grni_value(r.id)), 0) into v from goods_receipt r
   where r.business_id = v_business and r.received_at < v_end
     and not exists (select 1 from purchase_invoice b where b.goods_receipt_id = r.id and b.invoice_date <= p.ends_on
                        and (b.cancelled_at is null or b.cancelled_at >= v_end));
  g := -gl_balance_at(v_business, '2050', v_end);
  check_key := 'grni'; label := 'Unbilled receipts agree with GRNI (2050)'; ok := v = g;
  detail := case when v <> g then format('unbilled receipts %s, account 2050 %s, difference %s', v, g, v - g) end; return next;

  select coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0) into v
    from journal_line l join journal_entry e on e.id = l.journal_entry_id
   where e.period_id = p_period and e.status = 'published';
  check_key := 'trial_balance'; label := 'The period''s journals balance'; ok := v = 0;
  detail := case when v <> 0 then 'out by ' || v end; return next;
end $$;

-- Year end (calendar year): close revenue and expense into retained earnings.
create or replace function post_year_end_close(p_business uuid, p_year_end date) returns uuid
language plpgsql as $$
declare
  tz text := (select timezone from business where id = p_business);
  v_from timestamptz := (date_trunc('year', p_year_end)::date::timestamp) at time zone tz;
  v_to timestamptz := ((p_year_end + 1)::timestamp) at time zone tz;
  v_lines jsonb := '[]'; r record; v_net numeric := 0;
begin
  for r in
    select a.code, sum(l.debit - l.credit) bal
      from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id
     where e.business_id = p_business and e.status = 'published' and a.account_type in ('revenue', 'expense')
       and e.occurred_at >= v_from and e.occurred_at < v_to
     group by a.code having sum(l.debit - l.credit) <> 0
  loop
    v_lines := v_lines || jsonb_build_object('code', r.code, 'debit', greatest(-r.bal, 0), 'credit', greatest(r.bal, 0));
    v_net := v_net + r.bal;   -- debit-positive: net expense (loss) is positive
  end loop;
  if jsonb_array_length(v_lines) = 0 then return null; end if;
  v_lines := v_lines || jsonb_build_object('code', '3100', 'debit', greatest(v_net, 0), 'credit', greatest(-v_net, 0));
  return post_journal(p_business, v_to - interval '1 minute', 'Year-end close ' || extract(year from p_year_end),
                      'year_end_close', null, v_lines);
end $$;

create or replace function lock_period(p_period uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.period.lock');
  p accounting_period; v_fail text; v_close uuid;
begin
  select * into p from accounting_period where id = p_period and business_id = v_business for update;
  if not found then raise exception 'Period not found'; end if;
  if p.status = 'locked' then raise exception 'Period % is already locked', p.name; end if;
  select string_agg(label || coalesce(' — ' || detail, ''), '; ') into v_fail
    from period_close_checklist(p_period) where not ok;
  if v_fail is not null then
    raise exception 'Period % cannot be locked yet: %', p.name, v_fail using errcode = 'check_violation';
  end if;
  if extract(month from p.ends_on) = 12 and extract(day from p.ends_on) = 31 then
    v_close := post_year_end_close(v_business, p.ends_on);
  end if;
  perform set_config('ledger.reason', coalesce(p_reason, ''), true);
  update accounting_period set status = 'locked' where id = p_period;
  return jsonb_build_object('period', p.name, 'locked', true,
    'year_end_journal_no', (select journal_no from journal_entry where id = v_close));
end $$;

-- Unlocking is exceptional: owner only, with a reason, most recent first.
create or replace function unlock_period(p_period uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('accounting.period.unlock'); p accounting_period;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the period is being reopened'; end if;
  select * into p from accounting_period where id = p_period and business_id = v_business for update;
  if not found then raise exception 'Period not found'; end if;
  if p.status <> 'locked' then raise exception 'Period % is not locked', p.name; end if;
  if exists (select 1 from accounting_period where business_id = v_business and status = 'locked' and starts_on > p.starts_on) then
    raise exception 'Reopen the most recent locked period first';
  end if;
  perform set_config('ledger.reason', trim(p_reason), true);
  update accounting_period set status = 'open' where id = p_period;
end $$;
