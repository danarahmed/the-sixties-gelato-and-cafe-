-- =============================================================================
-- Voids and refunds (audit H-05, G7): the books and the shelf come back right.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table before as
  select test.balance('1000') cash, test.balance('4000') rev, test.balance('5000') cogs, test.balance('1200') inv,
         (item_position('00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-000000000001',
                        default_location('00000000-0000-0000-0000-0000000000b1'))).qty beans;
grant select on before to public;

select test.act_as('cashier@example.com');
create temp table s as select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]') as r;
grant select on s to public;

-- A cashier cannot void their own sale.
select test.throws($$select void_sale((select (r->>'order_id')::uuid from s), 'wrong item')$$,
  '%permission%', 'a cashier cannot void');

-- G7a — a manager voids it: every balance and the stock return exactly.
select test.act_as('manager@example.com');
select test.throws($$select void_sale((select (r->>'order_id')::uuid from s), '  ')$$, '%reason%', 'a void needs a reason');
select void_sale((select (r->>'order_id')::uuid from s), 'Rang up the wrong item');
select test.as_admin();
select test.eq(test.balance('1000'), (select cash from before), 'void: cash back to where it was');
select test.eq(test.balance('4000'), (select rev from before), 'void: revenue reversed');
select test.eq(test.balance('5000'), (select cogs from before), 'void: COGS reversed');
select test.eq(test.balance('1200'), (select inv from before), 'void: inventory value restored');
select test.eq((item_position('00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-000000000001',
                default_location('00000000-0000-0000-0000-0000000000b1'))).qty, (select beans from before),
               'void: the beans are back on the shelf');
select test.eq((select status::text from sales_order where id = (select (r->>'order_id')::uuid from s)), 'voided', 'status voided');
select test.eq((select count(*) from audit_log where action = 'sale.void')::int, 1, 'the void is in the audit trail');
select test.ok((select app_user_id is not null from audit_log where action = 'sale.void'), 'and it says who did it');

select test.act_as('manager@example.com');
select test.throws($$select void_sale((select (r->>'order_id')::uuid from s), 'again')$$, '%only a completed sale%', 'cannot void twice');

-- G7b — refund: a bottled water (returnable) and an espresso (not).
select test.act_as('cashier@example.com');
create temp table s2 as select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1},{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') as r;
grant select on s2 to public;
select test.act_as('manager@example.com');
create temp table rf as select refund_sale((select (r->>'order_id')::uuid from s2), 'Customer complaint') as r;
select test.eq((select (r->>'refunded')::numeric from rf), 3500::numeric, 'refunds the full 3,500');
select test.eq((select (r->>'returned_to_stock')::numeric from rf), 250::numeric, 'only the sealed water (250) goes back on the shelf');
select test.as_admin();
select test.eq(test.lines_of((select id from sale_adjustment where kind = 'refund')),
  '1000 Cr 3500 | 1200 Dr 250 | 4200 Dr 3500 | 5000 Cr 250',
  'G7b: Dr Returns, Cr Cash; the returned water back into stock, out of COGS');
select test.eq((select count(*) from inventory_movement where type = 'refund_return_to_stock'
                and item_id = 'c0000000-0000-0000-0000-000000000001')::int, 0, 'used coffee is never returned to stock');

-- Once the drawer is counted, a sale can only be refunded, not voided.
select test.act_as('cashier@example.com');
create temp table s3 as select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') as r;
grant select on s3 to public;
select test.as_admin();
create temp table today as select business_local_date('00000000-0000-0000-0000-0000000000b1', now()) d;
grant select on today to public;
select test.act_as('manager@example.com');
select count_drawer((drawer_status() ->> 'expected')::numeric);
select test.throws($$select void_sale((select (r->>'order_id')::uuid from s3), 'too late')$$,
  '%counted since this sale; refund%', 'a sale in a counted drawer cannot be voided');

select test.as_admin();
select test.eq((select sum(value * sign(base_quantity_signed)) from inventory_movement where business_id = '00000000-0000-0000-0000-0000000000b1'),
  test.balance('1200'), 'after voids and refunds the stock ledger still reconciles to 1200');
