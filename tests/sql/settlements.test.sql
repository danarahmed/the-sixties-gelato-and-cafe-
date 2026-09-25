-- =============================================================================
-- Card and platform money, reconciled (0030, the audit's P1-9): a payment by
-- card comes out of the bank; the card takings of a run of days are settled
-- against the terminal's total and what reached the bank, the fee and any
-- difference named; every platform sale carries the platform's order number,
-- once; a platform statement is matched order by order, the payout journal
-- proposed, and a person posts it; both kinds of settlement can be undone.
-- Golden catalogue: espresso 2,500 dine-in, 3,000 on Talabat.
-- =============================================================================
select test.golden_catalogue();
create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
create temp table s (k text primary key, r jsonb);
grant all on s to public;
create or replace function pg_temp.r(p text) returns jsonb language sql as $$ select r from s where k = p $$;
create or replace function pg_temp.espressos(p_qty int default 1) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p_qty))
$$;
create or replace function pg_temp.talabat(p_no text, p_key uuid default gen_random_uuid()) returns jsonb language sql as $$
  select record_sale(p_key, 'talabat', 'platform_paid', pg_temp.espressos(1), p_platform_order_no => p_no)
$$;
create or replace function pg_temp.day(p_offset int default 0) returns text language sql as $$
  select to_char(test.today() + p_offset, 'DD Mon')
$$;

-- ------------------------------------------------ a card payment, from the bank
select test.act_as('manager@example.com');
insert into s select 'paper', record_expense('Card machine paper', 5000, '6900', 'card');
select test.eq(test.lines_of((pg_temp.r('paper') ->> 'expense_id')::uuid), '1020 Cr 5000 | 6900 Dr 5000',
  'a payment by card comes out of the bank; card clearing holds only the takings');

-- ------------------------------------------------------------- card takings
-- The card takings of two days before today (brought in as journals), and
-- two card sales today, still trading.
select test.as_admin();
select post_journal('00000000-0000-0000-0000-0000000000b1',
  ((test.today() - d)::timestamp + time '20:00') at time zone 'Asia/Baghdad', 'Card takings brought forward (fixture)',
  'manual', null, jsonb_build_array(jsonb_build_object('code', '1010', 'debit', amount),
                                    jsonb_build_object('code', '3000', 'credit', amount)))
  from (values (2, 3000), (1, 4000)) v(d, amount);
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'card', pg_temp.espressos(1)) from generate_series(1, 2);
select test.throws($$select card_takings()$$, '%permission%', 'a cashier does not see the card takings');
select test.act_as('owner@example.com');
select test.eq(card_takings() -> 'days',
  jsonb_build_array(jsonb_build_object('day', test.today() - 2, 'amount', 3000),
                    jsonb_build_object('day', test.today() - 1, 'amount', 4000),
                    jsonb_build_object('day', test.today(), 'amount', 5000)),
  'the card takings of each day not yet settled');

select test.act_as('manager@example.com');
select test.throws(format('select record_card_settlement(%L, 3000, 2940)', test.today() - 2), '%permission%',
  'a branch manager does not settle card takings: the books are the owner''s, the accountant''s');
select test.act_as('owner@example.com');
select test.throws(format('select record_card_settlement(%L, 3000, 2940)', test.today() - 3),
  format('Settle the card takings of days that are over: from %s to %s', pg_temp.day(-2), pg_temp.day(-1)),
  'from the first day not settled');
select test.throws(format('select record_card_settlement(%L, 12000, 11760)', test.today()),
  format('Settle the card takings of days that are over: from %s to %s', pg_temp.day(-2), pg_temp.day(-1)),
  'and not today: the till takes cards until midnight');
select test.throws(format('select record_card_settlement(%L, 3000, 3100)', test.today() - 2),
  'The bank cannot receive more than the terminal took: the difference is its fee', 'the fee is never negative');
select test.throws(format('select record_card_settlement(%L, 3000, 2940, %L)', test.today() - 2, test.today() - 3),
  format('The money arrived on a day from %s to today', pg_temp.day(-2)), 'the money arrives after the takings');
insert into s select 'c1', record_card_settlement(test.today() - 2, 3000, 2940, p_reference => 'BANK-0923');
select test.eq(test.lines_of((pg_temp.r('c1') ->> 'settlement_id')::uuid), '1010 Cr 3000 | 1020 Dr 2940 | 6500 Dr 60',
  'the first day''s 3,000: 2,940 reached the bank, the terminal kept 60 as its fee');
select test.eq(card_takings() ->> 'from', (test.today() - 1)::text, 'the next settlement starts the day after');

-- Yesterday the terminal took 2,500 less than the till: a sale rung as card was paid in cash.
select test.throws(format('select record_card_settlement(%L, 1500, 1450)', test.today() - 1),
  'The till took 4000 by card and the terminal 1500: say why they differ', 'a difference is explained');
insert into s select 'c2', record_card_settlement(test.today() - 1, 1500, 1450,
  p_note => 'a sale of 2,500 rung as card was paid in cash');
select test.eq(test.lines_of((pg_temp.r('c2') ->> 'settlement_id')::uuid),
  '1010 Cr 4000 | 1020 Dr 1450 | 6300 Dr 2500 | 6500 Dr 50',
  'the fee to 6500, and the 2,500 the terminal never took to 6300 Cash over / short, beside the drawer''s over');
select test.eq(card_takings() -> 'days', jsonb_build_array(jsonb_build_object('day', test.today(), 'amount', 5000)),
  'only today''s takings wait');
select test.eq(test.balance('1010'), 5000::numeric, 'and card clearing holds just them');
select test.throws(format('select record_card_settlement(%L, 4000, 3900)', test.today() - 1),
  'Card takings are settled once the day is over: today''s wait until tomorrow', 'a day is settled once');

-- The latest settlement undone: its takings wait again.
select test.throws(format('select cancel_card_settlement(%L, %L)', pg_temp.r('c1') ->> 'settlement_id', 'typed wrongly'),
  'Cancel the latest settlement first: card takings are settled in order', 'in order');
select test.throws(format('select cancel_card_settlement(%L, %L)', pg_temp.r('c2') ->> 'settlement_id', 'no'),
  'Say why it is cancelled', 'with a reason');
select cancel_card_settlement((pg_temp.r('c2') ->> 'settlement_id')::uuid, 'the bank statement was for two days');
select test.eq(card_takings() -> 'days',
  jsonb_build_array(jsonb_build_object('day', test.today() - 1, 'amount', 4000),
                    jsonb_build_object('day', test.today(), 'amount', 5000)),
  'cancelled, yesterday''s takings wait again');
select test.eq(test.balance('1010'), 9000::numeric, 'back in card clearing');
select test.eq((select count(*) from jsonb_array_elements(card_takings() -> 'settlements') x
                 where x ->> 'cancelled_at' is not null)::int, 1, 'and the settlement is kept, marked cancelled');
insert into s select 'c3', record_card_settlement(test.today() - 1, 4000, 3900);
select test.eq(test.lines_of((pg_temp.r('c3') ->> 'settlement_id')::uuid), '1010 Cr 4000 | 1020 Dr 3900 | 6500 Dr 100',
  'settled again, as the bank really paid it');
select test.as_admin();
select test.eq((select string_agg(action, ',' order by id) from audit_log where action like 'card.%'),
  'card.settlement,card.settlement,card.settlement_cancel,card.settlement', 'each on the audit trail');

-- ------------------------------------------------ platform sales and their numbers
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'talabat', 'platform_paid',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]')$$, 'Enter the Talabat order number',
  'a Talabat sale needs the order number from the tablet');
select test.throws($$select pg_temp.talabat('55 01')$$,
  'An order number is letters and digits, as the Talabat tablet shows it', 'as the tablet shows it');
insert into s select 'k5501', jsonb_build_object('key', gen_random_uuid());
insert into s select 't5501', pg_temp.talabat('5501', (pg_temp.r('k5501') ->> 'key')::uuid);
select test.eq(pg_temp.r('t5501') ->> 'platform_order_no', '5501', 'the sale keeps its order number');
select test.throws($$select pg_temp.talabat('5501')$$, 'Talabat order 5501 is already recorded, on the sale of %',
  'an order is recorded once');
select test.eq((pg_temp.talabat('5501', (pg_temp.r('k5501') ->> 'key')::uuid) ->> 'replayed')::boolean, true,
  'though the same sale sent again is the sale already recorded');
insert into s select 't5502', pg_temp.talabat('5502');
insert into s select 't5503', pg_temp.talabat('5503');
insert into s select 't5504', pg_temp.talabat('5504');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(1), p_platform_order_no => '9001');
select test.as_admin();
select test.eq((select string_agg(external_order_id, ',' order by external_order_id) from platform_order),
  '5501,5502,5503,5504', 'one platform order for each Talabat sale; a dine-in sale has none');
select test.act_as('manager@example.com');
select void_sale((pg_temp.r('t5504') ->> 'order_id')::uuid, null, 'rang_twice');

select test.act_as('owner@example.com');
select test.eq((select string_agg(x ->> 'order_no', ',') from jsonb_array_elements(platform_money() -> 'orders') x),
  '5501,5502,5503', 'the platform owes three orders (the voided one, nothing)');
select test.eq((select row(platform_money() ->> 'waiting', platform_money() ->> 'receivable', platform_money() ->> 'unmatched')::text),
  '(9000,9000,0)', 'platform receivable is exactly the orders waiting');

-- --------------------------------------------------- a statement, matched
create temp table stmt as select '[
  {"order_no": "5501", "payout": 2550, "commission": 450},
  {"order_no": "5503", "payout": 2400, "commission": 450, "fees": 100},
  {"order_no": "5504", "payout": 2550, "commission": 450},
  {"order_no": "9999", "payout": 1000},
  {"order_no": "5501", "payout": 2550}
]'::jsonb as j;
grant select on stmt to public;
select test.act_as('cashier@example.com');
select test.throws($$select match_platform_statement('talabat', (select j from stmt))$$, '%permission%',
  'a cashier does not match statements');
select test.act_as('manager@example.com');
insert into s select 'm', match_platform_statement('talabat', (select j from stmt));
select test.eq((select string_agg((x ->> 'order_no') || ':' || (x ->> 'status'), ',' order by (x ->> 'line')::int)
                  from jsonb_array_elements(pg_temp.r('m') -> 'lines') x),
  '5501:matched,5503:matched,5504:voided,9999:not_found,5501:duplicate',
  'each line matched, or why not: a voided sale, an order the till never saw, a line twice');
select test.eq((select string_agg(x ->> 'order_no', ',') from jsonb_array_elements(pg_temp.r('m') -> 'missing') x), '5502',
  'and the order it leaves out, from between those it paid');
select test.eq(pg_temp.r('m') -> 'totals',
  '{"orders": 6000, "payout": 4950, "commission": 900, "fees": 100, "difference": 50, "not_posted": 6100}'::jsonb,
  'two orders of 3,000: 4,950 paid, 900 commission, 100 fees, 50 not explained; 6,100 on lines not posted');
select test.eq(pg_temp.r('m') -> 'journal',
  '[{"code": "1020", "debit": 4950}, {"code": "5100", "debit": 900}, {"code": "5200", "debit": 150},
    {"code": "1100", "credit": 6000}]'::jsonb,
  'the journal it proposes: the payout in, the commission, the fees and the difference, the orders out');
select test.eq((match_platform_statement('talabat', '[{"order_no": "5502", "payout": 2500}]') -> 'totals' ->> 'commission'),
  '500', 'with no commission or fees given, all the platform kept is its commission');

select test.throws($$select post_platform_settlement('talabat', 'TLB-0925', (select j from stmt))$$, '%permission%',
  'a person who keeps the books posts it: not a branch manager');
select test.act_as('owner@example.com');
select test.throws($$select post_platform_settlement('talabat', '', (select j from stmt))$$,
  'Enter the statement''s number or date, as the platform gives it', 'a statement is named');
select test.throws($$select post_platform_settlement('talabat', 'TLB-0925', (select j from stmt))$$,
  '4 line(s) of the statement do not match: say what they are', 'what does not match is explained');
insert into s select 'p1', post_platform_settlement('talabat', 'TLB-0925', (select j from stmt),
  p_note => 'order 9999 is not ours; 5504 was voided and is refunded next week; 50 short on 5503, asked');
select test.eq(test.lines_of((pg_temp.r('p1') ->> 'settlement_id')::uuid), '1020 Dr 4950 | 1100 Cr 6000 | 5100 Dr 900 | 5200 Dr 150',
  'posted as proposed');
select test.eq((select row(pg_temp.r('p1') ->> 'order_count', pg_temp.r('p1') ->> 'orders', pg_temp.r('p1') ->> 'issues')::text),
  '(2,6000,4)', 'two orders paid out, worth 6,000; four lines not a clean match');
select test.eq((select string_agg(x ->> 'order_no', ',') from jsonb_array_elements(platform_money() -> 'orders') x), '5502',
  'the two paid orders no longer wait; the one left out still does');
select test.eq((select row(platform_money() ->> 'waiting', platform_money() ->> 'receivable', platform_money() ->> 'unmatched')::text),
  '(3000,3000,0)', 'and platform receivable is still exactly the orders waiting');
select test.throws($$select post_platform_settlement('talabat', 'tlb-0925', '[{"order_no": "5502", "payout": 2550}]')$$,
  'Talabat statement tlb-0925 is already recorded', 'a statement is posted once');
select test.eq((match_platform_statement('talabat', '[{"order_no": "5501", "payout": 2550}]') -> 'lines' -> 0 ->> 'status'),
  'already_paid', 'an order paid out once is not paid out again');
select test.as_admin();
select test.eq((select string_agg(issue_type::text, ',' order by issue_type::text) from reconciliation_issue),
  'cancelled_still_charged,duplicate_settlement_line,payout_difference,unmatched_settlement_line',
  'every line that did not match is kept with the statement');
select test.eq((select string_agg(external_order_id || ':' || actual_payout, ',' order by external_order_id)
                  from platform_order where settlement_id is not null), '5501:2550,5503:2400',
  'each order keeps what it paid');

-- Undone: the orders wait again.
select test.act_as('owner@example.com');
select cancel_platform_settlement((pg_temp.r('p1') ->> 'settlement_id')::uuid, 'the statement belonged to Careem');
select test.eq(platform_money() ->> 'waiting', '9000', 'cancelled, the three orders wait again');
select test.eq(test.balance('1100'), 9000::numeric, 'and platform receivable holds them');
select test.eq((select count(*) from jsonb_array_elements(platform_money() -> 'settlements') x
                 where x ->> 'cancelled_at' is not null)::int, 1, 'the settlement is kept, marked cancelled');
select test.succeeds($$select post_platform_settlement('talabat', 'TLB-0925',
  '[{"order_no": "5501", "payout": 2550, "commission": 450}]')$$,
  'and its statement can be posted again, rightly');
select test.as_admin();
select test.eq((select string_agg(action || ':' || coalesce(after_state ->> 'order_count', '-'), ',' order by id)
                  from audit_log where action like 'platform.%'),
  'platform.settlement:2,platform.settlement_cancel:-,platform.settlement:1', 'each on the audit trail, with its orders');

-- ------------------------------------------------------------- the alerts
select test.as_admin();
select test.eq((select title from alert_conditions('00000000-0000-0000-0000-0000000000b1', now() + interval '8 days')
                 where rule = 'platform_not_received' and subject = 'talabat'),
  format('2 Talabat orders, 6,000 IQD, are more than 7 days old and not yet paid out; the oldest from %s', pg_temp.day()),
  'orders past the payout cycle, by number');
select test.eq((select count(*) from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'platform_not_received')::int, 0, 'none yet today, and nothing unmatched');
select test.act_as('owner@example.com');
select save_journal(test.today(), 'Talabat payout recorded by hand',
  '[{"code":"1020","debit":2000},{"code":"1100","credit":2000}]', true);
select test.as_admin();
select test.eq((select urgency || ' ' || confidence || ': ' || title from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'platform_not_received' and subject = 'unmatched'),
  'orange medium: Platform receivable is 2,000 IQD short of the orders waiting to be paid out',
  'a payout recorded by hand, matched to no order, is flagged');

-- ------------------------------------------------------------- closed tables
select test.act_as('owner@example.com');
select test.throws($$select * from card_settlement$$, '%permission denied%', 'card settlements are read through their functions');
select test.eq((select string_agg(check_key || '=' || difference, ',' order by check_key) from report_reconciliation(test.today())),
  'grni=0,inventory=0,payables=0,sales=0', 'and the books still tie');
