-- =============================================================================
-- Warnings on your phone (0072, round eleven): the owner turns them on for the
-- café, with the app's address and its keys; whoever sees the dashboard's
-- warnings turns them on on a phone — all, or the urgent ones; each new alert,
-- or one turned red, waits in each phone's queue, more than three at once as
-- one; an answered one is not sent; the app's address takes the queue only
-- with the database's secret, and says what was sent and which phones are
-- gone; turned off, nothing waits and nothing is given out.
-- =============================================================================
select test.as_admin();
-- The keys as a browser would be given them (base64url): 87 and 43 letters.
create function pg_temp.pub() returns text language sql as $$ select repeat('B', 87) $$;
create function pg_temp.priv() returns text language sql as $$ select repeat('p', 43) $$;
create function pg_temp.dev(p_endpoint text) returns uuid language sql security definer as $$
  select id from push_device where endpoint = p_endpoint $$;
create function pg_temp.waiting(p_endpoint text) returns text language sql security definer as $$
  select coalesce(string_agg(case when m.urgent then '!' else '' end || m.title, ' | ' order by m.id), '')
    from push_message m join push_device d on d.id = m.device_id
   where d.endpoint = p_endpoint and m.sent_at is null $$;
create function pg_temp.alert(p_rule text, p_urgency text, p_title text) returns uuid
language sql security definer as $$
  insert into alert (business_id, rule, subject, urgency, title, why, confidence, link)
  values ('00000000-0000-0000-0000-0000000000b1', p_rule, gen_random_uuid()::text, p_urgency, p_title,
          'Because the test says so', 'high', '/sales')
  returning id $$;
create function pg_temp.secret() returns text language sql security definer as $$
  select secret from push_config where business_id = '00000000-0000-0000-0000-0000000000b1' $$;
create function pg_temp.queue() returns int language sql security definer as $$
  select push_queue('00000000-0000-0000-0000-0000000000b1') $$;
-- Whatever alerts the catalogue raises are open before the warnings are turned on.
select refresh_alerts('00000000-0000-0000-0000-0000000000b1');

-- ------------------------------------------------------------ off, to start with
select test.act_as('owner@example.com');
select test.eq(phone_warnings() ->> 'on', 'false', 'off until the owner turns them on');
select test.eq(phone_warnings() ->> 'may_turn_on', 'true', 'the owner may');
select test.eq(phone_warnings() ->> 'can_send', 'false', 'this database has no timer: it says so');
select test.act_as('manager@example.com');
select test.eq(phone_warnings() ->> 'may_turn_on' || '/' || (phone_warnings() ->> 'may_receive'), 'false/true',
  'a branch manager sees warnings, and does not turn them on for the café');
select test.throws($$select turn_on_phone_warnings('https://cafe.example', pg_temp.pub(), pg_temp.priv())$$,
  '%needs settings.manage%', 'only the owner (or the general manager) turns them on');
select test.throws($$select save_push_device('https://push.example/m1', repeat('k', 87), repeat('a', 22), 'ckb', false)$$,
  'Phone warnings are not turned on for the café%', 'nor can a phone be turned on before the café is');
select test.act_as('cashier@example.com');
select test.throws($$select save_push_device('https://push.example/c1', repeat('k', 87), repeat('a', 22), 'en', false)$$,
  '%needs profit.view%', 'the cashier does not see the warnings, on a phone either');

-- ------------------------------------------------------------ turned on
select test.act_as('owner@example.com');
select test.throws($$select turn_on_phone_warnings('http://cafe.example', pg_temp.pub(), pg_temp.priv())$$,
  'The app''s address must be its https address', 'an address that is not https is refused');
select test.throws($$select turn_on_phone_warnings('https://cafe.example', 'short', pg_temp.priv())$$,
  'The keys for sending are not valid', 'and keys that are not keys');
select test.eq(turn_on_phone_warnings('https://cafe.example/', pg_temp.pub(), pg_temp.priv(),
                                      'f0000000-0000-0000-0000-000000000072') ->> 'site_url',
  'https://cafe.example', 'turned on, at the app''s address');
select test.eq(turn_on_phone_warnings('https://cafe.example/', pg_temp.pub(), pg_temp.priv(),
                                      'f0000000-0000-0000-0000-000000000072') ->> 'replayed', 'true',
  'pressed twice, it is done once');
select test.eq(phone_warnings() ->> 'on' || '/' || (phone_warnings() ->> 'public_key'), 'true/' || pg_temp.pub(),
  'on, with the key a phone needs');
select test.as_admin();
select test.ok((select count(*) from alert where business_id = '00000000-0000-0000-0000-0000000000b1'
                   and resolved_at is null and pushed_urgency is null) = 0,
  'what was open already was seen on the dashboard: none of it is sent');
select test.ok(length(pg_temp.secret()) >= 64, 'the database has a long secret of its own');
select test.ok((select count(*) from audit_log where action = 'phone_warnings.on') = 1, 'on the audit trail, once');
-- Turned on again with other keys, the first are kept: phones turned on with them keep working.
select test.act_as('owner@example.com');
select turn_on_phone_warnings('https://cafe.example', repeat('C', 87), repeat('q', 43));
select test.eq(phone_warnings() ->> 'public_key', pg_temp.pub(), 'the keys are kept from the first time');

-- ------------------------------------------------------------ phones
select test.act_as('manager@example.com');
select save_push_device('https://push.example/m1', repeat('k', 87), repeat('a', 22), 'ckb', false);
select test.eq(phone_warnings('https://push.example/m1') #>> '{this_phone,urgent_only}', 'false',
  'the manager''s phone: every warning');
select test.act_as('owner@example.com');
select save_push_device('https://push.example/o1', repeat('k', 87), repeat('a', 22), 'en', true);
select test.eq(phone_warnings('https://push.example/m1') -> 'this_phone', 'null'::jsonb,
  'the owner is not told of the manager''s phone as theirs');
select test.eq(phone_warnings() ->> 'phones', '2', 'the owner sees how many phones get them');
select test.throws($$select save_push_device('http://push.example/x', repeat('k', 87), repeat('a', 22), 'en', true)$$,
  'This phone''s browser gave no address to send to', 'a phone''s address is https');

-- ------------------------------------------------------------ the queue
select test.as_admin();
select pg_temp.alert('cash_negative', 'red', 'Cash is below zero');
select pg_temp.alert('running_out', 'orange', 'Milk is running out');
select test.eq(pg_temp.queue(), 3, 'two new warnings: both to the manager, the red one to the owner');
select test.eq(pg_temp.waiting('https://push.example/m1'), '!Cash is below zero | Milk is running out',
  'the manager''s phone: the red one first');
select test.eq(pg_temp.waiting('https://push.example/o1'), '!Cash is below zero',
  'the owner asked for the urgent ones only');
select test.eq(pg_temp.queue(), 0, 'each is sent once');
update alert set urgency = 'red' where title = 'Milk is running out';
select test.eq(pg_temp.queue(), 2, 'turned red, it is sent again, to both');
-- Answered or snoozed on the dashboard: not sent.
select pg_temp.alert('waste_spike', 'red', 'Waste above its usual'), pg_temp.alert('use_by', 'red', 'Cream past its use-by');
update alert set acknowledged_at = now() where title = 'Waste above its usual';
update alert set snoozed_until = now() + interval '1 day' where title = 'Cream past its use-by';
select test.eq(pg_temp.queue(), 0, 'what was answered or snoozed is not sent');
-- More than three at once: one, saying how many.
select pg_temp.alert('bill_due', 'orange', 'Bill ' || g) from generate_series(1, 4) g;
select test.eq(pg_temp.queue(), 1, 'four at once to the manager are one message');
select test.ok(pg_temp.waiting('https://push.example/m1') like '%4 new warnings at the café%',
  'it says how many');
-- Someone no longer at the café gets nothing.
update app_user set is_active = false where email = 'manager@example.com';
select pg_temp.alert('cash_negative', 'red', 'The safe is short');
select test.eq(pg_temp.queue(), 1, 'a person no longer at the café gets nothing: the owner''s phone only');
update app_user set is_active = true where email = 'manager@example.com';

-- ------------------------------------------------------------ the app takes the queue
select test.act_as_anon();
select test.throws($$select push_take('not the secret, nor anything like it, not at all')$$, 'Not allowed',
  'without the secret, nothing');
select test.throws($$select push_take(null)$$, 'Not allowed', 'nor with none');
select test.as_admin();
create temporary table took as select push_take(pg_temp.secret()) as v;
select test.eq((select v ->> 'subject' from took), 'https://cafe.example', 'with the secret: the keys and the queue');
select test.eq((select v ->> 'private_key' from took), pg_temp.priv(), 'the key to sign with');
select test.eq((select jsonb_array_length(v -> 'messages') from took), 7, 'every message waiting');
select test.eq((select string_agg(distinct m ->> 'locale', ',' order by m ->> 'locale')
                  from took, jsonb_array_elements(v -> 'messages') m), 'ckb,en', 'each in its phone''s language');
select test.eq(jsonb_array_length(push_take(pg_temp.secret()) -> 'messages'), 0, 'taken once, not twice at once');
select test.eq(push_done(pg_temp.secret(),
                 (select array_agg((m ->> 'id')::bigint) from took, jsonb_array_elements(v -> 'messages') m
                   where m ->> 'endpoint' = 'https://push.example/m1'),
                 array['https://push.example/o1']) ->> 'gone', '1',
  'what was sent is marked, and the phone that is gone is dropped');
select test.ok(pg_temp.dev('https://push.example/o1') is null, 'the owner''s old phone is gone');
select test.eq(pg_temp.waiting('https://push.example/m1'), '', 'nothing waits for the manager''s phone');
-- Taken and not answered for: offered again after ten minutes, three times at most.
select pg_temp.alert('cash_negative', 'red', 'Cash is short again');
select pg_temp.queue();
select test.eq(jsonb_array_length(push_take(pg_temp.secret()) -> 'messages'), 1, 'taken');
update push_message set taken_at = now() - interval '11 minutes' where sent_at is null;
select test.eq(jsonb_array_length(push_take(pg_temp.secret()) -> 'messages'), 1, 'offered again after ten minutes');
update push_message set taken_at = now() - interval '11 minutes' where sent_at is null;
select push_take(pg_temp.secret());
update push_message set taken_at = now() - interval '11 minutes' where sent_at is null;
select test.eq(jsonb_array_length(push_take(pg_temp.secret()) -> 'messages'), 0, 'three times at most');

-- ------------------------------------------------------------ a test, and the timer
select test.act_as('manager@example.com');
select test.eq(send_test_warning('https://push.example/m1') ->> 'queued', 'true', 'a test, to one''s own phone');
select test.ok(pg_temp.waiting('https://push.example/m1') like '%A test from the café%', 'it waits to be sent');
select send_test_warning('https://push.example/m1'), send_test_warning('https://push.example/m1');
select test.throws($$select send_test_warning('https://push.example/m1')$$, 'A test was sent a moment ago%',
  'not more than three a minute');
select test.act_as('owner@example.com');
select test.throws($$select send_test_warning('https://push.example/m1')$$,
  'Warnings are not turned on on this phone', 'not to someone else''s phone');
select test.as_admin();
select test.eq(push_kick('00000000-0000-0000-0000-0000000000b1'), false,
  'without pg_net the database calls nothing, and says nothing went');
select test.ok(push_tick() >= 0, 'the timer''s round runs, with nothing to call');

-- ------------------------------------------------------------ off, on a phone and for the café
select test.act_as('manager@example.com');
select test.eq(remove_push_device('https://push.example/m1') ->> 'removed', 'true', 'turned off on the phone');
select test.ok(pg_temp.dev('https://push.example/m1') is null, 'the phone is no longer kept');
select save_push_device('https://push.example/m1', repeat('k', 87), repeat('a', 22), 'ar', false);
select test.as_admin();
select pg_temp.alert('cash_negative', 'red', 'Cash is short once more');
select pg_temp.queue();
select test.act_as('owner@example.com');
select test.eq(turn_off_phone_warnings() ->> 'on', 'false', 'the owner turns them off');
select test.as_admin();
select test.eq(pg_temp.waiting('https://push.example/m1'), '', 'nothing is left waiting');
select test.act_as_anon();
select test.throws($$select push_take(pg_temp.secret())$$, 'Not allowed', 'and nothing is given out');
select test.act_as('manager@example.com');
select test.throws($$select save_push_device('https://push.example/m2', repeat('k', 87), repeat('a', 22), 'en', false)$$,
  'Phone warnings are not turned on for the café%', 'no phone is turned on while it is off');

-- ------------------------------------------------------------ who may read what
select test.act_as('owner@example.com');
select test.throws($$select count(*) from push_config$$, '%permission denied%', 'the keys are not read directly');
select test.throws($$select count(*) from push_device$$, '%permission denied%', 'nor the phones');
select test.throws($$select push_queue('00000000-0000-0000-0000-0000000000b1')$$, '%permission denied%',
  'nor is the queue filled by hand');
select test.throws($$select push_tick()$$, '%permission denied%', 'nor the timer''s round run');
