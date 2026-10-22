-- =============================================================================
-- Smarter buying (0092, SMART_PLAN part 3): a supplier's delivery time learnt
-- from the orders sent to it and when they came, how often it delivers (its
-- own, else learnt, else a week), the levels What to buy suggests from them
-- (to last until this order comes, late as it has come lately; up to what
-- lasts until the next could come), a top-up of what is low when its
-- supplier is ordered from anyway, a cheaper supplier, and the drafts made
-- in one press. Who may; keys.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create function pg_temp.loc() returns uuid language sql security definer as $$
  select default_location('00000000-0000-0000-0000-0000000000b1')
$$;
create function pg_temp.sup(p_name text) returns uuid language sql security definer as $$
  select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' and name = p_name
$$;
create function pg_temp.milk() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-0000000000d1'::uuid $$;
create function pg_temp.cream() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-0000000000d2'::uuid $$;
create function pg_temp.napkins() returns uuid language sql as $$ select 'c0000000-0000-0000-0000-0000000000d3'::uuid $$;
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
-- An order sent p_sent days ago whose delivery came p_took days later.
create function pg_temp.sent(p_supplier uuid, p_sent int, p_took int) returns void language plpgsql as $$
declare v_po uuid;
begin
  insert into purchase_order (business_id, supplier_id, location_id, status, po_no, total, approved_at, sent_at,
                              closed_at, close_reason, expected_on)
  values ('00000000-0000-0000-0000-0000000000b1', p_supplier, pg_temp.loc(), 'closed',
          next_document_no('00000000-0000-0000-0000-0000000000b1', 'purchase_order', 1), 1000,
          pg_temp.noon(p_sent), pg_temp.noon(p_sent), pg_temp.noon(p_sent - p_took) + interval '3 hours', 'fixture',
          test.today() - p_sent + 1)
  returning id into v_po;
  insert into goods_receipt (business_id, purchase_order_id, location_id, received_at, supplier_id)
  values ('00000000-0000-0000-0000-0000000000b1', v_po, pg_temp.loc(), pg_temp.noon(p_sent - p_took) + interval '2 hours',
          p_supplier);
end $$;
create function pg_temp.terms(p_name text) returns text language sql security definer as $$
  select concat_ws(' ', 'lead ' || (t ->> 'lead') || ' ' || (t ->> 'lead_from'),
                   'orders ' || (t ->> 'orders'), 'usual ' || coalesce(t ->> 'usual', '-'),
                   'late ' || coalesce(t ->> 'late', '-'), 'worst ' || coalesce(t ->> 'worst', '-'),
                   'allow ' || (t ->> 'late_days'), 'every ' || (t ->> 'every') || ' ' || (t ->> 'every_from'))
    from (select supplier_terms('00000000-0000-0000-0000-0000000000b1', pg_temp.sup(p_name), now()) t) x
$$;
create function pg_temp.row(p_item uuid) returns jsonb language sql as $$
  select e from jsonb_array_elements(buying_list() -> 'items') e where (e ->> 'item_id')::uuid = p_item
$$;
create function pg_temp.says(p_item uuid) returns text language sql as $$
  select concat_ws(' ', r ->> 'status', 'have ' || (r ->> 'position'),
                   'lead ' || (r ->> 'lead_time') || ' ' || (r ->> 'lead_from'),
                   'late ' || (r ->> 'late_days'), 'every ' || (r ->> 'every_days') || ' ' || (r ->> 'every_from'),
                   'reorder ' || coalesce(r ->> 'reorder_level', '-') || ' ' || coalesce(r ->> 'reorder_from', '-'),
                   'up to ' || coalesce(r ->> 'target_level', '-') || ' ' || coalesce(r ->> 'target_from', '-'),
                   'order ' || (r ->> 'packs'),
                   case when (r ->> 'top_up')::boolean then 'top up ' || (r ->> 'top_up_packs') end)
    from (select pg_temp.row(p_item) r) x
$$;
create function pg_temp.po(p_id uuid) returns text language sql security definer as $$
  select o.status || ' ' || s.name || ' ' || trim_scale(o.total) || ' expected +' || (o.expected_on - test.today()) || ': '
         || (select string_agg(i.name || ' ' || trim_scale(l.order_qty) || ' ' || l.order_unit_code || ' at '
                               || trim_scale(l.unit_price), ', ' order by i.name)
               from purchase_order_line l join item i on i.id = l.item_id where l.purchase_order_id = o.id)
    from purchase_order o join supplier s on s.id = o.supplier_id where o.id = p_id
$$;

-- Two suppliers of dairy; three items, with four weeks of steady use.
insert into supplier (business_id, name, lead_time_days) values
  ('00000000-0000-0000-0000-0000000000b1', 'Learn Dairy', 1),
  ('00000000-0000-0000-0000-0000000000b1', 'Learn Rival', null);
insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock) values
  ('c0000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'S-MILK', 'Smart milk', 'ingredient', 'ml', 'volume', false),
  ('c0000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', 'S-CREAM', 'Smart cream', 'ingredient', 'ml', 'volume', false),
  ('c0000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', 'S-NAP', 'Smart napkins', 'consumable', 'each', 'count', false);
insert into item_unit (item_id, code, label, dimension, factor_to_base) values
  ('c0000000-0000-0000-0000-0000000000d1', 'carton_1l', 'Carton of 1 L', 'volume', 1000),
  ('c0000000-0000-0000-0000-0000000000d2', 'carton_1l', 'Carton of 1 L', 'volume', 1000);
-- Milk: 30,000 ml 30 days ago, 1,000 a day for 28 days: 2,000 left.
select pg_temp.moves(pg_temp.milk(), 'opening_balance', 30000, 1.5, '{30}');
select pg_temp.moves(pg_temp.milk(), 'sale_consumption', -1000, 1.5, (select array_agg(d) from generate_series(1, 28) d));
-- Cream: 200 a day for 28 days, 1,200 left.
select pg_temp.moves(pg_temp.cream(), 'opening_balance', 6800, 6, '{30}');
select pg_temp.moves(pg_temp.cream(), 'sale_consumption', -200, 6, (select array_agg(d) from generate_series(1, 28) d));
-- Napkins: 10 a day, 15 left, and no supplier.
select pg_temp.moves(pg_temp.napkins(), 'opening_balance', 295, 10, '{30}');
select pg_temp.moves(pg_temp.napkins(), 'sale_consumption', -10, 10, (select array_agg(d) from generate_series(1, 28) d));

-- ------------------------------------------------------------ before it has learnt
select test.eq(pg_temp.terms('Learn Dairy'), 'lead 1 supplier orders 0 usual - late - worst - allow 0 every 7 default',
  'no orders sent yet: its own day, no lateness allowed for, a week between deliveries');
select test.eq(pg_temp.terms('Learn Rival'), 'lead 1 cafe orders 0 usual - late - worst - allow 0 every 7 default',
  'a supplier with no days of its own: the café''s');

-- ------------------------------------------------------------ learnt from orders sent
-- Four orders, sent 40, 30, 20 and 10 days ago: three came in two days, the
-- last in four. One sent 200 days ago (too long ago) is not counted.
select pg_temp.sent(pg_temp.sup('Learn Dairy'), 40, 2);
select pg_temp.sent(pg_temp.sup('Learn Dairy'), 30, 2);
select pg_temp.sent(pg_temp.sup('Learn Dairy'), 20, 2);
select pg_temp.sent(pg_temp.sup('Learn Dairy'), 10, 4);
select pg_temp.sent(pg_temp.sup('Learn Dairy'), 200, 9);
select test.eq(pg_temp.terms('Learn Dairy'), 'lead 2 learned orders 4 usual 2 late 1 worst 4 allow 2 every 10 learned',
  'learnt: usually two days, one of four later, four days at worst lately, so two days late allowed for; its deliveries came every ten days or so');

-- Set: it delivers every three days.
select test.act_as('manager@example.com');
select test.throws($$select update_supplier(pg_temp.sup('Learn Dairy'), 'Learn Dairy', null, null, true, null, 1, 61)$$,
  'A supplier delivers every 1 to 60 days', 'every 1 to 60 days');
select update_supplier(pg_temp.sup('Learn Dairy'), 'Learn Dairy', null, null, true, 'comes every three days', 1, 3);
select test.eq(pg_temp.terms('Learn Dairy'), 'lead 2 learned orders 4 usual 2 late 1 worst 4 allow 2 every 3 supplier',
  'how often it delivers, as set; the days it takes, still as learnt');
select test.eq((select delivers_every_days from supplier where id = pg_temp.sup('Learn Dairy')), 3, 'kept on the supplier');
select update_supplier(pg_temp.sup('Learn Dairy'), 'Learn Dairy', null, null, true, 'its phone', 1);
select test.eq((select delivers_every_days from supplier where id = pg_temp.sup('Learn Dairy')), 3,
  'edited without saying how often it delivers: kept as it was');
select test.eq((select count(*)::int from jsonb_array_elements(supplier_records()) r
                 where r ->> 'supplier' = 'Learn Dairy' and r ->> 'usual' = '2' and r ->> 'late' = '1'),
  1, 'Purchasing reads each supplier''s record');

-- ------------------------------------------------------------ the levels it suggests
select set_item_supplier(pg_temp.milk(), pg_temp.sup('Learn Dairy'), 'carton_1l', 1500, true, gen_random_uuid());
select set_item_supplier(pg_temp.milk(), pg_temp.sup('Learn Rival'), 'carton_1l', 1400, false, gen_random_uuid());
select set_item_supplier(pg_temp.cream(), pg_temp.sup('Learn Dairy'), 'carton_1l', 6000, true, gen_random_uuid());
select test.eq(pg_temp.says(pg_temp.milk()),
  'order have 2000 lead 2 learned late 2 every 3 supplier reorder 5000 use up to 8000 cover order 6',
  'milk: three days to the delivery (today to the day it comes) and two late: 5,000; up to three days more: 8,000; six cartons');
select test.eq(pg_temp.row(pg_temp.milk()) ->> 'suggested_reorder', '5000', 'the suggested reorder level, beside any set by hand');
select test.eq(pg_temp.row(pg_temp.milk()) ->> 'spread', '0', 'a steady 1,000 a day: nothing more kept for it straying');
select test.eq((pg_temp.row(pg_temp.milk()) -> 'cheaper') ->> 'supplier', 'Learn Rival', 'a cheaper supplier of milk');
select test.eq((pg_temp.row(pg_temp.milk()) -> 'cheaper') ->> 'saves', '0.067', '1,400 a carton against 1,500: 6.7% less');
select test.eq(pg_temp.says(pg_temp.cream()),
  'enough have 1200 lead 2 learned late 2 every 3 supplier reorder 1000 use up to 1600 cover order 0 top up 1',
  'cream has enough until the next order, but less than halfway to its level: a carton more when the dairy comes anyway');
select test.ok(pg_temp.row(pg_temp.cream()) -> 'cheaper' = 'null'::jsonb, 'no other supplier of cream');

-- An item's own reorder level still rules; the suggested one is shown beside it.
select test.as_admin();
update item set min_level_base = 4000 where id = pg_temp.milk();
select test.act_as('manager@example.com');
select test.eq((pg_temp.row(pg_temp.milk()) ->> 'reorder_level') || ' ' || (pg_temp.row(pg_temp.milk()) ->> 'reorder_from')
               || ' ' || (pg_temp.row(pg_temp.milk()) ->> 'own_reorder') || ' ' || (pg_temp.row(pg_temp.milk()) ->> 'suggested_reorder'),
  '4000 item 4000 5000', 'the level set on milk (4,000) is used, the suggested 5,000 beside it');
select test.as_admin();
update item set min_level_base = 0 where id = pg_temp.milk();

-- ------------------------------------------------------------ the drafts
select test.act_as('cashier@example.com');
select test.throws($$select draft_purchase_orders(null, gen_random_uuid())$$, '%purchase.create%', 'a cashier drafts no orders');
select test.act_as('manager@example.com');
create temp table d as select draft_purchase_orders(null, 'f0000000-0000-0000-0000-000000000092'::uuid) as v;
select test.eq((select (v ->> 'count')::int from d), 1, 'one draft: the dairy''s');
select test.eq(pg_temp.po((select (v -> 'orders' -> 0 ->> 'po_id')::uuid from d)),
  'draft Learn Dairy 15000 expected +2: Smart cream 1 carton_1l at 6000, Smart milk 6 carton_1l at 1500',
  'the milk to order and the cream topped up with it, from the usual supplier at its price, expected in the two days the dairy takes');
select test.eq((select string_agg(e ->> 'item', ', ') from d, jsonb_array_elements(v -> 'left') e), 'Smart napkins',
  'napkins to order have no supplier: left for someone to choose');
select test.eq((select (draft_purchase_orders(null, 'f0000000-0000-0000-0000-000000000092'::uuid) -> 'orders' -> 0 ->> 'po_id'))
                 = (select v -> 'orders' -> 0 ->> 'po_id' from d), true, 'pressed twice with one key: drafted once');
select test.eq((draft_purchase_orders(null, gen_random_uuid()) ->> 'count')::int, 0,
  'pressed again: the milk is in a draft now, so nothing more (cream is topped up only with an order)');
select test.eq(pg_temp.row(pg_temp.milk()) ->> 'status', 'enough', 'milk: enough once its draft counts');

-- A buyer may draft (purchasing reads costs and creates orders).
select test.as_admin();
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000f2', 'smartbuyer@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Smart Buyer', 'smartbuyer@example.com', 'a0000000-0000-0000-0000-0000000000f2');
insert into user_role (app_user_id, role) select id, 'purchasing' from app_user where email = 'smartbuyer@example.com';
select test.act_as('smartbuyer@example.com');
select test.eq((draft_purchase_orders(null, gen_random_uuid()) ->> 'count')::int, 0, 'a buyer may press it too');
