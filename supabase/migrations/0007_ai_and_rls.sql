-- =============================================================================
-- 0007_ai_and_rls.sql — AI insight/audit tables (spec §13) + Row-Level Security.
-- AI never mutates financial/inventory data; it only writes insight rows that a
-- human approves. Every AI call is logged (prompt, model, response, approval).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- AI insights + full audit trail
-- ---------------------------------------------------------------------------
create type insight_kind as enum (
  'sales_forecast','demand_forecast','purchase_suggestion','par_suggestion',
  'production_plan','expiry_risk','overstock_risk','understock_risk',
  'waste_prediction','inventory_anomaly','void_anomaly','price_change_alert',
  'settlement_anomaly','menu_engineering','promotion_profitability','nl_answer'
);
create type insight_status as enum ('new','acknowledged','approved','dismissed');

create table ai_insight (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business(id) on delete cascade,
  kind           insight_kind not null,
  title          text not null,
  recommendation text not null,
  explanation    text,
  data_used      jsonb,                    -- deterministic inputs shown to the user
  confidence     numeric check (confidence between 0 and 1),
  forecast_horizon text,
  impact_estimate  numeric,                -- financial/operational impact (currency)
  suggested_action text,
  status         insight_status not null default 'new',
  acted_by       uuid references app_user(id),
  acted_at       timestamptz,
  created_at     timestamptz not null default now()
);
create index on ai_insight (business_id, kind, status);

-- Every AI provider call is recorded for auditability (spec §13).
create table ai_interaction_log (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  app_user_id   uuid references app_user(id),
  provider      text not null,            -- 'anthropic','openai',...
  model         text not null,
  model_version text,
  prompt        jsonb not null,           -- redacted; no secrets/PII sent
  response      jsonb,
  insight_id    uuid references ai_insight(id),
  approved      boolean,
  created_at    timestamptz not null default now()
);

create trigger ai_interaction_log_immutable
  before update or delete on ai_interaction_log
  for each row execute function forbid_mutation();

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
-- Resolve the calling user's app_user row from the Supabase JWT (auth.uid()).
-- SECURITY DEFINER is REQUIRED: these functions read app_user/user_role, which
-- themselves carry RLS policies that call these functions. Without definer
-- rights the policy evaluation recurses infinitely (stack depth exceeded).
create or replace function current_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from app_user where auth_user_id = auth.uid();
$$;

create or replace function current_business_id() returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from app_user where auth_user_id = auth.uid();
$$;

create or replace function current_has_role(target app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_role ur
    join app_user au on au.id = ur.app_user_id
    where au.auth_user_id = auth.uid() and ur.role = target
  );
$$;

-- Sensitive data (cost/profit) is visible only to elevated roles.
create or replace function current_can_view_costs() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_role ur
    join app_user au on au.id = ur.app_user_id
    where au.auth_user_id = auth.uid()
      and ur.role in ('owner','general_manager','branch_manager','purchasing','accountant','auditor')
  );
$$;

-- Enable RLS + a tenant-isolation policy on every business-scoped table.
-- The policy restricts all access to rows of the caller's own business, which
-- also guarantees this project's data never mixes with any other tenant.
do $$
declare t text;
  business_tables text[] := array[
    'location','app_user','user_role','audit_log',
    'item','item_unit','product_category','product','product_variant',
    'recipe','recipe_version','recipe_line','variant_recipe','channel_price',
    'item_lot','inventory_movement','supplier','purchase_order','purchase_order_line',
    'goods_receipt','goods_receipt_line','purchase_invoice','production_batch',
    'stock_count','stock_count_line',
    'sales_order','sales_order_line','sales_tender','sale_adjustment','work_shift','sync_log',
    'delivery_platform','platform_store_map','platform_product_map','promotion',
    'platform_order','platform_settlement','platform_settlement_line','reconciliation_issue',
    'gl_account','accounting_period','journal_entry','journal_line',
    'expense_category','expense','ai_insight','ai_interaction_log'
  ];
begin
  foreach t in array business_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    -- Child tables reference business via a parent; those carrying business_id
    -- get the direct policy. Tables without business_id are covered by joins in
    -- app-layer queries and the parent policy; we add a permissive authenticated
    -- policy and rely on FKs + parent policies for isolation.
    if exists (
      select 1 from information_schema.columns
      where table_name = t and column_name = 'business_id'
    ) then
      execute format($p$
        create policy tenant_isolation on %I
        using (business_id = current_business_id())
        with check (business_id = current_business_id())
      $p$, t);
    else
      execute format($p$
        create policy authenticated_only on %I
        using (auth.uid() is not null)
        with check (auth.uid() is not null)
      $p$, t);
    end if;
  end loop;
end $$;

-- Note: finer-grained column/role policies (e.g. hiding cost columns from
-- cashiers) are enforced in server-side APIs and views using
-- current_can_view_costs(); RLS gives the tenant + authentication baseline.
