-- =============================================================================
-- Selling without internet (0073, round fifteen): a quick sale the till made
-- offline, sent once the connection is back, with when it was sold and by
-- whom. Recorded once whatever happens; at its own time the same day, and on
-- the day it is sent otherwise; never refused by an item's rule on stock, the
-- money being taken already. Espresso: 2,500 dine-in (20 g of beans at 10);
-- water: 1,000, a bottle bought in at 250. The fixtures opened the drawer.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.sale(p text) returns uuid language sql as $$
  select (v ->> 'order_id')::uuid from res where k = p
$$;
create function pg_temp.lines(p jsonb) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('variant_id', case x.key when 'E' then 'd1000000-0000-0000-0000-000000000001'
                                                    else 'd1000000-0000-0000-0000-000000000002' end,
                                      'qty', x.value) order by x.key)
    from jsonb_each(p) x
$$;
create function pg_temp.o(p text) returns sales_order language sql security definer as $$
  select * from sales_order where id = (select (v ->> 'order_id')::uuid from res where k = p)
$$;
create function pg_temp.journal_at(p text) returns timestamptz language sql security definer as $$
  select occurred_at from journal_entry
   where reference_id = (select (v ->> 'order_id')::uuid from res where k = p) and reverses_entry is null
$$;
create function pg_temp.drawer(p text) returns text language sql security definer as $$
  select string_agg(kind || ' ' || trim_scale(amount), ', ' order by created_at, kind)
    from cash_event where reference_id = (select (v ->> 'order_id')::uuid from res where k = p)
$$;
create function pg_temp.orders() returns bigint language sql security definer as $$
  select count(*) from sales_order
$$;
create function pg_temp.member(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
-- Earlier today, in the café's own day: half an hour ago, or just after
-- midnight when it is not yet half past.
create function pg_temp.earlier() returns timestamptz language sql stable security definer as $$
  select greatest(now() - interval '30 minutes',
                  (test.today()::timestamp + interval '1 minute') at time zone
                    (select timezone from business where id = '00000000-0000-0000-0000-0000000000b1'))
$$;
create temp table t0 as select pg_temp.earlier() as at;
grant select on t0 to public;

-- ------------------------------------------------------------ sold earlier today, by the cashier
select test.act_as('manager@example.com');
insert into res select 'A', record_offline_sale('73000000-0000-0000-0000-00000000000a', 'dine_in',
  pg_temp.lines('{"E": 2, "W": 1}'), (select at from t0),
  p_tenders => '[{"type": "cash", "amount": 6000, "received": 10000}]', p_expected_net => 6000,
  p_sold_by => pg_temp.member('cashier@example.com'), p_device => 'till-1');
select test.eq((pg_temp.r('A') ->> 'net') || ' ' || (pg_temp.r('A') ->> 'replayed'), '6000 false',
  'a sale made offline is recorded at what the customer was shown');
select test.eq((pg_temp.o('A')).placed_at, (select at from t0), 'it keeps the time it was sold, the same day');
select test.eq(pg_temp.journal_at('A'), (select at from t0), 'and so does its journal');
select test.eq((pg_temp.o('A')).sold_offline_at, (select at from t0), 'it is marked as sold offline, with when');
select test.eq((pg_temp.o('A')).cashier_id, pg_temp.member('cashier@example.com'),
  'it is the sale of who was signed in on the till then, not of who sent it');
select test.eq((pg_temp.o('A')).device_id, 'till-1', 'and of the till it was made on');
select test.eq(test.lines_of(pg_temp.sale('A')), '1000 Dr 6000 | 1200 Cr 650 | 4000 Cr 6000 | 5000 Dr 650',
  'its books as any sale''s: the cash, the revenue and what it cost');
select test.eq(pg_temp.drawer('A'), 'sale 6000', 'the drawer takes its cash');
select test.as_admin();
select test.eq((select (after_state ->> 'sent_by')::uuid from audit_log
                 where action = 'sale.offline' and entity_id = pg_temp.sale('A')::text),
  pg_temp.member('manager@example.com'), 'the audit trail keeps who sent it');

-- ------------------------------------------------------------ sent again: recorded once
create temp table n_before as select pg_temp.orders() as n;
grant select on n_before to public;
select test.act_as('cashier@example.com');
insert into res select 'A2', record_offline_sale('73000000-0000-0000-0000-00000000000a', 'dine_in',
  pg_temp.lines('{"E": 2, "W": 1}'), (select at from t0),
  p_tenders => '[{"type": "cash", "amount": 6000, "received": 10000}]', p_expected_net => 6000);
select test.eq((pg_temp.r('A2') ->> 'replayed') || ' ' || (pg_temp.r('A2') ->> 'order_id'),
  'true ' || pg_temp.sale('A')::text, 'sent again, it is the sale already recorded');
select test.eq(pg_temp.orders(), (select n from n_before), 'and nothing is recorded twice');
-- Sent first by the till's ordinary way, then again as an offline sale: one sale.
insert into res select 'B', record_sale('73000000-0000-0000-0000-00000000000b', 'dine_in', 'card',
  pg_temp.lines('{"W": 1}'), p_expected_net => 1000);
insert into res select 'B2', record_offline_sale('73000000-0000-0000-0000-00000000000b', 'dine_in',
  pg_temp.lines('{"W": 1}'), now(), p_tender => 'card', p_expected_net => 1000);
select test.eq(pg_temp.r('B2') ->> 'order_id', pg_temp.r('B') ->> 'order_id',
  'a sale whose answer was lost and is sent again as offline is the one sale');

-- ------------------------------------------------------------ sent on a later day
insert into res select 'C', record_offline_sale('73000000-0000-0000-0000-00000000000c', 'takeaway',
  pg_temp.lines('{"E": 1}'), now() - interval '1 day 2 hours', p_tender => 'card', p_expected_net => 2500);
select test.ok((pg_temp.o('C')).placed_at >= now() - interval '1 minute',
  'sent on a later day, it is the sale of the day it is sent');
select test.ok(pg_temp.journal_at('C') >= now() - interval '1 minute', 'and so is its journal: the books agree');
select test.ok((pg_temp.o('C')).sold_offline_at < now() - interval '1 day',
  'when it was really sold is kept on it');
select test.eq((pg_temp.o('C')).cashier_id, pg_temp.member('cashier@example.com'),
  'with nobody named, it is the sale of who sent it');

-- ------------------------------------------------------------ an item's rule does not refuse it
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-000000000003', '"block"', 'Count the water');
select test.act_as('cashier@example.com');
insert into res select 'D', record_offline_sale('73000000-0000-0000-0000-00000000000d', 'dine_in',
  pg_temp.lines('{"W": 30}'), pg_temp.earlier(), p_tender => 'card', p_expected_net => 30000);
select test.eq(pg_temp.r('D') ->> 'net', '30000',
  'thirty bottles where the books held fewer: sold, the money being taken already');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card', pg_temp.lines('{"W": 1}'))$$,
  'Only 0 each of Golden water is in stock%', 'the rule still refuses a sale made online');
select test.as_admin();
select test.eq((select reason || ': ' || (after_state ->> 'items') from audit_log
                 where action = 'stock.below_zero' and entity_id = pg_temp.sale('D')::text),
  'Sold offline: Golden water ×30 each', 'the audit trail says it was sold offline below the books');

-- ------------------------------------------------------------ refused
select test.as_admin();
truncate n_before; insert into n_before select pg_temp.orders();
select test.act_as('cashier@example.com');
select test.throws($$select record_offline_sale(gen_random_uuid(), 'dine_in', pg_temp.lines('{"E": 1}'),
  now(), p_tender => 'card', p_expected_net => 2000)$$,
  '%2500%', 'a price changed since the till showed it: refused, as online');
select test.throws($$select record_offline_sale(gen_random_uuid(), 'dine_in', pg_temp.lines('{"E": 1}'),
  now() + interval '1 hour', p_tender => 'card')$$,
  'This sale is dated later than now: check the till''s clock', 'a time to come is refused');
select test.throws($$select record_offline_sale(gen_random_uuid(), 'dine_in', pg_temp.lines('{"E": 1}'),
  now() - interval '8 days', p_tender => 'card')$$,
  'This sale was made more than a week ago: a manager records it by hand', 'a sale older than a week is refused');
select test.throws($$select record_offline_sale(gen_random_uuid(), 'dine_in', pg_temp.lines('{"E": 1}'),
  null, p_tender => 'card')$$, 'Say when the sale was made', 'a sale needs its time');
select test.throws($$select record_offline_sale(gen_random_uuid(), 'dine_in', pg_temp.lines('{"E": 1}'), now(),
  p_tenders => '[{"type": "cash", "amount": 2500, "currency": "USD", "usd": 2, "rate": 1500, "received": 3000}]')$$,
  'A sale paid in dollars is not taken offline', 'nor one paid in dollars');
select test.throws($$select record_offline_sale(gen_random_uuid(), 'direct_delivery', pg_temp.lines('{"E": 1}'),
  now(), p_tender => 'card')$$, '%needs the customer and their address', 'nor the café''s own delivery');
select test.eq(pg_temp.orders(), (select n from n_before), 'nothing refused is recorded');
select test.act_as_anon();
select test.throws($$select record_offline_sale(gen_random_uuid(), 'dine_in', '[]', now(), p_tender => 'card')$$,
  '%permission denied%', 'the public cannot send one');
