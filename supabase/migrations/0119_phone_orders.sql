-- 0119: orders sent from the customer's phone to the till (plan 11, item 4 B
-- and the café's own online ordering; the owner: optional, scanning by the
-- waiter stays the default).
--
--   * Two switches on the menu's link (0118), each off until the owner turns
--     it on: "to the till" (a table's order sent straight to the counter, with
--     the table) and "to take away or deliver" (the café's own online
--     ordering: a name, a phone number, and an address for a delivery).
--   * A phone's order waits at the till as an order to take: the cashier
--     accepts it (it becomes a bill, as one rung up) or turns it down, with
--     why. The customer's phone sees which.
--   * Nothing is paid from the phone; the money is taken at the till as
--     always. A phone sends at most 5 orders an hour, a café takes at most 200,
--     and each order is at most 30 lines of at most 20 each, of what the menu
--     sells now.
--
-- Nothing recorded changes; both off until the owner turns them on.

alter table public_menu add column if not exists to_till boolean not null default false;
alter table public_menu add column if not exists online boolean not null default false;

create table if not exists phone_order (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  location_id   uuid references location(id),
  order_no      int not null,
  kind          text not null check (kind in ('table', 'pickup', 'delivery')),
  table_label   text check (table_label is null or length(table_label) <= 40),
  customer_name text check (customer_name is null or length(customer_name) <= 80),
  phone         text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  address       text check (address is null or length(address) <= 300),
  note          text check (note is null or length(note) <= 300),
  lines         jsonb not null,
  status        text not null default 'new' check (status in ('new', 'accepted', 'declined')),
  decline_reason text check (decline_reason is null or length(decline_reason) <= 200),
  handled_by    uuid references app_user(id),
  handled_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (business_id, order_no)
);
create index if not exists phone_order_waiting on phone_order (business_id, status, created_at);
alter table phone_order enable row level security;
alter table phone_order force row level security;

-- A phone number as the café keeps it: +964… from 07…, Latin digits.
create or replace function phone_order_phone(p text) returns text
language sql immutable as $$
  select case
    when d ~ '^07[0-9]{9}$' then '+964' || substr(d, 2)
    when d ~ '^009647[0-9]{9}$' then '+' || substr(d, 3)
    when d ~ '^\+?[1-9][0-9]{7,14}$' then '+' || ltrim(d, '+')
  end
  from (select regexp_replace(translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '[^0-9+]', '', 'g') as d) x
$$;

-- (the owner) The two switches on the menu's link.
create or replace function set_phone_orders(p_to_till boolean, p_online boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage');
begin
  if not current_has_role('owner') then
    raise exception 'Only the owner turns the menu on customers'' phones on or off' using errcode = '42501';
  end if;
  update public_menu set to_till = coalesce(p_to_till, false), online = coalesce(p_online, false),
                         set_by = (current_member()).id, set_at = now()
   where business_id = v_business;
  if not found then raise exception 'Turn the menu on customers'' phones on first'; end if;
  perform audit_event(v_business, 'menu.phone_orders', 'business', v_business::text, null, null,
    jsonb_build_object('to_till', coalesce(p_to_till, false), 'online', coalesce(p_online, false)));
  return jsonb_build_object('to_till', coalesce(p_to_till, false), 'online', coalesce(p_online, false));
end $$;

-- (anyone with the link) An order sent to the till.
create or replace function submit_phone_order(p_token text, p_kind text, p_lines jsonb, p_name text default null,
                                              p_phone text default null, p_table text default null,
                                              p_address text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public_menu; v_phone text := phone_order_phone(p_phone); v_lines jsonb := '[]'::jsonb; x jsonb;
  v_today date; v_no int; v_id uuid := gen_random_uuid(); n int := 0;
begin
  select * into m from public_menu where token = p_token and enabled;
  if m.business_id is null then raise exception 'This menu is not available'; end if;
  if p_kind = 'table' and not m.to_till then raise exception 'Show your order to the waiter'; end if;
  if p_kind in ('pickup', 'delivery') and not m.online then raise exception 'This café takes no orders from phones'; end if;
  if p_kind not in ('table', 'pickup', 'delivery') then raise exception 'This café takes no orders from phones'; end if;
  if p_kind = 'table' and nullif(trim(p_table), '') is null then raise exception 'Say which table you are at'; end if;
  if p_kind <> 'table' then
    if nullif(trim(p_name), '') is null then raise exception 'Type your name'; end if;
    if v_phone is null then raise exception 'Type your phone number'; end if;
    if p_kind = 'delivery' and nullif(trim(p_address), '') is null then raise exception 'Type where it goes'; end if;
  end if;
  -- One order at a time for the café, and not too many.
  perform pg_advisory_xact_lock(hashtextextended('phone_order:' || m.business_id::text, 0));
  if v_phone is not null and (select count(*) from phone_order where business_id = m.business_id and phone = v_phone
                                and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many orders from this phone: ask at the counter';
  end if;
  if (select count(*) from phone_order where business_id = m.business_id
        and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'The café is busy: ask at the counter';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0
     or jsonb_array_length(p_lines) > 30 then
    raise exception 'Choose up to 30 things';
  end if;
  v_today := business_local_date(m.business_id, now());
  for x in select value from jsonb_array_elements(p_lines) loop
    if coalesce(x ->> 'variant_id', '') !~ '^[0-9a-f-]{36}$'
       or coalesce(x ->> 'qty', '') !~ '^[0-9]{1,2}$' or (x ->> 'qty')::int not between 1 and 20 then
      raise exception 'The order cannot be read';
    end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = (x ->> 'variant_id')::uuid and pv.business_id = m.business_id
                      and pv.is_active and p.is_active
                      and price_on(pv.id, 'dine_in', m.location_id, v_today) is not null) then
      raise exception 'Something on the order is not on the menu now';
    end if;
    v_lines := v_lines || jsonb_build_object('variant_id', x ->> 'variant_id', 'qty', (x ->> 'qty')::int);
    n := n + 1;
  end loop;
  select coalesce(max(order_no), 0) + 1 into v_no from phone_order where business_id = m.business_id;
  insert into phone_order (id, business_id, location_id, order_no, kind, table_label, customer_name, phone, address,
                           note, lines)
  values (v_id, m.business_id, m.location_id, v_no, p_kind, nullif(left(trim(p_table), 40), ''),
          nullif(left(trim(p_name), 80), ''), v_phone, nullif(left(trim(p_address), 300), ''),
          nullif(left(trim(p_note), 300), ''), v_lines);
  return jsonb_build_object('order_id', v_id, 'order_no', v_no, 'status', 'new');
end $$;

-- (anyone with the link and the order's id) Where the order stands.
create or replace function phone_order_status(p_token text, p_order uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('order_no', o.order_no, 'status', o.status, 'reason', o.decline_reason)
    from phone_order o join public_menu m on m.business_id = o.business_id and m.token = p_token
   where o.id = p_order
$$;

-- (sale.create) The orders from phones waiting at the till, and the last ones handled.
create or replace function phone_orders() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', o.id, 'order_no', o.order_no, 'kind', o.kind, 'table', o.table_label,
                                        'name', o.customer_name, 'phone', o.phone, 'address', o.address,
                                        'note', o.note, 'lines', o.lines, 'status', o.status, 'at', o.created_at)
                     order by o.created_at)
      from phone_order o
     where o.business_id = v_business
       and (o.status = 'new' or o.handled_at > now() - interval '2 hours')), '[]'::jsonb);
end $$;

-- (sale.create) An order taken (it is rung up as a bill at the till) or turned down, with why.
create or replace function handle_phone_order(p_order uuid, p_accept boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); o phone_order;
begin
  select * into o from phone_order where id = p_order and business_id = v_business for update;
  if o.id is null then raise exception 'That order is not found'; end if;
  if o.status <> 'new' then raise exception 'That order was dealt with already'; end if;
  if not coalesce(p_accept, false) and nullif(trim(p_reason), '') is null then
    raise exception 'Say why it is turned down';
  end if;
  update phone_order set status = case when p_accept then 'accepted' else 'declined' end,
                         decline_reason = case when p_accept then null else left(trim(p_reason), 200) end,
                         handled_by = (current_member()).id, handled_at = now()
   where id = o.id;
  return jsonb_build_object('id', o.id, 'order_no', o.order_no,
                            'status', case when p_accept then 'accepted' else 'declined' end, 'lines', o.lines,
                            'kind', o.kind, 'table', o.table_label, 'name', o.customer_name, 'phone', o.phone,
                            'address', o.address, 'note', o.note);
end $$;

-- 0118's setup, with the two switches.
create or replace function public_menu_setup() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when current_has_permission('settings.manage') then
    (select jsonb_build_object('enabled', m.enabled, 'token', m.token, 'location_id', m.location_id,
                               'to_till', m.to_till, 'online', m.online)
       from public_menu m where m.business_id = current_business_id()) end
$$;

-- 0118's menu, saying what the phone may send.
do $$
begin
  if to_regprocedure('public_menu_0118(text)') is null then
    alter function public_menu(text) rename to public_menu_0118;
  end if;
end $$;
create or replace function public_menu(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb := public_menu_0118(p_token); m public_menu;
begin
  select * into m from public_menu where token = p_token;
  return v || jsonb_build_object('to_till', m.to_till, 'online', m.online);
end $$;

revoke execute on function public_menu_0118(text), phone_order_phone(text) from public, anon, authenticated;
revoke execute on function set_phone_orders(boolean, boolean), submit_phone_order(text, text, jsonb, text, text, text, text, text),
  phone_order_status(text, uuid), phone_orders(), handle_phone_order(uuid, boolean, text), public_menu(text),
  public_menu_setup()
  from public;
grant execute on function set_phone_orders(boolean, boolean), submit_phone_order(text, text, jsonb, text, text, text, text, text),
  phone_order_status(text, uuid), phone_orders(), handle_phone_order(uuid, boolean, text), public_menu(text),
  public_menu_setup()
  to authenticated;
grant execute on function submit_phone_order(text, text, jsonb, text, text, text, text, text),
  phone_order_status(text, uuid), public_menu(text)
  to anon;
