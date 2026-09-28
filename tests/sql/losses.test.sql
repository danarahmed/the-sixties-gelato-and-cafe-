-- =============================================================================
-- The kinds of loss and their accounts, giveaways at the till, and the loss
-- report (0047–0048, release V): each kind of loss to its own account; a loss
-- recorded whole, of an item (from the batch named, when one is) or of a
-- product as its recipe makes it; a giveaway at the till of what is in the
-- cart, with its add-ons, as a loss of its kind with a turn number, and no
-- sale; the rules of 0040 on all of it, the limit asked of a manager's PIN at
-- the till; a loss that waits approved or reversed whole; record_waste as
-- before; the report; the books and the records checked; 5310 closed to bills,
-- expenses and credits. Fixtures: beans 1,000 g at 10, cups 100 at 50, water
-- 24 bottles at 250; an espresso (20 g of beans, and a cup to take away).
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;
create function pg_temp.on_hand(p_item uuid) returns numeric language sql security definer as $$
  select trim_scale((item_position('00000000-0000-0000-0000-0000000000b1', p_item,
                                   default_location('00000000-0000-0000-0000-0000000000b1'))).qty)
$$;
-- A loss's journal, as one line; its movements, item by item.
create function pg_temp.journal(p text) returns text language sql security definer as $$
  select test.lines_of(pg_temp.id(p, 'loss_id'))
$$;
create function pg_temp.moves(p text) returns text language sql security definer as $$
  select string_agg(i.name || ' ' || trim_scale(m.base_quantity_signed) || ' ' || m.type, ', ' order by i.name)
    from inventory_movement m join item i on i.id = m.item_id
   where m.reference_type = 'stock_loss' and m.reference_id = pg_temp.id(p, 'loss_id')
$$;
create function pg_temp.member(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
create function pg_temp.approve(p_kind text) returns uuid language plpgsql as $$
declare r jsonb;
begin
  r := request_approval(p_kind, pg_temp.member('manager@example.com'), '2468', '{}');
  if not (r ->> 'ok')::boolean then raise exception 'approval refused: %', r ->> 'error'; end if;
  return (r ->> 'approval_id')::uuid;
end $$;
create function pg_temp.alerts(p_rule text) returns text language sql security definer as $$
  select string_agg(urgency || ': ' || title, ' | ' order by title)
    from alert_conditions('00000000-0000-0000-0000-0000000000b1', now()) where rule = p_rule
$$;
-- What each lot of an item holds: "B1=1500, B2=1700".
create function pg_temp.lots(p_item uuid) returns text language sql security definer as $$
  select coalesce(string_agg(coalesce(l.lot_code, '-') || '=' || trim_scale(x.q), ', '
                             order by l.created_at nulls first, l.lot_code), 'none')
    from (select lot_id, sum(base_qty) q from lot_movement where item_id = p_item
           group by lot_id having sum(base_qty) <> 0) x
    left join item_lot l on l.id = x.lot_id
$$;
create function pg_temp.split(p_movement uuid) returns text language sql security definer as $$
  select coalesce(string_agg(coalesce(l.lot_code, '-') || '=' || trim_scale(x.q), ', ' order by l.lot_code), 'none')
    from (select lot_id, sum(base_qty) q from lot_movement where movement_id = p_movement
           group by lot_id having sum(base_qty) <> 0) x
    left join item_lot l on l.id = x.lot_id
$$;

-- A barista, who records losses and may not approve them; the manager's PIN.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000002a', 'barista@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000002a');
insert into user_role (app_user_id, role) select id, 'barista' from app_user where email = 'barista@example.com';
select test.act_as('manager@example.com');
select set_my_pin('2468');

-- Milk (10 L at 1.5 a millilitre), a gelato made from it (2 kg a batch from
-- 4 L, kept 48 hours), napkins never bought, and a latte of milk and beans.
select test.act_as('owner@example.com');
insert into res select 'MILK', create_item('Loss milk', 'ingredient', 'ml', 'volume',
  p_units => '[{"code":"L","label":"L","factor":1000}]', p_opening_qty => 10000, p_opening_unit_cost => 1.5,
  p_opening_reason => 'the opening count');
insert into res select 'GELATO', create_item('Loss gelato', 'finished_good', 'g', 'mass',
  p_units => '[{"code":"kg","label":"kg","factor":1000}]');
insert into res select 'NAPKINS', create_item('Loss napkins', 'consumable', 'each', 'count');
insert into res select 'REC', save_batch_recipe(null, 'Loss gelato', jsonb_build_object('item_id', pg_temp.id('GELATO', 'item_id')),
  2, 'kg', jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('MILK', 'item_id'), 'qty', 4, 'unit_code', 'L')),
  'Churn', true, 48);
insert into res select 'LATTE', create_product('Loss latte', '{"dine_in": 4000}',
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('MILK', 'item_id'), 'qty', 200, 'unit_code', 'ml'),
                    jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 18, 'unit_code', 'g')));
-- An add-on for the espresso: a shot of syrup, 10 ml of the milk.
insert into res select 'EXTRAS', save_modifier_group(null, 'Loss extras', 0, 2, 1);
insert into res select 'SYRUP', save_modifier(null, pg_temp.id('EXTRAS', 'group_id'), 'Loss syrup', 1,
  p_prices => '{"dine_in": 250, "takeaway": 250}',
  p_recipe => jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('MILK', 'item_id'), 'qty', 10, 'unit_code', 'ml')));
select set_product_modifiers('d0000000-0000-0000-0000-000000000001',
  jsonb_build_array(jsonb_build_object('group_id', pg_temp.id('EXTRAS', 'group_id'))));
-- Two batches of the gelato: the first kept as the recipe says, the second used by tomorrow.
select test.act_as('manager@example.com');
insert into res select 'B1', record_production(pg_temp.id('REC', 'recipe_id'), 1);
insert into res select 'B2', record_production(pg_temp.id('REC', 'recipe_id'), 1, p_use_by => now() + interval '24 hours');
select test.as_admin();
create temp table ids as
select 'c0000000-0000-0000-0000-000000000001'::uuid beans, 'c0000000-0000-0000-0000-000000000002'::uuid cups,
       'c0000000-0000-0000-0000-000000000003'::uuid water, 'd1000000-0000-0000-0000-000000000001'::uuid espresso,
       pg_temp.id('MILK', 'item_id') milk, pg_temp.id('GELATO', 'item_id') gelato, pg_temp.id('NAPKINS', 'item_id') napkins,
       pg_temp.id('LATTE', 'variant_id') latte, (select id from modifier where name = 'Loss syrup') syrup,
       (select output_lot_id from production_batch where id = pg_temp.id('B1', 'batch_id')) lot1,
       (select output_lot_id from production_batch where id = pg_temp.id('B2', 'batch_id')) lot2,
       (select batch_no from production_batch where id = pg_temp.id('B1', 'batch_id')) no1,
       default_location('00000000-0000-0000-0000-0000000000b1') loc;
grant select on ids to public;
select test.eq(pg_temp.lots((select gelato from ids)), 'B1=2000, B2=2000', 'two batches of gelato, each in its lot');

-- ------------------------------------------------------------------ the accounts, the kinds
select test.eq((select string_agg(code || ' ' || name || ' ' || account_type || ' ' || is_system, '; ' order by code)
                  from gl_account where business_id = '00000000-0000-0000-0000-0000000000b1'
                   and code in ('5310', '6110', '6610', '6620')),
  '5310 Production and preparation loss expense true; 6110 Staff meals expense true; '
  '6610 Complimentary items expense true; 6620 Marketing samples expense true',
  'four accounts for the kinds of loss, in the chart');
select test.eq((select string_agg(k || ':' || loss_account(k::movement_type) || case when is_giveaway(k::movement_type)
                                                                                    then ' at the till' else '' end,
                                  ', ' order by k)
                  from unnest(array['waste', 'spoilage', 'expired', 'damaged', 'melt_evaporation', 'production_waste',
                                    'preparation_waste', 'staff_consumption', 'complimentary', 'sampling']) k),
  'complimentary:6610 at the till, damaged:5300, expired:5300, melt_evaporation:5300, preparation_waste:5310, '
  'production_waste:5310, sampling:6620 at the till, spoilage:5300, staff_consumption:6110 at the till, waste:5300',
  'each kind of loss has its account; a staff meal, on the house and a sample are given away at the till');
select test.ok(is_loss('production_waste') and is_loss('preparation_waste') and not is_loss('sale_consumption'),
  'what is lost in production and preparation is a loss');
select test.eq(stock_card_kind('preparation_waste', 'stock_loss', -1) || ' ' || stock_card_kind('production_waste', 'stock_loss', -1),
  'wasted wasted', 'and on the stock card it is wasted');

-- ------------------------------------------------------------------ given away at the till
-- Two espressos for the staff's lunch, eaten in: 40 g of beans, 400, to 6110.
select test.act_as('cashier@example.com');
insert into res select 'G1', give_away('staff_consumption', 'dine_in',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 2)), 'Staff lunch',
  p_idempotency_key => 'f0000000-0000-0000-0000-000000000001');
select test.eq(give_away('staff_consumption', 'dine_in',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 2)), 'Staff lunch',
  p_idempotency_key => 'f0000000-0000-0000-0000-000000000001') ->> 'loss_id', pg_temp.r('G1') ->> 'loss_id',
  'sent twice with its key, the same giveaway');
select test.ok(not (pg_temp.r('G1') ? 'value') and (pg_temp.r('G1') ->> 'turn_no') is not null,
  'the cashier is not shown its cost, and is given its turn number for the bar');
select test.as_admin();
select test.eq(pg_temp.journal('G1'), '1200 Cr 400 | 6110 Dr 400', 'a staff meal to 6110 Staff meals, at its cost');
select test.eq(pg_temp.moves('G1'), 'Golden beans -40 staff_consumption', 'its beans out, as a staff meal');
select test.eq((select count(*) || ' ' || bool_and(at_till) || ' ' || min(channel::text) || ' ' || min(status::text)
                  from stock_loss where id = pg_temp.id('G1', 'loss_id')),
  '1 true dine_in not_required', 'one giveaway, at the till, eaten in, needing no approval');
select test.eq((select count(*) from sales_order)::int, 0, 'and no sale: no revenue, no payment, no order');

-- On the house, to take away: its beans and its cup, 250, to 6610.
select test.act_as('cashier@example.com');
insert into res select 'G2', give_away('complimentary', 'takeaway',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 1)), 'A regular''s birthday');
-- A sample with its add-on: the beans and 10 ml of milk, 215, to 6620.
insert into res select 'G3', give_away('sampling', 'dine_in',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 1,
                                       'modifiers', jsonb_build_array(jsonb_build_object('modifier_id', (select syrup from ids),
                                                                                         'qty', 1)))),
  'Tasting the new syrup');
select test.as_admin();
select test.eq(pg_temp.journal('G2') || ' / ' || pg_temp.moves('G2'),
  '1200 Cr 250 | 6610 Dr 250 / Golden beans -20 complimentary, Golden cup -1 complimentary',
  'on the house, to take away: its cup too, to 6610 Complimentary items');
select test.eq(pg_temp.journal('G3') || ' / ' || pg_temp.moves('G3'),
  '1200 Cr 215 | 6620 Dr 215 / Golden beans -20 sampling, Loss milk -10 sampling',
  'a sample with its add-on: the add-on''s milk too, to 6620 Marketing samples');
select test.eq((select string_agg(mo ->> 'name', ', ') from stock_loss_line l, jsonb_array_elements(l.modifiers) mo
                 where l.stock_loss_id = pg_temp.id('G3', 'loss_id')), 'Loss syrup', 'the line keeps its add-on');
select test.eq((pg_temp.r('G2') ->> 'turn_no')::int - (pg_temp.r('G1') ->> 'turn_no')::int
                 || ' ' || ((pg_temp.r('G3') ->> 'turn_no')::int - (pg_temp.r('G2') ->> 'turn_no')::int), '1 1',
  'each giveaway takes the next turn number');
select test.act_as('cashier@example.com');
insert into res select 'S1', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 1)));
select test.eq((pg_temp.r('S1') ->> 'turn_no')::int - (pg_temp.r('G3') ->> 'turn_no')::int, 1,
  'and the next sale the one after: the bar makes them in turn');
select test.throws($$select give_away('waste', 'dine_in',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 1)), 'x')$$,
  'Give it away as a staff meal, on the house or a sample', 'only a staff meal, on the house or a sample');
select test.throws($$select give_away('complimentary', 'talabat',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 1)), 'x')$$,
  'What is given away is eaten in or taken away', 'not through a delivery platform');
select test.throws($$select give_away('complimentary', 'dine_in', '[]', 'x')$$, 'The cart is empty',
  'something is given away');
select test.throws($$select give_away('complimentary', 'dine_in',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 1)), '  ')$$,
  'Say why it is given away', 'with why');
select test.act_as('counter@example.com');
select test.throws($$select give_away('complimentary', 'dine_in',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 1)), 'x')$$,
  '%needs sale.create%', 'only those who sell give away');

-- Over the limit, the cashier asks a manager's PIN on the spot: nothing waits at the till.
select test.act_as('owner@example.com');
select set_business_rule('waste_approval_over', 'business', null, '500', 'Small losses only');
select test.act_as('cashier@example.com');
select test.throws($$select give_away('staff_consumption', 'dine_in',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 3)), 'Three staff')$$,
  'This loss needs a manager''s approval: ask one to approve it now, or save it to wait for their approval',
  'three espressos, 600, are over the limit');
insert into res select 'G4', give_away('staff_consumption', 'dine_in',
  jsonb_build_array(jsonb_build_object('variant_id', (select espresso from ids), 'qty', 3)), 'Three staff',
  p_approval => pg_temp.approve('waste'));
select test.eq((pg_temp.r('G4') ->> 'status') || ' by ' || (pg_temp.r('G4') ->> 'approved_by'), 'approved by Demo Manager',
  'given away with the manager''s PIN');
select test.as_admin();
select test.eq((select string_agg(decision || ' ' || (select full_name from app_user where id = decided_by), ',')
                  from loss_review r join inventory_movement m on m.id = r.movement_id
                 where m.reference_type = 'stock_loss' and m.reference_id = pg_temp.id('G4', 'loss_id')),
  'approved Demo Manager', 'and the manager''s approval kept with it');
select test.eq(pg_temp.on_hand((select beans from ids)), 840::numeric,
  '1,000 g of beans less 40, 20, 20 and 60 given away and 20 sold');

-- ------------------------------------------------------------------ a loss of each kind, to its account
select test.act_as('manager@example.com');
insert into res select 'K_' || k, record_loss(k::movement_type, (select beans from ids), null, 10, 'g', 'Each kind')
  from unnest(array['waste', 'preparation_waste', 'production_waste', 'staff_consumption', 'complimentary',
                    'sampling']) k;
select test.as_admin();
select test.eq((select string_agg(substr(k, 3) || ': ' || pg_temp.journal(k), '; ' order by k) from res where k like 'K\_%'),
  'complimentary: 1200 Cr 100 | 6610 Dr 100; preparation_waste: 1200 Cr 100 | 5310 Dr 100; '
  'production_waste: 1200 Cr 100 | 5310 Dr 100; sampling: 1200 Cr 100 | 6620 Dr 100; '
  'staff_consumption: 1200 Cr 100 | 6110 Dr 100; waste: 1200 Cr 100 | 5300 Dr 100',
  'each kind to its own account: waste to 5300, production and preparation to 5310, a staff meal to 6110, '
  'on the house to 6610, a sample to 6620');
select test.eq((select string_agg(distinct (v ->> 'status'), ',') from res where k like 'K\_%'), 'approved',
  'a manager''s own loss is approved as it is recorded');
select test.eq((select count(*) || ' ' || string_agg(distinct entity_type, ',') from audit_log
                 where action = 'inventory.loss'), '6 stock_loss', 'each on the audit trail, as a loss');
select test.eq((select after_state ->> 'kind' || ' ' || (after_state ->> 'account') from audit_log
                 where action = 'inventory.loss' and entity_id = pg_temp.r('K_preparation_waste') ->> 'loss_id'),
  'preparation_waste 5310', 'with its kind and its account');
select test.act_as('manager@example.com');
select test.throws($$select record_loss('sale_consumption', (select beans from ids), null, 10, 'g', 'x')$$,
  'Choose what kind of loss it is', 'a loss is of a kind of loss');
select test.throws($$select record_loss('waste', (select beans from ids), null, 10, 'g', ' ')$$,
  'Say why the stock was lost', 'with why');
select test.throws($$select record_loss('waste', (select beans from ids), (select espresso from ids), 10, 'g', 'x')$$,
  'Choose an item or a product that was lost', 'an item or a product, not both');
select test.throws($$select record_loss('waste', null, null, 10, 'g', 'x')$$,
  'Choose an item or a product that was lost', 'nor neither');
select test.throws($$select record_loss('waste', (select beans from ids), null, 0, 'g', 'x')$$,
  'Enter a quantity greater than zero', 'more than nothing');
select test.throws($$select record_loss('waste', 'c0000000-0000-0000-0000-00000000dead', null, 1, 'g', 'x')$$,
  'Unknown item', 'of an item of the café');
select test.act_as('cashier@example.com');
select test.throws($$select record_loss('waste', (select beans from ids), null, 10, 'g', 'x')$$,
  '%needs waste.record%', 'a cashier gives away at the till, and records no loss');

-- ------------------------------------------------------------------ a product lost
select test.act_as('manager@example.com');
insert into res select 'P1', record_loss('damaged', null, (select espresso from ids), 2, null, 'Dropped two cups',
  p_idempotency_key => 'f0000000-0000-0000-0000-000000000002');
select test.eq(record_loss('damaged', null, (select espresso from ids), 2, null, 'Dropped two cups',
  p_idempotency_key => 'f0000000-0000-0000-0000-000000000002') ->> 'loss_id', pg_temp.r('P1') ->> 'loss_id',
  'a loss sent twice with its key is recorded once');
select test.as_admin();
select test.eq(pg_temp.journal('P1') || ' / ' || pg_temp.moves('P1'), '1200 Cr 400 | 5300 Dr 400 / Golden beans -40 damaged',
  'two espressos dropped: their beans, as eaten in (no cup), in one journal');
select test.eq((select trim_scale(qty) || ' ' || trim_scale(value) || ' ' || (product_variant_id = (select espresso from ids))
                  from stock_loss_line where stock_loss_id = pg_temp.id('P1', 'loss_id')),
  '2 400 true', 'the loss keeps the product, as it was given');
insert into product (id, business_id, name) values ('d0000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1',
                                                    'Loss tap water');
insert into product_variant (id, product_id, name) values ('d1000000-0000-0000-0000-0000000000f1',
                                                           'd0000000-0000-0000-0000-0000000000f1', 'Glass');
select test.act_as('manager@example.com');
select test.throws($$select record_loss('waste', null, 'd1000000-0000-0000-0000-0000000000f1', 1, null, 'x')$$,
  'Loss tap water uses no stock: nothing is lost with it', 'a product that uses no stock loses nothing');
select test.throws($$select record_loss('waste', null, (select espresso from ids), 1, null, 'x', (select lot1 from ids))$$,
  'A batch is named for an item, not a product', 'a batch is of an item');

-- ------------------------------------------------------------------ from the batch named
insert into res select 'D1', record_loss('damaged', (select gelato from ids), null, 500, 'g', 'A pan dropped',
  (select lot1 from ids));
insert into res select 'D2', record_loss('spoilage', (select gelato from ids), null, 300, 'g', 'Melted');
select test.as_admin();
select test.eq(pg_temp.split(pg_temp.id('D1', 'movement_id')) || ' / ' || pg_temp.split(pg_temp.id('D2', 'movement_id')),
  'B1=-500 / B2=-300', 'a loss from the batch named comes off it; without one, off the batch used by first');
select test.eq(pg_temp.journal('D1'), '1200 Cr 1500 | 5300 Dr 1500', 'at the gelato''s cost, 3 a gram');
select test.eq(pg_temp.lots((select gelato from ids)), 'B1=1500, B2=1700', 'each batch holds what is left of it');
select test.eq((select after_state ->> 'batch_no' from audit_log
                 where action = 'inventory.loss' and entity_id = pg_temp.r('D1') ->> 'loss_id'),
  (select no1 from ids)::text, 'the audit trail names the batch');
select test.act_as('manager@example.com');
select test.throws($$select record_loss('damaged', (select gelato from ids), null, 1.6, 'kg', 'too much', (select lot1 from ids))$$,
  format('Only 1500 g of batch %s is left', (select no1 from ids)), 'no more than the batch holds');
select test.throws($$select record_loss('damaged', (select beans from ids), null, 10, 'g', 'x', (select lot1 from ids))$$,
  'That batch is not of this item, here', 'a batch of the item lost');

-- ------------------------------------------------------------------ the rules: small losses add up; a loss waits whole
-- The barista's losses today (no session of their own): 225, 450, then 675, over the 500.
select test.act_as('barista@example.com');
insert into res select 'E1', record_loss('spoilage', (select milk from ids), null, 150, 'ml', 'Left out');
insert into res select 'E2', record_loss('spoilage', (select milk from ids), null, 150, 'ml', 'Left out again');
select test.eq((pg_temp.r('E1') ->> 'status') || ' ' || (pg_temp.r('E2') ->> 'status'), 'not_required not_required',
  'two small ones are under the limit');
select test.throws($$select record_loss('spoilage', (select milk from ids), null, 150, 'ml', 'And again')$$,
  'This loss needs a manager''s approval: ask one to approve it now, or save it to wait for their approval',
  'three small ones are over it together');
insert into res select 'E3', record_loss('spoilage', (select milk from ids), null, 150, 'ml', 'And again', p_wait => true);
select test.eq(pg_temp.r('E3') ->> 'status', 'pending', 'saved to wait for a manager');
insert into res select 'Z', record_loss('damaged', (select napkins from ids), null, 5, 'each', 'Wet');
select test.eq((pg_temp.r('Z') ->> 'status') || ' ' || coalesce(pg_temp.r('Z') ->> 'journal_no', 'no journal'),
  'not_required no journal', 'a loss worth nothing needs no approval and posts nothing');
insert into res select 'LATTE2', record_loss('damaged', null, (select latte from ids), 2, null, 'Tray tipped over',
  p_wait => true);
select test.as_admin();
select test.eq(pg_temp.moves('LATTE2') || ' / ' || pg_temp.journal('LATTE2'),
  'Golden beans -36 damaged, Loss milk -400 damaged / 1200 Cr 960 | 5300 Dr 960',
  'two lattes: their milk and their beans, 960, in one journal');
select test.eq(pg_temp.alerts('losses_waiting'), 'orange: 2 loss(es) waiting for a manager''s approval (1,185 IQD)',
  'two losses wait, the lattes counted once');
select test.act_as('barista@example.com');
select test.throws($$select * from losses_waiting()$$, '%needs waste.approve%', 'a barista does not see the list');
select test.act_as('manager@example.com');
select test.eq((select string_agg(item || ' ' || trim_scale(qty) || ' ' || coalesce(unit, '×') || ' ' || kind || ' '
                                  || trim_scale(value) || ' ' || account || ' by ' || recorded_by
                                  || case when loss_id is not null then '' else ' (no loss)' end, '; ' order by at)
                  from losses_waiting()),
  'Loss milk 150 ml spoilage 225 5300 by Demo Barista; Loss latte 2 × damaged 960 5300 by Demo Barista',
  'the manager sees each loss waiting once, as it was given');
select test.succeeds($$select review_loss(pg_temp.id('E3', 'movement_id'), 'approve')$$, 'the milk approved');
-- The lattes reversed by either of their movements: both back, one journal reversed.
create temp table lm as
  select m.id from inventory_movement m where m.reference_type = 'stock_loss' and m.reference_id = pg_temp.id('LATTE2', 'loss_id')
     and m.item_id = (select milk from ids);
grant select on lm to public;
select test.throws($$select review_loss((select id from lm), 'reverse')$$, 'Say why the loss is reversed', 'with why');
insert into res select 'LR', review_loss((select id from lm), 'reverse', 'Nothing was spilt: they were sold');
select test.throws($$select review_loss(pg_temp.id('LATTE2', 'movement_id'), 'approve')$$,
  'This loss has been looked at already', 'looked at once, whole');
select test.as_admin();
select test.eq(pg_temp.on_hand((select milk from ids)) || ' ml, ' || pg_temp.on_hand((select beans from ids)) || ' g',
  '1540 ml, 740 g', 'the lattes'' milk and beans back on the shelf');
select test.eq((select string_agg(a.code || case when l.debit > 0 then ' Dr ' || l.debit else ' Cr ' || l.credit end, ' | '
                                  order by a.code)
                  from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
                 where e.reverses_entry = (select id from journal_entry where reference_type = 'stock_loss'
                                             and reference_id = pg_temp.id('LATTE2', 'loss_id') and reverses_entry is null)),
  '1200 Dr 960 | 5300 Cr 960', 'its one journal reversed');
select test.eq((select count(*) || ' ' || count(distinct journal_entry_id) || ' ' || string_agg(distinct decision, ',')
                  from loss_review r join inventory_movement m on m.id = r.movement_id
                 where m.reference_type = 'stock_loss' and m.reference_id = pg_temp.id('LATTE2', 'loss_id')),
  '2 1 reversed', 'each of its movements reversed, with the one journal');
select test.eq((select entity_type || ' ' || (after_state ->> 'what') || ' ' || (after_state ->> 'value') from audit_log
                 where action = 'inventory.loss_reverse'), 'stock_loss Loss latte 960',
  'the reversal on the audit trail, as the loss');
select test.eq(coalesce(pg_temp.alerts('losses_waiting'), 'none'), 'none', 'nothing waits any more');

-- ------------------------------------------------------------------ record_waste, as before
select test.act_as('manager@example.com');
insert into res select 'W1', record_waste((select water from ids), 1, 'each', 'damaged', 'Bottle cracked');
insert into res select 'W2', record_waste((select water from ids), 1, 'each', 'production_waste', 'Used to test the machine');
select test.eq((select string_agg(k || ': ' || (v ->> 'status') || ' ' || (v ->> 'value') || ' '
                                  || (v ? 'movement_id' and v ? 'journal_no' and v ? 'loss_id')::text, '; ' order by k)
                  from res where k in ('W1', 'W2')),
  'W1: approved 250 true; W2: approved 250 true', 'record_waste answers as it did, and names its loss');
select test.as_admin();
select test.eq(pg_temp.journal('W2'), '1200 Cr 250 | 5310 Dr 250', 'each kind to its account through it too');
select test.eq((select count(*) from audit_log where action = 'inventory.waste' and entity_type = 'inventory_movement'
                   and entity_id in (pg_temp.r('W1') ->> 'movement_id', pg_temp.r('W2') ->> 'movement_id'))::int, 2,
  'and on the audit trail as it was');
select test.act_as('manager@example.com');
select test.throws($$select record_waste((select water from ids), 1, 'each', 'sale_consumption', 'x')$$,
  'Not a waste type: sale_consumption', 'only a loss is written off');

-- ------------------------------------------------------------------ what was lost
-- A loss the app recorded before 0048: one movement with its own journal.
select test.as_admin();
insert into inventory_movement (id, business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                reference_type, app_user_id, reason, approval_status)
values ('c1000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', (select beans from ids),
        (select loc from ids), 'spoilage', -10, 10, 100, 'waste', pg_temp.member('manager@example.com'), 'Before 0048',
        'not_required');
select post_journal('00000000-0000-0000-0000-0000000000b1', now(), 'Spoilage: Before 0048', 'inventory_movement',
  'c1000000-0000-0000-0000-0000000000f1',
  '[{"code": "5300", "debit": 100}, {"code": "1200", "credit": 100}]'::jsonb);
select test.act_as('owner@example.com');
insert into res select 'REP', report_losses(test.today(), test.today());
select test.eq((select string_agg(key || '=' || value, ', ' order by key) from jsonb_each_text(pg_temp.r('REP') -> 'total')),
  'count=20, pending_count=0, pending_value=0, reversed_count=1, reversed_value=960, value=6140',
  'twenty losses, 6,140; the lattes reversed apart; none waiting');
select test.eq((select string_agg((x ->> 'kind') || ' ' || (x ->> 'account') || ' ' || (x ->> 'count') || ' ' || (x ->> 'value'),
                                  '; ' order by ord)
                  from jsonb_array_elements(pg_temp.r('REP') -> 'by_kind') with ordinality t(x, ord)),
  'damaged 5300 4 2150; spoilage 5300 5 1675; staff_consumption 6110 3 1100; complimentary 6610 2 350; '
  'production_waste 5310 2 350; sampling 6620 2 315; preparation_waste 5310 1 100; waste 5300 1 100',
  'by kind, with its account, the most first (the loss from before 0048 to 5300, as it was posted)');
select test.eq((select string_agg((x ->> 'person') || ' ' || (x ->> 'count') || ' ' || (x ->> 'value'), '; ' order by ord)
                  from jsonb_array_elements(pg_temp.r('REP') -> 'by_person') with ordinality t(x, ord)),
  'Demo Manager 12 4000; Demo Cashier 4 1465; Demo Barista 4 675', 'by person');
select test.eq((select string_agg((x ->> 'kind') || ' ' || (x ->> 'count') || ' ' || (x ->> 'value'), '; ' order by ord)
                  from jsonb_array_elements(pg_temp.r('REP') -> 'giveaways') with ordinality t(x, ord)),
  'complimentary 1 250; sampling 1 215; staff_consumption 2 1000', 'the giveaways at the till, by kind');
select test.eq((select (x ->> 'count') || ' ' || (x ->> 'value') from jsonb_array_elements(pg_temp.r('REP') -> 'by_day') x
                 where (x ->> 'day')::date = test.today()), '20 6140', 'by day');
select test.eq((select (x ->> 'qty') || ' ' || (x ->> 'unit') || ' ' || (x ->> 'value')
                  from jsonb_array_elements(pg_temp.r('REP') -> 'by_item') x where x ->> 'item' = 'Golden beans'),
  '250 g 2500', 'by item: the beans'' 250 g, the lattes'' 36 left out as reversed');
select test.eq((select string_agg((x ->> 'kind') || case when (x ->> 'reversed')::boolean then ' reversed' else '' end
                                  || case when (x ->> 'at_till')::boolean then ' at the till, turn ' || (x ->> 'turn_no') else '' end,
                                  '; ' order by x ->> 'kind', (x ->> 'turn_no')::int)
                  from jsonb_array_elements(pg_temp.r('REP') -> 'losses') x
                 where (x ->> 'reversed')::boolean or (x ->> 'at_till')::boolean),
  format('complimentary at the till, turn %s; damaged reversed; sampling at the till, turn %s; '
         'staff_consumption at the till, turn %s; staff_consumption at the till, turn %s',
         pg_temp.r('G2') ->> 'turn_no', pg_temp.r('G3') ->> 'turn_no', pg_temp.r('G1') ->> 'turn_no',
         pg_temp.r('G4') ->> 'turn_no'),
  'each loss listed, a giveaway with its turn number, the one reversed marked');
select test.eq((select (x -> 'what' -> 0 ->> 'name') || ' ' || (x ->> 'account') || ' ' || coalesce(x ->> 'loss_id', 'no loss')
                  from jsonb_array_elements(pg_temp.r('REP') -> 'losses') x where x ->> 'reason' = 'Before 0048'),
  'Golden beans 5300 no loss', 'the loss from before 0048 as it was');
select test.eq((select x -> 'what' -> 0 ->> 'batch_no' from jsonb_array_elements(pg_temp.r('REP') -> 'losses') x
                 where x ->> 'reason' = 'A pan dropped'), (select no1 from ids)::text, 'a loss from a batch names it');
select test.act_as('barista@example.com');
select test.throws($$select report_losses(test.today(), test.today())$$, '%needs cost.view%',
  'what was lost is read by those who see costs');

-- ------------------------------------------------------------------ the books, and the records
select test.as_admin();
select test.eq((select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
                  from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
                 where check_key in ('inventory', 'documents')),
  'documents=0,inventory=0', 'the stock and the books tie, and every loss has its journal');
select test.act_as('owner@example.com');
select test.eq((select count(*) from legacy_unposted())::int, 0,
  'no loss is offered as stock the old app never journaled: each has its journal as a loss');
select test.as_admin();
-- A journal for a loss that does not exist is a record to look into, until it is reversed.
create temp table orphan as
  select post_journal('00000000-0000-0000-0000-0000000000b1', now(), 'A loss that never was', 'stock_loss',
    gen_random_uuid(), '[{"code": "5310", "debit": 100}, {"code": "1200", "credit": 100}]'::jsonb) as id;
select test.eq((select string_agg(problem, '; ') from document_problems('00000000-0000-0000-0000-0000000000b1',
                                                                         now() + interval '1 minute')),
  'A journal whose loss does not exist', 'a journal whose loss does not exist is found');
select reverse_entry_internal((select id from orphan), now(), 'Posted by mistake');
select test.eq((select count(*) from document_problems('00000000-0000-0000-0000-0000000000b1', now() + interval '1 minute'))::int,
  0, 'reversed, it is not');
-- A loss worth something with no journal (made here, and taken back).
begin;
insert into stock_loss (business_id, location_id, kind, reason, value, status)
values ('00000000-0000-0000-0000-0000000000b1', (select loc from ids), 'waste', 'No journal', 100, 'not_required');
select string_agg(problem, '; ') as loss_problem
  from document_problems('00000000-0000-0000-0000-0000000000b1', now() + interval '1 minute') \gset
rollback;
select test.eq(:'loss_problem'::text, 'A loss with no journal', 'a loss worth something with no journal is found');

-- ------------------------------------------------------------------ 5310 takes no bill, expense or credit
select test.act_as('manager@example.com');
select test.throws($$select record_expense('Spilled cream', 1000, '5310', 'owner')$$,
  'Account 5310 cannot take an expense (stock costs come from their own records)', 'no expense to 5310');
select test.succeeds($$select record_expense('Staff lunch from the kebab shop', 5000, '6110', 'owner')$$,
  'a staff meal bought outside is an expense to 6110');
select test.throws($$select record_bill((select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1'
                                           order by name, id limit 1), 'X-5310', test.today(), 1000, 0, null, '5310')$$,
  'Account 5310 cannot take a bill; stock is billed against its goods receipt', 'no bill to 5310');
select test.throws($$select record_supplier_credit((select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1'
                                                      order by name, id limit 1), 'other', 1000, 'CN-5310', 'A credit',
                                                   null, null, '5310')$$,
  '%cannot take a supplier''s credit%', 'no supplier''s credit to 5310');
