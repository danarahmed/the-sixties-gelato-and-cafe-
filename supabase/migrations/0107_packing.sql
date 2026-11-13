-- 0107: packing at the till (plan 5 C). The owner (12 November):
--   * Packing is free to the customer and a cost to the business: each order's
--     packing is kept for the order as a whole, at each packing item's average
--     cost, in a Packaging account of its own (5500), not in the products'
--     cost.
--   * Cups and lids are packing like the rest, not in the recipes: each size
--     sold to take away or for delivery says what it goes out in (a large cup
--     and its lid), and the till adds them by itself.
--   * The pay screen has a + / − row: one small bag by default for takeaway
--     and delivery, none for dine-in; the cashier changes it when needed.
--   * A report by order, by way of selling, by cashier and by day.
--
-- How it is kept:
--   * packing_item: a stock item that is packing, with how many of it an
--     order takes by default to take away and for delivery (a bag: 1).
--   * variant_packing: what each one of a size takes, sold to take away or for
--     delivery (a cup and a lid). Never on dine-in.
--   * The till sends what the order went out in; a sale that sends nothing (an
--     older till, a sale sent once the internet is back) takes the defaults.
--   * Each packing item leaves stock as its own movement ("packing"), at its
--     average cost; the order's packing is one journal: 5500 Packaging debited,
--     1200 Inventory credited. The sale's own cost and profit are unchanged.
--   * A void or refund does not bring the packing back: it went out with the
--     order.
--
-- Nothing recorded changes.

alter type movement_type add value if not exists 'packing';

create table if not exists packing_item (
  business_id  uuid not null references business(id) on delete cascade,
  item_id      uuid not null references item(id) on delete cascade,
  role         text not null default 'other' check (role in ('bag', 'cup', 'lid', 'box', 'other')),
  takeaway_qty int not null default 0 check (takeaway_qty between 0 and 20),
  delivery_qty int not null default 0 check (delivery_qty between 0 and 20),
  is_active    boolean not null default true,
  set_by       uuid references app_user(id),
  set_at       timestamptz not null default now(),
  primary key (business_id, item_id)
);
alter table packing_item enable row level security;
alter table packing_item force row level security;

create table if not exists variant_packing (
  business_id        uuid not null references business(id) on delete cascade,
  product_variant_id uuid not null references product_variant(id) on delete cascade,
  item_id            uuid not null references item(id) on delete cascade,
  qty                numeric not null check (qty > 0 and qty <= 10),
  primary key (product_variant_id, item_id)
);
alter table variant_packing enable row level security;
alter table variant_packing force row level security;

create table if not exists sales_order_packing (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business(id) on delete cascade,
  sales_order_id uuid not null references sales_order(id) on delete cascade,
  item_id        uuid not null references item(id),
  qty            numeric not null check (qty > 0),
  unit_cost      numeric,
  value          numeric not null default 0 check (value >= 0),
  sent_by_till   boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (sales_order_id, item_id)
);
create index if not exists sales_order_packing_business on sales_order_packing (business_id, created_at);
alter table sales_order_packing enable row level security;
alter table sales_order_packing force row level security;

-- The Packaging account, made the first time packing is set up.
create or replace function packing_account(p_business uuid) returns void
language sql set search_path = public as $$
  insert into gl_account (business_id, code, name, account_type, normal_balance, is_active, is_system)
  values (p_business, '5500', 'Packaging', 'expense', 'debit', true, true)
  on conflict do nothing
$$;

-- A packing item: its role and what an order takes of it by default, or put away.
create or replace function save_packing_item(p_item uuid, p_role text, p_takeaway int, p_delivery int,
                                             p_active boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_name text; v_before jsonb; v_after jsonb;
begin
  select name into v_name from item where id = p_item and business_id = v_business;
  if v_name is null then raise exception 'Choose one of the café''s stock items'; end if;
  if coalesce(p_role, '') not in ('bag', 'cup', 'lid', 'box', 'other') then
    raise exception 'Choose what it is: a bag, a cup, a lid, a box or other packing';
  end if;
  if coalesce(p_takeaway, 0) not between 0 and 20 or coalesce(p_delivery, 0) not between 0 and 20 then
    raise exception 'An order takes from 0 to 20 of it by default';
  end if;
  select to_jsonb(p) - 'business_id' into v_before from packing_item p
   where business_id = v_business and item_id = p_item;
  perform packing_account(v_business);
  insert into packing_item (business_id, item_id, role, takeaway_qty, delivery_qty, is_active, set_by, set_at)
  values (v_business, p_item, p_role, coalesce(p_takeaway, 0), coalesce(p_delivery, 0), coalesce(p_active, true),
          (current_member()).id, now())
  on conflict (business_id, item_id) do update
    set role = excluded.role, takeaway_qty = excluded.takeaway_qty, delivery_qty = excluded.delivery_qty,
        is_active = excluded.is_active, set_by = excluded.set_by, set_at = excluded.set_at;
  select to_jsonb(p) - 'business_id' into v_after from packing_item p
   where business_id = v_business and item_id = p_item;
  perform audit_event(v_business, 'packing.item', 'item', p_item::text, null,
    v_before || jsonb_build_object('name', v_name), v_after || jsonb_build_object('name', v_name));
  return v_after || jsonb_build_object('name', v_name);
end $$;

-- What one of a size goes out in, to take away or for delivery: [{item_id, qty}]; [] for nothing.
create or replace function set_variant_packing(p_variant uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_before jsonb; v_after jsonb; x jsonb;
begin
  if not exists (select 1 from product_variant v join product p on p.id = v.product_id
                  where v.id = p_variant and p.business_id = v_business) then
    raise exception 'Product not found';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Choose the packing'; end if;
  for x in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from packing_item where business_id = v_business
                      and item_id = nullif(x ->> 'item_id', '')::uuid) then
      raise exception 'Choose one of the café''s packing items';
    end if;
    if coalesce((x ->> 'qty')::numeric, 0) <= 0 or (x ->> 'qty')::numeric > 10 then
      raise exception 'One sold takes from 1 to 10 of it';
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('item_id', item_id, 'qty', qty) order by item_id), '[]')
    into v_before from variant_packing where product_variant_id = p_variant;
  delete from variant_packing where product_variant_id = p_variant;
  insert into variant_packing (business_id, product_variant_id, item_id, qty)
  select v_business, p_variant, (e ->> 'item_id')::uuid, sum((e ->> 'qty')::numeric)
    from jsonb_array_elements(p_items) e group by (e ->> 'item_id')::uuid;
  select coalesce(jsonb_agg(jsonb_build_object('item_id', item_id, 'qty', qty) order by item_id), '[]')
    into v_after from variant_packing where product_variant_id = p_variant;
  perform audit_event(v_business, 'packing.variant', 'product_variant', p_variant::text, null,
    jsonb_build_object('packing', v_before), jsonb_build_object('packing', v_after));
  return v_after;
end $$;

-- The café's packing, for the till and the screens that set it up (no costs).
create or replace function packing_setup() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                         'item_id', p.item_id, 'name', i.name, 'name_ar', i.name_ar, 'name_ckb', i.name_ckb,
                         'unit', i.base_unit_code, 'role', p.role, 'takeaway', p.takeaway_qty,
                         'delivery', p.delivery_qty, 'active', p.is_active)
                       order by p.role, i.name)
                         from packing_item p join item i on i.id = p.item_id
                        where p.business_id = current_business_id()), '[]'::jsonb),
    'variants', coalesce((select jsonb_agg(jsonb_build_object(
                            'variant_id', v.product_variant_id, 'item_id', v.item_id, 'qty', v.qty))
                            from variant_packing v
                           where v.business_id = current_business_id()), '[]'::jsonb))
   where current_has_permission('sale.create') or current_has_permission('settings.manage')
$$;

-- What an order goes out in by default: on dine-in nothing; otherwise each
-- line's sizes' cups and lids, and the order's own bag (to take away or for
-- delivery, as each packing item says).
create or replace function default_packing(p_business uuid, p_channel sales_channel, p_lines jsonb)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('item_id', t.item_id, 'qty', t.qty)), '[]'::jsonb)
    from (
      select x.item_id, sum(x.qty) as qty
        from (
          select vp.item_id, vp.qty * (l ->> 'qty')::numeric as qty
            from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
            join variant_packing vp on vp.business_id = p_business
                                   and vp.product_variant_id = (l ->> 'variant_id')::uuid
            join packing_item pi on pi.business_id = p_business and pi.item_id = vp.item_id and pi.is_active
          union all
          select pi.item_id, case when p_channel = 'takeaway' then pi.takeaway_qty else pi.delivery_qty end
            from packing_item pi
           where pi.business_id = p_business and pi.is_active
        ) x
       group by x.item_id
      having sum(x.qty) > 0
    ) t
   where p_channel <> 'dine_in'
$$;

-- What the till sends with a sale, for post_sale to read in the same
-- transaction: the packing it went out in. The first to say so is heard.
create or replace function sale_packing(p_packing jsonb) returns void
language plpgsql set search_path = public as $$
begin
  if p_packing is not null and jsonb_typeof(p_packing) = 'array'
     and coalesce(current_setting('sixties.sale_packing', true), '') = '' then
    perform set_config('sixties.sale_packing', p_packing::text, true);
  end if;
end $$;

-- An order's packing out of stock at its average cost, and to 5500 (once).
create or replace function pack_order(p_business uuid, p_me uuid, p_order uuid, p_channel sales_channel,
                                      p_lines jsonb, p_location uuid) returns numeric
language plpgsql set search_path = public as $$
declare
  v_sent text := coalesce(current_setting('sixties.sale_packing', true), '');
  v_list jsonb; v_from_till boolean := v_sent <> ''; x jsonb; v_item uuid; v_qty numeric;
  v_cost numeric; v_value numeric; v_total numeric := 0; v_at timestamptz; v_location uuid;
begin
  perform set_config('sixties.sale_packing', '', true);
  if exists (select 1 from sales_order_packing where sales_order_id = p_order) then return 0; end if;
  v_list := case when v_from_till then v_sent::jsonb else default_packing(p_business, p_channel, p_lines) end;
  if v_list is null or jsonb_array_length(v_list) = 0 then return 0; end if;
  select placed_at, location_id into v_at, v_location from sales_order where id = p_order;
  v_location := coalesce(v_location, p_location);
  for x in select * from jsonb_array_elements(v_list) loop
    v_item := nullif(x ->> 'item_id', '')::uuid;
    v_qty := coalesce(nullif(x ->> 'qty', '')::numeric, 0);
    if v_qty <= 0 then continue; end if;
    if v_qty > 100 then raise exception 'An order goes out in at most 100 of one packing item'; end if;
    if not exists (select 1 from packing_item where business_id = p_business and item_id = v_item) then
      raise exception 'Choose one of the café''s packing items';
    end if;
    v_cost := coalesce(item_issue_cost(p_business, v_item, v_location), 0);
    v_value := money_round(p_business, v_cost * v_qty);
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (p_business, v_item, v_location, 'packing', -v_qty, case when v_qty > 0 then v_value / v_qty end, v_value,
            'sales_order_packing', p_order, p_me, 'Packing');
    insert into sales_order_packing (business_id, sales_order_id, item_id, qty, unit_cost, value, sent_by_till)
    values (p_business, p_order, v_item, v_qty, v_cost, v_value, v_from_till)
    on conflict (sales_order_id, item_id) do update
      set qty = sales_order_packing.qty + excluded.qty, value = sales_order_packing.value + excluded.value;
    v_total := v_total + v_value;
  end loop;
  if v_total > 0 then
    perform packing_account(p_business);
    perform post_journal(p_business, coalesce(v_at, now()), 'Packing ' || left(p_order::text, 8),
      'sales_order_packing', p_order,
      jsonb_build_array(jsonb_build_object('code', '5500', 'debit', v_total),
                        jsonb_build_object('code', '1200', 'credit', v_total)));
  end if;
  return v_total;
end $$;

-- 0090's post_sale: the order's packing with it (0107).
alter function post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb,
                         int, uuid, jsonb, numeric, jsonb) rename to post_sale_0106;
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric,
  p_trust_line_prices boolean default false, p_discount jsonb default null, p_turn_no int default null,
  p_stock_approval uuid default null, p_tenders jsonb default null, p_expected_net numeric default null,
  p_customer jsonb default null)
returns jsonb language plpgsql set search_path = public as $$
declare v jsonb; v_packing numeric := 0;
begin
  v := post_sale_0106(p_business, p_me, p_idempotency_key, p_channel, p_tender, p_lines, p_location,
    p_discount_percent, p_discount_amount, p_trust_line_prices, p_discount, p_turn_no, p_stock_approval, p_tenders,
    p_expected_net, p_customer);
  if coalesce((v ->> 'replayed')::boolean, false) is false and v ? 'order_id' then
    v_packing := pack_order(p_business, p_me, (v ->> 'order_id')::uuid, p_channel, p_lines, p_location);
  else
    perform set_config('sixties.sale_packing', '', true);
  end if;
  return v;
end $$;

-- 0090's record_sale and settle_tab, with what the order went out in (0107).
alter function record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid,
                           text, uuid, jsonb, uuid, uuid, int, numeric, boolean) rename to record_sale_0106;
alter function settle_tab(uuid, int, uuid, tender_type, numeric, uuid, jsonb, uuid, uuid, int, numeric, boolean)
  rename to settle_tab_0106;

create or replace function record_sale(p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type, p_lines jsonb,
  p_location uuid default null, p_discount_percent numeric default null, p_discount_amount numeric default null,
  p_expected_net numeric default null, p_discount_reason text default null, p_discount_note text default null,
  p_approval uuid default null, p_platform_order_no text default null, p_stock_approval uuid default null,
  p_tenders jsonb default null, p_customer uuid default null, p_address uuid default null,
  p_rewards int default null, p_tip numeric default null, p_no_service boolean default false,
  p_packing jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform sale_packing(p_packing);
  return record_sale_0106(p_idempotency_key, p_channel, p_tender, p_lines, p_location, p_discount_percent,
    p_discount_amount, p_expected_net, p_discount_reason, p_discount_note, p_approval, p_platform_order_no,
    p_stock_approval, p_tenders, p_customer, p_address, p_rewards, p_tip, p_no_service);
end $$;

create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type,
  p_expected_net numeric default null, p_stock_approval uuid default null, p_tenders jsonb default null,
  p_customer uuid default null, p_address uuid default null, p_rewards int default null,
  p_tip numeric default null, p_no_service boolean default false, p_packing jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform sale_packing(p_packing);
  return settle_tab_0106(p_tab, p_version, p_idempotency_key, p_tender, p_expected_net, p_stock_approval, p_tenders,
    p_customer, p_address, p_rewards, p_tip, p_no_service);
end $$;

-- What went out in packing, and what it cost: by day, by way of selling, by
-- cashier, and the orders that took the most.
create or replace function report_packing(p_from date, p_to date, p_location uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record; v_loc uuid;
begin
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Choose the days, from and to'; end if;
  if p_to - p_from > 366 then raise exception 'Choose a year at most'; end if;
  v_loc := report_place(v_business, p_location);
  b := local_day_bounds(v_business, p_from, p_to);
  return (
    with rows as (
      select sp.*, o.channel, o.cashier_id, o.placed_at, o.turn_no, o.net_amount,
             business_local_date(v_business, o.placed_at) as day, i.name as item_name
        from sales_order_packing sp
        join sales_order o on o.id = sp.sales_order_id
        join item i on i.id = sp.item_id
       where sp.business_id = v_business and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
         and (v_loc is null or o.location_id = v_loc)
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to,
      'total', coalesce((select sum(value) from rows), 0),
      'orders', (select count(distinct sales_order_id) from rows),
      'items', coalesce((select jsonb_agg(x order by x ->> 'cost' desc) from (
                  select jsonb_build_object('item_id', item_id, 'name', item_name, 'qty', sum(qty),
                                            'cost', sum(value)) as x
                    from rows group by item_id, item_name) s), '[]'::jsonb),
      'by_day', coalesce((select jsonb_agg(x order by x ->> 'day') from (
                  select jsonb_build_object('day', day, 'orders', count(distinct sales_order_id), 'cost', sum(value)) as x
                    from rows group by day) s), '[]'::jsonb),
      'by_channel', coalesce((select jsonb_agg(x order by (x ->> 'cost')::numeric desc) from (
                  select jsonb_build_object('channel', channel, 'orders', count(distinct sales_order_id),
                                            'cost', sum(value),
                                            'per_order', round(sum(value) / nullif(count(distinct sales_order_id), 0))) as x
                    from rows group by channel) s), '[]'::jsonb),
      'by_cashier', coalesce((select jsonb_agg(x order by (x ->> 'cost')::numeric desc) from (
                  select jsonb_build_object('member_id', cashier_id,
                                            'name', (select full_name from app_user where id = cashier_id),
                                            'orders', count(distinct sales_order_id), 'cost', sum(value),
                                            'per_order', round(sum(value) / nullif(count(distinct sales_order_id), 0)),
                                            'changed', count(distinct sales_order_id) filter (where sent_by_till)) as x
                    from rows group by cashier_id) s), '[]'::jsonb),
      'top_orders', coalesce((select jsonb_agg(x order by (x ->> 'cost')::numeric desc) from (
                  select jsonb_build_object('order_id', sales_order_id, 'turn_no', min(turn_no), 'at', min(placed_at),
                                            'channel', min(channel::text), 'sale', min(net_amount),
                                            'cost', sum(value),
                                            'what', string_agg(trim_scale(qty) || ' × ' || item_name, ', ' order by item_name)) as x
                    from rows group by sales_order_id order by sum(value) desc limit 20) s), '[]'::jsonb))
  );
end $$;

revoke execute on function packing_account(uuid), default_packing(uuid, sales_channel, jsonb), sale_packing(jsonb),
  pack_order(uuid, uuid, uuid, sales_channel, jsonb, uuid),
  post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb, int, uuid,
            jsonb, numeric, jsonb),
  post_sale_0106(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb, int,
                 uuid, jsonb, numeric, jsonb),
  record_sale_0106(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid,
                   text, uuid, jsonb, uuid, uuid, int, numeric, boolean),
  settle_tab_0106(uuid, int, uuid, tender_type, numeric, uuid, jsonb, uuid, uuid, int, numeric, boolean)
  from public, anon, authenticated;
revoke execute on function save_packing_item(uuid, text, int, int, boolean), set_variant_packing(uuid, jsonb),
  packing_setup(), report_packing(date, date, uuid),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid,
              text, uuid, jsonb, uuid, uuid, int, numeric, boolean, jsonb),
  settle_tab(uuid, int, uuid, tender_type, numeric, uuid, jsonb, uuid, uuid, int, numeric, boolean, jsonb)
  from public, anon;
grant execute on function save_packing_item(uuid, text, int, int, boolean), set_variant_packing(uuid, jsonb),
  packing_setup(), report_packing(date, date, uuid),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid,
              text, uuid, jsonb, uuid, uuid, int, numeric, boolean, jsonb),
  settle_tab(uuid, int, uuid, tender_type, numeric, uuid, jsonb, uuid, uuid, int, numeric, boolean, jsonb)
  to authenticated;
