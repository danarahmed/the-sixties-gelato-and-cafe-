-- =============================================================================
-- Prepaid expenses (0060, the September audit's P2-14): a quarter's rent paid
-- ahead into 1400, each month's share an expense of its month once the month
-- has come (the first at once), the shares adding up to what was paid; what
-- is due released, pressed twice posted once; a month not locked while a
-- share of it is not posted; the alert; one entered in error cancelled, its
-- shares and payment reversed and the drawer's cash put back; 1400 moved by
-- nothing else; the books tie throughout; who may; retries with one key done
-- once.
-- =============================================================================
select test.golden_catalogue();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.k(p_n int) returns uuid language sql immutable as $$
  select ('c6000000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
create function pg_temp.month(p_plus int) returns date language sql stable as $$
  select (date_trunc('month', test.today()) + make_interval(months => p_plus))::date
$$;
-- The tests' own view, whoever they act as.
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
$$;
create function pg_temp.audits(p_action text) returns int language sql security definer as $$
  select count(*)::int from audit_log where action = p_action
$$;
create function pg_temp.shares(p_prepaid text) returns text language sql security definer as $$
  select string_agg(to_char(r.month, 'YYYY-MM') || ':' || trim_scale(r.amount), ' ' order by r.month)
    from prepaid_release r where r.prepaid_id = p_prepaid::uuid
$$;
-- A month's shares posted, as the database posts them when that month comes.
create function pg_temp.release_through(p_day date) returns jsonb language sql security definer as $$
  select release_prepaid__run('00000000-0000-0000-0000-0000000000b1', p_day,
                              (select id from app_user where email = 'owner@example.com'))
$$;
-- The month's closing check on its shares (its period made first: the
-- checklist reads what was there when its statement began).
create function pg_temp.check_of(p_month date) returns text language plpgsql security definer as $$
declare v_period uuid := ensure_period('00000000-0000-0000-0000-0000000000b1', p_month);
begin
  return (select ok::text || ' ' || coalesce(detail, '')
            from period_close_checklist(v_period) c where c.check_key = 'prepaid_shares');
end $$;
create function pg_temp.alert(p_now timestamptz) returns text language sql security definer as $$
  select title from alert_conditions('00000000-0000-0000-0000-0000000000b1', p_now) where rule = 'prepaid_due'
$$;
-- What the drawer should hold: the tests' own view (the till's is blind).
create function pg_temp.drawer() returns numeric language sql security definer as $$
  select d.carry + d.moved from location l cross join lateral drawer_position(l.business_id, l.id) d
   where l.business_id = '00000000-0000-0000-0000-0000000000b1' and l.kind = 'branch'
$$;
create temp table before as select pg_temp.checks() as checks;
grant select on before to public;

-- ------------------------------------------------------------------ the account
select test.eq((select account_type::text || ' ' || name from gl_account
                 where business_id = '00000000-0000-0000-0000-0000000000b1' and code = '1400'),
               'asset Prepaid expenses', '1400 Prepaid expenses, an asset');

-- ------------------------------------------------------------------ a quarter's rent, paid ahead
select test.act_as('owner@example.com');
select save_journal(test.today(), 'The owner puts money in the bank',
                    '[{"code":"1020","debit":1000000},{"code":"3000","credit":1000000}]', true);
insert into res select 'P1', record_prepaid_expense('Shop rent, three months', 100000, '6000', 'bank',
                                                    pg_temp.month(0), 3, p_idempotency_key => pg_temp.k(1));
insert into res select 'P1b', record_prepaid_expense('Shop rent, three months', 100000, '6000', 'bank',
                                                     pg_temp.month(0), 3, p_idempotency_key => pg_temp.k(1));
select test.eq(pg_temp.r('P1b') - 'replayed', pg_temp.r('P1'), 'sent twice with one key: recorded once');
select test.eq(test.lines_of((pg_temp.r('P1') ->> 'prepaid_id')::uuid), '1020 Cr 100000 | 1400 Dr 100000',
  'paid from the bank into 1400');
select test.eq(pg_temp.shares(pg_temp.r('P1') ->> 'prepaid_id'), to_char(pg_temp.month(0), 'YYYY-MM') || ':33333',
  'this month''s share is posted at once: a third, rounded down');
select test.eq(test.balance('1400'), 66667::numeric, '1400 holds the two months to come');
select test.eq(test.balance('6000'), 33333::numeric, 'this month''s rent is its share');
select test.eq((select count(*)::int from expense e join prepaid_release r on r.expense_id = e.id
                 where e.description = 'Shop rent, three months (' || to_char(pg_temp.month(0), 'YYYY-MM') || ')'
                   and e.amount = 33333),
               1, 'the share is on the Expense Register, named by its month');
select test.eq(pg_temp.audits('prepaid.record'), 1, 'on the audit trail once');
select test.eq(pg_temp.checks(), (select checks from before), 'the books tie as they did, 1400 too');
insert into res select 'L', prepaid_expenses();
select test.eq((pg_temp.r('L') -> 0 ->> 'released')::int || ' of ' || (pg_temp.r('L') -> 0 ->> 'months')
               || ', next ' || (pg_temp.r('L') -> 0 ->> 'next_month') || ', due ' || (pg_temp.r('L') -> 0 ->> 'due'),
               '1 of 3, next ' || to_char(pg_temp.month(1), 'YYYY-MM') || ', due 0',
  'the list: one share of three posted, the next month''s to come, none due');

-- Nothing more is due this month.
insert into res select 'R0', release_prepaid(pg_temp.k(2));
select test.eq(jsonb_array_length(pg_temp.r('R0') -> 'released'), 0, 'nothing more is due this month');
select test.eq(pg_temp.audits('prepaid.release'), 0, 'and nothing released is not on the audit trail');

-- ------------------------------------------------------------------ one starting next month
insert into res select 'P2', record_prepaid_expense('Insurance, a year', 120000, '6900', 'bank',
                                                    pg_temp.month(1), 12, p_idempotency_key => pg_temp.k(3));
select test.eq(jsonb_array_length(pg_temp.r('P2') -> 'released'), 0, 'starting next month: nothing posted yet');
select test.eq(pg_temp.alert(now()), null, 'nothing due: no alert');
select test.eq(pg_temp.check_of(pg_temp.month(0)), 'true ', 'this month can be locked: its share is posted');
select test.eq(pg_temp.check_of(pg_temp.month(1)),
  'false 2 share(s) of prepaid expenses to ' || (pg_temp.month(2) - 1)::text
    || ', 43,333 IQD in all, are not posted: release them on Expenses',
  'next month cannot, until the rent''s and the insurance''s shares of it are posted');
select test.eq(pg_temp.alert(now() + interval '1 month'),
  '2 month(s) of prepaid expenses are due to be released, 43,333 IQD in all',
  'once next month has come, the dashboard says so');

-- Next month comes: its shares are posted.
insert into res select 'R1', pg_temp.release_through(pg_temp.month(1));
select test.eq(jsonb_array_length(pg_temp.r('R1')), 2, 'the rent''s and the insurance''s shares');
select test.eq(pg_temp.check_of(pg_temp.month(1)), 'true ', 'and next month can be locked');
insert into res select 'R1b', pg_temp.release_through(pg_temp.month(1));
select test.eq(jsonb_array_length(pg_temp.r('R1b')), 0, 'released again: nothing twice');
-- And the month after: the rent's last share takes what is left.
select pg_temp.release_through(pg_temp.month(2));
select test.eq(pg_temp.shares(pg_temp.r('P1') ->> 'prepaid_id'),
  to_char(pg_temp.month(0), 'YYYY-MM') || ':33333 ' || to_char(pg_temp.month(1), 'YYYY-MM') || ':33333 '
    || to_char(pg_temp.month(2), 'YYYY-MM') || ':33334',
  'the three shares add up to the 100,000 paid: the last takes what is left');
select test.eq(test.balance('6000'), 100000::numeric, 'the rent, all of it, over its three months');
select test.eq(test.balance('1400'), 100000::numeric, 'what is left in 1400: the insurance''s ten months to come');
select test.eq(pg_temp.checks(), (select checks from before), 'the books still tie');

-- ------------------------------------------------------------------ refused
select test.throws($$select record_prepaid_expense('Rent', 100000, '6000', 'bank', pg_temp.month(0), 1)$$,
  'For this month alone, record an expense', 'this month alone is an expense');
select test.throws($$select record_prepaid_expense('Rent', 100000, '6000', 'bank', pg_temp.month(0), 0)$$,
  'A prepaid expense covers 1 to 36 months', 'it covers a month at least');
select test.throws($$select record_prepaid_expense('Rent', 100000, '6000', 'bank', pg_temp.month(0), 37)$$,
  'A prepaid expense covers 1 to 36 months', 'nor more than three years');
select test.throws($$select record_prepaid_expense('Rent', 100000, '6000', 'bank', pg_temp.month(-1), 3)$$,
  'A prepaid expense starts this month or later%', 'a month already past is an expense of that month');
select test.throws($$select record_prepaid_expense('Rent', 100000, '6000', 'bank', pg_temp.month(13), 3)$$,
  'A prepaid expense starts within a year', 'nor more than a year ahead');
select test.throws($$select record_prepaid_expense('Coffee', 100000, '5000', 'bank', pg_temp.month(0), 3)$$,
  'Account 5000 cannot take an expense%', 'stock costs come from their own records');
select test.throws($$select record_prepaid_expense('Rent', 100000, '6000', 'cheque', pg_temp.month(0), 3)$$,
  'Say where the money came from%', 'the money came from somewhere known');
select test.throws($$select record_prepaid_expense('Rent', 2, '6000', 'bank', pg_temp.month(0), 3)$$,
  'Each month takes at least 1 of it: pay at least 3, or cover fewer months', 'each month takes something');
select test.throws($$select record_prepaid_expense(' ', 100000, '6000', 'bank', pg_temp.month(0), 3)$$,
  'Describe the expense', 'it says what it is for');
select test.throws($$select save_journal(test.today(), 'Into 1400 by hand',
                                          '[{"code":"1400","debit":500},{"code":"1020","credit":500}]', true)$$,
  '%1400%', 'no journal by hand touches 1400');
select test.throws(format($$select reverse_journal('%s', 'Wrong')$$,
                          (select journal_entry_id from prepaid_expense where id = (pg_temp.r('P1') ->> 'prepaid_id')::uuid)),
  'Journal % was written by a prepaid expense (cancel it on Expenses)%', 'its payment is corrected by cancelling it');
-- Even by the database's own hand, a record stays as it was.
select test.as_admin();
select test.throws($$update prepaid_expense set months = 4$$, 'A prepaid expense stays as it was recorded%',
  'a prepaid expense stays as it was recorded');
select test.throws($$delete from prepaid_expense$$, 'A prepaid expense is never deleted%',
  'nor is it deleted');
select test.throws($$delete from prepaid_release$$, 'A month''s share of a prepaid expense is not changed%',
  'nor is a share, once posted');
select test.act_as('owner@example.com');

-- ------------------------------------------------------------------ who may
select test.act_as('cashier@example.com');
select test.throws($$select record_prepaid_expense('Rent', 100000, '6000', 'bank', pg_temp.month(0), 3)$$,
  '%needs expense.record%', 'a cashier records none');
select test.throws($$select prepaid_expenses()$$, '%needs cost.view%', 'nor reads them');
select test.eq((select count(*)::int from prepaid_expense), 0, 'nor sees their rows');
select test.act_as('manager@example.com');
select test.eq(jsonb_array_length(prepaid_expenses()), 2, 'a branch manager, who records expenses, reads them');
insert into res select 'RM', release_prepaid(pg_temp.k(4));
select test.eq(jsonb_array_length(pg_temp.r('RM') -> 'released'), 0, 'and may release what is due');
select test.throws(format($$select cancel_prepaid_expense('%s', 'Wrong')$$, pg_temp.r('P2') ->> 'prepaid_id'),
  '%needs accounting.post%', 'but cancels none');

-- ------------------------------------------------------------------ one entered in error, from the till
select test.act_as('owner@example.com');
select move_cash('owner', 'till', 60000, 'Float for the till');
create temp table drawer_before as select pg_temp.drawer() as v;
grant select on drawer_before to public;
insert into res select 'P3', record_prepaid_expense('Security, two months', 50000, '6900', 'till',
                                                    pg_temp.month(0), 2, p_idempotency_key => pg_temp.k(5));
select test.eq(pg_temp.drawer(), (select v from drawer_before) - 50000, 'paid out of the drawer');
-- Its share of this month is not reversed by hand (0061): its month would stay
-- posted and the share in 1400 for good. It goes with the prepaid expense.
select test.throws(format($$select reverse_journal('%s', 'Security not due this month')$$,
                          (select journal_entry_id from prepaid_release
                            where prepaid_id = (pg_temp.r('P3') ->> 'prepaid_id')::uuid)),
  'A month''s share of a prepaid expense is undone by cancelling the prepaid expense on Expenses',
  'a month''s share is not reversed by hand');
insert into res select 'L3', prepaid_expenses();
select test.eq((select (x ->> 'released') || ' posted, ' || (x ->> 'reversed') || ' reversed, '
                       || (x ->> 'released_amount') || ' out of 1400'
                  from jsonb_array_elements(pg_temp.r('L3')) x where x ->> 'id' = pg_temp.r('P3') ->> 'prepaid_id'),
               '1 posted, 0 reversed, 25000 out of 1400',
  'the list: its share posted, out of 1400');
insert into res select 'C3', cancel_prepaid_expense((pg_temp.r('P3') ->> 'prepaid_id')::uuid,
                                                    'Entered twice', pg_temp.k(6));
insert into res select 'C3b', cancel_prepaid_expense((pg_temp.r('P3') ->> 'prepaid_id')::uuid,
                                                     'Entered twice', pg_temp.k(6));
select test.eq(pg_temp.r('C3b') - 'replayed', pg_temp.r('C3'), 'sent twice with one key: cancelled once');
select test.eq((pg_temp.r('C3') ->> 'shares_reversed')::int, 1, 'its share posted is reversed with it');
select test.eq(pg_temp.drawer(), (select v from drawer_before), 'the cash is back in the drawer');
select test.eq(test.balance('1400'), 100000::numeric, 'nothing of it is left in 1400');
select test.eq((select cancel_reason from prepaid_expense where id = (pg_temp.r('P3') ->> 'prepaid_id')::uuid),
               'Entered twice', 'it keeps why');
select test.throws(format($$select cancel_prepaid_expense('%s', 'Again')$$, pg_temp.r('P3') ->> 'prepaid_id'),
  'That prepaid expense was cancelled already', 'cancelled once');
select test.eq(pg_temp.audits('prepaid.cancel'), 1, 'on the audit trail once');

-- The insurance cancelled with a share of it posted: the share is reversed too.
insert into res select 'C2', cancel_prepaid_expense((pg_temp.r('P2') ->> 'prepaid_id')::uuid, 'Wrong policy');
select test.eq((pg_temp.r('C2') ->> 'shares_reversed')::int, 2, 'its two shares posted are reversed');
select test.eq(test.balance('6900'), 0::numeric, 'nothing of it stays an expense');
select test.eq(test.balance('1400'), 0::numeric, 'nor in 1400');
select test.eq(pg_temp.check_of(pg_temp.month(5)), 'true ', 'a cancelled one is due no more');
select test.eq(pg_temp.checks(), (select checks from before), 'and the books tie as they did');

-- A month to come, alone: December's rent paid in September (the audit's own
-- example) waits in 1400 until its month, and is all that month's.
insert into res select 'P4', record_prepaid_expense('Shop rent, one month ahead', 150000, '6000', 'bank',
                                                    pg_temp.month(3), 1, p_idempotency_key => pg_temp.k(7));
select test.eq(jsonb_array_length(pg_temp.r('P4') -> 'released'), 0, 'a month to come, alone: nothing posted yet');
select test.eq(test.balance('1400'), 150000::numeric, '1400 holds it until then');
select test.eq(pg_temp.check_of(pg_temp.month(2)), 'true ', 'the months before it owe it nothing');
select pg_temp.release_through(pg_temp.month(3));
select test.eq(pg_temp.shares(pg_temp.r('P4') ->> 'prepaid_id'), to_char(pg_temp.month(3), 'YYYY-MM') || ':150000',
  'its month takes all of it');
select test.eq(test.balance('1400'), 0::numeric, 'and 1400 is empty again');
select test.eq(pg_temp.checks(), (select checks from before), 'the books tie');

-- ------------------------------------------------------------------ paid from the safe (0061)
-- The safe's tie-out counts what a prepaid expense took out of the safe, and
-- what its cancellation put back.
select move_cash('owner', 'safe', 90000, 'Cash into the safe');
insert into res select 'P5', record_prepaid_expense('Water, three months', 90000, '6200', 'safe',
                                                    pg_temp.month(1), 3, p_idempotency_key => pg_temp.k(8));
select test.eq(test.balance('1005'), 0::numeric, 'paid out of the safe');
select test.eq(pg_temp.checks(), (select checks from before), 'paid from the safe: the safe still ties');
select cancel_prepaid_expense((pg_temp.r('P5') ->> 'prepaid_id')::uuid, 'The landlord pays the water');
select test.eq(test.balance('1005'), 90000::numeric, 'cancelled: back in the safe');
select test.eq(pg_temp.checks(), (select checks from before), 'and the safe ties again');

-- ------------------------------------------------------------------ its account kept in use (0061)
-- An account the café added stays in use while a prepaid expense still takes
-- shares from it: the shares would be refused, and every other share due too.
select create_account('6010', 'Generator rent', 'expense');
insert into res select 'P6', record_prepaid_expense('Generator rent, two months', 40000, '6010', 'bank',
                                                    pg_temp.month(1), 2, p_idempotency_key => pg_temp.k(9));
select test.throws($$select set_account_in_use('6010', false, 'The generator is sold')$$,
  'A prepaid expense (Generator rent, two months) takes a share from account 6010 Generator rent each month until '
    || to_char(pg_temp.month(2), 'YYYY-MM')
    || ': take it out of use once the last share is posted, or cancel the prepaid expense first',
  'an account a prepaid expense still takes shares from stays in use');
select pg_temp.release_through(pg_temp.month(1));
select test.throws($$select set_account_in_use('6010', false, 'The generator is sold')$$,
  'A prepaid expense (Generator rent, two months)%', 'while a share of it is still to come');
select pg_temp.release_through(pg_temp.month(2));
select test.succeeds($$select set_account_in_use('6010', false, 'The generator is sold')$$,
  'its last share posted: the account may be taken out of use');
select test.eq(test.balance('6010'), 40000::numeric, 'all of it an expense of its two months');

-- ------------------------------------------------------------------ a payment like one posted already (0061)
-- Asked by the database when the screen asks (p_ask_same), in the step that
-- would post it: the payments like it come back and nothing is posted. The
-- answer is kept with its key; from SQL, and once the person says it is
-- another payment, it is posted as before.
create function pg_temp.posted(p_desc text) returns int language sql security definer as $$
  select count(*)::int from expense where description = p_desc
$$;
select test.act_as('manager@example.com');
insert into res select 'E1', record_expense('Internet, October', 35000, '6200', 'bank',
                                            p_idempotency_key => pg_temp.k(10));
insert into res select 'Q1', record_expense('Internet again', 35000, '6200', 'bank', p_ask_same => true,
                                            p_idempotency_key => pg_temp.k(11));
select test.eq((select string_agg((x ->> 'account_code') || ' ' || (x ->> 'amount') || ' ' || (x ->> 'date') || ' '
                                  || (x ->> 'description') || ' #' || (x ->> 'journal_no'), '; ')
                  from jsonb_array_elements(pg_temp.r('Q1') -> 'same') x),
               '6200 35000 ' || test.today() || ' Internet, October #' || (pg_temp.r('E1') ->> 'journal_no'),
  'asked: the payment like it posted today, with its journal');
select test.eq(pg_temp.posted('Internet again'), 0, 'and nothing is posted');
insert into res select 'Q1b', record_expense('Internet again', 35000, '6200', 'bank', p_ask_same => true,
                                             p_idempotency_key => pg_temp.k(11));
select test.eq(pg_temp.r('Q1b') - 'replayed', pg_temp.r('Q1'), 'sent again with its key: the same answer');
select test.eq(jsonb_array_length(record_expense('Internet again', 35000, '6200', 'bank', test.today() - 3,
                                                 p_ask_same => true, p_idempotency_key => pg_temp.k(12)) -> 'same'),
               1, 'three days before it: asked too');
select test.eq(record_expense('Internet again', 35000, '6200', 'bank', test.today() - 4, p_ask_same => true,
                              p_idempotency_key => pg_temp.k(13)) ? 'expense_id',
               true, 'four days before it: nothing to ask, posted');
select test.eq(record_expense('Internet, the shop upstairs', 35000, '6200', 'bank',
                              p_idempotency_key => pg_temp.k(14)) ? 'expense_id',
               true, 'said to be another payment: posted');
select test.eq(pg_temp.audits('expense.record'), 3, 'only those posted are on the audit trail');
-- A prepaid expense paid today is asked about the same way, and asks about them.
insert into res select 'Q2', record_prepaid_expense('Internet, three months', 35000, '6200', 'bank',
                                                    pg_temp.month(1), 3, p_ask_same => true,
                                                    p_idempotency_key => pg_temp.k(15));
select test.eq(jsonb_array_length(pg_temp.r('Q2') -> 'same'), 2, 'a prepaid expense like them: asked about both');
select test.eq((select count(*)::int from prepaid_expense where description = 'Internet, three months'), 0,
  'and not recorded');
select test.eq(record_prepaid_expense('Internet, three months', 35000, '6200', 'bank', pg_temp.month(1), 3,
                                      p_idempotency_key => pg_temp.k(16)) ? 'prepaid_id',
               true, 'said to be another: recorded');
select test.eq(jsonb_array_length(record_expense('Internet once more', 35000, '6200', 'bank', p_ask_same => true,
                                                 p_idempotency_key => pg_temp.k(17)) -> 'same'),
               3, 'an expense like the prepaid expense paid today: asked about it too');
-- A month's share counts: this month's rent posted already.
insert into res select 'P7', record_prepaid_expense('Shop rent, two months', 60000, '6000', 'bank',
                                                    pg_temp.month(0), 2, p_idempotency_key => pg_temp.k(18));
select test.eq((select string_agg(x ->> 'description', '; ')
                  from jsonb_array_elements(record_expense('Rent', 30000, '6000', 'bank', p_ask_same => true,
                                                           p_idempotency_key => pg_temp.k(19)) -> 'same') x),
               'Shop rent, two months (' || to_char(pg_temp.month(0), 'YYYY-MM') || ')',
  'this month''s share of the rent paid ahead: an expense of rent like it is asked about');
-- A payment reversed is not one posted.
select test.act_as('owner@example.com');
select reverse_journal((select journal_entry_id from expense where description = 'Internet, the shop upstairs'),
                       'Paid by the shop upstairs');
select test.eq(jsonb_array_length(record_expense('Internet once more', 35000, '6200', 'bank', p_ask_same => true,
                                                 p_idempotency_key => pg_temp.k(20)) -> 'same'),
               2, 'one reversed is not asked about');
-- Only someone who may record an expense is told of those posted.
select test.act_as('cashier@example.com');
select test.throws($$select record_expense('Internet', 35000, '6200', 'bank', p_ask_same => true,
                                           p_idempotency_key => gen_random_uuid())$$,
  '%needs expense.record%', 'a cashier is told nothing of them');
select test.act_as('owner@example.com');
select test.eq(pg_temp.checks(), (select checks from before), 'the books tie');
