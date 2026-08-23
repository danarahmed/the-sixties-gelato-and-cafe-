-- =============================================================================
-- 0008_views.sql — read-friendly views for the app to select from.
-- These join the derived current_stock with item metadata so a screen can read
-- a ready-made "stock board" in one query. Reads go through a server-side
-- service role (RLS baseline stays in place for anon/user access).
-- =============================================================================

create or replace view stock_board as
select
  cs.business_id,
  cs.item_id,
  cs.location_id,
  i.name,
  i.name_ar,
  i.name_ckb,
  i.item_type,
  i.base_unit_code,
  cs.quantity_base,
  abs(cs.value_signed) as value,
  case
    when abs(cs.quantity_base) > 0
      then round(abs(cs.value_signed) / abs(cs.quantity_base), 4)
    else 0
  end as unit_cost,
  i.min_level_base,
  i.par_level_base,
  i.track_expiry,
  (cs.quantity_base < coalesce(i.min_level_base, 0)) as is_low
from current_stock cs
join item i on i.id = cs.item_id;
