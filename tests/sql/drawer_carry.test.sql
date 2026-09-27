-- =============================================================================
-- The drawer's first events (0024): the cash already taken since a location's
-- last day closed the old way is carried into its drawer, so the first count
-- expects it. Before 0024 the till's cash was account 1000; each published
-- movement of it since that day becomes an event, as its record writes one
-- today. Here the old app's day is replayed with the drawer's triggers off —
-- the old app wrote no events — and then carried, as 0024 did before sessions
-- (0036) began. The first session then takes over from it.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table loc as select default_location('00000000-0000-0000-0000-0000000000b1') id;
create temp table ctx as select test.today() as today;
grant select on loc, ctx to public;
select test.eq((select count(*) from cash_event)::int, 0, 'a new database starts with no drawer events');
-- Before sessions: the fixtures' open session is taken away.
alter table work_shift disable trigger work_shift_guard;
delete from work_shift;
alter table work_shift enable trigger work_shift_guard;

-- Yesterday was closed the old way, one day at a time; its cash is not carried.
insert into work_shift (business_id, location_id, opened_at, closed_at, opening_float, expected_cash, counted_cash,
                        variance, business_day, kind)
values ('00000000-0000-0000-0000-0000000000b1', (select id from loc), now() - interval '1 day', now() - interval '1 day',
        0, 0, 0, 0, (select today from ctx) - 1, 'day');
create temp table je as select gen_random_uuid() id;
insert into journal_entry (id, business_id, period_id, description, reference_type, occurred_at, status)
select je.id, '00000000-0000-0000-0000-0000000000b1',
       ensure_period('00000000-0000-0000-0000-0000000000b1', (select today from ctx) - 1),
       'Float for the till (old app)', 'manual',
       ((select today from ctx) - 1 + time '09:00') at time zone 'Asia/Baghdad', 'draft'
  from je;
insert into journal_line (journal_entry_id, account_id, debit, credit)
select (select id from je), id, case code when '1000' then 7000 else 0 end, case code when '3000' then 7000 else 0 end
  from gl_account where business_id = '00000000-0000-0000-0000-0000000000b1' and code in ('1000', '3000');
update journal_entry set status = 'published' where id = (select id from je);

-- Today, as the old app recorded it: no drawer events.
alter table sales_tender disable trigger sales_tender_cash;
alter table sale_adjustment disable trigger sale_adjustment_cash;
select test.act_as('cashier@example.com');
create temp table s as
  select 1 n, record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') r
  union all select 2, record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]')
  union all select 3, record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]')
  union all select 4, record_sale(gen_random_uuid(), 'dine_in', 'card', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]');
grant select on s to public;
select test.act_as('manager@example.com');
select void_sale((select (r ->> 'order_id')::uuid from s where n = 1), 'rung twice');
select refund_sale((select (r ->> 'order_id')::uuid from s where n = 3), 'did not like it');
select test.as_admin();
-- An expense the old app paid "from cash": its journal credits 1000, and it wrote no event.
create temp table xp as select gen_random_uuid() id, gen_random_uuid() je;
insert into expense (id, business_id, amount, incurred_on, description)
select id, '00000000-0000-0000-0000-0000000000b1', 1000, (select today from ctx), 'Ice (old app)' from xp;
insert into journal_entry (id, business_id, period_id, description, reference_type, reference_id, occurred_at, status)
select je, '00000000-0000-0000-0000-0000000000b1', ensure_period('00000000-0000-0000-0000-0000000000b1', (select today from ctx)),
       'Expense: Ice (old app)', 'expense', id, now(), 'draft'
  from xp;
insert into journal_line (journal_entry_id, account_id, debit, credit)
select (select je from xp), id, case code when '6900' then 1000 else 0 end, case code when '1000' then 1000 else 0 end
  from gl_account where business_id = '00000000-0000-0000-0000-0000000000b1' and code in ('6900', '1000');
update journal_entry set status = 'published' where id = (select je from xp);
alter table sales_tender enable trigger sales_tender_cash;
alter table sale_adjustment enable trigger sale_adjustment_cash;
select test.eq((select count(*) from cash_event)::int, 0, 'the old app''s day left no drawer events');

-- Carried: three cash sales in, the void and the refund out, the expense out.
alter table cash_event disable trigger cash_event_session;
select test.eq(carry_cash_since_last_close(), 6, 'six movements of the till since yesterday''s close are carried');
select test.eq((select string_agg(kind || ' ' || trim_scale(amount), ', ' order by created_at, kind) from cash_event),
  'sale 2500, sale 5000, sale 2500, void -2500, refund -2500, paid_out -1000',
  'each as its record writes one today; the card sale and yesterday''s float are not');
select test.eq((select string_agg(distinct reference_type, ',' order by reference_type) from cash_event),
  'expense,sale_adjustment,sales_order', 'referring to the sale, the void or refund, and the expense');
select test.eq((select count(*) from cash_event where location_id <> (select id from loc))::int, 0, 'all at the sale''s location');
select test.eq(carry_cash_since_last_close(), 0, 'carried once only: a second run adds nothing');
alter table cash_event enable trigger cash_event_session;

-- The first session takes over. After a day closed the old way, the drawer's
-- start is not known, but the books know what the till holds: yesterday's
-- float of 7,000 and today's 4,000 (the three cash sales, less the void, the
-- refund and the ice). The opening count settles the difference.
select test.act_as('owner@example.com');
select test.eq((drawer_status() ->> 'needs_start')::boolean, true, 'after a day closed the old way, the start is not known');
select test.eq((drawer_status() ->> 'moved')::numeric, 4000::numeric, 'and the cash taken since that close is already in');
select test.act_as('cashier@example.com');
create temp table o1 as select open_cash_session(12000) as r;
grant select on o1 to public;
select test.eq((select (r ->> 'expected') || '/' || (r ->> 'variance') || '/' || (r ->> 'took_over') from o1), '11000/1000/true',
  'the books said 11,000; 12,000 was counted: 1,000 over, shown once the count is in');
select test.as_admin();
select test.eq((select kind || ' ' || trim_scale(expected_cash) || '/' || trim_scale(counted_cash) || '/' || trim_scale(variance)
                  || ' ' || test.lines_of(id)
                  from work_shift where id = (select opened_from from work_shift where id = (select (r ->> 'session_id')::uuid from o1))),
  'drawer 11000/12000/1000 1000 Dr 1000 | 6300 Cr 1000',
  'a drawer count of its own takes in the carried cash, and posts the difference');
select test.eq((select trim_scale(opening_counted) || '/' || trim_scale(opening_expected) || '/' || trim_scale(opening_variance)
                  from work_shift where id = (select (r ->> 'session_id')::uuid from o1)),
  '12000/12000/0', 'the session opens where that count closed');
select test.eq((select count(*) from cash_event where work_shift_id is null)::int, 0, 'every carried movement is counted');
select test.eq(test.balance('1000'), 12000::numeric, 'and the till''s account is what was counted');

-- Nobody can run it by hand.
select test.act_as('owner@example.com');
select test.throws($$select carry_cash_since_last_close()$$, '%permission denied%', 'the carry is the migration''s alone');
