-- =============================================================================
-- What a review of the releases since 0035 found, put right (0063). Each part
-- below is a case that went wrong before it:
--  1. a batch recorded with a time before its items were counted, and a loss
--     reversed after its item was counted, were in that count already;
--  2. a loss approved, a transfer received or cancelled, a delivery corrected
--     or credited by someone who works at another place, when no stock moved;
--     the drawer handed to someone who works elsewhere;
--  3. a transfer or a return taking an item below zero whose rule wants a
--     manager's approval, on a confirmation alone;
--  4. a payroll reopened next month moved its cost into it; a cancelled
--     payment left the month undraftable; journals named who was paid;
--  5. a delivery's share still on the shelf forgot what was used before a
--     correction, and counted what went back as used; a bill dated before its
--     delivery; a supplier settled by a credit kept in use; an order whose
--     delivery was reversed kept from being cancelled;
--  6. an expense from the till or the safe dated an earlier day;
--  7. the café's staff cost counting the year-end close.
-- Golden beans: 1,000 g at 10; cups: 100 at 50; water: 24 at 250.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
insert into location (business_id, kind, name) values ('00000000-0000-0000-0000-0000000000b1', 'branch', 'Second Branch');
-- A barista at the first branch, a manager at the second, and a buyer.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000e1', 'barista@example.com'),
  ('a0000000-0000-0000-0000-0000000000f2', 'manager2@example.com'),
  ('a0000000-0000-0000-0000-0000000000e7', 'buyer@example.com');
insert into app_user (business_id, full_name, email, auth_user_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'Main Barista', 'barista@example.com', 'a0000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000b1', 'Second Manager', 'manager2@example.com', 'a0000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Buyer', 'buyer@example.com', 'a0000000-0000-0000-0000-0000000000e7');
insert into user_role (app_user_id, role, location_id)
select id, 'barista', (select id from location where name = 'Main Branch') from app_user where email = 'barista@example.com';
insert into user_role (app_user_id, role, location_id)
select id, 'branch_manager', (select id from location where name = 'Second Branch') from app_user where email = 'manager2@example.com';
insert into user_role (app_user_id, role) select id, 'purchasing' from app_user where email = 'buyer@example.com';

create temp table ids as
select (select id from location where name = 'Main Branch') branch1, (select id from location where name = 'Second Branch') branch2,
       (select id from location where name = 'Central Kitchen') kitchen,
       'c0000000-0000-0000-0000-000000000001'::uuid beans, 'c0000000-0000-0000-0000-000000000002'::uuid cups,
       'c0000000-0000-0000-0000-000000000003'::uuid water,
       (select timezone from business where id = '00000000-0000-0000-0000-0000000000b1') tz,
       (date_trunc('month', test.today()) - interval '1 month')::date as lm,
       (date_trunc('month', test.today()) - interval '1 day')::date as lm_end,
       (date_trunc('month', test.today()) - interval '2 month')::date as hired;
grant select on ids to public;
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;
-- The tests' own view of the records, whoever they act as.
create function pg_temp.qty(p_item uuid, p_place uuid default null) returns numeric language sql security definer as $$
  select (item_position('00000000-0000-0000-0000-0000000000b1', p_item,
                        coalesce(p_place, default_location('00000000-0000-0000-0000-0000000000b1')))).qty
$$;
create function pg_temp.pos(p_item uuid, p_place uuid default null) returns text language sql security definer as $$
  select trim_scale(p.qty) || ' at ' || trim_scale(p.value)
    from item_position('00000000-0000-0000-0000-0000000000b1', p_item,
                       coalesce(p_place, default_location('00000000-0000-0000-0000-0000000000b1'))) p
$$;
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today()) where difference <> 0
$$;
create function pg_temp.audits(p_action text) returns int language sql security definer as $$
  select count(*)::int from audit_log where action = p_action
$$;
create function pg_temp.sup(p_name text) returns uuid language sql security definer as $$
  select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' and name = p_name
$$;
create function pg_temp.kci() returns uuid language sql as $$ select pg_temp.sup('Kurdistan Coffee Imports') $$;
create function pg_temp.line(p_item uuid, p_qty numeric, p_unit text, p_price numeric) returns jsonb language sql as $$
  select jsonb_build_object('item_id', p_item, 'qty', p_qty, 'unit_code', p_unit, 'unit_price', p_price)
$$;
-- A delivery's lines as its correction takes them, each with a new quantity and price.
create function pg_temp.relines(p_receipt uuid, p_qty numeric, p_price numeric) returns jsonb
language sql security definer as $$
  select jsonb_agg(jsonb_build_object('line_id', l ->> 'line_id', 'item_id', l ->> 'item_id', 'qty', p_qty,
                                      'unit_code', l ->> 'unit_code', 'unit_price', p_price))
    from jsonb_array_elements(receipt_state(p_receipt) -> 'lines') l
$$;
create function pg_temp.receipt_lines(p_receipt uuid) returns jsonb language sql security definer as $$
  select receipt_state(p_receipt) -> 'lines'
$$;
create function pg_temp.member(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
create function pg_temp.journal(p_id uuid) returns journal_entry language sql security definer as $$
  select * from journal_entry where id = p_id
$$;

select test.eq(pg_temp.checks(), null, 'the books tie before anything');

-- =============================================================================
-- 1. What a count has seen is not posted again
-- =============================================================================
-- Vanilla gelato, made in batches of 5 kg from 4 L of milk and 800 g of sugar.
select test.act_as('owner@example.com');
select create_item('Golden milk', 'ingredient', 'ml', 'volume', p_units => '[{"code":"L","label":"L","factor":1000}]',
  p_opening_qty => 60000, p_opening_unit_cost => 1.5, p_opening_reason => 'the opening count');
select create_item('Golden sugar', 'ingredient', 'g', 'mass',
  p_opening_qty => 10000, p_opening_unit_cost => 1.2, p_opening_reason => 'the opening count');
select create_item('Golden vanilla gelato', 'finished_good', 'g', 'mass',
  p_units => '[{"code":"kg","label":"kg","factor":1000}]', p_opening_qty => 1000, p_opening_unit_cost => 2,
  p_opening_reason => 'the opening count');
select test.as_admin();
create temp table gel as
select (select id from item where name = 'Golden milk') milk, (select id from item where name = 'Golden sugar') sugar,
       (select id from item where name = 'Golden vanilla gelato') vanilla;
grant select on gel to public;
select test.act_as('owner@example.com');
insert into res select 'recipe', save_batch_recipe(null, 'Golden vanilla gelato',
  jsonb_build_object('item_id', (select vanilla from gel)), 5, 'kg',
  jsonb_build_array(jsonb_build_object('item_id', (select milk from gel), 'qty', 4, 'unit_code', 'L'),
                    jsonb_build_object('item_id', (select sugar from gel), 'qty', 800, 'unit_code', 'g')),
  'Churn slowly', true, 72);
select test.as_admin();
update recipe_version set effective_from = test.today() - 60 where recipe_id = pg_temp.id('recipe', 'recipe_id');

-- Last night a batch was made, and nobody recorded it. This morning the
-- counter counts the shelf and submits the count: the batch is in it.
select test.act_as('counter@example.com');
insert into res select 'count1', jsonb_build_object('id',
  start_stock_count(array[(select vanilla from gel), (select milk from gel), (select sugar from gel)]));
select record_count(pg_temp.id('count1', 'id'), (select vanilla from gel), 6, 'kg');
select record_count(pg_temp.id('count1', 'id'), (select milk from gel), 56, 'L');
select record_count(pg_temp.id('count1', 'id'), (select sugar from gel), 9200, 'g');
select submit_stock_count(pg_temp.id('count1', 'id'));
-- Recorded now with last night's time, it would be posted twice.
select test.act_as('owner@example.com');
select test.throws(format('select record_production(%L, 1, p_produced_at => %L, p_late_reason => %L)',
                          pg_temp.id('recipe', 'recipe_id'),
                          ((test.today() - 1) + time '20:00') at time zone (select tz from ids),
                          'made last night, recorded this morning'),
  'Golden milk was counted after that time: a batch made before the count is in it already, and is not recorded now',
  'a batch made before a count still open is in it already: not recorded');
select approve_stock_count(pg_temp.id('count1', 'id'));
select test.eq((select string_agg(trim_scale(pg_temp.qty(x))::text, ' ') from unnest(array[(select vanilla from gel),
                  (select milk from gel), (select sugar from gel)]) x),
  '6000 56000 9200', 'the count approved, the books hold what is on the shelf, the batch once');
-- Within the hour, against the count now approved: the same.
select test.throws(format('select record_production(%L, 1, p_produced_at => %L)',
                          pg_temp.id('recipe', 'recipe_id'), now() - interval '50 minutes'),
  'Golden milk was counted after that time%', 'nor is one made within the hour before an approved count');
-- Made now, it is recorded.
insert into res select 'batch', record_production(pg_temp.id('recipe', 'recipe_id'), 1);
select test.eq((select string_agg(trim_scale(pg_temp.qty(x))::text, ' ') from unnest(array[(select vanilla from gel),
                  (select milk from gel), (select sugar from gel)]) x),
  '11000 52000 8400', 'a batch made after the count is recorded as before');

-- A loss of 300 g of beans waits for a manager. The counter finds all 1,000 g
-- on the shelf, and the count is approved: it puts the 300 g back.
select set_business_rule('waste_approval_over', 'business', '', '100'::jsonb, 'Losses over 100 wait for a manager');
select test.act_as('barista@example.com');
insert into res select 'spill', record_loss('waste', (select beans from ids), null, 300, 'g', 'Spilt',
                                            p_location => (select branch1 from ids), p_wait => true);
select test.act_as('counter@example.com');
insert into res select 'count2', jsonb_build_object('id', start_stock_count(array[(select beans from ids)]));
select record_count(pg_temp.id('count2', 'id'), (select beans from ids), 1000, 'g');
select submit_stock_count(pg_temp.id('count2', 'id'));
select test.act_as('owner@example.com');
select approve_stock_count(pg_temp.id('count2', 'id'));
-- Reversed now, the 300 g would come back a second time.
select test.throws(format('select review_loss(%L, %L, %L)', pg_temp.id('spill', 'movement_id'), 'reverse', 'Nothing was spilt'),
  'Golden beans was counted since the loss, and the count put its stock right: approve the loss instead',
  'a loss counted since is not reversed');
select review_loss(pg_temp.id('spill', 'movement_id'), 'approve');
select test.eq(pg_temp.qty((select beans from ids)), 1000::numeric, 'approved, the books stand as counted: 1,000 g');

-- =============================================================================
-- 2. Each place's work by those who work there
-- =============================================================================
-- A loss at the first branch is not approved by the second's manager.
select test.act_as('barista@example.com');
insert into res select 'spill2', record_loss('waste', (select beans from ids), null, 30, 'g', 'Spilt again',
                                             p_location => (select branch1 from ids), p_wait => true);
select test.act_as('manager2@example.com');
select test.throws(format('select review_loss(%L, %L, %L)', pg_temp.id('spill2', 'movement_id'), 'reverse', 'No'),
  'You work at Second Branch, not at Main Branch', 'the second branch''s manager does not reverse the first''s loss');
select test.throws(format('select review_loss(%L, %L)', pg_temp.id('spill2', 'movement_id'), 'approve'),
  'You work at Second Branch, not at Main Branch', 'nor approve it');
select test.act_as('manager@example.com');
select review_loss(pg_temp.id('spill2', 'movement_id'), 'approve');

-- A transfer from the first branch to the kitchen is not cancelled at the
-- second (its goods would come back to the first: 0055 refused that), nor
-- received there, even as "nothing arrived", which moves nothing.
select test.act_as('owner@example.com');
insert into res select 'k1', send_stock_transfer((select branch1 from ids), (select kitchen from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select beans from ids), 'qty', 100, 'unit_code', 'g')),
  'For the kitchen', p_idempotency_key => gen_random_uuid());
select test.act_as('manager2@example.com');
select test.throws(format('select cancel_stock_transfer(%L, %L)', pg_temp.id('k1', 'transfer_id'), 'Not needed'),
  'You work at Second Branch, not at Main Branch', 'the second branch''s manager does not cancel the first branch''s transfer');
select test.throws(format('select receive_stock_transfer(%L, %L, %L)', pg_temp.id('k1', 'transfer_id'),
                          jsonb_build_array(jsonb_build_object('line_id', (select id from stock_transfer_line
                                                                            where transfer_id = pg_temp.id('k1', 'transfer_id')),
                                                               'qty', 0)),
                          'Nothing arrived'),
  'You work at Second Branch, not at Central Kitchen', 'nor receive it at the kitchen, even as "nothing arrived"');
select test.act_as('owner@example.com');
select receive_stock_transfer(pg_temp.id('k1', 'transfer_id'), null, 'All there', gen_random_uuid());
select test.eq(pg_temp.qty((select beans from ids), (select kitchen from ids)), 100::numeric, 'the kitchen receives it');

-- The drawer is not handed to someone who works at another place, nor are
-- they offered to take it.
select test.act_as('cashier@example.com');
select test.throws(format('select hand_over_session(0, %L)', pg_temp.member('manager2@example.com')),
  'Second Manager works at Second Branch, not here: choose someone who works here',
  'the first branch''s drawer is not handed to the second''s manager');
select test.eq((select string_agg(t ->> 'name', ', ' order by t ->> 'name')
                  from jsonb_array_elements(cash_session_status() -> 'takers') t),
  'Demo Manager, Demo Owner, Main Barista', 'those offered to take it work here: the second''s manager is not');

-- A delivery at the first branch is not corrected or credited by the second's
-- manager, though no stock moves.
select test.act_as('owner@example.com');
select create_supplier('Water Co', 'water', null);
insert into res select 'w0', receive_goods(pg_temp.kci(), jsonb_build_array(pg_temp.line((select water from ids), 2, 'each', 250)),
  p_location => (select branch1 from ids));
insert into res select 'w1', receive_goods(pg_temp.kci(), jsonb_build_array(pg_temp.line((select water from ids), 4, 'each', 250)),
  p_location => (select branch1 from ids));
insert into res select 'wb1', record_bill(pg_temp.kci(), 'KCI-W1', test.today(), 1000, 0, pg_temp.id('w1', 'receipt_id'));
-- All the water is used: a credit on it moves no stock.
select adjust_stock((select water from ids), -30, 'each', 'Sold off', null, (select branch1 from ids));
select test.act_as('manager2@example.com');
select test.throws(format('select correct_receipt(%L, %L, %L, null, %L)', pg_temp.id('w0', 'receipt_id'),
                          pg_temp.receipt_lines(pg_temp.id('w0', 'receipt_id')), pg_temp.sup('Water Co'),
                          'The wrong supplier'),
  'You work at Second Branch, not at Main Branch', 'the second branch''s manager does not correct the first''s delivery');
select test.throws(format('select record_supplier_credit(%L, %L, 100, %L, %L, %L)', pg_temp.kci(), 'price', 'KCI-CN-W1',
                          'Price agreed down', pg_temp.id('w1', 'receipt_id')),
  'You work at Second Branch, not at Main Branch', 'nor record a credit on it');
select test.act_as('owner@example.com');
select correct_receipt(pg_temp.id('w0', 'receipt_id'), pg_temp.receipt_lines(pg_temp.id('w0', 'receipt_id')),
                       pg_temp.sup('Water Co'), null, 'The wrong supplier');
insert into res select 'wc1', record_supplier_credit(pg_temp.kci(), 'price', 100, 'KCI-CN-W1', 'Price agreed down',
  pg_temp.id('w1', 'receipt_id'));
select test.eq(test.lines_of(pg_temp.id('wc1', 'credit_id')), '2000 Dr 100 | 5050 Cr 100',
  'the owner does: all of it used, it comes off the price variance');

-- =============================================================================
-- 3. Below zero by a transfer or a return: a manager approves it
-- =============================================================================
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', (select cups from ids)::text, '"approve"'::jsonb,
                         'A manager approves cups below zero');
select test.act_as('buyer@example.com');
select test.throws(format('select send_stock_transfer(%L, %L, %L, p_confirm => true)', (select branch1 from ids),
                          (select kitchen from ids), jsonb_build_array(pg_temp.line((select cups from ids), 150, 'each', null))),
  'This leaves Golden cup below zero, which a manager approves: ask one to send it',
  'the buyer does not send cups the books do not hold, confirmed or not');
select test.act_as('manager@example.com');
insert into res select 'k2', send_stock_transfer((select branch1 from ids), (select kitchen from ids),
  jsonb_build_array(pg_temp.line((select cups from ids), 150, 'each', null)), 'The kitchen''s cups', true);
select test.eq((pg_temp.qty((select cups from ids)), pg_temp.audits('stock.below_zero')), (-50::numeric, 1),
  'the manager does, and it is on the audit trail');
select test.act_as('buyer@example.com');
select test.throws(format('select return_to_supplier(%L, %L, %L, p_confirm => true)', pg_temp.kci(),
                          jsonb_build_array(pg_temp.line((select cups from ids), 10, 'each', null)), 'Cracked'),
  'This leaves Golden cup below zero, which a manager approves: ask one to return it', 'nor return them');
select test.act_as('manager@example.com');
select return_to_supplier(pg_temp.kci(), jsonb_build_array(pg_temp.line((select cups from ids), 10, 'each', null)), 'Cracked',
                          p_confirm => true);
select test.eq(pg_temp.audits('stock.below_zero'), 2, 'the manager does, on the trail too');

-- =============================================================================
-- 4. Payroll
-- =============================================================================
select test.act_as('owner@example.com');
select save_employee(null, 'Rana', null, 'Barista', (select branch1 from ids), (select hired from ids), null, gen_random_uuid());
select save_employee(null, 'Sami', null, 'Barista', (select branch1 from ids), (select hired from ids), null, gen_random_uuid());
select set_employee_pay((select id from employee where full_name = 'Rana'), 'monthly', 600000, 8, null, null, gen_random_uuid());
select set_employee_pay((select id from employee where full_name = 'Sami'), 'monthly', 450000, 8, null, null, gen_random_uuid());
insert into res select 'adv', record_advance((select id from employee where full_name = 'Sami'), 50000, 'bank', 'Rent',
                                             null, gen_random_uuid());
select test.eq((select description from pg_temp.journal((select journal_entry_id from employee_advance
                                                           where id = pg_temp.id('adv', 'advance_id')))),
  'Advance on pay', 'an advance''s journal names neither who took it nor why');
insert into res select 'run', draft_payroll((select lm from ids), gen_random_uuid());
insert into res select 'ap1', approve_payroll(pg_temp.id('run', 'run_id'), gen_random_uuid());
insert into res select 'pay', pay_salary((select l.id from payroll_line l join employee e on e.id = l.employee_id
                                           where l.run_id = pg_temp.id('run', 'run_id') and e.full_name = 'Rana'),
                                         null, 'bank', gen_random_uuid());
select test.as_admin();
select test.eq((select j.description from salary_payment p join journal_entry j on j.id = p.journal_entry_id
                 where p.id = pg_temp.id('pay', 'payment_id')),
  'Salaries ' || payroll_month_text((select lm from ids)) || ' (payroll ' || (pg_temp.r('run') ->> 'run_no') || ')',
  'a salary''s journal names its payroll, not whom it paid');
select test.act_as('owner@example.com');

-- Rana was paid by mistake: she left the month before. The payment is
-- cancelled, the payroll reopened, and the month drafted again without her.
select cancel_salary_payment(pg_temp.id('pay', 'payment_id'), 'Rana left the month before', gen_random_uuid());
insert into res select 'reopen', reopen_payroll(pg_temp.id('run', 'run_id'), 'Rana left the month before', gen_random_uuid());
select test.eq((select rv.occurred_at from journal_entry rv join payroll_approval a on a.reopen_journal_id = rv.id
                 where a.run_id = pg_temp.id('run', 'run_id')),
               (select j.occurred_at from journal_entry j join payroll_approval a on a.journal_entry_id = j.id
                 where a.run_id = pg_temp.id('run', 'run_id')),
  'reopened, the approval is reversed in its own month, not in this one');
select set_employee_left((select id from employee where full_name = 'Rana'), (select lm from ids) - 1, 'Left the month before',
                         gen_random_uuid());
select test.succeeds(format('select draft_payroll(%L, gen_random_uuid())', (select lm from ids)),
  'the month is drafted again, though a cancelled payment points at her line');
select test.eq((select string_agg(e.full_name || ' ' || trim_scale(l.gross) || '/' || trim_scale(l.net), ', ' order by e.full_name)
                  from payroll_line l join employee e on e.id = l.employee_id where l.run_id = pg_temp.id('run', 'run_id')),
  'Rana 0/0, Sami 450000/400000', 'her line kept, at nothing; Sami''s pay less what he owes');
insert into res select 'ap2', approve_payroll(pg_temp.id('run', 'run_id'), gen_random_uuid());
select test.act_as('owner@example.com');
select test.eq((select string_agg(code || ' ' || trim_scale(amount), ', ' order by code)
                  from report_profit_and_loss((select lm from ids), (select lm_end from ids)) where code = '6100'),
  '6100 450000', 'last month''s pay: Sami''s alone, approved, taken back and approved again in its month');
select test.eq((select count(*)::int from report_profit_and_loss(test.today(), test.today()) where code = '6100' and amount <> 0), 0,
  'and nothing of it in this one');
-- Reopened again with the month locked: refused, as its approval would be.
select lock_period((select id from accounting_period where business_id = '00000000-0000-0000-0000-0000000000b1'
                      and starts_on = (select lm from ids)), 'Month end', gen_random_uuid());
select test.throws(format('select reopen_payroll(%L, %L)', pg_temp.id('run', 'run_id'), 'Check a line'),
  'Accounting period % is locked%', 'a locked month''s payroll is not reopened');
select test.eq((select status::text from payroll_run where id = pg_temp.id('run', 'run_id')), 'approved', 'it stays approved');
select unlock_period((select id from accounting_period where business_id = '00000000-0000-0000-0000-0000000000b1'
                        and starts_on = (select lm from ids)), 'The checks go on', gen_random_uuid());
select test.eq(pg_temp.checks(), null, 'the books tie after the payroll');

-- =============================================================================
-- 5. Purchases
-- =============================================================================
select test.as_admin();
insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock) values
  ('c0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'G-JAM', 'Golden jam', 'ingredient', 'each', 'count', false),
  ('c0000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', 'G-SYRUP', 'Golden syrup', 'ingredient', 'each', 'count', false);
select test.act_as('owner@example.com');

-- 10 jars of jam at 1,000; 5 used; the delivery was 12, not 10; then the
-- price was 900. 7 of the 12 are on the shelf: 7/12 of the price's change
-- comes off the stock, the rest off the price variance.
insert into res select 'j1', receive_goods(pg_temp.kci(),
  jsonb_build_array(pg_temp.line('c0000000-0000-0000-0000-0000000000a1', 10, 'each', 1000)), p_location => (select branch1 from ids));
select adjust_stock('c0000000-0000-0000-0000-0000000000a1', -5, 'each', 'Used in the kitchen', null, (select branch1 from ids));
select correct_receipt(pg_temp.id('j1', 'receipt_id'), pg_temp.relines(pg_temp.id('j1', 'receipt_id'), 12, 1000), null, null,
                       'Two more came than were entered');
insert into res select 'j1fix', correct_receipt(pg_temp.id('j1', 'receipt_id'),
  pg_temp.relines(pg_temp.id('j1', 'receipt_id'), 12, 900), null, null, 'The price agreed was 900');
select test.eq((pg_temp.r('j1fix') -> 'items' -> 0 ->> 'still_on_hand')::numeric, round(7 / 12::numeric, 4),
  'the share still on the shelf remembers the 5 used before the quantity was put right');
select test.eq(pg_temp.pos('c0000000-0000-0000-0000-0000000000a1'), '7 at 6300', 'the 7 jars on the shelf at 900 each');

-- 10 bottles of syrup at 1,000, billed; 5 go back; then a credit of 1,000 on
-- the price. The 5 kept are all on the shelf: all of it comes off the stock.
insert into res select 's1', receive_goods(pg_temp.kci(),
  jsonb_build_array(pg_temp.line('c0000000-0000-0000-0000-0000000000a2', 10, 'each', 1000)), p_location => (select branch1 from ids));
select record_bill(pg_temp.kci(), 'KCI-S1', test.today(), 10000, 0, pg_temp.id('s1', 'receipt_id'));
select return_to_supplier(pg_temp.kci(), jsonb_build_array(pg_temp.line('c0000000-0000-0000-0000-0000000000a2', 5, 'each', null)),
                          'Damaged', pg_temp.id('s1', 'receipt_id'));
insert into res select 's1c', record_supplier_credit(pg_temp.kci(), 'price', 1000, 'KCI-CN-S1', 'Price agreed down',
                                                     pg_temp.id('s1', 'receipt_id'));
select test.eq(test.lines_of(pg_temp.id('s1c', 'credit_id')), '1200 Cr 1000 | 2000 Dr 1000',
  'what went back is not counted as used: the credit comes off the 5 bottles kept');
select test.eq(pg_temp.pos('c0000000-0000-0000-0000-0000000000a2'), '5 at 4000', 'at 800 each');

-- A bill is not dated before its delivery came: on the days between, it
-- would clear goods received not invoiced before they were received.
insert into res select 's2', receive_goods(pg_temp.kci(),
  jsonb_build_array(pg_temp.line('c0000000-0000-0000-0000-0000000000a2', 4, 'each', 1000)), p_location => (select branch1 from ids));
select test.throws(format('select record_bill(%L, %L, %L, 4000, 0, %L)', pg_temp.kci(), 'KCI-S2', test.today() - 1,
                          pg_temp.id('s2', 'receipt_id')),
  'Delivery % came on ' || test.today() || ': date its bill that day or later', 'a bill dated the day before its delivery is refused');
select record_bill(pg_temp.kci(), 'KCI-S2', test.today(), 4000, 0, pg_temp.id('s2', 'receipt_id'));
select test.as_admin();
select test.eq((select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
                  from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today() - 1)
                 where check_key in ('grni', 'payables') and difference <> 0), null,
  'dated the day it came, the day before still ties');

-- A supplier settled by a credit is taken out of use.
select test.act_as('owner@example.com');
insert into res select 'dairy', jsonb_build_object('id', create_supplier('Dairy Co', 'milk', null));
insert into res select 'd1', receive_goods(pg_temp.id('dairy', 'id'),
  jsonb_build_array(pg_temp.line('c0000000-0000-0000-0000-0000000000a2', 2, 'each', 1000)), p_location => (select branch1 from ids),
  p_confirm => true);
select record_bill(pg_temp.id('dairy', 'id'), 'DC-1', test.today(), 2000, 0, pg_temp.id('d1', 'receipt_id'));
select return_to_supplier(pg_temp.id('dairy', 'id'), jsonb_build_array(pg_temp.line('c0000000-0000-0000-0000-0000000000a2', 2, 'each', null)),
                          'All spoiled', pg_temp.id('d1', 'receipt_id'), p_confirm => true);
select test.succeeds(format('select update_supplier(%L, %L, %L, null, false, %L)', pg_temp.id('dairy', 'id'), 'Dairy Co', 'milk',
                            'No longer used'),
  'a supplier whose bill a credit settled is owed nothing, and is taken out of use');

-- An order whose only delivery was reversed has nothing come against it: it is cancelled.
insert into res select 'po', save_po(null, pg_temp.kci(), jsonb_build_array(pg_temp.line((select water from ids), 12, 'each', 250)),
                                     p_location => (select branch1 from ids));
select approve_po(pg_temp.id('po', 'po_id'));
select send_po(pg_temp.id('po', 'po_id'));
insert into res select 'p1', receive_goods(pg_temp.kci(), jsonb_build_array(pg_temp.line((select water from ids), 12, 'each', 250)),
                                           p_purchase_order => pg_temp.id('po', 'po_id'));
select reverse_receipt(pg_temp.id('p1', 'receipt_id'), 'Entered against the wrong order');
select test.eq(purchase_order(pg_temp.id('po', 'po_id')) ->> 'receiving', 'none', 'the delivery reversed, nothing has come');
select test.succeeds(format('select cancel_po(%L, %L)', pg_temp.id('po', 'po_id'), 'Ordered twice'), 'and the order is cancelled');
select test.eq(pg_temp.checks(), null, 'the books tie after the purchases');

-- =============================================================================
-- 6. Money from the till or the safe, recorded the day it is taken out
-- =============================================================================
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'cash',
                   '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2}]');
select test.act_as('manager@example.com');
select test.throws(format('select record_expense(%L, 1000, %L, %L, %L)', 'Cleaning', '6900', 'cash', test.today() - 1),
  'Money from the till or the safe is recorded the day it is taken out: today', 'not from the till dated yesterday');
select test.throws(format('select record_expense(%L, 1000, %L, %L, %L)', 'Cleaning', '6900', 'safe', test.today() - 1),
  'Money from the till or the safe is recorded the day it is taken out: today', 'nor from the safe');
insert into res select 'e1', record_expense('Cleaning', 1000, '6900', 'cash', test.today(), p_idempotency_key => gen_random_uuid());
insert into res select 'e2', record_expense('Printer paper', 1500, '6900', 'bank', test.today() - 1,
                                            p_idempotency_key => gen_random_uuid());
select test.as_admin();
select test.eq((select string_agg(business_local_date('00000000-0000-0000-0000-0000000000b1', j.occurred_at)::text, ' '
                                  order by j.journal_no)
                  from expense x join journal_entry j on j.id = x.journal_entry_id
                 where x.id in (pg_temp.id('e1', 'expense_id'), pg_temp.id('e2', 'expense_id'))),
  test.today() || ' ' || (test.today() - 1), 'from the till today; from the bank, the day it was paid');
-- A journal that moved the till's cash is reversed the day the drawer counts
-- it back: today. An expense from the till dated two days ago, as the
-- releases before this one recorded it, is not reversed yesterday.
select test.as_admin();
select set_config('request.jwt.claims',
                  json_build_object('sub', 'a0000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, false);
do $$
begin
  execute format('insert into res select %L, %s(%L, 500, %L, %L, %L, null)', 'e0',
    coalesce(to_regprocedure('record_expense__run_0055(text,numeric,text,text,date,uuid)')::regproc::text,
             'record_expense__run'),
    'Window cleaning', '6900', 'till', test.today() - 2);
end $$;
select test.act_as('owner@example.com');
select test.throws(format('select reverse_journal(%L, %L, %L)', (select journal_entry_id from expense where id = pg_temp.id('e0', 'expense_id')),
                          'Paid twice', test.today() - 1),
  'A journal that moved the till''s or the safe''s cash is reversed today, when they count it',
  'a journal that moved the till''s cash is not reversed on an earlier day');
select test.succeeds(format('select reverse_journal(%L, %L)', (select journal_entry_id from expense where id = pg_temp.id('e0', 'expense_id')),
                            'Paid twice'), 'it is reversed today');
select test.eq(pg_temp.checks(), null, 'the drawer and the safe still tie');

-- =============================================================================
-- 7. The staff's cost without the year-end close
-- =============================================================================
select test.as_admin();
select post_year_end_close('00000000-0000-0000-0000-0000000000b1', test.today());
select test.act_as('owner@example.com');
select test.eq((select string_agg((m ->> 'month') || ' ' || (m ->> 'cost'), ', ' order by m ->> 'month')
                  from jsonb_array_elements(report_staff((select lm from ids), test.today()) -> 'labour') m),
  (select lm from ids) || ' 450000, ' || date_trunc('month', test.today())::date || ' 0',
  'the café''s staff cost by month leaves the year-end close out');
select test.eq((select string_agg((m ->> 'month') || ' ' || (m ->> 'cost'), ', ' order by m ->> 'month')
                  from jsonb_array_elements(report_staff((select lm from ids), test.today(), (select branch1 from ids)) -> 'labour') m),
  (select lm from ids) || ' 450000, ' || date_trunc('month', test.today())::date || ' 0',
  'as the branch''s does');
