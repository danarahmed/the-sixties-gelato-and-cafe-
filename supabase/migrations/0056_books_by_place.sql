-- =============================================================================
-- 0056 — The books by place (release AB, third part)
--
-- 0055 put a till at each branch and each person at their place; the books
-- still added the café up as one (docs/COMPLETION_PLAN.md, B12, D6 and
-- release AB). Now:
--   * each line of the profit and loss is at the place its record is at: a
--     sale, its void and its refund at the branch that sold it; a delivery's
--     price difference where it came in; a loss or a count where the stock
--     was; a drawer's difference at its branch; an expense where it was
--     recorded. What did not arrive of a transfer is the loss of the place
--     that sent it;
--   * a platform's payout is shared out by the branch of each order it paid,
--     and a payroll by where each person it paid works;
--   * what belongs to no place (the bank's card fees, a journal by hand) is the
--     café's, apart;
--   * the profit and loss is read for the café, for one place, or for each
--     side by side, and someone who works at one place reads theirs;
--   * a year-end close that was reversed is left out of the profit and loss
--     with the close itself: before, it counted the year a second time.
-- Nothing is written to the journals: each line's place is read from its
-- record, which never moves once posted.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. A payroll by place
-- ---------------------------------------------------------------------------
-- Each place's share of a payroll's gross, as the people it paid worked there
-- when it was approved: {place: gross}. A payroll reopened and drafted again
-- keeps each approval's own.
alter table payroll_approval add column if not exists gross_by_place jsonb;

create or replace function payroll_gross_by_place(p_run uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(x.location_id::text, x.gross), '{}'::jsonb)
    from (select e.location_id, sum(pl.gross) as gross
            from payroll_line pl join employee e on e.id = pl.employee_id
           where pl.run_id = p_run
           group by e.location_id having sum(pl.gross) <> 0) x
$$;

-- Taken as it is approved, from the lines its journal adds up.
create or replace function trg_payroll_approval_places() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.gross_by_place := payroll_gross_by_place(new.run_id);
  return new;
end $$;
drop trigger if exists payroll_approval_places on payroll_approval;
create trigger payroll_approval_places before insert on payroll_approval
  for each row execute function trg_payroll_approval_places();

-- Those approved before: from their lines as they are now. An approval is
-- never changed, so its guard stands aside for this one fill.
alter table payroll_approval disable trigger payroll_approval_guard;
update payroll_approval set gross_by_place = payroll_gross_by_place(run_id) where gross_by_place is null;
alter table payroll_approval enable trigger payroll_approval_guard;

-- ---------------------------------------------------------------------------
-- 2. What an entry stands for
-- ---------------------------------------------------------------------------
-- The entry a reversal reverses, followed to the first that is not one: a
-- reversal is at the place of what it reverses. Any other entry is itself.
create or replace function journal_origin(e journal_entry) returns journal_entry
language plpgsql stable security definer set search_path = public as $$
declare o journal_entry := e; p journal_entry; n int := 0;
begin
  while o.reverses_entry is not null and n < 10 loop
    select * into p from journal_entry where id = o.reverses_entry;
    exit when not found;
    o := p;
    n := n + 1;
  end loop;
  return o;
end $$;

-- A year-end close, or the reversal of one: neither is in a profit and loss.
create or replace function year_end_entry(e journal_entry) returns boolean
language sql stable set search_path = public as $$
  select coalesce(e.reference_type = 'year_end_close', false)
      or (e.reverses_entry is not null and coalesce((journal_origin(e)).reference_type = 'year_end_close', false))
$$;

-- ---------------------------------------------------------------------------
-- 3. Each line of the profit and loss at its place
-- ---------------------------------------------------------------------------
-- Every published line on a revenue or expense account in the time, at the
-- place of the record it was posted for (none: the café's), added up by
-- account and place: debit less credit. A platform's payout and a payroll are
-- shared out; what a share leaves of its line (nothing, but for a record
-- changed by hand) is the café's, so the places always add up to the café.
create or replace function pnl_by_place(p_business uuid, p_from timestamptz, p_to timestamptz)
returns table (account_id uuid, location_id uuid, amount numeric)
language sql stable security definer set search_path = public as $$
  with ent as (
    select e.id, e.reverses_entry is not null as reversing, o.reference_type as ref_type, o.reference_id as ref_id
      from journal_entry e
      cross join lateral (select (case when e.reverses_entry is null then e else journal_origin(e) end).*) o
     where e.business_id = p_business and e.status = 'published'
       and e.occurred_at >= p_from and e.occurred_at < p_to
       and coalesce(o.reference_type, '') <> 'year_end_close'
  ),
  placed as (
    select ent.*,
           case ent.ref_type
             when 'sales_order' then (select s.location_id from sales_order s where s.id = ent.ref_id)
             when 'sale_refund' then (select s.location_id from sale_adjustment sa
                                        join sales_order s on s.id = sa.sales_order_id where sa.id = ent.ref_id)
             when 'goods_receipt' then (select g.location_id from goods_receipt g where g.id = ent.ref_id)
             when 'receipt_correction' then (select g.location_id from receipt_correction c
                                               join goods_receipt g on g.id = c.goods_receipt_id where c.id = ent.ref_id)
             when 'purchase_invoice' then (select g.location_id from purchase_invoice pi
                                             join goods_receipt g on g.id = pi.goods_receipt_id where pi.id = ent.ref_id)
             when 'supplier_credit' then (select coalesce(g1.location_id, g2.location_id) from supplier_credit sc
                                            left join goods_receipt g1 on g1.id = sc.goods_receipt_id
                                            left join purchase_invoice pi on pi.id = sc.purchase_invoice_id
                                            left join goods_receipt g2 on g2.id = pi.goods_receipt_id
                                           where sc.id = ent.ref_id)
             when 'supplier_return' then (select r.location_id from supplier_return r where r.id = ent.ref_id)
             when 'inventory_movement' then (select m.location_id from inventory_movement m where m.id = ent.ref_id)
             when 'stock_count' then (select c.location_id from stock_count c where c.id = ent.ref_id)
             when 'stock_loss' then (select sl.location_id from stock_loss sl where sl.id = ent.ref_id)
             -- What did not arrive is the loss of the place that sent it.
             when 'stock_transfer' then (select t.from_location_id from stock_transfer t where t.id = ent.ref_id)
             when 'stock_transfer_receipt' then (select t.from_location_id from stock_transfer t where t.id = ent.ref_id)
             when 'stock_transfer_cancel' then (select t.from_location_id from stock_transfer t where t.id = ent.ref_id)
             when 'work_shift' then (select w.location_id from work_shift w where w.id = ent.ref_id)
             when 'session_opening' then (select w.location_id from work_shift w where w.id = ent.ref_id)
             when 'session_dollars' then (select w.location_id from work_shift w where w.id = ent.ref_id)
             when 'fx_exchange' then (select x.location_id from fx_exchange x where x.id = ent.ref_id)
             when 'expense' then (select x.location_id from expense x where x.id = ent.ref_id)
           end as location_id
      from ent
  ),
  lines as (
    select l.id as line_id, l.account_id, a.code, l.debit - l.credit as amount, p.reversing, p.ref_type, p.ref_id,
           p.location_id
      from placed p
      join journal_line l on l.journal_entry_id = p.id
      join gl_account a on a.id = l.account_id and a.account_type in ('revenue', 'expense')
  ),
  parts as (
    -- A line at one place.
    select ln.line_id, ln.account_id, ln.location_id, ln.amount
      from lines ln
     where ln.ref_type is null or ln.ref_type not in ('platform_settlement', 'payroll_approval')
    union all
    -- A platform's payout: each order it paid at its sale's branch, as the
    -- statement's journal added them up (0030).
    select ln.line_id, ln.account_id, s.location_id,
           (case when ln.reversing then -1 else 1 end)
           * sum(case ln.code when '5100' then psl.reported_commission
                              else psl.expected - psl.reported_payout - psl.reported_commission end)
      from lines ln
      join platform_settlement_line psl on psl.settlement_id = ln.ref_id and psl.status = 'matched'
      join sales_order s on s.id = psl.sales_order_id
     where ln.ref_type = 'platform_settlement' and ln.code in ('5100', '5200')
     group by ln.line_id, ln.account_id, s.location_id, ln.reversing
    union all
    -- A payroll: each person's gross where they worked when it was approved.
    select ln.line_id, ln.account_id, x.key::uuid, (case when ln.reversing then -1 else 1 end) * x.value::numeric
      from lines ln
      join payroll_approval pa on pa.id = ln.ref_id
      cross join lateral jsonb_each_text(coalesce(pa.gross_by_place, '{}'::jsonb)) x
     where ln.ref_type = 'payroll_approval' and ln.code = '6100'
  ),
  rest as (
    select ln.line_id, ln.account_id, null::uuid as location_id,
           ln.amount - coalesce((select sum(p.amount) from parts p where p.line_id = ln.line_id), 0) as amount
      from lines ln
     where ln.ref_type in ('platform_settlement', 'payroll_approval')
  )
  select x.account_id, x.location_id, sum(x.amount)
    from (select p.account_id, p.location_id, p.amount from parts p
          union all
          select r.account_id, r.location_id, r.amount from rest r) x
   group by x.account_id, x.location_id
  having sum(x.amount) <> 0
$$;

-- ---------------------------------------------------------------------------
-- 4. The place a report is read for
-- ---------------------------------------------------------------------------
-- One of the café's places, or none for all of them. Someone who works at one
-- place reads theirs, and no other.
create or replace function report_place(p_business uuid, p_location uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_mine uuid := current_work_place();
begin
  if p_location is not null and not exists (select 1 from location where id = p_location and business_id = p_business) then
    raise exception 'Choose one of the café''s places';
  end if;
  if v_mine is not null then
    if p_location is not null and p_location <> v_mine then
      raise exception 'You work at %, not at %', (select name from location where id = v_mine),
        (select name from location where id = p_location) using errcode = '42501';
    end if;
    return v_mine;
  end if;
  return p_location;
end $$;

-- ---------------------------------------------------------------------------
-- 5. The profit and loss, for the café or a place
-- ---------------------------------------------------------------------------
-- 0017's profit and loss, for the café (no place named) or one place, the
-- year-end close and its reversal left out. `amount` is in the natural
-- direction: revenue positive when earned, expenses positive when incurred.
drop function if exists report_profit_and_loss(date, date);
create or replace function report_profit_and_loss(p_from date, p_to date, p_location uuid default null)
returns table (code text, name text, section text, amount numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('profit.view'); b record; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  b := local_day_bounds(v_business, p_from, p_to);
  if v_loc is null then
    return query
      select a.code, a.name,
             case when a.account_type = 'revenue' then 'revenue'
                  when a.code like '5%' then 'cost_of_sales'
                  else 'operating_expenses' end,
             case when a.account_type = 'revenue' then coalesce(sum(l.credit - l.debit), 0)
                  else coalesce(sum(l.debit - l.credit), 0) end
        from gl_account a
        left join (journal_line l join journal_entry e on e.id = l.journal_entry_id
                    and e.status = 'published' and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts
                    and not year_end_entry(e))
          on l.account_id = a.id
       where a.business_id = v_business and a.account_type in ('revenue', 'expense')
       group by a.code, a.name, a.account_type
       order by a.code;
  else
    return query
      with x as (select * from pnl_by_place(v_business, b.from_ts, b.to_ts) p where p.location_id = v_loc)
      select a.code, a.name,
             case when a.account_type = 'revenue' then 'revenue'
                  when a.code like '5%' then 'cost_of_sales'
                  else 'operating_expenses' end,
             case when a.account_type = 'revenue' then -coalesce(sum(x.amount), 0)
                  else coalesce(sum(x.amount), 0) end
        from gl_account a
        left join x on x.account_id = a.id
       where a.business_id = v_business and a.account_type in ('revenue', 'expense')
       group by a.code, a.name, a.account_type
       order by a.code;
  end if;
end $$;

-- (profit.view) Each account at each place, side by side: a row for each
-- account and place that has an amount, none for the café's that are no
-- place's. Someone who works at one place reads theirs.
create or replace function report_profit_and_loss_by_place(p_from date, p_to date)
returns table (code text, name text, section text, location_id uuid, location text, amount numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('profit.view'); b record; v_loc uuid;
begin
  v_loc := report_place(v_business, null);
  b := local_day_bounds(v_business, p_from, p_to);
  return query
    select a.code, a.name,
           case when a.account_type = 'revenue' then 'revenue'
                when a.code like '5%' then 'cost_of_sales'
                else 'operating_expenses' end,
           x.location_id, l.name,
           case when a.account_type = 'revenue' then -x.amount else x.amount end
      from pnl_by_place(v_business, b.from_ts, b.to_ts) x
      join gl_account a on a.id = x.account_id
      left join location l on l.id = x.location_id
     where v_loc is null or x.location_id = v_loc
     order by a.code, l.created_at nulls last;
end $$;

-- ---------------------------------------------------------------------------
-- 6. A reversed year-end close is left out with the close
-- ---------------------------------------------------------------------------
-- 0054's dashboard.
create or replace function dashboard_summary(p_day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('profit.view'); b record; v_rev numeric; v_cos numeric; v_orders bigint;
begin
  b := local_day_bounds(v_business, p_day, p_day);
  select coalesce(sum(case when a.account_type = 'revenue' then l.credit - l.debit end), 0),
         coalesce(sum(case when a.code like '5%' then l.debit - l.credit end), 0)
    into v_rev, v_cos
    from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id
   where e.business_id = v_business and e.status = 'published' and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts
     and not year_end_entry(e);
  select count(*) into v_orders from sales_order
   where business_id = v_business and status not in ('voided', 'open') and placed_at >= b.from_ts and placed_at < b.to_ts;
  return jsonb_build_object(
    'net_revenue', v_rev, 'cost_of_sales', v_cos, 'gross_profit', v_rev - v_cos, 'orders', v_orders,
    'average_order', case when v_orders > 0 then round(v_rev / v_orders) else 0 end,
    'inventory_value', gl_balance_at(v_business, '1200', b.to_ts),
    'low_stock', (select count(*) from (
                    select s.item_id from stock_board s where s.business_id = v_business
                     group by s.item_id having sum(s.quantity_base) < coalesce(max(s.min_level_base), 0)) x),
    'negative_stock', (select count(distinct s.item_id) from stock_board s
                        where s.business_id = v_business and s.is_negative));
end $$;

-- 0029's daily brief (0036 kept it as daily_brief_0029 and adds the drawers).
create or replace function daily_brief_0029(p_day date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  b record; v_rev numeric; v_cos numeric; v_cogs numeric; v_waste numeric; v_counts record; v_sales record;
  v_voids record; v_refunds record; v_disc record; v_lastweek numeric; v_avg numeric;
  v_alerts jsonb; v_recs jsonb; v_uncosted bigint;
begin
  if p_day is null or p_day > business_local_date(v_business, now()) then
    raise exception 'Choose a day that has happened';
  end if;
  perform refresh_alerts(v_business);
  b := local_day_bounds(v_business, p_day, p_day);
  select coalesce(sum(case when g.account_type = 'revenue' then l.credit - l.debit end), 0),
         coalesce(sum(case when g.code like '5%' then l.debit - l.credit end), 0),
         coalesce(sum(case when g.code = '5000' then l.debit - l.credit end), 0),
         coalesce(sum(case when g.code = '5300' then l.debit - l.credit end), 0)
    into v_rev, v_cos, v_cogs, v_waste
    from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
   where e.business_id = v_business and e.status = 'published' and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts
     and not year_end_entry(e);
  select count(*) as n into v_sales
    from sales_order o
   where o.business_id = v_business and o.status not in ('voided', 'open')
     and o.placed_at >= b.from_ts and o.placed_at < b.to_ts;
  select count(*) as n, coalesce(sum(sa.amount), 0) as amount into v_voids
    from sale_adjustment sa where sa.business_id = v_business and sa.kind = 'void'
     and sa.created_at >= b.from_ts and sa.created_at < b.to_ts;
  select count(*) as n, coalesce(sum(sa.amount), 0) as amount into v_refunds
    from sale_adjustment sa where sa.business_id = v_business and sa.kind = 'refund'
     and sa.created_at >= b.from_ts and sa.created_at < b.to_ts;
  select count(*) as n, coalesce(sum(o.discount_amount), 0) as amount into v_disc
    from sales_order o
   where o.business_id = v_business and o.discount_amount > 0 and o.status not in ('voided', 'open')
     and o.placed_at >= b.from_ts and o.placed_at < b.to_ts;
  select count(*) as n, coalesce(sum(w.variance), 0) as variance into v_counts
    from work_shift w where w.business_id = v_business and w.kind = 'drawer'
     and w.closed_at >= b.from_ts and w.closed_at < b.to_ts;
  select count(*) into v_uncosted from uncosted_sales(v_business, p_day, p_day);

  -- The same weekday last week, and the average of the four before that had sales.
  select coalesce(sum(case when g.account_type = 'revenue' then l.credit - l.debit end), 0) into v_lastweek
    from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id,
         local_day_bounds(v_business, p_day - 7, p_day - 7) lw
   where e.business_id = v_business and e.status = 'published' and e.occurred_at >= lw.from_ts and e.occurred_at < lw.to_ts
     and not year_end_entry(e);
  select avg(x.rev) into v_avg from (
    select d, (select coalesce(sum(case when g.account_type = 'revenue' then l.credit - l.debit end), 0)
                 from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id,
                      local_day_bounds(v_business, d, d) db
                where e.business_id = v_business and e.status = 'published'
                  and e.occurred_at >= db.from_ts and e.occurred_at < db.to_ts
                  and not year_end_entry(e)) as rev
      from unnest(array[p_day - 7, p_day - 14, p_day - 21, p_day - 28]) d
     where exists (select 1 from sales_order o, local_day_bounds(v_business, d, d) db2
                    where o.business_id = v_business and o.placed_at >= db2.from_ts and o.placed_at < db2.to_ts)) x;

  select coalesce(jsonb_agg(jsonb_build_object('urgency', a.urgency, 'title', a.title, 'action', a.action,
                                               'link', a.link, 'acknowledged', a.acknowledged_at is not null)
                            order by (a.urgency = 'red') desc, a.first_seen_at, a.title), '[]'::jsonb)
    into v_alerts
    from alert a
   where a.business_id = v_business and a.resolved_at is null and (a.snoozed_until is null or a.snoozed_until <= now());
  select coalesce(jsonb_agg(x.action order by x.action), '[]'::jsonb) into v_recs
    from (select distinct a.action from alert a
           where a.business_id = v_business and a.resolved_at is null and a.acknowledged_at is null
             and (a.snoozed_until is null or a.snoozed_until <= now()) and a.urgency = 'red') x;

  return jsonb_build_object(
    'day', p_day,
    'facts', jsonb_build_object(
      'sales', v_sales.n, 'net_sales', v_rev, 'voids', v_voids.n, 'voided', v_voids.amount,
      'refunds', v_refunds.n, 'refunded', v_refunds.amount, 'discounts', v_disc.n, 'discounted', v_disc.amount,
      'waste', v_waste, 'drawer_counts', v_counts.n, 'drawer_difference', v_counts.variance,
      'uncosted_sales', v_uncosted),
    'calculations', jsonb_build_object(
      'cost_of_goods', v_cogs,
      'cost_of_goods_percent', case when v_rev > 0 then round(v_cogs / v_rev * 100, 1) end,
      'gross_profit', v_rev - v_cos,
      'gross_margin_percent', case when v_rev > 0 then round((v_rev - v_cos) / v_rev * 100, 1) end,
      'same_day_last_week', v_lastweek,
      'change_from_last_week_percent', case when v_lastweek > 0 then round((v_rev - v_lastweek) / v_lastweek * 100, 1) end,
      'usual_for_the_weekday', round(v_avg)),
    'alerts', v_alerts,
    'red', (select count(*) from jsonb_array_elements(v_alerts) x where x ->> 'urgency' = 'red'),
    'orange', (select count(*) from jsonb_array_elements(v_alerts) x where x ->> 'urgency' = 'orange'),
    'recommendations', v_recs);
end $$;

-- 0026's journal lines: the P&L's leave out the year-end close and its reversal.
create or replace function report_journal_lines(p_from date, p_to date, p_accounts text[] default null,
                                                p_exclude_year_end boolean default false)
returns table (journal_entry_id uuid, journal_no int, occurred_at timestamptz, day date, description text,
               reference_type text, reference_no text, account_code text, account_name text, memo text,
               debit numeric, credit numeric, posted_by text, reverses_journal_no int)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record;
begin
  b := local_day_bounds(v_business, p_from, p_to);
  return query
    select e.id, e.journal_no, e.occurred_at, business_local_date(v_business, e.occurred_at), e.description,
           e.reference_type, e.reference_no, a.code, a.name, l.memo, l.debit, l.credit, au.full_name, r.journal_no
      from journal_entry e
      join journal_line l on l.journal_entry_id = e.id
      join gl_account a on a.id = l.account_id
      left join app_user au on au.id = e.posted_by
      left join journal_entry r on r.id = e.reverses_entry
     where e.business_id = v_business and e.status = 'published'
       and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts
       and (p_accounts is null or a.code = any (p_accounts))
       and (not p_exclude_year_end or not year_end_entry(e))
     order by e.occurred_at, e.journal_no, l.id;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Who may call what
-- ---------------------------------------------------------------------------
-- The places are read inside the reports, never called by hand.
revoke execute on function
  payroll_gross_by_place(uuid), trg_payroll_approval_places(), journal_origin(journal_entry),
  year_end_entry(journal_entry), pnl_by_place(uuid, timestamptz, timestamptz), report_place(uuid, uuid)
  from public, anon, authenticated;
-- The two reports, open to signed-in people; each checks profit.view.
revoke execute on function report_profit_and_loss(date, date, uuid), report_profit_and_loss_by_place(date, date)
  from public, anon;
grant execute on function report_profit_and_loss(date, date, uuid), report_profit_and_loss_by_place(date, date)
  to authenticated;
