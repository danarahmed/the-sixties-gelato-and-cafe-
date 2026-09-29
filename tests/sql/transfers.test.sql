-- =============================================================================
-- Stock sent between the café's places (0054, release AB): the branch sends
-- milk and sugar to the central kitchen, which receives them all; the kitchen
-- makes a batch of vanilla gelato and sends 4 kg of it to the branch, where
-- 3.5 kg arrive: the batch is kept as that batch at the branch too, with its
-- use-by, and what did not arrive is lost; cups sent and cancelled on their
-- way go back where they were. Each at its cost where it left, through 1210
-- Stock in transit; refused in words; keyed; for those who may; on the audit
-- trail; and the books still tie, 1210 against what is on its way.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
-- A barista, who makes the gelato; an accountant, who sees costs; a buyer.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000e', 'barista@example.com'),
  ('a0000000-0000-0000-0000-0000000000e1', 'accountant@example.com'),
  ('a0000000-0000-0000-0000-0000000000e3', 'buyer@example.com');
insert into app_user (business_id, full_name, email, auth_user_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000000e'),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Accountant', 'accountant@example.com', 'a0000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Buyer', 'buyer@example.com', 'a0000000-0000-0000-0000-0000000000e3');
insert into user_role (app_user_id, role) select id, 'barista' from app_user where email = 'barista@example.com';
insert into user_role (app_user_id, role) select id, 'accountant' from app_user where email = 'accountant@example.com';
insert into user_role (app_user_id, role) select id, 'purchasing' from app_user where email = 'buyer@example.com';

create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;

select test.act_as('owner@example.com');
select create_item('Golden milk', 'ingredient', 'ml', 'volume', p_units => '[{"code":"L","label":"L","factor":1000}]',
  p_opening_qty => 60000, p_opening_unit_cost => 1.5, p_opening_reason => 'the opening count');
select create_item('Golden sugar', 'ingredient', 'g', 'mass', p_units => '[{"code":"kg","label":"kg","factor":1000}]',
  p_opening_qty => 10000, p_opening_unit_cost => 1.2, p_opening_reason => 'the opening count');
select create_item('Golden vanilla gelato', 'finished_good', 'g', 'mass',
  p_units => '[{"code":"kg","label":"kg","factor":1000}]');
select test.as_admin();
create temp table ids as
select (select id from item where name = 'Golden milk') milk, (select id from item where name = 'Golden sugar') sugar,
       (select id from item where name = 'Golden vanilla gelato') vanilla,
       'c0000000-0000-0000-0000-000000000002'::uuid cups,
       (select id from location where name = 'Main Branch') branch,
       (select id from location where name = 'Central Kitchen') kitchen;
grant select on ids to public;
-- An item's stock and its value at a place: "40000 @ 60000".
create function pg_temp.at(p_item uuid, p_place uuid) returns text language sql security definer as $$
  select trim_scale(p.qty) || ' @ ' || trim_scale(p.value)
    from item_position('00000000-0000-0000-0000-0000000000b1', p_item, p_place) p
$$;
create function pg_temp.bal(p_code text) returns numeric language sql security definer as $$
  select gl_balance_at('00000000-0000-0000-0000-0000000000b1', p_code, now() + interval '1 second')
$$;
-- What each batch of an item holds at a place, stock with no batch as "-": "-=0, B1=1500".
create function pg_temp.lots(p_item uuid, p_place uuid) returns text language sql security definer as $$
  select coalesce(string_agg(coalesce(l.lot_code, '-') || '=' || trim_scale(x.q), ', '
                             order by l.lot_code nulls first), 'none')
    from (select lot_id, sum(base_qty) q from lot_movement where item_id = p_item and location_id = p_place
           group by lot_id having sum(base_qty) <> 0) x
    left join item_lot l on l.id = x.lot_id
$$;
-- The books' checks, each difference: "inventory=0, transit=0, …".
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ', ' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
   where check_key in ('inventory', 'transit', 'documents')
$$;

-- An item added at the kitchen opens at the kitchen.
select test.act_as('owner@example.com');
select create_item('Golden cocoa', 'ingredient', 'g', 'mass', p_opening_qty => 2000, p_opening_unit_cost => 5,
  p_opening_reason => 'the opening count', p_location => (select kitchen from ids));
select test.eq(pg_temp.at((select id from item where name = 'Golden cocoa'), (select kitchen from ids)) || ' | '
               || pg_temp.at((select id from item where name = 'Golden cocoa'), (select branch from ids)),
  '2000 @ 10000 | 0 @ 0', 'an item added at the kitchen opens there, not at the branch');

-- ------------------------------------------------------------------ the kitchen asks for milk and sugar
select test.act_as('manager@example.com');
insert into res select 'T1', send_stock_transfer((select branch from ids), (select kitchen from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 20, 'unit_code', 'L'),
                    jsonb_build_object('item_id', (select sugar from ids), 'qty', 4, 'unit_code', 'kg')),
  'For tomorrow''s vanilla', p_idempotency_key => 'e1000000-0000-0000-0000-000000000001');
select test.eq((send_stock_transfer((select branch from ids), (select kitchen from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 20, 'unit_code', 'L'),
                    jsonb_build_object('item_id', (select sugar from ids), 'qty', 4, 'unit_code', 'kg')),
  'For tomorrow''s vanilla', p_idempotency_key => 'e1000000-0000-0000-0000-000000000001') ->> 'transfer_id')::uuid,
  pg_temp.id('T1', 'transfer_id'), 'sent twice with one key, sent once');
select test.eq((pg_temp.r('T1') ->> 'transfer_no') || ' ' || (pg_temp.r('T1') ->> 'from') || ' > '
               || (pg_temp.r('T1') ->> 'to') || ' ' || (pg_temp.r('T1') ->> 'value'),
  '1 Main Branch > Central Kitchen 34800', 'transfer 1, from the branch to the kitchen: 30,000 of milk and 4,800 of sugar');
select test.eq(pg_temp.at((select milk from ids), (select branch from ids)) || ' | '
               || pg_temp.at((select milk from ids), (select kitchen from ids)),
  '40000 @ 60000 | 0 @ 0', 'the milk has left the branch, and is not yet at the kitchen');
select test.eq(pg_temp.bal('1210') || ' ' || pg_temp.bal('1200'),
  '34800 ' || (21000 + 90000 + 12000 + 10000 - 34800)::text, 'on its way: 1210 holds it, and 1200 holds less by as much');
select test.eq(pg_temp.checks(), 'documents=0, inventory=0, transit=0', 'and the books tie, what is on its way against 1210');

select test.act_as('barista@example.com');
select test.throws(format('select receive_stock_transfer(%L)', pg_temp.id('T1', 'transfer_id')),
  '%needs stock.transfer%', 'a barista does not receive it');
select test.act_as('buyer@example.com');
insert into res select 'R1', receive_stock_transfer(pg_temp.id('T1', 'transfer_id'), null, 'All there',
  'e1000000-0000-0000-0000-000000000002');
select test.eq((pg_temp.r('R1') ->> 'received') || ' ' || (pg_temp.r('R1') ->> 'short'), '34800 0',
  'the buyer receives it at the kitchen, all of it');
select test.eq(pg_temp.at((select milk from ids), (select kitchen from ids)) || ' | '
               || pg_temp.at((select sugar from ids), (select kitchen from ids)),
  '20000 @ 30000 | 4000 @ 4800', 'the kitchen has the milk and the sugar, at what they left at');
select test.eq(pg_temp.bal('1210')::text, '0', 'nothing is on its way');
-- The dashboard counts an item, not an item at each place.
select test.as_admin();
update item set min_level_base = 50000 where id = (select milk from ids);
select test.act_as('owner@example.com');
select test.eq((dashboard_summary(test.today()) ->> 'low_stock')::int, 0,
  'milk at two places is low only when all of it is: 60 L against 50 L');
select test.as_admin();
update item set min_level_base = 70000 where id = (select milk from ids);
select test.act_as('owner@example.com');
select test.eq((dashboard_summary(test.today()) ->> 'low_stock')::int, 1, 'and then it is low once, not at each place');
select test.as_admin();
update item set min_level_base = null where id = (select milk from ids);
select test.act_as('buyer@example.com');
select test.throws(format('select receive_stock_transfer(%L)', pg_temp.id('T1', 'transfer_id')),
  'Transfer 1 was received already', 'received once');
select test.throws(format('select cancel_stock_transfer(%L, %L)', pg_temp.id('T1', 'transfer_id'), 'late'),
  'Transfer 1 was received: it is not cancelled', 'and, received, not cancelled');

-- ------------------------------------------------------------------ the kitchen makes vanilla and sends it
select test.act_as('owner@example.com');
insert into res select 'V', save_batch_recipe(null, 'Golden vanilla gelato',
  jsonb_build_object('item_id', (select vanilla from ids)), 5, 'kg',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from ids), 'qty', 4, 'unit_code', 'L'),
                    jsonb_build_object('item_id', (select sugar from ids), 'qty', 800, 'unit_code', 'g')),
  'Churn slowly', true, 72);
select test.act_as('barista@example.com');
insert into res select 'B1', record_production(pg_temp.id('V', 'recipe_id'), 1, p_location => (select kitchen from ids));
select test.eq(pg_temp.lots((select vanilla from ids), (select kitchen from ids)), 'B1=5000',
  'batch 1 is made at the kitchen: 5 kg');
select test.act_as('manager@example.com');
insert into res select 'T2', send_stock_transfer((select kitchen from ids), (select branch from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select vanilla from ids), 'qty', 4, 'unit_code', 'kg')),
  null, p_idempotency_key => gen_random_uuid());
select test.eq(pg_temp.lots((select vanilla from ids), (select kitchen from ids)), 'B1=1000',
  '4 kg of batch 1 leave the kitchen');
create function pg_temp.story(p_batch uuid) returns text language sql security definer as $$
  select format('%s made = %s sold + %s used + %s lost + %s on its way + %s left',
                s ->> 'made', s ->> 'sold', s ->> 'used', s ->> 'lost', s ->> 'moved', s ->> 'left')
    from (select batch_reconciliation(p_batch) -> 'story' s) x
$$;
select test.eq(pg_temp.story(pg_temp.id('B1', 'batch_id')),
  '5000 made = 0 sold + 0 used + 0 lost + 4000 on its way + 1000 left', 'batch 1''s page: 4 kg on its way');
insert into res select 'R2', receive_stock_transfer(pg_temp.id('T2', 'transfer_id'),
  jsonb_build_array(jsonb_build_object('line_id', (select id from stock_transfer_line
                                                     where transfer_id = pg_temp.id('T2', 'transfer_id')),
                                       'qty', 3.5)),
  'A tub fell', gen_random_uuid());
select test.eq(pg_temp.lots((select vanilla from ids), (select branch from ids)), 'B1=3500',
  '3.5 kg arrive at the branch: batch 1 there too');
select test.eq((select string_agg(lot_code || ' ' || (use_by = (select use_by from production_batch
                                                                 where id = pg_temp.id('B1', 'batch_id')))::text
                                 || ' ' || (production_batch_id = pg_temp.id('B1', 'batch_id'))::text, '; ')
                  from item_lot where item_id = (select vanilla from ids) and location_id = (select branch from ids)),
  'B1 true true', 'with the batch''s own use-by');
select test.eq((pg_temp.r('R2') ->> 'value') || ' ' || (pg_temp.r('R2') ->> 'received') || ' '
               || (pg_temp.r('R2') ->> 'short'),
  (select value_sent::text from stock_transfer where id = pg_temp.id('T2', 'transfer_id')) || ' '
  || (select trim_scale(round(value_sent * 3.5 / 4))::text from stock_transfer where id = pg_temp.id('T2', 'transfer_id'))
  || ' '
  || (select trim_scale(value_sent - round(value_sent * 3.5 / 4))::text from stock_transfer
       where id = pg_temp.id('T2', 'transfer_id')),
  'what arrived at what it left at; what did not, lost');
select test.eq((select string_agg(a.code || ' ' || trim_scale(l.debit - l.credit), ', ' order by a.code)
                  from journal_line l join journal_entry e on e.id = l.journal_entry_id
                  join gl_account a on a.id = l.account_id
                 where e.reference_type = 'stock_transfer_receipt' and e.reference_id = pg_temp.id('T2', 'transfer_id')),
  (select format('1200 %s, 1210 %s, 5300 %s', trim_scale(value_received), trim_scale(-value_sent),
                 trim_scale(value_short))
     from stock_transfer where id = pg_temp.id('T2', 'transfer_id')),
  'its journal: into 1200 at the branch, out of 1210, the loss to 5300');
select test.eq(pg_temp.checks(), 'documents=0, inventory=0, transit=0', 'and the books tie');

-- A tub dropped at the branch takes batch 1 there, and the kitchen's stays.
select test.act_as('manager@example.com');
select record_waste((select vanilla from ids), 500, 'g', 'waste', 'Dropped', (select branch from ids),
  p_idempotency_key => gen_random_uuid());
select test.eq(pg_temp.lots((select vanilla from ids), (select kitchen from ids)) || ' | '
               || pg_temp.lots((select vanilla from ids), (select branch from ids)),
  'B1=1000 | B1=3000', 'batch 1: 1 kg at the kitchen, 3 kg at the branch');
select test.eq(pg_temp.story(pg_temp.id('B1', 'batch_id')),
  '5000 made = 0 sold + 0 used + 1000 lost + 0 on its way + 4000 left',
  'batch 1''s page, at both places: half a kilo lost on the way and half dropped, 4 kg left');
select test.eq((select string_agg(m ->> 'place' || ' ' || (m ->> 'qty'), ', ' order by ord)
                  from jsonb_array_elements(batch_reconciliation(pg_temp.id('B1', 'batch_id')) -> 'movements')
                       with ordinality e(m, ord)),
  'Central Kitchen 5000, Central Kitchen -4000, Main Branch 3500, Main Branch -500',
  'and each movement of it, with where');

-- ------------------------------------------------------------------ cups sent, and cancelled on their way
select test.act_as('manager@example.com');
insert into res select 'T3', send_stock_transfer(null, (select kitchen from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select cups from ids), 'qty', 1, 'unit_code', 'sleeve_50')),
  null, p_idempotency_key => gen_random_uuid());
select test.eq((pg_temp.r('T3') ->> 'from') || ' ' || (pg_temp.r('T3') ->> 'value'), 'Main Branch 2500',
  'from the branch when none is named: a sleeve of 50 cups, 2,500');
select test.eq(pg_temp.at((select cups from ids), (select branch from ids)), '50 @ 2500', 'they have left');
select test.throws(format('select cancel_stock_transfer(%L, %L)', pg_temp.id('T3', 'transfer_id'), '  '),
  'Say why the transfer is cancelled', 'cancelled with why');
insert into res select 'C3', cancel_stock_transfer(pg_temp.id('T3', 'transfer_id'), 'Sent to the wrong place',
  gen_random_uuid());
select test.eq(pg_temp.at((select cups from ids), (select branch from ids)) || ' | '
               || pg_temp.at((select cups from ids), (select kitchen from ids)),
  '100 @ 5000 | 0 @ 0', 'back at the branch, as they were');
select test.throws(format('select receive_stock_transfer(%L)', pg_temp.id('T3', 'transfer_id')),
  'Transfer 3 was cancelled', 'a cancelled transfer is not received');
select test.throws(format('select cancel_stock_transfer(%L, %L)', pg_temp.id('T3', 'transfer_id'), 'again'),
  'Transfer 3 was cancelled already', 'nor cancelled twice');
select test.eq(pg_temp.bal('1210')::text || ' ' || pg_temp.checks(), '0 documents=0, inventory=0, transit=0',
  'nothing on its way, and the books tie');

-- ------------------------------------------------------------------ refused, in words
select test.throws(format('select send_stock_transfer(%L, null, %L)', (select branch from ids),
                          jsonb_build_array(jsonb_build_object('item_id', (select cups from ids), 'qty', 1))),
  'Choose where the stock goes', 'where it goes');
select test.throws(format('select send_stock_transfer(%L, %L, %L)', (select branch from ids), (select branch from ids),
                          jsonb_build_array(jsonb_build_object('item_id', (select cups from ids), 'qty', 1))),
  'The stock goes to another place', 'somewhere else');
select test.throws(format('select send_stock_transfer(%L, %L, %L)', (select branch from ids), (select kitchen from ids),
                          '[]'),
  'Add at least one line', 'something');
select test.throws(format('select send_stock_transfer(%L, %L, %L)', (select branch from ids), (select kitchen from ids),
                          jsonb_build_array(jsonb_build_object('item_id', (select cups from ids), 'qty', 1),
                                            jsonb_build_object('item_id', (select cups from ids), 'qty', 2))),
  'Golden cup is on the transfer twice: one line for it', 'an item once');
select test.throws(format('select send_stock_transfer(%L, %L, %L)', (select branch from ids), (select kitchen from ids),
                          jsonb_build_array(jsonb_build_object('item_id', (select cups from ids), 'qty', 0))),
  'Every line needs a quantity', 'a quantity');
select test.throws(format('select send_stock_transfer(%L, %L, %L)', (select branch from ids), (select kitchen from ids),
                          jsonb_build_array(jsonb_build_object('item_id', (select cups from ids), 'qty', 150))),
  'This leaves Golden cup (-50 each) below zero: confirm to send it all the same', 'below zero, asked');
select test.throws(format('select receive_stock_transfer(%L)', gen_random_uuid()), 'Transfer not found', 'a transfer');
insert into res select 'T4', send_stock_transfer((select branch from ids), (select kitchen from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select cups from ids), 'qty', 10)), null,
  p_idempotency_key => gen_random_uuid());
select test.throws(format('select receive_stock_transfer(%L, %L)', pg_temp.id('T4', 'transfer_id'),
                          jsonb_build_array(jsonb_build_object('line_id', gen_random_uuid(), 'qty', 1))),
  'That line is not on this transfer', 'its own lines');
select test.throws(format('select receive_stock_transfer(%L, %L)', pg_temp.id('T4', 'transfer_id'),
                          jsonb_build_array(jsonb_build_object(
                            'line_id', (select id from stock_transfer_line where transfer_id = pg_temp.id('T4', 'transfer_id')),
                            'qty', 11))),
  'More of Golden cup cannot arrive than was sent (10 each)', 'no more than was sent');

-- ------------------------------------------------------------------ who may
select test.act_as('cashier@example.com');
select test.throws(format('select send_stock_transfer(%L, %L, %L)', (select branch from ids), (select kitchen from ids),
                          jsonb_build_array(jsonb_build_object('item_id', (select cups from ids), 'qty', 1))),
  '%needs stock.transfer%', 'a cashier sends nothing');
select test.throws('select stock_transfers()', '%needs cost.view or stock.transfer%', 'nor sees the transfers');
select test.eq((select count(*) from stock_transfer)::int, 0, 'nor reads them');
select test.act_as('accountant@example.com');
select test.eq(jsonb_array_length(stock_transfers()), 4, 'the accountant, who sees costs, sees the four transfers');
select test.eq((select string_agg((t ->> 'no') || ' ' || (t ->> 'status'), ', ' order by (t ->> 'no')::int)
                  from jsonb_array_elements(stock_transfers()) t),
  '1 received, 2 received, 3 cancelled, 4 sent', 'where each stands');
select test.eq((select (l ->> 'qty') || ' ' || (l ->> 'unit_code') || ' > ' || (l ->> 'qty_received')
                  from jsonb_array_elements(stock_transfers()) t, jsonb_array_elements(t -> 'lines') l
                 where (t ->> 'no')::int = 2),
  '4 kg > 3.5', 'what was sent of the vanilla, and what arrived, as it was sent');
select test.throws(format('select send_stock_transfer(%L, %L, %L)', (select branch from ids), (select kitchen from ids),
                          jsonb_build_array(jsonb_build_object('item_id', (select cups from ids), 'qty', 1))),
  '%needs stock.transfer%', 'but sends nothing');
select test.eq((select string_agg(p ->> 'name', ', ') from jsonb_array_elements(stock_places()) p),
  'Main Branch, Central Kitchen', 'the places, the branch first');

-- ------------------------------------------------------------------ 1210 moves only with a transfer
select test.act_as('owner@example.com');
select test.throws($$select save_journal(test.today(), 'by hand', '[{"code":"1210","debit":100},{"code":"1020","credit":100}]', true)$$,
  '%1210%', 'a journal by hand does not touch 1210');
select test.as_admin();
select test.throws($$select post_journal('00000000-0000-0000-0000-0000000000b1', now(), 'x', 'expense', gen_random_uuid(),
                     '[{"code":"1210","debit":1},{"code":"1020","credit":1}]')$$,
  'Stock in transit (1210) moves only with a transfer between places', 'nor anything but a transfer');
select test.throws(format('update stock_transfer set note = %L where id = %L', 'x', pg_temp.id('T4', 'transfer_id')),
  'What was sent does not change: cancel the transfer and send it again', 'what was sent does not change');
select test.throws(format('delete from stock_transfer where id = %L', pg_temp.id('T1', 'transfer_id')),
  'A transfer is not deleted: cancel it while it is on its way', 'nor is a transfer deleted');
select test.throws(format('update stock_transfer set status = %L where id = %L', 'sent', pg_temp.id('T1', 'transfer_id')),
  'Transfer 1 is settled: it does not change', 'a settled one stays settled');

-- ------------------------------------------------------------------ the trail, the stock card, and the books
select test.eq((select string_agg(action || ' ' || (coalesce(after_state, before_state) ->> 'transfer_no')
                                  || coalesce(' (' || reason || ')', ''), '; ' order by id)
                  from audit_log where action like 'stock.transfer%'),
  'stock.transfer_send 1; stock.transfer_receive 1 (All there); stock.transfer_send 2; '
  || 'stock.transfer_receive 2 (A tub fell); stock.transfer_send 3; '
  || 'stock.transfer_cancel 3 (Sent to the wrong place); stock.transfer_send 4',
  'each sent, received and cancelled is on the trail, with why');
select test.eq((select string_agg(distinct stock_card_kind(type, reference_type, base_quantity_signed), ',')
                  from inventory_movement where reference_id in (select id from stock_transfer)),
  'transferred', 'the stock card calls each a transfer');
select test.eq(pg_temp.bal('1210')::text, (select trim_scale(value_sent)::text from stock_transfer
                                             where id = pg_temp.id('T4', 'transfer_id')),
  '1210 holds what is on its way: transfer 4');
select test.eq(pg_temp.checks(), 'documents=0, inventory=0, transit=0', 'and every check ties');
select test.act_as('owner@example.com');
select test.eq((select label || ' ' || ok::text from period_close_checklist(
                  (select id from accounting_period where business_id = '00000000-0000-0000-0000-0000000000b1'
                      and test.today() between starts_on and ends_on)) where check_key = 'transit'),
  'Stock on its way agrees with Stock in transit (1210) true', 'the month''s close checks it too');
select test.as_admin();
select test.eq((select count(*) from document_problems('00000000-0000-0000-0000-0000000000b1', now() + interval '1 second'))::int,
  0, 'every transfer has its journals, and every journal its transfer');
