-- 0118: the café's menu on the customer's phone (plan 11, item 4 A; the
-- owner: scanned by the waiter by default).
--
--   * The owner turns on a link for one of the café's places: its QR, on the
--     tables, opens the menu at that place's prices, in the customer's
--     language, with the photos. Nobody signs in.
--   * The customer taps what they want; their phone shows the order as a QR,
--     and the waiter scans it at the till: it is added to the bill like any
--     other line, and the waiter takes it from there. Nothing reaches the
--     database from the customer's phone: the menu is only read.
--   * The link can be changed at any time (the old QR stops working) or
--     turned off.
--
-- Nothing recorded changes; off until the owner turns it on.

create table if not exists public_menu (
  business_id uuid primary key references business(id) on delete cascade,
  token       text not null unique check (token ~ '^[A-Za-z0-9_-]{20,40}$'),
  enabled     boolean not null default false,
  location_id uuid references location(id),
  set_by      uuid references app_user(id),
  set_at      timestamptz not null default now()
);
alter table public_menu enable row level security;
alter table public_menu force row level security;

create or replace function public_menu_token() returns text
language sql volatile set search_path = public, extensions as $$
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_')
$$;

-- (settings.manage, the owner) The menu's link: on or off, for which place, a new link.
create or replace function set_public_menu(p_enabled boolean, p_location uuid default null,
                                           p_new_link boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage'); v_location uuid; m public_menu;
begin
  if not current_has_role('owner') then
    raise exception 'Only the owner turns the menu on customers'' phones on or off' using errcode = '42501';
  end if;
  if p_enabled is null then raise exception 'Choose on or off'; end if;
  v_location := resolve_location(v_business, p_location);
  insert into public_menu (business_id, token, enabled, location_id, set_by, set_at)
  values (v_business, public_menu_token(), p_enabled, v_location, (current_member()).id, now())
  on conflict (business_id) do update
    set enabled = excluded.enabled, location_id = excluded.location_id, set_by = excluded.set_by,
        set_at = excluded.set_at,
        token = case when p_new_link then excluded.token else public_menu.token end
  returning * into m;
  perform audit_event(v_business, 'menu.public', 'business', v_business::text, null, null,
    jsonb_build_object('enabled', p_enabled, 'location', v_location, 'new_link', coalesce(p_new_link, false)));
  return jsonb_build_object('enabled', m.enabled, 'token', m.token, 'location_id', m.location_id);
end $$;

-- (settings.manage) The link as it stands; null before it was ever turned on.
create or replace function public_menu_setup() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when current_has_permission('settings.manage') then
    (select jsonb_build_object('enabled', m.enabled, 'token', m.token, 'location_id', m.location_id)
       from public_menu m where m.business_id = current_business_id()) end
$$;

-- (anyone with the link) The menu at the link's place, today's dine-in prices,
-- what is on sale now: names in each language, the photos, the categories.
create or replace function public_menu(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m public_menu; b business; v_today date;
begin
  select * into m from public_menu where token = p_token and enabled;
  if m.business_id is null then raise exception 'This menu is not available'; end if;
  select * into b from business where id = m.business_id;
  if b.closed_at is not null then raise exception 'This menu is not available'; end if;
  v_today := business_local_date(b.id, now());
  return jsonb_build_object(
    'business', b.name, 'decimals', b.currency_decimals,
    'place', (select name from location where id = m.location_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'variant_id', x.id, 'product', x.product, 'variant', x.variant,
               'name_ar', x.name_ar, 'name_ckb', x.name_ckb,
               'category', x.category, 'category_ar', x.category_ar, 'category_ckb', x.category_ckb,
               'price', x.price, 'image_url', x.image_url)
             order by x.sort_order nulls last, x.category nulls last, x.product, x.variant)
        from (select pv.id, p.name as product, pv.name as variant, p.name_ar, p.name_ckb,
                     pc.name as category, pc.name_ar as category_ar, pc.name_ckb as category_ckb, pc.sort_order,
                     p.image_url, price_on(pv.id, 'dine_in', m.location_id, v_today) as price
                from product_variant pv
                join product p on p.id = pv.product_id
                left join product_category pc on pc.id = p.category_id
                left join menu_section ms on ms.id = pc.section_id and ms.is_active
               where pv.business_id = b.id and pv.is_active and p.is_active and coalesce(pc.is_active, true)
                 and not coalesce(pv.sold_by_weight, false)
                 and (ms.id is null or section_shown(ms, now()))) x
       where x.price is not null), '[]'::jsonb));
end $$;

revoke execute on function public_menu_token() from public, anon, authenticated;
revoke execute on function set_public_menu(boolean, uuid, boolean), public_menu_setup(), public_menu(text)
  from public;
grant execute on function set_public_menu(boolean, uuid, boolean), public_menu_setup(), public_menu(text)
  to authenticated;
grant execute on function public_menu(text) to anon;
