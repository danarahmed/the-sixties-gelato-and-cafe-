-- =============================================================================
-- Reports that agree, and numbers that open (0026, the audit's P1-2)
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table today as select test.today() d;
create temp table ids (k text primary key, id uuid);
create temp table sup as select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' limit 1;
grant select, insert on today, ids, sup to public;

-- A day's trading: two takeaway espressos (5,000; beans 400 and cups 100), a
-- bottle of water at a table (1,000; 250), a card espresso at a table (2,500;
-- 200), and an espresso rung in error and voided.
select test.act_as('cashier@example.com');
insert into ids select 'take', (record_sale(gen_random_uuid(), 'takeaway', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]') ->> 'order_id')::uuid;
insert into ids select 'water', (record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]') ->> 'order_id')::uuid;
insert into ids select 'card', (record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') ->> 'order_id')::uuid;
insert into ids select 'error', (record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') ->> 'order_id')::uuid;

-- The manager voids the error, refunds the water (it goes back on the shelf)
-- and the takeaway order (made drinks do not); beans arrive, and 100 g spoil.
select test.act_as('manager@example.com');
select void_sale((select id from ids where k = 'error'), 'Rung in error');
select refund_sale((select id from ids where k = 'water'), 'Customer changed their mind');
select refund_sale((select id from ids where k = 'take'), 'Wrong order made');
select receive_goods((select id from sup), '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1000,"goods_value":12000}]');
select record_waste('c0000000-0000-0000-0000-000000000001', 100, 'g', 'spoilage', 'left out');

-- ------------------------------------------------------------ sales by channel
create temp table ds as select * from report_daily_sales((select d from today), (select d from today));
select test.eq((select string_agg(channel || ': ' || orders || ' orders, ' || net || ' sold, ' || refunds
                                  || ' refunded, cost ' || cogs || ' less ' || returned_cost || ' back on the shelf',
                                  ' | ' order by channel) from ds),
  'dine_in: 2 orders, 3500 sold, 1000 refunded, cost 450 less 250 back on the shelf | '
  'takeaway: 1 orders, 5000 sold, 5000 refunded, cost 500 less 0 back on the shelf',
  'each channel: its sales, the refunds made against it that day, and the cost returned to stock (the void is not a sale)');
create temp table pl as select * from report_profit_and_loss((select d from today), (select d from today));
select test.eq((select sum(net - refunds) from ds), (select sum(amount) from pl where section = 'revenue'),
  'net sales after refunds are the P&L''s net revenue: the two reports agree');
select test.eq((select sum(cogs - returned_cost) from ds), (select amount from pl where code = '5000'),
  'and their cost is the P&L''s cost of goods sold');
select test.eq((select sum(net - refunds - cogs + returned_cost) from ds), 1800::numeric,
  'sales margin: 2,500 kept less 700 of cost');

-- ------------------------------------------------------------ the dashboard
select test.act_as('owner@example.com');
select test.eq((dashboard_summary((select d from today)) ->> 'gross_profit')::numeric,
  (select sum(case when section = 'revenue' then amount else -amount end) from pl where section <> 'operating_expenses'),
  'the dashboard''s gross profit is the P&L''s: after the spoilage too');
select test.ok((dashboard_summary((select d from today)) ->> 'gross_profit')::numeric
                 = 1800 - (select amount from pl where code = '5300'),
  'which is the sales margin less what was wasted');

-- ------------------------------------------------------------ journal lines
create temp table jl as select * from report_journal_lines((select d from today), (select d from today));
select test.eq((select sum(debit) from jl), (select sum(credit) from jl), 'the day''s lines balance');
select test.eq((select sum(credit - debit) from report_journal_lines((select d from today), (select d from today), array['4000'])),
  (select amount from pl where code = '4000'), 'the lines behind the P&L''s sales figure add up to it');
select test.eq((select sum(credit - debit) from report_journal_lines((select d from today), (select d from today),
                                                                      array['4000', '4100', '4200'])),
  (select ledger from report_reconciliation((select d from today)) where check_key = 'sales'),
  'and those behind the reconciliation''s sales line add up to it');
create temp table tb as select * from report_trial_balance((select d from today), (select d from today));
select test.eq((select opening + (select coalesce(sum(debit - credit), 0) from jl where account_code = '1000') from tb where code = '1000'),
  (select closing from tb where code = '1000'), 'an account''s opening plus its lines is the trial balance''s closing');
select test.ok((select bool_and(journal_no is not null and account_name is not null and day = (select d from today)) from jl),
  'each line has its journal number, account and trading day');
select test.eq((select count(*) from jl where reverses_journal_no is not null and reference_type = 'reversal')::int > 0, true,
  'a void''s lines say which journal they reverse');
select test.eq((select count(*) from report_journal_lines((select d from today) + 1, (select d from today) + 1))::int, 0,
  'tomorrow has none');

-- ------------------------------------------------------------ the stock card
-- From yesterday, so the fixture's opening stock (a minute ago) is on the card whatever the hour.
create temp table beans as select * from stock_card('c0000000-0000-0000-0000-000000000001', (select d from today) - 1, (select d from today));
select test.eq((select kind || ' ' || qty from beans where seq = 0), 'opening 0', 'the card opens with what was there before');
select test.eq((select string_agg(kind || ' ' || q, ', ' order by kind)
                  from (select kind, sum(qty) q from beans where seq > 0 group by kind) x),
  'opening_stock 1000, received 1000, sold -60, wasted -100',
  'opening stock, received, sold (the void netted out), wasted: each on its own line');
select test.eq((select balance_qty || '/' || balance_value from beans order by seq desc limit 1),
  (select quantity_base || '/' || value from stock_board where item_id = 'c0000000-0000-0000-0000-000000000001'),
  'the last balance is what the stock board shows');
select test.ok((select bool_and(ok) from (
    select balance_qty = lag(balance_qty) over w + qty and balance_value = lag(balance_value) over w + value as ok
      from beans window w as (order by seq)
  ) x where ok is not null), 'every balance is the one before plus the movement');
create temp table water as select * from stock_card('c0000000-0000-0000-0000-000000000003', (select d from today) - 1, (select d from today));
select test.eq((select sum(qty) from water where kind = 'sold'), 0::numeric,
  'a bottle sold and refunded back to the shelf nets to nothing sold');
-- (Internal to the card: no one calls it directly.)
select test.as_admin();
select test.eq((select string_agg(stock_card_kind(t::movement_type, r, q), ',' order by n)
                  from (values (1, 'production_consumption', 'production_batch', -5),
                               (2, 'reversal', 'production_cancel', 5),
                               (3, 'production_output', 'production_batch', 4),
                               (4, 'reversal', 'production_cancel', -4),
                               (5, 'reversal', 'sale_void', 20),
                               (6, 'count_adjustment', 'stock_count', -3),
                               (7, 'manual_correction', null, 2),
                               (8, 'melt_evaporation', null, -1)) v(n, t, r, q)),
  'batches,batches,made,made,sold,counted,corrected,wasted',
  'a cancelled batch nets in what it used and what it made; a void in what was sold');

select test.act_as('cashier@example.com');
select test.throws($$select * from stock_card('c0000000-0000-0000-0000-000000000001', test.today(), test.today())$$,
  '%permission%', 'a cashier sees no stock card');
select test.throws($$select * from report_journal_lines(test.today(), test.today())$$, '%permission%',
  'nor the journal lines');
select test.act_as('manager@example.com');
select test.throws($$select * from stock_card(gen_random_uuid(), test.today(), test.today())$$, '%Item not found%',
  'an item of no business of ours is not found');

-- ------------------------------------------------------------ the year-end close
-- Closed on this day, it is not trading: not on the dashboard, and not among
-- the P&L's lines, while the ledger itself shows the accounts closed.
select test.as_admin();
select post_year_end_close('00000000-0000-0000-0000-0000000000b1', (select d from today));
select test.act_as('owner@example.com');
select test.eq((dashboard_summary((select d from today)) ->> 'net_revenue')::numeric, 2500::numeric,
  'the dashboard does not count the year-end close as trading');
select test.eq((select sum(credit - debit) from report_journal_lines((select d from today), (select d from today),
                                                                      array['4000'], true)), 8500::numeric,
  'the P&L''s lines leave it out');
select test.eq((select sum(credit - debit) from report_journal_lines((select d from today), (select d from today),
                                                                      array['4000'])), 0::numeric,
  'the ledger''s lines include it: 4000 is closed to retained earnings');
