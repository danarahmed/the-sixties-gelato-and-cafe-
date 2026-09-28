-- =============================================================================
-- The buying list (0045, release T): what to buy for the branch, item by item,
-- from what is on hand, on order and in draft orders, the use a day over the
-- last 28 days and the days a delivery takes; its reorder level (the item's
-- own, or worked out from its use) and the level it is ordered up to; the
-- quantity in whole packs; the supplier (the usual one, else the last
-- delivery's, else the one it was set with) and a pack's price. Not enough
-- history, not used, no supplier. Draft orders made from it, one for each
-- supplier; an item's suppliers set and removed; permissions and keys.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.sup(p_name text) returns uuid language sql security definer as $$
  select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' and name = p_name
$$;
create function pg_temp.dairy() returns uuid language sql as $$ select pg_temp.sup('Sulaymaniyah Dairy Co.') $$;
create function pg_temp.kci() returns uuid language sql as $$ select pg_temp.sup('Kurdistan Coffee Imports') $$;
create function pg_temp.city() returns uuid language sql as $$ select pg_temp.sup('City Packaging Supplies') $$;
create function pg_temp.beans() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-000000000001'::uuid $$;
create function pg_temp.cups() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-000000000002'::uuid $$;
create function pg_temp.milk() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-0000000000b1'::uuid $$;
create function pg_temp.straws() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-0000000000b2'::uuid $$;
create function pg_temp.sugar() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-0000000000b3'::uuid $$;
create function pg_temp.syrup() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-0000000000b4'::uuid $$;
create function pg_temp.loc() returns uuid language sql security definer as $$
  select default_location('00000000-0000-0000-0000-0000000000b1')
$$;
create function pg_temp.line(p_item uuid, p_qty numeric, p_unit text, p_price numeric) returns jsonb language sql as $$
  select jsonb_build_object('item_id', p_item, 'qty', p_qty, 'unit_code', p_unit, 'unit_price', p_price)
$$;
-- A line of the list as the reader sees it, and in one line of words.
create function pg_temp.row(p_item uuid) returns jsonb language sql as $$
  select e from jsonb_array_elements(buying_list() -> 'items') e where (e ->> 'item_id')::uuid = p_item
$$;
create function pg_temp.says(p_item uuid) returns text language sql as $$
  select concat_ws(' ', r ->> 'status',
                   'have ' || (r ->> 'on_hand') || '+' || (r ->> 'on_order') || '+' || (r ->> 'in_draft'),
                   'use ' || coalesce(r ->> 'daily_use', '-') || '/' || coalesce(r ->> 'days', '-') || 'd',
                   'lead ' || (r ->> 'lead_time') || ' ' || (r ->> 'lead_from'),
                   'reorder ' || coalesce(r ->> 'reorder_level', '-') || ' ' || coalesce(r ->> 'reorder_from', '-'),
                   'up to ' || coalesce(r ->> 'target_level', '-') || ' ' || coalesce(r ->> 'target_from', '-'),
                   'order ' || (r ->> 'packs') || ' ' || (r ->> 'pack_unit'),
                   'from ' || coalesce(r ->> 'supplier', '-') || ' ' || coalesce(r ->> 'supplier_from', '-'),
                   'at ' || coalesce(r ->> 'price', '-') || ' ' || coalesce(r ->> 'price_from', '-'))
    from (select pg_temp.row(p_item) r) x
$$;
create function pg_temp.choices(p_item uuid) returns text language sql as $$
  select string_agg((c ->> 'supplier') || ' ' || (c ->> 'pack_unit') || ' at ' || coalesce(c ->> 'price', '-') || ' '
                    || coalesce(c ->> 'price_from', '-') || case when (c ->> 'usual')::boolean then ' (usual)' else '' end,
                    ', ' order by n)
    from jsonb_array_elements(pg_temp.row(p_item) -> 'choices') with ordinality e(c, n)
$$;
-- The tests' own view of the records, whoever they act as.
create function pg_temp.po(p_no bigint) returns text language sql security definer as $$
  select o.status || ' ' || s.name || ' ' || trim_scale(o.total) || ' expected +' || (o.expected_on - test.today())
         || coalesce(' "' || o.note || '"', '') || ': '
         || (select string_agg(i.name || ' ' || trim_scale(l.order_qty) || ' ' || l.order_unit_code || ' at '
                               || trim_scale(l.unit_price), ', ' order by l.line_no)
               from purchase_order_line l join item i on i.id = l.item_id where l.purchase_order_id = o.id)
    from purchase_order o join supplier s on s.id = o.supplier_id
   where o.business_id = '00000000-0000-0000-0000-0000000000b1' and o.po_no = p_no
$$;
create function pg_temp.po_id(p_no bigint) returns uuid language sql security definer as $$
  select id from purchase_order where business_id = '00000000-0000-0000-0000-0000000000b1' and po_no = p_no
$$;
create function pg_temp.links(p_item uuid) returns text language sql security definer as $$
  select string_agg(s.name || ' ' || l.pack_unit_code || ' at ' || coalesce(trim_scale(l.last_price)::text, '-')
                    || case when l.preferred then ' (usual)' else '' end, ', ' order by s.name)
    from item_supplier l join supplier s on s.id = l.supplier_id where l.item_id = p_item
$$;
create function pg_temp.audits(p_action text) returns int language sql security definer as $$
  select count(*)::int from audit_log where action = p_action
$$;
create function pg_temp.noon(p_days_ago int) returns timestamptz language sql as $$
  select ((test.today() - p_days_ago)::timestamp + time '12:00') at time zone 'Asia/Baghdad'
$$;
create function pg_temp.moves(p_item uuid, p_type movement_type, p_qty numeric, p_cost numeric, p_days int[])
returns void language sql as $$
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason,
                                  occurred_at)
  select '00000000-0000-0000-0000-0000000000b1', p_item, pg_temp.loc(), p_type, p_qty, p_cost, abs(p_qty) * p_cost,
         'fixture', pg_temp.noon(d) - case when p_type = 'opening_balance' then interval '3 hours' else interval '0' end
    from unnest(p_days) d
$$;

-- A buyer: purchasing, who drafts orders and receives, and approves nothing.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000e1', 'buyer@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Demo Buyer', 'buyer@example.com', 'a0000000-0000-0000-0000-0000000000e1');
insert into user_role (app_user_id, role) select id, 'purchasing' from app_user where email = 'buyer@example.com';

-- Items with a history, dated day by day at noon (Baghdad).
insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock) values
  ('c0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'L-MILK', 'List milk', 'ingredient', 'ml', 'volume', false),
  ('c0000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1', 'L-STRAW', 'List straws', 'consumable', 'each', 'count', false),
  ('c0000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b1', 'L-SUGAR', 'List sugar', 'ingredient', 'g', 'mass', false),
  ('c0000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000b1', 'L-SYRUP', 'List syrup', 'ingredient', 'ml', 'volume', false);
insert into item_unit (item_id, code, label, dimension, factor_to_base) values
  ('c0000000-0000-0000-0000-0000000000b1', 'carton_1l', 'Carton of 1 L', 'volume', 1000),
  ('c0000000-0000-0000-0000-0000000000b2', 'box_100', 'Box of 100', 'count', 100);
-- Milk: 25,000 ml opened 25 days ago, 1,000 ml used each day since.
select pg_temp.moves(pg_temp.milk(), 'opening_balance', 25000, 1.5, '{25}');
select pg_temp.moves(pg_temp.milk(), 'sale_consumption', -1000, 1.5,
  '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25}');
-- Sugar: five days of history. Syrup: ten days, and none used.
select pg_temp.moves(pg_temp.sugar(), 'opening_balance', 3000, 1, '{5}');
select pg_temp.moves(pg_temp.sugar(), 'sale_consumption', -500, 1, '{1,2,3,4,5}');
select pg_temp.moves(pg_temp.syrup(), 'opening_balance', 2000, 2, '{10}');

-- ------------------------------------------------------------ who may read it
select test.act_as('cashier@example.com');
select test.throws('select buying_list()', '%cost.view%', 'a cashier sees no buying list');

-- ------------------------------------------------------------ the list
-- The dairy delivers in two days; milk comes today, two cartons at 1,500.
select test.act_as('manager@example.com');
select update_supplier(pg_temp.dairy(), 'Sulaymaniyah Dairy Co.', 'Sales', '+964-770-000-0001', true, 'two days', 2);
select test.act_as('buyer@example.com');
select receive_goods(pg_temp.dairy(), jsonb_build_array(pg_temp.line(pg_temp.milk(), 2, 'carton_1l', 1500)),
                     p_idempotency_key => gen_random_uuid());
select test.eq((buying_list() ->> 'location_id')::uuid, pg_temp.loc(), 'the buyer reads the list for the branch');
select test.eq((select buying_list() ->> 'window_days'), '28', 'use is judged over 28 days');
select test.eq(pg_temp.says(pg_temp.milk()),
  'order have 2000+0+0 use 1000/25d lead 2 supplier reorder 3000 use up to 10000 week order 8 carton_1l from Sulaymaniyah Dairy Co. last_delivery at 1500 delivery',
  'milk: 2,000 ml on hand, 1,000 a day for 25 days, the dairy two days away: at or under 3,000 (three days of use) it is ordered up to 10,000 (and a week), 8 cartons from the dairy at the last delivery''s price');
select test.eq((pg_temp.row(pg_temp.milk()) ->> 'history_days')::int, 25, 'its history is the 25 days since it was first there');
select test.eq((pg_temp.row(pg_temp.sugar()) ->> 'status') || ' ' || (pg_temp.row(pg_temp.sugar()) ->> 'history_days')
               || ' ' || (pg_temp.row(pg_temp.sugar()) ->> 'packs'),
  'no_history 5 0', 'sugar: five days of history is not enough to judge by, and nothing is suggested');
select test.eq((pg_temp.row(pg_temp.syrup()) ->> 'status') || ' ' || (pg_temp.row(pg_temp.syrup()) ->> 'daily_use'),
  'not_used 0', 'syrup: ten days and none used: nothing needed');
select test.eq(pg_temp.says(pg_temp.beans()),
  'no_history have 1000+0+0 use -/0d lead 1 cafe reorder - - up to - - order 0 g from - - at 10 cost',
  'beans, opened a minute ago: no history, no supplier, priced at what they cost now');
select test.eq((select count(*) from jsonb_array_elements(buying_list() -> 'items') e where e ->> 'item' = 'Pistachio gelato')::int,
  0, 'an item made here is made on Production, not bought');
select test.eq((select count(*) from jsonb_array_elements(buying_list() -> 'items') e
                 where e ->> 'item' in ('Golden beans', 'Golden cup', 'Golden water'))::int,
  3, 'every item in use that is bought is there');

-- A reorder level of the item's own, and no history: straws, never in stock.
select test.act_as('manager@example.com');
select update_item(pg_temp.straws(), 'List straws', 'consumable', p_min_level => 50, p_par_level => 200);
select update_item(pg_temp.beans(), 'Golden beans', 'ingredient', p_min_level => 2000);
select test.eq(pg_temp.says(pg_temp.straws()),
  'order have 0+0+0 use -/-d lead 1 cafe reorder 50 item up to 200 par order 200 each from - - at - -',
  'straws: under their own reorder level of 50, ordered up to their par level; no supplier yet, and no price');
select test.eq(pg_temp.says(pg_temp.beans()),
  'order have 1000+0+0 use -/0d lead 1 cafe reorder 2000 item up to 2000 reorder order 1000 g from - - at 10 cost',
  'beans under their reorder level of 2,000 and no par level: up to the reorder level, in grams until a pack is known');
select test.as_admin();
select test.eq((select string_agg(rule || ' ' || link, ', ' order by rule) from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where subject = pg_temp.straws()::text),
  'below_minimum /purchasing/buying-list', 'below its reorder level, an item bought leads to What to buy');
update item set min_level_base = 100 where business_id = '00000000-0000-0000-0000-0000000000b1' and sku = 'GEL_PIST';
select test.eq((select link from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'below_minimum'
                   and subject = (select id::text from item where business_id = '00000000-0000-0000-0000-0000000000b1'
                                                              and sku = 'GEL_PIST')),
  (select '/inventory/' || id from item where business_id = '00000000-0000-0000-0000-0000000000b1' and sku = 'GEL_PIST'),
  'one made here still leads to its stock card, where a batch is made from');

-- ------------------------------------------------------------ an item's suppliers
select test.act_as('cashier@example.com');
select test.throws(format('select set_item_supplier(%L, %L, %L, 9000, true)', pg_temp.beans(), pg_temp.kci(), 'kg'),
  '%purchase.create%', 'a cashier sets no supplier');
select test.act_as('buyer@example.com');
select test.throws(format('select set_item_supplier(%L, %L, %L, 9000, true)', pg_temp.beans(), pg_temp.kci(), 'box'),
  'Golden beans is not bought in box', 'a pack the item has not is refused');
select test.throws(format('select set_item_supplier(%L, %L, %L, 9000, true)', pg_temp.beans(), gen_random_uuid(), 'kg'),
  'Choose an active supplier', 'a supplier not the café''s is refused');
select test.throws(format('select set_item_supplier(%L, %L, %L, -1, true)', pg_temp.beans(), pg_temp.kci(), 'kg'),
  'A price is zero or more', 'a price below nothing is refused');
insert into res select 'set1', set_item_supplier(pg_temp.beans(), pg_temp.kci(), 'kg', 9000, true, gen_random_uuid());
select test.eq(pg_temp.links(pg_temp.beans()), 'Kurdistan Coffee Imports kg at 9000 (usual)',
  'the buyer sets beans: from Kurdistan Coffee Imports, by the kg at 9,000, the usual supplier');
select test.eq(pg_temp.says(pg_temp.beans()),
  'order have 1000+0+0 use -/0d lead 1 cafe reorder 2000 item up to 2000 reorder order 1 kg from Kurdistan Coffee Imports usual at 9000 agreed',
  'the list orders them by the kg, a whole one, from their usual supplier at the price agreed');
select set_item_supplier(pg_temp.straws(), pg_temp.city(), 'box_100', 5000, true, gen_random_uuid());
select test.eq(pg_temp.says(pg_temp.straws()),
  'order have 0+0+0 use -/-d lead 1 cafe reorder 50 item up to 200 par order 2 box_100 from City Packaging Supplies usual at 5000 agreed',
  'straws in boxes of 100: two boxes');
select test.act_as('manager@example.com');
select update_item(pg_temp.beans(), 'Golden beans', 'ingredient', p_min_level => 2000, p_par_level => 5000);
select test.eq(pg_temp.says(pg_temp.beans()),
  'order have 1000+0+0 use -/0d lead 1 cafe reorder 2000 item up to 5000 par order 4 kg from Kurdistan Coffee Imports usual at 9000 agreed',
  'with a par level of 5,000, beans are ordered up to it: 4 kg');
select test.as_admin();
select test.eq((select after_state || jsonb_build_object('before', before_state) from audit_log
                 where action = 'item.supplier.set' and entity_id = pg_temp.beans()::text),
  jsonb_build_object('supplier', pg_temp.kci(), 'pack_unit', 'kg', 'last_price', 9000, 'usual', true, 'before', null),
  'a supplier set for an item is on the audit trail, as the item''s');

-- ------------------------------------------------------------ what is on order counts
select test.act_as('buyer@example.com');
insert into res select 'po1', save_po(null, pg_temp.dairy(), jsonb_build_array(pg_temp.line(pg_temp.milk(), 3, 'carton_1l', 1500)),
                                      p_idempotency_key => gen_random_uuid());
select test.eq(pg_temp.says(pg_temp.milk()),
  'enough have 2000+0+3000 use 1000/25d lead 2 supplier reorder 3000 use up to 10000 week order 0 carton_1l from Sulaymaniyah Dairy Co. last_delivery at 1500 delivery',
  'a draft for 3 cartons: 5,000 with it, over the reorder level: enough');
select test.eq(pg_temp.row(pg_temp.milk()) -> 'orders' -> 0 ->> 'status', 'draft', 'the draft is named on the line');
select test.act_as('owner@example.com');
select approve_po(pg_temp.po_id(1), gen_random_uuid());
select test.act_as('buyer@example.com');
select receive_goods(pg_temp.dairy(), jsonb_build_array(pg_temp.line(pg_temp.milk(), 0.5, 'carton_1l', 1500)),
                     p_purchase_order => pg_temp.po_id(1), p_idempotency_key => gen_random_uuid());
select test.eq(pg_temp.says(pg_temp.milk()),
  'enough have 2500+2500+0 use 1000/25d lead 2 supplier reorder 3000 use up to 10000 week order 0 carton_1l from Sulaymaniyah Dairy Co. last_delivery at 1500 delivery',
  'approved, and half a carton of it come: 2,500 on hand and 2,500 still on order');
select test.eq((select (o ->> 'status') || ' ' || (o ->> 'base_qty') from jsonb_array_elements(pg_temp.row(pg_temp.milk()) -> 'orders') o),
  'approved 2500', 'the order is named with what it still waits for');
select test.act_as('owner@example.com');
select close_po(pg_temp.po_id(1), 'the rest is not coming', gen_random_uuid());
select test.act_as('buyer@example.com');
select test.eq(pg_temp.says(pg_temp.milk()),
  'order have 2500+0+0 use 1000/25d lead 2 supplier reorder 3000 use up to 10000 week order 8 carton_1l from Sulaymaniyah Dairy Co. last_delivery at 1500 delivery',
  'closed short, nothing more is coming: below the reorder level, 7,500 ml to order, 8 whole cartons');

-- ------------------------------------------------------------ the usual supplier comes first
select set_item_supplier(pg_temp.milk(), pg_temp.city(), 'carton_1l', 1400, true, gen_random_uuid());
select test.eq(pg_temp.choices(pg_temp.milk()),
  'City Packaging Supplies carton_1l at 1400 agreed (usual), Sulaymaniyah Dairy Co. carton_1l at 1500 delivery',
  'every supplier it can come from is there to choose, the usual one first, each at its own price');
select test.eq((pg_temp.row(pg_temp.milk()) ->> 'supplier') || ' ' || (pg_temp.row(pg_temp.milk()) ->> 'lead_from'),
  'City Packaging Supplies cafe', 'the usual supplier is the one suggested, with the café''s delivery days (it has none)');
select remove_item_supplier(pg_temp.milk(), pg_temp.city(), gen_random_uuid());
select test.eq((pg_temp.row(pg_temp.milk()) ->> 'supplier') || ' ' || (pg_temp.row(pg_temp.milk()) ->> 'supplier_from'),
  'Sulaymaniyah Dairy Co. last_delivery', 'removed: the last delivery''s supplier again');
select test.throws(format('select remove_item_supplier(%L, %L)', pg_temp.milk(), pg_temp.city()),
  'That supplier is not one the item is bought from', 'removed once');
select test.as_admin();
select test.eq(pg_temp.audits('item.supplier.remove'), 1, 'the removal is on the audit trail');

-- ------------------------------------------------------------ orders drafted from the list
select test.act_as('cashier@example.com');
select test.throws(format('select purchase_orders_from_list(%L)',
                          jsonb_build_array(pg_temp.line(pg_temp.milk(), 7, 'carton_1l', 1500)
                                            || jsonb_build_object('supplier_id', pg_temp.dairy()))),
  '%purchase.create%', 'a cashier drafts no orders');
select test.act_as('buyer@example.com');
select test.throws('select purchase_orders_from_list(''[]'')', 'Choose at least one item to order', 'nothing chosen');
select test.throws(format('select purchase_orders_from_list(%L)',
                          jsonb_build_array(pg_temp.line(pg_temp.straws(), 2, 'box_100', 5000))),
  'Choose a supplier for List straws', 'every line needs its supplier');
select test.throws(format('select purchase_orders_from_list(%L)',
                          jsonb_build_array(pg_temp.line(pg_temp.beans(), 4, 'kg', 9000) || jsonb_build_object('supplier_id', pg_temp.kci()),
                                            pg_temp.line(pg_temp.beans(), 1, 'kg', 9000) || jsonb_build_object('supplier_id', pg_temp.kci()))),
  '%on the order twice%', 'an item twice for one supplier is refused');
select test.as_admin();
select test.eq((select count(*) from purchase_order)::int, 1, 'and nothing was drafted');

select test.act_as('buyer@example.com');
insert into res values ('lines', jsonb_build_array(
  pg_temp.line(pg_temp.milk(), 7, 'carton_1l', 1500) || jsonb_build_object('supplier_id', pg_temp.dairy()),
  pg_temp.line(pg_temp.beans(), 4, 'kg', 9000) || jsonb_build_object('supplier_id', pg_temp.kci()),
  pg_temp.line(pg_temp.straws(), 2, 'box_100', 5000) || jsonb_build_object('supplier_id', pg_temp.city()),
  pg_temp.line(pg_temp.cups(), 1, 'sleeve_50', 2000) || jsonb_build_object('supplier_id', pg_temp.kci(), 'usual', true)));
insert into res values ('key', to_jsonb(gen_random_uuid()));
insert into res select 'made', purchase_orders_from_list((select v from res where k = 'lines'), null,
                                                         (select (v #>> '{}')::uuid from res where k = 'key'));
select test.eq((select string_agg((o ->> 'po_no') || ' ' || (o ->> 'supplier') || ' ' || (o ->> 'total'), ', ')
                  from res, jsonb_array_elements(v -> 'orders') o where k = 'made'),
  '2 City Packaging Supplies 10000, 3 Kurdistan Coffee Imports 38000, 4 Sulaymaniyah Dairy Co. 10500',
  'one draft order for each supplier');
select test.eq(pg_temp.po(2), 'draft City Packaging Supplies 10000 expected +1: List straws 2 box_100 at 5000',
  'each a draft, expected in the café''s day, with no note: a note is for the supplier');
select test.eq(pg_temp.po(3),
  'draft Kurdistan Coffee Imports 38000 expected +1: Golden beans 4 kg at 9000, Golden cup 1 sleeve_50 at 2000',
  'the lines of one supplier on one order');
select test.eq(pg_temp.po(4), 'draft Sulaymaniyah Dairy Co. 10500 expected +2: List milk 7 carton_1l at 1500',
  'the dairy''s expected in its own two days');
insert into res select 'again', purchase_orders_from_list((select v from res where k = 'lines'), null,
                                                          (select (v #>> '{}')::uuid from res where k = 'key'));
select test.eq((select (v ->> 'replayed')::boolean from res where k = 'again'), true, 'sent twice, it is drafted once');
select test.as_admin();
select test.eq((select count(*) from purchase_order)::int, 4, 'no second set of orders');
select test.eq(pg_temp.audits('purchase.order.create'), 4, 'each order is on the audit trail as save_po puts it');

select test.eq(pg_temp.links(pg_temp.milk()), 'Sulaymaniyah Dairy Co. carton_1l at 1500',
  'the pack and price each line was ordered in are kept for its supplier');
select test.eq(pg_temp.links(pg_temp.cups()), 'Kurdistan Coffee Imports sleeve_50 at 2000 (usual)',
  'and a supplier made the usual one where the line asked');
select test.eq((select string_agg(e.entity_id, ',' order by e.id) from audit_log e where e.action = 'item.supplier.set'),
  pg_temp.beans() || ',' || pg_temp.straws() || ',' || pg_temp.milk() || ',' || pg_temp.milk() || ',' || pg_temp.cups(),
  'on the trail: each supplier set by hand, and one new to an item or made its usual one from the list');

select test.act_as('buyer@example.com');
select test.eq((select string_agg((e ->> 'item') || ' ' || (e ->> 'status') || ' ' || (e ->> 'in_draft'), ', ' order by e ->> 'item')
                  from jsonb_array_elements(buying_list() -> 'items') e
                 where (e ->> 'item_id')::uuid in (pg_temp.milk(), pg_temp.beans(), pg_temp.straws(), pg_temp.cups())),
  'Golden beans enough 4000, Golden cup no_history 50, List milk enough 7000, List straws enough 200',
  'drafted: what the drafts hold is counted, and nothing is suggested twice');
-- Ordered only up to its reorder level (no par level), an item is at it, not
-- below it: enough, not suggested again.
select test.act_as('manager@example.com');
select update_item(pg_temp.straws(), 'List straws', 'consumable', p_min_level => 200);
select test.act_as('buyer@example.com');
select test.eq((pg_temp.row(pg_temp.straws()) ->> 'status') || ' ' || (pg_temp.row(pg_temp.straws()) ->> 'position')
               || ' ' || (pg_temp.row(pg_temp.straws()) ->> 'target_from'),
  'enough 200 reorder', 'at its reorder level exactly, with no par level: enough, as the alert has it (below it, not at it)');

-- ------------------------------------------------------------ the usual supplier changed
select set_item_supplier(pg_temp.cups(), pg_temp.city(), 'sleeve_50', null, true, gen_random_uuid());
select test.eq(pg_temp.links(pg_temp.cups()),
  'City Packaging Supplies sleeve_50 at - (usual), Kurdistan Coffee Imports sleeve_50 at 2000',
  'one usual supplier an item: the new one takes the place of the one before');
select test.as_admin();
select test.eq((select (after_state ->> 'instead_of')::uuid from audit_log where action = 'item.supplier.set'
                 order by id desc limit 1), pg_temp.kci(), 'the trail says whose place it took');

-- ------------------------------------------------------------ another location, and another café
select test.act_as('buyer@example.com');
select test.throws(format('select buying_list(%L)', gen_random_uuid()), 'No active location for this business',
  'a location not the café''s is refused');
select test.act_as('owner@example.com');
select test.eq((select count(*) from item_supplier)::int, 5, 'the owner reads who each item is bought from');
select test.act_as('cashier@example.com');
select test.eq((select count(*) from item_supplier)::int, 0, 'a cashier, who sees no costs, does not');
