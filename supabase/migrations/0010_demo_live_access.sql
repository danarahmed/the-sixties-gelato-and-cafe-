-- =============================================================================
-- 0010_demo_live_access.sql — LIVE read + write for the labelled DEMO business.
--
-- Supersedes the read-only 0009 policies. Until Supabase Auth is wired, the app
-- ships the PUBLIC anon key and every screen reads AND writes the single demo
-- business through these policies. RLS still blocks all non-demo rows, and the
-- append-only triggers (forbid_mutation / forbid_financial_edit) still make the
-- ledger and journal immutable — writes here are INSERTs only.
--
-- ⚠️ BEFORE serving real, multi-tenant data: DROP the `demo_rw_*` policies and
-- rely on `tenant_isolation` (per-user JWT) instead.
-- =============================================================================

-- Remove the narrower read-only demo policies from 0009; 0010 replaces them.
drop policy if exists demo_public_read on item;
drop policy if exists demo_public_read on inventory_movement;
drop policy if exists demo_public_read on product;
drop policy if exists demo_public_read on product_variant;
drop policy if exists demo_public_read on channel_price;

-- Derived views must respect the CALLER's RLS (idempotent — set in 0009 too).
alter view current_stock set (security_invoker = on);
alter view stock_board set (security_invoker = on);

do $$
declare
  demo constant text := '00000000-0000-0000-0000-0000000000b1';
  t text;
  has_biz boolean;
  -- Tables the demo may READ (select). Excludes app_user/user_role/audit logs.
  read_tables text[] := array[
    'location','item','item_unit','product_category','product','product_variant',
    'recipe','recipe_version','recipe_line','variant_recipe','channel_price',
    'item_lot','inventory_movement','supplier','purchase_order','purchase_order_line',
    'goods_receipt','goods_receipt_line','purchase_invoice','production_batch',
    'stock_count','stock_count_line','sales_order','sales_order_line','sales_tender',
    'sale_adjustment','work_shift','sync_log','delivery_platform','platform_store_map',
    'platform_product_map','promotion','platform_order','platform_settlement',
    'platform_settlement_line','reconciliation_issue','gl_account','accounting_period',
    'journal_entry','journal_line','expense_category','expense','ai_insight'
  ];
  -- Tables the demo may WRITE (insert). Scaffold tables (location, gl_account,
  -- accounting_period) stay read-only.
  write_tables text[] := array[
    'item','item_unit','product_category','product','product_variant',
    'recipe','recipe_version','recipe_line','variant_recipe','channel_price',
    'item_lot','inventory_movement','supplier','purchase_order','purchase_order_line',
    'goods_receipt','goods_receipt_line','purchase_invoice','production_batch',
    'stock_count','stock_count_line','sales_order','sales_order_line','sales_tender',
    'sale_adjustment','work_shift','sync_log','delivery_platform','platform_store_map',
    'platform_product_map','promotion','platform_order','platform_settlement',
    'platform_settlement_line','reconciliation_issue','journal_entry','journal_line',
    'expense_category','expense','ai_insight'
  ];
begin
  foreach t in array read_tables loop
    has_biz := exists (
      select 1 from information_schema.columns
      where table_name = t and column_name = 'business_id'
    );
    execute format('drop policy if exists demo_rw_sel on %I', t);
    if has_biz then
      execute format(
        'create policy demo_rw_sel on %I for select using (business_id = %L)', t, demo);
    else
      -- Child tables (no business_id): reachable only via their demo parent in a
      -- single-tenant demo; a permissive read is acceptable here.
      execute format('create policy demo_rw_sel on %I for select using (true)', t);
    end if;
    execute format('grant select on %I to anon, authenticated', t);
  end loop;

  foreach t in array write_tables loop
    has_biz := exists (
      select 1 from information_schema.columns
      where table_name = t and column_name = 'business_id'
    );
    execute format('drop policy if exists demo_rw_ins on %I', t);
    if has_biz then
      execute format(
        'create policy demo_rw_ins on %I for insert with check (business_id = %L)', t, demo);
    else
      execute format('create policy demo_rw_ins on %I for insert with check (true)', t);
    end if;
    execute format('grant insert on %I to anon, authenticated', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on current_stock, stock_board to anon, authenticated;
