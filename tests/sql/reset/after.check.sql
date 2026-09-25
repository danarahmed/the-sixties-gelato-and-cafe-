-- =============================================================================
-- After supabase/remediation/reset-test-data.sql (scripts/test-sql.sh, phase
-- "reset"): what the café is set up with is all there, the records of trading
-- are gone and the audit trail says so, and the café trades again from nothing
-- — journals from 1001, its own bill numbers from 0001, the drawer from its
-- float, and each item from the opening stock it is given, at its cost.
-- =============================================================================
\set ON_ERROR_STOP 1
select test.as_admin();

-- The set-up stays.
select test.eq((select count(*) from product where name in ('Golden espresso', 'Golden water'))::int, 2, 'the menu is kept');
select test.eq((select count(*) from channel_price where product_variant_id = 'd1000000-0000-0000-0000-000000000001')::int, 3,
  'with its prices');
select test.ok(exists (select 1 from recipe where name = 'Golden syrup'), 'and the batch recipe made while testing');
select test.eq((select count(*) from item where id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
                                                        'c0000000-0000-0000-0000-000000000003'))::int, 3, 'the stock items are kept');
select test.eq((select count(*) from item_unit where item_id = 'c0000000-0000-0000-0000-000000000001')::int, 1, 'with their units');
select test.ok(exists (select 1 from dining_table where name = 'Table 9'), 'the tables are kept');
select test.ok((select count(*) from supplier where business_id = '00000000-0000-0000-0000-0000000000b1') > 0, 'the suppliers are kept');
select test.eq((select count(*) from app_user where email in ('owner@example.com', 'manager@example.com', 'cashier@example.com',
                                                              'counter@example.com'))::int, 4, 'the people are kept');
select test.ok(exists (select 1 from user_role r join app_user u on u.id = r.app_user_id
                        where u.email = 'owner@example.com' and r.role = 'owner'), 'with their roles');
select test.eq((select count(*) from gl_account where business_id = '00000000-0000-0000-0000-0000000000b1'
                                                  and code in ('1000', '1005', '6300'))::int, 3, 'the chart of accounts is kept');
select test.ok((select pin_hash is not null from app_user where email = 'owner@example.com'), 'and the PIN the owner approves with');
select test.eq((select count(*) from reason_code)::int, 20, 'the list of reasons is kept');
select test.eq((select string_agg(code || ' ' || name, ', ') from app_language), 'tr Türkçe', 'the languages the café added are kept');
select test.eq((select string_agg(locale || ' ' || words, ', ' order by locale) from app_phrase), 'ar احفظ, tr Kaydet',
  'and its own words for phrases');

-- The records of trading are gone, and the audit trail says so.
select test.eq((select count(*) from sales_order) + (select count(*) from journal_entry) + (select count(*) from inventory_movement)
               + (select count(*) from cash_event) + (select count(*) from pos_tab) + (select count(*) from work_shift)
               + (select count(*) from accounting_period) + (select count(*) from document_counter), 0::bigint,
  'no sale, journal, stock movement, cash event, open bill, drawer count, period or number is left');
select test.eq((select count(*) from approval) + (select count(*) from pin_attempt), 0::bigint,
  'nor any approval, or PIN typed, while testing');
select test.eq((select count(*) from alert)::int, 0, 'nor the alerts raised on them: they rise again from what is recorded next');
select test.eq((select alert_settings from business where id = '00000000-0000-0000-0000-0000000000b1'),
  '{"margin_target_percent": 65}'::jsonb, 'the alert thresholds are kept');
select test.ok(exists (select 1 from audit_log where action = 'business.reset_test_data' and (after_state ->> 'sales_order')::int = 4),
  'the audit trail records what was cleared');
select test.ok(exists (select 1 from audit_log where action = 'drawer.count'), 'and still holds what happened before it');

-- Trading again, from nothing.
select test.act_as('manager@example.com');
select test.eq((drawer_status() ->> 'needs_start')::boolean, false, 'the drawer needs no starting cash');
select test.eq((drawer_status() ->> 'expected')::numeric, 0::numeric, 'and should hold nothing');
select test.eq((select count(*) from stock_board)::int, 0, 'no item has stock');
select test.act_as('owner@example.com');
create temp table op as select record_opening_stock('c0000000-0000-0000-0000-000000000001', 1, 'kg', 12000, 'the opening count') r;
grant select on op to public;
select record_opening_stock('c0000000-0000-0000-0000-000000000002', 100, null, 50, 'the opening count');
select test.eq((select (r ->> 'journal_no')::int from op), 1001, 'each item is given its opening stock; journals number from 1001 again');

select move_cash('owner', 'till', 10000, 'Float for the till');
select test.eq(next_bill_number(), 'SGC-' || extract(year from test.today()) || '-0001', 'the café''s own bill numbers start again at 0001');

select test.act_as('cashier@example.com');
create temp table sale as select record_sale(gen_random_uuid(), 'takeaway', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb) r;
grant select on sale to public;
select test.as_admin();
select test.eq(test.cogs_of((select (r ->> 'order_id')::uuid from sale)), 290::numeric,
  'the first sale is costed from the opening stock: 20 g of beans at 12 and a cup at 50');

select test.act_as('manager@example.com');
select test.eq((drawer_status() ->> 'expected')::numeric, 12500::numeric, 'the drawer should hold the float and the sale');
create temp table cd as select count_drawer(12500) r;
grant select on cd to public;
select test.eq((select (r ->> 'variance')::numeric from cd), 0::numeric, 'and it counts true');

select test.as_admin();
select test.eq((select count(*) from accounting_period where business_id = '00000000-0000-0000-0000-0000000000b1')::int, 1,
  'the month''s period opens again with the first journal');
select test.eq((select sum(debit) - sum(credit) from journal_line), 0::numeric, 'the books balance');
select test.eq(test.balance('1000'), 12500::numeric, 'the till''s account is what the drawer holds');
select test.eq((select sum(value * sign(base_quantity_signed)) from inventory_movement
                 where business_id = '00000000-0000-0000-0000-0000000000b1'), test.balance('1200'),
  'and the stock ledger reconciles to 1200');
