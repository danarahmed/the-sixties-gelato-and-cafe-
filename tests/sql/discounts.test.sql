-- =============================================================================
-- Discounts (0019): a percentage or an amount, at the counter or on a bill.
-- Revenue posts at the full price in 4000, the discount in 4100, the tender
-- at what the customer paid; each line carries its share; refunds, voids and
-- the reconciliation all still tie.
-- Golden catalogue: espresso 2,500 dine-in (200 COGS), water 1,000 (250 COGS).
-- =============================================================================
select test.golden_catalogue();
-- Until the last section this business rounds a percentage to the dinar, so
-- every share can be seen exactly. A step of 500, the default, comes last.
update business set discount_round_to = 1;
create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
create temp table s (k text primary key, r jsonb);
grant all on s to public;
create or replace function pg_temp.r(p text) returns jsonb language sql as $$ select r from s where k = p $$;

-- ----------------------------------------------------------- at the counter
select test.act_as('cashier@example.com');
-- 10% off two espressos: 5,000 less 500.
insert into s select 'pct', record_sale('30000000-0000-0000-0000-000000000001', 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]', null, 10);
select test.eq((pg_temp.r('pct') ->> 'gross')::numeric || '/' || (pg_temp.r('pct') ->> 'discount') || '/' || (pg_temp.r('pct') ->> 'net'),
  '5000/500/4500', 'ten percent of 5,000 is 500 off: 4,500 to pay');
select test.eq(test.lines_of((pg_temp.r('pct') ->> 'order_id')::uuid),
  '1000 Dr 4500 | 1200 Cr 400 | 4000 Cr 5000 | 4100 Dr 500 | 5000 Dr 400',
  'revenue at the full price, the discount in 4100, the cash as paid');
select test.as_admin();
select test.eq((select row(gross_amount, discount_amount, net_amount)::text from sales_order
                 where id = (pg_temp.r('pct') ->> 'order_id')::uuid), '(5000,500,4500)', 'the sale records all three');
select test.eq((select row(line_discount, line_net)::text from sales_order_line
                 where sales_order_id = (pg_temp.r('pct') ->> 'order_id')::uuid), '(500,4500)', 'and so does its line');
select test.eq((select amount from sales_tender where sales_order_id = (pg_temp.r('pct') ->> 'order_id')::uuid),
  4500::numeric, 'the drawer is owed what was paid');

-- The same key again is the same sale, discount and all.
select test.act_as('cashier@example.com');
select test.eq((record_sale('30000000-0000-0000-0000-000000000001', 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]', null, 10) ->> 'discount')::numeric, 500::numeric,
  'a retried discounted sale returns the discount it recorded');

-- Two lines share 15% in proportion, to the dinar: 525 = 375 + 150.
insert into s select 'two', record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]', null, 15);
select test.eq(pg_temp.r('two') ->> 'net', '2975', '15% of 3,500 is 525 off');
select test.as_admin();
select test.eq((select string_agg(line_discount || '+' || line_net, ',' order by line_net desc) from sales_order_line
                 where sales_order_id = (pg_temp.r('two') ->> 'order_id')::uuid), '375+2125,150+850',
  'each line carries its share, and the shares add up exactly');

-- A percentage that does not come out even is rounded to the business's step,
-- half-way up: 12.5% of 2,500 = 312.5 -> 313.
select test.act_as('cashier@example.com');
insert into s select 'half', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, 12.5);
select test.eq((pg_temp.r('half') ->> 'discount') || '/' || (pg_temp.r('half') ->> 'net'), '313/2187',
  'half a dinar rounds up');

-- An amount: 700 off 3,500.
insert into s select 'amt', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]', null, null, 700);
select test.eq((pg_temp.r('amt') ->> 'discount') || '/' || (pg_temp.r('amt') ->> 'net'), '700/2800', 'an amount is taken off as it is');

-- Never more than the bill: a free espresso posts no cash at all.
insert into s select 'free', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, null, 9999);
select test.eq((pg_temp.r('free') ->> 'discount') || '/' || (pg_temp.r('free') ->> 'net'), '2500/0',
  'a discount larger than the bill is the whole bill, never more');
select test.eq(test.lines_of((pg_temp.r('free') ->> 'order_id')::uuid),
  '1200 Cr 200 | 4000 Cr 2500 | 4100 Dr 2500 | 5000 Dr 200', 'a free item: revenue and its discount, and the cost');

-- Refused.
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, 10, 100)$$, '%not both%',
  'a percentage or an amount, not both');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, 0)$$, '%more than 0%', 'not 0%');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, 101)$$, '%no more than 100%', 'not over 100%');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, null, -5)$$, '%more than zero%',
  'not a negative amount');
select test.throws($$select record_sale(gen_random_uuid(), 'talabat', 'platform_paid',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, 10)$$, '%sets its own discounts%',
  'a delivery platform order takes no discount at the till');

-- Only someone allowed to may give a discount.
select test.as_admin();
delete from role_permission where role = 'cashier' and permission = 'discount.apply';
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, 10)$$, '%permission to give discounts%',
  'a discount needs discount.apply');
select test.succeeds($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]')$$, 'a sale without one does not');
select test.as_admin();
insert into role_permission (role, permission) values ('cashier', 'discount.apply');
select test.eq((select count(*) from audit_log where action = 'sale.discount')::int, 5,
  'every discount given is on the audit trail');

-- Refunded, the customer gets back what they paid; voided, everything comes back.
select test.act_as('manager@example.com');
select test.eq((refund_sale((pg_temp.r('two') ->> 'order_id')::uuid, 'did not like it') ->> 'refunded')::numeric,
  2975::numeric, 'a refund returns what was paid, not the full price');
select void_sale((pg_temp.r('amt') ->> 'order_id')::uuid, 'rung on the wrong table');
select test.eq((select string_agg(check_key || '=' || difference, ',' order by check_key)
                  from report_reconciliation(test.today())),
  'grni=0,inventory=0,payables=0,sales=0', 'the books tie, discounts included');
select test.as_admin();
select test.eq(test.balance('4100'), (500 + 525 + 313 + 2500)::numeric,
  'discounts given, less the voided one, sit in 4100');
select test.act_as('owner@example.com');
select test.eq((select amount from report_profit_and_loss(test.today(), test.today()) where code = '4100'),
  -(500 + 525 + 313 + 2500)::numeric, 'and the P&L shows them as a deduction from revenue');

-- --------------------------------------------------------------- on a bill
select test.act_as('cashier@example.com');
insert into ids select 'b1', (open_tab('dine_in', null, 'Discount table', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]', 10) ->> 'tab_id')::uuid;
select test.eq((select row(subtotal, discount, total, discount_percent)::text from pos_open_bills() where tab_id = pg_temp.id('b1')),
  '(5000,500,4500,10)', 'a bill opened with 10% off owes 4,500');
-- A percentage follows the bill as it grows.
select save_tab(pg_temp.id('b1'), 2,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]', null, null, 10);
select test.eq((select row(subtotal, discount, total)::text from pos_open_bills() where tab_id = pg_temp.id('b1')),
  '(6000,600,5400)', 'ten percent of the bill as it now stands');
-- Saved without a discount, the discount is gone; saved with an amount, it is that amount.
select save_tab(pg_temp.id('b1'), 3,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]', null, null, null, 1000);
select test.eq((select row(discount, total, discount_percent, discount_amount)::text from pos_open_bills()
                 where tab_id = pg_temp.id('b1')), '(1000,5000,,1000)', 'an amount off the bill');

-- Printed, the customer has seen the total: only a manager may change the discount.
select mark_bill_printed(pg_temp.id('b1'), 4);
select test.throws(format($$select save_tab(%L, 4, '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2},
  {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]', null, null, 50)$$, pg_temp.id('b1')),
  '%Only a manager can change the discount%', 'a cashier cannot change the discount on a printed bill');
select test.succeeds(format($$select save_tab(%L, 4, '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2},
  {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]')$$, pg_temp.id('b1')),
  'but may take it off: the customer pays more, not less');
select test.act_as('manager@example.com');
select save_tab(pg_temp.id('b1'), 5,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]', null, null, 20);
select test.as_admin();
select test.eq((select count(*) from audit_log where action = 'bill.discount' and entity_id = pg_temp.id('b1')::text)::int, 1,
  'a manager''s change to a printed bill''s discount is on the audit trail');

-- Paid by someone who may not give discounts: the bill's discount stands, it was given by a manager.
delete from role_permission where role = 'cashier' and permission = 'discount.apply';
select test.act_as('cashier@example.com');
insert into s select 'b1', settle_tab(pg_temp.id('b1'), 6, gen_random_uuid(), 'cash');
select test.eq((pg_temp.r('b1') ->> 'gross') || '/' || (pg_temp.r('b1') ->> 'discount') || '/' || (pg_temp.r('b1') ->> 'net'),
  '6000/1200/4800', 'the bill is paid with its discount: 20% of 6,000');
select test.eq(test.lines_of((pg_temp.r('b1') ->> 'order_id')::uuid),
  '1000 Dr 4800 | 1200 Cr 650 | 4000 Cr 6000 | 4100 Dr 1200 | 5000 Dr 650', 'and posts like any discounted sale');
select test.throws($$select open_tab('dine_in', null, 'No discounts', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', 5)$$, '%permission to give discounts%',
  'a bill cannot be given a discount by someone not allowed to');
select test.as_admin();
insert into role_permission (role, permission) values ('cashier', 'discount.apply');

-- Split: a percentage goes with each part; an amount stays where it was given.
select test.act_as('cashier@example.com');
insert into ids select 'b2', (open_tab('dine_in', null, 'Pct', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]', 10) ->> 'tab_id')::uuid;
insert into ids select 'b2.l', (lines -> 0 ->> 'line_id')::uuid from pos_open_bills() where tab_id = pg_temp.id('b2');
insert into ids select 'b2.new', (split_tab(pg_temp.id('b2'), 2, format('[{"line_id":"%s","qty":1}]', pg_temp.id('b2.l'))::jsonb)
  ->> 'tab_id')::uuid;
select test.eq((select string_agg(total::text, ',' order by total) from pos_open_bills()
                 where tab_id in (pg_temp.id('b2'), pg_temp.id('b2.new'))), '2250,2250', 'each half keeps its 10%');
insert into ids select 'b3', (open_tab('dine_in', null, 'Amt', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]', null, 500) ->> 'tab_id')::uuid;
insert into ids select 'b3.l', (lines -> 0 ->> 'line_id')::uuid from pos_open_bills() where tab_id = pg_temp.id('b3');
insert into ids select 'b3.new', (split_tab(pg_temp.id('b3'), 2, format('[{"line_id":"%s","qty":1}]', pg_temp.id('b3.l'))::jsonb)
  ->> 'tab_id')::uuid;
select test.eq((select string_agg(total::text, ',' order by total) from pos_open_bills()
                 where tab_id in (pg_temp.id('b3'), pg_temp.id('b3.new'))), '2000,2500',
  'an amount stays on the bill it was given on');

-- The books still tie after all of it.
select settle_tab(pg_temp.id('b2'), 3, gen_random_uuid(), 'cash');
select settle_tab(pg_temp.id('b2.new'), 1, gen_random_uuid(), 'card');
select settle_tab(pg_temp.id('b3'), 3, gen_random_uuid(), 'cash');
select settle_tab(pg_temp.id('b3.new'), 1, gen_random_uuid(), 'cash');
select test.act_as('owner@example.com');
select test.eq((select string_agg(check_key || '=' || difference, ',' order by check_key)
                  from report_reconciliation(test.today())),
  'grni=0,inventory=0,payables=0,sales=0', 'every subledger still reconciles');

-- ------------------------------------------- a step of 500, the default
-- A percentage comes to the nearest 500 IQD, so the change is always in notes:
-- 47% of 8,500 is 3,995, given as 4,000, leaving 4,500 to pay.
select test.as_admin();
update business set discount_round_to = 500;
select test.act_as('cashier@example.com');
insert into s select 'r47', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]', null, 47);
select test.eq((pg_temp.r('r47') ->> 'gross') || '/' || (pg_temp.r('r47') ->> 'discount') || '/' || (pg_temp.r('r47') ->> 'net'),
  '8500/4000/4500', '47% of 8,500 is 3,995: 4,000 off, 4,500 to pay');
select test.eq(test.lines_of((pg_temp.r('r47') ->> 'order_id')::uuid),
  '1000 Dr 4500 | 1200 Cr 850 | 4000 Cr 8500 | 4100 Dr 4000 | 5000 Dr 850', 'and the books record exactly that');
select test.as_admin();
select test.eq((select sum(line_discount) from sales_order_line where sales_order_id = (pg_temp.r('r47') ->> 'order_id')::uuid),
  4000::numeric, 'the lines share the rounded discount, to the dinar');

-- Exactly half-way rounds up; nearer nothing than 500 takes nothing off.
select test.act_as('cashier@example.com');
insert into s select 'r5', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]', null, 5);
select test.eq((pg_temp.r('r5') ->> 'discount') || '/' || (pg_temp.r('r5') ->> 'net'), '500/4500',
  '5% of 5,000 is 250, half-way: rounds up to 500');
insert into s select 'r2', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, 2);
select test.eq((pg_temp.r('r2') ->> 'discount') || '/' || (pg_temp.r('r2') ->> 'net'), '0/2500',
  '2% of 2,500 is 50: nearer nothing than 500, so nothing comes off');
select test.eq(test.lines_of((pg_temp.r('r2') ->> 'order_id')::uuid),
  '1000 Dr 2500 | 1200 Cr 200 | 4000 Cr 2500 | 5000 Dr 200', 'and no discount is posted');
insert into s select 'r90', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]', null, 90);
select test.eq((pg_temp.r('r90') ->> 'discount') || '/' || (pg_temp.r('r90') ->> 'net'), '1000/0',
  'rounding never takes off more than the bill');

-- An amount typed in is the cashier's choice, taken as it is.
insert into s select 'r300', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, null, 300);
select test.eq((pg_temp.r('r300') ->> 'discount') || '/' || (pg_temp.r('r300') ->> 'net'), '300/2200',
  'an amount is not rounded');

-- A bill shows, and is paid at, the same rounded discount.
insert into ids select 'b47', (open_tab('dine_in', null, 'Rounded', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]', 47) ->> 'tab_id')::uuid;
select test.eq((select row(subtotal, discount, total)::text from pos_open_bills() where tab_id = pg_temp.id('b47')),
  '(8500,4000,4500)', 'the open bill owes 4,500');
insert into s select 'b47', settle_tab(pg_temp.id('b47'), 2, gen_random_uuid(), 'cash');
select test.eq((pg_temp.r('b47') ->> 'gross') || '/' || (pg_temp.r('b47') ->> 'discount') || '/' || (pg_temp.r('b47') ->> 'net'),
  '8500/4000/4500', 'and is paid at 4,500');

-- The till is told the step, to show what the books will record.
select test.eq((my_profile() ->> 'discount_round_to')::numeric, 500::numeric, 'the till knows the step');
select test.act_as('owner@example.com');
select test.eq((select string_agg(check_key || '=' || difference, ',' order by check_key)
                  from report_reconciliation(test.today())),
  'grni=0,inventory=0,payables=0,sales=0', 'and the books still tie');
