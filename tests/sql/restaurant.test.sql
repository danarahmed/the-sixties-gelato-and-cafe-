-- =============================================================================
-- The restaurant parts (0110): off for a café until turned on. A bill's lines
-- carry their course and seat; the kitchen is sent what is new, course by
-- course, a ticket for each station, and what is taken off as a line taken
-- off; a station marks a ticket ready, then done. Two bills are joined.
-- Bookings and the waiting list.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.tab(p text) returns uuid language sql as $$ select (v ->> 'tab_id')::uuid from res where k = p $$;
create function pg_temp.ver(p uuid) returns int language sql security definer as $$ select version from pos_tab where id = p $$;
grant execute on function pg_temp.r(text), pg_temp.tab(text), pg_temp.ver(uuid) to public;
create function pg_temp.lines(p_espresso numeric, p_course int, p_water numeric) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', p_espresso, 'course', p_course, 'seat', 2),
    jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000002', 'qty', p_water, 'course', 1))
$$;
grant execute on function pg_temp.lines(numeric, int, numeric) to public;

-- Off for a café.
select test.act_as('cashier@example.com');
insert into res select 'A', open_tab('dine_in', p_label => 'Table 9', p_lines => pg_temp.lines(2, 2, 1));
select test.throws(format('select send_tab_to_kitchen(%L)', pg_temp.tab('A')),
  'That part is off for this business: Kitchen screens and stations', 'a café has no kitchen screens yet');
select test.act_as('owner@example.com');
select set_business_part('kitchen', true, 'We cook now');
select set_business_part('courses', true, 'Starters and mains');
select set_business_part('reservations', true, 'We take bookings');
insert into res select 'grill', jsonb_build_object('id', (save_kitchen_station(null, 'Bar') -> 'stations' -> 0 ->> 'id'));
select test.throws($$select save_kitchen_station(null, 'bar')$$, 'There is a station called bar already', 'one of each name');

-- Courses and seats are kept with the lines.
select test.as_admin();
select test.eq((select string_agg(coalesce(course::text, '-') || '/' || coalesce(seat::text, '-'), ',' order by position)
                  from pos_tab_line where tab_id = pg_temp.tab('A')), '2/2,1/-', 'each line keeps its course and seat');

-- The starters go now; the mains wait.
select test.act_as('cashier@example.com');
insert into res select 's1', send_tab_to_kitchen(pg_temp.tab('A'), 1);
select test.eq((pg_temp.r('s1') ->> 'tickets')::int, 1, 'course 1: one ticket');
select test.eq((pg_temp.r('s1') ->> 'held')::int, 1, 'the main waits');
select test.as_admin();
select test.eq((select string_agg(l.name || ' ' || trim_scale(l.qty), ',') from kitchen_ticket_line l
                  join kitchen_ticket k on k.id = l.ticket_id where k.tab_id = pg_temp.tab('A')),
  'Golden water · Bottle 1', 'the starter only');
select test.act_as('cashier@example.com');
insert into res select 's2', send_tab_to_kitchen(pg_temp.tab('A'), 2);
select test.eq((pg_temp.r('s2') ->> 'tickets')::int, 1, 'course 2: its ticket');
insert into res select 's3', send_tab_to_kitchen(pg_temp.tab('A'));
select test.eq((pg_temp.r('s3') ->> 'tickets')::int, 0, 'nothing new: nothing sent');

-- One espresso taken off: the kitchen is told.
select save_tab(pg_temp.tab('A'), pg_temp.ver(pg_temp.tab('A')), pg_temp.lines(1, 2, 1));
select send_tab_to_kitchen(pg_temp.tab('A'));
select test.as_admin();
select test.eq((select trim_scale(l.qty) from kitchen_ticket_line l join kitchen_ticket k on k.id = l.ticket_id
                 where k.tab_id = pg_temp.tab('A') order by k.created_at desc limit 1), '-1',
  'what is taken off goes as a line taken off');
select test.act_as('cashier@example.com');

-- The screen, ready, then done.
insert into res select 'screen', kitchen_tickets(null, true);
select test.eq(jsonb_array_length(pg_temp.r('screen')), 3, 'the kitchen sees three tickets');
select set_ticket_status((pg_temp.r('screen') -> 0 ->> 'id')::uuid, 'ready');
select set_ticket_status((pg_temp.r('screen') -> 0 ->> 'id')::uuid, 'done');
select test.as_admin();
select test.eq((select status from kitchen_ticket where id = (pg_temp.r('screen') -> 0 ->> 'id')::uuid), 'done', 'done');
select test.ok((select ready_at is not null from kitchen_ticket where id = (pg_temp.r('screen') -> 0 ->> 'id')::uuid),
  'with when it was ready');
select test.act_as('cashier@example.com');

-- A sale at the counter goes whole.
insert into res select 'sale', record_sale(gen_random_uuid(), 'takeaway', 'cash',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2}]');
select test.eq((send_sale_to_kitchen((pg_temp.r('sale') ->> 'order_id')::uuid) ->> 'tickets')::int, 1,
  'a counter sale: one ticket');
select test.eq((send_sale_to_kitchen((pg_temp.r('sale') ->> 'order_id')::uuid) ->> 'tickets')::int, 0, 'once');

-- Two bills joined.
insert into res select 'B', open_tab('dine_in', p_label => 'Table 10', p_lines => pg_temp.lines(1, 2, 2));
select join_tabs(pg_temp.tab('A'), pg_temp.ver(pg_temp.tab('A')), pg_temp.tab('B'), pg_temp.ver(pg_temp.tab('B')));
select test.as_admin();
select test.eq((select sum(qty)::int from pos_tab_line where tab_id = pg_temp.tab('A')), 5, 'one bill holds both');
select test.eq((select status from pos_tab where id = pg_temp.tab('B')), 'cancelled', 'the other is closed as moved');

-- Bookings and the waiting list.
select test.act_as('cashier@example.com');
select test.throws($$select save_reservation(null, ' ', null, 4, now() + interval '2 hours')$$,
  'Give the name the table is for', 'a booking has a name');
select save_reservation(null, 'Karwan', '0750 000 0000', 4, now() + interval '2 hours');
select save_reservation(null, 'Walk-in Lana', null, 2, null);
insert into res select 'day', reservations(null);
select test.eq(jsonb_array_length(pg_temp.r('day')), 2, 'today''s booking and the party waiting');
select set_reservation_status((pg_temp.r('day') -> 0 ->> 'id')::uuid, 'seated');
select test.eq((reservations(null) -> 0 ->> 'status'), 'seated', 'seated');

-- The till reads each line's course and seat back.
select test.act_as('cashier@example.com');
select test.eq((select string_agg(coalesce(x ->> 'course', '-') || '/' || coalesce(x ->> 'seat', '-'), ',')
                  from pos_open_bills() b, jsonb_array_elements(b.lines) x where b.tab_id = pg_temp.tab('A')),
  '2/2,1/-,2/2,1/-', 'the open bill gives back each line''s course and seat');
