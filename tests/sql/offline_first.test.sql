-- =============================================================================
-- The till that waits less for the internet (0101): a sale made offline with
-- the seller's own discount (no more than their cap) and the customer chosen
-- before the connection dropped (points earned when it arrives); the till's
-- key for what it keeps; what each till still keeps, and the alert when it is
-- long. Espresso: 2,500 dine-in; the cashier's cap is 10%.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.o(p text) returns sales_order language sql security definer as $$
  select * from sales_order where id = (select (v ->> 'order_id')::uuid from res where k = p)
$$;
create function pg_temp.member(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
create function pg_temp.espresso(p int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p))
$$;
create function pg_temp.alerts(p_rule text) returns text language sql security definer as $$
  select string_agg(title || ' [' || urgency || ']', ' | ' order by title)
    from alert_conditions('00000000-0000-0000-0000-0000000000b1', now()) where rule = p_rule
$$;

-- ------------------------------------------------------------------ a discount, the seller's own
select test.act_as('cashier@example.com');
insert into res select 'D', record_offline_sale('01010000-0000-0000-0000-00000000000d', 'dine_in',
  pg_temp.espresso(2), now() - interval '10 minutes',
  p_tenders => '[{"type": "cash", "amount": 4500}]', p_expected_net => 4500,
  p_discount_percent => 10, p_discount_reason => 'regular');
select test.eq((pg_temp.r('D') ->> 'net') || ' ' || (pg_temp.r('D') ->> 'discount'), '4500 500',
  'a regular''s 10% taken offline, within the cashier''s cap');
select test.eq((pg_temp.o('D')).discount_by, pg_temp.member('cashier@example.com'), 'given by the cashier');
select test.eq((pg_temp.o('D')).discount_reason, 'Regular customer', 'with why');
select test.ok((pg_temp.o('D')).discount_approved_by is null, 'approved by no one: none was needed');
select test.throws($$select record_offline_sale('01010000-0000-0000-0000-0000000000d2', 'dine_in',
  pg_temp.espresso(2), now() - interval '9 minutes',
  p_tenders => '[{"type": "cash", "amount": 4000}]', p_expected_net => 4000,
  p_discount_percent => 20, p_discount_reason => 'regular')$$,
  'A discount over 10% needs a manager''s approval', 'over the cap: refused, a manager cannot approve one offline');
select test.throws($$select record_offline_sale('01010000-0000-0000-0000-0000000000d3', 'dine_in',
  pg_temp.espresso(2), now() - interval '9 minutes',
  p_tenders => '[{"type": "cash", "amount": 4500}]', p_expected_net => 4500, p_discount_percent => 10)$$,
  'Choose a reason from the list', 'a discount says why, offline too');
-- Sent by a manager, sold by the cashier: the cashier's cap, not the sender's.
select test.act_as('manager@example.com');
select test.throws($$select record_offline_sale('01010000-0000-0000-0000-0000000000d4', 'dine_in',
  pg_temp.espresso(2), now() - interval '9 minutes',
  p_tenders => '[{"type": "cash", "amount": 4000}]', p_expected_net => 4000,
  p_discount_percent => 20, p_discount_reason => 'regular', p_sold_by => pg_temp.member('cashier@example.com'))$$,
  'A discount over 10% needs a manager''s approval', 'the seller''s cap holds, whoever sends it');
-- A manager's own offline discount goes beyond a cashier's cap.
insert into res select 'M', record_offline_sale('01010000-0000-0000-0000-00000000000e', 'dine_in',
  pg_temp.espresso(2), now() - interval '8 minutes',
  p_tenders => '[{"type": "cash", "amount": 4000}]', p_expected_net => 4000,
  p_discount_percent => 20, p_discount_reason => 'complaint');
select test.eq(pg_temp.r('M') ->> 'net', '4000', 'a manager''s 20%, theirs to give');
select test.act_as('cashier@example.com');
insert into res select 'D2', record_offline_sale('01010000-0000-0000-0000-00000000000d', 'dine_in',
  pg_temp.espresso(2), now() - interval '10 minutes',
  p_tenders => '[{"type": "cash", "amount": 4500}]', p_expected_net => 4500,
  p_discount_percent => 10, p_discount_reason => 'regular');
select test.eq((pg_temp.r('D2') ->> 'replayed') || ' ' || (pg_temp.r('D2') ->> 'order_id'),
               'true ' || (pg_temp.r('D') ->> 'order_id'), 'sent again: recorded once');

-- ------------------------------------------------------------------ the customer chosen before it dropped
select test.act_as('manager@example.com');
insert into res select 'H', save_customer(null, 'Hawre', '0770 123 4567', null, true, gen_random_uuid());
select test.act_as('cashier@example.com');
insert into res select 'C', record_offline_sale('01010000-0000-0000-0000-00000000000c', 'dine_in',
  pg_temp.espresso(2), now() - interval '7 minutes',
  p_tenders => '[{"type": "cash", "amount": 5000}]', p_expected_net => 5000,
  p_customer => (pg_temp.r('H') ->> 'customer_id')::uuid);
select test.eq((pg_temp.o('C')).customer_id, (pg_temp.r('H') ->> 'customer_id')::uuid, 'the sale is the customer''s');
select test.eq((pg_temp.r('C') -> 'customer' ->> 'earned')::int, 5, 'and earns their points when it arrives');
select test.throws($$select record_offline_sale('01010000-0000-0000-0000-0000000000c2', 'talabat',
  pg_temp.espresso(1), now() - interval '7 minutes', p_tender => 'platform_paid', p_platform_order_no => 'T-1',
  p_customer => (pg_temp.r('H') ->> 'customer_id')::uuid)$$,
  'A delivery platform''s customers are its own: none is added at the till', 'not on a platform''s order');

-- ------------------------------------------------------------------ the till's key for what it keeps
insert into res select 'K', to_jsonb(offline_key());
select test.eq(length(decode(pg_temp.r('K') #>> '{}', 'base64')), 32, 'a key of 32 bytes');
select test.act_as('manager@example.com');
select test.eq(to_jsonb(offline_key()), pg_temp.r('K'), 'one for the café: every till of it reads what any kept');
select test.act_as('counter@example.com');
select test.throws($$select offline_key()$$, '%permission%', 'someone who does not sell has none');

-- ------------------------------------------------------------------ what each till keeps
select test.act_as('cashier@example.com');
select note_till_kept('till-a1b2c3d4', null, 3, 0, now() - interval '10 minutes');
select test.eq(pg_temp.alerts('till_kept'), null::text, 'ten minutes: not yet');
select note_till_kept('till-a1b2c3d4', null, 3, 0, now() - interval '45 minutes');
select test.ok(pg_temp.alerts('till_kept') like 'A till at % keeps 3 sales not yet sent [orange]', 'half an hour on: an alert');
select note_till_kept('till-a1b2c3d4', null, 2, 1, now() - interval '45 minutes');
select test.ok(pg_temp.alerts('till_kept') like '% [red]', 'one waiting for a manager: red');
select note_till_kept('till-a1b2c3d4', null, 0, 0, null);
select test.eq(pg_temp.alerts('till_kept'), null::text, 'all sent: gone');
select note_till_kept('not a till!', null, 3, 0, now() - interval '45 minutes');
select test.as_admin();
select test.eq((select count(*)::int from till_kept), 0, 'a till names itself in letters and digits');
select test.eq((select count(*)::int from pg_policies where tablename in ('till_kept', 'business_offline_key')), 0,
  'read by no one but through their functions');
