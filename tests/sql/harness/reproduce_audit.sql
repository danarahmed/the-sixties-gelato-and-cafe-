-- =============================================================================
-- Reproduce the audit's database findings against the migrations as shipped.
--
-- Diagnostic, not a pass/fail test: each block attempts the behaviour the
-- audit said was possible and reports REPRODUCED (the control failed, the
-- audit was right) or HELD (the control worked, the audit was wrong).
-- Run against the pre-fix migrations to confirm the findings are real.
-- =============================================================================
\set ON_ERROR_STOP 0
\set QUIET 1
set client_min_messages = notice;

-- Setup as admin: an open period, a locked period, and one published entry.
select test.as_admin();
insert into accounting_period (id, business_id, name, starts_on, ends_on, status) values
  ('e0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '2026-07', '2026-07-01', '2026-07-31', 'locked'),
  ('e0000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '2026-08', '2026-08-01', '2026-08-31', 'open');
-- Built draft -> lines -> publish: valid under both the old and new rules.
insert into journal_entry (id, business_id, period_id, description, status, occurred_at)
  values ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1',
          'e0000000-0000-0000-0000-0000000000a2', 'Posted sale', 'draft', '2026-08-10');
insert into journal_line (journal_entry_id, account_id, debit, credit)
  select 'f0000000-0000-0000-0000-000000000001'::uuid, id,
         case code when '1000' then 10000 else 0 end, case code when '4000' then 10000 else 0 end
  from gl_account where code in ('1000','4000') and business_id = '00000000-0000-0000-0000-0000000000b1';
update journal_entry set status = 'published', journal_no = coalesce(journal_no, 1001)
 where id = 'f0000000-0000-0000-0000-000000000001';

create or replace function pg_temp.report(id text, reproduced boolean, detail text) returns void
language plpgsql as $$ begin
  raise notice '% %  %', rpad(id, 6), case when reproduced then 'REPRODUCED' else 'held      ' end, detail;
end $$;

-- ---------------------------------------------------------------- C-01
select test.act_as_anon();
do $$ declare n int; begin
  select count(*) into n from inventory_movement where unit_cost is not null;
  perform pg_temp.report('C-01a', true, format('anon read inventory_movement (unit costs visible; %s costed rows)', n));
exception when others then perform pg_temp.report('C-01a', false, 'anon read denied: ' || sqlerrm); end $$;

do $$ declare eid uuid := gen_random_uuid(); begin
  insert into journal_entry (id, business_id, description)
    values (eid, '00000000-0000-0000-0000-0000000000b1', 'Fabricated by the public');
  insert into journal_line (journal_entry_id, account_id, debit, credit)
    values (eid, (select id from gl_account where code='1000' and business_id='00000000-0000-0000-0000-0000000000b1'), 999999, 0),
           (eid, (select id from gl_account where code='4000' and business_id='00000000-0000-0000-0000-0000000000b1'), 0, 999999);
  set constraints all immediate;
  perform pg_temp.report('C-01b', true, 'anon INSERTed a balanced 999,999 journal into the live books');
exception when others then perform pg_temp.report('C-01b', false, 'anon journal insert denied: ' || sqlerrm); end $$;

do $$ declare n int; begin
  update accounting_period set status = 'open' where name = '2026-07';
  get diagnostics n = row_count;
  perform pg_temp.report('C-01c', n > 0, format('anon UPDATE accounting_period locked->open (%s row)', n));
exception when others then perform pg_temp.report('C-01c', false, 'anon period update denied: ' || sqlerrm); end $$;

-- restore the lock for the C-07 checks
select test.as_admin();
update accounting_period set status = 'locked' where name = '2026-07';

-- ---------------------------------------------------------------- C-02
-- anon has no UPDATE on journal_line, so a line cannot be edited in place.
-- The route is: demote to draft, delete the lines, insert new ones, re-publish.
select test.act_as_anon();
do $$ declare n int; begin
  update journal_entry set description = 'Quietly rewritten'
   where id = 'f0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.report('C-02a', n > 0, format('anon edited a PUBLISHED journal description (%s row)', n));
exception when others then perform pg_temp.report('C-02a', false, 'edit denied: ' || sqlerrm); end $$;

do $$ declare n int; begin
  update journal_entry set status = 'draft' where id = 'f0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.report('C-02b', n > 0, format('anon demoted a PUBLISHED entry to draft (%s row)', n));
exception when others then perform pg_temp.report('C-02b', false, 'demote denied: ' || sqlerrm); end $$;

do $$ declare d int; i int; p int; begin
  delete from journal_line where journal_entry_id = 'f0000000-0000-0000-0000-000000000001';
  get diagnostics d = row_count;
  insert into journal_line (journal_entry_id, account_id, debit, credit)
    select 'f0000000-0000-0000-0000-000000000001'::uuid, id,
           case code when '1000' then 1 else 0 end, case code when '4000' then 1 else 0 end
    from gl_account where code in ('1000','4000') and business_id = '00000000-0000-0000-0000-0000000000b1';
  get diagnostics i = row_count;
  update journal_entry set status = 'published' where id = 'f0000000-0000-0000-0000-000000000001';
  get diagnostics p = row_count;
  set constraints all immediate;
  perform pg_temp.report('C-02c', d > 0 and i > 0 and p > 0,
    format('anon deleted %s lines, inserted %s at 1 dinar, re-published: a 10,000 entry now reads 1', d, i));
exception when others then perform pg_temp.report('C-02c', false, 'rewrite denied: ' || sqlerrm); end $$;

do $$ declare n int; begin
  update journal_entry set status = 'draft' where id = 'f0000000-0000-0000-0000-000000000001';
  delete from journal_line where journal_entry_id = 'f0000000-0000-0000-0000-000000000001';
  delete from journal_entry where id = 'f0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.report('C-02d', n > 0, format('anon DELETED the published entry outright (%s row)', n));
exception when others then perform pg_temp.report('C-02d', false, 'delete denied: ' || sqlerrm); end $$;

-- ---------------------------------------------------------------- C-07
-- Each probe judges the OUTCOME (where the entry ended up, how many lines it
-- has), not merely whether an error was raised: a control that silently
-- ignores a request is as good as one that refuses it, and "no error" alone
-- would misreport it as a breach.
select test.as_admin();
do $$ declare eid uuid := gen_random_uuid(); begin
  insert into journal_entry (id, business_id, period_id, description, occurred_at)
    values (eid, '00000000-0000-0000-0000-0000000000b1', null, 'Back-dated into locked July', '2026-07-15');
  insert into journal_line (journal_entry_id, account_id, debit, credit)
    values (eid, (select id from gl_account where code='1000' and business_id='00000000-0000-0000-0000-0000000000b1'), 500, 0),
           (eid, (select id from gl_account where code='4000' and business_id='00000000-0000-0000-0000-0000000000b1'), 0, 500);
  set constraints all immediate;
  perform pg_temp.report('C-07a', true, 'entry dated in LOCKED July accepted because period_id was null');
exception when others then perform pg_temp.report('C-07a', false, 'rejected: ' || sqlerrm); end $$;

-- A posted August entry, moved into locked July afterwards.
do $$ declare eid uuid := gen_random_uuid(); v uuid; begin
  insert into journal_entry (id, business_id, period_id, description, status, occurred_at)
    values (eid, '00000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000a2', 'August sale', 'draft', '2026-08-10');
  insert into journal_line (journal_entry_id, account_id, debit, credit)
    values (eid, (select id from gl_account where code='1000' and business_id='00000000-0000-0000-0000-0000000000b1'), 700, 0),
           (eid, (select id from gl_account where code='4000' and business_id='00000000-0000-0000-0000-0000000000b1'), 0, 700);
  update journal_entry set status = 'published', journal_no = 2001 where id = eid;
  begin
    update journal_entry set period_id = 'e0000000-0000-0000-0000-0000000000a1', occurred_at = '2026-07-15' where id = eid;
  exception when others then null;
  end;
  set constraints all immediate;
  select period_id into v from journal_entry where id = eid;
  perform pg_temp.report('C-07b', v = 'e0000000-0000-0000-0000-0000000000a1',
    case when v = 'e0000000-0000-0000-0000-0000000000a1' then 'a posted August entry was moved into LOCKED July'
         else 'the posted entry could not be moved; it stayed in its own period' end);
exception when others then perform pg_temp.report('C-07b', false, 'rejected: ' || sqlerrm); end $$;

-- A posted August entry; August is then locked; more lines are attached.
do $$ declare eid uuid := gen_random_uuid(); n int; begin
  insert into journal_entry (id, business_id, period_id, description, status, occurred_at)
    values (eid, '00000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000a2', 'Will be locked', 'draft', '2026-08-12');
  insert into journal_line (journal_entry_id, account_id, debit, credit)
    values (eid, (select id from gl_account where code='1000' and business_id='00000000-0000-0000-0000-0000000000b1'), 100, 0),
           (eid, (select id from gl_account where code='4000' and business_id='00000000-0000-0000-0000-0000000000b1'), 0, 100);
  update journal_entry set status = 'published', journal_no = 2002 where id = eid;
  update accounting_period set status = 'locked' where id = 'e0000000-0000-0000-0000-0000000000a2';
  begin
    insert into journal_line (journal_entry_id, account_id, debit, credit)
      values (eid, (select id from gl_account where code='1000' and business_id='00000000-0000-0000-0000-0000000000b1'), 50, 0),
             (eid, (select id from gl_account where code='4000' and business_id='00000000-0000-0000-0000-0000000000b1'), 0, 50);
  exception when others then null;
  end;
  set constraints all immediate;
  select count(*) into n from journal_line where journal_entry_id = eid;
  perform pg_temp.report('C-07c', n > 2,
    case when n > 2 then 'lines ADDED to a posted entry after its period was locked'
         else 'no line could be added to the locked, posted entry' end);
  update accounting_period set status = 'open' where id = 'e0000000-0000-0000-0000-0000000000a2';
exception when others then perform pg_temp.report('C-07c', false, 'rejected: ' || sqlerrm); end $$;

-- ---------------------------------------------------------------- H-02
-- The app picked "next number" with ORDER BY journal_no DESC LIMIT 1, where
-- NULLs sort FIRST. Probe whether any NULL-numbered row can shadow the max.
do $$ declare got bigint; nulls int; begin
  select count(*) into nulls from journal_entry
   where business_id = '00000000-0000-0000-0000-0000000000b1' and journal_no is null and status = 'published';
  select journal_no into got from journal_entry
   where business_id = '00000000-0000-0000-0000-0000000000b1' and status = 'published'
   order by journal_no desc limit 1;
  perform pg_temp.report('H-02', nulls > 0,
    format('%s published entries without a number; max-number probe returned %s', nulls, coalesce(got::text, 'NULL')));
end $$;

-- Two entries published with the same caller-supplied number.
do $$ declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); na bigint; nb bigint; begin
  insert into journal_entry (id, business_id, period_id, description, status) values
    (a, '00000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000a2', 'first',  'draft'),
    (b, '00000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000a2', 'second', 'draft');
  insert into journal_line (journal_entry_id, account_id, debit, credit)
    select e, id, case code when '1000' then 10 else 0 end, case code when '4000' then 10 else 0 end
    from gl_account, unnest(array[a, b]) e
    where code in ('1000','4000') and business_id = '00000000-0000-0000-0000-0000000000b1';
  update journal_entry set status = 'published', journal_no = 1002 where id = a;
  update journal_entry set status = 'published', journal_no = 1002 where id = b;
  set constraints all immediate;
  select journal_no into na from journal_entry where id = a;
  select journal_no into nb from journal_entry where id = b;
  perform pg_temp.report('H-02b', false, format('caller-supplied numbers ignored; the database issued %s and %s', na, nb));
exception when unique_violation then
  perform pg_temp.report('H-02b', true, 'a colliding journal_no is rejected by the unique index, so the save FAILS');
end $$;

-- ---------------------------------------------------------------- H-06
select test.as_admin();
do $$ declare eid uuid := gen_random_uuid(); acct uuid; n int; begin
  select id into acct from gl_account where business_id = '00000000-0000-0000-0000-0000000000b2' and code = '1000';
  if acct is null then
    insert into gl_account (business_id, code, name, account_type, normal_balance)
      values ('00000000-0000-0000-0000-0000000000b2', '1000', 'Cash', 'asset', 'debit') returning id into acct;
  end if;
  insert into journal_entry (id, business_id, description, status) values (eid, '00000000-0000-0000-0000-0000000000b2', 'Other tenant secret', 'draft');
  insert into journal_line (journal_entry_id, account_id, debit, credit) values (eid, acct, 12345, 0), (eid, acct, 0, 12345);
  perform test.act_as('cashier@example.com');
  select count(*) into n from journal_line where debit = 12345 or credit = 12345;
  perform pg_temp.report('H-06', n > 0, format('a user of business b1 read %s journal_line rows belonging to business b2', n));
  perform test.as_admin();
exception when others then
  perform test.as_admin();
  perform pg_temp.report('H-06', false, 'cross-tenant read denied: ' || sqlerrm);
end $$;

-- ---------------------------------------------------------------- L-01 / L-02 / M-07
select test.as_admin();
do $$ begin
  insert into journal_entry (business_id, period_id, description, status, journal_no, occurred_at)
    values ('00000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000a2', 'An entry with no lines', 'published', 2003, '2026-08-20');
  set constraints all immediate;
  perform pg_temp.report('L-01', true, 'a PUBLISHED journal entry with ZERO lines was accepted');
exception when others then perform pg_temp.report('L-01', false, 'rejected: ' || sqlerrm); end $$;

do $$ declare oid uuid := gen_random_uuid(); n int; begin
  insert into sales_order (id, business_id, location_id, channel, status, idempotency_key, gross_amount, net_amount, cogs_amount)
    values (oid, '00000000-0000-0000-0000-0000000000b1', (select id from location limit 1), 'dine_in', 'completed', gen_random_uuid(), 5000, 5000, 2000);
  update sales_order set cogs_amount = 1 where id = oid;
  get diagnostics n = row_count;
  perform pg_temp.report('L-02', n > 0, 'COGS on a COMPLETED sale rewritten from 2000 to 1');
exception when others then perform pg_temp.report('L-02', false, 'rejected: ' || sqlerrm); end $$;

do $$ declare sid uuid; begin
  select id into sid from supplier limit 1;
  insert into purchase_invoice (business_id, supplier_id, invoice_no, amount_total) values
    ('00000000-0000-0000-0000-0000000000b1', sid, 'INV-7', 100000),
    ('00000000-0000-0000-0000-0000000000b1', sid, 'INV-7', 100000);
  perform pg_temp.report('M-07', true, 'the same supplier invoice number INV-7 was entered twice');
exception when others then perform pg_temp.report('M-07', false, 'rejected: ' || sqlerrm); end $$;
