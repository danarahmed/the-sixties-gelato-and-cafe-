-- =============================================================================
-- Manual journals: drafts, publishing, reversal as the only correction, and
-- subledger accounts closed to manual posting.
-- =============================================================================
select test.as_admin();
create temp table today as select business_local_date('00000000-0000-0000-0000-0000000000b1', now()) d;
grant select on today to public;

select test.act_as('cashier@example.com');
select test.throws($$select save_journal((select d from today), 'x', '[{"code":"6200","debit":5},{"code":"1020","credit":5}]', true)$$,
  '%permission%', 'a cashier cannot post journals');

select test.act_as('owner@example.com');
-- An out-of-balance draft may be parked, but not published.
create temp table d1 as select save_journal((select d from today), 'Accrual',
  '[{"code":"6200","debit":25000},{"code":"1020","credit":20000}]', false) as r;
grant select on d1 to public;
select test.eq((select r->>'journal_no' from d1), null, 'a draft has no number');
select test.throws($$select publish_journal((select (r->>'id')::uuid from d1))$$, '%unbalanced%', 'an unbalanced draft cannot be published');
select test.throws($$select save_journal((select d from today), 'Accrual', '[{"code":"6200","debit":25000},{"code":"1020","credit":20000}]', true)$$,
  '%differ by 5000%', 'publishing out of balance says by how much');

-- Accounts with a subledger are closed to manual journals.
select test.throws($$select save_journal((select d from today), 'fudge', '[{"code":"1200","debit":5},{"code":"1020","credit":5}]', true)$$,
  '%subledger%', 'no manual journal to Inventory');
select test.throws($$select save_journal((select d from today), 'fudge', '[{"code":"2000","debit":5},{"code":"1020","credit":5}]', true)$$,
  '%subledger%', 'no manual journal to Accounts payable');
select test.throws($$select save_journal((select d from today), 'fudge', '[{"code":"3100","debit":5},{"code":"1020","credit":5}]', true)$$,
  '%subledger%', 'no manual journal to Retained earnings');
-- The till's cash moves through sales, payments, counts and moving cash only
-- (0024), so the drawer and 1000 always tell the same story.
select test.throws($$select save_journal((select d from today), 'fudge', '[{"code":"6200","debit":5},{"code":"1000","credit":5}]', true)$$,
  '%subledger%', 'no manual journal to the till''s cash');

-- A proper one: owner capital introduced.
create temp table j1 as select save_journal((select d from today), 'Owner capital introduced',
  '[{"code":"1020","debit":5000000},{"code":"3000","credit":5000000}]', true, 'CAP-1') as r;
grant select on j1 to public;
select test.ok((select (r->>'journal_no') is not null from j1), 'a published journal is numbered');

-- A published journal is corrected only by reversing it — once.
select test.throws($$select discard_journal((select (r->>'id')::uuid from j1))$$, '%Only a draft%', 'a published journal cannot be discarded');
select test.throws($$select reverse_journal((select (r->>'id')::uuid from j1), 'too early', (select d from today) - 1)$$,
  '%cannot be dated before the entry it reverses%', 'a reversal is never dated before its entry');
select test.throws($$select reverse_journal((select (r->>'id')::uuid from j1), 'too late', (select d from today) + 1)$$,
  '%has happened%', 'nor in the future');
create temp table rv as select reverse_journal((select (r->>'id')::uuid from j1), 'Posted to the wrong period') as r;
select test.as_admin();
select test.eq((select string_agg(a.code || case when l.debit > 0 then ' Dr ' || l.debit else ' Cr ' || l.credit end, ' | ' order by a.code)
                from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
                where e.reverses_entry = (select (r->>'id')::uuid from j1)),
  '1020 Cr 5000000 | 3000 Dr 5000000', 'the reversal mirrors the original');
select test.act_as('owner@example.com');
select test.throws($$select reverse_journal((select (r->>'id')::uuid from j1), 'again')$$, '%already been reversed%', 'reversed once only');
select test.throws($$select reverse_journal((select id from journal_entry where reverses_entry = (select (r->>'id')::uuid from j1)), 'undo')$$,
  '%reversal (post the entry again instead)%', 'a reversal is not itself reversed; the entry is posted again');

-- A journal a record wrote is corrected through the record, never by
-- reversing its journal: the sale and the ledger would disagree.
select test.as_admin();
select test.golden_catalogue();
select test.act_as('cashier@example.com');
create temp table sale as select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') as r;
grant select on sale to public;
select test.act_as('owner@example.com');
select test.throws($$select reverse_journal((select id from journal_entry where reference_type = 'sales_order'
                                              and reference_id = (select (r->>'order_id')::uuid from sale)), 'wrong')$$,
  '%was written by a sale (void or refund it on Orders)%', 'a sale''s journal is not reversed by hand');

-- A scheduled reversal (accruals): posted now, reversed on the chosen date.
create temp table j2 as select save_journal((select d from today), 'Accrued wages', '[{"code":"6100","debit":90000},{"code":"1020","credit":90000}]',
  true, null, (select d from today) + 1) as r;
select test.ok((select (r->>'reversal_journal_no') is not null from j2), 'the reversal is booked straight away');
select test.throws($$select save_journal((select d from today), 'bad', '[{"code":"6100","debit":1},{"code":"1020","credit":1}]', true, null, (select d from today))$$,
  '%after the journal date%', 'a reversal must fall after the original');

-- Numbers are the database's: consecutive, with no gaps from the refused attempts above.
select test.as_admin();
select test.eq((select (max(journal_no) - min(journal_no) + 1)::int from journal_entry
                where business_id = '00000000-0000-0000-0000-0000000000b1' and journal_no is not null),
               (select count(*)::int from journal_entry where business_id = '00000000-0000-0000-0000-0000000000b1' and journal_no is not null),
               'published journals are numbered without gaps');

-- Control accounts take a hand-posted correction only from the owner, with a
-- reason on the audit trail (used to repair pre-control history).
select test.act_as('manager@example.com');
select test.throws($$select post_control_correction((select d from today), 'x', '[{"code":"1200","debit":5},{"code":"5400","credit":5}]', 'r')$$,
  '%permission%', 'a manager cannot post to a control account');
select test.act_as('owner@example.com');
select test.throws($$select post_control_correction((select d from today), 'x', '[{"code":"1200","debit":5},{"code":"5400","credit":5}]', ' ')$$,
  '%Say why%', 'the owner must give a reason');
select test.throws($$select post_control_correction((select d from today), 'x', '[{"code":"1200","debit":5},{"code":"5400","credit":4}]', 'r')$$,
  '%does not balance%', 'and it must balance like any entry');
create temp table cc as select post_control_correction((select d from today), 'stock sold with no movement written',
  '[{"code":"1200","debit":940},{"code":"5000","credit":940}]', 'legacy sale had no stock movement') as r;
select test.ok((select (r->>'journal_no') is not null from cc), 'the owner''s correction is published and numbered');
select test.as_admin();
select test.eq((select reason from audit_log where action = 'journal.control_correction'), 'legacy sale had no stock movement',
  'and the reason is on the audit trail');
