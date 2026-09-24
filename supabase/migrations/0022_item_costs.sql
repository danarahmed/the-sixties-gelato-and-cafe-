-- =============================================================================
-- 0022_item_costs.sql — what each stock item costs today, to price a recipe.
--
-- The product form works out a new recipe's cost while it is being typed, so
-- the owner can see what one serving costs before choosing its prices. For
-- that it needs each item's cost per base unit: the cost a sale is charged
-- today (item_issue_cost at the business's default location, as menu_costing
-- uses), so the cost the form shows is the cost the product's card shows once
-- it is saved. An item never bought has no cost yet (0), and the form says so.
--
-- The cost is sent as text: as a JSON number it would reach the browser
-- rounded to a double, and a serving's cost could then differ by a dinar.
-- Only those who may see costs are given them.
-- =============================================================================

create or replace function item_costs()
returns table (item_id uuid, unit_cost text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_location uuid;
begin
  v_location := default_location(v_business);
  return query
    select i.id, trim_scale(item_issue_cost(v_business, i.id, v_location))::text
      from item i
     where i.business_id = v_business and i.is_active
     order by i.name;
end $$;

revoke execute on function item_costs() from public, anon;
grant execute on function item_costs() to authenticated;
