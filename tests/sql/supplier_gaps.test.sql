-- =============================================================================
-- The supplier's smaller gaps (0115). Kurdistan Coffee Imports' bill for
-- repairs, dated by them ten days ago; their credit note of five days ago
-- (none earlier than its bill, none after today); a credit of 20,000 not set
-- against anything, 15,000 of it paid back into the safe, the rest still
-- theirs to use; a bill dated before the delivery it is for, booked on the
-- delivery's day with their date kept. The books tie throughout.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.kci() returns uuid language sql security definer as $$
  select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' and name = 'Kurdistan Coffee Imports' $$;
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
$$;
create function pg_temp.bal(p text) returns numeric language sql security definer as $$ select test.balance(p) $$;
grant execute on function pg_temp.r(text), pg_temp.kci(), pg_temp.checks(), pg_temp.bal(text) to public;
create temp table before as select pg_temp.checks() as checks;
grant select on before to public;

-- ------------------------------------------------------------------ a bill as they dated it
select test.act_as('owner@example.com');
select test.throws(format('select record_bill(%L, %L, %L, 1000, 0, null, %L)', pg_temp.kci(), 'R-0', test.today() + 1,
                          '6900'),
  'A bill is dated today or earlier', 'not after today');
insert into res select 'bill', record_bill(pg_temp.kci(), 'R-1', test.today() - 10, 50000, 30, null, '6900');
select test.as_admin();
select test.eq((select invoice_date from purchase_invoice where invoice_no = 'R-1'), test.today() - 10, 'dated as they dated it');

-- ------------------------------------------------------------------ credits, back-dated
select test.act_as('owner@example.com');
select test.throws(format('select record_supplier_credit(%L, %L, 5000, %L, %L, p_bill => %L, p_date => %L)',
                          pg_temp.kci(), 'other', 'CN-0', 'A broken part', pg_temp.r('bill') ->> 'bill_id',
                          test.today() - 12),
  'Date the credit on or after its bill''s day%', 'not before its bill');
select test.throws(format('select record_supplier_credit(%L, %L, 5000, %L, %L, p_account_code => %L, p_date => %L)',
                          pg_temp.kci(), 'other', 'CN-0', 'A broken part', '6900', test.today() + 1),
  'A credit note is dated today or earlier', 'nor after today');
insert into res select 'c1', record_supplier_credit(pg_temp.kci(), 'other', 5000, 'CN-1', 'A broken part',
                                                    p_bill => (pg_temp.r('bill') ->> 'bill_id')::uuid,
                                                    p_date => test.today() - 5);
select test.as_admin();
select test.eq((select credit_date from supplier_credit where supplier_ref = 'CN-1'), test.today() - 5,
  'the credit dated as they dated it');
select test.eq((select business_local_date('00000000-0000-0000-0000-0000000000b1', e.occurred_at)
                  from supplier_credit c join journal_entry e on e.id = c.journal_entry_id where c.supplier_ref = 'CN-1'),
  test.today() - 5, 'and its books on that day');

-- ------------------------------------------------------------------ a refund
select test.act_as('owner@example.com');
insert into res select 'c2', record_supplier_credit(pg_temp.kci(), 'other', 20000, 'CN-2', 'Overcharged last month',
                                                    p_account_code => '6900');
create temp table safe0 as select pg_temp.bal('1005') as v;
grant select on safe0 to public;
insert into res select 'f1', record_supplier_refund((pg_temp.r('c2') ->> 'credit_id')::uuid, 15000, 'safe', 'Cash, Hama');
select test.eq((pg_temp.r('f1') ->> 'left')::int, 5000, '15,000 paid back: 5,000 of the credit left');
select test.throws(format('select record_supplier_refund(%L, 6000, %L)', pg_temp.r('c2') ->> 'credit_id', 'safe'),
  'Credit % has 5000 left: a refund is at most that', 'no more than is left');
select test.throws(format('select record_supplier_refund(%L, 1000, %L)', pg_temp.r('c2') ->> 'credit_id', 'owner'),
  'Say where the money went: the till, the safe or the bank', 'into the till, the safe or the bank');
select test.eq(pg_temp.bal('1005') - (select v from safe0), 15000::numeric, 'into the safe');
select test.eq((supplier_statement(pg_temp.kci(), test.today() - 30, test.today()) ->> 'refunded')::int, 15000,
  'the statement shows it');
select test.eq((select (x ->> 'left')::int from jsonb_array_elements(
                  supplier_statement(pg_temp.kci(), test.today() - 30, test.today()) -> 'open_credits') x
                 where x ->> 'supplier_ref' = 'CN-2'), 5000, 'and what is left of the credit');

-- ------------------------------------------------------------------ a bill before its delivery
select test.act_as('manager@example.com');
insert into res select 'gr', receive_goods(pg_temp.kci(),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":100,"unit_code":"each","unit_price":50}]');
select test.act_as('owner@example.com');
insert into res select 'b2', record_bill(pg_temp.kci(), 'INV-9', test.today() - 3, 5000, 30,
                                         (select id from goods_receipt order by received_at desc limit 1), null);
select test.as_admin();
select test.eq((select supplier_date || ' ' || invoice_date || ' ' || due_date from purchase_invoice where invoice_no = 'INV-9'),
  (test.today() - 3) || ' ' || test.today() || ' ' || (test.today() + 27),
  'their date kept, booked on the delivery''s day, due thirty days from their date');

select test.eq(pg_temp.checks(), (select checks from before), 'the books tie');
