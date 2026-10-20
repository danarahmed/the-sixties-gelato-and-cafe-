-- =============================================================================
-- 0084 — Each branch's books: a transfer price, and what each branch holds (G3)
-- =============================================================================
-- Stock made at one place and sold at another moved at cost (0054): the place
-- that made it carried the work and showed none of the sale. The owner chose
-- a transfer price: cost, or cost plus a share they set.
--
--  * transfer_markup_percent, a rule on Settings → Rules for the café or for
--    the place that sends (0, the default: at cost). When a transfer is
--    received, the share that applies then is kept on it with what it adds,
--    so a later change of the rule rewrites nothing.
--  * 4950 Sold to other branches and 5950 Bought from other branches: what a
--    transfer adds is revenue of the place that sent it and a cost of the place
--    that took it in, in the profit by place (pnl_by_place) — and so in every
--    report read for one place. Nothing is posted to the journals: within the
--    café the two are the same money, so the café's own books, the trial
--    balance and its statements are as they were. The two accounts carry no
--    journal: the database refuses a journal line on either.
--  * branch_position: what each branch holds and owes now — the cash in its
--    till, its stock at cost, stock it sent not yet received, its equipment
--    at book value, what customers owe on invoices made there, the deposits
--    it holds — with its profit this year, and what it sold to and bought
--    from the other branches. What belongs to no one branch (the safe, the
--    bank, what is owed to suppliers and to staff) is the café's, shown apart.
--
-- Nothing recorded changes.
-- =============================================================================

-- =============================================================================
-- 1. The rule
-- =============================================================================
-- 0071's list, and the transfer price.
create or replace function rule_definitions() returns jsonb
language sql immutable set search_path = public as $$
  select '{
    "daily_sales_target":    {"kind": "amount", "min": 0, "max": 1000000000, "whole": true,
                              "scopes": ["business", "location"],
                              "label": "A day''s net sales target (0: none)"},
    "labour_target_percent": {"kind": "percent", "min": 0, "max": 100, "whole": false,
                              "scopes": ["business", "location"],
                              "label": "Labour cost the café aims for (% of net sales; 0: none)"},
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
                              "label": "Salaries are paid on the day of the month"},
    "loyalty":               {"kind": "choice", "choices": ["on", "off"],
                              "scopes": ["business"],
                              "label": "Customers earn points, and take rewards"},
    "loyalty_point_per":     {"kind": "amount", "min": 1, "max": 1000000, "whole": true,
                              "scopes": ["business"],
                              "label": "A customer earns a point for every"},
    "loyalty_reward_points": {"kind": "points", "min": 1, "max": 100000, "whole": true,
                              "scopes": ["business"],
                              "label": "A reward takes"},
    "loyalty_reward_value":  {"kind": "amount", "min": 1, "max": 10000000, "whole": true,
                              "scopes": ["business"],
                              "label": "A reward is worth"},
    "transfer_markup_percent": {"kind": "percent", "min": 0, "max": 100, "whole": false,
                              "scopes": ["business", "location"],
                              "label": "Stock sent to another branch is charged at cost plus (%; 0: at cost)"}
  }'::jsonb
$$;

-- 0071's defaults, and at cost.
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
  union all
  select 'loyalty', 'business', '', to_jsonb('on'::text)
  union all
  select 'loyalty_point_per', 'business', '', to_jsonb(1000)
  union all
  select 'loyalty_reward_points', 'business', '', to_jsonb(100)
  union all
  select 'loyalty_reward_value', 'business', '', to_jsonb(5000)
  union all
  select 'daily_sales_target', 'business', '', to_jsonb(0)
  union all
  select 'labour_target_percent', 'business', '', to_jsonb(0)
  union all
  select 'transfer_markup_percent', 'business', '', to_jsonb(0)
$$;

-- =============================================================================
-- 2. The two accounts
-- =============================================================================
-- 0076's chart, with 4950 and 5950.
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
    ('1110','Customer accounts',          'asset',     'debit'),
    ('1200','Inventory',                  'asset',     'debit'),
    ('1210','Stock in transit',           'asset',     'debit'),
    ('1300','Employee advances',          'asset',     'debit'),
    ('1400','Prepaid expenses',           'asset',     'debit'),
    ('1500','Equipment',                  'asset',     'debit'),
    ('1590','Accumulated depreciation',   'asset',     'credit'),
    ('2000','Accounts payable',           'liability', 'credit'),
    ('2050','Goods received not invoiced','liability', 'credit'),
    ('2100','Salaries payable',           'liability', 'credit'),
    ('2300','Customer deposits',          'liability', 'credit'),
    ('3000','Owner equity',               'equity',    'credit'),
    ('3100','Retained earnings',          'equity',    'credit'),
    ('3200','Owner drawings',             'equity',    'debit'),
    ('4000','Sales revenue',              'revenue',   'credit'),
    ('4100','Merchant-funded discount',   'revenue',   'debit'),
    ('4200','Sales returns & refunds',    'revenue',   'debit'),
    ('4390','Deposits kept',              'revenue',   'credit'),
    ('4950','Sold to other branches',     'revenue',   'credit'),
    ('5000','Cost of goods sold',         'expense',   'debit'),
    ('5050','Purchase price variance',    'expense',   'debit'),
    ('5100','Platform commission',        'expense',   'debit'),
    ('5200','Platform fees',              'expense',   'debit'),
    ('5300','Waste & spoilage',           'expense',   'debit'),
    ('5310','Production and preparation loss', 'expense', 'debit'),
    ('5400','Inventory count variance',   'expense',   'debit'),
    ('5950','Bought from other branches', 'expense',   'debit'),
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

-- 0076's list, with 4950 and 5950: they carry no journal.
create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$
  select p_code in ('1000', '1001', '1005', '1006', '1200', '1210', '1300', '1400', '1110', '2000', '2050', '2100', '2300',
                    '3100', '4000', '4100', '4200',
                    '4950', '5950')
$$;

-- Nor any other way: a journal line on either is refused, wherever it comes from.
create or replace function trg_journal_line_not_transfer_price() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from gl_account a where a.id = new.account_id and a.code in ('4950', '5950')) then
    raise exception 'The accounts of the transfer price between branches carry no journal';
  end if;
  return new;
end $$;
drop trigger if exists journal_line_not_transfer_price on journal_line;
create trigger journal_line_not_transfer_price before insert or update of account_id on journal_line
  for each row execute function trg_journal_line_not_transfer_price();

-- =============================================================================
-- 3. What a transfer adds, kept when it is received
-- =============================================================================
alter table stock_transfer add column if not exists markup_percent numeric not null default 0;
alter table stock_transfer add column if not exists margin numeric not null default 0;
do $$ begin
  alter table stock_transfer add constraint stock_transfer_margin check (markup_percent >= 0 and margin >= 0);
exception when duplicate_object then null; end $$;

create or replace function trg_stock_transfer_margin() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pct numeric;
begin
  if new.status = 'received' and old.status is distinct from 'received' then
    v_pct := coalesce((rule_value(new.business_id, 'transfer_markup_percent', null, null,
                                  new.from_location_id) #>> '{}')::numeric, 0);
    new.markup_percent := v_pct;
    new.margin := money_round(new.business_id, coalesce(new.value_received, 0) * v_pct / 100);
  end if;
  return new;
end $$;
drop trigger if exists stock_transfer_margin on stock_transfer;
create trigger stock_transfer_margin before update of status on stock_transfer
  for each row execute function trg_stock_transfer_margin();

-- 0054's list of transfers, with the share and what it added.
create or replace function stock_transfers(p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view', 'stock.transfer');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', t.id, 'no', t.transfer_no, 'status', t.status,
             'from_id', t.from_location_id, 'from', lf.name, 'to_id', t.to_location_id, 'to', lt.name,
             'note', t.note, 'value', t.value_sent, 'value_received', t.value_received, 'value_short', t.value_short,
             'markup_percent', t.markup_percent, 'margin', t.margin,
             'sent_at', t.sent_at, 'sent_by', (select u.full_name from app_user u where u.id = t.sent_by),
             'received_at', t.received_at, 'received_by', (select u.full_name from app_user u where u.id = t.received_by),
             'receive_note', t.receive_note, 'cancelled_at', t.cancelled_at,
             'cancelled_by', (select u.full_name from app_user u where u.id = t.cancelled_by),
             'cancel_reason', t.cancel_reason,
             'lines', (select jsonb_agg(jsonb_build_object(
                                'id', l.id, 'item_id', l.item_id, 'item', i.name, 'qty', trim_scale(l.qty),
                                'unit_code', l.unit_code, 'base_qty', trim_scale(l.base_qty), 'base_unit', i.base_unit_code,
                                'value', l.value,
                                'qty_received', case when l.base_received is not null
                                                     then trim_scale(round(l.base_received * l.qty / l.base_qty, 6)) end,
                                'value_received', l.value_received)
                              order by i.name, l.id)
                         from stock_transfer_line l join item i on i.id = l.item_id where l.transfer_id = t.id))
           order by t.sent_at desc, t.transfer_no desc)
      from (select * from stock_transfer where business_id = v_business
             order by sent_at desc, transfer_no desc limit greatest(1, least(coalesce(p_limit, 50), 500))) t
      join location lf on lf.id = t.from_location_id
      join location lt on lt.id = t.to_location_id), '[]'::jsonb);
end $$;

-- =============================================================================
-- 4. The profit by place, with what transfers add
-- =============================================================================
-- 0056's, and a transfer's margin at the two places.
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
    union all
    -- A transfer charged at more than cost (0084): what was added is revenue
    -- of the place that sent it, and a cost of the place that took it in.
    select null::uuid, a.id, case a.code when '4950' then t.from_location_id else t.to_location_id end,
           case a.code when '4950' then -t.margin else t.margin end
      from stock_transfer t
      join gl_account a on a.business_id = t.business_id and a.code in ('4950', '5950')
     where t.business_id = p_business and t.status = 'received' and t.margin <> 0
       and t.received_at >= p_from and t.received_at < p_to
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

-- =============================================================================
-- 5. What each branch holds and owes, now
-- =============================================================================
create or replace function branch_position() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  v_loc uuid := report_place(v_business, null);
  v_today date := business_local_date(v_business, now());
  y record; v_places jsonb; v_cafe jsonb;
begin
  y := local_day_bounds(v_business, date_trunc('year', v_today)::date, v_today);
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
  profit as (
    select p.location_id, -sum(p.amount) as amount
      from pnl_by_place(v_business, y.from_ts, y.to_ts) p group by p.location_id
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
           coalesce((select p.amount from profit p where p.location_id = pl.id), 0) as profit_this_year,
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
             'profit_this_year', (select coalesce(-sum(p.amount), 0)
                                    from pnl_by_place(v_business, y.from_ts, y.to_ts) p where p.location_id is null),
             'markup_percent', coalesce((rule_value(v_business, 'transfer_markup_percent') #>> '{}')::numeric, 0))
      into v_cafe;
  end if;
  return jsonb_build_object('places', v_places, 'cafe', v_cafe, 'year_from', date_trunc('year', v_today)::date);
end $$;

-- =============================================================================
-- 6. Who may call what
-- =============================================================================
revoke execute on function trg_stock_transfer_margin(), trg_journal_line_not_transfer_price()
  from public, anon, authenticated;
revoke execute on function branch_position() from public, anon;
grant execute on function branch_position() to authenticated;
