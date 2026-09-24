-- =============================================================================
-- 0018_pos_bills_and_photos.sql — the till for a busy café: tables, bills that
-- are paid later, product photos and menu categories.
--
-- A bill (pos_tab) holds what a table or a customer has ordered until they
-- pay. It is not a sale: nothing reaches the books or the stock until it is
-- paid, and then it is recorded by record_sale exactly like any other sale,
-- with the same checks, the same journal and the same idempotency key.
--
-- While a bill is open it can change. Two controls keep that honest:
--   * once the bill has been printed for the customer, taking anything off it
--     needs a manager (sale.void), and is on the audit trail;
--   * cancelling a bill with anything on it always needs a manager.
-- Otherwise a drink could be served, struck off the bill and the cash kept.
-- A trading day cannot be closed while one of its bills is still open.
--
-- Product photos are stored small (the browser shrinks them first) in the
-- database and served by the app to signed-in members only. Only PNG, JPEG
-- and WebP are accepted, judged by their bytes, not their name.
-- =============================================================================

-- =============================================================================
-- 1. Tables in the café
-- =============================================================================
create table if not exists dining_table (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  location_id uuid not null references location(id),
  name        text not null check (length(trim(name)) between 1 and 40),
  area        text,
  seats       int check (seats is null or seats between 1 and 99),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists dining_table_business_idx on dining_table (business_id);
create unique index if not exists dining_table_name_uq on dining_table (location_id, lower(name)) where is_active;

-- Categories are what the till is organised by; two with one name would confuse it.
create unique index if not exists product_category_name_uq on product_category (business_id, lower(name));

-- =============================================================================
-- 2. Bills: open until paid
-- =============================================================================
create table if not exists pos_tab (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business(id) on delete cascade,
  location_id      uuid not null references location(id),
  table_id         uuid references dining_table(id),
  label            text,
  channel          sales_channel not null,
  status           text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  -- Bumped on every change, so a till working from an old copy is refused
  -- instead of overwriting what another till saved.
  version          int not null default 1,
  business_day     date not null,
  opened_by        uuid references app_user(id),
  opened_at        timestamptz not null default now(),
  bill_printed_at  timestamptz,
  bill_print_count int not null default 0,
  closed_by        uuid references app_user(id),
  closed_at        timestamptz,
  sales_order_id   uuid references sales_order(id),
  cancel_reason    text
);
create index if not exists pos_tab_business_idx on pos_tab (business_id, status);
create unique index if not exists pos_tab_one_order on pos_tab (sales_order_id) where sales_order_id is not null;

create table if not exists pos_tab_line (
  id                 uuid primary key default gen_random_uuid(),
  tab_id             uuid not null references pos_tab(id) on delete cascade,
  business_id        uuid not null references business(id) on delete cascade,
  product_variant_id uuid not null references product_variant(id),
  qty                numeric not null check (qty > 0),
  note               text,
  position           int not null default 0,
  added_by           uuid references app_user(id),
  added_at           timestamptz not null default now()
);
create index if not exists pos_tab_line_tab_idx on pos_tab_line (tab_id);

-- A paid or cancelled bill never changes again, and no bill is ever deleted.
create or replace function trg_pos_tab_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'A bill is never deleted; cancel it instead' using errcode = 'check_violation';
  end if;
  if OLD.status <> 'open' then
    raise exception 'This bill is % and cannot change', OLD.status using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

drop trigger if exists pos_tab_guard on pos_tab;
create trigger pos_tab_guard
  before update or delete on pos_tab
  for each row execute function trg_pos_tab_guard();

create or replace function trg_pos_tab_line_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from pos_tab where id = coalesce(NEW.tab_id, OLD.tab_id);
  if v_status is distinct from 'open' then
    raise exception 'The lines of a % bill cannot change', coalesce(v_status, 'missing')
      using errcode = 'check_violation';
  end if;
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists pos_tab_line_guard on pos_tab_line;
create trigger pos_tab_line_guard
  before insert or update or delete on pos_tab_line
  for each row execute function trg_pos_tab_line_guard();

-- =============================================================================
-- 3. Product photos
-- =============================================================================
create table if not exists product_image (
  product_id   uuid primary key references product(id) on delete cascade,
  business_id  uuid not null references business(id) on delete cascade,
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  data         bytea not null,
  updated_by   uuid references app_user(id),
  updated_at   timestamptz not null default now()
);

-- =============================================================================
-- 4. Setting up: tables, categories, products and their photos
-- =============================================================================
create or replace function save_table(p_id uuid, p_name text, p_area text default null, p_seats int default null,
                                      p_sort_order int default 0, p_is_active boolean default true,
                                      p_location uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage', 'day.close'); v_id uuid;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the table'; end if;
  if p_id is null then
    insert into dining_table (business_id, location_id, name, area, seats, sort_order, is_active)
    values (v_business, resolve_location(v_business, p_location), trim(p_name), nullif(trim(p_area), ''),
            p_seats, coalesce(p_sort_order, 0), coalesce(p_is_active, true))
    returning id into v_id;
  else
    if not exists (select 1 from dining_table where id = p_id and business_id = v_business) then
      raise exception 'Table not found';
    end if;
    if not coalesce(p_is_active, true)
       and exists (select 1 from pos_tab where table_id = p_id and status = 'open') then
      raise exception 'This table has an open bill; take payment or cancel it first';
    end if;
    update dining_table
       set name = trim(p_name), area = nullif(trim(p_area), ''), seats = p_seats,
           sort_order = coalesce(p_sort_order, 0), is_active = coalesce(p_is_active, true)
     where id = p_id
    returning id into v_id;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'There is already a table called %', trim(p_name);
end $$;

create or replace function save_category(p_id uuid, p_name text, p_name_ar text default null,
                                         p_name_ckb text default null, p_sort_order int default 0,
                                         p_is_active boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); v_id uuid;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the category'; end if;
  if p_id is null then
    insert into product_category (business_id, name, name_ar, name_ckb, sort_order, is_active)
    values (v_business, trim(p_name), nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''),
            coalesce(p_sort_order, 0), coalesce(p_is_active, true))
    returning id into v_id;
  else
    update product_category
       set name = trim(p_name), name_ar = nullif(trim(p_name_ar), ''), name_ckb = nullif(trim(p_name_ckb), ''),
           sort_order = coalesce(p_sort_order, 0), is_active = coalesce(p_is_active, true)
     where id = p_id and business_id = v_business
    returning id into v_id;
    if v_id is null then raise exception 'Category not found'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'There is already a category called %', trim(p_name);
end $$;

-- A product's name, category, and whether the till offers it. A product made
-- by create_product has one variant carrying the same name; it is renamed too.
create or replace function set_product_details(p_product uuid, p_name text, p_category uuid default null,
                                               p_is_active boolean default true, p_is_favourite boolean default false,
                                               p_name_ar text default null, p_name_ckb text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); v_old text;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the product'; end if;
  select name into v_old from product where id = p_product and business_id = v_business for update;
  if not found then raise exception 'Product not found'; end if;
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

-- p_data: the picture, base64. Returns the address the app shows it at; the
-- version in it changes with every new picture, so browsers never show a stale one.
create or replace function set_product_image(p_product uuid, p_content_type text, p_data text)
returns text language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); v_bytes bytea; v_url text;
begin
  if not exists (select 1 from product where id = p_product and business_id = v_business) then
    raise exception 'Product not found';
  end if;
  if p_content_type is null or p_content_type not in ('image/png', 'image/jpeg', 'image/webp') then
    raise exception 'Use a PNG, JPEG or WebP picture';
  end if;
  begin
    v_bytes := decode(p_data, 'base64');
  exception when others then
    raise exception 'The picture could not be read';
  end;
  if v_bytes is null or length(v_bytes) = 0 or length(v_bytes) > 300000 then
    raise exception 'The picture must be smaller than 300 KB';
  end if;
  if not ((p_content_type = 'image/png' and substring(v_bytes from 1 for 8) = '\x89504e470d0a1a0a'::bytea)
       or (p_content_type = 'image/jpeg' and substring(v_bytes from 1 for 3) = '\xffd8ff'::bytea)
       or (p_content_type = 'image/webp' and substring(v_bytes from 1 for 4) = '\x52494646'::bytea
                                        and substring(v_bytes from 9 for 4) = '\x57454250'::bytea)) then
    raise exception 'That file is not a PNG, JPEG or WebP picture';
  end if;
  insert into product_image (product_id, business_id, content_type, data, updated_by, updated_at)
  values (p_product, v_business, p_content_type, v_bytes, (current_member()).id, now())
  on conflict (product_id) do update
    set content_type = excluded.content_type, data = excluded.data,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  v_url := '/api/product-image/' || p_product || '?v=' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  update product set image_url = v_url where id = p_product;
  return v_url;
end $$;

create or replace function clear_product_image(p_product uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit');
begin
  if not exists (select 1 from product where id = p_product and business_id = v_business) then
    raise exception 'Product not found';
  end if;
  delete from product_image where product_id = p_product;
  update product set image_url = null where id = p_product;
end $$;

-- =============================================================================
-- 5. Bills
-- =============================================================================
-- A bill is for a table, or for a customer by name when there is no table.
-- Its first order can come with it (p_lines, as save_tab takes them), so a
-- bill is never left open and empty because the till lost its connection
-- between opening it and adding to it.
create or replace function open_tab(p_channel sales_channel, p_table uuid default null, p_label text default null,
                                    p_location uuid default null, p_lines jsonb default null)
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
    return save_tab(v_tab, 1, p_lines);
  end if;
  return jsonb_build_object('tab_id', v_tab, 'version', 1);
end $$;

-- Every change to a bill names the version the till is looking at. A till
-- working from an old copy is refused, so nobody prints, charges or cancels a
-- bill that is not what they see on their screen.
create or replace function lock_open_tab(p_business uuid, p_tab uuid, p_version int) returns pos_tab
language plpgsql set search_path = public as $$
declare t pos_tab;
begin
  select * into t from pos_tab where id = p_tab and business_id = p_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if t.status <> 'open' then raise exception 'This bill is already %', t.status; end if;
  if p_version is distinct from t.version then
    raise exception 'This bill was changed on another till. Open it again to see the latest.';
  end if;
  return t;
end $$;

-- Save what is on a bill: its lines (all of them), and optionally a new name or
-- table. p_lines: [{"variant_id": uuid, "qty": n, "note": "no sugar"}]
create or replace function save_tab(p_tab uuid, p_version int, p_lines jsonb, p_label text default null,
                                    p_table uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  t pos_tab; l jsonb; i int := 0; v_before jsonb; v_today date;
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
         table_id = coalesce(p_table, table_id)
   where id = p_tab;
  return jsonb_build_object('tab_id', p_tab, 'version', t.version + 1);
end $$;

-- Printing the bill for the customer is recorded: from then on, reducing it needs a manager.
create or replace function mark_bill_printed(p_tab uuid, p_version int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); t pos_tab;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  if not exists (select 1 from pos_tab_line where tab_id = p_tab) then
    raise exception 'The bill is empty';
  end if;
  update pos_tab set bill_printed_at = now(), bill_print_count = bill_print_count + 1
   where id = p_tab;
  return jsonb_build_object('tab_id', p_tab, 'version', t.version, 'print_count', t.bill_print_count + 1);
end $$;

-- Take payment for a bill: it becomes a sale, recorded by record_sale. Paying
-- twice (a retry, or two tills at once) returns the one sale, never a second.
create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); t pos_tab; v_lines jsonb; r jsonb;
begin
  select * into t from pos_tab where id = p_tab and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if t.status = 'paid' then
    return jsonb_build_object(
      'tab_id', t.id, 'order_id', t.sales_order_id, 'replayed', true,
      'net', (select net_amount from sales_order where id = t.sales_order_id),
      'journal_no', (select journal_no from journal_entry
                      where reference_type = 'sales_order' and reference_id = t.sales_order_id
                        and reverses_entry is null limit 1));
  end if;
  t := lock_open_tab(v_business, p_tab, p_version);
  select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty) order by position)
    into v_lines from pos_tab_line where tab_id = p_tab;
  if v_lines is null then raise exception 'The bill is empty'; end if;
  r := record_sale(p_idempotency_key, t.channel, p_tender, v_lines, t.location_id);
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

-- Move some of a bill onto a new bill, for a table that pays separately.
-- Nothing leaves the table's bills, so no manager is needed; a bill already
-- printed passes that on to the new one. p_move: [{"line_id": uuid, "qty": n}]
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
                       bill_printed_at)
  values (v_business, t.location_id, t.table_id,
          coalesce(nullif(trim(p_label), ''), t.label), t.channel, t.business_day, v_me, t.bill_printed_at)
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

create or replace function cancel_tab(p_tab uuid, p_version int, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); t pos_tab; v_lines jsonb;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty) order by position)
    into v_lines from pos_tab_line where tab_id = p_tab;
  if v_lines is not null then
    if not current_has_permission('sale.void') then
      raise exception 'Only a manager can cancel a bill with items on it' using errcode = '42501';
    end if;
    if nullif(trim(p_reason), '') is null then raise exception 'Say why the bill is being cancelled'; end if;
  end if;
  update pos_tab
     set status = 'cancelled', cancel_reason = nullif(trim(p_reason), ''), closed_at = now(),
         closed_by = (current_member()).id
   where id = p_tab;
  perform audit_event(v_business, 'bill.cancel', 'pos_tab', p_tab::text, nullif(trim(p_reason), ''),
                      jsonb_build_object('lines', v_lines, 'table_id', t.table_id, 'label', t.label), null);
end $$;

-- The bills still open, as the till shows them: every line with its name and
-- today's price, and what the bill comes to.
create or replace function pos_open_bills()
returns table (tab_id uuid, version int, table_id uuid, table_name text, label text, channel sales_channel,
               business_day date, opened_at timestamptz, opened_by text, bill_printed_at timestamptz,
               bill_print_count int, lines jsonb, total numeric)
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
    )
    select t.id, t.version, t.table_id, dt.name, t.label, t.channel, t.business_day, t.opened_at, au.full_name,
           t.bill_printed_at, t.bill_print_count,
           coalesce((select jsonb_agg(jsonb_build_object(
                               'line_id', l.id, 'variant_id', l.product_variant_id, 'qty', l.qty, 'note', l.note,
                               'product_name', l.product_name, 'variant_name', l.variant_name, 'price', l.price)
                             order by l.position)
                       from l where l.tab_id = t.id), '[]'::jsonb),
           coalesce((select sum(money_round(v_business, l.price * l.qty)) from l where l.tab_id = t.id), 0)
      from pos_tab t
      left join dining_table dt on dt.id = t.table_id
      left join app_user au on au.id = t.opened_by
     where t.business_id = v_business and t.status = 'open'
     order by t.opened_at;
end $$;

-- =============================================================================
-- 6. The till's menu, now with photos, categories in order, and favourites
-- =============================================================================
-- The return type changes, so the function is replaced, not altered. The first
-- five columns are unchanged, for any till still running the previous app.
drop function if exists pos_catalogue();
create or replace function pos_catalogue()
returns table (variant_id uuid, product_name text, variant_name text, category text, prices jsonb,
               product_id uuid, category_id uuid, category_sort int, image_url text, is_favourite boolean,
               name_ar text, name_ckb text, category_ar text, category_ckb text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date; v_location uuid;
begin
  v_today := business_local_date(v_business, now());
  v_location := default_location(v_business);
  return query
    select pv.id, p.name, pv.name, pc.name,
           coalesce((select jsonb_object_agg(ch, price_on(pv.id, ch, v_location, v_today))
                       from unnest(enum_range(null::sales_channel)) ch
                      where price_on(pv.id, ch, v_location, v_today) is not null), '{}'),
           p.id, pc.id, pc.sort_order, p.image_url, p.is_favourite, p.name_ar, p.name_ckb, pc.name_ar, pc.name_ckb
      from product_variant pv
      join product p on p.id = pv.product_id
      left join product_category pc on pc.id = p.category_id
     -- A hidden category takes its products off the menu with it.
     where pv.business_id = v_business and pv.is_active and p.is_active and coalesce(pc.is_active, true)
     order by pc.sort_order nulls last, pc.name nulls last, p.name, pv.name;
end $$;

-- =============================================================================
-- 7. The day cannot close with bills still open
-- =============================================================================
-- 0015's close_day, with one more refusal before anything is counted.
create or replace function close_day(p_day date, p_counted_cash numeric, p_opening_float numeric default 0,
                                     p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close');
  v_me uuid := (current_member()).id;
  v_location uuid; t record; v_expected numeric; v_counted numeric; v_variance numeric;
  v_shift uuid; v_at timestamptz; v_journal uuid; v_open int;
begin
  if p_day is null or p_day > business_local_date(v_business, now()) then
    raise exception 'Choose a trading day that has happened';
  end if;
  v_location := resolve_location(v_business, p_location);
  if exists (select 1 from work_shift where business_id = v_business and location_id = v_location
               and business_day = p_day and closed_at is not null) then
    raise exception 'Trading day % is already closed', p_day;
  end if;
  select count(*) into v_open from pos_tab
   where business_id = v_business and location_id = v_location and status = 'open' and business_day <= p_day;
  if v_open > 0 then
    raise exception '% bill(s) are still open. Take payment for them or cancel them before closing the day', v_open;
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

-- 0017's day totals, now also saying how many bills are still open.
create or replace function report_day_totals(p_day date, p_location uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('day.close', 'cost.view'); v_location uuid; t record;
begin
  v_location := resolve_location(v_business, p_location);
  t := day_cash_totals(v_business, v_location, p_day);
  return jsonb_build_object(
    'day', p_day, 'orders', t.orders, 'cash_sales', t.cash_sales, 'cash_refunds', t.cash_refunds,
    'card', coalesce((select sum(tn.amount) from sales_order o join sales_tender tn on tn.sales_order_id = o.id
                       where o.business_id = v_business and o.location_id = v_location and tn.tender_type = 'card'
                         and o.status <> 'voided' and business_local_date(v_business, o.placed_at) = p_day), 0),
    'platform', coalesce((select sum(tn.amount) from sales_order o join sales_tender tn on tn.sales_order_id = o.id
                           where o.business_id = v_business and o.location_id = v_location and tn.tender_type = 'platform_paid'
                             and o.status <> 'voided' and business_local_date(v_business, o.placed_at) = p_day), 0),
    'closed', exists (select 1 from work_shift where business_id = v_business and location_id = v_location
                        and business_day = p_day and closed_at is not null),
    'open_bills', (select count(*) from pos_tab where business_id = v_business and location_id = v_location
                     and status = 'open' and business_day <= p_day));
end $$;

-- =============================================================================
-- 8. Who may read what (0016 closed everything by default)
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['dining_table', 'pos_tab', 'pos_tab_line', 'product_image'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists member_read on %I', t);
    execute format($p$create policy member_read on %I for select to authenticated
                      using (business_id = (select current_business_id()))$p$, t);
    execute format('grant select on %I to authenticated', t);
  end loop;
end $$;

revoke execute on function trg_pos_tab_guard(), trg_pos_tab_line_guard(), lock_open_tab(uuid, uuid, int)
  from public, anon, authenticated;

grant execute on function
  save_table(uuid, text, text, int, int, boolean, uuid),
  save_category(uuid, text, text, text, int, boolean),
  set_product_details(uuid, text, uuid, boolean, boolean, text, text),
  set_product_image(uuid, text, text),
  clear_product_image(uuid),
  open_tab(sales_channel, uuid, text, uuid, jsonb),
  save_tab(uuid, int, jsonb, text, uuid),
  mark_bill_printed(uuid, int),
  settle_tab(uuid, int, uuid, tender_type),
  split_tab(uuid, int, jsonb, text),
  cancel_tab(uuid, int, text),
  pos_open_bills(),
  pos_catalogue()
to authenticated;
