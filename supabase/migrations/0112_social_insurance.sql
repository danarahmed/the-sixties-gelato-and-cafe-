-- 0112: social insurance and the payslip (plan 6, item 6; the owner, 8 November).
--
--   * Optional for each café, and on or off for each person (a trial period).
--     Two parts, both owed to the government: 12% of the salary paid by the
--     café (its cost: Dr 6120 Social insurance, Cr 2110 Social insurance owed)
--     and 5% of the salary taken from the person's pay (Cr 2110). The salary is
--     what the payroll pays before advances, tips aside.
--   * Worked out when the payroll is approved (the draft shows what it will
--     be): the line keeps both parts, and its net is less the person's 5%.
--   * Paying the government clears what is owed: Dr 2110, Cr the bank or the
--     safe. A month's report: owed by each part, paid, and left.
--   * The payslip: a person's month, line by line.
--
-- Nothing recorded changes; off until the owner turns it on.

create table if not exists social_insurance_setup (
  business_id      uuid primary key references business(id) on delete cascade,
  enabled          boolean not null default false,
  employer_percent numeric(5, 2) not null default 12 check (employer_percent >= 0 and employer_percent <= 50),
  employee_percent numeric(5, 2) not null default 5 check (employee_percent >= 0 and employee_percent <= 50),
  set_by           uuid references app_user(id),
  set_at           timestamptz not null default now()
);
alter table social_insurance_setup enable row level security;
alter table social_insurance_setup force row level security;

alter table employee add column if not exists social_insurance boolean not null default true;
alter table payroll_line add column if not exists si_employee numeric not null default 0;
alter table payroll_line add column if not exists si_employer numeric not null default 0;
-- What a person is paid: their gross, less the advance recovered, and less
-- their part of social insurance (0112; nothing until it is approved).
alter table payroll_line drop constraint if exists payroll_line_net;
alter table payroll_line add constraint payroll_line_net check (net = gross - advance_recovered - si_employee);
alter table payroll_line drop constraint if exists payroll_line_si;
alter table payroll_line add constraint payroll_line_si check (si_employee >= 0 and si_employer >= 0);

create table if not exists social_insurance_payment (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business(id) on delete cascade,
  month            date not null,
  amount           numeric not null check (amount > 0),
  account_code     text not null,
  reference        text,
  journal_entry_id uuid references journal_entry(id),
  created_by       uuid references app_user(id),
  created_at       timestamptz not null default now()
);
alter table social_insurance_payment enable row level security;
alter table social_insurance_payment force row level security;

-- (the owner) Social insurance on or off, and its two percentages.
create or replace function set_social_insurance(p_enabled boolean, p_employer numeric default 12,
                                                p_employee numeric default 5)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('payroll.run'); v_before jsonb;
begin
  if not current_has_role('owner') then
    raise exception 'Only the owner turns social insurance on or off' using errcode = '42501';
  end if;
  if p_enabled is null then raise exception 'Choose on or off'; end if;
  if coalesce(p_employer, -1) < 0 or p_employer > 50 or coalesce(p_employee, -1) < 0 or p_employee > 50 then
    raise exception '%', format('Each part is from %s%% to %s%% of the salary', 0, 50);
  end if;
  select to_jsonb(s) - 'business_id' into v_before from social_insurance_setup s where business_id = v_business;
  if p_enabled then
    insert into gl_account (business_id, code, name, account_type, normal_balance, is_active, is_system)
    values (v_business, '6120', 'Social insurance', 'expense', 'debit', true, true),
           (v_business, '2110', 'Social insurance owed', 'liability', 'credit', true, true)
    on conflict do nothing;
  end if;
  insert into social_insurance_setup (business_id, enabled, employer_percent, employee_percent, set_by, set_at)
  values (v_business, p_enabled, p_employer, p_employee, (current_member()).id, now())
  on conflict (business_id) do update set enabled = excluded.enabled, employer_percent = excluded.employer_percent,
    employee_percent = excluded.employee_percent, set_by = excluded.set_by, set_at = excluded.set_at;
  perform audit_event(v_business, 'payroll.social_insurance', 'business', v_business::text, null, v_before,
    jsonb_build_object('enabled', p_enabled, 'employer_percent', p_employer, 'employee_percent', p_employee));
  return social_insurance();
end $$;

-- (payroll.run) Social insurance for one person: on, or off for a trial period.
create or replace function set_employee_social_insurance(p_employee uuid, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('payroll.run'); v_name text;
begin
  if p_on is null then raise exception 'Choose on or off'; end if;
  update employee set social_insurance = p_on where id = p_employee and business_id = v_business
  returning full_name into v_name;
  if v_name is null then raise exception 'Employee not found'; end if;
  perform audit_event(v_business, 'employee.social_insurance', 'employee', p_employee::text, null, null,
    jsonb_build_object('name', v_name, 'on', p_on));
  return jsonb_build_object('employee_id', p_employee, 'on', p_on);
end $$;

create or replace function social_insurance() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', coalesce(s.enabled, false), 'employer_percent', coalesce(s.employer_percent, 12),
    'employee_percent', coalesce(s.employee_percent, 5),
    'off_for', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.full_name) order by e.full_name)
                           from employee e where e.business_id = current_business_id() and not e.social_insurance
                            and e.left_on is null), '[]'::jsonb))
    from (select 1) one left join social_insurance_setup s on s.business_id = current_business_id()
   where current_has_permission('payroll.view') or current_has_permission('payroll.run')
$$;

-- A line's two parts, as approving the payroll works them out.
create or replace function social_insurance_of(p_business uuid, p_employee uuid, p_salary numeric,
                                               out employee_part numeric, out employer_part numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(case when s.enabled and e.social_insurance and p_salary > 0
                       then money_round(p_business, p_salary * s.employee_percent / 100) end, 0),
         coalesce(case when s.enabled and e.social_insurance and p_salary > 0
                       then money_round(p_business, p_salary * s.employer_percent / 100) end, 0)
    from employee e left join social_insurance_setup s on s.business_id = p_business
   where e.id = p_employee
$$;

-- 0102's post_journal: a payroll's approval carries its social insurance, when
-- approving it said so (0112): the café's part its cost (Dr 6120), both parts
-- owed (Cr 2110); the person's part is already off what they are owed (2100).
alter function post_journal(uuid, timestamptz, text, text, uuid, jsonb, uuid, text) rename to post_journal_0111;
create or replace function post_journal(p_business uuid, p_at timestamptz, p_description text, p_ref_type text,
                                        p_ref_id uuid, p_lines jsonb, p_reverses uuid default null,
                                        p_reference_no text default null)
returns uuid language plpgsql set search_path = public as $$
declare v_si jsonb := nullif(current_setting('sixties.payroll_si', true), '')::jsonb; v_lines jsonb := p_lines;
begin
  if p_reverses is null and p_ref_type = 'payroll_approval' and v_si is not null then
    v_lines := p_lines || jsonb_build_array(
      jsonb_build_object('code', '6120', 'debit', (v_si ->> 'employer')::numeric),
      jsonb_build_object('code', '2110', 'credit', (v_si ->> 'employee')::numeric + (v_si ->> 'employer')::numeric));
  end if;
  return post_journal_0111(p_business, p_at, p_description, p_ref_type, p_ref_id, v_lines, p_reverses, p_reference_no);
end $$;

-- 0090's approve_payroll__run: each line's social insurance worked out on the
-- draft, its net less the person's part, and the approval's journal carrying it (0112).
alter function approve_payroll__run(uuid) rename to approve_payroll__run_0111;
create or replace function approve_payroll__run(p_run uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v jsonb; l record; si record; v_emp numeric := 0; v_er numeric := 0; r payroll_run; v_base numeric;
begin
  select * into r from payroll_run where id = p_run and business_id = v_business;
  if r.id is not null and r.status = 'draft' then
    for l in select * from payroll_line where run_id = p_run for update loop
      -- What they would be paid without it (a draft approved, reopened and approved again counts it once).
      v_base := l.net + l.si_employee;
      select * into si from social_insurance_of(v_business, l.employee_id, greatest(l.gross - coalesce(l.tips, 0), 0));
      si.employee_part := least(si.employee_part, greatest(v_base, 0));
      if si.employee_part <> l.si_employee or si.employer_part <> l.si_employer then
        update payroll_line set si_employee = si.employee_part, si_employer = si.employer_part,
                                net = v_base - si.employee_part
         where id = l.id;
      end if;
      v_emp := v_emp + si.employee_part;
      v_er := v_er + si.employer_part;
    end loop;
  end if;
  if v_emp + v_er > 0 then
    perform set_config('sixties.payroll_si', jsonb_build_object('employee', v_emp, 'employer', v_er)::text, true);
  end if;
  v := approve_payroll__run_0111(p_run);
  perform set_config('sixties.payroll_si', '', true);
  return v || jsonb_build_object('social_insurance', jsonb_build_object('employee', v_emp, 'employer', v_er));
end $$;

-- 0064's reopen_payroll__run: the approval's journal reversed carries its
-- social insurance back; the draft's nets are as before it (0112).
alter function reopen_payroll__run(uuid, text) rename to reopen_payroll__run_0111;
create or replace function reopen_payroll__run(p_run uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  v := reopen_payroll__run_0111(p_run, p_reason);
  update payroll_line set net = net + si_employee, si_employee = 0, si_employer = 0
   where run_id = p_run and (si_employee <> 0 or si_employer <> 0);
  return v;
end $$;

-- (payroll.run) Paid to the government, for a month: Dr 2110, Cr the bank or the safe.
create or replace function pay_social_insurance(p_month date, p_amount numeric, p_paid_from text,
                                                p_reference text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_req jsonb := jsonb_build_object('month', p_month, 'amount', p_amount, 'from', p_paid_from);
  v jsonb; v_code text; v_owed numeric; v_id uuid := gen_random_uuid(); v_journal uuid; v_month date;
begin
  v := idem_begin(v_business, p_idempotency_key, 'pay_social_insurance', v_req);
  if v is not null then return v; end if;
  v_month := date_trunc('month', p_month)::date;
  if p_amount is null or p_amount <= 0 or p_amount <> money_round(v_business, p_amount) then
    raise exception 'Enter an amount greater than zero';
  end if;
  v_code := case p_paid_from when 'bank' then '1020' when 'safe' then '1005' end;
  if v_code is null then raise exception 'Say where the money came from: the bank or the safe'; end if;
  v_owed := (social_insurance_month(v_month) ->> 'left')::numeric;
  if p_amount > v_owed then
    raise exception '%', format('%s is owed for that month: a payment is at most that', trim_scale(v_owed));
  end if;
  insert into social_insurance_payment (id, business_id, month, amount, account_code, reference, created_by)
  values (v_id, v_business, v_month, p_amount, v_code, left(nullif(trim(p_reference), ''), 60), (current_member()).id);
  v_journal := post_journal(v_business, now(), 'Social insurance paid ' || payroll_month_text(v_month),
    'social_insurance_payment', v_id,
    jsonb_build_array(jsonb_build_object('code', '2110', 'debit', p_amount),
                      jsonb_build_object('code', v_code, 'credit', p_amount)));
  update social_insurance_payment set journal_entry_id = v_journal where id = v_id;
  perform audit_event(v_business, 'payroll.social_insurance_paid', 'social_insurance_payment', v_id::text, null, null,
    jsonb_build_object('month', v_month, 'amount', p_amount, 'from', p_paid_from));
  v := social_insurance_month(v_month);
  perform idem_finish(v_business, p_idempotency_key, 'pay_social_insurance', v_req, v);
  return v;
end $$;

-- (payroll.view) A month's social insurance: each part owed, paid, and what is left.
create or replace function social_insurance_month(p_month date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('payroll.view', 'payroll.run'); v_month date; v_emp numeric; v_er numeric;
        v_paid numeric;
begin
  v_month := date_trunc('month', p_month)::date;
  select coalesce(sum(l.si_employee), 0), coalesce(sum(l.si_employer), 0) into v_emp, v_er
    from payroll_line l join payroll_run r on r.id = l.run_id
   where r.business_id = v_business and r.month = v_month and r.status in ('approved', 'paid');
  select coalesce(sum(amount), 0) into v_paid from social_insurance_payment
   where business_id = v_business and month = v_month;
  return jsonb_build_object('month', v_month, 'employee', v_emp, 'employer', v_er, 'owed', v_emp + v_er,
    'paid', v_paid, 'left', v_emp + v_er - v_paid,
    'people', coalesce((select jsonb_agg(jsonb_build_object('name', e.full_name, 'salary', l.gross - coalesce(l.tips, 0),
                                                            'employee', l.si_employee, 'employer', l.si_employer)
                                         order by e.full_name)
                          from payroll_line l join payroll_run r on r.id = l.run_id join employee e on e.id = l.employee_id
                         where r.business_id = v_business and r.month = v_month and r.status in ('approved', 'paid')
                           and (l.si_employee > 0 or l.si_employer > 0)), '[]'::jsonb));
end $$;

-- (payroll.view, or the person themselves) A payslip: one person's month, line by line.
create or replace function payslip(p_line uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l payroll_line; r payroll_run; e employee; v_me uuid := (current_member()).id;
begin
  select * into l from payroll_line where id = p_line and business_id = current_business_id();
  if l.id is null then raise exception 'Payslip not found'; end if;
  select * into e from employee where id = l.employee_id;
  if not (current_has_permission('payroll.view') or e.app_user_id = v_me) then
    raise exception 'You do not have permission to do this (needs %)', 'payroll.view' using errcode = '42501';
  end if;
  select * into r from payroll_run where id = l.run_id;
  return jsonb_build_object(
    'business', (select name from business where id = l.business_id), 'name', e.full_name, 'title', e.title,
    'month', r.month, 'month_text', payroll_month_text(r.month), 'status', r.status, 'run_no', r.run_no,
    'pay_basis', l.pay_basis, 'rate', l.rate, 'days_worked', l.days_worked,
    'hours', round(coalesce(l.minutes_worked, 0) / 60.0, 2), 'overtime_hours', round(coalesce(l.overtime_minutes, 0) / 60.0, 2),
    'base_pay', l.base_pay, 'overtime_pay', l.overtime_pay, 'tips', l.tips,
    'additions', l.additions, 'additions_note', l.additions_note,
    'deductions', l.deductions, 'deductions_note', l.deductions_note,
    'advance_recovered', l.advance_recovered, 'si_employee', l.si_employee, 'si_employer', l.si_employer,
    'gross', l.gross, 'net', l.net);
end $$;

revoke execute on function social_insurance_of(uuid, uuid, numeric), approve_payroll__run_0111(uuid),
  reopen_payroll__run_0111(uuid, text),
  post_journal_0111(uuid, timestamptz, text, text, uuid, jsonb, uuid, text)
  from public, anon, authenticated;
revoke execute on function set_social_insurance(boolean, numeric, numeric), set_employee_social_insurance(uuid, boolean),
  social_insurance(), pay_social_insurance(date, numeric, text, text, uuid), social_insurance_month(date), payslip(uuid)
  from public, anon;
grant execute on function set_social_insurance(boolean, numeric, numeric), set_employee_social_insurance(uuid, boolean),
  social_insurance(), pay_social_insurance(date, numeric, text, text, uuid), social_insurance_month(date), payslip(uuid)
  to authenticated;
