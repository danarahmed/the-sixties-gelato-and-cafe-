-- =============================================================================
-- Cash sessions (0036, release K): the drawer opens with a count and closes
-- with a count, blind; cash moves only in an open session; each difference
-- posts to 6300 for its session; a session is handed over, or closed by a
-- manager with a reason; and only the owner, general managers, accountants and
-- auditors see what an open drawer should hold. The fixtures opened the drawer:
-- the cashier's session 1, counted empty. Espresso: 2,500.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table ids (k text primary key, v uuid);
grant all on ids to public;
insert into ids select split_part(email::text, '@', 1), id from app_user
 where email in ('owner@example.com', 'manager@example.com', 'cashier@example.com', 'counter@example.com');
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.sell(p_qty int, p_tender text default 'cash') returns jsonb language sql as $$
  select record_sale(gen_random_uuid(), 'dine_in', p_tender::tender_type,
    jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p_qty)))
$$;
-- The open session, and a session by number (the tests' own view).
create function pg_temp.open_session() returns uuid language sql security definer as $$
  select id from work_shift where kind = 'session' and closed_at is null and business_id = '00000000-0000-0000-0000-0000000000b1'
$$;
create function pg_temp.session(p_no int) returns uuid language sql security definer as $$
  select id from work_shift where session_no = p_no and business_id = '00000000-0000-0000-0000-0000000000b1'
$$;
create function pg_temp.lines(p_ref_type text, p_ref uuid) returns text language sql security definer as $$
  select test.lines_of(p_ref) from journal_entry where reference_type = p_ref_type and reference_id = p_ref
$$;

-- ------------------------------------------------------------------ who may
select test.act_as('cashier@example.com');
select test.eq(cash_session_status() -> 'session' ->> 'no', '1', 'the drawer is open: session 1');
select test.eq((cash_session_status() -> 'session' ->> 'mine')::boolean, true, 'the cashier''s own');
select test.eq((cash_session_status() ->> 'may_close')::boolean || '/' || (cash_session_status() ->> 'may_force')::boolean
                 || '/' || (cash_session_status() ->> 'may_add_float')::boolean,
  'true/false/false', 'which they may close, but not close another''s, nor put in cash from the safe');
select test.eq(cash_session_status() ->> 'expected', null, 'the till does not show what the drawer should hold');
select test.eq(cash_session_status() ->> 'figures', null, 'nor its figures');
select test.throws(format('select * from cash_sessions(%L, %L)', test.today(), test.today()), '%permission%',
  'a cashier is not given the list of sessions');
select test.act_as('counter@example.com');
select test.throws($$select open_cash_session(0)$$, '%permission%', 'someone who handles no cash opens no drawer');
select test.throws($$select cash_session_status()$$, '%permission%', 'nor is told about it');
select test.act_as('manager@example.com');
select test.eq((cash_session_status() ->> 'may_force')::boolean || '/' || (cash_session_status() ->> 'may_add_float')::boolean,
  'true/true', 'a branch manager may close a cashier''s session, and put in cash from the safe');

-- ------------------------------------------------------------------ cash in the session
select test.act_as('cashier@example.com');
insert into res select 's1', pg_temp.sell(2);
insert into res select 's2', pg_temp.sell(1, 'card');
select test.act_as('manager@example.com');
select move_cash('till', 'safe', 3000, 'Drop to the safe');
select test.act_as('cashier@example.com');
insert into res select 's3', pg_temp.sell(1);
select test.act_as('manager@example.com');
select refund_sale((pg_temp.r('s3') ->> 'order_id')::uuid, 'cold', 'quality');
select test.as_admin();
select test.eq((select count(*) from sales_order where shift_id = pg_temp.session(1))::int, 3,
  'every sale made in the session names it, cash or card');
select test.eq((select string_agg(kind || ' ' || trim_scale(amount), ', ' order by created_at, id)
                  from cash_event where work_shift_id = pg_temp.session(1)),
  'sale 5000, cash_out -3000, sale 2500, refund -2500', 'each movement of cash joins it as it happens');
select test.act_as('manager@example.com');
select test.eq(cash_session_status() ->> 'expected', null, 'a branch manager is not shown what the drawer should hold');
select test.eq((select count(*) from cash_event)::int, 0, 'nor the open session''s movements, read directly');
select test.act_as('owner@example.com');
select test.eq((cash_session_status() ->> 'expected')::numeric, 2000::numeric,
  'the owner is: 7,500 in, 3,000 dropped in the safe, 2,500 refunded');
select test.eq((cash_session_status() -> 'figures' ->> 'card')::numeric, 2500::numeric, 'with the session''s card takings beside it');

-- ------------------------------------------------------------------ closing, blind
select test.act_as('cashier@example.com');
select test.throws($$select close_cash_session(null)$$, 'Enter the cash you counted', 'the count comes first');
select test.throws($$select close_cash_session(2500, '{"1000": 2}')$$, 'The notes counted come to 2000, not the 2500 entered',
  'the notes counted must come to the total');
select test.throws($$select close_cash_session(2500, '{"a thousand": 2}')$$, 'The notes counted cannot be read',
  'each note by its value');
select test.throws($$select close_cash_session(2500, '{"1000": 1.5}')$$, 'The notes counted cannot be read', 'in whole notes');
select test.throws($$select close_cash_session(2500, null, 1000)$$, '%the safe or the bank%', 'what does not stay goes somewhere');
insert into res select 'c1', close_cash_session(2500, '{"1000": 2, "250": 2}', 1000, 'safe');
select test.eq((select v ->> 'expected' || '/' || (v ->> 'counted') || '/' || (v ->> 'variance') from res where k = 'c1'),
  '2000/2500/500', 'counted 2,500 where 2,000 should be: 500 over, shown once the count is in');
select test.eq((select v ->> 'cash_sales' || '/' || (v ->> 'refunds') || '/' || (v ->> 'cash_out') || '/' || (v ->> 'card')
                  || '/' || (v ->> 'orders') from res where k = 'c1'),
  '7500/2500/3000/2500/3', 'with the session''s cash sales, refunds, drops, card takings and orders');
select test.as_admin();
select test.eq(pg_temp.lines('work_shift', pg_temp.session(1)), '1000 Dr 500 | 6300 Cr 500', 'the overage is posted, for the session');
select test.eq(test.lines_of((select id from cash_transfer where work_shift_id = pg_temp.session(1))),
  '1000 Cr 1500 | 1005 Dr 1500', 'the takings go to the safe after the count');
select test.eq(test.balance('1000'), 1000::numeric, 'the till''s account holds what stayed in the drawer');
select test.eq(test.balance('1005'), 4500::numeric, 'the safe the drop and the takings');
select test.eq((select closing_denominations from work_shift where id = pg_temp.session(1)), '{"250": 2, "1000": 2}'::jsonb,
  'the notes counted are kept with the session');
select test.eq((select (after_state ->> 'variance')::numeric from audit_log where action = 'cash.session.close'), 500::numeric,
  'and the close is on the audit trail, with its difference');

-- Closed, the drawer takes no cash: not twice closed, no sale, nothing in or out.
select test.act_as('cashier@example.com');
select test.throws($$select close_cash_session(1000)$$, 'The drawer is not open', 'a closed drawer is not closed again');
select test.throws(format('select close_cash_session(1000, null, null, null, %L)', pg_temp.session(1)),
  'Session 1 is already closed', 'nor that session, named');
select test.throws($$select pg_temp.sell(1)$$, 'Open the drawer first: on the till, count the cash in it',
  'a cash sale waits for the drawer to open');
insert into res select 's4', pg_temp.sell(1, 'card');
select test.as_admin();
select test.eq((select shift_id from sales_order where id = (pg_temp.r('s4') ->> 'order_id')::uuid), null,
  'a card sale needs no drawer, and names no session');
select test.act_as('manager@example.com');
select test.throws($$select move_cash('owner', 'till', 1000, 'Float')$$, 'Open the drawer first%', 'no cash goes into a closed drawer');
select test.throws($$select record_expense('Ice', 500, '6900', 'till')$$, 'Open the drawer first%', 'nor is anything paid out of it');
select test.throws(format('select void_sale(%L, %L)', pg_temp.r('s1') ->> 'order_id', 'rang twice'),
  '%counted since this sale; refund it%', 'a sale in a closed session is refunded, not voided');

-- ------------------------------------------------------------------ opening
select test.act_as('cashier@example.com');
select test.throws($$select open_cash_session(-5)$$, 'Enter the cash you counted', 'an opening count is never below nothing');
insert into res select 'o2', open_cash_session(800);
select test.eq((select v ->> 'session_no' || ': ' || (v ->> 'expected') || '/' || (v ->> 'counted') || '/' || (v ->> 'variance')
                  from res where k = 'o2'),
  '2: 1000/800/-200', 'session 2 opens 200 short of what session 1 left, shown once the count is in');
select test.as_admin();
select test.eq(pg_temp.lines('session_opening', pg_temp.session(2)), '1000 Cr 200 | 6300 Dr 200',
  'the shortage posts for this session, apart from its close');
select test.act_as('cashier@example.com');
select test.throws($$select open_cash_session(800)$$, 'The drawer is already open: session 2 since%', 'one session at a time');

-- ------------------------------------------------------------------ handing over
select test.act_as('manager@example.com');
select test.throws(format('select hand_over_session(800, %L)', pg_temp.id('counter')), 'Choose someone who may take the drawer',
  'the drawer goes to someone who handles cash');
select test.throws(format('select hand_over_session(800, %L)', pg_temp.id('cashier')), 'Hand the drawer to someone else',
  'and not back to whose session it is');
insert into res select 'h1', hand_over_session(800, pg_temp.id('owner'));
select test.eq((select v ->> 'variance' || '/' || (v ->> 'next_session_no') || '/' || (v ->> 'next_cashier') from res where k = 'h1'),
  '0/3/Demo Owner', 'the cashier''s session closes counted true, and the owner''s opens on what was left');
select test.as_admin();
select test.eq((select trim_scale(opening_counted) || '/' || trim_scale(opening_expected) || '/' || trim_scale(opening_variance)
                  || ' ' || (cashier_id = pg_temp.id('owner')) || '/' || (opened_by = pg_temp.id('manager'))
                  || '/' || (opened_from = pg_temp.session(2))
                  from work_shift where id = pg_temp.session(3)),
  '800/800/0 true/true/true', 'the owner''s session, opened by the manager from session 2''s count');
select test.act_as('cashier@example.com');
select test.throws($$select close_cash_session(800)$$, 'Only Demo Owner or a manager closes this session',
  'a cashier closes only their own session');

-- ------------------------------------------------------------------ a manager closes one left open
select test.act_as('cashier@example.com');
select test.throws(format('select force_close_session(%L, %L)', pg_temp.open_session(), 'went home'), '%permission%',
  'a cashier does not close another''s session');
select test.act_as('manager@example.com');
select test.throws(format('select force_close_session(%L, %L)', pg_temp.open_session(), ' '), 'Say why the session is being closed',
  'a manager says why');
insert into res select 'f1', force_close_session(pg_temp.open_session(), 'The owner left early');
select test.eq((select coalesce(v ->> 'counted', '-') || '/' || coalesce(v ->> 'variance', '-') || '/' || (v ->> 'left')
                  from res where k = 'f1'),
  '-/-/800', 'closed without a count: nothing is posted, and all it should hold stays for the next count');
select test.act_as('cashier@example.com');
select test.eq((open_cash_session(800) ->> 'variance')::numeric, 0::numeric, 'the next opening count finds it all there');

-- ------------------------------------------------------------------ a float from the safe
select test.act_as('cashier@example.com');
select close_cash_session(800);
select test.throws($$select open_cash_session(800, null, 1000)$$, 'Only a manager puts cash in from the safe',
  'a cashier does not take cash from the safe');
select test.act_as('manager@example.com');
select test.throws($$select open_cash_session(800, null, 50000)$$, '%safe holds only 4500%', 'nor more than the safe holds');
insert into res select 'o5', open_cash_session(800, '{"500": 1, "250": 1, "50": 1}', 1000);
select test.eq((select v ->> 'session_no' || ': ' || (v ->> 'variance') || ' + ' || (v ->> 'float_from_safe') from res where k = 'o5'),
  '5: 0 + 1000', 'the manager opens session 5 on the count, then puts in a float from the safe');
select test.act_as('owner@example.com');
select test.eq((cash_session_status() ->> 'expected')::numeric, 1800::numeric, 'the drawer should hold the count and the float');
select test.as_admin();
select test.eq(test.balance('1005') || '/' || test.balance('1000'), '3500/1800', 'the float moved from the safe to the till');

-- ------------------------------------------------------------------ sent twice
select test.act_as('manager@example.com');
insert into res select 'k1', close_cash_session(1800, null, null, null, null, null, 'c0de0000-0000-0000-0000-000000000001');
insert into res select 'k2', close_cash_session(1800, null, null, null, null, null, 'c0de0000-0000-0000-0000-000000000001');
select test.eq((pg_temp.r('k2') ->> 'replayed')::boolean, true, 'a close sent twice is answered from the first');
select test.act_as('cashier@example.com');
insert into res select 'k3', open_cash_session(1800, null, null, null, 'c0de0000-0000-0000-0000-000000000002');
insert into res select 'k4', open_cash_session(1800, null, null, null, 'c0de0000-0000-0000-0000-000000000002');
select test.eq((pg_temp.r('k4') ->> 'replayed')::boolean || ' ' || (pg_temp.r('k4') ->> 'session_no'), 'true 6',
  'an opening sent twice opens once');
select test.as_admin();
select test.eq((select count(*) from work_shift where kind = 'session')::int, 6, 'six sessions, one of them open');

-- ------------------------------------------------------------------ the record
select test.act_as('manager@example.com');
select test.eq((select count(*) from cash_sessions(test.today(), test.today()) where kind = 'session')::int, 6,
  'every session of the day is listed');
select test.eq((select coalesce(expected::text, '-') || ' ' || coalesce(counted::text, '-') from cash_sessions(test.today(), test.today())
                 where session_no = 6), '- -', 'the open one without what it should hold');
select test.eq((select string_agg(e ->> 'kind' || ' ' || (e ->> 'amount'), ', ')
                  from jsonb_array_elements(cash_session_statement(pg_temp.session(1)) -> 'events') e),
  'sale 5000, cash_out -3000, sale 2500, refund -2500', 'a closed session''s statement lists every movement of cash');
select test.eq((select string_agg(t ->> 'to' || ' ' || (t ->> 'amount'), ', ')
                  from jsonb_array_elements(cash_session_statement(pg_temp.session(1)) -> 'takings') t),
  'safe 1500', 'and the takings after it');
select test.throws(format('select cash_session_statement(%L)', pg_temp.open_session()),
  'What an open drawer should hold is shown once it is counted', 'an open session''s statement waits for its count');
select test.act_as('owner@example.com');
select test.succeeds(format('select cash_session_statement(%L)', pg_temp.open_session()), 'except for the owner');
select test.as_admin();
select test.eq((select string_agg(action || ' ' || n, ', ' order by action)
                  from (select action, count(*) n from audit_log where action like 'cash.session.%' group by action) x),
  'cash.session.close 3, cash.session.force_close 1, cash.session.hand_over 1, cash.session.open 5',
  'every opening, close, handover and forced close is on the audit trail');

-- ------------------------------------------------------------------ the books
select test.as_admin();
select test.eq(test.balance('1000'), (select d.carry + d.moved from location l cross join lateral drawer_position(l.business_id, l.id) d
                                        where l.business_id = '00000000-0000-0000-0000-0000000000b1' and l.kind = 'branch'),
  'the till''s account is always what the drawer should hold');
select test.eq((select count(*) from cash_event where work_shift_id is null)::int, 0, 'every movement of cash is in a session');
select test.eq(test.balance('6300'), -300::numeric, 'the over and short: 500 over, then 200 short');
select test.throws($$update work_shift set counted_cash = 1 where session_no = 1$$, '%cannot change%', 'a closed session never changes');
select test.throws($$delete from work_shift where session_no = 6$$, '%cannot be deleted%', 'nor is any deleted');
select test.act_as('owner@example.com');
select test.eq((select string_agg(check_key || '=' || difference, ', ' order by check_key)
                  from report_reconciliation(test.today()) where difference <> 0), null, 'every subledger agrees with its account');

-- A new branch gets its drawer.
select test.as_admin();
insert into location (business_id, kind, name) values ('00000000-0000-0000-0000-0000000000b1', 'branch', 'Second Branch');
select test.eq((select count(*) from cash_drawer d join location l on l.id = d.location_id where l.name = 'Second Branch')::int, 1,
  'a new branch gets a drawer of its own');
