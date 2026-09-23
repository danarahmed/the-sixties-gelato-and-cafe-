-- =============================================================================
-- Manual journals: drafts, publishing, reversal as the only correction, and
-- subledger accounts closed to manual posting.
-- =============================================================================
select test.as_admin();
create temp table today as select business_local_date('00000000-0000-0000-0000-0000000000b1', now()) d;
grant select on today to public;

select test.act_as('cashier@example.com');
select test.throws($$select save_journal((select d from today), 'x', '[{"code":"6200","debit":5},{"code":"1000","credit":5}]', true)$$,
  '%permission%', 'a cashier cannot post journals');

select test.act_as('owner@example.com');
-- An out-of-balance draft may be parked, but not published.
create temp table d1 as select save_journal((select d from today), 'Accrual',
  '[{"code":"6200","debit":25000},{"code":"1000","credit":20000}]', false) as r;
grant select on d1 to public;
select test.eq((select r->>'journal_no' from d1), null, 'a draft has no number');
select test.throws($$select publish_journal((select (r->>'id')::uuid from d1))$$, '%unbalanced%', 'an unbalanced draft cannot be published');
select test.throws($$select save_journal((select d from today), 'Accrual', '[{"code":"6200","debit":25000},{"code":"1000","credit":20000}]', true)$$,
  '%differ by 5000%', 'publishing out of balance says by how much');

-- Accounts with a subledger are closed to manual journals.
select test.throws($$select save_journal((select d from today), 'fudge', '[{"code":"1200","debit":5},{"code":"1000","credit":5}]', true)$$,
  '%subledger%', 'no manual journal to Inventory');
select test.throws($$select save_journal((select d from today), 'fudge', '[{"code":"2000","debit":5},{"code":"1000","credit":5}]', true)$$,
  '%subledger%', 'no manual journal to Accounts payable');
select test.throws($$select save_journal((select d from today), 'fudge', '[{"code":"3100","debit":5},{"code":"1000","credit":5}]', true)$$,
  '%subledger%', 'no manual journal to Retained earnings');

-- A proper one: owner capital introduced.
create temp table j1 as select save_journal((select d from today), 'Owner capital introduced',
  '[{"code":"1000","debit":5000000},{"code":"3000","credit":5000000}]', true, 'CAP-1') as r;
grant select on j1 to public;
select test.ok((select (r->>'journal_no') is not null from j1), 'a published journal is numbered');

-- A published journal is corrected only by reversing it — once.
select test.throws($$select discard_journal((select (r->>'id')::uuid from j1))$$, '%Only a draft%', 'a published journal cannot be discarded');
create temp table rv as select reverse_journal((select (r->>'id')::uuid from j1), 'Posted to the wrong period') as r;
select test.as_admin();
select test.eq((select string_agg(a.code || case when l.debit > 0 then ' Dr ' || l.debit else ' Cr ' || l.credit end, ' | ' order by a.code)
                from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
                where e.reverses_entry = (select (r->>'id')::uuid from j1)),
  '1000 Cr 5000000 | 3000 Dr 5000000', 'the reversal mirrors the original');
select test.act_as('owner@example.com');
select test.throws($$select reverse_journal((select (r->>'id')::uuid from j1), 'again')$$, '%already been reversed%', 'reversed once only');

-- A scheduled reversal (accruals): posted now, reversed on the chosen date.
create temp table j2 as select save_journal((select d from today), 'Accrued wages', '[{"code":"6100","debit":90000},{"code":"1000","credit":90000}]',
  true, null, (select d from today) + 1) as r;
select test.ok((select (r->>'reversal_journal_no') is not null from j2), 'the reversal is booked straight away');
select test.throws($$select save_journal((select d from today), 'bad', '[{"code":"6100","debit":1},{"code":"1000","credit":1}]', true, null, (select d from today))$$,
  '%after the journal date%', 'a reversal must fall after the original');

-- Numbers are the database's: consecutive, with no gaps from the refused attempts above.
select test.as_admin();
select test.eq((select (max(journal_no) - min(journal_no) + 1)::int from journal_entry
                where business_id = '00000000-0000-0000-0000-0000000000b1' and journal_no is not null),
               (select count(*)::int from journal_entry where business_id = '00000000-0000-0000-0000-0000000000b1' and journal_no is not null),
               'published journals are numbered without gaps');
