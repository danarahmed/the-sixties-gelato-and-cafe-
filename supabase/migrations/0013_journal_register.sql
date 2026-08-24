-- =============================================================================
-- 0013_journal_register.sql — a proper manual-journal register.
--
-- Adds what a bookkeeper expects of a journal: its own number, a reference, a
-- narration, a draft/published state, and an optional reversal date.
--
-- Drafts are the reason the balance rule moves: an entry being written is
-- allowed to be out of balance, but nothing may be PUBLISHED unless debits
-- equal credits. The database still refuses to let an unbalanced entry into
-- the books — it just permits an unfinished one to be parked.
-- =============================================================================

create sequence if not exists journal_no_seq start 1001;

alter table journal_entry add column if not exists journal_no  integer;
alter table journal_entry add column if not exists reference_no text;
alter table journal_entry add column if not exists status       text not null default 'published';
alter table journal_entry add column if not exists reverse_on   date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'journal_entry_status_chk') then
    alter table journal_entry add constraint journal_entry_status_chk
      check (status in ('draft','published'));
  end if;
end $$;

-- Number the entries that already exist, oldest first.
update journal_entry je set journal_no = s.n
from (select id, 1000 + row_number() over (order by occurred_at, created_at) as n
      from journal_entry where journal_no is null) s
where je.id = s.id and je.journal_no is null;

select setval('journal_no_seq', greatest((select coalesce(max(journal_no), 1000) from journal_entry), 1000) + 1, false);

create unique index if not exists journal_entry_no_idx on journal_entry (business_id, journal_no);

-- --- Balance rule: enforced on published entries, deferred for drafts --------
create or replace function assert_entry_balanced() returns trigger
language plpgsql as $$
declare
  eid uuid := coalesce(NEW.journal_entry_id, OLD.journal_entry_id);
  st  text;
  d numeric;
  c numeric;
begin
  select status into st from journal_entry where id = eid;
  if st is null or st = 'draft' then
    return null;                      -- an entry still being written may not balance
  end if;
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into d, c
  from journal_line where journal_entry_id = eid;
  if d <> c then
    raise exception 'Journal entry % is unbalanced: debit % <> credit %', eid, d, c;
  end if;
  return null;
end;
$$;

-- Publishing a draft re-runs the same check.
create or replace function assert_publish_balanced() returns trigger
language plpgsql as $$
declare d numeric; c numeric;
begin
  if NEW.status = 'published' and coalesce(OLD.status,'') <> 'published' then
    select coalesce(sum(debit),0), coalesce(sum(credit),0) into d, c
    from journal_line where journal_entry_id = NEW.id;
    if d <> c then
      raise exception 'Cannot publish journal %: debit % <> credit %', NEW.id, d, c;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists journal_entry_publish_guard on journal_entry;
create constraint trigger journal_entry_publish_guard
  after update on journal_entry
  deferrable initially deferred
  for each row execute function assert_publish_balanced();

-- --- Access: publish a draft, and discard one that was never published ------
drop policy if exists demo_rw_upd on journal_entry;
create policy demo_rw_upd on journal_entry
  for update using (business_id = '00000000-0000-0000-0000-0000000000b1')
  with check (business_id = '00000000-0000-0000-0000-0000000000b1');
grant update on journal_entry to anon, authenticated;

drop policy if exists demo_rw_del_draft on journal_entry;
create policy demo_rw_del_draft on journal_entry
  for delete using (business_id = '00000000-0000-0000-0000-0000000000b1' and status = 'draft');
grant delete on journal_entry to anon, authenticated;

drop policy if exists demo_rw_del on journal_line;
create policy demo_rw_del on journal_line
  for delete using (
    journal_entry_id in (
      select id from journal_entry
      where business_id = '00000000-0000-0000-0000-0000000000b1' and status = 'draft'
    )
  );
grant delete on journal_line to anon, authenticated;
