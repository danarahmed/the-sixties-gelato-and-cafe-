-- =============================================================================
-- Wholesale customers on account (0077, round nineteen): a hotel buys
-- espressos at 20% off and pays later. Each invoice is a sale charged to
-- their account (1110), within their limit; their payments pay the oldest
-- invoices first. Espresso: 2,500 take-away, so 2,000 to them. The fixtures
-- opened the drawer.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.espressos(n int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', n))
$$;
create function pg_temp.hotel() returns uuid language sql security definer as $$
  select id from customer where phone = '+9647501112233'
$$;
create function pg_temp.drawer(p text) returns text language sql security definer as $$
  select string_agg(kind || ' ' || trim_scale(amount), ', ' order by created_at)
    from cash_event where reference_id = (select (v ->> 'payment_id')::uuid from res where k = p)
$$;
create temp table b0 as select test.balance('1110') as owed, test.balance('1000') as till,
                               test.balance('1020') as bank, test.balance('4000') as sales;
grant select on b0 to public;

select test.act_as('cashier@example.com');
select save_customer(null, 'Hotel Ankawa', '0750 111 2233');
select test.throws(format('select set_customer_account(%L, true, 50000)', pg_temp.hotel()), null,
  'a cashier does not give credit');

-- ------------------------------------------------------------ put on account
select test.act_as('manager@example.com');
select test.throws(format('select invoice_customer(%L, %L, gen_random_uuid())', pg_temp.hotel(),
  pg_temp.espressos(1)), '%does not buy on account%', 'a customer buys on account once they are put on it');
select test.throws(format('select set_customer_account(%L, true, -1)', pg_temp.hotel()), '%credit limit%',
  'a limit is 0 or more');
select test.throws(format('select set_customer_account(%L, true, 1000, 400)', pg_temp.hotel()), '%Terms%',
  'terms are up to a year');
select test.throws(format('select set_customer_account(%L, true, 1000, 30, 95)', pg_temp.hotel()), '%wholesale%',
  'a wholesale price is at most 90% off');
select set_customer_account(pg_temp.hotel(), true, 50000, 30, 20, '77000000-0000-0000-0000-000000000001');
select test.eq((select on_account::text || ' ' || trim_scale(credit_limit) || ' ' || terms_days || ' '
                       || trim_scale(wholesale_percent) from customer where id = pg_temp.hotel()),
  'true 50000 30 20', 'on account: 50,000 at most, 30 days, 20% off');

-- ------------------------------------------------------------ an invoice
insert into res select 'I1', invoice_customer(pg_temp.hotel(), pg_temp.espressos(10),
  '77000000-0000-0000-0000-0000000000a1', 'Week 1');
select test.eq((pg_temp.r('I1') ->> 'amount')::numeric, 20000::numeric, 'ten espressos at 2,000: 20,000');
select test.eq((pg_temp.r('I1') ->> 'invoice_no')::int, 1, 'invoice number 1');
select test.eq((pg_temp.r('I1') ->> 'due_on')::date, test.today() + 30, 'due in 30 days');
select test.eq(test.balance('1110') - (select owed from b0), 20000::numeric, 'they owe 20,000 in the books');
select test.eq(test.balance('4000') - (select sales from b0), -20000::numeric, 'and it is 20,000 of sales');
select test.eq((select tender_type::text from sales_tender
                 where sales_order_id = (pg_temp.r('I1') ->> 'order_id')::uuid), 'other',
  'paid by their account');
select test.eq((select count(*) from cash_event
                 where reference_id = (pg_temp.r('I1') ->> 'order_id')::uuid), 0::bigint, 'no cash moved');
insert into res select 'I1b', invoice_customer(pg_temp.hotel(), pg_temp.espressos(10),
  '77000000-0000-0000-0000-0000000000a1', 'Week 1');
select test.eq(pg_temp.r('I1b') ->> 'invoice_id', pg_temp.r('I1') ->> 'invoice_id', 'sent again, the same invoice');
select test.eq((select count(*) from customer_invoice), 1::bigint, 'one invoice');

insert into res select 'I2', invoice_customer(pg_temp.hotel(), pg_temp.espressos(5), gen_random_uuid());
select test.eq((customer_account(pg_temp.hotel()) ->> 'balance')::numeric, 30000::numeric, 'they owe 30,000');
select test.throws(format('select invoice_customer(%L, %L, gen_random_uuid())', pg_temp.hotel(),
  pg_temp.espressos(11)), '%may owe at most 50000%', 'over their limit it is refused');
select test.throws($$select record_sale(gen_random_uuid(), 'takeaway', null,
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]',
  p_tenders => jsonb_build_array(jsonb_build_object('type', 'other', 'amount', 2500,
                                                    'on_account', pg_temp.hotel()::text)))$$, null,
  'a sale at the till cannot charge an account');

-- ------------------------------------------------------------ paid, the oldest first
select test.throws(format('select receive_customer_payment(%L, 40000, %L)', pg_temp.hotel(), 'bank'),
  '%a payment is at most that%', 'a payment is no more than they owe');
select test.throws(format('select receive_customer_payment(%L, 1000, %L)', pg_temp.hotel(), 'safe'),
  '%Say where the money went%', 'the money goes to the till, the bank or a way to pay');
insert into res select 'P1', receive_customer_payment(pg_temp.hotel(), 25000, 'bank', 'TRF 991', null,
  '77000000-0000-0000-0000-0000000000b1');
insert into res select 'P1b', receive_customer_payment(pg_temp.hotel(), 25000, 'bank', 'TRF 991', null,
  '77000000-0000-0000-0000-0000000000b1');
select test.eq(pg_temp.r('P1b') ->> 'payment_id', pg_temp.r('P1') ->> 'payment_id', 'sent again, one payment');
select test.eq((pg_temp.r('P1') ->> 'balance')::numeric, 5000::numeric, '5,000 left to pay');
select test.eq(test.balance('1020') - (select bank from b0), 25000::numeric, 'the bank has 25,000');
select test.eq(test.balance('1110') - (select owed from b0), 5000::numeric, 'the books say they owe 5,000');
select test.eq((select string_agg((i ->> 'no') || ':' || (i ->> 'paid') || '/' || (i ->> 'left'), ' '
                                  order by (i ->> 'no')::int)
                  from jsonb_array_elements(customer_account(pg_temp.hotel()) -> 'invoices') i),
  '1:20000/0 2:5000/5000', 'the first invoice paid, 5,000 of the second');
insert into res select 'P2', receive_customer_payment(pg_temp.hotel(), 5000, 'till');
select test.eq(pg_temp.drawer('P2'), 'cash_in 5000', 'cash paid at the till goes into the drawer');
select test.eq((customer_account(pg_temp.hotel()) ->> 'balance')::numeric, 0::numeric, 'they owe nothing');

-- ------------------------------------------------------------ late, and the list of accounts
insert into res select 'I3', invoice_customer(pg_temp.hotel(), pg_temp.espressos(3), gen_random_uuid());
select test.as_admin();
-- Earlier invoices, earlier: the first two 80 days ago, the third 75.
update customer_invoice set issued_on = test.today() - 80, due_on = test.today() - 50
 where id <> (pg_temp.r('I3') ->> 'invoice_id')::uuid;
update customer_invoice set issued_on = test.today() - 75, due_on = test.today() - 45
 where id = (pg_temp.r('I3') ->> 'invoice_id')::uuid;
select test.act_as('owner@example.com');
select test.eq((select (x ->> 'overdue')::numeric || ' ' || (x ->> 'late_60')
                  from jsonb_array_elements(customer_accounts() -> 'customers') x
                 where x ->> 'name' = 'Hotel Ankawa'), '6000 6000', '6,000 overdue, 31–60 days late');
select test.eq((select (i ->> 'days_late')::int
                  from jsonb_array_elements(customer_account(pg_temp.hotel()) -> 'invoices') i
                 where (i ->> 'no')::int = 3), 45, 'the invoice is 45 days late');
select test.eq((customer_accounts() ->> 'books')::numeric - (select owed from b0), 6000::numeric,
  'the owner sees 1110 agree');

-- ------------------------------------------------------------ an invoice's sale voided
select test.act_as('manager@example.com');
select void_sale((pg_temp.r('I3') ->> 'order_id')::uuid, 'Sent back', null);
select test.eq((select status from customer_invoice where id = (pg_temp.r('I3') ->> 'invoice_id')::uuid), 'void',
  'its sale voided, the invoice is void');
select test.eq((customer_account(pg_temp.hotel()) ->> 'balance')::numeric, 0::numeric, 'they owe nothing for it');
select test.eq(test.balance('1110') - (select owed from b0), 0::numeric, 'and the books agree');
select test.ok((select count(*) from audit_log where action like 'customer.%') >= 6,
  'every step is in the audit trail');
