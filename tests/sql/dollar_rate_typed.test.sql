-- =============================================================================
-- The dollar's rate typed with each payment (0116). The manager last used
-- 1,500 dinars a dollar, two days ago: dollars are still taken. A cashier's
-- 1,510 (within 2%) is taken; 1,600 needs a manager's PIN, and with it is
-- taken; a manager's own 1,550 is taken and is the last one from then on.
-- Every rate is kept with who used it, and the report says so.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.member(p text) returns uuid language sql security definer as $$
  select id from app_user where email = p $$;
create function pg_temp.name_of(p text) returns text language sql security definer as $$
  select full_name from app_user where email = p $$;
create function pg_temp.espresso() returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 1)) $$;
create function pg_temp.usd(p_rate numeric, p_approval uuid default null) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('type', 'cash', 'currency', 'USD', 'usd', 5, 'rate', p_rate,
                                              'amount', 2500)
                           || case when p_approval is not null then jsonb_build_object('approval', p_approval)
                                   else '{}'::jsonb end) $$;
grant execute on function pg_temp.r(text), pg_temp.member(text), pg_temp.name_of(text) to public;
insert into fx_rate (business_id, currency, rate, effective_from, set_by, reason)
select '00000000-0000-0000-0000-0000000000b1', 'USD', 1500, now() - interval '50 hours', id, 'Market'
  from app_user where email = 'manager@example.com';
select test.act_as('manager@example.com');
select set_my_pin('2468');

select test.act_as('cashier@example.com');
-- Dinars in the drawer for the change.
select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 20)));
select test.eq((fx_status() ->> 'usable')::boolean, true, 'a rate two days old is offered to start from');
select test.eq((fx_status() ->> 'band_percent')::numeric, 2::numeric, 'with its band, 2%');
insert into res select 'a', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.espresso(), p_tenders => pg_temp.usd(1510));
select test.eq((pg_temp.r('a') ->> 'order_id') is not null, true, 'the cashier''s 1,510, within 2%: taken');
select test.throws(format('select record_sale(%L, %L, null, %L, p_tenders => %L)', gen_random_uuid(), 'dine_in',
                          pg_temp.espresso(), pg_temp.usd(1600)),
  '1600 is more than 2% from 1500, the last rate a manager used: a manager approves it with their PIN',
  '1,600 is beyond it');
insert into res select 'ok', request_approval('usd_rate', pg_temp.member('manager@example.com'), '2468',
                                              jsonb_build_object('rate', 1600));
insert into res select 'b', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.espresso(),
                                        p_tenders => pg_temp.usd(1600, (pg_temp.r('ok') ->> 'approval_id')::uuid));
select test.eq((pg_temp.r('b') ->> 'order_id') is not null, true, 'approved by a manager''s PIN: taken');
select test.throws(format('select record_sale(%L, %L, null, %L, p_tenders => %L)', gen_random_uuid(), 'dine_in',
                          pg_temp.espresso(), pg_temp.usd(1600, (pg_temp.r('ok') ->> 'approval_id')::uuid)),
  'That approval has been used: ask again', 'an approval is used once');

select test.act_as('manager@example.com');
select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.espresso(), p_tenders => pg_temp.usd(1550));
select test.eq((fx_status() ->> 'rate')::numeric, 1550::numeric, 'the manager''s 1,550 is the last one now');

select test.act_as('owner@example.com');
select test.throws($$select set_usd_rate_band(25)$$, 'The band is from 0% to 20%', 'a sensible band');
select set_usd_rate_band(5);
insert into res select 'rep', usd_rates_used(test.today(), test.today());
select test.eq(jsonb_array_length(pg_temp.r('rep') -> 'rates'), 3, 'three rates used today');
select test.eq((select (x ->> 'approved')::int from jsonb_array_elements(pg_temp.r('rep') -> 'people') x
                 where x ->> 'name' = pg_temp.name_of('cashier@example.com')), 1,
  'one of the cashier''s approved by a manager');
select test.act_as('manager@example.com');
select test.throws($$select set_usd_rate_band(3)$$, 'Only the owner sets how far a cashier''s rate may be',
  'the owner''s to set');
