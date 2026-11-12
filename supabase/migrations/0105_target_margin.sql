-- 0105: a target margin for each product or category (plan 5 D). The owner
-- (12 November): agreed. Cold brew in a bottle, a cake, a cup of tea each earn
-- differently: a product says the margin it aims for (or its category does),
-- the price form suggests the price that reaches it from what the product
-- costs now, and Products says when a cost rise (the bottle's price) has taken
-- it under. None set: the café's margin target, as before.
--
-- Nothing recorded changes.

alter table product add column if not exists target_margin_percent numeric(5, 2);
alter table product drop constraint if exists product_target_margin;
alter table product add constraint product_target_margin
  check (target_margin_percent is null or (target_margin_percent >= 0 and target_margin_percent < 100));
alter table product_category add column if not exists target_margin_percent numeric(5, 2);
alter table product_category drop constraint if exists product_category_target_margin;
alter table product_category add constraint product_category_target_margin
  check (target_margin_percent is null or (target_margin_percent >= 0 and target_margin_percent < 100));

-- A product's or a category's target (null takes it away), by those who keep the recipes.
create or replace function set_target_margin(p_product uuid, p_category uuid, p_percent numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  v_before numeric; v_name text;
begin
  if (p_product is null) = (p_category is null) then raise exception 'Choose a product or a category'; end if;
  if p_percent is not null and (p_percent < 0 or p_percent >= 100) then
    raise exception '%', format('A margin target is from %s%% to under %s%%', 0, 100);
  end if;
  if p_product is not null then
    select target_margin_percent, name into v_before, v_name from product
     where id = p_product and business_id = v_business for update;
    if v_name is null then raise exception 'Product not found'; end if;
    update product set target_margin_percent = p_percent where id = p_product;
  else
    select target_margin_percent, name into v_before, v_name from product_category
     where id = p_category and business_id = v_business for update;
    if v_name is null then raise exception 'Choose one of the café''s categories'; end if;
    update product_category set target_margin_percent = p_percent where id = p_category;
  end if;
  perform audit_event(v_business, 'menu.target_margin', case when p_product is not null then 'product' else 'category' end,
    coalesce(p_product, p_category)::text, null,
    jsonb_build_object('name', v_name, 'target_margin', v_before),
    jsonb_build_object('name', v_name, 'target_margin', p_percent));
  return jsonb_build_object('name', v_name, 'target_margin', p_percent);
end $$;

-- Each product's target: its own, else its category's, else none (the café's).
create or replace function product_targets() returns table (product_id uuid, target numeric, own numeric,
                                                            category_target numeric)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.target_margin_percent, c.target_margin_percent), p.target_margin_percent,
         c.target_margin_percent
    from product p left join product_category c on c.id = p.category_id
   where p.business_id = current_business_id() and current_has_permission('cost.view')
$$;

revoke execute on function set_target_margin(uuid, uuid, numeric), product_targets() from public, anon;
grant execute on function set_target_margin(uuid, uuid, numeric), product_targets() to authenticated;
