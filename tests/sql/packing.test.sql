-- =============================================================================
-- Packing at the till (0107): a bag is one an order to take away or for
-- delivery; an espresso to take away goes out in a cup. A sale that says
-- nothing takes the defaults; the till's own count wins when it sends one;
-- dine-in takes none. Each leaves stock at its average cost, to 5500
-- Packaging, and the sale's own cost is unchanged.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
grant execute on function pg_temp.r(text) to public;
create function pg_temp.packed(p text) returns text language sql security definer as $$
  select coalesce(string_agg(i.name || ' ' || trim_scale(sp.qty) || ' ' || sp.value::int, ', ' order by i.name), '')
    from sales_order_packing sp join item i on i.id = sp.item_id
   where sp.sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p)
$$;
grant execute on function pg_temp.packed(text) to public;
\set ESP '''[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2}]'''

-- A bag: 50 at 100 each, in the books as opening stock.
do $$
declare b uuid := '00000000-0000-0000-0000-0000000000b1'; m uuid;
begin
  insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock)
  values ('c0000000-0000-0000-0000-0000000000b9', b, 'G-BAG', 'Golden bag', 'packaging', 'each', 'count', false);
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason)
  values (b, 'c0000000-0000-0000-0000-0000000000b9', default_location(b), 'opening_balance', 50, 100, 5000, 'fixture')
  returning id into m;
  perform post_journal(b, now(), 'Opening stock (bag)', 'inventory_movement', m,
    jsonb_build_array(jsonb_build_object('code', '1200', 'debit', 5000), jsonb_build_object('code', '3000', 'credit', 5000)));
end $$;

-- ------------------------------------------------------------ setting it up
select test.act_as('cashier@example.com');
select test.throws($$select save_packing_item('c0000000-0000-0000-0000-0000000000b9', 'bag', 1, 1)$$,
  '%permission%', 'a cashier does not set up packing');
select test.act_as('owner@example.com');
select test.throws($$select save_packing_item('c0000000-0000-0000-0000-0000000000b9', 'wrap', 1, 1)$$,
  'Choose what it is: a bag, a cup, a lid, a box or other packing', 'what it is');
select test.throws($$select save_packing_item('c0000000-0000-0000-0000-0000000000b9', 'bag', 30, 1)$$,
  'An order takes from 0 to 20 of it by default', 'a sensible default');
select save_packing_item('c0000000-0000-0000-0000-0000000000b9', 'bag', 1, 1);
select save_packing_item('c0000000-0000-0000-0000-000000000002', 'cup', 0, 0);
select test.throws($$select set_variant_packing('d1000000-0000-0000-0000-000000000001',
  '[{"item_id": "c0000000-0000-0000-0000-000000000001", "qty": 1}]')$$,
  'Choose one of the café''s packing items', 'only packing goes on a size');
select set_variant_packing('d1000000-0000-0000-0000-000000000001',
  '[{"item_id": "c0000000-0000-0000-0000-000000000002", "qty": 1}]');
select test.eq((select count(*)::int from gl_account where business_id = '00000000-0000-0000-0000-0000000000b1'
                 and code = '5500'), 1, 'the Packaging account is made');
select test.act_as('cashier@example.com');
select test.eq(jsonb_array_length(packing_setup() -> 'items'), 2, 'the till reads the packing');
select test.eq(jsonb_array_length(packing_setup() -> 'variants'), 1, 'and what each size goes out in');

-- ------------------------------------------------------------ at the till
-- Two espressos to take away, the till saying nothing: two cups and a bag.
insert into res select 'away', record_sale(gen_random_uuid(), 'takeaway', 'cash', :ESP);
select test.eq(pg_temp.packed('away'), 'Golden bag 1 100, Golden cup 2 100', 'by default: a cup each and a bag');
-- Dine-in: nothing.
insert into res select 'here', record_sale(gen_random_uuid(), 'dine_in', 'cash', :ESP);
select test.eq(pg_temp.packed('here'), '', 'dine-in goes out in nothing');
-- The cashier made it two bags and no cups.
insert into res select 'two', record_sale(gen_random_uuid(), 'takeaway', 'cash', :ESP,
  p_packing => '[{"item_id": "c0000000-0000-0000-0000-0000000000b9", "qty": 2}]');
select test.eq(pg_temp.packed('two'), 'Golden bag 2 200', 'the till''s own count wins');
-- A delivery platform's order: its delivery default, and the cups.
insert into res select 'plat', record_sale(gen_random_uuid(), 'talabat', 'platform_paid', :ESP,
  p_platform_order_no => 'PK-1');
select test.eq(pg_temp.packed('plat'), 'Golden bag 1 100, Golden cup 2 100', 'a delivery takes its bag and cups');
select test.throws(format('select record_sale(%L, %L, %L, %L, p_packing => %L)', gen_random_uuid(), 'takeaway', 'cash',
  :ESP, '[{"item_id": "c0000000-0000-0000-0000-000000000001", "qty": 1}]'),
  'Choose one of the café''s packing items', 'only packing is packed');

-- ------------------------------------------------------------ the books
select test.as_admin();
select test.eq((select sum(l.debit - l.credit)::int from journal_line l join gl_account g on g.id = l.account_id
                  join journal_entry e on e.id = l.journal_entry_id
                 where g.code = '5500' and e.status = 'published'), 600, 'all of it on 5500 Packaging');
select test.eq((select sum(-base_quantity_signed)::int from inventory_movement
                 where type = 'packing' and item_id = 'c0000000-0000-0000-0000-0000000000b9'), 4,
  'four bags out of stock');
select test.eq((select cogs_amount::int from sales_order where id = (pg_temp.r('two') ->> 'order_id')::uuid),
  (select cogs_amount::int from sales_order where id = (pg_temp.r('away') ->> 'order_id')::uuid),
  'the sale''s own cost is unchanged by its packing');
select test.eq((select count(*)::int from sales_order_packing where sent_by_till), 1, 'one counted by the till');

-- ------------------------------------------------------------ the report
select test.act_as('owner@example.com');
insert into res select 'rep', report_packing(test.today(), test.today());
select test.eq((pg_temp.r('rep') ->> 'total')::int, 600, 'the report: 600 in packing');
select test.eq((pg_temp.r('rep') ->> 'orders')::int, 3, 'on three orders');
select test.eq((select (x ->> 'cost')::int from jsonb_array_elements(pg_temp.r('rep') -> 'by_channel') x
                 where x ->> 'channel' = 'takeaway'), 400, 'takeaway: 400');
select test.eq(jsonb_array_length(pg_temp.r('rep') -> 'by_cashier'), 1, 'by cashier');
select test.eq(jsonb_array_length(pg_temp.r('rep') -> 'top_orders'), 3, 'and each order');
select test.as_admin();
select test.eq((select count(*)::int from audit_log where action like 'packing.%'), 3, 'set up on the audit trail');
