-- =============================================================================
-- 0052 — The balance sheet and the cash-flow statement (release Z)
--
-- The trial balance carried every balance and the P&L was built; the balance
-- sheet and the cash-flow statement were not (docs/COMPLETION_PLAN.md, B17).
-- Both are built from the published journal lines alone, so they agree with
-- the trial balance and the P&L to the dinar.
--   * report_balance_sheet(as_of): what the café owned and owed when a day
--     ended by its clock: the assets, the liabilities, and the equity with
--     the profit not yet closed into retained earnings. Assets less
--     liabilities less equity is worked out, not assumed: it is the
--     difference, nought when the books balance.
--   * report_cash_flow(from, to): the cash at the start of the dates, where
--     it came from and where it went, read from what else each journal that
--     moved cash touched (the direct method), and the cash at the end. Money
--     moved between the till, the safe and the bank is no flow.
-- Reading only: nothing is written, and no table changes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Where an account's cash goes in the statement, by its code
-- ---------------------------------------------------------------------------
-- The chart is numbered, and accounts are added only by the migrations, so
-- the code says it: 1xxx what the café owns (the cash in the till, the safe
-- and the bank, in dinars and dollars; what it is owed; its stock; its
-- equipment), 2xxx what it owes, 3xxx the owner's, 4xxx its sales, 5xxx their
-- cost, 6xxx its running costs. The lines of the statement:
--   cash       1000, 1001, 1005, 1006, 1020: the cash itself;
--   sales      4xxx, card clearing 1010 and the platforms' 1100 with their
--              commission and fees (5100, 5200) and the card and bank fees
--              (6500): received from sales;
--   stock      12xx, 2000, 2050 and the rest of 5xxx: paid for stock and to
--              suppliers;
--   staff      1300, 2100 and 61xx: paid to staff, and advances;
--   counts     6300: the drawer counted over or short;
--   running    every other account: the running costs;
--   equipment  15xx: bought or sold (investing);
--   owner      3xxx: the owner's money in and out (financing);
--   exchange   6950: dollars changed at another rate than they were kept at.
create or replace function cash_flow_line(p_code text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_code in ('1000', '1001', '1005', '1006', '1020') then 'cash'
    when p_code like '15%' then 'equipment'
    when p_code like '3%' then 'owner'
    when p_code = '6950' then 'exchange'
    when p_code = '6300' then 'counts'
    when p_code like '4%' or p_code in ('1010', '1100', '5100', '5200', '6500') then 'sales'
    when p_code like '12%' or p_code in ('2000', '2050') or p_code like '5%' then 'stock'
    when p_code in ('1300', '2100') or p_code like '61%' then 'staff'
    else 'running'
  end
$$;

-- A line's section: operating, investing, financing, or the exchange of
-- dollars (shown apart, as the effect of rates on the cash).
create or replace function cash_flow_section(p_line text) returns text
language sql immutable set search_path = public as $$
  select case p_line
    when 'cash' then 'cash'
    when 'equipment' then 'investing'
    when 'owner' then 'financing'
    when 'exchange' then 'exchange'
    else 'operating'
  end
$$;

-- ---------------------------------------------------------------------------
-- 2. The balance sheet at the end of a day
-- ---------------------------------------------------------------------------
-- Each account's balance from the published journals dated before the day
-- ended by the café's clock. Assets are debit balances; liabilities and
-- equity credit balances, so a contra account shows negative (accumulated
-- depreciation among the assets, the owner's drawings in the equity). The
-- revenue and expenses not yet closed into 3100 Retained earnings (the
-- year-end close, on locking December) are the equity's profit: this year's,
-- and any earlier year's left unclosed.
create or replace function report_balance_sheet(p_as_of date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  v_end timestamptz; v_year_start date := date_trunc('year', p_as_of)::date; v_year timestamptz;
  v_lines jsonb; v_cash numeric; v_current numeric; v_fixed numeric; v_liabilities numeric; v_equity numeric;
  v_this_year numeric; v_earlier numeric;
begin
  if p_as_of is null then raise exception 'Choose the day'; end if;
  if p_as_of > business_local_date(v_business, now()) then
    raise exception 'Choose today or a day before it';
  end if;
  select from_ts, to_ts into v_year, v_end from local_day_bounds(v_business, v_year_start, p_as_of);
  with bal as (
    select a.code, a.name, a.account_type,
           case when a.account_type = 'asset' and cash_flow_line(a.code) = 'cash' then 'cash'
                when a.account_type = 'asset' and a.code like '15%' then 'fixed'
                when a.account_type = 'asset' then 'current'
                else a.account_type::text end as grp,
           coalesce(sum(l.debit - l.credit), 0) as dr,
           coalesce(sum(l.debit - l.credit) filter (where e.occurred_at < v_year), 0) as dr_before
      from gl_account a
      left join (journal_line l join journal_entry e on e.id = l.journal_entry_id
                  and e.status = 'published' and e.occurred_at < v_end)
        on l.account_id = a.id
     where a.business_id = v_business
     group by a.code, a.name, a.account_type
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', code, 'name', name, 'section', account_type, 'group', grp,
           'amount', case when account_type = 'asset' then dr else -dr end)
         order by code) filter (where account_type in ('asset', 'liability', 'equity') and dr <> 0), '[]'::jsonb),
         coalesce(sum(dr) filter (where grp = 'cash'), 0),
         coalesce(sum(dr) filter (where grp in ('cash', 'current')), 0),
         coalesce(sum(dr) filter (where grp = 'fixed'), 0),
         coalesce(-sum(dr) filter (where account_type = 'liability'), 0),
         coalesce(-sum(dr) filter (where account_type = 'equity'), 0),
         coalesce(-sum(dr - dr_before) filter (where account_type in ('revenue', 'expense')), 0),
         coalesce(-sum(dr_before) filter (where account_type in ('revenue', 'expense')), 0)
    into v_lines, v_cash, v_current, v_fixed, v_liabilities, v_equity, v_this_year, v_earlier
    from bal;
  return jsonb_build_object(
    'as_of', p_as_of, 'year_from', v_year_start, 'lines', v_lines,
    'cash', v_cash, 'current_assets', v_current, 'fixed_assets', v_fixed, 'assets', v_current + v_fixed,
    'liabilities', v_liabilities, 'equity', v_equity,
    'profit_this_year', v_this_year, 'profit_earlier', v_earlier,
    'equity_total', v_equity + v_this_year + v_earlier,
    'liabilities_and_equity', v_liabilities + v_equity + v_this_year + v_earlier,
    'difference', v_current + v_fixed - v_liabilities - v_equity - v_this_year - v_earlier);
end $$;

-- ---------------------------------------------------------------------------
-- 3. The cash-flow statement for the dates
-- ---------------------------------------------------------------------------
-- The direct method. Every published journal of the dates that moves cash is
-- read by its other lines, each saying where that much cash came from (a
-- credit) or went (a debit), and summed by the line of the statement its
-- account is on, journal by journal: so a sale's cost and the stock it used,
-- which cancel in its journal, are no flow, and a line's accounts are those
-- that moved its cash. A bill paid is read by what the bill was for: a bill
-- charged to an account (equipment, a service) by that account, a bill for
-- goods delivered as paid to a supplier (2000). A journal that only moves
-- cash between the till, the safe and the bank has no other line, and is no
-- flow. The cash at the end less the cash at the start less the flows is
-- worked out, not assumed: it is the difference, nought when the journals
-- balance.
create or replace function report_cash_flow(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view'); b record;
  v_cash jsonb; v_open numeric; v_close numeric; v_lines jsonb; v_net numeric;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose the dates, the first on or before the last';
  end if;
  if p_to - p_from > 366 then raise exception 'Choose at most a year of dates'; end if;
  if p_to > business_local_date(v_business, now()) then
    raise exception 'Choose today or a day before it';
  end if;
  select * into b from local_day_bounds(v_business, p_from, p_to);

  -- The cash at the start and at the end, account by account.
  select coalesce(jsonb_agg(jsonb_build_object('code', x.code, 'name', x.name, 'opening', x.opening,
                                               'closing', x.closing) order by x.code)
                    filter (where x.opening <> 0 or x.closing <> 0), '[]'::jsonb),
         coalesce(sum(x.opening), 0), coalesce(sum(x.closing), 0)
    into v_cash, v_open, v_close
    from (select a.code, a.name,
                 coalesce(sum(l.debit - l.credit) filter (where e.occurred_at < b.from_ts), 0) as opening,
                 coalesce(sum(l.debit - l.credit), 0) as closing
            from gl_account a
            left join (journal_line l join journal_entry e on e.id = l.journal_entry_id
                        and e.status = 'published' and e.occurred_at < b.to_ts)
              on l.account_id = a.id
           where a.business_id = v_business and cash_flow_line(a.code) = 'cash'
           group by a.code, a.name) x;

  -- Where it came from and went.
  with moving as (
    select e.id,
           -- A bill paid: the account the bill was charged to (none for goods).
           (select pi.expense_account_code from supplier_payment sp
              join purchase_invoice pi on pi.id = sp.purchase_invoice_id
             where e.reference_type = 'supplier_payment' and sp.id = e.reference_id) as paid_for
      from journal_entry e
     where e.business_id = v_business and e.status = 'published'
       and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts
       and exists (select 1 from journal_line l join gl_account a on a.id = l.account_id
                    where l.journal_entry_id = e.id and cash_flow_line(a.code) = 'cash')
  ),
  jl as (
    select m.id as journal_id,
           case when a.code = '2000' and m.paid_for is not null and cash_flow_line(m.paid_for) <> 'cash'
                then m.paid_for else a.code end as code,
           sum(l.credit - l.debit) as amount
      from moving m
      join journal_line l on l.journal_entry_id = m.id
      join gl_account a on a.id = l.account_id
     where cash_flow_line(a.code) <> 'cash'
     group by 1, 2
  ),
  jline as (
    select journal_id, cash_flow_line(code) as line, sum(amount) as amount
      from jl group by 1, 2 having sum(amount) <> 0
  ),
  per_line as (
    select line, cash_flow_section(line) as section, sum(amount) as amount,
           coalesce(sum(amount) filter (where amount > 0), 0) as cash_in,
           coalesce(-sum(amount) filter (where amount < 0), 0) as cash_out,
           count(*) as journals
      from jline group by line
  ),
  per_account as (
    select k.line, jl.code, sum(jl.amount) as amount
      from jl join jline k on k.journal_id = jl.journal_id and k.line = cash_flow_line(jl.code)
     group by 1, 2 having sum(jl.amount) <> 0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'line', p.line, 'section', p.section, 'amount', p.amount, 'in', p.cash_in, 'out', p.cash_out,
           'journals', p.journals,
           'accounts', coalesce((select jsonb_agg(jsonb_build_object(
                                          'code', a.code, 'amount', a.amount,
                                          'name', (select g.name from gl_account g
                                                    where g.business_id = v_business and g.code = a.code))
                                        order by a.code)
                                   from per_account a where a.line = p.line), '[]'::jsonb))
         order by array_position(array['sales', 'stock', 'staff', 'running', 'counts', 'equipment', 'owner',
                                       'exchange'], p.line), p.line), '[]'::jsonb),
         coalesce(sum(p.amount), 0)
    into v_lines, v_net
    from per_line p;

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'cash', v_cash, 'opening', v_open, 'closing', v_close, 'lines', v_lines,
    'operating', (select coalesce(sum((x ->> 'amount')::numeric), 0) from jsonb_array_elements(v_lines) x
                   where x ->> 'section' = 'operating'),
    'investing', (select coalesce(sum((x ->> 'amount')::numeric), 0) from jsonb_array_elements(v_lines) x
                   where x ->> 'section' = 'investing'),
    'financing', (select coalesce(sum((x ->> 'amount')::numeric), 0) from jsonb_array_elements(v_lines) x
                   where x ->> 'section' = 'financing'),
    'exchange', (select coalesce(sum((x ->> 'amount')::numeric), 0) from jsonb_array_elements(v_lines) x
                  where x ->> 'section' = 'exchange'),
    'net', v_net, 'difference', v_close - v_open - v_net);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function cash_flow_line(text), cash_flow_section(text) from public, anon, authenticated;
revoke execute on function report_balance_sheet(date), report_cash_flow(date, date) from public, anon;
grant execute on function report_balance_sheet(date), report_cash_flow(date, date) to authenticated;
