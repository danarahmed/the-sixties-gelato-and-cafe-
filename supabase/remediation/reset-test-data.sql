-- =============================================================================
-- reset-test-data.sql: clear the test records before real trading begins.
--
-- For the live database while every record of trading in it is a test (the
-- owner, 25 September 2026: "All the data been recorded is a test"). It keeps
-- what the café is set up with, and clears everything it did:
--
--   kept     the business and its locations, the chart of accounts, the people
--            and their roles, the menu (products, variants, categories, photos,
--            prices, recipes and their versions), the stock items and their
--            units, suppliers, dining tables, platform and promotion settings,
--            expense categories, and the audit trail (which gains one line
--            saying the test records were cleared, and when)
--   cleared  sales, bills kept open, voids and refunds, drawer counts, cash
--            events and cash moved, stock movements and lots, stock counts,
--            production batches, purchase orders, deliveries, supplier bills and
--            payments, expenses, every journal and accounting period, platform
--            orders and settlements, reconciliation and sync logs, AI notes, and
--            the document numbers (journals start again at 1001, the café's own
--            bill numbers at 0001)
--
-- Afterwards no item has stock. Before the first sale, give each item its
-- opening stock (Inventory → Opening stock): what is on the shelf, at what it
-- cost — otherwise its sales are costed at nothing. Put the float in the till
-- (Sales → Move cash, from the owner or the safe); the first drawer count
-- starts from that.
--
-- Run it as the database owner (Supabase: the SQL editor), in one go, with the
-- confirmation set first in the same session:
--
--     set sixties.reset = 'clear the test records';   -- to clear them
--     set sixties.reset = 'dry run';                  -- to rehearse: it clears,
--         checks, reports what it would clear, then changes nothing
--
-- It is one transaction: it finishes and passes its own checks, or changes
-- nothing. It refuses to run without the confirmation, once any period has
-- been locked (those are closed books, not tests), and when a table it does
-- not know holds records. Logins (auth.users) and the photos in storage are
-- not touched. Running it twice does no harm.
-- =============================================================================
begin;

-- What stays. Every other table in the schema must be empty afterwards.
create temp table reset_keep (t text primary key) on commit drop;
insert into reset_keep values
  ('business'), ('location'), ('gl_account'), ('app_user'), ('user_role'), ('role_permission'),
  ('product'), ('product_variant'), ('product_category'), ('product_image'), ('channel_price'),
  ('recipe'), ('recipe_version'), ('recipe_line'), ('variant_recipe'),
  ('item'), ('item_unit'), ('supplier'), ('dining_table'), ('expense_category'),
  ('delivery_platform'), ('platform_store_map'), ('platform_product_map'), ('promotion'),
  ('audit_log');

do $$
declare v_mode text := coalesce(current_setting('sixties.reset', true), '');
begin
  if v_mode not in ('clear the test records', 'dry run') then
    raise exception 'reset-test-data: nothing was changed. To clear the test records, first run  set sixties.reset = ''clear the test records'';  in the same session (or ''dry run'' to rehearse).';
  end if;
  if exists (select 1 from accounting_period where status = 'locked') then
    raise exception 'reset-test-data: % is locked. Those are closed books, not test records: nothing was changed.',
      (select string_agg(name, ', ' order by starts_on) from accounting_period where status = 'locked');
  end if;
end $$;

-- A fingerprint of everything kept, to prove afterwards that none of it moved.
create temp table reset_before (t text primary key, n bigint, h text, max_id bigint) on commit drop;
create temp table reset_cleared (t text primary key, n bigint) on commit drop;
do $$
declare r record; v_n bigint; v_h text;
begin
  for r in select t from reset_keep order by t loop
    execute format('select count(*), md5(coalesce(string_agg(x::text, %L order by x::text), %L)) from public.%I x',
                   E'\n', '', r.t) into v_n, v_h;
    insert into reset_before values (r.t, v_n, v_h, case when r.t = 'audit_log' then (select max(id) from audit_log) end);
  end loop;
  for r in select c.relname as t from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind in ('r', 'p')
              and c.relname not in (select t from reset_keep) order by 1 loop
    execute format('select count(*) from public.%I', r.t) into v_n;
    insert into reset_cleared values (r.t, v_n);
  end loop;
end $$;

-- Every record of trading, in one statement. TRUNCATE bypasses the row
-- triggers that keep the ledger append-only, and fails, changing nothing, if a
-- table left out still refers to one of these.
truncate table
  accounting_period, ai_insight, ai_interaction_log, cash_event, cash_transfer, document_counter, expense,
  goods_receipt, goods_receipt_line, inventory_movement, item_lot, journal_entry, journal_line,
  platform_order, platform_settlement, platform_settlement_line, pos_tab, pos_tab_line, production_batch,
  purchase_invoice, purchase_order, purchase_order_line, reconciliation_issue, sale_adjustment,
  sales_order, sales_order_line, sales_tender, stock_count, stock_count_line, supplier_payment, sync_log,
  work_shift
  restart identity;

-- Journals number from 1001 again (document_counter above; this older
-- sequence is kept in step with it).
do $$
begin
  if to_regclass('public.journal_no_seq') is not null then
    perform setval('public.journal_no_seq', 1001, false);
  end if;
end $$;

-- The audit trail says what was cleared, and why the books start empty.
insert into audit_log (business_id, action, entity_type, entity_id, reason, after_state)
select b.id, 'business.reset_test_data', 'business', b.id::text,
       'Test records cleared before real trading (supabase/remediation/reset-test-data.sql)',
       (select jsonb_object_agg(t, n order by t) from reset_cleared where n > 0)
  from business b;

-- Prove it: everything cleared is empty, everything kept is exactly as it was,
-- and the books and the drawer start from nothing.
do $$
declare r record; v_n bigint; v_h text; l record; d record;
begin
  for r in select c.relname as t from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind in ('r', 'p')
              and c.relname not in (select t from reset_keep) loop
    execute format('select count(*) from public.%I', r.t) into v_n;
    if v_n > 0 then
      raise exception 'reset-test-data: % still has % row(s), and this script does not know that table. Nothing was changed.', r.t, v_n;
    end if;
  end loop;
  for r in select * from reset_before loop
    if r.t = 'audit_log' then
      select count(*), md5(coalesce(string_agg(x::text, E'\n' order by x::text), '')) into v_n, v_h
        from audit_log x where r.max_id is not null and x.id <= r.max_id;
      if v_n <> r.n or v_h <> r.h
         or (select count(*) from audit_log where r.max_id is null or id > r.max_id) <> (select count(*) from business) then
        raise exception 'reset-test-data: the audit trail is not as it was, plus one line. Nothing was changed.';
      end if;
      continue;
    end if;
    execute format('select count(*), md5(coalesce(string_agg(x::text, %L order by x::text), %L)) from public.%I x',
                   E'\n', '', r.t) into v_n, v_h;
    if v_n <> r.n or v_h <> r.h then
      raise exception 'reset-test-data: % changed, and it should have been kept. Nothing was changed.', r.t;
    end if;
  end loop;
  for l in select b.id as business_id, loc.id as location_id from business b join location loc on loc.business_id = b.id loop
    d := drawer_position(l.business_id, l.location_id);
    if d.last_count_id is not null or d.needs_start or d.carry <> 0 or d.moved <> 0 then
      raise exception 'reset-test-data: the drawer does not start from nothing. Nothing was changed.';
    end if;
  end loop;
end $$;

-- A dry run stops here, and so undoes everything above.
do $$
begin
  if current_setting('sixties.reset', true) = 'dry run' then
    raise exception 'reset-test-data: DRY RUN passed, nothing was changed. It would clear %; everything kept is unchanged.',
      coalesce((select string_agg(t || ' ' || n, ', ' order by t) from reset_cleared where n > 0), 'nothing (already clear)');
  end if;
end $$;

commit;
