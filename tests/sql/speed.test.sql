-- =============================================================================
-- Speed (0100): the alerts worked out once a minute, not each time a screen
-- asks; the system's administrators, and the Speed page's measurements.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();

-- ------------------------------------------------------------------ the alerts, once a minute
select test.eq(alerts_fresh_seconds(), 0, 'the tests work them out every time');
select set_config('sixties.alerts_fresh_seconds', 'soon', false);
select test.eq(alerts_fresh_seconds(), 60, 'a setting that is not a number is a minute');
select set_config('sixties.alerts_fresh_seconds', '60', false);
select test.eq(alerts_fresh_seconds(), 60, 'a minute, as the café has it');

delete from alert_refresh;
select refresh_alerts('00000000-0000-0000-0000-0000000000b1');
create temp table seen as select at from alert_refresh where business_id = '00000000-0000-0000-0000-0000000000b1';
select test.eq((select count(*)::int from seen), 1, 'worked out, and when');
select refresh_alerts('00000000-0000-0000-0000-0000000000b1');
select test.eq((select at from alert_refresh where business_id = '00000000-0000-0000-0000-0000000000b1'),
               (select at from seen), 'asked again within the minute: the answer is used as it is');
update alert_refresh set at = at - interval '2 minutes';
select refresh_alerts('00000000-0000-0000-0000-0000000000b1');
select test.ok((select at from alert_refresh where business_id = '00000000-0000-0000-0000-0000000000b1')
               > (select at from seen), 'a minute on: worked out again');
select set_config('sixties.alerts_fresh_seconds', '0', false);
select refresh_alerts(null);
select test.eq((select count(*)::int from alert_refresh), 1, 'no café, nothing');

select test.ok(exists (select 1 from pg_indexes where indexname = 'sale_adjustment_day'),
  'a day''s voids and refunds have their own index');

-- ------------------------------------------------------------------ the system's administrators
select test.act_as('owner@example.com');
select test.eq(is_system_admin(), false, 'a café''s owner is not the system''s administrator');
select test.throws($$select speed_ping()$$, 'Only the system''s administrators see this', 'nor sees the Speed page');
select test.throws($$select speed_samples()$$, 'Only the system''s administrators see this', 'or its measurements');
select test.as_admin();
insert into system_admin (auth_user_id)
select auth_user_id from app_user where email = 'owner@example.com';
select test.act_as('owner@example.com');
select test.eq(is_system_admin(), true, 'named one, they are');
select test.eq(speed_ping() ->> 'ok', 'true', 'the trip to the database and back');
select test.ok(save_speed_sample(180, 12, '[{"name": "the alerts", "ms": 40}]', 'Chrome on Windows', 'From the till')
               is not null, 'a measurement kept');
select test.eq((select string_agg((s ->> 'device_ms') || ' ' || (s ->> 'database_ms') || ' ' || (s ->> 'note'), ', ')
                  from jsonb_array_elements(speed_samples()) s),
               '180 12 From the till', 'and read back to send');
select test.throws($$select save_speed_sample(1, 1, '{}')$$, 'The measurement cannot be read', 'a measurement is a list');
select test.throws($$select save_speed_sample(-1, 1, '[]')$$, '%speed_sample_device_ms_check%', 'of times that can be');
select test.act_as('manager@example.com');
select test.throws($$select speed_samples()$$, 'Only the system''s administrators see this', 'a manager sees none');
select test.throws($$select require_system_admin()$$, '%permission denied%', 'and cannot ask the check itself');

select test.as_admin();
select test.eq((select count(*)::int from pg_policies where tablename in ('system_admin', 'speed_sample', 'alert_refresh')), 0,
  'read by no one but through their functions');
