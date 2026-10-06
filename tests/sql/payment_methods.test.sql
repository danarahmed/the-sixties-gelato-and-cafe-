-- =============================================================================
-- Ways to pay (0069, round ten): FIB, FastPay, ZainCash… each with its own
-- account among the cash, 1030 onwards; a sale paid by one of them alone, or
-- as a part of a split, debited to its account; a bill paid so; one taken out
-- of use takes no new sale; a refund given back the way it was paid; money
-- moved out of their accounts to the bank and the safe, with its fee, a charge
-- alone, and cancelled; what each took for the reports and the end of the day;
-- and the statements counting their accounts as cash.
-- Espresso: 2,500 dine-in (20 g of beans at 10); water: 1,000, a bottle bought
-- in at 250, which goes back on the shelf when refunded.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text) returns uuid language sql as $$ select (v ->> 'id')::uuid from res where k = p $$;
create function pg_temp.sale(p text) returns uuid language sql as $$
  select (v ->> 'order_id')::uuid from res where k = p
$$;
create function pg_temp.lines(p jsonb) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('variant_id', case x.key when 'E' then 'd1000000-0000-0000-0000-000000000001'
                                                    else 'd1000000-0000-0000-0000-000000000002' end,
                                      'qty', x.value) order by x.key)
    from jsonb_each(p) x
$$;
-- A payment by one of the ways to pay, as the till sends it.
create function pg_temp.by(p_method text, p_amount int, p_reference text default null) returns jsonb
language sql as $$
  select jsonb_build_object('type', 'other', 'method', pg_temp.id(p_method), 'amount', p_amount)
         || case when p_reference is not null then jsonb_build_object('reference', p_reference) else '{}'::jsonb end
$$;
-- The tests' own view, whoever they act as.
create function pg_temp.paid(p text) returns text language sql security definer as $$
  select string_agg(t.tender_type || coalesce(' ' || m.name, '') || ' ' || trim_scale(t.amount)
                    || coalesce(' (' || t.reference || ')', ''), ' + ' order by t.position)
    from sales_tender t left join payment_method m on m.id = t.payment_method_id
   where t.sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p)
$$;
create function pg_temp.back(p_refund jsonb) returns text language sql as $$
  select string_agg((x ->> 'type') || coalesce(' ' || (x ->> 'method_name'), '') || ' ' || (x ->> 'amount'), ', '
                    order by o)
    from jsonb_array_elements(p_refund -> 'tenders') with ordinality e(x, o)
$$;
create function pg_temp.line(p_sale text, p_variant text) returns uuid language sql security definer as $$
  select sl.id from sales_order_line sl
   where sl.sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p_sale)
     and sl.product_variant_id = p_variant::uuid
$$;
create function pg_temp.items(p_sale text, p jsonb) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('line_id',
           pg_temp.line(p_sale, case x.key when 'E' then 'd1000000-0000-0000-0000-000000000001'
                                           else 'd1000000-0000-0000-0000-000000000002' end), 'qty', x.value))
    from jsonb_each(p) x
$$;
create function pg_temp.orders() returns bigint language sql security definer as $$ select count(*) from sales_order $$;
create function pg_temp.account(p_code text) returns text language sql security definer as $$
  select a.name || ' ' || a.account_type || ' ' || a.normal_balance || case when a.is_system then ' system' else '' end
    from gl_account a where a.business_id = '00000000-0000-0000-0000-0000000000b1' and a.code = p_code
$$;
create function pg_temp.names() returns text language sql as $$
  select string_agg((x ->> 'name') || ' ' || (x ->> 'account') || case when (x ->> 'active')::boolean then '' else ' (out of use)' end,
                    ', ' order by o)
    from jsonb_array_elements(payment_methods()) with ordinality e(x, o)
$$;

-- ------------------------------------------------------------ ways to pay
select test.act_as('owner@example.com');
select test.eq(payment_methods(), '[]'::jsonb, 'a café starts with none: cash and the card machine, as before');
insert into res select 'FIB', save_payment_method(null, 'FIB', p_idempotency_key => '69000000-0000-0000-0000-000000000001');
insert into res select 'FastPay', save_payment_method(null, '  FastPay  ');
select test.eq(pg_temp.names(), 'FIB 1030, FastPay 1031', 'each is given an account of its own, 1030 onwards, in the order added');
select test.eq(pg_temp.account('1030') || ' | ' || pg_temp.account('1031'),
  'FIB asset debit system | FastPay asset debit system', 'an asset account, named after it, that only the café''s own records move');
insert into res select 'FIB again', save_payment_method(null, 'FIB', p_idempotency_key => '69000000-0000-0000-0000-000000000001');
select test.eq((select count(*) from payment_method)::int || ' ' || (pg_temp.r('FIB again') ->> 'id'),
  '2 ' || pg_temp.id('FIB'), 'sent again with its key: added once');
select test.throws($$select save_payment_method(null, 'fib')$$, 'There is already a way to pay called fib',
  'each is named once, whatever the letters'' case');
select test.throws($$select save_payment_method(null, '   ')$$, 'Name the way to pay, in 40 letters at most',
  'a way to pay has a name');
select test.throws($$select save_payment_method(null, repeat('x', 41))$$, 'Name the way to pay, in 40 letters at most',
  'of 40 letters at most');
select test.throws($$select save_payment_method(gen_random_uuid(), 'Nowhere')$$,
  'That way to pay is not one of the café''s', 'only the café''s own is changed');
select test.as_admin();
select test.eq((select count(*) from audit_log where action = 'payment_method.add')::int, 2, 'each added on the audit trail');
select test.act_as('manager@example.com');
select test.throws($$select save_payment_method(null, 'ZainCash')$$, '%permission%',
  'a branch manager does not add one: Settings is the owner''s and the general manager''s');
select test.act_as('cashier@example.com');
select test.throws($$select save_payment_method(null, 'ZainCash')$$, '%permission%', 'nor a cashier');
select test.eq(pg_temp.names(), 'FIB 1030, FastPay 1031', 'but a cashier reads them: the till offers them');
select test.eq((select count(*) from payment_method)::int, 2, 'and may read the list itself');

-- ------------------------------------------------------------ a sale paid by one
insert into res select 'S1', record_sale('69000000-0000-0000-0000-0000000000a1', 'dine_in', null,
  pg_temp.lines('{"E": 1}'), p_expected_net => 2500, p_tenders => jsonb_build_array(pg_temp.by('FIB', 2500, ' TX  77 ')));
select test.eq(pg_temp.paid('S1'), 'other FIB 2500 (TX 77)', 'paid by FIB alone, with the reference the app showed');
select test.eq(test.lines_of(pg_temp.sale('S1')), '1030 Dr 2500 | 1200 Cr 200 | 4000 Cr 2500 | 5000 Dr 200',
  'FIB''s account takes what it paid');
select test.eq((select string_agg((x ->> 'type') || ' ' || (x ->> 'method_name') || ' ' || (x ->> 'reference'), '; ')
                  from jsonb_array_elements(pg_temp.r('S1') -> 'payments') x),
  'other FIB TX 77', 'the sale answers with the way to pay, by name, and the reference');
select test.eq((select count(*) from cash_event where reference_id = pg_temp.sale('S1'))::int, 0,
  'nothing goes in the drawer');

insert into res select 'S2', record_sale('69000000-0000-0000-0000-0000000000a2', 'dine_in', null,
  pg_temp.lines('{"E": 2, "W": 1}'), p_expected_net => 6000,
  p_tenders => jsonb_build_array(jsonb_build_object('type', 'cash', 'amount', 1000, 'received', 1000),
                                 pg_temp.by('FIB', 3000), pg_temp.by('FastPay', 2000)));
select test.eq(pg_temp.paid('S2'), 'cash 1000 + other FIB 3000 + other FastPay 2000',
  'a sale split three ways: cash, FIB and FastPay');
select test.eq(test.lines_of(pg_temp.sale('S2')),
  '1000 Dr 1000 | 1030 Dr 3000 | 1031 Dr 2000 | 1200 Cr 650 | 4000 Cr 6000 | 5000 Dr 650',
  'each way to pay''s account debited with its part, apart from the other''s');

-- ------------------------------------------------------------ refused, nothing recorded
create temp table n_before as select pg_temp.orders() as n;
grant select on n_before to public;
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'other', pg_temp.lines('{"E": 1}'))$$,
  'Choose which way to pay it was', 'the old single tender cannot say which');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => '[{"type": "other", "amount": 2500}]')$$,
  'Choose which way to pay it was', 'a payment by one of them says which');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => '[{"type": "other", "method": "FIB", "amount": 2500}]')$$,
  'Choose which way to pay it was', 'by its id');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(jsonb_build_object('type', 'other', 'method', gen_random_uuid(), 'amount', 2500)))$$,
  'That way to pay is not one of the café''s', 'one of the café''s');
select test.as_admin();
insert into gl_account (business_id, code, name, account_type, normal_balance, is_system)
values ('00000000-0000-0000-0000-0000000000b2', '1030', 'Theirs', 'asset', 'debit', true);
insert into payment_method (id, business_id, name, account_code)
values ('69000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b2', 'Theirs', '1030');
select test.act_as('cashier@example.com');
select test.eq(pg_temp.names(), 'FIB 1030, FastPay 1031', 'another café''s is not offered');
select test.eq((select count(*) from payment_method)::int, 2, 'nor read');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => '[{"type": "other", "method": "69000000-0000-0000-0000-0000000000b2", "amount": 2500}]')$$,
  'That way to pay is not one of the café''s', 'nor taken');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(jsonb_build_object('type', 'cash', 'method', pg_temp.id('FIB'), 'amount', 2500)))$$,
  'The payments cannot be read', 'cash is not one of them');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => '[{"type": "cash", "amount": 2500, "reference": "R-1"}]')$$,
  'The payments cannot be read', 'cash has no reference');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.by('FIB', 2500, repeat('7', 61))))$$,
  'A payment''s reference is at most 60 letters', 'a reference of 60 letters at most');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.by('FIB', 2500) || '{"currency": "USD", "usd": 2, "rate": 1300}'))$$,
  'Dollars are taken in cash only', 'not in dollars');
select test.throws($$select record_sale(gen_random_uuid(), 'talabat', null, pg_temp.lines('{"E": 1}'),
  p_platform_order_no => 'T-9', p_tenders => jsonb_build_array(pg_temp.by('FIB', 3000)))$$,
  'Delivery-platform orders are platform-paid, and only they are', 'a platform''s order is the platform''s');
select test.eq(pg_temp.orders(), (select n from n_before), 'none of them recorded anything');

-- A card payment may carry the machine's reference.
insert into res select 'S5', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"W": 1}'),
  p_tenders => '[{"type": "card", "amount": 1000, "reference": "AUTH 4411"}]');
select test.eq(pg_temp.paid('S5') || ' | ' || test.lines_of(pg_temp.sale('S5')),
  'card 1000 (AUTH 4411) | 1010 Dr 1000 | 1200 Cr 250 | 4000 Cr 1000 | 5000 Dr 250',
  'a card with the slip''s reference, journaled as before');

-- ------------------------------------------------------------ a bill paid by one
insert into res select 'B', open_tab('dine_in', null, 'By FIB', null, pg_temp.lines('{"E": 1, "W": 1}'));
create temp table bill as
  select b.tab_id, b.version, b.total from pos_open_bills() b where b.tab_id = (pg_temp.r('B') ->> 'tab_id')::uuid;
grant select on bill to public;
insert into res select 'S4', settle_tab((select tab_id from bill), (select version from bill), gen_random_uuid(), null,
  3500, null, jsonb_build_array(pg_temp.by('FIB', 3500, 'TX-80')));
select test.eq(pg_temp.paid('S4') || ' | ' || test.lines_of(pg_temp.sale('S4')),
  'other FIB 3500 (TX-80) | 1030 Dr 3500 | 1200 Cr 450 | 4000 Cr 3500 | 5000 Dr 450', 'a bill paid by FIB');

-- ------------------------------------------------------------ taken out of use, renamed
select test.act_as('owner@example.com');
insert into res select 'FastPay off', save_payment_method(pg_temp.id('FastPay'), 'FastPay', false);
select test.eq(pg_temp.names(), 'FIB 1030, FastPay 1031 (out of use)', 'FastPay taken out of use stays on the list');
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.by('FastPay', 2500)))$$,
  'FastPay is no longer taken: choose another way to pay', 'and takes no new sale');
insert into res select 'S2 again', record_sale('69000000-0000-0000-0000-0000000000a2', 'dine_in', null,
  pg_temp.lines('{"E": 2, "W": 1}'), p_expected_net => 6000,
  p_tenders => jsonb_build_array(jsonb_build_object('type', 'cash', 'amount', 1000, 'received', 1000),
                                 pg_temp.by('FIB', 3000), pg_temp.by('FastPay', 2000)));
select test.eq((pg_temp.r('S2 again') ->> 'replayed') || ' ' || (pg_temp.r('S2 again') ->> 'order_id'),
  'true ' || pg_temp.sale('S2'), 'but a sale it took, sent again with its key, is the sale recorded');
select test.act_as('owner@example.com');
insert into res select 'FastPay on', save_payment_method(pg_temp.id('FastPay'), 'FastPay', true);
insert into res select 'ZainCash', save_payment_method(null, 'ZainCash');
select test.eq(pg_temp.names(), 'FIB 1030, FastPay 1031, ZainCash 1032', 'brought back, and a third added');
select test.as_admin();
select test.eq((select string_agg((before_state ->> 'active') || '→' || (after_state ->> 'active'), ', ' order by occurred_at, id)
                  from audit_log where action = 'payment_method.change'),
  'true→false, false→true', 'each change on the audit trail, with what it was');

-- ------------------------------------------------------------ given back the way it was paid
select test.act_as('manager@example.com');
insert into res select 'R1', refund_sale_lines(pg_temp.sale('S2'), pg_temp.items('S2', '{"W": 1}'), 'changed_mind');
select test.eq(pg_temp.back(pg_temp.r('R1')), 'cash 167, other FIB 500, other FastPay 333',
  'a refund goes back in proportion to what is left of each payment, FIB apart from FastPay');
select test.eq(test.lines_of((pg_temp.r('R1') ->> 'refund_id')::uuid),
  '1000 Cr 167 | 1030 Cr 500 | 1031 Cr 333 | 1200 Dr 250 | 4200 Dr 1000 | 5000 Cr 250',
  'each way to pay''s account credited with its part');
select test.as_admin();
select test.eq((select string_agg(rt.tender_type || coalesce(' ' || m.name, '') || ' ' || trim_scale(rt.amount), ', '
                                  order by rt.amount)
                  from sale_refund_tender rt left join payment_method m on m.id = rt.payment_method_id
                 where rt.refund_id = (pg_temp.r('R1') ->> 'refund_id')::uuid),
  'cash 167, other FastPay 333, other FIB 500', 'each part kept with its way to pay');
select test.act_as('manager@example.com');
select test.throws($$select refund_sale_lines(pg_temp.sale('S2'), pg_temp.items('S2', '{"E": 1}'), 'changed_mind',
  p_tenders => jsonb_build_array(pg_temp.by('FastPay', 2500)))$$,
  'Only 1667 of what FastPay took is left to give back', 'never more back to a way to pay than is left of what it took');
select test.throws($$select refund_sale_lines(pg_temp.sale('S2'), pg_temp.items('S2', '{"E": 1}'), 'changed_mind',
  p_tenders => jsonb_build_array(pg_temp.by('ZainCash', 2500)))$$,
  'This sale was not paid that way', 'nor back a way to pay it was not paid by');
select test.throws($$select refund_sale_lines(pg_temp.sale('S2'), pg_temp.items('S2', '{"E": 1}'), 'changed_mind',
  p_tenders => jsonb_build_array(pg_temp.by('FIB', 1000), pg_temp.by('FIB', 1500)))$$,
  'A payment is named twice', 'each way to pay once');
select test.throws($$select refund_sale_lines(pg_temp.sale('S2'), pg_temp.items('S2', '{"E": 1}'), 'changed_mind',
  p_tenders => '[{"type": "other", "amount": 2500}]')$$,
  'The payments to give back cannot be read', 'a part given back to a way to pay says which');
select test.throws($$select refund_sale_lines(pg_temp.sale('S2'), pg_temp.items('S2', '{"E": 1}'), 'changed_mind',
  p_tenders => jsonb_build_array(jsonb_build_object('type', 'card', 'method', pg_temp.id('FIB'), 'amount', 2500)))$$,
  'The payments to give back cannot be read', 'and only such a part does');
insert into res select 'R2', refund_sale_lines(pg_temp.sale('S2'), pg_temp.items('S2', '{"E": 1}'), 'changed_mind',
  p_tenders => jsonb_build_array(pg_temp.by('FIB', 2500)));
select test.eq(pg_temp.back(pg_temp.r('R2')), 'other FIB 2500', 'or as the refunder chose');
select test.eq(split_part(test.lines_of((pg_temp.r('R2') ->> 'refund_id')::uuid), ' | ', 1), '1030 Cr 2500',
  'from FIB''s account');
select test.throws($$select refund_sale_lines(pg_temp.sale('S2'), pg_temp.items('S2', '{"E": 1}'), 'changed_mind',
  p_tenders => jsonb_build_array(pg_temp.by('FIB', 2500)))$$,
  'Only 0 of what FIB took is left to give back', 'what FIB took is given back once');
insert into res select 'R3', refund_sale(pg_temp.sale('S2'), 'The rest', 'changed_mind');
select test.eq(pg_temp.back(pg_temp.r('R3')), 'cash 833, other FastPay 1667',
  'the rest goes back the ways something is left of');
select test.as_admin();
select test.eq((select string_agg(x.k || ' ' || trim_scale(x.s), ', ' order by x.k collate "C")
                  from (select rt.tender_type || coalesce(' ' || m.name, '') as k, sum(rt.amount) as s
                          from sale_refund r join sale_refund_tender rt on rt.refund_id = r.id
                          left join payment_method m on m.id = rt.payment_method_id
                         where r.sales_order_id = pg_temp.sale('S2') group by 1) x),
  'cash 1000, other FIB 3000, other FastPay 2000', 'refunded in full: each payment given back exactly');

-- ------------------------------------------------------------ the end of the day
select test.act_as('manager@example.com');
select test.eq((select string_agg((x ->> 'name') || ' ' || (x ->> 'amount') || ' in ' || (x ->> 'payments'), ', ' order by o)
                  from jsonb_array_elements(drawer_methods()) with ordinality e(x, o)),
  'FIB 9000 in 3, FastPay 2000 in 1', 'what each way to pay took since the drawer was counted, to check against its app');
select test.act_as('owner@example.com');
select test.eq((select (d ->> 'cash_sales') || ' | card ' || (d ->> 'card') from drawer_status() d),
  '1000 | card 1000', 'the drawer''s cash and the card''s takings are as they were');
select test.act_as('cashier@example.com');
select test.throws($$select drawer_methods()$$, '%permission%', 'a cashier does not read them');

-- ------------------------------------------------------------ money moved
select test.act_as('owner@example.com');
select test.eq(test.balance('1030') || ' ' || test.balance('1031') || ' ' || test.balance('1032'), '6000 0 0',
  'FIB holds what it took less what it gave back; FastPay gave it all back');
insert into res select 'M1', move_money('1030', '1020', 2000, 50, null, 'TR-9', 'Weekly',
  p_idempotency_key => '69000000-0000-0000-0000-0000000000c1');
select test.eq(test.lines_of((pg_temp.r('M1') ->> 'move_id')::uuid), '1020 Dr 2000 | 1030 Cr 2050 | 6500 Dr 50',
  'FIB to the bank: what arrived, and what FIB kept as its fee');
insert into res select 'M1 again', move_money('1030', '1020', 2000, 50, null, 'TR-9', 'Weekly',
  p_idempotency_key => '69000000-0000-0000-0000-0000000000c1');
select test.eq(pg_temp.r('M1 again') ->> 'move_id', pg_temp.r('M1') ->> 'move_id', 'sent again with its key: moved once');
select test.throws($$select move_money('1030', '1020', 3000, 0, p_idempotency_key => '69000000-0000-0000-0000-0000000000c1')$$,
  '%does not match what was first sent%', 'the same key for another move is refused');
insert into res select 'M2', move_money('1030', null, 0, 100, p_note => 'Monthly charge');
select test.eq(test.lines_of((pg_temp.r('M2') ->> 'move_id')::uuid), '1030 Cr 100 | 6500 Dr 100', 'a charge alone');
insert into res select 'M3', move_money('1030', '1005', 1000, 0);
select test.eq(test.lines_of((pg_temp.r('M3') ->> 'move_id')::uuid), '1005 Dr 1000 | 1030 Cr 1000',
  'taken out as cash, into the safe');
insert into res select 'M4', move_money('1020', '1032', 500, 0);
select test.eq(test.lines_of((pg_temp.r('M4') ->> 'move_id')::uuid), '1020 Cr 500 | 1032 Dr 500',
  'and from the bank into ZainCash');
select test.throws($$select move_money('1030', '1020', 5000, 0)$$, 'FIB holds 2850: no more can be moved out of it',
  'a way to pay gives no more than it holds');
select test.throws($$select move_money('1031', null, 0, 250)$$, 'FastPay holds 0: no more can be moved out of it',
  'nor a charge it does not hold');
select test.throws($$select move_money('1005', '1031', 5000, 0)$$, 'The safe holds 1000: no more can be moved out of it',
  'nor the safe');
select test.throws($$select move_money('1000', '1020', 100, 0)$$, 'Choose where the money is moved from',
  'the till''s cash is counted and moved as cash, not here');
select test.throws($$select move_money('1030', '1030', 100, 0)$$,
  'Choose where the money goes: the bank, the safe or another way to pay', 'money goes somewhere else');
select test.throws($$select move_money('1020', '1005', 100, 0)$$,
  'Money is moved out of a way to pay''s account, or into one', 'the bank and the safe move cash as before');
select test.throws($$select move_money('1030', '1020', 0, 10)$$, 'Enter how much arrived', 'something arrives');
select test.throws($$select move_money('1030', null, 100, 10)$$,
  'A charge alone is what the bank or the app took: enter it as the fee', 'a charge alone is a fee');
select test.throws($$select move_money('1030', '1020', 100, -1)$$, 'Enter amounts of 0 or more', 'no amount below nothing');
select test.throws($$select move_money('1030', '1020', 100, 0, test.today() + 1)$$, 'Money is moved on a day up to today',
  'nor a day to come');
select test.act_as('manager@example.com');
select test.throws($$select move_money('1030', '1020', 100, 0)$$, '%permission%', 'a branch manager does not move money');
select test.act_as('cashier@example.com');
select test.throws($$select money_accounts()$$, '%permission%', 'a cashier does not read what the accounts hold');

select test.act_as('owner@example.com');
select test.eq((select string_agg((x ->> 'name') || ' ' || (x ->> 'balance'), ', ' order by o)
                  from jsonb_array_elements(money_accounts() -> 'methods') with ordinality e(x, o))
               || ' | bank ' || (money_accounts() ->> 'bank') || ' | safe ' || (money_accounts() ->> 'safe'),
  'FIB 2850, FastPay 0, ZainCash 500 | bank 1500 | safe 1000', 'what each account holds');
select test.eq((select string_agg(coalesce(x ->> 'to', 'charge') || ' ' || (x ->> 'amount') || '+' || (x ->> 'fee'), ', '
                                  order by o)
                  from jsonb_array_elements(money_accounts() -> 'moves') with ordinality e(x, o)),
  '1032 500+0, 1005 1000+0, charge 0+100, 1020 2000+50', 'and the moves, most recent first');
select test.as_admin();
select test.eq((select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
                  from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today()) where difference <> 0),
  null, 'the books tie: the safe counts what was moved into it');

-- ------------------------------------------------------------ a move cancelled
select test.act_as('owner@example.com');
select test.throws($$select cancel_money_move((pg_temp.r('M3') ->> 'move_id')::uuid, 'no')$$, 'Say why it is cancelled',
  'a move is cancelled with why');
insert into res select 'C3', cancel_money_move((pg_temp.r('M3') ->> 'move_id')::uuid, 'Never left FIB',
  p_idempotency_key => '69000000-0000-0000-0000-0000000000c3');
select test.eq(test.balance('1030') || ' ' || test.balance('1005'), '3850 0', 'its journal reversed: FIB has it back, the safe not');
select test.throws($$select cancel_money_move((pg_temp.r('M3') ->> 'move_id')::uuid, 'Never left FIB')$$,
  'That move of money is not in force', 'a move is cancelled once');
select test.as_admin();
insert into res select 'M1 journal', jsonb_build_object('id', journal_entry_id) from money_move
 where id = (pg_temp.r('M1') ->> 'move_id')::uuid;
select test.act_as('owner@example.com');
select test.throws($$select reverse_journal(pg_temp.id('M1 journal'), 'By hand')$$,
  '%a move of money (cancel it on Sales)%', 'a move''s journal is not reversed by hand');
select test.as_admin();
select test.eq((select string_agg(action, ', ' order by occurred_at, id) from audit_log where action like 'money.%'),
  'money.move, money.move, money.move, money.move, money.move_cancel', 'each move, and the cancel, on the audit trail');
select test.eq((select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
                  from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today()) where difference <> 0),
  null, 'the books still tie');

-- ------------------------------------------------------------ the reports
insert into res select 'place', jsonb_build_object('id', default_location('00000000-0000-0000-0000-0000000000b1'));
select test.act_as('owner@example.com');
select test.eq((select string_agg((x ->> 'name') || ': ' || (x ->> 'sales') || ' sales, ' || (x ->> 'taken') || ' taken, '
                                  || (x ->> 'refunded') || ' back, net ' || (x ->> 'net') || ', moved '
                                  || (x ->> 'moved_out') || ', fees ' || (x ->> 'fees') || ', holds ' || (x ->> 'balance'),
                                  ' | ' order by o)
                  from jsonb_array_elements(report_payment_methods(test.today(), test.today())) with ordinality e(x, o)),
  'FIB: 3 sales, 9000 taken, 3000 back, net 6000, moved 2000, fees 150, holds 3850 | '
  'FastPay: 1 sales, 2000 taken, 2000 back, net 0, moved 0, fees 0, holds 0 | '
  'ZainCash: 0 sales, 0 taken, 0 back, net 0, moved 0, fees 0, holds 500',
  'each way to pay: its sales, what it took and gave back, the money moved out of it, its fees, and what it holds');
select test.eq((select x ->> 'fees' from jsonb_array_elements(report_payment_methods(test.today(), test.today(),
                                                               pg_temp.id('place'))) x
                 where x ->> 'name' = 'FIB'),
  null, 'at one place: its takings, not the café''s accounts');
select test.eq((select p.method || ' ' || p.sales || ' ' || trim_scale(p.taken) || ' ' || p.split_sales || ' '
                       || trim_scale(p.refunded) || ' ' || trim_scale(p.net)
                  from report_payments(test.today(), test.today()) p where p.method = 'other'),
  'other 3 11000 1 5000 6000', 'the takings by how they were paid show them together');
select test.act_as('cashier@example.com');
select test.throws($$select report_payment_methods(test.today(), test.today())$$, '%permission%',
  'a cashier does not read the takings');

-- ------------------------------------------------------------ the statements
select test.act_as('owner@example.com');
select test.eq((select string_agg((x ->> 'code') || ' ' || (x ->> 'group'), ', ' order by x ->> 'code')
                  from jsonb_array_elements(report_balance_sheet(test.today()) -> 'lines') x
                 where x ->> 'code' ~ '^10[3-8][0-9]$'),
  '1030 cash, 1032 cash', 'the balance sheet counts the ways to pay''s accounts as cash');
select test.eq((report_balance_sheet(test.today()) ->> 'cash')::numeric,
  test.balance('1000') + test.balance('1001') + test.balance('1005') + test.balance('1006') + test.balance('1020')
  + test.balance('1030') + test.balance('1031') + test.balance('1032'), 'all of it in the cash');
select test.eq((report_balance_sheet(test.today()) ->> 'difference')::numeric, 0::numeric, 'and it balances');
select test.eq((report_cash_flow(test.today(), test.today()) ->> 'closing')::numeric,
  (report_balance_sheet(test.today()) ->> 'cash')::numeric, 'the cash-flow statement ends with the same cash');
select test.eq((report_cash_flow(test.today(), test.today()) ->> 'difference')::numeric, 0::numeric,
  'every move of the cash accounts explained');
select test.eq((select string_agg((a ->> 'code') || ' ' || (a ->> 'amount'), ', ')
                  from jsonb_array_elements(report_cash_flow(test.today(), test.today()) -> 'lines') x,
                       jsonb_array_elements(x -> 'accounts') a
                 where a ->> 'code' = '6500'),
  '6500 -150', 'the fees are money out; money moved between the cash accounts is no flow');
