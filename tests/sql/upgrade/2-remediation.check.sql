-- =============================================================================
-- The remediation procedure of docs/REMEDIATION.md, applied to the
-- production-shaped history: every correction is a new, dated, audited entry;
-- nothing recorded before the controls is edited or deleted. At the end every
-- subledger agrees with its control account and August locks.
--
-- Runs after 1-history.check.sql, on the same upgraded database.
-- =============================================================================
select test.as_admin();
create temp table dup_bill as
  select id from purchase_invoice where invoice_no = 'INV-2207' order by invoice_date desc, created_at desc limit 1;
grant select on dup_bill to public;

select test.act_as('owner@example.com');

-- Before: the damage, as the reconciliation reports it.
select test.eq((select string_agg(check_key || '=' || difference, ',' order by check_key) from report_reconciliation('2026-08-31')),
  'grni=0,inventory=-169610,payables=110000,sales=0', 'before: the legacy damage is visible');
select test.throws($$select lock_period((select id from accounting_period where name = '2026-08'))$$,
  '%cannot be locked yet%', 'before: August cannot be locked over it');

-- Step 0. Stock the old app moved but never journaled: post the journals the
-- new app writes for the same records, each dated when it happened.
select test.eq((select (r ->> 'posted')::int from (select post_legacy_unposted('Opening stock, a delivery and a count variance the old app never journaled') r) x),
  3, 'the three unjournaled records are posted');
select test.throws($$select post_legacy_unposted('again')$$, '%nothing left%', 'and cannot be posted twice');
select test.eq((select string_agg(check_key || '=' || difference, ',' order by check_key) from report_reconciliation('2026-08-31')),
  'grni=0,inventory=-219060,payables=110000,sales=0', 'what remains is the damage in the ledger itself');

-- Step 1. A raced duplicate journal: reverse it.
select reverse_journal('11111111-0000-0000-0000-000000000003',
  'Raced duplicate of the receipt journal for Erbil Dairy Supply', '2026-08-31');

-- Step 2. A purchase counted twice — the receipt's auto-post AND the bill both
-- debited Inventory: reverse the receipt's, so the bill carries the purchase.
select reverse_journal('11111111-0000-0000-0000-000000000002',
  'Receipt and bill both debited Inventory; bill INV-2207 carries this purchase', '2026-08-31');

-- Step 3. An invoice entered twice: cancel the copy.
select cancel_bill((select id from dup_bill), 'INV-2207 was entered twice', '2026-08-31');

-- Step 3b. The invoices for two deliveries arrive. The one the old app posted
-- straight to payables is billed against that payable: only the 2,000
-- difference in price is posted. The one whose journal was posted in step 0
-- is billed like any receipt, clearing its GRNI.
create temp table legacy_bill as select record_bill((select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' order by name limit 1),
  'INV-3001', '2026-08-20', 52000, 0, '22222222-0000-0000-0000-000000000003', null) as r;
select record_bill((select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' order by name limit 1),
  'INV-3002', '2026-08-21', 30000, 0, '22222222-0000-0000-0000-000000000002', null);
select test.eq((select (r ->> 'price_variance')::numeric from legacy_bill), 2000::numeric,
  'the old receipt''s bill posts only its price difference');
select test.eq(test.lines_of((select id from purchase_invoice where invoice_no = 'INV-3001')),
  '2000 Cr 2000 | 5050 Dr 2000', 'Dr purchase price variance, Cr payables, 2,000 — the rest was posted on receipt');

-- Step 4. A sale whose cost reached the ledger but whose stock movement was
-- never written: the owner's control correction, with the reason recorded.
select post_control_correction('2026-08-31', 'Sale 44444444: cost credited to Inventory with no stock movement',
  '[{"code":"1200","debit":940},{"code":"5000","credit":940}]',
  'The old till wrote the journal but not the movement; the next count takes the stock out');

-- Step 5. Card takings the old till debited to Cash: reclassify. The till's
-- cash takes no manual journal (0024); the owner corrects it, with a reason.
select post_control_correction('2026-08-31', 'Card takings of sale 44444444, posted to Cash by the old till',
  '[{"code":"1010","debit":4000},{"code":"1000","credit":4000}]',
  'The old till posted a card sale to cash');

-- Step 6. A draft left parked: publish it or discard it.
select discard_journal('11111111-0000-0000-0000-000000000007');

-- After: every subledger agrees, and August locks.
select test.eq((select string_agg(check_key || '=' || difference, ',' order by check_key) from report_reconciliation('2026-08-31')),
  'grni=0,inventory=0,payables=0,sales=0', 'after: every subledger agrees with its control account');
select test.eq((select count(*) from period_close_checklist((select id from accounting_period where name = '2026-08')) where not ok)::int,
  0, 'after: every closing check passes');
select lock_period((select id from accounting_period where name = '2026-08'), 'Legacy history reconciled (docs/REMEDIATION.md)');

select test.as_admin();
select test.eq((select status::text from accounting_period where name = '2026-08'), 'locked', 'August is locked');
select test.eq(test.balance('1010'), 4000::numeric, 'card takings now sit in Card clearing');
select test.eq((select count(*) from test.legacy_lines l
                join test.legacy_entries e on e.id = l.journal_entry_id and e.status = 'published'
                where not exists (select 1 from journal_line j
                                  where j.journal_entry_id = l.journal_entry_id and j.account_id = l.account_id
                                    and j.debit = l.debit and j.credit = l.credit))::int,
               0, 'and not one published line recorded before the controls was changed to get here');
select test.eq((select count(*) from purchase_invoice where invoice_no = 'INV-2207')::int, 2,
  'the duplicate invoice is still on record, marked cancelled');
select test.eq((select count(*) from audit_log where action in ('journal.reverse', 'bill.cancel', 'journal.control_correction',
                                                              'legacy.post_unposted'))::int,
  6, 'and every correction is on the audit trail');

-- Drawer counts begin (0024). The old app counted by day, so the first drawer
-- count is told what the drawer held when it began; from then on each count
-- starts from what the last one left.
select test.act_as('manager@example.com');
select test.eq((drawer_status() ->> 'needs_start')::boolean, true, 'after days closed the old way, the drawer''s start is not known');
select test.throws($$select count_drawer(10000)$$, '%Enter the cash that was in the drawer%', 'so the first count asks for it');
create temp table first_count as select count_drawer(10000, null, null, 10000) as r;
select test.eq((select (r ->> 'variance')::numeric from first_count), 0::numeric, 'and counts against what it began with');
select test.eq((drawer_status() ->> 'needs_start')::boolean, false, 'from then on, each count starts from the last');
select test.eq((drawer_status() ->> 'expected')::numeric, 10000::numeric, 'with what it left in the drawer');
