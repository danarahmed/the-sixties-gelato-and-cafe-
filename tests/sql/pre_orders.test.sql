-- =============================================================================
-- Pre-orders with deposits (0076, round eighteen): a cake ordered for Friday,
-- part paid now. The deposit is the customer's money held (2300) until the
-- order is collected, when it pays its part of the sale; given back, or kept
-- (4390), when it is cancelled. Espresso: 2,500 takeaway. The fixtures opened
-- the drawer.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text) returns uuid language sql as $$
  select (v ->> 'pre_order_id')::uuid from res where k = p
$$;
create function pg_temp.status(p text) returns text language sql security definer as $$
  select status from pre_order where id = (select (v ->> 'pre_order_id')::uuid from res where k = p)
$$;
create function pg_temp.drawer(p text) returns text language sql security definer as $$
  select string_agg(kind || ' ' || trim_scale(amount), ', ' order by created_at, kind)
    from cash_event where reference_id = (select (v ->> 'pre_order_id')::uuid from res where k = p)
$$;
create function pg_temp.tenders(p_order uuid) returns text language sql security definer as $$
  select string_agg(t.tender_type || ' ' || trim_scale(t.amount) || case when t.pre_order_id is not null then ' (deposit)'
                                                                  else '' end, ', ' order by t.amount)
    from sales_tender t where t.sales_order_id = p_order
$$;
create function pg_temp.n(p text) returns bigint language plpgsql security definer as $$
declare v bigint; begin execute p into v; return v; end $$;
create temp table friday as select now() + interval '3 days' as at;
grant select on friday to public;
create temp table b0 as select test.balance('2300') as held, test.balance('1000') as cash,
                               test.balance('4390') as kept, test.balance('1010') as card;
grant select on b0 to public;

-- ------------------------------------------------------------ taken, with a cash deposit
select test.act_as('cashier@example.com');
select test.ok(exists (select 1 from gl_account where code = '2300' and name = 'Customer deposits'),
  'the chart has Customer deposits (a liability) …');
select test.ok(exists (select 1 from gl_account where code = '4390' and account_type = 'revenue'),
  '… and Deposits kept (income)');
insert into res select 'A', take_pre_order('  Shilan  ', (select at from friday),
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 4, "note": "Happy birthday"}]',
  '0750 000 0000', 'Chocolate', 'takeaway', '{"type": "cash", "amount": 4000}', null,
  '76000000-0000-0000-0000-00000000000a');
select test.eq((pg_temp.r('A') ->> 'total') || ' ' || (pg_temp.r('A') ->> 'deposit'), '10000 4000',
  'a pre-order: four at today''s 2,500, a deposit of 4,000');
select test.eq(pg_temp.status('A'), 'open', 'it is open until it is collected');
select test.eq(test.balance('2300') - (select held from b0), -4000::numeric, 'its deposit is held, a liability');
select test.eq(test.balance('1000') - (select cash from b0), 4000::numeric, 'the cash is in the till''s account');
select test.eq(pg_temp.drawer('A'), 'cash_in 4000', 'and in the drawer');
insert into res select 'A2', take_pre_order('  Shilan  ', (select at from friday),
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 4, "note": "Happy birthday"}]',
  '0750 000 0000', 'Chocolate', 'takeaway', '{"type": "cash", "amount": 4000}', null,
  '76000000-0000-0000-0000-00000000000a');
select test.eq(pg_temp.r('A2') ->> 'pre_order_id', pg_temp.r('A') ->> 'pre_order_id',
  'sent again with its key, the same pre-order');
select test.eq(pg_temp.n('select count(*) from pre_order'), 1::bigint, 'only one is taken');
select test.eq(test.balance('2300') - (select held from b0), -4000::numeric, 'and one deposit');

select test.eq((select o ->> 'customer' from jsonb_array_elements(pre_orders() -> 'orders') o),
  'Shilan', 'the till''s list shows it, the name trimmed');
select test.eq((select (o -> 'lines' -> 0 ->> 'note') from jsonb_array_elements(pre_orders() -> 'orders') o),
  'Happy birthday', 'with what to write on it');
select test.eq((pre_orders() ->> 'held')::numeric, 4000::numeric, 'the deposits held are 4,000');
select test.eq(pre_orders() -> 'books', 'null'::jsonb, 'a cashier does not see the books');
select test.act_as('owner@example.com');
select test.eq((pre_orders() ->> 'books')::numeric, 4000::numeric, 'the owner sees 2300 agree');

-- ------------------------------------------------------------ refused
select test.act_as('cashier@example.com');
select test.throws($$select take_pre_order(' ', now() + interval '1 day',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]')$$, '%Say who the order is for%',
  'a pre-order names who it is for');
select test.throws($$select take_pre_order('Ali', now() - interval '1 day',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]')$$, '%is collected later than now%',
  'it is collected later, not yesterday');
select test.throws($$select take_pre_order('Ali', now() + interval '1 day', '[]')$$, '%The cart is empty%',
  'it has something on it');
select test.throws($$select take_pre_order('Ali', now() + interval '1 day',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]', p_channel => 'talabat')$$,
  '%collected at the café%', 'it is not a delivery platform''s order');
select test.throws($$select take_pre_order('Ali', now() + interval '1 day',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]',
  p_deposit => '{"type": "cash", "amount": 3000}')$$, '%at most the order''s total%',
  'a deposit is no more than the total');
select test.throws($$select take_pre_order('Ali', now() + interval '1 day',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000002", "qty": 1}]')$$, '%No takeaway price%',
  'it is priced on its channel');

-- ------------------------------------------------------------ collected: the deposit pays its part
insert into res select 'S', collect_pre_order(pg_temp.id('A'), '76000000-0000-0000-0000-0000000000a1',
  '[{"type": "card", "amount": 6000}]', 10000);
select test.eq(pg_temp.status('A'), 'collected', 'collected, it is a sale');
select test.eq((pg_temp.r('S') ->> 'net')::numeric, 10000::numeric, 'the sale is the whole 10,000');
select test.eq(pg_temp.tenders((pg_temp.r('S') ->> 'order_id')::uuid), 'other 4000 (deposit), card 6000',
  'paid 6,000 by card now, and 4,000 by its deposit');
select test.eq(test.balance('2300') - (select held from b0), 0::numeric, 'the deposit is no longer held');
select test.eq(test.balance('1010') - (select card from b0), 6000::numeric, 'the card brought 6,000');
select test.eq(test.balance('1000') - (select cash from b0), 4000::numeric, 'and the cash is counted once');
select test.eq(pg_temp.n(format('select count(*) from cash_event where reference_id = %L',
  pg_temp.r('S') ->> 'order_id')), 0::bigint, 'the drawer takes nothing more at collection');
insert into res select 'S2', collect_pre_order(pg_temp.id('A'), '76000000-0000-0000-0000-0000000000a1',
  '[{"type": "card", "amount": 6000}]', 10000);
select test.eq(pg_temp.r('S2') ->> 'order_id', pg_temp.r('S') ->> 'order_id', 'sent again, the same sale');
select test.throws(format('select collect_pre_order(%L, gen_random_uuid(), %L)', pg_temp.id('A'),
  '[{"type": "card", "amount": 6000}]'), '%collected already%', 'it is collected once');
select test.throws($$select record_sale(gen_random_uuid(), 'takeaway', null,
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]',
  p_tenders => '[{"type": "other", "amount": 2500}]')$$, null,
  'a deposit pays only its own pre-order''s sale');

-- ------------------------------------------------------------ its sale voided: open again, deposit held
select test.act_as('manager@example.com');
select test.throws(format('select refund_sale_lines(%L, %L)', (pg_temp.r('S') ->> 'order_id')::uuid,
  jsonb_build_array(jsonb_build_object('line_id', (select id from sales_order_line
                                                   where sales_order_id = (pg_temp.r('S') ->> 'order_id')::uuid),
                                       'qty', 1))), '%cannot be refunded here%',
  'a collected pre-order is put right by voiding its sale, not by a refund');
select void_sale((pg_temp.r('S') ->> 'order_id')::uuid, 'Wrong cake', null);
select test.eq(pg_temp.status('A'), 'open', 'its sale voided, the pre-order is open again');
select test.eq(test.balance('2300') - (select held from b0), -4000::numeric, 'and its deposit held again');

-- ------------------------------------------------------------ cancelled: given back in cash
select test.throws(format('select cancel_pre_order(%L, %L)', pg_temp.id('A'), ' '), '%Say why%',
  'a cancellation says why');
insert into res select 'C', cancel_pre_order(pg_temp.id('A'), 'Customer changed plans', false,
  '76000000-0000-0000-0000-0000000000c1');
select test.eq(pg_temp.status('A'), 'cancelled', 'cancelled');
select test.eq(test.balance('2300') - (select held from b0), 0::numeric, 'nothing is held');
select test.eq(test.balance('1000') - (select cash from b0), 0::numeric, 'the 4,000 went back from the till');
select test.eq(pg_temp.drawer('A'), 'cash_in 4000, cash_out -4000', 'out of the drawer');
select test.throws(format('select cancel_pre_order(%L, %L)', pg_temp.id('A'), 'again'), '%was cancelled%',
  'it is cancelled once');
select test.throws(format('select collect_pre_order(%L, gen_random_uuid())', pg_temp.id('A')), '%was cancelled%',
  'a cancelled one is not collected');

-- ------------------------------------------------------------ cancelled, the deposit kept
select test.act_as('cashier@example.com');
insert into res select 'K', take_pre_order('Rawa', (select at from friday),
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2}]', p_deposit => '{"type": "card", "amount": 2500}');
select test.act_as('cashier@example.com');
select test.throws(format('select cancel_pre_order(%L, %L, true)', pg_temp.id('K'), 'No-show'), null,
  'a cashier does not cancel one');
select test.act_as('manager@example.com');
select cancel_pre_order(pg_temp.id('K'), 'No-show', true);
select test.eq(test.balance('4390') - (select kept from b0), -2500::numeric, 'a deposit kept is income');
select test.eq(test.balance('1010') - (select card from b0), 2500::numeric, 'and stays with the card takings (the voided sale''s 6,000 reversed)');

-- ------------------------------------------------------------ all paid ahead; none
select test.act_as('cashier@example.com');
insert into res select 'P', take_pre_order('Dana', (select at from friday),
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]', p_deposit => '{"type": "card", "amount": 2500}');
insert into res select 'PS', collect_pre_order(pg_temp.id('P'), gen_random_uuid(), null, 2500);
select test.eq(pg_temp.tenders((pg_temp.r('PS') ->> 'order_id')::uuid), 'other 2500 (deposit)',
  'paid in full ahead, nothing to pay at collection');
insert into res select 'N', take_pre_order('Hemin', (select at from friday),
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]');
select test.throws(format('select collect_pre_order(%L, gen_random_uuid())', pg_temp.id('N')),
  '%Choose how it was paid%', 'with no deposit, it is paid at collection');
insert into res select 'NS', collect_pre_order(pg_temp.id('N'), gen_random_uuid(),
  '[{"type": "cash", "amount": 2500, "received": 5000}]', 2500);
select test.eq(pg_temp.status('N'), 'collected', 'and collected');
select test.eq((select count(*) from jsonb_array_elements(pre_orders() -> 'orders')), 0::bigint,
  'none is open any more');
select test.eq((select count(*) from jsonb_array_elements(pre_orders(null, test.today()) -> 'orders')), 4::bigint,
  'today''s, collected and cancelled, on asking');

-- ------------------------------------------------------------ the books agree
select test.as_admin();
select test.eq((select count(*) from pre_order where status = 'open'), 0::bigint, 'none open');
select test.eq(test.balance('2300') - (select held from b0), 0::numeric, 'and 2300 holds nothing for them');
select test.ok((select count(*) from audit_log where action like 'pre_order.%') >= 6,
  'every step is in the audit trail');
