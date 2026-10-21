-- =============================================================================
-- One approvals inbox (0088): what waits for a manager, in one list, for the
-- reader's own permissions; how many, for the menu; and an alert, its subject
-- the newest one waiting, so each arrival reaches a phone.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.kinds() returns text language sql as $$
  select coalesce(string_agg(e ->> 'kind', ',' order by e ->> 'at'), '') from jsonb_array_elements(approvals_waiting()) e
$$;
create function pg_temp.one(p_kind text) returns jsonb language sql as $$
  select e from jsonb_array_elements(approvals_waiting()) e where e ->> 'kind' = p_kind limit 1
$$;
create function pg_temp.alert() returns text language sql security definer as $$
  select coalesce(string_agg(c.subject || ' ' || c.urgency || ' ' || c.title, '; '), 'none')
    from alert_conditions('00000000-0000-0000-0000-0000000000b1', now()) c where c.rule = 'approvals_waiting'
$$;
create function pg_temp.age_po(p_no bigint) returns void language sql security definer as $$
  update purchase_order set updated_at = now() - interval '2 hours'
   where business_id = '00000000-0000-0000-0000-0000000000b1' and po_no = p_no
$$;

-- A barista, who records losses and approves none.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000002a', 'barista@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000002a');
insert into user_role (app_user_id, role) select id, 'barista' from app_user where email = 'barista@example.com';

select test.act_as('owner@example.com');
select test.eq(pg_temp.kinds(), '', 'nothing waits at first');
select test.eq(approvals_waiting_count(), 0, 'and the menu counts none');
select test.eq(pg_temp.alert(), 'none', 'nor is there an alert');

-- The cashier and the barista approve nothing: no list, and a count of none.
select test.act_as('cashier@example.com');
select test.throws($$select approvals_waiting()$$, '%permission%', 'the cashier is shown no list');
select test.eq(approvals_waiting_count(), 0, 'and counts none');

-- ------------------------------------------------------------ a count submitted
select test.act_as('manager@example.com');
insert into res select 'C1', to_jsonb(start_stock_count(array['c0000000-0000-0000-0000-000000000002'::uuid]));
select record_count((pg_temp.r('C1') #>> '{}')::uuid, 'c0000000-0000-0000-0000-000000000002', 90, 'each');
select submit_stock_count((pg_temp.r('C1') #>> '{}')::uuid);
select test.eq(pg_temp.kinds(), 'count', 'the manager sees their own count waiting');
select test.eq((pg_temp.one('count') ->> 'may_approve') || ' ' || (pg_temp.one('count') ->> 'may_reject'),
  'false true', 'which they may withdraw, not approve');
select test.act_as('owner@example.com');
select test.eq((pg_temp.one('count') ->> 'may_approve') || ' ' || (pg_temp.one('count') ->> 'by') || ' '
               || (pg_temp.one('count') #>> '{detail,differ}') || '/' || (pg_temp.one('count') #>> '{detail,items}'),
  'true Demo Manager 1/1', 'the owner may approve it: who counted, and one item of one differs');
select test.eq(approvals_waiting_count(), 1, 'the menu counts it');
select test.ok(pg_temp.alert() like (pg_temp.r('C1') #>> '{}') || ' orange 1 waiting for a manager''s approval: 1 count(s), 0 order(s)',
  'and the alert names it, the newest waiting');

-- ------------------------------------------------------------ a loss saved to wait
select set_business_rule('waste_approval_over', 'business', null, '1', 'Every loss is looked at');
select test.act_as('barista@example.com');
select record_loss('waste', 'c0000000-0000-0000-0000-000000000001', null, 10, 'g', 'Spilled', p_wait => true);
select test.throws($$select approvals_waiting()$$, '%permission%', 'the barista is shown no list');
select test.act_as('owner@example.com');
select test.eq(pg_temp.kinds(), 'count,loss', 'the owner sees the count and the loss, oldest first');
select test.eq((pg_temp.one('loss') ->> 'reason') || ' · ' || (pg_temp.one('loss') ->> 'by') || ' · '
               || (pg_temp.one('loss') ->> 'may_approve'),
  'Spilled · Demo Barista · true', 'the loss with why, and who');
select test.eq(pg_temp.alert() like '% 1 count(s), 0 order(s)', true, 'a loss keeps its own alert (0040)');

-- ------------------------------------------------------------ an order drafted, and left
insert into res select 'PO', save_po(null,
  (select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' and name = 'Kurdistan Coffee Imports'),
  jsonb_build_array(jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 2, 'unit_code', 'kg',
                                       'unit_price', 9000)),
  test.today() + 2, 'For the weekend', null, gen_random_uuid());
select test.eq(pg_temp.kinds(), 'count,loss', 'an order just written is still being written');
select pg_temp.age_po((pg_temp.r('PO') ->> 'po_no')::bigint);
select test.eq(pg_temp.kinds(), 'count,loss,order', 'left an hour, it waits');
select test.eq((pg_temp.one('order') ->> 'value') || ' ' || (pg_temp.one('order') ->> 'reason') || ' '
               || (pg_temp.one('order') ->> 'may_approve'),
  '18000 For the weekend true', 'its total, its note, and the owner may approve it');
select test.ok(pg_temp.alert() like (pg_temp.r('PO') ->> 'po_id') || ' orange 2 waiting % 1 count(s), 1 order(s)',
  'a new arrival is a new alert: its subject the order now');
select test.eq(approvals_waiting_count(), 3, 'the menu counts three');

-- ------------------------------------------------------------ decided where they are decided
select approve_stock_count((pg_temp.r('C1') #>> '{}')::uuid);
select review_loss((pg_temp.one('loss') ->> 'id')::uuid, 'approve');
select approve_po((pg_temp.r('PO') ->> 'po_id')::uuid);
select test.eq(pg_temp.kinds(), '', 'each decided by its own function, the list is empty');
select test.eq(pg_temp.alert(), 'none', 'and the alert goes');
