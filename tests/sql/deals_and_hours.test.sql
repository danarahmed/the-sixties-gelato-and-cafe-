-- =============================================================================
-- Meal deals and prices by the time of day (0089).
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.dine(p_variant text) returns numeric language sql as $$
  select (prices ->> 'dine_in')::numeric from pos_catalogue() where variant_id = p_variant::uuid
$$;
create function pg_temp.lines(p_order uuid) returns text language sql security definer as $$
  select string_agg(trim_scale(unit_price) || '-' || trim_scale(line_discount) || '=' || trim_scale(line_net)
                    || case when sale_deal_id is null then '' else ' deal' end, ', ' order by unit_price desc)
    from sales_order_line where sales_order_id = p_order
$$;
create function pg_temp.disc_journal(p_order uuid) returns numeric language sql security definer as $$
  select coalesce(sum(l.debit), 0) from journal_entry e join journal_line l on l.journal_entry_id = e.id
    join gl_account a on a.id = l.account_id
   where e.reference_type = 'sales_order' and e.reference_id = p_order and a.code = '4100'
$$;
create function pg_temp.moves(p_order uuid) returns int language sql security definer as $$
  select count(*)::int from inventory_movement where reference_id = p_order
$$;
-- A window around now, in the café's time: from a minute ago, for two hours.
create function pg_temp.now_from() returns time language sql as $$
  select ((now() - interval '1 minute') at time zone (select timezone from business limit 1))::time
$$;
create function pg_temp.now_until() returns time language sql as $$
  select ((now() + interval '2 hours') at time zone (select timezone from business limit 1))::time
$$;
\set E '''d1000000-0000-0000-0000-000000000001'''
\set W '''d1000000-0000-0000-0000-000000000002'''

-- ------------------------------------------------------------ prices by the hour
select test.act_as('cashier@example.com');
select test.throws($$select set_time_price('d1000000-0000-0000-0000-000000000001', 1500, '08:00', '11:00')$$,
  '%recipe.edit%', 'a cashier sets no price');
select test.act_as('owner@example.com');
select test.throws($$select set_time_price('d1000000-0000-0000-0000-000000000001', 1500, '08:00', '08:00')$$,
  'Give the hours it runs, from and until', 'from and until differ');
select test.throws($$select set_time_price('d1000000-0000-0000-0000-000000000001', 1500, '08:00', '11:00',
                                           p_channel => 'talabat')$$,
  'A delivery platform sets its own prices', 'not on a platform');
insert into res select 'TP', to_jsonb(set_time_price(:E, 1500, pg_temp.now_from(), pg_temp.now_until()));
-- The water's runs later today, not now.
select set_time_price(:W, 500, ((now() + interval '3 hours') at time zone (select timezone from business limit 1))::time,
                      ((now() + interval '4 hours') at time zone (select timezone from business limit 1))::time);
select test.eq(pg_temp.dine(:E), 1500::numeric, 'while its hour runs, the espresso is 1,500 at the till');
select test.eq((select (prices ->> 'takeaway')::numeric || '/' || (prices ->> 'talabat')::numeric
                  from pos_catalogue() where variant_id = :E::uuid), '1500/3000',
  'on take-away too; a platform keeps its own price');
select test.eq(pg_temp.dine(:W), 1000::numeric, 'the water''s hour has not come: its usual price');
select test.ok(pos_menu_next_change() > now(), 'the till is told when its menu next changes');
select test.ok((select bool_or((x ->> 'on_now')::boolean) from jsonb_array_elements(time_prices()) x),
  'the menu''s screen lists them, which is on now');

select test.act_as('cashier@example.com');
insert into res select 'S1', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]');
select test.eq((pg_temp.r('S1') ->> 'net')::numeric, 3000::numeric, 'two espressos rung in the hour: 3,000');
-- A bill keeps the price it was rung at.
insert into res select 'B1', open_tab('dine_in', null, 'Hour table', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]');
select test.eq((select min(unit_price) from pos_tab_line where tab_id = (pg_temp.r('B1') ->> 'tab_id')::uuid),
  1500::numeric, 'a bill''s line carries the hour''s price from when it was rung');

select test.act_as('owner@example.com');
select stop_time_price((pg_temp.r('TP') #>> '{}')::uuid);
select test.eq(pg_temp.dine(:E), 2500::numeric, 'stopped: back to its usual price');
select test.eq((select subtotal from pos_open_bills() where tab_id = (pg_temp.r('B1') ->> 'tab_id')::uuid),
  1500::numeric, 'and the bill keeps the price it was rung at');

-- ------------------------------------------------------------ a meal deal
select test.act_as('cashier@example.com');
select test.throws($$select save_deal(null, 'Nope', '{"dine_in": 1}',
                     '[{"variants":["d1000000-0000-0000-0000-000000000001"]},{"variants":["d1000000-0000-0000-0000-000000000002"]}]')$$,
  '%recipe.edit%', 'a cashier makes no deal');
select test.act_as('owner@example.com');
select test.throws($$select save_deal(null, 'One thing', '{"dine_in": 1}',
                     '[{"variants":["d1000000-0000-0000-0000-000000000001"]}]')$$,
  'A deal has at least two things in it', 'a deal is two things or more');
select test.throws($$select save_deal(null, 'Platform deal', '{"talabat": 1}',
                     '[{"variants":["d1000000-0000-0000-0000-000000000001"]},{"variants":["d1000000-0000-0000-0000-000000000002"]}]')$$,
  'A delivery platform sets its own offers', 'not on a platform');
insert into res select 'D', to_jsonb(save_deal(null, 'Espresso and water', '{"dine_in": 3000}',
  '[{"label":"A coffee","variants":["d1000000-0000-0000-0000-000000000001"]},
    {"label":"A drink","variants":["d1000000-0000-0000-0000-000000000002"]}]'));
select test.eq((select count(*) from jsonb_array_elements(pos_deals()))::int, 1, 'the till offers it now');

select test.act_as('cashier@example.com');
insert into res select 'S2', record_sale(gen_random_uuid(), 'dine_in', 'cash', jsonb_build_array(
  jsonb_build_object('variant_id', :E, 'qty', 1, 'deal', jsonb_build_object('deal_id', pg_temp.r('D') #>> '{}', 'key', 'k1')),
  jsonb_build_object('variant_id', :W, 'qty', 1, 'deal', jsonb_build_object('deal_id', pg_temp.r('D') #>> '{}', 'key', 'k1'))),
  p_expected_net => 3000);
select test.eq((pg_temp.r('S2') ->> 'gross') || ' ' || (pg_temp.r('S2') ->> 'discount') || ' ' || (pg_temp.r('S2') ->> 'net'),
  '3500 500 3000', 'sold at 3,000: each at its full price, 500 given away');
select test.eq(pg_temp.lines((pg_temp.r('S2') ->> 'order_id')::uuid), '2500-357=2143 deal, 1000-143=857 deal',
  'what it gives away is shared over its two lines, as a discount');
select test.eq(pg_temp.disc_journal((pg_temp.r('S2') ->> 'order_id')::uuid), 500::numeric,
  'and posted as a discount, 4100');
select test.eq(pg_temp.moves((pg_temp.r('S2') ->> 'order_id')::uuid), 2,
  'each sold as itself: the espresso''s beans, the water''s bottle');

-- Two deals and an espresso besides, with 10% off: the deals first, the discount on what is left.
insert into res select 'S3', record_sale(gen_random_uuid(), 'dine_in', 'cash', jsonb_build_array(
  jsonb_build_object('variant_id', :E, 'qty', 1, 'deal', jsonb_build_object('deal_id', pg_temp.r('D') #>> '{}', 'key', 'a')),
  jsonb_build_object('variant_id', :W, 'qty', 1, 'deal', jsonb_build_object('deal_id', pg_temp.r('D') #>> '{}', 'key', 'a')),
  jsonb_build_object('variant_id', :E, 'qty', 1, 'deal', jsonb_build_object('deal_id', pg_temp.r('D') #>> '{}', 'key', 'b')),
  jsonb_build_object('variant_id', :W, 'qty', 1, 'deal', jsonb_build_object('deal_id', pg_temp.r('D') #>> '{}', 'key', 'b')),
  jsonb_build_object('variant_id', :E, 'qty', 1)),
  p_discount_percent => 5, p_discount_reason => 'regular');
select test.eq((pg_temp.r('S3') ->> 'gross') || ' ' || (pg_temp.r('S3') ->> 'deal_discount') || ' ' || (pg_temp.r('S3') ->> 'net'),
  '9500 1000 8000', 'two deals at 3,000 and an espresso at 2,500: 8,500, then 5% off it (425, to the step: 500): 8,000');

select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', jsonb_build_array(
  jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 1,
                     'deal', jsonb_build_object('deal_id', (select v #>> '{}' from res where k = 'D'), 'key', 'x'))))$$,
  'A deal is one of each of the things in it', 'half a deal is refused');
select test.act_as('owner@example.com');
select set_price('d1000000-0000-0000-0000-000000000002', 'takeaway', 1000);
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'takeaway', 'cash', jsonb_build_array(
  jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 1,
                     'deal', jsonb_build_object('deal_id', (select v #>> '{}' from res where k = 'D'), 'key', 'x')),
  jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000002', 'qty', 1,
                     'deal', jsonb_build_object('deal_id', (select v #>> '{}' from res where k = 'D'), 'key', 'x'))))$$,
  'That deal is not sold takeaway', 'on a channel it has no price on, refused');

-- Off: not sold.
select test.act_as('owner@example.com');
select save_deal((pg_temp.r('D') #>> '{}')::uuid, 'Espresso and water', '{"dine_in": 3000}',
  '[{"variants":["d1000000-0000-0000-0000-000000000001"]},{"variants":["d1000000-0000-0000-0000-000000000002"]}]',
  p_active => false);
select test.eq((select count(*) from jsonb_array_elements(pos_deals()))::int, 0, 'turned off, the till no longer offers it');
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', jsonb_build_array(
  jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 1,
                     'deal', jsonb_build_object('deal_id', (select v #>> '{}' from res where k = 'D'), 'key', 'x')),
  jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000002', 'qty', 1,
                     'deal', jsonb_build_object('deal_id', (select v #>> '{}' from res where k = 'D'), 'key', 'x'))))$$,
  'That deal is not on now', 'nor sold');

-- Reports: the deals sold, and what they gave away.
select test.act_as('owner@example.com');
select test.eq((select (x ->> 'sold') || ' ' || (x ->> 'paid') || ' ' || (x ->> 'given')
                  from jsonb_array_elements(report_deals(test.today(), test.today())) x),
  '3 9000 1500', 'three deals sold: 9,000 paid for them, 1,500 given away');
select test.eq((select (x ->> 'sold')::int from jsonb_array_elements(deals_list()) x), 3, 'the menu''s screen counts them');
select test.throws($$update sale_deal set given = 0$$, '%permission denied%', 'nobody changes a deal sold');
select test.as_admin();
select test.throws($$update sale_deal set given = 0$$, 'A deal sold is kept as it was sold',
  'not even the database''s owner: a deal sold stays as sold');
