-- =============================================================================
-- Selling by weight (0075, round seventeen): a size sold by the kilo, its
-- price a kilo's, its line the weight to the gram, its recipe a kilo's so the
-- stock it uses is the weight sold. The golden catalogue's water is made a
-- size sold by weight here: 1,000 a kilo, a "bottle" standing for a kilo of
-- bought-in stock at 250.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.on_hand(p uuid) returns numeric language sql security definer as $$
  select coalesce(sum(base_quantity_signed), 0) from inventory_movement where item_id = p
$$;
create function pg_temp.line(p text) returns text language sql security definer as $$
  select trim_scale(quantity) || ' x ' || trim_scale(unit_price) || ' = ' || trim_scale(line_net)
    from sales_order_line where sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p)
$$;
create temp table w0 as select pg_temp.on_hand('c0000000-0000-0000-0000-000000000003') as n;
grant select on w0 to public;

-- ------------------------------------------------------------ the size set
select test.act_as('owner@example.com');
select set_variant_weighed('d1000000-0000-0000-0000-000000000002', true, '75000000-0000-0000-0000-000000000001');
select set_variant_weighed('d1000000-0000-0000-0000-000000000002', true, '75000000-0000-0000-0000-000000000001');
select test.eq((select sold_by_weight from pos_catalogue() where variant_id = 'd1000000-0000-0000-0000-000000000002'),
  true, 'the till reads the size as sold by weight');
select test.eq((select sold_by_weight from pos_catalogue() where variant_id = 'd1000000-0000-0000-0000-000000000001'),
  false, 'every other size by the piece, as before');

-- ------------------------------------------------------------ sold by the gram
select test.act_as('cashier@example.com');
insert into res select 'W', record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000002", "qty": 0.75}]', p_expected_net => 750);
select test.eq(pg_temp.line('W'), '0.75 x 1000 = 750', '750 g at 1,000 a kilo is 750');
select test.eq(pg_temp.on_hand('c0000000-0000-0000-0000-000000000003'), (select n from w0) - 0.75,
  'the stock it uses is the weight sold');
insert into res select 'G', record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000002", "qty": 0.333}]');
select test.eq(pg_temp.line('G'), '0.333 x 1000 = 333', 'to the gram, the money rounded as any line''s');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000002", "qty": 0.0005}]')$$,
  'A weight is from 1 g to 1,000 kg, to the gram', 'less than a gram is refused');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000002", "qty": 1.2345}]')$$,
  'A weight is from 1 g to 1,000 kg, to the gram', 'a part of a gram is refused');
select test.succeeds($$select record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2}]')$$,
  'a size by the piece sells as before');

-- ------------------------------------------------------------ who may set it
select test.throws($$select set_variant_weighed('d1000000-0000-0000-0000-000000000001', true)$$, '%permission%',
  'a cashier sets no size by weight');
select test.act_as('owner@example.com');
select test.throws($$select set_variant_weighed(gen_random_uuid(), true)$$, 'Size not found', 'a size the café has');
select set_variant_weighed('d1000000-0000-0000-0000-000000000002', false);
select test.as_admin();
select test.eq((select count(*)::int from audit_log where action = 'variant.weighed'), 2,
  'set and unset, each once on the audit trail (sent again with its key, once)');
