-- =============================================================================
-- 0085 — Stock on hand kept as it moves (G2: speed under a rush)
-- =============================================================================
-- What a place holds of an item was added up from every movement it ever had
-- (item_position, current_stock), on every sale, twice for each item its
-- recipe uses. A café that has sold for a year has a hundred thousand
-- movements of its coffee: each sale grew slower, the dashboard and the stock
-- screens too. Measured on a copy: a sale took twice as long at 14,000
-- movements of an item as at 4,000.
--
--  * stock_balance: each item's quantity and value at each place, kept by the
--    movements themselves (a trigger, whatever records them): what the
--    movements add up to, read in one row.
--  * item_position and current_stock read it. Nothing else changes: the
--    movements stay the record, and the database's test checks the two agree.
--  * Stock written at a place is written one transaction after another (a
--    lock for the place, held until the sale is saved: milliseconds), so two
--    tills selling the same things in a different order never wait on each
--    other for ever.
--  * The last price an item was bought at, read when none is in stock, and
--    an account's balance (the stock's value, the safe, the statements), are
--    found from an index instead of a scan of everything.
--  * The dashboard's stock today is the balance; the profit by place, each
--    branch's position, the books' checks and the cash flow give the same
--    answers quicker; and the reports are not compiled first (JIT), which
--    cost seconds each. Measured on a copy with a year of sales (110,000):
--    the cash flow for a month had not finished in five minutes, and takes
--    half a second; the books' checks 5 s, now 0.8 s; the dashboard 0.4 s,
--    now 0.02 s; each branch's position 4.9 s, now 1.3 s.
--
-- Nothing recorded changes.
-- =============================================================================

create table if not exists stock_balance (
  business_id uuid not null references business (id) on delete cascade,
  item_id     uuid not null,
  location_id uuid not null,
  qty         numeric not null default 0,
  value       numeric not null default 0,
  primary key (business_id, item_id, location_id)
);

-- Read as the movements are: by those who see costs.
alter table stock_balance enable row level security;
alter table stock_balance force row level security;
drop policy if exists cost_read on stock_balance;
create policy cost_read on stock_balance for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
revoke all on stock_balance from public, anon, authenticated;
grant select on stock_balance to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Kept by the movements
-- -----------------------------------------------------------------------------
create or replace function trg_inventory_movement_balance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform pg_advisory_xact_lock(hashtextextended('stock:' || old.location_id::text, 0));
    update stock_balance
       set qty = qty - old.base_quantity_signed,
           value = value - coalesce(old.value, 0) * sign(old.base_quantity_signed)
     where business_id = old.business_id and item_id = old.item_id and location_id = old.location_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform pg_advisory_xact_lock(hashtextextended('stock:' || new.location_id::text, 0));
    insert into stock_balance as b (business_id, item_id, location_id, qty, value)
    values (new.business_id, new.item_id, new.location_id, new.base_quantity_signed,
            coalesce(new.value, 0) * sign(new.base_quantity_signed))
    on conflict (business_id, item_id, location_id) do update
      set qty = b.qty + excluded.qty, value = b.value + excluded.value;
  end if;
  return null;
end $$;

create or replace function trg_inventory_movement_truncate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  truncate stock_balance;
  return null;
end $$;

drop trigger if exists inventory_movement_balance on inventory_movement;
create trigger inventory_movement_balance after insert or update or delete on inventory_movement
  for each row execute function trg_inventory_movement_balance();
drop trigger if exists inventory_movement_truncate on inventory_movement;
create trigger inventory_movement_truncate after truncate on inventory_movement
  for each statement execute function trg_inventory_movement_truncate();

-- What the movements add up to now, no movement written meanwhile.
do $$
begin
  lock table inventory_movement in share row exclusive mode;
  insert into stock_balance as b (business_id, item_id, location_id, qty, value)
  select business_id, item_id, location_id, sum(base_quantity_signed),
         sum(coalesce(value, 0) * sign(base_quantity_signed))
    from inventory_movement
   group by business_id, item_id, location_id
  on conflict (business_id, item_id, location_id) do update set qty = excluded.qty, value = excluded.value;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Read in one row
-- -----------------------------------------------------------------------------
-- 0015's, from the balance.
create or replace function item_position(p_business uuid, p_item uuid, p_location uuid,
                                         out qty numeric, out value numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(b.qty, 0), coalesce(b.value, 0)
    from (select 1) one
    left join stock_balance b on b.business_id = p_business and b.item_id = p_item and b.location_id = p_location
$$;
revoke execute on function item_position(uuid, uuid, uuid) from public, anon, authenticated;

-- 0003's, from the balance: the same columns, read by those who see costs.
create or replace view current_stock with (security_invoker = on) as
select business_id, item_id, location_id, qty as quantity_base, value as value_signed
  from stock_balance;

-- The last price an item was bought at (item_issue_cost), from an index.
create index if not exists inventory_movement_last_cost
  on inventory_movement (business_id, item_id, occurred_at desc, created_at desc)
  where base_quantity_signed > 0 and unit_cost > 0;

-- An account's balance (gl_balance_at: the stock's value on the dashboard, the
-- safe, the statements) read from that account's lines, not every line.
create index if not exists journal_line_account
  on journal_line (account_id) include (journal_entry_id, debit, credit);

-- -----------------------------------------------------------------------------
-- 3. The dashboard and the profit by place, quicker
-- -----------------------------------------------------------------------------
-- 0057's dashboard: today's stock is what the balance holds, not a year of
-- the stock account's journal lines added up.
create or replace function dashboard_summary(p_day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view'); b record; v_rev numeric; v_cos numeric; v_orders bigint;
  v_loc uuid;
begin
  v_loc := report_place(v_business, null);
  b := local_day_bounds(v_business, p_day, p_day);
  if v_loc is null then
    select coalesce(sum(case when a.account_type = 'revenue' then l.credit - l.debit end), 0),
           coalesce(sum(case when a.code like '5%' then l.debit - l.credit end), 0)
      into v_rev, v_cos
      from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id
     where e.business_id = v_business and e.status = 'published' and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts
       and not year_end_entry(e);
  else
    select coalesce(sum(case when a.account_type = 'revenue' then -p.amount end), 0),
           coalesce(sum(case when a.code like '5%' then p.amount end), 0)
      into v_rev, v_cos
      from pnl_by_place(v_business, b.from_ts, b.to_ts) p join gl_account a on a.id = p.account_id
     where p.location_id = v_loc;
  end if;
  select count(*) into v_orders from sales_order
   where business_id = v_business and status not in ('voided', 'open') and placed_at >= b.from_ts and placed_at < b.to_ts
     and (v_loc is null or location_id = v_loc);
  return jsonb_build_object(
    'net_revenue', v_rev, 'cost_of_sales', v_cos, 'gross_profit', v_rev - v_cos, 'orders', v_orders,
    'average_order', case when v_orders > 0 then round(v_rev / v_orders) else 0 end,
    -- Today's, from the stock kept as it moves (0085); a day gone, as before.
    'inventory_value', case when p_day >= business_local_date(v_business, now())
                            then (select coalesce(sum(sb.value), 0) from stock_balance sb
                                   where sb.business_id = v_business and (v_loc is null or sb.location_id = v_loc))
                            when v_loc is null then gl_balance_at(v_business, '1200', b.to_ts)
                            else (select coalesce(sum(m.value * sign(m.base_quantity_signed)), 0) from inventory_movement m
                                   where m.business_id = v_business and m.location_id = v_loc and m.occurred_at < b.to_ts)
                       end,
    'low_stock', (select count(*) from (
                    select s.item_id from stock_board s
                     where s.business_id = v_business and (v_loc is null or s.location_id = v_loc)
                     group by s.item_id having sum(s.quantity_base) < coalesce(max(s.min_level_base), 0)) x),
    'negative_stock', (select count(distinct s.item_id) from stock_board s
                        where s.business_id = v_business and s.is_negative
                          and (v_loc is null or s.location_id = v_loc)),
    'location', (select name from location where id = v_loc));
end $$;

-- 0084's profit by place, the same answer quicker: an entry reversing another
-- looks for the one it reverses (and no other entry does); ordinary lines
-- are added up in one go; a platform's payout and a payroll are shared out
-- line by line as before. Measured on a copy with a year of sales: a month
-- 150 ms before, 100 ms after; a year 2.2 s before, 0.7 s after.
create or replace function pnl_by_place(p_business uuid, p_from timestamptz, p_to timestamptz)
returns table (account_id uuid, location_id uuid, amount numeric)
language sql stable security definer set search_path = public set jit = off as $$
  with ent as materialized (
    select e.id, e.reverses_entry is not null as reversing,
           case when e.reverses_entry is null then e.reference_type else (journal_origin(e)).reference_type end
             as ref_type,
           case when e.reverses_entry is null then e.reference_id else (journal_origin(e)).reference_id end
             as ref_id
      from journal_entry e
     where e.business_id = p_business and e.status = 'published'
       and e.occurred_at >= p_from and e.occurred_at < p_to
  ),
  placed as materialized (
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
     where coalesce(ent.ref_type, '') <> 'year_end_close'
  ),
  -- An ordinary line, at its entry's place: added up in one go.
  plain as (
    select l.account_id, p.location_id, sum(l.debit - l.credit) as amount
      from placed p
      join journal_line l on l.journal_entry_id = p.id
      join gl_account a on a.id = l.account_id and a.account_type in ('revenue', 'expense')
     where p.ref_type is null or p.ref_type not in ('platform_settlement', 'payroll_approval')
     group by l.account_id, p.location_id
  ),
  -- A platform's payout or a payroll: shared out line by line.
  lines as materialized (
    select l.id as line_id, l.account_id, a.code, l.debit - l.credit as amount, p.reversing, p.ref_type, p.ref_id
      from placed p
      join journal_line l on l.journal_entry_id = p.id
      join gl_account a on a.id = l.account_id and a.account_type in ('revenue', 'expense')
     where p.ref_type in ('platform_settlement', 'payroll_approval')
  ),
  parts as materialized (
    -- A platform's payout: each order it paid at its sale's branch, as the
    -- statement's journal added them up (0030).
    select ln.line_id, ln.account_id, s.location_id,
           (case when ln.reversing then -1 else 1 end)
           * sum(case ln.code when '5100' then psl.reported_commission
                              else psl.expected - psl.reported_payout - psl.reported_commission end) as amount
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
    select ln.account_id, null::uuid as location_id,
           ln.amount - coalesce((select sum(p.amount) from parts p where p.line_id = ln.line_id), 0) as amount
      from lines ln
  ),
  -- A transfer charged at more than cost (0084): what was added is revenue
  -- of the place that sent it, and a cost of the place that took it in.
  margins as (
    select a.id as account_id, case a.code when '4950' then t.from_location_id else t.to_location_id end as location_id,
           case a.code when '4950' then -t.margin else t.margin end as amount
      from stock_transfer t
      join gl_account a on a.business_id = t.business_id and a.code in ('4950', '5950')
     where t.business_id = p_business and t.status = 'received' and t.margin <> 0
       and t.received_at >= p_from and t.received_at < p_to
  )
  select x.account_id, x.location_id, sum(x.amount)
    from (select account_id, location_id, amount from plain
          union all select account_id, location_id, amount from parts
          union all select account_id, location_id, amount from rest
          union all select account_id, location_id, amount from margins) x
   group by x.account_id, x.location_id
  having sum(x.amount) <> 0
$$;

-- 0084's position of each branch: the year's profit worked out once, not
-- twice.
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
             'safe', gl_balance_at(v_business, '1005', now()) + gl_balance_at(v_business, '1006', now()),
             'bank', coalesce((select sum(gl_balance_at(v_business, a.code, now())) from gl_account a
                                where a.business_id = v_business
                                  and (a.code = '1020' or a.code ~ '^10[3-8][0-9]$')), 0),
             'to_come_in', gl_balance_at(v_business, '1010', now()) + gl_balance_at(v_business, '1100', now()),
             'equipment', (select coalesce(sum(a.cost - coalesce((select sum(d.amount) from asset_depreciation d
                                                                   where d.asset_id = a.id), 0)), 0)
                             from fixed_asset a
                            where a.business_id = v_business and a.disposed_on is null and a.location_id is null),
             'customers_owe', (select coalesce(sum(p.left_amount), 0)
                                 from customer c
                                 cross join lateral customer_invoices_paid(c.id) p
                                 join customer_invoice ci on ci.id = p.invoice_id
                                where c.business_id = v_business and ci.location_id is null),
             'owed_to_suppliers', -(gl_balance_at(v_business, '2000', now()) + gl_balance_at(v_business, '2050', now())),
             'owed_to_staff', -gl_balance_at(v_business, '2100', now()),
             'profit_this_year', coalesce((v_profit ->> '')::numeric, 0),
             'markup_percent', coalesce((rule_value(v_business, 'transfer_markup_percent') #>> '{}')::numeric, 0))
      into v_cafe;
  end if;
  return jsonb_build_object('places', v_places, 'cafe', v_cafe, 'year_from', date_trunc('year', v_today)::date);
end $$;

-- 0015's balance of an account, read from that account's lines (the index
-- above) rather than every line in the books.
create or replace function gl_balance_at(p_business uuid, p_code text, p_at timestamptz) returns numeric
language plpgsql stable set search_path = public as $$
declare v_account uuid; v numeric;
begin
  select id into v_account from gl_account where business_id = p_business and code = p_code;
  if v_account is null then return 0; end if;
  select coalesce(sum(l.debit - l.credit), 0) into v
    from journal_line l
    join journal_entry e on e.id = l.journal_entry_id
   where l.account_id = v_account and e.business_id = p_business and e.status = 'published' and e.occurred_at < p_at;
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 4. The books' checks and the cash flow, quicker
-- -----------------------------------------------------------------------------
-- 0054's records with no journal: each record's journal looked up by its
-- reference (an index), not in a list of every journal the café has made.
-- The same answer: a year of sales checked in 0.2 s.
create index if not exists journal_entry_reference on journal_entry (business_id, reference_type, reference_id);

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
  )
  -- Records without their journal.
  select 'sale'::text, o.id, o.placed_at, 'A sale with no journal'::text
    from sales_order o
   where o.business_id = p_business and o.status <> 'open' and o.created_at >= v_start and o.placed_at < p_before
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'sales_order'
                      and h.reference_id = o.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'void', a.id, a.created_at, 'A void whose sale''s journal was not reversed'
    from sale_adjustment a
   where a.business_id = p_business and a.kind = 'void' and a.created_at >= v_start and a.created_at < p_before
     and not exists (select 1 from journal_entry s join journal_entry rv on rv.reverses_entry = s.id
                      where s.business_id = p_business and s.reference_type = 'sales_order'
                        and s.reference_id = a.sales_order_id and s.status = 'published' and not s.legacy
                        and rv.status = 'published' and not rv.legacy)
  union all
  select 'refund', a.id, a.created_at, 'A refund with no journal'
    from sale_adjustment a
   where a.business_id = p_business and a.kind = 'refund' and a.created_at >= v_start and a.created_at < p_before
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'sale_refund'
                      and h.reference_id = a.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'delivery', r.id, r.received_at, 'A delivery with no journal'
    from goods_receipt r
   where r.business_id = p_business and r.received_at >= v_start and r.received_at < p_before
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'goods_receipt'
                      and h.reference_id = r.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
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
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'supplier_payment'
                      and h.reference_id = p.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'expense', x.id, x.created_at, 'An expense with no journal'
    from expense x
   where x.business_id = p_business and x.created_at >= v_start and x.created_at < p_before
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'expense'
                      and h.reference_id = x.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'stock', m.id, m.created_at, 'A loss, stock correction or opening stock with no journal'
    from inventory_movement m
   where m.business_id = p_business and m.created_at >= v_start and m.created_at < p_before and m.value > 0
     and m.type in ('waste', 'spoilage', 'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling',
                    'damaged', 'expired', 'manual_correction', 'opening_balance')
     and m.reference_id is null
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'inventory_movement'
                      and h.reference_id = m.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'loss', s.id, s.created_at, 'A loss with no journal'
    from stock_loss s
   where s.business_id = p_business and s.created_at >= v_start and s.created_at < p_before and s.value > 0
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'stock_loss'
                      and h.reference_id = s.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'count', c.id, c.approved_at, 'An approved count with no journal'
    from stock_count c
   where c.business_id = p_business and c.status = 'approved' and not c.legacy
     and c.approved_at >= v_start and c.approved_at < p_before
     and exists (select 1 from stock_count_line l join inventory_movement m on m.id = l.adjustment_movement_id
                  where l.stock_count_id = c.id and m.value > 0)
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'stock_count'
                      and h.reference_id = c.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'cash', t.id, t.created_at, 'Cash moved with no journal'
    from cash_transfer t
   where t.business_id = p_business and t.created_at >= v_start and t.created_at < p_before
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'cash_transfer'
                      and h.reference_id = t.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'session', w.id, w.closed_at, 'A drawer counted over or short with no journal'
    from work_shift w
   where w.business_id = p_business and w.kind in ('session', 'drawer') and coalesce(w.variance, 0) <> 0
     and w.closed_at >= v_start and w.closed_at < p_before
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'work_shift'
                      and h.reference_id = w.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'session', w.id, w.opened_at, 'A drawer opened over or short with no journal'
    from work_shift w
   where w.business_id = p_business and w.kind = 'session' and coalesce(w.opening_variance, 0) <> 0
     and w.opened_at >= v_start and w.opened_at < p_before
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'session_opening'
                      and h.reference_id = w.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
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
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'supplier_return'
                      and h.reference_id = x.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'credit', c.id, c.created_at, 'A supplier''s credit with no journal'
    from supplier_credit c
   where c.business_id = p_business and c.kind <> 'goods_return' and c.created_at >= v_start and c.created_at < p_before
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'supplier_credit'
                      and h.reference_id = c.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
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
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'payroll_approval'
                      and h.reference_id = a.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'advance', v.id, v.created_at, 'An advance with no journal'
    from employee_advance v
   where v.business_id = p_business and v.created_at < p_before and v.cancelled_at is null
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'employee_advance'
                      and h.reference_id = v.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'transfer', t.id, t.sent_at, 'Stock sent to another place with no journal'
    from stock_transfer t
   where t.business_id = p_business and t.sent_at < p_before and t.value_sent <> 0
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'stock_transfer'
                      and h.reference_id = t.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'transfer', t.id, t.received_at, 'Stock received from another place with no journal'
    from stock_transfer t
   where t.business_id = p_business and t.status = 'received' and t.received_at < p_before and t.value_sent <> 0
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'stock_transfer_receipt'
                      and h.reference_id = t.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'transfer', t.id, t.cancelled_at, 'A transfer cancelled on its way with no journal'
    from stock_transfer t
   where t.business_id = p_business and t.status = 'cancelled' and t.cancelled_at < p_before and t.value_sent <> 0
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'stock_transfer_cancel'
                      and h.reference_id = t.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
  union all
  select 'salary', s.id, s.created_at, 'A salary payment with no journal'
    from salary_payment s
   where s.business_id = p_business and s.created_at < p_before and s.cancelled_at is null
     and not exists (select 1 from journal_entry h where h.business_id = p_business and h.reference_type = 'salary_payment'
                      and h.reference_id = s.id and h.reverses_entry is null and h.status = 'published' and not h.legacy)
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
           when 'stock_transfer' then 'transfer' when 'stock_transfer_receipt' then 'transfer'
           when 'stock_transfer_cancel' then 'transfer'
           else replace(j.reference_type, '_', ' ') end || ' does not exist'
    from j
   where j.created_at < p_before and j.reverses_entry is null and j.reference_id is not null
     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.created_at < p_before
                       and rv.status = 'published' and not rv.legacy)
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
           when 'stock_transfer' then not exists (select 1 from stock_transfer x where x.id = j.reference_id)
           when 'stock_transfer_receipt' then not exists (select 1 from stock_transfer x where x.id = j.reference_id
                                                            and x.status = 'received')
           when 'stock_transfer_cancel' then not exists (select 1 from stock_transfer x where x.id = j.reference_id
                                                           and x.status = 'cancelled')
           else false end;
end $$;

-- 0052's cash flow: each account's amount and what its line comes to in its
-- journal worked out in one pass, not by joining the journal's lines to
-- themselves. The same answer; a month of a year-old café in half a second,
-- where it had not finished in five minutes.
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
  jl as materialized (
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
  -- Each account's amount with what its line comes to in its journal, in one
  -- pass (0085): a line that nets to nothing in a journal is no flow.
  jlx as materialized (
    select journal_id, code, amount, cash_flow_line(code) as line,
           sum(amount) over (partition by journal_id, cash_flow_line(code)) as line_amount
      from jl
  ),
  jline as (
    select distinct journal_id, line, line_amount as amount from jlx where line_amount <> 0
  ),
  per_line as (
    select line, cash_flow_section(line) as section, sum(amount) as amount,
           coalesce(sum(amount) filter (where amount > 0), 0) as cash_in,
           coalesce(-sum(amount) filter (where amount < 0), 0) as cash_out,
           count(*) as journals
      from jline group by line
  ),
  per_account as (
    select line, code, sum(amount) as amount
      from jlx where line_amount <> 0
     group by 1, 2 having sum(amount) <> 0
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

-- The reports and the books' checks read many rows in one go: compiling
-- their queries first (JIT) cost seconds and saved milliseconds. Off for them.
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
              and (p.proname like 'report\_%' or p.proname like 'reconciliation\_checks%'
                   or p.proname in ('document_problems', 'dashboard_summary', 'branch_position', 'pnl_by_place',
                                    'daily_brief', 'alert_conditions', 'stock_board_for'))
  loop
    execute format('alter function %s set jit = off', f);
  end loop;
end $$;

revoke execute on function trg_inventory_movement_balance(), trg_inventory_movement_truncate()
  from public, anon, authenticated;
