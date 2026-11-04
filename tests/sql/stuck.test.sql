-- =============================================================================
-- Where people get stuck (0097): a refusal or a help opened, noted by screen;
-- the owner reads what stops people most, practice apart.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
select test.eq(stuck_path('/inventory/c0000000-0000-0000-0000-000000000001?x=1'), '/inventory/x',
  'an item''s page is one screen, whatever the item');
select test.eq(stuck_path('/purchasing/orders/12/'), '/purchasing/orders/x/', 'and a numbered one');

select test.act_as('cashier@example.com');
select note_stuck('/pos', 'refused', 'A discount over 10% needs a manager''s approval');
select note_stuck('/pos', 'refused', 'A discount over 10% needs a manager''s approval');
select note_stuck('/pos', 'help');
select note_stuck('/pos', 'nonsense');
select note_stuck('not a path', 'help');
select set_config('request.headers', '{"x-sixties-practice": "1"}', false);
select note_stuck('/pos', 'help');
select set_config('request.headers', '', false);
select test.act_as('manager@example.com');
select note_stuck('/pos', 'refused', 'A discount over 10% needs a manager''s approval');
select note_stuck('/production', 'help');

select test.throws($$select stuck_report()$$, 'Only the owner reads where people get stuck', 'a manager reads none');
select test.act_as('owner@example.com');
create temp table rep as select stuck_report(30) as r;
grant all on rep to public;
create function pg_temp.screen(p text) returns jsonb language sql as $$
  select s from rep, jsonb_array_elements(r -> 'screens') s where s ->> 'path' = p
$$;
select test.eq((select jsonb_array_length(r -> 'screens') from rep), 2, 'two screens');
select test.eq((select r -> 'screens' -> 0 ->> 'path' from rep), '/pos', 'the till first: it stops people most');
select test.eq(pg_temp.screen('/pos') ->> 'refused', '2', 'twice refused (the same within a minute is one)');
select test.eq(pg_temp.screen('/pos') ->> 'help', '1', 'its help opened once for real');
select test.eq(pg_temp.screen('/pos') ->> 'practice', '1', 'and once in practice, apart');
select test.eq(pg_temp.screen('/pos') ->> 'people', '2', 'by two people');
select test.eq(pg_temp.screen('/pos') -> 'messages' -> 0 ->> 'times', '2', 'what was said, and how often');
select test.ok(pg_temp.screen('/pos') -> 'roles' ? 'branch_manager', 'with their roles');
