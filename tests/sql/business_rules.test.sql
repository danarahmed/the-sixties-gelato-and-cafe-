-- =============================================================================
-- Business rules (0040, release O): each rule set with a reason and kept with
-- its history; the discount cap per role and the rounding step; the refund a
-- second person approves; stock below zero refused, approved or alerted as the
-- item's rule says; losses added up by person and by item, approved with a
-- PIN, saved to wait for approval, then approved or reversed. Fixtures: beans
-- 1,000 g at 10, cups 100 at 50, water 24 at 250; an espresso (20 g of beans,
-- and a cup to take away) is 2,500, a bottle of water 1,000. The fixtures
-- opened the drawer.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.sale(p text) returns uuid language sql as $$ select (v ->> 'order_id')::uuid from res where k = p $$;
create function pg_temp.mv(p text) returns uuid language sql as $$ select (v ->> 'movement_id')::uuid from res where k = p $$;
-- The loss a movement belongs to (0048): its journal is the loss's.
create function pg_temp.loss(p text) returns uuid language sql as $$ select (v ->> 'loss_id')::uuid from res where k = p $$;
create function pg_temp.on_hand(p_item text) returns numeric language sql security definer as $$
  select trim_scale((item_position('00000000-0000-0000-0000-0000000000b1', p_item::uuid,
                                   default_location('00000000-0000-0000-0000-0000000000b1'))).qty)
$$;
create function pg_temp.member(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
create function pg_temp.rule(p_key text, p_item text default null, p_role text default null) returns text
language sql security definer as $$
  select rule_value('00000000-0000-0000-0000-0000000000b1', p_key, p_item::uuid,
                    case when p_role is null then null else array[p_role::app_role] end) #>> '{}'
$$;
create function pg_temp.approve(p_kind text, p_scope jsonb default '{}') returns uuid language plpgsql as $$
declare r jsonb;
begin
  r := request_approval(p_kind, pg_temp.member('manager@example.com'), '2468', p_scope);
  if not (r ->> 'ok')::boolean then raise exception 'approval refused: %', r ->> 'error'; end if;
  return (r ->> 'approval_id')::uuid;
end $$;
create function pg_temp.status(p text) returns text language sql security definer as $$
  select approval_status::text from inventory_movement where id = (select (v ->> 'movement_id')::uuid from res where k = p)
$$;
create function pg_temp.alerts(p_rule text) returns text language sql security definer as $$
  select string_agg(urgency || ': ' || title, ' | ' order by title)
    from alert_conditions('00000000-0000-0000-0000-0000000000b1', now()) where rule = p_rule
$$;

-- Two baristas, who record losses and may not approve them; the manager's PIN.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000001a', 'barista@example.com'),
                                         ('a0000000-0000-0000-0000-00000000001b', 'barista2@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000001a'),
       ('00000000-0000-0000-0000-0000000000b1', 'Second Barista', 'barista2@example.com', 'a0000000-0000-0000-0000-00000000001b');
insert into user_role (app_user_id, role)
select id, 'barista' from app_user where email in ('barista@example.com', 'barista2@example.com');
select test.act_as('manager@example.com');
select set_my_pin('2468');

-- ------------------------------------------------------------ the rules and their defaults
select test.act_as('owner@example.com');
select test.eq((select string_agg((x ->> 'key') || ' ' || (x ->> 'scope_type')
                                  || coalesce(' ' || nullif(x ->> 'scope_id', ''), '') || ' = ' || (x ->> 'value')
                                  || case when (x ->> 'is_default')::boolean then ' (default)' else '' end, '; '
                                  order by x ->> 'key', x ->> 'scope_type', x ->> 'scope_id')
                  from jsonb_array_elements(list_business_rules() -> 'rows') x
                 where x ->> 'key' not in ('discount_round_to')),
  'clocked_in_alert_hours business = 16 (default); daily_sales_target business = 0 (default); '
  'discount_cap_percent business = 10 (default); labour_target_percent business = 0 (default); '
  'late_after_minutes business = 5 (default); '
  'loyalty business = on (default); loyalty_point_per business = 1000 (default); '
  'loyalty_reward_points business = 100 (default); loyalty_reward_value business = 5000 (default); '
  'negative_stock business = alert (default); '
  'negative_stock item_type finished_good = block (default); negative_stock item_type sub_recipe_output = block (default); '
  'overtime_percent business = 150 (default); payday business = 1 (default); '
  'po_approve_up_to business = 250000 (default); po_approve_up_to role general_manager = 1000000000 (default); '
  'po_approve_up_to role owner = 1000000000 (default); '
  'refund_approval_over business = 25000 (default); usd_rate_max_age_hours business = 36 (default); '
  'usd_round_to business = 250 (default); waste_approval_over business = 50000 (default); '
  'waste_approval_window business = session (default)',
  'every rule starts at its default: the business row''s columns, and the plan''s for the rest');

-- ------------------------------------------------------------ setting a rule
insert into res select 'R1', set_business_rule('discount_cap_percent', 'role', 'cashier', '5', 'Cashiers give 5% at most');
select test.eq(pg_temp.rule('discount_cap_percent', null, 'cashier') || '/' || pg_temp.rule('discount_cap_percent', null, 'branch_manager')
               || '/' || pg_temp.rule('discount_cap_percent'),
  '5/10/10', 'a role''s own cap; the others follow the café''s');
select test.throws($$select set_business_rule('discount_cap_percent', 'role', 'cashier', '6', '  ')$$,
  'Say why the rule is changing', 'a rule changes with a reason');
select test.throws($$select set_business_rule('discount_cap_percent', 'role', 'cashier', '5', 'again')$$,
  'That is the rule already', 'setting it to what it is changes nothing');
select test.throws($$select set_business_rule('discount_cap_percent', 'role', 'cashier', '101', 'too much')$$,
  'Enter a number from 0 to 100', 'a cap is a share of the bill');
select test.throws($$select set_business_rule('discount_cap_percent', 'role', 'cashier', '"five"', 'words')$$,
  'Enter a number', 'a number, not words');
select test.throws($$select set_business_rule('discount_round_to', 'role', 'cashier', '100', 'per role')$$,
  'This rule is not set that way', 'the rounding step is the café''s alone');
select test.throws($$select set_business_rule('discount_round_to', 'business', null, '12.5', 'halves')$$,
  'Enter a whole number', 'a step is a whole amount');
select test.throws($$select set_business_rule('negative_stock', 'business', null, '"allow"', 'everything')$$,
  'Using stock the books do not hold, with no alert, is for chosen items only',
  'no alert at all only for chosen items');
select test.throws($$select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-000000000003', '"maybe"', 'x')$$,
  'That is not one of this rule''s choices', 'one of its choices');
select test.throws($$select set_business_rule('negative_stock', 'role', 'cashier', '"block"', 'x')$$,
  'This rule is not set that way', 'stock below zero is not a matter of roles');
select test.throws($$select set_business_rule('no_such_rule', 'business', null, '1', 'x')$$,
  'Unknown rule', 'only the rules there are');
select test.throws($$select set_business_rule('discount_cap_percent', 'role', 'chef', '5', 'x')$$,
  'Unknown role', 'only the roles there are');
select test.throws($$select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-00000000dead', '"block"', 'x')$$,
  'Unknown item', 'only the café''s own items');
select test.act_as('manager@example.com');
select test.throws($$select set_business_rule('discount_cap_percent', 'business', null, '20', 'more for all')$$,
  '%needs settings.manage%', 'a branch manager does not set the rules');
select test.throws($$select list_business_rules()$$, '%needs settings.manage%', 'nor reads them there');

-- Back to the default, with a reason; every change kept, from what to what.
select test.act_as('owner@example.com');
select set_business_rule('discount_cap_percent', 'role', 'cashier', null, 'As before');
select test.throws($$select set_business_rule('discount_cap_percent', 'role', 'cashier', null, 'twice')$$,
  'That is the rule already', 'a rule at its default is not set back again');
select test.eq((select string_agg(coalesce(x ->> 'old_value', '-') || '>' || coalesce(x ->> 'new_value', 'default') || ' ('
                                  || (x ->> 'reason') || ', ' || (x ->> 'changed_by') || ')', '; '
                                  order by x ->> 'changed_at')
                  from jsonb_array_elements(list_business_rules() -> 'history') x),
  '->5 (Cashiers give 5% at most, Demo Owner); 5>default (As before, Demo Owner)', 'the history of the rule');
select test.eq(pg_temp.rule('discount_cap_percent', null, 'cashier'), '10', 'the cashier follows the café again');
select test.as_admin();
select test.eq((select count(*) from audit_log where action = 'rule.set')::int, 2, 'both on the audit trail');
select test.throws($$delete from business_rule$$, 'A rule is never deleted: set it back to its default',
  'a rule is never deleted');
select test.throws($$update business_rule_history set reason = 'x'$$, '%append-only%', 'nor its history rewritten');

-- ------------------------------------------------------------ discounts by the rules
select test.act_as('owner@example.com');
select set_business_rule('discount_cap_percent', 'role', 'cashier', '5', 'Cashiers give 5% at most');
select set_business_rule('discount_round_to', 'business', null, '100', 'Rounded to 100');
select test.act_as('cashier@example.com');
select test.eq((my_profile() ->> 'discount_cap_percent') || '/' || (my_profile() ->> 'discount_round_to'), '5/100',
  'the till knows the cashier''s cap and the step');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
    '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3}]', p_discount_percent => 8,
    p_discount_reason => 'regular')$$,
  'A discount over 5% needs a manager''s approval', 'over the cashier''s own cap, a manager approves it');
insert into res select 'D1', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3}]', p_discount_percent => 5,
  p_discount_reason => 'regular');
select test.eq((pg_temp.r('D1') ->> 'discount')::numeric, 400::numeric,
  '5% of 7,500 is 375: rounded to the step of 100, 400');
select test.act_as('manager@example.com');
insert into res select 'D2', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3}]', p_discount_percent => 8,
  p_discount_reason => 'regular');
select test.eq((pg_temp.r('D2') ->> 'discount')::numeric, 600::numeric, 'a manager gives 8% themselves: 600');

-- ------------------------------------------------------------ refunds a second person approves
select test.act_as('cashier@example.com');
insert into res select 'S1', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":12}]');
select test.act_as('manager@example.com');
select test.eq(my_profile() ->> 'refund_approval_over', '25000', 'the refund limit, as it applies to the manager');
select test.throws($$select refund_sale_lines(pg_temp.sale('S1'), null, 'changed_mind')$$,
  'A refund over 25,000 needs a second person to approve it', '30,000 back needs a second person');
select test.act_as('owner@example.com');
select set_my_pin('1357');
select test.act_as('manager@example.com');
insert into res select 'S1a', request_approval('refund', pg_temp.member('owner@example.com'), '1357',
  jsonb_build_object('order_id', pg_temp.sale('S1')));
insert into res select 'S1r', refund_sale_lines(pg_temp.sale('S1'), null, 'changed_mind', null,
  (pg_temp.r('S1a') ->> 'approval_id')::uuid);
select test.eq((pg_temp.r('S1r') ->> 'refunded')::numeric, 30000::numeric, 'with the owner''s approval, it is given back');
select test.act_as('cashier@example.com');
insert into res select 'S2', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":12}]');
select test.act_as('owner@example.com');
select set_business_rule('refund_approval_over', 'role', 'branch_manager', '50000', 'Managers refund up to 50,000');
select test.act_as('manager@example.com');
select test.eq((refund_sale_lines(pg_temp.sale('S2'), null, 'changed_mind') ->> 'refunded')::numeric, 30000::numeric,
  'under the branch manager''s own limit, no second person');

-- Keyed like every write (0035): sent twice with one key, a rule is set once.
select test.act_as('owner@example.com');
create temp table k as select gen_random_uuid() as key;
grant select on k to public;
select set_business_rule('refund_approval_over', 'role', 'barista', '1000', 'Sent twice', (select key from k));
select test.eq(set_business_rule('refund_approval_over', 'role', 'barista', '1000', 'Sent twice', (select key from k))
                 ->> 'replayed', 'true', 'sent again with its key, the rule is answered, not set twice');
select test.as_admin();
select test.eq((select count(*) from business_rule_history where key = 'refund_approval_over' and scope_id = 'barista')::int,
  1, 'one change in its history');

-- ------------------------------------------------------------ stock below zero
-- The café's default: sold, and shown as an alert.
select test.act_as('cashier@example.com');
insert into res select 'W1', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":26}]');
select test.eq(pg_temp.on_hand('c0000000-0000-0000-0000-000000000003'), -2::numeric,
  'twenty-six bottles sold where the books held 24: the café''s rule alerts');
select test.eq(pg_temp.alerts('stock_below_zero'), 'red: Golden water is below zero in the books: -2 each',
  'and the dashboard says so, in red');
-- An item refused.
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-000000000003', '"block"', 'Count the water');
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
    '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]')$$,
  'Only 0 each of Golden water is in stock: record the delivery or the batch first, or count it',
  'refused by the water''s own rule');
-- An item a manager approves.
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-000000000003', '"approve"', 'A manager decides');
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
    '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]')$$,
  'Only 0 each of Golden water is in stock: a manager approves using more than that',
  'the cashier needs a manager');
insert into res select 'W2', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]',
  p_stock_approval => pg_temp.approve('negative_stock'));
select test.eq(pg_temp.on_hand('c0000000-0000-0000-0000-000000000003'), -3::numeric, 'with the manager''s PIN, it is sold');
select test.as_admin();
select test.eq((select (after_state ->> 'items') || ' by ' || (select full_name from app_user where id = (after_state ->> 'approved_by')::uuid)
                  from audit_log where action = 'stock.below_zero' and entity_id = pg_temp.sale('W2')::text),
  'Golden water ×1 each by Demo Manager', 'the audit trail keeps what was sold beyond the books, and who approved it');
select test.act_as('manager@example.com');
select test.succeeds($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
    '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]')$$,
  'a manager at the till approves it themselves');
-- An item allowed, with no alert.
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-000000000003', '"allow"', 'Water is never counted');
select test.eq(coalesce(pg_temp.alerts('stock_below_zero'), 'none'), 'none', 'allowed without an alert: none');
-- Made items are refused by default.
select test.as_admin();
insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension)
values ('c0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000b1', 'G-GELATO', 'Golden gelato',
        'finished_good', 'g', 'mass');
insert into product (id, business_id, name) values ('d0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000b1', 'Golden scoop');
insert into product_variant (id, product_id, name, resale_item_id)
values ('d1000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000009', 'Tub', 'c0000000-0000-0000-0000-000000000009');
insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
values ('00000000-0000-0000-0000-0000000000b1', 'd1000000-0000-0000-0000-000000000009', 'dine_in', 4000, '2020-01-01');
select test.eq(pg_temp.rule('negative_stock', 'c0000000-0000-0000-0000-000000000009'), 'block', 'a made item refuses by default');
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
    '[{"variant_id":"d1000000-0000-0000-0000-000000000009","qty":1}]')$$,
  'Only 0 g of Golden gelato is in stock: record the delivery or the batch first, or count it',
  'no gelato sold that was never made');
-- Corrections by hand, and deliveries corrected, below zero under a refusing rule.
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-000000000002', '"block"', 'Cups are counted');
select test.act_as('manager@example.com');
select test.throws($$select adjust_stock('c0000000-0000-0000-0000-000000000002', -101, 'each', 'Broken sleeve')$$,
  'Only 100 each of Golden cup is in stock: record the delivery or the batch first, or count it',
  'a correction by hand below zero is refused by the cups'' rule');
select test.succeeds($$select adjust_stock('c0000000-0000-0000-0000-000000000002', -1, 'each', 'Broken cup')$$,
  'within what the books hold, it is made');

-- ------------------------------------------------------------ losses added up
select test.act_as('owner@example.com');
select set_business_rule('waste_approval_over', 'business', null, '500', 'Small losses only');
select test.act_as('barista@example.com');
select test.eq((my_profile() ->> 'waste_approval_over') || '/' || (my_profile() ->> 'waste_approval_window'), '500/session',
  'the barista''s limit, and what it is added up over');
insert into res select 'L1', record_waste('c0000000-0000-0000-0000-000000000001', 30, 'g', 'spoilage', 'left out');
select test.eq(pg_temp.status('L1'), 'not_required', '300 alone is under the limit');
select test.throws($$select record_waste('c0000000-0000-0000-0000-000000000001', 30, 'g', 'spoilage', 'again')$$,
  'This loss needs a manager''s approval: ask one to approve it now, or save it to wait for their approval',
  '300 more makes 600 in the barista''s day (no session of their own): over the limit');
insert into res select 'L2', record_waste('c0000000-0000-0000-0000-000000000001', 30, 'g', 'spoilage', 'again',
  p_wait => true);
select test.eq(pg_temp.status('L2') || ' ' || pg_temp.on_hand('c0000000-0000-0000-0000-000000000001'),
  'pending 340', 'saved to wait for a manager, the stock gone all the same (600 g went in espressos)');
select test.eq(test.lines_of(pg_temp.loss('L2')), '1200 Cr 300 | 5300 Dr 300', 'and its journal posted');
-- The item's losses by anyone today count too.
select test.act_as('barista2@example.com');
select test.throws($$select record_waste('c0000000-0000-0000-0000-000000000001', 20, 'g', 'spoilage', 'the rest')$$,
  'This loss needs a manager''s approval%', 'the second barista''s 200 is under the limit, but not the beans'' 800 today');
insert into res select 'L3', record_waste('c0000000-0000-0000-0000-000000000001', 20, 'g', 'spoilage', 'the rest',
  p_approval => pg_temp.approve('waste'));
select test.eq(pg_temp.status('L3') || ' by ' || (pg_temp.r('L3') ->> 'approved_by'), 'approved by Demo Manager',
  'approved with the manager''s PIN, as it is recorded');
select test.as_admin();
select test.eq((select decision || ' ' || (select full_name from app_user where id = decided_by) from loss_review
                 where movement_id = pg_temp.mv('L3')), 'approved Demo Manager', 'and the approval kept with it');
-- Nothing of an item never bought is worth approving.
insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension)
values ('c0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000b1', 'G-SYRUP', 'Golden syrup',
        'ingredient', 'ml', 'volume');
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-00000000000a', '"allow"', 'Never bought yet');
select test.act_as('barista@example.com');
insert into res select 'L4', record_waste('c0000000-0000-0000-0000-00000000000a', 50, 'ml', 'spoilage', 'a spill');
select test.eq(pg_temp.status('L4') || ' ' || coalesce(test.lines_of(pg_temp.loss('L4')), 'no journal'),
  'not_required no journal', 'a loss worth nothing needs no approval and posts nothing');
-- Losses added up entry by entry only, when the rule says so.
select test.act_as('owner@example.com');
select set_business_rule('waste_approval_window', 'business', null, '"entry"', 'Each loss on its own');
select test.act_as('barista@example.com');
insert into res select 'L5', record_waste('c0000000-0000-0000-0000-000000000001', 30, 'g', 'spoilage', 'third time');
select test.eq(pg_temp.status('L5'), 'not_required', 'each loss on its own: 300 is under the limit');
select test.throws($$select record_waste('c0000000-0000-0000-0000-000000000001', 60, 'g', 'spoilage', 'a big one')$$,
  'This loss needs a manager''s approval%', '600 on its own is over it');
-- A manager records theirs, approved as they record it.
select test.act_as('manager@example.com');
insert into res select 'L6', record_waste('c0000000-0000-0000-0000-000000000001', 100, 'g', 'damaged', 'dropped a bag');
select test.eq(pg_temp.status('L6'), 'approved', 'a manager''s own loss is approved as it is recorded');

-- ------------------------------------------------------------ the losses waiting, approved or reversed
select test.act_as('barista@example.com');
insert into res select 'L7', record_waste('c0000000-0000-0000-0000-000000000001', 60, 'g', 'expired', 'a typing slip',
  p_wait => true);
select test.throws($$select * from losses_waiting()$$, '%needs waste.approve%', 'a barista does not see the list');
select test.throws($$select review_loss(pg_temp.mv('L2'), 'approve')$$, '%needs waste.approve%', 'nor approves their own');
select test.as_admin();
select test.eq(pg_temp.alerts('losses_waiting'), 'orange: 2 loss(es) waiting for a manager''s approval (900 IQD)',
  'the dashboard names the losses waiting');
select test.act_as('manager@example.com');
select test.eq((select string_agg(item || ' ' || trim_scale(qty) || ' ' || unit || ' ' || kind || ' ' || trim_scale(value)
                                  || ' by ' || recorded_by, '; ' order by at) from losses_waiting()),
  'Golden beans 30 g spoilage 300 by Demo Barista; Golden beans 60 g expired 600 by Demo Barista',
  'the manager sees each loss waiting, oldest first');
select test.succeeds($$select review_loss(pg_temp.mv('L2'), 'approve')$$, 'the manager approves one');
select test.throws($$select review_loss(pg_temp.mv('L2'), 'approve')$$, 'This loss has been looked at already',
  'once');
select test.throws($$select review_loss(pg_temp.mv('L7'), 'reverse')$$, 'Say why the loss is reversed',
  'reversing one takes a reason');
select test.throws($$select review_loss(pg_temp.mv('L1'), 'approve')$$, 'This loss is not waiting for approval',
  'a loss under the limit is not waiting');
insert into res select 'L7r', review_loss(pg_temp.mv('L7'), 'reverse', 'Typed 60 for 6');
select test.eq(pg_temp.on_hand('c0000000-0000-0000-0000-000000000001'), 190::numeric,
  'reversed: the 60 g are back on the shelf');
select test.as_admin();
select test.eq((select string_agg(a.code || case when l.debit > 0 then ' Dr ' || l.debit else ' Cr ' || l.credit end, ' | '
                                  order by a.code)
                  from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
                 where e.reverses_entry = (select id from journal_entry where reference_id = pg_temp.loss('L7')
                                             and reverses_entry is null)),
  '1200 Dr 600 | 5300 Cr 600', 'its journal reversed: the stock and the loss put back');
select test.eq(coalesce(pg_temp.alerts('losses_waiting'), 'none'), 'none', 'nothing waits any more');
select test.eq((select losses_since('00000000-0000-0000-0000-0000000000b1', null, 'c0000000-0000-0000-0000-000000000001',
                                    now() - interval '1 day')), 2100::numeric,
  'the beans'' losses today leave the reversed 600 out: 300 + 300 + 200 + 300, and the manager''s 1,000');
select test.eq((select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
                  from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
                 where check_key in ('inventory', 'documents')),
  'documents=0,inventory=0', 'the stock and the books still tie, and every record has its journal');
select test.eq((select string_agg(stock_card_kind(type, reference_type, base_quantity_signed), ',')
                  from inventory_movement where reference_type = 'loss_review'),
  'wasted', 'on the stock card a loss reversed is a loss taken back');

-- ------------------------------------------------------------ batches and deliveries by the rules
-- A cold brew uses 300 g of beans a batch; 190 g are left.
select test.act_as('owner@example.com');
insert into res select 'B0', save_batch_recipe(null, 'Golden cold brew', '{"measure":"volume"}', 1, 'L',
  jsonb_build_array(jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 300, 'unit_code', 'g')));
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-000000000001', '"approve"', 'Beans are weighed');
select test.act_as('barista@example.com');
select test.throws($$select record_production((pg_temp.r('B0') ->> 'recipe_id')::uuid, 1)$$,
  'Only 190 g of Golden beans is in stock: a manager approves using more than that',
  'a batch that uses more beans than the books hold waits for a manager');
insert into res select 'B1', record_production((pg_temp.r('B0') ->> 'recipe_id')::uuid, 1,
  p_stock_approval => pg_temp.approve('negative_stock'));
select test.eq(pg_temp.on_hand('c0000000-0000-0000-0000-000000000001'), -110::numeric,
  'with the manager''s PIN it is made, and the beans are 110 g below zero');
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-000000000001', '"block"', 'Beans are counted');
select test.act_as('barista@example.com');
select test.throws($$select record_production((pg_temp.r('B0') ->> 'recipe_id')::uuid, 1)$$,
  'Only 0 g of Golden beans is in stock: record the delivery or the batch first, or count it',
  'refused outright under the beans'' new rule');
-- A delivery reversed below zero, refused by the cups' rule (99 on hand).
select test.act_as('manager@example.com');
insert into res select 'G1', receive_goods((select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1'
                                              order by name, id limit 1),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":10,"unit_price":50}]', p_confirm => true);
select adjust_stock('c0000000-0000-0000-0000-000000000002', -100, 'each', 'Sleeves thrown out');
select test.throws($$select reverse_receipt((pg_temp.r('G1') ->> 'receipt_id')::uuid, 'Never came', true)$$,
  'This leaves Golden cup (-1 each) below zero, which its rule refuses: count it, or correct less',
  'a delivery is not reversed below zero where the item''s rule refuses it');
