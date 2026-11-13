-- =============================================================================
-- The menu on the customer's phone (0118): off, the link opens nothing; the
-- owner turns it on for the first branch, and anyone with its link reads the
-- menu there (names, prices, photos), signed in or not; a new link and the
-- old one opens nothing; a manager does not turn it on.
-- =============================================================================
select test.golden_catalogue();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
grant execute on function pg_temp.r(text) to public;

select test.act_as('manager@example.com');
select test.throws($$select set_public_menu(true)$$, '%', 'a manager does not turn it on');
select test.act_as('owner@example.com');
select test.eq(public_menu_setup(), null, 'never turned on: nothing');
insert into res select 'on', set_public_menu(true);
select test.eq((pg_temp.r('on') ->> 'enabled')::boolean, true, 'on, with a link');
select test.eq(length(pg_temp.r('on') ->> 'token') >= 20, true, 'a long link nobody guesses');

-- Anyone with the link, signed in or not.
set local role anon;
insert into res select 'menu', public_menu(pg_temp.r('on') ->> 'token');
reset role;
select test.eq(jsonb_array_length(pg_temp.r('menu') -> 'items') > 0, true, 'the menu, read by anyone with the link');
select test.eq((select (x ->> 'price')::int from jsonb_array_elements(pg_temp.r('menu') -> 'items') x
                 where x ->> 'variant_id' = 'd1000000-0000-0000-0000-000000000001'), 2500,
  'the espresso at its dine-in price');
select test.throws($$select public_menu('not-the-link-at-all-0000')$$, 'This menu is not available',
  'a wrong link opens nothing');

select test.act_as('owner@example.com');
insert into res select 'new', set_public_menu(true, null, true);
select test.eq((pg_temp.r('new') ->> 'token') <> (pg_temp.r('on') ->> 'token'), true, 'a new link');
select test.throws(format('select public_menu(%L)', pg_temp.r('on') ->> 'token'), 'This menu is not available',
  'the old link opens nothing');
select set_public_menu(false);
select test.throws(format('select public_menu(%L)', pg_temp.r('new') ->> 'token'), 'This menu is not available',
  'off: nothing');
