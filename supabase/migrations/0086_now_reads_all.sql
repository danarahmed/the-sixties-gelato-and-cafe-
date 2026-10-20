-- =============================================================================
-- 0086 — What the books hold now: every published entry, whatever its hour
-- =============================================================================
-- An expense, a payment or a bill dated a day is booked at that day's noon in
-- the café's own time. Read "as of now" between midnight and noon, the
-- morning's dated entries were still to come: on Reports → Balance sheet
-- ("Each branch, now") the safe and the bank were shown as they were before
-- the day's bills were paid out of them (found at 01:23, Erbil time: the safe
-- 347,000 IQD where it held 12,000). What is held now is every published
-- entry, so these read them all, as the safe's own check on a payment does:
--
--  * branch_position: the café's safe, bank, money to come in, and what it
--    owes suppliers and staff;
--  * pre_orders: the deposits the books hold (2300);
--  * customer_accounts: what customers owe in the books (1110).
--
-- Nothing recorded changes.
-- =============================================================================

-- 0085's, every published entry read.
create or replace function branch_position() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  v_loc uuid := report_place(v_business, null);
  v_today date := business_local_date(v_business, now());
  y record; v_places jsonb; v_cafe jsonb; v_profit jsonb;
begin
  y := local_day_bounds(v_business, date_trunc('year', v_today)::date, v_today);
  -- The year's profit at each place (and the café's, under ''), worked out once.
  select coalesce(jsonb_object_agg(coalesce(p.location_id::text, ''), p.amount), '{}'::jsonb) into v_profit
    from (select location_id, -sum(amount) as amount
            from pnl_by_place(v_business, y.from_ts, y.to_ts) group by location_id) p;
  with pl as (
    select l.id, l.name, l.kind, l.created_at from location l
     where l.business_id = v_business and l.is_active and (v_loc is null or l.id = v_loc)
  ),
  owed as (
    select ci.location_id, sum(p.left_amount) as amount
      from customer c
      cross join lateral customer_invoices_paid(c.id) p
      join customer_invoice ci on ci.id = p.invoice_id
     where c.business_id = v_business
     group by ci.location_id
  ),
  equipment as (
    select a.location_id, sum(a.cost - coalesce((select sum(d.amount) from asset_depreciation d
                                                  where d.asset_id = a.id), 0)) as amount
      from fixed_asset a where a.business_id = v_business and a.disposed_on is null
     group by a.location_id
  ),
  x as (
    select pl.*,
           coalesce((select d.amount from drawer_position_at(v_business, pl.id, now()) d where d.known), 0) as till,
           (select coalesce(sum(m.value * sign(m.base_quantity_signed)), 0) from inventory_movement m
             where m.business_id = v_business and m.location_id = pl.id) as stock,
           (select coalesce(sum(t.value_sent), 0) from stock_transfer t
             where t.business_id = v_business and t.from_location_id = pl.id and t.status = 'sent') as on_its_way,
           coalesce((select e.amount from equipment e where e.location_id = pl.id), 0) as equipment,
           coalesce((select o.amount from owed o where o.location_id = pl.id), 0) as customers_owe,
           (select coalesce(sum(po.deposit), 0) from pre_order po
             where po.business_id = v_business and po.location_id = pl.id and po.status = 'open') as deposits,
           coalesce((v_profit ->> pl.id::text)::numeric, 0) as profit_this_year,
           (select coalesce(sum(t.value_received + t.margin), 0) from stock_transfer t
             where t.business_id = v_business and t.from_location_id = pl.id and t.status = 'received'
               and t.received_at >= y.from_ts and t.received_at < y.to_ts) as sold_to_branches,
           (select coalesce(sum(t.value_received + t.margin), 0) from stock_transfer t
             where t.business_id = v_business and t.to_location_id = pl.id and t.status = 'received'
               and t.received_at >= y.from_ts and t.received_at < y.to_ts) as bought_from_branches
      from pl
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'name', x.name, 'kind', x.kind,
           'till', x.till, 'stock', x.stock, 'on_its_way', x.on_its_way, 'equipment', x.equipment,
           'customers_owe', x.customers_owe,
           'holds', x.till + x.stock + x.on_its_way + x.equipment + x.customers_owe,
           'deposits', x.deposits,
           'net', x.till + x.stock + x.on_its_way + x.equipment + x.customers_owe - x.deposits,
           'profit_this_year', x.profit_this_year,
           'sold_to_branches', x.sold_to_branches, 'bought_from_branches', x.bought_from_branches,
           'markup_percent', coalesce((rule_value(v_business, 'transfer_markup_percent', null, null, x.id)
                                       #>> '{}')::numeric, 0))
           order by (x.kind <> 'branch'), x.created_at, x.id), '[]'::jsonb)
    into v_places from x;

  -- What is the café's, no one branch's: read by those who see all of it.
  if v_loc is null then
    select jsonb_build_object(
             'safe', gl_balance_at(v_business, '1005', 'infinity') + gl_balance_at(v_business, '1006', 'infinity'),
             'bank', coalesce((select sum(gl_balance_at(v_business, a.code, 'infinity')) from gl_account a
                                where a.business_id = v_business
                                  and (a.code = '1020' or a.code ~ '^10[3-8][0-9]$')), 0),
             'to_come_in', gl_balance_at(v_business, '1010', 'infinity') + gl_balance_at(v_business, '1100', 'infinity'),
             'equipment', (select coalesce(sum(a.cost - coalesce((select sum(d.amount) from asset_depreciation d
                                                                   where d.asset_id = a.id), 0)), 0)
                             from fixed_asset a
                            where a.business_id = v_business and a.disposed_on is null and a.location_id is null),
             'customers_owe', (select coalesce(sum(p.left_amount), 0)
                                 from customer c
                                 cross join lateral customer_invoices_paid(c.id) p
                                 join customer_invoice ci on ci.id = p.invoice_id
                                where c.business_id = v_business and ci.location_id is null),
             'owed_to_suppliers', -(gl_balance_at(v_business, '2000', 'infinity') + gl_balance_at(v_business, '2050', 'infinity')),
             'owed_to_staff', -gl_balance_at(v_business, '2100', 'infinity'),
             'profit_this_year', coalesce((v_profit ->> '')::numeric, 0),
             'markup_percent', coalesce((rule_value(v_business, 'transfer_markup_percent') #>> '{}')::numeric, 0))
      into v_cafe;
  end if;
  return jsonb_build_object('places', v_places, 'cafe', v_cafe, 'year_from', date_trunc('year', v_today)::date);
end $$;

-- 0076's, every published entry read.
create or replace function pre_orders(p_location uuid default null, p_from date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid; v_held numeric;
begin
  -- The till reads them, and so does the kitchen that makes them.
  v_business := require_permission(case when current_has_permission('production.record')
                                        then 'production.record' else 'sale.create' end);
  select coalesce(sum(deposit), 0) into v_held from pre_order where business_id = v_business and status = 'open';
  return jsonb_build_object(
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'no', o.order_no, 'customer', o.customer_name, 'phone', o.customer_phone,
               'pickup_at', o.pickup_at, 'channel', o.channel, 'note', o.note, 'status', o.status,
               'total', o.total, 'deposit', o.deposit, 'deposit_tender', o.deposit_tender,
               'location', o.location_id, 'sale', o.sales_order_id, 'created_at', o.created_at,
               'lines', (select jsonb_agg(jsonb_build_object(
                                 'variant_id', l.product_variant_id, 'qty', l.qty, 'price', l.unit_price,
                                 'note', l.note, 'product', p.name, 'product_ar', p.name_ar,
                                 'product_ckb', p.name_ckb, 'size', pv.name) order by l.position)
                           from pre_order_line l join product_variant pv on pv.id = l.product_variant_id
                           join product p on p.id = pv.product_id where l.pre_order_id = o.id))
             order by o.pickup_at, o.order_no)
        from pre_order o
       where o.business_id = v_business
         and (p_location is null or o.location_id = p_location)
         and (o.status = 'open'
              or (p_from is not null and coalesce(o.collected_at, o.cancelled_at)
                    >= (local_day_bounds(v_business, p_from, p_from)).from_ts))), '[]'::jsonb),
    'held', v_held,
    'books', case when current_has_permission('profit.view')
                  then -gl_balance_at(v_business, '2300', 'infinity') end);
end $$;

-- 0077's, every published entry read.
create or replace function customer_accounts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('customer.view'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return jsonb_build_object(
    'customers', coalesce((
      select jsonb_agg(x order by (x ->> 'balance')::numeric desc, x ->> 'name')
        from (select jsonb_build_object(
                       'id', c.id, 'name', c.full_name, 'phone', c.phone, 'on_account', c.on_account,
                       'credit_limit', c.credit_limit, 'terms_days', c.terms_days,
                       'wholesale_percent', c.wholesale_percent, 'balance', customer_balance(c.id),
                       'overdue', coalesce(sum(p.left_amount) filter (where ci.due_on < v_today), 0),
                       'late_30', coalesce(sum(p.left_amount) filter (where v_today - ci.due_on between 1 and 30), 0),
                       'late_60', coalesce(sum(p.left_amount) filter (where v_today - ci.due_on between 31 and 60), 0),
                       'late_more', coalesce(sum(p.left_amount) filter (where v_today - ci.due_on > 60), 0)) as x
                from customer c
                left join lateral customer_invoices_paid(c.id) p on true
                left join customer_invoice ci on ci.id = p.invoice_id
               where c.business_id = v_business
                 and (c.on_account or exists (select 1 from customer_invoice i where i.customer_id = c.id))
               group by c.id) s), '[]'::jsonb),
    'books', case when current_has_permission('profit.view')
                  then gl_balance_at(v_business, '1110', 'infinity') end);
end $$;
-- As 0085 set it: no JIT for the branch panel.
alter function branch_position() set jit = off;
