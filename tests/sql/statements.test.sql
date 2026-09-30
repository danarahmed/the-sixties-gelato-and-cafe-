-- =============================================================================
-- The balance sheet and the cash-flow statement (0052, release Z). Espresso:
-- 2,500 dine-in (20 g of beans at 10); water: 1,000 (a bottle at 250). The
-- fixtures put 21,000 of stock in (Dr 1200, Cr 3000) and opened the drawer
-- empty. Two days ago the owner put 400,000 in the bank and 50,000 in the
-- safe; yesterday the card terminal took 3,000 and paid 2,940 into the bank,
-- keeping 60. Today, in this order:
--   S1 cash, 2 espressos, 5,000         S2 card, an espresso and 2 waters, 4,500
--   S3 2 espressos, 2,000 cash + 3,000 card
--   S4 an espresso paid with $5 at 1,300 (6,500), 4,000 change in dinars
--   the $5 changed for 6,700 (200 gained)   one espresso of S1 given back, 2,500
--   1,000 of cloths from the till       1,500 from the till to the safe
--   20,000 from the safe to the owner   a grinder, 150,000, billed and paid from the bank
--   2 kg of beans delivered (18,000), billed, 10,000 paid from the bank
--   electricity, 20,000, billed and paid from the safe
--   5,000 advanced to Sara from the safe
--   a bank charge left in draft; 700 of cleaning paid from the bank, then reversed
--   the drawer counted 500 short.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.lines(p_variant text, n int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', p_variant, 'qty', n))
$$;
create function pg_temp.esp() returns text language sql as $$ select 'd1000000-0000-0000-0000-000000000001' $$;
create function pg_temp.wat() returns text language sql as $$ select 'd1000000-0000-0000-0000-000000000002' $$;
-- The café's clock: a day before today at an hour.
create function pg_temp.at(p_days_ago int, p_time text) returns timestamptz language sql security definer as $$
  select ((test.today() - p_days_ago)::timestamp + p_time::time) at time zone b.timezone
    from business b where b.id = '00000000-0000-0000-0000-0000000000b1'
$$;
create function pg_temp.post(p_at timestamptz, p_what text, p_lines jsonb) returns uuid language sql security definer as $$
  select post_journal('00000000-0000-0000-0000-0000000000b1', p_at, p_what, 'manual', null, p_lines)
$$;
create function pg_temp.supplier(p_name text) returns uuid language sql security definer as $$
  select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' and name = p_name
$$;
create function pg_temp.person(p_name text) returns uuid language sql security definer as $$
  select id from employee where full_name = p_name
$$;
create function pg_temp.main() returns uuid language sql security definer as $$
  select default_location('00000000-0000-0000-0000-0000000000b1')
$$;
create function pg_temp.gl(p_code text) returns numeric language sql security definer as $$
  select gl_balance_at('00000000-0000-0000-0000-0000000000b1', p_code, 'infinity')
$$;
-- The balance sheet's accounts, "code amount"; the cash flow's lines, "line amount (in, out)".
create function pg_temp.bs_lines(p jsonb) returns text language sql as $$
  select string_agg((x ->> 'code') || ' ' || (x ->> 'amount'), ', ' order by x ->> 'code')
    from jsonb_array_elements(p -> 'lines') x
$$;
create function pg_temp.cf_lines(p jsonb) returns text language sql as $$
  select string_agg((x ->> 'line') || ' ' || (x ->> 'amount') || ' (' || (x ->> 'in') || ' in, ' || (x ->> 'out')
                    || ' out)', ', ' order by o)
    from jsonb_array_elements(p -> 'lines') with ordinality e(x, o)
$$;
create function pg_temp.cf_accounts(p jsonb, p_line text) returns text language sql as $$
  select string_agg((a ->> 'code') || ' ' || (a ->> 'amount'), ', ' order by a ->> 'code')
    from jsonb_array_elements(p -> 'lines') x cross join lateral jsonb_array_elements(x -> 'accounts') a
   where x ->> 'line' = p_line
$$;
create function pg_temp.cash(p jsonb) returns text language sql as $$
  select string_agg((x ->> 'code') || ' ' || (x ->> 'opening') || ' → ' || (x ->> 'closing'), ', ' order by x ->> 'code')
    from jsonb_array_elements(p -> 'cash') x
$$;
-- An accountant, and a buyer who sees costs but not profit.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000e1', 'accountant@example.com'),
  ('a0000000-0000-0000-0000-0000000000e3', 'buyer@example.com');
insert into app_user (business_id, full_name, email, auth_user_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Accountant', 'accountant@example.com', 'a0000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Buyer', 'buyer@example.com', 'a0000000-0000-0000-0000-0000000000e3');
insert into user_role (app_user_id, role) select id, 'accountant' from app_user where email = 'accountant@example.com';
insert into user_role (app_user_id, role) select id, 'purchasing' from app_user where email = 'buyer@example.com';

-- ------------------------------------------------------------------ the two days before
select pg_temp.post(pg_temp.at(2, '12:00'), 'The owner puts money in',
  '[{"code": "1020", "debit": 400000}, {"code": "1005", "debit": 50000}, {"code": "3000", "credit": 450000}]');
select pg_temp.post(pg_temp.at(1, '12:00'), 'Card sales',
  '[{"code": "1010", "debit": 3000}, {"code": "4000", "credit": 3000}]');
select pg_temp.post(pg_temp.at(1, '18:00'), 'Card takings settled',
  '[{"code": "1020", "debit": 2940}, {"code": "6500", "debit": 60}, {"code": "1010", "credit": 3000}]');

-- ------------------------------------------------------------------ today
select test.act_as('cashier@example.com');
insert into res select 'S1', record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.lines(pg_temp.esp(), 2));
insert into res select 'S2', record_sale(gen_random_uuid(), 'dine_in', 'card',
  jsonb_build_array(jsonb_build_object('variant_id', pg_temp.esp(), 'qty', 1),
                    jsonb_build_object('variant_id', pg_temp.wat(), 'qty', 2)));
insert into res select 'S3', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines(pg_temp.esp(), 2),
  p_tenders => '[{"type": "cash", "amount": 2000}, {"type": "card", "amount": 3000}]');
select test.act_as('manager@example.com');
select set_fx_rate('USD', 1300, 'Market rate this morning', gen_random_uuid());
select test.act_as('cashier@example.com');
insert into res select 'S4', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines(pg_temp.esp(), 1),
  p_tenders => '[{"type": "cash", "currency": "USD", "usd": 5, "rate": 1300, "amount": 2500}]');
select test.act_as('manager@example.com');
insert into res select 'X1', exchange_dollars('till', 5, 6700, 'till', 'Exchange office', null, gen_random_uuid());
select refund_sale_lines((pg_temp.r('S1') ->> 'order_id')::uuid,
  (select jsonb_build_array(jsonb_build_object('line_id', l.id, 'qty', 1))
     from sales_order_line l where l.sales_order_id = (pg_temp.r('S1') ->> 'order_id')::uuid), 'changed_mind');
select test.act_as('owner@example.com');
select record_expense('Cleaning cloths', 1000, '6900', 'cash', p_idempotency_key => gen_random_uuid());
select move_cash('till', 'safe', 1500, null, null, gen_random_uuid());
select move_cash('safe', 'owner', 20000, 'For the owner', null, gen_random_uuid());
insert into res select 'EQ', record_bill(pg_temp.supplier('Kurdistan Coffee Imports'), 'EQ-1', test.today(), 150000, 0,
                                         null, '1500', gen_random_uuid());
select pay_bill((pg_temp.r('EQ') ->> 'bill_id')::uuid, 150000, 'bank', null, gen_random_uuid());
insert into res select 'R1', receive_goods(pg_temp.supplier('Kurdistan Coffee Imports'),
  jsonb_build_array(jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 2, 'unit_code', 'kg',
                                       'unit_price', 9000)),
  p_idempotency_key => gen_random_uuid());
insert into res select 'KC', record_bill(pg_temp.supplier('Kurdistan Coffee Imports'), 'KC-1', test.today(), 18000, 0,
                                         (pg_temp.r('R1') ->> 'receipt_id')::uuid, null, gen_random_uuid());
select pay_bill((pg_temp.r('KC') ->> 'bill_id')::uuid, 10000, 'bank', null, gen_random_uuid());
insert into res select 'EL', record_bill(pg_temp.supplier('Kurdistan Coffee Imports'), 'EL-1', test.today(), 20000, 0,
                                         null, '6200', gen_random_uuid());
select pay_bill((pg_temp.r('EL') ->> 'bill_id')::uuid, 20000, 'safe', null, gen_random_uuid());
select test.act_as('manager@example.com');
select save_employee(null, 'Sara', null, 'Barista', pg_temp.main(), test.today(), null, gen_random_uuid());
select test.act_as('owner@example.com');
select record_advance(pg_temp.person('Sara'), 5000, 'safe', 'Rent due', null, gen_random_uuid());
select test.act_as('accountant@example.com');
select save_journal(test.today(), 'Bank charge', '[{"code": "6500", "debit": 100}, {"code": "1020", "credit": 100}]', false);
insert into res select 'J1', save_journal(test.today(), 'Cleaning', '[{"code": "6900", "debit": 700}, {"code": "1020", "credit": 700}]', true);
select reverse_journal((pg_temp.r('J1') ->> 'id')::uuid, 'Paid twice by mistake');
select test.act_as('cashier@example.com');
select test.eq(pg_temp.gl('1000'), 4700::numeric, 'the drawer should hold 4,700');
select close_cash_session(4200);

select test.as_admin();
select test.eq(pg_temp.gl('1000') || ' ' || pg_temp.gl('1001') || ' ' || pg_temp.gl('1005') || ' ' || pg_temp.gl('1020'),
  '4200 0 6500 242940', 'the cash today: the till, its dollars, the safe and the bank');

-- ------------------------------------------------------------------ the balance sheet
select test.act_as('owner@example.com');
insert into res select 'B1', report_balance_sheet(test.today() - 1);
select test.eq(pg_temp.bs_lines(pg_temp.r('B1')), '1005 50000, 1020 402940, 3000 450000',
  'yesterday: the safe and the bank, what the owner put in; the card takings settled');
select test.eq((select (b ->> 'cash') || ' cash, ' || (b ->> 'assets') || ' = ' || (b ->> 'liabilities') || ' + '
                       || (b ->> 'equity') || ' + ' || ((b ->> 'profit_this_year')::numeric + (b ->> 'profit_earlier')::numeric)
                       || ' profit, difference ' || (b ->> 'difference')
                  from (select pg_temp.r('B1') as b) x),
  '452940 cash, 452940 = 0 + 450000 + 2940 profit, difference 0', 'it balances: 3,000 of sales less the 60 fee');

insert into res select 'B0', report_balance_sheet(test.today());
select test.eq(pg_temp.bs_lines(pg_temp.r('B0')),
  '1000 4200, 1005 6500, 1010 7500, 1020 242940, 1200 37300, 1300 5000, 1500 150000, 2000 8000, 3000 471000, 3200 -20000',
  'today: the drawer, the safe, cards not yet settled, the bank, the stock, Sara''s advance, the grinder; the beans'' bill '
  || 'owed; the owner''s money in, and taken out');
select test.eq((select (b ->> 'cash') || ' cash + ' || ((b ->> 'current_assets')::numeric - (b ->> 'cash')::numeric)
                       || ' current + ' || (b ->> 'fixed_assets') || ' fixed = ' || (b ->> 'assets')
                  from (select pg_temp.r('B0') as b) x),
  '253640 cash + 49800 current + 150000 fixed = 453440', 'the assets');
select test.eq((select (b ->> 'liabilities') || ' owed + ' || (b ->> 'equity') || ' equity '
                       || ((b ->> 'profit_this_year')::numeric + (b ->> 'profit_earlier')::numeric) || ' profit = '
                       || (b ->> 'liabilities_and_equity') || ', difference ' || (b ->> 'difference')
                  from (select pg_temp.r('B0') as b) x),
  '8000 owed + 451000 equity -5560 profit = 453440, difference 0',
  'what it owes and the owner''s: the loss not yet closed is in the equity; it balances');
select test.eq((select trim_scale(sum(amount) filter (where section = 'revenue')
                                  - sum(amount) filter (where section <> 'revenue'))::text
                  from report_profit_and_loss(test.today() - 2, test.today())),
  ((pg_temp.r('B0') ->> 'profit_this_year')::numeric + (pg_temp.r('B0') ->> 'profit_earlier')::numeric)::text,
  'the profit is the P&L''s: 20,000 of sales less 2,500 given back, 1,700 of cost, the fees, the cloths, the '
  || 'electricity and the drawer''s 500, and 200 gained on the dollars');
select test.eq((select string_agg(distinct x ->> 'group', ',' order by x ->> 'group') from jsonb_array_elements(pg_temp.r('B0') -> 'lines') x),
  'cash,current,equity,fixed,liability', 'each account in its place');

-- ------------------------------------------------------------------ the cash flow of today
insert into res select 'F0', report_cash_flow(test.today(), test.today());
select test.eq(pg_temp.cash(pg_temp.r('F0')), '1000 0 → 4200, 1005 50000 → 6500, 1020 402940 → 242940',
  'the cash at the start and at the end, account by account');
select test.eq(pg_temp.cf_lines(pg_temp.r('F0')),
  'sales 7000 (9500 in, 2500 out), stock -10000 (0 in, 10000 out), staff -5000 (0 in, 5000 out), '
  || 'running -21000 (700 in, 21700 out), counts -500 (0 in, 500 out), equipment -150000 (0 in, 150000 out), '
  || 'owner -20000 (0 in, 20000 out), exchange 200 (200 in, 0 out)',
  'where it came from and went, line by line');
select test.eq(pg_temp.cf_accounts(pg_temp.r('F0'), 'sales'), '1010 -3000, 4000 12500, 4200 -2500',
  'from sales: the cash of the sales (the card part of the split not yet in the bank), less the refund; '
  || 'a sale''s cost and its stock cancel, and the card sale moved no cash');
select test.eq(pg_temp.cf_accounts(pg_temp.r('F0'), 'stock'), '2000 -10000', 'the beans'' bill, part paid');
select test.eq(pg_temp.cf_accounts(pg_temp.r('F0'), 'running'), '6200 -20000, 6900 -1000',
  'the electricity bill by what it was for; the cloths; the cleaning paid and reversed comes to nothing');
select test.eq(pg_temp.cf_accounts(pg_temp.r('F0'), 'equipment'), '1500 -150000',
  'the grinder''s bill, paid: investing, not a supplier of stock');
select test.eq((select (f ->> 'operating') || ' operating, ' || (f ->> 'investing') || ' investing, '
                       || (f ->> 'financing') || ' financing, ' || (f ->> 'exchange') || ' exchange = ' || (f ->> 'net')
                       || '; ' || (f ->> 'opening') || ' + ' || (f ->> 'net') || ' = ' || (f ->> 'closing')
                       || ', difference ' || (f ->> 'difference')
                  from (select pg_temp.r('F0') as f) x),
  '-29500 operating, -150000 investing, -20000 financing, 200 exchange = -199300; 452940 + -199300 = 253640, difference 0',
  'the sections, and the cash at the start and the flows come to the cash at the end');
select test.eq((pg_temp.r('F0') ->> 'closing'), (pg_temp.r('B0') ->> 'cash'), 'the balance sheet''s cash');

-- ------------------------------------------------------------------ over the three days
insert into res select 'F3', report_cash_flow(test.today() - 2, test.today());
select test.eq((select (f ->> 'opening') || ' + ' || (f ->> 'net') || ' = ' || (f ->> 'closing') || '; financing '
                       || (f ->> 'financing') || ', difference ' || (f ->> 'difference')
                  from (select pg_temp.r('F3') as f) x),
  '0 + 253640 = 253640; financing 430000, difference 0', 'from nothing: the owner''s 450,000 in, 20,000 out');
select test.eq(pg_temp.cf_accounts(pg_temp.r('F3'), 'sales'), '4000 12500, 4200 -2500, 6500 -60',
  'the card takings reached the bank, less their fee: as much as the split sale''s card part left');
select test.eq(pg_temp.cf_lines(report_cash_flow(test.today() - 1, test.today() - 1)), 'sales 2940 (2940 in, 0 out)',
  'yesterday: only the card takings settled');

-- ------------------------------------------------------------------ depreciation: no cash
select test.act_as('accountant@example.com');
select save_journal(test.today(), 'Depreciation of the grinder',
  '[{"code": "6400", "debit": 2500}, {"code": "1590", "credit": 2500}]', true);
insert into res select 'B2', report_balance_sheet(test.today());
select test.eq((select (x ->> 'amount') || ' in ' || (x ->> 'group') from jsonb_array_elements(pg_temp.r('B2') -> 'lines') x
                 where x ->> 'code' = '1590'), '-2500 in fixed', 'accumulated depreciation takes from the fixed assets');
select test.eq((select (b ->> 'fixed_assets') || ' fixed, profit '
                       || ((b ->> 'profit_this_year')::numeric + (b ->> 'profit_earlier')::numeric - (
                            (pg_temp.r('B0') ->> 'profit_this_year')::numeric + (pg_temp.r('B0') ->> 'profit_earlier')::numeric))
                       || ', difference ' || (b ->> 'difference')
                  from (select pg_temp.r('B2') as b) x),
  '147500 fixed, profit -2500, difference 0', 'the grinder less its depreciation, the profit less the charge: it balances');
select test.eq((report_cash_flow(test.today(), test.today()) ->> 'net'), (pg_temp.r('F0') ->> 'net'),
  'and the cash flow is as it was: depreciation moves no cash');

-- ------------------------------------------------------------------ an empty day, long ago
select test.eq((select jsonb_array_length(b -> 'lines') || ' lines, ' || (b ->> 'assets') || ', difference '
                       || (b ->> 'difference') from (select report_balance_sheet(test.today() - 30) as b) x),
  '0 lines, 0, difference 0', 'a day before anything happened');
select test.eq((select (f ->> 'opening') || ' ' || jsonb_array_length(f -> 'lines') || ' ' || (f ->> 'closing')
                  from (select report_cash_flow(test.today() - 30, test.today() - 20) as f) x),
  '0 0 0', 'no cash, and no flows');

-- ------------------------------------------------------------------ the year-end close
-- Last year: 10,000 of sales on 10 December, paid into the bank.
select test.as_admin();
create function pg_temp.on_day(p_day date, p_time text) returns timestamptz language sql security definer as $$
  select (p_day::timestamp + p_time::time) at time zone b.timezone
    from business b where b.id = '00000000-0000-0000-0000-0000000000b1'
$$;
create function pg_temp.last_dec(p_day int) returns date language sql as $$
  select make_date(extract(year from test.today())::int - 1, 12, p_day)
$$;
select pg_temp.post(pg_temp.on_day(pg_temp.last_dec(10), '12:00'), 'Last year''s sales',
  '[{"code": "1020", "debit": 10000}, {"code": "4000", "credit": 10000}]');
select test.act_as('owner@example.com');
insert into res select 'B3', report_balance_sheet(test.today());
select test.eq((pg_temp.r('B3') ->> 'profit_earlier')::numeric - (pg_temp.r('B2') ->> 'profit_earlier')::numeric
               || ' earlier, ' || (pg_temp.r('B3') ->> 'difference'),
  '10000 earlier, 0', 'last year''s profit, not yet closed, is apart from this year''s');
select test.eq((select (b ->> 'profit_this_year') || ' this year, ' || (b ->> 'profit_earlier') || ' earlier'
                  from (select report_balance_sheet(pg_temp.last_dec(30)) as b) x),
  '10000 this year, 0 earlier', 'at the end of 30 December last year, it was that year''s');
insert into res select 'L31', report_balance_sheet(pg_temp.last_dec(31));
select test.as_admin();
select post_year_end_close('00000000-0000-0000-0000-0000000000b1', pg_temp.last_dec(31));
select test.act_as('owner@example.com');
insert into res select 'B4', report_balance_sheet(test.today());
select test.eq((select (b ->> 'profit_earlier') || ' earlier; 3100 '
                       || (select x ->> 'amount' from jsonb_array_elements(b -> 'lines') x where x ->> 'code' = '3100')
                       || ' = ' || (pg_temp.r('B3') ->> 'profit_earlier') || '; equity '
                       || ((b ->> 'equity_total')::numeric - (pg_temp.r('B3') ->> 'equity_total')::numeric)
                       || ' changed; this year ' || ((b ->> 'profit_this_year')::numeric
                                                     - (pg_temp.r('B3') ->> 'profit_this_year')::numeric)
                       || ' changed; difference ' || (b ->> 'difference')
                  from (select pg_temp.r('B4') as b) x),
  format('0 earlier; 3100 %s = %s; equity 0 changed; this year 0 changed; difference 0',
         pg_temp.r('B3') ->> 'profit_earlier', pg_temp.r('B3') ->> 'profit_earlier'),
  'closed: last year''s profit is in retained earnings; the equity as it was');
select test.eq((select (b ->> 'profit_this_year') || ' this year; 3100 '
                       || (select x ->> 'amount' from jsonb_array_elements(b -> 'lines') x where x ->> 'code' = '3100')
                       || '; difference ' || (b ->> 'difference')
                  from (select report_balance_sheet(pg_temp.last_dec(31)) as b) x),
  format('0 this year; 3100 %s; difference 0', pg_temp.r('L31') ->> 'profit_this_year'),
  'at the end of the year closed, its profit is in retained earnings');
select test.eq(pg_temp.cf_lines(report_cash_flow(pg_temp.last_dec(1), pg_temp.last_dec(20))),
  'sales 10000 (10000 in, 0 out)', 'last December''s cash: the close moved none');

-- ------------------------------------------------------------------ refused
select test.throws($$select report_balance_sheet(null)$$, 'Choose the day', 'a balance sheet needs its day');
select test.throws($$select report_balance_sheet(test.today() + 1)$$, 'Choose today or a day before it', 'not tomorrow');
select test.throws($$select report_cash_flow(test.today(), test.today() - 1)$$,
  'Choose the dates, the first on or before the last', 'dates the wrong way round');
select test.throws($$select report_cash_flow(test.today() - 400, test.today())$$, 'Choose at most a year of dates',
  'more than a year');
select test.throws($$select report_cash_flow(test.today(), test.today() + 1)$$, 'Choose today or a day before it',
  'nor to tomorrow');

-- ------------------------------------------------------------------ who may
select test.as_admin();
create temp table audit0 as select (select count(*) from audit_log) as n, (select count(*) from journal_entry) as j;
grant select on audit0 to public;
select test.act_as('accountant@example.com');
select test.eq((report_balance_sheet(test.today()) ->> 'difference') || ' ' || (report_cash_flow(test.today(), test.today()) ->> 'difference'),
  '0 0', 'the accountant reads both');
select test.act_as('manager@example.com');
select test.eq((report_balance_sheet(test.today()) ->> 'assets'), (pg_temp.r('B4') ->> 'assets'), 'and the branch manager');
select test.act_as('buyer@example.com');
select test.throws($$select report_balance_sheet(test.today())$$, '%needs profit.view%',
  'the buyer sees costs, not the profit: no balance sheet');
select test.throws($$select report_cash_flow(test.today(), test.today())$$, '%needs profit.view%', 'nor the cash flow');
select test.act_as('cashier@example.com');
select test.throws($$select report_balance_sheet(test.today())$$, '%needs profit.view%', 'the cashier reads neither');
select test.throws($$select report_cash_flow(test.today(), test.today())$$, '%needs profit.view%', 'the cashier reads neither');
select test.throws($$select cash_flow_line('1000')$$, '%permission denied%', 'the helpers are not to be called');
select test.as_admin();
select test.eq((select (count(*) - (select n from audit0)) || ' ' || ((select count(*) from journal_entry) - (select j from audit0))
                  from audit_log), '0 0', 'reading only: nothing written');
