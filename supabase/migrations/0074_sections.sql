-- =============================================================================
-- 0074 — The café and the bakery on one till, and a menu for each place
-- (round sixteen)
-- =============================================================================
-- The owner's choice (option A): one till sells the café's and the bakery's
-- products together, on one bill and into one drawer; what each sells is
-- still told apart. And where a branch sells only some of it, its till shows
-- only that.
--
--  * A section is a part of the menu the café names: "Café", "Bakery". The
--    owner sets each category's section; a product is of its category's
--    section, so a few categories are set, not every product. A product with
--    no category, or a category with no section, is of none.
--  * A branch may sell only some sections: its till shows those, and the
--    products of no section. A branch given none sells everything, as before.
--  * The reports tell the sections apart by the categories' sales, as the
--    sales analysis already reads them.
--
-- Nothing recorded changes; before a section is named the menu is as it was.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. What is kept
-- -----------------------------------------------------------------------------
create table if not exists menu_section (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  name         text not null,
  name_ar      text,
  name_ckb     text,
  position     int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint menu_section_name check (length(trim(name)) between 1 and 40)
);
create unique index if not exists menu_section_named_once on menu_section (business_id, lower(name));

-- Everyone at the café reads the sections (the till groups its menu by them);
-- only the functions below write them.
alter table menu_section enable row level security;
alter table menu_section force row level security;
drop policy if exists member_read on menu_section;
create policy member_read on menu_section for select to authenticated
  using (business_id = (select current_business_id()));
grant select on menu_section to authenticated;

alter table product_category add column if not exists section_id uuid references menu_section (id);

-- The sections a branch sells; none, everything.
create table if not exists location_section (
  business_id  uuid not null references business (id) on delete cascade,
  location_id  uuid not null references location (id) on delete cascade,
  section_id   uuid not null references menu_section (id) on delete cascade,
  primary key (location_id, section_id)
);
alter table location_section enable row level security;
alter table location_section force row level security;
drop policy if exists member_read on location_section;
create policy member_read on location_section for select to authenticated
  using (business_id = (select current_business_id()));
grant select on location_section to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Naming a section, a category's section, a branch's sections
-- -----------------------------------------------------------------------------
-- A section added (p_id null) or changed: its name in the three languages, its
-- place in the order, and whether it is in use. One taken out of use keeps its
-- categories, which show as of none.
create or replace function save_section(p_id uuid, p_name text, p_name_ar text default null,
                                        p_name_ckb text default null, p_position int default null,
                                        p_is_active boolean default true, p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_req jsonb := jsonb_build_object('p_id', p_id, 'p_name', p_name, 'p_name_ar', p_name_ar, 'p_name_ckb', p_name_ckb,
                                    'p_position', p_position, 'p_is_active', p_is_active);
  v jsonb; v_id uuid; v_name text := nullif(trim(p_name), ''); s menu_section;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_section', v_req);
  if v is not null then return (v #>> '{}')::uuid; end if;
  if v_name is null then raise exception 'Name the section'; end if;
  if length(v_name) > 40 then raise exception 'A section''s name is at most 40 letters'; end if;
  if exists (select 1 from menu_section where business_id = v_business and lower(name) = lower(v_name)
               and id is distinct from p_id) then
    raise exception 'There is already a section called %', v_name;
  end if;
  if p_id is null then
    insert into menu_section (business_id, name, name_ar, name_ckb, position, is_active)
    values (v_business, v_name, nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''),
            coalesce(p_position, (select coalesce(max(position), 0) + 1 from menu_section where business_id = v_business)),
            coalesce(p_is_active, true))
    returning id into v_id;
    perform audit_event(v_business, 'section.add', 'menu_section', v_id::text, null, null,
      jsonb_build_object('name', v_name));
  else
    select * into s from menu_section where id = p_id and business_id = v_business for update;
    if not found then raise exception 'Section not found'; end if;
    update menu_section
       set name = v_name, name_ar = nullif(trim(p_name_ar), ''), name_ckb = nullif(trim(p_name_ckb), ''),
           position = coalesce(p_position, s.position), is_active = coalesce(p_is_active, true)
     where id = p_id
    returning id into v_id;
    perform audit_event(v_business, 'section.change', 'menu_section', v_id::text, null,
      jsonb_build_object('name', s.name, 'is_active', s.is_active),
      jsonb_build_object('name', v_name, 'is_active', coalesce(p_is_active, true)));
  end if;
  perform idem_finish(v_business, p_idempotency_key, 'save_section', v_req, to_jsonb(v_id));
  return v_id;
end $$;

-- A category's section (p_section null: none). Its products go with it.
create or replace function set_category_section(p_category uuid, p_section uuid,
                                                p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_req jsonb := jsonb_build_object('p_category', p_category, 'p_section', p_section);
  v jsonb; c product_category;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_category_section', v_req);
  if v is not null then return; end if;
  select * into c from product_category where id = p_category and business_id = v_business for update;
  if not found then raise exception 'Category not found'; end if;
  if p_section is not null
     and not exists (select 1 from menu_section where id = p_section and business_id = v_business) then
    raise exception 'Section not found';
  end if;
  if c.section_id is distinct from p_section then
    update product_category set section_id = p_section where id = c.id;
    perform audit_event(v_business, 'category.section', 'product_category', c.id::text, null,
      jsonb_build_object('name', c.name, 'section', c.section_id),
      jsonb_build_object('name', c.name, 'section', p_section));
  end if;
  perform idem_finish(v_business, p_idempotency_key, 'set_category_section', v_req, 'null'::jsonb);
end $$;

-- The sections a branch sells (none: everything). Answers with them.
create or replace function set_place_sections(p_location uuid, p_sections uuid[],
                                              p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_req jsonb := jsonb_build_object('p_location', p_location, 'p_sections', to_jsonb(p_sections));
  v jsonb; l location; v_before jsonb; v_after jsonb; v_wanted uuid[] := coalesce(p_sections, '{}');
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_place_sections', v_req);
  if v is not null then return v; end if;
  select * into l from location where id = p_location and business_id = v_business;
  if not found then raise exception 'Place not found'; end if;
  if l.kind <> 'branch' then raise exception '% does not sell: the till is at a branch', l.name; end if;
  if exists (select 1 from unnest(v_wanted) x
              where not exists (select 1 from menu_section s where s.id = x and s.business_id = v_business)) then
    raise exception 'Section not found';
  end if;
  select coalesce(jsonb_agg(section_id order by section_id), '[]') into v_before
    from location_section where location_id = l.id;
  delete from location_section where location_id = l.id and not (section_id = any (v_wanted));
  insert into location_section (business_id, location_id, section_id)
  select v_business, l.id, x from (select distinct unnest(v_wanted) as x) u
  on conflict do nothing;
  select coalesce(jsonb_agg(section_id order by section_id), '[]') into v_after
    from location_section where location_id = l.id;
  if v_before is distinct from v_after then
    perform audit_event(v_business, 'place.sections', 'location', l.id::text, null,
      jsonb_build_object('sections', v_before), jsonb_build_object('sections', v_after));
  end if;
  v := jsonb_build_object('location', l.id, 'sections', v_after);
  perform idem_finish(v_business, p_idempotency_key, 'set_place_sections', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 3. The till's menu, by section, and only what its branch sells
-- -----------------------------------------------------------------------------
-- 0055's pos_catalogue, with each product's section (its category's), and at
-- a branch that sells only some sections, only those and the products of
-- none.
drop function if exists pos_catalogue(uuid);
create or replace function pos_catalogue(p_location uuid default null)
returns table (variant_id uuid, product_name text, variant_name text, category text, prices jsonb,
               product_id uuid, category_id uuid, category_sort int, image_url text, is_favourite boolean,
               name_ar text, name_ckb text, category_ar text, category_ckb text,
               section_id uuid, section text, section_ar text, section_ckb text, section_position int)
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
           ms.id, ms.name, ms.name_ar, ms.name_ckb, ms.position
      from product_variant pv
      join product p on p.id = pv.product_id
      left join product_category pc on pc.id = p.category_id
      left join menu_section ms on ms.id = pc.section_id and ms.is_active
     -- A hidden category takes its products off the menu with it.
     where pv.business_id = v_business and pv.is_active and p.is_active and coalesce(pc.is_active, true)
       and (not v_limited or ms.id is null
            or exists (select 1 from location_section ls where ls.location_id = v_location and ls.section_id = ms.id))
     order by ms.position nulls last, pc.sort_order nulls last, pc.name nulls last, p.name, pv.name;
end $$;

revoke execute on function pos_catalogue(uuid) from public, anon;
grant execute on function pos_catalogue(uuid) to authenticated;
revoke execute on function save_section(uuid, text, text, text, int, boolean, uuid) from public, anon;
grant execute on function save_section(uuid, text, text, text, int, boolean, uuid) to authenticated;
revoke execute on function set_category_section(uuid, uuid, uuid) from public, anon;
grant execute on function set_category_section(uuid, uuid, uuid) to authenticated;
revoke execute on function set_place_sections(uuid, uuid[], uuid) from public, anon;
grant execute on function set_place_sections(uuid, uuid[], uuid) to authenticated;
