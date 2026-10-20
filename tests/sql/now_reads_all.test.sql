-- =============================================================================
-- What the books hold now (0086): an entry dated today is booked at noon, the
-- café's time; read before noon, it is still what the safe, the bank, the
-- deposits and the customers' accounts hold now.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v numeric);
grant all on res to public;
create function pg_temp.v(p text) returns numeric language sql as $$ select v from res where k = p $$;

select test.act_as('owner@example.com');
insert into res select 'bank', (branch_position() -> 'cafe' ->> 'bank')::numeric;
insert into res select 'safe', (branch_position() -> 'cafe' ->> 'safe')::numeric;

-- The morning's bills, dated today: booked at noon, hours from now.
select test.as_admin();
select post_journal('00000000-0000-0000-0000-0000000000b1', now() + interval '3 hours', 'Electricity (fixture)', 'manual',
  null, '[{"code":"6200","debit":1000},{"code":"1020","credit":1000}]');
select post_journal('00000000-0000-0000-0000-0000000000b1', now() + interval '3 hours', 'Generator (fixture)', 'manual',
  null, '[{"code":"6200","debit":250},{"code":"1005","credit":250}]');

select test.act_as('owner@example.com');
select test.eq((branch_position() -> 'cafe' ->> 'bank')::numeric, pg_temp.v('bank') - 1000,
  'the bank, now: less the bill dated today, though it is booked at noon');
select test.eq((branch_position() -> 'cafe' ->> 'safe')::numeric, pg_temp.v('safe') - 250,
  'and the safe');

-- The deposits and the customers' accounts, as the books have every entry.
select test.as_admin();
create function pg_temp.books(p_code text) returns numeric language sql security definer as $$
  select coalesce(sum(l.debit - l.credit), 0) from journal_line l
    join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id
   where e.business_id = '00000000-0000-0000-0000-0000000000b1' and e.status = 'published' and a.code = p_code
$$;
select test.act_as('owner@example.com');
select test.eq((pre_orders() ->> 'books')::numeric, -pg_temp.books('2300'), 'the deposits in the books: every entry');
select test.eq((customer_accounts() ->> 'books')::numeric, pg_temp.books('1110'),
  'what customers owe in the books: every entry');
