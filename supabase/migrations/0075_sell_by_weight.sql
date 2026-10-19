-- =============================================================================
-- 0075 — Selling by weight (round seventeen)
-- =============================================================================
-- The owner's choice: a bakery sells sweets, cookies and bread by the kilo. A
-- size of a product is "sold by weight": its price is the price of a kilo, the
-- till asks how much it weighs (typed, in grams or kilos), and the line is that
-- weight at that price. Its recipe is the recipe of a kilo, so the stock it
-- uses is the weight sold, as for any size by its quantity.
--
--  * product_variant.sold_by_weight, set on Products & Recipes (Sizes & prices)
--    with set_variant_weighed (recipe.edit; keyed; on the audit trail).
--  * The till reads it with the menu (pos_catalogue). A sale's line of a size
--    sold by weight is its weight in kilos, to the gram: at least 1 g, at most
--    a tonne. Other sizes are as they were.
--  * Nothing recorded changes; every size is sold by the piece until it is set.
-- =============================================================================

alter table product_variant add column if not exists sold_by_weight boolean not null default false;

-- -----------------------------------------------------------------------------
-- 1. A size sold by weight
-- -----------------------------------------------------------------------------
create or replace function set_variant_weighed(p_variant uuid, p_weighed boolean, p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_req jsonb := jsonb_build_object('p_variant', p_variant, 'p_weighed', p_weighed);
  v jsonb; r record;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_variant_weighed', v_req);
  if v is not null then return; end if;
  select pv.id, pv.name, pv.sold_by_weight, p.name as product into r
    from product_variant pv join product p on p.id = pv.product_id
   where pv.id = p_variant and pv.business_id = v_business for update of pv;
  if not found then raise exception 'Size not found'; end if;
  if r.sold_by_weight is distinct from coalesce(p_weighed, false) then
    update product_variant set sold_by_weight = coalesce(p_weighed, false) where id = r.id;
    perform audit_event(v_business, 'variant.weighed', 'product_variant', r.id::text, null,
      jsonb_build_object('product', r.product, 'size', r.name, 'sold_by_weight', r.sold_by_weight),
      jsonb_build_object('product', r.product, 'size', r.name, 'sold_by_weight', coalesce(p_weighed, false)));
  end if;
  perform idem_finish(v_business, p_idempotency_key, 'set_variant_weighed', v_req, 'null'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 2. A weighed line's quantity: a weight to the gram
-- -----------------------------------------------------------------------------
create or replace function trg_line_quantity() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_weighed boolean;
begin
  select sold_by_weight into v_weighed from product_variant where id = NEW.product_variant_id;
  if coalesce(v_weighed, false) then
    if NEW.quantity < 0.001 or NEW.quantity > 1000 or NEW.quantity <> round(NEW.quantity, 3) then
      raise exception 'A weight is from 1 g to 1,000 kg, to the gram';
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists line_quantity on sales_order_line;
create trigger line_quantity before insert on sales_order_line
  for each row execute function trg_line_quantity();

-- -----------------------------------------------------------------------------
-- 3. The till's menu, saying which sizes are sold by weight
-- -----------------------------------------------------------------------------
-- 0074's pos_catalogue, with each size's sold_by_weight.
drop function if exists pos_catalogue(uuid);
create or replace function pos_catalogue(p_location uuid default null)
returns table (variant_id uuid, product_name text, variant_name text, category text, prices jsonb,
               product_id uuid, category_id uuid, category_sort int, image_url text, is_favourite boolean,
               name_ar text, name_ckb text, category_ar text, category_ckb text,
               section_id uuid, section text, section_ar text, section_ckb text, section_position int,
               sold_by_weight boolean)
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
           ms.id, ms.name, ms.name_ar, ms.name_ckb, ms.position, pv.sold_by_weight
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
revoke execute on function set_variant_weighed(uuid, boolean, uuid) from public, anon;
grant execute on function set_variant_weighed(uuid, boolean, uuid) to authenticated;
