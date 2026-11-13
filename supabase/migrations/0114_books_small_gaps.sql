-- 0114: three of the books' smaller gaps (plan 6, item 11; the owner, 8 and
-- 12 November).
--
--   * d. A payment out of the till, recorded a day late, explains that day's
--     short. The drawer closed yesterday 20,000 short (Dr 6300); the ice, paid
--     from it yesterday and recorded today, is a cost of yesterday that the
--     short already took out of the drawer: Dr the cost, Cr 6300, dated that
--     day, and today's drawer untouched. Up to the short: a payment larger than
--     what is left of it, or a day with no short, is recorded today as before
--     (0064: money out of the till is recorded the day it is taken out).
--   * e. A prepaid expense is changed before its first month's share is
--     posted (what it is, the account, the months), and each month's share is
--     posted by itself overnight as its month comes; the button stays.
--   * f. A payroll's cost is shared between places by the hours each person
--     clocked at each that month; someone with no hours, by where they work.
--
-- Nothing recorded changes: approved payrolls keep how they were shared.

-- =============================================================================
-- d. A late payment explains that day's short
-- =============================================================================
create table if not exists drawer_short_explained (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  work_shift_id uuid not null references work_shift(id),
  expense_id    uuid not null unique references expense(id),
  amount        numeric not null check (amount > 0),
  created_by    uuid references app_user(id),
  created_at    timestamptz not null default now()
);
alter table drawer_short_explained enable row level security;
alter table drawer_short_explained force row level security;

-- The closed day at a place whose drawer was short by at least the amount, net of what explained it already.
create or replace function short_to_explain(p_business uuid, p_location uuid, p_day date, p_amount numeric)
returns uuid language sql stable security definer set search_path = public as $$
  select w.id
    from work_shift w
   where w.business_id = p_business and w.location_id = p_location and w.kind in ('day', 'session')
     and w.business_day = p_day and w.closed_at is not null and coalesce(w.variance, 0) < 0
     and -w.variance - coalesce((select sum(x.amount) from drawer_short_explained x where x.work_shift_id = w.id), 0)
         >= p_amount
   order by w.closed_at desc
   limit 1
$$;

alter function record_expense__run(text, numeric, text, text, date, uuid) rename to record_expense__run_0113;

create or replace function record_expense__run(
  p_description text, p_amount numeric, p_account_code text, p_paid_from text default 'cash', p_date date default null,
  p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('expense.record');
  v_me uuid := (current_member()).id;
  v_from text := lower(coalesce(p_paid_from, '')); v_amount numeric; v_location uuid; v_shift uuid;
  v_acct gl_account; v_exp uuid := gen_random_uuid(); v_journal uuid; w work_shift;
begin
  if v_from = 'cash' then v_from := 'till'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_from <> 'till' or p_date is null or p_date >= business_local_date(v_business, now())
     or v_amount is null or v_amount <= 0 or nullif(trim(p_description), '') is null then
    return record_expense__run_0113(p_description, p_amount, p_account_code, p_paid_from, p_date, p_location);
  end if;
  select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
  if not found or v_acct.account_type <> 'expense' or p_account_code in ('5000', '5050', '5300', '5310', '5400') then
    return record_expense__run_0113(p_description, p_amount, p_account_code, p_paid_from, p_date, p_location);
  end if;
  v_location := resolve_location(v_business, p_location);
  -- One explanation at a time for the day's drawer.
  perform 1 from work_shift where business_id = v_business and location_id = v_location
     and business_day = p_date and kind in ('day', 'session') for update;
  v_shift := short_to_explain(v_business, v_location, p_date, v_amount);
  if v_shift is null then
    return record_expense__run_0113(p_description, p_amount, p_account_code, p_paid_from, p_date, p_location);
  end if;
  select * into w from work_shift where id = v_shift;
  v_journal := post_journal(v_business, (p_date + time '12:00') at time zone (select timezone from business where id = v_business),
    'Expense: ' || trim(p_description) || ' (explains the drawer''s short of ' || to_char(p_date, 'YYYY-MM-DD') || ')',
    'expense', v_exp,
    jsonb_build_array(jsonb_build_object('code', p_account_code, 'debit', v_amount),
                      jsonb_build_object('code', '6300', 'credit', v_amount)));
  insert into expense (id, business_id, location_id, amount, incurred_on, description, journal_entry_id, created_by)
  values (v_exp, v_business, v_location, v_amount, p_date, trim(p_description), v_journal, v_me);
  insert into drawer_short_explained (business_id, work_shift_id, expense_id, amount, created_by)
  values (v_business, v_shift, v_exp, v_amount, v_me);
  perform audit_event(v_business, 'expense.explains_short', 'expense', v_exp::text, null,
    jsonb_build_object('short', -w.variance, 'session_no', w.session_no),
    jsonb_build_object('amount', v_amount, 'day', p_date, 'description', trim(p_description)));
  return jsonb_build_object('expense_id', v_exp, 'journal_no', (select journal_no from journal_entry where id = v_journal),
    'explains_short', jsonb_build_object('day', p_date, 'session_no', w.session_no, 'short', -w.variance,
                                         'amount', v_amount));
end $$;

-- =============================================================================
-- e. A prepaid expense changed before its first share; its shares by themselves
-- =============================================================================
-- 0060's guard: what it is, the account and the months change while no share
-- is posted and the change comes from update_prepaid_expense.
create or replace function trg_prepaid_expense_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'A prepaid expense is never deleted: cancel it instead';
  end if;
  if OLD.cancelled_at is not null then
    raise exception 'That prepaid expense was cancelled already';
  end if;
  if (NEW.business_id, NEW.location_id, NEW.paid_from, NEW.amount, NEW.journal_entry_id, NEW.created_by, NEW.created_at)
     is distinct from
     (OLD.business_id, OLD.location_id, OLD.paid_from, OLD.amount, OLD.journal_entry_id, OLD.created_by, OLD.created_at)
     or ((NEW.description, NEW.account_id, NEW.first_month, NEW.months)
         is distinct from (OLD.description, OLD.account_id, OLD.first_month, OLD.months)
         and (coalesce(current_setting('sixties.prepaid_edit', true), '') <> 'on'
              or exists (select 1 from prepaid_release r where r.prepaid_id = OLD.id))) then
    raise exception 'A prepaid expense stays as it was recorded once a share is posted: cancel it and record it again';
  end if;
  return NEW;
end $$;

-- (expense.record) What it is, its account and its months, before its first share is posted.
create or replace function update_prepaid_expense(p_prepaid uuid, p_description text, p_account_code text,
                                                  p_first_month date, p_months int, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('expense.record');
  v_req jsonb := jsonb_build_object('prepaid', p_prepaid, 'description', p_description, 'account', p_account_code,
                                    'first_month', p_first_month, 'months', p_months);
  v jsonb; pe prepaid_expense; v_acct gl_account; v_first date; v_this date; v_released jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'update_prepaid_expense', v_req);
  if v is not null then return v; end if;
  select * into pe from prepaid_expense where id = p_prepaid and business_id = v_business for update;
  if pe.id is null then raise exception 'Prepaid expense not found'; end if;
  if pe.cancelled_at is not null then raise exception 'That prepaid expense was cancelled already'; end if;
  if exists (select 1 from prepaid_release r where r.prepaid_id = pe.id) then
    raise exception 'A prepaid expense stays as it was recorded once a share is posted: cancel it and record it again';
  end if;
  if nullif(trim(p_description), '') is null then raise exception 'Describe the expense'; end if;
  select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
  if not found or v_acct.account_type <> 'expense' or p_account_code in ('5000', '5050', '5300', '5310', '5400') then
    raise exception 'Account % cannot take an expense (stock costs come from their own records)', p_account_code;
  end if;
  v_this := date_trunc('month', business_local_date(v_business, now()))::date;
  v_first := date_trunc('month', p_first_month)::date;
  if p_months is null or p_months < 1 or p_months > 36 then
    raise exception 'A prepaid expense covers 1 to 36 months';
  end if;
  if v_first is null or v_first < v_this then
    raise exception 'A prepaid expense starts this month or later: what it paid for before is an expense of those months';
  end if;
  if p_months = 1 and v_first = v_this then raise exception 'For this month alone, record an expense'; end if;
  if v_first > v_this + interval '12 months' then raise exception 'A prepaid expense starts within a year'; end if;
  if pe.amount < p_months then
    raise exception 'Each month takes at least 1 of it: pay at least %, or cover fewer months', p_months;
  end if;
  perform set_config('sixties.prepaid_edit', 'on', true);
  update prepaid_expense set description = trim(p_description), account_id = v_acct.id, first_month = v_first,
                             months = p_months
   where id = pe.id;
  perform set_config('sixties.prepaid_edit', '', true);
  perform audit_event(v_business, 'prepaid.update', 'prepaid_expense', pe.id::text, null,
    jsonb_build_object('description', pe.description, 'first_month', pe.first_month, 'months', pe.months),
    jsonb_build_object('description', trim(p_description), 'account', p_account_code, 'first_month', v_first,
                       'months', p_months));
  -- Starting this month now: its share is due, and posted as recording it would.
  v_released := release_prepaid__run(v_business, business_local_date(v_business, now()), (current_member()).id, pe.id);
  v := jsonb_build_object('prepaid_id', pe.id, 'released', v_released);
  perform idem_finish(v_business, p_idempotency_key, 'update_prepaid_expense', v_req, v);
  return v;
end $$;

-- (internal) Each café's shares due, posted overnight, each by whoever recorded it.
create or replace function prepaid_tick() returns int
language plpgsql security definer set search_path = public as $$
declare x record; n int := 0;
begin
  for x in
    select pe.id, pe.business_id, pe.created_by
      from prepaid_expense pe
     where pe.cancelled_at is null
       and exists (select 1 from prepaid_shares(pe.business_id, pe.amount, pe.months, pe.first_month) s
                    where s.month <= date_trunc('month', business_local_date(pe.business_id, now()))::date
                      and not exists (select 1 from prepaid_release r where r.prepaid_id = pe.id and r.month = s.month))
  loop
    begin
      n := n + jsonb_array_length(release_prepaid__run(x.business_id, business_local_date(x.business_id, now()),
                                                       x.created_by, x.id));
    exception when others then
      -- A locked month, or a business closed: left for the button and the month-end checklist.
      null;
    end;
  end loop;
  return n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sixties-prepaid';
    -- 22:15 UTC: 01:15 in Erbil, the new day's shares once its month has come.
    perform cron.schedule('sixties-prepaid', '15 22 * * *', 'select public.prepaid_tick()');
  end if;
end $$;

-- =============================================================================
-- f. A payroll shared between places by the hours clocked at each
-- =============================================================================
-- 0090's share of a payroll's salaries' cost (the pay less the tips): each
-- person's by the minutes they clocked at each place in the payroll's month;
-- someone with no hours, at the place they work. Rounded to the dinar, the
-- rest at the place they clocked most.
create or replace function payroll_gross_by_place(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r payroll_run; l record; p record; v_total numeric; v_left numeric; v_part numeric; v_top uuid;
  v_out jsonb := '{}'::jsonb; v_place text;
begin
  select * into r from payroll_run where id = p_run;
  if r.id is null then return '{}'::jsonb; end if;
  for l in
    select pl.employee_id, e.location_id as home, pl.gross - coalesce(pl.tips, 0) as cost
      from payroll_line pl join employee e on e.id = pl.employee_id
     where pl.run_id = p_run and pl.gross - coalesce(pl.tips, 0) <> 0
  loop
    select coalesce(sum(extract(epoch from (a.clock_out - a.clock_in)) / 60), 0) into v_total
      from attendance a
     where a.employee_id = l.employee_id and a.cancelled_at is null and a.clock_out is not null
       and a.work_day >= r.month and a.work_day < (r.month + interval '1 month')::date;
    if v_total <= 0 then
      v_place := l.home::text;
      v_out := jsonb_set(v_out, array[v_place], to_jsonb(coalesce((v_out ->> v_place)::numeric, 0) + l.cost));
      continue;
    end if;
    v_left := l.cost; v_top := null;
    for p in
      select a.location_id, sum(extract(epoch from (a.clock_out - a.clock_in)) / 60) as minutes
        from attendance a
       where a.employee_id = l.employee_id and a.cancelled_at is null and a.clock_out is not null
         and a.work_day >= r.month and a.work_day < (r.month + interval '1 month')::date
       group by a.location_id
       order by minutes desc, a.location_id
    loop
      if v_top is null then v_top := p.location_id; end if;
      v_part := money_round(r.business_id, l.cost * p.minutes / v_total);
      v_left := v_left - v_part;
      v_place := p.location_id::text;
      v_out := jsonb_set(v_out, array[v_place], to_jsonb(coalesce((v_out ->> v_place)::numeric, 0) + v_part));
    end loop;
    if v_left <> 0 then
      v_place := v_top::text;
      v_out := jsonb_set(v_out, array[v_place], to_jsonb((v_out ->> v_place)::numeric + v_left));
    end if;
  end loop;
  return coalesce((select jsonb_object_agg(k, v) from jsonb_each(v_out) x(k, v) where (v #>> '{}')::numeric <> 0),
                  '{}'::jsonb);
end $$;

revoke execute on function short_to_explain(uuid, uuid, date, numeric),
  record_expense__run(text, numeric, text, text, date, uuid),
  record_expense__run_0113(text, numeric, text, text, date, uuid), prepaid_tick(), payroll_gross_by_place(uuid)
  from public, anon, authenticated;
revoke execute on function update_prepaid_expense(uuid, text, text, date, int, uuid) from public, anon;
grant execute on function update_prepaid_expense(uuid, text, text, date, int, uuid) to authenticated;
