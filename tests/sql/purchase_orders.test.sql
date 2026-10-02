-- =============================================================================
-- Purchasing (0044, release S): purchase orders, drafted by the buyer and
-- approved within the approver's limit, sent, received against (in part, more
-- than ordered once confirmed, an item not on the order), closed or cancelled;
-- returns to the supplier, before the bill (off what it clears) and after (a
-- credit set against it); the supplier's credit notes, for a price and for a
-- service, the note for a return, credits set against bills; the statement,
-- the report and the books.
-- Golden beans: 1,000 g at 10; cups: 100 at 50; water: 24 at 250.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;
create function pg_temp.sup(p_name text) returns uuid language sql security definer as $$
  select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' and name = p_name
$$;
-- Kurdistan Coffee Imports sells the beans and cups; City Packaging Supplies the water.
create function pg_temp.kci() returns uuid language sql as $$ select pg_temp.sup('Kurdistan Coffee Imports') $$;
create function pg_temp.city() returns uuid language sql as $$ select pg_temp.sup('City Packaging Supplies') $$;
create function pg_temp.beans() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-000000000001'::uuid $$;
create function pg_temp.cups() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-000000000002'::uuid $$;
create function pg_temp.water() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-000000000003'::uuid $$;
create function pg_temp.line(p_item uuid, p_qty numeric, p_unit text, p_price numeric) returns jsonb language sql as $$
  select jsonb_build_object('item_id', p_item, 'qty', p_qty, 'unit_code', p_unit, 'unit_price', p_price)
$$;
-- The tests' own view of the records, whoever they act as.
create function pg_temp.po(p_no bigint) returns jsonb language sql security definer as $$
  select po_view(id) from purchase_order where business_id = '00000000-0000-0000-0000-0000000000b1' and po_no = p_no
$$;
create function pg_temp.po_id(p_no bigint) returns uuid language sql security definer as $$
  select id from purchase_order where business_id = '00000000-0000-0000-0000-0000000000b1' and po_no = p_no
$$;
create function pg_temp.po_line(p_no bigint, p_item uuid) returns uuid language sql security definer as $$
  select l.id from purchase_order_line l join purchase_order o on o.id = l.purchase_order_id
   where o.business_id = '00000000-0000-0000-0000-0000000000b1' and o.po_no = p_no and l.item_id = p_item
$$;
create function pg_temp.came(p_no bigint) returns text language sql security definer as $$
  select string_agg((e ->> 'item') || ' ' || (e ->> 'received_base') || '/' || (e ->> 'base_qty'), ', '
                    order by (e ->> 'line_no')::int)
    from jsonb_array_elements(pg_temp.po(p_no) -> 'lines') e
$$;
create function pg_temp.on_hand(p_item uuid) returns text language sql security definer as $$
  select trim_scale(p.qty) || ' at ' || trim_scale(p.value)
    from item_position('00000000-0000-0000-0000-0000000000b1', p_item,
                       default_location('00000000-0000-0000-0000-0000000000b1')) p
$$;
create function pg_temp.bill(p_no text) returns text language sql security definer as $$
  select trim_scale(amount_total) || ' paid ' || trim_scale(paid_amount) || case when is_paid then ' (paid)' else '' end
    from purchase_invoice where business_id = '00000000-0000-0000-0000-0000000000b1' and invoice_no = p_no
$$;
create function pg_temp.bill_id(p_no text) returns uuid language sql security definer as $$
  select id from purchase_invoice where business_id = '00000000-0000-0000-0000-0000000000b1' and invoice_no = p_no
$$;
create function pg_temp.delivery_lines(p_receipt uuid) returns jsonb language sql security definer as $$
  select receipt_state(p_receipt) -> 'lines'
$$;
create function pg_temp.grni(p_receipt uuid) returns numeric language sql security definer as $$
  select receipt_grni_value(p_receipt)
$$;
create function pg_temp.audits(p_action text) returns int language sql security definer as $$
  select count(*)::int from audit_log where action = p_action
$$;
-- What the trail's last entry of an action changed: each key whose value
-- differs, before > after (an order's lines by name only).
create function pg_temp.changed(p_action text) returns text language sql security definer as $$
  select string_agg(k || case when k = 'order_lines' then ''
                              else ' ' || coalesce(a.before_state ->> k, '-') || '>' || coalesce(a.after_state ->> k, '-') end,
                    ', ' order by k)
    from (select before_state, after_state from audit_log where action = p_action order by id desc limit 1) a
    cross join lateral jsonb_object_keys(a.after_state) k
   where (a.before_state -> k) is distinct from (a.after_state -> k)
$$;
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today()) where difference <> 0
$$;

-- A buyer: purchasing, who drafts orders and receives, and approves nothing.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000e1', 'buyer@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Demo Buyer', 'buyer@example.com', 'a0000000-0000-0000-0000-0000000000e1');
insert into user_role (app_user_id, role) select id, 'purchasing' from app_user where email = 'buyer@example.com';

select test.eq(pg_temp.checks(), null, 'the books tie before any purchasing');

-- ------------------------------------------------------------ an order drafted
select test.act_as('cashier@example.com');
select test.throws(format('select save_po(null, %L, %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 5, 'kg', 9000))),
  '%purchase.create%', 'a cashier drafts no order');

select test.act_as('buyer@example.com');
insert into res select 'po1', save_po(null, pg_temp.kci(),
  jsonb_build_array(pg_temp.line(pg_temp.beans(), 5, 'kg', 9000), pg_temp.line(pg_temp.cups(), 2, 'sleeve_50', 2000)),
  test.today() + 3, 'For the week', null, gen_random_uuid());
select test.eq((select (v ->> 'po_no') || ' ' || (v ->> 'status') || ' ' || (v ->> 'total') from res where k = 'po1'),
  '1 draft 49000', 'the buyer drafts order 1: 5 kg of beans at 9,000 and 2 sleeves of cups at 2,000');
select test.eq(pg_temp.came(1), 'Golden beans 0/5000, Golden cup 0/100',
  'its lines, each in the item''s base unit: 5,000 g and 100 cups');
select test.eq(pg_temp.po(1) ->> 'receiving', 'none', 'nothing has come yet');

select test.throws(format('select save_po(null, %L, %L)', pg_temp.kci(), '[]'), '%at least one line%',
  'an order with no lines is refused');
select test.throws(format('select save_po(null, %L, %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 1, 'kg', 9000),
                                            pg_temp.line(pg_temp.beans(), 2, 'kg', 9000))),
  '%on the order twice%', 'an item twice on one order is refused');
select test.throws(format('select save_po(null, %L, %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 1, 'box', 9000))),
  '%Unit "box" is not defined%', 'a unit the item is not bought in is refused');
select test.throws(format('select save_po(null, %L, %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 0, 'kg', 9000))),
  '%needs a quantity%', 'a line needs a quantity');
select test.throws(format('select save_po(null, %L, %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 1, 'kg', -1))),
  '%needs a price%', 'and a price');

-- The buyer changes the draft: 6 kg.
insert into res select 'po1b', save_po(pg_temp.id('po1', 'po_id'), pg_temp.kci(),
  jsonb_build_array(pg_temp.line(pg_temp.beans(), 6, 'kg', 9000), pg_temp.line(pg_temp.cups(), 2, 'sleeve_50', 2000)),
  test.today() + 3, 'For the week');
select test.eq((select (v ->> 'po_no') || ' ' || (v ->> 'status') || ' ' || (v ->> 'total') from res where k = 'po1b'),
  '1 draft 58000', 'a draft changes, and keeps its number');
select test.eq(pg_temp.came(1), 'Golden beans 0/6000, Golden cup 0/100', 'its lines replaced');
select test.eq(pg_temp.changed('purchase.order.change'), 'order_lines, total 49000>58000',
  'the trail keeps what the change changed: the lines and the total');
select test.throws(format('select approve_po(%L)', pg_temp.po_id(1)), '%purchase.approve%',
  'the buyer approves no order');

-- ------------------------------------------------------------ approved, within the approver's limit
select test.act_as('manager@example.com');
insert into res select 'ap1', approve_po(pg_temp.po_id(1));
select test.eq(pg_temp.po(1) ->> 'status', 'approved', 'the branch manager approves order 1 (58,000)');
select test.eq(pg_temp.po(1) ->> 'approved_by', 'Demo Manager', 'and is named on it');
select test.throws(format('select approve_po(%L)', pg_temp.po_id(1)), '%not a draft%',
  'an approved order is not approved again');

-- Changed after its approval, it is a draft again.
select test.act_as('buyer@example.com');
insert into res select 'po1c', save_po(pg_temp.po_id(1), pg_temp.kci(),
  jsonb_build_array(pg_temp.line(pg_temp.beans(), 6, 'kg', 9000), pg_temp.line(pg_temp.cups(), 2, 'sleeve_50', 2000)),
  test.today() + 3, 'For the week, confirmed');
select test.eq(pg_temp.po(1) ->> 'status' || ' ' || coalesce(pg_temp.po(1) ->> 'approved_by', '-'), 'draft -',
  'an approved order changed is a draft again, its approval gone');
select test.eq(pg_temp.changed('purchase.order.change'), 'note For the week>For the week, confirmed, status approved>draft',
  'and the trail says so: the note changed, and approved became a draft');
select test.act_as('manager@example.com');
select approve_po(pg_temp.po_id(1));

-- A bigger order: over the branch manager's 250,000.
select test.act_as('buyer@example.com');
insert into res select 'po2', save_po(null, pg_temp.kci(),
  jsonb_build_array(pg_temp.line(pg_temp.beans(), 30, 'kg', 9000)));
select test.act_as('manager@example.com');
select test.throws(format('select approve_po(%L)', pg_temp.po_id(2)),
  'You approve orders up to 250000; order 2 comes to 270000%', 'the branch manager does not approve 270,000');
select test.act_as('owner@example.com');
select approve_po(pg_temp.po_id(2));
select test.eq(pg_temp.po(2) ->> 'approved_by', 'Demo Owner', 'the owner does');

-- The limit is a rule on Settings, by role.
select test.act_as('buyer@example.com');
insert into res select 'po3', save_po(null, pg_temp.kci(),
  jsonb_build_array(pg_temp.line(pg_temp.beans(), 30, 'kg', 9000)));
select test.act_as('owner@example.com');
select set_business_rule('po_approve_up_to', 'role', 'branch_manager', '300000', 'Branch orders are bigger now');
select test.act_as('manager@example.com');
select approve_po(pg_temp.po_id(3));
select test.eq(pg_temp.po(3) ->> 'status', 'approved', 'with the rule raised to 300,000, the branch manager approves it');
select test.eq((select (purchase_orders() ->> 'approve_up_to')::numeric), 300000::numeric,
  'and the orders list says up to what they approve');

-- ------------------------------------------------------------ sent
select test.act_as('buyer@example.com');
insert into res select 'po4', save_po(null, pg_temp.city(), jsonb_build_array(pg_temp.line(pg_temp.water(), 24, 'each', 250)));
select test.throws(format('select send_po(%L)', pg_temp.po_id(4)), '%not approved yet%', 'a draft is not sent');
select send_po(pg_temp.po_id(1));
select test.eq(pg_temp.po(1) ->> 'status', 'sent', 'the buyer sends order 1 to the supplier');
select test.throws(format('select send_po(%L)', pg_temp.po_id(1)), '%not waiting to be sent%', 'once');
select test.throws(format('select save_po(%L, %L, %L)', pg_temp.po_id(1), pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 1, 'kg', 9000))),
  '%has been sent%', 'an order sent is not changed');
select test.as_admin();
select test.throws(format('insert into purchase_order_line (purchase_order_id, item_id, order_qty, order_unit_code, unit_price, line_no, base_qty) values (%L, %L, 1, %L, 1, 9, 1)',
                          pg_temp.po_id(1), pg_temp.water(), 'each'),
  '%only while it is a draft%', 'nor are its lines, even written directly');

-- ------------------------------------------------------------ cancelled
select test.act_as('buyer@example.com');
select test.throws(format('select cancel_po(%L, %L)', pg_temp.po_id(4), ''), '%Say why%', 'a cancellation says why');
select cancel_po(pg_temp.po_id(4), 'Ordered by the branch instead');
select test.eq(pg_temp.po(4) ->> 'status' || ': ' || (pg_temp.po(4) ->> 'cancel_reason'),
  'cancelled: Ordered by the branch instead', 'a draft is cancelled, with its reason');
select test.throws(format('select cancel_po(%L, %L)', pg_temp.po_id(4), 'again'), '%is not open%', 'once');

-- ------------------------------------------------------------ received against order 1
select test.throws(format('select receive_goods(%L, %L, p_purchase_order => %L)', pg_temp.city(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 1, 'kg', 9000)), pg_temp.po_id(1)),
  'Order 1 is from Kurdistan Coffee Imports%', 'an order is received from its own supplier');
select test.throws(format('select receive_goods(%L, %L, p_purchase_order => %L)', pg_temp.city(),
                          jsonb_build_array(pg_temp.line(pg_temp.water(), 1, 'each', 250)), pg_temp.po_id(4)),
  'Order 4 was cancelled%', 'nothing is received against a cancelled order');

-- In part: 4 kg of the 6, and all the cups.
insert into res select 'r1', receive_goods(pg_temp.kci(),
  jsonb_build_array(pg_temp.line(pg_temp.beans(), 4, 'kg', 9000) || jsonb_build_object('po_line_id', pg_temp.po_line(1, pg_temp.beans())),
                    pg_temp.line(pg_temp.cups(), 2, 'sleeve_50', 2000)),
  p_purchase_order => pg_temp.po_id(1), p_idempotency_key => gen_random_uuid());
select test.eq((select (v ->> 'po_no') || ' ' || (v ->> 'po_receiving') || ' ' || (v ->> 'value') from res where k = 'r1'),
  '1 part 40000', 'delivery 1 is against order 1, in part: 36,000 of beans and 4,000 of cups');
select test.eq(pg_temp.came(1), 'Golden beans 4000/6000, Golden cup 100/100', 'order 1 shows what has come of each line');
select test.eq((select count(*) from goods_receipt_line gl join goods_receipt g on g.id = gl.goods_receipt_id
                 where g.id = pg_temp.id('r1', 'receipt_id') and gl.purchase_order_line_id is not null)::int, 2,
  'each line of the delivery names its line on the order');

-- More than is still on order is asked about, then confirmed; water was not ordered.
select test.throws(format('select receive_goods(%L, %L, p_purchase_order => %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 3, 'kg', 9000)), pg_temp.po_id(1)),
  'Check the quantity: Golden beans: 6000 g ordered, 7000 with this delivery. If it is right, confirm it and receive again',
  'more than was ordered is asked about');
insert into res select 'r2', receive_goods(pg_temp.kci(),
  jsonb_build_array(pg_temp.line(pg_temp.beans(), 3, 'kg', 9000), pg_temp.line(pg_temp.water(), 6, 'each', 250)),
  p_confirm => true, p_purchase_order => pg_temp.po_id(1));
select test.eq(pg_temp.po(1) ->> 'receiving', 'all', 'confirmed, order 1 has all come');
select test.eq(pg_temp.came(1), 'Golden beans 7000/6000, Golden cup 100/100', 'a kilogram more than was ordered');
select test.eq((select string_agg((e ->> 'item') || ' ' || (e ->> 'base_qty'), ', ') from jsonb_array_elements(pg_temp.po(1) -> 'unexpected') e),
  'Golden water 6', 'the water came against the order, though not on it');
select test.eq(pg_temp.audits('purchase.quantity_confirmed'), 1,
  'the confirmation is on the audit trail');

-- A price and a quantity asked about together.
select test.throws(format('select receive_goods(%L, %L, p_purchase_order => %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 31, 'kg', 30000)), pg_temp.po_id(2)),
  'Check the price and the quantity:%', 'a price far off and more than ordered are asked about together');

-- Closed: all come, no reason needed; short, a reason.
select close_po(pg_temp.po_id(1));
select test.eq(pg_temp.po(1) ->> 'status', 'closed', 'order 1 is closed');
select test.throws(format('select receive_goods(%L, %L, p_purchase_order => %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 1, 'kg', 9000)), pg_temp.po_id(1)),
  'Order 1 is closed%', 'nothing more is received against it');
select test.throws(format('select close_po(%L)', pg_temp.po_id(3)), '%Nothing has come against order 3: cancel it instead%',
  'an order nothing came against is cancelled, not closed');
select send_po(pg_temp.po_id(2));
insert into res select 'r3', receive_goods(pg_temp.kci(), jsonb_build_array(pg_temp.line(pg_temp.beans(), 10, 'kg', 9000)),
  p_purchase_order => pg_temp.po_id(2));
select test.throws(format('select close_po(%L)', pg_temp.po_id(2)), '%has not all come: say why%',
  'an order closed short says why');
select test.throws(format('select cancel_po(%L, %L)', pg_temp.po_id(2), 'too late'), '%close it instead%',
  'an order goods came against is not cancelled');
select close_po(pg_temp.po_id(2), 'The supplier has no more this month');
select test.eq(pg_temp.po(2) ->> 'status' || ' ' || (pg_temp.po(2) ->> 'receiving'), 'closed part',
  'order 2 is closed short, with its reason');

-- A delivery against an order keeps the order's supplier.
select test.act_as('manager@example.com');
select test.throws(format('select correct_receipt(%L, %L, %L, null, %L)', pg_temp.id('r3', 'receipt_id'),
                          pg_temp.delivery_lines(pg_temp.id('r3', 'receipt_id')), pg_temp.city(), 'wrong supplier'),
  '%came against order 2: its supplier is the order''s%', 'a delivery against an order keeps its supplier');

select test.eq(pg_temp.checks(), null, 'the books tie after the orders and their deliveries');

-- ------------------------------------------------------------ returns before the bill
-- Beans now: 1,000 at 10, and 4,000 + 3,000 + 10,000 at 9: 18,000 g at 163,000.
select test.eq(pg_temp.on_hand(pg_temp.beans()), '18000 at 163000', 'the beans on hand');
select test.act_as('buyer@example.com');
select test.throws(format('select return_to_supplier(%L, %L, %L, %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 1, 'kg', null)), '', pg_temp.id('r1', 'receipt_id')),
  '%Say why%', 'a return says why');
insert into res select 'x1', return_to_supplier(pg_temp.kci(), jsonb_build_array(pg_temp.line(pg_temp.beans(), 1, 'kg', null)),
  'Damp sacks', pg_temp.id('r1', 'receipt_id'), null, false, gen_random_uuid());
select test.eq((select (v ->> 'return_no') || ' ' || (v ->> 'against') || ' ' || (v ->> 'value') || ' ' || (v ->> 'stock_value')
                  from res where k = 'x1'),
  '1 delivery 9000 9056', 'return 1: a kilogram of delivery 1''s beans, 9,000 owed back; the stock leaves at its cost now');
select test.eq(test.lines_of(pg_temp.id('x1', 'return_id')), '1200 Cr 9056 | 2050 Dr 9000 | 5050 Dr 56',
  'before the bill: off what the bill will clear (2050); the difference is a price variance');
select test.eq(pg_temp.grni(pg_temp.id('r1', 'receipt_id')), 31000::numeric,
  'delivery 1''s bill now clears 31,000, what was kept');
select test.eq(pg_temp.on_hand(pg_temp.beans()), '17000 at 153944', 'the beans leave the stock');

select test.throws(format('select return_to_supplier(%L, %L, %L, %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 4, 'kg', null)), 'more', pg_temp.id('r1', 'receipt_id')),
  'Only 3000 g of Golden beans from delivery 1 is left to return', 'no more than came, less what went back');
select test.throws(format('select return_to_supplier(%L, %L, %L, %L)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line(pg_temp.water(), 1, 'each', null)), 'water', pg_temp.id('r1', 'receipt_id')),
  'Golden water did not come in delivery 1', 'nor what did not come in it');
select test.throws(format('select return_to_supplier(%L, %L, %L, %L)', pg_temp.city(),
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 1, 'kg', null)), 'x', pg_temp.id('r1', 'receipt_id')),
  '%came from another supplier%', 'a delivery goes back to its own supplier');

-- A delivery some of which went back is no longer corrected.
select test.act_as('manager@example.com');
select test.throws(format('select reverse_receipt(%L, %L)', pg_temp.id('r1', 'receipt_id'), 'undo'),
  '%have gone back to the supplier: it is no longer corrected%', 'a delivery with a return is not reversed');

-- All of a delivery back before its bill: nothing to bill.
select test.act_as('buyer@example.com');
insert into res select 'r4', receive_goods(pg_temp.kci(), jsonb_build_array(pg_temp.line(pg_temp.cups(), 1, 'sleeve_50', 2000)));
insert into res select 'x2', return_to_supplier(pg_temp.kci(), jsonb_build_array(pg_temp.line(pg_temp.cups(), 50, 'each', null)),
  'Wrong size', pg_temp.id('r4', 'receipt_id'));
select test.eq(pg_temp.grni(pg_temp.id('r4', 'receipt_id')), 0::numeric, 'delivery 4 went all back');
select test.throws(format('select record_bill(%L, %L, %L, 2000, 0, %L)', pg_temp.kci(), 'KCI-4', test.today(),
                          pg_temp.id('r4', 'receipt_id')),
  'Everything delivery 4 brought went back to the supplier: there is nothing to bill', 'so there is nothing to bill');

-- ------------------------------------------------------------ the bill, then returns after it
insert into res select 'b1', record_bill(pg_temp.kci(), 'KCI-1', test.today(), 31000, 30, pg_temp.id('r1', 'receipt_id'));
select test.eq(test.lines_of(pg_temp.id('b1', 'bill_id')), '2000 Cr 31000 | 2050 Dr 31000',
  'delivery 1 is billed for what was kept');
insert into res select 'x3', return_to_supplier(pg_temp.kci(), jsonb_build_array(pg_temp.line(pg_temp.cups(), 10, 'each', null)),
  'Cracked', pg_temp.id('r1', 'receipt_id'));
select test.eq((select (v ->> 'against') || ' ' || (v ->> 'value') || ' ' || (v ->> 'stock_value') || ' credit '
                       || (v ->> 'credit_no') || ' set against ' || (v ->> 'set_against_bill') from res where k = 'x3'),
  'account 400 440 credit 1 set against 400',
  'after the bill: owed back on the account, as credit 1, set against the delivery''s bill');
select test.eq(test.lines_of(pg_temp.id('x3', 'return_id')), '1200 Cr 440 | 2000 Dr 400 | 5050 Dr 40',
  'the payable comes down by what the supplier charged');
select test.eq(pg_temp.bill('KCI-1'), '31000 paid 400', 'the bill counts the credit as paid');
select test.eq((select supplier_ref is null and matched_at is null from supplier_credit where credit_no = 1), true,
  'the credit waits for the supplier''s note');

-- With no delivery named: at the cost now, owed back on the account.
insert into res select 'x4', return_to_supplier(pg_temp.city(), jsonb_build_array(pg_temp.line(pg_temp.water(), 4, 'each', null)),
  'Expired');
select test.eq((select (v ->> 'against') || ' ' || (v ->> 'value') || ' ' || (v ->> 'stock_value') || ' credit ' || (v ->> 'credit_no')
                  from res where k = 'x4'),
  'account 1000 1000 credit 2', 'water returned with no delivery: 1,000 at its cost, credit 2');
select test.throws(format('select return_to_supplier(%L, %L, %L)', pg_temp.city(),
                          jsonb_build_array(pg_temp.line(pg_temp.water(), 100, 'each', null)), 'all of it'),
  'This leaves Golden water (-74 each) below zero: confirm to return it all the same', 'below zero is asked about');

select test.eq(pg_temp.checks(), null, 'the books tie after the returns');

-- ------------------------------------------------------------ the supplier's credit notes
select test.throws(format('select record_supplier_credit(%L, %L, 3000, %L, %L, p_receipt => %L)', pg_temp.kci(), 'price',
                          'CN-7', 'Price agreed down', pg_temp.id('r2', 'receipt_id')),
  'Delivery 2 is not billed yet: correct its price on Purchasing instead', 'a price not yet billed is corrected instead');
select test.throws(format('select record_supplier_credit(%L, %L, 40000, %L, %L, p_receipt => %L)', pg_temp.kci(), 'price',
                          'CN-7', 'Price agreed down', pg_temp.id('r1', 'receipt_id')),
  'That is more than delivery 1 is still worth (30600)', 'a credit is no more than the delivery is still worth');
insert into res select 'c3', record_supplier_credit(pg_temp.kci(), 'price', 3000, 'CN-7', 'Price agreed down',
  p_receipt => pg_temp.id('r1', 'receipt_id'), p_idempotency_key => gen_random_uuid());
select test.eq((select (v ->> 'credit_no') || ' ' || (v ->> 'amount') || ' stock ' || (v ->> 'stock') || ' set against '
                       || (v ->> 'set_against_bill') from res where k = 'c3'),
  '3 3000 stock -3000 set against 3000', 'credit note CN-7: 3,000 off delivery 1, the stock of it still on hand revalued');
select test.eq(test.lines_of(pg_temp.id('c3', 'credit_id')), '1200 Cr 3000 | 2000 Dr 3000',
  'none of it was used: what went back to the supplier, of this delivery or another, is not a use, so all of it comes off the stock');
select test.eq(pg_temp.bill('KCI-1'), '31000 paid 3400', 'and it is set against the delivery''s bill');
select test.throws(format('select record_supplier_credit(%L, %L, 100, %L, %L, p_receipt => %L)', pg_temp.kci(), 'price',
                          'cn-7', 'again', pg_temp.id('r1', 'receipt_id')),
  'Credit note cn-7 from this supplier is already recorded', 'a supplier''s note is recorded once');

-- A service bill, and its supplier's credit.
insert into res select 'b2', record_bill(pg_temp.city(), 'CITY-9', test.today(), 50000, 0, null, '6200');
insert into res select 'c4', record_supplier_credit(pg_temp.city(), 'other', 5000, 'CR-1', 'Overcharged for the month',
  p_bill => pg_temp.id('b2', 'bill_id'));
select test.eq(test.lines_of(pg_temp.id('c4', 'credit_id')), '2000 Dr 5000 | 6200 Cr 5000',
  'a credit for a service bill comes off the bill''s own account');
select test.eq(pg_temp.bill('CITY-9'), '50000 paid 5000', 'and is set against it');
select test.throws(format('select record_supplier_credit(%L, %L, 100, %L, %L, p_account_code => %L)', pg_temp.city(),
                          'other', 'CR-2', 'x', '1005'),
  'Account 1005 cannot take a supplier''s credit', 'no credit is taken off cash');
select test.throws(format('select record_supplier_credit(%L, %L, 100, %L, %L)', pg_temp.city(), 'goods_return', 'CR-2', 'x'),
  '%A return makes its own credit%', 'a return''s credit is made by the return');

-- The supplier's note for return 3's credit.
select note_supplier_credit((select id from supplier_credit where credit_no = 1), 'CN-9');
select test.eq((select supplier_ref || ' ' || (matched_at is not null)::text from supplier_credit where credit_no = 1),
  'CN-9 true', 'the supplier''s note is matched to the return''s credit, posting nothing');
select test.throws(format('select note_supplier_credit(%L, %L)', (select id from supplier_credit where credit_no = 1), 'CN-10'),
  '%already has the supplier''s note CN-9%', 'once');
select test.as_admin();
select test.throws(format('update supplier_credit set amount = 1 where credit_no = 1'), '%does not change%',
  'a credit is never changed, even directly');

-- ------------------------------------------------------------ credits set against bills
select test.act_as('buyer@example.com');
select test.throws(format('select allocate_credit(%L, %L, 100)', (select id from supplier_credit where credit_no = 2),
                          pg_temp.bill_id('CITY-9')),
  '%accounting.post%', 'setting a credit against a bill is for those who pay bills');
select test.act_as('owner@example.com');
select allocate_credit((select id from supplier_credit where credit_no = 2), pg_temp.bill_id('CITY-9'), 600);
select test.eq(pg_temp.bill('CITY-9'), '50000 paid 5600', 'credit 2 set against the service bill, 600 of it');
select test.throws(format('select allocate_credit(%L, %L, 500)', (select id from supplier_credit where credit_no = 2),
                          pg_temp.bill_id('CITY-9')),
  'That is more than the 400 left of credit 2', 'never more than is left of the credit');
select test.throws(format('select allocate_credit(%L, %L, 100)', (select id from supplier_credit where credit_no = 2),
                          pg_temp.bill_id('KCI-1')),
  '%another supplier%', 'nor against another supplier''s bill');
select test.throws(format('select pay_bill(%L, 27601, %L)', pg_temp.bill_id('KCI-1'), 'bank'),
  '%more than the 27600 outstanding%', 'the credits come off what is owed on the bill');
select pay_bill(pg_temp.bill_id('KCI-1'), 27600, 'bank');
select test.eq(pg_temp.bill('KCI-1'), '31000 paid 31000 (paid)', 'the bill is paid: 27,600 paid and 3,400 of credits');
select test.throws(format('select cancel_bill(%L, %L)', pg_temp.bill_id('CITY-9'), 'wrong'),
  'This bill has credits set against it, so it cannot be cancelled', 'a bill with credits set against it is not cancelled');

-- ------------------------------------------------------------ the statement, the report, the books
select test.eq((select string_agg((e ->> 'kind') || ' ' || coalesce(e ->> 'ref', '') || ' ' || (e ->> 'charge') || '/'
                                  || (e ->> 'credit') || ' = ' || (e ->> 'balance'), ' | ')
                  from jsonb_array_elements(supplier_statement(pg_temp.kci(), test.today(), test.today()) -> 'lines') e),
  'bill KCI-1 31000/0 = 31000 | payment  0/27600 = 3400 | credit CN-9 0/400 = 3000 | credit CN-7 0/3000 = 0',
  'the coffee supplier''s statement: the bill, the payment and the two credits, owing nothing');
select test.eq((select (s ->> 'opening') || ' ' || (s ->> 'closing') || ' ' || jsonb_array_length(s -> 'open_bills')
                       || ' ' || jsonb_array_length(s -> 'open_credits')
                  from supplier_statement(pg_temp.city(), test.today(), test.today()) s),
  '0 44000 1 1', 'the packaging supplier: 50,000 billed, 6,000 credited; one bill owed, one credit with some left');
select test.eq((select (b ->> 'outstanding') || ' ' || (c ->> 'left')
                  from supplier_statement(pg_temp.city(), test.today(), test.today()) s,
                       jsonb_array_elements(s -> 'open_bills') b, jsonb_array_elements(s -> 'open_credits') c),
  '44400 400', 'its bill owes 44,400, less the 400 left of credit 2: 44,000');
select test.throws(format('select supplier_statement(%L, %L, %L)', pg_temp.kci(), test.today(), test.today() - 1),
  '%first before the last%', 'a statement''s dates in order');

select test.eq((select string_agg((o ->> 'po_no') || ' ' || (o ->> 'status') || ' ' || (o ->> 'receiving') || ' '
                                  || (o ->> 'ordered') || '/' || (o ->> 'received'), ', ' order by (o ->> 'po_no')::int)
                  from jsonb_array_elements(report_purchasing(test.today(), test.today()) -> 'orders') o),
  '1 closed all 58000/68500, 2 closed part 270000/90000, 3 approved none 270000/0, 4 cancelled none 6000/0',
  'Reports → Purchasing: each order, ordered against received');
select test.eq((select jsonb_array_length(x -> 'returns') || ' ' || jsonb_array_length(x -> 'credits') || ' '
                       || (x -> 'totals' ->> 'returned') || ' ' || (x -> 'totals' ->> 'credited') || ' '
                       || (x -> 'totals' ->> 'credits_left')
                  from report_purchasing(test.today(), test.today()) x),
  '4 4 12400 9400 400', 'its returns and credits');

select test.eq(pg_temp.checks(), null, 'the books tie: stock, goods received, payables with the credits, every journal');
select test.as_admin();
select test.eq((select count(*) from document_problems('00000000-0000-0000-0000-0000000000b1', 'infinity'))::int, 0,
  'every return and credit has its journal');

-- ------------------------------------------------------------ who may read what; retries
select test.act_as('cashier@example.com');
select test.throws('select purchase_orders()', '%cost.view%', 'a cashier sees no orders');
select test.eq((select count(*) from supplier_return)::int + (select count(*) from supplier_credit)::int, 0,
  'nor returns or credits');
select test.act_as('buyer@example.com');
select test.eq(jsonb_array_length(purchase_orders() -> 'orders'), 4, 'the buyer sees the four orders');
select test.eq((purchase_orders() -> 'approve_up_to'), 'null'::jsonb, 'and approves none');
create temp table k1 as select gen_random_uuid() as k;
grant select on k1 to public;
select save_po(null, pg_temp.city(), jsonb_build_array(pg_temp.line(pg_temp.water(), 12, 'each', 250)), p_idempotency_key => (select k from k1));
select save_po(null, pg_temp.city(), jsonb_build_array(pg_temp.line(pg_temp.water(), 12, 'each', 250)), p_idempotency_key => (select k from k1));
select test.eq(jsonb_array_length(purchase_orders() -> 'orders'), 5, 'an order sent twice with its key is made once');
