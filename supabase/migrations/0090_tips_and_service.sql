-- =============================================================================
-- 0090 — Tips and a service charge (SMART_PLAN F3)
-- =============================================================================
-- A service charge (as the owner chose: on any of the café's own ways of
-- selling, or off everywhere). A percentage of what the products come to
-- after discounts, set for each way of selling the till rings up itself —
-- at a table, to take away, delivered by the café — and none on a delivery
-- platform, which sets what its customers pay. It is added when the sale is
-- paid at the till or a table's bill is settled; a pre-order collected or a
-- customer invoiced pays what was agreed. Someone who may give discounts can
-- take it off one sale. It is the café's own money, kept apart from the
-- products' sales: 4300 Service charge.
--
-- Tips (as the owner chose: shared between the people the owner ticks, each
-- day's at the end of that day, paid with the salary). A tip is added when
-- paying, by any way to pay; it is not the café's sales but money it holds
-- for the staff: 2200 Tips owed to staff. Each day's tips at a branch are
-- shared equally between the people ticked to share them who work there —
-- those of them who clocked in that day, or all of them when nobody did —
-- and each one's share is added to their pay for the month: the payroll's
-- line shows it, and its approval moves it from 2200 to what is owed in
-- salaries (2100), not to the salaries' cost.
--
--  * gl_account 2200 Tips owed to staff, 4300 Service charge.
--  * service_charge (a percentage per way of selling); set_service_charge,
--    service_charges.
--  * sales_order.service_percent, service_amount, tip_amount; post_sale adds
--    them to what is paid; record_sale, settle_tab, record_offline_sale and
--    settle_tab_offline take p_tip and p_no_service.
--  * tip_sharer (who shares the tips, from and until when); set_tip_sharers;
--    tip_shares (each day's split); tips_month (the month on Payroll).
--  * payroll_line.tips; the payroll drafts, adjusts and approves with them.
--  * report_tips_and_service: what the till took of both, for Reports and
--    the end of the day.
--
-- Nothing recorded changes. A refund gives back what was bought; the
-- service charge and the tip stay. Voiding a sale takes back all of it.
-- =============================================================================

-- =============================================================================
-- 1. The two accounts
-- =============================================================================
-- An account the café made itself with either code is not taken over.
do $$
declare v_name text;
begin
  select name into v_name from gl_account where code in ('2200', '4300') and not is_system limit 1;
  if found then
    raise exception 'The café already has its own account % with the code 2200 or 4300: give it another code on the chart of accounts, then run this again', v_name;
  end if;
end $$;

-- 0084's chart, with 2200 and 4300.
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
    ('2200','Tips owed to staff',         'liability', 'credit'),
    ('2300','Customer deposits',          'liability', 'credit'),
    ('3000','Owner equity',               'equity',    'credit'),
    ('3100','Retained earnings',          'equity',    'credit'),
    ('3200','Owner drawings',             'equity',    'debit'),
    ('4000','Sales revenue',              'revenue',   'credit'),
    ('4100','Merchant-funded discount',   'revenue',   'debit'),
    ('4200','Sales returns & refunds',    'revenue',   'debit'),
    ('4300','Service charge',             'revenue',   'credit'),
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

-- 0084's list, with the two: only the till posts to them.
create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$
  select p_code in ('1000', '1001', '1005', '1006', '1200', '1210', '1300', '1400', '1110', '2000', '2050', '2100',
                    '2200', '2300', '3100', '4000', '4100', '4200', '4300',
                    '4950', '5950')
$$;

-- 0081's cash flow lines: tips are the staff's money.
create or replace function cash_flow_line(p_code text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_code in ('1000', '1001', '1005', '1006', '1020') or p_code ~ '^10[3-8][0-9]$'
         or p_code between '1021' and '1029' then 'cash'
    when p_code like '15%' then 'equipment'
    when p_code like '3%' or p_code between '2400' and '2499' then 'owner'
    when p_code = '6950' then 'exchange'
    when p_code = '6300' then 'counts'
    when p_code like '4%' or p_code in ('1010', '1100', '1110', '2300', '5100', '5200', '6500') then 'sales'
    when p_code like '12%' or p_code in ('2000', '2050') or p_code like '5%' then 'stock'
    when p_code in ('1300', '2100', '2200') or p_code like '61%' then 'staff'
    else 'running'
  end
$$;

-- =============================================================================
-- 2. The service charge, per way of selling
-- =============================================================================
create table if not exists service_charge (
  business_id uuid not null references business (id) on delete cascade,
  channel     sales_channel not null,
  percent     numeric not null,
  set_by      uuid references app_user (id),
  set_at      timestamptz not null default now(),
  primary key (business_id, channel),
  constraint service_charge_percent check (percent > 0 and percent <= 50)
);
alter table service_charge enable row level security;
alter table service_charge force row level security;
drop policy if exists member_read on service_charge;
create policy member_read on service_charge for select to authenticated
  using (business_id = (select current_business_id()));
grant select on service_charge to authenticated;

-- p_percent: the charge on that way of selling; null or 0 takes it off.
create or replace function set_service_charge(p_channel sales_channel, p_percent numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_before numeric;
begin
  if p_channel is null then raise exception 'Choose the way of selling'; end if;
  if is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets what its customers pay: no service charge is added to it';
  end if;
  if p_percent is not null and (p_percent < 0 or p_percent > 50) then
    raise exception 'A service charge is between 0 and 50%%';
  end if;
  select percent into v_before from service_charge where business_id = v_business and channel = p_channel;
  if coalesce(p_percent, 0) = 0 then
    delete from service_charge where business_id = v_business and channel = p_channel;
  else
    insert into service_charge (business_id, channel, percent, set_by)
    values (v_business, p_channel, p_percent, (current_member()).id)
    on conflict (business_id, channel) do update set percent = excluded.percent, set_by = excluded.set_by,
                                                     set_at = now();
  end if;
  perform audit_event(v_business, 'settings.service_charge', 'service_charge', p_channel::text, null,
    jsonb_build_object('percent', v_before), jsonb_build_object('percent', nullif(p_percent, 0)));
  return service_charges();
end $$;

-- {channel: percent} for each way of selling that takes one.
create or replace function service_charges() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(channel::text, percent), '{}'::jsonb)
    from service_charge where business_id = current_business_id()
$$;

-- =============================================================================
-- 3. What a sale took besides its products
-- =============================================================================
alter table sales_order add column if not exists service_percent numeric;
alter table sales_order add column if not exists service_amount numeric not null default 0;
alter table sales_order add column if not exists tip_amount numeric not null default 0;
do $$ begin
  alter table sales_order add constraint sales_order_extras
    check (service_amount >= 0 and tip_amount >= 0 and (service_amount = 0 or service_percent is not null));
exception when duplicate_object then null; end $$;

-- What the till sends with a sale, for post_sale to read in the same
-- transaction: the tip, and whether the service charge is added. The first
-- to say so is heard (an offline bill's payment passes through settle_tab).
create or replace function sale_extras(p_tip numeric, p_no_service boolean) returns void
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('sixties.sale_service', true), '') = '' then
    perform set_config('sixties.sale_service', case when coalesce(p_no_service, false) then 'off' else 'on' end, true);
    perform set_config('sixties.sale_tip', coalesce(p_tip::text, ''), true);
  end if;
end $$;

-- 0089's post_sale, with the service charge and the tip (0090).
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric,
  p_trust_line_prices boolean default false, p_discount jsonb default null, p_turn_no int default null,
  p_stock_approval uuid default null, p_tenders jsonb default null, p_expected_net numeric default null,
  p_customer jsonb default null)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_business uuid := p_business;
  v_me uuid := p_me;
  v_location uuid;
  v_order uuid;
  v_existing record;
  v_today date;
  v_needs jsonb; v_stock_by uuid;
  l jsonb; v_variant uuid; v_qty numeric; v_price numeric;
  v_variants uuid[] := '{}'; v_qtys numeric[] := '{}'; v_prices numeric[] := '{}'; v_gross_lines numeric[] := '{}';
  v_nets numeric[]; v_gross numeric := 0; v_discount numeric := 0; v_net numeric; v_cogs numeric := 0;
  d record; v_cost numeric; v_value numeric; v_line_cogs numeric; n int; i int;
  v_items uuid[];
  v_journal uuid;
  v_disc_by uuid; v_disc_approved uuid; v_disc_reason text; v_turn int; v_line uuid;
  v_mods jsonb[] := '{}'; v_mod jsonb; v_mod_costs numeric[]; v_amounts numeric[]; v_shares numeric[];
  v_part numeric; v_mod_cost numeric; j int; k int;
  v_pay jsonb; v_paid numeric;
  -- When it was sold: now, or a sale made offline earlier today (0073).
  v_at timestamptz := coalesce(nullif(current_setting('sixties.sale_placed_at', true), '')::timestamptz, now());
  -- Deals (0089): what they gave away, the discount given besides, and each line's deal.
  v_deal numeric := 0; v_manual numeric := 0; v_after numeric; dk text; v_idx int[]; v_deal_row deal;
  v_dprice numeric; v_dgross numeric[]; v_dnets numeric[]; v_daddons numeric; v_given numeric;
  v_sale_deal uuid; v_line_deal uuid[];
  -- The service charge and the tip (0090), as the till sent them.
  v_service_on text := coalesce(current_setting('sixties.sale_service', true), '');
  v_tip numeric := nullif(current_setting('sixties.sale_tip', true), '')::numeric;
  v_pct numeric; v_service numeric := 0; v_due numeric;
begin
  -- Read once, for this sale alone.
  perform set_config('sixties.sale_service', '', true);
  perform set_config('sixties.sale_tip', '', true);
  v_tip := coalesce(v_tip, 0);
  if p_idempotency_key is null then
    raise exception 'A sale needs its idempotency key';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  v_pay := sale_payments(v_business, p_channel, p_tender, p_tenders);

  -- Replay: the same key returns the sale it already recorded.
  select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no, service_amount, tip_amount
    into v_existing
    from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'service', v_existing.service_amount, 'tip', v_existing.tip_amount,
             'turn_no', v_existing.turn_no, 'payments', order_payments(v_existing.id))
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  -- A way to pay taken out of use takes no new sale (0069).
  perform sale_methods_in_use(v_business, v_pay);
  if v_tip < 0 or v_tip <> money_round(v_business, v_tip) then
    raise exception 'A tip is a whole amount of 0 or more';
  end if;
  if v_tip > 0 and is_platform_channel(p_channel) then
    raise exception 'A delivery platform''s order takes no tip at the till';
  end if;
  if (p_discount_percent is not null or p_discount_amount is not null) and is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets its own discounts; none is given at the till';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, v_at);

  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
                           gross_amount, discount_amount, net_amount, cogs_amount, cashier_id,
                           customer_id, customer_address_id, delivery_address, placed_at, sold_offline_at,
                           device_id)
  values (v_business, v_location, p_channel, 'open', p_idempotency_key, 0, 0, 0, 0, v_me,
          (p_customer ->> 'customer_id')::uuid, (p_customer ->> 'address_id')::uuid, p_customer ->> 'address', v_at,
          nullif(current_setting('sixties.sale_sold_offline_at', true), '')::timestamptz,
          nullif(current_setting('sixties.sale_device', true), ''))
  on conflict (business_id, idempotency_key) do nothing
  returning id into v_order;
  if v_order is null then
    -- A concurrent request with this key won the race; return its sale.
    select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no, service_amount, tip_amount
      into v_existing
      from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'service', v_existing.service_amount, 'tip', v_existing.tip_amount,
             'turn_no', v_existing.turn_no, 'payments', order_payments(v_existing.id))
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  -- Each line: a product on sale, a quantity, and its add-ons as the product
  -- offers them, priced (0041).
  for l in select * from jsonb_array_elements(p_lines) loop
    v_variant := (l ->> 'variant_id')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = v_variant and pv.business_id = v_business and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    v_variants := v_variants || v_variant;
    v_qtys := v_qtys || v_qty;
    v_mods := array_append(v_mods, line_modifiers(v_business, v_variant, l -> 'modifiers', p_channel, v_location,
                                                  v_today, p_trust_line_prices));
  end loop;
  n := cardinality(v_variants);

  -- What the sale uses, its add-ons' included: locked in a stable order, then
  -- sold as each item's rule says (0040): refused, sold with a manager's
  -- approval, or sold and shown as an alert.
  select jsonb_agg(jsonb_build_object('item_id', u.item_id, 'qty', u.base_qty)) into v_needs
    from (select e.item_id, e.base_qty
            from generate_series(1, n) s(ix), lateral expand_variant(v_variants[s.ix], p_channel, v_qtys[s.ix], v_today) e
          union all
          select e.item_id, e.base_qty
            from generate_series(1, n) s(ix), lateral jsonb_array_elements(v_mods[s.ix]) a(m),
                 lateral expand_modifier((a.m ->> 'modifier_id')::uuid, v_variants[s.ix], p_channel,
                                         v_qtys[s.ix] * (a.m ->> 'qty')::numeric) e) u;
  select array_agg(distinct (x ->> 'item_id')::uuid) into v_items from jsonb_array_elements(v_needs) x;
  if v_items is not null then
    perform lock_items(v_items);
    v_stock_by := stock_rules(v_business, v_location, v_needs, v_me, p_stock_approval, 'negative_stock',
                              v_order::text);
  end if;

  -- Price every line first: its size and its add-ons, each one of the line;
  -- the discount is shared out over the whole bill.
  for i in 1 .. n loop
    l := p_lines -> (i - 1);
    -- A bill's printed price, passed by settle_tab alone (0025); otherwise today's.
    v_price := case when p_trust_line_prices and nullif(l ->> 'price', '') is not null
                    then (l ->> 'price')::numeric
                    else price_on(v_variants[i], p_channel, v_location, v_today) end;
    if v_price is null then
      raise exception 'No % price is set for this product', p_channel;
    end if;
    v_price := v_price + coalesce((select sum((x ->> 'price')::numeric * (x ->> 'qty')::numeric)
                                     from jsonb_array_elements(v_mods[i]) x), 0);
    v_prices := v_prices || v_price;
    v_gross_lines := v_gross_lines || money_round(v_business, v_price * v_qtys[i]);
    v_gross := v_gross + money_round(v_business, v_price * v_qtys[i]);
  end loop;

  -- Deals (0089): each one's lines at their own full price, what the deal
  -- gives away shared over them as their discount; a deal is one of each of
  -- its places, on now, at its price on the channel, its add-ons on top.
  v_nets := v_gross_lines;
  v_line_deal := array_fill(null::uuid, array[n]);
  for dk in select distinct e.x -> 'deal' ->> 'key' from jsonb_array_elements(p_lines) e(x)
             where jsonb_typeof(e.x -> 'deal') = 'object' loop
    if dk is null or length(dk) > 64 then raise exception 'A deal on the bill has no key'; end if;
    select array_agg(o::int order by o) into v_idx
      from jsonb_array_elements(p_lines) with ordinality e(x, o) where e.x -> 'deal' ->> 'key' = dk;
    if (select count(distinct p_lines -> (ix - 1) -> 'deal' ->> 'deal_id') from unnest(v_idx) ix) <> 1 then
      raise exception 'A deal on the bill is mixed with another';
    end if;
    select * into v_deal_row from deal
     where id = (p_lines -> (v_idx[1] - 1) -> 'deal' ->> 'deal_id')::uuid and business_id = v_business;
    if not found or not deal_on(v_deal_row, v_at) then
      raise exception 'That deal is not on now';
    end if;
    select price into v_dprice from deal_price where deal_id = v_deal_row.id and channel = p_channel;
    if v_dprice is null or is_platform_channel(p_channel) then
      raise exception 'That deal is not sold on this channel';
    end if;
    if not deal_fills(v_deal_row.id, (select array_agg(v_variants[ix] order by ix) from unnest(v_idx) ix),
                      (select array_agg(v_qtys[ix] order by ix) from unnest(v_idx) ix)) then
      raise exception 'A deal is one of each of the things in it';
    end if;
    select array_agg(v_gross_lines[ix] order by ix) into v_dgross from unnest(v_idx) ix;
    select coalesce(sum(money_round(v_business, v_qtys[ix] * coalesce(
             (select sum((x ->> 'price')::numeric * (x ->> 'qty')::numeric) from jsonb_array_elements(v_mods[ix]) x), 0))), 0)
      into v_daddons from unnest(v_idx) ix;
    v_given := greatest((select sum(g) from unnest(v_dgross) g) - (v_dprice + v_daddons), 0);
    if v_given > 0 then
      v_dnets := allocate_landed(v_business, v_dgross, -v_given);
      for j in 1 .. cardinality(v_idx) loop
        v_nets[v_idx[j]] := v_dnets[j];
      end loop;
    end if;
    v_deal := v_deal + v_given;
    insert into sale_deal (business_id, sales_order_id, deal_id, deal_key, name, full_amount, deal_amount, given)
    values (v_business, v_order, v_deal_row.id, dk, v_deal_row.name, (select sum(g) from unnest(v_dgross) g),
            (select sum(g) from unnest(v_dgross) g) - v_given, v_given)
    returning id into v_sale_deal;
    for j in 1 .. cardinality(v_idx) loop
      v_line_deal[v_idx[j]] := v_sale_deal;
    end loop;
  end loop;

  -- Each line's share of the discount given besides, in proportion to what
  -- is left of it, adding up to the discount exactly (the rounding method
  -- receipts use for landed costs).
  v_after := v_gross - v_deal;
  v_manual := sale_discount(v_business, v_after, p_discount_percent, p_discount_amount);
  if v_manual > 0 then
    v_nets := allocate_landed(v_business, v_nets, -v_manual);
    -- Who gave it, why, and who approved it (0028).
    if coalesce((p_discount ->> 'checked')::boolean, false) then
      v_disc_by := (p_discount ->> 'by')::uuid;
      v_disc_approved := (p_discount ->> 'approved_by')::uuid;
      v_disc_reason := p_discount ->> 'reason';
    else
      v_disc_reason := reason_text('discount', p_discount ->> 'reason', p_discount ->> 'note');
      v_disc_by := v_me;
      v_disc_approved := discount_approver(v_business, v_after, p_discount_percent, p_discount_amount,
                                           (p_discount ->> 'approval')::uuid, v_order::text);
    end if;
  end if;
  v_discount := v_deal + v_manual;
  v_net := v_gross - v_discount;

  -- The service charge of this way of selling (0090), on what the products
  -- come to after discounts: at the till or a table's bill, unless someone
  -- who may give discounts takes it off this sale.
  if v_service_on <> '' then
    select percent into v_pct from service_charge where business_id = v_business and channel = p_channel;
  end if;
  if v_pct is not null and v_service_on = 'off' then
    if not current_has_permission('discount.apply') then
      raise exception 'You do not have permission to take the service charge off' using errcode = '42501';
    end if;
    perform audit_event(v_business, 'sale.no_service', 'sales_order', v_order::text, null,
      jsonb_build_object('percent', v_pct), null);
    v_pct := null;
  end if;
  if v_pct is not null then
    v_service := money_round(v_business, v_net * v_pct / 100);
  end if;
  v_due := v_net + v_service + v_tip;

  -- The total the till showed (0025), then the payments: together they come to
  -- the net exactly (0042). The old single tender pays all of it.
  perform assert_sale_total(jsonb_build_object('net', v_net), p_expected_net);
  select jsonb_agg(case when jsonb_typeof(x -> 'amount') = 'null' then x || jsonb_build_object('amount', v_due)
                        else x end order by o)
    into v_pay from jsonb_array_elements(v_pay) with ordinality e(x, o);
  select sum((x ->> 'amount')::numeric) into v_paid from jsonb_array_elements(v_pay) x;
  if v_paid <> v_due then
    raise exception 'The payments come to %, not the % to pay', trim_scale(v_paid), trim_scale(v_due);
  end if;
  -- Dollars at the rate now, worth at least what they pay (0043).
  v_pay := sale_dollars(v_business, v_pay);

  for i in 1 .. n loop
    -- One costed movement per component per line, and per add-on, so every
    -- figure ties: line COGS = its movements; order COGS = all movements =
    -- the journal. Cost first, then write the line once: lines are
    -- append-only. Each movement names its line (0037), so a refund of the
    -- line takes back its own stock, its add-ons' included.
    v_line := gen_random_uuid();
    v_line_cogs := 0;
    for d in select * from expand_variant(v_variants[i], p_channel, v_qtys[i], v_today) loop
      v_cost := item_issue_cost(v_business, d.item_id, v_location);
      v_value := money_round(v_business, v_cost * d.base_qty);
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                      unit_cost, value, reference_type, reference_id, app_user_id, reason,
                                      sales_order_line_id)
      values (v_business, d.item_id, v_location, 'sale_consumption', -d.base_qty,
              case when d.base_qty > 0 then v_value / d.base_qty end, v_value,
              'sales_order', v_order, v_me, 'Sale', v_line);
      v_line_cogs := v_line_cogs + v_value;
    end loop;
    v_mod_costs := '{}';
    v_amounts := '{}';
    k := coalesce(jsonb_array_length(v_mods[i]), 0);
    for j in 1 .. k loop
      v_mod := v_mods[i] -> (j - 1);
      v_mod_cost := 0;
      for d in select * from expand_modifier((v_mod ->> 'modifier_id')::uuid, v_variants[i], p_channel,
                                             v_qtys[i] * (v_mod ->> 'qty')::numeric) loop
        v_cost := item_issue_cost(v_business, d.item_id, v_location);
        v_value := money_round(v_business, v_cost * d.base_qty);
        insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                        unit_cost, value, reference_type, reference_id, app_user_id, reason,
                                        sales_order_line_id)
        values (v_business, d.item_id, v_location, 'sale_consumption', -d.base_qty,
                case when d.base_qty > 0 then v_value / d.base_qty end, v_value,
                'sales_order', v_order, v_me, 'Sale: ' || (v_mod ->> 'name'), v_line);
        v_mod_cost := v_mod_cost + v_value;
      end loop;
      v_mod_costs := v_mod_costs || v_mod_cost;
      v_line_cogs := v_line_cogs + v_mod_cost;
      v_amounts := v_amounts || money_round(v_business, (v_mod ->> 'price')::numeric * (v_mod ->> 'qty')::numeric
                                                        * v_qtys[i]);
    end loop;

    insert into sales_order_line (id, sales_order_id, product_variant_id, quantity, unit_price, line_discount, line_net,
                                  cogs_amount, sale_deal_id)
    values (v_line, v_order, v_variants[i], v_qtys[i], v_prices[i], v_gross_lines[i] - v_nets[i], v_nets[i],
            v_line_cogs, v_line_deal[i]);
    v_cogs := v_cogs + v_line_cogs;

    -- The add-ons as they were sold: each its amount and its share of the
    -- line's discount, the size keeping the rest.
    if k > 0 then
      v_part := v_gross_lines[i] - (select coalesce(sum(a), 0) from unnest(v_amounts) a);
      if v_nets[i] < v_gross_lines[i] then
        v_shares := allocate_landed(v_business, array[v_part] || v_amounts, v_nets[i] - v_gross_lines[i]);
      else
        v_shares := array[v_part] || v_amounts;
      end if;
      for j in 1 .. k loop
        v_mod := v_mods[i] -> (j - 1);
        insert into sales_order_line_modifier (business_id, sales_order_id, sales_order_line_id, modifier_id, group_id,
                                               name, qty, unit_price, amount, net_amount, cost, position)
        values (v_business, v_order, v_line, (v_mod ->> 'modifier_id')::uuid, (v_mod ->> 'group_id')::uuid,
                v_mod ->> 'name', (v_mod ->> 'qty')::numeric * v_qtys[i], (v_mod ->> 'price')::numeric,
                v_amounts[j], v_shares[j + 1], v_mod_costs[j], j);
      end loop;
    end if;
  end loop;

  -- Each payment in its order; a cash one is also the drawer's, a payment in
  -- dollars the dollars' (trg_cash_from_tender); one by a way to pay says
  -- which, with the reference shown (0069).
  insert into sales_tender (sales_order_id, tender_type, amount, received, position, currency, foreign_amount, rate,
                            payment_method_id, reference, pre_order_id, on_account_customer)
  select v_order, (x ->> 'type')::tender_type, (x ->> 'amount')::numeric, (x ->> 'received')::numeric, o,
         coalesce(x ->> 'currency', 'IQD'), (x ->> 'usd')::numeric, (x ->> 'rate')::numeric,
         (x ->> 'method')::uuid, x ->> 'reference', (x ->> 'pre_order')::uuid, (x ->> 'on_account')::uuid
    from jsonb_array_elements(v_pay) with ordinality e(x, o)
   order by o;

  -- Its turn number (0034): the bill's own, or the next of the day. Taken in
  -- the sale's own transaction, so a sale refused takes none.
  v_turn := coalesce(p_turn_no, take_turn_no(v_business, v_today, v_location));
  update sales_order
     set gross_amount = v_gross, discount_amount = v_discount, net_amount = v_net, cogs_amount = v_cogs,
         discount_percent = case when v_manual > 0 then p_discount_percent end,
         discount_by = v_disc_by, discount_approved_by = v_disc_approved, discount_reason = v_disc_reason,
         service_percent = v_pct, service_amount = v_service, tip_amount = v_tip,
         status = 'completed', turn_no = v_turn
   where id = v_order;

  -- Each payment's account debited with what it paid (one line per account),
  -- revenue at the full price, the discount on its own line (none posts when
  -- it is zero). Dollars are debited to 1001 at their value, and their change
  -- in dinars leaves 1000 (0043). A way to pay's is debited to its own
  -- account (0069).
  v_journal := post_journal(v_business, v_at, 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
    coalesce((select jsonb_agg(signed_line(a.code, a.amount) order by a.pos)
                from (select p.code, sum(p.amount) as amount, min(p.pos) as pos
                        from jsonb_array_elements(v_pay) with ordinality e(x, o)
                        cross join lateral (
                          select coalesce(x ->> 'account', tender_account((x ->> 'type')::tender_type)) as code,
                                 case when x ->> 'currency' = 'USD'
                                      then (x ->> 'amount')::numeric - (x ->> 'received')::numeric
                                      else (x ->> 'amount')::numeric end as amount, o as pos
                          union all
                          select '1001', (x ->> 'received')::numeric, o where x ->> 'currency' = 'USD') p
                       group by p.code) a), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('code', '4100', 'debit', v_discount),
      jsonb_build_object('code', '4000', 'credit', v_gross),
      jsonb_build_object('code', '4300', 'credit', v_service),
      jsonb_build_object('code', '2200', 'credit', v_tip),
      jsonb_build_object('code', '5000', 'debit', v_cogs),
      jsonb_build_object('code', '1200', 'credit', v_cogs)));

  if v_manual > 0 then
    perform audit_event(v_business, 'sale.discount', 'sales_order', v_order::text, v_disc_reason, null,
      jsonb_build_object('gross', v_after, 'discount', v_manual, 'percent', p_discount_percent,
                         'amount', p_discount_amount, 'given_by', v_disc_by, 'approved_by', v_disc_approved));
  end if;

  return jsonb_build_object('order_id', v_order, 'gross', v_gross, 'discount', v_discount, 'net', v_net,
    'deal_discount', v_deal, 'service', v_service, 'service_percent', v_pct, 'tip', v_tip, 'due', v_due,
    'journal_no', (select journal_no from journal_entry where id = v_journal), 'replayed', false,
    'turn_no', v_turn, 'payments', order_payments(v_order))
    || sale_cost_view(v_cogs);
end $$;

-- =============================================================================
-- 4. The till sends the tip, and whether the service charge is added
-- =============================================================================
-- Each of the four ways a sale is paid at the till, as it was, kept under
-- another name for the one that takes p_tip and p_no_service to call.
alter function record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid,
                           text, uuid, jsonb, uuid, uuid, int)
  rename to record_sale_0050;
alter function settle_tab(uuid, int, uuid, tender_type, numeric, uuid, jsonb, uuid, uuid, int)
  rename to settle_tab_0050;
alter function settle_tab_offline(uuid, int, uuid, timestamptz, jsonb, numeric, uuid, text)
  rename to settle_tab_offline_0082;
alter function record_offline_sale(uuid, sales_channel, jsonb, timestamptz, tender_type, jsonb, uuid, numeric, text,
                                   uuid, text)
  rename to record_offline_sale_0073;
revoke execute on function
  record_sale_0050(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text,
                   uuid, jsonb, uuid, uuid, int),
  settle_tab_0050(uuid, int, uuid, tender_type, numeric, uuid, jsonb, uuid, uuid, int),
  settle_tab_offline_0082(uuid, int, uuid, timestamptz, jsonb, numeric, uuid, text),
  record_offline_sale_0073(uuid, sales_channel, jsonb, timestamptz, tender_type, jsonb, uuid, numeric, text, uuid, text)
  from public, anon, authenticated;

create or replace function record_sale(p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type, p_lines jsonb,
  p_location uuid default null, p_discount_percent numeric default null, p_discount_amount numeric default null,
  p_expected_net numeric default null, p_discount_reason text default null, p_discount_note text default null,
  p_approval uuid default null, p_platform_order_no text default null, p_stock_approval uuid default null,
  p_tenders jsonb default null, p_customer uuid default null, p_address uuid default null,
  p_rewards int default null, p_tip numeric default null, p_no_service boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform sale_extras(p_tip, p_no_service);
  return record_sale_0050(p_idempotency_key, p_channel, p_tender, p_lines, p_location, p_discount_percent,
    p_discount_amount, p_expected_net, p_discount_reason, p_discount_note, p_approval, p_platform_order_no,
    p_stock_approval, p_tenders, p_customer, p_address, p_rewards);
end $$;

create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type,
  p_expected_net numeric default null, p_stock_approval uuid default null, p_tenders jsonb default null,
  p_customer uuid default null, p_address uuid default null, p_rewards int default null,
  p_tip numeric default null, p_no_service boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform sale_extras(p_tip, p_no_service);
  return settle_tab_0050(p_tab, p_version, p_idempotency_key, p_tender, p_expected_net, p_stock_approval, p_tenders,
    p_customer, p_address, p_rewards);
end $$;

create or replace function settle_tab_offline(p_tab uuid, p_version int, p_idempotency_key uuid,
  p_sold_at timestamptz, p_tenders jsonb, p_expected_net numeric default null, p_sold_by uuid default null,
  p_device text default null, p_tip numeric default null, p_no_service boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform sale_extras(p_tip, p_no_service);
  return settle_tab_offline_0082(p_tab, p_version, p_idempotency_key, p_sold_at, p_tenders, p_expected_net,
    p_sold_by, p_device);
end $$;

create or replace function record_offline_sale(p_idempotency_key uuid, p_channel sales_channel, p_lines jsonb,
  p_sold_at timestamptz, p_tender tender_type default null, p_tenders jsonb default null,
  p_location uuid default null, p_expected_net numeric default null, p_platform_order_no text default null,
  p_sold_by uuid default null, p_device text default null, p_tip numeric default null,
  p_no_service boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform sale_extras(p_tip, p_no_service);
  return record_offline_sale_0073(p_idempotency_key, p_channel, p_lines, p_sold_at, p_tender, p_tenders, p_location,
    p_expected_net, p_platform_order_no, p_sold_by, p_device);
end $$;

-- =============================================================================
-- 5. Who shares the tips
-- =============================================================================
-- A person ticked to share the tips, from a day, until a day when unticked:
-- each day's tips are shared as the list stood that day.
create table if not exists tip_sharer (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business (id) on delete cascade,
  employee_id uuid not null references employee (id),
  from_day    date not null,
  until_day   date,
  set_by      uuid references app_user (id),
  created_at  timestamptz not null default now(),
  constraint tip_sharer_days check (until_day is null or until_day >= from_day - 1)
);
create unique index if not exists tip_sharer_open on tip_sharer (business_id, employee_id) where until_day is null;
create index if not exists tip_sharer_employee on tip_sharer (employee_id);
alter table tip_sharer enable row level security;
alter table tip_sharer force row level security;
drop policy if exists member_read on tip_sharer;
create policy member_read on tip_sharer for select to authenticated
  using (business_id = (select current_business_id()));
grant select on tip_sharer to authenticated;

-- p_employees: everyone who shares the tips from today; the rest stop
-- sharing from today (their earlier days stay as they were).
create or replace function set_tip_sharers(p_employees uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_today date := business_local_date(v_business, now());
  v_before uuid[]; v_after uuid[] := coalesce(p_employees, '{}');
begin
  perform 1 from business where id = v_business for update;
  if exists (select 1 from unnest(v_after) x
              where not exists (select 1 from employee e where e.id = x and e.business_id = v_business)) then
    raise exception 'That person is not on Staff';
  end if;
  if exists (select 1 from unnest(v_after) x join employee e on e.id = x
              where e.left_on is not null and e.left_on < v_today) then
    raise exception 'Someone who has left does not share the tips';
  end if;
  select coalesce(array_agg(employee_id order by employee_id), '{}') into v_before
    from tip_sharer where business_id = v_business and until_day is null;
  -- Unticked today: a row begun today goes; an older one ends yesterday.
  delete from tip_sharer where business_id = v_business and until_day is null and from_day = v_today
     and not (employee_id = any (v_after));
  update tip_sharer set until_day = v_today - 1
   where business_id = v_business and until_day is null and not (employee_id = any (v_after));
  insert into tip_sharer (business_id, employee_id, from_day, set_by)
  select v_business, x, v_today, (current_member()).id from (select distinct unnest(v_after) as x) u
   where not exists (select 1 from tip_sharer t where t.business_id = v_business and t.employee_id = u.x
                       and t.until_day is null);
  perform audit_event(v_business, 'payroll.tip_sharers', 'business', v_business::text, null,
    jsonb_build_object('employees', to_jsonb(v_before)),
    jsonb_build_object('employees', (select to_jsonb(coalesce(array_agg(x order by x), '{}'))
                                       from (select distinct unnest(v_after) as x) u)));
  return jsonb_build_object('employees', (select coalesce(jsonb_agg(employee_id), '[]'::jsonb) from tip_sharer
                                           where business_id = v_business and until_day is null));
end $$;

-- Each day's tips at each branch, and each person's share of them: shared
-- equally between those ticked that day who work at that branch (or at
-- every branch) and were employed — those of them who clocked in that day,
-- or all of them when none did. When nobody at the branch shares them, all
-- who share them do. The first by name takes what rounding leaves. A day
-- whose tips have nobody to share them has a row with no one.
create or replace function tip_shares(p_business uuid, p_from date, p_to date)
returns table (work_day date, location_id uuid, tips numeric, employee_id uuid, amount numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  d record; v_people uuid[]; v_worked uuid[]; v_n int; v_each numeric; i int; b record;
begin
  b := local_day_bounds(p_business, p_from, p_to);
  for d in
    select business_local_date(p_business, o.placed_at) as day, o.location_id as loc, sum(o.tip_amount) as total
      from sales_order o
     where o.business_id = p_business and o.tip_amount > 0 and o.status not in ('voided', 'open')
       and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
     group by 1, 2
     order by 1, 2
  loop
    -- Those ticked that day and employed, at this branch first.
    select array_agg(e.id order by e.full_name, e.id) into v_people
      from employee e
     where e.business_id = p_business and works_on(e, d.day)
       and (e.location_id is null or e.location_id = d.loc)
       and exists (select 1 from tip_sharer t where t.employee_id = e.id and t.from_day <= d.day
                     and (t.until_day is null or t.until_day >= d.day));
    if v_people is null then
      select array_agg(e.id order by e.full_name, e.id) into v_people
        from employee e
       where e.business_id = p_business and works_on(e, d.day)
         and exists (select 1 from tip_sharer t where t.employee_id = e.id and t.from_day <= d.day
                       and (t.until_day is null or t.until_day >= d.day));
    end if;
    -- Of them, those who clocked in that day.
    select array_agg(x order by o) into v_worked
      from unnest(v_people) with ordinality u(x, o)
     where exists (select 1 from attendance a where a.employee_id = u.x and a.work_day = d.day
                     and a.cancelled_at is null);
    if v_worked is not null then v_people := v_worked; end if;
    v_n := coalesce(cardinality(v_people), 0);
    if v_n = 0 then
      work_day := d.day; location_id := d.loc; tips := d.total; employee_id := null; amount := d.total;
      return next;
      continue;
    end if;
    v_each := money_round(p_business, d.total / v_n);
    for i in 1 .. v_n loop
      work_day := d.day; location_id := d.loc; tips := d.total; employee_id := v_people[i];
      amount := case when i = 1 then d.total - v_each * (v_n - 1) else v_each end;
      return next;
    end loop;
  end loop;
end $$;

-- A person's share of the tips in a month, for their pay.
create or replace function tips_earned(p_business uuid, p_employee uuid, p_month date) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(s.amount), 0)
    from tip_shares(p_business, p_month, (p_month + interval '1 month - 1 day')::date) s
   where s.employee_id = p_employee
$$;

-- The month's tips on Payroll: who shares them, each day's split, and each
-- person's total.
create or replace function tips_month(p_month date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.view');
  v_month date := date_trunc('month', coalesce(p_month, business_local_date(v_business, now())))::date;
  v_today date := business_local_date(v_business, now());
begin
  return jsonb_build_object(
    'month', v_month,
    'sharers', coalesce((select jsonb_agg(jsonb_build_object('employee_id', e.id, 'name', e.full_name,
                                                              'from', t.from_day) order by e.full_name)
                           from tip_sharer t join employee e on e.id = t.employee_id
                          where t.business_id = v_business and t.until_day is null), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', x.work_day, 'location', l.name, 'tips', x.tips,
                                          'today', x.work_day = v_today, 'shares', x.shares)
                       order by x.work_day desc, l.name)
        from (select s.work_day, s.location_id, max(s.tips) as tips,
                     jsonb_agg(jsonb_build_object('employee_id', s.employee_id, 'name', e.full_name,
                                                  'amount', s.amount) order by e.full_name nulls last) as shares
                from tip_shares(v_business, v_month, (v_month + interval '1 month - 1 day')::date) s
                left join employee e on e.id = s.employee_id
               group by s.work_day, s.location_id) x
        left join location l on l.id = x.location_id), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('employee_id', s.employee_id, 'name', e.full_name, 'amount', s.total)
                       order by e.full_name)
        from (select employee_id, sum(amount) as total
                from tip_shares(v_business, v_month, (v_month + interval '1 month - 1 day')::date)
               where employee_id is not null group by employee_id) s
        join employee e on e.id = s.employee_id), '[]'::jsonb),
    'unshared', (select coalesce(sum(amount), 0)
                   from tip_shares(v_business, v_month, (v_month + interval '1 month - 1 day')::date)
                  where employee_id is null),
    'total', (select coalesce(sum(amount), 0)
                from tip_shares(v_business, v_month, (v_month + interval '1 month - 1 day')::date)));
end $$;

-- =============================================================================
-- 6. The tips in the pay
-- =============================================================================
alter table payroll_line add column if not exists tips numeric not null default 0;
-- A line is written while its run is a draft; this changes no line's figures.
alter table payroll_line drop constraint if exists payroll_line_gross;
alter table payroll_line add constraint payroll_line_gross
  check (gross = base_pay + overtime_pay + additions + tips - deductions);
do $$ begin
  alter table payroll_line add constraint payroll_line_tips check (tips >= 0);
exception when duplicate_object then null; end $$;

-- 0064's payroll_refresh, with each person's tips (0090).
create or replace function payroll_refresh(p_business uuid, p_run uuid) returns void
language plpgsql set search_path = public as $$
declare
  r payroll_run; e employee; f record; l payroll_line; v_start date; v_end date; v_owed numeric; v_gross numeric;
  v_recover numeric; v_ded numeric; v_tips numeric;
begin
  select * into r from payroll_run where id = p_run;
  v_start := r.month;
  v_end := (r.month + interval '1 month - 1 day')::date;
  -- Someone not employed that month leaves the payroll. A line paid from once
  -- (a payment since cancelled, which is kept for good) stays, at nothing (0064).
  update payroll_line x
     set base_pay = 0, overtime_pay = 0, additions = 0, deductions = 0, tips = 0, advance_owed = 0,
         advance_recovered = 0,
         recovery_set = false, gross = 0, net = 0, days_employed = 0, days_worked = 0, minutes_worked = 0,
         overtime_minutes = 0, days_scheduled = 0, days_absent = 0, times_late = 0, minutes_late = 0,
         still_in = false
   where x.run_id = r.id
     and not exists (select 1 from employee y where y.id = x.employee_id and y.hired_on <= v_end
                       and (y.left_on is null or y.left_on >= v_start))
     and exists (select 1 from salary_payment_line pl where pl.line_id = x.id);
  delete from payroll_line x where x.run_id = r.id
     and not exists (select 1 from employee y where y.id = x.employee_id and y.hired_on <= v_end
                       and (y.left_on is null or y.left_on >= v_start))
     and not exists (select 1 from salary_payment_line pl where pl.line_id = x.id);
  for e in select * from employee y where y.business_id = p_business and y.hired_on <= v_end
                                     and (y.left_on is null or y.left_on >= v_start)
            order by y.full_name loop
    select * into f from payroll_figures(p_business, e, r.month);
    select * into l from payroll_line x where x.run_id = r.id and x.employee_id = e.id;
    v_owed := advance_owed(p_business, e.id);
    -- Deductions beyond what is now earned are cut to it.
    v_ded := least(coalesce(l.deductions, 0), f.base_pay + f.overtime_pay + coalesce(l.additions, 0));
    -- Their share of each day's tips that month (0090).
    v_tips := tips_earned(p_business, e.id, r.month);
    v_gross := f.base_pay + f.overtime_pay + coalesce(l.additions, 0) + v_tips - v_ded;
    v_recover := case when coalesce(l.recovery_set, false) then least(l.advance_recovered, greatest(v_owed, 0), v_gross)
                      else least(greatest(v_owed, 0), v_gross) end;
    if l.id is null then
      insert into payroll_line (run_id, business_id, employee_id, pay_basis, rate, standard_hours, overtime_percent,
                                days_in_month, days_employed, days_worked, minutes_worked, overtime_minutes,
                                days_scheduled, days_absent, times_late, minutes_late, still_in, base_pay, overtime_pay,
                                tips, advance_owed, advance_recovered, gross, net)
      values (r.id, p_business, e.id, e.pay_basis, e.rate, e.standard_hours, f.overtime_percent,
              f.days_in_month, f.days_employed, f.days_worked, f.minutes_worked, f.overtime_minutes,
              f.days_scheduled, f.days_absent, f.times_late, f.minutes_late, f.still_in, f.base_pay, f.overtime_pay,
              v_tips, v_owed, v_recover, v_gross, v_gross - v_recover);
    else
      update payroll_line set pay_basis = e.pay_basis, rate = e.rate, standard_hours = e.standard_hours,
             overtime_percent = f.overtime_percent, days_in_month = f.days_in_month,
             days_employed = f.days_employed, days_worked = f.days_worked, minutes_worked = f.minutes_worked,
             overtime_minutes = f.overtime_minutes, days_scheduled = f.days_scheduled, days_absent = f.days_absent,
             times_late = f.times_late, minutes_late = f.minutes_late, still_in = f.still_in,
             base_pay = f.base_pay, overtime_pay = f.overtime_pay, tips = v_tips,
             deductions = v_ded,
             advance_owed = v_owed, advance_recovered = v_recover, gross = v_gross, net = v_gross - v_recover
       where id = l.id;
    end if;
  end loop;
  update payroll_run set drafted_at = now(), drafted_by = (current_member()).id where id = r.id;
end $$;

-- 0064's payroll_current: the tips as they stand too (0090).
create or replace function payroll_current(p_business uuid, p_run uuid) returns boolean
language plpgsql stable set search_path = public as $$
declare r payroll_run; e employee; f record; l payroll_line; v_start date; v_end date;
begin
  select * into r from payroll_run where id = p_run;
  v_start := r.month;
  v_end := (r.month + interval '1 month - 1 day')::date;
  if exists (select 1 from payroll_line x join employee y on y.id = x.employee_id
              where x.run_id = r.id and not (y.hired_on <= v_end and (y.left_on is null or y.left_on >= v_start))
                -- A line paid from once, kept at nothing, is as it should be (0064).
                and not (x.gross = 0 and x.net = 0 and x.advance_recovered = 0
                         and exists (select 1 from salary_payment_line pl where pl.line_id = x.id))) then
    return false;
  end if;
  for e in select * from employee y where y.business_id = p_business and y.hired_on <= v_end
                                     and (y.left_on is null or y.left_on >= v_start) loop
    select * into l from payroll_line x where x.run_id = r.id and x.employee_id = e.id;
    if l.id is null then return false; end if;
    select * into f from payroll_figures(p_business, e, r.month);
    if (l.pay_basis, l.rate, l.standard_hours, l.overtime_percent, l.days_employed, l.days_worked, l.minutes_worked,
        l.overtime_minutes, l.still_in, l.base_pay, l.overtime_pay, l.tips)
       is distinct from (e.pay_basis, e.rate, e.standard_hours, f.overtime_percent, f.days_employed, f.days_worked,
                         f.minutes_worked, f.overtime_minutes, f.still_in, f.base_pay, f.overtime_pay,
                         tips_earned(p_business, e.id, r.month)) then
      return false;
    end if;
    if l.advance_recovered > greatest(advance_owed(p_business, e.id), 0)
       or (not l.recovery_set and l.advance_recovered <> least(greatest(advance_owed(p_business, e.id), 0), l.gross)) then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- 0049's adjust_payroll_line__run: the tips are part of the pay (0090).
create or replace function adjust_payroll_line__run(p_line uuid, p_additions numeric, p_additions_note text,
                                                    p_deductions numeric, p_deductions_note text,
                                                    p_advance_recovered numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  l payroll_line; r payroll_run; e employee;
  v_add numeric := money_round(v_business, coalesce(p_additions, 0));
  v_ded numeric := money_round(v_business, coalesce(p_deductions, 0));
  v_rec numeric := money_round(v_business, p_advance_recovered);
  v_owed numeric; v_gross numeric;
begin
  select * into l from payroll_line where id = p_line and business_id = v_business;
  if not found then raise exception 'Payroll line not found'; end if;
  select * into r from payroll_run where id = l.run_id for update;
  if r.status <> 'draft' then raise exception 'Only a draft payroll changes: this one is approved'; end if;
  select * into l from payroll_line where id = p_line for update;
  e := staff_member(v_business, l.employee_id);
  if v_add < 0 or v_ded < 0 or v_rec < 0 then raise exception 'Enter amounts of zero or more'; end if;
  if v_add > 0 and nullif(trim(p_additions_note), '') is null then raise exception 'Say what the addition is for'; end if;
  if v_ded > 0 and nullif(trim(p_deductions_note), '') is null then raise exception 'Say what the deduction is for'; end if;
  if v_ded > l.base_pay + l.overtime_pay + v_add then
    raise exception 'The deductions are more than % earned (%)', e.full_name, trim_scale(l.base_pay + l.overtime_pay + v_add);
  end if;
  v_gross := l.base_pay + l.overtime_pay + v_add + l.tips - v_ded;
  v_owed := greatest(advance_owed(v_business, e.id), 0);
  if v_rec is not null and v_rec > v_owed then
    raise exception '% owes % of advances: take back no more than that', e.full_name, trim_scale(v_owed);
  end if;
  if v_rec is not null and v_rec > v_gross then
    raise exception 'Take back no more of the advances than the pay (%)', trim_scale(v_gross);
  end if;
  update payroll_line
     set additions = v_add, additions_note = case when v_add > 0 then trim(p_additions_note) end,
         deductions = v_ded, deductions_note = case when v_ded > 0 then trim(p_deductions_note) end,
         advance_owed = v_owed, advance_recovered = coalesce(v_rec, least(v_owed, v_gross)),
         recovery_set = v_rec is not null, gross = v_gross, net = v_gross - coalesce(v_rec, least(v_owed, v_gross))
   where id = l.id;
  return jsonb_build_object('line_id', l.id, 'run_id', r.id, 'name', e.full_name,
    'before', jsonb_build_object('additions', l.additions, 'additions_note', l.additions_note,
                                 'deductions', l.deductions, 'deductions_note', l.deductions_note,
                                 'advance_recovered', l.advance_recovered, 'net', l.net),
    'after', (select jsonb_build_object('name', e.full_name, 'additions', x.additions, 'additions_note', x.additions_note,
                                        'deductions', x.deductions, 'deductions_note', x.deductions_note,
                                        'advance_recovered', x.advance_recovered, 'net', x.net)
                from payroll_line x where x.id = l.id));
end $$;

-- 0049's approve_payroll__run: the tips debited to 2200, not to the salaries' cost (0090).
create or replace function approve_payroll__run(p_run uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  v_tz text := (select timezone from business where id = v_business);
  v_today date := business_local_date(v_business, now());
  r payroll_run; v_end date; v_gross numeric; v_net numeric; v_rec numeric; v_journal uuid; v_name text;
  v_tips numeric;
  v_since timestamptz; v_approval uuid := gen_random_uuid();
begin
  select * into r from payroll_run where id = p_run and business_id = v_business for update;
  if not found then raise exception 'Payroll not found'; end if;
  if r.status <> 'draft' then raise exception 'This payroll is approved already'; end if;
  v_end := (r.month + interval '1 month - 1 day')::date;
  if v_end >= v_today then
    raise exception 'The pay for % is approved once the month is over', payroll_month_text(r.month);
  end if;
  perform 1 from employee y where y.business_id = v_business order by y.id for update;
  if not exists (select 1 from payroll_line where run_id = r.id) then
    raise exception 'Nobody worked here in %: there is no pay to approve', payroll_month_text(r.month);
  end if;
  select e.full_name, a.clock_in into v_name, v_since
    from payroll_line l join employee e on e.id = l.employee_id
    join attendance a on a.employee_id = e.id and a.clock_out is null and a.cancelled_at is null
                     and a.work_day <= v_end
   where l.run_id = r.id limit 1;
  if found then
    raise exception '% is still clocked in since %: clock them out or correct the hours first', v_name,
      to_char(v_since at time zone v_tz, 'DD Mon HH24:MI');
  end if;
  select e.full_name into v_name from payroll_line l join employee e on e.id = l.employee_id
   where l.run_id = r.id and l.rate is null order by e.full_name limit 1;
  if found then raise exception 'Set %''s pay on Staff, then draft the payroll again', v_name; end if;
  if not payroll_current(v_business, r.id) then
    raise exception 'The hours or the pay changed since this draft: draft it again, check it, then approve it';
  end if;
  select coalesce(sum(gross), 0), coalesce(sum(net), 0), coalesce(sum(advance_recovered), 0),
         coalesce(sum(tips), 0)
    into v_gross, v_net, v_rec, v_tips from payroll_line where run_id = r.id;
  if v_gross > 0 then
    v_journal := post_journal(v_business, (v_end + time '12:00') at time zone v_tz,
      'Payroll ' || payroll_month_text(r.month) || ' (' || r.run_no || ')', 'payroll_approval', v_approval,
      -- The tips were never the café's cost: they come out of what it held for the staff (0090).
      jsonb_build_array(jsonb_build_object('code', '6100', 'debit', v_gross - v_tips),
                        jsonb_build_object('code', '2200', 'debit', v_tips),
                        jsonb_build_object('code', '2100', 'credit', v_net),
                        jsonb_build_object('code', '1300', 'credit', v_rec)));
  end if;
  insert into payroll_approval (id, business_id, run_id, approved_by, gross, net, advances_recovered, journal_entry_id)
  values (v_approval, v_business, r.id, v_me, v_gross, v_net, v_rec, v_journal);
  update payroll_run set status = case when v_net = 0 then 'paid' else 'approved' end, approved_by = v_me,
                         approved_at = now(), journal_entry_id = v_journal
   where id = r.id;
  return jsonb_build_object('run_id', r.id, 'run_no', r.run_no, 'month', r.month,
    'status', case when v_net = 0 then 'paid' else 'approved' end,
    'people', (select count(*) from payroll_line where run_id = r.id),
    'gross', v_gross, 'net', v_net, 'advances_recovered', v_rec,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- 0056's share of a payroll's salaries' cost by place: the pay less the tips,
-- which are not the café's cost.
create or replace function payroll_gross_by_place(p_run uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(x.location_id::text, x.gross), '{}'::jsonb)
    from (select e.location_id, sum(pl.gross - pl.tips) as gross
            from payroll_line pl join employee e on e.id = pl.employee_id
           where pl.run_id = p_run
           group by e.location_id having sum(pl.gross - pl.tips) <> 0) x
$$;

-- =============================================================================
-- 7. What the till took of both
-- =============================================================================
-- For Sales analysis and the end of the day: the service charge and the
-- tips the sales of the days took (none voided), at a branch or all of them.
create or replace function report_tips_and_service(p_from date, p_to date, p_location uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  b := local_day_bounds(v_business, p_from, p_to);
  return (select jsonb_build_object(
            'service', coalesce(sum(o.service_amount), 0),
            'service_sales', count(*) filter (where o.service_amount > 0),
            'tips', coalesce(sum(o.tip_amount), 0),
            'tip_sales', count(*) filter (where o.tip_amount > 0))
            from sales_order o
           where o.business_id = v_business and o.status not in ('voided', 'open')
             and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
             and (v_loc is null or o.location_id = v_loc));
end $$;

-- =============================================================================
-- 8. Who may call what
-- =============================================================================
revoke execute on function sale_extras(numeric, boolean), tip_shares(uuid, date, date),
  tips_earned(uuid, uuid, date)
  from public, anon, authenticated;
revoke execute on function
  set_service_charge(sales_channel, numeric), service_charges(), set_tip_sharers(uuid[]), tips_month(date),
  report_tips_and_service(date, date, uuid),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text,
              uuid, jsonb, uuid, uuid, int, numeric, boolean),
  settle_tab(uuid, int, uuid, tender_type, numeric, uuid, jsonb, uuid, uuid, int, numeric, boolean),
  settle_tab_offline(uuid, int, uuid, timestamptz, jsonb, numeric, uuid, text, numeric, boolean),
  record_offline_sale(uuid, sales_channel, jsonb, timestamptz, tender_type, jsonb, uuid, numeric, text, uuid, text,
                      numeric, boolean)
  from public, anon;
grant execute on function
  set_service_charge(sales_channel, numeric), service_charges(), set_tip_sharers(uuid[]), tips_month(date),
  report_tips_and_service(date, date, uuid),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text,
              uuid, jsonb, uuid, uuid, int, numeric, boolean),
  settle_tab(uuid, int, uuid, tender_type, numeric, uuid, jsonb, uuid, uuid, int, numeric, boolean),
  settle_tab_offline(uuid, int, uuid, timestamptz, jsonb, numeric, uuid, text, numeric, boolean),
  record_offline_sale(uuid, sales_channel, jsonb, timestamptz, tender_type, jsonb, uuid, numeric, text, uuid, text,
                      numeric, boolean)
  to authenticated;
