-- =============================================================================
-- 0009_demo_read_access.sql — PUBLIC READ for the labelled DEMO business only.
--
-- This lets the deployed demo read live data with the public anon key BEFORE
-- user authentication is wired. It is intentionally scoped to the single demo
-- business id and to SELECT only. RLS still blocks all writes and every
-- non-demo row.
--
-- ⚠️ BEFORE serving real, private business data: DROP these `demo_public_read`
-- policies and rely on `tenant_isolation` (per-user JWT) instead.
-- =============================================================================

-- Derived views must respect the CALLER's RLS, not the view owner's, so the
-- demo-only policies below actually constrain what anon can read.
alter view current_stock set (security_invoker = on);
alter view stock_board set (security_invoker = on);

create policy demo_public_read on item
  for select using (business_id = '00000000-0000-0000-0000-0000000000b1');
create policy demo_public_read on inventory_movement
  for select using (business_id = '00000000-0000-0000-0000-0000000000b1');
create policy demo_public_read on product
  for select using (business_id = '00000000-0000-0000-0000-0000000000b1');
create policy demo_public_read on product_variant
  for select using (
    product_id in (select id from product where business_id = '00000000-0000-0000-0000-0000000000b1')
  );
create policy demo_public_read on channel_price
  for select using (business_id = '00000000-0000-0000-0000-0000000000b1');

grant usage on schema public to anon, authenticated;
grant select on item, inventory_movement, product, product_variant, channel_price,
  current_stock, stock_board to anon, authenticated;
