-- =============================================================================
-- Split payments (0042, release Q): a sale paid part in cash and part by card,
-- or by two cards; cash with the change it was given; each payment debited to
-- its own account and each cash payment its own drawer event; a bill paid two
-- ways; voids and refunds per payment; the day's and the drawer's figures, and
-- the takings by how they were paid. The fixtures opened the drawer with
-- nothing in it. Espresso: 2,500 dine-in, 3,000 on Talabat (20 g of beans at
-- 10, and a cup at 50 on Talabat); water: 1,000, a bottle bought in at 250.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.sale(p text) returns uuid language sql as $$
  select (v ->> 'order_id')::uuid from res where k = p
$$;
-- {"E": 2, "W": 1}: the till's lines for two espressos and a water.
create function pg_temp.lines(p jsonb) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('variant_id', case x.key when 'E' then 'd1000000-0000-0000-0000-000000000001'
                                                    else 'd1000000-0000-0000-0000-000000000002' end,
                                      'qty', x.value) order by x.key)
    from jsonb_each(p) x
$$;
-- The tests' own view, whoever they act as: a sale's payments, the drawer's
-- events for something, a refund's payments, a sale's line.
create function pg_temp.paid(p text) returns text language sql security definer as $$
  select string_agg(tender_type || ' ' || trim_scale(amount)
                    || coalesce(' of ' || trim_scale(received) || ', change ' || trim_scale(change_given), ''),
                    ' + ' order by position)
    from sales_tender where sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p)
$$;
create function pg_temp.drawer(p_ref uuid) returns text language sql security definer as $$
  select string_agg(kind || ' ' || trim_scale(amount), ', ' order by created_at, kind)
    from cash_event where reference_id = p_ref
$$;
create function pg_temp.back(p_refund jsonb) returns text language sql as $$
  select string_agg((x ->> 'type') || ' ' || (x ->> 'amount'), ', ' order by o)
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
create function pg_temp.orders() returns bigint language sql security definer as $$
  select count(*) from sales_order
$$;

-- ------------------------------------------------------------ cash and card
select test.act_as('cashier@example.com');
insert into res select 'A', record_sale('52000000-0000-0000-0000-00000000000a', 'dine_in', null,
  pg_temp.lines('{"E": 2, "W": 1}'), p_expected_net => 6000,
  p_tenders => '[{"type": "cash", "amount": 2000, "received": 5000}, {"type": "card", "amount": 4000}]');
select test.eq((pg_temp.r('A') ->> 'net') || ' | ' ||
               (select string_agg((x ->> 'type') || ' ' || (x ->> 'amount') || ', change ' || coalesce(x ->> 'change', '-'),
                                  '; ' order by o)
                  from jsonb_array_elements(pg_temp.r('A') -> 'payments') with ordinality e(x, o)),
  '6000 | cash 2000, change 3000; card 4000, change -', 'a sale paid two ways answers with each payment and the change');
select test.eq(pg_temp.paid('A'), 'cash 2000 of 5000, change 3000 + card 4000',
  'each payment kept in its order: its part of the sale, and the cash handed over');
select test.eq(test.lines_of(pg_temp.sale('A')),
  '1000 Dr 2000 | 1010 Dr 4000 | 1200 Cr 650 | 4000 Cr 6000 | 5000 Dr 650',
  'each payment''s account debited with what it paid: cash less its change, and the card');
select test.eq(pg_temp.drawer(pg_temp.sale('A')), 'sale 2000', 'the drawer takes the cash part, not what was handed over');

-- ------------------------------------------------------------ refused, nothing recorded
create temp table n_before as select pg_temp.orders() as n;
grant select on n_before to public;
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "cash", "amount": 1000}, {"type": "card", "amount": 4000}]')$$,
  'The payments come to 5000, not the 6000 to pay', 'payments short of the total are refused');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "card", "amount": 7000}]')$$,
  'The payments come to 7000, not the 6000 to pay', 'a card for more than the total is refused');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "cash", "amount": 2000, "received": 1500}, {"type": "card", "amount": 4000}]')$$,
  'The cash handed over (1500) is less than the 2000 it pays', 'cash handed over short of its part is refused');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "card", "amount": 6000, "received": 6000}]')$$,
  'The payments cannot be read', 'only cash is handed over');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "cash", "amount": 0}, {"type": "card", "amount": 6000}]')$$,
  'Each payment needs an amount more than 0', 'a payment of nothing in a split is refused');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "cash", "amount": -1000}, {"type": "card", "amount": 7000}]')$$,
  'Each payment needs an amount more than 0', 'and a payment below nothing');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "cash", "amount": 2000.5}, {"type": "card", "amount": 3999.5}]')$$,
  'The payments cannot be read', 'a payment is in whole dinars');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "card", "amount": "6000"}]')$$,
  'The payments cannot be read', 'an amount is a number');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "platform_paid", "amount": 6000}]')$$,
  'Delivery-platform orders are platform-paid, and only they are', 'a sale in the café is not platform-paid');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "mixed", "amount": 6000}]')$$,
  'Tender mixed is not supported', 'nor paid any other way');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => '[{"type": "cash", "amount": 6000}]')$$,
  'Send the payments once: one tender, or the list of payments', 'a tender and a list are not both taken');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'))$$,
  'Choose how it was paid', 'nor neither');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => (select jsonb_agg(jsonb_build_object('type', 'card', 'amount', 500)) from generate_series(1, 11)))$$,
  'A sale is paid in at most 10 payments', 'ten payments at most');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_expected_net => 5000, p_tenders => '[{"type": "cash", "amount": 1000}, {"type": "card", "amount": 4000}]')$$,
  'The total is 6000 now, not the 5000 shown%', 'a price that changed is told as such, before the payments');
select test.throws($$select record_sale(gen_random_uuid(), 'talabat', null, pg_temp.lines('{"E": 1}'),
  p_platform_order_no => 'T-2', p_tenders => '[{"type": "platform_paid", "amount": 1000},
                                                {"type": "platform_paid", "amount": 2000}]')$$,
  'A delivery platform''s order is paid once, by the platform', 'a platform''s order is not split');
select test.throws($$select record_sale(gen_random_uuid(), 'talabat', null, pg_temp.lines('{"E": 1}'),
  p_platform_order_no => 'T-2', p_tenders => '[{"type": "card", "amount": 3000}]')$$,
  'Delivery-platform orders are platform-paid, and only they are', 'nor paid at the till');
select test.eq(pg_temp.orders(), (select n from n_before), 'none of them recorded anything');

-- ------------------------------------------------------------ sent again
insert into res select 'A again', record_sale('52000000-0000-0000-0000-00000000000a', 'dine_in', null,
  pg_temp.lines('{"E": 2, "W": 1}'), p_tenders => '[{"type": "card", "amount": 6000}]');
select test.eq((pg_temp.r('A again') ->> 'replayed') || ' ' || (pg_temp.r('A again') -> 'payments' -> 0 ->> 'type')
               || ' ' || jsonb_array_length(pg_temp.r('A again') -> 'payments'),
  'true cash 2', 'sent again with its key: the sale as recorded, its payments as they were');

-- ------------------------------------------------------------ one payment
insert into res select 'C', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => '[{"type": "cash", "amount": 2500, "received": 10000}]');
select test.eq(pg_temp.paid('C'), 'cash 2500 of 10000, change 7500', 'cash alone, with its change');
select test.eq(pg_temp.drawer(pg_temp.sale('C')), 'sale 2500', 'the drawer keeps the sale, not the note');
insert into res select 'D', record_sale(gen_random_uuid(), 'dine_in', 'card', pg_temp.lines('{"E": 1}'));
select test.eq(pg_temp.paid('D'), 'card 2500', 'the old single tender is one payment for the whole of it');
select test.eq(test.lines_of(pg_temp.sale('D')), '1010 Dr 2500 | 1200 Cr 200 | 4000 Cr 2500 | 5000 Dr 200',
  'and is journaled as before');
insert into res select 'E', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"W": 1}'),
  p_tenders => '[{"type": "card", "amount": 400}, {"type": "card", "amount": 600}]');
select test.eq(pg_temp.paid('E') || ' | ' || test.lines_of(pg_temp.sale('E')),
  'card 400 + card 600 | 1010 Dr 1000 | 1200 Cr 250 | 4000 Cr 1000 | 5000 Dr 250',
  'two cards: two payments, one line on the card account');
insert into res select 'T', record_sale(gen_random_uuid(), 'talabat', null, pg_temp.lines('{"E": 1}'),
  p_platform_order_no => 'T-1', p_tenders => '[{"type": "platform_paid", "amount": 3000}]');
select test.eq(pg_temp.paid('T') || ' | ' || (pg_temp.r('T') ->> 'platform_order_no'), 'platform_paid 3000 | T-1',
  'a platform''s order, paid once by the platform, with its number');

-- ------------------------------------------------------------ a bill paid two ways
insert into res select 'B', open_tab('dine_in', null, 'Two ways', null, pg_temp.lines('{"E": 1, "W": 1}'));
create temp table bill as
  select b.tab_id, b.version, b.total from pos_open_bills() b where b.tab_id = (pg_temp.r('B') ->> 'tab_id')::uuid;
grant select on bill to public;
select test.eq((select total from bill), 3500::numeric, 'a bill of 3,500');
select test.throws($$select settle_tab((select tab_id from bill), (select version from bill), gen_random_uuid(), null,
  3500, null, '[{"type": "cash", "amount": 1500}, {"type": "card", "amount": 1500}]')$$,
  'The payments come to 3000, not the 3500 to pay', 'a bill is paid in full or not at all');
select test.eq((select count(*) from pos_open_bills() b where b.tab_id = (select tab_id from bill))::int, 1,
  'and stays open');
insert into res select 'F', settle_tab((select tab_id from bill), (select version from bill), gen_random_uuid(), null,
  3500, null, '[{"type": "cash", "amount": 1500}, {"type": "card", "amount": 2000}]');
select test.eq(pg_temp.paid('F') || ' | ' || test.lines_of(pg_temp.sale('F')),
  'cash 1500 + card 2000 | 1000 Dr 1500 | 1010 Dr 2000 | 1200 Cr 450 | 4000 Cr 3500 | 5000 Dr 450',
  'a bill paid in cash and by card');
select test.eq(pg_temp.drawer(pg_temp.sale('F')), 'sale 1500', 'its cash in the drawer');

-- ------------------------------------------------------------ a void takes back the cash only
insert into res select 'V', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => '[{"type": "cash", "amount": 1000}, {"type": "card", "amount": 1500}]');
select test.act_as('manager@example.com');
select void_sale(pg_temp.sale('V'), 'Rang twice', 'rang_twice');
select test.as_admin();
select test.eq((select string_agg(e.kind || ' ' || trim_scale(e.amount), ', ')
                  from cash_event e join sale_adjustment a on a.id = e.reference_id
                 where a.sales_order_id = pg_temp.sale('V') and a.kind = 'void'),
  'void -1000', 'a void takes back from the drawer the cash the sale put in it, not the card''s');

-- ------------------------------------------------------------ refunds per payment
select test.act_as('manager@example.com');
insert into res select 'R1', refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"W": 1}'), 'changed_mind');
select test.eq(pg_temp.back(pg_temp.r('R1')) || ' | ' || (pg_temp.r('R1') ->> 'tender'), 'cash 333, card 667 | cash',
  'a refund goes back in proportion to what is left of each payment, in whole dinars');
select test.eq(test.lines_of((pg_temp.r('R1') ->> 'refund_id')::uuid),
  '1000 Cr 333 | 1010 Cr 667 | 1200 Dr 250 | 4200 Dr 1000 | 5000 Cr 250',
  'each payment''s account credited with its part');
select test.eq(pg_temp.drawer((pg_temp.r('R1') ->> 'refund_id')::uuid), 'refund -333',
  'only the cash part leaves the drawer');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  p_tenders => '[{"type": "cash", "amount": 2500}]')$$,
  'Only 1667 of the cash paid is left to give back', 'never more back in cash than is left of the cash paid');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  p_tenders => '[{"type": "cash", "amount": 1000}, {"type": "card", "amount": 1000}]')$$,
  'The refund is 2500, but the payments given back come to 2000', 'the parts come to the refund');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  p_tenders => '[{"type": "platform_paid", "amount": 2500}]')$$,
  'Only 0 of the platform''s payment is left to give back', 'nor back a way it was not paid');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  p_tenders => '[{"type": "cash", "amount": 1000}, {"type": "cash", "amount": 1500}]')$$,
  'A payment is named twice', 'each way once');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  p_tenders => '[{"type": "card", "amount": 0}]')$$,
  'The payments to give back cannot be read', 'a part is more than nothing');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  p_tenders => '{"cash": 2500}')$$,
  'The payments to give back cannot be read', 'and is read from a list');
insert into res select 'R2', refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  p_tenders => '[{"type": "card", "amount": 833}, {"type": "cash", "amount": 1667}]',
  p_idempotency_key => '52000000-0000-0000-0000-0000000000f2');
select test.eq(pg_temp.back(pg_temp.r('R2')), 'cash 1667, card 833', 'or as the refunder chose, each at most what is left of it');
select test.eq(pg_temp.drawer((pg_temp.r('R2') ->> 'refund_id')::uuid), 'refund -1667', 'its cash from the drawer');
insert into res select 'R2 again', refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  p_tenders => '[{"type": "card", "amount": 833}, {"type": "cash", "amount": 1667}]',
  p_idempotency_key => '52000000-0000-0000-0000-0000000000f2');
select test.eq((pg_temp.r('R2 again') ->> 'replayed') || ' ' || (pg_temp.r('R2 again') ->> 'refund_no'),
  'true ' || (pg_temp.r('R2') ->> 'refund_no'), 'sent again with its key: refunded once');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  p_tenders => '[{"type": "card", "amount": 2500}]', p_idempotency_key => '52000000-0000-0000-0000-0000000000f2')$$,
  '%does not match what was first sent%', 'the same key to give it back another way is refused');
insert into res select 'R3', refund_sale(pg_temp.sale('A'), 'The rest', 'changed_mind');
select test.eq(pg_temp.back(pg_temp.r('R3')) || ' | ' || coalesce(pg_temp.drawer((pg_temp.r('R3') ->> 'refund_id')::uuid), 'no cash'),
  'card 2500 | no cash', 'the rest of it goes back the one way something is left of: the card');
select test.as_admin();
select test.eq((select string_agg(rt.tender_type || ' ' || trim_scale(sum), ', ' order by rt.tender_type)
                  from (select rt.tender_type, sum(rt.amount) from sale_refund r join sale_refund_tender rt on rt.refund_id = r.id
                         where r.sales_order_id = pg_temp.sale('A') group by 1) rt),
  'cash 2000, card 4000', 'refunded in full: each payment given back exactly');
select test.eq((select status::text from sales_order where id = pg_temp.sale('A')), 'refunded', 'and the sale refunded');

-- ------------------------------------------------------------ the day and the drawer
select test.eq((select row(t.cash_sales, t.cash_refunds, t.orders)::text
                  from day_cash_totals('00000000-0000-0000-0000-0000000000b1',
                                       default_location('00000000-0000-0000-0000-0000000000b1'), test.today()) t),
  '(6000,2000,6)', 'the day''s cash: the cash parts of its sales, the cash its refunds gave back; the orders once each');
select test.act_as('owner@example.com');
select test.eq((select (d ->> 'cash_sales') || ' ' || (d ->> 'cash_refunds') || ' | card ' || (d ->> 'card')
                       || ' | platform ' || (d ->> 'platform') || ' | ' || (d ->> 'orders') || ' orders'
                  from report_day_totals(test.today()) d),
  '6000 2000 | card 9500 | platform 3000 | 6 orders', 'the day''s totals by payment');
select test.eq((select (d ->> 'orders') || ' orders | sales ' || (d ->> 'cash_sales') || ', voids ' || (d ->> 'voids')
                       || ', refunds ' || (d ->> 'refunds') || ' | expected ' || (d ->> 'expected')
                       || ' | card ' || (d ->> 'card')
                  from drawer_status() d),
  '6 orders | sales 7000, voids 1000, refunds 2000 | expected 4000 | card 9500',
  'the drawer: each cash payment in, the void''s and the refunds'' cash out; a sale paid two ways is one order');
select test.eq((select string_agg(p.method || ' ' || p.sales || ' ' || trim_scale(p.taken) || ' ' || p.split_sales || ' '
                                  || trim_scale(p.change_given) || ' ' || trim_scale(p.refunded) || ' ' || trim_scale(p.net),
                                  '; ' order by p.method)
                  from report_payments(test.today(), test.today()) p),
  'cash 3 6000 2 10500 2000 4000; card 4 9500 2 0 4000 5500; platform_paid 1 3000 0 0 0 3000',
  'the takings by how they were paid: sales, taken, paid more than one way, change, given back, net');
select test.act_as('cashier@example.com');
select test.throws($$select * from report_payments(test.today(), test.today())$$, '%permission%',
  'a cashier does not read the takings');

-- ------------------------------------------------------------ the books
select test.as_admin();
select test.eq(test.balance('1000') || ' ' || test.balance('1010') || ' ' || test.balance('1100'), '4000 5500 3000',
  'cash, card and platform accounts hold what their payments took, less what went back');
select test.eq((select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
                  from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today()) where difference <> 0),
  null, 'the books tie');

-- ------------------------------------------------------------ a refund from before 0037
-- It names no payment: it gave back the sale's one.
insert into sale_adjustment (business_id, sales_order_id, kind, amount, reason, reason_code)
values ('00000000-0000-0000-0000-0000000000b1', pg_temp.sale('C'), 'refund', 500, 'Refunded before 0037', 'other');
select test.eq((select string_agg(tender_type || ' ' || trim_scale(left_amount), ', ') from refundable_payments(pg_temp.sale('C'))),
  'cash 2000', 'an old refund is taken off the sale''s one payment');
select test.eq((select t.cash_refunds from day_cash_totals('00000000-0000-0000-0000-0000000000b1',
                                                          default_location('00000000-0000-0000-0000-0000000000b1'), test.today()) t),
  2500::numeric, 'and counted in the day''s cash refunds when the sale was paid in cash');
