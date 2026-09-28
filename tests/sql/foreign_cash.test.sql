-- =============================================================================
-- US dollars at the till (0043, release R): the rate, set by a manager with a
-- reason and refused once it is older than the café allows; a sale paid in
-- dollars, alone or with dinars or a card, its value rounded to 250 and its
-- change in dinars; a void and a refund; the dollars counted at each close and
-- taken to the safe; exchanged for dinars, with the difference; the report and
-- the books. The fixtures opened the drawer with nothing in it. Espresso:
-- 2,500 dine-in (20 g of beans at 10); water: 1,000, a bottle bought in at 250.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.sale(p text) returns uuid language sql as $$
  select (v ->> 'order_id')::uuid from res where k = p
$$;
-- {"E": 2, "W": 1}: the till's lines for two espressos and a water.
create function pg_temp.lines(p jsonb) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('variant_id', case x.key when 'E' then 'd1000000-0000-0000-0000-000000000001'
                                                    else 'd1000000-0000-0000-0000-000000000002' end,
                                      'qty', x.value) order by x.key)
    from jsonb_each(p) x
$$;
-- A sale paid with $usd, for the part it pays, at the rate shown.
create function pg_temp.usd(p_usd numeric, p_amount numeric, p_rate numeric default 1310) returns jsonb language sql as $$
  select jsonb_build_object('type', 'cash', 'currency', 'USD', 'usd', p_usd, 'rate', p_rate, 'amount', p_amount)
$$;
-- The tests' own view, whoever they act as.
create function pg_temp.paid(p text) returns text language sql security definer as $$
  select string_agg(tender_type || ' ' || trim_scale(amount)
                    || case when currency = 'USD' then ', $' || trim_scale(foreign_amount) || ' at ' || trim_scale(rate)
                                                        || ' = ' || trim_scale(received)
                            else coalesce(' of ' || trim_scale(received), '') end
                    || coalesce(', change ' || trim_scale(change_given), ''),
                    ' + ' order by position)
    from sales_tender where sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p)
$$;
create function pg_temp.drawer(p_ref uuid) returns text language sql security definer as $$
  select string_agg(kind || ' ' || trim_scale(amount), ', ' order by created_at, amount desc)
    from cash_event where reference_id = p_ref
$$;
create function pg_temp.fx(p_ref uuid) returns text language sql security definer as $$
  select string_agg(place || ' ' || kind || ' ' || trim_scale(usd) || ' ' || trim_scale(value), ', '
                    order by created_at, place desc, kind)
    from fx_cash_event where reference_id = p_ref
$$;
create function pg_temp.held(p_place text) returns text language sql security definer as $$
  select '$' || trim_scale(h.usd) || ' at ' || trim_scale(h.value)
    from fx_place_balance('00000000-0000-0000-0000-0000000000b1', p_place,
                          default_location('00000000-0000-0000-0000-0000000000b1')) h
$$;
create function pg_temp.orders() returns bigint language sql security definer as $$
  select count(*) from sales_order
$$;
create function pg_temp.session() returns uuid language sql security definer as $$
  select open_session_at('00000000-0000-0000-0000-0000000000b1', default_location('00000000-0000-0000-0000-0000000000b1'))
$$;
create function pg_temp.uid(p_email text) returns uuid language sql security definer as $$
  select id from app_user where email = p_email
$$;
create function pg_temp.line(p_sale text, p_variant text) returns uuid language sql security definer as $$
  select sl.id from sales_order_line sl
   where sl.sales_order_id = (select (v ->> 'order_id')::uuid from res where k = p_sale)
     and sl.product_variant_id = p_variant::uuid
$$;

-- ------------------------------------------------------------ the accounts and the rules
select test.eq((select string_agg(b.name || ': ' || (select string_agg(a.code || ' ' || a.name, ', ' order by a.code)
                                                        from gl_account a
                                                       where a.business_id = b.id and a.code in ('1001', '1006', '6950')),
                                  ' | ' order by b.name)
                  from business b),
  'Other Café: 1001 Cash in the till — USD, 1006 Cash in the safe — USD, 6950 Exchange differences | '
  || 'The Sixty''s Gelato & Café: 1001 Cash in the till — USD, 1006 Cash in the safe — USD, 6950 Exchange differences',
  'every café has the dollars'' accounts and exchange differences');
select test.eq((select string_agg(k || '=' || (rule_value('00000000-0000-0000-0000-0000000000b1', k) #>> '{}'), ', ' order by k)
                  from unnest(array['usd_rate_max_age_hours', 'usd_round_to']) k),
  'usd_rate_max_age_hours=36, usd_round_to=250', 'a rate lasts 36 hours; dollars are counted in dinars to the nearest 250');

-- ------------------------------------------------------------ dinars in the drawer first
select test.act_as('cashier@example.com');
insert into res select 'S0', record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.lines('{"E": 8}'));

-- ------------------------------------------------------------ no rate, an old rate
select test.eq((select (s ->> 'rate') is null and not (s ->> 'usable')::boolean and not (s ->> 'may_set')::boolean
                  from fx_status() s), true, 'no rate yet: dollars cannot be taken, and a cashier does not set one');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500)))$$,
  'No dollar rate is set: a manager sets today''s on Sales → Dollars', 'no dollars without a rate');
select test.throws($$select set_fx_rate('USD', 1310, 'Market')$$, '%permission%', 'a cashier does not set the rate');
select test.as_admin();
insert into fx_rate (business_id, currency, rate, effective_from, set_by, reason)
select '00000000-0000-0000-0000-0000000000b1', 'USD', 1300, now() - interval '40 hours', id, 'Market two days ago'
  from app_user where email = 'manager@example.com';
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500, 1300)))$$,
  'The dollar rate was set 40 hours ago: a manager sets today''s before dollars are taken',
  'a rate older than 36 hours is not used');
select test.eq((select (s ->> 'rate') || ' ' || (s ->> 'usable') || ' ' || (s ->> 'age_hours') from fx_status() s),
  '1300 false 40', 'the till is told the rate is too old');

-- ------------------------------------------------------------ the manager sets today's
select test.act_as('manager@example.com');
select test.throws($$select set_fx_rate('EUR', 1500, 'Market')$$, 'Only the dollar''s rate is kept', 'dollars only');
select test.throws($$select set_fx_rate('USD', 99, 'Market')$$, 'A dollar is a whole number of dinars, from 100 to 100,000',
  'a rate in range');
select test.throws($$select set_fx_rate('USD', 1310.5, 'Market')$$,
  'A dollar is a whole number of dinars, from 100 to 100,000', 'in whole dinars');
select test.throws($$select set_fx_rate('USD', 1310, '  ')$$, 'Say where the rate comes from', 'with where it comes from');
insert into res select 'rate', set_fx_rate('USD', 1310, 'Market rate this morning',
                                           '53000000-0000-0000-0000-000000000001');
insert into res select 'rate again', set_fx_rate('USD', 1310, 'Market rate this morning',
                                                 '53000000-0000-0000-0000-000000000001');
select test.eq((pg_temp.r('rate') ->> 'rate') || ' was ' || (pg_temp.r('rate') ->> 'was') || ' | '
               || (pg_temp.r('rate again') ->> 'replayed'), '1310 was 1300 | true',
  'the rate is set, and sent again with its key, set once');
select test.eq((select count(*) from fx_rate)::int, 2, 'two rates: the old and today''s');
select test.act_as('cashier@example.com');
select test.eq((select (s ->> 'rate') || ' ' || (s ->> 'usable') || ' by ' || (s ->> 'set_by') || ': ' || (s ->> 'reason')
                       || ' | nearest ' || (s ->> 'round_to') || ', ' || (s ->> 'max_age_hours') || ' hours | '
                       || jsonb_array_length(s -> 'history') || ' rates | may set ' || (s ->> 'may_set')
                  from fx_status() s),
  '1310 true by Demo Manager: Market rate this morning | nearest 250, 36 hours | 2 rates | may set false',
  'the till reads today''s rate, who set it and why');
select test.as_admin();
select test.eq((select (before_state ->> 'rate') || ' → ' || (after_state ->> 'rate') || ': ' || reason
                  from audit_log where action = 'fx.rate.set'), '1300 → 1310: Market rate this morning',
  'the rate is on the audit trail, with the one before');
select test.throws($$update fx_rate set rate = 1400$$, '%append-only%', 'a rate once set is never changed');

-- ------------------------------------------------------------ a sale in dollars
select test.act_as('cashier@example.com');
insert into res select 'U1', record_sale('53000000-0000-0000-0000-0000000000a1', 'dine_in', null,
  pg_temp.lines('{"E": 1}'), p_expected_net => 2500, p_tenders => jsonb_build_array(pg_temp.usd(5, 2500)));
select test.eq((select string_agg((x ->> 'type') || ' ' || (x ->> 'amount') || ', $' || (x ->> 'usd') || ' at '
                                  || (x ->> 'rate') || ' = ' || (x ->> 'received') || ', change ' || (x ->> 'change'),
                                  '; ')
                  from jsonb_array_elements(pg_temp.r('U1') -> 'payments') x),
  'cash 2500, $5 at 1310 = 6500, change 4000',
  '$5 at 1,310 are 6,550, counted as 6,500 (to the nearest 250): 4,000 change in dinars');
select test.eq(test.lines_of(pg_temp.sale('U1')),
  '1000 Cr 4000 | 1001 Dr 6500 | 1200 Cr 200 | 4000 Cr 2500 | 5000 Dr 200',
  'the dollars go to 1001 at their value; the change leaves the till''s dinars');
select test.eq(pg_temp.drawer(pg_temp.sale('U1')) || ' | ' || pg_temp.fx(pg_temp.sale('U1')),
  'sale -4000 | till sale 5 6500', 'the drawer gives the change; the till''s dollars take the $5');

-- ------------------------------------------------------------ refused, nothing recorded
create temp table n_before as select pg_temp.orders() as n;
grant select on n_before to public;
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500, 1300)))$$,
  'The dollar rate is now 1310, not the 1300 shown: take the payment again', 'a rate that changed while paying');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(1, 2500)))$$,
  '$1 come to 1250, less than the 2500 they pay', 'dollars worth less than their part');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500) || '{"type": "card"}'))$$,
  'Dollars are taken in cash only', 'dollars are cash');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5.5, 2500)))$$,
  'Dollars are taken in whole dollars', 'in whole notes');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(0, 2500)))$$,
  'Dollars are taken in whole dollars', 'more than none');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500) || '{"received": 6500}'))$$,
  'The payments cannot be read', 'their value is the database''s to work out');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500) - 'rate'))$$,
  'The payments cannot be read', 'at the rate the till showed');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500) || '{"currency": "EUR"}'))$$,
  'Payments are taken in dinars or dollars', 'no other currency');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500) - 'currency'))$$,
  'The payments cannot be read', 'dollars say so');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(100, 2500)))$$,
  'The drawer does not hold the 128500 change in dinars: take the payment in dinars, or put cash in the till first',
  'no more change than the drawer holds');
select test.throws($$select record_sale(gen_random_uuid(), 'talabat', null, pg_temp.lines('{"E": 1}'),
  p_platform_order_no => 'T-9', p_tenders => jsonb_build_array(pg_temp.usd(5, 3000)))$$,
  'Delivery-platform orders are platform-paid, and only they are', 'a platform''s order is not paid in dollars');
select test.eq(pg_temp.orders(), (select n from n_before), 'none of them recorded anything');

-- ------------------------------------------------------------ with a card, with dinars
insert into res select 'U2', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2}'),
  p_tenders => jsonb_build_array(pg_temp.usd(2, 2500), '{"type": "card", "amount": 2500}'::jsonb));
select test.eq(pg_temp.paid('U2') || ' | ' || test.lines_of(pg_temp.sale('U2')) || ' | '
               || coalesce(pg_temp.drawer(pg_temp.sale('U2')), 'no dinars') || ' | ' || pg_temp.fx(pg_temp.sale('U2')),
  'cash 2500, $2 at 1310 = 2500, change 0 + card 2500 | 1001 Dr 2500 | 1010 Dr 2500 | 1200 Cr 400 | 4000 Cr 5000 | 5000 Dr 400 | no dinars | till sale 2 2500',
  '$2 (2,620, counted 2,500) and a card: no change, the drawer''s dinars untouched');
insert into res select 'U3', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 2, "W": 1}'),
  p_tenders => jsonb_build_array('{"type": "cash", "amount": 1000, "received": 1000}'::jsonb, pg_temp.usd(5, 5000)));
select test.eq(pg_temp.paid('U3') || ' | ' || test.lines_of(pg_temp.sale('U3')) || ' | ' || pg_temp.drawer(pg_temp.sale('U3')),
  'cash 1000 of 1000, change 0 + cash 5000, $5 at 1310 = 6500, change 1500 | 1000 Cr 500 | 1001 Dr 6500 | 1200 Cr 650 | 4000 Cr 6000 | 5000 Dr 650 | sale 1000, sale -1500',
  'dinars and dollars: 1000 in, 1500 change out of the drawer, the till''s cash account netted');
insert into res select 'U1 again', record_sale('53000000-0000-0000-0000-0000000000a1', 'dine_in', 'card',
  pg_temp.lines('{"E": 1}'));
select test.eq((pg_temp.r('U1 again') ->> 'replayed') || ' ' || (pg_temp.r('U1 again') -> 'payments' -> 0 ->> 'currency')
               || ' $' || (pg_temp.r('U1 again') -> 'payments' -> 0 ->> 'usd'),
  'true USD $5', 'sent again with its key: the sale as recorded, paid in dollars');

-- ------------------------------------------------------------ a void gives the dollars back
insert into res select 'V1', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(10, 2500)));
select test.eq(pg_temp.paid('V1'), 'cash 2500, $10 at 1310 = 13000, change 10500', '$10 are 13,100, counted 13,000');
select test.act_as('manager@example.com');
select void_sale(pg_temp.sale('V1'), 'Rang twice', 'rang_twice');
select test.as_admin();
select test.eq((select pg_temp.drawer(a.id) || ' | ' || pg_temp.fx(a.id) from sale_adjustment a
                 where a.sales_order_id = pg_temp.sale('V1') and a.kind = 'void'),
  'void 10500 | till void -10 -13000', 'a void takes back the change and gives back the dollars');
select test.eq(pg_temp.held('till'), '$12 at 15500', 'the till holds the dollars of the sales left');

-- Dollars exchanged out of the till: a sale whose dollars are gone is refunded, not voided.
select test.act_as('cashier@example.com');
insert into res select 'V2', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500)));
select test.act_as('manager@example.com');
insert into res select 'X0', exchange_dollars('till', 15, 19500, 'till', 'Change from the exchange office');
select test.eq((pg_temp.r('X0') ->> 'value') || ' → ' || (pg_temp.r('X0') ->> 'received') || ', '
               || (pg_temp.r('X0') ->> 'difference') || ' | ' || test.lines_of((pg_temp.r('X0') ->> 'exchange_id')::uuid)
               || ' | ' || pg_temp.drawer((pg_temp.r('X0') ->> 'exchange_id')::uuid),
  '19412 → 19500, 88 | 1000 Dr 19500 | 1001 Cr 19412 | 6950 Cr 88 | cash_in 19500',
  '$15 of the till''s $17 leave at their share of 22,000; the dinars into the drawer; the gain to 6950');
select test.throws(format('select void_sale(%L, %L, %L)', pg_temp.sale('V2'), 'Rang twice', 'rang_twice'),
  'The till no longer holds the $5 this sale was paid with: refund it instead', 'a void needs its dollars');

-- ------------------------------------------------------------ a refund gives back dinars
insert into res select 'R1', refund_sale_lines(pg_temp.sale('U3'),
  jsonb_build_array(jsonb_build_object('line_id', pg_temp.line('U3', 'd1000000-0000-0000-0000-000000000002'), 'qty', 1)),
  'changed_mind');
select test.eq(test.lines_of((pg_temp.r('R1') ->> 'refund_id')::uuid) || ' | '
               || pg_temp.drawer((pg_temp.r('R1') ->> 'refund_id')::uuid),
  '1000 Cr 1000 | 1200 Dr 250 | 4200 Dr 1000 | 5000 Cr 250 | refund -1000',
  'a sale paid partly in dollars is refunded in dinars, from the drawer');

-- ------------------------------------------------------------ the close counts the dollars
select test.act_as('cashier@example.com');
select test.eq((select (s -> 'dollars' ->> 'in_till') || ' ' || coalesce(s -> 'dollars' ->> 'usd', 'hidden')
                  from cash_session_status() s), 'true hidden',
  'the cashier is told the till holds dollars, not how many');
select test.act_as('owner@example.com');
select test.eq((select (s -> 'dollars' ->> 'usd') || ' at ' || (s -> 'dollars' ->> 'value') || ' | ' || (s ->> 'expected')
                  from cash_session_status() s), '2 at 2588 | 30000', 'the owner sees what it should hold');
select test.act_as('cashier@example.com');
select test.throws($$select close_cash_session(30000, p_usd_counted => 1.5)$$,
  'Enter the dollars you counted, in whole dollars', 'dollars are counted in whole dollars');
select test.throws($$select close_cash_session(30000, p_usd_counted => -1)$$,
  'Enter the dollars you counted, in whole dollars', 'none or more');
select test.throws($$select close_cash_session(30000, p_usd_counted => 2, p_usd_denominations => '{"1": 3}')$$,
  'The dollar notes counted come to $3, not the $2 entered', 'the notes add up to the count');
select test.throws($$select close_cash_session(30000, p_usd_counted => 2, p_usd_denominations => '{"one": 2}')$$,
  'The dollar notes counted cannot be read', 'notes by their value');
select test.throws($$select close_cash_session(29000, p_left_in_drawer => 1000, p_usd_counted => 1.5)$$,
  'Say where the rest of the cash goes: the safe or the bank', 'the dinars are checked first');
create temp table s1 as select pg_temp.session() as id;
grant select on s1 to public;
insert into res select 'C1', close_cash_session(30000, p_usd_counted => 1, p_usd_denominations => '{"1": 1}',
                                                p_idempotency_key => '53000000-0000-0000-0000-0000000000c1');
select test.eq((select string_agg(k || '=' || (pg_temp.r('C1') ->> k), ', ' order by o)
                  from unnest(array['expected', 'counted', 'variance', 'usd_expected', 'usd_counted', 'usd_variance',
                                    'usd_variance_value', 'usd_taken', 'usd_taken_value']) with ordinality u(k, o)),
  'expected=30000, counted=30000, variance=0, usd_expected=2, usd_counted=1, usd_variance=-1, usd_variance_value=-1294, usd_taken=1, usd_taken_value=1294',
  'counted blind: $1 of the $2 it should hold; the missing dollar at its share of what the till held them at');
select test.eq(test.lines_of((select id from s1)), '1001 Cr 2588 | 1006 Dr 1294 | 6300 Dr 1294',
  'one journal: the dollar short to cash over and short, the dollar counted to the safe');
select test.eq(pg_temp.fx((select id from s1)), 'till count -1 -1294, till take -1 -1294, safe take 1 1294',
  'the till''s dollars counted and taken to the safe');
select test.eq(pg_temp.held('till') || ' | ' || pg_temp.held('safe'), '$0 at 0 | $1 at 1294',
  'the till is left with no dollars; the safe has the one counted');
insert into res select 'C1 again', close_cash_session(30000, p_usd_counted => 1, p_usd_denominations => '{"1": 1}',
                                                      p_idempotency_key => '53000000-0000-0000-0000-0000000000c1');
select test.eq((pg_temp.r('C1 again') ->> 'replayed') || ' ' || (pg_temp.r('C1 again') ->> 'usd_counted'), 'true 1',
  'sent again with its key: closed once');
select test.act_as('owner@example.com');
select test.eq((select (st -> 'dollars' ->> 'expected') || ' → ' || (st -> 'dollars' ->> 'counted') || ' | '
                       || (select string_agg((e ->> 'kind') || ' ' || (e ->> 'usd'), ', ' order by o)
                             from jsonb_array_elements(st -> 'dollar_events') with ordinality x(e, o))
                  from cash_session_statement((select id from s1)) st),
  '2 → 1 | sale 5, sale 2, sale 5, sale 10, void -10, sale 5, exchange -15, count -1, take -1',
  'the session''s statement: the till''s dollars in and out, and their count');
select test.as_admin();
select test.eq((select string_agg((after_state ->> 'usd_expected') || ' → ' || (after_state ->> 'usd_counted'), ', ')
                  from audit_log where action = 'cash.session.close' and entity_id = (select id from s1)::text),
  '2 → 1', 'the close is on the audit trail, once, with the dollars counted');
select test.act_as('cashier@example.com');

-- A close from a till loaded before 0043 does not count them: they stay.
select open_cash_session(30000);
insert into res select 'D1', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(20, 2500)));
select test.eq(pg_temp.paid('D1'), 'cash 2500, $20 at 1310 = 26250, change 23750', '$20 are 26,200, counted 26,250');
insert into res select 'C2', close_cash_session(6250);
select test.eq((pg_temp.r('C2') ->> 'usd_carried') || ' | ' || pg_temp.held('till'), '20 | $20 at 26250',
  'a close that does not count the dollars leaves them in the till');
-- A hand over counts them: one found over.
select open_cash_session(6250);
insert into res select 'C3', hand_over_session(6250, pg_temp.uid('owner@example.com'),
                                               p_usd_counted => 21);
select test.eq((pg_temp.r('C3') ->> 'usd_expected') || ' → ' || (pg_temp.r('C3') ->> 'usd_counted') || ', '
               || (pg_temp.r('C3') ->> 'usd_variance_value') || ' | to the safe ' || (pg_temp.r('C3') ->> 'usd_taken_value')
               || ' | ' || (pg_temp.r('C3') ->> 'next_cashier'),
  '20 → 21, 1312 | to the safe 27562 | Demo Owner',
  'a dollar over, at the till''s average (1,312.5, to the dinar); all 21 to the safe; the drawer handed over');
-- Dollars found where none were taken: at today's rate.
select test.act_as('owner@example.com');
insert into res select 'C4', close_cash_session(6250, p_usd_counted => 1);
select test.eq((pg_temp.r('C4') ->> 'usd_expected') || ' → ' || (pg_temp.r('C4') ->> 'usd_counted') || ', '
               || (pg_temp.r('C4') ->> 'usd_variance_value') || ' | ' || pg_temp.held('safe'),
  '0 → 1, 1310 | $23 at 30166', 'a dollar found in a till that held none, at the rate');
-- A manager closes a session without a count: its dollars stay.
select test.act_as('cashier@example.com');
select open_cash_session(6250);
insert into res select 'F1', record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500)));
select test.act_as('owner@example.com');
insert into res select 'C5', force_close_session(pg_temp.session(), 'The cashier went home');
select test.eq((pg_temp.r('C5') ->> 'usd_carried') || ' | ' || pg_temp.held('till'), '5 | $5 at 6500',
  'closed without a count: the dollars wait in the till for the next count');
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500)))$$,
  'Open the drawer first: on the till, count the cash in it', 'no dollars taken with the drawer closed');

-- ------------------------------------------------------------ exchanged for dinars
select test.throws($$select exchange_dollars('safe', 5, 6500, 'bank')$$, '%permission%',
  'a cashier does not exchange dollars');
select test.act_as('manager@example.com');
select test.throws($$select exchange_dollars('bank', 5, 6500, 'safe')$$,
  'Say where the dollars come from: the till or the safe', 'from the till or the safe');
select test.throws($$select exchange_dollars('safe', 5, 6500, 'owner')$$,
  'Say where the dinars go: the till, the safe or the bank', 'into the till, the safe or the bank');
select test.throws($$select exchange_dollars('safe', 1.5, 1950, 'safe')$$, 'Enter the dollars exchanged, in whole dollars',
  'whole dollars');
select test.throws($$select exchange_dollars('safe', 5, 0, 'safe')$$, 'Enter the dinars received for them',
  'for dinars');
select test.throws($$select exchange_dollars('safe', 5, 6500.5, 'safe')$$, 'Enter the dinars received for them',
  'in whole dinars');
select test.throws($$select exchange_dollars('safe', 1, 50, 'safe')$$, 'That is 50 dinars a dollar: check the dinars received',
  'at a believable rate');
select test.throws($$select exchange_dollars('safe', 30, 39000, 'safe')$$, 'The safe holds only $23 in the books',
  'no more than the safe holds');
select test.throws($$select exchange_dollars('till', 5, 6500, 'till')$$, 'Open the drawer first: on the till, count the cash in it',
  'the till''s dollars only while it is open');
insert into res select 'X1', exchange_dollars('safe', 10, 12500, 'safe', 'Exchange office');
select test.eq((pg_temp.r('X1') ->> 'value') || ' → ' || (pg_temp.r('X1') ->> 'received') || ', '
               || (pg_temp.r('X1') ->> 'difference') || ' | ' || test.lines_of((pg_temp.r('X1') ->> 'exchange_id')::uuid),
  '13116 → 12500, -616 | 1005 Dr 12500 | 1006 Cr 13116 | 6950 Dr 616',
  '$10 of the safe''s $23, at their share of 30,166, for less: the loss to 6950');
insert into res select 'X2', exchange_dollars('safe', 13, 17550, 'bank', null, null, '53000000-0000-0000-0000-0000000000e2');
insert into res select 'X2 again', exchange_dollars('safe', 13, 17550, 'bank', null, null,
                                                    '53000000-0000-0000-0000-0000000000e2');
select test.eq((pg_temp.r('X2') ->> 'value') || ' → ' || (pg_temp.r('X2') ->> 'received') || ', '
               || (pg_temp.r('X2') ->> 'difference') || ' | ' || test.lines_of((pg_temp.r('X2') ->> 'exchange_id')::uuid)
               || ' | ' || (pg_temp.r('X2 again') ->> 'replayed') || ' | ' || pg_temp.held('safe'),
  '17050 → 17550, 500 | 1006 Cr 17050 | 1020 Dr 17550 | 6950 Cr 500 | true | $0 at 0',
  'the last dollars take the rest of the value; into the bank, for more; sent again, exchanged once');
select test.as_admin();
select test.eq((select count(*) from fx_exchange)::int || ' ' || test.balance('6950'), '3 28',
  'three exchanges: 88 and 500 gained, 616 lost');
select test.eq((select string_agg(after_state ->> 'difference', ', ' order by id) from audit_log
                 where action = 'fx.exchange'), '88, -616, 500', 'each on the audit trail');

-- ------------------------------------------------------------ what each person may see
select test.act_as('cashier@example.com');
select test.eq((select count(*) from fx_rate)::int || ' ' || (select count(*) from fx_cash_event)::int
               || ' ' || (select count(*) from fx_exchange)::int, '2 0 0',
  'a cashier reads the rates, not the dollars held or exchanged');
select test.throws($$select report_dollars(test.today(), test.today())$$, '%permission%',
  'nor the dollars'' report');
select test.act_as('owner@example.com');
select test.eq((select count(*) > 0 from fx_cash_event) and (select count(*) = 3 from fx_exchange), true,
  'the owner reads them');
select test.throws($$update fx_cash_event set usd = 0$$, '%', 'the dollars'' records are never changed by hand');

-- ------------------------------------------------------------ the report
create temp table rep as select report_dollars(test.today(), test.today()) as r;
grant select on rep to public;
select test.eq((select (r -> 'taken' ->> 'sales') || ' sales, $' || (r -> 'taken' ->> 'usd') || ' = '
                       || (r -> 'taken' ->> 'value') || ', paying ' || (r -> 'taken' ->> 'paid') || ', change '
                       || (r -> 'taken' ->> 'change') from rep),
  '6 sales, $42 = 54750, paying 17500, change 37250',
  'taken: the dollars of the sales not voided, their value, what they paid and the change in dinars');
select test.eq((select string_agg((x ->> 'rate') || ': ' || (x ->> 'sales') || ' sales, $' || (x ->> 'usd'), '; ')
                  from rep, jsonb_array_elements(r -> 'by_rate') x), '1310: 6 sales, $42', 'by the rate taken at');
select test.eq((select string_agg(x ->> 'rate', ', ') from rep, jsonb_array_elements(r -> 'rates') x), '1310',
  'the rates set in the dates');
select test.eq((select string_agg((x ->> 'from') || '→' || (x ->> 'to') || ' $' || (x ->> 'usd') || ' '
                                  || (x ->> 'difference'), ', ' order by x ->> 'at')
                  from rep, jsonb_array_elements(r -> 'exchanges') x),
  'till→till $15 88, safe→safe $10 -616, safe→bank $13 500', 'the exchanges, with their differences');
select test.eq((select string_agg(coalesce(x ->> 'counted', 'not counted') || '/' || (x ->> 'expected'), ', '
                                  order by x ->> 'at')
                  from rep, jsonb_array_elements(r -> 'counts') x),
  '1/2, not counted/20, 21/20, 1/0, not counted/5', 'each close''s count of the dollars');
select test.eq((select (r -> 'differences' ->> 'exchanges') || ' ' || (r -> 'differences' ->> 'counts') from rep),
  '-28 1328', 'the differences: exchanged and counted');
select test.eq((select (select string_agg((x ->> 'location') || ' $' || (x ->> 'usd') || ' at ' || (x ->> 'value'), ', ')
                          from jsonb_array_elements(r -> 'held' -> 'tills') x)
                       || ' | safe $' || (r -> 'held' -> 'safe' ->> 'usd') from rep),
  'Main Branch $5 at 6500 | safe $0', 'held now: the till''s uncounted $5, the safe''s none');

-- ------------------------------------------------------------ the books
select test.as_admin();
select test.eq(test.balance('1001') || ' ' || test.balance('1006'), '6500 0',
  'the dollar accounts hold what the till and the safe hold');
select test.eq((select subledger || '/' || ledger || '/' || difference
                  from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
                 where check_key = 'dollars'), '6500/6500/0', 'the dollars held tie to 1001 and 1006');
select test.eq((select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
                  from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today()) where difference <> 0),
  null, 'the books tie: the drawer, the safe with the dinars exchanged into it, the dollars');
select test.eq((select count(*) from document_problems('00000000-0000-0000-0000-0000000000b1', 'infinity'))::int, 0,
  'every count and exchange of dollars has its journal');
select test.act_as('owner@example.com');
select test.throws(format('select save_journal(%L, %L, %L, true)', test.today(), 'fudge',
                          '[{"code":"6200","debit":5},{"code":"1001","credit":5}]'),
  '%subledger%', 'no manual journal to the till''s dollars');
select test.throws(format('select save_journal(%L, %L, %L, true)', test.today(), 'fudge',
                          '[{"code":"1006","debit":5},{"code":"1020","credit":5}]'),
  '%subledger%', 'nor to the safe''s');

-- ------------------------------------------------------------ a bill in dollars; a sale sent again later
select test.act_as('cashier@example.com');
select open_cash_session(2250);
insert into res select 'B', open_tab('dine_in', null, 'Dollars', null, pg_temp.lines('{"E": 1}'));
create temp table bill as
  select b.tab_id, b.version from pos_open_bills() b where b.tab_id = (pg_temp.r('B') ->> 'tab_id')::uuid;
grant select on bill to public;
insert into res select 'B paid', settle_tab((select tab_id from bill), (select version from bill), gen_random_uuid(),
  null, 2500, null, jsonb_build_array(pg_temp.usd(2, 2500)));
select test.eq(pg_temp.paid('B paid') || ' | ' || pg_temp.fx(pg_temp.sale('B paid')),
  'cash 2500, $2 at 1310 = 2500, change 0 | till sale 2 2500', 'a bill paid in dollars');
select test.act_as('manager@example.com');
select set_fx_rate('USD', 1320, 'Market rate this afternoon');
select test.act_as('cashier@example.com');
insert into res select 'U1 later', record_sale('53000000-0000-0000-0000-0000000000a1', 'dine_in', null,
  pg_temp.lines('{"E": 1}'), p_tenders => jsonb_build_array(pg_temp.usd(5, 2500)));
select test.eq((pg_temp.r('U1 later') ->> 'replayed') || ' at ' || (pg_temp.r('U1 later') -> 'payments' -> 0 ->> 'rate'),
  'true at 1310', 'a sale sent again after the rate changed is the sale as recorded, at its rate');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', null, pg_temp.lines('{"E": 1}'),
  p_tenders => jsonb_build_array(pg_temp.usd(5, 2500)))$$,
  'The dollar rate is now 1320, not the 1310 shown: take the payment again', 'a new sale takes the new rate');

-- ------------------------------------------------------------ the rounding is the café's
select test.act_as('owner@example.com');
select set_business_rule('usd_round_to', 'business', '', '500', 'Change is given in 500s');
select test.as_admin();
select test.eq(usd_value('00000000-0000-0000-0000-0000000000b1', 7, 1310), 9000::numeric,
  '$7 at 1,310 are 9,170: to the nearest 500, 9,000');
