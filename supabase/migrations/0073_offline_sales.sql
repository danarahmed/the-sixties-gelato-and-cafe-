-- =============================================================================
-- 0073 — Selling without internet (round fifteen)
-- =============================================================================
-- The owner's choice: when the café's internet drops, the till keeps taking
-- quick sales; it keeps each on the till, with the key it made for it, and
-- sends it once the connection is back. The key is the sale's, as it always
-- was (0035): sent twice, it is recorded once.
--
--  * record_offline_sale takes a sale the till made offline: when it was sold
--    and by whom, its lines and how it was paid, the total the customer was
--    shown, nothing else (no discount, no customer, no dollars: the till takes
--    none of those offline).
--  * Sent the same day it was sold, it keeps the time it was sold: the sales
--    reports and its journal are of that time. Sent on a later day, it is the
--    sale of the day it is sent, so the reports and the books agree; when it
--    was really sold is kept on it (sold_offline_at) and shown. The drawer
--    takes its cash when it is sent, as every sale's (the till sends what it
--    holds before its drawer is counted).
--  * The money was taken already: an item's rule on selling below what the
--    books hold does not refuse it, nor ask for a manager. It is sold, and the
--    audit trail says it was sold offline below what the books held.
--  * What is still refused (a price changed since, a month closed, a drawer
--    counted shut) stays on the till for a manager, with the reason.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. When a sale made offline was really sold
-- -----------------------------------------------------------------------------
alter table sales_order add column if not exists sold_offline_at timestamptz;

-- -----------------------------------------------------------------------------
-- 2. post_sale, at the time the sale was made
-- -----------------------------------------------------------------------------
-- 0069's post_sale: the sale's time is now, or, for a sale made offline
-- earlier the same day, the time it was made (set by record_offline_sale
-- alone, for its own transaction): its day's prices, its placed_at and its
-- journal; and, for any sale made offline, when and on which till it was
-- made. Its stock and its cash move when it is recorded.
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
                            payment_method_id, reference)
  select v_order, (x ->> 'type')::tender_type, (x ->> 'amount')::numeric, (x ->> 'received')::numeric, o,
         coalesce(x ->> 'currency', 'IQD'), (x ->> 'usd')::numeric, (x ->> 'rate')::numeric,
         (x ->> 'method')::uuid, x ->> 'reference'
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

-- -----------------------------------------------------------------------------
-- 3. An item's rule, for a sale made offline
-- -----------------------------------------------------------------------------
-- 0040's stock_rules: for a sale made offline (record_offline_sale alone sets
-- it, for its own transaction) the money was taken already, so nothing is
-- refused and no manager is asked; what was sold below the books is on the
-- audit trail as sold offline.
create or replace function stock_rules(p_business uuid, p_location uuid, p_needs jsonb, p_member uuid,
                                       p_approval uuid, p_kind text, p_for text, p_approved_by uuid default null)
returns uuid language plpgsql set search_path = public as $$
declare s record; v_names text; v_have numeric; v_unit text; v_name text; v_by uuid; a approval;
  v_offline boolean := current_setting('sixties.sale_offline', true) = 'on';
begin
  for s in select * from stock_shortfalls(p_business, p_location, p_needs) loop
    if v_offline then
      if s.policy in ('block', 'approve') then
        v_names := concat_ws(', ', v_names, format('%s ×%s %s', s.name, trim_scale(s.need), s.unit));
      end if;
      continue;
    end if;
    if s.policy = 'block' then
      raise exception '%', format('Only %s %s of %s is in stock: record the delivery or the batch first, or count it',
                                  trim_scale(greatest(s.have, 0)), s.unit, s.name);
    end if;
    if s.policy = 'approve' then
      v_names := concat_ws(', ', v_names, format('%s ×%s %s', s.name, trim_scale(s.need), s.unit));
      if v_name is null then
        v_have := greatest(s.have, 0); v_unit := s.unit; v_name := s.name;
      end if;
    end if;
  end loop;
  if v_offline then
    if v_names is not null then
      perform audit_event(p_business, 'stock.below_zero', 'stock', p_for, 'Sold offline', null,
        jsonb_build_object('items', v_names, 'approved_by', null, 'offline', true));
    end if;
    return null;
  end if;
  if v_name is null then return null; end if;
  if p_approved_by is not null then
    v_by := p_approved_by;
  elsif member_has_permission(p_member, approval_permission(p_kind)) then
    v_by := p_member;
  elsif p_approval is not null then
    a := use_approval(p_business, p_approval, p_kind, p_for);
    v_by := a.approver_id;
  else
    raise exception '%', format('Only %s %s of %s is in stock: a manager approves using more than that',
                                trim_scale(v_have), v_unit, v_name);
  end if;
  perform audit_event(p_business, 'stock.below_zero', 'stock', p_for, null, null,
    jsonb_build_object('items', v_names, 'approved_by', v_by));
  return v_by;
end $$;

-- -----------------------------------------------------------------------------
-- 4. A sale the till made offline, sent once the connection is back
-- -----------------------------------------------------------------------------
-- p_sold_at: when the till took the money; p_sold_by: who was signed in on it
-- then (one of the café's people who may sell; anyone else, or none, is the
-- one sending it). Paid in dinars, by card or one of the café's ways to pay;
-- for a delivery platform, its order number. Sent again with its key, it is
-- the sale recorded.
create or replace function record_offline_sale(p_idempotency_key uuid, p_channel sales_channel, p_lines jsonb,
  p_sold_at timestamptz, p_tender tender_type default null, p_tenders jsonb default null,
  p_location uuid default null, p_expected_net numeric default null, p_platform_order_no text default null,
  p_sold_by uuid default null, p_device text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create'); r jsonb;
  v_me uuid := (current_member()).id; v_by uuid := v_me;
  v_no text := nullif(trim(p_platform_order_no), ''); v_platform uuid; v_pname text; v_active boolean;
  v_at timestamptz; v_replay boolean; v_order uuid;
begin
  if p_idempotency_key is null then raise exception 'A sale needs its idempotency key'; end if;
  v_replay := exists (select 1 from sales_order where business_id = v_business and idempotency_key = p_idempotency_key);
  if not v_replay then
    if p_sold_at is null then raise exception 'Say when the sale was made'; end if;
    if p_sold_at > now() + interval '10 minutes' then
      raise exception 'This sale is dated later than now: check the till''s clock';
    end if;
    if p_sold_at < now() - interval '7 days' then
      raise exception 'This sale was made more than a week ago: a manager records it by hand';
    end if;
    if p_channel = 'direct_delivery' then
      raise exception 'A delivery by the café''s own driver needs the customer and their address';
    end if;
    if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_tenders) = 'array' then p_tenders
                                                       else '[]'::jsonb end) x
                where x ->> 'currency' = 'USD') then
      raise exception 'A sale paid in dollars is not taken offline';
    end if;
    if is_platform_channel(p_channel) then
      select id, name, is_active into v_platform, v_pname, v_active
        from delivery_platform where business_id = v_business and code = p_channel::text;
      if v_platform is null then
        raise exception '% is not one of the café''s delivery platforms: add it on Delivery Platforms', initcap(p_channel::text);
      end if;
    end if;
    -- Who was signed in on the till when it was sold, if they may sell here.
    if p_sold_by is not null and p_sold_by <> v_me
       and exists (select 1 from app_user u where u.id = p_sold_by and u.business_id = v_business and u.is_active)
       and member_has_permission(p_sold_by, 'sale.create') then
      v_by := p_sold_by;
    end if;
    -- Its own time on the day it is sent; a later day's is recorded now.
    v_at := least(p_sold_at, now());
    if business_local_date(v_business, v_at) = business_local_date(v_business, now()) then
      perform set_config('sixties.sale_placed_at', v_at::text, true);
    end if;
    perform set_config('sixties.sale_offline', 'on', true);
    perform set_config('sixties.sale_sold_offline_at', p_sold_at::text, true);
    perform set_config('sixties.sale_device', coalesce(left(nullif(trim(p_device), ''), 64), ''), true);
  end if;
  r := post_sale(v_business, v_by, p_idempotency_key, p_channel, p_tender, p_lines,
                 p_location, null, null, false, jsonb_build_object('reason', null, 'note', null, 'approval', null),
                 p_tenders => p_tenders, p_expected_net => p_expected_net);
  perform set_config('sixties.sale_placed_at', '', true);
  perform set_config('sixties.sale_offline', '', true);
  perform set_config('sixties.sale_sold_offline_at', '', true);
  perform set_config('sixties.sale_device', '', true);
  v_order := (r ->> 'order_id')::uuid;
  if coalesce((r ->> 'replayed')::boolean, false) then
    return r || jsonb_build_object('customer', sale_customer_answer(v_order),
      'platform_order_no', (select po.external_order_id from platform_order po where po.sales_order_id = v_order limit 1),
      'sold_offline_at', (select sold_offline_at from sales_order where id = v_order));
  end if;
  -- A platform's sale is matched to its payout by the order number (0030).
  if is_platform_channel(p_channel) then
    if v_no is null then
      raise exception 'Enter the % order number', v_pname;
    end if;
    if length(v_no) > 40 or v_no !~ '^[A-Za-z0-9#/_.-]+$' then
      raise exception 'An order number is letters and digits, as the % tablet shows it', v_pname;
    end if;
    if exists (select 1 from platform_order po
                where po.business_id = v_business and po.platform_id = v_platform
                  and lower(po.external_order_id) = lower(v_no)) then
      raise exception '% order % is already recorded', v_pname, v_no;
    end if;
    insert into platform_order (business_id, platform_id, location_id, external_order_id, status, store_list_value,
                                customer_payment, sales_order_id, placed_at, import_source)
    select v_business, v_platform, o.location_id, v_no, 'completed', o.gross_amount, o.net_amount, o.id, o.placed_at, 'till'
      from sales_order o where o.id = v_order;
    r := r || jsonb_build_object('platform_order_no', v_no);
  end if;
  perform audit_event(v_business, 'sale.offline', 'sales_order', v_order::text, null, null,
    jsonb_build_object('sold_at', p_sold_at, 'sold_by', v_by, 'sent_by', v_me, 'device', p_device,
                       'net', r -> 'net'));
  return r || jsonb_build_object('customer', null, 'sold_offline_at', p_sold_at);
end $$;

revoke execute on function record_offline_sale(uuid, sales_channel, jsonb, timestamptz, tender_type, jsonb, uuid,
                                               numeric, text, uuid, text) from public, anon;
grant execute on function record_offline_sale(uuid, sales_channel, jsonb, timestamptz, tender_type, jsonb, uuid,
                                             numeric, text, uuid, text) to authenticated;
