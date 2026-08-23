-- =============================================================================
-- 03_transactions.sql — DEMO transactions: opening balances, a purchase receipt,
-- a production batch, sample sales, a waste event, a stock count, and a Talabat
-- order + settlement with a deliberate discrepancy for the reconciliation demo.
--   *** EXAMPLE data only. All costs/prices are illustrative. ***
--
-- Every stock change is a row in inventory_movement (the ledger). Current stock
-- is derived from these, never entered directly.
-- =============================================================================

\set biz '''00000000-0000-0000-0000-0000000000b1'''

-- Convenience location ids
-- (subqueries used inline below for portability)

-- ---------------------------------------------------------------------------
-- 1) Opening balances at Main Branch (ingredients + packaging + finished goods)
--    base_quantity_signed = qty; value = qty * example unit cost.
-- ---------------------------------------------------------------------------
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason, occurred_at)
select :biz, i.id, (select id from location where name='Main Branch' and business_id=:biz),
       'opening_balance', ob.qty, ob.cost, ob.qty*ob.cost, 'Demo opening balance', timestamptz '2026-08-01 06:00:00+03'
from (values
  ('COFFEE', 20000::numeric, 40::numeric), ('MILK', 60000, 2), ('CREAM', 10000, 3),
  ('SUGAR', 20000, 1), ('VSYRUP', 5000, 5), ('ICE', 100000, 0.2),
  ('STRAWBCONC', 5000, 4),
  ('CUP_TA', 2000, 100), ('LID', 2000, 50), ('STRAW', 5000, 20),
  ('GEL_CUP', 1000, 120), ('GEL_SPOON', 5000, 15), ('NAPKIN', 10000, 10),
  ('CONE', 500, 90), ('CONE_SLEEVE', 500, 30), ('DBAG', 1000, 150),
  ('STICKER', 3000, 30), ('TSEAL', 3000, 40), ('CARRIER', 500, 200),
  ('SLUSH_CUP', 500, 90), ('BAKERY_BOX', 500, 250), ('WATER', 200, 300),
  ('CROISSANT', 40, 900)
) as ob(sku,qty,cost)
join item i on i.sku = ob.sku and i.business_id = :biz;

-- Opening balances at Central Kitchen (bulk production ingredients)
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason, occurred_at)
select :biz, i.id, (select id from location where name='Central Kitchen' and business_id=:biz),
       'opening_balance', ob.qty, ob.cost, ob.qty*ob.cost, 'Demo opening balance', timestamptz '2026-08-01 06:00:00+03'
from (values
  ('MILK', 100000::numeric, 2::numeric), ('CREAM', 40000, 3), ('SUGAR', 50000, 1),
  ('PISTPASTE', 10000, 20), ('VSYRUP', 5000, 5), ('FLOUR', 40000, 1), ('BUTTER', 20000, 6)
) as ob(sku,qty,cost)
join item i on i.sku = ob.sku and i.business_id = :biz;

-- ---------------------------------------------------------------------------
-- 2) Purchase order + goods receipt for straws: 5 cartons × 1,000 = 5,000 each.
--    Demonstrates purchase-unit → base-unit conversion in receiving.
-- ---------------------------------------------------------------------------
with po as (
  insert into purchase_order (business_id, supplier_id, location_id, status, note)
  values (:biz, (select id from supplier where name='City Packaging Supplies'),
          (select id from location where name='Main Branch' and business_id=:biz),
          'received', 'Demo straw purchase')
  returning id
), pol as (
  insert into purchase_order_line (purchase_order_id, item_id, order_qty, order_unit_code, unit_price)
  select po.id, (select id from item where sku='STRAW'), 5, 'carton_1000', 18000 from po
  returning id
), gr as (
  insert into goods_receipt (business_id, purchase_order_id, location_id, freight_total)
  select :biz, po.id, (select id from location where name='Main Branch' and business_id=:biz), 2000 from po
  returning id
), mv as (
  -- 5 cartons × 1000 = 5000 base units. Goods 90,000 + freight 2,000 landed.
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reason, occurred_at)
  select :biz, (select id from item where sku='STRAW'),
         (select id from location where name='Main Branch' and business_id=:biz),
         'purchase_receipt', 5000, 18.4, 92000, 'goods_receipt', 'Demo receipt (5×carton_1000)', timestamptz '2026-08-05 09:00:00+03'
  returning id
)
insert into goods_receipt_line (goods_receipt_id, item_id, received_qty, received_unit_code, goods_value, movement_id)
select gr.id, (select id from item where sku='STRAW'), 5, 'carton_1000', 90000, mv.id from gr, mv;

-- ---------------------------------------------------------------------------
-- 3) Production batch: 1 batch pistachio gelato. Planned 5,000 g, actual 4,800 g.
--    Consumes milk/cream/sugar/pistachio; outputs finished gelato at actual yield.
-- ---------------------------------------------------------------------------
with b as (
  insert into production_batch (business_id, recipe_id, location_id, status, batches,
     planned_yield_base, actual_yield_base, produced_at, expiry_date, total_consumed_value)
  select :biz, (select id from recipe where name='Pistachio Gelato Batch' and business_id=:biz),
         (select id from location where name='Central Kitchen' and business_id=:biz),
         'completed', 1, 5000, 4800, timestamptz '2026-08-06 08:00:00+03', date '2026-08-20', 18300
  returning id
),
cons as (
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reference_id, reason, occurred_at)
  select :biz, i.id, (select id from location where name='Central Kitchen' and business_id=:biz),
         'production_consumption', -c.qty, c.cost, c.qty*c.cost, 'production', b.id, 'Pistachio batch', timestamptz '2026-08-06 08:00:00+03'
  from b, (values ('MILK',2500::numeric,2::numeric),('CREAM',1500,3),('SUGAR',800,1),('PISTPASTE',400,20)) as c(sku,qty,cost)
  join item i on i.sku=c.sku and i.business_id=:biz
  returning 1
)
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reference_id, reason, occurred_at)
select :biz, (select id from item where sku='GEL_PIST'),
       (select id from location where name='Central Kitchen' and business_id=:biz),
       'production_output', 4800, 3.8125, 18300, 'production', b.id, 'Pistachio batch output (actual yield)', timestamptz '2026-08-06 09:00:00+03'
from b;

-- Transfer 2,000 g pistachio gelato from kitchen to Main Branch for sale.
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reason, occurred_at)
values
  (:biz, (select id from item where sku='GEL_PIST'), (select id from location where name='Central Kitchen' and business_id=:biz),
   'transfer_out', -2000, 3.8125, 7625, 'transfer', 'To Main Branch', timestamptz '2026-08-06 10:00:00+03'),
  (:biz, (select id from item where sku='GEL_PIST'), (select id from location where name='Main Branch' and business_id=:biz),
   'transfer_in', 2000, 3.8125, 7625, 'transfer', 'From Central Kitchen', timestamptz '2026-08-06 10:05:00+03');

-- ---------------------------------------------------------------------------
-- 4) Sample sales (dine-in latte, takeaway gelato) with consumption movements.
-- ---------------------------------------------------------------------------
-- Sale A: dine-in Iced Latte (no disposable packaging).
with o as (
  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
     gross_amount, discount_amount, net_amount, cogs_amount, placed_at)
  values (:biz, (select id from location where name='Main Branch' and business_id=:biz),
     'dine_in','completed', gen_random_uuid(), 4000, 0, 4000, 1300, timestamptz '2026-08-10 11:00:00+03')
  returning id
), l as (
  insert into sales_order_line (sales_order_id, product_variant_id, quantity, unit_price, line_net, cogs_amount)
  select o.id, pv.id, 1, 4000, 4000, 1300
  from o, product_variant pv join product p on p.id=pv.product_id
  where p.name='Iced Latte' and pv.name='Medium'
  returning sales_order_id
), t as (
  insert into sales_tender (sales_order_id, tender_type, amount) select o.id,'cash',4000 from o returning 1
)
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reference_id, reason, occurred_at)
select :biz, i.id, (select id from location where name='Main Branch' and business_id=:biz),
       'sale_consumption', -d.qty, d.cost, d.qty*d.cost, 'sale', o.id, 'Dine-in iced latte', timestamptz '2026-08-10 11:00:00+03'
from o, (values ('COFFEE',18::numeric,40::numeric),('MILK',200,2),('VSYRUP',30,5),('ICE',150,0.2)) as d(sku,qty,cost)
join item i on i.sku=d.sku and i.business_id=:biz;

-- Sale B: takeaway Gelato Cup Pistachio.
with o as (
  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
     gross_amount, discount_amount, net_amount, cogs_amount, placed_at)
  values (:biz, (select id from location where name='Main Branch' and business_id=:biz),
     'takeaway','completed', gen_random_uuid(), 3500, 0, 3500, 488, timestamptz '2026-08-10 12:30:00+03')
  returning id
), l as (
  insert into sales_order_line (sales_order_id, product_variant_id, quantity, unit_price, line_net, cogs_amount)
  select o.id, pv.id, 1, 3500, 3500, 488
  from o, product_variant pv join product p on p.id=pv.product_id
  where p.name='Gelato Cup' and pv.name='Single / Pistachio'
  returning 1
), t as (
  insert into sales_tender (sales_order_id, tender_type, amount) select o.id,'card',3500 from o returning 1
)
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reference_id, reason, occurred_at)
select :biz, i.id, (select id from location where name='Main Branch' and business_id=:biz),
       'sale_consumption', -d.qty, d.cost, d.qty*d.cost, 'sale', o.id, 'Takeaway pistachio gelato cup', timestamptz '2026-08-10 12:30:00+03'
from o, (values ('GEL_PIST',90::numeric,3.8125::numeric),('GEL_CUP',1,120),('GEL_SPOON',1,15),('NAPKIN',1,10)) as d(sku,qty,cost)
join item i on i.sku=d.sku and i.business_id=:biz;

-- ---------------------------------------------------------------------------
-- 5) Talabat order + settlement with a deliberate discrepancy (recon demo).
--    Numbers mirror acceptance scenario 4: expected payout 3,650.
-- ---------------------------------------------------------------------------
with so as (
  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
     gross_amount, discount_amount, net_amount, cogs_amount, placed_at)
  values (:biz, (select id from location where name='Main Branch' and business_id=:biz),
     'talabat','completed', gen_random_uuid(), 6000, 1000, 5000, 1910, timestamptz '2026-08-11 19:00:00+03')
  returning id
), po as (
  insert into platform_order (business_id, platform_id, location_id, external_order_id, status,
     store_list_value, item_level_discounts, order_level_discounts,
     merchant_funded_discount, platform_funded_discount,
     customer_payment, commission, payment_processing_fee, advertising_fee,
     refunds, expected_payout, sales_order_id, import_source, placed_at)
  select :biz, (select id from delivery_platform where code='talabat' and business_id=:biz),
     (select id from location where name='Main Branch' and business_id=:biz),
     'TLB-2026-0001','completed', 6000, 600, 400, 500, 500, 5000, 1100, 150, 100, 500, 3650,
     so.id, 'csv', timestamptz '2026-08-11 19:00:00+03'
  from so
  returning id
)
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reference_id, reason, occurred_at)
select :biz, i.id, (select id from location where name='Main Branch' and business_id=:biz),
       'sale_consumption', -d.qty, d.cost, d.qty*d.cost, 'platform_order', po.id, 'Talabat iced latte', timestamptz '2026-08-11 19:00:00+03'
from po, (values
  ('COFFEE',18::numeric,40::numeric),('MILK',200,2),('VSYRUP',30,5),('ICE',150,0.2),
  ('CUP_TA',1,100),('LID',1,50),('STRAW',1,20),('DBAG',1,150),('NAPKIN',2,10),
  ('STICKER',1,30),('TSEAL',1,40),('CARRIER',1,200)
) as d(sku,qty,cost)
join item i on i.sku=d.sku and i.business_id=:biz;

-- Settlement statement: reports payout 3,450 (short 200) and commission 1,300
-- (over by 200). The app's reconciler flags both; we also seed the issue rows.
with s as (
  insert into platform_settlement (business_id, platform_id, reference, period_start, period_end, statement_total)
  values (:biz, (select id from delivery_platform where code='talabat' and business_id=:biz),
     'TLB-SETTLE-2026-W32', date '2026-08-10', date '2026-08-16', 3450)
  returning id
), sl as (
  insert into platform_settlement_line (settlement_id, external_order_id, reported_payout, reported_commission, adjustment_note)
  select s.id, 'TLB-2026-0001', 3450, 1300, 'Fee adjustment' from s
  returning settlement_id
)
insert into reconciliation_issue (settlement_id, issue_type, external_order_id, detail, delta_amount)
select s.id, x.t::reconciliation_issue_type, 'TLB-2026-0001', x.detail, x.delta
from s, (values
  ('payout_difference','Reported payout 3450 vs expected 3650', -200::numeric),
  ('incorrect_commission','Reported commission 1300 vs expected 1100', 200)
) as x(t,detail,delta);

-- Link the platform order to its settlement + actual payout.
update platform_order
set settlement_id = (select id from platform_settlement where reference='TLB-SETTLE-2026-W32'),
    actual_payout = 3450, settlement_reference='TLB-SETTLE-2026-W32', settled_at = timestamptz '2026-08-17 12:00:00+03'
where external_order_id='TLB-2026-0001';

-- ---------------------------------------------------------------------------
-- 6) Waste event: 1,000 ml milk spoilage at Main Branch.
-- ---------------------------------------------------------------------------
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason, approval_status, occurred_at)
values (:biz, (select id from item where sku='MILK'), (select id from location where name='Main Branch' and business_id=:biz),
   'spoilage', -1000, 2, 2000, 'Left out overnight', 'approved', timestamptz '2026-08-12 08:00:00+03');

-- ---------------------------------------------------------------------------
-- 7) Stock count: straws expected 950 (example) counted 930 → -20 adjustment.
-- ---------------------------------------------------------------------------
with sc as (
  insert into stock_count (business_id, location_id, count_type, status, is_blind, submitted_at, approved_at)
  values (:biz, (select id from location where name='Main Branch' and business_id=:biz),
     'cycle','approved', true, timestamptz '2026-08-13 07:30:00+03', timestamptz '2026-08-13 08:00:00+03')
  returning id
), adj as (
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reason, approval_status, occurred_at)
  values (:biz, (select id from item where sku='STRAW'), (select id from location where name='Main Branch' and business_id=:biz),
     'count_adjustment', -20, 20, 400, 'stock_count', 'Cycle count variance', 'approved', timestamptz '2026-08-13 08:00:00+03')
  returning id
)
insert into stock_count_line (stock_count_id, item_id, expected_base, counted_base, adjustment_movement_id)
select sc.id, (select id from item where sku='STRAW'), 950, 930, adj.id from sc, adj;
