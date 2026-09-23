-- =============================================================================
-- Production-shaped data, written exactly the way the pre-0014 application
-- wrote it. Loaded AFTER migration 0013 and BEFORE 0014, so the upgrade check
-- proves the new migrations apply cleanly on top of real history — including
-- the defects the audit found in that history.
--
-- Mirrors the live register at audit time: auto-posted entries with no
-- journal_no and no period_id, a receipt AND its bill both debiting Inventory
-- (C-05), a card sale debited to Cash (H-03), a zero-priced sale with zero
-- lines (the edge the new validator must not choke on), a raced duplicate
-- receipt journal (H-11), a doubled day close, a duplicate invoice (M-07),
-- stock records it never journaled, and a delivery posted straight to
-- Accounts payable that still awaits its bill.
-- =============================================================================
\set biz '''00000000-0000-0000-0000-0000000000b1'''

create temp table acct as select code, id from gl_account where business_id = :biz;
create temp table loc as select id from location where business_id = :biz and kind = 'branch' limit 1;

-- The period the old currentPeriod() created.
insert into accounting_period (business_id, name, starts_on, ends_on, status)
values (:biz, '2026-08', '2026-08-01', '2026-08-31', 'open');

-- A manual journal from before 0013 (numbered 1001 by 0013's backfill).
insert into journal_entry (id, business_id, period_id, description, journal_no, status, occurred_at)
values ('11111111-0000-0000-0000-000000000001', :biz,
        (select id from accounting_period where name = '2026-08'),
        'Owner capital introduced', 1001, 'published', '2026-08-01 09:00+03');
insert into journal_line (journal_entry_id, account_id, debit, credit)
select '11111111-0000-0000-0000-000000000001'::uuid, id,
       case code when '1000' then 5000000 else 0 end, case code when '3000' then 5000000 else 0 end
from acct where code in ('1000', '3000');

-- Goods receipt with its movement, then the auto-post AND a raced duplicate.
insert into goods_receipt (id, business_id, location_id, note, received_at)
values ('22222222-0000-0000-0000-000000000001', :biz, (select id from loc), 'Erbil Dairy Supply', '2026-08-05 10:00+03');
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reference_id, occurred_at)
select :biz, id, (select id from loc), 'purchase_receipt', 10000, 11, 110000, 'goods_receipt', '22222222-0000-0000-0000-000000000001', '2026-08-05 10:00+03'
from item where business_id = :biz and sku = 'MILK';

insert into journal_entry (id, business_id, description, reference_type, reference_id, occurred_at)
values ('11111111-0000-0000-0000-000000000002', :biz, 'Purchase received — Erbil Dairy Supply',
        'goods_receipt', '22222222-0000-0000-0000-000000000001', '2026-08-05 10:05+03'),
       ('11111111-0000-0000-0000-000000000003', :biz, 'Purchase received — Erbil Dairy Supply',
        'goods_receipt', '22222222-0000-0000-0000-000000000001', '2026-08-05 10:05+03');
insert into journal_line (journal_entry_id, account_id, debit, credit)
select e.id, a.id, case a.code when '1200' then 110000 else 0 end, case a.code when '2000' then 110000 else 0 end
from (values ('11111111-0000-0000-0000-000000000002'::uuid), ('11111111-0000-0000-0000-000000000003'::uuid)) e(id)
cross join acct a where a.code in ('1200', '2000');

-- The bill for the same delivery: the second Dr Inventory / Cr A/P (C-05).
insert into purchase_invoice (id, business_id, supplier_id, invoice_no, invoice_date, amount_total, paid_amount)
values ('33333333-0000-0000-0000-000000000001', :biz, (select id from supplier where business_id = :biz limit 1),
        'INV-2207', '2026-08-06', 110000, 0);
insert into journal_entry (id, business_id, description, reference_type, occurred_at)
values ('11111111-0000-0000-0000-000000000004', :biz, 'Bill INV-2207', 'purchase_invoice', '2026-08-06 12:00+03');
insert into journal_line (journal_entry_id, account_id, debit, credit)
select '11111111-0000-0000-0000-000000000004'::uuid, id,
       case code when '1200' then 110000 else 0 end, case code when '2000' then 110000 else 0 end
from acct where code in ('1200', '2000');

-- The same invoice number entered again (M-07).
insert into purchase_invoice (business_id, supplier_id, invoice_no, invoice_date, amount_total)
values (:biz, (select id from supplier where business_id = :biz limit 1), 'INV-2207', '2026-08-07', 110000);

-- A card sale the old POS debited to Cash (H-03), with no period and no number.
insert into sales_order (id, business_id, location_id, channel, status, idempotency_key, gross_amount, net_amount, cogs_amount, placed_at)
values ('44444444-0000-0000-0000-000000000001', :biz, (select id from loc), 'dine_in', 'completed', gen_random_uuid(), 4000, 4000, 940, '2026-08-10 23:30+03');
insert into sales_tender (sales_order_id, tender_type, amount) values ('44444444-0000-0000-0000-000000000001', 'card', 4000);
insert into journal_entry (id, business_id, description, reference_type, reference_id, occurred_at)
values ('11111111-0000-0000-0000-000000000005', :biz, 'Sale 44444444', 'sales_order', '44444444-0000-0000-0000-000000000001', '2026-08-10 23:30+03');
insert into journal_line (journal_entry_id, account_id, debit, credit)
select '11111111-0000-0000-0000-000000000005'::uuid, id,
       case code when '1000' then 4000 when '5000' then 940 else 0 end,
       case code when '4000' then 4000 when '1200' then 940 else 0 end
from acct where code in ('1000', '4000', '5000', '1200');

-- A zero-priced sale: the old code wrote a published entry with two 0/0 lines.
insert into journal_entry (id, business_id, description, reference_type, occurred_at)
values ('11111111-0000-0000-0000-000000000006', :biz, 'Sale (complimentary)', 'sales_order', '2026-08-11 12:00+03');
insert into journal_line (journal_entry_id, account_id, debit, credit)
select '11111111-0000-0000-0000-000000000006'::uuid, id, 0, 0 from acct where code in ('1000', '4000');

-- A draft someone parked.
insert into journal_entry (id, business_id, description, status, reference_type, occurred_at)
values ('11111111-0000-0000-0000-000000000007', :biz, 'Accrual (unfinished)', 'draft', 'manual', '2026-08-12 09:00+03');
insert into journal_line (journal_entry_id, account_id, debit, credit)
select '11111111-0000-0000-0000-000000000007'::uuid, id, 25000, 0 from acct where code = '6200';

-- The same trading day closed twice (no idempotency in the old day close).
insert into work_shift (business_id, location_id, opened_at, closed_at, expected_cash, counted_cash, variance)
values (:biz, (select id from loc), '2026-08-10 06:00Z', '2026-08-10 22:00Z', 0, 0, 0),
       (:biz, (select id from loc), '2026-08-10 06:00Z', '2026-08-10 22:05Z', 0, 0, 0);

-- An expense and a stock count as the old code wrote them.
insert into journal_entry (id, business_id, description, reference_type, occurred_at)
values ('11111111-0000-0000-0000-000000000008', :biz, 'Expense: August shop rent', 'expense', '2026-08-02 09:00+03');
insert into journal_line (journal_entry_id, account_id, debit, credit)
select '11111111-0000-0000-0000-000000000008'::uuid, id,
       case code when '6000' then 400000 else 0 end, case code when '1000' then 400000 else 0 end
from acct where code in ('6000', '1000');
insert into expense (business_id, amount, description, journal_entry_id)
values (:biz, 400000, 'August shop rent', '11111111-0000-0000-0000-000000000008');

insert into stock_count (id, business_id, location_id, count_type, status, is_blind)
values ('55555555-0000-0000-0000-000000000001', :biz, (select id from loc), 'cycle', 'approved', true);
insert into stock_count_line (stock_count_id, item_id, expected_base, counted_base)
select '55555555-0000-0000-0000-000000000001', id, 10000, 9950 from item where business_id = :biz and sku = 'MILK';

-- Stock records the old app moved but never journaled: the count's variance,
-- opening stock entered with an item, and a delivery it had not yet
-- "carried forward" to the books.
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reference_id, occurred_at)
select :biz, id, (select id from loc), 'count_adjustment', -50, 11, 550, 'stock_count', '55555555-0000-0000-0000-000000000001', '2026-08-20 18:00+03'
from item where business_id = :biz and sku = 'MILK';
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, occurred_at)
select :biz, id, (select id from loc), 'opening_balance', 10000, 2, 20000, '2026-08-01 08:00+03'
from item where business_id = :biz and sku = 'SUGAR';
insert into goods_receipt (id, business_id, location_id, note, received_at)
values ('22222222-0000-0000-0000-000000000002', :biz, (select id from loc), 'Zagros Coffee Roasters', '2026-08-12 10:00+03');
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reference_id, occurred_at)
select :biz, id, (select id from loc), 'purchase_receipt', 1000, 30, 30000, 'goods_receipt', '22222222-0000-0000-0000-000000000002', '2026-08-12 10:00+03'
from item where business_id = :biz and sku = 'COFFEE';

-- A delivery the old app did post — straight to Accounts payable, the way it
-- did before goods-received-not-invoiced existed — whose invoice has not
-- been entered yet. The old app kept the supplier's name in the note.
insert into goods_receipt (id, business_id, location_id, note, received_at)
values ('22222222-0000-0000-0000-000000000003', :biz, (select id from loc), 'Erbil Dairy Supply', '2026-08-14 10:00+03');
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reference_type, reference_id, occurred_at)
select :biz, id, (select id from loc), 'purchase_receipt', 25000, 2, 50000, 'goods_receipt', '22222222-0000-0000-0000-000000000003', '2026-08-14 10:00+03'
from item where business_id = :biz and sku = 'MILK';
insert into journal_entry (id, business_id, description, reference_type, reference_id, occurred_at)
values ('11111111-0000-0000-0000-000000000009', :biz, 'Purchase received — Erbil Dairy Supply',
        'goods_receipt', '22222222-0000-0000-0000-000000000003', '2026-08-14 10:05+03');
insert into journal_line (journal_entry_id, account_id, debit, credit)
select '11111111-0000-0000-0000-000000000009'::uuid, id,
       case code when '1200' then 50000 else 0 end, case code when '2000' then 50000 else 0 end
from acct where code in ('1200', '2000');

-- Snapshot, so the upgrade check can prove history came through untouched.
create table test.legacy_lines   as select journal_entry_id, account_id, debit, credit from journal_line;
create table test.legacy_entries as select id, description, status, journal_no, occurred_at from journal_entry;
create table test.legacy_accounts as select id, code, name, account_type, normal_balance from gl_account;
