-- =============================================================================
-- Batches, use-by dates and lots (0046, release U): each batch numbered, used
-- by its recipe's shelf life or a date given, and made into a lot of its own;
-- what leaves a tracked item taken from its lots — stock with no lot first,
-- then the batch used by first, what is past its use-by last, except when it
-- is thrown away as expired or found missing on a count; what comes back going
-- back to the lot it left (a void, a refund back on the shelf, a loss taken
-- back, a batch cancelled); what was sold beyond the stock there was taken from
-- the next batch; a batch accounted for (made = sold + lost ± counted + left);
-- the lots near their use-by, as a list and as alerts; a batch recorded late,
-- by a manager, with a reason; and the day's plan, from what each flavour sold
-- on that weekday in the weeks before.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
-- A barista, who makes the gelato.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000e', 'barista@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000000e');
insert into user_role (app_user_id, role) select id, 'barista' from app_user where email = 'barista@example.com';

create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;

-- Ingredients, and the vanilla gelato, of which a kilo was on the shelf before
-- it was made here (bought in, in tubs that go back on the shelf when refunded).
select test.act_as('owner@example.com');
select create_item('Golden milk', 'ingredient', 'ml', 'volume', p_units => '[{"code":"L","label":"L","factor":1000}]',
  p_opening_qty => 60000, p_opening_unit_cost => 1.5, p_opening_reason => 'the opening count');
select create_item('Golden sugar', 'ingredient', 'g', 'mass', p_units => '[{"code":"kg","label":"kg","factor":1000}]',
  p_opening_qty => 10000, p_opening_unit_cost => 1.2, p_opening_reason => 'the opening count');
select create_item('Golden cocoa', 'ingredient', 'g', 'mass', p_opening_qty => 300, p_opening_unit_cost => 20,
  p_opening_reason => 'the opening count');
select create_item('Golden vanilla gelato', 'finished_good', 'g', 'mass',
  p_units => '[{"code":"kg","label":"kg","factor":1000}]', p_opening_qty => 1000, p_opening_unit_cost => 2,
  p_returnable => true, p_opening_reason => 'the opening count');
select test.as_admin();
create temp table ids as
select (select id from item where name = 'Golden milk') milk, (select id from item where name = 'Golden sugar') sugar,
       (select id from item where name = 'Golden cocoa') cocoa,
       (select id from item where name = 'Golden vanilla gelato') vanilla,
       default_location('00000000-0000-0000-0000-0000000000b1') loc,
       (select timezone from business where id = '00000000-0000-0000-0000-0000000000b1') tz;
grant select on ids to public;

-- What each lot of an item holds, stock with no lot as "-": "-=1000, B1=5000".
create function pg_temp.lots(p_item uuid) returns text language sql security definer as $$
  select coalesce(string_agg(coalesce(l.lot_code, '-') || '=' || trim_scale(x.q), ', '
                             order by l.created_at nulls first, l.lot_code), 'none')
    from (select lot_id, sum(base_qty) q from lot_movement where item_id = p_item
           group by lot_id having sum(base_qty) <> 0) x
    left join item_lot l on l.id = x.lot_id
$$;
-- How one movement was split by lot: "-=-1000, B2=-200".
create function pg_temp.split(p_movement uuid) returns text language sql security definer as $$
  select coalesce(string_agg(coalesce(l.lot_code, '-') || '=' || trim_scale(x.q), ', '
                             order by l.created_at nulls first, l.lot_code), 'none')
    from (select lot_id, sum(base_qty) q from lot_movement where movement_id = p_movement
           group by lot_id having sum(base_qty) <> 0) x
    left join item_lot l on l.id = x.lot_id
$$;
-- A sale's movement of the vanilla gelato.
create function pg_temp.sale_mv(p text) returns uuid language sql security definer as $$
  select id from inventory_movement
   where reference_type = 'sales_order' and type = 'sale_consumption' and reference_id = pg_temp.id(p, 'order_id')
     and item_id = (select vanilla from ids)
$$;
-- Every tracked item's rows add up, at each place, to its stock there; each
-- lot holds what its rows say, and none holds less than nothing.
create function pg_temp.balanced() returns boolean language sql security definer as $$
  select not exists (
           select 1 from item i join location l on l.business_id = i.business_id
            where i.track_lot
              and coalesce((select sum(base_qty) from lot_movement lm where lm.item_id = i.id and lm.location_id = l.id), 0)
                  <> (item_position(i.business_id, i.id, l.id)).qty)
     and not exists (
           select 1 from item_lot lot
            where lot.left_base <> coalesce((select sum(base_qty) from lot_movement lm where lm.lot_id = lot.id), 0)
               or lot.left_base < 0)
     and not exists (
           select 1 from inventory_movement m join item i on i.id = m.item_id
            where i.track_lot and m.type::text <> 'cost_adjustment'
              and exists (select 1 from lot_movement lm where lm.movement_id = m.id)
              and (select sum(base_qty) from lot_movement lm where lm.movement_id = m.id) <> m.base_quantity_signed)
$$;
-- The end of the business's today, as a moment.
create function pg_temp.day_end() returns timestamptz language sql security definer as $$
  select (test.today() + 1)::timestamp at time zone (select tz from ids)
$$;
-- A lot's alert, as the dashboard would open it.
create function pg_temp.alert(p_batch text) returns text language sql security definer as $$
  select c.urgency || ': ' || c.title
    from alert_conditions('00000000-0000-0000-0000-0000000000b1', now()) c
   where c.rule = 'use_by'
     and c.subject = (select output_lot_id::text from production_batch where id = pg_temp.id(p_batch, 'batch_id'))
$$;

-- ------------------------------------------------------------------ a recipe that keeps
select test.act_as('owner@example.com');
insert into res select 'V', save_batch_recipe(null, 'Golden vanilla gelato',
  jsonb_build_object('item_id', (select vanilla from ids)), 5, 'kg',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 4, 'unit_code', 'L'),
                    jsonb_build_object('item_id', (select sugar from ids), 'qty', 800, 'unit_code', 'g')),
  'Churn slowly', true, 72);
select test.throws($$select save_batch_recipe(pg_temp.id('V', 'recipe_id'), 'Golden vanilla gelato', null, 5, 'kg',
  null, 'Churn slowly', true, 9000)$$, '%keeps for an hour to a year%', 'a shelf life is an hour to a year');
select test.as_admin();
-- It was set up weeks ago: a batch made yesterday is made by it.
update recipe_version set effective_from = test.today() - 60 where recipe_id = pg_temp.id('V', 'recipe_id');
select test.eq((select after_state ->> 'keeps_hours' from audit_log
                 where action = 'recipe.batch.create' and entity_id = pg_temp.id('V', 'recipe_id')::text), '72',
  'how long it keeps is on the trail');
select test.act_as('barista@example.com');
select test.eq((select shelf_life_hours from production_recipes() where recipe_id = pg_temp.id('V', 'recipe_id')), 72,
  'the barista sees how long what it makes keeps');
select test.as_admin();
select test.ok(not (select track_lot from item where id = (select vanilla from ids)), 'not tracked by lot before it is made');

-- ------------------------------------------------------------------ batches: a number, a use-by, a lot
-- Batch 1: as the recipe says, used by 72 hours on.
select test.act_as('barista@example.com');
insert into res select 'B1', record_production(pg_temp.id('V', 'recipe_id'), 1);
select test.eq((pg_temp.r('B1') ->> 'batch_no') || ' ' || (pg_temp.r('B1') ->> 'lot'), '1 B1',
  'the first batch is number 1, and its lot is named for it');
select test.eq((pg_temp.r('B1') ->> 'use_by')::timestamptz - (pg_temp.r('B1') ->> 'produced_at')::timestamptz,
  interval '72 hours', 'used by 72 hours after it was made, as the recipe keeps');
select test.as_admin();
select test.ok((select track_lot from item where id = (select vanilla from ids)),
  'what a batch makes is tracked by lot from its first batch');
select test.eq((select reason from audit_log where action = 'item.update' and entity_id = (select vanilla from ids)::text
                  and after_state ? 'track_lot'), 'Made in batches: its stock is kept batch by batch from this batch on',
  'with why, on the audit trail');
select test.eq(pg_temp.lots((select vanilla from ids)), '-=1000, B1=5000',
  'the kilo it had is stock with no lot; the batch is in its lot');
select test.ok((select movement_id is null from lot_movement where item_id = (select vanilla from ids) and lot_id is null),
  'the kilo is kept as what it had when it began to be tracked');
select test.eq((select use_by = (pg_temp.r('B1') ->> 'use_by')::timestamptz and expiry_date = business_local_date(business_id, use_by)
                         and production_batch_id = pg_temp.id('B1', 'batch_id') and location_id = (select loc from ids)
                  from item_lot where lot_code = 'B1'), true, 'the lot keeps the batch, its use-by and its place');

-- Batch 2: 4.8 kg came out, to be used within 30 hours.
select test.act_as('manager@example.com');
insert into res select 'B2', record_production(pg_temp.id('V', 'recipe_id'), 1, 4.8, 'kg', 'a little short',
  p_use_by => now() + interval '30 hours');
select test.eq((pg_temp.r('B2') ->> 'batch_no')::int, 2, 'numbered in turn');

-- ------------------------------------------------------------------ a batch made earlier
select test.act_as('barista@example.com');
select test.throws($$select record_production(pg_temp.id('V', 'recipe_id'), 1, p_produced_at => now() - interval '2 hours',
  p_late_reason => 'forgot')$$, '%made earlier is recorded by a manager%', 'a barista records a batch as it is made');
select test.act_as('manager@example.com');
select test.throws($$select record_production(pg_temp.id('V', 'recipe_id'), 1, p_produced_at => now() - interval '2 hours')$$,
  '%why the batch is recorded late%', 'a manager says why it is late');
select test.throws($$select record_production(pg_temp.id('V', 'recipe_id'), 1, p_produced_at => now() - interval '50 hours',
  p_late_reason => 'forgot')$$, '%late by a day at most%', 'yesterday''s at the earliest');
select test.throws($$select record_production(pg_temp.id('V', 'recipe_id'), 1, p_produced_at => now() + interval '1 hour')$$,
  '%once it is made, not before%', 'not a batch still to make');
select test.throws($$select record_production(pg_temp.id('V', 'recipe_id'), 1, p_use_by => now() - interval '1 minute')$$,
  '%use-by is after the batch was made%', 'used by after it was made');
-- Batch 3: a kilo made three hours ago, past its use-by an hour ago, recorded now.
insert into res select 'B3', record_production(pg_temp.id('V', 'recipe_id'), 1, 1, 'kg', null,
  p_produced_at => now() - interval '3 hours', p_use_by => now() - interval '1 hour',
  p_late_reason => 'Made this morning, recorded late');
select test.as_admin();
select test.eq((select batch_no || ': ' || late_reason from production_batch where id = pg_temp.id('B3', 'batch_id')),
  '3: Made this morning, recorded late', 'a batch recorded late keeps why');
select test.ok((select bool_and(m.occurred_at = b.produced_at) and min(b.produced_at) < min(b.created_at) - interval '2 hours'
                  from inventory_movement m join production_batch b on b.id = m.reference_id
                 where b.id = pg_temp.id('B3', 'batch_id')), 'its stock moved when it was made');
select test.eq((select reason || ' / ' || (after_state ? 'made_at')::text from audit_log
                 where action = 'production.record' and entity_id = pg_temp.id('B3', 'batch_id')::text),
  'Made this morning, recorded late / true', 'on the audit trail with the time it was made and why');
select test.eq(pg_temp.lots((select vanilla from ids)), '-=1000, B1=5000, B2=4800, B3=1000', 'each batch in its lot');

-- ------------------------------------------------------------------ what leaves, from which lot
select test.act_as('owner@example.com');
insert into res select 'TUB', create_product('Golden vanilla tub', '{"dine_in": 2000}',
  jsonb_build_array(jsonb_build_object('item_id', (select vanilla from ids), 'qty', 100, 'unit_code', 'g')));

-- Twelve tubs: the kilo with no lot, then batch 2 (used by first); batch 3 is past its use-by.
select test.act_as('cashier@example.com');
insert into res select 'S1', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  jsonb_build_array(jsonb_build_object('variant_id', pg_temp.id('TUB', 'variant_id'), 'qty', 12)));
select test.as_admin();
select test.eq(pg_temp.split(pg_temp.sale_mv('S1')), '-=-1000, B2=-200',
  'a sale takes stock with no lot first, then the batch used by first, and not one past its use-by');

-- Thrown away as expired: off the batch past its use-by. Melted: off the batch used by first.
select test.act_as('manager@example.com');
insert into res select 'W1', record_waste((select vanilla from ids), 400, 'g', 'expired', 'Past its use-by');
insert into res select 'W2', record_waste((select vanilla from ids), 300, 'g', 'spoilage', 'Melted in the display');
select test.as_admin();
select test.eq(pg_temp.split(pg_temp.id('W1', 'movement_id')), 'B3=-400', 'what is thrown away as expired comes off the batch past its use-by');
select test.eq(pg_temp.split(pg_temp.id('W2', 'movement_id')), 'B2=-300', 'any other loss comes off the batch used by first');
select test.eq(pg_temp.lots((select vanilla from ids)), 'B1=5000, B2=4300, B3=600', 'and each lot holds what is left of it');

-- A sale voided goes back to the batch it came from.
select test.act_as('cashier@example.com');
insert into res select 'S2', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  jsonb_build_array(jsonb_build_object('variant_id', pg_temp.id('TUB', 'variant_id'), 'qty', 3)));
select test.act_as('manager@example.com');
select void_sale(pg_temp.id('S2', 'order_id'), 'Rang the wrong item', 'rang_wrong_item');
select test.as_admin();
select test.eq(pg_temp.split(pg_temp.sale_mv('S2')) || ' / ' ||
               pg_temp.split((select id from inventory_movement where reference_type = 'sale_void'
                                and reference_id = pg_temp.id('S2', 'order_id'))),
  'B2=-300 / B2=300', 'a void puts back in the batch what it took from it');

-- Fifty tubs take the rest of batch 2 and some of batch 1; 48 are refunded, back
-- on the shelf: to the batch used by first, as far as the sale took from it.
select test.act_as('cashier@example.com');
insert into res select 'S3', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  jsonb_build_array(jsonb_build_object('variant_id', pg_temp.id('TUB', 'variant_id'), 'qty', 50)));
select test.as_admin();
select test.eq(pg_temp.split(pg_temp.sale_mv('S3')), 'B1=-700, B2=-4300', 'past the end of one batch, into the next');
create temp table s3_line as select id from sales_order_line where sales_order_id = pg_temp.id('S3', 'order_id');
grant select on s3_line to public;
select test.act_as('owner@example.com');
select set_business_rule('refund_approval_over', 'business', null, '200000', 'Tubs come back whole');
select test.act_as('manager@example.com');
insert into res select 'R3', refund_sale_lines(pg_temp.id('S3', 'order_id'),
  jsonb_build_array(jsonb_build_object('line_id', (select id from s3_line), 'qty', 48)), 'changed_mind');
select test.as_admin();
select test.eq(pg_temp.split((select id from inventory_movement where type = 'refund_return_to_stock'
                                and sales_order_line_id = (select id from s3_line))),
  'B1=500, B2=4300', 'a refund back on the shelf goes to the lots the sale took from, the one used by first first');

-- A loss waiting for a manager, taken back: back to the batch it came off.
select test.act_as('owner@example.com');
select set_business_rule('waste_approval_over', 'business', null, '100', 'Every loss is looked at');
select test.act_as('barista@example.com');
insert into res select 'W3', record_waste((select vanilla from ids), 200, 'g', 'spoilage', 'Dropped a pan', p_wait => true);
select test.eq(pg_temp.r('W3') ->> 'status', 'pending', 'the loss waits for a manager');
select test.act_as('manager@example.com');
select review_loss(pg_temp.id('W3', 'movement_id'), 'reverse', 'The pan was found whole');
select test.as_admin();
select test.eq(pg_temp.split(pg_temp.id('W3', 'movement_id')) || ' / ' ||
               pg_temp.split((select reversal_movement_id from loss_review where movement_id = pg_temp.id('W3', 'movement_id'))),
  'B2=-200 / B2=200', 'a loss taken back goes back to the batch it came off');
select test.eq(pg_temp.lots((select vanilla from ids)), 'B1=4800, B2=4300, B3=600', 'the lots after it all');
select test.ok(pg_temp.balanced(), 'the lots add up to the stock, movement by movement');

-- ------------------------------------------------------------------ counted
-- 500 g missing on a count: off the batch past its use-by first.
select test.act_as('counter@example.com');
insert into res select 'C1', jsonb_build_object('id', start_stock_count(array[(select vanilla from ids)]));
select record_count(pg_temp.id('C1', 'id'), (select vanilla from ids), 9.2, 'kg');
select submit_stock_count(pg_temp.id('C1', 'id'));
select test.act_as('manager@example.com');
select approve_stock_count(pg_temp.id('C1', 'id'));
select test.as_admin();
select test.eq(pg_temp.split((select adjustment_movement_id from stock_count_line where stock_count_id = pg_temp.id('C1', 'id'))),
  'B3=-500', 'what a count finds missing comes off the batch past its use-by first');
-- A batch made before a count approved since is not recorded now: the count saw it already.
select test.act_as('manager@example.com');
select test.throws($$select record_production(pg_temp.id('V', 'recipe_id'), 1, p_produced_at => now() - interval '2 hours',
  p_late_reason => 'forgot')$$, '%count of its items was approved after that time%',
  'not before the last approved count of its items');
-- 200 g more than the books on the next count: stock with no lot.
select test.act_as('counter@example.com');
insert into res select 'C2', jsonb_build_object('id', start_stock_count(array[(select vanilla from ids)]));
select record_count(pg_temp.id('C2', 'id'), (select vanilla from ids), 9.4, 'kg');
select submit_stock_count(pg_temp.id('C2', 'id'));
select test.act_as('manager@example.com');
select approve_stock_count(pg_temp.id('C2', 'id'));
select test.as_admin();
select test.eq(pg_temp.split((select adjustment_movement_id from stock_count_line where stock_count_id = pg_temp.id('C2', 'id'))),
  '-=200', 'what a count finds over the books is stock with no lot');
select test.eq(pg_temp.lots((select vanilla from ids)), '-=200, B1=4800, B2=4300, B3=100', 'the lots after the counts');

-- ------------------------------------------------------------------ near and past the use-by
select test.act_as('barista@example.com');
select test.eq((select string_agg((l ->> 'lot') || ' ' || (l ->> 'status') || ' ' || (l ->> 'left'), ', ' order by n)
                  from jsonb_array_elements(production_lots()) with ordinality x(l, n)),
  'B3 expired 100, B2 good 4300, B1 good 4800', 'Production lists the lots, the one used by first first');
select test.as_admin();
select test.eq(pg_temp.alert('B3'), 'red: Golden vanilla gelato, batch 3, is past its use-by: 100 g left',
  'a batch past its use-by with stock left is a red alert');
select test.eq(coalesce(pg_temp.alert('B2'), 'none'), 'none', 'a batch good for more than a day is not');

-- Batch 2 set soft: to be used within two hours.
select test.act_as('barista@example.com');
select test.throws($$select set_batch_use_by(pg_temp.id('B2', 'batch_id'), now() + interval '2 hours', 'soft')$$,
  '%permission%', 'a barista does not change a use-by');
select test.act_as('manager@example.com');
select test.throws($$select set_batch_use_by(pg_temp.id('B2', 'batch_id'), now() + interval '2 hours', ' ')$$,
  '%why the use-by changes%', 'a manager says why');
select test.throws($$select set_batch_use_by(pg_temp.id('B2', 'batch_id'), now() - interval '3 days', 'typo')$$,
  '%use-by is after the batch was made%', 'still after it was made');
insert into res select 'U2', jsonb_build_object('at', now() + interval '2 hours');
select set_batch_use_by(pg_temp.id('B2', 'batch_id'), (pg_temp.r('U2') ->> 'at')::timestamptz, 'It set soft: sell it today',
  'e0000000-0000-0000-0000-000000000461');
select set_batch_use_by(pg_temp.id('B2', 'batch_id'), (pg_temp.r('U2') ->> 'at')::timestamptz, 'It set soft: sell it today',
  'e0000000-0000-0000-0000-000000000461');
select test.as_admin();
select test.eq((select count(*) from audit_log where action = 'production.use_by')::int, 1,
  'the change is on the audit trail once, sent twice');
select test.eq((select l.use_by = b.use_by and l.expiry_date = b.expiry_date from item_lot l
                  join production_batch b on b.id = l.production_batch_id where b.id = pg_temp.id('B2', 'batch_id')),
  true, 'the lot is used by when the batch is');
select test.eq(pg_temp.alert('B2'), (select 'orange: Golden vanilla gelato, batch 2, is to be used by '
                                            || to_char(use_by at time zone (select tz from ids), 'DD Mon HH24:MI')
                                            || ': 4300 g left'
                                       from production_batch where id = pg_temp.id('B2', 'batch_id')),
  'a batch to be used within a day is an orange alert, with when');
select test.act_as('barista@example.com');
select test.eq((select l ->> 'status' from jsonb_array_elements(production_lots()) l where l ->> 'lot' = 'B2'),
  case when (pg_temp.r('U2') ->> 'at')::timestamptz <= pg_temp.day_end() then 'today' else 'soon' end,
  'due today, or within a day');

-- ------------------------------------------------------------------ sold beyond the stock, then made
-- Everything is sold, and 600 g more than there was: the last of batch 3 only
-- when nothing else is left, and the 600 g below zero with no lot.
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', (select vanilla from ids)::text, '"allow"', 'Sold before it is recorded');
select test.act_as('cashier@example.com');
insert into res select 'S4', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  jsonb_build_array(jsonb_build_object('variant_id', pg_temp.id('TUB', 'variant_id'), 'qty', 100)));
select test.as_admin();
select test.eq(pg_temp.split(pg_temp.sale_mv('S4')), '-=-800, B1=-4800, B2=-4300, B3=-100',
  'what is past its use-by goes last; beyond the stock, below zero with no lot');
select test.eq(pg_temp.lots((select vanilla from ids)), '-=-600', 'the books are 600 g below zero');
select test.eq(coalesce(pg_temp.alert('B3'), 'none'), 'none', 'a batch with nothing left is no longer an alert');
-- Batch 4, recorded after: the 600 g sold from it.
select test.act_as('barista@example.com');
insert into res select 'B4', record_production(pg_temp.id('V', 'recipe_id'), 1);
select test.as_admin();
select test.eq(pg_temp.lots((select vanilla from ids)), 'B4=4400', 'what was sold beyond the stock is taken from the next batch');
select test.eq(pg_temp.split(pg_temp.sale_mv('S4')), '-=-200, B1=-4800, B2=-4300, B3=-100, B4=-600',
  'as part of the sale that took it');
select test.eq((select (s ->> 'made') || ' made, ' || (s ->> 'sold') || ' sold, ' || (s ->> 'left') || ' left'
                  from lot_story((select output_lot_id from production_batch where id = pg_temp.id('B4', 'batch_id'))) s),
  '5000 made, 600 sold, 4400 left', 'and batch 4 shows it sold');
select test.ok(pg_temp.balanced(), 'the lots still add up to the stock');

-- ------------------------------------------------------------------ cancelled
select test.act_as('manager@example.com');
select test.throws($$select cancel_production(pg_temp.id('B4', 'batch_id'), 'Recorded twice')$$,
  '%already been used or sold%', 'a batch some of which was sold is not taken back');
insert into res select 'B5', record_production(pg_temp.id('V', 'recipe_id'), 1);
select cancel_production(pg_temp.id('B5', 'batch_id'), 'Recorded twice');
select test.as_admin();
select test.eq(pg_temp.split((select id from inventory_movement where type = 'reversal' and reference_type = 'production_cancel'
                                and reference_id = pg_temp.id('B5', 'batch_id') and item_id = (select vanilla from ids))),
  'B5=-5000', 'a batch cancelled takes what it made out of its own lot');
select test.eq(pg_temp.lots((select vanilla from ids)), 'B4=4400', 'and nothing else');

-- ------------------------------------------------------------------ a batch accounted for
select test.act_as('barista@example.com');
select test.eq((select (s ->> 'made') || ' = ' || (s ->> 'sold') || ' sold + ' || (s ->> 'lost') || ' lost - '
                       || (s ->> 'counted') || ' counted + ' || (s ->> 'left') || ' left'
                  from (select batch_reconciliation(pg_temp.id('B3', 'batch_id')) -> 'story' s) x),
  '1000 = 100 sold + 400 lost - -500 counted + 0 left', 'batch 3: made = sold + lost ± counted + left');
select test.eq((select (s ->> 'made') || ' = ' || (s ->> 'sold') || ' sold + ' || (s ->> 'lost') || ' lost + '
                       || (s ->> 'left') || ' left'
                  from (select batch_reconciliation(pg_temp.id('B2', 'batch_id')) -> 'story' s) x),
  '4800 = 4500 sold + 300 lost + 0 left', 'batch 2: what was voided, refunded or taken back counts once');
select test.eq((select jsonb_array_length(r -> 'movements') || ' movements, ' || (r ->> 'lot') || ', by ' || (r ->> 'made_by')
                  from (select batch_reconciliation(pg_temp.id('B2', 'batch_id')) r) x),
  '10 movements, B2, by Demo Manager', 'each movement of its lot, and who made it');
select test.eq((select string_agg(batch_no || ':' || coalesce(trim_scale(left_base)::text, '-') || ':' || status, ', ' order by batch_no)
                  from production_batches()),
  '1:0:completed, 2:0:completed, 3:0:completed, 4:4400:completed, 5:0:cancelled',
  'the batches, each with its number and what is left of it');
select test.eq((select late_reason from production_batches() where batch_no = 3), 'Made this morning, recorded late',
  'and why one was recorded late');

-- ------------------------------------------------------------------ who may
select test.act_as('cashier@example.com');
select test.throws($$select production_lots()$$, '%permission%', 'a cashier does not see the lots');
select test.throws($$select production_plan()$$, '%permission%', 'nor the plan');
select test.throws($$select batch_reconciliation(pg_temp.id('B1', 'batch_id'))$$, '%permission%', 'nor a batch''s story');
select test.eq((select count(*) from lot_movement)::int, 0, 'nor the rows of the lots');
select test.act_as('barista@example.com');
select test.throws($$select report_production(test.today() - 1, test.today())$$, '%permission%',
  'the report is for those who see costs');
select test.act_as('manager@example.com');
select test.ok((select count(*) from lot_movement) > 0, 'a manager sees the rows of the lots');
select test.throws($$insert into lot_movement (business_id, item_id, location_id, base_qty)
  values ('00000000-0000-0000-0000-0000000000b1', (select vanilla from ids), (select loc from ids), 1)$$,
  '%permission denied%', 'no one writes them but the movements');
select test.throws($$update item_lot set left_base = 0$$, '%permission denied%', 'nor what a lot holds');
select test.as_admin();
select test.throws($$update lot_movement set base_qty = 1$$, '%append-only%', 'they are never changed');
select test.act_as('manager@example.com');
select test.eq((select difference from report_reconciliation(test.today()) where check_key = 'inventory'), 0::numeric,
  'the stock ledger still agrees with Inventory (1200)');
select test.eq((select string_agg((b ->> 'batch_no') || ':' || (b ->> 'yield_pct'), ', ' order by (b ->> 'batch_no')::int)
                  from jsonb_array_elements(report_production(test.today() - 1, test.today()) -> 'batches') b),
  '1:100.0, 2:96.0, 3:20.0, 4:100.0, 5:100.0', 'Reports lists the batches, with what came out of what was planned');

-- ------------------------------------------------------------------ the day's plan
select test.act_as('owner@example.com');
insert into res select 'CH', save_batch_recipe(null, 'Golden chocolate gelato', '{"measure":"weight"}', 4, 'kg',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 3, 'unit_code', 'L'),
                    jsonb_build_object('item_id', (select cocoa from ids), 'qty', 500, 'unit_code', 'g')),
  null, true, 48);
select test.as_admin();
update recipe_version set effective_from = test.today() - 60 where recipe_id = pg_temp.id('CH', 'recipe_id');
create function pg_temp.plan(p_recipe text, p_day date default null) returns jsonb language sql security definer as $$
  select r from jsonb_array_elements(production_plan(p_day) -> 'recipes') r where r ->> 'recipe' = p_recipe
$$;
select test.act_as('barista@example.com');
select test.eq((select r ->> 'status' from jsonb_array_elements(production_plan() -> 'recipes') r
                 where r ->> 'recipe' = 'Golden chocolate gelato'), 'no_history', 'a new flavour: nothing to judge by');
select test.eq((select r ->> 'status' from jsonb_array_elements(production_plan() -> 'recipes') r
                 where r ->> 'recipe' = 'Golden vanilla gelato'), 'no_history', 'nor for one made only since today');
-- Six weeks of chocolate: 13 kg in 43 days ago, and on this weekday each week
-- since, 1, 2, 3, 1, 2 and 3 kg sold (the latest first).
select test.as_admin();
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason,
                                occurred_at)
values ('00000000-0000-0000-0000-0000000000b1', pg_temp.id('CH', 'item_id'), (select loc from ids), 'opening_balance',
        13000, 1, 13000, 'the opening count', ((test.today() - 43) + time '09:00') at time zone (select tz from ids));
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                reference_type, reason, occurred_at)
select '00000000-0000-0000-0000-0000000000b1', pg_temp.id('CH', 'item_id'), (select loc from ids), 'sale_consumption',
       -w.q, 1, w.q, 'sales_order', 'Sale', ((test.today() - 7 * w.k) + time '12:00') at time zone (select tz from ids)
  from (values (1, 1000), (2, 2000), (3, 3000), (4, 1000), (5, 2000), (6, 3000)) w(k, q);
select test.act_as('barista@example.com');
select test.eq((select (p ->> 'status') || ': ' || (p ->> 'weeks') || ' weeks of ' || (p ->> 'history_days') || ' days, '
                       || (p ->> 'demand') || ' a day, ' || (p ->> 'on_hand') || ' on hand, ' || (p ->> 'good') || ' good, '
                       || (p ->> 'to_make') || ' to make: ' || (p ->> 'batches') || ' batch of ' || (p ->> 'batch_yield')
                  from (select pg_temp.plan('Golden chocolate gelato') p) x),
  'make: 6 weeks of 43 days, 2000 a day, 1000 on hand, 1000 good, 1000 to make: 1 batch of 4000',
  'what sold on this weekday, on average, less what is good, in whole batches');
select test.eq((select string_agg(d ->> 'used', ',' order by d ->> 'day' desc)
                  from jsonb_array_elements(pg_temp.plan('Golden chocolate gelato') -> 'days') d),
  '1000,2000,3000,1000,2000,3000', 'each of the weeks it judged by');
select test.eq((select string_agg((i ->> 'item') || ' ' || (i ->> 'needed') || ' needed, ' || (i ->> 'on_hand')
                                  || ' on hand, short ' || (i ->> 'short'), '; ')
                  from jsonb_array_elements(production_plan() -> 'ingredients') i where i ->> 'item' = 'Golden cocoa'),
  'Golden cocoa 500 needed, 300 on hand, short 200', 'what the batches to make need of each ingredient, and what is short');
select test.eq((select (p ->> 'status') || ' ' || (p ->> 'demand')
                  from (select pg_temp.plan('Golden chocolate gelato', test.today() + 1) p) x),
  'enough 0', 'tomorrow is another weekday: none sold on it, none to make');
-- A batch due before the day is out does not count as good for it.
select test.act_as('barista@example.com');
insert into res select 'CB', record_production(pg_temp.id('CH', 'recipe_id'), 1, p_use_by => pg_temp.day_end() - interval '1 second');
select test.eq((select (p ->> 'on_hand') || ' on hand, ' || (p ->> 'due') || ' due today, ' || (p ->> 'good') || ' good: '
                       || (p ->> 'batches') || ' batch'
                  from (select pg_temp.plan('Golden chocolate gelato') p) x),
  '5000 on hand, 4000 due today, 1000 good: 1 batch', 'what is due today is not counted as good for it');
select test.eq((select l ->> 'status' from jsonb_array_elements(production_lots()) l where l ->> 'item' = 'Golden chocolate gelato'),
  'today', 'and it is listed as due today');

-- ------------------------------------------------------------------ once, and with no shelf life
select test.act_as('owner@example.com');
select save_batch_recipe(pg_temp.id('V', 'recipe_id'), 'Golden vanilla gelato', null, 5, 'kg', null, 'Churn slowly', true, 0);
select test.as_admin();
select test.eq((select coalesce(shelf_life_hours::text, 'none') from recipe where id = pg_temp.id('V', 'recipe_id')), 'none',
  'a shelf life taken away');
select test.eq((select (before_state ->> 'keeps_hours') || '→' || coalesce(after_state ->> 'keeps_hours', 'none')
                  from audit_log where action = 'recipe.batch.change' and entity_id = pg_temp.id('V', 'recipe_id')::text
                 order by id desc limit 1), '72→none', 'on the trail');
select test.act_as('barista@example.com');
insert into res select 'K1', record_production(pg_temp.id('V', 'recipe_id'), 1, p_idempotency_key => 'e0000000-0000-0000-0000-000000000462');
insert into res select 'K2', record_production(pg_temp.id('V', 'recipe_id'), 1, p_idempotency_key => 'e0000000-0000-0000-0000-000000000462');
select test.eq(pg_temp.r('K1') ->> 'batch_id', pg_temp.r('K2') ->> 'batch_id', 'a batch sent twice is recorded once');
select test.eq(coalesce(pg_temp.r('K1') ->> 'use_by', 'none'), 'none', 'with no shelf life, no use-by');
select test.as_admin();
select test.eq((select count(*) from production_batch where recipe_id = pg_temp.id('V', 'recipe_id'))::int, 6,
  'six batches of vanilla');
select test.ok(pg_temp.balanced(), 'and every lot adds up');
