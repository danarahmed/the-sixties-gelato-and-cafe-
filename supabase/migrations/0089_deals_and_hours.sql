-- =============================================================================
-- 0089 — Meal deals and prices by the time of day (SMART_PLAN F1, F2)
-- =============================================================================
-- Prices by the time of day (F2). A size's price at set hours, on set days —
-- gelato after 21:00, breakfast from 08:00 to 11:00 — on dine-in and
-- take-away unless another channel is named, at every branch or one. It
-- takes the place of the channel's price while it runs; a markdown (0079)
-- still comes off it. A sale is priced at the moment it was made (an
-- offline one at its own time that day); a bill keeps the price it was rung
-- at, and the till changes by itself when an hour comes. A menu section can
-- be shown only in its hours.
--
-- Meal deals (F1). "Latte + croissant = 5,000": a deal is its places to fill
-- (a size named, or any size of a category: any hot drink), a price for
-- each channel it is sold on, and the days and hours it is on. At the till it
-- is one tap; each size is sold as itself — its stock and its cost go down
-- as if sold alone, at its own full price — and what the deal gives away is
-- shared over them as a discount (4100), kept apart, so each product's
-- figures stay its own. Add-ons cost what they cost. Each deal sold is kept
-- (sale_deal) with its full price, its deal price and what it gave away;
-- Reports show the deals sold.
--
--  * time_price, set_time_price, stop_time_price; time_price_now; price_on
--    reads it; pos_menu_next_change says when the till's menu next changes.
--  * menu_section.shown_from/shown_until, set_section_hours; pos_catalogue
--    leaves out a section outside its hours.
--  * deal, deal_price, deal_slot, deal_slot_variant; save_deal, set_deal_on,
--    deals_list, pos_deals; post_sale prices a deal's lines; sale_deal;
--    report_deals.
--
-- Nothing recorded changes. Before it, nothing is priced by the hour and no
-- deal is sold.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Prices by the time of day
-- -----------------------------------------------------------------------------
create table if not exists time_price (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references business (id) on delete cascade,
  product_variant_id  uuid not null references product_variant (id),
  -- Null: dine-in and take-away.
  channel             sales_channel,
  -- Null: every branch.
  location_id         uuid references location (id),
  -- The days of the week it is on, Monday 1 to Sunday 7; null: every day.
  days                smallint[],
  starts              time not null,
  -- At or before its start: it runs past midnight, into the next day.
  ends                time not null,
  price               numeric not null,
  created_by          uuid references app_user (id),
  created_at          timestamptz not null default now(),
  stopped_at          timestamptz,
  stopped_by          uuid references app_user (id),
  constraint time_price_price check (price >= 0),
  constraint time_price_days check (days is null or (cardinality(days) between 1 and 7 and days <@ array[1,2,3,4,5,6,7]::smallint[])),
  constraint time_price_hours check (starts <> ends)
);
create index if not exists time_price_running on time_price (product_variant_id) where stopped_at is null;
alter table time_price enable row level security;
alter table time_price force row level security;
drop policy if exists member_read on time_price;
create policy member_read on time_price for select to authenticated
  using (business_id = (select current_business_id()));
grant select on time_price to authenticated;

-- Whether a window of days and hours holds a moment, in the café's time: a
-- window past midnight belongs to the day it starts.
create or replace function in_window(p_business uuid, p_days smallint[], p_starts time, p_ends time,
                                     p_at timestamptz)
returns boolean language sql stable set search_path = public as $$
  with t as (select (p_at at time zone coalesce((select timezone from business where id = p_business), 'UTC')) as l)
  select case
           when p_starts is null or p_ends is null then
             p_days is null or extract(isodow from t.l)::smallint = any (p_days)
           when p_starts < p_ends then
             t.l::time >= p_starts and t.l::time < p_ends
             and (p_days is null or extract(isodow from t.l)::smallint = any (p_days))
           else
             (t.l::time >= p_starts and (p_days is null or extract(isodow from t.l)::smallint = any (p_days)))
             or (t.l::time < p_ends
                 and (p_days is null or extract(isodow from t.l - interval '1 day')::smallint = any (p_days)))
         end
    from t
$$;

-- The price by the hour for a size now: a branch's own first, then the lowest.
create or replace function time_price_now(p_variant uuid, p_channel sales_channel, p_location uuid,
                                          p_at timestamptz)
returns numeric language sql stable security definer set search_path = public as $$
  select tp.price from time_price tp
   where tp.product_variant_id = p_variant and tp.stopped_at is null
     and (tp.channel = p_channel or (tp.channel is null and p_channel in ('dine_in', 'takeaway')))
     and (tp.location_id is null or tp.location_id = p_location)
     and in_window(tp.business_id, tp.days, tp.starts, tp.ends, p_at)
   order by (tp.location_id is not null) desc, tp.price
   limit 1
$$;

-- 0079's price_on, before the hour's price.
alter function price_on(uuid, sales_channel, uuid, date) rename to price_on_0079;
revoke execute on function price_on_0079(uuid, sales_channel, uuid, date) from public, anon, authenticated;

-- The price on a day; on the day of the sale (now, or an offline sale's own
-- time that day), the hour's price while one runs, a markdown still off it.
create or replace function price_on(p_variant uuid, p_channel sales_channel, p_location uuid, p_on date)
returns numeric language plpgsql stable set search_path = public as $$
declare
  v_at timestamptz := coalesce(nullif(current_setting('sixties.sale_placed_at', true), '')::timestamptz, now());
  v_business uuid; v_hour numeric; v_cut numeric;
begin
  select business_id into v_business from product_variant where id = p_variant;
  if v_business is not null and p_on = business_local_date(v_business, v_at) then
    v_hour := time_price_now(p_variant, p_channel, p_location, v_at);
    if v_hour is not null then
      v_cut := case when p_channel in ('dine_in', 'takeaway') and p_on = business_local_date(v_business, now())
                    then markdown_now(p_variant, p_location) end;
      return case when v_cut is null then v_hour else money_round(v_business, v_hour * (100 - v_cut) / 100) end;
    end if;
  end if;
  return price_on_0079(p_variant, p_channel, p_location, p_on);
end $$;

create or replace function set_time_price(p_variant uuid, p_price numeric, p_starts time, p_ends time,
                                          p_days smallint[] default null, p_channel sales_channel default null,
                                          p_location uuid default null, p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_req jsonb := jsonb_build_object('variant', p_variant, 'price', p_price, 'starts', p_starts, 'ends', p_ends,
                                    'days', p_days, 'channel', p_channel, 'location', p_location);
  v jsonb; v_id uuid;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_time_price', v_req);
  if v is not null then return (v #>> '{}')::uuid; end if;
  if not exists (select 1 from product_variant where id = p_variant and business_id = v_business) then
    raise exception 'Unknown product';
  end if;
  if p_price is null or p_price < 0 then raise exception 'Enter a price'; end if;
  if p_starts is null or p_ends is null or p_starts = p_ends then
    raise exception 'Give the hours it runs, from and until';
  end if;
  if p_days is not null and (cardinality(p_days) = 0 or not p_days <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception 'Choose the days it runs';
  end if;
  if p_channel is not null and is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets its own prices';
  end if;
  if p_location is not null and not exists (select 1 from location where id = p_location
                                               and business_id = v_business and is_active and kind = 'branch') then
    raise exception 'Choose one of the café''s branches';
  end if;
  insert into time_price (business_id, product_variant_id, channel, location_id, days, starts, ends, price,
                          created_by)
  values (v_business, p_variant, p_channel, p_location, p_days, p_starts, p_ends, p_price, (current_member()).id)
  returning id into v_id;
  perform audit_event(v_business, 'price.by_hour', 'time_price', v_id::text, null, null, v_req);
  perform idem_finish(v_business, p_idempotency_key, 'set_time_price', v_req, to_jsonb(v_id));
  return v_id;
end $$;

create or replace function stop_time_price(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit');
begin
  update time_price set stopped_at = now(), stopped_by = (current_member()).id
   where id = p_id and business_id = v_business and stopped_at is null;
  if not found then raise exception 'That price is not running'; end if;
  perform audit_event(v_business, 'price.by_hour.stop', 'time_price', p_id::text, null, null, null);
end $$;

-- The prices by the hour still running, for the menu's screen.
create or replace function time_prices() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit', 'cost.view');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', tp.id, 'variant_id', tp.product_variant_id,
             'product', p.name || case when (select count(*) from product_variant v2 where v2.product_id = p.id) > 1
                                       then ' — ' || pv.name else '' end,
             'channel', tp.channel, 'location_id', tp.location_id, 'location', l.name,
             'days', tp.days, 'starts', to_char(tp.starts, 'HH24:MI'), 'ends', to_char(tp.ends, 'HH24:MI'),
             'price', tp.price,
             'usual', price_on_0079(tp.product_variant_id, coalesce(tp.channel, 'dine_in'), tp.location_id,
                                    business_local_date(v_business, now())),
             'on_now', in_window(v_business, tp.days, tp.starts, tp.ends, now()))
           order by p.name, pv.name, tp.starts)
      from time_price tp
      join product_variant pv on pv.id = tp.product_variant_id
      join product p on p.id = pv.product_id
      left join location l on l.id = tp.location_id
     where tp.business_id = v_business and tp.stopped_at is null), '[]'::jsonb);
end $$;

-- A bill keeps the price it was rung at: a line added while an hour's price
-- runs carries it from then on (as a printed bill's does, 0025).
create or replace function trg_tab_line_hour_price() returns trigger
language plpgsql security definer set search_path = public as $$
declare t pos_tab;
begin
  if NEW.unit_price is null then
    select * into t from pos_tab where id = NEW.tab_id;
    if found and time_price_now(NEW.product_variant_id, t.channel, t.location_id, now()) is not null then
      NEW.unit_price := price_on(NEW.product_variant_id, t.channel, t.location_id,
                                 business_local_date(t.business_id, now()));
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists tab_line_hour_price on pos_tab_line;
create trigger tab_line_hour_price before insert on pos_tab_line
  for each row execute function trg_tab_line_hour_price();

-- -----------------------------------------------------------------------------
-- 2. A menu section shown only in its hours
-- -----------------------------------------------------------------------------
alter table menu_section add column if not exists shown_from time;
alter table menu_section add column if not exists shown_until time;
alter table menu_section add column if not exists shown_days smallint[];

create or replace function set_section_hours(p_section uuid, p_from time, p_until time,
                                             p_days smallint[] default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit');
begin
  if (p_from is null) <> (p_until is null) or (p_from is not null and p_from = p_until) then
    raise exception 'Give the hours it is shown, from and until, or neither';
  end if;
  if p_days is not null and (cardinality(p_days) = 0 or not p_days <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception 'Choose the days it is shown';
  end if;
  update menu_section set shown_from = p_from, shown_until = p_until, shown_days = p_days
   where id = p_section and business_id = v_business;
  if not found then raise exception 'Section not found'; end if;
  perform audit_event(v_business, 'section.hours', 'menu_section', p_section::text, null, null,
    jsonb_build_object('from', p_from, 'until', p_until, 'days', p_days));
end $$;

-- Whether a section is shown now: always, or in its hours and days.
create or replace function section_shown(s menu_section, p_at timestamptz) returns boolean
language sql stable set search_path = public as $$
  select (s.shown_from is null and s.shown_days is null)
      or in_window(s.business_id, s.shown_days, s.shown_from, s.shown_until, p_at)
$$;

-- 0079's pos_catalogue, leaving out a section outside its hours.
drop function if exists pos_catalogue(uuid);
create or replace function pos_catalogue(p_location uuid default null)
returns table (variant_id uuid, product_name text, variant_name text, category text, prices jsonb,
               product_id uuid, category_id uuid, category_sort int, image_url text, is_favourite boolean,
               name_ar text, name_ckb text, category_ar text, category_ckb text,
               section_id uuid, section text, section_ar text, section_ckb text, section_position int,
               sold_by_weight boolean, barcode text, markdown_percent numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date; v_location uuid; v_limited boolean;
begin
  v_today := business_local_date(v_business, now());
  v_location := resolve_location(v_business, p_location);
  v_limited := exists (select 1 from location_section ls where ls.location_id = v_location);
  return query
    select pv.id, p.name, pv.name, pc.name,
           coalesce((select jsonb_object_agg(ch, price_on(pv.id, ch, v_location, v_today))
                       from unnest(enum_range(null::sales_channel)) ch
                      where price_on(pv.id, ch, v_location, v_today) is not null), '{}'),
           p.id, pc.id, pc.sort_order, p.image_url, p.is_favourite, p.name_ar, p.name_ckb, pc.name_ar, pc.name_ckb,
           ms.id, ms.name, ms.name_ar, ms.name_ckb, ms.position, pv.sold_by_weight, pv.barcode,
           markdown_now(pv.id, v_location)
      from product_variant pv
      join product p on p.id = pv.product_id
      left join product_category pc on pc.id = p.category_id
      left join menu_section ms on ms.id = pc.section_id and ms.is_active
     where pv.business_id = v_business and pv.is_active and p.is_active and coalesce(pc.is_active, true)
       and (not v_limited or ms.id is null
            or exists (select 1 from location_section ls where ls.location_id = v_location and ls.section_id = ms.id))
       and (ms.id is null or section_shown(ms, now()))
     order by ms.position nulls last, pc.sort_order nulls last, pc.name nulls last, p.name, pv.name;
end $$;

-- When the till's menu next changes by itself, within a day: an hour's price
-- starting or ending, a section shown or hidden, a deal on or off. The till
-- asks for its menu again then.
create or replace function pos_menu_next_change(p_location uuid default null) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_tz text := coalesce((select timezone from business where id = v_business), 'UTC');
  v_local timestamp := now() at time zone v_tz;
  v_next timestamp;
begin
  select min(c) into v_next
    from (select (v_local::date + d + t) as c
            from (select tp.starts as t from time_price tp where tp.business_id = v_business and tp.stopped_at is null
                  union select tp.ends from time_price tp where tp.business_id = v_business and tp.stopped_at is null
                  union select ms.shown_from from menu_section ms where ms.business_id = v_business and ms.shown_from is not null
                  union select ms.shown_until from menu_section ms where ms.business_id = v_business and ms.shown_until is not null
                  union select dl.starts from deal dl where dl.business_id = v_business and dl.is_active and dl.starts is not null
                  union select dl.ends from deal dl where dl.business_id = v_business and dl.is_active and dl.ends is not null
                  union select time '00:00') x(t),
                 (values (0), (1)) dd(d)) y
   where c > v_local;
  return v_next at time zone v_tz;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Meal deals
-- -----------------------------------------------------------------------------
create table if not exists deal (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business (id) on delete cascade,
  name        text not null,
  name_ar     text,
  name_ckb    text,
  is_active   boolean not null default true,
  -- When it is on: days (Monday 1 to Sunday 7) and hours; null: always.
  days        smallint[],
  starts      time,
  ends        time,
  created_by  uuid references app_user (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint deal_name check (length(trim(name)) between 1 and 60),
  constraint deal_hours check ((starts is null) = (ends is null) and (starts is null or starts <> ends)),
  constraint deal_days check (days is null or (cardinality(days) between 1 and 7 and days <@ array[1,2,3,4,5,6,7]::smallint[]))
);
create unique index if not exists deal_named_once on deal (business_id, lower(name));

create table if not exists deal_price (
  deal_id  uuid not null references deal (id) on delete cascade,
  channel  sales_channel not null,
  price    numeric not null check (price >= 0),
  primary key (deal_id, channel)
);

-- Each place in a deal: one size of those named, or of a category's.
create table if not exists deal_slot (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references deal (id) on delete cascade,
  position    int not null,
  label       text,
  category_id uuid references product_category (id)
);
create table if not exists deal_slot_variant (
  slot_id            uuid not null references deal_slot (id) on delete cascade,
  product_variant_id uuid not null references product_variant (id),
  primary key (slot_id, product_variant_id)
);

-- Each deal sold, as it was sold: its full price, its price as a deal, and
-- what it gave away (the discount shared over its lines).
create table if not exists sale_deal (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business (id) on delete cascade,
  sales_order_id uuid not null references sales_order (id),
  deal_id        uuid not null references deal (id),
  deal_key       text not null,
  name           text not null,
  full_amount    numeric not null,
  deal_amount    numeric not null,
  given          numeric not null check (given >= 0),
  created_at     timestamptz not null default now(),
  unique (sales_order_id, deal_key)
);
create index if not exists sale_deal_order on sale_deal (sales_order_id);
alter table sales_order_line add column if not exists sale_deal_id uuid references sale_deal (id);

do $$
declare t text;
begin
  foreach t in array array['deal', 'sale_deal'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists member_read on %I', t);
    execute format('create policy member_read on %I for select to authenticated
                      using (business_id = (select current_business_id()))', t);
    execute format('grant select on %I to authenticated', t);
  end loop;
  foreach t in array array['deal_price', 'deal_slot'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists member_read on %I', t);
    execute format('create policy member_read on %I for select to authenticated
                      using (exists (select 1 from deal d where d.id = deal_id
                                       and d.business_id = (select current_business_id())))', t);
    execute format('grant select on %I to authenticated', t);
  end loop;
end $$;
alter table deal_slot_variant enable row level security;
alter table deal_slot_variant force row level security;
drop policy if exists member_read on deal_slot_variant;
create policy member_read on deal_slot_variant for select to authenticated
  using (exists (select 1 from deal_slot s join deal d on d.id = s.deal_id
                  where s.id = slot_id and d.business_id = (select current_business_id())));
grant select on deal_slot_variant to authenticated;
-- A sale's deals are written with the sale, never after.
create or replace function trg_sale_deal_frozen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'A deal sold is kept as it was sold';
end $$;
drop trigger if exists sale_deal_frozen on sale_deal;
create trigger sale_deal_frozen before update or delete on sale_deal
  for each row execute function trg_sale_deal_frozen();

-- Whether a deal is on at a moment.
create or replace function deal_on(d deal, p_at timestamptz) returns boolean
language sql stable set search_path = public as $$
  select d.is_active and in_window(d.business_id, d.days, d.starts, d.ends, p_at)
$$;

-- The sizes a deal's place takes: those named, and those of its category on sale.
create or replace function deal_slot_sizes(p_slot uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select v.product_variant_id from deal_slot_variant v where v.slot_id = p_slot
  union
  select pv.id from deal_slot s
    join product p on p.category_id = s.category_id and p.is_active
    join product_variant pv on pv.product_id = p.id and pv.is_active
   where s.id = p_slot and s.category_id is not null
$$;

create or replace function save_deal(p_id uuid, p_name text, p_prices jsonb, p_slots jsonb,
                                     p_name_ar text default null, p_name_ckb text default null,
                                     p_days smallint[] default null, p_starts time default null,
                                     p_ends time default null, p_active boolean default true,
                                     p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_req jsonb := jsonb_build_object('id', p_id, 'name', p_name, 'prices', p_prices, 'slots', p_slots,
                                    'name_ar', p_name_ar, 'name_ckb', p_name_ckb, 'days', p_days,
                                    'starts', p_starts, 'ends', p_ends, 'active', p_active);
  v jsonb; v_id uuid; v_name text := nullif(trim(p_name), ''); s jsonb; v_slot uuid; v_pos int := 0;
  v_ch text; v_price numeric; v_n int;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_deal', v_req);
  if v is not null then return (v #>> '{}')::uuid; end if;
  if v_name is null then raise exception 'Name the deal'; end if;
  if length(v_name) > 60 then raise exception 'A deal''s name is at most 60 letters'; end if;
  if exists (select 1 from deal where business_id = v_business and lower(name) = lower(v_name)
               and id is distinct from p_id) then
    raise exception 'There is already a deal called %', v_name;
  end if;
  if p_prices is null or jsonb_typeof(p_prices) <> 'object' or p_prices = '{}'::jsonb then
    raise exception 'Give the deal a price';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) < 2 then
    raise exception 'A deal has at least two things in it';
  end if;
  if jsonb_array_length(p_slots) > 8 then raise exception 'A deal has at most eight things in it'; end if;
  if (p_starts is null) <> (p_ends is null) or (p_starts is not null and p_starts = p_ends) then
    raise exception 'Give the hours it is on, from and until, or neither';
  end if;
  if p_days is not null and (cardinality(p_days) = 0 or not p_days <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception 'Choose the days it is on';
  end if;
  if p_id is null then
    insert into deal (business_id, name, name_ar, name_ckb, is_active, days, starts, ends, created_by)
    values (v_business, v_name, nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''), coalesce(p_active, true),
            p_days, p_starts, p_ends, (current_member()).id)
    returning id into v_id;
  else
    update deal set name = v_name, name_ar = nullif(trim(p_name_ar), ''), name_ckb = nullif(trim(p_name_ckb), ''),
                    is_active = coalesce(p_active, true), days = p_days, starts = p_starts, ends = p_ends,
                    updated_at = now()
     where id = p_id and business_id = v_business
    returning id into v_id;
    if v_id is null then raise exception 'Deal not found'; end if;
    delete from deal_price where deal_id = v_id;
    delete from deal_slot where deal_id = v_id;
  end if;
  for v_ch, v_price in select key, (value #>> '{}')::numeric from jsonb_each(p_prices) loop
    if v_ch not in (select unnest(enum_range(null::sales_channel))::text) then
      raise exception 'Unknown channel %', v_ch;
    end if;
    if is_platform_channel(v_ch::sales_channel) then
      raise exception 'A delivery platform sets its own offers';
    end if;
    if v_price is null or v_price < 0 then raise exception 'Enter a price'; end if;
    insert into deal_price (deal_id, channel, price) values (v_id, v_ch::sales_channel, v_price);
  end loop;
  for s in select * from jsonb_array_elements(p_slots) loop
    v_pos := v_pos + 1;
    if nullif(s ->> 'category_id', '') is not null
       and not exists (select 1 from product_category where id = (s ->> 'category_id')::uuid
                         and business_id = v_business) then
      raise exception 'Unknown category';
    end if;
    insert into deal_slot (deal_id, position, label, category_id)
    values (v_id, v_pos, nullif(trim(s ->> 'label'), ''), nullif(s ->> 'category_id', '')::uuid)
    returning id into v_slot;
    insert into deal_slot_variant (slot_id, product_variant_id)
    select v_slot, x::uuid from jsonb_array_elements_text(coalesce(s -> 'variants', '[]'::jsonb)) x
     where exists (select 1 from product_variant pv where pv.id = x::uuid and pv.business_id = v_business)
    on conflict do nothing;
    select count(*) into v_n from deal_slot_sizes(v_slot);
    if v_n = 0 then raise exception 'Each thing in a deal is a product or a category with products on sale'; end if;
  end loop;
  perform audit_event(v_business, case when p_id is null then 'deal.add' else 'deal.change' end, 'deal', v_id::text,
    null, null, v_req);
  perform idem_finish(v_business, p_idempotency_key, 'save_deal', v_req, to_jsonb(v_id));
  return v_id;
end $$;

-- The deals, for the menu's screen: each with its prices, places and sizes.
create or replace function deals_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create', 'recipe.edit', 'cost.view');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'name', d.name, 'name_ar', d.name_ar, 'name_ckb', d.name_ckb, 'is_active', d.is_active,
             'days', d.days, 'starts', to_char(d.starts, 'HH24:MI'), 'ends', to_char(d.ends, 'HH24:MI'),
             'on_now', deal_on(d, now()),
             'prices', coalesce((select jsonb_object_agg(dp.channel, dp.price) from deal_price dp
                                  where dp.deal_id = d.id), '{}'::jsonb),
             'slots', coalesce((select jsonb_agg(jsonb_build_object(
                                         'label', s.label, 'category_id', s.category_id,
                                         'variants', coalesce((select jsonb_agg(v.product_variant_id)
                                                                 from deal_slot_variant v where v.slot_id = s.id),
                                                              '[]'::jsonb),
                                         'sizes', coalesce((select jsonb_agg(z) from deal_slot_sizes(s.id) z),
                                                           '[]'::jsonb))
                                       order by s.position)
                                  from deal_slot s where s.deal_id = d.id), '[]'::jsonb),
             'sold', (select count(*) from sale_deal sd join sales_order so on so.id = sd.sales_order_id
                       where sd.deal_id = d.id and so.status <> 'voided'))
           order by d.is_active desc, d.name)
      from deal d where d.business_id = v_business), '[]'::jsonb);
end $$;

-- The deals on now, for the till: those with a price on some channel.
create or replace function pos_deals(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create');
begin
  return coalesce((
    select jsonb_agg(x order by x ->> 'name')
      from jsonb_array_elements(deals_list()) x
     where (x ->> 'on_now')::boolean and x -> 'prices' <> '{}'::jsonb), '[]'::jsonb);
end $$;

-- A deal's lines, as they fill its places: one of each, each place a size
-- it takes; the places with fewest sizes filled first.
create or replace function deal_fills(p_deal uuid, p_variants uuid[], p_qtys numeric[]) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s record; v_free boolean[]; i int; v_done boolean;
begin
  if cardinality(p_variants) <> (select count(*) from deal_slot where deal_id = p_deal) then return false; end if;
  if exists (select 1 from unnest(p_qtys) q where q <> 1) then return false; end if;
  v_free := array_fill(true, array[cardinality(p_variants)]);
  for s in select ds.id, (select count(*) from deal_slot_sizes(ds.id)) n
             from deal_slot ds where ds.deal_id = p_deal order by n, ds.position loop
    v_done := false;
    for i in 1 .. cardinality(p_variants) loop
      if v_free[i] and p_variants[i] in (select deal_slot_sizes(s.id)) then
        v_free[i] := false; v_done := true; exit;
      end if;
    end loop;
    if not v_done then return false; end if;
  end loop;
  return true;
end $$;

-- What each deal sold between two days (cost.view): how many, at what, and
-- what it gave away; voided sales left out.
create or replace function report_deals(p_from date, p_to date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('deal_id', x.deal_id, 'name', x.name, 'sold', x.sold,
                                        'full', x.full_amount, 'paid', x.deal_amount, 'given', x.given)
                     order by x.sold desc, x.name)
      from (select sd.deal_id, max(d.name) as name, count(*) as sold, sum(sd.full_amount) as full_amount,
                   sum(sd.deal_amount) as deal_amount, sum(sd.given) as given
              from sale_deal sd
              join sales_order so on so.id = sd.sales_order_id
              join deal d on d.id = sd.deal_id
             where sd.business_id = v_business and so.status <> 'voided'
               and business_local_date(v_business, so.placed_at) between p_from and p_to
               and (p_location is null or so.location_id = p_location)
             group by sd.deal_id) x), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 4. A deal sold: 0076's post_sale, its deals' lines priced as one
-- -----------------------------------------------------------------------------
-- As 0076's, and: lines carrying a deal ({"deal_id", "key"}) are its places;
-- what the deal gives away is their discount (with the discount given
-- besides, on 4100), each deal kept in sale_deal and named on its lines. A
-- discount given besides is judged on what is left after the deals.
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric,
  p_trust_line_prices boolean default false, p_discount jsonb default null, p_turn_no int default null,
  p_stock_approval uuid default null, p_tenders jsonb default null, p_expected_net numeric default null,
  p_customer jsonb default null)
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
  v_pay jsonb; v_paid numeric;
  -- When it was sold: now, or a sale made offline earlier today (0073).
  v_at timestamptz := coalesce(nullif(current_setting('sixties.sale_placed_at', true), '')::timestamptz, now());
  -- Deals (0089): what they gave away, the discount given besides, and each line's deal.
  v_deal numeric := 0; v_manual numeric := 0; v_after numeric; dk text; v_idx int[]; v_deal_row deal;
  v_dprice numeric; v_dgross numeric[]; v_dnets numeric[]; v_daddons numeric; v_given numeric;
  v_sale_deal uuid; v_line_deal uuid[];
begin
  if p_idempotency_key is null then
    raise exception 'A sale needs its idempotency key';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  v_pay := sale_payments(v_business, p_channel, p_tender, p_tenders);

  -- Replay: the same key returns the sale it already recorded.
  select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
    from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'turn_no', v_existing.turn_no, 'payments', order_payments(v_existing.id))
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  -- A way to pay taken out of use takes no new sale (0069).
  perform sale_methods_in_use(v_business, v_pay);
  if (p_discount_percent is not null or p_discount_amount is not null) and is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets its own discounts; none is given at the till';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, v_at);

  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
                           gross_amount, discount_amount, net_amount, cogs_amount, cashier_id,
                           customer_id, customer_address_id, delivery_address, placed_at, sold_offline_at,
                           device_id)
  values (v_business, v_location, p_channel, 'open', p_idempotency_key, 0, 0, 0, 0, v_me,
          (p_customer ->> 'customer_id')::uuid, (p_customer ->> 'address_id')::uuid, p_customer ->> 'address', v_at,
          nullif(current_setting('sixties.sale_sold_offline_at', true), '')::timestamptz,
          nullif(current_setting('sixties.sale_device', true), ''))
  on conflict (business_id, idempotency_key) do nothing
  returning id into v_order;
  if v_order is null then
    -- A concurrent request with this key won the race; return its sale.
    select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
      from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'turn_no', v_existing.turn_no, 'payments', order_payments(v_existing.id))
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

  -- Deals (0089): each one's lines at their own full price, what the deal
  -- gives away shared over them as their discount; a deal is one of each of
  -- its places, on now, at its price on the channel, its add-ons on top.
  v_nets := v_gross_lines;
  v_line_deal := array_fill(null::uuid, array[n]);
  for dk in select distinct e.x -> 'deal' ->> 'key' from jsonb_array_elements(p_lines) e(x)
             where jsonb_typeof(e.x -> 'deal') = 'object' loop
    if dk is null or length(dk) > 64 then raise exception 'A deal on the bill has no key'; end if;
    select array_agg(o::int order by o) into v_idx
      from jsonb_array_elements(p_lines) with ordinality e(x, o) where e.x -> 'deal' ->> 'key' = dk;
    if (select count(distinct p_lines -> (ix - 1) -> 'deal' ->> 'deal_id') from unnest(v_idx) ix) <> 1 then
      raise exception 'A deal on the bill is mixed with another';
    end if;
    select * into v_deal_row from deal
     where id = (p_lines -> (v_idx[1] - 1) -> 'deal' ->> 'deal_id')::uuid and business_id = v_business;
    if not found or not deal_on(v_deal_row, v_at) then
      raise exception 'That deal is not on now';
    end if;
    select price into v_dprice from deal_price where deal_id = v_deal_row.id and channel = p_channel;
    if v_dprice is null or is_platform_channel(p_channel) then
      raise exception 'That deal is not sold on this channel';
    end if;
    if not deal_fills(v_deal_row.id, (select array_agg(v_variants[ix] order by ix) from unnest(v_idx) ix),
                      (select array_agg(v_qtys[ix] order by ix) from unnest(v_idx) ix)) then
      raise exception 'A deal is one of each of the things in it';
    end if;
    select array_agg(v_gross_lines[ix] order by ix) into v_dgross from unnest(v_idx) ix;
    select coalesce(sum(money_round(v_business, v_qtys[ix] * coalesce(
             (select sum((x ->> 'price')::numeric * (x ->> 'qty')::numeric) from jsonb_array_elements(v_mods[ix]) x), 0))), 0)
      into v_daddons from unnest(v_idx) ix;
    v_given := greatest((select sum(g) from unnest(v_dgross) g) - (v_dprice + v_daddons), 0);
    if v_given > 0 then
      v_dnets := allocate_landed(v_business, v_dgross, -v_given);
      for j in 1 .. cardinality(v_idx) loop
        v_nets[v_idx[j]] := v_dnets[j];
      end loop;
    end if;
    v_deal := v_deal + v_given;
    insert into sale_deal (business_id, sales_order_id, deal_id, deal_key, name, full_amount, deal_amount, given)
    values (v_business, v_order, v_deal_row.id, dk, v_deal_row.name, (select sum(g) from unnest(v_dgross) g),
            (select sum(g) from unnest(v_dgross) g) - v_given, v_given)
    returning id into v_sale_deal;
    for j in 1 .. cardinality(v_idx) loop
      v_line_deal[v_idx[j]] := v_sale_deal;
    end loop;
  end loop;

  -- Each line's share of the discount given besides, in proportion to what
  -- is left of it, adding up to the discount exactly (the rounding method
  -- receipts use for landed costs).
  v_after := v_gross - v_deal;
  v_manual := sale_discount(v_business, v_after, p_discount_percent, p_discount_amount);
  if v_manual > 0 then
    v_nets := allocate_landed(v_business, v_nets, -v_manual);
    -- Who gave it, why, and who approved it (0028).
    if coalesce((p_discount ->> 'checked')::boolean, false) then
      v_disc_by := (p_discount ->> 'by')::uuid;
      v_disc_approved := (p_discount ->> 'approved_by')::uuid;
      v_disc_reason := p_discount ->> 'reason';
    else
      v_disc_reason := reason_text('discount', p_discount ->> 'reason', p_discount ->> 'note');
      v_disc_by := v_me;
      v_disc_approved := discount_approver(v_business, v_after, p_discount_percent, p_discount_amount,
                                           (p_discount ->> 'approval')::uuid, v_order::text);
    end if;
  end if;
  v_discount := v_deal + v_manual;
  v_net := v_gross - v_discount;

  -- The total the till showed (0025), then the payments: together they come to
  -- the net exactly (0042). The old single tender pays all of it.
  perform assert_sale_total(jsonb_build_object('net', v_net), p_expected_net);
  select jsonb_agg(case when jsonb_typeof(x -> 'amount') = 'null' then x || jsonb_build_object('amount', v_net)
                        else x end order by o)
    into v_pay from jsonb_array_elements(v_pay) with ordinality e(x, o);
  select sum((x ->> 'amount')::numeric) into v_paid from jsonb_array_elements(v_pay) x;
  if v_paid <> v_net then
    raise exception 'The payments come to %, not the % to pay', trim_scale(v_paid), trim_scale(v_net);
  end if;
  -- Dollars at the rate now, worth at least what they pay (0043).
  v_pay := sale_dollars(v_business, v_pay);

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
                                  cogs_amount, sale_deal_id)
    values (v_line, v_order, v_variants[i], v_qtys[i], v_prices[i], v_gross_lines[i] - v_nets[i], v_nets[i],
            v_line_cogs, v_line_deal[i]);
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

  -- Each payment in its order; a cash one is also the drawer's, a payment in
  -- dollars the dollars' (trg_cash_from_tender); one by a way to pay says
  -- which, with the reference shown (0069).
  insert into sales_tender (sales_order_id, tender_type, amount, received, position, currency, foreign_amount, rate,
                            payment_method_id, reference, pre_order_id, on_account_customer)
  select v_order, (x ->> 'type')::tender_type, (x ->> 'amount')::numeric, (x ->> 'received')::numeric, o,
         coalesce(x ->> 'currency', 'IQD'), (x ->> 'usd')::numeric, (x ->> 'rate')::numeric,
         (x ->> 'method')::uuid, x ->> 'reference', (x ->> 'pre_order')::uuid, (x ->> 'on_account')::uuid
    from jsonb_array_elements(v_pay) with ordinality e(x, o)
   order by o;

  -- Its turn number (0034): the bill's own, or the next of the day. Taken in
  -- the sale's own transaction, so a sale refused takes none.
  v_turn := coalesce(p_turn_no, take_turn_no(v_business, v_today, v_location));
  update sales_order
     set gross_amount = v_gross, discount_amount = v_discount, net_amount = v_net, cogs_amount = v_cogs,
         discount_percent = case when v_manual > 0 then p_discount_percent end,
         discount_by = v_disc_by, discount_approved_by = v_disc_approved, discount_reason = v_disc_reason,
         status = 'completed', turn_no = v_turn
   where id = v_order;

  -- Each payment's account debited with what it paid (one line per account),
  -- revenue at the full price, the discount on its own line (none posts when
  -- it is zero). Dollars are debited to 1001 at their value, and their change
  -- in dinars leaves 1000 (0043). A way to pay's is debited to its own
  -- account (0069).
  v_journal := post_journal(v_business, v_at, 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
    coalesce((select jsonb_agg(signed_line(a.code, a.amount) order by a.pos)
                from (select p.code, sum(p.amount) as amount, min(p.pos) as pos
                        from jsonb_array_elements(v_pay) with ordinality e(x, o)
                        cross join lateral (
                          select coalesce(x ->> 'account', tender_account((x ->> 'type')::tender_type)) as code,
                                 case when x ->> 'currency' = 'USD'
                                      then (x ->> 'amount')::numeric - (x ->> 'received')::numeric
                                      else (x ->> 'amount')::numeric end as amount, o as pos
                          union all
                          select '1001', (x ->> 'received')::numeric, o where x ->> 'currency' = 'USD') p
                       group by p.code) a), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('code', '4100', 'debit', v_discount),
      jsonb_build_object('code', '4000', 'credit', v_gross),
      jsonb_build_object('code', '5000', 'debit', v_cogs),
      jsonb_build_object('code', '1200', 'credit', v_cogs)));

  if v_manual > 0 then
    perform audit_event(v_business, 'sale.discount', 'sales_order', v_order::text, v_disc_reason, null,
      jsonb_build_object('gross', v_after, 'discount', v_manual, 'percent', p_discount_percent,
                         'amount', p_discount_amount, 'given_by', v_disc_by, 'approved_by', v_disc_approved));
  end if;

  return jsonb_build_object('order_id', v_order, 'gross', v_gross, 'discount', v_discount, 'net', v_net,
    'deal_discount', v_deal,
    'journal_no', (select journal_no from journal_entry where id = v_journal), 'replayed', false,
    'turn_no', v_turn, 'payments', order_payments(v_order))
    || sale_cost_view(v_cogs);
end $$;

revoke execute on function in_window(uuid, smallint[], time, time, timestamptz),
  time_price_now(uuid, sales_channel, uuid, timestamptz), trg_tab_line_hour_price(),
  section_shown(menu_section, timestamptz), trg_sale_deal_frozen(), deal_on(deal, timestamptz),
  deal_slot_sizes(uuid), deal_fills(uuid, uuid[], numeric[])
  from public, anon, authenticated;
revoke execute on function price_on(uuid, sales_channel, uuid, date) from public, anon, authenticated;
revoke execute on function set_time_price(uuid, numeric, time, time, smallint[], sales_channel, uuid, uuid),
  stop_time_price(uuid), time_prices(), set_section_hours(uuid, time, time, smallint[]),
  pos_catalogue(uuid), pos_menu_next_change(uuid),
  save_deal(uuid, text, jsonb, jsonb, text, text, smallint[], time, time, boolean, uuid),
  deals_list(), pos_deals(uuid), report_deals(date, date, uuid)
  from public, anon;
grant execute on function set_time_price(uuid, numeric, time, time, smallint[], sales_channel, uuid, uuid),
  stop_time_price(uuid), time_prices(), set_section_hours(uuid, time, time, smallint[]),
  pos_catalogue(uuid), pos_menu_next_change(uuid),
  save_deal(uuid, text, jsonb, jsonb, text, text, smallint[], time, time, boolean, uuid),
  deals_list(), pos_deals(uuid), report_deals(date, date, uuid)
  to authenticated;
