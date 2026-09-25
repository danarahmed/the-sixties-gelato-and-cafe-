-- =============================================================================
-- 0026 — Reports that agree, and numbers that open
-- =============================================================================
-- The September 2026 audit's P1-2 (docs/SYSTEM_AUDIT_2026-09.md):
--
--  * Sales by channel counted refunded sales in its net sales. A refund is now
--    reported on the day it is made, against the channel of the sale it
--    refunds, with the cost of anything that went back on the shelf: the basis
--    of the ledger (4200) and of the reconciliation, so the report and the P&L
--    agree for any dates.
--  * The dashboard counted a year-end close posted that day as trading; the
--    P&L never has. Now neither does.
--  * Every figure opens. The journal lines behind any account and dates (for
--    the trial balance, the P&L and the reconciliation), all of them as CSV,
--    and a stock card for each item: what it opened with, what was received,
--    sold, used in batches, made, wasted, counted and corrected, and what it
--    closed with, each movement listed with the balance after it.
--
-- (A count under review valued at today's cost was put right in 0024.)
-- Nothing recorded changes: these are reports.

-- =============================================================================
-- 1. Sales by day and channel, refunds on the day they are made
-- =============================================================================
drop function if exists report_daily_sales(date, date);
create or replace function report_daily_sales(p_from date, p_to date)
returns table (day date, channel sales_channel, orders bigint, net numeric, cogs numeric,
               refunds numeric, returned_cost numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record;
begin
  b := local_day_bounds(v_business, p_from, p_to);
  return query
    with s as (
      select business_local_date(v_business, o.placed_at) as d, o.channel as ch, count(*) as n,
             sum(o.net_amount) as net, sum(o.cogs_amount) as cogs
        from sales_order o
       where o.business_id = v_business and o.status not in ('voided', 'open')
         and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
       group by 1, 2
    ),
    r as (
      select business_local_date(v_business, a.created_at) as d, o.channel as ch, sum(a.amount) as refunds,
             sum(coalesce((select sum(m.value) from inventory_movement m
                            where m.reference_type = 'sale_refund' and m.reference_id = a.id
                              and m.type = 'refund_return_to_stock'), 0)) as returned
        from sale_adjustment a join sales_order o on o.id = a.sales_order_id
       where a.business_id = v_business and a.kind = 'refund'
         and a.created_at >= b.from_ts and a.created_at < b.to_ts
       group by 1, 2
    )
    select coalesce(s.d, r.d), coalesce(s.ch, r.ch), coalesce(s.n, 0), coalesce(s.net, 0), coalesce(s.cogs, 0),
           coalesce(r.refunds, 0), coalesce(r.returned, 0)
      from s full join r on r.d = s.d and r.ch = s.ch
     order by 1 desc, 2;
end $$;

-- =============================================================================
-- 2. The dashboard, without the year-end close
-- =============================================================================
-- 0017's summary; the close is not trading, exactly as the P&L has it.
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
     and e.reference_type is distinct from 'year_end_close';
  select count(*) into v_orders from sales_order
   where business_id = v_business and status not in ('voided', 'open') and placed_at >= b.from_ts and placed_at < b.to_ts;
  return jsonb_build_object(
    'net_revenue', v_rev, 'cost_of_sales', v_cos, 'gross_profit', v_rev - v_cos, 'orders', v_orders,
    'average_order', case when v_orders > 0 then round(v_rev / v_orders) else 0 end,
    'inventory_value', gl_balance_at(v_business, '1200', b.to_ts),
    'low_stock', (select count(*) from stock_board where business_id = v_business and is_low),
    'negative_stock', (select count(*) from stock_board where business_id = v_business and is_negative));
end $$;

-- =============================================================================
-- 3. The journal lines behind a figure
-- =============================================================================
-- Every published line in the dates, or those of some accounts: the trial
-- balance's and the reconciliation's lines as they are, the P&L's without the
-- year-end close. In a stable order, so a long list can be read in pages.
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
       and (not p_exclude_year_end or e.reference_type is distinct from 'year_end_close')
     order by e.occurred_at, e.journal_no, l.id;
end $$;

-- =============================================================================
-- 4. The stock card
-- =============================================================================
-- What each movement is, on a stock card. A void puts back what the sale took,
-- and a cancelled batch what it used or made, so each nets in its own line.
create or replace function stock_card_kind(p_type movement_type, p_reference text, p_qty numeric) returns text
language sql immutable set search_path = public as $$
  select case
    when p_type = 'opening_balance' then 'opening_stock'
    when p_type in ('purchase_receipt', 'supplier_return') then 'received'
    when p_type in ('sale_consumption', 'refund_return_to_stock') then 'sold'
    when p_type = 'reversal' and p_reference in ('sale_void', 'sales_order') then 'sold'
    when p_type = 'production_consumption' then 'batches'
    when p_type = 'reversal' and p_reference = 'production_cancel' and p_qty > 0 then 'batches'
    when p_type = 'production_output' then 'made'
    when p_type = 'reversal' and p_reference = 'production_cancel' then 'made'
    when p_type in ('waste', 'spoilage', 'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling',
                    'damaged', 'expired') then 'wasted'
    when p_type = 'count_adjustment' then 'counted'
    when p_type in ('transfer_in', 'transfer_out') then 'transferred'
    else 'corrected'
  end
$$;

-- An item's movements in the dates, after its opening line (seq 0), each with
-- the quantity and value on hand after it. The last balance is what the stock
-- board shows at the end of the last day.
create or replace function stock_card(p_item uuid, p_from date, p_to date)
returns table (seq bigint, occurred_at timestamptz, day date, kind text, movement movement_type, qty numeric,
               value numeric, balance_qty numeric, balance_value numeric, reason text, reference_type text,
               by_name text, location text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record; v_qty numeric; v_value numeric;
begin
  if not exists (select 1 from item where id = p_item and business_id = v_business) then
    raise exception 'Item not found';
  end if;
  b := local_day_bounds(v_business, p_from, p_to);
  select coalesce(sum(m.base_quantity_signed), 0), coalesce(sum(coalesce(m.value, 0) * sign(m.base_quantity_signed)), 0)
    into v_qty, v_value
    from inventory_movement m
   where m.business_id = v_business and m.item_id = p_item and m.occurred_at < b.from_ts;
  seq := 0; occurred_at := b.from_ts; day := p_from; kind := 'opening'; movement := null;
  qty := v_qty; value := v_value; balance_qty := v_qty; balance_value := v_value;
  reason := null; reference_type := null; by_name := null; location := null;
  return next;
  return query
    select row_number() over w, m.occurred_at, business_local_date(v_business, m.occurred_at),
           stock_card_kind(m.type, m.reference_type, m.base_quantity_signed), m.type,
           m.base_quantity_signed, coalesce(m.value, 0) * sign(m.base_quantity_signed),
           v_qty + sum(m.base_quantity_signed) over w,
           v_value + sum(coalesce(m.value, 0) * sign(m.base_quantity_signed)) over w,
           m.reason, m.reference_type, au.full_name, loc.name
      from inventory_movement m
      left join app_user au on au.id = m.app_user_id
      left join location loc on loc.id = m.location_id
     where m.business_id = v_business and m.item_id = p_item
       and m.occurred_at >= b.from_ts and m.occurred_at < b.to_ts
    window w as (order by m.occurred_at, m.created_at, m.id rows between unbounded preceding and current row)
     order by m.occurred_at, m.created_at, m.id;
end $$;

-- =============================================================================
-- 5. Who may call what
-- =============================================================================
revoke execute on function stock_card_kind(movement_type, text, numeric) from public, anon, authenticated;

revoke execute on function
  report_daily_sales(date, date),
  report_journal_lines(date, date, text[], boolean),
  stock_card(uuid, date, date)
  from public, anon;
grant execute on function
  report_daily_sales(date, date),
  report_journal_lines(date, date, text[], boolean),
  stock_card(uuid, date, date)
to authenticated;
