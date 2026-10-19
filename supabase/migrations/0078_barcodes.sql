-- =============================================================================
-- 0078 — Barcodes (round twenty)
-- =============================================================================
-- A size of a product may carry a barcode: the one printed on what is bought
-- in to sell as it is (a bottle of water), or one the café prints on its own
-- labels. At the till a scanner types it and the size is added; a scale's
-- label for a size sold by weight carries the size's short code (its
-- "PLU", four or five digits) and the weight, read by the till.
--
--  * product_variant.barcode: 4 to 32 letters and digits, once in the café.
--  * set_variant_barcode (recipe.edit), keyed, on the audit trail; refused
--    when another size has it already.
--  * pos_catalogue gives each size's barcode.
--
-- Nothing recorded changes. Before it, the till reads no barcode.
-- =============================================================================

alter table product_variant add column if not exists barcode text;
alter table product_variant drop constraint if exists product_variant_barcode;
alter table product_variant add constraint product_variant_barcode
  check (barcode is null or barcode ~ '^[0-9A-Za-z.-]{4,32}$');
create unique index if not exists product_variant_barcode_once
  on product_variant (business_id, barcode) where barcode is not null;

-- -----------------------------------------------------------------------------
-- 1. A size's barcode
-- -----------------------------------------------------------------------------
create or replace function set_variant_barcode(p_variant uuid, p_barcode text, p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_code text := nullif(regexp_replace(coalesce(p_barcode, ''), '\s+', '', 'g'), '');
  v_req jsonb := jsonb_build_object('variant', p_variant, 'barcode', v_code);
  v jsonb; r record; v_other text;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_variant_barcode', v_req);
  if v is not null then return; end if;
  select pv.id, pv.name, pv.barcode, p.name as product into r
    from product_variant pv join product p on p.id = pv.product_id
   where pv.id = p_variant and pv.business_id = v_business for update of pv;
  if not found then raise exception 'Size not found'; end if;
  if v_code is not null and v_code !~ '^[0-9A-Za-z.-]{4,32}$' then
    raise exception 'A barcode is 4 to 32 letters and digits';
  end if;
  select p.name || ' (' || pv.name || ')' into v_other
    from product_variant pv join product p on p.id = pv.product_id
   where pv.business_id = v_business and pv.barcode = v_code and pv.id <> r.id;
  if v_other is not null then raise exception 'That barcode is on % already', v_other; end if;
  if r.barcode is distinct from v_code then
    update product_variant set barcode = v_code where id = r.id;
    perform audit_event(v_business, 'variant.barcode', 'product_variant', r.id::text, null,
      jsonb_build_object('product', r.product, 'size', r.name, 'barcode', r.barcode),
      jsonb_build_object('product', r.product, 'size', r.name, 'barcode', v_code));
  end if;
  perform idem_finish(v_business, p_idempotency_key, 'set_variant_barcode', v_req, 'null'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 2. The till's menu, with each size's barcode
-- -----------------------------------------------------------------------------
-- 0075's pos_catalogue, with each size's barcode.
drop function if exists pos_catalogue(uuid);
create or replace function pos_catalogue(p_location uuid default null)
returns table (variant_id uuid, product_name text, variant_name text, category text, prices jsonb,
               product_id uuid, category_id uuid, category_sort int, image_url text, is_favourite boolean,
               name_ar text, name_ckb text, category_ar text, category_ckb text,
               section_id uuid, section text, section_ar text, section_ckb text, section_position int,
               sold_by_weight boolean, barcode text)
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
           ms.id, ms.name, ms.name_ar, ms.name_ckb, ms.position, pv.sold_by_weight, pv.barcode
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
revoke execute on function set_variant_barcode(uuid, text, uuid) from public, anon;
grant execute on function set_variant_barcode(uuid, text, uuid) to authenticated;
