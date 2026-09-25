-- =============================================================================
-- 0025 — The recipe and price in force, printed bills, and sales costed at nothing
-- =============================================================================
-- The September 2026 audit's first P1s (docs/SYSTEM_AUDIT_2026-09.md):
--
--  * P1-5. The recipe in force was the highest version number covering the
--    day, and a new version never ended before a change already scheduled: a
--    recipe scheduled for next month, then a change made today, left today's
--    change in force for ever. Now the version that started last wins, a new
--    version ends the day before the next scheduled one, and a version starting
--    the same day as another replaces it. Scheduled prices and recipes are
--    listed, and can be cancelled before they start. A price can no longer be
--    dated in the past, and each price set is on the audit trail.
--  * P1-7. A printed bill was paid at the price on the day of payment, not the
--    price the customer was shown. Now printing freezes each line's price, and
--    the bill is paid at it. The till also says what total it showed; if the
--    database would record another (a price changed since the till loaded its
--    menu), the payment is refused and the till refreshes, so what the customer
--    pays is what the books record.
--  * P1-6. A sale of a product with no recipe, or of an ingredient never bought,
--    was costed at nothing without a word. Now a new product lists what it uses
--    or says why it uses no stock; the sales costed at nothing (wholly, or an
--    ingredient with no cost) are listed; and the month-end checklist warns of
--    them.
--
-- Nothing recorded before this migration changes.

-- =============================================================================
-- 1. The recipe and the price in force (P1-5)
-- =============================================================================
-- The version that started last, then the newest: a change scheduled for a
-- later date takes over on that date, whatever was changed in between.
create or replace function recipe_version_on(p_recipe uuid, p_on date) returns uuid
language sql stable as $$
  select id from recipe_version
   where recipe_id = p_recipe and effective_from <= p_on
     and (effective_to is null or effective_to >= p_on)
   order by effective_from desc, version_no desc limit 1
$$;

-- A new version from a date: what is in force then ends the day before (one
-- starting that same day is replaced, and never comes into force); a change
-- already scheduled for later stays, and the new version ends the day before it.
create or replace function start_recipe_version(p_recipe uuid, p_from date) returns uuid
language plpgsql set search_path = public as $$
declare v_no int; v_version uuid; v_next date;
begin
  update recipe_version set effective_to = p_from - 1
   where recipe_id = p_recipe and (effective_to is null or effective_to >= p_from) and effective_from <= p_from;
  select min(effective_from) into v_next from recipe_version
   where recipe_id = p_recipe and effective_from > p_from
     and (effective_to is null or effective_to >= effective_from);
  select coalesce(max(version_no), 0) + 1 into v_no from recipe_version where recipe_id = p_recipe;
  insert into recipe_version (recipe_id, version_no, effective_from, effective_to)
  values (p_recipe, v_no, p_from, v_next - 1)
  returning id into v_version;
  return v_version;
end $$;

-- A price from today or later, never in the past; and on the audit trail.
create or replace function set_price(p_variant uuid, p_channel sales_channel, p_price numeric, p_effective_from date default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); v_today date; v_from date; v_was numeric; v_id uuid;
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
  v_was := price_on(p_variant, p_channel, null, v_from);
  insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
  values (v_business, p_variant, p_channel, p_price, v_from)
  returning id into v_id;
  perform audit_event(v_business, 'price.set', 'channel_price', v_id::text, null,
    jsonb_build_object('variant', p_variant, 'channel', p_channel, 'price', v_was),
    jsonb_build_object('variant', p_variant, 'channel', p_channel, 'price', p_price, 'effective_from', v_from));
end $$;

-- What is scheduled and not yet in force: prices and product recipes.
create or replace function menu_scheduled()
returns table (kind text, id uuid, variant_id uuid, channel sales_channel, price numeric, effective_from date,
               version_no int)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    select 'price'::text, cp.id, cp.product_variant_id, cp.channel, cp.price, cp.effective_from, null::int
      from channel_price cp
     where cp.business_id = v_business and cp.effective_from > v_today
    union all
    select 'recipe'::text, rv.id, vr.product_variant_id, null::sales_channel, null::numeric, rv.effective_from,
           rv.version_no
      from recipe_version rv join variant_recipe vr on vr.recipe_id = rv.recipe_id
     where rv.business_id = v_business and rv.effective_from > v_today
       and (rv.effective_to is null or rv.effective_to >= rv.effective_from)
    order by 3, 6, 1;
end $$;

-- A scheduled price, withdrawn before it starts. It was never used.
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
  delete from channel_price where id = p_price;
  perform audit_event(v_business, 'price.cancel', 'channel_price', p_price::text, trim(p_reason), to_jsonb(cp), null);
end $$;

-- A scheduled recipe, withdrawn before it starts: the recipe it would have
-- ended carries on. It was never used by a sale or a batch.
create or replace function cancel_scheduled_recipe(p_version uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); v recipe_version; v_lines jsonb;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the change is cancelled'; end if;
  select * into v from recipe_version where id = p_version and business_id = v_business for update;
  if not found then raise exception 'Recipe not found'; end if;
  if v.effective_from <= business_local_date(v_business, now()) then
    raise exception 'That recipe is already in force: change the recipe again instead';
  end if;
  select coalesce(jsonb_agg(to_jsonb(rl) - 'id' - 'recipe_version_id' - 'business_id' order by rl.id), '[]'::jsonb)
    into v_lines from recipe_line rl where rl.recipe_version_id = p_version;
  update recipe_version set effective_to = v.effective_to
   where recipe_id = v.recipe_id and effective_to = v.effective_from - 1 and effective_from < v.effective_from;
  delete from recipe_version where id = p_version;
  perform audit_event(v_business, 'recipe.cancel', 'recipe_version', p_version::text, trim(p_reason),
                      to_jsonb(v) || jsonb_build_object('lines', v_lines), null);
end $$;

-- =============================================================================
-- 2. A printed bill is paid at its printed prices (P1-7)
-- =============================================================================
alter table pos_tab_line add column if not exists unit_price numeric;

-- 0018's printing, now freezing the prices the customer is shown.
create or replace function mark_bill_printed(p_tab uuid, p_version int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); t pos_tab;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  if not exists (select 1 from pos_tab_line where tab_id = p_tab) then
    raise exception 'The bill is empty';
  end if;
  -- The customer now holds these prices: the bill is paid at them (0025).
  update pos_tab_line tl
     set unit_price = price_on(tl.product_variant_id, t.channel, t.location_id, business_local_date(v_business, now()))
   where tl.tab_id = p_tab and tl.unit_price is null;
  update pos_tab set bill_printed_at = now(), bill_print_count = bill_print_count + 1
   where id = p_tab;
  return jsonb_build_object('tab_id', p_tab, 'version', t.version, 'print_count', t.bill_print_count + 1);
end $$;

-- 0019's save_tab, keeping each printed price.
create or replace function save_tab(p_tab uuid, p_version int, p_lines jsonb, p_label text default null,
                                    p_table uuid default null, p_discount_percent numeric default null,
                                    p_discount_amount numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  t pos_tab; l jsonb; i int := 0; v_before jsonb; v_today date; v_was jsonb; v_now jsonb; v_frozen jsonb;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  v_today := business_local_date(v_business, now());
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'The bill has no lines'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if coalesce((l ->> 'qty')::numeric, 0) <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = (l ->> 'variant_id')::uuid and pv.business_id = v_business
                      and pv.is_active and p.is_active) then
      raise exception 'A product on the bill is not on sale';
    end if;
    -- Refused now, not when the customer comes to pay.
    if price_on((l ->> 'variant_id')::uuid, t.channel, t.location_id, v_today) is null then
      raise exception 'No % price is set for %', t.channel,
        (select p.name from product_variant pv join product p on p.id = pv.product_id
          where pv.id = (l ->> 'variant_id')::uuid);
    end if;
  end loop;
  if p_table is not null and p_table is distinct from t.table_id
     and not exists (select 1 from dining_table where id = p_table and business_id = v_business
                       and is_active and location_id = t.location_id) then
    raise exception 'That table is not in use';
  end if;

  -- A discount is given only by someone allowed to. Once the customer has seen
  -- the bill, changing it is a manager's call; taking it off never is.
  v_was := jsonb_build_object('percent', t.discount_percent, 'amount', t.discount_amount);
  v_now := jsonb_build_object('percent', p_discount_percent, 'amount', p_discount_amount);
  if v_now is distinct from v_was and (p_discount_percent is not null or p_discount_amount is not null) then
    if not current_has_permission('discount.apply') then
      raise exception 'You do not have permission to give discounts' using errcode = '42501';
    end if;
    perform sale_discount(v_business, 0, p_discount_percent, p_discount_amount);
    if t.bill_printed_at is not null then
      if not current_has_permission('sale.void') then
        raise exception 'Only a manager can change the discount on a bill that has been printed' using errcode = '42501';
      end if;
      perform audit_event(v_business, 'bill.discount', 'pos_tab', p_tab::text, null, v_was, v_now);
    end if;
  end if;

  -- Once the customer has seen the bill, taking anything off it is a manager's call.
  if t.bill_printed_at is not null and exists (
       select 1
         from (select product_variant_id v, sum(qty) q from pos_tab_line where tab_id = p_tab group by 1) was
         left join (select (x ->> 'variant_id')::uuid v, sum((x ->> 'qty')::numeric) q
                      from jsonb_array_elements(p_lines) x group by 1) now_ on now_.v = was.v
        where coalesce(now_.q, 0) < was.q) then
    if not current_has_permission('sale.void') then
      raise exception 'Only a manager can take items off a bill that has been printed' using errcode = '42501';
    end if;
    select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty) order by position)
      into v_before from pos_tab_line where tab_id = p_tab;
    perform audit_event(v_business, 'bill.reduce', 'pos_tab', p_tab::text, null,
                        jsonb_build_object('lines', v_before), jsonb_build_object('lines', p_lines));
  end if;

  -- What the customer was shown keeps its printed price (0025); anything not
  -- yet printed is priced when the bill is printed, or paid.
  select coalesce(jsonb_object_agg(v, p), '{}'::jsonb) into v_frozen
    from (select product_variant_id::text v, min(unit_price) p from pos_tab_line
           where tab_id = p_tab and unit_price is not null group by 1) x;
  delete from pos_tab_line where tab_id = p_tab;
  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    insert into pos_tab_line (tab_id, business_id, product_variant_id, qty, note, position, added_by, unit_price)
    values (p_tab, v_business, (l ->> 'variant_id')::uuid, (l ->> 'qty')::numeric,
            left(nullif(trim(l ->> 'note'), ''), 200), i, v_me, (v_frozen ->> (l ->> 'variant_id'))::numeric);
  end loop;
  update pos_tab
     set version = version + 1,
         label = coalesce(nullif(trim(p_label), ''), label),
         table_id = coalesce(p_table, table_id),
         discount_percent = p_discount_percent,
         discount_amount = p_discount_amount
   where id = p_tab;
  return jsonb_build_object('tab_id', p_tab, 'version', t.version + 1);
end $$;

-- 0019's split_tab: a line moved to a new bill keeps its printed price.
create or replace function split_tab(p_tab uuid, p_version int, p_move jsonb, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  t pos_tab; m jsonb; v_line pos_tab_line; v_qty numeric; v_new uuid; i int := 0;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  if p_move is null or jsonb_typeof(p_move) <> 'array' or jsonb_array_length(p_move) = 0 then
    raise exception 'Choose what to move to the new bill';
  end if;
  if (select count(distinct x ->> 'line_id') from jsonb_array_elements(p_move) x) <> jsonb_array_length(p_move) then
    raise exception 'Each line can be moved once';
  end if;
  insert into pos_tab (business_id, location_id, table_id, label, channel, business_day, opened_by,
                       bill_printed_at, discount_percent)
  values (v_business, t.location_id, t.table_id,
          coalesce(nullif(trim(p_label), ''), t.label), t.channel, t.business_day, v_me, t.bill_printed_at,
          t.discount_percent)
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
    values (v_new, v_business, v_line.product_variant_id, v_qty, v_line.note, i, v_me, v_line.unit_price);
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

-- 0019's open bills: a printed line shows its printed price.
create or replace function pos_open_bills()
returns table (tab_id uuid, version int, table_id uuid, table_name text, label text, channel sales_channel,
               business_day date, opened_at timestamptz, opened_by text, bill_printed_at timestamptz,
               bill_print_count int, lines jsonb, total numeric,
               subtotal numeric, discount numeric, discount_percent numeric, discount_amount numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    with l as (
      select tl.tab_id, tl.id, tl.position, tl.product_variant_id, tl.qty, tl.note, p.name as product_name,
             pv.name as variant_name,
             coalesce(tl.unit_price, price_on(tl.product_variant_id, t.channel, t.location_id, v_today)) as price
        from pos_tab t
        join pos_tab_line tl on tl.tab_id = t.id
        join product_variant pv on pv.id = tl.product_variant_id
        join product p on p.id = pv.product_id
       where t.business_id = v_business and t.status = 'open'
    ),
    b as (
      select t.*,
             coalesce((select sum(money_round(v_business, l.price * l.qty)) from l where l.tab_id = t.id), 0) as gross
        from pos_tab t
       where t.business_id = v_business and t.status = 'open'
    )
    select b.id, b.version, b.table_id, dt.name, b.label, b.channel, b.business_day, b.opened_at, au.full_name,
           b.bill_printed_at, b.bill_print_count,
           coalesce((select jsonb_agg(jsonb_build_object(
                               'line_id', l.id, 'variant_id', l.product_variant_id, 'qty', l.qty, 'note', l.note,
                               'product_name', l.product_name, 'variant_name', l.variant_name, 'price', l.price)
                             order by l.position)
                       from l where l.tab_id = b.id), '[]'::jsonb),
           b.gross - sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.gross,
           sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.discount_percent, b.discount_amount
      from b
      left join dining_table dt on dt.id = b.table_id
      left join app_user au on au.id = b.opened_by
     order by b.opened_at;
end $$;

-- 0019's post_sale: settle_tab alone may pass a bill's printed prices.
drop function if exists post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric);
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric,
  p_trust_line_prices boolean default false)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_business uuid := p_business;
  v_me uuid := p_me;
  v_location uuid;
  v_order uuid;
  v_existing record;
  v_today date;
  v_prevent_negative boolean;
  l jsonb; v_variant uuid; v_qty numeric; v_price numeric;
  v_variants uuid[] := '{}'; v_qtys numeric[] := '{}'; v_prices numeric[] := '{}'; v_gross_lines numeric[] := '{}';
  v_nets numeric[]; v_gross numeric := 0; v_discount numeric := 0; v_net numeric; v_cogs numeric := 0;
  d record; v_cost numeric; v_value numeric; v_line_cogs numeric; n int; i int;
  v_items uuid[];
  v_journal uuid;
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
  select id, gross_amount, discount_amount, net_amount, cogs_amount into v_existing
    from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  if (p_discount_percent is not null or p_discount_amount is not null) and is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets its own discounts; none is given at the till';
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
    select id, gross_amount, discount_amount, net_amount, cogs_amount into v_existing
      from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true)
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
      select e.item_id, sum(e.base_qty) as need, i2.name
        from jsonb_array_elements(p_lines) x,
             lateral expand_variant((x ->> 'variant_id')::uuid, p_channel, (x ->> 'qty')::numeric, v_today) e
        join item i2 on i2.id = e.item_id
       group by e.item_id, i2.name
    loop
      if (item_position(v_business, d.item_id, v_location)).qty < d.need then
        raise exception 'Not enough % in stock to make this sale', d.name;
      end if;
    end loop;
  end if;

  -- Price every line first: the discount is shared out over the whole bill.
  for l in select * from jsonb_array_elements(p_lines) loop
    v_variant := (l ->> 'variant_id')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = v_variant and pv.business_id = v_business and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    -- A bill's printed price, passed by settle_tab alone (0025); otherwise today's.
    v_price := case when p_trust_line_prices and nullif(l ->> 'price', '') is not null
                    then (l ->> 'price')::numeric
                    else price_on(v_variant, p_channel, v_location, v_today) end;
    if v_price is null then
      raise exception 'No % price is set for this product', p_channel;
    end if;
    v_variants := v_variants || v_variant;
    v_qtys := v_qtys || v_qty;
    v_prices := v_prices || v_price;
    v_gross_lines := v_gross_lines || money_round(v_business, v_price * v_qty);
    v_gross := v_gross + money_round(v_business, v_price * v_qty);
  end loop;

  -- Each line's share of the discount, in proportion to its value, adding up
  -- to the discount exactly (the rounding method receipts use for landed costs).
  v_discount := sale_discount(v_business, v_gross, p_discount_percent, p_discount_amount);
  if v_discount > 0 then
    v_nets := allocate_landed(v_business, v_gross_lines, -v_discount);
  else
    v_nets := v_gross_lines;
  end if;
  v_net := v_gross - v_discount;

  n := cardinality(v_variants);
  for i in 1 .. n loop
    -- One costed movement per component per line, so every figure ties:
    -- line COGS = its movements; order COGS = all movements = the journal.
    -- Cost first, then write the line once: lines are append-only.
    v_line_cogs := 0;
    for d in select * from expand_variant(v_variants[i], p_channel, v_qtys[i], v_today) loop
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
    values (v_order, v_variants[i], v_qtys[i], v_prices[i], v_gross_lines[i] - v_nets[i], v_nets[i], v_line_cogs);
    v_cogs := v_cogs + v_line_cogs;
  end loop;

  insert into sales_tender (sales_order_id, tender_type, amount) values (v_order, p_tender, v_net);

  update sales_order
     set gross_amount = v_gross, discount_amount = v_discount, net_amount = v_net, cogs_amount = v_cogs,
         status = 'completed'
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
    perform audit_event(v_business, 'sale.discount', 'sales_order', v_order::text, null, null,
      jsonb_build_object('gross', v_gross, 'discount', v_discount, 'percent', p_discount_percent,
                         'amount', p_discount_amount));
  end if;

  return jsonb_build_object('order_id', v_order, 'gross', v_gross, 'discount', v_discount, 'net', v_net,
    'journal_no', (select journal_no from journal_entry where id = v_journal), 'replayed', false)
    || sale_cost_view(v_cogs);
end $$;

-- The total the till showed, if it says, must be the total recorded. A
-- replayed sale is returned as it was.
create or replace function assert_sale_total(p_sale jsonb, p_expected numeric) returns void
language plpgsql as $$
begin
  if p_expected is not null and not coalesce((p_sale ->> 'replayed')::boolean, false)
     and (p_sale ->> 'net')::numeric <> p_expected then
    raise exception 'The total is % now, not the % shown: a price has changed. The till has the new prices; tell the customer, then take payment again',
      trim_scale((p_sale ->> 'net')::numeric), trim_scale(p_expected);
  end if;
end $$;

-- 0019's record_sale, told the total the till showed.
drop function if exists record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric);
create or replace function record_sale(
  p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid default null,
  p_discount_percent numeric default null, p_discount_amount numeric default null,
  p_expected_net numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); r jsonb;
begin
  if (p_discount_percent is not null or p_discount_amount is not null)
     and not current_has_permission('discount.apply') then
    raise exception 'You do not have permission to give discounts' using errcode = '42501';
  end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, p_channel, p_tender, p_lines,
                 p_location, p_discount_percent, p_discount_amount, false);
  perform assert_sale_total(r, p_expected_net);
  return r;
end $$;

-- 0019's settle_tab: paid at the printed prices, and told the total shown.
drop function if exists settle_tab(uuid, int, uuid, tender_type);
create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type,
                                      p_expected_net numeric default null)
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
                                and reverses_entry is null limit 1))
              from sales_order o where o.id = t.sales_order_id);
  end if;
  t := lock_open_tab(v_business, p_tab, p_version);
  select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty, 'price', unit_price)
                   order by position)
    into v_lines from pos_tab_line where tab_id = p_tab;
  if v_lines is null then raise exception 'The bill is empty'; end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, t.channel, p_tender, v_lines,
                 t.location_id, t.discount_percent, t.discount_amount, true);
  if coalesce((r ->> 'replayed')::boolean, false) then
    -- That key already paid for something else: never attach its sale to this bill.
    raise exception 'That payment was already used for another sale. Try again.';
  end if;
  perform assert_sale_total(r, p_expected_net);
  update pos_tab
     set status = 'paid', sales_order_id = (r ->> 'order_id')::uuid, closed_at = now(),
         closed_by = (current_member()).id
   where id = p_tab;
  return r || jsonb_build_object('tab_id', p_tab);
end $$;

-- =============================================================================
-- 3. Sales costed at nothing (P1-6)
-- =============================================================================
-- A product that uses no stock says so, and why (a service charge, say).
alter table product_variant add column if not exists no_stock_reason text;

-- 0015's create_product: a new product lists what one serving uses, or says
-- why it uses none.
drop function if exists create_product(text, jsonb, jsonb, text, text, uuid);
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

-- 0023's change_product_recipe: a product given a recipe no longer "uses no stock".
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
  -- It takes its stock through its recipe now (0025).
  update product_variant set no_stock_reason = null where id = p_variant and no_stock_reason is not null;
  perform audit_event(v_business, 'recipe.change', 'product_variant', p_variant::text, null, null,
    jsonb_build_object('effective_from', v_from, 'lines', p_lines));
  return jsonb_build_object('recipe_id', v_recipe, 'effective_from', v_from,
    'version_no', (select version_no from recipe_version where id = v_version));
end $$;

-- A product with no recipe: say why it uses no stock (or, with no reason, take that back).
create or replace function set_no_stock(p_variant uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); pv product_variant; v_recipe uuid; v_reason text;
begin
  select * into pv from product_variant where id = p_variant and business_id = v_business for update;
  if not found then raise exception 'Unknown product'; end if;
  if pv.resale_item_id is not null then
    raise exception 'This product is sold as bought: it takes its item from stock';
  end if;
  v_reason := nullif(trim(p_reason), '');
  if v_reason is not null then
    select recipe_id into v_recipe from variant_recipe where product_variant_id = p_variant;
    if v_recipe is not null and exists (
         select 1 from recipe_line
          where recipe_version_id = recipe_version_on(v_recipe, business_local_date(v_business, now()))) then
      raise exception 'It has a recipe in force: it takes its stock through it';
    end if;
  end if;
  update product_variant set no_stock_reason = v_reason where id = p_variant;
  perform audit_event(v_business, 'product.no_stock', 'product_variant', p_variant::text, v_reason,
    jsonb_build_object('no_stock_reason', pv.no_stock_reason), jsonb_build_object('no_stock_reason', v_reason));
end $$;

-- Sales whose cost is understated: a line costed at nothing (no recipe, and
-- not marked as using no stock), or an ingredient used before it had any cost.
-- (An ingredient with a cost whose share rounds to nothing is not one of them.)
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
    select sl.sales_order_id, string_agg(distinct p.name, ', ') as names
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
         (select string_agg(p.name, ', ' order by p.name) from sales_order_line sl
            join product_variant pv on pv.id = sl.product_variant_id join product p on p.id = pv.product_id
           where sl.sales_order_id = s.id),
         s.net_amount, s.cogs_amount,
         concat_ws('; ', case when z.names is not null then 'Costed at nothing: ' || z.names end,
                         case when f.names is not null then 'Used before it had a cost: ' || f.names end)
    from s left join zero_lines z on z.sales_order_id = s.id left join free_items f on f.sales_order_id = s.id
   where z.names is not null or f.names is not null
   order by s.placed_at
$$;

create or replace function report_uncosted_sales(p_from date, p_to date)
returns table (order_id uuid, placed_at timestamptz, channel sales_channel, products text, net numeric,
               cogs numeric, reasons text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  return query select * from uncosted_sales(v_business, p_from, p_to);
end $$;

-- 0024's checklist, with a warning line that does not stop the lock.
drop function if exists period_close_checklist(uuid);
create or replace function period_close_checklist(p_period uuid)
returns table (check_key text, label text, ok boolean, detail text, blocks boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.period.lock', 'accounting.post', 'audit.view');
  p accounting_period; tz text; v_end timestamptz; v numeric; g numeric; n int; v_days text;
begin
  select * into p from accounting_period where id = p_period and business_id = v_business;
  if not found then raise exception 'Period not found'; end if;
  select timezone into tz from business where id = v_business;
  v_end := ((p.ends_on + 1)::timestamp) at time zone tz;
  blocks := true;

  select count(*) into n from accounting_period
   where business_id = v_business and ends_on < p.starts_on and status = 'open';
  check_key := 'prior_periods'; label := 'Earlier periods are locked'; ok := n = 0;
  detail := case when n > 0 then n || ' earlier period(s) still open' end; return next;

  select count(*) into n from journal_entry where period_id = p_period and status = 'draft';
  check_key := 'drafts'; label := 'No draft journals'; ok := n = 0;
  detail := case when n > 0 then n || ' draft journal(s) must be published or discarded' end; return next;

  select string_agg(d::text, ', ' order by d) into v_days from (
    select distinct u.day d from uncounted_days(v_business) u where u.day between p.starts_on and p.ends_on
  ) x;
  check_key := 'days_closed'; label := 'Every trading day''s cash is counted'; ok := v_days is null;
  detail := case when v_days is not null then 'Not counted: ' || v_days end; return next;

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
  v := v + coalesce((select sum(receipt_legacy_payable(r.id, v_end)) from goods_receipt r
                      where r.business_id = v_business and r.received_at < v_end
                        and not exists (select 1 from purchase_invoice b where b.goods_receipt_id = r.id
                                          and b.invoice_date <= p.ends_on
                                          and (b.cancelled_at is null or b.cancelled_at >= v_end))), 0);
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

  -- A warning, not a lock: a sale costed at nothing cannot be costed again, but
  -- the owner should know its profit is overstated, and why (0025).
  select count(*) into n from uncosted_sales(v_business, p.starts_on, p.ends_on);
  check_key := 'uncosted'; label := 'No sale costed at nothing'; ok := n = 0; blocks := false;
  detail := case when n > 0 then n || ' sale(s) costed at nothing or in part at nothing: see Reports, Uncosted sales. '
                                 || 'Their profit is overstated. The month can still be locked' end; return next;
end $$;

-- 0015's lock: only the checks that block, block.
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
    from period_close_checklist(p_period) where not ok and blocks;
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

-- =============================================================================
-- 4. Who may call what
-- =============================================================================
revoke execute on function
  post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean),
  assert_sale_total(jsonb, numeric), uncosted_sales(uuid, date, date), start_recipe_version(uuid, date)
  from public, anon, authenticated;

revoke execute on function
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric),
  settle_tab(uuid, int, uuid, tender_type, numeric),
  create_product(text, jsonb, jsonb, text, text, uuid, text),
  period_close_checklist(uuid),
  menu_scheduled(), cancel_scheduled_price(uuid, text), cancel_scheduled_recipe(uuid, text),
  set_no_stock(uuid, text), report_uncosted_sales(date, date)
  from public, anon;
grant execute on function
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric),
  settle_tab(uuid, int, uuid, tender_type, numeric),
  create_product(text, jsonb, jsonb, text, text, uuid, text),
  period_close_checklist(uuid),
  menu_scheduled(), cancel_scheduled_price(uuid, text), cancel_scheduled_recipe(uuid, text),
  set_no_stock(uuid, text), report_uncosted_sales(date, date)
to authenticated;
