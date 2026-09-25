-- =============================================================================
-- The drawer (0024, audit P0-2 and P0-3): a count covers every movement of cash
-- since the last one, whatever the day; money paid out says where it came
-- from; neither the till nor the safe goes below zero in the books; and the
-- till's account (1000) always equals what the drawer should hold.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table today as select test.today() d;
create temp table sup as select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' limit 1;
grant select on today, sup to public;

-- An espresso is 2,500 dine-in.
create function pg_temp.sell(p_qty int, p_tender text default 'cash') returns jsonb language sql as $$
  select record_sale(gen_random_uuid(), 'dine_in', p_tender::tender_type,
    jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p_qty)))
$$;
create function pg_temp.expected() returns numeric language sql as $$ select (drawer_status() ->> 'expected')::numeric $$;
create function pg_temp.lines_of_journal(p_no int) returns text language sql as $$
  select test.lines_of(reference_id) from journal_entry
   where journal_no = p_no and business_id = '00000000-0000-0000-0000-0000000000b1'
$$;

-- A new drawer starts from nothing; the cashier is not shown what it should hold.
select test.act_as('cashier@example.com');
select test.throws($$select drawer_status()$$, '%permission%', 'a cashier is not shown what the drawer should hold');
select test.act_as('manager@example.com');
select test.eq((drawer_status() ->> 'needs_start')::boolean, false, 'a new drawer needs no starting cash: it starts from nothing');
select test.eq(pg_temp.expected(), 0::numeric, 'and should hold nothing');

-- The owner puts in a float; cash sales go in, card sales do not.
select test.throws($$select move_cash('owner', 'till', 25000)$$, '%Say what the money is for%', 'money from the owner says what it is for');
create temp table fl as select move_cash('owner', 'till', 25000, 'Float for the till') as r;
select test.eq(pg_temp.lines_of_journal((select (r ->> 'journal_no')::int from fl)),
  '1000 Dr 25000 | 3000 Cr 25000', 'the float is the owner''s money put into the till');
select test.act_as('cashier@example.com');
select pg_temp.sell(1);
select pg_temp.sell(1);
select pg_temp.sell(1, 'card');
select test.act_as('manager@example.com');
select test.eq(pg_temp.expected(), 30000::numeric, 'float 25,000 + two cash espressos; the card sale is not in the drawer');
select test.eq((drawer_status() ->> 'card')::numeric, 2500::numeric, 'the card takings are shown beside it');

-- Paying out of the till lowers the drawer, and the drawer must hold the money.
create temp table ice as select record_expense('Ice', 1000, '6900', 'till') as r;
select test.eq(pg_temp.expected(), 29000::numeric, 'money paid out of the till leaves the drawer');
select test.eq(pg_temp.lines_of_journal((select (r ->> 'journal_no')::int from ice)),
  '1000 Cr 1000 | 6900 Dr 1000', 'Dr the expense, Cr the till');
select test.throws($$select record_expense('Rent', 400000, '6000', 'till')$$, '%drawer should hold only 29000%',
  'the till cannot pay more than it holds');
select test.as_admin();
select test.eq((select count(*) from expense where description = 'Rent')::int, 0, 'and the refused payment left nothing behind');
select test.act_as('manager@example.com');
select test.throws($$select record_expense('Gas', 1000, '6200', 'safe')$$, '%safe holds only 0%', 'nor can the safe, which is empty');
select test.throws($$select record_expense('Gas', 1000, '6200', 'pocket')$$, '%Say where the money came from%',
  'the money comes from somewhere the books know');
create temp table rep as select record_expense('Machine repair', 7000, '6900', 'owner') as r;
select test.eq(pg_temp.lines_of_journal((select (r ->> 'journal_no')::int from rep)),
  '3000 Cr 7000 | 6900 Dr 7000', 'what the owner paid personally is capital they put in');
select record_expense('Online advert', 500, '6900', 'card');
select test.eq(pg_temp.expected(), 29000::numeric, 'paid by the owner or a card, the drawer is untouched');

-- A void before the count takes its cash back out of the drawer.
select test.act_as('cashier@example.com');
create temp table v1 as select pg_temp.sell(1) as r;
grant select on v1 to public;
select test.act_as('manager@example.com');
select test.eq(pg_temp.expected(), 31500::numeric, 'the sale is in the drawer');
select void_sale((select (r ->> 'order_id')::uuid from v1), 'rang twice');
select test.eq(pg_temp.expected(), 29000::numeric, 'and its void takes it out again');

-- The count: 500 short; 25,000 stays for tomorrow and the rest goes to the safe.
select test.throws($$select count_drawer(28500, 25000)$$, '%the safe or the bank%', 'cash taken out needs a destination');
select test.throws($$select count_drawer(28500, 30000, 'safe')$$, '%between 0 and the 28500 counted%',
  'no more can stay than was counted');
create temp table c1 as select count_drawer(28500, 25000, 'safe') as r;
grant select on c1 to public;
select test.eq((select (r ->> 'expected')::numeric from c1), 29000::numeric, 'expected: the float, the sales, less the paid-out and the void');
select test.eq((select (r ->> 'variance')::numeric from c1), -500::numeric, '500 short');
select test.eq((select (r ->> 'taken')::numeric from c1), 3500::numeric, '3,500 to the safe');
select test.eq((select (r ->> 'cash_sales')::numeric || '/' || (r ->> 'voids')::numeric || '/' || (r ->> 'paid_out')::numeric
                       || '/' || (r ->> 'cash_in')::numeric from c1),
  '7500/2500/1000/25000', 'the count shows what went in and out: sales, voids, paid out, put in');
select test.as_admin();
select test.eq(test.lines_of((select (r ->> 'shift_id')::uuid from c1)), '1000 Cr 500 | 6300 Dr 500', 'the shortage is expensed');
select test.eq(test.lines_of((select id from cash_transfer where work_shift_id = (select (r ->> 'shift_id')::uuid from c1))),
  '1000 Cr 3500 | 1005 Dr 3500', 'the takings go from the till to the safe');
select test.eq(test.balance('1000'), 25000::numeric, 'the till''s account holds exactly what stayed in the drawer');
select test.eq(test.balance('1005'), 3500::numeric, 'and the safe what was taken to it');
select test.act_as('manager@example.com');
select test.eq(pg_temp.expected(), 25000::numeric, 'the next count starts from what stayed');
select test.eq((select count(*) from report_unclosed_days())::int, 0, 'every day''s cash is counted');

-- A sale after the count is never lost: it waits for the next count (the trial
-- of 24 September, where 7 sales went into a day already closed).
select test.act_as('cashier@example.com');
create temp table late as select pg_temp.sell(1) as r;
grant select on late to public;
select test.act_as('manager@example.com');
select test.eq(pg_temp.expected(), 27500::numeric, 'the sale after the count is in the next one');
select test.eq((select string_agg(day::text, ',') from report_unclosed_days()), (select d::text from today),
  'and its day is uncounted again until then');
select test.throws(format('select void_sale(%L, %L)',
  (select o.id from sales_order o join sales_tender t on t.sales_order_id = o.id and t.tender_type = 'cash'
    where o.status = 'completed' order by o.created_at limit 1), 'too late'),
  '%counted since this sale; refund it%', 'a sale in a counted drawer is refunded, not voided');

-- Refunds in cash come out of the drawer, which must hold them.
create temp table c2 as select count_drawer(27500, 1000, 'safe') as r;
select test.eq((select (r ->> 'variance')::numeric from c2), 0::numeric, 'counted exactly');
select test.throws(format('select refund_sale(%L, %L, %L)', (select r ->> 'order_id' from late), 'cold', 'quality'),
  '%drawer should hold only 1000%', 'a cash refund bigger than the drawer is refused');
select move_cash('safe', 'till', 2000, 'Change for a refund');
select refund_sale((select (r ->> 'order_id')::uuid from late), 'cold', 'quality');
select test.eq(pg_temp.expected(), 500::numeric, 'the cash put in, less the refund paid out');

-- Moving cash: only the owner takes money for themselves; the safe cannot go
-- below zero; a deposit moves the safe to the bank.
select test.throws($$select move_cash('till', 'owner', 100, 'lunch')$$, '%Only the owner%', 'a manager takes no money for themselves');
select test.throws($$select move_cash('safe', 'bank', 1000000, 'deposit')$$, '%safe holds only 28000%', 'the safe cannot go below zero');
select test.throws($$select move_cash('till', 'till', 100)$$, '%two of%', 'cash moves between two different places');
create temp table dep as select move_cash('safe', 'bank', 20000, 'Deposit') as r;
select test.eq(pg_temp.lines_of_journal((select (r ->> 'journal_no')::int from dep)),
  '1005 Cr 20000 | 1020 Dr 20000', 'a deposit: from the safe to the bank');
select test.act_as('owner@example.com');
create temp table drw as select move_cash('safe', 'owner', 1000, 'Personal') as r;
select test.eq(pg_temp.lines_of_journal((select (r ->> 'journal_no')::int from drw)),
  '1005 Cr 1000 | 3200 Dr 1000', 'the owner''s drawings');

-- A supplier paid from the till ('cash' still means the till), and an expense
-- reversed puts its cash back in the drawer.
select test.act_as('manager@example.com');
select receive_goods((select id from sup), '[{"item_id":"c0000000-0000-0000-0000-000000000003","qty":10,"goods_value":2500}]');
select test.act_as('owner@example.com');
create temp table bill as select record_bill((select id from sup), 'DRAWER-1', (select d from today), 2500, 0,
  (select id from goods_receipt order by receipt_no desc limit 1)) as r;
select test.throws(format('select pay_bill(%L, 2500, %L)', (select r ->> 'bill_id' from bill), 'cash'),
  '%drawer should hold only 500%', 'the till cannot pay a bill it does not hold');
select pay_bill((select (r ->> 'bill_id')::uuid from bill), 400, 'cash');
select test.eq(pg_temp.expected(), 100::numeric, 'the bill paid from the till leaves the drawer');
select reverse_journal((select id from journal_entry where reference_type = 'expense'
                         and reference_id = (select (r ->> 'expense_id')::uuid from ice)), 'The ice was returned');
select test.eq(pg_temp.expected(), 1100::numeric, 'the reversed paid-out comes back into the drawer');

-- The till's account never moves by hand; it always equals the drawer.
select test.throws($$select save_journal((select d from today), 'fudge', '[{"code":"6200","debit":5},{"code":"1000","credit":5}]', true)$$,
  '%subledger%', 'no manual journal to the till''s cash');
select test.as_admin();
select test.eq(test.balance('1000'), 1100::numeric, 'between counts, the till''s account is what the drawer should hold');

-- A month locks only when its cash is counted: money paid out of the till
-- since the last count keeps the day open until the next count.
select test.act_as('manager@example.com');
select test.eq((select string_agg(day::text, ',') from report_unclosed_days()), (select d::text from today),
  'cash moved since the count keeps today uncounted');
select count_drawer(1100);
select test.eq((select count(*) from report_unclosed_days())::int, 0, 'until the drawer is counted');
select test.act_as('owner@example.com');
select test.ok((select ok from period_close_checklist((select id from accounting_period
                 where business_id = '00000000-0000-0000-0000-0000000000b1' and (select d from today) between starts_on and ends_on))
                where check_key = 'days_closed'), 'and the month''s cash check passes');

-- Cash in and out of the drawer is never changed or deleted.
select test.as_admin();
select test.throws($$update cash_event set amount = 1 where kind = 'sale'$$, '%cannot change%', 'a movement of cash cannot be edited');
select test.throws($$delete from cash_event$$, '%never deleted%', 'nor deleted');
select test.throws($$delete from cash_transfer$$, '%cannot change or be deleted%', 'nor a transfer');
select test.eq((select count(*) from cash_event where work_shift_id is null)::int, 0, 'every movement is in exactly one count');
