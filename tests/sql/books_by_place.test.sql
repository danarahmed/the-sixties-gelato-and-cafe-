-- =============================================================================
-- The books by place (0056, release AB): the café has two branches and the
-- central kitchen. Each branch sells by card and on Talabat; a sale is voided
-- at the first branch and one refunded at the second; the first branch sends
-- the kitchen beans and some never arrive, and the kitchen spills some; the
-- second branch pays an expense and the owner writes a journal by hand;
-- Talabat pays out orders of both branches; last month's payroll pays a
-- person at each branch, is reopened, and approved again with a raise. Each
-- line of the profit and loss is at its place, and the places add up to the
-- café's, account by account. Someone who works at one place reads only
-- theirs. A year-end close reversed by hand is left out with the close.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
insert into location (business_id, kind, name) values ('00000000-0000-0000-0000-0000000000b1', 'branch', 'Second Branch');
create temp table ids as
select (select id from location where name = 'Main Branch') branch1, (select id from location where name = 'Second Branch') branch2,
       (select id from location where name = 'Central Kitchen') kitchen,
       'd1000000-0000-0000-0000-000000000001'::uuid espresso, 'c0000000-0000-0000-0000-000000000001'::uuid beans,
       'c0000000-0000-0000-0000-000000000002'::uuid cups,
       test.today() as today, (date_trunc('month', test.today()) - interval '1 month')::date as lm,
       (date_trunc('month', test.today()) - interval '1 day')::date as lm_end,
       (date_trunc('month', test.today()) - interval '2 month')::date as hired;
grant select on ids to public;
-- The second branch's manager, who works there only.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000f2', 'manager2@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Second Manager', 'manager2@example.com', 'a0000000-0000-0000-0000-0000000000f2');
insert into user_role (app_user_id, role, location_id)
select id, 'branch_manager', (select branch2 from ids) from app_user where email = 'manager2@example.com';

create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;
create function pg_temp.sale(p_place uuid, p_channel text, p_tender text, p_qty int, p_no text default null)
returns jsonb language sql as $$
  select record_sale(gen_random_uuid(), p_channel::sales_channel, p_tender::tender_type,
                     jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p_qty)),
                     p_location => p_place, p_platform_order_no => p_no)
$$;
-- The P&L of a place (or the café's: null) in the dates, as "code amount" of
-- the accounts with one.
create function pg_temp.pnl(p_from date, p_to date, p_place uuid default null) returns text language sql as $$
  select coalesce(string_agg(code || ' ' || trim_scale(amount), ', ' order by code), '')
    from report_profit_and_loss(p_from, p_to, p_place) where amount <> 0
$$;
-- The same, read from the P&L by place: one place's column, or the café's that
-- are no place's (p_none).
create function pg_temp.col(p_from date, p_to date, p_place uuid, p_none boolean default false) returns text
language sql as $$
  select coalesce(string_agg(code || ' ' || trim_scale(amount), ', ' order by code), '')
    from report_profit_and_loss_by_place(p_from, p_to)
   where (p_none and location_id is null) or (not p_none and location_id = p_place)
$$;
-- Account by account, the places and the café's no place's add up to the café:
-- the accounts where they do not, empty when all do.
create function pg_temp.untied(p_from date, p_to date) returns text language sql as $$
  select coalesce(string_agg(c.code || ' ' || trim_scale(c.amount) || ' vs ' || trim_scale(coalesce(p.amount, 0)), ', '), '')
    from report_profit_and_loss(p_from, p_to) c
    left join (select code, sum(amount) as amount from report_profit_and_loss_by_place(p_from, p_to) group by code) p
      on p.code = c.code
   where c.amount <> coalesce(p.amount, 0)
$$;
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
$$;

-- ------------------------------------------------------------------ the first branch sends the second its beans and cups
select test.act_as('owner@example.com');
insert into res select 'stock2', send_stock_transfer((select branch1 from ids), (select branch2 from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select beans from ids), 'qty', 500, 'unit_code', 'g'),
                    jsonb_build_object('item_id', (select cups from ids), 'qty', 5, 'unit_code', 'each')),
  'The second branch opens', p_idempotency_key => gen_random_uuid());
select receive_stock_transfer(pg_temp.id('stock2', 'transfer_id'), null, 'All there', gen_random_uuid());

-- ------------------------------------------------------------------ a day's trading at each place
-- The first branch: two espressos by card, one rung twice and voided, one on
-- Talabat.
insert into res select 'm1', pg_temp.sale((select branch1 from ids), 'dine_in', 'card', 2);
insert into res select 'm2', pg_temp.sale((select branch1 from ids), 'dine_in', 'card', 1);
select void_sale(pg_temp.id('m2', 'order_id'), null, 'rang_twice', null, gen_random_uuid());
insert into res select 'm3', pg_temp.sale((select branch1 from ids), 'talabat', 'platform_paid', 1, 'TB-1');
-- The second branch: an espresso by card, refunded; one on Talabat.
insert into res select 's1', pg_temp.sale((select branch2 from ids), 'dine_in', 'card', 1);
select refund_sale(pg_temp.id('s1', 'order_id'), 'Too cold', null, null, gen_random_uuid());
insert into res select 's2', pg_temp.sale((select branch2 from ids), 'talabat', 'platform_paid', 1, 'TB-2');
-- The first branch sends the kitchen 300 g of beans: 250 g arrive; the kitchen
-- spills 50 g.
insert into res select 'k1', send_stock_transfer((select branch1 from ids), (select kitchen from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select beans from ids), 'qty', 300, 'unit_code', 'g')),
  'For the kitchen', p_idempotency_key => gen_random_uuid());
select receive_stock_transfer(pg_temp.id('k1', 'transfer_id'),
  jsonb_build_array(jsonb_build_object('line_id', (select id from stock_transfer_line
                                                     where transfer_id = pg_temp.id('k1', 'transfer_id')), 'qty', 250)),
  'A bag split on the way', gen_random_uuid());
select record_loss('waste', (select beans from ids), null, 50, 'g', 'Spilt', null, (select kitchen from ids), null,
                   false, gen_random_uuid());
-- The second branch's cleaning, paid by the owner; a journal by hand for the
-- café's share of the rent.
select record_expense('Second branch''s cleaning', 7000, '6900', 'owner', null, (select branch2 from ids), p_idempotency_key => gen_random_uuid());
select save_journal((select today from ids), 'Rent: the café''s share',
  '[{"code": "6900", "debit": 1000}, {"code": "1020", "credit": 1000}]', true);
-- Talabat pays out both orders: 450 and 400 kept, and 100 more on TB-2.
insert into res select 'tb', post_platform_settlement('talabat', 'TB-STATEMENT-1',
  '[{"order_no": "TB-1", "payout": 2550, "commission": 450}, {"order_no": "TB-2", "payout": 2500, "commission": 400}]',
  null, 'TB-2 was paid 100 short', gen_random_uuid());
select test.eq(test.lines_of(pg_temp.id('tb', 'settlement_id')),
  '1020 Dr 5050 | 1100 Cr 6000 | 5100 Dr 850 | 5200 Dr 100', 'the payout, as it posts for the café');

-- ------------------------------------------------------------------ last month's payroll: a person at each branch
select save_employee(null, 'Rana', null, 'Barista', (select branch1 from ids), (select hired from ids), null, gen_random_uuid());
select save_employee(null, 'Sami', null, 'Barista', (select branch2 from ids), (select hired from ids), null, gen_random_uuid());
select set_employee_pay((select id from employee where full_name = 'Rana'), 'monthly', 600000, 8, null, null, gen_random_uuid());
select set_employee_pay((select id from employee where full_name = 'Sami'), 'monthly', 450000, 8, null, null, gen_random_uuid());
insert into res select 'run', draft_payroll((select lm from ids), gen_random_uuid());
insert into res select 'pay1', approve_payroll(pg_temp.id('run', 'run_id'), gen_random_uuid());
-- Reopened: Sami's pay was 500,000. Approved again.
select reopen_payroll(pg_temp.id('run', 'run_id'), 'Sami''s raise was left out', gen_random_uuid());
select set_employee_pay((select id from employee where full_name = 'Sami'), 'monthly', 500000, 8, null, 'raise', gen_random_uuid());
select draft_payroll((select lm from ids), gen_random_uuid());
insert into res select 'pay2', approve_payroll(pg_temp.id('run', 'run_id'), gen_random_uuid());
select test.as_admin();
select test.eq((select string_agg(l.name || ' ' || trim_scale(x.value::numeric), ', ' order by l.name)
                  from payroll_approval pa cross join lateral jsonb_each_text(pa.gross_by_place) x
                  join location l on l.id = x.key::uuid
                 where pa.journal_entry_id = (select id from journal_entry where journal_no = (pg_temp.r('pay1') ->> 'journal_no')::int)),
  'Main Branch 600000, Second Branch 450000', 'the first approval keeps what it paid at each place');
select test.eq((select string_agg(l.name || ' ' || trim_scale(x.value::numeric), ', ' order by l.name)
                  from payroll_approval pa cross join lateral jsonb_each_text(pa.gross_by_place) x
                  join location l on l.id = x.key::uuid
                 where pa.journal_entry_id = (select id from journal_entry where journal_no = (pg_temp.r('pay2') ->> 'journal_no')::int)),
  'Main Branch 600000, Second Branch 500000', 'and the second its own, with the raise');
select test.eq(pg_temp.checks(),
  'advances=0,card=0,documents=0,dollars=0,drawer=0,grni=0,inventory=0,payables=0,payroll=0,platform=0,prepaid=0,safe=0,sales=0,transit=0',
  'the books tie');

-- ------------------------------------------------------------------ the day, by place
select test.act_as('owner@example.com');
select test.eq(pg_temp.col((select today from ids), (select today from ids), (select branch1 from ids)),
  '4000 8000, 5000 650, 5100 450, 5300 500, 6100 -600000',
  'the first branch: its sales less the void, their cost, Talabat''s commission, the beans that never reached the kitchen, and last month''s pay taken back');
select test.eq(pg_temp.col((select today from ids), (select today from ids), (select branch2 from ids)),
  '4000 5500, 4200 -2500, 5000 450, 5100 400, 5200 100, 6100 -450000, 6900 7000',
  'the second branch: its sales, the refund, their cost, Talabat''s commission and what it paid short, the pay taken back, the cleaning');
select test.eq(pg_temp.col((select today from ids), (select today from ids), (select kitchen from ids)),
  '5300 500', 'the kitchen: the beans it spilt');
select test.eq(pg_temp.col((select today from ids), (select today from ids), null, true),
  '6900 1000', 'the café''s, no place''s: the journal by hand');
select test.eq(pg_temp.untied((select today from ids), (select today from ids)), '',
  'account by account, the places and the café''s add up to the café''s profit and loss');
select test.eq(pg_temp.pnl((select today from ids), (select today from ids), (select branch2 from ids)),
  pg_temp.col((select today from ids), (select today from ids), (select branch2 from ids)),
  'the second branch''s profit and loss is its column');

-- Last month: each approval split as it paid.
select test.eq(pg_temp.col((select lm from ids), (select lm_end from ids), (select branch1 from ids)), '6100 1200000',
  'last month, the first branch: Rana''s pay, approved twice');
select test.eq(pg_temp.col((select lm from ids), (select lm_end from ids), (select branch2 from ids)), '6100 950000',
  'the second branch: Sami''s 450,000, then 500,000');
select test.eq(pg_temp.untied((select lm from ids), (select lm_end from ids)), '', 'and they add up');

-- ------------------------------------------------------------------ someone who works at one place
select test.act_as('manager2@example.com');
select test.eq(pg_temp.pnl((select today from ids), (select today from ids)),
  '4000 5500, 4200 -2500, 5000 450, 5100 400, 5200 100, 6100 -450000, 6900 7000',
  'the second branch''s manager reads the second branch''s profit and loss');
select test.eq((select string_agg(distinct location, ', ') from report_profit_and_loss_by_place((select today from ids), (select today from ids))),
  'Second Branch', 'and only its column');
select test.throws(format('select * from report_profit_and_loss(%L, %L, %L)', test.today(), test.today(), (select branch1 from ids)),
  'You work at Second Branch, not at Main Branch', 'not the first branch''s');
select test.act_as('owner@example.com');
select test.throws(format('select * from report_profit_and_loss(%L, %L, %L)', test.today(), test.today(),
                          'f0000000-0000-0000-0000-0000000000b2'),
  'Choose one of the café''s places', 'a place of the café''s own');
select test.act_as('cashier@example.com');
select test.throws(format('select * from report_profit_and_loss_by_place(%L, %L)', test.today(), test.today()),
  '%needs profit.view%', 'a cashier does not read the profit and loss');
select test.act_as_anon();
select test.throws(format('select * from report_profit_and_loss_by_place(%L, %L)', test.today(), test.today()),
  '%permission denied%', 'nor does the public');

-- ------------------------------------------------------------------ a year-end close, reversed by hand
select test.act_as('owner@example.com');
create temp table before_close as
select pg_temp.pnl((select today from ids), (select today from ids)) as pnl,
       (dashboard_summary((select today from ids)) ->> 'net_revenue')::numeric as revenue;
grant select on before_close to public;
select test.as_admin();
insert into res select 'close', jsonb_build_object('entry', post_year_end_close('00000000-0000-0000-0000-0000000000b1', test.today()));
select test.act_as('owner@example.com');
select test.eq(pg_temp.pnl((select today from ids), (select today from ids)), (select pnl from before_close),
  'the close is not in the profit and loss');
select reverse_journal(pg_temp.id('close', 'entry'), 'Closed by mistake', test.today(), gen_random_uuid());
select test.eq(pg_temp.pnl((select today from ids), (select today from ids)), (select pnl from before_close),
  'nor is its reversal: the year is not counted twice');
select test.eq(pg_temp.untied((select today from ids), (select today from ids)), '', 'the places still add up');
select test.eq((dashboard_summary((select today from ids)) ->> 'net_revenue')::numeric, (select revenue from before_close),
  'the dashboard counts neither');
select test.eq((select sum(credit - debit) from report_journal_lines(test.today(), test.today(), array['4000'], true)),
  13500::numeric, 'the profit and loss''s lines leave out both');
select test.eq((select count(*) from report_journal_lines(test.today(), test.today(), array['4000'], false))
               - (select count(*) from report_journal_lines(test.today(), test.today(), array['4000'], true)),
  2::bigint, 'while the ledger shows both');
