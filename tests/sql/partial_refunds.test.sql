-- =============================================================================
-- Refunds by the item (0037, release L): some of a sale's items given back at
-- their share of what the sale took; the last refund of a line takes what is
-- left of it, so a sale's refunds add up to it; what can go back on the shelf
-- goes back at its own line's cost; cash from the drawer's open session, card
-- off 1010, a platform's order off what it owes. The fixtures opened the
-- drawer. Espresso: 2,500 dine-in, 3,000 on Talabat (20 g of beans at 10, and
-- a cup on Talabat); water: 1,000, a bottle bought in at 250 (returnable).
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.sale(p text) returns uuid language sql as $$
  select (v ->> 'order_id')::uuid from res where k = p
$$;
-- The tests' own view: a sale's line for a product, what the shelf holds, a status.
create function pg_temp.line(p_sale text, p_variant text) returns uuid language sql security definer as $$
  select sl.id from sales_order_line sl
   where sl.sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p_sale)
     and sl.product_variant_id = p_variant::uuid
$$;
create function pg_temp.water() returns numeric language sql security definer as $$
  select (item_position('00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-000000000003',
                        default_location('00000000-0000-0000-0000-0000000000b1'))).qty
$$;
create function pg_temp.status(p text) returns text language sql security definer as $$
  select status::text from sales_order where id = (select (v ->> 'order_id')::uuid from res where k = p)
$$;
create function pg_temp.lines(p_refund jsonb) returns text language sql security definer as $$
  select test.lines_of((p_refund ->> 'refund_id')::uuid)
$$;
create function pg_temp.items(p_sale text, p jsonb) returns jsonb language sql as $$
  -- [{"E": qty}, {"W": qty}] → the lines of that sale, as the Orders screen sends them
  select jsonb_agg(jsonb_build_object('line_id',
           pg_temp.line(p_sale, case x.key when 'E' then 'd1000000-0000-0000-0000-000000000001'
                                           else 'd1000000-0000-0000-0000-000000000002' end), 'qty', x.value))
    from jsonb_each(p) x
$$;
create temp table before as select pg_temp.water() as water;
grant select on before to public;

-- ------------------------------------------------------------ a sale, by line
select test.act_as('cashier@example.com');
insert into res select 'A', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":2}]');
select test.as_admin();
select test.eq((select count(*) filter (where sales_order_line_id is null) || '/' || count(*)
                  from inventory_movement where reference_type = 'sales_order' and reference_id = pg_temp.sale('A')),
  '0/2', 'each stock movement of a sale names its line');
select test.eq((select string_agg(sl.product_variant_id::text || ':' || i.name, ',' order by i.name)
                  from inventory_movement mv join sales_order_line sl on sl.id = mv.sales_order_line_id
                  join item i on i.id = mv.item_id
                 where mv.reference_id = pg_temp.sale('A')),
  'd1000000-0000-0000-0000-000000000001:Golden beans,d1000000-0000-0000-0000-000000000002:Golden water',
  'the beans with the espresso line, the water with the water line');

-- ------------------------------------------------------------ who may
select test.act_as('cashier@example.com');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind')$$,
  '%permission%', 'a cashier does not refund');

-- ------------------------------------------------------------ some of it
select test.act_as('manager@example.com');
insert into res select 'A1', refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1, "W": 1}'), 'changed_mind');
select test.eq((pg_temp.r('A1') ->> 'refunded') || '/' || (pg_temp.r('A1') ->> 'returned_to_stock') || '/' ||
               (pg_temp.r('A1') ->> 'refund_no') || '/' || (pg_temp.r('A1') ->> 'status') || '/' ||
               (pg_temp.r('A1') ->> 'whole') || '/' || (pg_temp.r('A1') ->> 'tender'),
  '3500/250/1/partially_refunded/false/cash',
  'one espresso and one water: 3,500 back in cash, the bottle (250) back on the shelf; refund 1; part-refunded');
select test.eq(pg_temp.lines(pg_temp.r('A1')), '1000 Cr 3500 | 1200 Dr 250 | 4200 Dr 3500 | 5000 Cr 250',
  'Dr Sales returns, Cr Cash; the bottle back into stock at its cost, out of the cost of sales');
select test.eq(pg_temp.status('A'), 'partially_refunded', 'the sale is part-refunded');
select test.as_admin();
select test.eq(pg_temp.water(), (select water from before) - 1, 'one of the two bottles is back on the shelf');
select test.eq((select string_agg(trim_scale(rl.qty) || '×' || trim_scale(rl.amount) || '/' || trim_scale(rl.cost_returned)
                                  || '/' || rl.restocked, ', ' order by rl.amount desc)
                  from sale_refund_line rl where rl.refund_id = (pg_temp.r('A1') ->> 'refund_id')::uuid),
  '1×2500/0/false, 1×1000/250/true', 'its lines: the espresso (not restocked) and the water (restocked)');
select test.eq((select tender_type::text || ' ' || trim_scale(amount) from sale_refund_tender
                 where refund_id = (pg_temp.r('A1') ->> 'refund_id')::uuid), 'cash 3500',
  'the money went back to the payment the sale took');
select test.eq((select count(*) from sale_adjustment a join sale_refund r on r.id = a.id
                 where a.kind = 'refund' and a.amount = r.amount and r.id = (pg_temp.r('A1') ->> 'refund_id')::uuid)::int,
  1, 'the refund is the sale''s adjustment of kind refund, under the same id');
select test.eq((select trim_scale(-e.amount) || ' ' || (w.closed_at is null) from cash_event e
                  join work_shift w on w.id = e.work_shift_id
                 where e.reference_type = 'sale_adjustment' and e.reference_id = (pg_temp.r('A1') ->> 'refund_id')::uuid),
  '3500 true', 'the cash left the drawer, in its open session');
select test.eq((select sales_order_line_id from inventory_movement
                 where type = 'refund_return_to_stock' and reference_id = (pg_temp.r('A1') ->> 'refund_id')::uuid),
  pg_temp.line('A', 'd1000000-0000-0000-0000-000000000002'), 'the bottle came back to the water line');

-- ------------------------------------------------------------ what is refused
select test.act_as('manager@example.com');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 3}'), 'changed_mind')$$,
  'Only 2 of Golden espresso — Single is left to refund', 'not more than is left of a line');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), null)$$,
  'Choose a reason from the list', 'a refund needs a reason');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'),
                     jsonb_build_array(jsonb_build_object('line_id', gen_random_uuid(), 'qty', 1)), 'changed_mind')$$,
  'That item is not on this sale', 'only the sale''s own items');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'),
                     pg_temp.items('A', '{"E": 1}') || pg_temp.items('A', '{"E": 1}'), 'changed_mind')$$,
  'An item is named twice', 'each item once');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), '[{"line_id": "x", "qty": 1}]', 'changed_mind')$$,
  'The items to refund cannot be read', 'what cannot be read is refused');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 0}'), 'changed_mind')$$,
  'Choose what to refund', 'nothing chosen, nothing refunded');

-- ------------------------------------------------------------ sent twice
insert into res select 'A2', refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  null, null, '51000000-0000-0000-0000-000000000001');
insert into res select 'A2b', refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"E": 1}'), 'changed_mind',
  null, null, '51000000-0000-0000-0000-000000000001');
select test.eq((pg_temp.r('A2b') ->> 'replayed') || ' ' || (pg_temp.r('A2b') ->> 'refund_no') || '=' ||
               (pg_temp.r('A2') ->> 'refund_no'), 'true 2=2', 'sent twice with one key: refunded once, the retry told so');
select test.throws($$select refund_sale_lines(pg_temp.sale('A'), pg_temp.items('A', '{"W": 1}'), 'changed_mind',
                     null, null, '51000000-0000-0000-0000-000000000001')$$,
  '%does not match what was first sent%', 'the same key for other items is refused');

-- ------------------------------------------------------------ the rest of it
insert into res select 'A3', refund_sale(pg_temp.sale('A'), null, 'quality');
select test.eq((pg_temp.r('A3') ->> 'refunded') || '/' || (pg_temp.r('A3') ->> 'returned_to_stock') || '/' ||
               (pg_temp.r('A3') ->> 'status') || '/' || (pg_temp.r('A3') ->> 'whole') || '/' ||
               (pg_temp.r('A3') ->> 'refund_no'),
  '3500/250/refunded/true/3', 'what is left, whole: the last espresso and the last bottle, 3,500; refunded');
select test.as_admin();
select test.eq((select trim_scale(sum(amount)) from sale_refund where sales_order_id = pg_temp.sale('A')) || ' of ' ||
               (select trim_scale(net_amount) from sales_order where id = pg_temp.sale('A')), '9500 of 9500',
  'the refunds add up to the sale');
select test.eq(pg_temp.water(), (select water from before), 'both bottles are back on the shelf');
select test.eq((select string_agg(trim_scale(qty)::text, ',' order by qty) from sale_refund_line rl
                  join sales_order_line sl on sl.id = rl.sales_order_line_id
                 where sl.sales_order_id = pg_temp.sale('A')
                   and sl.product_variant_id = 'd1000000-0000-0000-0000-000000000001'), '1,1,1',
  'the three espressos went back one at a time');
select test.act_as('manager@example.com');
select test.throws($$select refund_sale(pg_temp.sale('A'), null, 'quality')$$,
  'This sale has been refunded in full already', 'nothing is left to refund');
select test.throws($$select void_sale(pg_temp.sale('A'), null, 'rang_twice')$$,
  '%only a completed sale%', 'a refunded sale is not voided');

-- ------------------------------------------------------------ shares that do not divide
-- Three espressos, 500 off: 7,000 for the line. A third is 2,333.33: 2,333,
-- 2,333, and the last takes the 2,334 left.
select test.act_as('cashier@example.com');
insert into res select 'C', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3}]', null, null, 500, p_discount_reason => 'regular');
select test.act_as('manager@example.com');
insert into res select 'C1', refund_sale_lines(pg_temp.sale('C'), pg_temp.items('C', '{"E": 1}'), 'changed_mind');
insert into res select 'C2', refund_sale_lines(pg_temp.sale('C'), pg_temp.items('C', '{"E": 1}'), 'changed_mind');
select test.eq(pg_temp.status('C'), 'partially_refunded', 'two of three: still part-refunded');
insert into res select 'C3', refund_sale_lines(pg_temp.sale('C'), pg_temp.items('C', '{"E": 1}'), 'changed_mind');
select test.eq((pg_temp.r('C1') ->> 'refunded') || ',' || (pg_temp.r('C2') ->> 'refunded') || ',' ||
               (pg_temp.r('C3') ->> 'refunded'), '2333,2333,2334',
  'each its share of the net after the discount; the last takes what is left');
select test.eq(pg_temp.status('C'), 'refunded', 'three of three: refunded');

-- ------------------------------------------------------------ a void, a card, a platform
select test.act_as('cashier@example.com');
insert into res select 'B', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]');
insert into res select 'D', record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]');
insert into res select 'E', record_sale(gen_random_uuid(), 'talabat', 'platform_paid',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]', p_platform_order_no => '9001');
select test.as_admin();
create temp table books as select test.balance('1010') card, test.balance('1100') owed, test.balance('1000') cash;
grant select on books to public;
select test.act_as('manager@example.com');
insert into res select 'B1', refund_sale_lines(pg_temp.sale('B'), pg_temp.items('B', '{"E": 1}'), 'changed_mind');
select test.throws($$select void_sale(pg_temp.sale('B'), null, 'rang_twice')$$,
  'Only a completed sale can be voided; this one is partially_refunded', 'a sale part-refunded is not voided');
insert into res select 'D1', refund_sale_lines(pg_temp.sale('D'), pg_temp.items('D', '{"E": 1}'), 'quality');
insert into res select 'E1', refund_sale_lines(pg_temp.sale('E'), pg_temp.items('E', '{"E": 1}'), 'wrong_order');
select test.as_admin();
select test.eq(test.balance('1010') - (select card from books), -2500::numeric, 'a card refund comes off the card takings');
select test.eq(test.balance('1100') - (select owed from books), -3000::numeric,
  'a Talabat refund comes off what Talabat owes');
select test.eq(test.balance('1000') - (select cash from books), -2500::numeric, 'a cash refund comes out of the till');
select test.eq((select count(*) from cash_event where reference_id in ((pg_temp.r('D1') ->> 'refund_id')::uuid,
                                                                        (pg_temp.r('E1') ->> 'refund_id')::uuid))::int,
  0, 'neither the card nor the platform refund touches the drawer');
select test.act_as('manager@example.com');
select test.eq((select (o ->> 'amount')::numeric from jsonb_array_elements(platform_money() -> 'orders') o
                 where o ->> 'order_no' = '9001'), 3000::numeric, 'Talabat still owes the 3,000 left of order 9001');
select test.as_admin();
select test.eq((select (l ->> 'expected')::numeric || ' ' || (l ->> 'status')
                  from jsonb_array_elements(platform_statement_match('00000000-0000-0000-0000-0000000000b1', 'talabat',
                         '[{"order_no": "9001", "payout": 2700, "commission": 300}]') -> 'lines') l),
  '3000 matched', 'and its statement is matched against what is left: 3,000');

-- ------------------------------------------------------------ the drawer closed
-- The owner, who sees what it should hold, closes it for the cashier, counted true.
select test.act_as('owner@example.com');
insert into res select 'closed', close_cash_session((cash_session_status() ->> 'expected')::numeric);
select test.act_as('manager@example.com');
select test.throws($$select refund_sale_lines(pg_temp.sale('B'), pg_temp.items('B', '{"E": 1}'), 'changed_mind')$$,
  'Open the drawer first: on the till, count the cash in it', 'cash is not given back with the drawer closed');
select test.act_as('cashier@example.com');
select open_cash_session((pg_temp.r('closed') ->> 'left')::numeric);
select test.act_as('manager@example.com');
insert into res select 'B2', refund_sale_lines(pg_temp.sale('B'), pg_temp.items('B', '{"E": 1}'), 'changed_mind');
select test.eq(pg_temp.status('B'), 'refunded', 'opened again, the rest of it goes back');

-- ------------------------------------------------------------ before refunds by item
-- A sale recorded before 0037: its movements do not name their lines.
select test.act_as('cashier@example.com');
insert into res select 'F', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1},
    {"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]');
select test.as_admin();
alter table inventory_movement disable trigger user;
update inventory_movement set sales_order_line_id = null where reference_id = pg_temp.sale('F');
alter table inventory_movement enable trigger user;
select test.act_as('manager@example.com');
select test.throws($$select refund_sale_lines(pg_temp.sale('F'), pg_temp.items('F', '{"W": 1}'), 'changed_mind')$$,
  'This sale was recorded before refunds by item: refund all of it', 'an older sale is refunded whole');
insert into res select 'F1', refund_sale(pg_temp.sale('F'), null, 'changed_mind');
select test.eq((pg_temp.r('F1') ->> 'refunded') || '/' || (pg_temp.r('F1') ->> 'returned_to_stock') || '/' ||
               (pg_temp.r('F1') ->> 'status'), '3500/250/refunded', 'whole, as before, the bottle back on the shelf');

-- ------------------------------------------------------------ the record
select test.as_admin();
select test.eq((select string_agg(refund_no::text, ',' order by refund_no) from sale_refund), '1,2,3,4,5,6,7,8,9,10,11',
  'refunds are numbered 1, 2, 3 …, none skipped');
select test.eq((select count(*) from sale_refund r
                 where r.amount <> (select sum(amount) from sale_refund_line where refund_id = r.id)
                   and exists (select 1 from sale_refund_line where refund_id = r.id))::int, 0,
  'each refund is the sum of its lines');
select test.eq((select count(*) from sale_refund r
                 where r.amount <> (select sum(amount) from sale_refund_tender where refund_id = r.id))::int, 0,
  'and went back to its payment whole');
select test.eq((select count(*) from sale_refund r join journal_entry j on j.id = r.journal_entry_id
                 where j.reference_type = 'sale_refund' and j.reference_id = r.id and j.status = 'published')::int,
  (select count(*) from sale_refund)::int, 'each refund has its one published journal');
select test.eq((select count(*) from audit_log where action = 'sale.refund' and after_state ? 'refund_no')::int,
  (select count(*) from sale_refund)::int, 'each refund is on the audit trail, with its number');
select test.eq((select count(*) from inventory_movement mv
                 where mv.sales_order_line_id is not null
                   and not exists (select 1 from sales_order_line sl
                                    where sl.id = mv.sales_order_line_id
                                      and sl.sales_order_id = case when mv.type = 'refund_return_to_stock'
                                                                   then (select sales_order_id from sale_refund
                                                                          where id = mv.reference_id)
                                                                   else mv.reference_id end))::int, 0,
  'every stock movement that names a line names one of its own sale');
select test.throws($$update sale_refund set amount = 1$$, '%append-only%', 'a refund is never changed');
select test.act_as('cashier@example.com');
select test.eq((select count(*) from sale_refund)::int, 0, 'a cashier reads no refunds');
select test.act_as('owner@example.com');
select test.eq((select sum(refunds) from report_daily_sales(test.today(), test.today())),
  (select sum(amount) from sale_adjustment where kind = 'refund'), 'the day''s sales count every refund');
select test.eq((select string_agg(check_key, ',') from report_reconciliation(test.today()) where difference <> 0), null,
  'every subledger agrees with its account');

-- ------------------------------------------------------------ the old count is closed
select test.act_as('manager@example.com');
select test.throws($$select count_drawer(0)$$, '%permission denied%', 'the old drawer count is closed');
