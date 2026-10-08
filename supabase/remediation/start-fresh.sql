-- =============================================================================
-- start-fresh.sql: clear the live database to start fresh, setup and all.
--
-- The owner, 4 October 2026: "remove every data in the database i want it to
-- start fresh", choosing to clear the records and the setup, with no copy.
-- Further than reset-test-data.sql, which keeps the setup:
--
--   kept     the business, its places and their cash drawers, the chart of
--            accounts, the logins with their roles and permissions, and the
--            settings: the café's rules and their history, the reasons for
--            voids, refunds, discounts and cancelled bills, the languages and
--            the café's own words, expense categories, the delivery
--            platforms with their stores, and the ways to pay (each with its
--            account)
--   cleared  every record of trading (sales, bills, payments, refunds, stock
--            and its movements, deliveries, purchases, supplier bills and
--            payments, expenses, money moved out of the ways to pay,
--            journals and periods, payroll, the hours
--            clocked, cash sessions, batches, counts, transfers, losses,
--            alerts, the answers kept for retries), and the setup lists: the
--            menu (products, sizes, categories, photos, prices, add-ons,
--            promotions), recipes, stock items and their units, suppliers,
--            staff (their phones too), the shop's clock screens, customers and
--            their addresses, dining tables; and the
--            audit trail, which starts again with one line saying so.
--            Numbers start again: journals at 1001, the rest at 1.
--
-- Afterwards the café is set up again from Products & Recipes, Inventory,
-- Purchasing (suppliers), Staff and the till's tables.
--
-- Run it as the database owner (Supabase: the SQL editor), in one go, with the
-- confirmation set first in the same session:
--
--     set sixties.fresh = 'clear everything';   -- to clear it all
--     set sixties.fresh = 'dry run';            -- to rehearse: it clears,
--         checks, says what it would clear, then changes nothing
--
-- It is one transaction: it finishes and passes its own checks, or changes
-- nothing. It refuses to run without the confirmation, once any month has been
-- locked, and when a table it does not know still holds records. Logins
-- (auth.users) and the files in storage (the menu's photos, attached
-- documents) are not touched. Running it twice does no harm.
-- =============================================================================
begin;

-- What stays. Every other table in the schema must be empty afterwards (but
-- for the audit trail's one new line).
do $$
declare v_mode text := coalesce(current_setting('sixties.fresh', true), '');
begin
  if v_mode not in ('clear everything', 'dry run') then
    raise exception 'start-fresh: nothing was changed. To clear everything, first run  set sixties.fresh = ''clear everything'';  in the same session (or ''dry run'' to rehearse).';
  end if;
end $$;

create temp table fresh_keep (t text primary key) on commit drop;
insert into fresh_keep values
  ('business'), ('location'), ('cash_drawer'), ('gl_account'), ('app_user'), ('user_role'), ('role_permission'),
  ('business_rule'), ('business_rule_history'), ('reason_code'), ('app_language'), ('app_phrase'),
  ('expense_category'), ('delivery_platform'), ('platform_store_map'), ('payment_method'),
  -- Phone warnings (0072): on or off, and each login's phones; what waited is cleared.
  ('push_config'), ('push_device');

do $$
begin
  if exists (select 1 from accounting_period where status = 'locked') then
    raise exception 'start-fresh: % is locked. Those are closed books: nothing was changed.',
      (select string_agg(name, ', ' order by starts_on) from accounting_period where status = 'locked');
  end if;
end $$;

-- A fingerprint of everything kept, and a count of everything cleared.
create temp table fresh_before (t text primary key, n bigint, h text) on commit drop;
create temp table fresh_cleared (t text primary key, n bigint) on commit drop;
do $$
declare r record; v_n bigint; v_h text;
begin
  for r in select t from fresh_keep order by t loop
    execute format('select count(*), md5(coalesce(string_agg(x::text, %L order by x::text), %L)) from public.%I x',
                   E'\n', '', r.t) into v_n, v_h;
    insert into fresh_before values (r.t, v_n, v_h);
  end loop;
  for r in select c.relname as t from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind in ('r', 'p')
              and c.relname not in (select t from fresh_keep) order by 1 loop
    execute format('select count(*) from public.%I', r.t) into v_n;
    insert into fresh_cleared values (r.t, v_n);
  end loop;
end $$;

truncate table
  accounting_period, ai_insight, ai_interaction_log, alert, approval, attendance, audit_log, bank_statement,
  bank_statement_line, card_settlement, cash_event, cash_transfer, channel_price, clock_attempt, clock_screen,
  clock_secret, customer,
  customer_address, dining_table, document_attachment, document_counter, employee, employee_advance, expense,
  fx_cash_event, fx_exchange, fx_rate, goods_receipt, goods_receipt_line, inventory_movement, item, item_lot,
  item_supplier, item_unit, journal_entry, journal_line, loss_review, lot_movement, loyalty_ledger, modifier,
  money_move,
  modifier_group, modifier_price, modifier_recipe_line, payroll_approval, payroll_line, payroll_run, pin_attempt,
  platform_order, platform_product_map, platform_settlement, platform_settlement_line, pos_tab, pos_tab_line,
  pos_tab_line_modifier, prepaid_expense, prepaid_release, product, product_category, product_image,
  product_modifier_group, product_variant, production_batch, promotion, purchase_invoice, purchase_order,
  purchase_order_line, phone_link, push_message, receipt_correction, recipe, recipe_line, recipe_version, reconciliation_issue,
  request_log,
  sale_adjustment, sale_refund, sale_refund_line, sale_refund_tender, salary_payment, salary_payment_line,
  sales_order, sales_order_line, sales_order_line_modifier, sales_tender, session_dollar_count, shift_schedule,
  staff_phone, stock_count, stock_count_line, stock_loss, stock_loss_line, stock_transfer, stock_transfer_line, supplier,
  supplier_credit, supplier_credit_allocation, supplier_payment, supplier_return, supplier_return_line, sync_log,
  variant_recipe, work_shift
  restart identity;

-- Journals number from 1001 again.
do $$
begin
  if to_regclass('public.journal_no_seq') is not null then
    perform setval('public.journal_no_seq', 1001, false);
  end if;
end $$;

-- The new audit trail begins with why it is empty.
insert into audit_log (business_id, action, entity_type, entity_id, reason, after_state)
select b.id, 'business.start_fresh', 'business', b.id::text,
       'Every record and the setup lists cleared at the owner''s request, to start fresh; the logins, places, chart of accounts and settings kept',
       (select jsonb_object_agg(t, n order by t) from fresh_cleared where n > 0)
  from business b;

-- Prove it: everything else is empty, everything kept is exactly as it was,
-- and each drawer starts from nothing.
do $$
declare r record; v_n bigint; v_h text; l record; d record;
begin
  for r in select c.relname as t from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind in ('r', 'p')
              and c.relname not in (select t from fresh_keep) and c.relname <> 'audit_log' loop
    execute format('select count(*) from public.%I', r.t) into v_n;
    if v_n > 0 then
      raise exception 'start-fresh: % still has % row(s); nothing was changed', r.t, v_n;
    end if;
  end loop;
  if (select count(*) from audit_log) <> (select count(*) from business) then
    raise exception 'start-fresh: the audit trail does not begin with the one line; nothing was changed';
  end if;
  for r in select * from fresh_before loop
    execute format('select count(*), md5(coalesce(string_agg(x::text, %L order by x::text), %L)) from public.%I x',
                   E'\n', '', r.t) into v_n, v_h;
    if v_n <> r.n or v_h <> r.h then
      raise exception 'start-fresh: % changed, and it should have been kept; nothing was changed', r.t;
    end if;
  end loop;
  for l in select b.id as business_id, loc.id as location_id from business b join location loc on loc.business_id = b.id loop
    d := drawer_position(l.business_id, l.location_id);
    if d.last_count_id is not null or d.needs_start or d.carry <> 0 or d.moved <> 0 then
      raise exception 'start-fresh: the drawer does not start from nothing; nothing was changed';
    end if;
  end loop;
end $$;

-- A dry run stops here, and so undoes everything above.
do $$
begin
  if current_setting('sixties.fresh', true) = 'dry run' then
    raise exception 'start-fresh: DRY RUN passed, nothing was changed. It would clear %; everything kept is unchanged.',
      coalesce((select string_agg(t || ' ' || n, ', ' order by t) from fresh_cleared where n > 0), 'nothing (already clear)');
  end if;
end $$;

commit;
