-- 0110: the restaurant parts (plan 10, step 3). Each behind its own part,
-- on by default for a restaurant only (a café turns them on in Settings →
-- Plan and parts); off, nothing changes.
--
--   * Kitchen screens ("kitchen"): stations (grill, cold kitchen, bar), each
--     category sent to one; what a bill or a sale adds goes to each station's
--     screen as a ticket, and what is taken off as a line taken off. The
--     station marks a ticket ready, then done.
--   * Courses and seats ("courses"): each line of a bill may say its course
--     (1 starter, 2 main, 3 dessert…) and its seat; a course is sent to the
--     kitchen when it is time, the rest held.
--   * Tables: a bill moved to another table (save_tab already could), and two
--     bills joined into one.
--   * Reservations and the waiting list ("reservations"): a name, a phone, how
--     many, when (none: waiting now), a table when seated; booked, seated,
--     cancelled or no-show.
--   * The menu engineering report is the Menu matrix (Reports), already.
--
-- Nothing recorded changes.

-- -----------------------------------------------------------------------------
-- 0. The parts
-- -----------------------------------------------------------------------------
-- 0108's catalogue, with the restaurant's parts (off but for a restaurant).
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
                     "plans": ["complete", "business"], "on_for": ["restaurant"]}
  }'::jsonb
$$;

-- A part asked for by a function of its own: refused, saying so, while it is off.
create or replace function require_part(p_business uuid, p_part text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not part_on(p_business, p_part) then
    raise exception '%', format('That part is off for this business: %s', part_catalogue() -> p_part ->> 'label')
      using errcode = '42501';
  end if;
end $$;

-- 0109's my_profile: each part that is on too ("on:kitchen"), so a screen
-- knows a part the database has, not only one it lacks (0110).
alter function my_profile() rename to my_profile_0109;
create or replace function my_profile() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb := my_profile_0109();
begin
  if v is null then return null; end if;
  return v || jsonb_build_object('permissions', (v -> 'permissions') || coalesce((
    select jsonb_agg('on:' || k order by k) from jsonb_object_keys(part_catalogue()) k
     where part_on((v ->> 'business_id')::uuid, k)), '[]'::jsonb));
end $$;
grant execute on function my_profile() to authenticated;
revoke execute on function my_profile_0109() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1. Stations, and which category goes to which
-- -----------------------------------------------------------------------------
create table if not exists kitchen_station (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 40),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists kitchen_station_name on kitchen_station (business_id, lower(name));
alter table kitchen_station enable row level security;
alter table kitchen_station force row level security;

create table if not exists category_station (
  business_id uuid not null references business(id) on delete cascade,
  category_id uuid primary key references product_category(id) on delete cascade,
  station_id  uuid not null references kitchen_station(id) on delete cascade
);
alter table category_station enable row level security;
alter table category_station force row level security;

-- A station, new or renamed, or put away.
create or replace function save_kitchen_station(p_id uuid, p_name text, p_active boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_id uuid := p_id;
begin
  perform require_part(v_business, 'kitchen');
  if v_name = '' or length(v_name) > 40 then raise exception 'A station has a name of up to 40 letters'; end if;
  if exists (select 1 from kitchen_station where business_id = v_business and lower(name) = lower(v_name)
                and id is distinct from p_id) then
    raise exception '%', format('There is a station called %s already', v_name);
  end if;
  if p_id is null then
    insert into kitchen_station (business_id, name, sort_order)
    values (v_business, v_name, coalesce((select max(sort_order) + 1 from kitchen_station where business_id = v_business), 1))
    returning id into v_id;
  else
    update kitchen_station set name = v_name, is_active = coalesce(p_active, true)
     where id = p_id and business_id = v_business;
    if not found then raise exception 'That station is not one of the café''s'; end if;
  end if;
  perform audit_event(v_business, 'kitchen.station', 'kitchen_station', v_id::text, null, null,
    jsonb_build_object('name', v_name, 'active', coalesce(p_active, true)));
  return kitchen_setup();
end $$;

-- A category's station (none: the kitchen's own screen, unsorted).
create or replace function set_category_station(p_category uuid, p_station uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage');
begin
  perform require_part(v_business, 'kitchen');
  if not exists (select 1 from product_category where id = p_category and business_id = v_business) then
    raise exception 'Choose one of the café''s categories';
  end if;
  if p_station is null then
    delete from category_station where category_id = p_category;
  else
    if not exists (select 1 from kitchen_station where id = p_station and business_id = v_business) then
      raise exception 'That station is not one of the café''s';
    end if;
    insert into category_station (business_id, category_id, station_id) values (v_business, p_category, p_station)
    on conflict (category_id) do update set station_id = excluded.station_id;
  end if;
  perform audit_event(v_business, 'kitchen.category', 'product_category', p_category::text, null, null,
    jsonb_build_object('station', p_station));
  return kitchen_setup();
end $$;

create or replace function kitchen_setup() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'stations', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'active', s.is_active)
                            order by s.sort_order, s.name)
                            from kitchen_station s where s.business_id = current_business_id()), '[]'::jsonb),
    'categories', coalesce((select jsonb_object_agg(c.category_id, c.station_id)
                              from category_station c where c.business_id = current_business_id()), '{}'::jsonb))
   where current_has_permission('sale.create') or current_has_permission('settings.manage')
$$;

-- -----------------------------------------------------------------------------
-- 2. Courses and seats on a bill's lines
-- -----------------------------------------------------------------------------
alter table pos_tab_line add column if not exists course smallint;
alter table pos_tab_line add column if not exists seat smallint;
alter table pos_tab_line drop constraint if exists pos_tab_line_course_seat;
alter table pos_tab_line add constraint pos_tab_line_course_seat
  check ((course is null or course between 1 and 5) and (seat is null or seat between 1 and 50));

-- 0041's save_tab__run: each line's course and seat, as the till sent them (0110).
alter function save_tab__run(uuid, int, jsonb, text, uuid, numeric, numeric, text, text, uuid)
  rename to save_tab__run_0109;
create or replace function save_tab__run(p_tab uuid, p_version int, p_lines jsonb, p_label text default null,
                                         p_table uuid default null, p_discount_percent numeric default null,
                                         p_discount_amount numeric default null, p_discount_reason text default null,
                                         p_discount_note text default null, p_approval uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  v := save_tab__run_0109(p_tab, p_version, p_lines, p_label, p_table, p_discount_percent, p_discount_amount,
                          p_discount_reason, p_discount_note, p_approval);
  if jsonb_typeof(p_lines) = 'array' and exists (
       select 1 from jsonb_array_elements(p_lines) l where l ? 'course' or l ? 'seat') then
    update pos_tab_line tl
       set course = case when nullif(p_lines -> (tl.position - 1) ->> 'course', '') ~ '^[1-5]$'
                         then (p_lines -> (tl.position - 1) ->> 'course')::smallint end,
           seat = case when nullif(p_lines -> (tl.position - 1) ->> 'seat', '') ~ '^([1-9]|[1-4][0-9]|50)$'
                       then (p_lines -> (tl.position - 1) ->> 'seat')::smallint end
     where tl.tab_id = p_tab;
  end if;
  return v;
end $$;

-- 0055's pos_open_bills: each line with its course and seat (0110).
alter function pos_open_bills(uuid) rename to pos_open_bills_0109;
create or replace function pos_open_bills(p_location uuid default null)
returns table (tab_id uuid, version integer, table_id uuid, table_name text, label text, channel sales_channel,
               business_day date, opened_at timestamptz, opened_by text, bill_printed_at timestamptz,
               bill_print_count integer, lines jsonb, total numeric, subtotal numeric, discount numeric,
               discount_percent numeric, discount_amount numeric, discount_reason text, discount_by text,
               discount_approved_by text, turn_no integer, customer_id uuid, customer_name text,
               customer_phone text, customer_points integer, customer_address_id uuid, delivery_address text)
language sql stable security definer set search_path = public as $$
  select r.tab_id, r.version, r.table_id, r.table_name, r.label, r.channel, r.business_day, r.opened_at, r.opened_by,
         r.bill_printed_at, r.bill_print_count,
         coalesce((select jsonb_agg(x || jsonb_build_object('course', tl.course, 'seat', tl.seat) order by e.ord)
                     from jsonb_array_elements(r.lines) with ordinality e(x, ord)
                     left join pos_tab_line tl on tl.id = nullif(x ->> 'line_id', '')::uuid), r.lines),
         r.total, r.subtotal, r.discount, r.discount_percent, r.discount_amount, r.discount_reason, r.discount_by,
         r.discount_approved_by, r.turn_no, r.customer_id, r.customer_name, r.customer_phone, r.customer_points,
         r.customer_address_id, r.delivery_address
    from pos_open_bills_0109(p_location) r
$$;
grant execute on function pos_open_bills(uuid) to authenticated;
revoke execute on function pos_open_bills_0109(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Kitchen tickets
-- -----------------------------------------------------------------------------
create table if not exists kitchen_ticket (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business(id) on delete cascade,
  location_id    uuid references location(id),
  station_id     uuid references kitchen_station(id) on delete set null,
  tab_id         uuid references pos_tab(id) on delete set null,
  sales_order_id uuid references sales_order(id) on delete set null,
  title          text not null,
  turn_no        int,
  channel        sales_channel,
  course         smallint,
  status         text not null default 'new' check (status in ('new', 'ready', 'done')),
  created_by     uuid references app_user(id),
  created_at     timestamptz not null default now(),
  ready_at       timestamptz,
  done_at        timestamptz
);
create index if not exists kitchen_ticket_open on kitchen_ticket (business_id, status, created_at);
create index if not exists kitchen_ticket_tab on kitchen_ticket (tab_id);
alter table kitchen_ticket enable row level security;
alter table kitchen_ticket force row level security;

create table if not exists kitchen_ticket_line (
  id                 uuid primary key default gen_random_uuid(),
  ticket_id          uuid not null references kitchen_ticket(id) on delete cascade,
  product_variant_id uuid not null references product_variant(id),
  name               text not null,
  qty                numeric not null check (qty <> 0),
  note               text,
  addons             text,
  course             smallint,
  seat               smallint,
  line_key           text not null
);
create index if not exists kitchen_ticket_line_ticket on kitchen_ticket_line (ticket_id);
alter table kitchen_ticket_line enable row level security;
alter table kitchen_ticket_line force row level security;

-- What a set of lines comes to, by what the kitchen makes (the size, its
-- add-ons, the note, the course and the seat) and the station it goes to.
create or replace function kitchen_lines_of_tab(p_tab uuid)
returns table (line_key text, variant_id uuid, name text, qty numeric, note text, addons text, course smallint,
               seat smallint, station_id uuid)
language sql stable security definer set search_path = public as $$
  select x.k, x.variant, x.name, sum(x.qty), x.note, x.addons, x.course, x.seat, x.station
    from (
      select concat_ws('|', tl.product_variant_id, coalesce(tl.note, ''), coalesce(a.txt, ''),
                       coalesce(tl.course::text, ''), coalesce(tl.seat::text, '')) as k,
             tl.product_variant_id as variant,
             p.name || case when v.name is not null and v.name <> '' and v.name <> p.name then ' · ' || v.name else '' end as name,
             tl.qty, tl.note, a.txt as addons, tl.course, tl.seat, cs.station_id as station
        from pos_tab_line tl
        join product_variant v on v.id = tl.product_variant_id
        join product p on p.id = v.product_id
        left join category_station cs on cs.category_id = p.category_id
        left join lateral (
          select string_agg(m.name || case when lm.qty > 1 then ' ×' || lm.qty else '' end, ', '
                            order by lm.position) as txt
            from pos_tab_line_modifier lm join modifier m on m.id = lm.modifier_id
           where lm.tab_line_id = tl.id) a on true
       where tl.tab_id = p_tab
    ) x
   group by x.k, x.variant, x.name, x.note, x.addons, x.course, x.seat, x.station
$$;

-- (sale.create) What a bill added, or took off, since the kitchen last had it:
-- one ticket for each station. A course given: only its lines, and those with
-- no course; the rest wait. Returns how many tickets were sent.
create or replace function send_tab_to_kitchen(p_tab uuid, p_course int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  t pos_tab; st record; v_ticket uuid; n int := 0; v_title text;
begin
  perform require_part(v_business, 'kitchen');
  select * into t from pos_tab where id = p_tab and business_id = v_business;
  if t.id is null then raise exception 'Bill not found'; end if;
  if t.status <> 'open' then raise exception 'This bill is closed'; end if;
  if p_course is not null and (p_course < 1 or p_course > 5) then raise exception 'A course is from 1 to 5'; end if;
  v_title := coalesce((select name from dining_table where id = t.table_id), nullif(t.label, ''), 'Bill');
  create temp table if not exists kt_diff (line_key text, variant_id uuid, name text, qty numeric, note text,
                                           addons text, course smallint, seat smallint, station_id uuid)
    on commit drop;
  delete from kt_diff;
  insert into kt_diff
  select coalesce(now_.line_key, sent.line_key), coalesce(now_.variant_id, sent.variant_id),
         coalesce(now_.name, sent.name), coalesce(now_.qty, 0) - coalesce(sent.qty, 0),
         coalesce(now_.note, sent.note), coalesce(now_.addons, sent.addons), coalesce(now_.course, sent.course),
         coalesce(now_.seat, sent.seat), coalesce(now_.station_id, sent.station_id)
    from kitchen_lines_of_tab(p_tab) now_
    full join (
      select l.line_key, min(l.product_variant_id::text)::uuid as variant_id, min(l.name) as name, sum(l.qty) as qty,
             min(l.note) as note, min(l.addons) as addons, min(l.course) as course, min(l.seat) as seat,
             min(k.station_id::text)::uuid as station_id
        from kitchen_ticket_line l join kitchen_ticket k on k.id = l.ticket_id
       where k.tab_id = p_tab group by l.line_key) sent on sent.line_key = now_.line_key;
  delete from kt_diff where qty = 0
     or (p_course is not null and course is not null and course <> p_course);
  for st in select distinct station_id from kt_diff loop
    insert into kitchen_ticket (business_id, location_id, station_id, tab_id, title, turn_no, channel, course, created_by)
    values (v_business, t.location_id, st.station_id, p_tab, v_title, t.turn_no, t.channel, p_course,
            (current_member()).id)
    returning id into v_ticket;
    insert into kitchen_ticket_line (ticket_id, product_variant_id, name, qty, note, addons, course, seat, line_key)
    select v_ticket, d.variant_id, d.name, d.qty, d.note, d.addons, d.course, d.seat, d.line_key
      from kt_diff d where d.station_id is not distinct from st.station_id;
    n := n + 1;
  end loop;
  return jsonb_build_object('tickets', n,
    'held', (select count(*) from kitchen_lines_of_tab(p_tab) l
              where p_course is not null and l.course is not null and l.course <> p_course));
end $$;

-- (sale.create) A sale at the counter, to the kitchen whole: a ticket for each station.
create or replace function send_sale_to_kitchen(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  o sales_order; st record; v_ticket uuid; n int := 0;
begin
  perform require_part(v_business, 'kitchen');
  select * into o from sales_order where id = p_order and business_id = v_business;
  if o.id is null then raise exception 'Sale not found'; end if;
  if exists (select 1 from kitchen_ticket where sales_order_id = p_order) then
    return jsonb_build_object('tickets', 0);
  end if;
  for st in select distinct cs.station_id
              from sales_order_line l join product_variant v on v.id = l.product_variant_id
              join product p on p.id = v.product_id left join category_station cs on cs.category_id = p.category_id
             where l.sales_order_id = p_order loop
    insert into kitchen_ticket (business_id, location_id, station_id, sales_order_id, title, turn_no, channel, created_by)
    values (v_business, o.location_id, st.station_id, p_order,
            coalesce('#' || o.turn_no::text, 'Sale ' || left(p_order::text, 8)), o.turn_no, o.channel,
            (current_member()).id)
    returning id into v_ticket;
    insert into kitchen_ticket_line (ticket_id, product_variant_id, name, qty, addons, line_key)
    select v_ticket, l.product_variant_id,
           p.name || case when v.name is not null and v.name <> '' and v.name <> p.name then ' · ' || v.name else '' end,
           l.quantity,
           (select string_agg(m.name || case when lm.qty > 1 then ' ×' || lm.qty else '' end, ', ')
              from sales_order_line_modifier lm join modifier m on m.id = lm.modifier_id
             where lm.sales_order_line_id = l.id),
           l.id::text
      from sales_order_line l join product_variant v on v.id = l.product_variant_id
      join product p on p.id = v.product_id left join category_station cs on cs.category_id = p.category_id
     where l.sales_order_id = p_order and cs.station_id is not distinct from st.station_id;
    n := n + 1;
  end loop;
  return jsonb_build_object('tickets', n);
end $$;

-- (sale.create) A station's screen: its tickets not yet done, the oldest first,
-- and those done in the last ten minutes.
create or replace function kitchen_tickets(p_station uuid default null, p_all boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create');
begin
  perform require_part(v_business, 'kitchen');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', k.id, 'title', k.title, 'turn_no', k.turn_no, 'channel', k.channel, 'course', k.course,
      'status', k.status, 'at', k.created_at, 'ready_at', k.ready_at,
      'station', (select name from kitchen_station where id = k.station_id),
      'lines', (select jsonb_agg(jsonb_build_object('name', l.name, 'qty', l.qty, 'note', l.note,
                                                    'addons', l.addons, 'seat', l.seat) order by l.name)
                  from kitchen_ticket_line l where l.ticket_id = k.id))
    order by k.created_at)
      from kitchen_ticket k
     where k.business_id = v_business
       and (p_all or k.station_id is not distinct from p_station)
       and (k.status <> 'done' or k.done_at > now() - interval '10 minutes')
       and k.created_at > now() - interval '1 day'), '[]'::jsonb);
end $$;

-- (sale.create) A ticket ready, then done; or back to new by mistake.
create or replace function set_ticket_status(p_ticket uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create');
begin
  perform require_part(v_business, 'kitchen');
  if coalesce(p_status, '') not in ('new', 'ready', 'done') then raise exception 'Choose new, ready or done'; end if;
  update kitchen_ticket
     set status = p_status,
         ready_at = case when p_status = 'ready' then coalesce(ready_at, now()) when p_status = 'new' then null else ready_at end,
         done_at = case when p_status = 'done' then now() end
   where id = p_ticket and business_id = v_business;
  if not found then raise exception 'That ticket is not found'; end if;
  return jsonb_build_object('id', p_ticket, 'status', p_status);
end $$;

-- -----------------------------------------------------------------------------
-- 4. Two bills joined into one
-- -----------------------------------------------------------------------------
-- (sale.create) The second bill's lines added to the first, the second
-- cancelled as moved. Neither may have been printed or discounted.
create or replace function join_tabs(p_into uuid, p_into_version int, p_from uuid, p_from_version int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  a pos_tab; b pos_tab; v_lines jsonb; v jsonb;
begin
  if p_into = p_from then raise exception 'Choose two different bills'; end if;
  select * into a from pos_tab where id = p_into and business_id = v_business for update;
  select * into b from pos_tab where id = p_from and business_id = v_business for update;
  if a.id is null or b.id is null then raise exception 'Bill not found'; end if;
  if a.status <> 'open' or b.status <> 'open' then raise exception 'This bill is closed'; end if;
  if a.version <> p_into_version or b.version <> p_from_version then
    raise exception 'This bill was changed on another till: open it again';
  end if;
  if a.bill_printed_at is not null or b.bill_printed_at is not null then
    raise exception 'A printed bill is not joined: the customer has its total';
  end if;
  if coalesce(a.discount_amount, 0) > 0 or a.discount_percent is not null
     or coalesce(b.discount_amount, 0) > 0 or b.discount_percent is not null then
    raise exception 'Take the discount off first, then join the bills';
  end if;
  -- Both bills' lines, as the till sends them, the first's first.
  select coalesce(jsonb_agg(jsonb_build_object(
           'variant_id', tl.product_variant_id, 'qty', tl.qty, 'note', tl.note,
           'course', tl.course, 'seat', tl.seat,
           'modifiers', coalesce((select jsonb_agg(jsonb_build_object('modifier_id', lm.modifier_id, 'qty', lm.qty)
                                                   order by lm.position)
                                    from pos_tab_line_modifier lm where lm.tab_line_id = tl.id), '[]'::jsonb))
         order by (tl.tab_id = p_from), tl.position), '[]'::jsonb)
    into v_lines from pos_tab_line tl where tl.tab_id in (p_into, p_from);
  v := save_tab__run(p_into, p_into_version, v_lines);
  -- The kitchen has had both: what it was sent for the second is the first's now.
  update kitchen_ticket set tab_id = p_into where tab_id = p_from;
  -- The second bill, its lines moved, is emptied and cancelled as moved.
  perform save_tab__run(p_from, p_from_version, '[]'::jsonb);
  perform cancel_tab__run(p_from, p_from_version + 1, 'Joined to another bill', 'moved');
  perform audit_event(v_business, 'bill.join', 'pos_tab', p_into::text, null,
    jsonb_build_object('from', p_from), jsonb_build_object('into', p_into));
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Reservations and the waiting list
-- -----------------------------------------------------------------------------
create table if not exists reservation (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  location_id uuid references location(id),
  name        text not null check (length(trim(name)) between 1 and 80),
  phone       text,
  party_size  int not null check (party_size between 1 and 100),
  at          timestamptz,
  table_id    uuid references dining_table(id) on delete set null,
  status      text not null default 'booked' check (status in ('booked', 'seated', 'cancelled', 'no_show')),
  note        text,
  created_by  uuid references app_user(id),
  created_at  timestamptz not null default now(),
  seated_at   timestamptz
);
create index if not exists reservation_business on reservation (business_id, at);
alter table reservation enable row level security;
alter table reservation force row level security;

-- (sale.create) A booking for a time, or a party waiting now (no time).
create or replace function save_reservation(p_id uuid, p_name text, p_phone text, p_party int, p_at timestamptz,
                                            p_note text default null, p_table uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_id uuid := p_id;
begin
  perform require_part(v_business, 'reservations');
  if v_name = '' then raise exception 'Give the name the table is for'; end if;
  if p_party is null or p_party < 1 or p_party > 100 then raise exception 'A party is from 1 to 100 people'; end if;
  if p_at is not null and p_at < now() - interval '1 hour' then raise exception 'A booking is for now or later'; end if;
  if p_table is not null and not exists (select 1 from dining_table where id = p_table and business_id = v_business) then
    raise exception 'That table is not one of the café''s';
  end if;
  if p_id is null then
    insert into reservation (business_id, location_id, name, phone, party_size, at, note, table_id, created_by)
    values (v_business, current_work_place(), left(v_name, 80), nullif(trim(p_phone), ''), p_party, p_at,
            left(nullif(trim(p_note), ''), 300), p_table, (current_member()).id)
    returning id into v_id;
  else
    update reservation set name = left(v_name, 80), phone = nullif(trim(p_phone), ''), party_size = p_party,
                           at = p_at, note = left(nullif(trim(p_note), ''), 300), table_id = p_table
     where id = p_id and business_id = v_business and status = 'booked';
    if not found then raise exception 'That booking is not open'; end if;
  end if;
  return reservations(null);
end $$;

-- (sale.create) Seated at a table, cancelled, or not come.
create or replace function set_reservation_status(p_id uuid, p_status text, p_table uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create');
begin
  perform require_part(v_business, 'reservations');
  if coalesce(p_status, '') not in ('seated', 'cancelled', 'no_show', 'booked') then
    raise exception 'Choose seated, cancelled, not come or booked';
  end if;
  update reservation
     set status = p_status,
         table_id = coalesce(p_table, table_id),
         seated_at = case when p_status = 'seated' then now() end
   where id = p_id and business_id = v_business;
  if not found then raise exception 'That booking is not found'; end if;
  return reservations(null);
end $$;

-- (sale.create) A day's bookings (none: today's and those waiting now).
create or replace function reservations(p_day date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_day date; b record;
begin
  perform require_part(v_business, 'reservations');
  v_day := coalesce(p_day, business_local_date(v_business, now()));
  b := local_day_bounds(v_business, v_day, v_day);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'phone', r.phone, 'party', r.party_size, 'at', r.at, 'status', r.status,
      'note', r.note, 'table_id', r.table_id, 'table', (select name from dining_table where id = r.table_id),
      'waiting', r.at is null, 'created_at', r.created_at)
    order by r.at is null, r.at, r.created_at)
      from reservation r
     where r.business_id = v_business
       and ((r.at >= b.from_ts and r.at < b.to_ts)
            or (r.at is null and r.created_at >= b.from_ts and r.created_at < b.to_ts))), '[]'::jsonb);
end $$;

revoke execute on function require_part(uuid, text), kitchen_lines_of_tab(uuid),
  save_tab__run_0109(uuid, int, jsonb, text, uuid, numeric, numeric, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function save_kitchen_station(uuid, text, boolean), set_category_station(uuid, uuid), kitchen_setup(),
  send_tab_to_kitchen(uuid, int), send_sale_to_kitchen(uuid), kitchen_tickets(uuid, boolean),
  set_ticket_status(uuid, text), join_tabs(uuid, int, uuid, int),
  save_reservation(uuid, text, text, int, timestamptz, text, uuid), set_reservation_status(uuid, text, uuid),
  reservations(date)
  from public, anon;
grant execute on function save_kitchen_station(uuid, text, boolean), set_category_station(uuid, uuid), kitchen_setup(),
  send_tab_to_kitchen(uuid, int), send_sale_to_kitchen(uuid), kitchen_tickets(uuid, boolean),
  set_ticket_status(uuid, text), join_tabs(uuid, int, uuid, int),
  save_reservation(uuid, text, text, int, timestamptz, text, uuid), set_reservation_status(uuid, text, uuid),
  reservations(date)
  to authenticated;
