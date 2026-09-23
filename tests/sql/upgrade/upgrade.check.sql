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
