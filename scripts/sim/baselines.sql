-- =============================================================================
-- Baselines for the backtests (SMART_PLAN step 7): the simplest rules a
-- feature must beat. They are not the features: each looks only at what was
-- recorded up to its day, as a feature will, and the backtest scores it the
-- same way it will score the real one (scripts/sim/backtest.py).
-- Loaded by the backtest, on the copy only.
-- =============================================================================

-- The watch list's baseline: over the four weeks before p_as_of, a cashier
-- whose sales are voided, or discounted near the limit, far more often than
-- everyone else's, or whose drawers come up short again and again. No time
-- is given to someone new (the real feature must).
create or replace function sim.naive_watch(p_as_of date)
returns table (who text, kind text, detail text)
language sql stable as $$
  with w as (
    select u.full_name as who, o.status, o.discount_percent,
           exists (select 1 from sales_tender t where t.sales_order_id = o.id and t.tender_type = 'cash') as cash
      from sales_order o join app_user u on u.id = o.cashier_id
     where o.business_id = sim.business()
       and o.placed_at >= (p_as_of - 28)::timestamp at time zone 'Asia/Baghdad'
       and o.placed_at < p_as_of::timestamp at time zone 'Asia/Baghdad'
  ), per as (
    select who, count(*) as n,
           count(*) filter (where status = 'voided') as voids,
           count(*) filter (where discount_percent >= 8 and discount_percent < 10) as near
      from w group by who
  ), all_ as (select sum(n) as n, sum(voids) as voids, sum(near) as near from per)
  select p.who, 'voids', p.voids || ' of ' || p.n || ' voided'
    from per p, all_ a
   where p.voids >= 8 and p.voids::numeric / p.n > 3 * (a.voids - p.voids)::numeric / nullif(a.n - p.n, 0)
  union all
  select p.who, 'discounts', p.near || ' of ' || p.n || ' discounted 8–10%'
    from per p, all_ a
   where p.near >= 10 and p.near::numeric / p.n > 4 * greatest((a.near - p.near)::numeric / nullif(a.n - p.n, 0), 0.001)
  union all
  select u.full_name, 'drawer_short', count(*) || ' drawers short, ' || -sum(s.variance)
    from work_shift s join app_user u on u.id = s.cashier_id
   where s.business_id = sim.business() and s.kind = 'session' and s.variance <= -10000
     and s.closed_at >= (p_as_of - 28)::timestamp at time zone 'Asia/Baghdad'
     and s.closed_at < p_as_of::timestamp at time zone 'Asia/Baghdad'
   group by u.full_name having count(*) >= 2
$$;

-- The money the café holds (till, safe, bank, card money on its way) at the
-- end of a day.
create or replace function sim.cash_on(p_day date) returns numeric
language sql stable as $$
  select sum(coalesce(gl_balance_at(sim.business(), code,
               ((p_day + 1)::timestamp at time zone 'Asia/Baghdad') - interval '1 microsecond'), 0))
    from unnest(array['1000', '1005', '1010', '1020']) code
$$;

-- What the café paid out between two days (after the first, to the end of the
-- second) under words its books had not seen twice before the first: what no
-- forecast from its own records could foresee (a machine; the second of a
-- quarterly rent, whose rhythm one payment does not tell).
create or replace function sim.first_payments(p_from date, p_to date) returns numeric
language sql stable as $$
  select coalesce(sum(l.debit - l.credit), 0)
    from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
   where e.business_id = sim.business() and e.status = 'published' and a.code in ('1000', '1005', '1010', '1020')
     and e.reference_type in ('manual', 'expense')
     and e.occurred_at >= ((p_from + 1)::timestamp at time zone 'Asia/Baghdad')
     and e.occurred_at < ((p_to + 1)::timestamp at time zone 'Asia/Baghdad')
     and (select count(*) from journal_entry o
           where o.business_id = e.business_id and o.status = 'published' and o.description = e.description
             and o.occurred_at < ((p_from + 1)::timestamp at time zone 'Asia/Baghdad')) < 2
$$;

-- The cash forecast's two baselines, p_days ahead of p_as_of: nothing
-- changes; or the last four weeks' average day goes on.
create or replace function sim.naive_cash(p_as_of date, p_days int)
returns numeric language sql stable as $$ select sim.cash_on(p_as_of) $$;
create or replace function sim.naive_cash_trend(p_as_of date, p_days int)
returns numeric language sql stable as $$
  select sim.cash_on(p_as_of) + (sim.cash_on(p_as_of) - sim.cash_on(p_as_of - 28)) / 28 * p_days
$$;

-- What the bank holds at the end of a day.
create or replace function sim.bank_on(p_day date) returns numeric
language sql stable as $$
  select coalesce(gl_balance_at(sim.business(), '1020',
           ((p_day + 1)::timestamp at time zone 'Asia/Baghdad') - interval '1 microsecond'), 0)
$$;

-- The shortfall warning's baseline: the bank's last four weeks' average day
-- goes on; the days of the next fortnight when that leaves it below nothing.
create or replace function sim.naive_short(p_as_of date)
returns table (day date) language sql stable as $$
  with t as (select sim.bank_on(p_as_of) as now, (sim.bank_on(p_as_of) - sim.bank_on(p_as_of - 28)) / 28 as per_day)
  select p_as_of + k from t, generate_series(1, 14) k where t.now + t.per_day * k < 0
$$;

-- ---------------------------------------------------------------- the features
-- Cash ahead (step 9, 0093), asked as at the end of p_as_of, scored as the
-- baselines are: the café's money p_days later; the days of the next fortnight
-- the bank or the safe would be below nothing. (plpgsql: loaded before 0093
-- is applied, they wait until called.)
create or replace function sim.ahead_cash(p_as_of date, p_days int) returns numeric
language plpgsql stable as $$
begin
  return (cash_ahead_for(sim.business(), ((p_as_of + 1)::timestamp at time zone 'Asia/Baghdad') - interval '1 microsecond',
                         p_days) -> 'days' -> (p_days - 1) ->> 'total')::numeric;
end $$;
create or replace function sim.ahead_short(p_as_of date) returns table (day date)
language plpgsql stable as $$
begin
  return query
    select (x ->> 'day')::date
      from jsonb_array_elements(cash_ahead_for(sim.business(),
             ((p_as_of + 1)::timestamp at time zone 'Asia/Baghdad') - interval '1 microsecond', 14) -> 'days') x
     where (x ->> 'bank')::numeric < 0 or (x ->> 'safe')::numeric < 0;
end $$;

-- The watch list (step 10, 0094), asked on the morning after p_as_of (its
-- four weeks to the end of p_as_of), scored as the baseline is.
create or replace function sim.watch_feature(p_as_of date) returns table (who text, kind text, detail text)
language plpgsql stable as $$
begin
  return query
    select s.who, s.kind, s.observed || ' against ' || s.expected
                          || case when s.detail_key <> '' then ' (' || s.detail_key || ')' else '' end
      from watch_scan(sim.business(), ((p_as_of + 1)::timestamp + time '06:00') at time zone 'Asia/Baghdad') s;
end $$;
