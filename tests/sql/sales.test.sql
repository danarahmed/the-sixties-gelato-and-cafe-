-- =============================================================================
-- Sales: golden journals (audit G1-G3), idempotency (H-01), card clearing
-- (H-03), channel packaging, permissions, and the negative-stock policy (H-10).
-- Costs: beans 10 IQD/g, espresso = 20 g; cup 50; bottled water 250.
-- =============================================================================
select test.golden_catalogue();
select test.act_as('cashier@example.com');

-- G1 — cash sale of two espressos dine-in: 5,000 revenue, 40 g x 10 = 400 COGS.
create temp table s1 as select record_sale('10000000-0000-0000-0000-000000000001', 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]') as r;
select test.eq((select (r->>'net')::numeric from s1), 5000::numeric, 'G1 net');
select test.eq((select (r->>'cogs')::numeric from s1), 400::numeric, 'G1 cogs');
select test.eq(test.lines_of((select (r->>'order_id')::uuid from s1)),
  '1000 Dr 5000 | 1200 Cr 400 | 4000 Cr 5000 | 5000 Dr 400', 'G1 journal');

-- H-01 — the till retries with the same key: the original comes back, nothing posts twice.
select test.eq((record_sale('10000000-0000-0000-0000-000000000001', 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]') ->> 'replayed')::boolean,
  true, 'a retried sale is recognised as a replay');
select test.eq((select count(*) from sales_order where idempotency_key = '10000000-0000-0000-0000-000000000001')::int,
  1, 'the retry created no second order');

-- G2 / H-03 — card takings debit Card clearing, never Cash.
create temp table s2 as select record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') as r;
select test.eq(test.lines_of((select (r->>'order_id')::uuid from s2)),
  '1010 Dr 2500 | 1200 Cr 200 | 4000 Cr 2500 | 5000 Dr 200', 'G2 card sale clears through 1010');

-- Takeaway consumes the cup; dine-in did not.
create temp table s3 as select record_sale(gen_random_uuid(), 'takeaway', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') as r;
select test.eq(test.lines_of((select (r->>'order_id')::uuid from s3)),
  '1000 Dr 2500 | 1200 Cr 250 | 4000 Cr 2500 | 5000 Dr 250', 'takeaway adds the 50 IQD cup to COGS');

-- G3 (sale side) — a Talabat order is platform-paid, at the Talabat price.
create temp table s4 as select record_sale(gen_random_uuid(), 'talabat', 'platform_paid',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') as r;
select test.eq(test.lines_of((select (r->>'order_id')::uuid from s4)),
  '1100 Dr 3000 | 1200 Cr 250 | 4000 Cr 3000 | 5000 Dr 250', 'Talabat sale posts to Platform receivable');

-- A resale item is issued one-for-one.
create temp table s5 as select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":2}]') as r;
select test.eq((select (r->>'cogs')::numeric from s5), 500::numeric, 'two bottles at 250');

-- Line COGS add up to the order, and the order to its movements.
select test.eq((select sum(cogs_amount) from sales_order_line where sales_order_id = (select (r->>'order_id')::uuid from s3)),
               250::numeric, 'line COGS sum to the order');
select test.eq((select sum(value) from inventory_movement where reference_id = (select (r->>'order_id')::uuid from s3)),
               250::numeric, 'movements sum to the order COGS');

-- Guard rails.
select test.throws($$select record_sale(gen_random_uuid(), 'talabat', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]')$$,
  '%platform-paid%', 'a Talabat order cannot be taken as cash');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'platform_paid', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]')$$,
  '%platform-paid%', 'a dine-in order cannot be platform-paid');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[]')$$, '%cart is empty%', 'an empty cart is refused');
select test.throws($$select record_sale(gen_random_uuid(), 'careem', 'platform_paid', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]')$$,
  '%No careem price%', 'a channel with no price is refused, not sold at zero');

select test.act_as('counter@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]')$$,
  '%permission%', 'a stock counter cannot ring up sales');

-- Inventory subledger equals the Inventory control account.
select test.as_admin();
select test.eq((select sum(value * sign(base_quantity_signed)) from inventory_movement
                where business_id = '00000000-0000-0000-0000-0000000000b1'),
               test.balance('1200'), 'inventory movements reconcile to account 1200');

-- H-10 — with prevention on, the sale is refused; with it off, a sale from
-- negative stock is costed at the last purchase cost, never at zero.
update business set prevent_negative_stock = true where id = '00000000-0000-0000-0000-0000000000b1';
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":100}]')$$,
  '%Not enough Golden beans%', 'selling beyond stock is refused when prevention is on');
select test.as_admin();
update business set prevent_negative_stock = false where id = '00000000-0000-0000-0000-0000000000b1';
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":50}]');
select test.ok((item_position('00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-000000000001',
                default_location('00000000-0000-0000-0000-0000000000b1'))).qty < 0, 'beans are now negative');
create temp table s6 as select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') as r;
select test.eq((select (r->>'cogs')::numeric from s6), 200::numeric, 'a sale from negative stock costs 200, not 0');
