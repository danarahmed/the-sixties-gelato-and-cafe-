-- =============================================================================
-- The system speaks (0029, the audit's P1-8): the alert rules of §7, each
-- saying what happened, why it matters, how urgent it is, what to do and how
-- sure it is; kept one per rule and subject, acknowledged with a note, snoozed
-- with a reason, resolving themselves once the condition clears; thresholds
-- the owner sets; and the daily brief, its facts, calculations and
-- recommendations kept apart.
-- Golden catalogue: beans 1,000 g at 10; cups 100 at 50; water 24 at 250;
-- espresso 2,500 dine-in and takeaway, 3,000 on Talabat, costing 200 (250 with
-- its takeaway cup); water 1,000. The seed menu's own ingredients have no cost
-- yet, so the seed raises alerts of its own: each rule here is read for its
-- own subjects.
-- =============================================================================
select test.golden_catalogue();
-- Percentages to the dinar, so every discount can be seen exactly.
update business set discount_round_to = 1;
create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
create temp table s (k text primary key, r jsonb);
grant all on s to public;
create or replace function pg_temp.r(p text) returns jsonb language sql as $$ select r from s where k = p $$;
create or replace function pg_temp.order_of(p text) returns uuid language sql as $$ select (r ->> 'order_id')::uuid from s where k = p $$;
insert into ids select split_part(email::text, '@', 1), id from app_user
 where email in ('owner@example.com', 'manager@example.com', 'cashier@example.com', 'counter@example.com');
insert into ids values
  ('loc', (select id from location where business_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'branch')),
  ('dairy', (select id from supplier where name = 'Sulaymaniyah Dairy Co.'));
-- What one rule finds, now or at another moment: "urgency confidence: title",
-- for every subject or one.
create or replace function pg_temp.found(p_rule text, p_subject text default null, p_at timestamptz default now())
returns text language sql as $$
  select string_agg(urgency || ' ' || confidence || ': ' || title, ' | ' order by title)
    from alert_conditions('00000000-0000-0000-0000-0000000000b1', p_at)
   where rule = p_rule and (p_subject is null or subject = p_subject)
$$;
create or replace function pg_temp.espressos(p_qty int default 1) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p_qty))
$$;
create or replace function pg_temp.day(p_offset int default 0) returns text language sql as $$
  select to_char(test.today() + p_offset, 'DD Mon')
$$;
create or replace function pg_temp.said(a audit_log) returns text language sql as $$
  select coalesce(a.before_state::text, '-') || ' → ' || coalesce(a.after_state::text, '-') || ' by '
         || coalesce((select email::text from app_user where id = a.app_user_id), 'no one')
         || coalesce(' (' || a.reason || ')', '')
$$;

-- ---------------------------------------------------------- nothing to say
select test.eq((select string_agg(distinct rule, ',') from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())),
  'no_cost', 'on a new café, only the seed menu''s ingredients without a cost yet');
select test.eq((select count(*) from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where subject like 'c0000000%' or subject like 'd1000000%')::int,
  0, 'the golden catalogue, costed and priced, raises nothing');

-- ----------------------------------------------------------- the daily brief
-- A day: three sales, one voided, one refunded, one discounted; some beans
-- wasted; the drawer counted 500 short.
select test.act_as('cashier@example.com');
insert into s select 'a', record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(2));
insert into s select 'b', record_sale(gen_random_uuid(), 'takeaway', 'card', pg_temp.espressos(1));
insert into s select 'c', record_sale(gen_random_uuid(), 'dine_in', 'cash',
  '[{"variant_id":"d1000000-0000-0000-0000-000000000002","qty":1}]', null, 10, p_discount_reason => 'regular');
select test.act_as('manager@example.com');
select void_sale(pg_temp.order_of('b'), null, 'rang_twice');
select refund_sale(pg_temp.order_of('c'), 'the bottle was warm', 'quality');
select record_waste('c0000000-0000-0000-0000-000000000001', 100, 'g', 'waste', 'spilled');
select count_drawer(4500);

select test.act_as('cashier@example.com');
select test.throws(format('select daily_brief(%L)', test.today()), '%permission%', 'a cashier is not given the brief');
select test.throws($$select * from current_alerts()$$, '%permission%', 'nor the alerts');
select test.act_as('counter@example.com');
select test.throws(format('select daily_brief(%L)', test.today()), '%permission%', 'nor is a stock counter');
select test.act_as('owner@example.com');
insert into s select 'brief', daily_brief(test.today());
select test.eq(pg_temp.r('brief') -> 'facts',
  '{"sales": 2, "net_sales": 5000, "voids": 1, "voided": 2500, "refunds": 1, "refunded": 900, "discounts": 1,
    "discounted": 100, "waste": 1000, "drawer_counts": 1, "drawer_difference": -500, "uncosted_sales": 0}'::jsonb,
  'the facts: two sales standing (the voided one is not), 5,000 net of the void, the refund and the discount; '
  'the voids, refunds and discounts; 1,000 of beans wasted; the drawer 500 short');
select test.eq(pg_temp.r('brief') -> 'calculations',
  '{"cost_of_goods": 400, "cost_of_goods_percent": 8.0, "gross_profit": 3600, "gross_margin_percent": 72.0,
    "same_day_last_week": 0, "change_from_last_week_percent": null, "usual_for_the_weekday": null}'::jsonb,
  'the calculations, apart: the two espressos cost 400 (the water came back to the shelf), 8% of sales; '
  'the waste makes the gross profit 3,600, 72%; no week before to compare with');
select test.eq((pg_temp.r('brief') ->> 'red')::int || ' red, ' || jsonb_array_length(pg_temp.r('brief') -> 'recommendations')
                 || ' to do', '0 red, 0 to do', 'nothing urgent, so nothing recommended');
select test.as_admin();
select test.eq((pg_temp.r('brief') ->> 'orange')::int,
  (select count(*) from alert where resolved_at is null and urgency = 'orange')::int,
  'the brief lists the alerts open now');
select test.act_as('owner@example.com');
select test.eq(daily_brief(test.today() - 1) -> 'facts',
  '{"sales": 0, "net_sales": 0, "voids": 0, "voided": 0, "refunds": 0, "refunded": 0, "discounts": 0,
    "discounted": 0, "waste": 0, "drawer_counts": 0, "drawer_difference": 0, "uncosted_sales": 0}'::jsonb,
  'yesterday, before the café opened: nothing');
select test.throws(format('select daily_brief(%L)', test.today() + 1), 'Choose a day that has happened',
  'there is no brief of tomorrow');

-- ------------------------------------------------------ cash below zero
select test.act_as('owner@example.com');
select save_journal(test.today(), 'Rent paid from the bank',
  '[{"code":"6000","debit":50000},{"code":"1020","credit":50000}]', true);
select test.as_admin();
select test.eq(pg_temp.found('cash_negative'), 'red high: Bank is -50,000 IQD: below zero',
  'the bank below zero: red, and sure — the ledger says so');
select test.eq((select why || ' ' || action from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'cash_negative'),
  'Money cannot leave a place before it is there: a payment was recorded from the wrong place, or takings are missing. '
  'Open the account''s journal lines and record where the money really came from.',
  'with why it matters, and what to do');

-- -------------------------------------------- kept, acknowledged, resolved
select test.act_as('manager@example.com');
select test.eq((select rule || ' ' || urgency from current_alerts() limit 1), 'cash_negative red', 'red comes first');
select count(*) from current_alerts();
select test.as_admin();
select test.eq((select count(*) from alert where rule = 'cash_negative')::int, 1,
  'one alert for the bank, however often it is looked at');
insert into ids select 'bank1', id from alert where rule = 'cash_negative';
select test.act_as('owner@example.com');
select test.throws($$select * from alert$$, '%permission denied%', 'alerts are read only through their functions');

select test.act_as('cashier@example.com');
select test.throws(format('select acknowledge_alert(%L, %L)', pg_temp.id('bank1'), 'seen it'), '%permission%',
  'a cashier does not answer alerts');
select test.act_as('manager@example.com');
select test.throws(format('select acknowledge_alert(%L, %L)', pg_temp.id('bank1'), 'ok'),
  'Say what was done about it, or why it is fine', 'an acknowledgement says something');
select acknowledge_alert(pg_temp.id('bank1'), 'Rent left the bank before the deposit was recorded');
select test.eq((select row(acknowledged_by, ack_note)::text from current_alerts() where id = pg_temp.id('bank1')),
  '("Demo Manager","Rent left the bank before the deposit was recorded")', 'the alert stays, with who answered it and how');
select test.act_as('owner@example.com');
insert into s select 'brief2', daily_brief(test.today());
select test.eq((pg_temp.r('brief2') ->> 'red')::int || ' red, ' || (pg_temp.r('brief2') -> 'recommendations')::text,
  '1 red, []', 'the brief still lists it, and recommends nothing more: it has been answered');
select test.as_admin();
select test.eq((select reason || ' | ' || (after_state ->> 'rule') from audit_log where action = 'alert.acknowledge'),
  'Rent left the bank before the deposit was recorded | cash_negative', 'the answer is on the audit trail');

-- The owner puts the money in: the alert resolves itself.
select test.act_as('owner@example.com');
select save_journal(test.today(), 'Owner''s money into the bank',
  '[{"code":"1020","debit":50000},{"code":"3000","credit":50000}]', true);
select test.eq((select count(*) from current_alerts() where rule = 'cash_negative')::int, 0, 'once the bank is back to zero');
select test.as_admin();
select test.ok((select resolved_at is not null from alert where id = pg_temp.id('bank1')), 'resolved, and kept as it was');

-- It happens again: a new alert, not an answered one.
select test.act_as('owner@example.com');
select save_journal(test.today(), 'Rent paid from the bank again',
  '[{"code":"6000","debit":10000},{"code":"1020","credit":10000}]', true);
select test.eq((select row(id <> pg_temp.id('bank1'), acknowledged_at is null, title)::text
                  from current_alerts() where rule = 'cash_negative'),
  '(t,t,"Bank is -10,000 IQD: below zero")', 'a new alert, waiting for an answer');
insert into ids select 'bank2', id from current_alerts() where rule = 'cash_negative';

-- Snoozed: out of the brief until the day chosen, with a reason.
select test.throws(format('select snooze_alert(%L, %L, %L)', pg_temp.id('bank2'), test.today() + 1, 'no'),
  'Say why it can wait', 'a snooze says why');
select test.throws(format('select snooze_alert(%L, %L, %L)', pg_temp.id('bank2'), test.today(), 'the transfer is on its way'),
  'Snooze it until a day in the next 30', 'until a day to come');
select test.throws(format('select snooze_alert(%L, %L, %L)', pg_temp.id('bank2'), test.today() + 31, 'the transfer is on its way'),
  'Snooze it until a day in the next 30', 'within a month');
select snooze_alert(pg_temp.id('bank2'), test.today() + 2, 'the transfer is on its way');
select test.eq((select row(snoozed_until = ((test.today() + 2)::timestamp at time zone 'Asia/Baghdad'), snoozed_by, snooze_reason)::text
                  from current_alerts() where id = pg_temp.id('bank2')),
  '(t,"Demo Owner","the transfer is on its way")', 'until the start of that day, Baghdad time, by whom and why');
select test.eq((daily_brief(test.today()) ->> 'red')::int, 0, 'the brief leaves it out meanwhile');
select test.as_admin();
select test.eq((select (after_state ->> 'until') || ' ' || reason from audit_log where action = 'alert.snooze'),
  (test.today() + 2)::text || ' the transfer is on its way', 'snoozing is on the audit trail too');
select test.act_as('owner@example.com');
select save_journal(test.today(), 'Transfer from the owner',
  '[{"code":"1020","debit":10000},{"code":"3000","credit":10000}]', true);
select test.eq((select count(*) from current_alerts() where rule = 'cash_negative')::int, 0, 'and it too resolves itself');
select test.throws(format('select acknowledge_alert(%L, %L)', pg_temp.id('bank2'), 'money arrived'),
  'That alert has cleared already', 'a cleared alert needs no answer');

-- ------------------------------------------------- the drawer not counted
select test.as_admin();
select test.eq(pg_temp.found('drawer_uncounted', null, now() + interval '1 day'), null,
  'counted after the last sale: nothing to say, even tomorrow');
select test.act_as('cashier@example.com');
insert into s select 'd1', record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(1));
select test.as_admin();
select test.eq(pg_temp.found('drawer_uncounted'), null, 'today''s takings are counted tonight: nothing yet');
select test.eq(pg_temp.found('drawer_uncounted', null, now() + interval '1 day'),
  format('orange high: The drawer at Main Branch has not been counted for %s', pg_temp.day()),
  'tomorrow, a day not counted: orange');
-- Cash that came in the day before, not counted either (with its journal, so
-- the till's account still matches the drawer).
insert into cash_event (id, business_id, location_id, kind, amount, reference_type, reference_id, created_at)
values ('e0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', pg_temp.id('loc'), 'cash_in', 1000,
        'cash_transfer', gen_random_uuid(), now() - interval '1 day');
select post_journal('00000000-0000-0000-0000-0000000000b1', now() - interval '1 day', 'Float (fixture)', 'cash_event',
  'e0000000-0000-0000-0000-0000000000c1', '[{"code":"1000","debit":1000},{"code":"3000","credit":1000}]');
select test.eq(pg_temp.found('drawer_uncounted', null, now() + interval '1 day'),
  format('red high: The drawer at Main Branch has not been counted for 2 days, since %s', pg_temp.day(-1)),
  'two days: red');
select test.act_as('manager@example.com');
select count_drawer((drawer_status() ->> 'expected')::numeric);
select test.as_admin();
select test.eq(pg_temp.found('drawer_uncounted', null, now() + interval '1 day'), null, 'counted: nothing to say');

-- ------------------------------------------------ a count left open; thresholds
select test.act_as('counter@example.com');
insert into ids select 'count', start_stock_count(array['c0000000-0000-0000-0000-000000000003'::uuid]);
select test.as_admin();
select test.eq(pg_temp.found('count_stale'), null, 'a count just started is not stale');
select test.eq(pg_temp.found('count_stale', null, now() + interval '9 hours'),
  (select 'orange high: A stock count has been open since ' || to_char(started_at at time zone 'Asia/Baghdad', 'DD Mon HH24:MI')
     from stock_count where id = pg_temp.id('count')),
  'open for more than 8 hours: orange');

-- The thresholds are the owner's (and the general manager's) to set.
select test.act_as('manager@example.com');
select test.throws($$select set_alert_thresholds('{"count_stale_hours": 12}')$$, '%permission%',
  'a branch manager does not change them');
select test.act_as('owner@example.com');
select test.eq(alert_thresholds() -> 'count_stale_hours',
  '{"default": 8, "min": 1, "max": 72, "whole": true, "label": "Hours a stock count may stay open", "value": 8}'::jsonb,
  'each threshold with its default, its limits, and the value in force');
select test.eq((select count(*) from jsonb_object_keys(alert_thresholds()))::int, 11, 'eleven of them');
select test.throws($$select set_alert_thresholds('{"count_stale_hours": 0}')$$,
  'Hours a stock count may stay open: enter a whole number from 1 to 72', 'within its limits');
select test.throws($$select set_alert_thresholds('{"count_stale_hours": 2.5}')$$,
  'Hours a stock count may stay open: enter a whole number from 1 to 72', 'whole hours');
select test.throws($$select set_alert_thresholds('{"count_stale_hours": "soon"}')$$,
  'Hours a stock count may stay open: enter a number', 'a number');
select test.throws($$select set_alert_thresholds('{"coffee_strength": 3}')$$, 'Unknown threshold: coffee_strength',
  'only the thresholds there are');
select test.eq(set_alert_thresholds('{"count_stale_hours": 12}') -> 'count_stale_hours' ->> 'value', '12', 'set to 12 hours');
select test.as_admin();
select test.eq(pg_temp.found('count_stale', null, now() + interval '9 hours'), null, 'and 9 hours is no longer stale');
select test.eq((select pg_temp.said(a) from audit_log a where action = 'business.update' and after_state ? 'alert_settings'),
  '{"alert_settings": {}} → {"alert_settings": {"count_stale_hours": 12}} by owner@example.com',
  'a change of threshold is on the audit trail, as a change to the business');
select test.act_as('owner@example.com');
select test.eq(set_alert_thresholds('{"count_stale_hours": null, "waste_spike_min": ""}') -> 'count_stale_hours' ->> 'value', '8',
  'emptied, it follows the default again');
select test.as_admin();
select test.eq((select alert_settings from business where id = '00000000-0000-0000-0000-0000000000b1'), '{}'::jsonb,
  'and nothing of the café''s own is kept');
select test.act_as('manager@example.com');
select cancel_stock_count(pg_temp.id('count'), 'started by mistake');
select test.as_admin();
select test.eq(pg_temp.found('count_stale', null, now() + interval '9 hours'), null, 'cancelled: nothing to say');

-- ------------------------------------------------------------ running out
-- Stock with a history, dated day by day at noon (Baghdad): milk opened ten
-- days ago with 11,500 ml, and 1,000 ml used each day since.
select test.as_admin();
create or replace function pg_temp.noon(p_days_ago int) returns timestamptz language sql as $$
  select ((test.today() - p_days_ago)::timestamp + time '12:00') at time zone 'Asia/Baghdad'
$$;
create or replace function pg_temp.moves(p_item uuid, p_type movement_type, p_qty numeric, p_cost numeric, p_days int[])
returns void language sql as $$
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason, occurred_at)
  select '00000000-0000-0000-0000-0000000000b1', p_item, (select v from ids where k = 'loc'), p_type, p_qty, p_cost,
         abs(p_qty) * p_cost, 'fixture', pg_temp.noon(d) - case when p_type = 'opening_balance' then interval '3 hours' else interval '0' end
    from unnest(p_days) d
$$;
insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock) values
  ('c0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'A-MILK', 'Alert milk', 'ingredient', 'ml', 'volume', false),
  ('c0000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', 'A-SUGAR', 'Alert sugar', 'ingredient', 'g', 'mass', false),
  ('c0000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', 'A-CREAM', 'Alert cream', 'ingredient', 'ml', 'volume', false),
  ('c0000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b1', 'A-STRAW', 'Alert straws', 'consumable', 'each', 'count', false);
select pg_temp.moves('c0000000-0000-0000-0000-0000000000a1', 'opening_balance', 11500, 2, '{10}');
select pg_temp.moves('c0000000-0000-0000-0000-0000000000a1', 'sale_consumption', -1000, 2, '{1,2,3,4,5,6,7,8,9,10}');
select test.eq(pg_temp.found('running_out', 'c0000000-0000-0000-0000-0000000000a1'),
  'orange low: Alert milk runs out in 1.5 days: 1500 ml left, using about 1000 a day',
  'a day and a half left, under the day a delivery takes plus one: orange, and only ten days to judge by');
select test.eq((select action || ' ' || (facts ->> 'lead_time_days') from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'running_out' and subject = 'c0000000-0000-0000-0000-0000000000a1'),
  'Order about 7000 ml (a week of use). 1', 'order a week of use');
-- Sugar: nearly gone, but with six days of history the rule stays quiet.
select pg_temp.moves('c0000000-0000-0000-0000-0000000000a2', 'opening_balance', 3100, 1, '{6}');
select pg_temp.moves('c0000000-0000-0000-0000-0000000000a2', 'sale_consumption', -500, 1, '{1,2,3,4,5,6}');
select test.eq(pg_temp.found('running_out', 'c0000000-0000-0000-0000-0000000000a2'), null,
  'under 7 days of history there is not enough to judge by');

-- Answered while orange, it asks again once it turns red.
select test.act_as('manager@example.com');
insert into ids select 'milk', id from current_alerts() where rule = 'running_out' and subject = 'c0000000-0000-0000-0000-0000000000a1';
select acknowledge_alert(pg_temp.id('milk'), 'ordered from the dairy');
select test.as_admin();
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason, occurred_at)
values ('00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000a1', pg_temp.id('loc'), 'waste', -1000, 2, 2000,
        'fixture', now() - interval '1 minute');
select test.eq(pg_temp.found('running_out', 'c0000000-0000-0000-0000-0000000000a1'),
  'red low: Alert milk runs out in under a day: 500 ml left, using about 1100 a day',
  'a litre spilt: under a day left, red');
select test.act_as('manager@example.com');
select test.eq((select row(id = pg_temp.id('milk'), urgency, acknowledged_at is null, ack_note is null)::text
                  from current_alerts() where rule = 'running_out' and subject = 'c0000000-0000-0000-0000-0000000000a1'),
  '(t,red,t,t)', 'the same alert, red now, and waiting for an answer again');

-- Below its reorder level: an item never moved is there too; one running out is said once.
select update_item('c0000000-0000-0000-0000-000000000002', 'Golden cup', 'packaging', p_min_level => 150);
select test.as_admin();
update item set min_level_base = 50 where id = 'c0000000-0000-0000-0000-0000000000a4';
update item set min_level_base = 5000 where id = 'c0000000-0000-0000-0000-0000000000a1';
select test.eq(pg_temp.found('below_minimum', 'c0000000-0000-0000-0000-000000000002'),
  'orange high: Golden cup: 100 each on hand, below its reorder level of 150', 'cups below their reorder level');
select test.eq(pg_temp.found('below_minimum', 'c0000000-0000-0000-0000-0000000000a4'),
  'orange high: Alert straws: 0 each on hand, below its reorder level of 50', 'and straws that have never been in stock');
select test.eq(pg_temp.found('below_minimum', 'c0000000-0000-0000-0000-0000000000a1'), null,
  'milk is running out: said once, not twice');

-- The day a delivery comes, running out waits for it to be entered in full.
select test.act_as('manager@example.com');
select receive_goods(pg_temp.id('dairy'), '[{"item_id":"c0000000-0000-0000-0000-0000000000a1","qty":100,"unit_code":"ml","unit_price":2}]');
select test.as_admin();
select test.eq(pg_temp.found('running_out', 'c0000000-0000-0000-0000-0000000000a1'), null, 'milk received today: quiet');
select test.eq(pg_temp.found('below_minimum', 'c0000000-0000-0000-0000-0000000000a1'),
  'orange high: Alert milk: 600 ml on hand, below its reorder level of 5000', 'though still below its reorder level');

-- The days a delivery takes: the item's last supplier's own, or the café's.
insert into goods_receipt (id, business_id, location_id, supplier_id, receipt_no, received_at, note)
values ('e0000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', pg_temp.id('loc'), pg_temp.id('dairy'),
        9001, pg_temp.noon(10) - interval '3 hours', 'fixture');
insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                reference_type, reference_id, reason, occurred_at)
values ('00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000a3', pg_temp.id('loc'), 'purchase_receipt',
        6000, 3, 18000, 'goods_receipt', 'e0000000-0000-0000-0000-0000000000d1', 'fixture', pg_temp.noon(10) - interval '3 hours');
select pg_temp.moves('c0000000-0000-0000-0000-0000000000a3', 'sale_consumption', -500, 3, '{1,2,3,4,5,6,7,8,9,10}');
select test.eq(pg_temp.found('running_out', 'c0000000-0000-0000-0000-0000000000a3'), null,
  'cream: two days left, and a delivery takes a day: enough');
select test.act_as('manager@example.com');
select test.throws(format('select update_supplier(%L, %L, p_lead_time_days => 31)', pg_temp.id('dairy'), 'Sulaymaniyah Dairy Co.'),
  'A delivery takes 0 to 30 days', 'a delivery time in days, within a month');
select update_supplier(pg_temp.id('dairy'), name, contact, phone, true, 'they deliver weekly now', 5)
  from supplier where id = pg_temp.id('dairy');
select test.as_admin();
select test.eq(pg_temp.found('running_out', 'c0000000-0000-0000-0000-0000000000a3'),
  'orange low: Alert cream runs out in 2 days: 1000 ml left, using about 500 a day',
  'the dairy takes five days: two days of cream is not enough');
select test.eq((select pg_temp.said(a) from audit_log a where action = 'supplier.update' order by id desc limit 1),
  '{"lead_time_days": null} → {"lead_time_days": 5} by manager@example.com (they deliver weekly now)',
  'the supplier''s delivery time is on the audit trail');

-- --------------------------------------------- a delivery price confirmed
select test.act_as('manager@example.com');
select test.throws(format('select receive_goods(%L, %L)', pg_temp.id('dairy'),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":1,"unit_code":"sleeve_50","unit_price":12500}]'),
  'Check the price: Golden cup at 250 each is 400% above its cost now (50 each)%', 'a price far from the cost is checked (0027)');
select receive_goods(pg_temp.id('dairy'),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":1,"unit_code":"sleeve_50","unit_price":12500}]', p_confirm => true);
select test.as_admin();
select test.eq(pg_temp.found('price_confirmed'),
  'orange high: Golden cup at 250 each is 400% above its cost now (50 each) — confirmed by Demo Manager',
  'confirmed, it is still worth a second look against the invoice');
select test.eq(pg_temp.found('price_confirmed', null, now() + interval '8 days'), null, 'for a week');
select test.eq(pg_temp.found('below_minimum', 'c0000000-0000-0000-0000-000000000002'), null,
  'and 150 cups are no longer below the reorder level');

-- ---------------------------------------- the menu: recipes, costs, margins
-- A product sold with no recipe: named once, whatever channels it is sold on.
select test.as_admin();
insert into product (id, business_id, name) values ('d0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Alert tea');
insert into product_variant (id, product_id, name) values ('d1000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000a1', 'Alert tea');
insert into channel_price (business_id, product_variant_id, channel, price, effective_from) values
  ('00000000-0000-0000-0000-0000000000b1', 'd1000000-0000-0000-0000-0000000000a1', 'dine_in', 1500, '2020-01-01'),
  ('00000000-0000-0000-0000-0000000000b1', 'd1000000-0000-0000-0000-0000000000a1', 'takeaway', 1500, '2020-01-01');
select test.eq(pg_temp.found('no_recipe'), 'orange high: Alert tea is sold with no recipe: its sales are costed at nothing',
  'a product with no recipe is costed at nothing: said once for both its channels');
select test.act_as('owner@example.com');
select set_no_stock('d1000000-0000-0000-0000-0000000000a1', 'tea bags are counted as supplies');
select test.as_admin();
select test.eq(pg_temp.found('no_recipe'), null, 'once it says why it uses no stock, there is nothing to say');

-- An ingredient with no cost yet, named once with the products that use it.
insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock) values
  ('c0000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b1', 'A-VAN', 'Alert vanilla', 'ingredient', 'g', 'mass', false);
select test.act_as('owner@example.com');
select create_product('Alert vanilla latte', '{"dine_in": 4000}',
  '[{"item_id":"c0000000-0000-0000-0000-0000000000a5","qty":5,"unit_code":"g"},
    {"item_id":"c0000000-0000-0000-0000-000000000001","qty":20,"unit_code":"g"}]');
select test.as_admin();
select test.eq(pg_temp.found('no_cost', 'c0000000-0000-0000-0000-0000000000a5'),
  'orange high: Alert vanilla has no cost yet, and 1 product uses it: Alert vanilla latte', 'an ingredient with no cost');
select test.eq(pg_temp.found('margin'), null, 'the latte''s margin waits for every ingredient''s cost');
select test.act_as('owner@example.com');
select create_product(n, '{"dine_in": 4000}', '[{"item_id":"c0000000-0000-0000-0000-0000000000a5","qty":5,"unit_code":"g"}]')
  from unnest(array['Alert vanilla shake', 'Alert vanilla cone', 'Alert vanilla cup', 'Alert vanilla float']) n;
select test.as_admin();
select test.eq(pg_temp.found('no_cost', 'c0000000-0000-0000-0000-0000000000a5'),
  'orange high: Alert vanilla has no cost yet, and 5 products use it: Alert vanilla cone, Alert vanilla cup, '
  'Alert vanilla float, Alert vanilla latte and 1 more', 'one alert for the vanilla, not five');
select test.eq((select action from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                 where rule = 'no_cost' and subject = 'c0000000-0000-0000-0000-0000000000a5'),
  'Receive it with its cost, or give it its opening stock, on Inventory.', 'and what to do');
select test.act_as('owner@example.com');
select record_opening_stock('c0000000-0000-0000-0000-0000000000a5', 100, 'g', 30, 'the opening count');
select test.as_admin();
select test.eq(pg_temp.found('no_cost', 'c0000000-0000-0000-0000-0000000000a5'), null, 'given its cost, the vanilla is fine');

-- Margins: below cost is red; under the target, orange; per channel.
select test.act_as('owner@example.com');
select create_product('Alert cheap latte', '{"dine_in": 150}', '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":20,"unit_code":"g"}]');
select create_product('Alert thin latte', '{"dine_in": 500, "takeaway": 600}',
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":20,"unit_code":"g"}]');
select test.as_admin();
select test.eq(pg_temp.found('margin'),
  'red high: Alert cheap latte (Dine-in): sold below cost at 150 IQD, costing 200 | '
  'orange high: Alert thin latte (Dine-in): 60% margin at 500 IQD, costing 200 | '
  'orange high: Alert thin latte (Takeaway): 67% margin at 600 IQD, costing 200',
  'sold below cost: red; 60% and 67%, under the 70% target: orange; the golden espresso at 92% is fine');
select test.act_as('owner@example.com');
select set_alert_thresholds('{"margin_target_percent": 55}');
select test.as_admin();
select test.eq(pg_temp.found('margin'), 'red high: Alert cheap latte (Dine-in): sold below cost at 150 IQD, costing 200',
  'with a 55% target, only the one sold below cost');
select test.act_as('owner@example.com');
select set_alert_thresholds('{"margin_target_percent": null}');

-- A cost from the last delivery, for an item with none on hand, is less sure.
select test.as_admin();
insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock) values
  ('c0000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000b1', 'A-SYRUP', 'Alert syrup', 'ingredient', 'ml', 'volume', false);
select pg_temp.moves('c0000000-0000-0000-0000-0000000000a6', 'opening_balance', 100, 5, '{3}');
select pg_temp.moves('c0000000-0000-0000-0000-0000000000a6', 'sale_consumption', -100, 5, '{2}');
select test.act_as('owner@example.com');
select create_product('Alert syrup soda', '{"dine_in": 300}', '[{"item_id":"c0000000-0000-0000-0000-0000000000a6","qty":50,"unit_code":"ml"}]');
select test.as_admin();
select test.eq(pg_temp.found('margin', (select pv.id || ':dine_in' from product_variant pv join product p on p.id = pv.product_id
                                         where p.name = 'Alert syrup soda')),
  'orange medium: Alert syrup soda (Dine-in): 17% margin at 300 IQD, costing 250',
  'none on hand: costed at the last delivery''s price, so less sure');

-- A price that looks typed wrongly.
select test.act_as('owner@example.com');
insert into s select 'aw', create_product('Alert water', '{"dine_in": 5000, "takeaway": 500}', p_no_stock_reason => 'a test');
select test.as_admin();
select test.eq(pg_temp.found('price_typo'), 'orange medium: Alert water is 5,000 IQD on Dine-in but 500 on Takeaway',
  'ten times another channel''s price: a zero too many, or too few');
select test.act_as('owner@example.com');
select set_price((pg_temp.r('aw') ->> 'variant_id')::uuid, 'takeaway', 5000);
select test.as_admin();
select test.eq(pg_temp.found('price_typo'), null, 'corrected: nothing to say');

-- ------------------------------------------------------------ waste spike
select test.as_admin();
create or replace function pg_temp.waste(p_amount numeric, p_days_ago int) returns uuid language sql as $$
  select post_journal('00000000-0000-0000-0000-0000000000b1', pg_temp.noon(p_days_ago), 'Waste (fixture)', 'manual', null,
    jsonb_build_array(jsonb_build_object('code', '5300', 'debit', p_amount), jsonb_build_object('code', '1200', 'credit', p_amount)))
$$;
select test.eq(pg_temp.found('waste_spike'), null, 'with a day of history there is no usual week to compare with');
-- Twenty days of books: 6,000 wasted in the thirteen days before the last seven, about 3,231 a week.
select pg_temp.waste(3000, 20);
select pg_temp.waste(3000, 10);
select pg_temp.waste(4000, 1);
select test.eq(pg_temp.found('waste_spike'), null,
  '5,000 this week (with today''s beans) is over one and a half usual weeks, but under 20,000: not worth an alert');
select pg_temp.waste(20000, 2);
select test.eq(pg_temp.found('waste_spike'), 'orange low: Waste of 25,000 IQD in the last 7 days, against about 3,231 in a usual week',
  '25,000: an alert, though with under four weeks to compare with, a less sure one');

-- ------------------------------------------------ exceptions by one person
select test.as_admin();
select test.eq(pg_temp.found('exceptions_person'), null,
  'a void, a refund and a discount this week: nobody stands out (the manager voided and refunded the cashier''s sales, '
  'and sells nothing themselves)');
select test.act_as('manager@example.com');
insert into s select 'm' || n, record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.espressos(1)) from generate_series(1, 4) n;
select void_sale(pg_temp.order_of('m4'), null, 'rang_wrong_item');
select test.as_admin();
select test.eq(pg_temp.found('exceptions_person'),
  'orange medium: Demo Manager: 3 void(s), refund(s), discount(s) or cancelled bill(s) in 7 days, 5,900 IQD (59% of their sales)',
  'the manager''s voids and refunds, 59% of their own sales: worth a look, evidence and not an accusation');
select test.act_as('manager@example.com');
insert into ids select 'mine', id from current_alerts() where rule = 'exceptions_person';
select test.throws(format('select acknowledge_alert(%L, %L)', pg_temp.id('mine'), 'all were mistakes'),
  'An alert about your own exceptions is for someone else to review', 'nobody answers an alert about themselves');
select test.throws(format('select snooze_alert(%L, %L, %L)', pg_temp.id('mine'), test.today() + 7, 'a busy week'),
  'An alert about your own exceptions is for someone else to review', 'or puts it off');
select test.act_as('owner@example.com');
select acknowledge_alert(pg_temp.id('mine'), 'Went through them with the manager: all rang twice');
select set_alert_thresholds('{"exceptions_share_percent": 60}');
select test.as_admin();
select test.eq(pg_temp.found('exceptions_person'), null, 'with 60% allowed, and three under the ten a week, nothing to say');
select test.act_as('owner@example.com');
select set_alert_thresholds('{"exceptions_share_percent": null}');

-- ---------------------------------------- card and platform money not in
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'dine_in', 'card', pg_temp.espressos(1));
select record_sale(gen_random_uuid(), 'talabat', 'platform_paid', pg_temp.espressos(1));
select test.as_admin();
select test.eq(pg_temp.found('card_not_banked'), null, 'today''s card takings are not due at the bank yet');
select test.eq(pg_temp.found('card_not_banked', null, now() + interval '4 days'),
  'orange high: 2,500 IQD of card money is more than 3 days old and not yet recorded as settled',
  'four days on, still not settled: orange');
select test.eq(pg_temp.found('platform_not_received', null, now() + interval '4 days'), null,
  'a delivery platform pays on a longer cycle');
select test.eq(pg_temp.found('platform_not_received', null, now() + interval '8 days'),
  'orange medium: 3,000 IQD of delivery-platform money is more than 7 days old and not yet received',
  'past it, orange — less sure until sales carry the platform''s order number');
select test.act_as('owner@example.com');
select save_journal(test.today(), 'Card settlement',
  '[{"code":"1020","debit":2450},{"code":"6900","debit":50},{"code":"1010","credit":2500}]', true);
select test.as_admin();
select test.eq(pg_temp.found('card_not_banked', null, now() + interval '4 days'), null, 'settled: nothing to say');

-- ------------------------------------------------------------ bills due
select test.act_as('manager@example.com');
select record_bill(pg_temp.id('dairy'), 'SD-501', test.today(), 20000, 2, null, '6200');
select record_bill(pg_temp.id('dairy'), 'SD-502', test.today(), 8000, 10, null, '6200');
select test.as_admin();
select test.eq(pg_temp.found('bill_due'), format('orange high: Sulaymaniyah Dairy Co.: 20,000 IQD due on %s', pg_temp.day(2)),
  'due in two days: orange; the bill due in ten, not yet');
select test.eq(pg_temp.found('bill_due', null, now() + interval '2 days'),
  'orange high: Sulaymaniyah Dairy Co.: 20,000 IQD due today', 'due today');
select test.eq(pg_temp.found('bill_due', null, now() + interval '3 days'),
  'orange high: Sulaymaniyah Dairy Co.: 20,000 IQD overdue by 1 day(s)', 'then overdue');
select test.act_as('owner@example.com');
select pay_bill((select id from purchase_invoice where invoice_no = 'SD-501'), 20000, 'owner');
select test.as_admin();
select test.eq(pg_temp.found('bill_due', null, now() + interval '3 days'), null, 'paid: nothing to say');

-- ------------------------------------------------ a payment recorded twice
select test.act_as('manager@example.com');
insert into s select 'x1', record_expense('Generator repair', 15000, '6900', 'owner');
insert into s select 'x2', record_expense('Generator repair', 15000, '6900', 'owner');
select test.as_admin();
select test.eq(pg_temp.found('duplicate_payment'),
  format('orange medium: Possible duplicate: Other expenses 15,000 IQD in journal %s (%s) and journal %s (%s)',
         pg_temp.r('x1') ->> 'journal_no', pg_temp.day(), pg_temp.r('x2') ->> 'journal_no', pg_temp.day()),
  'the same amount to the same account twice in three days: worth confirming');
select test.act_as('owner@example.com');
select reverse_journal((select id from journal_entry where journal_no = (pg_temp.r('x2') ->> 'journal_no')::bigint
                          and business_id = '00000000-0000-0000-0000-0000000000b1'), 'entered twice');
select test.as_admin();
select test.eq(pg_temp.found('duplicate_payment'), null, 'one reversed: nothing to say');

-- ---------------------------------------------------- and all of them, once
select test.act_as('owner@example.com');
create temp table ca as select rule, subject, urgency from current_alerts();
select test.as_admin();
select test.eq((select count(*) from ca)::int, (select count(*) from alert_conditions('00000000-0000-0000-0000-0000000000b1', now()))::int,
  'the dashboard lists every condition the rules find, once each');
select test.eq((select count(*) from (select rule, subject from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
                                      except select rule, subject from ca) x)::int, 0, 'and nothing else');
select test.eq((select count(*) from alert where resolved_at is null)::int, (select count(*) from ca)::int,
  'every other alert has resolved itself');
