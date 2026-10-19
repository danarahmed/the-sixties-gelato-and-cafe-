-- =============================================================================
-- 0079 — End-of-day markdowns (round twenty-one)
-- =============================================================================
-- What the bakery made today and must sell today: sold off cheaper before it
-- is thrown away, rather than thrown away at full cost. So:
--
--  * price_markdown: a size sold a percentage off, at a branch, from now to
--    the end of the day (or a time given), on dine-in and take-away only (a
--    delivery platform sets its own prices). Stopped by hand, or by its end.
--  * price_on gives the marked-down price while one runs: the till, an open
--    bill, the sale and its books all read the one price.
--  * mark_down / stop_markdown, by those who approve discounts or record
--    production, keyed and on the audit trail.
--  * markdown_suggestions: the batches whose use-by ends today with some left
--    at the branch, each with the sizes that sell them (sold as they are, or
--    in a size's recipe), how many servings are left, and a suggested
--    percentage by how little time is left; and the markdowns running.
--  * pos_catalogue says by how much a size is marked down.
--
-- Nothing recorded changes. Before it, nothing is marked down.
-- =============================================================================

create table if not exists price_markdown (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references business (id) on delete cascade,
  location_id         uuid not null references location (id),
  product_variant_id  uuid not null references product_variant (id),
  percent             numeric not null,
  starts_at           timestamptz not null default now(),
  ends_at             timestamptz not null,
  created_by          uuid references app_user (id),
  created_at          timestamptz not null default now(),
  stopped_at          timestamptz,
  stopped_by          uuid references app_user (id),
  constraint price_markdown_percent check (percent >= 5 and percent <= 90 and percent = round(percent)),
  constraint price_markdown_times check (ends_at > starts_at)
);
create index if not exists price_markdown_running on price_markdown (product_variant_id, location_id)
  where stopped_at is null;
alter table price_markdown enable row level security;
alter table price_markdown force row level security;
drop policy if exists member_read on price_markdown;
create policy member_read on price_markdown for select to authenticated
  using (business_id = (select current_business_id()));
grant select on price_markdown to authenticated;

-- -----------------------------------------------------------------------------
-- 1. The price, marked down while a markdown runs
-- -----------------------------------------------------------------------------
-- The percentage off a size at a branch now: the largest running, or null.
create or replace function markdown_now(p_variant uuid, p_location uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select max(m.percent) from price_markdown m
   where m.product_variant_id = p_variant and m.stopped_at is null
     and (p_location is null or m.location_id = p_location)
     and now() >= m.starts_at and now() < m.ends_at
$$;

-- 0015's price_on: on dine-in and take-away, today, a running markdown's
-- percentage off, rounded as the café rounds money.
create or replace function price_on(p_variant uuid, p_channel sales_channel, p_location uuid, p_on date)
returns numeric language sql stable set search_path = public as $$
  select case when x.price is null or x.cut is null then x.price
              else money_round(x.business_id, x.price * (100 - x.cut) / 100) end
    from (select (select price from channel_price
                   where product_variant_id = p_variant and channel = p_channel
                     and effective_from <= p_on and (effective_to is null or effective_to >= p_on)
                     and (location_id is null or location_id = p_location)
                   order by (location_id is not null) desc, effective_from desc, created_at desc
                   limit 1) as price,
                 case when p_channel in ('dine_in', 'takeaway')
                       and p_on = business_local_date(pv.business_id, now())
                      then markdown_now(p_variant, p_location) end as cut,
                 pv.business_id
            from product_variant pv where pv.id = p_variant) x
$$;

-- -----------------------------------------------------------------------------
-- 2. Marking down, and stopping
-- -----------------------------------------------------------------------------
-- p_variants: the sizes; p_percent: 5 to 90, whole; p_until: when it ends
-- (the end of the café's day when none, and never after it). A size already
-- marked down at the branch has that one stopped, this one in its place.
create or replace function mark_down(p_variants uuid[], p_percent numeric, p_location uuid default null,
  p_until timestamptz default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('discount.approve', 'production.record');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('variants', p_variants, 'percent', p_percent, 'location', p_location,
                                    'until', p_until);
  v jsonb; v_location uuid; v_end timestamptz; v_until timestamptz; r record; n int := 0;
begin
  v := idem_begin(v_business, p_idempotency_key, 'mark_down', v_req);
  if v is not null then return v; end if;
  if p_percent is null or p_percent < 5 or p_percent > 90 or p_percent <> round(p_percent) then
    raise exception 'A markdown is from 5%% to 90%% off, in whole percent';
  end if;
  if p_variants is null or cardinality(p_variants) = 0 then raise exception 'Choose what to mark down'; end if;
  v_location := resolve_location(v_business, p_location);
  v_end := ((business_local_date(v_business, now()) + 1)::timestamp
            at time zone (select timezone from business where id = v_business));
  v_until := least(coalesce(p_until, v_end), v_end);
  if v_until <= now() then raise exception 'A markdown ends later than now'; end if;
  for r in select pv.id, pv.name, p.name as product
             from product_variant pv join product p on p.id = pv.product_id
            where pv.id = any (p_variants) and pv.business_id = v_business and pv.is_active loop
    n := n + 1;
    update price_markdown set stopped_at = now(), stopped_by = v_me
     where product_variant_id = r.id and location_id = v_location and stopped_at is null and ends_at > now();
    insert into price_markdown (business_id, location_id, product_variant_id, percent, ends_at, created_by)
    values (v_business, v_location, r.id, p_percent, v_until, v_me);
    perform audit_event(v_business, 'price.markdown', 'product_variant', r.id::text, null, null,
      jsonb_build_object('product', r.product, 'size', r.name, 'percent', p_percent, 'until', v_until));
  end loop;
  if n <> cardinality(p_variants) then raise exception 'That product is not on sale'; end if;
  v := jsonb_build_object('marked', n, 'until', v_until);
  perform idem_finish(v_business, p_idempotency_key, 'mark_down', v_req, v);
  return v;
end $$;

create or replace function stop_markdown(p_markdown uuid, p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('discount.approve', 'production.record');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('markdown', p_markdown);
  v jsonb; m price_markdown;
begin
  v := idem_begin(v_business, p_idempotency_key, 'stop_markdown', v_req);
  if v is not null then return; end if;
  select * into m from price_markdown where id = p_markdown and business_id = v_business for update;
  if not found then raise exception 'Markdown not found'; end if;
  if m.stopped_at is null and m.ends_at > now() then
    update price_markdown set stopped_at = now(), stopped_by = v_me where id = m.id;
    perform audit_event(v_business, 'price.markdown_stop', 'product_variant', m.product_variant_id::text, null,
      jsonb_build_object('percent', m.percent), null);
  end if;
  perform idem_finish(v_business, p_idempotency_key, 'stop_markdown', v_req, 'null'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 3. What to mark down
-- -----------------------------------------------------------------------------
-- The lots at the branch whose use-by ends before the café's day does, with
-- some left; each with the sizes that sell what it holds — as they are, or in
-- their recipe in force today — and how many servings are left of each; a
-- suggested percentage: half off with two hours or less left, 30% with five
-- or less, 20% else. And the markdowns running at the branch.
create or replace function markdown_suggestions(p_location uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('discount.approve', 'production.record');
  v_location uuid := resolve_location(v_business, p_location);
  v_today date := business_local_date(v_business, now());
  v_end timestamptz := ((business_local_date(v_business, now()) + 1)::timestamp
                        at time zone (select timezone from business where id = v_business));
begin
  return jsonb_build_object(
    'until', v_end,
    'lots', coalesce((
      select jsonb_agg(jsonb_build_object(
               'lot_id', lot.id, 'item_id', lot.item_id, 'item', i.name, 'unit', i.base_unit_code,
               'left', trim_scale(lot.left_base), 'use_by', lot.use_by,
               'suggested', case when lot.use_by <= now() + interval '2 hours' then 50
                                 when lot.use_by <= now() + interval '5 hours' then 30 else 20 end,
               'sizes', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'variant_id', s.variant_id, 'product', s.product, 'size', s.size,
                          'servings', floor(lot.left_base / s.per_serving),
                          'price', price_on(s.variant_id, 'takeaway', v_location, v_today),
                          'marked', markdown_now(s.variant_id, v_location))
                        order by s.product, s.size)
                   from (select pv.id as variant_id, p.name as product, pv.name as size, 1::numeric as per_serving
                           from product_variant pv join product p on p.id = pv.product_id
                          where pv.resale_item_id = lot.item_id and pv.is_active and p.is_active
                         union
                         select pv.id, p.name, pv.name, to_base_qty(rl.item_id, rl.quantity, rl.unit_code)
                           from product_variant pv join product p on p.id = pv.product_id
                           join variant_recipe vr on vr.product_variant_id = pv.id
                           join lateral (select rv.id from recipe_version rv
                                          where rv.recipe_id = vr.recipe_id and rv.effective_from <= v_today
                                            and (rv.effective_to is null or rv.effective_to >= v_today)
                                          order by rv.effective_from desc, rv.version_no desc limit 1) rv on true
                           join recipe_line rl on rl.recipe_version_id = rv.id
                          where rl.item_id = lot.item_id and rl.component_type = 'item' and rl.quantity > 0
                            and pv.is_active and p.is_active) s
                  where s.per_serving > 0), '[]'::jsonb))
             order by lot.use_by, i.name)
        from item_lot lot join item i on i.id = lot.item_id
       where lot.business_id = v_business and lot.location_id = v_location and lot.left_base > 0
         and lot.use_by is not null and lot.use_by > now() and lot.use_by <= v_end), '[]'::jsonb),
    'running', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'variant_id', m.product_variant_id, 'product', p.name,
                                          'size', pv.name, 'percent', m.percent, 'ends_at', m.ends_at)
                       order by p.name, pv.name)
        from price_markdown m join product_variant pv on pv.id = m.product_variant_id
        join product p on p.id = pv.product_id
       where m.business_id = v_business and m.location_id = v_location and m.stopped_at is null
         and now() >= m.starts_at and now() < m.ends_at), '[]'::jsonb));
end $$;

-- -----------------------------------------------------------------------------
-- 4. The till's menu, with each size's markdown
-- -----------------------------------------------------------------------------
drop function if exists pos_catalogue(uuid);
-- 0078's pos_catalogue, with each size's markdown running now: its price is
-- the marked-down one already (price_on), and the till shows by how much.
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
     -- A hidden category takes its products off the menu with it.
     where pv.business_id = v_business and pv.is_active and p.is_active and coalesce(pc.is_active, true)
       and (not v_limited or ms.id is null
            or exists (select 1 from location_section ls where ls.location_id = v_location and ls.section_id = ms.id))
     order by ms.position nulls last, pc.sort_order nulls last, pc.name nulls last, p.name, pv.name;
end $$;


revoke execute on function pos_catalogue(uuid) from public, anon;
grant execute on function pos_catalogue(uuid) to authenticated;
revoke execute on function mark_down(uuid[], numeric, uuid, timestamptz, uuid) from public, anon;
grant execute on function mark_down(uuid[], numeric, uuid, timestamptz, uuid) to authenticated;
revoke execute on function stop_markdown(uuid, uuid) from public, anon;
grant execute on function stop_markdown(uuid, uuid) to authenticated;
revoke execute on function markdown_suggestions(uuid) from public, anon;
grant execute on function markdown_suggestions(uuid) to authenticated;
revoke execute on function markdown_now(uuid, uuid) from public, anon, authenticated;
