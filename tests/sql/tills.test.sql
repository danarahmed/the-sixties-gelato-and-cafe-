-- =============================================================================
-- The tills at each branch, and who works where (0055, release AB): the café
-- opens a second branch. Its barista works there only: they sell there, at
-- its own price, from its own turn numbers, with its own drawer, and are
-- refused at the first branch; the first branch's manager is refused at the
-- second; the central kitchen sells nothing, and only its cook receives what
-- is sent to it. A person's place is kept when their roles change, and is
-- gone when they become the general manager. The kitchen's plan counts what
-- it sends, and the buying list what is on its way.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
insert into location (business_id, kind, name) values ('00000000-0000-0000-0000-0000000000b1', 'branch', 'Second Branch');
create temp table ids as
select (select id from location where name = 'Main Branch') branch1, (select id from location where name = 'Second Branch') branch2,
       (select id from location where name = 'Central Kitchen') kitchen,
       'd1000000-0000-0000-0000-000000000001'::uuid espresso, 'c0000000-0000-0000-0000-000000000001'::uuid beans,
       'c0000000-0000-0000-0000-000000000002'::uuid cups;
grant select on ids to public;
-- A barista at the second branch, its manager, and a cook at the kitchen, who
-- makes and buys there.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000f1', 'barista2@example.com'),
  ('a0000000-0000-0000-0000-0000000000f2', 'manager2@example.com'),
  ('a0000000-0000-0000-0000-0000000000f3', 'cook@example.com');
insert into app_user (business_id, full_name, email, auth_user_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'Second Barista', 'barista2@example.com', 'a0000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000b1', 'Second Manager', 'manager2@example.com', 'a0000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-0000000000b1', 'Kitchen Cook', 'cook@example.com', 'a0000000-0000-0000-0000-0000000000f3');
insert into user_role (app_user_id, role, location_id)
select u.id, r.role::app_role, (select case r.place when 'second' then branch2 else kitchen end from ids)
  from app_user u join (values ('barista2@example.com', 'barista', 'second'), ('manager2@example.com', 'branch_manager', 'second'),
                               ('cook@example.com', 'barista', 'kitchen'), ('cook@example.com', 'purchasing', 'kitchen')) r(email, role, place)
    on r.email = u.email;

create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.member(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
create function pg_temp.place_of(p_email text) returns text language sql security definer as $$
  select coalesce(string_agg(distinct coalesce(l.name, 'everywhere'), ', '), 'no role')
    from user_role r left join location l on l.id = r.location_id
   where r.app_user_id = pg_temp.member(p_email)
$$;
create function pg_temp.sale(p_place uuid, p_key uuid) returns jsonb language sql as $$
  select record_sale(p_key, 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]',
                     p_location => p_place)
$$;

-- ------------------------------------------------------------------ where a person works
select test.act_as('barista2@example.com');
select test.eq(my_profile() ->> 'works_at_name', 'Second Branch', 'the barista works at the second branch');
select test.act_as('owner@example.com');
select test.eq(my_profile() ->> 'works_at', null, 'the owner works everywhere');
select test.eq((select string_agg(full_name || ': ' || coalesce(works_at_name, 'everywhere'), ', ' order by full_name)
                  from list_members() where full_name in ('Demo Owner', 'Second Barista', 'Kitchen Cook')),
  'Demo Owner: everywhere, Kitchen Cook: Central Kitchen, Second Barista: Second Branch',
  'Settings lists where each person works');

-- The first branch's manager is put at the first branch.
select set_member_place(pg_temp.member('manager@example.com'), (select branch1 from ids));
select test.eq(pg_temp.place_of('manager@example.com'), 'Main Branch', 'the manager now works at the first branch');
select test.as_admin();
select test.eq((select before_state ->> 'place' || ' > ' || (after_state ->> 'place') from audit_log
                 where action = 'member.place' order by id desc limit 1),
  'everywhere > Main Branch', 'on the audit trail, from where to where');
select test.act_as('owner@example.com');
select test.throws(format('select set_member_place(%L, %L)', pg_temp.member('owner@example.com'), (select branch1 from ids)),
  '%owner and the general manager work everywhere%', 'the owner works everywhere');
select test.throws(format('select set_member_place(%L, %L)', pg_temp.member('cashier@example.com'),
                          'f0000000-0000-0000-0000-0000000000b2'),
  '%one of the café''s places%', 'a place of the café''s own');
select test.act_as('manager@example.com');
select test.throws(format('select set_member_place(%L, null)', pg_temp.member('manager@example.com')),
  '%needs settings.manage%', 'a manager does not move themselves');

-- Roles changed where the person works: the place stays; made general
-- manager, they work everywhere.
select test.act_as('owner@example.com');
select set_member_roles(pg_temp.member('barista2@example.com'), '{barista,cashier}');
select test.eq(pg_temp.place_of('barista2@example.com'), 'Second Branch', 'new roles, still at the second branch');
select invite_member('temp@example.com', 'Temp Hand', '{barista}', (select branch2 from ids), gen_random_uuid());
select test.eq(pg_temp.place_of('temp@example.com'), 'Second Branch', 'invited to work at the second branch');
select set_member_roles(pg_temp.member('temp@example.com'), '{general_manager}');
select test.eq(pg_temp.place_of('temp@example.com'), 'everywhere', 'made general manager, they work everywhere');
-- One place for all of a person's roles, and none for the owner.
select test.as_admin();
select test.throws(format($s$do $d$ begin
    execute 'set constraints user_role_one_place immediate';
    insert into user_role (app_user_id, role, location_id) values (%L, 'inventory_counter', %L);
  end $d$$s$, pg_temp.member('barista2@example.com'), (select branch1 from ids)),
  '%all their roles are at that place%', 'a second role at another place is refused');
select test.throws(format('insert into user_role (app_user_id, role, location_id) values (%L, %L, %L)',
                          pg_temp.member('owner@example.com'), 'owner', (select branch1 from ids)),
  '%owner and the general manager work everywhere%', 'the owner is not put at a place');

-- ------------------------------------------------------------------ the second branch's till
-- Its own price for an espresso, from today; the first branch keeps the café's.
select test.act_as('owner@example.com');
select set_price((select espresso from ids), 'dine_in', 3000, null, (select branch2 from ids), gen_random_uuid());
select test.throws(format('select set_price(%L, %L, 1, null, %L, gen_random_uuid())', (select espresso from ids), 'dine_in',
                          (select kitchen from ids)),
  '%one of the café''s branches%', 'a price is a branch''s, not the kitchen''s');
select test.act_as('barista2@example.com');
select test.eq((select (prices ->> 'dine_in') from pos_catalogue((select branch2 from ids)) where variant_id = (select espresso from ids)),
  '3000', 'at the second branch the till sells an espresso at its price');
select test.eq((select (prices ->> 'dine_in') from pos_catalogue((select branch1 from ids)) where variant_id = (select espresso from ids)),
  '2500', 'at the first branch, at the café''s');
select test.eq((select (prices ->> 'dine_in') from pos_catalogue() where variant_id = (select espresso from ids)),
  '2500', 'and with no branch named, at the first branch''s');

select test.act_as('owner@example.com');
select set_price((select espresso from ids), 'takeaway', 2800, test.today() + 2, (select branch2 from ids), gen_random_uuid());
select test.eq((select string_agg(location || ' ' || channel || ' ' || trim_scale(price), ', ' order by channel)
                  from menu_branch_prices() where variant_id = (select espresso from ids)),
  'Second Branch dine_in 3000', 'the product card lists the branch''s own price in force');
select test.eq((select string_agg(coalesce(location, 'every branch') || ' ' || channel || ' ' || trim_scale(price)
                                  || ' +' || (effective_from - test.today()), ', ')
                  from menu_scheduled() where kind = 'price'),
  'Second Branch takeaway 2800 +2', 'and a price to come names its branch');
select test.as_admin();
select test.eq((select after_state ->> 'place' from audit_log where action = 'price.set' order by id desc limit 1),
  'Second Branch', 'the audit trail names the branch of a price');

-- Its own drawer, and its own numbers from 1.
select test.act_as('barista2@example.com');
select open_cash_session(0, p_location => (select branch2 from ids), p_idempotency_key => gen_random_uuid());
insert into res select 's1', pg_temp.sale((select branch2 from ids), gen_random_uuid());
select test.eq((pg_temp.r('s1') ->> 'net')::numeric || ' #' || (pg_temp.r('s1') ->> 'turn_no'), '3000 #1',
  'the second branch''s first sale: at its price, number 1');
select test.act_as('cashier@example.com');
insert into res select 'm1', pg_temp.sale((select branch1 from ids), gen_random_uuid());
select test.eq((pg_temp.r('m1') ->> 'net')::numeric || ' #' || (pg_temp.r('m1') ->> 'turn_no'), '2500 #1',
  'the first branch''s first sale: number 1 of its own');
select test.act_as('barista2@example.com');
insert into res select 'b1', to_jsonb(open_tab('dine_in', null, 'Sara', (select branch2 from ids),
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]', p_idempotency_key => gen_random_uuid()));
select test.eq((select string_agg(label || ' #' || turn_no || ' ' || total, ', ') from pos_open_bills((select branch2 from ids))),
  'Sara #2 6000', 'a bill at the second branch takes its next number, at its price');
select test.eq((select count(*)::int from pos_open_bills((select branch1 from ids))), 0,
  'and is not among the first branch''s open bills');
select test.as_admin();
select test.eq((select string_agg(l.name || ' ' || o.turn_no, ', ' order by l.name, o.turn_no)
                  from sales_order o join location l on l.id = o.location_id where o.status = 'completed'),
  'Main Branch 1, Second Branch 1', 'each sale at the branch it was made at');
select test.eq((select string_agg(distinct l.name, ', ') from cash_event e join work_shift w on w.id = e.work_shift_id
                  join cash_drawer d on d.id = w.drawer_id join location l on l.id = d.location_id
                 where e.kind = 'sale' and (e.reference_id = (pg_temp.r('s1') ->> 'order_id')::uuid
                        or e.reference_id in (select id from sales_tender
                                               where sales_order_id = (pg_temp.r('s1') ->> 'order_id')::uuid))),
  'Second Branch', 'its cash in the second branch''s drawer');

-- Paid from the till: out of the second branch's drawer, by its manager; not
-- out of the first branch's.
select test.act_as('manager2@example.com');
insert into res select 'x1', record_expense('Ice', 500, '6900', 'till', null, (select branch2 from ids), gen_random_uuid());
select test.as_admin();
select test.eq((select l.name || ' ' || trim_scale(e.amount) from cash_event e join location l on l.id = e.location_id
                 where e.reference_type = 'expense' and e.reference_id = (pg_temp.r('x1') ->> 'expense_id')::uuid),
  'Second Branch -500', 'an expense from the till leaves the second branch''s drawer');
select test.eq((select l.name from expense x join location l on l.id = x.location_id
                 where x.id = (pg_temp.r('x1') ->> 'expense_id')::uuid),
  'Second Branch', 'and is the second branch''s');
select test.act_as('manager2@example.com');
select test.throws($$select record_expense('Ice', 500, '6900', 'till', null, null, gen_random_uuid())$$,
  '%You work at Second Branch, not at Main Branch%', 'with no branch named, the first branch''s drawer: not theirs');

-- The barista of the second branch does nothing at the first. (The first
-- branch's drawer is closed, counted, to see it cannot be opened either.)
select test.act_as('cashier@example.com');
select close_cash_session(2500, p_location => (select branch1 from ids), p_idempotency_key => gen_random_uuid());
select test.act_as('barista2@example.com');
select test.throws(format('select pg_temp.sale(%L, gen_random_uuid())', (select branch1 from ids)),
  '%You work at Second Branch, not at Main Branch%', 'no sale at the first branch');
select test.throws('select pg_temp.sale(null, gen_random_uuid())',
  '%You work at Second Branch, not at Main Branch%', 'nor with no branch named, which is the first');
select test.throws(format('select open_tab(%L, null, %L, %L, p_idempotency_key => gen_random_uuid())', 'dine_in', 'X',
                          (select branch1 from ids)),
  '%You work at Second Branch, not at Main Branch%', 'no bill at the first branch');
select test.throws(format('select open_cash_session(0, p_location => %L, p_idempotency_key => gen_random_uuid())',
                          (select branch1 from ids)),
  '%You work at Second Branch, not at Main Branch%', 'nor its drawer');
-- The first branch's manager does nothing at the second; its own manager voids its sale.
select test.act_as('manager@example.com');
select test.throws(format('select void_sale(%L, %L, p_idempotency_key => gen_random_uuid())',
                          pg_temp.r('s1') ->> 'order_id', 'Rang twice'),
  '%You work at Main Branch, not at Second Branch%', 'the first branch''s manager does not void the second''s sale');
select test.act_as('manager2@example.com');
select test.succeeds(format('select void_sale(%L, %L, p_idempotency_key => gen_random_uuid())',
                            pg_temp.r('s1') ->> 'order_id', 'Rang twice'),
  'the second branch''s manager does');

-- The kitchen sells nothing.
select test.act_as('owner@example.com');
select test.throws(format('select pg_temp.sale(%L, gen_random_uuid())', (select kitchen from ids)),
  '%Central Kitchen does not sell: the till is at a branch%', 'no sale at the kitchen');
select test.throws(format('select open_tab(%L, null, %L, %L, p_idempotency_key => gen_random_uuid())', 'dine_in', 'X',
                          (select kitchen from ids)),
  '%Central Kitchen does not sell%', 'no bill');
select test.throws(format('select save_table(null, %L, p_location => %L, p_idempotency_key => gen_random_uuid())', 'K1',
                          (select kitchen from ids)),
  '%Central Kitchen does not sell%', 'no table');
select test.throws(format('select open_cash_session(0, p_location => %L, p_idempotency_key => gen_random_uuid())',
                          (select kitchen from ids)),
  '%Central Kitchen does not sell%', 'no drawer to open');

-- ------------------------------------------------------------------ stock where one works
-- The first branch's manager sends beans to the kitchen; the second branch's
-- manager cannot receive them there, and the cook can; the cook cannot send
-- from the branch, nor cancel what the branch sent.
select test.act_as('manager@example.com');
insert into res select 't1', send_stock_transfer((select branch1 from ids), (select kitchen from ids),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":100}]', null, false, gen_random_uuid());
insert into res select 't2', send_stock_transfer((select branch1 from ids), (select kitchen from ids),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":50}]', null, false, gen_random_uuid());
select test.act_as('manager2@example.com');
select test.throws(format('select receive_stock_transfer(%L, null, null, gen_random_uuid())', pg_temp.r('t1') ->> 'transfer_id'),
  '%You work at Second Branch, not at Central Kitchen%', 'only someone at the kitchen receives what is sent to it');
select test.act_as('cook@example.com');
select test.eq((receive_stock_transfer((pg_temp.r('t1') ->> 'transfer_id')::uuid, null, null, gen_random_uuid()) ->> 'received')::numeric,
  1000::numeric, 'the cook receives it at the kitchen');
select test.throws(format('select cancel_stock_transfer(%L, %L, gen_random_uuid())', pg_temp.r('t2') ->> 'transfer_id', 'no'),
  '%You work at Central Kitchen, not at Main Branch%', 'only someone at the branch cancels what it sent');
select test.throws(format('select send_stock_transfer(%L, %L, %L, null, false, gen_random_uuid())', (select branch1 from ids),
                          (select kitchen from ids), '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1}]'),
  '%You work at Central Kitchen, not at Main Branch%', 'nor does the cook send from the branch');

-- ------------------------------------------------------------------ what a place sends, and what is on its way
-- The buying list at the second branch counts what is on its way to it.
select test.act_as('manager@example.com');
insert into res select 't3', send_stock_transfer((select branch1 from ids), (select branch2 from ids),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":30}]', null, false, gen_random_uuid());
select test.act_as('manager2@example.com');
select test.eq((select (i ->> 'on_way') || ' on its way, ' || (i ->> 'position') || ' in all'
                  from jsonb_array_elements(buying_list((select branch2 from ids)) -> 'items') i
                 where (i ->> 'item_id')::uuid = (select cups from ids)),
  '30 on its way, 30 in all', 'what is on its way to a branch counts as coming there');
-- What the first branch sent is its use.
select test.act_as('owner@example.com');
select test.eq((select (i ->> 'used') from jsonb_array_elements(buying_list((select branch1 from ids)) -> 'items') i
                 where (i ->> 'item_id')::uuid = (select cups from ids)),
  '30', 'what the branch sent counts as its use');
select test.eq((select (i ->> 'used') from jsonb_array_elements(buying_list((select branch1 from ids)) -> 'items') i
                 where (i ->> 'item_id')::uuid = (select beans from ids)),
  '170', 'beans: 100 g sent and received, 50 g sent and on its way, 20 g sold');

-- The kitchen's plan: what it sent the branch on this weekday, week by week.
select save_batch_recipe(null, 'Kitchen gelato', '{"measure":"weight"}', 4, 'kg',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":100,"unit_code":"g"}]', 'Churn', true, 72);
select test.as_admin();
update recipe_version set effective_from = test.today() - 60
 where recipe_id = (select id from recipe where name = 'Kitchen gelato');
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason,
                                reference_type, occurred_at)
select '00000000-0000-0000-0000-0000000000b1', (select id from item where name = 'Kitchen gelato'), (select kitchen from ids),
       w.t::movement_type, w.q, 1, abs(w.q), 'fixture', w.ref,
       ((test.today() - w.d) + time '10:00') at time zone 'Asia/Baghdad'
  from (values ('opening_balance', 20000, 36, null), ('transfer_out', -2000, 7, 'stock_transfer'),
               ('transfer_out', -3000, 14, 'stock_transfer'), ('transfer_out', -1000, 21, 'stock_transfer'),
               ('transfer_out', -3000, 28, 'stock_transfer'), ('reversal', 1000, 28, 'stock_transfer_cancel'))
       w(t, q, d, ref);
select test.act_as('cook@example.com');
select test.eq((select (p ->> 'status') || ' ' || (p ->> 'demand') || ' a day, ' || (p ->> 'weeks') || ' weeks'
                  from jsonb_array_elements(production_plan(null, (select kitchen from ids)) -> 'recipes') p
                 where p ->> 'recipe' = 'Kitchen gelato'),
  'enough 1600 a day, 5 weeks',
  'the kitchen''s demand: what it sent on this weekday, less what came back (2000, 3000, 1000, 2000 and none)');
