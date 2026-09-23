-- =============================================================================
-- clean-start.sql: clear a trial database before the upgrade (migration 0014).
--
-- For a database whose records are test data, not trading. It keeps each
-- business, its locations, its chart of accounts and its owners, and removes
-- everything else: sales, stock and its movements, purchases, bills, payments,
-- expenses, journals, periods, counts, the catalogue, suppliers, every person
-- who is not an owner, and the logs. The books then start at zero, and the
-- upgrade finds no pre-control history to mark or correct.
--
-- Run it as the database owner (Supabase: the SQL editor), in the same sitting
-- as the upgrade and immediately before migration 0014, so nothing is recorded
-- in between. It is one transaction: it either finishes and passes its own
-- checks, or changes nothing. Running it twice does no harm.
--
-- It refuses to run once 0014 is applied. From then on the records are the
-- books, and they are corrected (docs/REMEDIATION.md), never cleared.
--
-- Logins (auth.users) are not touched. The owner keeps their row: set its
-- email to the owner's real address before they sign up
-- (docs/guides/deployment.md).
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'journal_entry' and column_name = 'legacy') then
    raise exception 'clean-start: migration 0014 is already applied. These are the books now: correct them (docs/REMEDIATION.md), do not clear them.';
  end if;
  if exists (
    select 1 from business b
     where exists (select 1 from app_user u where u.business_id = b.id)
       and not exists (select 1 from app_user u join user_role r on r.app_user_id = u.id
                        where u.business_id = b.id and u.is_active and r.role = 'owner')) then
    raise exception 'clean-start: a business has people but no active owner; nobody could run its books afterwards.';
  end if;
end $$;

-- Every record, in one statement. TRUNCATE bypasses the row triggers that keep
-- the ledger append-only, and fails, changing nothing, if a table left out
-- still refers to one of these.
truncate table
  accounting_period, ai_insight, ai_interaction_log, audit_log, channel_price,
  delivery_platform, expense, expense_category, goods_receipt, goods_receipt_line,
  inventory_movement, item, item_lot, item_unit, journal_entry, journal_line,
  platform_order, platform_product_map, platform_settlement, platform_settlement_line,
  platform_store_map, product, product_category, product_variant, production_batch,
  promotion, purchase_invoice, purchase_order, purchase_order_line, recipe,
  recipe_line, recipe_version, reconciliation_issue, sale_adjustment, sales_order,
  sales_order_line, sales_tender, stock_count, stock_count_line, supplier,
  supplier_payment, sync_log, variant_recipe, work_shift
  restart identity;

-- Journals number from 1001 again.
do $$
begin
  if to_regclass('public.journal_no_seq') is not null then
    perform setval('public.journal_no_seq', 1001, false);
  end if;
end $$;

-- People: only the owners stay. Everyone else's roles go with them.
delete from app_user u
 where not exists (select 1 from user_role r where r.app_user_id = u.id and r.role = 'owner');

-- The first line of the new audit trail says why the books start empty.
insert into audit_log (business_id, action, entity_type, entity_id, reason)
select id, 'business.clean_start', 'business', id::text,
       'Trial records cleared before go-live (supabase/remediation/clean-start.sql)'
  from business;

-- Prove it: every other table is empty, and only owners are left.
do $$
declare t text; n bigint;
begin
  for t in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind in ('r', 'p')
              and c.relname not in ('business', 'location', 'gl_account', 'app_user', 'user_role', 'audit_log')
  loop
    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then
      raise exception 'clean-start: % still has % row(s); nothing was changed', t, n;
    end if;
  end loop;
  if exists (select 1 from app_user u
              where not exists (select 1 from user_role r where r.app_user_id = u.id and r.role = 'owner')) then
    raise exception 'clean-start: someone other than an owner is left; nothing was changed';
  end if;
  if (select count(*) from audit_log) <> (select count(*) from business) then
    raise exception 'clean-start: the audit trail is not as expected; nothing was changed';
  end if;
end $$;

commit;
