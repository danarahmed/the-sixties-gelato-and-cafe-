-- =============================================================================
-- Reports come from the ledger (audit C-03, M-01, M-02), and the
-- reconciliation proves the subledgers against their control accounts.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table today as select business_local_date('00000000-0000-0000-0000-0000000000b1', now()) d;
create temp table sup as select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' limit 1;
grant select on today, sup to public;

-- A day's trading: 2 espressos (5,000, COGS 400), a card espresso (2,500, 200),
-- rent 400,000, a waste write-off (1,000), one receipt billed, one not.
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]');
select record_sale(gen_random_uuid(), 'dine_in', 'card', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]');
select test.act_as('manager@example.com');
select record_expense('August rent', 400000, '6000');
select record_waste('c0000000-0000-0000-0000-000000000001', 100, 'g', 'spoilage', 'left out');
select receive_goods((select id from sup), '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":50,"goods_value":2500}]');
select receive_goods((select id from sup), '[{"item_id":"c0000000-0000-0000-0000-000000000003","qty":10,"goods_value":2500}]');
select record_bill((select id from sup), 'R-1', (select d from today), 2500, 0,
  (select id from goods_receipt order by receipt_no limit 1));
-- A draft that must not count (M-02).
select test.act_as('owner@example.com');
select save_journal((select d from today), 'Parked', '[{"code":"6200","debit":99999},{"code":"1000","credit":1}]', false);

-- A cashier sees no statements.
select test.act_as('cashier@example.com');
select test.throws($$select * from report_profit_and_loss((select d from today), (select d from today))$$, '%permission%',
  'a cashier cannot see profit');
select test.ok((select count(*) from pos_catalogue()) >= 2, 'but gets the till''s menu');
select test.eq((select prices->>'dine_in' from pos_catalogue() where variant_id = 'd1000000-0000-0000-0000-000000000001'), '2500',
  'at today''s price');

-- P&L is the ledger: revenue 7,500; cost of sales 600 + 1,000 waste; rent 400,000.
select test.act_as('manager@example.com');
create temp table pl as select * from report_profit_and_loss((select d from today), (select d from today));
select test.eq((select sum(amount) from pl where section = 'revenue'), 7500::numeric, 'P&L revenue from the ledger');
select test.eq((select sum(amount) from pl where section = 'cost_of_sales'), 1600::numeric, 'cost of sales: COGS 600 + waste 1,000');
select test.eq((select sum(amount) from pl where section = 'operating_expenses'), 400000::numeric, 'rent');
select test.eq((select amount from pl where code = '6200'), 0::numeric, 'the parked draft is not in the P&L (M-02)');

-- Trial balance: opening + period = closing, and it says what it covers (M-01).
create temp table tb as select * from report_trial_balance((select d from today), (select d from today));
select test.eq((select sum(debit) from tb), (select sum(credit) from tb), 'the period''s debits equal its credits');
select test.eq((select sum(closing) from tb), 0::numeric, 'closing balances net to zero');
select test.eq((select closing from tb where code = '1010'), 2500::numeric, 'card takings sit in 1010');
select test.eq((select count(*) from tb where code = '6200' and (debit <> 0 or credit <> 0))::int, 0, 'drafts excluded');
create temp table tb2 as select * from report_trial_balance((select d from today) + 1, (select d from today) + 1);
select test.eq((select sum(debit) from tb2), 0::numeric, 'tomorrow has no movements');
select test.eq((select closing from tb2 where code = '1010'), 2500::numeric, 'but today''s balance carries forward as its opening');

-- Every subledger reconciles; the unbilled receipt sits in GRNI.
create temp table rec as select * from report_reconciliation((select d from today));
select test.eq((select string_agg(check_key || '=' || difference, ',' order by check_key) from rec),
  'grni=0,inventory=0,payables=0,sales=0', 'every subledger agrees with its control account');
select test.eq((select subledger from rec where check_key = 'grni'), 2500::numeric, 'the unbilled receipt is in GRNI');

-- The dashboard is the ledger too.
select test.eq((dashboard_summary((select d from today)) ->> 'net_revenue')::numeric, 7500::numeric, 'dashboard revenue');
select test.eq((dashboard_summary((select d from today)) ->> 'gross_profit')::numeric, 5900::numeric, 'dashboard gross profit');
select test.eq((select sum(orders) from report_daily_sales((select d from today), (select d from today)))::int, 2, 'two orders today');
