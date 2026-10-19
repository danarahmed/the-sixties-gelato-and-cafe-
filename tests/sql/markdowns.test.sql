-- =============================================================================
-- End-of-day markdowns (0079, round twenty-one): what must be sold today,
-- sold off cheaper. The golden water is sold as it is (1,000 dine-in); a lot
-- of it must go within an hour; the espresso uses beans (2,500, 3,000 on
-- talabat). The fixtures opened the drawer.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.price(p_variant text, p_channel text) returns numeric language sql security definer as $$
  select (prices ->> p_channel)::numeric from pos_catalogue() where variant_id = p_variant::uuid
$$;
-- The water: a lot of 6 bottles at the branch, to be sold within the hour
-- (or before the café's day ends, when that is sooner).
insert into item_lot (business_id, item_id, lot_code, use_by, location_id, left_base)
select '00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-000000000003', 'W-TODAY',
       least(now() + interval '1 hour',
             ((test.today() + 1)::timestamp at time zone (select timezone from business limit 1)) - interval '1 minute'),
       (select id from location where kind = 'branch' limit 1), 6;

-- ------------------------------------------------------------ what to mark down
select test.act_as('manager@example.com');
insert into res select 'S', markdown_suggestions();
select test.eq((select string_agg((l ->> 'item') || ' ' || (l ->> 'left') || ' ' || (l ->> 'suggested'), '; ')
                  from jsonb_array_elements(pg_temp.r('S') -> 'lots') l
                 where l ->> 'item' = 'Golden water'), 'Golden water 6 50',
  'the water must go within the hour: 6 left, half off suggested');
select test.eq((select string_agg((s ->> 'product') || ' ' || (s ->> 'servings'), '; ')
                  from jsonb_array_elements(pg_temp.r('S') -> 'lots') l,
                       jsonb_array_elements(l -> 'sizes') s
                 where l ->> 'item' = 'Golden water'), 'Golden water 6',
  'sold as it is: six bottles to sell');

-- ------------------------------------------------------------ marked down
select test.throws($$select mark_down(array['d1000000-0000-0000-0000-000000000002'::uuid], 3)$$,
  '%from 5% to 90%%', 'at least 5% off');
select test.throws($$select mark_down(array['d1000000-0000-0000-0000-000000000002'::uuid], 33.5)$$,
  '%whole percent%', 'in whole percent');
insert into res select 'M', mark_down(array['d1000000-0000-0000-0000-000000000002'::uuid], 50, null, null,
  '79000000-0000-0000-0000-000000000001');
insert into res select 'M2', mark_down(array['d1000000-0000-0000-0000-000000000002'::uuid], 50, null, null,
  '79000000-0000-0000-0000-000000000001');
select test.eq((select count(*) from price_markdown), 1::bigint, 'sent again with its key: one markdown');
select test.eq(pg_temp.price('d1000000-0000-0000-0000-000000000002', 'dine_in'), 500::numeric,
  'the till sells the water at 500, half off');
select test.eq((select markdown_percent from pos_catalogue()
                 where variant_id = 'd1000000-0000-0000-0000-000000000002'), 50::numeric,
  'and says by how much');
select test.eq(pg_temp.price('d1000000-0000-0000-0000-000000000001', 'dine_in'), 2500::numeric,
  'the espresso is as it was');

select test.act_as('cashier@example.com');
insert into res select 'W', record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000002", "qty": 2}]');
select test.eq((pg_temp.r('W') ->> 'net')::numeric, 1000::numeric, 'two waters sold at 500 each');
select test.throws($$select mark_down(array['d1000000-0000-0000-0000-000000000001'::uuid], 20)$$, null,
  'a cashier does not mark down');

-- ------------------------------------------------------------ on the platforms, as they price it
select test.act_as('manager@example.com');
select mark_down(array['d1000000-0000-0000-0000-000000000001'::uuid], 20);
select test.eq(pg_temp.price('d1000000-0000-0000-0000-000000000001', 'dine_in'), 2000::numeric,
  'the espresso 20% off: 2,000');
select test.eq(pg_temp.price('d1000000-0000-0000-0000-000000000001', 'talabat'), 3000::numeric,
  'a delivery platform''s price is the platform''s: 3,000');
select mark_down(array['d1000000-0000-0000-0000-000000000001'::uuid], 30);
select test.eq(pg_temp.price('d1000000-0000-0000-0000-000000000001', 'dine_in'), 1750::numeric,
  'marked down again: the new one in its place');
select test.eq((select count(*) from price_markdown where stopped_at is null
                 and product_variant_id = 'd1000000-0000-0000-0000-000000000001'), 1::bigint, 'one running');

-- ------------------------------------------------------------ stopped
insert into res select 'S2', markdown_suggestions();
select stop_markdown((select (x ->> 'id')::uuid from jsonb_array_elements(pg_temp.r('S2') -> 'running') x
                       where x ->> 'product' = 'Golden espresso'));
select test.eq(pg_temp.price('d1000000-0000-0000-0000-000000000001', 'dine_in'), 2500::numeric,
  'stopped: the espresso at its price again');
select test.eq(jsonb_array_length(markdown_suggestions() -> 'running'), 1, 'the water still marked down');

-- ------------------------------------------------------------ it ends with the day
select test.as_admin();
update price_markdown set starts_at = now() - interval '2 days', ends_at = now() - interval '1 day';
select test.act_as('manager@example.com');
select test.eq(pg_temp.price('d1000000-0000-0000-0000-000000000002', 'dine_in'), 1000::numeric,
  'a markdown past its end is over: the water at 1,000 again');
select test.as_admin();
select test.eq((select count(*) from audit_log where action like 'price.markdown%'), 4::bigint,
  'each markdown and stop audited');
