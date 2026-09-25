-- =============================================================================
-- Exceptions under control (0028, the audit's P1-10): every void, refund,
-- discount and cancelled bill takes a reason from a list; a discount over the
-- cap is approved by a manager's name and PIN; a void or refund may be
-- approved by a second person, and without one waits for the owner's review;
-- everything taken off a bill is recorded; and the owner reads it all, by
-- person, on one report.
-- Golden catalogue: espresso 2,500 dine-in, water 1,000.
-- =============================================================================
select test.golden_catalogue();
-- Percentages to the dinar, so every share can be seen exactly.
update business set discount_round_to = 1;
create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
create temp table s (k text primary key, r jsonb);
grant all on s to public;
create or replace function pg_temp.r(p text) returns jsonb language sql as $$ select r from s where k = p $$;
create or replace function pg_temp.order_of(p text) returns uuid language sql as $$ select (r ->> 'order_id')::uuid from s where k = p $$;
create or replace function pg_temp.approval_of(p text) returns uuid language sql as $$ select (r ->> 'approval_id')::uuid from s where k = p $$;
insert into ids select split_part(email::text, '@', 1), id from app_user
 where email in ('owner@example.com', 'manager@example.com', 'cashier@example.com', 'counter@example.com');
-- A second cashier, to show an approval is the person's who asked for it.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000e1', 'cashier2@example.com');
insert into app_user (business_id, auth_user_id, full_name, email)
values ('00000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000e1', 'Second Cashier', 'cashier2@example.com');
insert into user_role (app_user_id, role) select id, 'cashier' from app_user where email = 'cashier2@example.com';
create or replace function pg_temp.espressos(p_qty int default 1) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p_qty))
$$;
create or replace function pg_temp.sell(p_qty int default 1) returns jsonb language sql as $$
  select record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(p_qty))
$$;

-- ------------------------------------------------------------- the reasons
select test.act_as('cashier@example.com');
select test.eq((select string_agg(code, ',' order by sort_order) from reason_code where kind = 'void'),
  'rang_wrong_item,rang_twice,wrong_channel,customer_left,other', 'the till reads the list of reasons');
insert into s select 'v1', pg_temp.sell();
insert into s select 'v2', pg_temp.sell();

select test.act_as('manager@example.com');
select test.throws(format('select void_sale(%L)', pg_temp.order_of('v1')), 'Choose a reason from the list',
  'a void needs a reason');
select test.throws(format('select void_sale(%L, null, %L)', pg_temp.order_of('v1'), 'staff_meal'),
  'Choose a reason from the list', 'from the list for voids: a discount''s reason is not one');
select test.throws(format('select void_sale(%L, %L)', pg_temp.order_of('v1'), 'hjjjhjjk'),
  'Say what happened, in a few words', '"Other" needs real words, not a key held down');
select test.throws(format('select void_sale(%L, %L, %L)', pg_temp.order_of('v1'), 'x y', 'other'),
  'Say what happened, in a few words', 'two words are not enough without six letters');
select void_sale(pg_temp.order_of('v1'), ' second  espresso ', 'rang_twice');
select void_sale(pg_temp.order_of('v2'), 'Poured it for the wrong table');
select test.as_admin();
select test.eq((select string_agg(reason || ' | ' || reason_code, '; ' order by created_at) from sale_adjustment),
  'Rang twice: second espresso | rang_twice; Poured it for the wrong table | other',
  'kept as the reason chosen with its note, or in the person''s own words as "Other"');
select test.act_as('manager@example.com');
select test.throws($$select reason_text('void', 'other', 'anything at all')$$, '%permission denied%',
  'the check is the database''s own: nobody calls it directly');

-- ------------------------------------------------------------ the PINs
select test.act_as('cashier@example.com');
select test.throws($$select set_my_pin('2580')$$, '%Only those who approve%', 'a cashier has no PIN to set');
select test.act_as('manager@example.com');
select test.throws($$select set_my_pin('25a0')$$, 'A PIN is 4 to 8 digits', 'digits only');
select test.throws($$select set_my_pin('258')$$, 'A PIN is 4 to 8 digits', 'four at least');
select test.throws($$select set_my_pin('7777')$$, '%harder to guess%', 'not one digit over and over');
select test.throws($$select set_my_pin('3456')$$, '%harder to guess%', 'nor a run up');
select test.throws($$select set_my_pin('6543')$$, '%harder to guess%', 'or down');
select test.eq((my_profile() ->> 'has_pin')::boolean, false, 'no PIN yet');
select set_my_pin('2580');
select test.eq((my_profile() ->> 'has_pin')::boolean, true, 'the manager has set one');
select test.eq((my_profile() ->> 'discount_cap_percent')::numeric, 10::numeric, 'and the till knows the cap: 10%');
select test.as_admin();
select test.ok((select pin_hash like '$2%' and pin_hash not like '%2580%' from app_user where id = pg_temp.id('manager')),
  'the PIN is kept only as a hash');
select test.eq((select count(*) from audit_log where action = 'member.pin_set' and entity_id = pg_temp.id('manager')::text)::int,
  1, 'setting it is on the audit trail');

select test.act_as('cashier@example.com');
select test.eq((select string_agg(name, ',') from list_approvers('discount')), 'Demo Manager',
  'the till lists who may approve a discount: those who may, with a PIN');
select test.throws(format('select request_approval(%L, %L, %L)', 'discount', pg_temp.id('counter'), '2580'),
  'Choose someone who may approve this', 'a stock counter approves nothing');
select test.eq(request_approval('discount', pg_temp.id('owner'), '2580', '{"percent": 20}') ->> 'error',
  'Demo Owner has not set a PIN yet (My account)', 'nor does someone without a PIN');
select test.eq(request_approval('discount', pg_temp.id('manager'), '0852', '{"percent": 20}')::text,
  '{"ok": false, "error": "That PIN is not right"}', 'a wrong PIN is refused, and says so');
select test.act_as('manager@example.com');
select test.throws(format('select request_approval(%L, %L, %L)', 'void', pg_temp.id('manager'), '2580'),
  'Someone else approves it%', 'nobody approves their own');

-- -------------------------------------------- a discount over the cap
select test.act_as('cashier@example.com');
insert into s select 'd10', record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(2), null, 10,
  p_discount_reason => 'regular');
select test.eq(pg_temp.r('d10') ->> 'discount', '500', '10% off: within the cap, the cashier gives it');
select test.throws(format('select record_sale(%L, %L, %L, %L, null, 20)', gen_random_uuid(), 'dine_in', 'cash',
  pg_temp.espressos(2)), 'Choose a reason from the list', 'a discount needs a reason');
select test.throws(format('select record_sale(%L, %L, %L, %L, null, 20, p_discount_reason => %L)', gen_random_uuid(),
  'dine_in', 'cash', pg_temp.espressos(2), 'complaint'),
  'A discount over 10% needs a manager''s approval', 'over the cap, a manager approves it');
select test.throws(format('select record_sale(%L, %L, %L, %L, null, null, 300, p_discount_reason => %L)',
  gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(1), 'regular'),
  'A discount over 10% needs a manager''s approval', 'an amount is judged by the share it takes off: 300 of 2,500 is 12%');
select test.succeeds(format('select record_sale(%L, %L, %L, %L, null, null, 250, p_discount_reason => %L)',
  gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(1), 'regular'), 'and 250 of 2,500 is 10%: the cashier''s own');

insert into s select 'ap20', request_approval('discount', pg_temp.id('manager'), '2580', '{"percent": 20}');
select test.eq((pg_temp.r('ap20') ->> 'ok') || ' ' || (pg_temp.r('ap20') ->> 'approver'), 'true Demo Manager',
  'the manager chooses their name and types their PIN: approved');
select test.throws(format('select record_sale(%L, %L, %L, %L, null, 25, p_discount_reason => %L, p_approval => %L)',
  gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(2), 'complaint', pg_temp.approval_of('ap20')),
  'The manager approved up to 20%: ask again for this one', 'an approval covers what the manager was asked, no more');
select test.act_as('cashier2@example.com');
select test.throws(format('select record_sale(%L, %L, %L, %L, null, 20, p_discount_reason => %L, p_approval => %L)',
  gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(2), 'complaint', pg_temp.approval_of('ap20')),
  'That approval was given to someone else', 'it is the approval of the person who asked for it');
select test.act_as('cashier@example.com');
insert into s select 'd20', record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(2), null, 20,
  p_discount_reason => 'complaint', p_discount_note => 'cold coffee', p_approval => pg_temp.approval_of('ap20'));
select test.eq(pg_temp.r('d20') ->> 'discount', '1000', '20% off, approved');
select test.throws(format('select record_sale(%L, %L, %L, %L, null, 20, p_discount_reason => %L, p_approval => %L)',
  gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(2), 'complaint', pg_temp.approval_of('ap20')),
  'That approval has been used: ask again', 'an approval is used once');
insert into s select 'ap15', request_approval('discount', pg_temp.id('manager'), '2580', '{"percent": 15}');
select test.as_admin();
update approval set expires_at = now() - interval '1 second' where id = pg_temp.approval_of('ap15');
select test.act_as('cashier@example.com');
select test.throws(format('select record_sale(%L, %L, %L, %L, null, 15, p_discount_reason => %L, p_approval => %L)',
  gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(2), 'regular', pg_temp.approval_of('ap15')),
  'That approval has run out: ask again', 'and within ten minutes');

select test.as_admin();
select test.eq((select row(discount_amount, discount_percent, discount_reason, discount_by = pg_temp.id('cashier'),
                           discount_approved_by = pg_temp.id('manager'))::text
                  from sales_order where id = pg_temp.order_of('d20')),
  '(1000,20,"To make up for a complaint: cold coffee",t,t)',
  'the sale keeps the discount, why, who gave it and who approved it');
select test.eq((select row(discount_reason, discount_by = pg_temp.id('cashier'), discount_approved_by)::text
                  from sales_order where id = pg_temp.order_of('d10')),
  '("Regular customer",t,)', 'within the cap nobody else approves it');
select test.eq((select after_state ->> 'approved_by' from audit_log
                 where action = 'sale.discount' and entity_id = pg_temp.order_of('d20')::text),
  pg_temp.id('manager')::text, 'and the audit trail says who approved it');

select test.act_as('manager@example.com');
insert into s select 'd50', record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(2), null, 50,
  p_discount_reason => 'staff_meal');
select test.eq(pg_temp.r('d50') ->> 'discount', '2500', 'a manager gives more on their own authority');

-- Five wrong PINs in fifteen minutes lock that manager's approvals.
select test.act_as('cashier@example.com');
select request_approval('discount', pg_temp.id('manager'), '1470', '{}') from generate_series(1, 4);
select test.eq(request_approval('discount', pg_temp.id('manager'), '2580', '{"percent": 15}') ->> 'error',
  'Too many wrong PINs for Demo Manager: try again in 15 minutes',
  'five wrong PINs lock the manager''s approvals, even with the right one');
select test.as_admin();
select test.eq((select count(*) filter (where not ok) || '/' || count(*) from pin_attempt), '5/7',
  'every PIN typed is counted: five wrong, two right, none while locked');
update pin_attempt set at = at - interval '15 minutes';
select test.act_as('cashier@example.com');
select test.eq((request_approval('discount', pg_temp.id('manager'), '2580', '{"percent": 15}') ->> 'ok')::boolean, true,
  'fifteen minutes on, the manager approves again');
select test.act_as('manager@example.com');
select test.throws($$select * from approval$$, '%permission denied%', 'approvals are read only through the till''s functions');
select test.throws($$select * from pin_attempt$$, '%permission denied%', 'as are the PINs typed');

-- ------------------------------------ a second person for voids and refunds
select test.act_as('owner@example.com');
select set_my_pin('13579');
select test.act_as('cashier@example.com');
insert into s select 'v3', pg_temp.sell();
insert into s select 'v4', pg_temp.sell();
insert into s select 'v5', pg_temp.sell();
select test.act_as('manager@example.com');
select test.eq((select string_agg(name, ',') from list_approvers('void')), 'Demo Owner',
  'a void may be approved by someone else who may void');
insert into s select 'apv', request_approval('void', pg_temp.id('owner'), '13579',
  jsonb_build_object('order_id', pg_temp.order_of('v3')));
select test.throws(format('select void_sale(%L, null, %L, %L)', pg_temp.order_of('v4'), 'customer_left', pg_temp.approval_of('apv')),
  'That approval is for another sale', 'an approval for one sale voids no other');
select test.throws(format('select refund_sale(%L, null, %L, %L)', pg_temp.order_of('v3'), 'quality', pg_temp.approval_of('apv')),
  'That approval is not for this', 'nor does a void''s approval refund it');
select void_sale(pg_temp.order_of('v3'), null, 'customer_left', pg_temp.approval_of('apv'));
select refund_sale(pg_temp.order_of('v4'), 'Too sweet for the customer', null);
select test.act_as('cashier@example.com');
select test.throws(format('select void_sale(%L, null, %L)', pg_temp.order_of('v5'), 'rang_twice'), '%permission%',
  'a second person does not let a cashier void: a manager voids, and another approves');
select test.as_admin();
select test.eq((select string_agg(kind || ' ' || reason_code || ' by ' || rq.full_name || ', approved by ' || ap.full_name, '; '
                                  order by sa.created_at)
                  from sale_adjustment sa join app_user rq on rq.id = sa.requested_by join app_user ap on ap.id = sa.approved_by
                 where sa.sales_order_id in (pg_temp.order_of('v3'), pg_temp.order_of('v4'))),
  'void customer_left by Demo Manager, approved by Demo Owner; refund other by Demo Manager, approved by Demo Manager',
  'the void is approved by the owner; the refund is the manager''s own');

-- ---------------------------------------------------------------- on a bill
select test.act_as('cashier@example.com');
insert into ids select 'b1', (open_tab('dine_in', null, 'Window', null, pg_temp.espressos(4), 10,
  p_discount_reason => 'regular') ->> 'tab_id')::uuid;
select test.eq((select row(discount, discount_reason, discount_by, discount_approved_by)::text from pos_open_bills()
                 where tab_id = pg_temp.id('b1')), '(1000,"Regular customer","Demo Cashier",)',
  'the bill shows its discount, why, and who gave it');
select test.throws(format('select save_tab(%L, 2, %L, null, null, 30, null, %L)', pg_temp.id('b1'), pg_temp.espressos(4),
  'complaint'), 'A discount over 10% needs a manager''s approval', 'a bill''s discount over the cap is approved too');
insert into s select 'ap30', request_approval('discount', pg_temp.id('manager'), '2580', '{"percent": 30}');
select save_tab(pg_temp.id('b1'), 2, pg_temp.espressos(4), null, null, 30, null, 'complaint', null, pg_temp.approval_of('ap30'));
select test.eq((select row(discount, discount_reason, discount_approved_by)::text from pos_open_bills()
                 where tab_id = pg_temp.id('b1')), '(3000,"To make up for a complaint","Demo Manager")',
  'approved by the manager, and shown on the bill');
select test.succeeds(format('select save_tab(%L, 3, %L, null, null, 30)', pg_temp.id('b1'), pg_temp.espressos(5)),
  'a discount already on the bill is not asked about again as the bill grows');
insert into s select 'b1', settle_tab(pg_temp.id('b1'), 4, gen_random_uuid(), 'cash');
select test.as_admin();
select test.eq((select row(gross_amount, discount_amount, discount_percent, discount_reason, discount_by = pg_temp.id('cashier'),
                           discount_approved_by = pg_temp.id('manager'))::text
                  from sales_order where id = pg_temp.order_of('b1')),
  '(12500,3750,30,"To make up for a complaint",t,t)', 'paid, the sale keeps who gave it, why, and who approved it');
select test.eq((select string_agg(coalesce(before_state ->> 'percent', '-') || '>' || coalesce(after_state ->> 'percent', '-'), ',')
                  from audit_log where action = 'bill.discount' and entity_id = pg_temp.id('b1')::text), '10>30',
  'the change to a discount already given is on the audit trail');

-- An amount stays as it was given: taking things off must not make it more of the bill.
select test.act_as('cashier@example.com');
insert into ids select 'b2', (open_tab('dine_in', null, 'Big table', null, pg_temp.espressos(4), null, 1000,
  p_discount_reason => 'regular') ->> 'tab_id')::uuid;
select test.throws(format('select save_tab(%L, 2, %L, null, null, null, 1000)', pg_temp.id('b2'), pg_temp.espressos(1)),
  'The 1000 off would be 40% of the bill, over the 10% allowed: take the discount off first, or ask a manager',
  'taking things off cannot turn a discount into more of the bill than the cap');
select save_tab(pg_temp.id('b2'), 2, pg_temp.espressos(3), null, null, null, 750, 'regular');
select test.eq((select row(discount, discount_by)::text from pos_open_bills() where tab_id = pg_temp.id('b2')),
  '(750,"Demo Cashier")', 'the discount made to fit, the cashier takes one off');
select test.act_as('manager@example.com');
select test.succeeds(format('select save_tab(%L, 3, %L, null, null, null, 750)', pg_temp.id('b2'), pg_temp.espressos(1)),
  'a manager may leave the amount on a smaller bill');
select test.as_admin();
select test.eq((select string_agg(action || ':' || (select count(*) from jsonb_array_elements(after_state -> 'lines')), ',' order by id)
                  from audit_log where action in ('bill.line_remove', 'bill.reduce') and entity_id = pg_temp.id('b2')::text),
  'bill.line_remove:1,bill.line_remove:1', 'everything taken off a bill is on the audit trail, printed or not');

-- A bill with anything on it is cancelled by a manager, with a reason from the list.
select test.act_as('manager@example.com');
select test.throws(format('select cancel_tab(%L, 4, %L)', pg_temp.id('b2'), 'hjjjhjjk'), 'Say what happened, in a few words',
  'a cancelled bill''s reason is checked like any other');
select cancel_tab(pg_temp.id('b2'), 4, null, 'customer_left');
select test.as_admin();
select test.eq((select cancel_reason || ' | ' || cancel_reason_code from pos_tab where id = pg_temp.id('b2')),
  'Customer left without ordering | customer_left', 'and keeps the reason chosen');

-- ---------------------------------------------------- the exceptions report
select test.act_as('cashier@example.com');
select test.throws($$select * from report_exceptions(test.today(), test.today())$$, '%permission%',
  'the exceptions report is not a cashier''s');
select test.act_as('owner@example.com');
select test.eq((select string_agg(kind || '=' || n || '/' || r, ', ' order by kind)
                  from (select kind, count(*) n, count(*) filter (where needs_review) r
                          from report_exceptions(test.today(), test.today()) group by kind) x),
  'bill_cancel=1/0, discount=5/0, line_removed=2/0, refund=1/1, void=3/2, wrong_pin=5/5',
  'every exception of the day, and what waits for the owner''s review');
select test.eq((select string_agg(person || ', approved by ' || coalesce(approved_by, 'nobody else'), '; ' order by at)
                  from report_exceptions(test.today(), test.today()) where kind = 'void'),
  'Demo Manager, approved by nobody else; Demo Manager, approved by nobody else; Demo Manager, approved by Demo Owner',
  'a void approved by a second person needs no review; one on its requester''s word does');
select test.eq((select string_agg(amount::text || ' ' || person || ' ' || coalesce(approved_by, '-') || ' ' || detail, '; ' order by at)
                  from report_exceptions(test.today(), test.today()) where kind = 'discount'),
  '500 Demo Cashier - 10% asked, 10% of 5000; 250 Demo Cashier - 10% of 2500; '
  '1000 Demo Cashier Demo Manager 20% asked, 20% of 5000; 2500 Demo Manager - 50% asked, 50% of 5000; '
  '3750 Demo Cashier Demo Manager 30% asked, 30% of 12500',
  'each discount: how much, who gave it, who approved it');
select test.eq((select count(*) from report_exceptions(test.today(), test.today())
                 where kind = 'wrong_pin' and person = 'Demo Cashier' and reference = 'Approval by Demo Manager')::int, 5,
  'every wrong PIN, whose it was and who typed it');
