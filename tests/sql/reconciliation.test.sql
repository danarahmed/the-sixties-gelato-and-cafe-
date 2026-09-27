-- =============================================================================
-- The books checked account by account (0038, release M): the card takings
-- not yet settled against 1010, the orders the platforms owe against 1100,
-- what the drawers should hold against 1000, the cash moved through the safe
-- against 1005, and every record with its one journal. Each blocks the
-- month's lock. The fixtures opened the drawer, counting it empty.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.recon() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
$$;
create function pg_temp.check(p_key text) returns text language sql security definer as $$
  select trim_scale(subledger) || '/' || trim_scale(ledger) || '/' || trim_scale(difference)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today()) where check_key = p_key
$$;
create function pg_temp.checklist() returns text language sql security definer as $$
  select string_agg(c.check_key || ':' || case when c.ok then 'ok' else 'NOT OK' end, ',' order by c.check_key)
    from period_close_checklist((select id from accounting_period
                                  where business_id = '00000000-0000-0000-0000-0000000000b1'
                                    and test.today() between starts_on and ends_on)) c
   where c.check_key in ('card', 'platform', 'drawer', 'safe', 'documents', 'sales')
$$;

-- ------------------------------------------------------------ a day's trading ties
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]');
select record_sale(gen_random_uuid(), 'dine_in', 'card', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]');
select record_sale(gen_random_uuid(), 'talabat', 'platform_paid', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]',
                   p_platform_order_no => 'R100');
select test.act_as('owner@example.com');
select test.eq((select string_agg(check_key, ',' order by ord) from (
                  select check_key, row_number() over () ord from report_reconciliation(test.today())) x),
  'inventory,payables,grni,sales,card,platform,drawer,safe,documents', 'nine checks, the four before and five new');
select test.eq(pg_temp.recon(), 'card=0,documents=0,drawer=0,grni=0,inventory=0,payables=0,platform=0,safe=0,sales=0',
  'a day of cash, card and Talabat sales ties everywhere');
select test.eq(pg_temp.check('card'), '2500/2500/0', 'the card takings not yet settled are what 1010 holds');
select test.eq(pg_temp.check('platform'), '3000/3000/0', 'Talabat owes its order, as 1100 says');
select test.eq(pg_temp.check('drawer'), '5000/5000/0', 'the drawer should hold the two espressos, as 1000 says');

-- ------------------------------------------------------------ what each check catches
-- A payout typed by hand, matched to no order: 1100 no longer says what is owed.
create temp table hand as select save_journal(test.today(), 'Talabat paid, typed by hand',
  '[{"code":"1020","debit":3000},{"code":"1100","credit":3000}]', true) as r;
grant select on hand to public;
select test.eq(pg_temp.check('platform'), '3000/0/3000', 'orders owed 3,000, the account 0: a difference of 3,000');
select test.eq(pg_temp.checklist(), 'card:ok,documents:ok,drawer:ok,platform:NOT OK,safe:ok,sales:ok',
  'and the month''s checklist says so');
select reverse_journal((select id from journal_entry where description = 'Talabat paid, typed by hand'), 'Match it on the statement instead');
select test.eq(pg_temp.check('platform'), '3000/3000/0', 'reversed, it ties again');

-- The owner's correction to the till's cash, which no count supports.
select post_control_correction(test.today(), 'Cash found', '[{"code":"1000","debit":500},{"code":"6300","credit":500}]',
                               'Found behind the till');
select test.eq(pg_temp.check('drawer'), '5000/5500/-500', 'the drawer should hold 5,000; the account says 5,500');
select post_control_correction(test.today(), 'Cash found, taken back', '[{"code":"6300","debit":500},{"code":"1000","credit":500}]',
                               'It was the float of the other till');

-- The safe: the takings go there when the drawer closes; nothing is typed into it by hand.
select test.act_as('cashier@example.com');
select close_cash_session(5000, null, 0, 'safe');
select test.act_as('owner@example.com');
select test.eq(pg_temp.check('safe'), '5000/5000/0', 'the takings moved into the safe are what 1005 holds');
select test.eq(pg_temp.check('drawer'), '0/0/0', 'and the drawer, closed on nothing left, holds nothing');
select test.throws($$select save_journal(test.today(), 'Safe by hand', '[{"code":"1005","debit":100},{"code":"3000","credit":100}]', true)$$,
  'Account 1005 has a subledger and cannot take a manual journal%', 'the safe takes no manual journal');

-- The records: a journal whose record does not exist.
select test.as_admin();
select post_journal('00000000-0000-0000-0000-0000000000b1', now(), 'An expense that was never recorded', 'expense',
                    '00000000-0000-0000-0000-00000000beef',
                    '[{"code":"6900","debit":100},{"code":"1020","credit":100}]');
select test.act_as('owner@example.com');
select test.eq(pg_temp.check('documents'), '1/0/1', 'one record to look into');
select test.eq((select kind || ': ' || problem from report_document_problems(test.today())),
  'journal: A journal whose expense does not exist', 'and which: a journal whose expense does not exist');
select test.eq((select detail from period_close_checklist((select id from accounting_period
                  where business_id = '00000000-0000-0000-0000-0000000000b1' and test.today() between starts_on and ends_on))
                 where check_key = 'documents'),
  '1 record(s) to look into: see Reports, Do the books tie?', 'the checklist points to it');
select test.eq((select blocks from period_close_checklist((select id from accounting_period
                  where business_id = '00000000-0000-0000-0000-0000000000b1' and test.today() between starts_on and ends_on))
                 where check_key = 'documents'), true, 'and it blocks the month''s lock');
select reverse_journal((select id from journal_entry where description = 'An expense that was never recorded'), 'No such expense');
select test.eq(pg_temp.check('documents'), '0/0/0', 'reversed, nothing is left to look into');

-- Records without their journal, as the database's owner could leave them.
select test.as_admin();
set session_replication_role = replica;
insert into expense (id, business_id, amount, incurred_on, description, created_at)
values ('00000000-0000-0000-0000-00000000cafe', '00000000-0000-0000-0000-0000000000b1', 700, test.today(), 'Unposted', now());
set session_replication_role = origin;
select test.act_as('owner@example.com');
select test.eq((select string_agg(kind || ': ' || problem, '; ') from report_document_problems(test.today())),
  'expense: An expense with no journal', 'an expense with no journal is found');
select test.as_admin();
set session_replication_role = replica;
delete from expense where id = '00000000-0000-0000-0000-00000000cafe';
set session_replication_role = origin;

-- ------------------------------------------------------------ as of a day
select test.act_as('owner@example.com');
select test.eq((select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
                  from report_reconciliation(test.today() - 1)),
  'card=0,documents=0,drawer=0,grni=0,inventory=0,payables=0,platform=0,safe=0,sales=0',
  'yesterday ties too: each check is as at the end of its day');
select test.eq(pg_temp.recon(), 'card=0,documents=0,drawer=0,grni=0,inventory=0,payables=0,platform=0,safe=0,sales=0',
  'and today, after it all, ties everywhere');
select test.eq(pg_temp.checklist(), 'card:ok,documents:ok,drawer:ok,platform:ok,safe:ok,sales:ok',
  'the month''s checklist has every check, each passing');
select test.act_as('cashier@example.com');
select test.throws($$select * from report_document_problems(test.today())$$, '%needs cost.view%',
  'a cashier reads no records to look into');

-- ------------------------------------------------------------ before order numbers
-- The Talabat sale as a platform sale from before 0030 is: no order number,
-- so on no statement. A payout typed by hand is what explains it.
select test.as_admin();
set session_replication_role = replica;
delete from platform_order where external_order_id = 'R100';
set session_replication_role = origin;
select test.act_as('owner@example.com');
select test.eq(pg_temp.check('platform'), '3000/3000/0', 'a platform sale from before order numbers is owed all the same');
select save_journal(test.today(), 'Talabat paid the old order, typed by hand',
  '[{"code":"1020","debit":3000},{"code":"1100","credit":3000}]', true);
select test.eq(pg_temp.check('platform'), '0/0/0', 'the payout typed by hand explains it');
select save_journal(test.today(), 'Talabat paid, typed by hand again',
  '[{"code":"1020","debit":1000},{"code":"1100","credit":1000}]', true);
select test.eq(pg_temp.check('platform'), '0/-1000/1000', 'but no further: a payout no order explains is flagged');
