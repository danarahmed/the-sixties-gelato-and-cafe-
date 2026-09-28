-- =============================================================================
-- 0049 — Staff: who works here, their hours, and their pay (release W)
--
-- The café's people had logins and roles and nothing else: no record of who
-- works here, when they came and went, or what they are paid. Salaries were an
-- expense typed by hand (docs/COMPLETION_PLAN.md, B20).
--   * A person who works here (employee): name, phone, what they do, their
--     branch, when they started and left, a login when they have one, and a
--     PIN for clocking at the till. Their pay (by the month, the day or the
--     hour, a day's hours and what overtime is paid at) is set by those who run
--     payroll and seen only by those who see payroll.
--   * The hours: a schedule, one stretch of hours a person a day; clocking in
--     and out at the till with a name and a PIN; a manager adds, corrects or
--     cancels a record, always saying why. Lateness, leaving early, absence and
--     overtime are counted, and never deducted by themselves.
--   * Payroll, a month at a time: a draft from the pay and the hours, with the
--     additions and deductions a person adds with why, and the advances taken
--     back; approved once the month is over (Dr 6100 Salaries, Cr 2100
--     Salaries payable and 1300 Employee advances); reopened while nothing is
--     paid from it; paid to one person or to everyone at once, from the till,
--     the safe, the bank or the owner (Dr 2100, Cr where the money came from).
--   * Advances, given from the same places (Dr 1300), taken back from a
--     salary, and cancelled while none of them is taken back.
--   * The books: two new checks (salaries owed against 2100, advances against
--     1300); the safe counts what advances and salaries took from it; a record
--     without its journal, and a journal without its record, are found; 1300
--     and 2100 move only through their records.
--   * Alerts: someone still clocked in long after; last month's payroll not
--     approved, or not paid, by payday.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The accounts
-- ---------------------------------------------------------------------------
create or replace function provision_chart_of_accounts(p_business uuid) returns void
language plpgsql as $$
begin
  insert into gl_account (business_id, code, name, account_type, normal_balance, is_system)
  select p_business, a.code, a.name, a.t::account_type, a.nb::normal_balance, true
  from (values
    ('1000','Cash in the till',           'asset',     'debit'),
    ('1001','Cash in the till — USD',     'asset',     'debit'),
    ('1005','Cash in the safe',           'asset',     'debit'),
    ('1006','Cash in the safe — USD',     'asset',     'debit'),
    ('1010','Card clearing',              'asset',     'debit'),
    ('1020','Bank',                       'asset',     'debit'),
    ('1100','Platform receivable',        'asset',     'debit'),
    ('1200','Inventory',                  'asset',     'debit'),
    ('1300','Employee advances',          'asset',     'debit'),
    ('1500','Equipment',                  'asset',     'debit'),
    ('1590','Accumulated depreciation',   'asset',     'credit'),
    ('2000','Accounts payable',           'liability', 'credit'),
    ('2050','Goods received not invoiced','liability', 'credit'),
    ('2100','Salaries payable',           'liability', 'credit'),
    ('3000','Owner equity',               'equity',    'credit'),
    ('3100','Retained earnings',          'equity',    'credit'),
    ('3200','Owner drawings',             'equity',    'debit'),
    ('4000','Sales revenue',              'revenue',   'credit'),
    ('4100','Merchant-funded discount',   'revenue',   'debit'),
    ('4200','Sales returns & refunds',    'revenue',   'debit'),
    ('5000','Cost of goods sold',         'expense',   'debit'),
    ('5050','Purchase price variance',    'expense',   'debit'),
    ('5100','Platform commission',        'expense',   'debit'),
    ('5200','Platform fees',              'expense',   'debit'),
    ('5300','Waste & spoilage',           'expense',   'debit'),
    ('5310','Production and preparation loss', 'expense', 'debit'),
    ('5400','Inventory count variance',   'expense',   'debit'),
    ('6000','Rent',                       'expense',   'debit'),
    ('6100','Salaries',                   'expense',   'debit'),
    ('6110','Staff meals',                'expense',   'debit'),
    ('6200','Utilities',                  'expense',   'debit'),
    ('6300','Cash over / short',          'expense',   'debit'),
    ('6400','Depreciation',               'expense',   'debit'),
    ('6500','Card and bank fees',         'expense',   'debit'),
    ('6610','Complimentary items',        'expense',   'debit'),
    ('6620','Marketing samples',          'expense',   'debit'),
    ('6900','Other expenses',             'expense',   'debit'),
    ('6950','Exchange differences',       'expense',   'debit')
  ) as a(code, name, t, nb)
  on conflict (business_id, code) do update set is_system = true;
end $$;

do $$
declare b record;
begin
  for b in select id from business loop
    perform provision_chart_of_accounts(b.id);
  end loop;
end $$;

-- Advances and the salaries owed move only through their records, as cash does.
create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$
  select p_code in ('1000', '1001', '1005', '1006', '1200', '1300', '2000', '2050', '2100', '3100')
$$;

-- ---------------------------------------------------------------------------
-- 2. Who may
-- ---------------------------------------------------------------------------
-- staff.manage: the people, their PINs and the schedule; attendance.edit: a
-- record of hours added, corrected or cancelled; payroll.view: the pay, the
-- payrolls and the advances; payroll.run: setting pay, drafting, approving and
-- paying payroll, and advances.
insert into role_permission (role, permission)
select r::app_role, p from (values
  ('owner','staff.manage'),('general_manager','staff.manage'),('branch_manager','staff.manage'),
  ('owner','attendance.edit'),('general_manager','attendance.edit'),('branch_manager','attendance.edit'),
  ('owner','payroll.view'),('general_manager','payroll.view'),('accountant','payroll.view'),('auditor','payroll.view'),
  ('owner','payroll.run'),('general_manager','payroll.run'),('accountant','payroll.run')
) as v(r, p)
on conflict do nothing;

-- What someone is paid is read only by those who see payroll, the audit trail's
-- record of it included.
drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('audit.view'))
         and (not (action like 'payroll.%' or action = 'staff.pay')
              or (select current_has_permission('payroll.view'))));

-- ---------------------------------------------------------------------------
-- 3. The rules: overtime, lateness, when someone has stayed clocked in too
--    long, and payday (decision 11)
-- ---------------------------------------------------------------------------
create or replace function rule_definitions() returns jsonb
language sql immutable set search_path = public as $$
  select '{
    "discount_cap_percent":  {"kind": "percent", "min": 0, "max": 100, "whole": false,
                              "scopes": ["business", "role"],
                              "label": "Discounts a manager approves, over (% of the bill)"},
    "discount_round_to":     {"kind": "amount", "min": 1, "max": 100000, "whole": true,
                              "scopes": ["business"],
                              "label": "A discount given as a percentage is rounded to"},
    "refund_approval_over":  {"kind": "amount", "min": 0, "max": 100000000, "whole": true,
                              "scopes": ["business", "role"],
                              "label": "Refunds a second person approves, over"},
    "waste_approval_over":   {"kind": "amount", "min": 0, "max": 100000000, "whole": true,
                              "scopes": ["business", "role"],
                              "label": "Losses a manager approves, over"},
    "waste_approval_window": {"kind": "choice", "choices": ["entry", "session", "day"],
                              "scopes": ["business"],
                              "label": "One person''s losses are added up over"},
    "negative_stock":        {"kind": "choice", "choices": ["block", "approve", "alert", "allow"],
                              "scopes": ["business", "item_type", "item"],
                              "label": "Using more stock than the books hold"},
    "usd_rate_max_age_hours": {"kind": "hours", "min": 1, "max": 168, "whole": true,
                              "scopes": ["business"],
                              "label": "Dollars are taken at a rate set within the last"},
    "usd_round_to":          {"kind": "amount", "min": 1, "max": 100000, "whole": true,
                              "scopes": ["business"],
                              "label": "Dollars are counted in dinars to the nearest"},
    "po_approve_up_to":      {"kind": "amount", "min": 0, "max": 1000000000, "whole": true,
                              "scopes": ["business", "role"],
                              "label": "Purchase orders a manager approves, up to"},
    "overtime_percent":      {"kind": "percent", "min": 100, "max": 300, "whole": false,
                              "scopes": ["business"],
                              "label": "Overtime is paid at (% of an hour''s pay)"},
    "late_after_minutes":    {"kind": "minutes", "min": 0, "max": 120, "whole": true,
                              "scopes": ["business"],
                              "label": "Late, or leaving early, by more than"},
    "clocked_in_alert_hours": {"kind": "hours", "min": 4, "max": 24, "whole": true,
                              "scopes": ["business"],
                              "label": "Someone still clocked in after"},
    "payday":                {"kind": "day", "min": 1, "max": 28, "whole": true,
                              "scopes": ["business"],
                              "label": "Salaries are paid on the day of the month"}
  }'::jsonb
$$;

create or replace function rule_defaults(p_business uuid)
returns table (key text, scope_type text, scope_id text, value jsonb)
language sql stable set search_path = public as $$
  select 'discount_cap_percent', 'business', '', to_jsonb(b.discount_cap_percent) from business b where b.id = p_business
  union all
  select 'discount_round_to', 'business', '', to_jsonb(b.discount_round_to) from business b where b.id = p_business
  union all
  select 'refund_approval_over', 'business', '', to_jsonb(25000)
  union all
  select 'waste_approval_over', 'business', '', to_jsonb(b.waste_approval_threshold) from business b where b.id = p_business
  union all
  select 'waste_approval_window', 'business', '', to_jsonb('session'::text)
  union all
  select 'negative_stock', 'business', '',
         to_jsonb(case when b.prevent_negative_stock then 'block' else 'alert' end) from business b where b.id = p_business
  union all
  select 'negative_stock', 'item_type', t, to_jsonb('block'::text) from unnest(array['finished_good', 'sub_recipe_output']) t
  union all
  select 'usd_rate_max_age_hours', 'business', '', to_jsonb(36)
  union all
  select 'usd_round_to', 'business', '', to_jsonb(250)
  union all
  select 'po_approve_up_to', 'business', '', to_jsonb(250000)
  union all
  select 'po_approve_up_to', 'role', r, to_jsonb(1000000000) from unnest(array['owner', 'general_manager']) r
  union all
  select 'overtime_percent', 'business', '', to_jsonb(150)
  union all
  select 'late_after_minutes', 'business', '', to_jsonb(5)
  union all
  select 'clocked_in_alert_hours', 'business', '', to_jsonb(16)
  union all
  select 'payday', 'business', '', to_jsonb(1)
$$;

-- A number rule of the whole café.
create or replace function staff_rule(p_business uuid, p_key text) returns numeric
language sql stable set search_path = public as $$
  select (rule_value(p_business, p_key) #>> '{}')::numeric
$$;

-- ---------------------------------------------------------------------------
-- 4. The people who work here
-- ---------------------------------------------------------------------------
create table if not exists employee (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business (id) on delete cascade,
  location_id      uuid not null references location (id),
  full_name        text not null,
  phone            text,
  title            text,
  hired_on         date not null,
  -- Their last day; after it they no longer work here.
  left_on          date,
  -- Their pay: set by those who run payroll, read by those who see it.
  pay_basis        text,
  rate             numeric,
  standard_hours   numeric not null default 8,
  -- What overtime is paid at, in % of an hour's pay; none: the café's rule.
  overtime_percent numeric,
  app_user_id      uuid references app_user (id),
  clock_pin_hash   text,
  clock_pin_set_at timestamptz,
  created_by       uuid references app_user (id),
  created_at       timestamptz not null default now(),
  constraint employee_name check (length(trim(full_name)) between 1 and 80),
  constraint employee_basis check (pay_basis in ('monthly', 'daily', 'hourly')),
  constraint employee_pay check ((pay_basis is null) = (rate is null) and (rate is null or rate >= 0)),
  constraint employee_hours check (standard_hours > 0 and standard_hours <= 16),
  constraint employee_overtime check (overtime_percent is null or overtime_percent between 100 and 300),
  constraint employee_left check (left_on is null or left_on >= hired_on)
);
create unique index if not exists employee_name_once on employee (business_id, lower(trim(full_name)));
create unique index if not exists employee_login_once on employee (app_user_id) where app_user_id is not null;
create index if not exists employee_location on employee (location_id);

-- The PINs typed at the till: 3 wrong from one login in 15 minutes pause that
-- login; 20 wrong for one person in a day pause their clocking by PIN until a
-- manager sets them a new one.
create table if not exists clock_attempt (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  employee_id  uuid not null references employee (id),
  requested_by uuid references app_user (id),
  ok           boolean not null,
  at           timestamptz not null default now()
);
create index if not exists clock_attempt_employee on clock_attempt (employee_id, at);
create index if not exists clock_attempt_login on clock_attempt (requested_by, at);

-- Someone who works here, locked while their hours or pay change.
create or replace function staff_member(p_business uuid, p_employee uuid, p_lock boolean default false)
returns employee language plpgsql set search_path = public as $$
declare e employee;
begin
  if p_lock then
    select * into e from employee where id = p_employee and business_id = p_business for update;
  else
    select * into e from employee where id = p_employee and business_id = p_business;
  end if;
  if not found then raise exception 'Choose someone who works here'; end if;
  return e;
end $$;

-- Whether someone works here on a day: started, and not yet left.
create or replace function works_on(e employee, p_day date) returns boolean
language sql immutable as $$
  select e.hired_on <= p_day and (e.left_on is null or e.left_on >= p_day)
$$;

-- A new person, or their details changed (not their pay).
create or replace function save_employee__run(p_employee uuid, p_name text, p_phone text, p_title text,
                                              p_location uuid, p_hired_on date, p_app_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage');
  v_me uuid := (current_member()).id;
  v_name text := nullif(trim(p_name), ''); v_loc uuid; e employee; v_id uuid; v_before jsonb;
  v_today date := business_local_date(v_business, now());
begin
  if v_name is null then raise exception 'Type the person''s name'; end if;
  if length(v_name) > 80 then raise exception 'A name is at most 80 letters'; end if;
  if p_hired_on is null then raise exception 'Say when they started'; end if;
  if p_hired_on > v_today + 366 then raise exception 'They start within a year'; end if;
  if p_location is null then raise exception 'Choose where they work'; end if;
  v_loc := resolve_location(v_business, p_location);
  if exists (select 1 from employee x where x.business_id = v_business and lower(trim(x.full_name)) = lower(v_name)
               and x.id is distinct from p_employee) then
    raise exception 'Someone here is called % already: add a surname or a nickname', v_name;
  end if;
  if p_app_user is not null then
    if not exists (select 1 from app_user u where u.id = p_app_user and u.business_id = v_business) then
      raise exception 'Choose a login of this café';
    end if;
    if exists (select 1 from employee x where x.app_user_id = p_app_user and x.id is distinct from p_employee) then
      raise exception '% is the login of someone else already', (select full_name from app_user where id = p_app_user);
    end if;
  end if;
  if p_employee is null then
    insert into employee (business_id, location_id, full_name, phone, title, hired_on, app_user_id, created_by)
    values (v_business, v_loc, v_name, nullif(trim(p_phone), ''), nullif(trim(p_title), ''), p_hired_on, p_app_user, v_me)
    returning id into v_id;
  else
    e := staff_member(v_business, p_employee, true);
    v_id := e.id;
    if exists (select 1 from attendance a where a.employee_id = e.id and a.cancelled_at is null
                 and a.work_day < p_hired_on) then
      raise exception 'There are hours recorded before %: correct them first', p_hired_on;
    end if;
    if e.left_on is not null and e.left_on < p_hired_on then
      raise exception 'They cannot start after their last day (%)', e.left_on;
    end if;
    v_before := jsonb_build_object('name', e.full_name, 'phone', e.phone, 'title', e.title, 'location', e.location_id,
                                   'hired_on', e.hired_on, 'login', e.app_user_id);
    update employee set full_name = v_name, phone = nullif(trim(p_phone), ''), title = nullif(trim(p_title), ''),
                        location_id = v_loc, hired_on = p_hired_on, app_user_id = p_app_user
     where id = e.id;
  end if;
  return jsonb_build_object('employee_id', v_id, 'before', v_before,
    'after', jsonb_build_object('name', v_name, 'phone', nullif(trim(p_phone), ''), 'title', nullif(trim(p_title), ''),
                                'location', v_loc, 'hired_on', p_hired_on, 'login', p_app_user));
end $$;

create or replace function save_employee(p_employee uuid, p_name text, p_phone text, p_title text, p_location uuid,
                                         p_hired_on date, p_app_user uuid default null,
                                         p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_employee', p_employee, 'p_name', p_name, 'p_phone', p_phone, 'p_title', p_title,
                                    'p_location', p_location, 'p_hired_on', p_hired_on, 'p_app_user', p_app_user);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_employee', v_req);
  if v is not null then return v; end if;
  v := save_employee__run(p_employee => p_employee, p_name => p_name, p_phone => p_phone, p_title => p_title,
                          p_location => p_location, p_hired_on => p_hired_on, p_app_user => p_app_user);
  perform audit_event(v_business, 'staff.save', 'employee', v ->> 'employee_id', null, v -> 'before', v -> 'after');
  v := jsonb_build_object('employee_id', v -> 'employee_id');
  perform idem_finish(v_business, p_idempotency_key, 'save_employee', v_req, v);
  return v;
end $$;

-- What someone is paid: by the month, the day or the hour, a day's hours, and
-- what overtime is paid at (none: the café's rule).
create or replace function set_employee_pay__run(p_employee uuid, p_pay_basis text, p_rate numeric,
                                                 p_standard_hours numeric, p_overtime_percent numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  e employee; v_rate numeric := money_round(v_business, p_rate);
begin
  if p_pay_basis is null or p_pay_basis not in ('monthly', 'daily', 'hourly') then
    raise exception 'Choose how they are paid: by the month, the day or the hour';
  end if;
  if v_rate is null or v_rate < 0 then raise exception 'Enter the pay'; end if;
  if p_standard_hours is null or p_standard_hours <= 0 or p_standard_hours > 16 then
    raise exception 'A day''s hours are more than 0 and at most 16';
  end if;
  if p_overtime_percent is not null and (p_overtime_percent < 100 or p_overtime_percent > 300) then
    raise exception 'Overtime is paid at 100%% to 300%% of an hour''s pay';
  end if;
  e := staff_member(v_business, p_employee, true);
  update employee set pay_basis = p_pay_basis, rate = v_rate, standard_hours = p_standard_hours,
                      overtime_percent = p_overtime_percent
   where id = e.id;
  return jsonb_build_object('employee_id', e.id,
    'before', case when e.rate is not null then jsonb_build_object('pay_basis', e.pay_basis, 'rate', e.rate,
                                                                   'standard_hours', e.standard_hours,
                                                                   'overtime_percent', e.overtime_percent) end,
    'after', jsonb_build_object('pay_basis', p_pay_basis, 'rate', v_rate, 'standard_hours', p_standard_hours,
                                'overtime_percent', p_overtime_percent, 'name', e.full_name));
end $$;

create or replace function set_employee_pay(p_employee uuid, p_pay_basis text, p_rate numeric,
                                            p_standard_hours numeric default 8, p_overtime_percent numeric default null,
                                            p_reason text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_employee', p_employee, 'p_pay_basis', p_pay_basis, 'p_rate', p_rate,
                                    'p_standard_hours', p_standard_hours, 'p_overtime_percent', p_overtime_percent,
                                    'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_employee_pay', v_req);
  if v is not null then return v; end if;
  v := set_employee_pay__run(p_employee => p_employee, p_pay_basis => p_pay_basis, p_rate => p_rate,
                             p_standard_hours => p_standard_hours, p_overtime_percent => p_overtime_percent,
                             p_reason => p_reason);
  perform audit_event(v_business, 'staff.pay', 'employee', v ->> 'employee_id', nullif(trim(p_reason), ''),
                      v -> 'before', v -> 'after');
  v := jsonb_build_object('employee_id', v -> 'employee_id');
  perform idem_finish(v_business, p_idempotency_key, 'set_employee_pay', v_req, v);
  return v;
end $$;

-- Someone's last day, or back to working here (p_left_on null). Their place on
-- the schedule after it goes.
create or replace function set_employee_left__run(p_employee uuid, p_left_on date, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage');
  e employee; v_shifts int := 0;
begin
  if nullif(trim(p_reason), '') is null then
    if p_left_on is null then raise exception 'Say why they work here again'; end if;
    raise exception 'Say why they leave';
  end if;
  e := staff_member(v_business, p_employee, true);
  if p_left_on is not null then
    if p_left_on < e.hired_on then raise exception 'They cannot leave before they started (%)', e.hired_on; end if;
    if exists (select 1 from attendance a where a.employee_id = e.id and a.cancelled_at is null
                 and a.clock_out is null) then
      raise exception '% is clocked in: clock them out first', e.full_name;
    end if;
    if exists (select 1 from attendance a where a.employee_id = e.id and a.cancelled_at is null
                 and a.work_day > p_left_on) then
      raise exception 'There are hours recorded after %: correct them first', p_left_on;
    end if;
    delete from shift_schedule s where s.employee_id = e.id and s.day > p_left_on;
    get diagnostics v_shifts = row_count;
  elsif e.left_on is null then
    raise exception '% works here already', e.full_name;
  end if;
  update employee set left_on = p_left_on where id = e.id;
  return jsonb_build_object('employee_id', e.id, 'name', e.full_name, 'left_on', p_left_on,
                            'was', e.left_on, 'shifts_removed', v_shifts);
end $$;

create or replace function set_employee_left(p_employee uuid, p_left_on date, p_reason text,
                                             p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_employee', p_employee, 'p_left_on', p_left_on, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_employee_left', v_req);
  if v is not null then return v; end if;
  v := set_employee_left__run(p_employee => p_employee, p_left_on => p_left_on, p_reason => p_reason);
  perform audit_event(v_business, 'staff.left', 'employee', v ->> 'employee_id', p_reason,
                      jsonb_build_object('left_on', v -> 'was'),
                      jsonb_build_object('left_on', v -> 'left_on', 'name', v -> 'name',
                                         'shifts_removed', v -> 'shifts_removed'));
  perform idem_finish(v_business, p_idempotency_key, 'set_employee_left', v_req, v);
  return v;
end $$;

-- The PIN someone clocks with: set by a manager, with them there to type it,
-- or by the person themselves when their login is theirs. A new PIN lifts a
-- pause after too many wrong ones.
create or replace function set_clock_pin(p_employee uuid, p_pin text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_me app_user := current_member();
  e employee;
begin
  if v_me.id is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  e := staff_member(v_business, p_employee, true);
  if not current_has_permission('staff.manage') and e.app_user_id is distinct from v_me.id then
    raise exception 'You do not have permission to do this (needs %)', 'staff.manage' using errcode = '42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then raise exception 'A PIN is 4 to 8 digits'; end if;
  if p_pin ~ '^(.)\1+$' or '0123456789' like '%' || p_pin || '%' or '9876543210' like '%' || p_pin || '%' then
    raise exception 'Choose a PIN that is harder to guess';
  end if;
  update employee set clock_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), clock_pin_set_at = now()
   where id = e.id;
  perform audit_event(v_business, 'staff.clock_pin', 'employee', e.id::text, null, null,
                      jsonb_build_object('name', e.full_name));
end $$;

-- The people, as Staff shows them: their pay only to those who see payroll.
create or replace function staff_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage', 'attendance.edit', 'payroll.view');
  v_pay boolean := current_has_permission('payroll.view');
  v_today date := business_local_date(v_business, now());
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', e.id, 'name', e.full_name, 'phone', e.phone, 'title', e.title,
             'location_id', e.location_id, 'location', l.name, 'hired_on', e.hired_on, 'left_on', e.left_on,
             'works_now', works_on(e, v_today), 'app_user_id', e.app_user_id, 'login', u.full_name,
             'has_pin', e.clock_pin_hash is not null, 'in_since', a.clock_in, 'attendance_id', a.id,
             'pay_set', e.rate is not null)
           || case when v_pay then jsonb_build_object('pay_basis', e.pay_basis, 'rate', e.rate,
                                                      'standard_hours', e.standard_hours,
                                                      'overtime_percent', e.overtime_percent,
                                                      'advance_owed', advance_owed(v_business, e.id))
                   else '{}'::jsonb end
           order by (e.left_on is not null and e.left_on < v_today), e.full_name)
      from employee e
      join location l on l.id = e.location_id
      left join app_user u on u.id = e.app_user_id
      left join attendance a on a.employee_id = e.id and a.clock_out is null and a.cancelled_at is null
     where e.business_id = v_business), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- 5. The schedule: one stretch of hours a person a day
-- ---------------------------------------------------------------------------
create table if not exists shift_schedule (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  employee_id  uuid not null references employee (id),
  location_id  uuid not null references location (id),
  day          date not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  note         text,
  created_by   uuid references app_user (id),
  created_at   timestamptz not null default now(),
  constraint shift_schedule_hours check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
  constraint shift_schedule_note check (note is null or length(note) <= 200)
);
create unique index if not exists shift_schedule_one_a_day on shift_schedule (employee_id, day);
create index if not exists shift_schedule_days on shift_schedule (business_id, day);
create index if not exists shift_schedule_location on shift_schedule (location_id, day);

-- The hours at a branch in the dates, as given: [{employee_id, day, starts
-- 'HH:MI', ends 'HH:MI' (at or before the start: the next day), note}]. What
-- was there before in those dates, at that branch, is replaced. Days whose pay
-- is approved keep their hours.
create or replace function save_schedule__run(p_location uuid, p_from date, p_to date, p_shifts jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage');
  v_me uuid := (current_member()).id;
  v_loc uuid := resolve_location(v_business, p_location);
  v_tz text := (select timezone from business where id = v_business);
  x jsonb; e employee; v_day date; v_start time; v_end time; v_new jsonb := '[]'::jsonb;
  v_before int; v_after int := 0; v_clash record; v_settled text;
begin
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Choose the dates, the first before the last'; end if;
  if p_to - p_from > 31 then raise exception 'Choose up to 31 days'; end if;
  if p_shifts is null or jsonb_typeof(p_shifts) <> 'array' then raise exception 'Give the hours as a list'; end if;
  -- Each stretch of hours checked, and turned into the café's times.
  for x in select * from jsonb_array_elements(p_shifts) loop
    e := staff_member(v_business, nullif(x ->> 'employee_id', '')::uuid);
    v_day := nullif(x ->> 'day', '')::date;
    if v_day is null or v_day < p_from or v_day > p_to then
      raise exception 'Each day of the hours is within the dates chosen';
    end if;
    if not works_on(e, v_day) then raise exception '% does not work here on %', e.full_name, v_day; end if;
    begin
      v_start := (x ->> 'starts')::time;
      v_end := (x ->> 'ends')::time;
    exception when others then
      raise exception 'Give the hours as 08:00 to 16:00';
    end;
    if v_start is null or v_end is null then raise exception 'Give the hours as 08:00 to 16:00'; end if;
    if exists (select 1 from jsonb_array_elements(v_new) n
                where (n ->> 'employee_id')::uuid = e.id and (n ->> 'day')::date = v_day) then
      raise exception '% has one stretch of hours on % at most', e.full_name, v_day;
    end if;
    if length(coalesce(x ->> 'note', '')) > 200 then raise exception 'A note is at most 200 letters'; end if;
    v_new := v_new || jsonb_build_object(
      'employee_id', e.id, 'day', v_day, 'note', nullif(trim(x ->> 'note'), ''),
      'starts_at', (v_day + v_start) at time zone v_tz,
      -- Ending at or before it starts: it ends the next day.
      'ends_at', ((v_day + case when v_end <= v_start then 1 else 0 end) + v_end) at time zone v_tz);
  end loop;
  -- Days whose pay is approved keep their hours.
  select string_agg(distinct to_char(d, 'YYYY-MM'), ', ') into v_settled
    from generate_series(p_from, p_to, interval '1 day') d
   where payroll_settled(v_business, d::date)
     and (exists (select 1 from shift_schedule s where s.location_id = v_loc and s.day = d::date
                    and not exists (select 1 from jsonb_to_recordset(v_new)
                                                    n(employee_id uuid, day date, starts_at timestamptz, ends_at timestamptz)
                                     where n.employee_id = s.employee_id and n.day = s.day
                                       and n.starts_at = s.starts_at and n.ends_at = s.ends_at))
          or exists (select 1 from jsonb_to_recordset(v_new)
                                     n(employee_id uuid, day date, starts_at timestamptz, ends_at timestamptz)
                      where n.day = d::date
                        and not exists (select 1 from shift_schedule s where s.location_id = v_loc
                                          and s.employee_id = n.employee_id and s.day = n.day
                                          and s.starts_at = n.starts_at and s.ends_at = n.ends_at)));
  if v_settled is not null then
    raise exception 'The pay for % is approved: its hours can no longer change', v_settled;
  end if;
  select count(*) into v_before from shift_schedule s
   where s.location_id = v_loc and s.day between p_from and p_to and not payroll_settled(v_business, s.day);
  delete from shift_schedule s
   where s.location_id = v_loc and s.day between p_from and p_to and not payroll_settled(v_business, s.day);
  -- Someone with hours at another branch that day.
  select n.day, e2.full_name as name, l.name as branch into v_clash
    from jsonb_to_recordset(v_new) n(employee_id uuid, day date)
    join shift_schedule s on s.employee_id = n.employee_id and s.day = n.day
    join employee e2 on e2.id = n.employee_id
    join location l on l.id = s.location_id
   where not payroll_settled(v_business, n.day)
   order by n.day limit 1;
  if found then
    raise exception '% works at % on % already', v_clash.name, v_clash.branch, v_clash.day;
  end if;
  insert into shift_schedule (business_id, employee_id, location_id, day, starts_at, ends_at, note, created_by)
  select v_business, n.employee_id, v_loc, n.day, n.starts_at, n.ends_at, n.note, v_me
    from jsonb_to_recordset(v_new) n(employee_id uuid, day date, starts_at timestamptz, ends_at timestamptz, note text)
   where not payroll_settled(v_business, n.day);
  get diagnostics v_after = row_count;
  -- Hours running into another day's.
  select a.day, e2.full_name as name into v_clash
    from shift_schedule a
    join shift_schedule b on b.employee_id = a.employee_id and b.id <> a.id
                         and b.starts_at < a.ends_at and a.starts_at < b.ends_at
    join employee e2 on e2.id = a.employee_id
   where a.business_id = v_business and a.day between p_from - 1 and p_to + 1
   order by a.day limit 1;
  if found then raise exception '%''s hours overlap on %', v_clash.name, v_clash.day; end if;
  return jsonb_build_object('location_id', v_loc, 'from', p_from, 'to', p_to, 'before', v_before, 'shifts', v_after);
end $$;

create or replace function save_schedule(p_location uuid, p_from date, p_to date, p_shifts jsonb,
                                         p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_location', p_location, 'p_from', p_from, 'p_to', p_to, 'p_shifts', p_shifts);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_schedule', v_req);
  if v is not null then return v; end if;
  v := save_schedule__run(p_location => p_location, p_from => p_from, p_to => p_to, p_shifts => p_shifts);
  perform audit_event(v_business, 'staff.schedule', 'location', v ->> 'location_id', null,
                      jsonb_build_object('shifts', v -> 'before'),
                      jsonb_build_object('from', p_from, 'to', p_to, 'shifts', v -> 'shifts'));
  perform idem_finish(v_business, p_idempotency_key, 'save_schedule', v_req, v);
  return v;
end $$;

-- The schedule in the dates: the people who work at the branch (or anywhere)
-- then, and their hours.
create or replace function staff_schedule(p_from date, p_to date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage', 'attendance.edit', 'payroll.view');
begin
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Choose the dates, the first before the last'; end if;
  if p_to - p_from > 62 then raise exception 'Choose up to 62 days'; end if;
  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'location_id', p_location,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.full_name, 'title', e.title,
                                          'location_id', e.location_id, 'hired_on', e.hired_on, 'left_on', e.left_on)
                       order by e.full_name)
        from employee e
       where e.business_id = v_business and e.hired_on <= p_to and (e.left_on is null or e.left_on >= p_from)
         and (p_location is null or e.location_id = p_location
              or exists (select 1 from shift_schedule s where s.employee_id = e.id and s.location_id = p_location
                           and s.day between p_from and p_to))), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'employee_id', s.employee_id, 'location_id', s.location_id,
                                          'location', l.name, 'day', s.day, 'starts_at', s.starts_at,
                                          'ends_at', s.ends_at, 'note', s.note,
                                          'settled', payroll_settled(v_business, s.day))
                       order by s.day, s.starts_at)
        from shift_schedule s join location l on l.id = s.location_id
       where s.business_id = v_business and s.day between p_from and p_to
         and (p_location is null or s.location_id = p_location)), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 6. Clocking in and out, and the records of hours
-- ---------------------------------------------------------------------------
create table if not exists attendance (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references business (id) on delete cascade,
  employee_id     uuid not null references employee (id),
  location_id     uuid not null references location (id),
  clock_in        timestamptz not null,
  clock_out       timestamptz,
  -- The day the hours count for: the day they began, in the café's time.
  work_day        date not null,
  source          text not null,
  recorded_by     uuid references app_user (id),
  out_recorded_by uuid references app_user (id),
  edited_by       uuid references app_user (id),
  edited_at       timestamptz,
  edit_reason     text,
  cancelled_by    uuid references app_user (id),
  cancelled_at    timestamptz,
  cancel_reason   text,
  created_at      timestamptz not null default now(),
  constraint attendance_source check (source in ('till', 'manager')),
  constraint attendance_hours check (clock_out is null or (clock_out > clock_in and clock_out <= clock_in + interval '24 hours')),
  constraint attendance_edit check ((edited_at is null) = (edit_reason is null)),
  constraint attendance_cancel check ((cancelled_at is null) = (cancel_reason is null))
);
create unique index if not exists attendance_one_open on attendance (employee_id)
  where clock_out is null and cancelled_at is null;
create index if not exists attendance_days on attendance (business_id, work_day);
create index if not exists attendance_employee on attendance (employee_id, clock_in);
create index if not exists attendance_location on attendance (location_id);

-- A record of hours is corrected or cancelled, never deleted.
create or replace function trg_attendance_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'A record of hours is cancelled, not deleted'; end if;
  if old.cancelled_at is not null then raise exception 'That record was cancelled'; end if;
  if new.employee_id <> old.employee_id or new.business_id <> old.business_id then
    raise exception 'A record of hours stays with its person';
  end if;
  return new;
end $$;
drop trigger if exists attendance_guard on attendance;
create trigger attendance_guard before update or delete on attendance
  for each row execute function trg_attendance_guard();

-- A PIN typed at the till for someone clocking: null when right, or what is
-- wrong. The attempt is kept either way.
create or replace function clock_pin_check(p_business uuid, e employee, p_pin text, p_me uuid)
returns text language plpgsql set search_path = public as $$
declare v_mine int; v_day int; v_ok boolean;
begin
  if e.clock_pin_hash is null then
    return format('%s has no PIN yet: a manager sets one on Staff', e.full_name);
  end if;
  select count(*) into v_mine from clock_attempt
   where business_id = p_business and requested_by = p_me and not ok and at > now() - interval '15 minutes';
  if v_mine >= 3 then return 'Too many wrong PINs from this login: try again in 15 minutes'; end if;
  select count(*) into v_day from clock_attempt
   where employee_id = e.id and not ok
     and at > greatest(now() - interval '1 day', coalesce(e.clock_pin_set_at, '-infinity'::timestamptz));
  if v_day >= 20 then
    return format('Clocking by PIN is paused for %s after too many wrong PINs today: a manager sets a new PIN on Staff',
                  e.full_name);
  end if;
  v_ok := extensions.crypt(coalesce(p_pin, ''), e.clock_pin_hash) = e.clock_pin_hash;
  insert into clock_attempt (business_id, employee_id, requested_by, ok) values (p_business, e.id, p_me, v_ok);
  if not v_ok then return 'That PIN is not right'; end if;
  return null;
end $$;

-- Hours that would overlap someone's other hours: their start, or null.
create or replace function attendance_overlap(p_employee uuid, p_in timestamptz, p_out timestamptz, p_except uuid)
returns timestamptz language sql stable set search_path = public as $$
  select min(a.clock_in) from attendance a
   where a.employee_id = p_employee and a.cancelled_at is null and a.id is distinct from p_except
     and a.clock_in < coalesce(p_out, 'infinity'::timestamptz)
     and p_in < coalesce(a.clock_out, 'infinity'::timestamptz)
$$;

-- Who clocks at the till: those who work at the branch, or have hours there
-- today, or are clocked in there; who is in, since when; their hours today.
create or replace function clock_board(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'staff.manage', 'attendance.edit');
  v_loc uuid := resolve_location(v_business, p_location);
  v_today date := business_local_date(v_business, now());
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'employee_id', e.id, 'name', e.full_name, 'title', e.title, 'has_pin', e.clock_pin_hash is not null,
             'in_since', a.clock_in, 'shift_starts', s.starts_at, 'shift_ends', s.ends_at)
           order by (a.id is null), e.full_name)
      from employee e
      left join attendance a on a.employee_id = e.id and a.clock_out is null and a.cancelled_at is null
      left join shift_schedule s on s.employee_id = e.id and s.day = v_today
     where e.business_id = v_business and works_on(e, v_today)
       and (e.location_id = v_loc or s.location_id = v_loc or a.location_id = v_loc)), '[]'::jsonb);
end $$;

create or replace function clock_in__run(p_employee uuid, p_pin text, p_location uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'staff.manage', 'attendance.edit');
  v_me uuid := (current_member()).id;
  v_loc uuid := resolve_location(v_business, p_location);
  v_tz text := (select timezone from business where id = v_business);
  v_now timestamptz := clock_timestamp(); v_day date;
  e employee; a attendance; s shift_schedule; v_err text; v_id uuid; v_late int; v_grace numeric;
begin
  e := staff_member(v_business, p_employee, true);
  v_day := business_local_date(v_business, v_now);
  if not works_on(e, v_day) then raise exception '% does not work here on %', e.full_name, v_day; end if;
  v_err := clock_pin_check(v_business, e, p_pin, v_me);
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  select * into a from attendance x where x.employee_id = e.id and x.clock_out is null and x.cancelled_at is null;
  if found then
    return jsonb_build_object('ok', false,
      'error', format('%s is clocked in already, since %s', e.full_name,
                      to_char(a.clock_in at time zone v_tz, 'DD Mon HH24:MI')));
  end if;
  if attendance_overlap(e.id, v_now, null, null) is not null then
    return jsonb_build_object('ok', false,
      'error', format('%s has hours recorded until later today: a manager corrects them on Staff', e.full_name));
  end if;
  insert into attendance (business_id, employee_id, location_id, clock_in, work_day, source, recorded_by)
  values (v_business, e.id, v_loc, v_now, v_day, 'till', v_me)
  returning id into v_id;
  select * into s from shift_schedule x where x.employee_id = e.id and x.day = v_day;
  v_grace := staff_rule(v_business, 'late_after_minutes');
  if s.id is not null and v_now > s.starts_at + make_interval(mins => v_grace::int) then
    v_late := floor(extract(epoch from v_now - s.starts_at) / 60)::int;
  end if;
  return jsonb_build_object('ok', true, 'attendance_id', v_id, 'employee_id', e.id, 'name', e.full_name,
                            'clock_in', v_now, 'shift_starts', s.starts_at, 'shift_ends', s.ends_at,
                            'late_minutes', v_late);
end $$;

create or replace function clock_in(p_employee uuid, p_pin text, p_location uuid default null,
                                    p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  -- The PIN is not kept, not even hashed: a retry is the same person, the same key.
  v_req jsonb := jsonb_build_object('p_employee', p_employee, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'clock_in', v_req);
  if v is not null then return v; end if;
  v := clock_in__run(p_employee => p_employee, p_pin => p_pin, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'clock_in', v_req, v);
  return v;
end $$;

create or replace function clock_out__run(p_employee uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'staff.manage', 'attendance.edit');
  v_me uuid := (current_member()).id;
  v_now timestamptz := clock_timestamp();
  e employee; a attendance; s shift_schedule; v_err text; v_minutes int; v_early int; v_grace numeric;
begin
  e := staff_member(v_business, p_employee, true);
  v_err := clock_pin_check(v_business, e, p_pin, v_me);
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  select * into a from attendance x where x.employee_id = e.id and x.clock_out is null and x.cancelled_at is null
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', format('%s is not clocked in', e.full_name));
  end if;
  if v_now > a.clock_in + interval '24 hours' then
    return jsonb_build_object('ok', false,
      'error', format('%s has been clocked in for more than a day: a manager corrects the hours on Staff', e.full_name));
  end if;
  update attendance set clock_out = v_now, out_recorded_by = v_me where id = a.id;
  v_minutes := floor(extract(epoch from v_now - a.clock_in) / 60)::int;
  select * into s from shift_schedule x where x.employee_id = e.id and x.day = a.work_day;
  v_grace := staff_rule(v_business, 'late_after_minutes');
  if s.id is not null and v_now < s.ends_at - make_interval(mins => v_grace::int) then
    v_early := floor(extract(epoch from s.ends_at - v_now) / 60)::int;
  end if;
  return jsonb_build_object('ok', true, 'attendance_id', a.id, 'employee_id', e.id, 'name', e.full_name,
                            'clock_in', a.clock_in, 'clock_out', v_now, 'minutes', v_minutes,
                            'shift_ends', s.ends_at, 'early_minutes', v_early);
end $$;

create or replace function clock_out(p_employee uuid, p_pin text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  -- The PIN is not kept, not even hashed: a retry is the same person, the same key.
  v_req jsonb := jsonb_build_object('p_employee', p_employee);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'clock_out', v_req);
  if v is not null then return v; end if;
  v := clock_out__run(p_employee => p_employee, p_pin => p_pin);
  perform idem_finish(v_business, p_idempotency_key, 'clock_out', v_req, v);
  return v;
end $$;

-- Hours checked before they are written: in the past, a day at most, while
-- the person works here, clear of their other hours, and in a month whose pay
-- is not yet approved.
create or replace function attendance_checked(p_business uuid, e employee, p_in timestamptz, p_out timestamptz,
                                              p_except uuid) returns date
language plpgsql set search_path = public as $$
declare v_day date; v_other timestamptz; v_tz text := (select timezone from business where id = p_business);
begin
  if p_in is null then raise exception 'Say when they clocked in'; end if;
  if p_in > now() or p_out > now() then raise exception 'The hours cannot be in the future'; end if;
  if p_out is not null and p_out <= p_in then raise exception 'They clock out after they clock in'; end if;
  if p_out is not null and p_out > p_in + interval '24 hours' then raise exception 'One record is a day of hours at most'; end if;
  v_day := business_local_date(p_business, p_in);
  if not works_on(e, v_day) then raise exception '% does not work here on %', e.full_name, v_day; end if;
  if payroll_settled(p_business, v_day) then
    raise exception 'The pay for % is approved: its hours can no longer change', to_char(v_day, 'YYYY-MM');
  end if;
  v_other := attendance_overlap(e.id, p_in, p_out, p_except);
  if v_other is not null then
    raise exception '% has other hours recorded then, from %', e.full_name,
      to_char(v_other at time zone v_tz, 'DD Mon HH24:MI');
  end if;
  return v_day;
end $$;

-- A record of hours corrected, with why.
create or replace function correct_attendance__run(p_attendance uuid, p_clock_in timestamptz, p_clock_out timestamptz,
                                                   p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('attendance.edit');
  v_me uuid := (current_member()).id;
  a attendance; e employee; v_day date;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the hours are corrected'; end if;
  select * into a from attendance where id = p_attendance and business_id = v_business;
  if not found then raise exception 'Record of hours not found'; end if;
  e := staff_member(v_business, a.employee_id, true);
  select * into a from attendance where id = p_attendance for update;
  if a.cancelled_at is not null then raise exception 'That record was cancelled'; end if;
  if payroll_settled(v_business, a.work_day) then
    raise exception 'The pay for % is approved: its hours can no longer change', to_char(a.work_day, 'YYYY-MM');
  end if;
  v_day := attendance_checked(v_business, e, p_clock_in, p_clock_out, a.id);
  update attendance set clock_in = p_clock_in, clock_out = p_clock_out, work_day = v_day,
                        out_recorded_by = case when p_clock_out is distinct from a.clock_out then v_me
                                               else out_recorded_by end,
                        edited_by = v_me, edited_at = now(), edit_reason = trim(p_reason)
   where id = a.id;
  return jsonb_build_object('attendance_id', a.id, 'employee_id', e.id, 'name', e.full_name,
    'before', jsonb_build_object('clock_in', a.clock_in, 'clock_out', a.clock_out),
    'after', jsonb_build_object('clock_in', p_clock_in, 'clock_out', p_clock_out, 'name', e.full_name));
end $$;

create or replace function correct_attendance(p_attendance uuid, p_clock_in timestamptz, p_clock_out timestamptz,
                                              p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_attendance', p_attendance, 'p_clock_in', p_clock_in, 'p_clock_out', p_clock_out,
                                    'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'correct_attendance', v_req);
  if v is not null then return v; end if;
  v := correct_attendance__run(p_attendance => p_attendance, p_clock_in => p_clock_in, p_clock_out => p_clock_out,
                               p_reason => p_reason);
  perform audit_event(v_business, 'attendance.correct', 'attendance', v ->> 'attendance_id', p_reason,
                      v -> 'before', v -> 'after');
  v := jsonb_build_object('attendance_id', v -> 'attendance_id');
  perform idem_finish(v_business, p_idempotency_key, 'correct_attendance', v_req, v);
  return v;
end $$;

-- Hours nobody clocked, added by a manager, with why. Without an end, the
-- person is in now.
create or replace function add_attendance__run(p_employee uuid, p_clock_in timestamptz, p_clock_out timestamptz,
                                               p_reason text, p_location uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('attendance.edit');
  v_me uuid := (current_member()).id;
  e employee; v_day date; v_id uuid; v_loc uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the hours are added'; end if;
  e := staff_member(v_business, p_employee, true);
  v_loc := resolve_location(v_business, coalesce(p_location, e.location_id));
  v_day := attendance_checked(v_business, e, p_clock_in, p_clock_out, null);
  insert into attendance (business_id, employee_id, location_id, clock_in, clock_out, work_day, source, recorded_by,
                          out_recorded_by, edited_by, edited_at, edit_reason)
  values (v_business, e.id, v_loc, p_clock_in, p_clock_out, v_day, 'manager', v_me,
          case when p_clock_out is not null then v_me end, v_me, now(), trim(p_reason))
  returning id into v_id;
  return jsonb_build_object('attendance_id', v_id, 'employee_id', e.id, 'name', e.full_name,
                            'clock_in', p_clock_in, 'clock_out', p_clock_out);
end $$;

create or replace function add_attendance(p_employee uuid, p_clock_in timestamptz, p_clock_out timestamptz,
                                          p_reason text, p_location uuid default null,
                                          p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_employee', p_employee, 'p_clock_in', p_clock_in, 'p_clock_out', p_clock_out,
                                    'p_reason', p_reason, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'add_attendance', v_req);
  if v is not null then return v; end if;
  v := add_attendance__run(p_employee => p_employee, p_clock_in => p_clock_in, p_clock_out => p_clock_out,
                           p_reason => p_reason, p_location => p_location);
  perform audit_event(v_business, 'attendance.add', 'attendance', v ->> 'attendance_id', p_reason, null,
                      jsonb_build_object('name', v -> 'name', 'clock_in', v -> 'clock_in', 'clock_out', v -> 'clock_out'));
  v := jsonb_build_object('attendance_id', v -> 'attendance_id');
  perform idem_finish(v_business, p_idempotency_key, 'add_attendance', v_req, v);
  return v;
end $$;

-- A record of hours that should not be there (someone clocked in by mistake), cancelled with why.
create or replace function cancel_attendance__run(p_attendance uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('attendance.edit');
  v_me uuid := (current_member()).id;
  a attendance; e employee;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the record is cancelled'; end if;
  select * into a from attendance where id = p_attendance and business_id = v_business;
  if not found then raise exception 'Record of hours not found'; end if;
  e := staff_member(v_business, a.employee_id, true);
  select * into a from attendance where id = p_attendance for update;
  if a.cancelled_at is not null then raise exception 'That record was cancelled'; end if;
  if payroll_settled(v_business, a.work_day) then
    raise exception 'The pay for % is approved: its hours can no longer change', to_char(a.work_day, 'YYYY-MM');
  end if;
  update attendance set cancelled_by = v_me, cancelled_at = now(), cancel_reason = trim(p_reason) where id = a.id;
  return jsonb_build_object('attendance_id', a.id, 'name', e.full_name, 'clock_in', a.clock_in,
                            'clock_out', a.clock_out);
end $$;

create or replace function cancel_attendance(p_attendance uuid, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_attendance', p_attendance, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_attendance', v_req);
  if v is not null then return v; end if;
  v := cancel_attendance__run(p_attendance => p_attendance, p_reason => p_reason);
  perform audit_event(v_business, 'attendance.cancel', 'attendance', v ->> 'attendance_id', p_reason,
                      jsonb_build_object('name', v -> 'name', 'clock_in', v -> 'clock_in', 'clock_out', v -> 'clock_out'),
                      null);
  v := jsonb_build_object('attendance_id', v -> 'attendance_id');
  perform idem_finish(v_business, p_idempotency_key, 'cancel_attendance', v_req, v);
  return v;
end $$;

-- Each day someone had hours on the schedule, or worked, in the dates: the
-- hours as scheduled and as worked, how late they came and how early they
-- left beyond the rule's minutes, whether they were absent (hours on the
-- schedule that ended with nobody clocked), and their overtime (what they
-- worked beyond a day's hours). A record still open counts up to now.
create or replace function staff_days(p_business uuid, p_from date, p_to date, p_employee uuid default null)
returns table (employee_id uuid, day date, shift_starts timestamptz, shift_ends timestamptz, first_in timestamptz,
               last_out timestamptz, minutes int, overtime_minutes int, late_minutes int, early_minutes int,
               absent boolean, still_in boolean, records int)
language sql stable set search_path = public as $$
  with g as (select coalesce(staff_rule(p_business, 'late_after_minutes'), 0)::int as grace),
  w as (
    select x.employee_id, x.work_day as day, min(x.clock_in) as first_in, max(x.clock_out) as last_out,
           bool_or(x.clock_out is null) as still_in,
           sum(floor(extract(epoch from coalesce(x.clock_out, now()) - x.clock_in) / 60))::int as minutes,
           count(*)::int as records
      from attendance x
     where x.business_id = p_business and x.cancelled_at is null and x.work_day between p_from and p_to
       and (p_employee is null or x.employee_id = p_employee)
     group by x.employee_id, x.work_day
  ),
  s as (
    select x.employee_id, x.day, x.starts_at, x.ends_at from shift_schedule x
     where x.business_id = p_business and x.day between p_from and p_to
       and (p_employee is null or x.employee_id = p_employee)
  )
  select coalesce(w.employee_id, s.employee_id), coalesce(w.day, s.day), s.starts_at, s.ends_at, w.first_in,
         case when w.still_in then null else w.last_out end,
         coalesce(w.minutes, 0),
         greatest(coalesce(w.minutes, 0) - round(e.standard_hours * 60)::int, 0),
         case when s.starts_at is not null and w.first_in > s.starts_at + make_interval(mins => g.grace)
              then floor(extract(epoch from w.first_in - s.starts_at) / 60)::int end,
         case when s.ends_at is not null and not w.still_in and w.last_out < s.ends_at - make_interval(mins => g.grace)
              then floor(extract(epoch from s.ends_at - w.last_out) / 60)::int end,
         s.starts_at is not null and w.employee_id is null and s.ends_at < now(),
         coalesce(w.still_in, false), coalesce(w.records, 0)
    from w full join s on s.employee_id = w.employee_id and s.day = w.day
    join employee e on e.id = coalesce(w.employee_id, s.employee_id)
    cross join g
$$;

-- The records of hours in the dates, as Staff shows them: whose, when, how
-- long, how late or early, and each correction's why.
create or replace function attendance_list(p_from date, p_to date, p_employee uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage', 'attendance.edit', 'payroll.view');
  v_long numeric;
begin
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Choose the dates, the first before the last'; end if;
  if p_to - p_from > 62 then raise exception 'Choose up to 62 days'; end if;
  v_long := staff_rule(v_business, 'clocked_in_alert_hours');
  return jsonb_build_object(
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'employee_id', a.employee_id, 'name', e.full_name, 'location', l.name,
               'day', a.work_day, 'clock_in', a.clock_in, 'clock_out', a.clock_out,
               'minutes', floor(extract(epoch from coalesce(a.clock_out, now()) - a.clock_in) / 60)::int,
               'long', coalesce(a.clock_out, now()) - a.clock_in > make_interval(hours => v_long::int),
               'source', a.source, 'recorded_by', rb.full_name,
               'edited_by', eb.full_name, 'edited_at', a.edited_at, 'edit_reason', a.edit_reason,
               'cancelled_by', cb.full_name, 'cancelled_at', a.cancelled_at, 'cancel_reason', a.cancel_reason,
               'settled', payroll_settled(v_business, a.work_day))
             order by a.clock_in desc, a.id)
        from attendance a
        join employee e on e.id = a.employee_id
        join location l on l.id = a.location_id
        left join app_user rb on rb.id = a.recorded_by
        left join app_user eb on eb.id = a.edited_by
        left join app_user cb on cb.id = a.cancelled_by
       where a.business_id = v_business and a.work_day between p_from and p_to
         and (p_employee is null or a.employee_id = p_employee)), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
               'employee_id', d.employee_id, 'name', e.full_name, 'day', d.day, 'shift_starts', d.shift_starts,
               'shift_ends', d.shift_ends, 'first_in', d.first_in, 'last_out', d.last_out, 'minutes', d.minutes,
               'overtime_minutes', d.overtime_minutes, 'late_minutes', d.late_minutes,
               'early_minutes', d.early_minutes, 'absent', d.absent, 'still_in', d.still_in)
             order by d.day desc, e.full_name)
        from staff_days(v_business, p_from, p_to, p_employee) d join employee e on e.id = d.employee_id),
      '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 7. Advances
-- ---------------------------------------------------------------------------
create table if not exists employee_advance (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references business (id) on delete cascade,
  employee_id       uuid not null references employee (id),
  amount            numeric not null,
  paid_from         text not null,
  location_id       uuid references location (id),
  reason            text not null,
  given_on          date not null,
  journal_entry_id  uuid references journal_entry (id),
  created_by        uuid references app_user (id),
  created_at        timestamptz not null default now(),
  cancelled_by      uuid references app_user (id),
  cancelled_at      timestamptz,
  cancel_reason     text,
  cancel_journal_id uuid references journal_entry (id),
  constraint employee_advance_amount check (amount > 0),
  constraint employee_advance_from check (paid_from in ('till', 'safe', 'bank', 'owner')),
  constraint employee_advance_cancel check ((cancelled_at is null) = (cancel_reason is null))
);
create index if not exists employee_advance_employee on employee_advance (employee_id, given_on);

-- An advance is written once; only its cancellation is added to it.
create or replace function trg_employee_advance_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'An advance is cancelled, not deleted'; end if;
  if old.cancelled_at is not null
     or (to_jsonb(new) - array['cancelled_by', 'cancelled_at', 'cancel_reason', 'cancel_journal_id'])
        is distinct from (to_jsonb(old) - array['cancelled_by', 'cancelled_at', 'cancel_reason', 'cancel_journal_id']) then
    raise exception 'An advance is not changed: cancel it and give it again';
  end if;
  return new;
end $$;
drop trigger if exists employee_advance_guard on employee_advance;
create trigger employee_advance_guard before update or delete on employee_advance
  for each row execute function trg_employee_advance_guard();

-- Where money for staff comes from.
create or replace function staff_paid_from(p_from text) returns text
language plpgsql immutable as $$
declare v text := lower(coalesce(p_from, ''));
begin
  if v = 'cash' then v := 'till'; end if;
  if v not in ('till', 'safe', 'bank', 'owner') then
    raise exception 'Say where the money came from: the till, the safe, the bank or the owner';
  end if;
  return v;
end $$;

create or replace function record_advance__run(p_employee uuid, p_amount numeric, p_paid_from text, p_reason text)
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
  v_loc := resolve_location(v_business, null);
  v_journal := post_journal(v_business, now(), 'Advance to ' || e.full_name || ': ' || trim(p_reason),
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

create or replace function record_advance(p_employee uuid, p_amount numeric, p_paid_from text, p_reason text,
                                          p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_employee', p_employee, 'p_amount', p_amount, 'p_paid_from', p_paid_from,
                                    'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_advance', v_req);
  if v is not null then return v; end if;
  v := record_advance__run(p_employee => p_employee, p_amount => p_amount, p_paid_from => p_paid_from,
                           p_reason => p_reason);
  perform audit_event(v_business, 'payroll.advance', 'employee_advance', v ->> 'advance_id', p_reason, null,
    jsonb_build_object('name', v -> 'name', 'amount', v -> 'amount', 'paid_from', v -> 'paid_from', 'owed', v -> 'owed'));
  perform idem_finish(v_business, p_idempotency_key, 'record_advance', v_req, v);
  return v;
end $$;

-- Cash back into the drawer it left, when money for staff is taken back.
create or replace function staff_cash_back(p_business uuid, p_location uuid, p_from text, p_amount numeric,
                                           p_ref_type text, p_ref uuid, p_by uuid) returns void
language plpgsql set search_path = public as $$
begin
  if p_from = 'till' then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (p_business, p_location, 'paid_out_reversed', p_amount, p_ref_type, p_ref, p_by);
  end if;
end $$;

-- An advance given by mistake, cancelled while none of it is taken back: its
-- journal reversed, its cash back where it came from.
create or replace function cancel_advance__run(p_advance uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  v employee_advance; e employee; v_rev uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the advance is cancelled'; end if;
  select * into v from employee_advance where id = p_advance and business_id = v_business;
  if not found then raise exception 'Advance not found'; end if;
  e := staff_member(v_business, v.employee_id, true);
  select * into v from employee_advance where id = p_advance for update;
  if v.cancelled_at is not null then raise exception 'This advance was cancelled already'; end if;
  if advance_owed(v_business, e.id) < v.amount then
    raise exception 'Some of this advance was taken back from a salary already: it cannot be cancelled';
  end if;
  if v.journal_entry_id is not null then
    v_rev := reverse_entry_internal(v.journal_entry_id, now(), 'Advance cancelled: ' || trim(p_reason));
  end if;
  update employee_advance set cancelled_by = v_me, cancelled_at = now(), cancel_reason = trim(p_reason),
                              cancel_journal_id = v_rev
   where id = v.id;
  perform staff_cash_back(v_business, coalesce(v.location_id, resolve_location(v_business, null)), v.paid_from,
                          v.amount, 'employee_advance', v.id, v_me);
  return jsonb_build_object('advance_id', v.id, 'name', e.full_name, 'amount', v.amount, 'paid_from', v.paid_from,
                            'owed', advance_owed(v_business, e.id),
                            'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

create or replace function cancel_advance(p_advance uuid, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_advance', p_advance, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_advance', v_req);
  if v is not null then return v; end if;
  v := cancel_advance__run(p_advance => p_advance, p_reason => p_reason);
  perform audit_event(v_business, 'payroll.advance_cancel', 'employee_advance', v ->> 'advance_id', p_reason,
    jsonb_build_object('amount', v -> 'amount', 'paid_from', v -> 'paid_from'),
    jsonb_build_object('name', v -> 'name', 'owed', v -> 'owed'));
  perform idem_finish(v_business, p_idempotency_key, 'cancel_advance', v_req, v);
  return v;
end $$;

-- The advances, and what each person still owes.
create or replace function employee_advances(p_employee uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('payroll.view');
begin
  return jsonb_build_object(
    'advances', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'employee_id', v.employee_id, 'name', e.full_name, 'amount', v.amount,
               'paid_from', v.paid_from, 'reason', v.reason, 'given_on', v.given_on, 'by', u.full_name,
               'journal_no', j.journal_no, 'cancelled_at', v.cancelled_at, 'cancel_reason', v.cancel_reason)
             order by v.given_on desc, v.created_at desc)
        from employee_advance v
        join employee e on e.id = v.employee_id
        left join app_user u on u.id = v.created_by
        left join journal_entry j on j.id = v.journal_entry_id
       where v.business_id = v_business and (p_employee is null or v.employee_id = p_employee)), '[]'::jsonb),
    'owed', coalesce((
      select jsonb_agg(jsonb_build_object('employee_id', x.id, 'name', x.full_name, 'owed', x.owed)
             order by x.full_name)
        from (select e.id, e.full_name, advance_owed(v_business, e.id) as owed from employee e
               where e.business_id = v_business and (p_employee is null or e.id = p_employee)) x
       where x.owed <> 0), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 8. Payroll, a month at a time
-- ---------------------------------------------------------------------------
create table if not exists payroll_run (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business (id) on delete cascade,
  run_no           bigint not null,
  month            date not null,
  status           text not null default 'draft',
  drafted_by       uuid references app_user (id),
  drafted_at       timestamptz not null default now(),
  approved_by      uuid references app_user (id),
  approved_at      timestamptz,
  journal_entry_id uuid references journal_entry (id),
  created_at       timestamptz not null default now(),
  constraint payroll_run_status check (status in ('draft', 'approved', 'paid')),
  constraint payroll_run_month check (month = date_trunc('month', month)::date),
  constraint payroll_run_steps check ((status = 'draft') = (approved_at is null))
);
create unique index if not exists payroll_run_month_once on payroll_run (business_id, month);
create unique index if not exists payroll_run_no on payroll_run (business_id, run_no);

-- Whether the pay for the month a day is in is approved or paid: its hours are then settled.
create or replace function payroll_settled(p_business uuid, p_day date) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from payroll_run r
                  where r.business_id = p_business and r.month = date_trunc('month', p_day)::date
                    and r.status in ('approved', 'paid'))
$$;

create table if not exists payroll_line (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references payroll_run (id),
  business_id       uuid not null references business (id) on delete cascade,
  employee_id       uuid not null references employee (id),
  -- The pay as it was when drafted.
  pay_basis         text,
  rate              numeric,
  standard_hours    numeric not null,
  overtime_percent  numeric not null,
  -- The month's hours, as the records stood.
  days_in_month     int not null,
  days_employed     int not null,
  days_worked       int not null default 0,
  minutes_worked    int not null default 0,
  overtime_minutes  int not null default 0,
  days_scheduled    int not null default 0,
  days_absent       int not null default 0,
  times_late        int not null default 0,
  minutes_late      int not null default 0,
  still_in          boolean not null default false,
  -- The pay.
  base_pay          numeric not null default 0,
  overtime_pay      numeric not null default 0,
  additions         numeric not null default 0,
  additions_note    text,
  deductions        numeric not null default 0,
  deductions_note   text,
  advance_owed      numeric not null default 0,
  advance_recovered numeric not null default 0,
  -- Whether a person chose what is taken back of the advances.
  recovery_set      boolean not null default false,
  gross             numeric not null default 0,
  net               numeric not null default 0,
  constraint payroll_line_amounts check (additions >= 0 and deductions >= 0 and advance_recovered >= 0
                                         and base_pay >= 0 and overtime_pay >= 0 and gross >= 0 and net >= 0),
  constraint payroll_line_gross check (gross = base_pay + overtime_pay + additions - deductions),
  constraint payroll_line_net check (net = gross - advance_recovered),
  constraint payroll_line_notes check ((additions = 0 or additions_note is not null)
                                       and (deductions = 0 or deductions_note is not null))
);
create unique index if not exists payroll_line_once on payroll_line (run_id, employee_id);
create index if not exists payroll_line_employee on payroll_line (employee_id);

-- What someone still owes of their advances: given and not cancelled, less
-- what approved payrolls took back.
create or replace function advance_owed(p_business uuid, p_employee uuid) returns numeric
language sql stable set search_path = public as $$
  select coalesce((select sum(v.amount) from employee_advance v
                    where v.business_id = p_business and v.employee_id = p_employee and v.cancelled_at is null), 0)
       - coalesce((select sum(l.advance_recovered) from payroll_line l join payroll_run r on r.id = l.run_id
                    where l.business_id = p_business and l.employee_id = p_employee
                      and r.status in ('approved', 'paid')), 0)
$$;

-- Each time a payroll is approved: who, when, what it came to, and its one
-- journal; reopened, with who, when, why and the journal that reversed it.
create table if not exists payroll_approval (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references business (id) on delete cascade,
  run_id             uuid not null references payroll_run (id),
  approved_by        uuid references app_user (id),
  approved_at        timestamptz not null default now(),
  gross              numeric not null,
  net                numeric not null,
  advances_recovered numeric not null,
  journal_entry_id   uuid references journal_entry (id),
  reopened_by        uuid references app_user (id),
  reopened_at        timestamptz,
  reopen_reason      text,
  reopen_journal_id  uuid references journal_entry (id),
  constraint payroll_approval_reopen check ((reopened_at is null) = (reopen_reason is null))
);
create unique index if not exists payroll_approval_live on payroll_approval (run_id) where reopened_at is null;

-- An approval is written once; only its reopening is added to it.
create or replace function trg_payroll_approval_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'A payroll''s approval is reopened, not deleted'; end if;
  if old.reopened_at is not null
     or (to_jsonb(new) - array['reopened_by', 'reopened_at', 'reopen_reason', 'reopen_journal_id'])
        is distinct from (to_jsonb(old) - array['reopened_by', 'reopened_at', 'reopen_reason', 'reopen_journal_id']) then
    raise exception 'A payroll''s approval is not changed: reopen the payroll';
  end if;
  return new;
end $$;
drop trigger if exists payroll_approval_guard on payroll_approval;
create trigger payroll_approval_guard before update or delete on payroll_approval
  for each row execute function trg_payroll_approval_guard();

-- A payroll's lines change only while it is a draft; a payroll is never deleted.
create or replace function trg_payroll_line_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from payroll_run where id = coalesce(new.run_id, old.run_id);
  if v_status is distinct from 'draft' then
    raise exception 'Only a draft payroll changes: this one is approved';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists payroll_line_guard on payroll_line;
create trigger payroll_line_guard before insert or update or delete on payroll_line
  for each row execute function trg_payroll_line_guard();
drop trigger if exists payroll_run_append_only on payroll_run;
create trigger payroll_run_append_only before delete on payroll_run
  for each row execute function forbid_mutation();

-- What someone earned in a month, from their pay and their hours: the base
-- (a month's pay for the days they worked here; a day's pay for each day
-- worked; an hour's for each hour not overtime), and overtime (each hour beyond
-- a day's hours at the overtime rate). An hour's pay: an hourly rate; a day's
-- pay over a day's hours; a month's pay over 30 days and a day's hours.
create or replace function payroll_figures(p_business uuid, e employee, p_month date)
returns table (days_in_month int, days_employed int, days_worked int, minutes_worked int, overtime_minutes int,
               days_scheduled int, days_absent int, times_late int, minutes_late int, still_in boolean,
               overtime_percent numeric, base_pay numeric, overtime_pay numeric)
language plpgsql stable set search_path = public as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_hour numeric;
begin
  days_in_month := v_end - v_start + 1;
  days_employed := greatest(least(coalesce(e.left_on, v_end), v_end) - greatest(e.hired_on, v_start) + 1, 0);
  select coalesce(count(*) filter (where d.minutes > 0), 0), coalesce(sum(d.minutes), 0),
         coalesce(sum(d.overtime_minutes), 0), coalesce(count(*) filter (where d.shift_starts is not null), 0),
         coalesce(count(*) filter (where d.absent), 0), coalesce(count(*) filter (where d.late_minutes is not null), 0),
         coalesce(sum(d.late_minutes), 0), coalesce(bool_or(d.still_in), false)
    into days_worked, minutes_worked, overtime_minutes, days_scheduled, days_absent, times_late, minutes_late, still_in
    from staff_days(p_business, v_start, v_end, e.id) d;
  overtime_percent := coalesce(e.overtime_percent, staff_rule(p_business, 'overtime_percent'), 150);
  v_hour := case e.pay_basis when 'hourly' then e.rate
                             when 'daily' then e.rate / e.standard_hours
                             when 'monthly' then e.rate / 30 / e.standard_hours end;
  base_pay := coalesce(money_round(p_business, case e.pay_basis
                when 'monthly' then e.rate * days_employed / days_in_month
                when 'daily' then e.rate * days_worked
                when 'hourly' then e.rate * (minutes_worked - overtime_minutes) / 60 end), 0);
  overtime_pay := coalesce(money_round(p_business, v_hour * overtime_percent / 100 * overtime_minutes / 60), 0);
  return next;
end $$;

-- A payroll's lines, drafted afresh from the pay and the hours: what a person
-- added (additions, deductions and their why) stays, and so does what they
-- chose to take back of the advances, as far as it is still owed and earned.
create or replace function payroll_refresh(p_business uuid, p_run uuid) returns void
language plpgsql set search_path = public as $$
declare
  r payroll_run; e employee; f record; l payroll_line; v_start date; v_end date; v_owed numeric; v_gross numeric;
  v_recover numeric; v_ded numeric;
begin
  select * into r from payroll_run where id = p_run;
  v_start := r.month;
  v_end := (r.month + interval '1 month - 1 day')::date;
  delete from payroll_line x where x.run_id = r.id
     and not exists (select 1 from employee y where y.id = x.employee_id and y.hired_on <= v_end
                       and (y.left_on is null or y.left_on >= v_start));
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

-- Whether a draft still says what the pay and the hours say now: nobody new,
-- nobody gone, no hours or pay changed since it was drafted.
create or replace function payroll_current(p_business uuid, p_run uuid) returns boolean
language plpgsql stable set search_path = public as $$
declare r payroll_run; e employee; f record; l payroll_line; v_start date; v_end date;
begin
  select * into r from payroll_run where id = p_run;
  v_start := r.month;
  v_end := (r.month + interval '1 month - 1 day')::date;
  if exists (select 1 from payroll_line x join employee y on y.id = x.employee_id
              where x.run_id = r.id and not (y.hired_on <= v_end and (y.left_on is null or y.left_on >= v_start))) then
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

-- A payroll's month, as its messages name it.
create or replace function payroll_month_text(p_month date) returns text
language sql immutable as $$ select to_char(p_month, 'YYYY-MM') $$;

-- A month's payroll drafted, or its draft drafted again from the hours and the pay as they are now.
create or replace function draft_payroll__run(p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  v_month date := date_trunc('month', p_month)::date;
  v_today date := business_local_date(v_business, now());
  r payroll_run; v_new boolean := false;
begin
  if p_month is null then raise exception 'Choose the month'; end if;
  if v_month > date_trunc('month', v_today)::date then raise exception 'Choose a month that has begun'; end if;
  -- One payroll a month, however many ask at once.
  perform pg_advisory_xact_lock(hashtextextended('payroll:' || v_business::text || ':' || v_month::text, 0));
  select * into r from payroll_run where business_id = v_business and month = v_month for update;
  if found and r.status <> 'draft' then
    raise exception 'The pay for % is approved already', payroll_month_text(v_month);
  end if;
  if not found then
    insert into payroll_run (business_id, run_no, month, drafted_by)
    values (v_business, next_document_no(v_business, 'payroll', 1), v_month, v_me)
    returning * into r;
    v_new := true;
  end if;
  perform payroll_refresh(v_business, r.id);
  return jsonb_build_object('run_id', r.id, 'run_no', r.run_no, 'month', v_month, 'new', v_new,
    'people', (select count(*) from payroll_line where run_id = r.id),
    'gross', (select coalesce(sum(gross), 0) from payroll_line where run_id = r.id),
    'net', (select coalesce(sum(net), 0) from payroll_line where run_id = r.id));
end $$;

create or replace function draft_payroll(p_month date, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_month', p_month);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'draft_payroll', v_req);
  if v is not null then return v; end if;
  v := draft_payroll__run(p_month => p_month);
  perform audit_event(v_business, 'payroll.draft', 'payroll_run', v ->> 'run_id', null, null,
    jsonb_build_object('run_no', v -> 'run_no', 'month', v -> 'month', 'people', v -> 'people',
                       'gross', v -> 'gross', 'net', v -> 'net'));
  perform idem_finish(v_business, p_idempotency_key, 'draft_payroll', v_req, v);
  return v;
end $$;

-- A draft's line changed: what is added and deducted, with why, and what is
-- taken back of the advances (none given: all that is owed, as far as the pay goes).
create or replace function adjust_payroll_line__run(p_line uuid, p_additions numeric, p_additions_note text,
                                                    p_deductions numeric, p_deductions_note text,
                                                    p_advance_recovered numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  l payroll_line; r payroll_run; e employee;
  v_add numeric := money_round(v_business, coalesce(p_additions, 0));
  v_ded numeric := money_round(v_business, coalesce(p_deductions, 0));
  v_rec numeric := money_round(v_business, p_advance_recovered);
  v_owed numeric; v_gross numeric;
begin
  select * into l from payroll_line where id = p_line and business_id = v_business;
  if not found then raise exception 'Payroll line not found'; end if;
  select * into r from payroll_run where id = l.run_id for update;
  if r.status <> 'draft' then raise exception 'Only a draft payroll changes: this one is approved'; end if;
  select * into l from payroll_line where id = p_line for update;
  e := staff_member(v_business, l.employee_id);
  if v_add < 0 or v_ded < 0 or v_rec < 0 then raise exception 'Enter amounts of zero or more'; end if;
  if v_add > 0 and nullif(trim(p_additions_note), '') is null then raise exception 'Say what the addition is for'; end if;
  if v_ded > 0 and nullif(trim(p_deductions_note), '') is null then raise exception 'Say what the deduction is for'; end if;
  if v_ded > l.base_pay + l.overtime_pay + v_add then
    raise exception 'The deductions are more than % earned (%)', e.full_name, trim_scale(l.base_pay + l.overtime_pay + v_add);
  end if;
  v_gross := l.base_pay + l.overtime_pay + v_add - v_ded;
  v_owed := greatest(advance_owed(v_business, e.id), 0);
  if v_rec is not null and v_rec > v_owed then
    raise exception '% owes % of advances: take back no more than that', e.full_name, trim_scale(v_owed);
  end if;
  if v_rec is not null and v_rec > v_gross then
    raise exception 'Take back no more of the advances than the pay (%)', trim_scale(v_gross);
  end if;
  update payroll_line
     set additions = v_add, additions_note = case when v_add > 0 then trim(p_additions_note) end,
         deductions = v_ded, deductions_note = case when v_ded > 0 then trim(p_deductions_note) end,
         advance_owed = v_owed, advance_recovered = coalesce(v_rec, least(v_owed, v_gross)),
         recovery_set = v_rec is not null, gross = v_gross, net = v_gross - coalesce(v_rec, least(v_owed, v_gross))
   where id = l.id;
  return jsonb_build_object('line_id', l.id, 'run_id', r.id, 'name', e.full_name,
    'before', jsonb_build_object('additions', l.additions, 'additions_note', l.additions_note,
                                 'deductions', l.deductions, 'deductions_note', l.deductions_note,
                                 'advance_recovered', l.advance_recovered, 'net', l.net),
    'after', (select jsonb_build_object('name', e.full_name, 'additions', x.additions, 'additions_note', x.additions_note,
                                        'deductions', x.deductions, 'deductions_note', x.deductions_note,
                                        'advance_recovered', x.advance_recovered, 'net', x.net)
                from payroll_line x where x.id = l.id));
end $$;

create or replace function adjust_payroll_line(p_line uuid, p_additions numeric, p_additions_note text,
                                               p_deductions numeric, p_deductions_note text,
                                               p_advance_recovered numeric default null,
                                               p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_line', p_line, 'p_additions', p_additions, 'p_additions_note', p_additions_note,
                                    'p_deductions', p_deductions, 'p_deductions_note', p_deductions_note,
                                    'p_advance_recovered', p_advance_recovered);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'adjust_payroll_line', v_req);
  if v is not null then return v; end if;
  v := adjust_payroll_line__run(p_line => p_line, p_additions => p_additions, p_additions_note => p_additions_note,
                                p_deductions => p_deductions, p_deductions_note => p_deductions_note,
                                p_advance_recovered => p_advance_recovered);
  perform audit_event(v_business, 'payroll.adjust', 'payroll_run', v ->> 'run_id', null, v -> 'before', v -> 'after');
  v := jsonb_build_object('line_id', v -> 'line_id', 'run_id', v -> 'run_id', 'net', v #> '{after,net}');
  perform idem_finish(v_business, p_idempotency_key, 'adjust_payroll_line', v_req, v);
  return v;
end $$;

-- A month's payroll approved, once the month is over and the draft says what
-- the hours and the pay say: Dr 6100 the pay, Cr 2100 what is to be paid and
-- 1300 what is taken back of the advances, on the month's last day.
create or replace function approve_payroll__run(p_run uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  v_tz text := (select timezone from business where id = v_business);
  v_today date := business_local_date(v_business, now());
  r payroll_run; v_end date; v_gross numeric; v_net numeric; v_rec numeric; v_journal uuid; v_name text;
  v_since timestamptz; v_approval uuid := gen_random_uuid();
begin
  select * into r from payroll_run where id = p_run and business_id = v_business for update;
  if not found then raise exception 'Payroll not found'; end if;
  if r.status <> 'draft' then raise exception 'This payroll is approved already'; end if;
  v_end := (r.month + interval '1 month - 1 day')::date;
  if v_end >= v_today then
    raise exception 'The pay for % is approved once the month is over', payroll_month_text(r.month);
  end if;
  perform 1 from employee y where y.business_id = v_business order by y.id for update;
  if not exists (select 1 from payroll_line where run_id = r.id) then
    raise exception 'Nobody worked here in %: there is no pay to approve', payroll_month_text(r.month);
  end if;
  select e.full_name, a.clock_in into v_name, v_since
    from payroll_line l join employee e on e.id = l.employee_id
    join attendance a on a.employee_id = e.id and a.clock_out is null and a.cancelled_at is null
                     and a.work_day <= v_end
   where l.run_id = r.id limit 1;
  if found then
    raise exception '% is still clocked in since %: clock them out or correct the hours first', v_name,
      to_char(v_since at time zone v_tz, 'DD Mon HH24:MI');
  end if;
  select e.full_name into v_name from payroll_line l join employee e on e.id = l.employee_id
   where l.run_id = r.id and l.rate is null order by e.full_name limit 1;
  if found then raise exception 'Set %''s pay on Staff, then draft the payroll again', v_name; end if;
  if not payroll_current(v_business, r.id) then
    raise exception 'The hours or the pay changed since this draft: draft it again, check it, then approve it';
  end if;
  select coalesce(sum(gross), 0), coalesce(sum(net), 0), coalesce(sum(advance_recovered), 0)
    into v_gross, v_net, v_rec from payroll_line where run_id = r.id;
  if v_gross > 0 then
    v_journal := post_journal(v_business, (v_end + time '12:00') at time zone v_tz,
      'Payroll ' || payroll_month_text(r.month) || ' (' || r.run_no || ')', 'payroll_approval', v_approval,
      jsonb_build_array(jsonb_build_object('code', '6100', 'debit', v_gross),
                        jsonb_build_object('code', '2100', 'credit', v_net),
                        jsonb_build_object('code', '1300', 'credit', v_rec)));
  end if;
  insert into payroll_approval (id, business_id, run_id, approved_by, gross, net, advances_recovered, journal_entry_id)
  values (v_approval, v_business, r.id, v_me, v_gross, v_net, v_rec, v_journal);
  update payroll_run set status = case when v_net = 0 then 'paid' else 'approved' end, approved_by = v_me,
                         approved_at = now(), journal_entry_id = v_journal
   where id = r.id;
  return jsonb_build_object('run_id', r.id, 'run_no', r.run_no, 'month', r.month,
    'status', case when v_net = 0 then 'paid' else 'approved' end,
    'people', (select count(*) from payroll_line where run_id = r.id),
    'gross', v_gross, 'net', v_net, 'advances_recovered', v_rec,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

create or replace function approve_payroll(p_run uuid, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_run', p_run);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'approve_payroll', v_req);
  if v is not null then return v; end if;
  v := approve_payroll__run(p_run => p_run);
  perform audit_event(v_business, 'payroll.approve', 'payroll_run', v ->> 'run_id', null,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', v -> 'status', 'run_no', v -> 'run_no', 'month', v -> 'month', 'people', v -> 'people',
                       'gross', v -> 'gross', 'net', v -> 'net', 'advances_recovered', v -> 'advances_recovered'));
  perform idem_finish(v_business, p_idempotency_key, 'approve_payroll', v_req, v);
  return v;
end $$;

-- An approved payroll back to a draft, with why, while nothing is paid from
-- it: its journal is reversed.
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
    v_rev := reverse_entry_internal(a.journal_entry_id, now(), 'Payroll reopened: ' || trim(p_reason));
  end if;
  update payroll_approval set reopened_by = v_me, reopened_at = now(), reopen_reason = trim(p_reason),
                              reopen_journal_id = v_rev
   where id = a.id;
  update payroll_run set status = 'draft', approved_by = null, approved_at = null, journal_entry_id = null
   where id = r.id;
  return jsonb_build_object('run_id', r.id, 'run_no', r.run_no, 'month', r.month, 'was', r.status,
                            'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

create or replace function reopen_payroll(p_run uuid, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_run', p_run, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'reopen_payroll', v_req);
  if v is not null then return v; end if;
  v := reopen_payroll__run(p_run => p_run, p_reason => p_reason);
  perform audit_event(v_business, 'payroll.reopen', 'payroll_run', v ->> 'run_id', p_reason,
    jsonb_build_object('status', v -> 'was'),
    jsonb_build_object('status', 'draft', 'run_no', v -> 'run_no', 'month', v -> 'month'));
  perform idem_finish(v_business, p_idempotency_key, 'reopen_payroll', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Salaries paid
-- ---------------------------------------------------------------------------
create table if not exists salary_payment (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references business (id) on delete cascade,
  run_id            uuid not null references payroll_run (id),
  paid_from         text not null,
  location_id       uuid references location (id),
  amount            numeric not null,
  paid_on           date not null,
  journal_entry_id  uuid references journal_entry (id),
  created_by        uuid references app_user (id),
  created_at        timestamptz not null default now(),
  cancelled_by      uuid references app_user (id),
  cancelled_at      timestamptz,
  cancel_reason     text,
  cancel_journal_id uuid references journal_entry (id),
  constraint salary_payment_amount check (amount > 0),
  constraint salary_payment_from check (paid_from in ('till', 'safe', 'bank', 'owner')),
  constraint salary_payment_cancel check ((cancelled_at is null) = (cancel_reason is null))
);
create index if not exists salary_payment_run on salary_payment (run_id);

create table if not exists salary_payment_line (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references salary_payment (id),
  business_id uuid not null references business (id) on delete cascade,
  line_id     uuid not null references payroll_line (id),
  employee_id uuid not null references employee (id),
  amount      numeric not null,
  constraint salary_payment_line_amount check (amount > 0)
);
create index if not exists salary_payment_line_payment on salary_payment_line (payment_id);
create index if not exists salary_payment_line_line on salary_payment_line (line_id);

-- What a payroll line has been paid.
create or replace function payroll_line_paid(p_line uuid) returns numeric
language sql stable set search_path = public as $$
  select coalesce(sum(pl.amount), 0) from salary_payment_line pl join salary_payment p on p.id = pl.payment_id
   where pl.line_id = p_line and p.cancelled_at is null
$$;

-- A payment is written once; only its cancellation is added to it. Its lines never change.
create or replace function trg_salary_payment_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'A salary payment is cancelled, not deleted'; end if;
  if old.cancelled_at is not null
     or (to_jsonb(new) - array['cancelled_by', 'cancelled_at', 'cancel_reason', 'cancel_journal_id'])
        is distinct from (to_jsonb(old) - array['cancelled_by', 'cancelled_at', 'cancel_reason', 'cancel_journal_id']) then
    raise exception 'A salary payment is not changed: cancel it and pay again';
  end if;
  return new;
end $$;
drop trigger if exists salary_payment_guard on salary_payment;
create trigger salary_payment_guard before update or delete on salary_payment
  for each row execute function trg_salary_payment_guard();
drop trigger if exists salary_payment_line_append_only on salary_payment_line;
create trigger salary_payment_line_append_only before update or delete on salary_payment_line
  for each row execute function forbid_mutation();

-- Salaries paid: [{line_id, amount}], from one place, in one journal
-- (Dr 2100, Cr where the money came from).
create or replace function pay_salaries(p_business uuid, r payroll_run, p_lines jsonb, p_from text, p_me uuid)
returns uuid language plpgsql set search_path = public as $$
declare
  v_id uuid := gen_random_uuid(); v_total numeric; v_loc uuid := resolve_location(p_business, null); v_journal uuid;
  v_who text;
begin
  select coalesce(sum((x ->> 'amount')::numeric), 0) into v_total from jsonb_array_elements(p_lines) x;
  select string_agg(e.full_name, ', ' order by e.full_name) into v_who
    from jsonb_array_elements(p_lines) x join payroll_line l on l.id = (x ->> 'line_id')::uuid
    join employee e on e.id = l.employee_id;
  v_journal := post_journal(p_business, now(),
    'Salaries ' || payroll_month_text(r.month) || ': ' || v_who, 'salary_payment', v_id,
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

-- One person's salary paid, all that is owed to them or part of it.
create or replace function pay_salary__run(p_line uuid, p_amount numeric, p_paid_from text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  v_from text := staff_paid_from(p_paid_from);
  l payroll_line; r payroll_run; e employee; v_owed numeric; v_amount numeric; v_pay uuid;
begin
  select * into l from payroll_line where id = p_line and business_id = v_business;
  if not found then raise exception 'Payroll line not found'; end if;
  select * into r from payroll_run where id = l.run_id for update;
  if r.status = 'draft' then raise exception 'Approve the payroll first'; end if;
  e := staff_member(v_business, l.employee_id);
  v_owed := l.net - payroll_line_paid(l.id);
  v_amount := coalesce(money_round(v_business, p_amount), v_owed);
  if v_amount <= 0 then
    if v_owed <= 0 then raise exception '% is paid in full already', e.full_name; end if;
    raise exception 'Enter an amount greater than zero';
  end if;
  if v_amount > v_owed then
    raise exception 'That is more than is owed to % (%)', e.full_name, trim_scale(v_owed);
  end if;
  v_pay := pay_salaries(v_business, r, jsonb_build_array(jsonb_build_object('line_id', l.id, 'amount', v_amount)),
                        v_from, v_me);
  return jsonb_build_object('payment_id', v_pay, 'run_id', r.id, 'name', e.full_name, 'month', r.month,
    'amount', v_amount, 'paid_from', v_from, 'owed', v_owed - v_amount,
    'status', (select status from payroll_run where id = r.id),
    'journal_no', (select j.journal_no from salary_payment p join journal_entry j on j.id = p.journal_entry_id
                    where p.id = v_pay));
end $$;

create or replace function pay_salary(p_line uuid, p_amount numeric, p_paid_from text,
                                      p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_line', p_line, 'p_amount', p_amount, 'p_paid_from', p_paid_from);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'pay_salary', v_req);
  if v is not null then return v; end if;
  v := pay_salary__run(p_line => p_line, p_amount => p_amount, p_paid_from => p_paid_from);
  perform audit_event(v_business, 'payroll.pay', 'salary_payment', v ->> 'payment_id', null, null,
    jsonb_build_object('name', v -> 'name', 'month', v -> 'month', 'amount', v -> 'amount', 'paid_from', v -> 'paid_from',
                       'owed', v -> 'owed'));
  perform idem_finish(v_business, p_idempotency_key, 'pay_salary', v_req, v);
  return v;
end $$;

-- Everyone still owed their salary for a month, paid at once from one place.
create or replace function pay_payroll__run(p_run uuid, p_paid_from text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  v_from text := staff_paid_from(p_paid_from);
  r payroll_run; v_lines jsonb; v_pay uuid;
begin
  select * into r from payroll_run where id = p_run and business_id = v_business for update;
  if not found then raise exception 'Payroll not found'; end if;
  if r.status = 'draft' then raise exception 'Approve the payroll first'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('line_id', x.id, 'amount', x.owed) order by x.id), '[]'::jsonb)
    into v_lines
    from (select l.id, l.net - payroll_line_paid(l.id) as owed from payroll_line l where l.run_id = r.id) x
   where x.owed > 0;
  if jsonb_array_length(v_lines) = 0 then raise exception 'Everyone is paid in full already'; end if;
  v_pay := pay_salaries(v_business, r, v_lines, v_from, v_me);
  return jsonb_build_object('payment_id', v_pay, 'run_id', r.id, 'run_no', r.run_no, 'month', r.month,
    'people', jsonb_array_length(v_lines), 'amount', (select amount from salary_payment where id = v_pay),
    'paid_from', v_from, 'status', (select status from payroll_run where id = r.id),
    'journal_no', (select j.journal_no from salary_payment p join journal_entry j on j.id = p.journal_entry_id
                    where p.id = v_pay));
end $$;

create or replace function pay_payroll(p_run uuid, p_paid_from text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_run', p_run, 'p_paid_from', p_paid_from);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'pay_payroll', v_req);
  if v is not null then return v; end if;
  v := pay_payroll__run(p_run => p_run, p_paid_from => p_paid_from);
  perform audit_event(v_business, 'payroll.pay_all', 'salary_payment', v ->> 'payment_id', null, null,
    jsonb_build_object('run_no', v -> 'run_no', 'month', v -> 'month', 'people', v -> 'people', 'amount', v -> 'amount',
                       'paid_from', v -> 'paid_from'));
  perform idem_finish(v_business, p_idempotency_key, 'pay_payroll', v_req, v);
  return v;
end $$;

-- A salary payment made by mistake, cancelled with why: its journal reversed,
-- its cash back where it came from, and what it paid owed again.
create or replace function cancel_salary_payment__run(p_payment uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  p salary_payment; r payroll_run; v_rev uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the payment is cancelled'; end if;
  select * into p from salary_payment where id = p_payment and business_id = v_business;
  if not found then raise exception 'Salary payment not found'; end if;
  select * into r from payroll_run where id = p.run_id for update;
  select * into p from salary_payment where id = p_payment for update;
  if p.cancelled_at is not null then raise exception 'This payment was cancelled already'; end if;
  if p.journal_entry_id is not null then
    v_rev := reverse_entry_internal(p.journal_entry_id, now(), 'Salary payment cancelled: ' || trim(p_reason));
  end if;
  update salary_payment set cancelled_by = v_me, cancelled_at = now(), cancel_reason = trim(p_reason),
                            cancel_journal_id = v_rev
   where id = p.id;
  perform staff_cash_back(v_business, coalesce(p.location_id, resolve_location(v_business, null)), p.paid_from,
                          p.amount, 'salary_payment', p.id, v_me);
  if r.status = 'paid' and exists (select 1 from payroll_line l where l.run_id = r.id
                                     and l.net > payroll_line_paid(l.id)) then
    update payroll_run set status = 'approved' where id = r.id;
  end if;
  return jsonb_build_object('payment_id', p.id, 'run_id', r.id, 'month', r.month, 'amount', p.amount,
                            'paid_from', p.paid_from,
                            'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

create or replace function cancel_salary_payment(p_payment uuid, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_payment', p_payment, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_salary_payment', v_req);
  if v is not null then return v; end if;
  v := cancel_salary_payment__run(p_payment => p_payment, p_reason => p_reason);
  perform audit_event(v_business, 'payroll.payment_cancel', 'salary_payment', v ->> 'payment_id', p_reason,
    jsonb_build_object('amount', v -> 'amount', 'paid_from', v -> 'paid_from'),
    jsonb_build_object('month', v -> 'month'));
  perform idem_finish(v_business, p_idempotency_key, 'cancel_salary_payment', v_req, v);
  return v;
end $$;

-- The payrolls, the latest month first.
create or replace function payroll_runs() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('payroll.view');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id, 'run_no', r.run_no, 'month', r.month, 'status', r.status,
             'drafted_at', r.drafted_at, 'drafted_by', d.full_name, 'approved_at', r.approved_at,
             'approved_by', a.full_name, 'journal_no', j.journal_no,
             'people', (select count(*) from payroll_line l where l.run_id = r.id),
             'gross', (select coalesce(sum(l.gross), 0) from payroll_line l where l.run_id = r.id),
             'net', (select coalesce(sum(l.net), 0) from payroll_line l where l.run_id = r.id),
             'paid', (select coalesce(sum(p.amount), 0) from salary_payment p
                       where p.run_id = r.id and p.cancelled_at is null))
           order by r.month desc)
      from payroll_run r
      left join app_user d on d.id = r.drafted_by
      left join app_user a on a.id = r.approved_by
      left join journal_entry j on j.id = r.journal_entry_id
     where r.business_id = v_business), '[]'::jsonb);
end $$;

-- A payroll whole: its lines, what each is paid, and its payments.
create or replace function payroll_detail(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.view');
  r payroll_run;
begin
  select * into r from payroll_run where id = p_run and business_id = v_business;
  if not found then raise exception 'Payroll not found'; end if;
  return jsonb_build_object(
    'id', r.id, 'run_no', r.run_no, 'month', r.month, 'status', r.status,
    'drafted_at', r.drafted_at, 'drafted_by', (select full_name from app_user where id = r.drafted_by),
    'approved_at', r.approved_at, 'approved_by', (select full_name from app_user where id = r.approved_by),
    'journal_no', (select journal_no from journal_entry where id = r.journal_entry_id),
    'current', case when r.status = 'draft' then payroll_current(v_business, r.id) end,
    'month_over', (r.month + interval '1 month - 1 day')::date < business_local_date(v_business, now()),
    'lines', coalesce((
      select jsonb_agg(to_jsonb(l) - 'business_id' - 'run_id'
                       || jsonb_build_object('name', e.full_name, 'title', e.title, 'paid', payroll_line_paid(l.id))
                       order by e.full_name)
        from payroll_line l join employee e on e.id = l.employee_id
       where l.run_id = r.id), '[]'::jsonb),
    'approvals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'approved_at', a.approved_at, 'approved_by', ab.full_name, 'gross', a.gross, 'net', a.net,
               'advances_recovered', a.advances_recovered, 'journal_no', j.journal_no,
               'reopened_at', a.reopened_at, 'reopened_by', rb.full_name, 'reopen_reason', a.reopen_reason,
               'reopen_journal_no', rj.journal_no)
             order by a.approved_at)
        from payroll_approval a
        left join app_user ab on ab.id = a.approved_by
        left join app_user rb on rb.id = a.reopened_by
        left join journal_entry j on j.id = a.journal_entry_id
        left join journal_entry rj on rj.id = a.reopen_journal_id
       where a.run_id = r.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'paid_from', p.paid_from, 'amount', p.amount, 'paid_on', p.paid_on,
               'by', u.full_name, 'journal_no', j.journal_no, 'cancelled_at', p.cancelled_at,
               'cancel_reason', p.cancel_reason,
               'people', (select jsonb_agg(jsonb_build_object('employee_id', pl.employee_id, 'name', e.full_name,
                                                              'amount', pl.amount) order by e.full_name)
                            from salary_payment_line pl join employee e on e.id = pl.employee_id
                           where pl.payment_id = p.id))
             order by p.created_at)
        from salary_payment p
        left join app_user u on u.id = p.created_by
        left join journal_entry j on j.id = p.journal_entry_id
       where p.run_id = r.id), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 10. Reports → Staff: the hours by person, and what staff cost against sales
-- ---------------------------------------------------------------------------
create or replace function report_staff(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage', 'attendance.edit', 'payroll.view');
  v_pay boolean := current_has_permission('payroll.view');
begin
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Choose the dates, the first before the last'; end if;
  if p_to - p_from > 366 then raise exception 'Choose up to a year'; end if;
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
               'employee_id', e.id, 'name', e.full_name, 'title', e.title,
               'days_scheduled', x.scheduled, 'days_worked', x.worked, 'minutes', x.minutes,
               'overtime_minutes', x.overtime, 'times_late', x.late, 'minutes_late', x.late_minutes,
               'times_early', x.early, 'minutes_early', x.early_minutes, 'days_absent', x.absent)
             order by e.full_name)
        from (select d.employee_id, count(*) filter (where d.shift_starts is not null) as scheduled,
                     count(*) filter (where d.minutes > 0) as worked, coalesce(sum(d.minutes), 0) as minutes,
                     coalesce(sum(d.overtime_minutes), 0) as overtime,
                     count(*) filter (where d.late_minutes is not null) as late,
                     coalesce(sum(d.late_minutes), 0) as late_minutes,
                     count(*) filter (where d.early_minutes is not null) as early,
                     coalesce(sum(d.early_minutes), 0) as early_minutes,
                     count(*) filter (where d.absent) as absent
                from staff_days(v_business, p_from, p_to) d group by d.employee_id) x
        join employee e on e.id = x.employee_id), '[]'::jsonb),
    -- What staff cost (6100, by the month its journals are dated in) against
    -- the month's sales: only for those who see payroll.
    'labour', case when v_pay then coalesce((
      select jsonb_agg(jsonb_build_object('month', m.month, 'cost', m.cost, 'sales', m.sales,
                                          'percent', case when m.sales > 0 then round(100 * m.cost / m.sales, 1) end)
                       order by m.month)
        from (select mm.month,
                     coalesce((select sum(l.debit - l.credit) from journal_line l
                                 join journal_entry j on j.id = l.journal_entry_id
                                 join gl_account g on g.id = l.account_id
                                where j.business_id = v_business and j.status = 'published' and g.code = '6100'
                                  and business_local_date(v_business, j.occurred_at)
                                      between mm.month and (mm.month + interval '1 month - 1 day')::date), 0) as cost,
                     coalesce((select sum(o.net_amount) from sales_order o
                                where o.business_id = v_business and o.status not in ('voided', 'open')
                                  and business_local_date(v_business, o.placed_at)
                                      between mm.month and (mm.month + interval '1 month - 1 day')::date), 0)
                     - coalesce((select sum(a.amount) from sale_adjustment a
                                  where a.business_id = v_business and a.kind = 'refund'
                                    and business_local_date(v_business, a.created_at)
                                        between mm.month and (mm.month + interval '1 month - 1 day')::date), 0) as sales
                from (select generate_series(date_trunc('month', p_from), date_trunc('month', p_to),
                                             interval '1 month')::date as month) mm) m), '[]'::jsonb) end);
end $$;

-- ---------------------------------------------------------------------------
-- 11. The books
-- ---------------------------------------------------------------------------
-- 0044's checks, and two more: the salaries owed against 2100, the advances
-- not yet taken back against 1300. The safe counts what advances and salaries
-- took from it, and what their cancellations put back.
create or replace function reconciliation_checks(p_business uuid, p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable set search_path = public as $$
declare
  v_end timestamptz; v_settled date; v_known boolean := true; v_sum numeric := 0; d record; l record;
  v_unnumbered numeric; v_by_hand numeric;
begin
  v_end := (local_day_bounds(p_business, p_as_of, p_as_of)).to_ts;

  check_key := 'inventory'; label := 'Stock ledger vs Inventory (1200)';
  select coalesce(sum(value * sign(base_quantity_signed)), 0) into subledger
    from inventory_movement where business_id = p_business and occurred_at < v_end;
  ledger := gl_balance_at(p_business, '1200', v_end);
  difference := subledger - ledger; return next;

  check_key := 'payables'; label := 'Unpaid bills vs Accounts payable (2000)';
  select coalesce(sum(amount_total), 0) into subledger
    from purchase_invoice where business_id = p_business and invoice_date < p_as_of + 1
                            and (cancelled_at is null or cancelled_at >= v_end);
  subledger := subledger - coalesce((select sum(amount) from supplier_payment
                                      where business_id = p_business and paid_on < p_as_of + 1), 0);
  -- Less what the suppliers owe back (0044): their credits, set against bills or not.
  subledger := subledger - coalesce((select sum(amount) from supplier_credit
                                      where business_id = p_business and credit_date < p_as_of + 1), 0);
  -- Receipts the old app posted straight to A/P are owed until their bill is recorded.
  subledger := subledger + coalesce((select sum(receipt_legacy_payable(r.id, v_end)) from goods_receipt r
                                      where r.business_id = p_business and r.received_at < v_end
                                        and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id
                                                          and p.invoice_date < p_as_of + 1
                                                          and (p.cancelled_at is null or p.cancelled_at >= v_end))), 0);
  ledger := -gl_balance_at(p_business, '2000', v_end);
  difference := subledger - ledger; return next;

  check_key := 'grni'; label := 'Unbilled receipts vs Goods received not invoiced (2050)';
  select coalesce(sum(receipt_grni_value_at(r.id, v_end)), 0) into subledger
    from goods_receipt r
   where r.business_id = p_business and r.received_at < v_end
     and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id and p.invoice_date < p_as_of + 1
                        and (p.cancelled_at is null or p.cancelled_at >= v_end));
  ledger := -gl_balance_at(p_business, '2050', v_end);
  difference := subledger - ledger; return next;

  check_key := 'sales'; label := 'Sales recorded vs net revenue in the ledger (4000 less 4100 and 4200)';
  select coalesce(sum(net_amount), 0) into subledger
    from sales_order where business_id = p_business and status <> 'voided' and status <> 'open' and placed_at < v_end;
  subledger := subledger - coalesce((select sum(amount) from sale_adjustment
                                      where business_id = p_business and kind = 'refund' and created_at < v_end), 0);
  ledger := -(gl_balance_at(p_business, '4000', v_end) + gl_balance_at(p_business, '4100', v_end)
              + gl_balance_at(p_business, '4200', v_end));
  difference := subledger - ledger; return next;

  -- Card: what the till took by card on the days not yet settled (0030),
  -- against Card clearing. What else sits in 1010 was posted on a day
  -- already settled, and no settlement will ever take it.
  check_key := 'card'; label := 'Card takings not yet settled vs Card clearing (1010)';
  select max(s.covers_to) into v_settled
    from card_settlement s join journal_entry j on j.id = s.journal_entry_id
   where s.business_id = p_business and j.occurred_at < v_end
     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end);
  select coalesce(sum(jl.debit - jl.credit), 0) into subledger
    from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
   where e.business_id = p_business and e.status = 'published' and g.code = '1010' and e.occurred_at < v_end
     and e.reference_type is distinct from 'card_settlement'
     and not (e.reference_type = 'reversal'
              and exists (select 1 from journal_entry o where o.id = e.reverses_entry and o.reference_type = 'card_settlement'))
     and (v_settled is null or business_local_date(p_business, e.occurred_at) > v_settled);
  ledger := gl_balance_at(p_business, '1010', v_end);
  difference := subledger - ledger; return next;

  -- Platforms: each platform order not voided, less what was refunded of it
  -- and what a statement has paid out for it, against what they owe (1100).
  -- The platform sales from before order numbers (0030) are on no statement:
  -- a payout typed by hand into 1100 is what explains them, as far as they
  -- go (docs/LIMITATIONS.md). A payout typed by hand beyond them is flagged.
  check_key := 'platform'; label := 'Orders the platforms owe vs Receivable from platforms (1100)';
  select coalesce(sum(o.net_amount
                      - coalesce((select sum(a.amount) from sale_adjustment a
                                   where a.sales_order_id = o.id and a.kind = 'refund' and a.created_at < v_end), 0)
                      - coalesce((select sum(sl.expected) from platform_settlement_line sl
                                    join platform_settlement s on s.id = sl.settlement_id
                                    join journal_entry j on j.id = s.journal_entry_id
                                   where sl.sales_order_id = o.id and sl.status = 'matched' and j.occurred_at < v_end
                                     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id
                                                       and rv.occurred_at < v_end)), 0)), 0)
    into subledger
    from platform_order po join sales_order o on o.id = po.sales_order_id
   where po.business_id = p_business and o.placed_at < v_end and o.status <> 'open'
     and not exists (select 1 from sale_adjustment a where a.sales_order_id = o.id and a.kind = 'void'
                       and a.created_at < v_end);
  select coalesce(sum(o.net_amount - coalesce((select sum(a.amount) from sale_adjustment a
                                                where a.sales_order_id = o.id and a.kind = 'refund'
                                                  and a.created_at < v_end), 0)), 0)
    into v_unnumbered
    from sales_order o
   where o.business_id = p_business and o.placed_at < v_end and o.status <> 'open'
     and exists (select 1 from sales_tender t where t.sales_order_id = o.id and t.tender_type = 'platform_paid')
     and not exists (select 1 from platform_order po where po.sales_order_id = o.id)
     and not exists (select 1 from sale_adjustment a where a.sales_order_id = o.id and a.kind = 'void'
                       and a.created_at < v_end);
  select coalesce(sum(jl.debit - jl.credit), 0) into v_by_hand
    from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
   where e.business_id = p_business and e.status = 'published' and g.code = '1100' and e.occurred_at < v_end
     and e.reference_type is distinct from 'sales_order' and e.reference_type is distinct from 'sale_refund'
     and e.reference_type is distinct from 'platform_settlement'
     and not (e.reference_type = 'reversal'
              and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                            and o.reference_type in ('sales_order', 'sale_refund', 'platform_settlement')));
  subledger := subledger + greatest(v_unnumbered + v_by_hand, 0);
  ledger := gl_balance_at(p_business, '1100', v_end);
  difference := subledger - ledger; return next;

  -- The drawers: what each should hold, from its counts and its cash since,
  -- against Cash in the till. Before a drawer is first counted in a session,
  -- the books are all there is (the first opening settles the difference, 0036).
  for l in select id from location where business_id = p_business loop
    d := drawer_position_at(p_business, l.id, v_end);
    if not d.known then v_known := false; end if;
    v_sum := v_sum + coalesce(d.amount, 0);
  end loop;
  -- Nothing to hold the books to until some drawer has been counted.
  if not exists (select 1 from work_shift w
                  where w.business_id = p_business
                    and ((w.kind = 'session' and w.opened_at < v_end) or (w.kind = 'drawer' and w.closed_at < v_end))) then
    v_known := false;
  end if;
  check_key := 'drawer';
  ledger := gl_balance_at(p_business, '1000', v_end);
  if v_known then
    label := 'What the drawers should hold vs Cash in the till (1000)';
    subledger := v_sum;
  else
    label := 'What the drawers should hold vs Cash in the till (1000): not yet counted, the first opening settles it';
    subledger := ledger;
  end if;
  difference := subledger - ledger; return next;

  -- The safe: cash moved in and out of it, expenses and bills paid from it,
  -- dinars from dollars exchanged into it (0043), and advances and salaries
  -- paid from it (0049), against the Safe (1005).
  check_key := 'safe'; label := 'Cash moved in and out of the safe vs Safe (1005)';
  select coalesce(sum(case when t.to_place = 'safe' then t.amount else -t.amount end), 0) into subledger
    from cash_transfer t join journal_entry j on j.id = t.journal_entry_id
   where t.business_id = p_business and 'safe' in (t.from_place, t.to_place) and j.occurred_at < v_end;
  subledger := subledger + coalesce((
    select sum(jl.debit - jl.credit)
      from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
     where e.business_id = p_business and e.status = 'published' and g.code = '1005' and e.occurred_at < v_end
       and (e.reference_type in ('expense', 'supplier_payment', 'fx_exchange', 'employee_advance', 'salary_payment')
            or (e.reference_type = 'reversal'
                and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                              and o.reference_type in ('expense', 'supplier_payment', 'employee_advance',
                                                       'salary_payment'))))), 0);
  ledger := gl_balance_at(p_business, '1005', v_end);
  difference := subledger - ledger; return next;

  -- The dollars (0043): what the till and the safe hold, at what they were
  -- taken at, against Cash in dollars (1001 and 1006).
  check_key := 'dollars'; label := 'Dollars held, at what they were taken at, vs Cash in dollars (1001 and 1006)';
  select coalesce(sum(value), 0) into subledger
    from fx_cash_event where business_id = p_business and created_at < v_end;
  ledger := gl_balance_at(p_business, '1001', v_end) + gl_balance_at(p_business, '1006', v_end);
  difference := subledger - ledger; return next;

  -- The salaries owed (0049): what each approval of a payroll left to be paid,
  -- from when its journal is dated until it is reversed, less the salaries
  -- paid, against Salaries payable (2100).
  check_key := 'payroll'; label := 'Salaries owed vs Salaries payable (2100)';
  select coalesce(sum(a.net), 0) into subledger
    from payroll_approval a join journal_entry j on j.id = a.journal_entry_id
   where a.business_id = p_business and j.occurred_at < v_end
     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end);
  subledger := subledger - coalesce((
    select sum(p.amount) from salary_payment p join journal_entry j on j.id = p.journal_entry_id
     where p.business_id = p_business and j.occurred_at < v_end
       and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end)), 0);
  ledger := -gl_balance_at(p_business, '2100', v_end);
  difference := subledger - ledger; return next;

  -- The advances (0049): given and not cancelled, less what approved payrolls
  -- took back, against Employee advances (1300).
  check_key := 'advances'; label := 'Advances not yet taken back vs Employee advances (1300)';
  select coalesce(sum(v.amount), 0) into subledger
    from employee_advance v join journal_entry j on j.id = v.journal_entry_id
   where v.business_id = p_business and j.occurred_at < v_end
     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end);
  subledger := subledger - coalesce((
    select sum(a.advances_recovered)
      from payroll_approval a join journal_entry j on j.id = a.journal_entry_id
     where a.business_id = p_business and j.occurred_at < v_end
       and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end)), 0);
  ledger := gl_balance_at(p_business, '1300', v_end);
  difference := subledger - ledger; return next;

  -- The records themselves: how many lack their journal, or are journals
  -- lacking their record.
  check_key := 'documents'; label := 'Every record has its one journal, and every automatic journal its record';
  select count(*) into subledger from document_problems(p_business, v_end);
  ledger := 0;
  difference := subledger; return next;
end $$;

-- 0038's closing checklist, with the two new checks named, and a warning when
-- the month's payroll is not approved: after the lock it cannot be posted into
-- the month.
create or replace function period_close_checklist(p_period uuid)
returns table (check_key text, label text, ok boolean, detail text, blocks boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.period.lock', 'accounting.post', 'audit.view');
  p accounting_period; v numeric; n int; v_days text; c record;
begin
  select * into p from accounting_period where id = p_period and business_id = v_business;
  if not found then raise exception 'Period not found'; end if;
  blocks := true;

  select count(*) into n from accounting_period
   where business_id = v_business and ends_on < p.starts_on and status = 'open';
  check_key := 'prior_periods'; label := 'Earlier periods are locked'; ok := n = 0;
  detail := case when n > 0 then n || ' earlier period(s) still open' end; return next;

  select count(*) into n from journal_entry where period_id = p_period and status = 'draft';
  check_key := 'drafts'; label := 'No draft journals'; ok := n = 0;
  detail := case when n > 0 then n || ' draft journal(s) must be published or discarded' end; return next;

  select string_agg(d::text, ', ' order by d) into v_days from (
    select distinct u.day d from uncounted_days(v_business) u where u.day between p.starts_on and p.ends_on
  ) x;
  check_key := 'days_closed'; label := 'Every trading day''s cash is counted'; ok := v_days is null;
  detail := case when v_days is not null then 'Not counted: ' || v_days end; return next;

  select count(*) into n from stock_count where business_id = v_business and status = 'submitted';
  check_key := 'counts'; label := 'No stock count awaiting approval'; ok := n = 0;
  detail := case when n > 0 then n || ' count(s) submitted and not yet approved or rejected' end; return next;

  -- Each subledger against its account, as at the month's last day.
  for c in select * from reconciliation_checks(v_business, p.ends_on) loop
    check_key := c.check_key;
    ok := c.difference = 0;
    label := case c.check_key
      when 'inventory' then 'Stock ledger agrees with Inventory (1200)'
      when 'payables' then 'Unpaid bills agree with Accounts payable (2000)'
      when 'grni' then 'Unbilled receipts agree with GRNI (2050)'
      when 'sales' then 'Sales agree with net revenue (4000 less 4100 and 4200)'
      when 'card' then 'Card takings not yet settled agree with Card clearing (1010)'
      when 'platform' then 'Orders the platforms owe agree with their receivable (1100)'
      when 'drawer' then 'What the drawers should hold agrees with Cash in the till (1000)'
      when 'safe' then 'Cash moved through the safe agrees with the Safe (1005)'
      when 'payroll' then 'Salaries owed agree with Salaries payable (2100)'
      when 'advances' then 'Advances not yet taken back agree with Employee advances (1300)'
      when 'documents' then 'Every record has its one journal'
      else c.label end;
    detail := case when c.difference = 0 then null
      when c.check_key = 'documents' then c.difference || ' record(s) to look into: see Reports, Do the books tie?'
      else format(case c.check_key
                    when 'inventory' then 'stock ledger %s, account 1200 %s, difference %s'
                    when 'payables' then 'unpaid bills %s, account 2000 %s, difference %s'
                    when 'grni' then 'unbilled receipts %s, account 2050 %s, difference %s'
                    when 'sales' then 'sales %s, net revenue %s, difference %s'
                    when 'card' then 'card takings %s, account 1010 %s, difference %s'
                    when 'platform' then 'orders owed %s, account 1100 %s, difference %s'
                    when 'drawer' then 'the drawers %s, account 1000 %s, difference %s'
                    when 'safe' then 'the safe''s records %s, account 1005 %s, difference %s'
                    when 'payroll' then 'salaries owed %s, account 2100 %s, difference %s'
                    when 'advances' then 'advances owed %s, account 1300 %s, difference %s'
                    else 'records %s, account %s, difference %s' end,
                  c.subledger, c.ledger, c.difference) end;
    return next;
  end loop;

  select coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0) into v
    from journal_line l join journal_entry e on e.id = l.journal_entry_id
   where e.period_id = p_period and e.status = 'published';
  check_key := 'trial_balance'; label := 'The period''s journals balance'; ok := v = 0;
  detail := case when v <> 0 then 'out by ' || v end; return next;

  -- A warning, not a lock: a sale costed at nothing cannot be costed again, but
  -- the owner should know its profit is overstated, and why (0025).
  select count(*) into n from uncosted_sales(v_business, p.starts_on, p.ends_on);
  check_key := 'uncosted'; label := 'No sale costed at nothing'; ok := n = 0; blocks := false;
  detail := case when n > 0 then n || ' sale(s) costed at nothing or in part at nothing: see Reports, Uncosted sales. '
                                 || 'Their profit is overstated. The month can still be locked' end; return next;

  -- A warning (0049): the month's payroll, while people worked here in it.
  check_key := 'payroll_approved'; label := 'The month''s payroll is approved'; blocks := false;
  ok := not exists (select 1 from employee e where e.business_id = v_business and e.hired_on <= p.ends_on
                      and (e.left_on is null or e.left_on >= p.starts_on))
        or exists (select 1 from payroll_run r where r.business_id = v_business
                     and r.month = date_trunc('month', p.starts_on)::date and r.status in ('approved', 'paid'));
  detail := case when not ok then format('The payroll for %s is not approved: after the lock it cannot be posted into this month',
                                         to_char(p.starts_on, 'YYYY-MM')) end;
  return next;
end $$;

-- 0048's records to look into, with the payrolls, advances and salaries paid:
-- one with no journal, and a journal whose record does not exist.
create or replace function document_problems(p_business uuid, p_before timestamptz)
returns table (kind text, record_id uuid, at timestamptz, problem text)
language plpgsql stable set search_path = public as $$
declare v_start timestamptz;
begin
  select min(created_at) into v_start from journal_entry where business_id = p_business and not legacy;
  if v_start is null then return; end if;
  return query
  with j as (
    select e.id, e.reference_type, e.reference_id, e.reverses_entry, e.occurred_at, e.created_at
      from journal_entry e
     where e.business_id = p_business and e.status = 'published' and not e.legacy
  ),
  has as (select distinct reference_type, reference_id from j where reverses_entry is null and reference_id is not null)
  -- Records without their journal.
  select 'sale'::text, o.id, o.placed_at, 'A sale with no journal'::text
    from sales_order o
   where o.business_id = p_business and o.status <> 'open' and o.created_at >= v_start and o.placed_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'sales_order' and h.reference_id = o.id)
  union all
  select 'void', a.id, a.created_at, 'A void whose sale''s journal was not reversed'
    from sale_adjustment a
   where a.business_id = p_business and a.kind = 'void' and a.created_at >= v_start and a.created_at < p_before
     and not exists (select 1 from j s join j rv on rv.reverses_entry = s.id
                      where s.reference_type = 'sales_order' and s.reference_id = a.sales_order_id)
  union all
  select 'refund', a.id, a.created_at, 'A refund with no journal'
    from sale_adjustment a
   where a.business_id = p_business and a.kind = 'refund' and a.created_at >= v_start and a.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'sale_refund' and h.reference_id = a.id)
  union all
  select 'delivery', r.id, r.received_at, 'A delivery with no journal'
    from goods_receipt r
   where r.business_id = p_business and r.received_at >= v_start and r.received_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'goods_receipt' and h.reference_id = r.id)
  union all
  select 'correction', c.id, c.created_at, 'A delivery''s correction with no journal'
    from receipt_correction c
   where c.business_id = p_business and c.created_at < p_before and c.journal_entry_id is null
     and exists (select 1 from jsonb_array_elements(c.effects) e
                  where (e ->> 'stock_change')::numeric <> 0 or (e ->> 'grni_change')::numeric <> 0)
  union all
  select 'bill', b.id, b.created_at, 'A bill with no journal'
    from purchase_invoice b
   where b.business_id = p_business and not b.legacy and b.created_at >= v_start and b.created_at < p_before
     and b.journal_entry_id is null
     -- A bill for a delivery the old app posted to payables posts only a difference in price.
     and not (b.goods_receipt_id is not null and receipt_legacy_payable(b.goods_receipt_id) > 0)
  union all
  select 'payment', p.id, p.created_at, 'A payment with no journal'
    from supplier_payment p
   where p.business_id = p_business and p.created_at >= v_start and p.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'supplier_payment' and h.reference_id = p.id)
  union all
  select 'expense', x.id, x.created_at, 'An expense with no journal'
    from expense x
   where x.business_id = p_business and x.created_at >= v_start and x.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'expense' and h.reference_id = x.id)
  union all
  select 'stock', m.id, m.created_at, 'A loss, stock correction or opening stock with no journal'
    from inventory_movement m
   where m.business_id = p_business and m.created_at >= v_start and m.created_at < p_before and m.value > 0
     and m.type in ('waste', 'spoilage', 'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling',
                    'damaged', 'expired', 'manual_correction', 'opening_balance')
     and m.reference_id is null
     and not exists (select 1 from has h where h.reference_type = 'inventory_movement' and h.reference_id = m.id)
  union all
  select 'loss', s.id, s.created_at, 'A loss with no journal'
    from stock_loss s
   where s.business_id = p_business and s.created_at >= v_start and s.created_at < p_before and s.value > 0
     and not exists (select 1 from has h where h.reference_type = 'stock_loss' and h.reference_id = s.id)
  union all
  select 'count', c.id, c.approved_at, 'An approved count with no journal'
    from stock_count c
   where c.business_id = p_business and c.status = 'approved' and not c.legacy
     and c.approved_at >= v_start and c.approved_at < p_before
     and exists (select 1 from stock_count_line l join inventory_movement m on m.id = l.adjustment_movement_id
                  where l.stock_count_id = c.id and m.value > 0)
     and not exists (select 1 from has h where h.reference_type = 'stock_count' and h.reference_id = c.id)
  union all
  select 'cash', t.id, t.created_at, 'Cash moved with no journal'
    from cash_transfer t
   where t.business_id = p_business and t.created_at >= v_start and t.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'cash_transfer' and h.reference_id = t.id)
  union all
  select 'session', w.id, w.closed_at, 'A drawer counted over or short with no journal'
    from work_shift w
   where w.business_id = p_business and w.kind in ('session', 'drawer') and coalesce(w.variance, 0) <> 0
     and w.closed_at >= v_start and w.closed_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'work_shift' and h.reference_id = w.id)
  union all
  select 'session', w.id, w.opened_at, 'A drawer opened over or short with no journal'
    from work_shift w
   where w.business_id = p_business and w.kind = 'session' and coalesce(w.opening_variance, 0) <> 0
     and w.opened_at >= v_start and w.opened_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'session_opening' and h.reference_id = w.id)
  union all
  select 'session', c.work_shift_id, c.created_at, 'A drawer''s dollars counted with no journal'
    from session_dollar_count c
   where c.business_id = p_business and c.created_at >= v_start and c.created_at < p_before
     and (c.variance_value <> 0 or c.taken_value <> 0) and c.journal_entry_id is null
  union all
  select 'dollars', x.id, x.created_at, 'Dollars exchanged with no journal'
    from fx_exchange x
   where x.business_id = p_business and x.created_at >= v_start and x.created_at < p_before
     and x.journal_entry_id is null
  union all
  select 'return', x.id, x.created_at, 'A return to a supplier with no journal'
    from supplier_return x
   where x.business_id = p_business and x.created_at >= v_start and x.created_at < p_before
     and (x.value <> 0 or x.stock_value <> 0)
     and not exists (select 1 from has h where h.reference_type = 'supplier_return' and h.reference_id = x.id)
  union all
  select 'credit', c.id, c.created_at, 'A supplier''s credit with no journal'
    from supplier_credit c
   where c.business_id = p_business and c.kind <> 'goods_return' and c.created_at >= v_start and c.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'supplier_credit' and h.reference_id = c.id)
  union all
  select 'card', s.id, s.created_at, 'A card settlement with no journal'
    from card_settlement s
   where s.business_id = p_business and s.created_at < p_before and s.journal_entry_id is null
  union all
  select 'platform', s.id, s.imported_at, 'A platform statement posted with no journal'
    from platform_settlement s
   where s.business_id = p_business and s.imported_at < p_before and s.journal_entry_id is null
     and exists (select 1 from platform_settlement_line l where l.settlement_id = s.id and l.status = 'matched')
  union all
  select 'payroll', a.run_id, a.approved_at, 'An approved payroll with no journal'
    from payroll_approval a
   where a.business_id = p_business and a.approved_at < p_before and a.reopened_at is null and a.gross > 0
     and not exists (select 1 from has h where h.reference_type = 'payroll_approval' and h.reference_id = a.id)
  union all
  select 'advance', v.id, v.created_at, 'An advance with no journal'
    from employee_advance v
   where v.business_id = p_business and v.created_at < p_before and v.cancelled_at is null
     and not exists (select 1 from has h where h.reference_type = 'employee_advance' and h.reference_id = v.id)
  union all
  select 'salary', s.id, s.created_at, 'A salary payment with no journal'
    from salary_payment s
   where s.business_id = p_business and s.created_at < p_before and s.cancelled_at is null
     and not exists (select 1 from has h where h.reference_type = 'salary_payment' and h.reference_id = s.id)
  union all
  -- Automatic journals whose record does not exist (and that are not reversed).
  select 'journal', j.id, j.occurred_at,
         'A journal whose ' || case j.reference_type
           when 'sales_order' then 'sale' when 'goods_receipt' then 'delivery'
           when 'receipt_correction' then 'delivery correction' when 'purchase_invoice' then 'bill'
           when 'supplier_payment' then 'payment' when 'inventory_movement' then 'stock movement'
           when 'sale_refund' then 'refund' when 'cash_transfer' then 'cash movement'
           when 'work_shift' then 'drawer count' when 'session_opening' then 'drawer opening'
           when 'session_dollars' then 'drawer''s dollars count' when 'fx_exchange' then 'exchange of dollars'
           when 'supplier_return' then 'return to a supplier' when 'supplier_credit' then 'supplier''s credit'
           when 'platform_settlement' then 'platform statement' when 'stock_loss' then 'loss'
           when 'payroll_approval' then 'payroll''s approval' when 'employee_advance' then 'advance'
           when 'salary_payment' then 'salary payment'
           else replace(j.reference_type, '_', ' ') end || ' does not exist'
    from j
   where j.created_at < p_before and j.reverses_entry is null and j.reference_id is not null
     and not exists (select 1 from j rv where rv.reverses_entry = j.id and rv.created_at < p_before)
     and case j.reference_type
           when 'sales_order' then not exists (select 1 from sales_order x where x.id = j.reference_id)
           when 'goods_receipt' then not exists (select 1 from goods_receipt x where x.id = j.reference_id)
           when 'receipt_correction' then not exists (select 1 from receipt_correction x where x.id = j.reference_id)
           when 'purchase_invoice' then not exists (select 1 from purchase_invoice x where x.id = j.reference_id)
           when 'supplier_payment' then not exists (select 1 from supplier_payment x where x.id = j.reference_id)
           when 'expense' then not exists (select 1 from expense x where x.id = j.reference_id)
           when 'inventory_movement' then not exists (select 1 from inventory_movement x where x.id = j.reference_id)
           when 'stock_count' then not exists (select 1 from stock_count x where x.id = j.reference_id)
           when 'sale_refund' then not exists (select 1 from sale_adjustment x where x.id = j.reference_id)
           when 'cash_transfer' then not exists (select 1 from cash_transfer x where x.id = j.reference_id)
           when 'work_shift' then not exists (select 1 from work_shift x where x.id = j.reference_id)
           when 'session_opening' then not exists (select 1 from work_shift x where x.id = j.reference_id)
           when 'session_dollars' then not exists (select 1 from session_dollar_count x
                                                    where x.work_shift_id = j.reference_id)
           when 'fx_exchange' then not exists (select 1 from fx_exchange x where x.id = j.reference_id)
           when 'supplier_return' then not exists (select 1 from supplier_return x where x.id = j.reference_id)
           when 'supplier_credit' then not exists (select 1 from supplier_credit x where x.id = j.reference_id)
           when 'card_settlement' then not exists (select 1 from card_settlement x where x.id = j.reference_id)
           when 'platform_settlement' then not exists (select 1 from platform_settlement x where x.id = j.reference_id)
           when 'stock_loss' then not exists (select 1 from stock_loss x where x.id = j.reference_id)
           when 'payroll_approval' then not exists (select 1 from payroll_approval x where x.id = j.reference_id)
           when 'employee_advance' then not exists (select 1 from employee_advance x where x.id = j.reference_id)
           when 'salary_payment' then not exists (select 1 from salary_payment x where x.id = j.reference_id)
           else false end;
end $$;

-- 0048's hints, with the payrolls, advances and salaries paid.
create or replace function journal_source_hint(p_ref_type text) returns text
language sql immutable as $$
  select case p_ref_type
    when 'sales_order' then 'a sale (void or refund it on Orders)'
    when 'sale_adjustment' then 'a refund'
    when 'sale_refund' then 'a refund (refund the rest of the sale on Orders if more should go back)'
    when 'goods_receipt' then 'a goods receipt (correct it on Purchasing)'
    when 'receipt_correction' then 'a delivery''s correction (correct the delivery again on Purchasing)'
    when 'purchase_invoice' then 'a bill (cancel it on Vendors)'
    when 'supplier_payment' then 'a supplier payment'
    when 'inventory_movement' then 'a stock record (correct stock with a count or a stock correction)'
    when 'stock_count' then 'a stock count (correct stock with a new count)'
    when 'work_shift' then 'a drawer count'
    when 'session_opening' then 'the opening count of a cash session'
    when 'session_dollars' then 'the dollars counted at a drawer''s close'
    when 'fx_exchange' then 'an exchange of dollars'
    when 'supplier_return' then 'a return to a supplier (record a credit on Vendors if more is owed back)'
    when 'supplier_credit' then 'a supplier''s credit'
    when 'cash_transfer' then 'a movement of cash (move it back instead)'
    when 'reversal' then 'a reversal (post the entry again instead)'
    when 'card_settlement' then 'a card settlement (cancel it on Sales)'
    when 'platform_settlement' then 'a platform settlement (cancel it on Delivery Platforms)'
    when 'stock_loss' then 'a loss (correct stock with a count or a stock correction)'
    when 'payroll_approval' then 'a payroll''s approval (reopen the payroll on Payroll while nothing is paid from it)'
    when 'employee_advance' then 'an advance to someone who works here (cancel it on Payroll)'
    when 'salary_payment' then 'a salary payment (cancel it on Payroll)'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- 0048's record_bill__run: nor does 1300 take a bill; advances are given on Payroll.
create or replace function record_bill__run(
  p_supplier uuid, p_invoice_no text, p_invoice_date date, p_amount numeric, p_term_days int default 0,
  p_receipt uuid default null, p_account_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_amount numeric; v_grni numeric; v_legacy numeric; v_ppv numeric; v_bill uuid; v_journal uuid; v_lines jsonb;
  v_acct gl_account; v_state jsonb;
  v_no text := nullif(trim(p_invoice_no), '');
begin
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business) then
    raise exception 'Choose a supplier';
  end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if (p_receipt is null) = (p_account_code is null) then
    raise exception 'A bill is either for a goods receipt or for an expense account — choose one';
  end if;
  if v_no is null then
    v_no := bill_number_take(v_business);
  elsif is_own_bill_number(v_business, v_no) then
    raise exception 'Numbers like % are the café''s own and are given automatically: leave the box as it is, or type the supplier''s invoice number', v_no;
  end if;
  -- Against every bill ever entered, including those before the controls (M-07).
  if exists (select 1 from purchase_invoice where business_id = v_business and supplier_id = p_supplier
               and lower(invoice_no) = lower(v_no) and cancelled_at is null) then
    raise exception 'Invoice % from this supplier is already recorded', v_no;
  end if;

  v_bill := gen_random_uuid();
  if p_receipt is not null then
    perform 1 from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Receipt not found'; end if;
    v_state := receipt_state(p_receipt);
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'That delivery was reversed: there is nothing to bill';
    end if;
    -- The old app did not record the supplier on a receipt; any supplier may bill those.
    if (v_state ->> 'supplier_id') is not null and (v_state ->> 'supplier_id')::uuid <> p_supplier then
      raise exception 'That receipt is from a different supplier';
    end if;
    if exists (select 1 from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null) then
      raise exception 'That receipt has already been billed';
    end if;
    v_grni := receipt_grni_value(p_receipt);
    if v_grni <= 0 and exists (select 1 from supplier_return where goods_receipt_id = p_receipt and against = 'delivery') then
      raise exception 'Everything delivery % brought went back to the supplier: there is nothing to bill',
        (select receipt_no from goods_receipt where id = p_receipt);
    end if;
    if v_grni > 0 then
      v_ppv := v_amount - v_grni;
      v_lines := jsonb_build_array(
        jsonb_build_object('code', '2050', 'debit', v_grni),
        jsonb_build_object('code', '5050', 'debit', greatest(v_ppv, 0), 'credit', greatest(-v_ppv, 0)),
        jsonb_build_object('code', '2000', 'credit', v_amount));
    else
      v_legacy := receipt_legacy_payable(p_receipt);
      if v_legacy <= 0 then
        raise exception 'That receipt has no payable to bill against: its journal was reversed or never written (see docs/REMEDIATION.md)';
      end if;
      v_ppv := v_amount - v_legacy;
      v_lines := case when v_ppv <> 0 then jsonb_build_array(
        jsonb_build_object('code', '5050', 'debit', greatest(v_ppv, 0), 'credit', greatest(-v_ppv, 0)),
        jsonb_build_object('code', '2000', 'debit', greatest(-v_ppv, 0), 'credit', greatest(v_ppv, 0))) end;
    end if;
  else
    select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
    if not found or v_acct.account_type not in ('expense', 'asset')
       or p_account_code in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '1300', '5000', '5050',
                          '5300', '5310', '5400') then
      raise exception 'Account % cannot take a bill; stock is billed against its goods receipt', p_account_code;
    end if;
    v_lines := jsonb_build_array(
      jsonb_build_object('code', p_account_code, 'debit', v_amount),
      jsonb_build_object('code', '2000', 'credit', v_amount));
  end if;

  if v_lines is not null then
    v_journal := post_journal(v_business, (coalesce(p_invoice_date, business_local_date(v_business, now())) + time '12:00')
                                            at time zone (select timezone from business where id = v_business),
      'Bill ' || v_no, 'purchase_invoice', v_bill, v_lines, null, v_no);
  end if;
  insert into purchase_invoice (id, business_id, supplier_id, invoice_no, invoice_date, due_date, amount_total,
                                goods_receipt_id, expense_account_code, journal_entry_id)
  values (v_bill, v_business, p_supplier, v_no,
          coalesce(p_invoice_date, business_local_date(v_business, now())),
          coalesce(p_invoice_date, business_local_date(v_business, now())) + greatest(coalesce(p_term_days, 0), 0),
          v_amount, p_receipt, p_account_code, v_journal);
  return jsonb_build_object('bill_id', v_bill, 'invoice_no', v_no,
                            'journal_no', (select journal_no from journal_entry where id = v_journal),
                            'price_variance', coalesce(v_ppv, 0));
end $$;

-- 0048's record_supplier_credit__run: nor does 1300 take a supplier's credit.
create or replace function record_supplier_credit__run(p_supplier uuid, p_kind text, p_amount numeric,
                                                       p_supplier_ref text, p_reason text, p_receipt uuid,
                                                       p_bill uuid, p_account_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_me uuid := (current_member()).id;
  v_kind text := lower(nullif(trim(p_kind), '')); v_ref text := nullif(trim(p_supplier_ref), '');
  v_reason text := nullif(trim(p_reason), ''); v_amount numeric; v_day date; v_account text;
  r goods_receipt; v_state jsonb; b purchase_invoice; acct gl_account;
  v_id uuid := gen_random_uuid(); v_no bigint; v_journal uuid; v_lines jsonb; v_alloc numeric := 0;
  v_items uuid[]; v_values numeric[]; v_after numeric[]; v_worth numeric; v_taken numeric; i int; p record;
  v_share numeric; v_on numeric; v_stock numeric := 0; v_part numeric; v_moves jsonb := '[]'; x jsonb;
begin
  if v_kind is null or v_kind not in ('price', 'other', 'goods_return') then
    raise exception 'Say what the credit is for: a price, or other';
  end if;
  if v_kind = 'goods_return' then
    raise exception 'A return makes its own credit: record the supplier''s note on it instead';
  end if;
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business) then
    raise exception 'Choose a supplier';
  end if;
  if v_ref is null then raise exception 'Type the number on the supplier''s credit note'; end if;
  if exists (select 1 from supplier_credit where business_id = v_business and supplier_id = p_supplier
               and lower(supplier_ref) = lower(v_ref)) then
    raise exception 'Credit note % from this supplier is already recorded', v_ref;
  end if;
  if v_reason is null then raise exception 'Say what the credit is for'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  v_day := business_local_date(v_business, now());
  if p_bill is not null then
    select * into b from purchase_invoice where id = p_bill and business_id = v_business;
    if not found then raise exception 'Bill not found'; end if;
    if b.supplier_id <> p_supplier then raise exception 'That bill is from another supplier'; end if;
    if b.cancelled_at is not null then raise exception 'That bill was cancelled; it is not owed'; end if;
  end if;

  if v_kind = 'price' then
    if p_receipt is null then raise exception 'Choose the delivery the price was for'; end if;
    select * into r from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Delivery not found'; end if;
    v_state := receipt_state(p_receipt);
    if (v_state ->> 'supplier_id')::uuid is distinct from p_supplier then
      raise exception 'Delivery % came from another supplier', coalesce(r.receipt_no::text, '');
    end if;
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'Delivery % was reversed: there is no price to reduce', r.receipt_no;
    end if;
    if p_bill is null then
      select * into b from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null;
    elsif b.goods_receipt_id is distinct from p_receipt then
      raise exception 'Bill % is not for delivery %', b.invoice_no, r.receipt_no;
    end if;
    if b.id is null then
      raise exception 'Delivery % is not billed yet: correct its price on Purchasing instead', r.receipt_no;
    end if;
    -- What the delivery is still worth to the supplier: its value less what went back and earlier credits.
    select array_agg(g.item_id order by g.item_id), array_agg(g.v order by g.item_id), coalesce(sum(g.v), 0)
      into v_items, v_values, v_worth
      from (select (e ->> 'item_id')::uuid as item_id, sum((e ->> 'landed')::numeric) as v
              from jsonb_array_elements(v_state -> 'lines') e group by 1) g
     where g.v > 0;
    v_taken := coalesce((select sum(value) from supplier_return where goods_receipt_id = p_receipt), 0)
               + coalesce((select sum(amount) from supplier_credit where goods_receipt_id = p_receipt and kind = 'price'), 0);
    if v_worth - v_taken <= 0 or v_amount > v_worth - v_taken then
      raise exception 'That is more than delivery % is still worth (%)', r.receipt_no,
        trim_scale(greatest(v_worth - v_taken, 0));
    end if;
    -- Shared over its items by value; each item's share still on hand revalues it, the rest is variance.
    v_after := allocate_landed(v_business, v_values, -v_amount);
    perform lock_items(v_items);
    for i in 1 .. cardinality(v_items) loop
      v_share := v_values[i] - v_after[i];
      p := item_position(v_business, v_items[i], r.location_id);
      v_on := receipt_share_on_hand(v_business, p_receipt, v_items[i], r.location_id);
      v_part := case when p.qty > 0 and p.value > 0
                     then least(money_round(v_business, v_share * v_on), p.value) else 0 end;
      if v_part > 0 then
        v_moves := v_moves || jsonb_build_object('item_id', v_items[i], 'qty', p.qty, 'from', p.value,
                                                 'to', p.value - v_part);
      end if;
      v_stock := v_stock + v_part;
    end loop;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line('1200', -v_stock),
                                 signed_line('5050', v_stock - v_amount));
  else
    v_account := coalesce(nullif(trim(p_account_code), ''), b.expense_account_code);
    if v_account is null then raise exception 'Choose the account the credit is taken off'; end if;
    select * into acct from gl_account where business_id = v_business and code = v_account and is_active;
    if not found or acct.account_type not in ('expense', 'asset')
       or v_account in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '1300', '5000', '5300', '5310',
                       '5400') then
      raise exception 'Account % cannot take a supplier''s credit', v_account;
    end if;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line(v_account, -v_amount));
  end if;

  v_no := next_document_no(v_business, 'supplier_credit', 1);
  v_journal := post_journal(v_business, now(),
    'Credit ' || v_no || ' from ' || (select name from supplier where id = p_supplier) || ' (' || v_ref || '): ' || v_reason,
    'supplier_credit', v_id, v_lines, null, v_ref);
  insert into supplier_credit (id, business_id, credit_no, supplier_id, kind, amount, credit_date, supplier_ref, reason,
                               goods_receipt_id, purchase_invoice_id, account_code, journal_entry_id, matched_at,
                               matched_by, created_by)
  values (v_id, v_business, v_no, p_supplier, v_kind, v_amount, v_day, v_ref, v_reason, p_receipt, b.id, v_account,
          v_journal, now(), v_me, v_me);
  for x in select * from jsonb_array_elements(v_moves) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, (x ->> 'item_id')::uuid, r.location_id, 'cost_adjustment', -(x ->> 'qty')::numeric,
            (x ->> 'from')::numeric / (x ->> 'qty')::numeric, (x ->> 'from')::numeric,
            'supplier_credit', v_id, v_me, 'Revalued: credit ' || v_no || ' on delivery ' || r.receipt_no),
           (v_business, (x ->> 'item_id')::uuid, r.location_id, 'cost_adjustment', (x ->> 'qty')::numeric,
            (x ->> 'to')::numeric / (x ->> 'qty')::numeric, (x ->> 'to')::numeric,
            'supplier_credit', v_id, v_me, 'Revalued: credit ' || v_no || ' on delivery ' || r.receipt_no);
  end loop;
  if b.id is not null then
    v_alloc := set_credit_against(v_business, v_id, b.id, null, v_me, false);
  end if;
  perform audit_event(v_business, 'purchase.credit', 'supplier_credit', v_id::text, v_reason, null,
    jsonb_build_object('credit_no', v_no, 'supplier', p_supplier, 'credit_kind', v_kind, 'amount', v_amount,
                       'supplier_ref', v_ref, 'receipt_no', r.receipt_no, 'bill', b.invoice_no,
                       'account', v_account, 'stock_change', -v_stock, 'set_against_bill', v_alloc));
  return jsonb_build_object('credit_id', v_id, 'credit_no', v_no, 'kind', v_kind, 'amount', v_amount,
    'stock', -v_stock, 'variance', case when v_kind = 'price' then v_stock - v_amount else 0 end,
    'set_against_bill', v_alloc, 'bill_no', b.invoice_no,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- 0043's cash session statement: what advances and salaries took from the
-- drawer is named by whom it was paid to.
create or replace function cash_session_statement(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close', 'cash.view_expected', 'audit.view');
  w work_shift; v_day date;
begin
  select * into w from work_shift where id = p_session and business_id = v_business;
  if not found then raise exception 'Session not found'; end if;
  if w.closed_at is null and not current_has_permission('cash.view_expected') then
    raise exception 'What an open drawer should hold is shown once it is counted' using errcode = '42501';
  end if;
  v_day := business_local_date(v_business, w.opened_at);
  return jsonb_build_object(
    'session', (select to_jsonb(r) from cash_sessions(v_day, v_day, w.location_id) r where r.id = p_session),
    'notes', jsonb_build_object('opening', w.opening_denominations, 'closing', w.closing_denominations),
    'events', (select coalesce(jsonb_agg(jsonb_build_object(
                  'at', e.created_at, 'kind', e.kind, 'amount', e.amount, 'by', u.full_name,
                  'reference_type', e.reference_type, 'reference_id', e.reference_id,
                  'turn_no', coalesce(o.turn_no, ao.turn_no),
                  'note', coalesce(x.description, ct.note, sa.reason, sup.name, je.description, adv_e.full_name,
                                   (select string_agg(pe.full_name, ', ' order by pe.full_name)
                                      from salary_payment_line pl join employee pe on pe.id = pl.employee_id
                                     where e.reference_type = 'salary_payment' and pl.payment_id = e.reference_id)))
                  order by e.created_at, e.id), '[]'::jsonb)
                 from cash_event e
                 left join app_user u on u.id = e.created_by
                 left join sales_order o on e.reference_type = 'sales_order' and o.id = e.reference_id
                 left join sale_adjustment sa on e.reference_type = 'sale_adjustment' and sa.id = e.reference_id
                 left join sales_order ao on ao.id = sa.sales_order_id
                 left join expense x on e.reference_type = 'expense' and x.id = e.reference_id
                 left join cash_transfer ct on e.reference_type = 'cash_transfer' and ct.id = e.reference_id
                 left join supplier_payment sp on e.reference_type = 'supplier_payment' and sp.id = e.reference_id
                 left join supplier sup on sup.id = sp.supplier_id
                 left join journal_entry je on e.reference_type = 'journal_entry' and je.id = e.reference_id
                 left join employee_advance adv on e.reference_type = 'employee_advance' and adv.id = e.reference_id
                 left join employee adv_e on adv_e.id = adv.employee_id
                where e.work_shift_id = p_session),
    'takings', (select coalesce(jsonb_agg(jsonb_build_object('at', t.created_at, 'to', t.to_place, 'amount', t.amount,
                                                              'journal_no', j.journal_no) order by t.created_at),
                                '[]'::jsonb)
                  from cash_transfer t left join journal_entry j on j.id = t.journal_entry_id
                 where t.work_shift_id = p_session and t.from_place = 'till'),
    -- The till's dollars in the session, and their count at its close (0043).
    'dollars', (select jsonb_build_object('expected', c.expected, 'counted', c.counted, 'variance', c.variance,
                                          'variance_value', c.variance_value, 'taken', c.taken,
                                          'taken_value', c.taken_value, 'notes', c.denominations,
                                          'journal_no', j.journal_no)
                  from session_dollar_count c left join journal_entry j on j.id = c.journal_entry_id
                 where c.work_shift_id = p_session),
    'dollar_events', (select coalesce(jsonb_agg(jsonb_build_object(
                         'at', e.created_at, 'kind', e.kind, 'usd', e.usd, 'value', e.value, 'rate', e.rate,
                         'by', u.full_name, 'turn_no', coalesce(o.turn_no, ao.turn_no))
                         order by e.created_at, e.kind, e.id), '[]'::jsonb)
                        from fx_cash_event e
                        left join app_user u on u.id = e.created_by
                        left join sales_order o on e.reference_type = 'sales_order' and o.id = e.reference_id
                        left join sale_adjustment sa on e.reference_type = 'sale_adjustment' and sa.id = e.reference_id
                        left join sales_order ao on ao.id = sa.sales_order_id
                       where e.work_shift_id = p_session and e.place = 'till'));
end $$;

-- ---------------------------------------------------------------------------
-- 12. The alerts
-- ---------------------------------------------------------------------------
-- 0046's rules stay as they are. Someone still clocked in after the rule's
-- hours: orange, red after a day. Last month's payroll, from payday: not
-- approved, or approved and not all paid.
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0046;
revoke execute on function alert_conditions_0046(uuid, timestamptz) from public, anon, authenticated;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0046(p_business, p_now) c
  union all
  select 'clocked_in_long'::text, a.id::text,
         case when a.clock_in < p_now - interval '24 hours' then 'red' else 'orange' end,
         format('%s has been clocked in for %s hours, since %s', e.full_name,
                floor(extract(epoch from p_now - a.clock_in) / 3600)::int,
                to_char(a.clock_in at time zone bz.timezone, 'DD Mon HH24:MI')),
         'Hours left open are paid as worked: a clock-out forgotten becomes overtime.',
         'Clock them out on the till, or correct the hours on Staff.',
         'high', '/staff#attendance',
         jsonb_build_object('attendance_id', a.id, 'employee_id', e.id, 'since', a.clock_in)
    from attendance a
    join employee e on e.id = a.employee_id
    join business bz on bz.id = a.business_id
   where a.business_id = p_business and a.clock_out is null and a.cancelled_at is null and a.clock_in <= p_now
     and a.clock_in < p_now - make_interval(hours => coalesce(staff_rule(p_business, 'clocked_in_alert_hours'), 16)::int)
  union all
  select 'payroll_due'::text, to_char(m.month, 'YYYY-MM'),
         case when m.today > m.payday + 7 then 'red' else 'orange' end,
         case when r.status is null or r.status = 'draft'
              then format('The payroll for %s is not approved: salaries were due on %s', to_char(m.month, 'YYYY-MM'),
                          to_char(m.payday, 'DD Mon'))
              else format('Salaries for %s: %s IQD not paid yet', to_char(m.month, 'YYYY-MM'),
                          alert_money((select coalesce(sum(l.net), 0) from payroll_line l where l.run_id = r.id)
                                      - (select coalesce(sum(p.amount), 0) from salary_payment p
                                          where p.run_id = r.id and p.cancelled_at is null))) end,
         case when r.status is null or r.status = 'draft'
              then 'Until the payroll is approved, the month''s salaries are not in the books and nobody can be paid.'
              else 'Salaries owed and not paid are owed to people who have done the work.' end,
         case when r.status is null or r.status = 'draft'
              then 'Draft it on Payroll, check it, and approve it.'
              else 'Pay them on Payroll.' end,
         'high', '/payroll',
         jsonb_build_object('month', m.month, 'payday', m.payday, 'run_id', r.id, 'status', r.status)
    from (select x.month, x.today, (x.month + interval '1 month'
                   + make_interval(days => coalesce(staff_rule(p_business, 'payday'), 1)::int - 1))::date as payday
            from (select (date_trunc('month', business_local_date(p_business, p_now)) - interval '1 month')::date as month,
                         business_local_date(p_business, p_now) as today) x) m
    left join payroll_run r on r.business_id = p_business and r.month = m.month
   where m.today >= m.payday
     and exists (select 1 from employee e where e.business_id = p_business and e.hired_on < m.month + interval '1 month'
                   and (e.left_on is null or e.left_on >= m.month))
     and (r.status is null or r.status in ('draft', 'approved'))
$$;

-- ---------------------------------------------------------------------------
-- 13. Read by those who may
-- ---------------------------------------------------------------------------
alter table employee enable row level security;
alter table employee force row level security;
alter table clock_attempt enable row level security;
alter table clock_attempt force row level security;
alter table shift_schedule enable row level security;
alter table shift_schedule force row level security;
alter table attendance enable row level security;
alter table attendance force row level security;
alter table employee_advance enable row level security;
alter table employee_advance force row level security;
alter table payroll_run enable row level security;
alter table payroll_run force row level security;
alter table payroll_line enable row level security;
alter table payroll_line force row level security;
alter table payroll_approval enable row level security;
alter table payroll_approval force row level security;
alter table salary_payment enable row level security;
alter table salary_payment force row level security;
alter table salary_payment_line enable row level security;
alter table salary_payment_line force row level security;

-- The people and their hours: whoever looks after staff, their hours or their pay.
drop policy if exists staff_read on employee;
create policy staff_read on employee for select to authenticated
  using (business_id = (select current_business_id())
         and ((select current_has_permission('staff.manage')) or (select current_has_permission('attendance.edit'))
              or (select current_has_permission('payroll.view'))));
drop policy if exists staff_read on shift_schedule;
create policy staff_read on shift_schedule for select to authenticated
  using (business_id = (select current_business_id())
         and ((select current_has_permission('staff.manage')) or (select current_has_permission('attendance.edit'))
              or (select current_has_permission('payroll.view'))));
drop policy if exists staff_read on attendance;
create policy staff_read on attendance for select to authenticated
  using (business_id = (select current_business_id())
         and ((select current_has_permission('staff.manage')) or (select current_has_permission('attendance.edit'))
              or (select current_has_permission('payroll.view'))));
-- Pay: those who see payroll.
drop policy if exists payroll_read on employee_advance;
create policy payroll_read on employee_advance for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('payroll.view')));
drop policy if exists payroll_read on payroll_run;
create policy payroll_read on payroll_run for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('payroll.view')));
drop policy if exists payroll_read on payroll_line;
create policy payroll_read on payroll_line for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('payroll.view')));
drop policy if exists payroll_read on payroll_approval;
create policy payroll_read on payroll_approval for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('payroll.view')));
drop policy if exists payroll_read on salary_payment;
create policy payroll_read on salary_payment for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('payroll.view')));
drop policy if exists payroll_read on salary_payment_line;
create policy payroll_read on salary_payment_line for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('payroll.view')));

-- A person's pay and PIN are not among what is read straight from the table.
grant select (id, business_id, location_id, full_name, phone, title, hired_on, left_on, app_user_id, created_at)
  on employee to authenticated;
grant select on shift_schedule, attendance, employee_advance, payroll_run, payroll_line, payroll_approval,
  salary_payment, salary_payment_line to authenticated;

-- ---------------------------------------------------------------------------
-- 14. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  provision_chart_of_accounts(uuid), manual_journal_blocked(text), rule_definitions(), rule_defaults(uuid),
  staff_rule(uuid, text), staff_member(uuid, uuid, boolean), works_on(employee, date), payroll_settled(uuid, date),
  save_employee__run(uuid, text, text, text, uuid, date, uuid),
  set_employee_pay__run(uuid, text, numeric, numeric, numeric, text), set_employee_left__run(uuid, date, text),
  save_schedule__run(uuid, date, date, jsonb), trg_attendance_guard(), clock_pin_check(uuid, employee, text, uuid),
  attendance_overlap(uuid, timestamptz, timestamptz, uuid), clock_in__run(uuid, text, uuid), clock_out__run(uuid, text),
  attendance_checked(uuid, employee, timestamptz, timestamptz, uuid),
  correct_attendance__run(uuid, timestamptz, timestamptz, text),
  add_attendance__run(uuid, timestamptz, timestamptz, text, uuid), cancel_attendance__run(uuid, text),
  staff_days(uuid, date, date, uuid), trg_employee_advance_guard(), advance_owed(uuid, uuid), staff_paid_from(text),
  record_advance__run(uuid, numeric, text, text), staff_cash_back(uuid, uuid, text, numeric, text, uuid, uuid),
  cancel_advance__run(uuid, text), trg_payroll_line_guard(), trg_payroll_approval_guard(),
  payroll_figures(uuid, employee, date),
  payroll_refresh(uuid, uuid), payroll_current(uuid, uuid), payroll_month_text(date), draft_payroll__run(date),
  adjust_payroll_line__run(uuid, numeric, text, numeric, text, numeric), approve_payroll__run(uuid),
  payroll_line_paid(uuid), reopen_payroll__run(uuid, text), trg_salary_payment_guard(),
  pay_salaries(uuid, payroll_run, jsonb, text, uuid), pay_salary__run(uuid, numeric, text), pay_payroll__run(uuid, text),
  cancel_salary_payment__run(uuid, text), reconciliation_checks(uuid, date), document_problems(uuid, timestamptz),
  journal_source_hint(text), record_bill__run(uuid, text, date, numeric, int, uuid, text),
  record_supplier_credit__run(uuid, text, numeric, text, text, uuid, uuid, text), alert_conditions(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function
  save_employee(uuid, text, text, text, uuid, date, uuid, uuid),
  set_employee_pay(uuid, text, numeric, numeric, numeric, text, uuid), set_employee_left(uuid, date, text, uuid),
  set_clock_pin(uuid, text), staff_list(), save_schedule(uuid, date, date, jsonb, uuid),
  staff_schedule(date, date, uuid), clock_board(uuid), clock_in(uuid, text, uuid, uuid), clock_out(uuid, text, uuid),
  correct_attendance(uuid, timestamptz, timestamptz, text, uuid),
  add_attendance(uuid, timestamptz, timestamptz, text, uuid, uuid), cancel_attendance(uuid, text, uuid),
  attendance_list(date, date, uuid), record_advance(uuid, numeric, text, text, uuid), cancel_advance(uuid, text, uuid),
  employee_advances(uuid), draft_payroll(date, uuid),
  adjust_payroll_line(uuid, numeric, text, numeric, text, numeric, uuid), approve_payroll(uuid, uuid),
  reopen_payroll(uuid, text, uuid), pay_salary(uuid, numeric, text, uuid), pay_payroll(uuid, text, uuid),
  cancel_salary_payment(uuid, text, uuid), payroll_runs(), payroll_detail(uuid), report_staff(date, date),
  period_close_checklist(uuid), cash_session_statement(uuid)
  from public, anon;
grant execute on function
  save_employee(uuid, text, text, text, uuid, date, uuid, uuid),
  set_employee_pay(uuid, text, numeric, numeric, numeric, text, uuid), set_employee_left(uuid, date, text, uuid),
  set_clock_pin(uuid, text), staff_list(), save_schedule(uuid, date, date, jsonb, uuid),
  staff_schedule(date, date, uuid), clock_board(uuid), clock_in(uuid, text, uuid, uuid), clock_out(uuid, text, uuid),
  correct_attendance(uuid, timestamptz, timestamptz, text, uuid),
  add_attendance(uuid, timestamptz, timestamptz, text, uuid, uuid), cancel_attendance(uuid, text, uuid),
  attendance_list(date, date, uuid), record_advance(uuid, numeric, text, text, uuid), cancel_advance(uuid, text, uuid),
  employee_advances(uuid), draft_payroll(date, uuid),
  adjust_payroll_line(uuid, numeric, text, numeric, text, numeric, uuid), approve_payroll(uuid, uuid),
  reopen_payroll(uuid, text, uuid), pay_salary(uuid, numeric, text, uuid), pay_payroll(uuid, text, uuid),
  cancel_salary_payment(uuid, text, uuid), payroll_runs(), payroll_detail(uuid), report_staff(date, date),
  period_close_checklist(uuid), cash_session_statement(uuid)
  to authenticated;
