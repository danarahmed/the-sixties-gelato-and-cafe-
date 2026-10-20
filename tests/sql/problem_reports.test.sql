-- =============================================================================
-- "Something's wrong" (0083, G5): anyone signed in says what went wrong, with
-- the screen and what the app knew; once whatever the connection does; the
-- owner and the managers see the list and mark each one dealt with.
-- =============================================================================
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.reports() returns bigint language sql security definer as $$
  select count(*) from problem_report
$$;

-- ------------------------------------------------------------ the cashier says what went wrong
select test.act_as('cashier@example.com');
insert into res select 'A', report_problem('/pos', 'The receipt printed twice',
  '{"online": true, "error": "none", "screen": "1280x800"}', null, '83000000-0000-0000-0000-000000000001');
insert into res select 'A2', report_problem('/pos', 'The receipt printed twice',
  '{"online": true, "error": "none", "screen": "1280x800"}', null, '83000000-0000-0000-0000-000000000001');
select test.eq(pg_temp.r('A2') ->> 'report_id', pg_temp.r('A') ->> 'report_id', 'sent twice: one report');
select test.eq(pg_temp.reports(), 1::bigint, 'and only one kept');
select test.throws($$select report_problem('/pos', ' ')$$, '%what went wrong%', 'it says something');
select test.throws(format('select report_problem(%L, %L)', '/pos', repeat('x', 501)), '%500 letters%',
  'in at most 500 letters');
select test.throws($$select problem_reports()$$, null, 'a cashier does not read the list');
select test.eq((select count(*) from problem_report), 0::bigint, 'nor the table');

-- ------------------------------------------------------------ the owner reads it and deals with it
select test.act_as('owner@example.com');
select test.eq((problem_reports() ->> 'open')::int, 1, 'one open');
select test.eq(problem_reports() -> 'reports' -> 0 ->> 'what', 'The receipt printed twice', 'what was said');
select test.eq(problem_reports() -> 'reports' -> 0 ->> 'page', '/pos', 'on which screen');
select test.eq(problem_reports() -> 'reports' -> 0 -> 'context' ->> 'screen', '1280x800',
  'with what the app knew');
select test.ok(problem_reports() -> 'reports' -> 0 ->> 'by' is not null, 'and by whom');
select settle_problem((pg_temp.r('A') ->> 'report_id')::uuid, true, 'Printer set to two copies');
select test.eq((problem_reports() ->> 'open')::int, 0, 'dealt with: none open');
select test.eq(problem_reports() -> 'reports' -> 0 ->> 'note', 'Printer set to two copies', 'with its note');
select settle_problem((pg_temp.r('A') ->> 'report_id')::uuid, false);
select test.eq((problem_reports() ->> 'open')::int, 1, 'opened again');
select test.as_admin();
select test.eq((select count(*) from audit_log where action in ('problem.done', 'problem.reopen')), 2::bigint,
  'each on the audit trail');
