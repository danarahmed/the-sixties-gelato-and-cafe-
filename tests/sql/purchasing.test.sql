-- =============================================================================
-- Purchase to pay: receipt -> GRNI -> bill -> payment (audit C-05, G4-G6),
-- exact landed-cost allocation, duplicate invoices (M-07), overpayment (H-11).
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table sup as select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' limit 1;
grant select on sup to public;

select test.act_as('manager@example.com');

-- G4 — receive 2 kg of beans for 18,000 plus 2,000 freight: 20,000 landed, 10/g.
create temp table r1 as select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":2,"unit_code":"kg","goods_value":18000}]', 2000) as r;
select test.eq(test.lines_of((select (r->>'receipt_id')::uuid from r1)),
  '1200 Dr 20000 | 2050 Cr 20000', 'G4 receipt: Dr Inventory / Cr GRNI, never A/P');
select test.eq((select base_quantity_signed from inventory_movement where reference_id = (select (r->>'receipt_id')::uuid from r1)),
  2000::numeric, '2 kg converted to 2,000 g by the item''s own unit, not a browser-supplied factor');

-- Landed cost: 100 freight over three equal lines is 34/33/33, never 33/33/33.
-- (Cups at twice their cost: the price is confirmed, 0027.)
create temp table r2 as select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":1,"goods_value":100},
    {"item_id":"c0000000-0000-0000-0000-000000000002","qty":1,"goods_value":100},
    {"item_id":"c0000000-0000-0000-0000-000000000002","qty":1,"goods_value":100}]', 100, p_confirm => true) as r;
select test.eq((select sum(value) from inventory_movement where reference_id = (select (r->>'receipt_id')::uuid from r2)),
  400::numeric, 'landed values add up to goods + freight exactly');
select test.eq((select string_agg(value::text, ',' order by value desc) from inventory_movement
                where reference_id = (select (r->>'receipt_id')::uuid from r2)),
  '134,133,133', 'the leftover unit goes to one line, by largest remainder');

-- G5 — the bill for the first receipt, 500 over: the variance goes to 5050.
create temp table b1 as select record_bill((select id from sup), 'INV-001', test.today(), 20500, 15,
  (select (r->>'receipt_id')::uuid from r1)) as r;
select test.eq(test.lines_of((select (r->>'bill_id')::uuid from b1)),
  '2000 Cr 20500 | 2050 Dr 20000 | 5050 Dr 500', 'G5 bill clears GRNI, variance to PPV, payable raised once');

-- A receipt is billed by the supplier who delivered it.
select test.throws($$select record_bill((select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1'
                                           and id <> (select id from sup) limit 1),
                                        'OTHER-1', test.today(), 100, 0, (select (r->>'receipt_id')::uuid from r2))$$,
  '%different supplier%', 'another supplier cannot bill someone else''s delivery');

-- Under-billed: the variance is a credit.
create temp table b2 as select record_bill((select id from sup), 'INV-002', test.today(), 350, 0,
  (select (r->>'receipt_id')::uuid from r2)) as r;
select test.eq(test.lines_of((select (r->>'bill_id')::uuid from b2)),
  '2000 Cr 350 | 2050 Dr 400 | 5050 Cr 50', 'billed below receipt value credits PPV');

-- C-05 regression: receiving and billing 100,000 raises Inventory by 100,000, not 200,000.
create temp table inv_before as select test.balance('1200') b;
grant select on inv_before to public;
select receive_goods((select id from sup), '[{"item_id":"c0000000-0000-0000-0000-000000000003","qty":400,"goods_value":100000}]');
select record_bill((select id from sup), 'INV-003', test.today(), 100000, 0,
  (select id from goods_receipt where business_id = '00000000-0000-0000-0000-0000000000b1' order by receipt_no desc limit 1));
select test.eq(test.balance('1200') - (select b from inv_before), 100000::numeric,
  'a receipt plus its bill raises Inventory once');
select test.eq(test.balance('2050'), 0::numeric, 'every receipt is billed, so GRNI is clear');

-- A bill that is not for stock goes to the account chosen, never to Inventory.
create temp table b4 as select record_bill((select id from sup), 'ELEC-8', test.today(), 150000, 30, null, '6200') as r;
select test.eq(test.lines_of((select (r->>'bill_id')::uuid from b4)), '2000 Cr 150000 | 6200 Dr 150000', 'non-stock bill');

select test.throws($$select record_bill((select id from sup), 'X-1', test.today(), 100, 0, null, '1200')$$,
  '%cannot take a bill%', 'a bill cannot debit Inventory without a receipt');
select test.throws($$select record_bill((select id from sup), 'X-2', test.today(), 100, 0,
  (select (r->>'receipt_id')::uuid from r1), '6200')$$, '%choose one%', 'a bill is for a receipt or an account, not both');
select test.throws($$select record_bill((select id from sup), 'inv-001', test.today(), 5, 0, null, '6200')$$,
  '%already recorded%', 'M-07: the same invoice number (any case) is refused');
select test.throws($$select record_bill((select id from sup), 'INV-009', test.today(), 5, 0, (select (r->>'receipt_id')::uuid from r1))$$,
  '%already been billed%', 'a receipt is billed once');

-- G6 — payment. A manager cannot pay (separation of duties); the owner can.
select test.throws($$select pay_bill((select (r->>'bill_id')::uuid from b1), 20500, 'cash')$$,
  '%permission%', 'the person who buys does not also pay');
select test.act_as('owner@example.com');
create temp table p1 as select pay_bill((select (r->>'bill_id')::uuid from b1), 20000, 'bank') as r;
select test.eq(test.lines_of((select (r->>'payment_id')::uuid from p1)), '1020 Cr 20000 | 2000 Dr 20000', 'G6 payment by bank');
select test.eq((select (r->>'outstanding')::numeric from p1), 500::numeric, 'partial payment leaves 500');
select test.throws($$select pay_bill((select (r->>'bill_id')::uuid from b1), 501, 'cash')$$,
  '%more than the 500 outstanding%', 'cannot pay more than is owed');
select pay_bill((select (r->>'bill_id')::uuid from b1), 500, 'bank');
select test.eq((select is_paid from purchase_invoice where id = (select (r->>'bill_id')::uuid from b1)), true, 'the bill is settled');

-- The database itself refuses overpayment, whatever path is used (H-11).
select test.as_admin();
select test.throws($$insert into supplier_payment (business_id, supplier_id, purchase_invoice_id, amount)
  values ('00000000-0000-0000-0000-0000000000b1', (select id from sup), (select (r->>'bill_id')::uuid from b1), 1)$$,
  '%exceed the bill total%', 'even a direct insert cannot overpay a bill');
-- Setting paid_amount by hand is not rejected; it is recomputed from the
-- payments on every write, so the attempt simply has no effect.
update purchase_invoice set paid_amount = 0, is_paid = false where id = (select (r->>'bill_id')::uuid from b1);
select test.eq((select paid_amount from purchase_invoice where id = (select (r->>'bill_id')::uuid from b1)), 20500::numeric,
  'paid_amount cannot be set by hand: it always equals the payments recorded');
select test.throws($$update purchase_invoice set amount_total = 1 where id = (select (r->>'bill_id')::uuid from b1)$$,
  '%cannot change%', 'a bill''s amount cannot be edited');

-- Reconciliation: payables subledger = 2000; stock ledger = 1200.
select test.eq((select sum(amount_total - paid_amount) from purchase_invoice where business_id = '00000000-0000-0000-0000-0000000000b1'),
  -test.balance('2000'), 'unpaid bills reconcile to Accounts payable');
select test.eq((select sum(value * sign(base_quantity_signed)) from inventory_movement where business_id = '00000000-0000-0000-0000-0000000000b1'),
  test.balance('1200'), 'stock ledger reconciles to Inventory');

-- Cancelling a bill entered in error (M-07): the record stays, its journal is
-- reversed, it stops being owed, and its number and receipt are free again.
select test.act_as('manager@example.com');
create temp table cancel_r3 as select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":10,"goods_value":500}]') as r;
create temp table cancel_b3 as select record_bill((select id from sup), 'INV-777', test.today(), 5000, 0,
  (select (r->>'receipt_id')::uuid from cancel_r3)) as r;   -- typed 5,000 for a 500 delivery
select test.throws($$select cancel_bill((select (r->>'bill_id')::uuid from cancel_b3), 'typed 5000 for 500')$$,
  '%permission%', 'the person who buys cannot also cancel bills');
select test.act_as('owner@example.com');
select test.throws($$select cancel_bill((select (r->>'bill_id')::uuid from cancel_b3), '  ')$$, '%Say why%', 'a cancellation needs a reason');
select test.throws($$select cancel_bill((select (r->>'bill_id')::uuid from cancel_b3), 'typed 5000 for 500', test.today() + 2)$$,
  '%has happened%', 'a cancellation is not dated in the future');
select cancel_bill((select (r->>'bill_id')::uuid from cancel_b3), 'typed 5000 for 500');
select test.as_admin();
select test.ok((select cancelled_at is not null and cancel_reason = 'typed 5000 for 500' from purchase_invoice
                where id = (select (r->>'bill_id')::uuid from cancel_b3)), 'the bill is marked cancelled, with its reason — not deleted');
select test.eq((select count(*) from journal_entry where reverses_entry =
                 (select journal_entry_id from purchase_invoice where id = (select (r->>'bill_id')::uuid from cancel_b3)))::int,
               1, 'its journal is reversed');
select test.eq((select count(*) from audit_log where action = 'bill.cancel')::int, 1, 'and the cancellation is audited');
select test.throws($$update purchase_invoice set cancelled_at = null, cancel_reason = null
                     where id = (select (r->>'bill_id')::uuid from cancel_b3)$$, '%already cancelled%', 'a cancellation cannot be undone by hand');
select test.act_as('owner@example.com');
select test.throws($$select pay_bill((select (r->>'bill_id')::uuid from cancel_b3), 1, 'cash')$$, '%cancelled%', 'a cancelled bill cannot be paid');
select test.throws($$select cancel_bill((select (r->>'bill_id')::uuid from cancel_b3), 'again')$$, '%already cancelled%', 'nor cancelled twice');
select test.throws($$select cancel_bill((select (r->>'bill_id')::uuid from b1), 'x')$$, '%payments%', 'a bill with payments cannot be cancelled');
create temp table cancel_b4 as select record_bill((select id from sup), 'INV-777', test.today(), 500, 0,
  (select (r->>'receipt_id')::uuid from cancel_r3)) as r;
select test.eq(test.lines_of((select (r->>'bill_id')::uuid from cancel_b4)), '2000 Cr 500 | 2050 Dr 500',
  'the corrected bill takes the same invoice number and the same receipt');
select test.eq((select string_agg(check_key || '=' || difference, ',' order by check_key) from report_reconciliation(test.today())),
  'grni=0,inventory=0,payables=0,sales=0', 'and the books still reconcile');
select test.act_as('owner@example.com');
select test.eq((select count(*) from legacy_unposted())::int, 0,
  'everything the app records is journaled as it happens: nothing awaits a journal');

-- ------------------------------------------------- the café's own bill numbers
-- Left blank, a bill takes the café's own number, SGC-<year>-0001 and on: one
-- count for every supplier, never given twice, and never typed in by hand.
select test.as_admin();
create temp table yr as select extract(year from test.today())::int as y;
grant select on yr to public;
create or replace function pg_temp.own(n int) returns text language sql as $$
  select format('SGC-%s-%s', (select y from yr), lpad(n::text, 4, '0')) $$;
create temp table sup2 as select id from supplier
  where business_id = '00000000-0000-0000-0000-0000000000b1' and id <> (select id from sup) limit 1;
grant select on sup2 to public;

select test.act_as('manager@example.com');
select test.eq(next_bill_number(), pg_temp.own(1), 'the bill form is offered the café''s first number of the year');
select test.eq(next_bill_number(), pg_temp.own(1), 'and looking at it does not use it up');
create temp table own1 as select record_bill((select id from sup), null, test.today(), 1000, 0, null, '6200') as r;
select test.eq(own1.r ->> 'invoice_no', pg_temp.own(1), 'a bill with no number takes it') from own1;
create temp table own2 as select record_bill((select id from sup2), '   ', test.today(), 2000, 0, null, '6200') as r;
select test.eq(own2.r ->> 'invoice_no', pg_temp.own(2), 'the next, for another supplier, takes the next: one count for the café')
  from own2;
select test.as_admin();
select test.eq((select description || ' | ' || reference_no from journal_entry
                 where id = (select journal_entry_id from purchase_invoice where id = (select (r ->> 'bill_id')::uuid from own1))),
  'Bill ' || pg_temp.own(1) || ' | ' || pg_temp.own(1), 'its journal carries the number');

-- A number some bill already carries is passed over.
update document_counter set next_no = 1 where doc_type = 'bill:' || (select y from yr);
select test.act_as('manager@example.com');
select test.eq(next_bill_number(), pg_temp.own(3), 'numbers already on a bill are passed over');
create temp table own3 as select record_bill((select id from sup), null, test.today(), 500, 0, null, '6200') as r;
select test.eq(own3.r ->> 'invoice_no', pg_temp.own(3), 'when the bill is saved too') from own3;

-- A cancelled bill keeps its number; it is never given again.
select test.act_as('owner@example.com');
select cancel_bill((select (r ->> 'bill_id')::uuid from own3), 'entered twice');
select test.act_as('manager@example.com');
select test.eq(next_bill_number(), pg_temp.own(4), 'a cancelled bill''s number is not given again');

-- The café's form of number cannot be typed in; a supplier's own number can.
select test.throws(format($$select record_bill((select id from sup), %L, test.today(), 5, 0, null, '6200')$$, pg_temp.own(9)),
  '%given automatically%', 'a number in the café''s own form cannot be typed in');
select test.throws(format($$select record_bill((select id from sup2), %L, test.today(), 5, 0, null, '6200')$$, lower(pg_temp.own(1))),
  '%given automatically%', 'in any case, for any supplier');
create temp table own_sup as select record_bill((select id from sup), 'DAIRY-77', test.today(), 700, 0, null, '6200') as r;
select test.eq(own_sup.r ->> 'invoice_no', 'DAIRY-77', 'a supplier''s own number is kept as typed') from own_sup;
select test.eq(next_bill_number(), pg_temp.own(4), 'and uses none of the café''s numbers');

select test.act_as('owner@example.com');
select test.eq((select string_agg(check_key || '=' || difference, ',' order by check_key) from report_reconciliation(test.today())),
  'grni=0,inventory=0,payables=0,sales=0', 'the books still reconcile');
