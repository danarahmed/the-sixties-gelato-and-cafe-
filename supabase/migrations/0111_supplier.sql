-- 0111: the supplier parts (plan 10, step 4). Each behind a part, on by
-- default for a bakery and a supplier, off for a café until turned on.
--
--   * Selling stock items directly, by the piece or by the carton: a stock
--     item made a product in one step (a size whose recipe is the item itself,
--     1 or a carton's count), so the sale engine is untouched.
--   * Price lists ("price_lists"): a customer's own price for a size; an
--     invoice takes it before the customer's wholesale percentage.
--   * Quotes, sales orders and delivery notes ("quotes"): a quote for a
--     customer on account, sent, accepted, then invoiced at its own prices;
--     a delivery note for an invoice, with its driver and route, out, then
--     delivered and signed for.
--   * Credit notes for wholesale ("wholesale"): what a customer gave back or
--     is let off, taken off what they owe (Dr 4200 returns, Cr 1110), with why.
--   * Use-by for bought goods (0098), a business with no till (0108's part),
--     and tax on invoices (0102: an invoice is a sale) were built before.
--
-- Nothing recorded changes.

-- -----------------------------------------------------------------------------
-- 0. The parts
-- -----------------------------------------------------------------------------
create or replace function part_catalogue() returns jsonb
language sql immutable set search_path = public as $$
  select '{
    "till":         {"label": "The till: menu, tables, open bills, offline sales",
                     "plans": ["starter", "complete", "business"], "on_for": ["cafe", "bakery", "restaurant"]},
    "recipes":      {"label": "Recipes and costing, production and use-by",
                     "plans": ["complete", "business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "purchasing":   {"label": "Purchasing and suppliers",
                     "plans": ["complete", "business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "staff":        {"label": "Staff, the clock and payroll",
                     "plans": ["complete", "business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "accounting":   {"label": "The full accounting screens: journals, the bank, the balance sheet",
                     "plans": ["complete", "business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "wholesale":    {"label": "Customers on account: invoices, terms and payments",
                     "plans": ["complete", "business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "branches":     {"label": "Several places: branches, a central kitchen, transfers",
                     "plans": ["business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "kitchen":      {"label": "Kitchen screens and stations",
                     "plans": ["complete", "business"], "on_for": ["restaurant"]},
    "courses":      {"label": "Courses and seats on a bill",
                     "plans": ["complete", "business"], "on_for": ["restaurant"]},
    "reservations": {"label": "Reservations and the waiting list",
                     "plans": ["complete", "business"], "on_for": ["restaurant"]},
    "price_lists":  {"label": "Price lists for each customer",
                     "plans": ["complete", "business"], "on_for": ["bakery", "supplier"]},
    "quotes":       {"label": "Quotes, sales orders and delivery notes",
                     "plans": ["complete", "business"], "on_for": ["bakery", "supplier"]}
  }'::jsonb
$$;

-- -----------------------------------------------------------------------------
-- 1. A stock item sold as it is, by the piece or by the carton
-- -----------------------------------------------------------------------------
-- (recipe.edit) A product whose one size is the stock item itself: `p_pack`
-- of it (1, or a carton's 24), at a price on each way of selling given.
create or replace function make_item_sellable(p_item uuid, p_name text, p_prices jsonb, p_pack numeric default 1,
                                              p_category uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); i item; v_name text;
begin
  select * into i from item where id = p_item and business_id = v_business;
  if i.id is null then raise exception 'Choose one of the café''s stock items'; end if;
  if p_pack is null or p_pack <= 0 or p_pack > 1000 then raise exception 'A pack is from 1 to 1000 of the item'; end if;
  v_name := coalesce(nullif(trim(p_name), ''), i.name);
  return create_product__run(
    p_name => v_name, p_prices => p_prices,
    p_recipe => jsonb_build_array(jsonb_build_object('item_id', i.id, 'qty', p_pack, 'unit_code', i.base_unit_code,
                                                     'channels', '[]'::jsonb)),
    p_name_ar => case when p_pack = 1 then i.name_ar end, p_name_ckb => case when p_pack = 1 then i.name_ckb end,
    p_category => p_category);
end $$;

-- -----------------------------------------------------------------------------
-- 2. A customer's own prices
-- -----------------------------------------------------------------------------
create table if not exists customer_price (
  business_id        uuid not null references business(id) on delete cascade,
  customer_id        uuid not null references customer(id) on delete cascade,
  product_variant_id uuid not null references product_variant(id) on delete cascade,
  price              numeric not null check (price >= 0),
  set_by             uuid references app_user(id),
  set_at             timestamptz not null default now(),
  primary key (customer_id, product_variant_id)
);
alter table customer_price enable row level security;
alter table customer_price force row level security;

-- (credit.manage) A customer's price for a size; null takes it away.
create or replace function set_customer_price(p_customer uuid, p_variant uuid, p_price numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('credit.manage'); v_before numeric;
begin
  perform require_part(v_business, 'price_lists');
  if not exists (select 1 from customer where id = p_customer and business_id = v_business) then
    raise exception 'Customer not found';
  end if;
  if not exists (select 1 from product_variant where id = p_variant and business_id = v_business) then
    raise exception 'Product not found';
  end if;
  if p_price is not null and (p_price < 0 or p_price <> money_round(v_business, p_price)) then
    raise exception 'A price is 0 or more';
  end if;
  select price into v_before from customer_price where customer_id = p_customer and product_variant_id = p_variant;
  if p_price is null then
    delete from customer_price where customer_id = p_customer and product_variant_id = p_variant;
  else
    insert into customer_price (business_id, customer_id, product_variant_id, price, set_by)
    values (v_business, p_customer, p_variant, p_price, (current_member()).id)
    on conflict (customer_id, product_variant_id) do update set price = excluded.price, set_by = excluded.set_by,
                                                               set_at = now();
  end if;
  perform audit_event(v_business, 'customer.price', 'customer', p_customer::text, null,
    jsonb_build_object('variant', p_variant, 'price', v_before), jsonb_build_object('variant', p_variant, 'price', p_price));
  return customer_prices(p_customer);
end $$;

create or replace function customer_prices(p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('credit.manage', 'customer.view');
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'variant_id', cp.product_variant_id, 'price', cp.price,
      'name', p.name || case when v.name is not null and v.name <> '' and v.name <> p.name then ' · ' || v.name else '' end)
    order by p.name, v.name)
      from customer_price cp join product_variant v on v.id = cp.product_variant_id join product p on p.id = v.product_id
     where cp.customer_id = p_customer and cp.business_id = v_business), '[]'::jsonb);
end $$;

-- A size's price for a customer on account: a quote's, their own, else the
-- menu's less their wholesale percentage.
create or replace function customer_line_price(p_business uuid, c customer, p_variant uuid, p_channel sales_channel,
                                               p_location uuid, p_day date) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v_quote jsonb := nullif(current_setting('sixties.quote_prices', true), '')::jsonb; v_price numeric;
begin
  if v_quote ? p_variant::text then return (v_quote ->> p_variant::text)::numeric; end if;
  select price into v_price from customer_price where customer_id = c.id and product_variant_id = p_variant;
  if v_price is not null and part_on(p_business, 'price_lists') then return v_price; end if;
  v_price := price_on(p_variant, p_channel, p_location, p_day);
  if v_price is null then return null; end if;
  return money_round(p_business, v_price * (100 - c.wholesale_percent) / 100);
end $$;

-- 0077's invoice_customer: each line at the customer's own price, or a quote's (0111).
create or replace function invoice_customer(p_customer uuid, p_lines jsonb, p_idempotency_key uuid,
  p_note text default null, p_channel sales_channel default 'takeaway', p_location uuid default null,
  p_expected_net numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('credit.manage');
  v_me uuid := (current_member()).id;
  c customer; v_location uuid; v_today date; l jsonb; v_price numeric; v_qty numeric; v_total numeric := 0;
  v_lines jsonb := '[]'; r jsonb; v_no int; v_owed numeric; v_inv customer_invoice;
begin
  if p_idempotency_key is null then raise exception 'A sale needs its idempotency key'; end if;
  select ci.* into v_inv from customer_invoice ci join sales_order o on o.id = ci.sales_order_id
   where o.business_id = v_business and o.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('invoice_id', v_inv.id, 'invoice_no', v_inv.invoice_no, 'order_id',
                              v_inv.sales_order_id, 'amount', v_inv.amount, 'due_on', v_inv.due_on,
                              'replayed', true);
  end if;
  select * into c from customer where id = p_customer and business_id = v_business for update;
  if not found then raise exception 'Customer not found'; end if;
  if not c.is_active then raise exception '% is no longer a customer', c.full_name; end if;
  if not c.on_account then raise exception '% does not buy on account', c.full_name; end if;
  if is_platform_channel(p_channel) or p_channel = 'direct_delivery' then
    raise exception 'An invoice is for take-away or eat-in prices';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  if nullif(trim(p_note), '') is not null and length(trim(p_note)) > 300 then
    raise exception 'A note is at most 300 letters';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, now());
  for l in select * from jsonb_array_elements(p_lines) loop
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = (l ->> 'variant_id')::uuid and pv.business_id = v_business
                      and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    v_price := customer_line_price(v_business, c, (l ->> 'variant_id')::uuid, p_channel, v_location, v_today);
    if v_price is null then raise exception 'No % price is set for this product', p_channel; end if;
    v_lines := v_lines || jsonb_build_object('variant_id', l ->> 'variant_id', 'qty', v_qty, 'price', v_price,
                                             'modifiers', '[]'::jsonb);
    v_total := v_total + money_round(v_business, v_price * v_qty);
  end loop;
  v_owed := customer_balance(c.id);
  if v_owed + v_total > c.credit_limit then
    raise exception '% may owe at most %: they owe % already, and this is %', c.full_name,
      trim_scale(c.credit_limit), trim_scale(v_owed), trim_scale(v_total);
  end if;
  perform set_config('sixties.on_account', c.id::text, true);
  r := post_sale(v_business, v_me, p_idempotency_key, p_channel, null, v_lines, v_location, null, null, true,
                 jsonb_build_object('reason', null, 'note', null, 'approval', null),
                 p_tenders => jsonb_build_array(jsonb_build_object('type', 'other', 'amount', v_total,
                                                                   'on_account', c.id::text)),
                 p_expected_net => p_expected_net);
  perform set_config('sixties.on_account', '', true);
  perform pg_advisory_xact_lock(hashtext('customer_invoice:' || v_business::text));
  select coalesce(max(invoice_no), 0) + 1 into v_no from customer_invoice where business_id = v_business;
  insert into customer_invoice (business_id, customer_id, invoice_no, sales_order_id, location_id, amount,
                                issued_on, due_on, note, created_by)
  values (v_business, c.id, v_no, (r ->> 'order_id')::uuid, v_location, (r ->> 'net')::numeric, v_today,
          v_today + c.terms_days, nullif(trim(p_note), ''), v_me)
  returning * into v_inv;
  perform audit_event(v_business, 'customer.invoice', 'customer_invoice', v_inv.id::text, null, null,
    jsonb_build_object('customer', c.full_name, 'invoice_no', v_no, 'amount', v_inv.amount,
                       'due_on', v_inv.due_on));
  return jsonb_build_object('invoice_id', v_inv.id, 'invoice_no', v_no, 'order_id', v_inv.sales_order_id,
                            'amount', v_inv.amount, 'due_on', v_inv.due_on, 'replayed', false);
end $$;

-- -----------------------------------------------------------------------------
-- 3. Quotes and sales orders
-- -----------------------------------------------------------------------------
create table if not exists sales_quote (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  customer_id uuid not null references customer(id),
  quote_no    int not null,
  status      text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'invoiced', 'cancelled')),
  valid_until date,
  note        text,
  lines       jsonb not null default '[]',
  total       numeric not null default 0,
  invoice_id  uuid references customer_invoice(id),
  created_by  uuid references app_user(id),
  created_at  timestamptz not null default now(),
  unique (business_id, quote_no)
);
alter table sales_quote enable row level security;
alter table sales_quote force row level security;

-- (credit.manage) A quote, new or changed while a draft or sent: each line at
-- the customer's price today, kept with it.
create or replace function save_quote(p_id uuid, p_customer uuid, p_lines jsonb, p_valid_until date default null,
                                      p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('credit.manage');
  c customer; l jsonb; v_lines jsonb := '[]'; v_total numeric := 0; v_price numeric; v_qty numeric; v_no int;
  v_id uuid := p_id; v_today date; v_location uuid;
begin
  perform require_part(v_business, 'quotes');
  select * into c from customer where id = p_customer and business_id = v_business;
  if c.id is null then raise exception 'Customer not found'; end if;
  if not c.on_account then raise exception '% does not buy on account', c.full_name; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  v_today := business_local_date(v_business, now());
  if p_valid_until is not null and p_valid_until < v_today then raise exception 'A quote is good until today or later'; end if;
  v_location := resolve_location(v_business, null);
  for l in select * from jsonb_array_elements(p_lines) loop
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    v_price := customer_line_price(v_business, c, (l ->> 'variant_id')::uuid, 'takeaway', v_location, v_today);
    if v_price is null then raise exception 'That product is not on sale'; end if;
    v_lines := v_lines || jsonb_build_object('variant_id', l ->> 'variant_id', 'qty', v_qty, 'price', v_price,
      'name', (select p.name || case when v.name is not null and v.name <> '' and v.name <> p.name then ' · ' || v.name else '' end
                 from product_variant v join product p on p.id = v.product_id where v.id = (l ->> 'variant_id')::uuid));
    v_total := v_total + money_round(v_business, v_price * v_qty);
  end loop;
  if p_id is null then
    perform pg_advisory_xact_lock(hashtext('sales_quote:' || v_business::text));
    select coalesce(max(quote_no), 0) + 1 into v_no from sales_quote where business_id = v_business;
    insert into sales_quote (business_id, customer_id, quote_no, valid_until, note, lines, total, created_by)
    values (v_business, c.id, v_no, p_valid_until, left(nullif(trim(p_note), ''), 300), v_lines, v_total,
            (current_member()).id)
    returning id into v_id;
  else
    update sales_quote set customer_id = c.id, valid_until = p_valid_until, note = left(nullif(trim(p_note), ''), 300),
                           lines = v_lines, total = v_total
     where id = p_id and business_id = v_business and status in ('draft', 'sent');
    if not found then raise exception 'That quote is not open'; end if;
  end if;
  perform audit_event(v_business, 'quote.save', 'sales_quote', v_id::text, null, null,
    jsonb_build_object('customer', c.full_name, 'total', v_total));
  return quote_json(v_id);
end $$;

create or replace function quote_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', q.id, 'quote_no', q.quote_no, 'customer_id', q.customer_id,
    'customer', (select full_name from customer where id = q.customer_id), 'status', q.status,
    'valid_until', q.valid_until, 'note', q.note, 'lines', q.lines, 'total', q.total,
    'invoice_no', (select invoice_no from customer_invoice where id = q.invoice_id), 'created_at', q.created_at)
    from sales_quote q where q.id = p_id
$$;

-- (credit.manage) Sent to the customer, accepted (a sales order), or cancelled.
create or replace function set_quote_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('credit.manage'); q sales_quote;
begin
  perform require_part(v_business, 'quotes');
  if coalesce(p_status, '') not in ('sent', 'accepted', 'cancelled') then
    raise exception 'Choose sent, accepted or cancelled';
  end if;
  select * into q from sales_quote where id = p_id and business_id = v_business for update;
  if q.id is null then raise exception 'That quote is not found'; end if;
  if q.status in ('invoiced', 'cancelled') then raise exception 'That quote is closed'; end if;
  update sales_quote set status = p_status where id = p_id;
  perform audit_event(v_business, 'quote.' || p_status, 'sales_quote', p_id::text, null,
    jsonb_build_object('status', q.status), jsonb_build_object('status', p_status));
  return quote_json(p_id);
end $$;

-- (credit.manage) The quote invoiced, at the prices it gave.
create or replace function quote_to_invoice(p_id uuid, p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('credit.manage'); q sales_quote; r jsonb; v_prices jsonb;
begin
  perform require_part(v_business, 'quotes');
  select * into q from sales_quote where id = p_id and business_id = v_business for update;
  if q.id is null then raise exception 'That quote is not found'; end if;
  if q.status = 'invoiced' then
    return quote_json(p_id) || jsonb_build_object('replayed', true);
  end if;
  if q.status = 'cancelled' then raise exception 'That quote is closed'; end if;
  if q.valid_until is not null and q.valid_until < business_local_date(v_business, now()) then
    raise exception 'That quote has run out: make a new one';
  end if;
  select jsonb_object_agg(x ->> 'variant_id', x ->> 'price') into v_prices from jsonb_array_elements(q.lines) x;
  perform set_config('sixties.quote_prices', v_prices::text, true);
  r := invoice_customer(q.customer_id,
    (select jsonb_agg(jsonb_build_object('variant_id', x ->> 'variant_id', 'qty', x ->> 'qty'))
       from jsonb_array_elements(q.lines) x),
    p_idempotency_key, 'Quote ' || q.quote_no);
  perform set_config('sixties.quote_prices', '', true);
  update sales_quote set status = 'invoiced', invoice_id = (r ->> 'invoice_id')::uuid where id = p_id;
  perform audit_event(v_business, 'quote.invoiced', 'sales_quote', p_id::text, null, null,
    jsonb_build_object('invoice_no', r ->> 'invoice_no'));
  return quote_json(p_id) || jsonb_build_object('invoice_id', r ->> 'invoice_id', 'invoice_no', r ->> 'invoice_no');
end $$;

create or replace function quotes(p_open_only boolean default true) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('credit.manage');
begin
  perform require_part(v_business, 'quotes');
  return coalesce((select jsonb_agg(quote_json(q.id) order by q.quote_no desc)
                     from sales_quote q
                    where q.business_id = v_business
                      and (not p_open_only or q.status in ('draft', 'sent', 'accepted'))), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 4. Delivery notes
-- -----------------------------------------------------------------------------
create table if not exists delivery_note (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  invoice_id   uuid not null references customer_invoice(id),
  note_no      int not null,
  driver       text,
  route        text,
  status       text not null default 'prepared' check (status in ('prepared', 'out', 'delivered')),
  out_at       timestamptz,
  delivered_at timestamptz,
  received_by  text,
  created_by   uuid references app_user(id),
  created_at   timestamptz not null default now(),
  unique (business_id, note_no)
);
alter table delivery_note enable row level security;
alter table delivery_note force row level security;

-- (credit.manage) A delivery note for an invoice, with its driver and route.
create or replace function make_delivery_note(p_invoice uuid, p_driver text, p_route text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('credit.manage'); v_no int; v_id uuid;
begin
  perform require_part(v_business, 'quotes');
  if not exists (select 1 from customer_invoice where id = p_invoice and business_id = v_business) then
    raise exception 'That invoice is not found';
  end if;
  if exists (select 1 from delivery_note where invoice_id = p_invoice and status <> 'delivered') then
    raise exception 'That invoice has a delivery note on its way already';
  end if;
  perform pg_advisory_xact_lock(hashtext('delivery_note:' || v_business::text));
  select coalesce(max(note_no), 0) + 1 into v_no from delivery_note where business_id = v_business;
  insert into delivery_note (business_id, invoice_id, note_no, driver, route, created_by)
  values (v_business, p_invoice, v_no, left(nullif(trim(p_driver), ''), 80), left(nullif(trim(p_route), ''), 120),
          (current_member()).id)
  returning id into v_id;
  perform audit_event(v_business, 'delivery.note', 'delivery_note', v_id::text, null, null,
    jsonb_build_object('note_no', v_no, 'driver', p_driver));
  return delivery_notes(false);
end $$;

-- (credit.manage) Out with the driver; delivered, and who signed for it.
create or replace function set_delivery_status(p_id uuid, p_status text, p_received_by text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('credit.manage'); d delivery_note;
begin
  perform require_part(v_business, 'quotes');
  if coalesce(p_status, '') not in ('out', 'delivered') then raise exception 'Choose out or delivered'; end if;
  select * into d from delivery_note where id = p_id and business_id = v_business for update;
  if d.id is null then raise exception 'That delivery note is not found'; end if;
  if d.status = 'delivered' then raise exception 'That delivery is done already'; end if;
  if p_status = 'delivered' and nullif(trim(p_received_by), '') is null then
    raise exception 'Say who signed for it';
  end if;
  update delivery_note
     set status = p_status,
         out_at = coalesce(out_at, now()),
         delivered_at = case when p_status = 'delivered' then now() end,
         received_by = case when p_status = 'delivered' then left(trim(p_received_by), 80) else received_by end
   where id = p_id;
  perform audit_event(v_business, 'delivery.' || p_status, 'delivery_note', p_id::text, null, null,
    jsonb_build_object('received_by', p_received_by));
  return delivery_notes(false);
end $$;

create or replace function delivery_notes(p_all boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('credit.manage');
begin
  perform require_part(v_business, 'quotes');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', d.id, 'note_no', d.note_no, 'invoice_no', i.invoice_no, 'customer', c.full_name, 'amount', i.amount,
      'driver', d.driver, 'route', d.route, 'status', d.status, 'out_at', d.out_at,
      'delivered_at', d.delivered_at, 'received_by', d.received_by, 'created_at', d.created_at)
    order by d.note_no desc)
      from delivery_note d join customer_invoice i on i.id = d.invoice_id join customer c on c.id = i.customer_id
     where d.business_id = v_business
       and (p_all or d.status <> 'delivered' or d.delivered_at > now() - interval '7 days')), '[]'::jsonb);
end $$;

-- (credit.manage) The last invoices, for a delivery note: whether one is on its way or done.
create or replace function recent_invoices() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('credit.manage');
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'invoice_no', i.invoice_no, 'customer', c.full_name, 'amount', i.amount, 'issued_on', i.issued_on,
      'delivery', (select d.status from delivery_note d where d.invoice_id = i.id order by d.created_at desc limit 1))
    order by i.invoice_no desc)
      from (select * from customer_invoice where business_id = v_business order by invoice_no desc limit 50) i
      join customer c on c.id = i.customer_id), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 5. Credit notes
-- -----------------------------------------------------------------------------
-- (credit.manage) Taken off what a customer owes, with why: Dr 4200, Cr 1110,
-- kept beside their payments (account 4200), so their invoices are settled
-- oldest first as a payment settles them.
create or replace function credit_customer(p_customer uuid, p_amount numeric, p_reason text,
                                           p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('credit.manage');
  v_req jsonb := jsonb_build_object('customer', p_customer, 'amount', p_amount, 'reason', p_reason);
  v jsonb; c customer; v_owed numeric; v_id uuid := gen_random_uuid(); v_journal uuid;
  v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
begin
  v := idem_begin(v_business, p_idempotency_key, 'credit_customer', v_req);
  if v is not null then return v; end if;
  select * into c from customer where id = p_customer and business_id = v_business for update;
  if not found then raise exception 'Customer not found'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> money_round(v_business, p_amount) then
    raise exception 'A credit note needs an amount more than 0';
  end if;
  if v_reason is null or length(v_reason) < 6 then raise exception 'Say why, in a few words'; end if;
  v_owed := customer_balance(c.id);
  if p_amount > v_owed then
    raise exception '% owes %: a credit note is at most that', c.full_name, trim_scale(v_owed);
  end if;
  insert into customer_payment (id, business_id, customer_id, amount, account_code, location_id, reference, created_by)
  values (v_id, v_business, c.id, p_amount, '4200', resolve_location(v_business, null),
          left('Credit note: ' || v_reason, 60), (current_member()).id);
  v_journal := post_journal(v_business, now(), 'Credit note for ' || c.full_name, 'customer_payment', v_id,
    jsonb_build_array(jsonb_build_object('code', '4200', 'debit', p_amount),
                      jsonb_build_object('code', '1110', 'credit', p_amount)));
  update customer_payment set journal_entry_id = v_journal where id = v_id;
  perform audit_event(v_business, 'customer.credit', 'customer_payment', v_id::text, v_reason, null,
    jsonb_build_object('customer', c.full_name, 'amount', p_amount));
  v := jsonb_build_object('credit_id', v_id, 'balance', v_owed - p_amount,
                          'journal_no', (select journal_no from journal_entry where id = v_journal));
  perform idem_finish(v_business, p_idempotency_key, 'credit_customer', v_req, v);
  return v;
end $$;

revoke execute on function customer_line_price(uuid, customer, uuid, sales_channel, uuid, date), quote_json(uuid)
  from public, anon, authenticated;
revoke execute on function make_item_sellable(uuid, text, jsonb, numeric, uuid), set_customer_price(uuid, uuid, numeric),
  customer_prices(uuid), save_quote(uuid, uuid, jsonb, date, text), set_quote_status(uuid, text),
  quote_to_invoice(uuid, uuid), quotes(boolean), make_delivery_note(uuid, text, text),
  set_delivery_status(uuid, text, text), delivery_notes(boolean), credit_customer(uuid, numeric, text, uuid),
  recent_invoices()
  from public, anon;
grant execute on function make_item_sellable(uuid, text, jsonb, numeric, uuid), set_customer_price(uuid, uuid, numeric),
  customer_prices(uuid), save_quote(uuid, uuid, jsonb, date, text), set_quote_status(uuid, text),
  quote_to_invoice(uuid, uuid), quotes(boolean), make_delivery_note(uuid, text, text),
  set_delivery_status(uuid, text, text), delivery_notes(boolean), credit_customer(uuid, numeric, text, uuid),
  recent_invoices()
  to authenticated;
