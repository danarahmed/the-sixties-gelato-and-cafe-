-- =============================================================================
-- 0060 — Prepaid expenses (the September audit's P2-14)
-- =============================================================================
-- A cost paid ahead for months to come (next month's rent, a quarter's, a
-- year's insurance) was an expense of the month it was paid in: that month's
-- profit was too low, and the months it paid for too high. Now:
--
--  * It is paid into 1400 Prepaid expenses, an asset: Dr 1400, Cr where the
--    money came from, out of the till's drawer or the safe as an expense is.
--    1400 moves only with a prepaid expense: no journal by hand touches it.
--  * Each month it covers takes its share, as an expense of that month at the
--    place it was recorded at: Dr the expense's account, Cr 1400, on the
--    Expense Register like any expense. The shares are equal, rounded down to
--    the café's money, and the last takes what is left, so they add up to
--    what was paid.
--  * A month's share is posted once that month has come: at once for the
--    month it starts in, if that has come, and for the months after by
--    "Release what is due" on Expenses. A month is not locked while a share
--    of it is not posted (the closing checklist), and the dashboard says when
--    one is due.
--  * One entered in error is cancelled, with why: its journal and every share
--    posted are reversed that day, and cash paid out of the drawer is put
--    back in it.
--  * 1400 is checked against the prepaid expenses whenever the books are
--    tied (reconciliation_checks).
--  * Each is recorded, released and cancelled on the audit trail, and each
--    call may be retried with its key (0035).

-- =============================================================================
-- 1. 1400 Prepaid expenses
-- =============================================================================
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
    ('1210','Stock in transit',           'asset',     'debit'),
    ('1300','Employee advances',          'asset',     'debit'),
    ('1400','Prepaid expenses',           'asset',     'debit'),
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

select provision_chart_of_accounts(id) from business;

create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$
  select p_code in ('1000', '1001', '1005', '1006', '1200', '1210', '1300', '1400', '2000', '2050', '2100', '3100')
$$;

-- =============================================================================
-- 2. A prepaid expense, and each month's share of it posted
-- =============================================================================
create table if not exists prepaid_expense (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references business(id),
  location_id     uuid not null references location(id),
  description     text not null check (length(btrim(description)) between 1 and 200),
  -- The expense account each month's share goes to.
  account_id      uuid not null references gl_account(id),
  paid_from       text not null check (paid_from in ('till', 'safe', 'bank', 'card', 'owner')),
  amount          numeric not null check (amount > 0),
  first_month     date not null check (first_month = date_trunc('month', first_month)::date),
  months          int not null check (months between 1 and 36),
  journal_entry_id uuid not null references journal_entry(id),
  created_by      uuid not null references app_user(id),
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz,
  cancelled_by    uuid references app_user(id),
  cancel_reason   text check (cancel_reason is null or length(cancel_reason) <= 300),
  cancel_journal_entry_id uuid references journal_entry(id),
  check ((cancelled_at is null) = (cancelled_by is null) and (cancelled_at is null) = (cancel_reason is null)
         and (cancelled_at is null) = (cancel_journal_entry_id is null))
);
create index if not exists prepaid_expense_recent on prepaid_expense (business_id, created_at desc);

create table if not exists prepaid_release (
  id              uuid primary key default gen_random_uuid(),
  prepaid_id      uuid not null references prepaid_expense(id),
  business_id     uuid not null references business(id),
  month           date not null check (month = date_trunc('month', month)::date),
  amount          numeric not null check (amount > 0),
  -- The share is an expense of its month (the Expense Register, the profit
  -- and loss at its place): its row and its journal.
  expense_id      uuid not null unique references expense(id),
  journal_entry_id uuid not null unique references journal_entry(id),
  created_by      uuid not null references app_user(id),
  created_at      timestamptz not null default now(),
  unique (prepaid_id, month)
);

alter table prepaid_expense enable row level security;
alter table prepaid_expense force row level security;
alter table prepaid_release enable row level security;
alter table prepaid_release force row level security;
drop policy if exists prepaid_expense_read on prepaid_expense;
create policy prepaid_expense_read on prepaid_expense for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
drop policy if exists prepaid_release_read on prepaid_release;
create policy prepaid_release_read on prepaid_release for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
revoke all on prepaid_expense, prepaid_release from anon, authenticated;
grant select on prepaid_expense, prepaid_release to authenticated;

-- A prepaid expense stays as it was recorded: it is cancelled once, and never
-- deleted. A share, once posted, is never changed.
create or replace function trg_prepaid_expense_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'A prepaid expense is never deleted: cancel it instead';
  end if;
  if OLD.cancelled_at is not null then
    raise exception 'That prepaid expense was cancelled already';
  end if;
  if (NEW.business_id, NEW.location_id, NEW.description, NEW.account_id, NEW.paid_from, NEW.amount,
      NEW.first_month, NEW.months, NEW.journal_entry_id, NEW.created_by, NEW.created_at)
     is distinct from
     (OLD.business_id, OLD.location_id, OLD.description, OLD.account_id, OLD.paid_from, OLD.amount,
      OLD.first_month, OLD.months, OLD.journal_entry_id, OLD.created_by, OLD.created_at) then
    raise exception 'A prepaid expense stays as it was recorded: cancel it and record it again';
  end if;
  return NEW;
end $$;
drop trigger if exists prepaid_expense_guard on prepaid_expense;
create trigger prepaid_expense_guard before update or delete on prepaid_expense
  for each row execute function trg_prepaid_expense_guard();

create or replace function trg_prepaid_release_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'A month''s share of a prepaid expense is not changed: cancel the prepaid expense instead';
end $$;
drop trigger if exists prepaid_release_guard on prepaid_release;
create trigger prepaid_release_guard before update or delete on prepaid_release
  for each row execute function trg_prepaid_release_guard();

-- 1400 moves only with a prepaid expense: the payment into it, a month's share
-- out of it (while the share is being posted), and the reversal of either.
create or replace function trg_prepaid_by_its_records() returns trigger
language plpgsql security definer set search_path = public as $$
declare e journal_entry;
begin
  if not exists (select 1 from gl_account a where a.id = new.account_id and a.code = '1400') then
    return new;
  end if;
  select * into e from journal_entry where id = new.journal_entry_id;
  if e.reference_type = 'prepaid_expense' or current_setting('ledger.prepaid_share', true) = 'on' then
    return new;
  end if;
  if e.reference_type = 'reversal' and exists (
       select 1 from journal_entry o
        where o.id = e.reverses_entry
          and (o.reference_type = 'prepaid_expense'
               or exists (select 1 from prepaid_release r where r.journal_entry_id = o.id))) then
    return new;
  end if;
  raise exception 'Prepaid expenses (1400) move only with a prepaid expense: record one on Expenses';
end $$;
drop trigger if exists journal_line_prepaid on journal_line;
create trigger journal_line_prepaid before insert on journal_line
  for each row execute function trg_prepaid_by_its_records();

-- =============================================================================
-- 3. The shares
-- =============================================================================
-- Month by month: each an equal share rounded down to the café's money, the
-- last what is left, so they add up to the amount.
create or replace function prepaid_shares(p_business uuid, p_amount numeric, p_months int, p_first date)
returns table (n int, month date, amount numeric)
language sql stable set search_path = public as $$
  with e as (select trunc(p_amount / p_months,
                          coalesce((select currency_decimals from business where id = p_business), 0)) as each)
  select g.n, (p_first + make_interval(months => g.n - 1))::date,
         case when g.n < p_months then e.each else p_amount - e.each * (p_months - 1) end
    from e, generate_series(1, p_months) g(n)
$$;

-- Every share of the café's prepaid expenses (one, when named) whose month has
-- come by p_through and is not posted yet, posted: an expense of its month,
-- dated on its first day at noon, or when the prepaid was recorded if that is
-- later. Returns what was posted.
create or replace function release_prepaid__run(p_business uuid, p_through date, p_me uuid,
                                                p_prepaid uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  x record; v_exp uuid; v_journal uuid; v_at timestamptz; v_code text; v_text text;
  v_tz text := (select timezone from business where id = p_business);
  v_out jsonb := '[]'::jsonb;
begin
  -- One release at a time for the café: two presses of the button post once.
  perform 1 from prepaid_expense
   where business_id = p_business and cancelled_at is null and (p_prepaid is null or id = p_prepaid)
   for update;
  for x in
    select pe.id, pe.location_id, pe.description, pe.account_id, pe.created_at, s.month, s.amount as share
      from prepaid_expense pe
      cross join lateral prepaid_shares(p_business, pe.amount, pe.months, pe.first_month) s
     where pe.business_id = p_business and pe.cancelled_at is null
       and (p_prepaid is null or pe.id = p_prepaid)
       and s.month <= date_trunc('month', p_through)::date
       and not exists (select 1 from prepaid_release r where r.prepaid_id = pe.id and r.month = s.month)
     order by s.month, pe.created_at
  loop
    v_exp := gen_random_uuid();
    v_at := greatest((x.month + time '12:00') at time zone v_tz, x.created_at);
    v_text := x.description || ' (' || to_char(x.month, 'YYYY-MM') || ')';
    select code into v_code from gl_account where id = x.account_id;
    perform set_config('ledger.prepaid_share', 'on', true);
    v_journal := post_journal(p_business, v_at, 'Expense: ' || v_text, 'expense', v_exp,
      jsonb_build_array(jsonb_build_object('code', v_code, 'debit', x.share),
                        jsonb_build_object('code', '1400', 'credit', x.share)));
    perform set_config('ledger.prepaid_share', 'off', true);
    insert into expense (id, business_id, location_id, amount, incurred_on, description, journal_entry_id, created_by)
    values (v_exp, p_business, x.location_id, x.share, business_local_date(p_business, v_at), v_text, v_journal, p_me);
    insert into prepaid_release (prepaid_id, business_id, month, amount, expense_id, journal_entry_id, created_by)
    values (x.id, p_business, x.month, x.share, v_exp, v_journal, p_me);
    v_out := v_out || jsonb_build_object('prepaid_id', x.id, 'description', x.description,
                                         'month', to_char(x.month, 'YYYY-MM'), 'amount', x.share,
                                         'journal_no', (select journal_no from journal_entry where id = v_journal));
  end loop;
  return v_out;
end $$;

-- The shares whose month has come by p_through and are not posted yet.
create or replace function prepaid_due(p_business uuid, p_through date)
returns table (prepaid_id uuid, month date, amount numeric)
language sql stable security definer set search_path = public as $$
  select pe.id, s.month, s.amount
    from prepaid_expense pe
    cross join lateral prepaid_shares(p_business, pe.amount, pe.months, pe.first_month) s
   where pe.business_id = p_business and pe.cancelled_at is null
     and s.month <= date_trunc('month', p_through)::date
     and not exists (select 1 from prepaid_release r where r.prepaid_id = pe.id and r.month = s.month)
$$;

-- =============================================================================
-- 4. A prepaid expense recorded
-- =============================================================================
create or replace function record_prepaid_expense__run(
  p_description text, p_amount numeric, p_account_code text, p_paid_from text,
  p_first_month date, p_months int, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('expense.record');
  v_me uuid := (current_member()).id;
  v_today date := business_local_date(v_business, now());
  v_this date := date_trunc('month', v_today)::date;
  v_first date := date_trunc('month', p_first_month)::date;
  v_amount numeric; v_acct gl_account; v_id uuid := gen_random_uuid(); v_journal uuid;
  v_from text := lower(coalesce(p_paid_from, '')); v_location uuid; v_released jsonb;
begin
  if v_from = 'cash' then v_from := 'till'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Describe the expense'; end if;
  select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
  if not found or v_acct.account_type <> 'expense' or p_account_code in ('5000', '5050', '5300', '5310', '5400') then
    raise exception 'Account % cannot take an expense (stock costs come from their own records)', p_account_code;
  end if;
  if v_from not in ('till', 'safe', 'bank', 'card', 'owner') then
    raise exception 'Say where the money came from: the till, the safe, the bank, a card or the owner';
  end if;
  if p_months is null or p_months < 1 or p_months > 36 then
    raise exception 'A prepaid expense covers 1 to 36 months';
  end if;
  if v_first is null or v_first < v_this then
    raise exception 'A prepaid expense starts this month or later: what it paid for before is an expense of those months';
  end if;
  -- One month is paid ahead only if it is still to come (next month's rent).
  if p_months = 1 and v_first = v_this then
    raise exception 'For this month alone, record an expense';
  end if;
  if v_first > v_this + interval '12 months' then
    raise exception 'A prepaid expense starts within a year';
  end if;
  if v_amount < p_months then
    raise exception 'Each month takes at least 1 of it: pay at least %, or cover fewer months', p_months;
  end if;
  v_location := resolve_location(v_business, p_location);

  v_journal := post_journal(v_business, now(), 'Prepaid: ' || trim(p_description), 'prepaid_expense', v_id,
    jsonb_build_array(jsonb_build_object('code', '1400', 'debit', v_amount),
                      jsonb_build_object('code', payment_account(v_from), 'credit', v_amount)));
  insert into prepaid_expense (id, business_id, location_id, description, account_id, paid_from, amount,
                               first_month, months, journal_entry_id, created_by)
  values (v_id, v_business, v_location, trim(p_description), v_acct.id, v_from, v_amount,
          v_first, p_months, v_journal, v_me);
  perform pay_out_of(v_business, v_location, v_from, v_amount, 'prepaid_expense', v_id, v_me);
  -- The month it starts in, if that has come.
  v_released := release_prepaid__run(v_business, v_today, v_me, v_id);
  return jsonb_build_object('prepaid_id', v_id, 'amount', v_amount,
                            'journal_no', (select journal_no from journal_entry where id = v_journal),
                            'released', v_released);
end $$;

create or replace function record_prepaid_expense(
  p_description text, p_amount numeric, p_account_code text, p_paid_from text,
  p_first_month date, p_months int, p_location uuid default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_description', p_description, 'p_amount', p_amount,
                                    'p_account_code', p_account_code, 'p_paid_from', p_paid_from,
                                    'p_first_month', p_first_month, 'p_months', p_months)
                 || case when p_location is not null then jsonb_build_object('p_location', p_location)
                         else '{}'::jsonb end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_prepaid_expense', v_req);
  if v is not null then return v; end if;
  v := record_prepaid_expense__run(p_description => p_description, p_amount => p_amount,
                                   p_account_code => p_account_code, p_paid_from => p_paid_from,
                                   p_first_month => p_first_month, p_months => p_months,
                                   p_location => p_location);
  perform audit_event(v_business, 'prepaid.record', 'prepaid_expense', v->>'prepaid_id', null, null,
    jsonb_build_object('description', p_description, 'amount', v->'amount', 'account', p_account_code,
                       'paid_from', p_paid_from, 'first_month', p_first_month, 'months', p_months,
                       'journal_no', v->'journal_no'));
  perform idem_finish(v_business, p_idempotency_key, 'record_prepaid_expense', v_req, v);
  return v;
end $$;

-- =============================================================================
-- 5. What is due, released
-- =============================================================================
create or replace function release_prepaid(p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('expense.record', 'accounting.post');
  v_req jsonb := '{}'::jsonb; v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'release_prepaid', v_req);
  if v is not null then return v; end if;
  v := jsonb_build_object('released',
         release_prepaid__run(v_business, business_local_date(v_business, now()), (current_member()).id));
  if jsonb_array_length(v -> 'released') > 0 then
    perform audit_event(v_business, 'prepaid.release', 'prepaid_expense', null, null, null, v);
  end if;
  perform idem_finish(v_business, p_idempotency_key, 'release_prepaid', v_req, v);
  return v;
end $$;

-- =============================================================================
-- 6. One entered in error, cancelled
-- =============================================================================
create or replace function cancel_prepaid_expense__run(p_prepaid uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  pe prepaid_expense; r record; v_rev uuid; v_n int := 0;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the prepaid expense is cancelled'; end if;
  select * into pe from prepaid_expense where id = p_prepaid and business_id = v_business for update;
  if not found then raise exception 'Prepaid expense not found'; end if;
  if pe.cancelled_at is not null then raise exception 'That prepaid expense was cancelled already'; end if;
  -- Each share posted, and not reversed by hand already, reversed today.
  for r in select pr.journal_entry_id from prepaid_release pr
            where pr.prepaid_id = pe.id
              and not exists (select 1 from journal_entry x where x.reverses_entry = pr.journal_entry_id)
            order by pr.month
  loop
    perform reverse_entry_internal(r.journal_entry_id, now(), 'Reversal: ' || trim(p_reason));
    v_n := v_n + 1;
  end loop;
  v_rev := reverse_entry_internal(pe.journal_entry_id, now(), 'Reversal: ' || trim(p_reason));
  -- Cash paid out of the drawer goes back in it; the safe and the bank are
  -- their accounts, put right by the reversal.
  if pe.paid_from = 'till' then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (v_business, pe.location_id, 'paid_out_reversed', pe.amount, 'journal_entry', v_rev, v_me);
  end if;
  update prepaid_expense
     set cancelled_at = now(), cancelled_by = v_me, cancel_reason = trim(p_reason), cancel_journal_entry_id = v_rev
   where id = pe.id;
  return jsonb_build_object('prepaid_id', pe.id, 'description', pe.description, 'shares_reversed', v_n,
                            'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

create or replace function cancel_prepaid_expense(p_prepaid uuid, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_prepaid', p_prepaid, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_prepaid_expense', v_req);
  if v is not null then return v; end if;
  v := cancel_prepaid_expense__run(p_prepaid => p_prepaid, p_reason => p_reason);
  perform audit_event(v_business, 'prepaid.cancel', 'prepaid_expense', p_prepaid::text, p_reason, null, v);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_prepaid_expense', v_req, v);
  return v;
end $$;

-- =============================================================================
-- 7. The café's prepaid expenses, read
-- =============================================================================
-- Each, newest first: what was paid, from where, for which months; the shares
-- posted (and any reversed by hand) and what is still in 1400; those due; and
-- a cancelled one's why.
create or replace function prepaid_expenses() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_today date := business_local_date(v_business, now());
begin
  return coalesce((
    select jsonb_agg(x order by x.created_at desc)
      from (select pe.id, pe.description, a.code as account_code, a.name as account_name, pe.paid_from,
                   pe.amount, to_char(pe.first_month, 'YYYY-MM') as first_month, pe.months,
                   to_char((pe.first_month + make_interval(months => pe.months - 1))::date, 'YYYY-MM') as last_month,
                   pe.created_at, j.journal_no, l.name as location,
                   (select count(*) from prepaid_release r where r.prepaid_id = pe.id) as released,
                   -- What the shares took out of 1400: a share reversed by hand put its back.
                   (select coalesce(sum(r.amount), 0) from prepaid_release r
                     where r.prepaid_id = pe.id
                       and not exists (select 1 from journal_entry x where x.reverses_entry = r.journal_entry_id))
                     as released_amount,
                   (select count(*) from prepaid_release r
                     where r.prepaid_id = pe.id
                       and exists (select 1 from journal_entry x where x.reverses_entry = r.journal_entry_id))
                     as reversed,
                   (select count(*) from prepaid_due(v_business, v_today) d where d.prepaid_id = pe.id) as due,
                   (select to_char(min(s.month), 'YYYY-MM')
                      from prepaid_shares(v_business, pe.amount, pe.months, pe.first_month) s
                     where not exists (select 1 from prepaid_release r
                                        where r.prepaid_id = pe.id and r.month = s.month)) as next_month,
                   pe.cancelled_at, pe.cancel_reason
              from prepaid_expense pe
              join gl_account a on a.id = pe.account_id
              join journal_entry j on j.id = pe.journal_entry_id
              left join location l on l.id = pe.location_id
             where pe.business_id = v_business) x), '[]'::jsonb);
end $$;

-- =============================================================================
-- 8. The alert, the closing checklist, and the books tied
-- =============================================================================
-- 0059's rules stay as they are. A share whose month has come and is not
-- posted: orange, to release it.
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0059;
revoke execute on function alert_conditions_0059(uuid, timestamptz) from public, anon, authenticated;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0059(p_business, p_now) c
  union all
  select 'prepaid_due'::text, 'prepaid'::text, 'orange'::text,
         format('%s month(s) of prepaid expenses are due to be released, %s IQD in all', x.n, alert_money(x.total)),
         'Each month a prepaid expense covers takes its share of it: until it is released, that month''s profit is too high.',
         'Release what is due on Expenses.',
         'high', '/expenses#prepaid', jsonb_build_object('shares', x.n, 'amount', x.total)
    from (select count(*) n, coalesce(sum(d.amount), 0) total
            from prepaid_due(p_business, business_local_date(p_business, p_now)) d) x
   where x.n > 0
$$;

-- 0059's checklist, and a check that stops the lock: every share of the month
-- posted.
alter function period_close_checklist(uuid) rename to period_close_checklist_0059;
revoke execute on function period_close_checklist_0059(uuid) from public, anon, authenticated;
create or replace function period_close_checklist(p_period uuid)
returns table (check_key text, label text, ok boolean, detail text, blocks boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.period.lock', 'accounting.post', 'audit.view');
  p accounting_period; n int; v_total numeric;
begin
  return query select * from period_close_checklist_0059(p_period);
  select * into p from accounting_period where id = p_period and business_id = v_business;
  select count(*), coalesce(sum(d.amount), 0) into n, v_total from prepaid_due(v_business, p.ends_on) d;
  check_key := 'prepaid_shares'; label := 'Each prepaid expense''s share of the month is posted'; blocks := true;
  ok := n = 0;
  detail := case when n > 0 then format('%s share(s) of prepaid expenses to %s, %s IQD in all, are not posted: release them on Expenses',
                                        n, p.ends_on, alert_money(v_total)) end;
  return next;
end $$;

-- 0054's checks, and 1400 against the prepaid expenses: what was paid in, less
-- a cancelled one's, less the shares posted, plus those reversed.
alter function reconciliation_checks(uuid, date) rename to reconciliation_checks_0054;
revoke execute on function reconciliation_checks_0054(uuid, date) from public, anon, authenticated;
create or replace function reconciliation_checks(p_business uuid, p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable set search_path = public as $$
declare v_end timestamptz;
begin
  return query select * from reconciliation_checks_0054(p_business, p_as_of);
  v_end := (local_day_bounds(p_business, p_as_of, p_as_of)).to_ts;
  check_key := 'prepaid'; label := 'Prepaid expenses still to come vs Prepaid expenses (1400)';
  subledger := coalesce((select sum(pe.amount) from prepaid_expense pe
                          where pe.business_id = p_business and pe.created_at < v_end), 0)
             - coalesce((select sum(pe.amount) from prepaid_expense pe
                          where pe.business_id = p_business and pe.cancelled_at < v_end), 0)
             - coalesce((select sum(r.amount) from prepaid_release r join journal_entry j on j.id = r.journal_entry_id
                          where r.business_id = p_business and j.occurred_at < v_end), 0)
             + coalesce((select sum(r.amount) from prepaid_release r
                           join journal_entry x on x.reverses_entry = r.journal_entry_id
                          where r.business_id = p_business and x.occurred_at < v_end), 0);
  ledger := gl_balance_at(p_business, '1400', v_end);
  difference := subledger - ledger;
  return next;
end $$;

-- A prepaid expense's own journal is corrected by cancelling it on Expenses.
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
    when 'stock_transfer' then 'stock sent to another place (cancel the transfer on Inventory while it is on its way)'
    when 'stock_transfer_receipt' then 'stock received from another place'
    when 'stock_transfer_cancel' then 'a transfer cancelled on its way'
    when 'prepaid_expense' then 'a prepaid expense (cancel it on Expenses)'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- =============================================================================
-- 9. Who may call what
-- =============================================================================
revoke execute on function
  trg_prepaid_expense_guard(), trg_prepaid_release_guard(), trg_prepaid_by_its_records(),
  prepaid_shares(uuid, numeric, int, date), prepaid_due(uuid, date),
  release_prepaid__run(uuid, date, uuid, uuid),
  record_prepaid_expense__run(text, numeric, text, text, date, int, uuid),
  cancel_prepaid_expense__run(uuid, text)
  from public, anon, authenticated;
revoke execute on function
  record_prepaid_expense(text, numeric, text, text, date, int, uuid, uuid), release_prepaid(uuid),
  cancel_prepaid_expense(uuid, text, uuid), prepaid_expenses(),
  alert_conditions(uuid, timestamptz), period_close_checklist(uuid), reconciliation_checks(uuid, date)
  from public, anon;
grant execute on function
  record_prepaid_expense(text, numeric, text, text, date, int, uuid, uuid), release_prepaid(uuid),
  cancel_prepaid_expense(uuid, text, uuid), prepaid_expenses(), period_close_checklist(uuid)
  to authenticated;
