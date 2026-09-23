-- =============================================================================
-- 0016_access_control.sql — who can see and do what (audit C-01, H-06).
--
-- Before this migration the public anon key — published in every page — could
-- read the whole business and insert, update and delete journals, sales,
-- stock and periods (every one of those was reproduced; see
-- tests/sql/harness/reproduce_audit.sql). Even the "tenant_isolation"
-- policies from 0007 allowed signed-in users to write directly, and child
-- tables were readable across businesses.
--
-- After it:
--   * anon can do nothing at all;
--   * a signed-in, ACTIVE member can READ their own business's rows, and only
--     the rows their role may see — costs and the ledger need cost.view, the
--     audit trail needs audit.view;
--   * nobody writes a table directly. Every change goes through the
--     permission-checked functions of 0015, which are the only functions
--     granted to signed-in users;
--   * columns that must never reach a browser (PIN hashes, auth ids, the
--     expected quantity of a blind count) are not granted at all;
--   * defaults are reversed, so a table or function added later is closed
--     until it is deliberately opened.
-- =============================================================================

-- =============================================================================
-- 1. Identity: only ACTIVE members count
-- =============================================================================
-- 0007's versions ignored is_active, so a deactivated employee could still
-- read the books.
create or replace function current_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from app_user where auth_user_id = auth.uid() and is_active limit 1
$$;

create or replace function current_business_id() returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from app_user where auth_user_id = auth.uid() and is_active limit 1
$$;

create or replace function current_has_role(target app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_role ur join app_user au on au.id = ur.app_user_id
                  where au.auth_user_id = auth.uid() and au.is_active and ur.role = target)
$$;

-- =============================================================================
-- 2. Close everything
-- =============================================================================
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Supabase grants new objects to anon/authenticated by default. Reverse that:
-- anything added later stays closed until it is opened on purpose.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
-- PostgreSQL's EXECUTE-to-PUBLIC on new functions is a GLOBAL default; a
-- per-schema revoke cannot remove it, so it must be revoked globally too.
alter default privileges revoke execute on functions from public;

do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- =============================================================================
-- 3. Read access, by what the role may see
-- =============================================================================
-- (select fn()) makes PostgreSQL evaluate the helper once per query rather
-- than once per row.
do $$
declare
  t text;
  -- Any active member of the business: the catalogue, the chart, the
  -- periods, the people. Nothing here reveals a cost or a margin.
  member_tables text[] := array[
    'location', 'item', 'item_unit', 'product', 'product_category', 'product_variant',
    'channel_price', 'delivery_platform', 'promotion', 'gl_account', 'accounting_period',
    'expense_category', 'user_role', 'stock_count', 'stock_count_line'];
  -- Costs, margins, suppliers, sales detail and the ledger: cost.view.
  cost_tables text[] := array[
    'inventory_movement', 'item_lot', 'recipe', 'recipe_version', 'recipe_line', 'variant_recipe',
    'supplier', 'purchase_order', 'purchase_order_line', 'goods_receipt', 'goods_receipt_line',
    'purchase_invoice', 'supplier_payment', 'production_batch', 'sales_order', 'sales_order_line',
    'sales_tender', 'sale_adjustment', 'work_shift', 'sync_log', 'platform_order',
    'platform_product_map', 'platform_store_map', 'platform_settlement', 'platform_settlement_line',
    'reconciliation_issue', 'journal_entry', 'journal_line', 'expense', 'ai_insight', 'document_counter'];
  -- The audit trail: audit.view.
  audit_tables text[] := array['audit_log', 'ai_interaction_log'];
begin
  foreach t in array member_tables loop
    execute format($p$create policy member_read on %I for select to authenticated
                      using (business_id = (select current_business_id()))$p$, t);
  end loop;
  foreach t in array cost_tables loop
    execute format($p$create policy cost_read on %I for select to authenticated
                      using (business_id = (select current_business_id())
                             and (select current_has_permission('cost.view')))$p$, t);
  end loop;
  foreach t in array audit_tables loop
    execute format($p$create policy audit_read on %I for select to authenticated
                      using (business_id = (select current_business_id())
                             and (select current_has_permission('audit.view')))$p$, t);
  end loop;
  foreach t in array member_tables || cost_tables || audit_tables loop
    if t not in ('app_user', 'stock_count_line') then
      execute format('grant select on %I to authenticated', t);
    end if;
  end loop;
end $$;

create policy member_read on business for select to authenticated
  using (id = (select current_business_id()));
grant select on business to authenticated;

create policy member_read on app_user for select to authenticated
  using (business_id = (select current_business_id()));
-- Colleagues see names, never PIN hashes, auth ids or email addresses.
grant select (id, business_id, full_name, is_active) on app_user to authenticated;

-- A blind count stays blind: the expected quantity is not granted to anyone
-- signed in. Reviewers read it through review_stock_count().
grant select (id, stock_count_id, item_id, counted_base, adjustment_movement_id, recount_requested, business_id)
  on stock_count_line to authenticated;

create policy reference_read on role_permission for select to authenticated using (true);
grant select on role_permission to authenticated;

-- Views read through the caller's own policies (security_invoker).
grant select on current_stock, stock_board to authenticated;

-- =============================================================================
-- 4. People: invitations, roles, and linking a login to a person
-- =============================================================================
-- Who am I, what may I do — safe to hand to the browser.
create or replace function my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when m.id is null then null else jsonb_build_object(
    'id', m.id, 'name', m.full_name, 'business_id', m.business_id,
    'business_name', (select name from business where id = m.business_id),
    'roles', coalesce((select jsonb_agg(role order by role) from user_role where app_user_id = m.id), '[]'),
    'permissions', coalesce((select jsonb_agg(distinct rp.permission order by rp.permission)
                               from user_role ur join role_permission rp on rp.role = ur.role
                              where ur.app_user_id = m.id), '[]'))
  end
  from (select * from app_user where auth_user_id = auth.uid() and is_active limit 1) m
  right join (select 1) one on true
$$;

-- Owners and general managers add people by email and role. The login is
-- linked when that person signs in with a CONFIRMED email of that address.
create or replace function invite_member(p_email text, p_name text, p_roles app_role[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage'); v_id uuid; r app_role;
begin
  if nullif(trim(p_email), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'Give the person''s name and email';
  end if;
  if p_roles is null or cardinality(p_roles) = 0 then raise exception 'Give the person at least one role'; end if;
  if ('owner' = any(p_roles) or 'general_manager' = any(p_roles)) and not current_has_role('owner') then
    raise exception 'Only the owner can appoint an owner or general manager' using errcode = '42501';
  end if;
  if exists (select 1 from app_user where business_id = v_business and lower(email::text) = lower(trim(p_email))) then
    raise exception 'Someone with that email is already a member';
  end if;
  insert into app_user (business_id, full_name, email) values (v_business, trim(p_name), lower(trim(p_email)))
  returning id into v_id;
  foreach r in array p_roles loop
    insert into user_role (app_user_id, role) values (v_id, r);
  end loop;
  perform audit_event(v_business, 'member.invite', 'app_user', v_id::text, null, null,
                      jsonb_build_object('email', lower(trim(p_email)), 'roles', p_roles));
  return v_id;
end $$;

create or replace function set_member_active(p_member uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage');
begin
  if p_member = current_app_user_id() then raise exception 'You cannot deactivate yourself'; end if;
  if not p_active and exists (select 1 from user_role where app_user_id = p_member and role = 'owner')
     and (select count(*) from user_role ur join app_user au on au.id = ur.app_user_id
           where au.business_id = v_business and au.is_active and ur.role = 'owner') <= 1 then
    raise exception 'The business must keep at least one active owner';
  end if;
  update app_user set is_active = p_active where id = p_member and business_id = v_business;
  if not found then raise exception 'Member not found'; end if;
  perform audit_event(v_business, case when p_active then 'member.activate' else 'member.deactivate' end,
                      'app_user', p_member::text);
end $$;

-- Link a confirmed login to the invited person with that email. Confirmation
-- matters: without it, anyone could sign up with the owner's address first.
create or replace function link_confirmed_login() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.email_confirmed_at is not null then
    update app_user set auth_user_id = NEW.id
     where auth_user_id is null and lower(email::text) = lower(NEW.email);
  end if;
  return NEW;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at') then
    execute 'drop trigger if exists on_auth_user_confirmed on auth.users';
    execute 'create trigger on_auth_user_confirmed after insert or update of email_confirmed_at on auth.users
             for each row execute function public.link_confirmed_login()';
  end if;
end $$;

-- =============================================================================
-- 5. The API: the only functions a signed-in person may call
-- =============================================================================
-- Each checks the caller's permission itself (0015). Nothing else is exposed:
-- not the journal builder, not the counters, not the audit writer. The revoke
-- runs last, so it covers every function above, including this migration's.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid),
  void_sale(uuid, text),
  refund_sale(uuid, text),
  receive_goods(uuid, jsonb, numeric, numeric, numeric, text, uuid),
  record_bill(uuid, text, date, numeric, int, uuid, text),
  pay_bill(uuid, numeric, text),
  record_expense(text, numeric, text, text, date),
  record_waste(uuid, numeric, text, movement_type, text, uuid),
  adjust_stock(uuid, numeric, text, text, numeric, uuid),
  create_supplier(text, text, text),
  create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric, numeric, boolean),
  create_product(text, jsonb, jsonb, text, text, uuid),
  set_price(uuid, sales_channel, numeric, date),
  new_recipe_version(uuid, jsonb, date),
  start_stock_count(uuid[], uuid),
  record_count(uuid, uuid, numeric, text),
  submit_stock_count(uuid),
  review_stock_count(uuid),
  approve_stock_count(uuid),
  reject_stock_count(uuid, text),
  close_day(date, numeric, numeric, uuid),
  save_journal(date, text, jsonb, boolean, text, date),
  publish_journal(uuid),
  discard_journal(uuid),
  reverse_journal(uuid, text, date),
  period_close_checklist(uuid),
  lock_period(uuid, text),
  unlock_period(uuid, text)
to authenticated;

-- Helpers that row policies and the screens need to evaluate.
grant execute on function
  current_app_user_id(), current_business_id(), current_has_role(app_role),
  current_has_permission(text), current_can_view_costs()
to authenticated;

-- People.
grant execute on function my_profile(), invite_member(text, text, app_role[]), set_member_active(uuid, boolean)
  to authenticated;
