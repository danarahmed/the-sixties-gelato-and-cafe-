-- =============================================================================
-- Correcting a delivery (0038, release M): the quantity, the price, the item,
-- the supplier and the date of a delivery corrected by a document of its own,
-- or the delivery reversed. Stock moves by what changes; 2050 by the
-- difference in value; the part of a price difference whose stock has been
-- used goes to 5050. Refused once billed, for an item counted since, in a
-- locked month, and below zero without a confirmation. Fixtures: water 24 at
-- 250, beans 1,000 g at 10/g, cups 100 at 50; an espresso takes 20 g of beans.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.receipt(p text) returns uuid language sql as $$
  select (v ->> 'receipt_id')::uuid from res where k = p
$$;
-- The tests' own view, whoever they act as.
create function pg_temp.pos(p_item text) returns text language sql security definer as $$
  select trim_scale(p.qty) || '/' || trim_scale(p.value)
    from item_position('00000000-0000-0000-0000-0000000000b1', p_item::uuid,
                       default_location('00000000-0000-0000-0000-0000000000b1')) p
$$;
create function pg_temp.line(p_receipt text, p_item text) returns uuid language sql security definer as $$
  select gl.id from goods_receipt_line gl
   where gl.goods_receipt_id = (select (v ->> 'receipt_id')::uuid from res where k = p_receipt) and gl.item_id = p_item::uuid
$$;
create function pg_temp.corr_lines(p text) returns text language sql security definer as $$
  select test.lines_of((v ->> 'correction_id')::uuid) from res where k = p
$$;
create function pg_temp.grni(p_receipt text) returns numeric language sql security definer as $$
  select receipt_grni_value((select (v ->> 'receipt_id')::uuid from res where k = p_receipt))
$$;
create function pg_temp.received_on(p_receipt text) returns text language sql security definer as $$
  select receipt_state((select (v ->> 'receipt_id')::uuid from res where k = p_receipt)) ->> 'received_on'
$$;
create function pg_temp.sup(n int) returns uuid language sql security definer as $$
  select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' order by name, id offset n limit 1
$$;
create function pg_temp.recon() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
   where check_key in ('inventory', 'grni', 'documents')
$$;

-- ------------------------------------------------------------ fewer than entered
-- 10 bottles at 300 were entered; 8 came. Nothing has been sold since, so the
-- two go out at the price they came in at: exactly as if 8 had been entered.
select test.act_as('manager@example.com');
insert into res select 'R1', receive_goods(pg_temp.sup(0),
  '[{"item_id":"c0000000-0000-0000-0000-000000000003","qty":10,"unit_price":300}]');
select test.eq(pg_temp.pos('c0000000-0000-0000-0000-000000000003'), '34/9000', 'water: 24 at 250 and 10 at 300');
select test.throws($$select correct_receipt(pg_temp.receipt('R1'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R1', 'c0000000-0000-0000-0000-000000000003'),
                    'item_id', 'c0000000-0000-0000-0000-000000000003', 'qty', 8, 'unit_price', 300)), null, null, '  ')$$,
  'Say why the delivery is being corrected', 'a correction says why');
create temp table k1 as select gen_random_uuid() as k;
grant select on k1 to public;
insert into res select 'C1', correct_receipt(pg_temp.receipt('R1'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R1', 'c0000000-0000-0000-0000-000000000003'),
                    'item_id', 'c0000000-0000-0000-0000-000000000003', 'qty', 8, 'unit_price', 300)),
  null, null, 'Only 8 bottles came', false, (select k from k1));
select test.eq((pg_temp.r('C1') ->> 'correction_no') || '/' || (pg_temp.r('C1') ->> 'kinds') || '/'
               || (pg_temp.r('C1') ->> 'stock') || '/' || (pg_temp.r('C1') ->> 'grni') || '/' || (pg_temp.r('C1') ->> 'variance'),
  '1/["quantity"]/-600/-600/0', 'correction 1: the quantity, 600 out of stock and out of 2050');
select test.eq(pg_temp.corr_lines('C1'), '1200 Cr 600 | 2050 Dr 600', 'Dr 2050 / Cr 1200, at the price they came in at');
select test.eq(pg_temp.pos('c0000000-0000-0000-0000-000000000003'), '32/8400', 'water: 32, worth 8,400, as if 8 had been entered');
select test.eq(pg_temp.grni('R1'), 2400::numeric, 'the delivery now owes its bill 2,400');
select test.eq((select (r ->> 'replayed')::boolean || '/' || (r ->> 'correction_no')
                  from (select correct_receipt(pg_temp.receipt('R1'),
                          jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R1', 'c0000000-0000-0000-0000-000000000003'),
                                            'item_id', 'c0000000-0000-0000-0000-000000000003', 'qty', 8, 'unit_price', 300)),
                          null, null, 'Only 8 bottles came', false, (select k from k1)) r) x),
  'true/1', 'sent again with its key, it is the same correction, made once');
select test.throws($$select correct_receipt(pg_temp.receipt('R1'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R1', 'c0000000-0000-0000-0000-000000000003'),
                    'item_id', 'c0000000-0000-0000-0000-000000000003', 'qty', 8, 'unit_price', 300)), null, null, 'again')$$,
  'Nothing was changed', 'a correction that changes nothing is refused');
select test.throws($$select correct_receipt(pg_temp.receipt('R1'), '[]', null, null, 'none')$$,
  'A delivery keeps at least one line%', 'taking every line off is a reversal, not a correction');
select test.throws($$select correct_receipt(pg_temp.receipt('R1'),
  '[{"line_id":"00000000-0000-0000-0000-00000000dead","item_id":"c0000000-0000-0000-0000-000000000003","qty":8,"unit_price":300}]',
  null, null, 'x')$$, 'That line is not on this delivery', 'a line is corrected on its own delivery only');
select test.throws($$select correct_receipt(pg_temp.receipt('R1'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R1', 'c0000000-0000-0000-0000-000000000003'),
                    'item_id', 'c0000000-0000-0000-0000-000000000003', 'qty', 0, 'unit_price', 300)), null, null, 'x')$$,
  'Every line needs a quantity%', 'a line keeps a quantity');

-- The bill for what came: 2,400, and nothing to 5050.
insert into res select 'B1', record_bill(pg_temp.sup(0), 'CORR-1', test.today(), 2400, 0, pg_temp.receipt('R1'));
select test.as_admin();
select test.eq(test.lines_of((pg_temp.r('B1') ->> 'bill_id')::uuid), '2000 Cr 2400 | 2050 Dr 2400',
  'the bill clears the corrected 2050 exactly: no price variance');
select test.act_as('manager@example.com');
select test.throws($$select correct_receipt(pg_temp.receipt('R1'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R1', 'c0000000-0000-0000-0000-000000000003'),
                    'item_id', 'c0000000-0000-0000-0000-000000000003', 'qty', 7, 'unit_price', 300)), null, null, 'x')$$,
  '%has been billed: cancel its bill on Vendors first%', 'a billed delivery waits for its bill to be cancelled');

-- ------------------------------------------------------------ the wrong price, a third of it used
-- 2 kg of beans entered at 6,000 a kg (confirmed, being far from the cost
-- now); the invoice says 12,000. 50 espressos use 1 kg before anyone notices:
-- a third of the delivery's value has gone into sales at the wrong price.
insert into res select 'R2', receive_goods(pg_temp.sup(0),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":2,"unit_code":"kg","unit_price":6000}]', p_confirm => true);
select test.eq(pg_temp.pos('c0000000-0000-0000-0000-000000000001'), '3000/22000', 'beans: 1,000 g at 10, 2,000 g at 6');
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":50}]');
select test.eq(pg_temp.pos('c0000000-0000-0000-0000-000000000001'), '2000/14667', '1 kg used at the average, 7,333');
select test.act_as('manager@example.com');
create temp table pv2 as select preview_receipt_correction(pg_temp.receipt('R2'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R2', 'c0000000-0000-0000-0000-000000000001'),
                    'item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 2, 'unit_code', 'kg', 'unit_price', 12000))) as p;
grant select on pv2 to public;
select test.eq((select (p ->> 'stock') || '/' || (p ->> 'grni') || '/' || (p ->> 'variance') || '/'
                       || (p -> 'items' -> 0 ->> 'still_on_hand') || '/' || (p ->> 'kinds') from pv2),
  '8000/12000/4000/0.6667/["price"]',
  'the preview: two thirds still on the shelf revalue it by 8,000; the third used, 4,000, to 5050');
select test.eq((select count(*) from receipt_correction)::int, 1, 'and a preview writes nothing');
insert into res select 'C2', correct_receipt(pg_temp.receipt('R2'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R2', 'c0000000-0000-0000-0000-000000000001'),
                    'item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 2, 'unit_code', 'kg', 'unit_price', 12000)),
  null, null, 'The invoice says 12,000 a kg');
select test.eq((pg_temp.r('C2') ->> 'stock') || '/' || (pg_temp.r('C2') ->> 'grni') || '/' || (pg_temp.r('C2') ->> 'variance'),
  (select (p ->> 'stock') || '/' || (p ->> 'grni') || '/' || (p ->> 'variance') from pv2),
  'the correction does what its preview said');
select test.eq(pg_temp.corr_lines('C2'), '1200 Dr 8000 | 2050 Cr 12000 | 5050 Dr 4000',
  'Dr 1200 8,000 and 5050 4,000 / Cr 2050 12,000');
select test.eq(pg_temp.pos('c0000000-0000-0000-0000-000000000001'), '2000/22667',
  'the beans left are worth what they would have been at the right price (11.33 a gram)');
select test.as_admin();
select test.eq((select string_agg(type::text || ' ' || trim_scale(base_quantity_signed) || ' ' || trim_scale(value), ', ' order by base_quantity_signed)
                  from inventory_movement where reference_type = 'receipt_correction'
                   and reference_id = (pg_temp.r('C2') ->> 'correction_id')::uuid),
  'cost_adjustment -2000 14667, cost_adjustment 2000 22667',
  'revalued as a pair: what is on hand out at its value, back in at its corrected value');
select test.act_as('manager@example.com');
select test.eq((select trim_scale(landed_per_base) from item_price_history('c0000000-0000-0000-0000-000000000001')
                 where receipt_no = (pg_temp.r('R2') ->> 'receipt_no')::bigint), '12',
  'the price history shows the delivery as corrected');

-- ------------------------------------------------------------ more than entered, in its own unit
-- One sleeve of 50 cups entered; two came.
insert into res select 'R3', receive_goods(pg_temp.sup(0),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":1,"unit_code":"sleeve_50","unit_price":2500}]');
insert into res select 'C3', correct_receipt(pg_temp.receipt('R3'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R3', 'c0000000-0000-0000-0000-000000000002'),
                    'item_id', 'c0000000-0000-0000-0000-000000000002', 'qty', 2, 'unit_code', 'sleeve_50', 'unit_price', 2500)),
  null, null, 'Two sleeves came');
select test.eq(pg_temp.corr_lines('C3'), '1200 Dr 2500 | 2050 Cr 2500', 'the 50 more come in at their price');
select test.eq(pg_temp.pos('c0000000-0000-0000-0000-000000000002'), '200/10000', 'cups: 200, at 50 each');

-- ------------------------------------------------------------ the wrong item
-- Five "cups" at 50 were five bottles of water at 250.
insert into res select 'R4', receive_goods(pg_temp.sup(0),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":5,"unit_price":50}]');
insert into res select 'C4', correct_receipt(pg_temp.receipt('R4'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R4', 'c0000000-0000-0000-0000-000000000002'),
                    'item_id', 'c0000000-0000-0000-0000-000000000003', 'qty', 5, 'unit_price', 250)),
  null, null, 'They were bottles of water');
select test.eq((pg_temp.r('C4') ->> 'kinds'), '["item"]', 'the item is corrected');
select test.eq(pg_temp.corr_lines('C4'), '1200 Dr 1000 | 2050 Cr 1000', 'cups 250 out, water 1,250 in: 1,000 more owed');
select test.eq(pg_temp.pos('c0000000-0000-0000-0000-000000000002') || ' ' || pg_temp.pos('c0000000-0000-0000-0000-000000000003'),
  '200/10000 37/9650', 'the cups as before; the water five more, at 250');

-- ------------------------------------------------------------ the supplier, the date
insert into res select 'R5', receive_goods(pg_temp.sup(0),
  '[{"item_id":"c0000000-0000-0000-0000-000000000003","qty":1,"unit_price":250}]');
insert into res select 'C5', correct_receipt(pg_temp.receipt('R5'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R5', 'c0000000-0000-0000-0000-000000000003'),
                    'item_id', 'c0000000-0000-0000-0000-000000000003', 'qty', 1, 'unit_price', 250)),
  pg_temp.sup(1), null, 'Delivered by the other supplier');
select test.eq((pg_temp.r('C5') ->> 'kinds') || '/' || coalesce(pg_temp.r('C5') ->> 'journal_no', 'no journal'),
  '["supplier"]/no journal', 'the supplier is corrected, with nothing to post');
select test.throws($$select record_bill(pg_temp.sup(0), 'CORR-5', test.today(), 250, 0, pg_temp.receipt('R5'))$$,
  '%different supplier%', 'the supplier it was entered under no longer bills it');
select test.succeeds($$select record_bill(pg_temp.sup(1), 'CORR-5', test.today(), 250, 0, pg_temp.receipt('R5'))$$,
  'the supplier who delivered it bills it');
select test.throws($$select correct_receipt(pg_temp.receipt('R3'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R3', 'c0000000-0000-0000-0000-000000000002'),
                    'item_id', 'c0000000-0000-0000-0000-000000000002', 'qty', 2, 'unit_code', 'sleeve_50', 'unit_price', 2500)),
  null, test.today() - 40, 'x')$$, 'A delivery''s date is corrected within the month it was entered%',
  'a delivery keeps to its month');
select test.throws($$select correct_receipt(pg_temp.receipt('R3'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R3', 'c0000000-0000-0000-0000-000000000002'),
                    'item_id', 'c0000000-0000-0000-0000-000000000002', 'qty', 2, 'unit_code', 'sleeve_50', 'unit_price', 2500)),
  null, test.today() + 1, 'x')$$, 'A delivery cannot have arrived after today', 'nor arrives tomorrow');
do $$
begin
  if test.today() > date_trunc('month', test.today())::date then
    insert into res select 'C6', correct_receipt(pg_temp.receipt('R3'),
      jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R3', 'c0000000-0000-0000-0000-000000000002'),
                        'item_id', 'c0000000-0000-0000-0000-000000000002', 'qty', 2, 'unit_code', 'sleeve_50', 'unit_price', 2500)),
      null, date_trunc('month', test.today())::date, 'It came on the first');
    perform test.eq((pg_temp.r('C6') ->> 'kinds') || '/' || pg_temp.received_on('R3'),
      '["date"]/' || date_trunc('month', test.today())::date, 'the date is corrected within its month');
  else
    perform test.ok(true, 'the date is corrected within its month (not on the first day of one)');
  end if;
end $$;

-- ------------------------------------------------------------ a delivery that should not exist
insert into res select 'R7', receive_goods(pg_temp.sup(0),
  '[{"item_id":"c0000000-0000-0000-0000-000000000003","qty":3,"unit_price":250}]');
insert into res select 'C7', reverse_receipt(pg_temp.receipt('R7'), 'Entered twice');
select test.eq((pg_temp.r('C7') ->> 'kinds') || '/' || (pg_temp.r('C7') ->> 'reversed'), '["reversed"]/true', 'the delivery is reversed');
select test.eq(pg_temp.corr_lines('C7'), '1200 Cr 750 | 2050 Dr 750', 'its stock and its 2050 go');
select test.eq(pg_temp.grni('R7'), 0::numeric, 'nothing is owed for it');
select test.throws($$select reverse_receipt(pg_temp.receipt('R7'), 'again')$$, '%was reversed: receive it again instead',
  'a reversed delivery stays reversed');
select test.throws($$select record_bill(pg_temp.sup(0), 'CORR-7', test.today(), 750, 0, pg_temp.receipt('R7'))$$,
  'That delivery was reversed: there is nothing to bill', 'and has nothing to bill');
select test.eq((select p ->> 'blocked' from (select preview_receipt_correction(pg_temp.receipt('R7')) p) x),
  'Reversed: receive it again instead', 'the screen is told why it cannot be corrected');

-- ------------------------------------------------------------ counted since
insert into res select 'R8', receive_goods(pg_temp.sup(0),
  '[{"item_id":"c0000000-0000-0000-0000-000000000003","qty":4,"unit_price":250}]');
select test.act_as('counter@example.com');
create temp table cnt as select start_stock_count(array['c0000000-0000-0000-0000-000000000003'::uuid]) as id;
grant select on cnt to public;
select record_count((select id from cnt), 'c0000000-0000-0000-0000-000000000003', 41, 'each');
select submit_stock_count((select id from cnt));
select test.act_as('manager@example.com');
select approve_stock_count((select id from cnt));
select test.throws($$select correct_receipt(pg_temp.receipt('R8'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R8', 'c0000000-0000-0000-0000-000000000003'),
                    'item_id', 'c0000000-0000-0000-0000-000000000003', 'qty', 3, 'unit_price', 250)), null, null, 'x')$$,
  'Golden water counted after this delivery, and the count set its stock: correct only its price',
  'the count after it set the water''s stock: its quantity stays');
select test.succeeds($$select correct_receipt(pg_temp.receipt('R8'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('R8', 'c0000000-0000-0000-0000-000000000003'),
                    'item_id', 'c0000000-0000-0000-0000-000000000003', 'qty', 4, 'unit_price', 260)), null, null, 'It was 260')$$,
  'its price can still be corrected');

-- ------------------------------------------------------------ below zero
-- A kilogram of beans received, then all the beans used: taking the delivery
-- back leaves the beans at -1 kg, which needs saying.
insert into res select 'R9', receive_goods(pg_temp.sup(0),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1,"unit_code":"kg","unit_price":12000}]');
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":150}]');
select test.act_as('manager@example.com');
select test.eq(split_part(pg_temp.pos('c0000000-0000-0000-0000-000000000001'), '/', 1), '0', 'the beans are all used');
select test.throws($$select reverse_receipt(pg_temp.receipt('R9'), 'Never came')$$,
  'This leaves Golden beans (-1000 g) below zero: confirm to correct it all the same', 'below zero needs saying');
insert into res select 'C9', reverse_receipt(pg_temp.receipt('R9'), 'Never came', true);
select test.eq(pg_temp.corr_lines('C9'), '1200 Cr 12000 | 2050 Dr 12000', 'confirmed, it goes at its price');
select test.eq(pg_temp.pos('c0000000-0000-0000-0000-000000000001'), '-1000/-12000', 'the beans below zero, at that price');

-- ------------------------------------------------------------ who, and when
select test.act_as('cashier@example.com');
select test.throws($$select correct_receipt(pg_temp.receipt('R3'), '[]', null, null, 'x')$$,
  '%needs inventory.adjust.approve%', 'a cashier corrects no delivery');
select test.throws($$select preview_receipt_correction(pg_temp.receipt('R3'))$$,
  '%needs inventory.adjust.approve%', 'nor sees what a correction would do');
select test.eq((select count(*) from receipt_correction)::int, 0, 'nor reads the corrections');
select test.act_as('counter@example.com');
select test.throws($$select reverse_receipt(pg_temp.receipt('R3'), 'x')$$,
  '%needs inventory.adjust.approve%', 'nor does the stock counter');
-- A delivery in a locked month is no longer corrected.
select test.as_admin();
set session_replication_role = replica;
update accounting_period set status = 'locked'
 where business_id = '00000000-0000-0000-0000-0000000000b1' and test.today() between starts_on and ends_on;
set session_replication_role = origin;
select test.act_as('manager@example.com');
select test.throws($$select reverse_receipt(pg_temp.receipt('R3'), 'x')$$, 'Delivery % is in %, a locked month: it is no longer corrected',
  'a locked month''s delivery stays as it is');
select test.as_admin();
set session_replication_role = replica;
update accounting_period set status = 'open'
 where business_id = '00000000-0000-0000-0000-0000000000b1' and test.today() between starts_on and ends_on;
set session_replication_role = origin;

-- ------------------------------------------------------------ the records
select test.as_admin();
select test.eq((select string_agg(correction_no || ':' || array_to_string(kinds, '+'), ', ' order by correction_no)
                  from receipt_correction),
  '1:quantity, 2:price, 3:quantity, 4:item, 5:supplier, '
  || case when test.today() > date_trunc('month', test.today())::date then '6:date, 7:reversed, 8:price, 9:reversed'
          else '6:reversed, 7:price, 8:reversed' end,
  'the corrections are numbered in order, each with what it changed');
select test.eq((select count(*) from receipt_correction c
                 where c.before_state is null or c.after_state is null or c.reason = '')::int, 0,
  'each keeps the delivery before and after, and why');
select test.throws($$update receipt_correction set reason = 'x'$$, '%append-only%', 'a correction never changes');
select test.throws($$delete from receipt_correction$$, '%append-only%', 'nor goes');
select test.eq((select string_agg(action || '=' || n, ',' order by action)
                  from (select action, count(*) n from audit_log where action in ('purchase.correct', 'purchase.reverse')
                         group by action) x),
  case when test.today() > date_trunc('month', test.today())::date then 'purchase.correct=7,purchase.reverse=2'
       else 'purchase.correct=6,purchase.reverse=2' end,
  'each correction and reversal is on the audit trail');
select test.eq(pg_temp.recon(), 'documents=0,grni=0,inventory=0',
  'the stock, 2050 and the records all still tie');
