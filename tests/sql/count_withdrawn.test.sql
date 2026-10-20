-- =============================================================================
-- A count withdrawn by the person who counted it (0087): rejecting their own
-- submitted count posts nothing and is theirs to do; approving it is not.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v uuid);
grant all on res to public;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from res where k = p $$;
create function pg_temp.status(p text) returns text language sql security definer as $$
  select status::text || coalesce(' ' || rejected_reason, '') from stock_count where id = pg_temp.id(p)
$$;
create function pg_temp.lines_posted(p text) returns bigint language sql security definer as $$
  select count(*) from stock_count_line where stock_count_id = pg_temp.id(p) and adjustment_movement_id is not null
$$;

-- The manager counts the milk, and submits it.
select test.act_as('manager@example.com');
insert into res select 'C1', start_stock_count(array[(select id from item where name = 'Golden cup')]);
select record_count(pg_temp.id('C1'), (select id from item where name = 'Golden cup'), 10, 'each');
select submit_stock_count(pg_temp.id('C1'));
select test.throws($$select approve_stock_count(pg_temp.id('C1'))$$, '%someone other than the person who counted it%',
  'whoever counted it does not approve it');
select reject_stock_count(pg_temp.id('C1'), 'Counted before the delivery was put away');
select test.eq(pg_temp.status('C1'), 'rejected Counted before the delivery was put away',
  'but withdraws it for a recount');
select test.eq(pg_temp.lines_posted('C1'), 0::bigint, 'and nothing is posted');

-- Another's count is still another's to approve.
insert into res select 'C2', start_stock_count(array[(select id from item where name = 'Golden cup')]);
select record_count(pg_temp.id('C2'), (select id from item where name = 'Golden cup'), 10, 'each');
select submit_stock_count(pg_temp.id('C2'));
select test.act_as('owner@example.com');
select approve_stock_count(pg_temp.id('C2'));
select test.eq(split_part(pg_temp.status('C2'), ' ', 1), 'approved', 'approved by someone else, as before');
