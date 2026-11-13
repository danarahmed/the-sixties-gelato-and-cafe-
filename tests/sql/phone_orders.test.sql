-- =============================================================================
-- Orders sent from the phone to the till (0119): off, a phone's order is
-- refused (show it to the waiter); the owner turns both on; table 4 sends two
-- espressos; Hawre orders to take away with his number; the till sees them,
-- takes one and turns the other down with why; each phone sees which. A
-- phone sends at most five an hour; nothing not on the menu is taken.
-- =============================================================================
select test.golden_catalogue();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
grant execute on function pg_temp.r(text) to public;
create temp table two as select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 2)) as v;
grant select on two to public;

select test.act_as('owner@example.com');
insert into res select 'menu', set_public_menu(true);

set local role anon;
select test.throws(format('select submit_phone_order(%L, %L, %L, p_table => %L)', pg_temp.r('menu') ->> 'token', 'table',
                          (select v from two), '4'),
  'Show your order to the waiter', 'off: the waiter scans it');
reset role;

select test.act_as('owner@example.com');
select set_phone_orders(true, true);
set local role anon;
insert into res select 't4', submit_phone_order(pg_temp.r('menu') ->> 'token', 'table', (select v from two), p_table => '4');
insert into res select 'hw', submit_phone_order(pg_temp.r('menu') ->> 'token', 'pickup', (select v from two),
                                                 p_name => 'Hawre', p_phone => '0770 123 4567');
select test.throws(format('select submit_phone_order(%L, %L, %L)', pg_temp.r('menu') ->> 'token', 'pickup',
                          (select v from two)),
  'Type your name', 'to take away: a name');
select test.throws(format('select submit_phone_order(%L, %L, %L, p_table => %L)', pg_temp.r('menu') ->> 'token', 'table',
                          '[{"variant_id": "00000000-0000-0000-0000-000000000009", "qty": 1}]', '4'),
  'Something on the order is not on the menu now', 'only what the menu sells');
select test.throws(format('select submit_phone_order(%L, %L, %L, p_table => %L)', pg_temp.r('menu') ->> 'token', 'table',
                          '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 50}]', '4'),
  'The order cannot be read', 'at most 20 of a thing');
reset role;

select test.act_as('cashier@example.com');
select test.eq(jsonb_array_length(phone_orders()), 2, 'two orders wait at the till');
insert into res select 'take', handle_phone_order((pg_temp.r('t4') ->> 'order_id')::uuid, true);
select test.eq(pg_temp.r('take') -> 'lines' -> 0 ->> 'qty', '2', 'taken: its lines, to ring up');
select test.throws(format('select handle_phone_order(%L, false)', pg_temp.r('hw') ->> 'order_id'),
  'Say why it is turned down', 'turned down with why');
select handle_phone_order((pg_temp.r('hw') ->> 'order_id')::uuid, false, 'Closing now');
select test.throws(format('select handle_phone_order(%L, true)', pg_temp.r('t4') ->> 'order_id'),
  'That order was dealt with already', 'once');

set local role anon;
select test.eq(phone_order_status(pg_temp.r('menu') ->> 'token', (pg_temp.r('t4') ->> 'order_id')::uuid) ->> 'status',
  'accepted', 'table 4''s phone sees it taken');
select test.eq(phone_order_status(pg_temp.r('menu') ->> 'token', (pg_temp.r('hw') ->> 'order_id')::uuid) ->> 'reason',
  'Closing now', 'Hawre''s sees it turned down, and why');
-- Five an hour from a phone.
select submit_phone_order(pg_temp.r('menu') ->> 'token', 'pickup', (select v from two), p_name => 'Hawre',
                          p_phone => '+9647701234567')
  from generate_series(1, 4);
select test.throws(format('select submit_phone_order(%L, %L, %L, p_name => %L, p_phone => %L)', pg_temp.r('menu') ->> 'token',
                          'pickup', (select v from two), 'Hawre', '07701234567'),
  'Too many orders from this phone: ask at the counter', 'at most five an hour from a phone');
reset role;
