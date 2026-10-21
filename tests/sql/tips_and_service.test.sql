-- =============================================================================
-- Tips and a service charge (0090).
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.order_of(p text) returns uuid language sql as $$ select (v ->> 'order_id')::uuid from res where k = p $$;
-- A sale's journal on an account: credit less debit.
create function pg_temp.posted(p_order uuid, p_code text) returns numeric language sql security definer as $$
  select coalesce(sum(l.credit - l.debit), 0) from journal_entry e join journal_line l on l.journal_entry_id = e.id
    join gl_account a on a.id = l.account_id
   where a.code = p_code
     and (e.reference_type = 'sales_order' and e.reference_id = p_order
          or e.reverses_entry in (select x.id from journal_entry x
                                   where x.reference_type = 'sales_order' and x.reference_id = p_order))
$$;
create function pg_temp.paid(p_order uuid) returns numeric language sql security definer as $$
  select sum(amount) from sales_tender where sales_order_id = p_order
$$;
create function pg_temp.svc(p_order uuid) returns text language sql security definer as $$
  select service_amount || '/' || coalesce(service_percent::text, '-') from sales_order where id = p_order
$$;
create function pg_temp.key_of(p_order uuid) returns uuid language sql security definer as $$
  select idempotency_key from sales_order where id = p_order
$$;
create function pg_temp.person(p_name text) returns uuid language sql security definer as $$
  select id from employee where full_name = p_name
$$;
create function pg_temp.main() returns uuid language sql security definer as $$
  select default_location('00000000-0000-0000-0000-0000000000b1')
$$;
create function pg_temp.at(p_day date, p_time text) returns timestamptz language sql as $$
  select (p_day + p_time::time) at time zone 'Asia/Baghdad'
$$;
create function pg_temp.shares() returns text language sql security definer as $$
  select string_agg(coalesce(e.full_name, 'nobody') || ' ' || trim_scale(s.amount), ', ' order by s.work_day, e.full_name)
    from tip_shares('00000000-0000-0000-0000-0000000000b1', test.today(), test.today()) s
    left join employee e on e.id = s.employee_id
$$;
\set E '''[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'''

-- ------------------------------------------------------------ the accounts
select test.eq((select string_agg(code || ' ' || name || ' ' || account_type, '; ' order by code) from gl_account
                 where business_id = '00000000-0000-0000-0000-0000000000b1' and code in ('2200', '4300')),
  '2200 Tips owed to staff liability; 4300 Service charge revenue', 'the tips and the service charge have their accounts');
select test.ok(manual_journal_blocked('2200') and manual_journal_blocked('4300'), 'only the till posts to them');
select test.eq(cash_flow_line('2200'), 'staff', 'tips are the staff''s money in the cash flow');

-- ------------------------------------------------------------ the service charge, per way of selling
select test.act_as('cashier@example.com');
select test.throws($$select set_service_charge('dine_in', 10)$$, '%settings.manage%', 'a cashier sets no service charge');
select test.act_as('owner@example.com');
select test.throws($$select set_service_charge('talabat', 10)$$,
  'A delivery platform sets what its customers pay: no service charge is added to it', 'none on a platform');
select test.throws($$select set_service_charge('dine_in', 60)$$, 'A service charge is between 0 and 50%', 'at most 50%');
select set_service_charge('dine_in', 10);
select set_service_charge('direct_delivery', 5);
select set_service_charge('direct_delivery', 0);
select test.eq(service_charges(), '{"dine_in": 10}'::jsonb, 'on at a table; set and taken off again for delivery');

-- At a table: 10% on what the products come to.
select test.act_as('cashier@example.com');
insert into res select 'S1', record_sale(gen_random_uuid(), 'dine_in', 'cash', :E);
select test.eq((pg_temp.r('S1') ->> 'net')::numeric || '+' || (pg_temp.r('S1') ->> 'service')::numeric
               || '=' || (pg_temp.r('S1') ->> 'due')::numeric, '2500+250=2750',
  'an espresso at a table: 2,500 and 250 service, 2,750 to pay');
select test.eq(pg_temp.paid(pg_temp.order_of('S1')), 2750::numeric, 'the payment is the whole of it');
select test.eq(pg_temp.posted(pg_temp.order_of('S1'), '4000') || '/' || pg_temp.posted(pg_temp.order_of('S1'), '4300'),
  '2500/250', 'the sales stay 2,500; the service charge is revenue of its own');
-- Payments that leave it out are refused.
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]',
  p_tenders => '[{"type":"cash","amount":2500}]')$$,
  'The payments come to 2500, not the 2750 to pay', 'payments without the service charge are short');
-- Take-away has none.
insert into res select 'S2', record_sale(gen_random_uuid(), 'takeaway', 'cash', :E);
select test.eq((pg_temp.r('S2') ->> 'service')::numeric || '/' || pg_temp.paid(pg_temp.order_of('S2')), '0/2500',
  'to take away: no service charge');
-- After a discount, on what is left.
insert into res select 'S3', record_sale(gen_random_uuid(), 'dine_in', 'card', :E, p_discount_percent => 10,
  p_discount_reason => 'regular');
select test.eq((pg_temp.r('S3') ->> 'net')::numeric || '+' || (pg_temp.r('S3') ->> 'service')::numeric,
  '2000+200', 'after a discount (rounded to 500 off): 10% of the 2,000 left');
-- Taken off one sale, by someone who may give discounts; the log says so.
insert into res select 'S4', record_sale(gen_random_uuid(), 'dine_in', 'cash', :E, p_no_service => true);
select test.eq(pg_temp.svc(pg_temp.order_of('S4')), '0/-', 'taken off this sale');
select test.as_admin();
select test.ok(exists (select 1 from audit_log where action = 'sale.no_service'
                         and entity_id = (select v ->> 'order_id' from res where k = 'S4')),
  'and the audit log keeps who took it off');
delete from role_permission where role = 'cashier' and permission = 'discount.apply';
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', p_no_service => true)$$,
  'You do not have permission to take the service charge off', 'not by someone who may give no discount');
select test.as_admin();
insert into role_permission (role, permission) values ('cashier', 'discount.apply');

-- ------------------------------------------------------------ tips
select test.act_as('cashier@example.com');
insert into res select 'T1', record_sale(gen_random_uuid(), 'takeaway', 'card', :E, p_tip => 1001);
select test.eq((pg_temp.r('T1') ->> 'tip')::numeric || '/' || pg_temp.paid(pg_temp.order_of('T1')), '1001/3501',
  'a tip of 1,001 on a card: 3,501 paid');
select test.eq(pg_temp.posted(pg_temp.order_of('T1'), '2200') || '/' || pg_temp.posted(pg_temp.order_of('T1'), '4000'),
  '1001/2500', 'the tip is owed to the staff, not sales');
select test.throws($$select record_sale(gen_random_uuid(), 'takeaway', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', p_tip => -5)$$,
  'A tip is a whole amount of 0 or more', 'no tip below 0');
select test.throws($$select record_sale(gen_random_uuid(), 'takeaway', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', p_tip => 2.5)$$,
  'A tip is a whole amount of 0 or more', 'nor a part of a dinar');
select test.throws($$select record_sale(gen_random_uuid(), 'talabat', 'platform_paid',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', p_platform_order_no => 'T-1', p_tip => 500)$$,
  'A delivery platform''s order takes no tip at the till', 'none on a platform''s order');
-- In cash, with the change kept: the drawer takes it all.
insert into res select 'T2', record_sale(gen_random_uuid(), 'dine_in', null, :E, p_tip => 250,
  p_tenders => '[{"type":"cash","amount":3000,"received":3000}]');
select test.eq((pg_temp.r('T2') ->> 'due')::numeric, 3000::numeric, 'at a table with a 250 tip: 2,500 + 250 + 250');
-- Sent again with its key: the sale it recorded, with what it took.
insert into res select 'T1R', record_sale(pg_temp.key_of(pg_temp.order_of('T1')),
  'takeaway', 'card', :E, p_tip => 1001);
select test.eq((pg_temp.r('T1R') ->> 'replayed') || '/' || (pg_temp.r('T1R') ->> 'tip'), 'true/1001',
  'sent again: the sale recorded, its tip with it');

-- A table's bill: the service charge when it is paid, and a tip.
insert into res select 'B1', open_tab('dine_in', null, 'Window', null, :E);
insert into res select 'B1P', settle_tab((pg_temp.r('B1') ->> 'tab_id')::uuid,
  (select version from pos_tab where id = (pg_temp.r('B1') ->> 'tab_id')::uuid), gen_random_uuid(), 'card',
  p_tip => 500);
select test.eq((pg_temp.r('B1P') ->> 'service')::numeric || '+' || (pg_temp.r('B1P') ->> 'tip')::numeric || '='
               || pg_temp.paid((pg_temp.r('B1P') ->> 'order_id')::uuid), '250+500=3250',
  'a bill paid: its service charge and a tip');

-- ------------------------------------------------------------ refunds and voids
select test.act_as('owner@example.com');
insert into res select 'R1', refund_sale_lines(pg_temp.order_of('S1'), null, 'changed_mind');
select test.eq((pg_temp.r('R1') ->> 'refunded')::numeric || '/' || (pg_temp.r('R1') ->> 'status'), '2500/refunded',
  'a refund gives back what was bought; the service charge stays');
insert into res select 'V1', void_sale(pg_temp.order_of('T2'), null, 'rang_twice');
select test.eq(pg_temp.posted(pg_temp.order_of('T2'), '2200') || '/' || pg_temp.posted(pg_temp.order_of('T2'), '4300'),
  '0/0', 'voided: its tip and its service charge are taken back too');

-- ------------------------------------------------------------ who shares the tips, each day
select test.act_as('owner@example.com');
select save_employee(null, 'Bana', null, 'Barista', pg_temp.main(), test.today() - 60, null, gen_random_uuid());
select save_employee(null, 'Avin', null, 'Waiter', pg_temp.main(), test.today() - 60, null, gen_random_uuid());
select save_employee(null, 'Cira', null, 'Kitchen', pg_temp.main(), test.today() - 60, null, gen_random_uuid());
select test.eq(pg_temp.shares(), 'nobody 1501', 'nobody ticked: today''s 1,501 has nobody to share it');
select test.act_as('cashier@example.com');
select test.throws($$select set_tip_sharers(array[pg_temp.person('Avin')])$$, '%payroll.run%',
  'a cashier ticks nobody');
select test.act_as('owner@example.com');
select set_tip_sharers(array[pg_temp.person('Avin'), pg_temp.person('Bana')]);
select test.eq(pg_temp.shares(), 'Avin 751, Bana 750',
  'two ticked, nobody clocked in: shared equally, the first by name taking what rounding leaves');
select add_attendance(pg_temp.person('Bana'), pg_temp.at(test.today(), '00:01'), null, 'opened', null,
  gen_random_uuid());
select test.eq(pg_temp.shares(), 'Bana 1501', 'of them, the one who clocked in today shares them');
select set_tip_sharers(array[pg_temp.person('Avin'), pg_temp.person('Bana'), pg_temp.person('Cira')]);
select set_tip_sharers(array[pg_temp.person('Avin'), pg_temp.person('Bana')]);
select test.eq((select count(*)::int from tip_sharer where employee_id = pg_temp.person('Cira')), 0,
  'ticked and unticked the same day: as if never ticked');
select test.eq((select jsonb_array_length(tips_month(test.today()) -> 'sharers')
                || '/' || (tips_month(test.today()) ->> 'total')), '2/1501', 'Payroll shows who shares them, and the month''s');

-- ------------------------------------------------------------ the pay
-- Last month: the tips of a day then go into that month's pay.
select test.as_admin();
update tip_sharer set from_day = test.today() - 45 where until_day is null;
update attendance set cancelled_at = now(), cancel_reason = 'test' where employee_id = pg_temp.person('Bana');
-- A sale is never changed; the test moves this one back a month, its guard standing aside.
alter table sales_order disable trigger user;
update sales_order set placed_at = pg_temp.at((date_trunc('month', test.today()) - interval '1 month')::date + 9, '12:00')
 where id = pg_temp.order_of('T1');
alter table sales_order enable trigger user;
select test.act_as('owner@example.com');
select set_employee_pay(pg_temp.person('Avin'), 'monthly', 600000, 8, null, null, gen_random_uuid());
select set_employee_pay(pg_temp.person('Bana'), 'monthly', 600000, 8, null, null, gen_random_uuid());
select set_employee_pay(pg_temp.person('Cira'), 'monthly', 600000, 8, null, null, gen_random_uuid());
insert into res select 'P', draft_payroll((date_trunc('month', test.today()) - interval '1 month')::date, gen_random_uuid());
select test.eq((select string_agg(e.full_name || ' ' || trim_scale(l.tips) || ' ' || trim_scale(l.gross - l.base_pay), ', '
                                  order by e.full_name)
                  from payroll_line l join employee e on e.id = l.employee_id
                 where l.run_id = (pg_temp.r('P') ->> 'run_id')::uuid),
  'Avin 501 501, Bana 500 500, Cira 0 0', 'each one''s tips are added to their pay; Cira was not ticked');
insert into res select 'PA', approve_payroll((pg_temp.r('P') ->> 'run_id')::uuid, gen_random_uuid());
select test.as_admin();
select test.eq((select string_agg(a.code || ' ' || trim_scale(l.debit - l.credit), ', ' order by a.code)
                  from payroll_run r join journal_line l on l.journal_entry_id = r.journal_entry_id
                  join gl_account a on a.id = l.account_id
                 where r.id = (select (v ->> 'run_id')::uuid from res where k = 'P') and a.code in ('2200', '6100')),
  '2200 1001, 6100 ' || trim_scale((select sum(base_pay) from payroll_line
                                     where run_id = (select (v ->> 'run_id')::uuid from res where k = 'P'))),
  'approved: the tips come out of what was held for the staff, not the salaries'' cost');
select test.eq((select sum(x.value::numeric) from payroll_approval pa, jsonb_each_text(pa.gross_by_place) x
                 where pa.run_id = (select (v ->> 'run_id')::uuid from res where k = 'P')),
  (select sum(base_pay) from payroll_line where run_id = (select (v ->> 'run_id')::uuid from res where k = 'P')),
  'and the salaries'' cost by place leaves the tips out');

-- ------------------------------------------------------------ what the till took
select test.act_as('owner@example.com');
select test.eq((select (x ->> 'service')::numeric || '/' || (x ->> 'tips')::numeric
                  from report_tips_and_service(test.today(), test.today()) x),
  '700/500', 'today: 250 + 200 + the bill''s 250 of service (the voided sale''s not), and the bill''s 500 tip');
