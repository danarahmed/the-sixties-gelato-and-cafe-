-- =============================================================================
-- 0017_reporting.sql — every figure comes from the books.
--
-- The audit found the profit-and-loss was summed from four operational tables
-- and never read the general ledger (C-03); the "period" trial balance was a
-- lifetime total (M-01) that included unbalanced drafts (M-02); and nothing
-- compared the subledgers with their control accounts, so the books could not
-- be proven. These functions read PUBLISHED journal lines only, in the
-- business's own timezone (H-09), and put the reconciliation on the screen.
--
-- All are read-only, run with full visibility, and check the caller's
-- permission themselves.
-- =============================================================================

-- A date range in business-local days, as the timestamps that bound it.
create or replace function local_day_bounds(p_business uuid, p_from date, p_to date,
                                            out from_ts timestamptz, out to_ts timestamptz)
language sql stable as $$
  select (p_from::timestamp) at time zone b.timezone, ((p_to + 1)::timestamp) at time zone b.timezone
    from business b where b.id = p_business
$$;

-- Trial balance for a range: each account's opening balance, the period's
-- debits and credits, and the closing balance — so a period report says
-- exactly what it covers instead of passing a lifetime total off as a month.
create or replace function report_trial_balance(p_from date, p_to date)
returns table (code text, name text, account_type account_type, normal_balance normal_balance,
               opening numeric, debit numeric, credit numeric, closing numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record;
begin
  b := local_day_bounds(v_business, p_from, p_to);
  return query
    with moves as (
      select l.account_id,
             sum(case when e.occurred_at < b.from_ts then l.debit - l.credit else 0 end) as opening,
             sum(case when e.occurred_at >= b.from_ts then l.debit else 0 end) as debit,
             sum(case when e.occurred_at >= b.from_ts then l.credit else 0 end) as credit
        from journal_line l join journal_entry e on e.id = l.journal_entry_id
       where e.business_id = v_business and e.status = 'published' and e.occurred_at < b.to_ts
       group by l.account_id)
    select a.code, a.name, a.account_type, a.normal_balance,
           coalesce(m.opening, 0), coalesce(m.debit, 0), coalesce(m.credit, 0),
           coalesce(m.opening, 0) + coalesce(m.debit, 0) - coalesce(m.credit, 0)
      from gl_account a left join moves m on m.account_id = a.id
     where a.business_id = v_business
     order by a.code;
end $$;

-- Profit and loss for a range, straight from the ledger. `amount` is in the
-- natural direction: revenue positive when earned, expenses positive when
-- incurred; contra-revenue (discounts, refunds) therefore shows negative.
create or replace function report_profit_and_loss(p_from date, p_to date)
returns table (code text, name text, section text, amount numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('profit.view'); b record;
begin
  b := local_day_bounds(v_business, p_from, p_to);
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
                  and e.reference_type is distinct from 'year_end_close')
        on l.account_id = a.id
     where a.business_id = v_business and a.account_type in ('revenue', 'expense')
     group by a.code, a.name, a.account_type
     order by a.code;
end $$;

-- Each subledger against its control account, as at the end of a day. A
-- non-zero difference is something to investigate before the period closes.
create or replace function report_reconciliation(p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_end timestamptz;
begin
  v_end := (local_day_bounds(v_business, p_as_of, p_as_of)).to_ts;

  check_key := 'inventory'; label := 'Stock ledger vs Inventory (1200)';
  select coalesce(sum(value * sign(base_quantity_signed)), 0) into subledger
    from inventory_movement where business_id = v_business and occurred_at < v_end;
  ledger := gl_balance_at(v_business, '1200', v_end);
  difference := subledger - ledger; return next;

  check_key := 'payables'; label := 'Unpaid bills vs Accounts payable (2000)';
  select coalesce(sum(amount_total), 0) into subledger
    from purchase_invoice where business_id = v_business and invoice_date < p_as_of + 1
                            and (cancelled_at is null or cancelled_at >= v_end);
  subledger := subledger - coalesce((select sum(amount) from supplier_payment
                                      where business_id = v_business and paid_on < p_as_of + 1), 0);
  -- Receipts the old app posted straight to A/P are owed until their bill is recorded.
  subledger := subledger + coalesce((select sum(receipt_legacy_payable(r.id, v_end)) from goods_receipt r
                                      where r.business_id = v_business and r.received_at < v_end
                                        and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id
                                                          and p.invoice_date < p_as_of + 1
                                                          and (p.cancelled_at is null or p.cancelled_at >= v_end))), 0);
  ledger := -gl_balance_at(v_business, '2000', v_end);
  difference := subledger - ledger; return next;

  check_key := 'grni'; label := 'Unbilled receipts vs Goods received not invoiced (2050)';
  select coalesce(sum(receipt_grni_value(r.id)), 0) into subledger
    from goods_receipt r
   where r.business_id = v_business and r.received_at < v_end
     and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id and p.invoice_date < p_as_of + 1
                        and (p.cancelled_at is null or p.cancelled_at >= v_end));
  ledger := -gl_balance_at(v_business, '2050', v_end);
  difference := subledger - ledger; return next;

  check_key := 'sales'; label := 'Sales recorded vs net revenue in the ledger (4000 less 4200)';
  select coalesce(sum(net_amount), 0) into subledger
    from sales_order where business_id = v_business and status <> 'voided' and status <> 'open' and placed_at < v_end;
  subledger := subledger - coalesce((select sum(amount) from sale_adjustment
                                      where business_id = v_business and kind = 'refund' and created_at < v_end), 0);
  ledger := -(gl_balance_at(v_business, '4000', v_end) + gl_balance_at(v_business, '4200', v_end));
  difference := subledger - ledger; return next;
end $$;

-- Daily sales, one row per trading day and channel, in the business's own
-- timezone (H-09). Operational detail; reconciled to the ledger above.
create or replace function report_daily_sales(p_from date, p_to date)
returns table (day date, channel sales_channel, orders bigint, net numeric, cogs numeric, refunded numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  return query
    select business_local_date(v_business, o.placed_at) d, o.channel, count(*),
           coalesce(sum(o.net_amount), 0), coalesce(sum(o.cogs_amount), 0),
           coalesce(sum(case when o.status = 'refunded' then o.net_amount else 0 end), 0)
      from sales_order o
     where o.business_id = v_business and o.status not in ('voided', 'open')
       and business_local_date(v_business, o.placed_at) between p_from and p_to
     group by 1, 2 order by 1 desc, 2;
end $$;

-- What the till should hold for a day, before it is counted.
create or replace function report_day_totals(p_day date, p_location uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('day.close', 'cost.view'); v_location uuid; t record;
begin
  v_location := resolve_location(v_business, p_location);
  t := day_cash_totals(v_business, v_location, p_day);
  return jsonb_build_object(
    'day', p_day, 'orders', t.orders, 'cash_sales', t.cash_sales, 'cash_refunds', t.cash_refunds,
    'card', coalesce((select sum(tn.amount) from sales_order o join sales_tender tn on tn.sales_order_id = o.id
                       where o.business_id = v_business and o.location_id = v_location and tn.tender_type = 'card'
                         and o.status <> 'voided' and business_local_date(v_business, o.placed_at) = p_day), 0),
    'platform', coalesce((select sum(tn.amount) from sales_order o join sales_tender tn on tn.sales_order_id = o.id
                           where o.business_id = v_business and o.location_id = v_location and tn.tender_type = 'platform_paid'
                             and o.status <> 'voided' and business_local_date(v_business, o.placed_at) = p_day), 0),
    'closed', exists (select 1 from work_shift where business_id = v_business and location_id = v_location
                        and business_day = p_day and closed_at is not null));
end $$;

-- Trading days that sold and have not been closed, oldest first, however long
-- ago: the same test the period close applies, so every day that blocks a
-- lock can be found and closed.
create or replace function report_unclosed_days()
returns table (day date)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('day.close', 'cost.view');
begin
  return query
    select d from (
      select distinct business_local_date(v_business, o.placed_at) d from sales_order o
       where o.business_id = v_business and o.status <> 'voided'
      except
      select w.business_day from work_shift w
       where w.business_id = v_business and w.closed_at is not null and w.business_day is not null
    ) x order by d;
end $$;

-- The till's menu: what may be sold today, at today's prices. No costs — a
-- cashier needs a price, not a margin.
create or replace function pos_catalogue()
returns table (variant_id uuid, product_name text, variant_name text, category text, prices jsonb)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date; v_location uuid;
begin
  v_today := business_local_date(v_business, now());
  v_location := default_location(v_business);
  return query
    select pv.id, p.name, pv.name, pc.name,
           coalesce((select jsonb_object_agg(ch, price_on(pv.id, ch, v_location, v_today))
                       from unnest(enum_range(null::sales_channel)) ch
                      where price_on(pv.id, ch, v_location, v_today) is not null), '{}')
      from product_variant pv
      join product p on p.id = pv.product_id
      left join product_category pc on pc.id = p.category_id
     where pv.business_id = v_business and pv.is_active and p.is_active
     order by p.name, pv.name;
end $$;

-- Today at a glance, from the books. Managers only.
create or replace function dashboard_summary(p_day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('profit.view'); b record; v_rev numeric; v_cos numeric; v_orders bigint;
begin
  b := local_day_bounds(v_business, p_day, p_day);
  select coalesce(sum(case when a.account_type = 'revenue' then l.credit - l.debit end), 0),
         coalesce(sum(case when a.code like '5%' then l.debit - l.credit end), 0)
    into v_rev, v_cos
    from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id
   where e.business_id = v_business and e.status = 'published' and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts;
  select count(*) into v_orders from sales_order
   where business_id = v_business and status not in ('voided', 'open') and placed_at >= b.from_ts and placed_at < b.to_ts;
  return jsonb_build_object(
    'net_revenue', v_rev, 'cost_of_sales', v_cos, 'gross_profit', v_rev - v_cos, 'orders', v_orders,
    'average_order', case when v_orders > 0 then round(v_rev / v_orders) else 0 end,
    'inventory_value', gl_balance_at(v_business, '1200', b.to_ts),
    'low_stock', (select count(*) from stock_board where business_id = v_business and is_low),
    'negative_stock', (select count(*) from stock_board where business_id = v_business and is_negative));
end $$;

-- The menu as a manager sees it: today's price and today's cost of one serving
-- on every channel it is sold on, costed by exactly the functions a sale uses
-- (so the margin shown is the margin a sale will post). Recipes and prices in
-- force TODAY are used; a future-dated change does not apply yet (M-04).
create or replace function menu_costing()
returns table (variant_id uuid, product_id uuid, product_name text, variant_name text, category text,
               channel sales_channel, price numeric, unit_cost numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_today date; v_location uuid; r record; ch sales_channel;
begin
  v_today := business_local_date(v_business, now());
  v_location := default_location(v_business);
  for r in select pv.id as vid, p.id as pid, p.name as pname, pv.name as vname, pc.name as cname
             from product_variant pv
             join product p on p.id = pv.product_id
             left join product_category pc on pc.id = p.category_id
            where pv.business_id = v_business and pv.is_active and p.is_active
            order by p.name, pv.name loop
    foreach ch in array enum_range(null::sales_channel) loop
      price := price_on(r.vid, ch, v_location, v_today);
      continue when price is null;
      variant_id := r.vid; product_id := r.pid; product_name := r.pname; variant_name := r.vname;
      category := r.cname; channel := ch;
      begin
        select coalesce(sum(money_round(v_business, item_issue_cost(v_business, e.item_id, v_location) * e.base_qty)), 0)
          into unit_cost
          from expand_variant(r.vid, ch, 1, v_today) e;
      exception when others then
        unit_cost := null;   -- e.g. no recipe version in force today: unknown, never shown as free
      end;
      return next;
    end loop;
  end loop;
end $$;

-- The recipe in force today for every product, line by line.
create or replace function menu_recipe_lines()
returns table (variant_id uuid, version_no int, effective_from date, component text,
               quantity numeric, unit_code text, channels sales_channel[])
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    select vr.product_variant_id, rv.version_no, rv.effective_from,
           coalesce(i.name, sr.name, '—'), rl.quantity, rl.unit_code, rl.applies_to_channels
      from variant_recipe vr
      join product_variant pv on pv.id = vr.product_variant_id and pv.business_id = v_business
      join recipe_version rv on rv.id = recipe_version_on(vr.recipe_id, v_today)
      join recipe_line rl on rl.recipe_version_id = rv.id
      left join item i on i.id = rl.item_id
      left join recipe sr on sr.id = rl.sub_recipe_id
     order by vr.product_variant_id, coalesce(i.name, sr.name);
end $$;

-- 0016 reversed the defaults, so the functions above start closed; open only
-- the reports. (local_day_bounds stays internal.)
grant execute on function
  report_trial_balance(date, date), report_profit_and_loss(date, date), report_reconciliation(date),
  report_daily_sales(date, date), report_day_totals(date, uuid), report_unclosed_days(),
  pos_catalogue(), dashboard_summary(date),
  menu_costing(), menu_recipe_lines()
to authenticated;
