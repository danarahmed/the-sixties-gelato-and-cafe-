-- =============================================================================
-- 0019_discounts.sql — discounts at the till, as a percentage or an amount.
--
-- A discount is a reduction the café chooses to give on a bill. It posts the
-- way the chart of accounts has expected since 0014: revenue at the full price
-- in 4000 Sales revenue, the discount in 4100 Merchant-funded discount (a
-- contra-revenue account the P&L already shows as a deduction), and the cash,
-- card or platform receivable at what the customer paid. The sale records all
-- three (gross, discount, net) and each line carries its share of the
-- discount, so a refund returns what was paid and the margins show it.
--
-- A percentage is taken of the bill and rounded like every other amount
-- (money_round: to the currency unit, the dinar for IQD); a fixed amount is
-- never more than the bill. Giving a discount needs discount.apply. Once a
-- bill has been printed for the customer, only a manager may change its
-- discount: otherwise the customer could pay the printed total while a
-- smaller one was recorded. Delivery platforms set their own discounts, so
-- none is given at the till on a platform order.
-- =============================================================================

-- =============================================================================
-- 1. What a discount comes to on a bill of p_gross
-- =============================================================================
create or replace function sale_discount(p_business uuid, p_gross numeric, p_percent numeric, p_amount numeric)
returns numeric language plpgsql stable set search_path = public as $$
begin
  if p_percent is not null and p_amount is not null then
    raise exception 'Give the discount as a percentage or as an amount, not both';
  end if;
  if p_percent is not null then
    if p_percent <= 0 or p_percent > 100 then
      raise exception 'A discount is more than 0%% and no more than 100%%';
    end if;
    return least(money_round(p_business, p_gross * p_percent / 100), greatest(p_gross, 0));
  end if;
  if p_amount is not null then
    if p_amount <= 0 then raise exception 'A discount must be more than zero'; end if;
    return least(money_round(p_business, p_amount), greatest(p_gross, 0));
  end if;
  return 0;
end $$;

-- =============================================================================
-- 2. Sales: 0015's record_sale, now with a discount
-- =============================================================================
-- The work of recording a sale, for record_sale and settle_tab. The caller has
-- already checked who may do it: settle_tab pays a bill whose discount was
-- checked when it was given, whoever takes the money.
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric)
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
    v_price := price_on(v_variant, p_channel, v_location, v_today);
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

-- Record a sale. p_idempotency_key is minted by the till when the cart is
-- created and reused on every retry, so a retried or double-submitted sale
-- returns the original instead of posting twice (audit H-01).
-- p_lines: [{"variant_id": uuid, "qty": n}]. A discount is a percentage or an
-- amount, not both.
drop function if exists record_sale(uuid, sales_channel, tender_type, jsonb, uuid);
create or replace function record_sale(
  p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid default null,
  p_discount_percent numeric default null, p_discount_amount numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create');
begin
  if (p_discount_percent is not null or p_discount_amount is not null)
     and not current_has_permission('discount.apply') then
    raise exception 'You do not have permission to give discounts' using errcode = '42501';
  end if;
  return post_sale(v_business, (current_member()).id, p_idempotency_key, p_channel, p_tender, p_lines,
                   p_location, p_discount_percent, p_discount_amount);
end $$;

-- =============================================================================
-- 3. Bills carry a discount until they are paid
-- =============================================================================
-- As the cashier gave it: a percentage (worked out again as the bill changes)
-- or a fixed amount.
alter table pos_tab add column if not exists discount_percent numeric;
alter table pos_tab add column if not exists discount_amount numeric;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pos_tab_discount_ok') then
    alter table pos_tab add constraint pos_tab_discount_ok check (
      (discount_percent is null or (discount_percent > 0 and discount_percent <= 100))
      and (discount_amount is null or discount_amount > 0)
      and (discount_percent is null or discount_amount is null));
  end if;
end $$;

-- 0018's open_tab: a bill's first order can come with its discount.
drop function if exists open_tab(sales_channel, uuid, text, uuid, jsonb);
create or replace function open_tab(p_channel sales_channel, p_table uuid default null, p_label text default null,
                                    p_location uuid default null, p_lines jsonb default null,
                                    p_discount_percent numeric default null, p_discount_amount numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_location uuid; v_tab uuid;
begin
  if is_platform_channel(p_channel) then
    raise exception 'Delivery-platform orders are paid through the platform: ring them up as a sale, not a bill';
  end if;
  if p_table is not null then
    select location_id into v_location from dining_table
     where id = p_table and business_id = v_business and is_active;
    if not found then raise exception 'That table is not in use'; end if;
  else
    if nullif(trim(p_label), '') is null then raise exception 'Give the bill a table or a name'; end if;
    v_location := resolve_location(v_business, p_location);
  end if;
  insert into pos_tab (business_id, location_id, table_id, label, channel, business_day, opened_by)
  values (v_business, v_location, p_table, nullif(trim(p_label), ''), p_channel,
          business_local_date(v_business, now()), (current_member()).id)
  returning id into v_tab;
  if p_lines is not null and jsonb_typeof(p_lines) = 'array' and jsonb_array_length(p_lines) > 0 then
    return save_tab(v_tab, 1, p_lines, null, null, p_discount_percent, p_discount_amount);
  end if;
  if p_discount_percent is not null or p_discount_amount is not null then
    raise exception 'Add something to the bill before giving a discount';
  end if;
  return jsonb_build_object('tab_id', v_tab, 'version', 1);
end $$;

-- 0018's save_tab, now saving the bill's discount too.
drop function if exists save_tab(uuid, int, jsonb, text, uuid);
create or replace function save_tab(p_tab uuid, p_version int, p_lines jsonb, p_label text default null,
                                    p_table uuid default null, p_discount_percent numeric default null,
                                    p_discount_amount numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  t pos_tab; l jsonb; i int := 0; v_before jsonb; v_today date; v_was jsonb; v_now jsonb;
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

  delete from pos_tab_line where tab_id = p_tab;
  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    insert into pos_tab_line (tab_id, business_id, product_variant_id, qty, note, position, added_by)
    values (p_tab, v_business, (l ->> 'variant_id')::uuid, (l ->> 'qty')::numeric,
            left(nullif(trim(l ->> 'note'), ''), 200), i, v_me);
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

-- 0018's settle_tab: the bill is paid with the discount it carries.
create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type)
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
  select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty) order by position)
    into v_lines from pos_tab_line where tab_id = p_tab;
  if v_lines is null then raise exception 'The bill is empty'; end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, t.channel, p_tender, v_lines,
                 t.location_id, t.discount_percent, t.discount_amount);
  if coalesce((r ->> 'replayed')::boolean, false) then
    -- That key already paid for something else: never attach its sale to this bill.
    raise exception 'That payment was already used for another sale. Try again.';
  end if;
  update pos_tab
     set status = 'paid', sales_order_id = (r ->> 'order_id')::uuid, closed_at = now(),
         closed_by = (current_member()).id
   where id = p_tab;
  return r || jsonb_build_object('tab_id', p_tab);
end $$;

-- 0018's split_tab: a percentage discount applies to each part; a fixed
-- amount stays with the bill it was given on.
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
    insert into pos_tab_line (tab_id, business_id, product_variant_id, qty, note, position, added_by)
    values (v_new, v_business, v_line.product_variant_id, v_qty, v_line.note, i, v_me);
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

-- 0018's open bills, now with each bill's discount. `total` is what the
-- customer owes (after the discount); `subtotal` is before it. The return type
-- grows, so the function is replaced; its first thirteen columns are unchanged.
drop function if exists pos_open_bills();
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
             pv.name as variant_name, price_on(tl.product_variant_id, t.channel, t.location_id, v_today) as price
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

-- =============================================================================
-- 4. The books still tie: discounts are part of net revenue
-- =============================================================================
-- 0017's report_reconciliation, with 4100 in the sales check.
create or replace function report_reconciliation(p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_end timestamptz;
begin
  v_end := (local_day_bounds(v_business, p_as_of, p_as_of)).to_ts;

  check_key := 'inventory'; label := 'Stock ledger vs Inventory (1200)';
  select coalesce(sum(value * sign(base_quantity_signed)), 0) into subledger
    from inventory_movement where business_id = v_business and occurred_at < v_end;
  ledger := gl_balance_at(v_business, '1200', v_end);
  difference := subledger - ledger; return next;

  check_key := 'payables'; label := 'Unpaid bills vs Accounts payable (2000)';
  select coalesce(sum(amount_total), 0) into subledger
    from purchase_invoice where business_id = v_business and invoice_date < p_as_of + 1
                            and (cancelled_at is null or cancelled_at >= v_end);
  subledger := subledger - coalesce((select sum(amount) from supplier_payment
                                      where business_id = v_business and paid_on < p_as_of + 1), 0);
  -- Receipts the old app posted straight to A/P are owed until their bill is recorded.
  subledger := subledger + coalesce((select sum(receipt_legacy_payable(r.id, v_end)) from goods_receipt r
                                      where r.business_id = v_business and r.received_at < v_end
                                        and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id
                                                          and p.invoice_date < p_as_of + 1
                                                          and (p.cancelled_at is null or p.cancelled_at >= v_end))), 0);
  ledger := -gl_balance_at(v_business, '2000', v_end);
  difference := subledger - ledger; return next;

  check_key := 'grni'; label := 'Unbilled receipts vs Goods received not invoiced (2050)';
  select coalesce(sum(receipt_grni_value(r.id)), 0) into subledger
    from goods_receipt r
   where r.business_id = v_business and r.received_at < v_end
     and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id and p.invoice_date < p_as_of + 1
                        and (p.cancelled_at is null or p.cancelled_at >= v_end));
  ledger := -gl_balance_at(v_business, '2050', v_end);
  difference := subledger - ledger; return next;

  check_key := 'sales'; label := 'Sales recorded vs net revenue in the ledger (4000 less 4100 and 4200)';
  select coalesce(sum(net_amount), 0) into subledger
    from sales_order where business_id = v_business and status <> 'voided' and status <> 'open' and placed_at < v_end;
  subledger := subledger - coalesce((select sum(amount) from sale_adjustment
                                      where business_id = v_business and kind = 'refund' and created_at < v_end), 0);
  ledger := -(gl_balance_at(v_business, '4000', v_end) + gl_balance_at(v_business, '4100', v_end)
              + gl_balance_at(v_business, '4200', v_end));
  difference := subledger - ledger; return next;
end $$;

-- =============================================================================
-- 5. Who may call what
-- =============================================================================
revoke execute on function sale_discount(uuid, numeric, numeric, numeric),
  post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric)
  from public, anon, authenticated;

grant execute on function
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric),
  open_tab(sales_channel, uuid, text, uuid, jsonb, numeric, numeric),
  save_tab(uuid, int, jsonb, text, uuid, numeric, numeric),
  pos_open_bills()
to authenticated;
