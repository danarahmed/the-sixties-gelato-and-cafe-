-- =============================================================================
-- 0076 — Pre-orders and custom cakes, with a deposit (round eighteen)
-- =============================================================================
-- The owner's choice: a customer orders ahead — a birthday cake for
-- Thursday — and pays part of it now. The deposit is not a sale yet: the
-- cake is not made, nor handed over. So:
--
--  * take_pre_order keeps who it is for, when it is collected, what (each
--    product at today's price, agreed then), a note, and the deposit, paid by
--    cash, card or one of the café's ways to pay. The deposit is the
--    customer's money held: Dr where it was paid (cash into the drawer), Cr
--    2300 Customer deposits.
--  * collect_pre_order records the sale when it is collected, at the prices
--    agreed: the deposit pays its part (Dr 2300, the liability gone) and the
--    customer pays the rest, as any sale. Its stock and its cost go then.
--  * cancel_pre_order gives the deposit back the way it was paid (Dr 2300, Cr
--    it; cash out of the drawer), or, by the shop's terms, keeps it (Dr 2300,
--    Cr 4300 Deposits kept).
--  * A sale of a collected pre-order voided puts the deposit back as held and
--    the pre-order open again. Refunding such a sale by the item is not done
--    at the till (its deposit is no way to pay back): a manager voids it.
--  * 2300 moves only with pre-orders: no journal by hand touches it.
--  * Ready for round nineteen: 1110 Customer accounts, and a sale's payment
--    charged to a customer's account, which only invoicing can make.
--
-- Nothing recorded changes. Before it, the till takes no pre-order.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 2300 Customer deposits, 4300 Deposits kept
-- -----------------------------------------------------------------------------
-- 0060's chart, with the two, and 1110 Customer accounts: what customers who
-- buy on account owe (round nineteen; it moves only with their invoices).
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
    ('4300','Deposits kept',              'revenue',   'credit'),
    ('5000','Cost of goods sold',         'expense',   'debit'),
    ('5050','Purchase price variance',    'expense',   'debit'),
    ('5100','Platform commission',        'expense',   'debit'),
    ('5200','Platform fees',              'expense',   'debit'),
    ('5300','Waste & spoilage',           'expense',   'debit'),
    ('5310','Production and preparation loss', 'expense', 'debit'),
    ('5400','Inventory count variance',   'expense',   'debit'),
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

-- 0062's list, with 2300 and 1110: they move only with pre-orders and
-- invoices.
create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$
  select p_code in ('1000', '1001', '1005', '1006', '1200', '1210', '1300', '1400', '1110', '2000', '2050', '2100', '2300',
                    '3100', '4000', '4100', '4200')
$$;

-- 0069's cash flow lines: a deposit held, and what customers owe on account,
-- are money from the café's customers.
create or replace function cash_flow_line(p_code text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_code in ('1000', '1001', '1005', '1006', '1020') or p_code ~ '^10[3-8][0-9]$' then 'cash'
    when p_code like '15%' then 'equipment'
    when p_code like '3%' then 'owner'
    when p_code = '6950' then 'exchange'
    when p_code = '6300' then 'counts'
    when p_code like '4%' or p_code in ('1010', '1100', '1110', '2300', '5100', '5200', '6500') then 'sales'
    when p_code like '12%' or p_code in ('2000', '2050') or p_code like '5%' then 'stock'
    when p_code in ('1300', '2100') or p_code like '61%' then 'staff'
    else 'running'
  end
$$;

-- -----------------------------------------------------------------------------
-- 2. What is kept
-- -----------------------------------------------------------------------------
create table if not exists pre_order (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business (id) on delete cascade,
  location_id      uuid not null references location (id),
  order_no         int not null,
  customer_name    text not null,
  customer_phone   text,
  pickup_at        timestamptz not null,
  channel          sales_channel not null default 'takeaway',
  note             text,
  status           text not null default 'open',
  total            numeric not null,
  deposit          numeric not null default 0,
  -- How the deposit was paid: its way and the account it went to.
  deposit_tender   tender_type,
  deposit_method   uuid references payment_method (id),
  deposit_account  text,
  sales_order_id   uuid references sales_order (id),
  created_by       uuid references app_user (id),
  created_at       timestamptz not null default now(),
  collected_at     timestamptz,
  cancelled_at     timestamptz,
  cancel_reason    text,
  deposit_kept     boolean,
  constraint pre_order_status check (status in ('open', 'collected', 'cancelled')),
  constraint pre_order_name check (length(trim(customer_name)) between 1 and 80),
  constraint pre_order_note check (note is null or length(note) <= 500),
  constraint pre_order_money check (total >= 0 and deposit >= 0 and deposit <= total),
  unique (business_id, order_no)
);
create index if not exists pre_order_open on pre_order (business_id, pickup_at) where status = 'open';

create table if not exists pre_order_line (
  id                  uuid primary key default gen_random_uuid(),
  pre_order_id        uuid not null references pre_order (id) on delete cascade,
  product_variant_id  uuid not null references product_variant (id),
  qty                 numeric not null,
  unit_price          numeric not null,
  note                text,
  position            int not null,
  constraint pre_order_line_qty check (qty > 0),
  constraint pre_order_line_note check (note is null or length(note) <= 200)
);

-- Everyone at the café who sells reads them through the functions below.
alter table pre_order enable row level security;
alter table pre_order force row level security;
alter table pre_order_line enable row level security;
alter table pre_order_line force row level security;
revoke all on pre_order, pre_order_line from anon, authenticated;

-- A sale's payment by a pre-order's deposit (debited to 2300).
alter table sales_tender add column if not exists pre_order_id uuid references pre_order (id);
-- A sale charged to a customer's account (1110), for invoicing (round
-- nineteen): only the function that invoices says so, for its own customer.
alter table sales_tender add column if not exists on_account_customer uuid references customer (id);
alter table sales_tender drop constraint if exists sales_tender_method_check;
alter table sales_tender add constraint sales_tender_method_check check (
  (tender_type = 'other')
    = (payment_method_id is not null or pre_order_id is not null or on_account_customer is not null)
  and num_nonnulls(payment_method_id, pre_order_id, on_account_customer) <= 1
  and (reference is null or (tender_type in ('card', 'other') and length(reference) between 1 and 60)));

-- -----------------------------------------------------------------------------
-- 3. A sale paid in part by a pre-order's deposit
-- -----------------------------------------------------------------------------
-- 0069's sale_payments: {type: 'other', pre_order, amount}, the deposit, when
-- collect_pre_order says so for its own pre-order (sixties.pre_order).
-- And {type: 'other', on_account, amount}, charged to a customer's account
-- (1110), when the invoice says so for its own customer (sixties.on_account;
-- round nineteen).
create or replace function sale_payments(p_business uuid, p_channel sales_channel, p_tender tender_type,
                                         p_tenders jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  x jsonb; v_out jsonb := '[]'; n int; v_amount numeric; v_received numeric; v_currency text;
  v_usd numeric; v_rate numeric; v_ref text; v_extra jsonb; m payment_method;
begin
  if p_tenders is null then
    if p_tender is null then raise exception 'Choose how it was paid'; end if;
    if p_tender = 'other' then raise exception 'Choose which way to pay it was'; end if;
    v_out := jsonb_build_array(jsonb_build_object('type', p_tender, 'amount', null, 'received', null));
  else
    if p_tender is not null then
      raise exception 'Send the payments once: one tender, or the list of payments';
    end if;
    if jsonb_typeof(p_tenders) <> 'array' or jsonb_array_length(p_tenders) = 0 then
      raise exception 'Choose how it was paid';
    end if;
    n := jsonb_array_length(p_tenders);
    if n > 10 then raise exception 'A sale is paid in at most 10 payments'; end if;
    for x in select * from jsonb_array_elements(p_tenders) loop
      if jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x -> 'type') is distinct from 'string'
         or jsonb_typeof(x -> 'amount') is distinct from 'number'
         or coalesce(jsonb_typeof(x -> 'received'), 'null') not in ('number', 'null')
         or coalesce(jsonb_typeof(x -> 'currency'), 'null') not in ('string', 'null')
         or coalesce(jsonb_typeof(x -> 'usd'), 'null') not in ('number', 'null')
         or coalesce(jsonb_typeof(x -> 'rate'), 'null') not in ('number', 'null')
         or coalesce(jsonb_typeof(x -> 'method'), 'null') not in ('string', 'null')
         or coalesce(jsonb_typeof(x -> 'reference'), 'null') not in ('string', 'null')
         or coalesce(jsonb_typeof(x -> 'pre_order'), 'null') not in ('string', 'null')
         or coalesce(jsonb_typeof(x -> 'on_account'), 'null') not in ('string', 'null') then
        raise exception 'The payments cannot be read';
      end if;
      if x ->> 'type' not in ('cash', 'card', 'platform_paid', 'other') then
        raise exception 'Tender % is not supported', x ->> 'type';
      end if;
      v_amount := (x ->> 'amount')::numeric;
      v_received := (x ->> 'received')::numeric;
      -- A part of the sale in the currency's own units; only the one payment
      -- of a sale that comes to nothing is nothing.
      if v_amount < 0 or (v_amount = 0 and n > 1) then
        raise exception 'Each payment needs an amount more than 0';
      end if;
      if v_amount <> money_round(p_business, v_amount) then
        raise exception 'The payments cannot be read';
      end if;
      if v_received is not null then
        if x ->> 'type' <> 'cash' then raise exception 'The payments cannot be read'; end if;
        if v_received < v_amount then
          raise exception 'The cash handed over (%) is less than the % it pays', trim_scale(v_received),
            trim_scale(v_amount);
        end if;
      end if;
      -- Which of the café's ways to pay (0069), and the reference shown.
      v_extra := '{}'::jsonb;
      if x ->> 'type' = 'other' and x ? 'pre_order' then
        -- A pre-order's deposit, paying its part when it is collected (0076):
        -- only collect_pre_order says so, for its own pre-order.
        if x ->> 'pre_order' is distinct from nullif(current_setting('sixties.pre_order', true), '') then
          raise exception 'The payments cannot be read';
        end if;
        v_extra := jsonb_build_object('pre_order', x ->> 'pre_order', 'account', '2300');
      elsif x ->> 'type' = 'other' and x ? 'on_account' then
        -- Charged to a customer's account: only the invoice says so, for its
        -- own customer (sixties.on_account).
        if x ->> 'on_account' is distinct from nullif(current_setting('sixties.on_account', true), '') then
          raise exception 'The payments cannot be read';
        end if;
        v_extra := jsonb_build_object('on_account', x ->> 'on_account', 'account', '1110');
      elsif x ->> 'type' = 'other' then
        if coalesce(x ->> 'method', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          raise exception 'Choose which way to pay it was';
        end if;
        select * into m from payment_method where id = (x ->> 'method')::uuid and business_id = p_business;
        if not found then raise exception 'That way to pay is not one of the café''s'; end if;
        v_extra := jsonb_build_object('method', m.id, 'account', m.account_code);
      elsif x ->> 'method' is not null then
        raise exception 'The payments cannot be read';
      end if;
      v_ref := nullif(regexp_replace(btrim(coalesce(x ->> 'reference', '')), '\s+', ' ', 'g'), '');
      if v_ref is not null then
        if x ->> 'type' not in ('card', 'other') then raise exception 'The payments cannot be read'; end if;
        if length(v_ref) > 60 then raise exception 'A payment''s reference is at most 60 letters'; end if;
        v_extra := v_extra || jsonb_build_object('reference', v_ref);
      end if;
      v_currency := coalesce(x ->> 'currency', 'IQD');
      v_usd := (x ->> 'usd')::numeric;
      v_rate := (x ->> 'rate')::numeric;
      if v_currency = 'USD' then
        -- Dollars: handed over in whole notes, for a part of the sale.
        if x ->> 'type' <> 'cash' then raise exception 'Dollars are taken in cash only'; end if;
        if v_received is not null or v_rate is null or v_rate <= 0 then
          raise exception 'The payments cannot be read';
        end if;
        if v_usd is null or v_usd <= 0 or v_usd <> trunc(v_usd) or v_usd > 100000 then
          raise exception 'Dollars are taken in whole dollars';
        end if;
        if v_amount = 0 then raise exception 'Each payment needs an amount more than 0'; end if;
        v_out := v_out || jsonb_build_object('type', 'cash', 'amount', v_amount, 'received', null,
                                             'currency', 'USD', 'usd', v_usd, 'rate', v_rate);
      elsif v_currency = 'IQD' then
        if v_usd is not null or v_rate is not null then raise exception 'The payments cannot be read'; end if;
        v_out := v_out || (jsonb_build_object('type', x ->> 'type', 'amount', v_amount, 'received', v_received)
                           || v_extra);
      else
        raise exception 'Payments are taken in dinars or dollars';
      end if;
    end loop;
  end if;
  if exists (select 1 from jsonb_array_elements(v_out) y
              where y ->> 'type' not in ('cash', 'card', 'platform_paid', 'other')) then
    raise exception 'Tender % is not supported',
      (select y ->> 'type' from jsonb_array_elements(v_out) y
        where y ->> 'type' not in ('cash', 'card', 'platform_paid', 'other') limit 1);
  end if;
  if exists (select 1 from jsonb_array_elements(v_out) y
              where is_platform_channel(p_channel) <> (y ->> 'type' = 'platform_paid')) then
    raise exception 'Delivery-platform orders are platform-paid, and only they are';
  end if;
  if is_platform_channel(p_channel) and jsonb_array_length(v_out) > 1 then
    raise exception 'A delivery platform''s order is paid once, by the platform';
  end if;
  return v_out;
end $$;

-- 0073's post_sale, keeping which pre-order's deposit a payment is.
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
begin
  if p_idempotency_key is null then
    raise exception 'A sale needs its idempotency key';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  v_pay := sale_payments(v_business, p_channel, p_tender, p_tenders);

  -- Replay: the same key returns the sale it already recorded.
  select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
    from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'turn_no', v_existing.turn_no, 'payments', order_payments(v_existing.id))
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  -- A way to pay taken out of use takes no new sale (0069).
  perform sale_methods_in_use(v_business, v_pay);
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
    select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
      from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
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

  -- Each line's share of the discount, in proportion to its value, adding up
  -- to the discount exactly (the rounding method receipts use for landed costs).
  v_discount := sale_discount(v_business, v_gross, p_discount_percent, p_discount_amount);
  if v_discount > 0 then
    v_nets := allocate_landed(v_business, v_gross_lines, -v_discount);
    -- Who gave it, why, and who approved it (0028).
    if coalesce((p_discount ->> 'checked')::boolean, false) then
      v_disc_by := (p_discount ->> 'by')::uuid;
      v_disc_approved := (p_discount ->> 'approved_by')::uuid;
      v_disc_reason := p_discount ->> 'reason';
    else
      v_disc_reason := reason_text('discount', p_discount ->> 'reason', p_discount ->> 'note');
      v_disc_by := v_me;
      v_disc_approved := discount_approver(v_business, v_gross, p_discount_percent, p_discount_amount,
                                           (p_discount ->> 'approval')::uuid, v_order::text);
    end if;
  else
    v_nets := v_gross_lines;
  end if;
  v_net := v_gross - v_discount;

  -- The total the till showed (0025), then the payments: together they come to
  -- the net exactly (0042). The old single tender pays all of it.
  perform assert_sale_total(jsonb_build_object('net', v_net), p_expected_net);
  select jsonb_agg(case when jsonb_typeof(x -> 'amount') = 'null' then x || jsonb_build_object('amount', v_net)
                        else x end order by o)
    into v_pay from jsonb_array_elements(v_pay) with ordinality e(x, o);
  select sum((x ->> 'amount')::numeric) into v_paid from jsonb_array_elements(v_pay) x;
  if v_paid <> v_net then
    raise exception 'The payments come to %, not the % to pay', trim_scale(v_paid), trim_scale(v_net);
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
                                  cogs_amount)
    values (v_line, v_order, v_variants[i], v_qtys[i], v_prices[i], v_gross_lines[i] - v_nets[i], v_nets[i],
            v_line_cogs);
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
         discount_percent = case when v_discount > 0 then p_discount_percent end,
         discount_by = v_disc_by, discount_approved_by = v_disc_approved, discount_reason = v_disc_reason,
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
      jsonb_build_object('code', '5000', 'debit', v_cogs),
      jsonb_build_object('code', '1200', 'credit', v_cogs)));

  if v_discount > 0 then
    perform audit_event(v_business, 'sale.discount', 'sales_order', v_order::text, v_disc_reason, null,
      jsonb_build_object('gross', v_gross, 'discount', v_discount, 'percent', p_discount_percent,
                         'amount', p_discount_amount, 'given_by', v_disc_by, 'approved_by', v_disc_approved));
  end if;

  return jsonb_build_object('order_id', v_order, 'gross', v_gross, 'discount', v_discount, 'net', v_net,
    'journal_no', (select journal_no from journal_entry where id = v_journal), 'replayed', false,
    'turn_no', v_turn, 'payments', order_payments(v_order))
    || sale_cost_view(v_cogs);
end $$;

-- 0069's order_payments, saying which payment is a deposit, and which is
-- charged to the customer's account.
create or replace function order_payments(p_order uuid) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('type', t.tender_type, 'amount', t.amount, 'received', t.received,
                                               'change', t.change_given)
                            || case when t.currency = 'USD'
                                    then jsonb_build_object('currency', 'USD', 'usd', t.foreign_amount, 'rate', t.rate)
                                    else '{}'::jsonb end
                            || case when t.payment_method_id is not null
                                    then jsonb_build_object('method', t.payment_method_id, 'method_name', m.name)
                                    else '{}'::jsonb end
                            || case when t.reference is not null then jsonb_build_object('reference', t.reference)
                                    else '{}'::jsonb end
                            || case when t.pre_order_id is not null
                                    then jsonb_build_object('deposit', true) else '{}'::jsonb end
                            || case when t.on_account_customer is not null
                                    then jsonb_build_object('on_account', true) else '{}'::jsonb end
                            order by t.position, t.id), '[]'::jsonb)
    from sales_tender t left join payment_method m on m.id = t.payment_method_id
   where t.sales_order_id = p_order
$$;

-- -----------------------------------------------------------------------------
-- 4. Taking a pre-order, and its deposit
-- -----------------------------------------------------------------------------
-- p_lines: [{variant_id, qty, note}], each at today's price on the channel, at
-- the till's branch: the price agreed. p_deposit: null, or {type: cash | card
-- | other, amount, method (other), received (cash)}. Keyed.
create or replace function take_pre_order(p_customer_name text, p_pickup_at timestamptz, p_lines jsonb,
  p_customer_phone text default null, p_note text default null, p_channel sales_channel default 'takeaway',
  p_deposit jsonb default null, p_location uuid default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('name', p_customer_name, 'pickup', p_pickup_at, 'lines', p_lines,
                                    'phone', p_customer_phone, 'note', p_note, 'channel', p_channel,
                                    'deposit', p_deposit, 'location', p_location);
  v jsonb; v_location uuid; v_today date; v_id uuid := gen_random_uuid(); v_no int;
  l jsonb; v_variant uuid; v_qty numeric; v_price numeric; v_total numeric := 0; n int := 0;
  v_dep numeric := 0; v_type tender_type; v_method payment_method; v_account text; v_journal uuid;
  v_name text := nullif(trim(p_customer_name), '');
begin
  v := idem_begin(v_business, p_idempotency_key, 'take_pre_order', v_req);
  if v is not null then return v; end if;
  if v_name is null then raise exception 'Say who the order is for'; end if;
  if length(v_name) > 80 then raise exception 'A name is at most 80 letters'; end if;
  if p_pickup_at is null then raise exception 'Say when it is collected'; end if;
  if p_pickup_at < now() - interval '1 hour' then raise exception 'It is collected later than now'; end if;
  if p_pickup_at > now() + interval '180 days' then raise exception 'It is collected within six months'; end if;
  if is_platform_channel(p_channel) or p_channel = 'direct_delivery' then
    raise exception 'A pre-order is collected at the café: take it away or eat in';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, now());
  perform pg_advisory_xact_lock(hashtext('pre_order:' || v_business::text));
  select coalesce(max(order_no), 0) + 1 into v_no from pre_order where business_id = v_business;
  insert into pre_order (id, business_id, location_id, order_no, customer_name, customer_phone, pickup_at, channel,
                         note, total, created_by)
  values (v_id, v_business, v_location, v_no, v_name, nullif(trim(p_customer_phone), ''), p_pickup_at, p_channel,
          nullif(trim(p_note), ''), 0, v_me);
  for l in select * from jsonb_array_elements(p_lines) loop
    n := n + 1;
    v_variant := (l ->> 'variant_id')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = v_variant and pv.business_id = v_business and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    v_price := price_on(v_variant, p_channel, v_location, v_today);
    if v_price is null then raise exception 'No % price is set for this product', p_channel; end if;
    insert into pre_order_line (pre_order_id, product_variant_id, qty, unit_price, note, position)
    values (v_id, v_variant, v_qty, v_price, nullif(trim(l ->> 'note'), ''), n);
    v_total := v_total + money_round(v_business, v_price * v_qty);
  end loop;

  -- The deposit: the customer's money held, until it is collected.
  if p_deposit is not null and coalesce((p_deposit ->> 'amount')::numeric, 0) > 0 then
    v_dep := (p_deposit ->> 'amount')::numeric;
    if v_dep <> money_round(v_business, v_dep) or v_dep > v_total then
      raise exception 'A deposit is at most the order''s total';
    end if;
    v_type := (p_deposit ->> 'type')::tender_type;
    if v_type = 'cash' then v_account := '1000';
    elsif v_type = 'card' then v_account := '1010';
    elsif v_type = 'other' then
      select * into v_method from payment_method
       where id = (p_deposit ->> 'method')::uuid and business_id = v_business and is_active;
      if v_method.id is null then raise exception 'Choose which way to pay it was'; end if;
      v_account := v_method.account_code;
    else
      raise exception 'A deposit is paid in cash, by card or one of the café''s ways to pay';
    end if;
    v_journal := post_journal(v_business, now(), 'Pre-order ' || v_no || ' deposit', 'pre_order', v_id,
      jsonb_build_array(jsonb_build_object('code', v_account, 'debit', v_dep),
                        jsonb_build_object('code', '2300', 'credit', v_dep)));
    -- Cash goes into the drawer, which must be open.
    if v_type = 'cash' then
      insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
      values (v_business, v_location, 'cash_in', v_dep, 'pre_order', v_id, v_me);
    end if;
  end if;
  update pre_order set total = v_total, deposit = v_dep, deposit_tender = v_type, deposit_method = v_method.id,
                       deposit_account = v_account
   where id = v_id;
  perform audit_event(v_business, 'pre_order.take', 'pre_order', v_id::text, null, null,
    jsonb_build_object('order_no', v_no, 'customer', v_name, 'pickup_at', p_pickup_at, 'total', v_total,
                       'deposit', v_dep));
  v := jsonb_build_object('pre_order_id', v_id, 'order_no', v_no, 'total', v_total, 'deposit', v_dep,
                          'journal_no', (select journal_no from journal_entry where id = v_journal));
  perform idem_finish(v_business, p_idempotency_key, 'take_pre_order', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Collecting it: the sale, its deposit paying its part
-- -----------------------------------------------------------------------------
-- p_tenders: what the customer pays now, as a sale's (0042); none when the
-- deposit paid it all. p_expected_net: the whole total, as the till showed it.
-- Its key is the sale's: sent again, it is the sale recorded.
create or replace function collect_pre_order(p_pre_order uuid, p_idempotency_key uuid, p_tenders jsonb default null,
                                             p_expected_net numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id; o pre_order; r jsonb; v_lines jsonb; v_pay jsonb; v_again boolean;
begin
  if p_idempotency_key is null then raise exception 'A sale needs its idempotency key'; end if;
  select * into o from pre_order where id = p_pre_order and business_id = v_business for update;
  if not found then raise exception 'Pre-order not found'; end if;
  -- Sent again, it is the sale it recorded: post_sale answers with it.
  v_again := exists (select 1 from sales_order where business_id = v_business
                                                and idempotency_key = p_idempotency_key);
  if not v_again then
    if o.status = 'collected' then raise exception 'Pre-order % is collected already', o.order_no; end if;
    if o.status = 'cancelled' then raise exception 'Pre-order % was cancelled', o.order_no; end if;
  end if;
  select jsonb_agg(jsonb_build_object('variant_id', l.product_variant_id, 'qty', l.qty, 'price', l.unit_price,
                                      'modifiers', '[]'::jsonb) order by l.position)
    into v_lines from pre_order_line l where l.pre_order_id = o.id;
  v_pay := case when jsonb_typeof(p_tenders) = 'array' then p_tenders else '[]'::jsonb end;
  if o.deposit > 0 then
    v_pay := v_pay || jsonb_build_array(jsonb_build_object('type', 'other', 'amount', o.deposit,
                                                           'pre_order', o.id::text));
  end if;
  if jsonb_array_length(v_pay) = 0 then raise exception 'Choose how it was paid'; end if;
  perform set_config('sixties.pre_order', o.id::text, true);
  r := post_sale(v_business, v_me, p_idempotency_key, o.channel, null, v_lines, o.location_id, null, null, true,
                 jsonb_build_object('reason', null, 'note', null, 'approval', null),
                 p_tenders => v_pay, p_expected_net => p_expected_net);
  perform set_config('sixties.pre_order', '', true);
  if not v_again then
    update pre_order set status = 'collected', sales_order_id = (r ->> 'order_id')::uuid, collected_at = now()
     where id = o.id;
    perform audit_event(v_business, 'pre_order.collect', 'pre_order', o.id::text, null, null,
      jsonb_build_object('order_no', o.order_no, 'customer', o.customer_name, 'sale', r ->> 'order_id'));
  end if;
  return r || jsonb_build_object('pre_order_no', o.order_no, 'deposit', o.deposit);
end $$;

-- A collected pre-order's sale voided: its deposit is held again, and the
-- pre-order is open again, to be collected or cancelled.
create or replace function trg_pre_order_sale_voided() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.kind = 'void' then
    update pre_order set status = 'open', sales_order_id = null, collected_at = null
     where sales_order_id = NEW.sales_order_id;
  end if;
  return NEW;
end $$;
drop trigger if exists pre_order_sale_voided on sale_adjustment;
create trigger pre_order_sale_voided after insert on sale_adjustment
  for each row execute function trg_pre_order_sale_voided();

-- -----------------------------------------------------------------------------
-- 6. Cancelling it: the deposit given back, or kept
-- -----------------------------------------------------------------------------
create or replace function cancel_pre_order(p_pre_order uuid, p_reason text, p_keep_deposit boolean default false,
                                            p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.void');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('pre_order', p_pre_order, 'reason', p_reason, 'keep', p_keep_deposit);
  v jsonb; o pre_order; v_journal uuid; v_reason text := nullif(trim(p_reason), '');
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_pre_order', v_req);
  if v is not null then return v; end if;
  if v_reason is null then raise exception 'Say why it is cancelled'; end if;
  select * into o from pre_order where id = p_pre_order and business_id = v_business for update;
  if not found then raise exception 'Pre-order not found'; end if;
  if o.status = 'collected' then raise exception 'Pre-order % is collected already', o.order_no; end if;
  if o.status = 'cancelled' then raise exception 'Pre-order % was cancelled', o.order_no; end if;
  if o.deposit > 0 then
    if coalesce(p_keep_deposit, false) then
      v_journal := post_journal(v_business, now(), 'Pre-order ' || o.order_no || ' cancelled, deposit kept',
        'pre_order_cancel', o.id,
        jsonb_build_array(jsonb_build_object('code', '2300', 'debit', o.deposit),
                          jsonb_build_object('code', '4300', 'credit', o.deposit)));
    else
      v_journal := post_journal(v_business, now(), 'Pre-order ' || o.order_no || ' cancelled, deposit given back',
        'pre_order_cancel', o.id,
        jsonb_build_array(jsonb_build_object('code', '2300', 'debit', o.deposit),
                          jsonb_build_object('code', o.deposit_account, 'credit', o.deposit)));
      -- Cash comes out of the drawer, which must be open.
      if o.deposit_tender = 'cash' then
        insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
        values (v_business, o.location_id, 'cash_out', -o.deposit, 'pre_order', o.id, v_me);
      end if;
    end if;
  end if;
  update pre_order set status = 'cancelled', cancelled_at = now(), cancel_reason = v_reason,
                       deposit_kept = case when o.deposit > 0 then coalesce(p_keep_deposit, false) end
   where id = o.id;
  perform audit_event(v_business, 'pre_order.cancel', 'pre_order', o.id::text, v_reason, null,
    jsonb_build_object('order_no', o.order_no, 'customer', o.customer_name, 'deposit', o.deposit,
                       'deposit_kept', o.deposit > 0 and coalesce(p_keep_deposit, false)));
  v := jsonb_build_object('pre_order_id', o.id, 'journal_no', (select journal_no from journal_entry where id = v_journal));
  perform idem_finish(v_business, p_idempotency_key, 'cancel_pre_order', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 7. The pre-orders, for the till and the kitchen
-- -----------------------------------------------------------------------------
-- Open ones (or every one collected or cancelled from p_from), soonest first,
-- at the till's branch (none: every branch), each with its lines; and what
-- 2300 holds against the open ones' deposits, for those who see the books.
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
                  then -gl_balance_at(v_business, '2300', now()) end);
end $$;

revoke execute on function take_pre_order(text, timestamptz, jsonb, text, text, sales_channel, jsonb, uuid, uuid)
  from public, anon;
grant execute on function take_pre_order(text, timestamptz, jsonb, text, text, sales_channel, jsonb, uuid, uuid)
  to authenticated;
revoke execute on function collect_pre_order(uuid, uuid, jsonb, numeric) from public, anon;
grant execute on function collect_pre_order(uuid, uuid, jsonb, numeric) to authenticated;
revoke execute on function cancel_pre_order(uuid, text, boolean, uuid) from public, anon;
grant execute on function cancel_pre_order(uuid, text, boolean, uuid) to authenticated;
revoke execute on function pre_orders(uuid, date) from public, anon;
grant execute on function pre_orders(uuid, date) to authenticated;
