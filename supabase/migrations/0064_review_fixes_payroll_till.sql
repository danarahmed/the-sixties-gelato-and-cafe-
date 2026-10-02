-- =============================================================================
-- 0064 — What a review of the releases since 0035 found, put right (2 of 4)
-- =============================================================================
-- Five reviews, one for each part of what 0035 to 0057 built, each finding
-- checked against the code before it was put right. 0063 to 0066 put right
-- what they found, each small enough to apply in one call; this one:
--
--  * Payroll (0049): reopened in a later month, a payroll's cost moved into
--    that month; a cancelled payment left the month's payroll undraftable; and
--    the journals of salaries paid and advances given named the people, read
--    by everyone who sees costs.
--  * The till (0024, 0055): an expense from the till or the safe dated an
--    earlier day put that day's drawer or safe out for good.
-- No table changes, and nothing recorded changes.

-- =============================================================================
-- 1. Payroll
-- =============================================================================
-- 0049's reopen, reversing the approval in its own month: reopened later, the
-- cost went out of the month it was reopened in and stayed in its own. A
-- locked month now refuses the reopen as it refuses the approval.

create or replace function reopen_payroll__run(p_run uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  r payroll_run; a payroll_approval; v_rev uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the payroll is reopened'; end if;
  select * into r from payroll_run where id = p_run and business_id = v_business for update;
  if not found then raise exception 'Payroll not found'; end if;
  if r.status = 'draft' then raise exception 'This payroll is a draft already'; end if;
  if exists (select 1 from salary_payment p where p.run_id = r.id and p.cancelled_at is null) then
    raise exception 'Salaries were paid from this payroll: cancel the payments first';
  end if;
  select * into a from payroll_approval where run_id = r.id and reopened_at is null for update;
  if a.journal_entry_id is not null then
    -- In the month the approval was posted in: reopened later, the cost stayed
    -- there and went out of the month it was reopened in (0063).
    v_rev := reverse_entry_internal(a.journal_entry_id,
                                    (select occurred_at from journal_entry where id = a.journal_entry_id),
                                    'Payroll reopened: ' || trim(p_reason));
  end if;
  update payroll_approval set reopened_by = v_me, reopened_at = now(), reopen_reason = trim(p_reason),
                              reopen_journal_id = v_rev
   where id = a.id;
  update payroll_run set status = 'draft', approved_by = null, approved_at = null, journal_entry_id = null
   where id = r.id;
  return jsonb_build_object('run_id', r.id, 'run_no', r.run_no, 'month', r.month, 'was', r.status,
                            'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- 0049's draft, keeping a line once paid from: a payment cancelled is kept for
-- good, and its lines point at the payroll's line, so deleting it failed and
-- the month could not be drafted again.

create or replace function payroll_refresh(p_business uuid, p_run uuid) returns void
language plpgsql set search_path = public as $$
declare
  r payroll_run; e employee; f record; l payroll_line; v_start date; v_end date; v_owed numeric; v_gross numeric;
  v_recover numeric; v_ded numeric;
begin
  select * into r from payroll_run where id = p_run;
  v_start := r.month;
  v_end := (r.month + interval '1 month - 1 day')::date;
  -- Someone not employed that month leaves the payroll. A line paid from once
  -- (a payment since cancelled, which is kept for good) stays, at nothing (0063).
  update payroll_line x
     set base_pay = 0, overtime_pay = 0, additions = 0, deductions = 0, advance_owed = 0, advance_recovered = 0,
         recovery_set = false, gross = 0, net = 0, days_employed = 0, days_worked = 0, minutes_worked = 0,
         overtime_minutes = 0, days_scheduled = 0, days_absent = 0, times_late = 0, minutes_late = 0,
         still_in = false
   where x.run_id = r.id
     and not exists (select 1 from employee y where y.id = x.employee_id and y.hired_on <= v_end
                       and (y.left_on is null or y.left_on >= v_start))
     and exists (select 1 from salary_payment_line pl where pl.line_id = x.id);
  delete from payroll_line x where x.run_id = r.id
     and not exists (select 1 from employee y where y.id = x.employee_id and y.hired_on <= v_end
                       and (y.left_on is null or y.left_on >= v_start))
     and not exists (select 1 from salary_payment_line pl where pl.line_id = x.id);
  for e in select * from employee y where y.business_id = p_business and y.hired_on <= v_end
                                     and (y.left_on is null or y.left_on >= v_start)
            order by y.full_name loop
    select * into f from payroll_figures(p_business, e, r.month);
    select * into l from payroll_line x where x.run_id = r.id and x.employee_id = e.id;
    v_owed := advance_owed(p_business, e.id);
    -- Deductions beyond what is now earned are cut to it.
    v_ded := least(coalesce(l.deductions, 0), f.base_pay + f.overtime_pay + coalesce(l.additions, 0));
    v_gross := f.base_pay + f.overtime_pay + coalesce(l.additions, 0) - v_ded;
    v_recover := case when coalesce(l.recovery_set, false) then least(l.advance_recovered, greatest(v_owed, 0), v_gross)
                      else least(greatest(v_owed, 0), v_gross) end;
    if l.id is null then
      insert into payroll_line (run_id, business_id, employee_id, pay_basis, rate, standard_hours, overtime_percent,
                                days_in_month, days_employed, days_worked, minutes_worked, overtime_minutes,
                                days_scheduled, days_absent, times_late, minutes_late, still_in, base_pay, overtime_pay,
                                advance_owed, advance_recovered, gross, net)
      values (r.id, p_business, e.id, e.pay_basis, e.rate, e.standard_hours, f.overtime_percent,
              f.days_in_month, f.days_employed, f.days_worked, f.minutes_worked, f.overtime_minutes,
              f.days_scheduled, f.days_absent, f.times_late, f.minutes_late, f.still_in, f.base_pay, f.overtime_pay,
              v_owed, v_recover, v_gross, v_gross - v_recover);
    else
      update payroll_line set pay_basis = e.pay_basis, rate = e.rate, standard_hours = e.standard_hours,
             overtime_percent = f.overtime_percent, days_in_month = f.days_in_month,
             days_employed = f.days_employed, days_worked = f.days_worked, minutes_worked = f.minutes_worked,
             overtime_minutes = f.overtime_minutes, days_scheduled = f.days_scheduled, days_absent = f.days_absent,
             times_late = f.times_late, minutes_late = f.minutes_late, still_in = f.still_in,
             base_pay = f.base_pay, overtime_pay = f.overtime_pay,
             deductions = v_ded,
             advance_owed = v_owed, advance_recovered = v_recover, gross = v_gross, net = v_gross - v_recover
       where id = l.id;
    end if;
  end loop;
  update payroll_run set drafted_at = now(), drafted_by = (current_member()).id where id = r.id;
end $$;

-- 0049's check that a draft is as the records stand, with such a line in it.

create or replace function payroll_current(p_business uuid, p_run uuid) returns boolean
language plpgsql stable set search_path = public as $$
declare r payroll_run; e employee; f record; l payroll_line; v_start date; v_end date;
begin
  select * into r from payroll_run where id = p_run;
  v_start := r.month;
  v_end := (r.month + interval '1 month - 1 day')::date;
  if exists (select 1 from payroll_line x join employee y on y.id = x.employee_id
              where x.run_id = r.id and not (y.hired_on <= v_end and (y.left_on is null or y.left_on >= v_start))
                -- A line paid from once, kept at nothing, is as it should be (0063).
                and not (x.gross = 0 and x.net = 0 and x.advance_recovered = 0
                         and exists (select 1 from salary_payment_line pl where pl.line_id = x.id))) then
    return false;
  end if;
  for e in select * from employee y where y.business_id = p_business and y.hired_on <= v_end
                                     and (y.left_on is null or y.left_on >= v_start) loop
    select * into l from payroll_line x where x.run_id = r.id and x.employee_id = e.id;
    if l.id is null then return false; end if;
    select * into f from payroll_figures(p_business, e, r.month);
    if (l.pay_basis, l.rate, l.standard_hours, l.overtime_percent, l.days_employed, l.days_worked, l.minutes_worked,
        l.overtime_minutes, l.still_in, l.base_pay, l.overtime_pay)
       is distinct from (e.pay_basis, e.rate, e.standard_hours, f.overtime_percent, f.days_employed, f.days_worked,
                         f.minutes_worked, f.overtime_minutes, f.still_in, f.base_pay, f.overtime_pay) then
      return false;
    end if;
    if l.advance_recovered > greatest(advance_owed(p_business, e.id), 0)
       or (not l.recovery_set and l.advance_recovered <> least(greatest(advance_owed(p_business, e.id), 0), l.gross)) then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- 0049's payment and 0055's advance, their journals no longer naming anyone:
-- the journals are read by those who see costs, pay by those who see payroll.

create or replace function pay_salaries(p_business uuid, r payroll_run, p_lines jsonb, p_from text, p_me uuid)
returns uuid language plpgsql set search_path = public as $$
declare
  v_id uuid := gen_random_uuid(); v_total numeric; v_loc uuid := resolve_location(p_business, null); v_journal uuid;
begin
  select coalesce(sum((x ->> 'amount')::numeric), 0) into v_total from jsonb_array_elements(p_lines) x;
  -- Named by its payroll, not by whom it pays: the journals are read by those
  -- who see costs, and pay is for those who see payroll (0063).
  v_journal := post_journal(p_business, now(),
    'Salaries ' || payroll_month_text(r.month) || ' (payroll ' || r.run_no || ')', 'salary_payment', v_id,
    jsonb_build_array(jsonb_build_object('code', '2100', 'debit', v_total),
                      jsonb_build_object('code', payment_account(p_from), 'credit', v_total)));
  insert into salary_payment (id, business_id, run_id, paid_from, location_id, amount, paid_on, journal_entry_id,
                              created_by)
  values (v_id, p_business, r.id, p_from, v_loc, v_total, business_local_date(p_business, now()), v_journal, p_me);
  insert into salary_payment_line (payment_id, business_id, line_id, employee_id, amount)
  select v_id, p_business, l.id, l.employee_id, (x ->> 'amount')::numeric
    from jsonb_array_elements(p_lines) x join payroll_line l on l.id = (x ->> 'line_id')::uuid;
  perform pay_out_of(p_business, v_loc, p_from, v_total, 'salary_payment', v_id, p_me);
  -- Paid in full, the payroll is paid.
  if not exists (select 1 from payroll_line l where l.run_id = r.id and l.net > payroll_line_paid(l.id)) then
    update payroll_run set status = 'paid' where id = r.id;
  end if;
  return v_id;
end $$;

create or replace function record_advance__run(p_employee uuid, p_amount numeric, p_paid_from text, p_reason text,
                                               p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  v_from text := staff_paid_from(p_paid_from);
  v_amount numeric := money_round(v_business, p_amount);
  v_today date := business_local_date(v_business, now());
  e employee; v_id uuid := gen_random_uuid(); v_journal uuid; v_loc uuid;
begin
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say what the advance is for'; end if;
  e := staff_member(v_business, p_employee, true);
  if not works_on(e, v_today) then raise exception '% does not work here on %', e.full_name, v_today; end if;
  v_loc := resolve_location(v_business, p_location);
  -- Not named, nor why: an advance is for those who see payroll (0063).
  v_journal := post_journal(v_business, now(), 'Advance on pay',
    'employee_advance', v_id,
    jsonb_build_array(jsonb_build_object('code', '1300', 'debit', v_amount),
                      jsonb_build_object('code', payment_account(v_from), 'credit', v_amount)));
  insert into employee_advance (id, business_id, employee_id, amount, paid_from, location_id, reason, given_on,
                                journal_entry_id, created_by)
  values (v_id, v_business, e.id, v_amount, v_from, v_loc, trim(p_reason), v_today, v_journal, v_me);
  perform pay_out_of(v_business, v_loc, v_from, v_amount, 'employee_advance', v_id, v_me);
  return jsonb_build_object('advance_id', v_id, 'employee_id', e.id, 'name', e.full_name, 'amount', v_amount,
                            'paid_from', v_from, 'owed', advance_owed(v_business, e.id),
                            'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- =============================================================================
-- 2. Money from the till or the safe, recorded the day it is taken out
-- =============================================================================
-- The drawer's and the safe's own records are written when the money moves;
-- the journal took the date chosen. An expense from either dated an earlier
-- day, or the reversal of a journal that moved their cash dated so, put that
-- day out for good, and its month could not be locked.
alter function record_expense__run(text, numeric, text, text, date, uuid) rename to record_expense__run_0055;
create function record_expense__run(p_description text, p_amount numeric, p_account_code text,
                                    p_paid_from text default 'cash', p_date date default null,
                                    p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(p_paid_from, '')) in ('cash', 'till', 'safe') and p_date is not null
     and p_date <> business_local_date(current_business_id(), now()) then
    raise exception 'Money from the till or the safe is recorded the day it is taken out: today';
  end if;
  return record_expense__run_0055(p_description, p_amount, p_account_code, p_paid_from, p_date, p_location);
end $$;

alter function reverse_journal__run(uuid, text, date) rename to reverse_journal__run_0035;
create function reverse_journal__run(p_entry uuid, p_reason text, p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_date is not null and p_date <> business_local_date(current_business_id(), now())
     and exists (select 1 from journal_line l join gl_account a on a.id = l.account_id
                  where l.journal_entry_id = p_entry and a.code in ('1000', '1001', '1005', '1006')) then
    raise exception 'A journal that moved the till''s or the safe''s cash is reversed today, when they count it';
  end if;
  return reverse_journal__run_0035(p_entry, p_reason, p_date);
end $$;

-- =============================================================================
-- 3. Who may call what
-- =============================================================================
-- The work behind each keyed write, and the helpers, are called inside the
-- database only; the old versions kept their closed doors when renamed.
revoke execute on function
  reopen_payroll__run(uuid, text),
  payroll_refresh(uuid, uuid),
  payroll_current(uuid, uuid),
  pay_salaries(uuid, payroll_run, jsonb, text, uuid),
  record_advance__run(uuid, numeric, text, text, uuid),
  record_expense__run(text, numeric, text, text, date, uuid),
  reverse_journal__run(uuid, text, date)
  from public, anon, authenticated;
