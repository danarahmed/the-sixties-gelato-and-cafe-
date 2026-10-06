-- =============================================================================
-- The plan learns, What to buy looks ahead, and a week's waste (0070, round
-- ten). The day's plan reads, for each day it judges by, what was thrown away
-- unsold and whether it sold out: sold out on half the days or more and never
-- thrown away, it makes for a batch more for every day it sold out out of the
-- days judged; thrown away on half or more and never sold out, what was thrown
-- away on average the less, half a batch at most and never below one batch;
-- both at once, it learns nothing. What to buy judges use without what was
-- thrown away (a loss taken back on review with it), the days a delivery takes
-- each by its weekday, adds what today's plan needs beyond its weekday's
-- batches, and orders what keeps only a few days up to no more than they will
-- use — never below the reorder level. How long an item keeps, set with its
-- own function on the audit trail; a week's waste against the week before;
-- who may do what.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
-- A barista, who makes the gelato and sees the plan, but not costs.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000e', 'barista@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000000e');
insert into user_role (app_user_id, role) select id, 'barista' from app_user where email = 'barista@example.com';

create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;
create function pg_temp.loc() returns uuid language sql security definer as $$
  select default_location('00000000-0000-0000-0000-0000000000b1')
$$;
-- So many days ago, at a time of day, in the café's time.
create function pg_temp.at(p_days_ago int, p_time time) returns timestamptz language sql security definer as $$
  select ((test.today() - p_days_ago) + p_time)
         at time zone (select timezone from business where id = '00000000-0000-0000-0000-0000000000b1')
$$;
-- A movement of stock so many days ago, as the screens would have left it.
create function pg_temp.mv(p_item uuid, p_type movement_type, p_qty numeric, p_days_ago int, p_time time,
                           p_cost numeric default 1) returns uuid language sql security definer as $$
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, reason, occurred_at)
  values ('00000000-0000-0000-0000-0000000000b1', p_item, pg_temp.loc(), p_type, p_qty, p_cost, abs(p_qty) * p_cost,
          case p_type when 'sale_consumption' then 'sales_order' end, 'fixture', pg_temp.at(p_days_ago, p_time))
  returning id
$$;
-- A flavour's day: made at nine, sold at noon, and what was left thrown away
-- as expired, that night or the next.
create function pg_temp.day(p_item uuid, p_days_ago int, p_made numeric, p_sold numeric,
                            p_thrown numeric default 0, p_thrown_next_day boolean default false)
returns void language plpgsql security definer as $$
begin
  perform pg_temp.mv(p_item, 'production_output', p_made, p_days_ago, '09:00');
  perform pg_temp.mv(p_item, 'sale_consumption', -p_sold, p_days_ago, '12:00');
  if p_thrown > 0 then
    perform pg_temp.mv(p_item, 'expired', -p_thrown, p_days_ago - case when p_thrown_next_day then 1 else 0 end,
                       '21:00');
  end if;
end $$;
-- The plan for a flavour, and in one line of words.
create function pg_temp.plan(p_recipe text) returns jsonb language sql as $$
  select r from jsonb_array_elements(production_plan() -> 'recipes') r where r ->> 'recipe' = p_recipe
$$;
create function pg_temp.says(p_recipe text) returns text language sql as $$
  select concat_ws(' ', p ->> 'status', 'seen ' || (p ->> 'seen'),
                   'sold out ' || (p ->> 'sold_out_days') || '/' || (p ->> 'weeks'),
                   'thrown ' || (p ->> 'waste_days') || ' (' || (p ->> 'wasted_avg') || ')',
                   '+' || (p ->> 'bump'), '-' || (p ->> 'trim'), 'demand ' || (p ->> 'demand'),
                   'to make ' || (p ->> 'to_make') || ':', (p ->> 'batches') || ' x ' || (p ->> 'batch_yield'),
                   'learned ' || coalesce(p ->> 'learned', '-'))
    from (select pg_temp.plan(p_recipe) p) x
$$;
create function pg_temp.days(p_recipe text) returns text language sql as $$
  select string_agg((d ->> 'used') || case when (d ->> 'sold_out')::boolean then ' out' else '' end
                    || case when (d ->> 'wasted')::numeric > 0 then ' thrown ' || (d ->> 'wasted') else '' end,
                    ', ' order by d ->> 'day' desc)
    from jsonb_array_elements(pg_temp.plan(p_recipe) -> 'days') d
$$;
-- A line of What to buy, and in one line of words.
create function pg_temp.buy(p_name text) returns jsonb language sql as $$
  select e from jsonb_array_elements(buying_list() -> 'items') e where e ->> 'item' = p_name
$$;
create function pg_temp.buys(p_name text) returns text language sql as $$
  select concat_ws(' ', r ->> 'status', 'used ' || (r ->> 'used'), 'wasted ' || (r ->> 'wasted'),
                   'daily ' || coalesce(r ->> 'daily_use', '-'),
                   coalesce(r ->> 'forecast', '-') || ' ' || coalesce(r ->> 'lead_use', '-'),
                   'plan ' || (r ->> 'plan_need') || '/' || (r ->> 'plan_extra'),
                   'reorder ' || coalesce(r ->> 'reorder_level', '-') || ' ' || coalesce(r ->> 'reorder_from', '-'),
                   'up to ' || coalesce(r ->> 'target_level', '-') || ' ' || coalesce(r ->> 'target_from', '-'),
                   case when (r ->> 'capped')::boolean
                        then 'kept to ' || (r ->> 'cap_level') || ' (' || (r ->> 'keeps_days') || ' days)' end,
                   'order ' || (r ->> 'packs') || ' ' || (r ->> 'pack_unit'))
    from (select pg_temp.buy(p_name) r) x
$$;
create function pg_temp.audits(p_action text) returns int language sql security definer as $$
  select count(*)::int from audit_log where action = p_action
$$;

-- Ingredients, and four flavours with their batch recipes.
select test.act_as('owner@example.com');
select create_item('Learn milk', 'ingredient', 'ml', 'volume', p_units => '[{"code":"L","label":"L","factor":1000}]',
  p_opening_qty => 60000, p_opening_unit_cost => 1.5, p_opening_reason => 'the opening count');
select create_item('Learn cocoa', 'ingredient', 'g', 'mass', p_opening_qty => 300, p_opening_unit_cost => 20,
  p_opening_reason => 'the opening count');
select test.as_admin();
create temp table ids as
select (select id from item where name = 'Learn milk') milk, (select id from item where name = 'Learn cocoa') cocoa;
grant select on ids to public;
select test.act_as('owner@example.com');
insert into res select 'CH', save_batch_recipe(null, 'Learn chocolate gelato', '{"measure":"weight"}', 4, 'kg',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 3, 'unit_code', 'L'),
                    jsonb_build_object('item_id', (select cocoa from ids), 'qty', 500, 'unit_code', 'g')),
  null, true, 48);
insert into res select 'LE', save_batch_recipe(null, 'Learn lemon sorbet', '{"measure":"weight"}', 2, 'kg',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 1, 'unit_code', 'L')), null, true, 24);
insert into res select 'MA', save_batch_recipe(null, 'Learn mango sorbet', '{"measure":"weight"}', 2, 'kg',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 1, 'unit_code', 'L')), null, true, 24);
insert into res select 'PI', save_batch_recipe(null, 'Learn pistachio gelato', '{"measure":"weight"}', 2, 'kg',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 1, 'unit_code', 'L')), null, true, 24);
select test.as_admin();
update recipe_version set effective_from = test.today() - 60
 where recipe_id in (pg_temp.id('CH', 'recipe_id'), pg_temp.id('LE', 'recipe_id'), pg_temp.id('MA', 'recipe_id'),
                     pg_temp.id('PI', 'recipe_id'));

-- Four weeks of each, on this weekday (the latest first).
-- Chocolate, a batch of 4 kg: sold out twice; on the two weeks before, what
-- was left was thrown away the next day — not a day the plan judges by.
select pg_temp.day(pg_temp.id('CH', 'item_id'), 7, 4000, 4000);
select pg_temp.day(pg_temp.id('CH', 'item_id'), 14, 4000, 4000);
select pg_temp.day(pg_temp.id('CH', 'item_id'), 21, 4000, 3000, 1000, true);
select pg_temp.day(pg_temp.id('CH', 'item_id'), 28, 4000, 2000, 2000, true);
-- Lemon, batches of 2 kg: two made, 2.5 kg sold, 1.5 kg thrown away that night.
select pg_temp.day(pg_temp.id('LE', 'item_id'), d, 4000, 2500, 1500) from unnest(array[7, 14, 21, 28]) d;
-- Mango: one batch made, 500 g sold, the rest thrown away.
select pg_temp.day(pg_temp.id('MA', 'item_id'), d, 2000, 500, 1500) from unnest(array[7, 14, 21, 28]) d;
-- Pistachio: sold out twice, thrown away once.
select pg_temp.day(pg_temp.id('PI', 'item_id'), 7, 2000, 2000);
select pg_temp.day(pg_temp.id('PI', 'item_id'), 14, 2000, 1500, 500);
select pg_temp.day(pg_temp.id('PI', 'item_id'), 21, 2000, 2000);
select pg_temp.day(pg_temp.id('PI', 'item_id'), 28, 2000, 1800, 200, true);

-- ------------------------------------------------------------------ the day's plan learns
select test.act_as('barista@example.com');
select test.eq(pg_temp.days('Learn chocolate gelato'), '4000 out, 4000 out, 3000, 2000',
  'each day it judges by says whether it sold out: next to nothing left that night, and none thrown away');
select test.eq(pg_temp.says('Learn chocolate gelato'),
  'make seen 3250 sold out 2/4 thrown 0 (0) +2000 -0 demand 5250 to make 5250: 2 x 4000 learned sold_out',
  'chocolate sold out on two of four days, never thrown away: half a batch more, so two batches where what it sold alone would make one');
select test.eq(pg_temp.days('Learn lemon sorbet'),
  '2500 thrown 1500, 2500 thrown 1500, 2500 thrown 1500, 2500 thrown 1500', 'and what was thrown away unsold');
select test.eq(pg_temp.says('Learn lemon sorbet'),
  'make seen 2500 sold out 0/4 thrown 4 (1500) +0 -500 demand 2500 to make 2000: 1 x 2000 learned waste',
  'lemon thrown away every time, never sold out: made the less, but never below one batch — one, not two');
select test.eq(pg_temp.says('Learn mango sorbet'),
  'make seen 500 sold out 0/4 thrown 4 (1500) +0 -0 demand 500 to make 500: 1 x 2000 learned -',
  'mango thrown away every time, but one batch is the least there is: nothing learnt, one batch still');
select test.eq(pg_temp.says('Learn pistachio gelato'),
  'make seen 1825 sold out 2/4 thrown 1 (125) +0 -0 demand 1825 to make 1825: 1 x 2000 learned -',
  'pistachio sold out and was thrown away too: no clear lesson, the plan is what it sold');
select test.eq((select string_agg((i ->> 'item') || ' ' || (i ->> 'needed'), ', ' order by i ->> 'item')
                  from jsonb_array_elements(production_plan() -> 'ingredients') i),
  'Learn cocoa 1000, Learn milk 9000', 'the batches it plans need their ingredients: two of chocolate, one of each sorbet');

-- ------------------------------------------------------------------ What to buy looks ahead
-- Cocoa: no history of its own, but today's plan needs a kilo.
select test.act_as('manager@example.com');
select test.eq(pg_temp.buys('Learn cocoa'),
  'order used 0 wasted 0 daily - - - plan 1000/1000 reorder 1000 plan up to 1000 reorder order 700 g',
  'an ingredient with no use yet that today''s plan needs is bought for it: 300 g on hand, 700 g more');

-- Cones, opened 30 days ago: used only on this weekday (2,800 each of the
-- last three weeks) and 700 once on another; 1,400 broken and thrown away.
select test.as_admin();
insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock) values
  ('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'L-CONE', 'Learn cones', 'packaging', 'each', 'count', false),
  ('c0000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 'L-CREAM', 'Learn cream', 'ingredient', 'ml', 'volume', false);
insert into item_unit (item_id, code, label, dimension, factor_to_base) values
  ('c0000000-0000-0000-0000-0000000000c2', 'carton_1l', 'Carton of 1 L', 'volume', 1000);
select pg_temp.mv('c0000000-0000-0000-0000-0000000000c1', 'opening_balance', 12000, 30, '09:00');
select pg_temp.mv('c0000000-0000-0000-0000-0000000000c1', 'sale_consumption', -2800, d, '12:00') from unnest(array[7, 14, 21]) d;
select pg_temp.mv('c0000000-0000-0000-0000-0000000000c1', 'sale_consumption', -700, 10, '12:00');
select pg_temp.mv('c0000000-0000-0000-0000-0000000000c1', 'waste', -1400, 14, '20:00');
select test.act_as('manager@example.com');
select test.eq(pg_temp.buys('Learn cones'),
  'order used 9100 wasted 1400 daily 325 weekday 2100 plan 0/0 reorder 2100 use up to 4375 week order 2875 each',
  'cones: use without what was thrown away (shown apart), and today and tomorrow judged each by its weekday — 2,100 for today, none tomorrow — where 325 a day would have said 650, and enough');

-- Cocoa again, with four weeks of batches behind it on this weekday: what
-- today's plan needs beyond what those batches use is added.
select test.as_admin();
select pg_temp.mv((select cocoa from ids), 'opening_balance', 1500, 30, '08:00');
select pg_temp.mv((select cocoa from ids), 'production_consumption', -500, d, '09:00') from unnest(array[7, 14, 21]) d;
select test.act_as('manager@example.com');
select test.eq(pg_temp.buys('Learn cocoa'),
  'order used 1500 wasted 0 daily 53.571 weekday 375 plan 1000/625 reorder 1000 use up to 1375 week order 1075 g',
  'its weekday''s batches use 375 g; today''s plan needs 1,000: the 625 beyond is added to what the days ahead use');

-- Cream, 20 days of a litre a day, from the dairy by the carton, a par level of 10 L.
select test.as_admin();
select pg_temp.mv('c0000000-0000-0000-0000-0000000000c2', 'opening_balance', 20500, 20, '09:00');
select pg_temp.mv('c0000000-0000-0000-0000-0000000000c2', 'sale_consumption', -1000, d, '12:00')
  from generate_series(1, 20) d;
select test.act_as('manager@example.com');
select update_item('c0000000-0000-0000-0000-0000000000c2', 'Learn cream', 'ingredient', p_par_level => 10000);
select set_item_supplier('c0000000-0000-0000-0000-0000000000c2',
  (select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' and name = 'Sulaymaniyah Dairy Co.'),
  'carton_1l', 1500, true, gen_random_uuid());
select test.eq(pg_temp.buys('Learn cream'),
  'order used 20000 wasted 0 daily 1000 average 2000 plan 0/0 reorder 2000 use up to 10000 par order 10 carton_1l',
  'cream, with less than four weeks behind it, judged a day on average: up to its par level, ten cartons');

-- ------------------------------------------------------------------ how long it keeps
select test.act_as('cashier@example.com');
select test.throws($$select set_item_keeps('c0000000-0000-0000-0000-0000000000c2', 3)$$, '%permission%',
  'a cashier does not say how long an item keeps');
select test.act_as('barista@example.com');
select test.throws($$select set_item_keeps('c0000000-0000-0000-0000-0000000000c2', 3)$$, '%permission%', 'nor a barista');
select test.act_as('manager@example.com');
select test.throws($$select set_item_keeps('c0000000-0000-0000-0000-0000000000c2', 0)$$,
  'An item keeps 1 to 365 days, or say nothing', 'it keeps a day at least');
select test.throws($$select set_item_keeps('c0000000-0000-0000-0000-0000000000c2', 366)$$,
  'An item keeps 1 to 365 days, or say nothing', 'and a year at most');
select test.throws(format('select set_item_keeps(%L, 3)', gen_random_uuid()), 'Unknown item', 'an item not the café''s');
insert into res select 'K1', set_item_keeps('c0000000-0000-0000-0000-0000000000c2', 3, 'e0000000-0000-0000-0000-000000000700');
insert into res select 'K2', set_item_keeps('c0000000-0000-0000-0000-0000000000c2', 3, 'e0000000-0000-0000-0000-000000000700');
select set_item_keeps('c0000000-0000-0000-0000-0000000000c2', 3);
select test.eq(pg_temp.r('K2'), pg_temp.r('K1') || '{"replayed": true}', 'sent twice, set once: the second is the first, replayed');
select test.eq(pg_temp.audits('item.keeps'), 1, 'on the audit trail once: the same again changes nothing');
select test.as_admin();
select test.eq((select coalesce(before_state ->> 'keeps_days', 'none') || '→' || (after_state ->> 'keeps_days')
                       || ' ' || (after_state ->> 'name')
                  from audit_log where action = 'item.keeps'), 'none→3 Learn cream', 'what it was and what it is');
select test.act_as('manager@example.com');
select test.eq(pg_temp.buys('Learn cream'),
  'order used 20000 wasted 0 daily 1000 average 2000 plan 0/0 reorder 2000 use up to 3000 par kept to 3000 (3 days) order 2 carton_1l',
  'cream keeps three days: up to no more than three days use, 3 L; with 500 ml on hand, two cartons, rounded down');
select set_item_keeps('c0000000-0000-0000-0000-0000000000c2', 1);
select test.eq(pg_temp.buys('Learn cream'),
  'order used 20000 wasted 0 daily 1000 average 2000 plan 0/0 reorder 2000 use up to 2000 par kept to 1000 (1 days) order 2 carton_1l',
  'keeping a day, it is still ordered up to its reorder level, to last until the next delivery');
select set_item_keeps('c0000000-0000-0000-0000-0000000000c2', null);
select test.eq(pg_temp.buys('Learn cream'),
  'order used 20000 wasted 0 daily 1000 average 2000 plan 0/0 reorder 2000 use up to 10000 par order 10 carton_1l',
  'how long it keeps taken away: up to its par level again');
select test.eq(pg_temp.audits('item.keeps'), 3, 'each change on the trail');
select set_item_keeps('c0000000-0000-0000-0000-0000000000c2', 3);

-- ------------------------------------------------------------------ a week's waste
-- This week the cream: 600 ml spoilt, 400 ml thrown away, and 250 ml thrown
-- away and taken back on review; a carton dropped is a loss, not waste.
select test.as_admin();
select pg_temp.mv('c0000000-0000-0000-0000-0000000000c2', 'spoilage', -600, 2, '18:00', 2);
select pg_temp.mv('c0000000-0000-0000-0000-0000000000c2', 'waste', -400, 5, '18:00', 2);
insert into res select 'W3', jsonb_build_object('mv', pg_temp.mv('c0000000-0000-0000-0000-0000000000c2', 'waste', -250, 3, '18:00', 2));
insert into loss_review (id, business_id, movement_id, decision, reason, decided_by)
values ('e0000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-0000000000b1', pg_temp.id('W3', 'mv'), 'reversed',
        'Found in the back', (select id from app_user where email = 'manager@example.com'));
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                reference_type, reference_id, reason, occurred_at)
values ('00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000c2', pg_temp.loc(), 'reversal', 250, 2,
        500, 'loss_review', 'e0000000-0000-0000-0000-000000000701', 'Loss reversed: Found in the back', pg_temp.at(3, '19:00'));
select pg_temp.mv('c0000000-0000-0000-0000-0000000000c2', 'damaged', -100, 3, '10:00', 2);
select test.act_as('manager@example.com');
select test.eq((select (r ->> 'used') || ' used, ' || (r ->> 'wasted') || ' thrown away'
                  from (select pg_temp.buy('Learn cream') r) x), '20100 used, 1000 thrown away',
  'What to buy: what was thrown away apart, the loss taken back with it, and the dropped carton still use');

select test.act_as('cashier@example.com');
select test.throws('select waste_coach()', '%cost.view%', 'a cashier does not see what waste cost');
select test.act_as('barista@example.com');
select test.throws('select waste_coach()', '%cost.view%', 'nor a barista');
select test.act_as('manager@example.com');
insert into res select 'WC', waste_coach();
select test.eq((pg_temp.r('WC') ->> 'from')::date || ' to ' || (pg_temp.r('WC') ->> 'to')::date,
  (test.today() - 6) || ' to ' || test.today(), 'the seven days to today');
select test.eq((pg_temp.r('WC') ->> 'value') || ' against ' || (pg_temp.r('WC') ->> 'value_before'), '2000 against 3000',
  'what was thrown away cost 2,000 this week, against 3,000 the week before');
select test.eq((select string_agg(concat_ws(' ', i ->> 'item', (i ->> 'qty') || '/' || (i ->> 'qty_before'),
                                            (i ->> 'value') || '/' || (i ->> 'value_before'), (i ->> 'times') || 'x',
                                            case when (i ->> 'made')::boolean then 'made' else 'bought' end,
                                            coalesce(i ->> 'keeps_days', '-')), ', ' order by n)
                  from jsonb_array_elements(pg_temp.r('WC') -> 'items') with ordinality e(i, n)),
  'Learn cream 1000/0 2000/0 2x bought 3, Learn lemon sorbet 0/1500 0/1500 0x made -, Learn mango sorbet 0/1500 0/1500 0x made -',
  'item by item, the costliest first: the cream this week (the loss taken back not counted), the sorbets the week before');
select test.eq((select i -> 'weekdays' from jsonb_array_elements(pg_temp.r('WC') -> 'items') i where i ->> 'item' = 'Learn cream'),
  (select jsonb_agg(d order by d) from (select distinct extract(isodow from test.today() - k)::int d
                                          from unnest(array[2, 5]) k) x),
  'and on which weekdays');
select test.eq((select (w ->> 'value') || ' against ' || (w ->> 'value_before')
                  from (select waste_coach(test.today() - 7, pg_temp.loc()) w) x), '3000 against 5900',
  'a week ago, at the branch: the sorbets, against the sorbets, chocolate, pistachio and the cones the week before that');
