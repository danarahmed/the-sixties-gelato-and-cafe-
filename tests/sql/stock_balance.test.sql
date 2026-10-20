-- =============================================================================
-- Stock on hand kept as it moves (0085, G2): whatever records a movement —
-- an item opened with stock, sales, a table's bill, stock sent, received and
-- cancelled on its way — the balance is what the movements add up to, item by
-- item and place by place, and what a place holds is read from it.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;
-- Every item at every place where the balance and the movements differ: "".
create function pg_temp.differences() returns text language sql security definer as $$
  select coalesce(string_agg(coalesce(b.item_id, m.item_id)::text, ', '), '')
    from stock_balance b
    full join (select business_id, item_id, location_id, sum(base_quantity_signed) q,
                      sum(coalesce(value, 0) * sign(base_quantity_signed)) v
                 from inventory_movement group by 1, 2, 3) m
      on m.business_id = b.business_id and m.item_id = b.item_id and m.location_id = b.location_id
   where b.qty is distinct from m.q or b.value is distinct from m.v
$$;
create function pg_temp.balances() returns bigint language sql security definer as $$
  select count(*) from stock_balance
$$;

select test.eq(pg_temp.differences(), '', 'the balance starts as the movements add up');
select test.ok(pg_temp.balances() > 0, 'with a row for each item at each place');

-- ------------------------------------------------------------------ the day's trading
select test.act_as('owner@example.com');
select create_item('Balance milk', 'ingredient', 'ml', 'volume', p_units => '[{"code":"L","label":"L","factor":1000}]',
  p_opening_qty => 20000, p_opening_unit_cost => 1.5, p_opening_reason => 'the opening count');
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'takeaway', 'cash',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 3}]');
select record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]');
insert into res select 'B', open_tab('dine_in', p_label => 'Table 9',
  p_lines => '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2}]');
select settle_tab(pg_temp.id('B', 'tab_id'), (select version from pos_tab where id = pg_temp.id('B', 'tab_id')),
  gen_random_uuid(), 'cash');
select test.act_as('manager@example.com');
insert into res select 'T1', send_stock_transfer((select id from location where name = 'Main Branch'),
  (select id from location where name = 'Central Kitchen'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from item where name = 'Balance milk'), 'qty', 5, 'unit_code', 'L')),
  null, p_idempotency_key => gen_random_uuid());
select receive_stock_transfer(pg_temp.id('T1', 'transfer_id'),
  jsonb_build_array(jsonb_build_object('line_id', (select id from stock_transfer_line
                                                     where transfer_id = pg_temp.id('T1', 'transfer_id')),
                                       'qty', 4.5)), 'One bottle leaked', gen_random_uuid());
insert into res select 'T2', send_stock_transfer((select id from location where name = 'Main Branch'),
  (select id from location where name = 'Central Kitchen'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from item where name = 'Balance milk'), 'qty', 2, 'unit_code', 'L')),
  null, p_idempotency_key => gen_random_uuid());
select cancel_stock_transfer(pg_temp.id('T2', 'transfer_id'), 'Sent by mistake', gen_random_uuid());

select test.as_admin();
select test.eq(pg_temp.differences(), '', 'after sales, a bill, stock sent, received and cancelled: as the movements add up');
select test.eq((select trim_scale(qty) || ' @ ' || trim_scale(value)
                  from item_position('00000000-0000-0000-0000-0000000000b1',
                                     (select id from item where name = 'Balance milk'),
                                     (select id from location where name = 'Main Branch'))),
  '15000 @ 22500', 'what a place holds is read from it: 20 L less the 5 L sent');
select test.eq((select trim_scale(qty) || ' @ ' || trim_scale(value)
                  from item_position('00000000-0000-0000-0000-0000000000b1',
                                     (select id from item where name = 'Balance milk'),
                                     (select id from location where name = 'Central Kitchen'))),
  '4500 @ 6750', 'and the kitchen the 4.5 L that arrived');
select test.eq((select trim_scale(qty) || ' @ ' || trim_scale(value)
                  from item_position('00000000-0000-0000-0000-0000000000b1', gen_random_uuid(),
                                     (select id from location where name = 'Main Branch'))),
  '0 @ 0', 'an item never moved there: none');
select test.eq((select count(*) from current_stock cs
                  join stock_balance b using (business_id, item_id, location_id)
                 where cs.quantity_base = b.qty and cs.value_signed = b.value), pg_temp.balances(),
  'the stock screens read the same');

-- ------------------------------------------------------------------ cleared with the movements
truncate inventory_movement cascade;
select test.eq(pg_temp.balances(), 0::bigint, 'the movements cleared, the balance with them');
