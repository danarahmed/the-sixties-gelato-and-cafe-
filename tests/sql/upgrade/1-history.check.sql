-- =============================================================================
-- After applying 0014+ on top of production-shaped history: nothing lost,
-- nothing altered, everything numbered and dated, and all of it now immutable.
-- =============================================================================
select test.as_admin();

-- History is intact.
select test.eq((select count(*) from test.legacy_lines l
                where not exists (select 1 from journal_line j
                                  where j.journal_entry_id = l.journal_entry_id and j.account_id = l.account_id
                                    and j.debit = l.debit and j.credit = l.credit))::int,
               0, 'every legacy journal line survives unchanged');
select test.eq((select count(*) from journal_line)::int, (select count(*) from test.legacy_lines)::int,
               'no journal lines added or removed');
select test.eq((select count(*) from test.legacy_entries l join journal_entry j using (id)
                where (j.description, j.status, j.occurred_at) is distinct from (l.description, l.status, l.occurred_at)
                   or (l.journal_no is not null and j.journal_no is distinct from l.journal_no))::int,
               0, 'legacy entries keep their narration, status, date and existing number');
select test.eq((select count(*) from journal_entry where id in (
                 '11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003'))::int,
               2, 'the raced duplicate receipt journal is kept, not silently deleted');
select test.eq((select count(*) from purchase_invoice where invoice_no = 'INV-2207')::int, 2,
               'the duplicate invoice is kept for review');

-- Every legacy entry is dated into a period, marked legacy, and numbered.
select test.eq((select count(*) from journal_entry where period_id is null)::int, 0, 'every entry has a period');
select test.eq((select count(*) from journal_entry where not legacy)::int, 0, 'all pre-existing entries are marked legacy');
select test.eq((select count(*) from journal_entry where status = 'published' and journal_no is null)::int, 0,
               'every published entry is numbered');
select test.eq((select count(*) from journal_entry where status = 'draft' and journal_no is not null)::int, 0,
               'drafts carry no number');
select test.eq((select count(distinct journal_no) from journal_entry where journal_no is not null)::int,
               (select count(*) from journal_entry where journal_no is not null)::int, 'numbers are unique');
select test.eq((select next_no from document_counter where doc_type = 'journal')::bigint,
               (select max(journal_no) + 1 from journal_entry)::bigint, 'the counter continues after the highest number');

-- The chart is completed without touching existing accounts.
select test.eq((select count(*) from test.legacy_accounts l join gl_account g using (id)
                where (g.code, g.name, g.account_type, g.normal_balance) is distinct from
                      (l.code, l.name, l.account_type, l.normal_balance))::int, 0, 'existing accounts unchanged');
select test.eq((select count(*) from gl_account where business_id = '00000000-0000-0000-0000-0000000000b1'
                and code in ('2050', '3100', '3200', '4200', '5050', '5400', '6900', '1020'))::int, 8,
               'GRNI, retained earnings, drawings, returns, PPV, count variance, other, bank are added');

-- Tenant columns were backfilled.
select test.eq((select count(*) from journal_line where business_id is null)::int, 0, 'journal_line.business_id filled');
select test.eq((select count(*) from sales_tender where business_id is null)::int, 0, 'sales_tender.business_id filled');

-- And history is now read-only.
select test.throws($$update journal_entry set description = 'x' where id = '11111111-0000-0000-0000-000000000005'$$,
                   '%published and cannot be changed%', 'a legacy published entry cannot be edited');
select test.throws($$delete from journal_line where journal_entry_id = '11111111-0000-0000-0000-000000000005'$$,
                   '%published journal%', 'a legacy entry''s lines cannot be deleted');
select test.throws($$update sales_order set cogs_amount = 1 where id = '44444444-0000-0000-0000-000000000001'$$,
                   '%immutable%', 'a legacy sale''s COGS cannot be rewritten');

-- The reconciliation report makes the damaged history visible, to the dinar.
-- Stock ledger: receipts of 110,000, 30,000 and 50,000, opening sugar of
-- 20,000, less a count variance of 550: 209,450. Inventory (1200) was debited
-- 110,000 by the first receipt, 110,000 again by its raced duplicate, 110,000
-- by the bill (C-05) and 50,000 by the third receipt, and credited 940 by a
-- sale whose stock movement was never written: 379,060. Of the -169,610,
-- 49,450 is stock the old app never journaled (listed for the owner to post)
-- and -219,060 is damage in the ledger itself.
-- Payables: two copies of INV-2207 (M-07) = 220,000 unpaid, plus what the old
-- app posted to 2000 for receipts still awaiting a bill — the first receipt
-- twice, the third once = 270,000; while 2000 was credited 380,000.
select test.act_as('owner@example.com');
create temp table rec as select * from report_reconciliation('2026-08-31');
select test.eq((select difference from rec where check_key = 'inventory'), -169610::numeric,
  'the legacy damage and the unjournaled stock show as a -169,610 inventory difference');
select test.eq((select difference from rec where check_key = 'payables'), 110000::numeric,
  'and a +110,000 payables difference: the duplicate invoice');
select test.eq((select difference from rec where check_key = 'grni'), 0::numeric,
  'a receipt posted straight to payables is not mistaken for goods received not invoiced');

-- The stock records the old app never journaled are listed, each with the
-- journal the new app writes for the same record — and nothing is posted
-- until the owner says so.
select test.eq((select string_agg(kind || ' ' || amount || ': ' || (select string_agg(x ->> 'code' ||
                  case when (x ->> 'debit')::numeric > 0 then ' Dr ' || (x ->> 'debit') else ' Cr ' || (x ->> 'credit') end, ' | ')
                  from jsonb_array_elements(lines) x), ' / ' order by at) from legacy_unposted()),
  'opening_stock 20000: 1200 Dr 20000 | 3000 Cr 20000 / goods_received 30000: 1200 Dr 30000 | 2050 Cr 30000'
  ' / count_variance 550: 5400 Dr 550 | 1200 Cr 550',
  'opening stock, a delivery and a count variance await their journals');
select test.act_as('manager@example.com');
select test.throws($$select post_legacy_unposted('tidy up')$$, '%permission%', 'only the owner may post them');
select test.eq((select count(*) from report_unclosed_days())::int, 0,
  'no trading day is left to close: the old app''s closes are recognised');
select test.as_admin();

-- Days the old app closed still count; a day it closed twice counts once.
select test.eq((select count(*) from work_shift where business_day = '2026-08-10')::int, 1,
  'the first close of 2026-08-10 carries its day; the duplicate close does not count twice');
select test.eq((select count(*) from work_shift)::int, 2, 'and both closes stay on record');
