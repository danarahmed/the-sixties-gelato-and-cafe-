-- =============================================================================
-- 0059 — The bank reconciled against its statement
-- =============================================================================
-- The drawers and the safe are counted against the books; the bank was not.
-- The owner, a general manager or the accountant (accounting.post) now
-- reconciles 1020 Bank with the bank's own statement: the statement's last
-- day, the balance the bank gives, and which of the books' bank lines are on
-- it. Anyone who sees costs reads it.
--
--  * A statement is kept only when the lines ticked take the bank from the
--    last statement's balance (nothing, for the first) to the one the bank
--    gives. Each line is on one statement; a line not on it yet stays open for
--    the next (a cheque not yet cashed, a transfer on its way).
--  * Statements follow one another: each ends after the last one kept. The
--    latest may be undone, with why, and its lines are open again.
--  * What the bank took or paid that the books do not have yet (a charge,
--    interest) is recorded first: a charge on Expenses, paid from the bank,
--    to 6500; interest by a journal. Then it is ticked like any line.
--  * An alert when a bank line is more than 35 days old and on no statement,
--    and a warning on the month's closing checklist (it does not stop the
--    lock) when a line to the month's last day is on none.
--  * Each statement kept or undone is on the audit trail (bank.reconcile,
--    bank.unreconcile), and each call may be retried with its key (0035).

-- =============================================================================
-- 1. The statements, and the bank's lines on each
-- =============================================================================
create table if not exists bank_statement (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references business(id),
  statement_no    bigint not null,
  statement_date  date not null,
  opening_balance numeric not null,
  closing_balance numeric not null,
  line_count      int not null check (line_count >= 0),
  money_in        numeric not null default 0 check (money_in >= 0),
  money_out       numeric not null default 0 check (money_out >= 0),
  note            text check (note is null or length(note) <= 500),
  status          text not null default 'kept' check (status in ('kept', 'undone')),
  created_by      uuid not null references app_user(id),
  created_at      timestamptz not null default now(),
  undo_reason     text check (undo_reason is null or length(undo_reason) <= 300),
  undone_by       uuid references app_user(id),
  undone_at       timestamptz,
  unique (business_id, statement_no),
  check (closing_balance = opening_balance + money_in - money_out),
  check ((status = 'undone') = (undone_at is not null) and (undone_at is null) = (undone_by is null)
         and (undone_at is null) = (undo_reason is null))
);
create index if not exists bank_statement_recent on bank_statement (business_id, statement_date desc);

-- A line of 1020 on a statement kept: each on one at most. An undone
-- statement's lines are taken off it, so they are open again.
create table if not exists bank_statement_line (
  journal_line_id uuid primary key references journal_line(id),
  statement_id    uuid not null references bank_statement(id),
  business_id     uuid not null references business(id)
);
create index if not exists bank_statement_line_statement on bank_statement_line (statement_id);

alter table bank_statement enable row level security;
alter table bank_statement force row level security;
alter table bank_statement_line enable row level security;
alter table bank_statement_line force row level security;
drop policy if exists bank_statement_read on bank_statement;
create policy bank_statement_read on bank_statement for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
drop policy if exists bank_statement_line_read on bank_statement_line;
create policy bank_statement_line_read on bank_statement_line for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
revoke all on bank_statement, bank_statement_line from anon, authenticated;
grant select on bank_statement, bank_statement_line to authenticated;

-- A statement stays as it was kept: it is undone once, and never deleted.
create or replace function trg_bank_statement_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'A bank statement is never deleted: undo it instead';
  end if;
  if OLD.status = 'undone' then
    raise exception 'Bank statement % was undone already', OLD.statement_no;
  end if;
  if (NEW.business_id, NEW.statement_no, NEW.statement_date, NEW.opening_balance, NEW.closing_balance,
      NEW.line_count, NEW.money_in, NEW.money_out, NEW.note, NEW.created_by, NEW.created_at)
     is distinct from
     (OLD.business_id, OLD.statement_no, OLD.statement_date, OLD.opening_balance, OLD.closing_balance,
      OLD.line_count, OLD.money_in, OLD.money_out, OLD.note, OLD.created_by, OLD.created_at) then
    raise exception 'A bank statement stays as it was kept';
  end if;
  return NEW;
end $$;
drop trigger if exists bank_statement_guard on bank_statement;
create trigger bank_statement_guard before update or delete on bank_statement
  for each row execute function trg_bank_statement_guard();

create or replace function trg_bank_statement_line_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'A line on a bank statement is not changed: undo the statement instead';
end $$;
drop trigger if exists bank_statement_line_guard on bank_statement_line;
create trigger bank_statement_line_guard before update on bank_statement_line
  for each row execute function trg_bank_statement_line_guard();

-- =============================================================================
-- 2. The bank's lines in the books
-- =============================================================================
-- Every published line of 1020 to the end of a day, the day it happened in the
-- café's time, and the statement it is on (none: open).
create or replace function bank_lines(p_business uuid, p_to date)
returns table (line_id uuid, journal_no int, day date, description text, amount numeric, statement_no bigint)
language sql stable set search_path = public as $$
  select l.id, e.journal_no, business_local_date(p_business, e.occurred_at),
         coalesce(nullif(btrim(l.memo), ''), e.description), l.debit - l.credit, s.statement_no
    from journal_line l
    join journal_entry e on e.id = l.journal_entry_id
    join gl_account a on a.id = l.account_id
    left join bank_statement_line bl on bl.journal_line_id = l.id
    left join bank_statement s on s.id = bl.statement_id
   where e.business_id = p_business and a.business_id = p_business and a.code = '1020'
     and e.status = 'published'
     and e.occurred_at < (local_day_bounds(p_business, p_to, p_to)).to_ts
$$;

-- What the screen shows: the books' bank to the day, the last statement kept,
-- the lines on no statement yet, and the statements.
create or replace function bank_book(p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_to date := coalesce(p_to, business_local_date(v_business, now()));
  v_last bank_statement;
begin
  select * into v_last from bank_statement where business_id = v_business and status = 'kept'
   order by statement_date desc, statement_no desc limit 1;
  return jsonb_build_object(
    'to', v_to,
    'books', gl_balance_at(v_business, '1020', (local_day_bounds(v_business, v_to, v_to)).to_ts),
    'last', case when v_last.id is null then null else jsonb_build_object(
              'id', v_last.id, 'statement_no', v_last.statement_no, 'statement_date', v_last.statement_date,
              'closing_balance', v_last.closing_balance) end,
    'open', coalesce((select jsonb_agg(jsonb_build_object('line_id', b.line_id, 'journal_no', b.journal_no,
                                                          'day', b.day, 'description', b.description,
                                                          'amount', b.amount) order by b.day, b.journal_no, b.line_id)
                        from bank_lines(v_business, v_to) b where b.statement_no is null), '[]'::jsonb),
    'statements', coalesce((select jsonb_agg(x order by x ->> 'statement_date' desc, (x ->> 'statement_no')::bigint desc)
                              from (select jsonb_build_object(
                                      'id', s.id, 'statement_no', s.statement_no, 'statement_date', s.statement_date,
                                      'opening_balance', s.opening_balance, 'closing_balance', s.closing_balance,
                                      'line_count', s.line_count, 'money_in', s.money_in, 'money_out', s.money_out,
                                      'note', s.note, 'status', s.status, 'by', u.full_name, 'at', s.created_at,
                                      'undo_reason', s.undo_reason) x
                                      from bank_statement s left join app_user u on u.id = s.created_by
                                     where s.business_id = v_business
                                     order by s.statement_date desc, s.statement_no desc limit 24) y), '[]'::jsonb));
end $$;

-- =============================================================================
-- 3. A statement kept
-- =============================================================================
create or replace function save_bank_statement__run(p_date date, p_closing numeric, p_lines uuid[], p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_lines uuid[] := array(select distinct x from unnest(coalesce(p_lines, '{}'::uuid[])) x where x is not null);
  v_last bank_statement; v_opening numeric; v_in numeric; v_out numeric; v_n int; v_no bigint; v_id uuid;
begin
  if p_date is null then raise exception 'Give the statement''s last day'; end if;
  if p_date > business_local_date(v_business, now()) then
    raise exception 'A statement cannot end after today';
  end if;
  if p_closing is null then raise exception 'Give the balance the bank''s statement shows'; end if;
  if v_note is not null and length(v_note) > 500 then raise exception 'A note is at most 500 letters'; end if;
  -- One at a time: two statements kept at once cannot take the same lines.
  perform pg_advisory_xact_lock(hashtext('bank_statement:' || v_business::text));
  select * into v_last from bank_statement where business_id = v_business and status = 'kept'
   order by statement_date desc, statement_no desc limit 1;
  if v_last.id is not null and p_date <= v_last.statement_date then
    raise exception 'Statement % ends on %: the next one ends after it', v_last.statement_no, v_last.statement_date;
  end if;
  v_opening := coalesce(v_last.closing_balance, 0);
  select count(*), coalesce(sum(greatest(b.amount, 0)), 0), coalesce(sum(greatest(-b.amount, 0)), 0)
    into v_n, v_in, v_out
    from bank_lines(v_business, p_date) b
   where b.line_id = any(v_lines) and b.statement_no is null;
  if v_n <> cardinality(v_lines) then
    raise exception 'A line ticked is not one of the bank''s lines to % still open', p_date;
  end if;
  if v_opening + v_in - v_out <> p_closing then
    raise exception 'The lines ticked take the bank to %, and the statement says %: % apart',
      trim_scale(v_opening + v_in - v_out), trim_scale(p_closing), trim_scale(p_closing - (v_opening + v_in - v_out));
  end if;
  v_no := next_document_no(v_business, 'bank_statement', 1);
  insert into bank_statement (business_id, statement_no, statement_date, opening_balance, closing_balance,
                              line_count, money_in, money_out, note, created_by)
  values (v_business, v_no, p_date, v_opening, p_closing, v_n, v_in, v_out, v_note, current_app_user_id())
  returning id into v_id;
  insert into bank_statement_line (journal_line_id, statement_id, business_id)
  select x, v_id, v_business from unnest(v_lines) x;
  return jsonb_build_object('id', v_id, 'statement_no', v_no, 'statement_date', p_date,
                            'opening_balance', v_opening, 'closing_balance', p_closing,
                            'line_count', v_n, 'money_in', v_in, 'money_out', v_out);
end $$;

create or replace function save_bank_statement(p_date date, p_closing numeric, p_lines uuid[],
                                               p_note text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_date', p_date, 'p_closing', p_closing, 'p_lines', to_jsonb(p_lines),
                                    'p_note', p_note);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_bank_statement', v_req);
  if v is not null then return v; end if;
  v := save_bank_statement__run(p_date => p_date, p_closing => p_closing, p_lines => p_lines, p_note => p_note);
  perform audit_event(v_business, 'bank.reconcile', 'bank_statement', v ->> 'id', null, null, v - 'id');
  perform idem_finish(v_business, p_idempotency_key, 'save_bank_statement', v_req, v);
  return v;
end $$;

-- =============================================================================
-- 4. The latest statement undone
-- =============================================================================
create or replace function undo_bank_statement__run(p_statement uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  s bank_statement; v_later bigint;
begin
  if v_reason is null then raise exception 'Say why'; end if;
  if length(v_reason) > 300 then raise exception 'A reason is at most 300 letters'; end if;
  perform pg_advisory_xact_lock(hashtext('bank_statement:' || v_business::text));
  select * into s from bank_statement where id = p_statement and business_id = v_business for update;
  if s.id is null then raise exception 'There is no such bank statement'; end if;
  if s.status = 'undone' then raise exception 'Bank statement % was undone already', s.statement_no; end if;
  select statement_no into v_later from bank_statement
   where business_id = v_business and status = 'kept' and id <> s.id
     and (statement_date, statement_no) > (s.statement_date, s.statement_no)
   order by statement_date, statement_no limit 1;
  if v_later is not null then
    raise exception 'Statement % comes after it: undo the latest first', v_later;
  end if;
  delete from bank_statement_line where statement_id = s.id;
  update bank_statement set status = 'undone', undo_reason = v_reason, undone_by = current_app_user_id(),
                            undone_at = now()
   where id = s.id;
  return jsonb_build_object('id', s.id, 'statement_no', s.statement_no, 'reason', v_reason,
                            'before', jsonb_build_object('statement_no', s.statement_no,
                                                         'statement_date', s.statement_date,
                                                         'closing_balance', s.closing_balance,
                                                         'line_count', s.line_count, 'status', 'kept'),
                            'after', jsonb_build_object('status', 'undone'));
end $$;

create or replace function undo_bank_statement(p_statement uuid, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_statement', p_statement, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'undo_bank_statement', v_req);
  if v is not null then return v; end if;
  v := undo_bank_statement__run(p_statement => p_statement, p_reason => p_reason);
  perform audit_event(v_business, 'bank.unreconcile', 'bank_statement', v ->> 'id', v ->> 'reason',
                      v -> 'before', v -> 'after');
  v := jsonb_build_object('id', v ->> 'id', 'statement_no', (v ->> 'statement_no')::bigint, 'status', 'undone');
  perform idem_finish(v_business, p_idempotency_key, 'undo_bank_statement', v_req, v);
  return v;
end $$;

-- =============================================================================
-- 5. The alert, and the month's closing checklist
-- =============================================================================
-- 0049's rules stay as they are. A bank line more than 35 days old and on no
-- statement: orange, to reconcile the bank.
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0049;
revoke execute on function alert_conditions_0049(uuid, timestamptz) from public, anon, authenticated;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0049(p_business, p_now) c
  union all
  select 'bank_unreconciled'::text, 'bank'::text, 'orange'::text,
         format('%s bank line(s), the oldest from %s, are on no bank statement', x.n, x.oldest),
         'The bank''s own statement shows whether the books have every payment in and out of the bank.',
         'Reconcile the bank with its statement on Chart of Accounts.',
         'high', '/accounting/bank', jsonb_build_object('lines', x.n, 'oldest', x.oldest)
    from (select count(*) n, min(b.day) oldest
            from bank_lines(p_business, business_local_date(p_business, p_now)) b
           where b.statement_no is null and b.day < business_local_date(p_business, p_now) - 35) x
   where x.n > 0
$$;

-- 0054's checklist, and a warning (it does not stop the lock): every bank line
-- to the month's last day on a statement.
alter function period_close_checklist(uuid) rename to period_close_checklist_0054;
revoke execute on function period_close_checklist_0054(uuid) from public, anon, authenticated;
create or replace function period_close_checklist(p_period uuid)
returns table (check_key text, label text, ok boolean, detail text, blocks boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.period.lock', 'accounting.post', 'audit.view');
  p accounting_period; n int; v_first date;
begin
  return query select * from period_close_checklist_0054(p_period);
  select * into p from accounting_period where id = p_period and business_id = v_business;
  select count(*), min(b.day) into n, v_first from bank_lines(v_business, p.ends_on) b where b.statement_no is null;
  check_key := 'bank'; label := 'The bank is reconciled to the month''s end'; blocks := false; ok := n = 0;
  detail := case when n > 0 then format('%s bank line(s) to %s, the first from %s, are on no bank statement',
                                        n, p.ends_on, v_first) end;
  return next;
end $$;

-- =============================================================================
-- 6. Who may call what
-- =============================================================================
revoke execute on function
  bank_lines(uuid, date), trg_bank_statement_guard(), trg_bank_statement_line_guard(),
  save_bank_statement__run(date, numeric, uuid[], text), undo_bank_statement__run(uuid, text)
  from public, anon, authenticated;
revoke execute on function
  bank_book(date), save_bank_statement(date, numeric, uuid[], text, uuid), undo_bank_statement(uuid, text, uuid),
  period_close_checklist(uuid)
  from public, anon;
grant execute on function
  bank_book(date), save_bank_statement(date, numeric, uuid[], text, uuid), undo_bank_statement(uuid, text, uuid),
  period_close_checklist(uuid)
  to authenticated;
