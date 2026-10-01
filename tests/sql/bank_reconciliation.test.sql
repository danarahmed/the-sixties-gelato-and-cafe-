-- =============================================================================
-- The bank reconciled against its statement (0059): the books' bank lines, a
-- statement kept only when the lines ticked take the bank to the balance the
-- bank gives; each line on one statement; statements following one another;
-- a bank charge recorded, then ticked; the latest undone with why, its lines
-- open again; the alert for a line a month old on no statement; the closing
-- checklist's warning, which does not stop the lock; each kept or undone on
-- the audit trail, sent twice with one key done once; who may and who reads;
-- a statement never changed nor deleted; the books tie as they did.
-- =============================================================================
select test.golden_catalogue();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.k(p_n int) returns uuid language sql immutable as $$
  select ('c5900000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
-- The tests' own view, whoever they act as: a bank line by its amount.
create function pg_temp.line(p_amount numeric) returns uuid language sql security definer as $$
  select b.line_id from bank_lines('00000000-0000-0000-0000-0000000000b1', test.today()) b
   where b.amount = p_amount order by b.day limit 1
$$;
create function pg_temp.stmt(p_no bigint) returns text language sql security definer as $$
  select statement_date - test.today() || ' ' || trim_scale(opening_balance) || ' ' || trim_scale(money_in) || ' '
         || trim_scale(money_out) || ' ' || trim_scale(closing_balance) || ' ' || line_count || ' ' || status
    from bank_statement where business_id = '00000000-0000-0000-0000-0000000000b1' and statement_no = p_no
$$;
create function pg_temp.audits(p_action text) returns int language sql security definer as $$
  select count(*)::int from audit_log where action = p_action
$$;
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
$$;
create temp table before as select pg_temp.checks() as checks;
grant select on before to public;

-- ------------------------------------------------------------------ the bank's lines
select test.act_as('owner@example.com');
select save_journal(test.today() - 10, 'The owner puts money in the bank',
                    '[{"code":"1020","debit":1000000},{"code":"3000","credit":1000000}]', true);
insert into res select 'E1', record_expense('The internet', 60000, '6200', 'bank', test.today() - 8, p_idempotency_key => pg_temp.k(1));
insert into res select 'E2', record_expense('Cleaning', 25000, '6900', 'bank', test.today() - 2, p_idempotency_key => pg_temp.k(2));
insert into res select 'B', bank_book(test.today());
select test.eq(pg_temp.r('B') ->> 'books', '915000', 'the books'' bank: 1,000,000 in, 85,000 out');
select test.eq(jsonb_array_length(pg_temp.r('B') -> 'open'), 3, 'three lines on no statement yet');
select test.eq(pg_temp.r('B') -> 'last', 'null'::jsonb, 'no statement yet');

-- ------------------------------------------------------------------ who may
select test.act_as('manager@example.com');
select test.throws(format($$select save_bank_statement(test.today() - 5, 940000, array['%s', '%s']::uuid[])$$,
                          pg_temp.line(1000000), pg_temp.line(-60000)),
  '%needs accounting.post%', 'a branch manager keeps no statement');
select test.eq(jsonb_array_length(bank_book(test.today()) -> 'open'), 3, 'but reads the bank');
select test.act_as('cashier@example.com');
select test.throws($$select bank_book(test.today())$$, '%needs cost.view%', 'a cashier does not read it');

-- ------------------------------------------------------------------ a statement kept
select test.act_as('owner@example.com');
insert into res select 'S1', save_bank_statement(test.today() - 5, 940000,
                                                 array[pg_temp.line(1000000), pg_temp.line(-60000)],
                                                 'September, first half', pg_temp.k(3));
insert into res select 'S1b', save_bank_statement(test.today() - 5, 940000,
                                                  array[pg_temp.line(1000000), pg_temp.line(-60000)],
                                                  'September, first half', pg_temp.k(3));
select test.eq(pg_temp.r('S1b') - 'replayed', pg_temp.r('S1'), 'sent twice with one key: kept once');
select test.eq(pg_temp.stmt(1), '-5 0 1000000 60000 940000 2 kept', 'statement 1: from nothing to 940,000, two lines');
select test.eq(jsonb_array_length(bank_book(test.today()) -> 'open'), 1, 'the cleaning, not on it, still open');
select test.eq(pg_temp.audits('bank.reconcile'), 1, 'on the audit trail once');
select test.act_as('cashier@example.com');
select test.eq((select count(*)::int from bank_statement), 0, 'a cashier sees no statement');
select test.act_as('manager@example.com');
select test.eq((select count(*)::int from bank_statement), 1, 'a manager, who sees costs, does');
select test.act_as('owner@example.com');

-- ------------------------------------------------------------------ refused
select test.throws($$select save_bank_statement(test.today() - 6, 940000, '{}')$$,
  'Statement 1 ends on %: the next one ends after it', 'statements follow one another');
select test.throws(format($$select save_bank_statement(test.today() - 1, 915000, array['%s', '%s']::uuid[])$$,
                          pg_temp.line(-60000), pg_temp.line(-25000)),
  'A line ticked is not one of the bank''s lines to % still open', 'a line on one statement only');
select test.throws(format($$select save_bank_statement(test.today() - 3, 915000, array['%s']::uuid[])$$,
                          pg_temp.line(-25000)),
  'A line ticked is not one of the bank''s lines to % still open', 'a line after the statement''s last day');
select test.throws(format($$select save_bank_statement(test.today() - 1, 900000, array['%s']::uuid[])$$,
                          pg_temp.line(-25000)),
  'The lines ticked take the bank to 915000, and the statement says 900000: -15000 apart', 'it must tie');
select test.throws($$select save_bank_statement(test.today() + 1, 940000, '{}')$$,
  'A statement cannot end after today', 'not after today');
select test.throws($$select save_bank_statement(test.today() - 1, null, '{}')$$,
  'Give the balance the bank''s statement shows', 'the bank''s balance is needed');

-- ------------------------------------------------------------------ a bank charge, then ticked
insert into res select 'C', record_expense('Bank charge', 5000, '6500', 'bank', test.today() - 1, p_idempotency_key => pg_temp.k(4));
insert into res select 'S2', save_bank_statement(test.today() - 1, 910000,
                                                 array[pg_temp.line(-25000), pg_temp.line(-5000)], null, pg_temp.k(5));
select test.eq(pg_temp.stmt(2), '-1 940000 0 30000 910000 2 kept', 'statement 2: 940,000 less the cleaning and the charge');
select test.eq(jsonb_array_length(bank_book(test.today()) -> 'open'), 0, 'every line on a statement');

-- ------------------------------------------------------------------ undone
select test.throws(format($$select undo_bank_statement('%s', 'Wrong one')$$, pg_temp.r('S1') ->> 'id'),
  'Statement 2 comes after it: undo the latest first', 'the latest first');
select test.throws(format($$select undo_bank_statement('%s', ' ')$$, pg_temp.r('S2') ->> 'id'), 'Say why', 'with why');
insert into res select 'U', undo_bank_statement((pg_temp.r('S2') ->> 'id')::uuid, 'The charge was typed twice', pg_temp.k(6));
insert into res select 'U2', undo_bank_statement((pg_temp.r('S2') ->> 'id')::uuid, 'The charge was typed twice', pg_temp.k(6));
select test.eq(pg_temp.r('U2') - 'replayed', pg_temp.r('U'), 'sent twice with one key: undone once');
select test.eq(pg_temp.stmt(2), '-1 940000 0 30000 910000 2 undone', 'statement 2 undone, kept as it was');
select test.eq(jsonb_array_length(bank_book(test.today()) -> 'open'), 2, 'its lines open again');
select test.throws(format($$select undo_bank_statement('%s', 'Again')$$, pg_temp.r('S2') ->> 'id'),
  'Bank statement 2 was undone already', 'once');
insert into res select 'S3', save_bank_statement(test.today() - 1, 910000,
                                                 array[pg_temp.line(-25000), pg_temp.line(-5000)]);
select test.eq(pg_temp.stmt(3), '-1 940000 0 30000 910000 2 kept', 'kept again, as statement 3');
select test.eq((pg_temp.r('U') ->> 'statement_no'), '2', 'the undone one keeps its number');
select test.eq(pg_temp.audits('bank.reconcile') || '/' || pg_temp.audits('bank.unreconcile'), '3/1',
  'each kept (1, 2 and 3) and undone (2) on the audit trail');

-- ------------------------------------------------------------------ a statement stays as kept
select test.as_admin();
select test.throws($$update bank_statement set closing_balance = 1 where statement_no = 3$$,
  'A bank statement stays as it was kept', 'not changed');
select test.throws($$delete from bank_statement where statement_no = 3$$,
  'A bank statement is never deleted: undo it instead', 'not deleted');
select test.throws($$update bank_statement_line set statement_id = statement_id$$,
  'A line on a bank statement is not changed: undo the statement instead', 'its lines not changed');

-- ------------------------------------------------------------------ the alert and the checklist
select test.act_as('owner@example.com');
select save_journal(test.today() - 40, 'Money in, found on no statement',
                    '[{"code":"1020","debit":2000},{"code":"3000","credit":2000}]', true);
select test.as_admin();
select test.eq((select title from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'bank_unreconciled'),
  format('1 bank line(s), the oldest from %s, are on no bank statement', test.today() - 40),
  'a line more than 35 days old on no statement: an alert');
select test.act_as('owner@example.com');
select test.eq((select ok::text || ' ' || blocks::text from period_close_checklist(
                  (select id from accounting_period where test.today() - 40 between starts_on and ends_on))
                 where check_key = 'bank'), 'false false', 'on the month''s checklist, a warning that does not stop the lock');
select test.eq((select ok::text from period_close_checklist(
                  (select id from accounting_period where test.today() - 1 between starts_on and ends_on))
                 where check_key = 'bank' ), 'false', 'nor is a later month reconciled while it is open');

-- ------------------------------------------------------------------ the books
select test.eq(pg_temp.checks(), (select checks from before), 'the books tie as they did');
