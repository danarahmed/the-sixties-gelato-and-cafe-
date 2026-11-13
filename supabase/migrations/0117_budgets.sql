-- 0117: budgets, against what happened (plan 6, item 9).
--
--   * A month's budget for each revenue and cost account: what the café
--     plans to take in, and to spend. Set by the owner or the accountant, for
--     this month, a month to come or one gone by (as a record of what was
--     planned); changed by setting it again, each change on the audit trail.
--   * Read for any dates: each month's budget shared by the days of it that
--     the dates cover. Reports → Compare sets it beside what happened, and
--     beside the same days a year before.
--
-- Nothing recorded changes.

create table if not exists budget_line (
  business_id  uuid not null references business(id) on delete cascade,
  month        date not null check (month = date_trunc('month', month)::date),
  account_code text not null,
  amount       numeric not null check (amount >= 0),
  set_by       uuid references app_user(id),
  set_at       timestamptz not null default now(),
  primary key (business_id, month, account_code)
);
alter table budget_line enable row level security;
alter table budget_line force row level security;

-- (the owner, or accounting.post) A month's budget: {code: amount} for each
-- account; an amount of 0 or none takes the account off it.
create or replace function set_budget(p_month date, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view'); v_month date := date_trunc('month', p_month)::date;
  x record; v_before jsonb; n int := 0;
begin
  if not (current_has_role('owner') or current_has_permission('accounting.post')) then
    raise exception 'The owner or the accountant sets the budget' using errcode = '42501';
  end if;
  if v_month is null then raise exception 'Choose the month'; end if;
  if jsonb_typeof(p_lines) is distinct from 'object' then raise exception 'The budget cannot be read'; end if;
  select coalesce(jsonb_object_agg(account_code, amount), '{}'::jsonb) into v_before
    from budget_line where business_id = v_business and month = v_month;
  for x in select key as code, value from jsonb_each(p_lines) loop
    if not exists (select 1 from gl_account where business_id = v_business and code = x.code
                     and account_type in ('revenue', 'expense')) then
      raise exception 'Account % is not a revenue or a cost', x.code;
    end if;
    if jsonb_typeof(x.value) not in ('number', 'null') or coalesce((x.value #>> '{}')::numeric, 0) < 0 then
      raise exception 'A budget is 0 or more';
    end if;
    if coalesce((x.value #>> '{}')::numeric, 0) = 0 then
      delete from budget_line where business_id = v_business and month = v_month and account_code = x.code;
    else
      insert into budget_line (business_id, month, account_code, amount, set_by, set_at)
      values (v_business, v_month, x.code, money_round(v_business, (x.value #>> '{}')::numeric), (current_member()).id, now())
      on conflict (business_id, month, account_code)
        do update set amount = excluded.amount, set_by = excluded.set_by, set_at = excluded.set_at;
      n := n + 1;
    end if;
  end loop;
  perform audit_event(v_business, 'budget.set', 'business', v_business::text, to_char(v_month, 'YYYY-MM'),
    v_before, (select coalesce(jsonb_object_agg(account_code, amount), '{}'::jsonb)
                 from budget_line where business_id = v_business and month = v_month));
  return jsonb_build_object('month', v_month, 'accounts', n);
end $$;

-- (profit.view) The budget of the dates: each account's months, each shared by
-- the days of it the dates cover.
create or replace function budget_for(p_from date, p_to date)
returns table (code text, amount numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('profit.view');
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose the dates, the first before the last';
  end if;
  return query
    select b.account_code,
           round(sum(b.amount
                     * ((least(p_to, (b.month + interval '1 month')::date - 1) - greatest(p_from, b.month) + 1)::numeric
                        / (((b.month + interval '1 month')::date - b.month)::numeric))), 0)
      from budget_line b
     where b.business_id = v_business and b.month <= p_to and (b.month + interval '1 month')::date > p_from
     group by b.account_code
     order by b.account_code;
end $$;

-- (profit.view) A month's budget as it was set, for the form.
create or replace function budget_month(p_month date) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(account_code, amount), '{}'::jsonb)
    from budget_line
   where business_id = current_business_id() and month = date_trunc('month', p_month)::date
     and current_has_permission('profit.view')
$$;

revoke execute on function set_budget(date, jsonb), budget_for(date, date), budget_month(date) from public, anon;
grant execute on function set_budget(date, jsonb), budget_for(date, date), budget_month(date) to authenticated;
