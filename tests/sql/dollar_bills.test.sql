-- =============================================================================
-- A supplier bill in dollars and dinars (0103): 100,000 dinars and $50 at
-- 1,300; paid in dinars, part of the dollars in dinars at a rate typed then,
-- what is still owed in dollars valued again at month end, $5 handed over
-- from the till, and the rest in dinars. Each difference from what the
-- dollars were carried at goes to 6950; the payable comes to nothing.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.bill() returns purchase_invoice language sql security definer as $$
  select * from purchase_invoice where invoice_no = 'USD-1'
$$;
create function pg_temp.moved(p_ref uuid, p_code text) returns numeric language sql security definer as $$
  select coalesce(sum(l.debit - l.credit), 0) from journal_line l
    join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
   where e.reference_id = p_ref and g.code = p_code
$$;
create function pg_temp.owed() returns jsonb language sql security definer as $$
  select bill_owed(b) from purchase_invoice b where invoice_no = 'USD-1'
$$;
create function pg_temp.payable() returns numeric language sql security definer as $$
  select coalesce(sum(l.credit - l.debit), 0) from journal_line l
    join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
   where g.code = '2000' and g.business_id = '00000000-0000-0000-0000-0000000000b1'
     and (e.reference_id = (select id from purchase_invoice where invoice_no = 'USD-1')
          or e.reference_id in (select id from supplier_payment
                                 where purchase_invoice_id = (select id from purchase_invoice where invoice_no = 'USD-1'))
          or e.reference_type = 'fx_revaluation')
$$;
create function pg_temp.lines(p int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p))
$$;

-- ------------------------------------------------------------------ the bill
select test.act_as('owner@example.com');
select test.throws($$select record_dollar_bill((select id from supplier where name = 'Kurdistan Coffee Imports'), 'USD-0',
  test.today(), 100000, 50, 12, 0, null, '6200')$$, 'That is 12 dinars a dollar: check the rate',
  'a rate as the database checks it');
select test.throws($$select record_dollar_bill((select id from supplier where name = 'Kurdistan Coffee Imports'), 'USD-0',
  test.today(), 100000, 50, null, 0, null, '6200')$$, 'Type the dollar''s rate, in dinars', 'dollars need their rate');
insert into res select 'B', record_dollar_bill((select id from supplier where name = 'Kurdistan Coffee Imports'), 'USD-1',
  test.today(), 100000, 50, 1300, 30, null, '6200', gen_random_uuid());
select test.eq((pg_temp.bill()).amount_total, 165000::numeric, 'the books in dinars: 100,000 and $50 at 1,300');
select test.eq((pg_temp.bill()).usd_amount || ' at ' || (pg_temp.bill()).usd_rate, '50.00 at 1300.0000',
  'and the dollars kept beside it, with their rate');
select test.eq(pg_temp.owed() ->> 'iqd', '100000.0000', 'owes 100,000 in dinars');
select test.eq(pg_temp.owed() ->> 'usd', '50.00', 'and $50');
select test.eq(pg_temp.payable(), 165000::numeric, 'payable: 165,000');

-- ------------------------------------------------------------------ paid in dinars
select test.throws($$select pay_bill((select id from purchase_invoice where invoice_no = 'USD-1'), 120000, 'bank')$$,
  'That is more than the 100000.0000 owed in dinars on this bill: pay its $50.00 in dollars, or in dinars at a rate',
  'the dinars owed are paid in dinars; the dollars, as dollars');
select pay_bill((select id from purchase_invoice where invoice_no = 'USD-1'), 100000, 'bank');
select test.eq(pg_temp.owed() ->> 'iqd', '0.0000', 'the dinars paid');

-- ------------------------------------------------------------------ $20 in dinars at 1,320
insert into res select 'P1', pay_bill_dollars((select id from purchase_invoice where invoice_no = 'USD-1'), 20, 'IQD', 1320, 'bank', null, gen_random_uuid());
select test.eq((pg_temp.r('P1') ->> 'paid')::numeric, 26400::numeric, '$20 at 1,320 is 26,400 from the bank');
select test.eq((pg_temp.r('P1') ->> 'carried')::numeric, 26000::numeric, 'carried at 26,000 (1,300)');
select test.eq(pg_temp.moved((pg_temp.r('P1') ->> 'payment_id')::uuid, '6950'), 400::numeric,
  'the 400 between them is an exchange difference');
select test.eq(pg_temp.owed() ->> 'usd', '30.00', '$30 still owed');

-- ------------------------------------------------------------------ month end: valued again at 1,350
select test.throws($$select revalue_dollar_bills(1350, 'end')$$, 'Say why, in a few words', 'with why');
insert into res select 'R', revalue_dollar_bills(1350, 'Month end, at the market rate', gen_random_uuid());
select test.eq((pg_temp.r('R') ->> 'difference')::numeric, 1500::numeric, '$30 at 1,350 is 40,500: 1,500 more owed');
select test.eq((pg_temp.bill()).usd_carried_rate, 1350::numeric, 'carried at 1,350 now');
select test.eq(pg_temp.payable(), 40500::numeric, 'the payable is what the $30 is worth now');
select test.eq(revalue_dollar_bills(1350, 'Month end, at the market rate again') ->> 'bills', '0',
  'valued again at the same rate: nothing moves');

-- ------------------------------------------------------------------ $5 handed over from the till
select test.act_as('manager@example.com');
select set_fx_rate('USD', 1310, 'Market this morning');
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines(3), p_expected_net => 7500,
  p_tenders => jsonb_build_array(jsonb_build_object('type', 'cash', 'currency', 'USD', 'usd', 5, 'rate', 1310,
                                                    'amount', 6500),
                                 jsonb_build_object('type', 'cash', 'amount', 1000)));
select test.as_admin();
create temp table held as
select (fx_place_balance('00000000-0000-0000-0000-0000000000b1', 'till',
                         (select id from location where business_id = '00000000-0000-0000-0000-0000000000b1'
                             and kind = 'branch' order by created_at limit 1))).value as value;
grant select on held to public;
select test.act_as('owner@example.com');
select test.throws($$select pay_bill_dollars((select id from purchase_invoice where invoice_no = 'USD-1'), 5, 'USD', null, 'bank')$$, 'Dollars are paid from the till or the safe: from the bank, pay them in dinars at the rate',
  'dollars from the bank are paid in dinars');
select test.throws($$select pay_bill_dollars((select id from purchase_invoice where invoice_no = 'USD-1'), 6, 'USD', null, 'till')$$, 'The till holds only $5 in the books', 'only the dollars the till holds');
insert into res select 'P2', pay_bill_dollars((select id from purchase_invoice where invoice_no = 'USD-1'), 5, 'USD', null, 'till', null, gen_random_uuid());
select test.eq((pg_temp.r('P2') ->> 'paid')::numeric, (select value from held),
  'the $5 leave the till at what they were taken at');
select test.eq((pg_temp.r('P2') ->> 'carried')::numeric, 6750::numeric, 'the debt carried them at 6,750');
select test.eq(pg_temp.moved((pg_temp.r('P2') ->> 'payment_id')::uuid, '6950'), (select value from held) - 6750,
  'the difference, to 6950');
select test.as_admin();
select test.eq((select string_agg(kind || ' ' || usd, ', ') from fx_cash_event
                 where reference_id = (pg_temp.r('P2') ->> 'payment_id')::uuid), 'supplier -5',
  'the till''s dollars are $5 fewer');
select test.act_as('owner@example.com');

-- ------------------------------------------------------------------ the rest, in dinars
select test.throws($$select pay_bill_dollars((select id from purchase_invoice where invoice_no = 'USD-1'), 26, 'IQD', 1350, 'bank')$$, 'That is more than the $25 owed in dollars on this bill', 'no more than is owed');
insert into res select 'P3', pay_bill_dollars((select id from purchase_invoice where invoice_no = 'USD-1'), 25, 'IQD', 1350, 'bank', null, gen_random_uuid());
select test.eq((pg_temp.r('P3') ->> 'difference')::numeric, 0::numeric, 'at the rate it was carried at: no difference');
select test.eq((pg_temp.bill()).is_paid, true, 'the bill is paid');
select test.eq(pg_temp.owed() ->> 'usd', '0.00', 'nothing owed in dollars');
select test.eq(pg_temp.payable(), 0::numeric, 'and nothing on the payable');
select test.eq((dollars_owed() ->> 'usd')::numeric, 0::numeric, 'the café owes no dollars');

-- ------------------------------------------------------------------ a bill keeps its dollars
select test.as_admin();
select test.throws($$update purchase_invoice set amount_total = 1 where invoice_no = 'USD-1'$$,
  '%cannot change%', 'a bill''s total changes only by valuing its dollars again');
select test.throws($$update purchase_invoice set usd_amount = 1 where invoice_no = 'USD-1'$$,
  '%cannot change%', 'nor its dollars');
select test.eq((select count(*)::int from audit_log where action = 'fx.revalue'), 1, 'the revaluation on the audit trail');
