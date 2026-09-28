-- =============================================================================
-- 0042 — Split payments (release Q)
--
-- A sale was paid one way: post_sale wrote one payment for the whole net, and
-- the drawer, voids and refunds assumed it (docs/COMPLETION_PLAN.md, B1).
--   * A sale takes a list of payments: part in cash and part by card, or two
--     cards, each its part of the net, together the net exactly. Cash may be
--     more than its part: what was handed over is kept with it, and the
--     change. The old single tender is a list of one.
--   * Each payment is debited to its own account, and each cash payment is
--     its own drawer event, as before.
--   * A void takes back from the drawer what the sale put in it: its cash.
--   * A refund gives back per payment: as the refunder chooses, or in
--     proportion to what is left of each, never more than is left of one. Only
--     its cash leaves the drawer.
--   * The day's cash refunds count only the cash given back, and the drawer's
--     count of orders counts a split sale once.
--   * report_payments: the takings by how they were paid.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. A payment: its part of the sale, and the cash handed over for it
-- ---------------------------------------------------------------------------
-- `amount` stays what the payment pays of the sale. `received` is the cash
-- handed over for it, when the cashier typed it; the change is the rest. The
-- payments of a sale are kept in the order they were taken.
alter table sales_tender add column if not exists received numeric;
alter table sales_tender add column if not exists change_given numeric
  generated always as (received - amount) stored;
alter table sales_tender add column if not exists position smallint not null default 1;
alter table sales_tender drop constraint if exists sales_tender_received_check;
alter table sales_tender add constraint sales_tender_received_check
  check (received is null or (tender_type = 'cash' and received >= amount));
create index if not exists sales_tender_order_idx on sales_tender (sales_order_id);

-- A sale's payments, as the till and the receipts show them.
create or replace function order_payments(p_order uuid) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('type', tender_type, 'amount', amount, 'received', received,
                                               'change', change_given)
                            order by position, id), '[]'::jsonb)
    from sales_tender where sales_order_id = p_order
$$;

-- The payments a sale is taken with: [{type, amount, received}], in the order
-- given, checked for its channel. The old single tender is a list of one whose
-- amount is the whole net (null until the net is known). A delivery platform's
-- order is paid once, by the platform; a sale in the café in cash or by card,
-- in at most ten payments.
create or replace function sale_payments(p_business uuid, p_channel sales_channel, p_tender tender_type,
                                         p_tenders jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  x jsonb; v_out jsonb := '[]'; n int; v_amount numeric; v_received numeric;
begin
  if p_tenders is null then
    if p_tender is null then raise exception 'Choose how it was paid'; end if;
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
         or coalesce(jsonb_typeof(x -> 'received'), 'null') not in ('number', 'null') then
        raise exception 'The payments cannot be read';
      end if;
      if x ->> 'type' not in ('cash', 'card', 'platform_paid') then
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
      v_out := v_out || jsonb_build_object('type', x ->> 'type', 'amount', v_amount, 'received', v_received);
    end loop;
  end if;
  if exists (select 1 from jsonb_array_elements(v_out) y
              where y ->> 'type' not in ('cash', 'card', 'platform_paid')) then
    raise exception 'Tender % is not supported',
      (select y ->> 'type' from jsonb_array_elements(v_out) y
        where y ->> 'type' not in ('cash', 'card', 'platform_paid') limit 1);
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

-- ---------------------------------------------------------------------------
-- 2. A sale taken with its payments
-- ---------------------------------------------------------------------------
-- 0041's post_sale, with the payments (p_tenders) and the total the till
-- showed (p_expected_net): both are checked once the sale is priced, the total
-- first, so a price that changed is told as such. Each payment is written in
-- its order, each cash payment a drawer event (trg_cash_from_tender), and the
-- journal debits each payment's account with what it paid.
drop function if exists post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric,
                                  boolean, jsonb, integer, uuid);
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric,
  p_trust_line_prices boolean default false, p_discount jsonb default null, p_turn_no int default null,
  p_stock_approval uuid default null, p_tenders jsonb default null, p_expected_net numeric default null)
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

  if (p_discount_percent is not null or p_discount_amount is not null) and is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets its own discounts; none is given at the till';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, now());

  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
                           gross_amount, discount_amount, net_amount, cogs_amount, cashier_id)
  values (v_business, v_location, p_channel, 'open', p_idempotency_key, 0, 0, 0, 0, v_me)
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

  -- Each payment in its order; a cash one is also the drawer's (trg_cash_from_tender).
  insert into sales_tender (sales_order_id, tender_type, amount, received, position)
  select v_order, (x ->> 'type')::tender_type, (x ->> 'amount')::numeric, (x ->> 'received')::numeric, o
    from jsonb_array_elements(v_pay) with ordinality e(x, o)
   order by o;

  -- Its turn number (0034): the bill's own, or the next of the day. Taken in
  -- the sale's own transaction, so a sale refused takes none.
  v_turn := coalesce(p_turn_no, take_turn_no(v_business, v_today));
  update sales_order
     set gross_amount = v_gross, discount_amount = v_discount, net_amount = v_net, cogs_amount = v_cogs,
         discount_percent = case when v_discount > 0 then p_discount_percent end,
         discount_by = v_disc_by, discount_approved_by = v_disc_approved, discount_reason = v_disc_reason,
         status = 'completed', turn_no = v_turn
   where id = v_order;

  -- Each payment's account debited with what it paid (one line per account),
  -- revenue at the full price, the discount on its own line (none posts when
  -- it is zero).
  v_journal := post_journal(v_business, now(), 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
    coalesce((select jsonb_agg(jsonb_build_object('code', a.code, 'debit', a.amount) order by a.pos)
                from (select tender_account((x ->> 'type')::tender_type) as code,
                             sum((x ->> 'amount')::numeric) as amount, min(o) as pos
                        from jsonb_array_elements(v_pay) with ordinality e(x, o) group by 1) a), '[]'::jsonb)
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

-- 0030's record_sale, taking the payments as a list (p_tenders) or, as
-- before, one tender for the whole net.
drop function if exists record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text,
                                    text, uuid, text, uuid);
create or replace function record_sale(p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type, p_lines jsonb,
  p_location uuid default null, p_discount_percent numeric default null, p_discount_amount numeric default null,
  p_expected_net numeric default null, p_discount_reason text default null, p_discount_note text default null,
  p_approval uuid default null, p_platform_order_no text default null, p_stock_approval uuid default null,
  p_tenders jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create'); r jsonb;
  v_no text := nullif(trim(p_platform_order_no), ''); v_platform uuid; v_at timestamptz;
  v_pname text; v_active boolean;
begin
  if (p_discount_percent is not null or p_discount_amount is not null)
     and not current_has_permission('discount.apply') then
    raise exception 'You do not have permission to give discounts' using errcode = '42501';
  end if;
  -- A platform sale goes through one of the café's platforms, in use; a sale
  -- it already recorded, sent again by a till that was offline, is replayed.
  if is_platform_channel(p_channel) then
    select id, name, is_active into v_platform, v_pname, v_active
      from delivery_platform where business_id = v_business and code = p_channel::text;
    if not exists (select 1 from sales_order where business_id = v_business and idempotency_key = p_idempotency_key) then
      if v_platform is null then
        raise exception '% is not one of the café''s delivery platforms: add it on Delivery Platforms', initcap(p_channel::text);
      end if;
      if not v_active then
        raise exception '% is no longer in use: bring it back on Delivery Platforms to sell through it', v_pname;
      end if;
    end if;
  end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, p_channel, p_tender, p_lines,
                 p_location, p_discount_percent, p_discount_amount, false,
                 jsonb_build_object('reason', p_discount_reason, 'note', p_discount_note, 'approval', p_approval),
                 p_stock_approval => p_stock_approval, p_tenders => p_tenders, p_expected_net => p_expected_net);
  -- A replay is the sale already recorded, with its number.
  if is_platform_channel(p_channel) and not coalesce((r ->> 'replayed')::boolean, false) then
    if v_no is null then
      raise exception 'Enter the % order number', v_pname;
    end if;
    if length(v_no) > 40 or v_no !~ '^[A-Za-z0-9#/_.-]+$' then
      raise exception 'An order number is letters and digits, as the % tablet shows it', v_pname;
    end if;
    select o.placed_at into v_at
      from platform_order po join sales_order o on o.id = po.sales_order_id
     where po.business_id = v_business and po.platform_id = v_platform and lower(po.external_order_id) = lower(v_no);
    if found then
      raise exception '% order % is already recorded, on the sale of %', v_pname, v_no,
        to_char(v_at at time zone (select timezone from business where id = v_business), 'DD Mon HH24:MI');
    end if;
    insert into platform_order (business_id, platform_id, location_id, external_order_id, status, store_list_value,
                                customer_payment, sales_order_id, placed_at, import_source)
    select v_business, v_platform, o.location_id, v_no, 'completed', o.gross_amount, o.net_amount, o.id, o.placed_at, 'till'
      from sales_order o where o.id = (r ->> 'order_id')::uuid;
    r := r || jsonb_build_object('platform_order_no', v_no);
  end if;
  return r;
end $$;

-- 0041's settle_tab, taking the payments as a list too.
drop function if exists settle_tab(uuid, integer, uuid, tender_type, numeric, uuid);
create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type,
  p_expected_net numeric default null, p_stock_approval uuid default null, p_tenders jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); t pos_tab; v_lines jsonb; r jsonb;
begin
  select * into t from pos_tab where id = p_tab and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if t.status = 'paid' then
    return (select jsonb_build_object(
              'tab_id', t.id, 'order_id', o.id, 'replayed', true,
              'gross', o.gross_amount, 'discount', o.discount_amount, 'net', o.net_amount,
              'journal_no', (select journal_no from journal_entry
                              where reference_type = 'sales_order' and reference_id = o.id
                                and reverses_entry is null limit 1),
              'turn_no', o.turn_no, 'payments', order_payments(o.id))
              from sales_order o where o.id = t.sales_order_id);
  end if;
  t := lock_open_tab(v_business, p_tab, p_version);
  select jsonb_agg(jsonb_build_object('variant_id', tl.product_variant_id, 'qty', tl.qty, 'price', tl.unit_price,
                     'modifiers', (select coalesce(jsonb_agg(jsonb_build_object('modifier_id', lm.modifier_id,
                                                             'qty', lm.qty, 'price', lm.unit_price)
                                                           order by lm.position, lm.id), '[]')
                                     from pos_tab_line_modifier lm where lm.tab_line_id = tl.id))
                   order by tl.position)
    into v_lines from pos_tab_line tl where tl.tab_id = p_tab;
  if v_lines is null then raise exception 'The bill is empty'; end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, t.channel, p_tender, v_lines,
                 t.location_id, t.discount_percent, t.discount_amount, true,
                 jsonb_build_object('checked', true, 'by', t.discount_by, 'approved_by', t.discount_approved_by,
                                    'reason', t.discount_reason),
                 t.turn_no, p_stock_approval, p_tenders, p_expected_net);
  if coalesce((r ->> 'replayed')::boolean, false) then
    -- That key already paid for something else: never attach its sale to this bill.
    raise exception 'That payment was already used for another sale. Try again.';
  end if;
  update pos_tab
     set status = 'paid', sales_order_id = (r ->> 'order_id')::uuid, closed_at = now(),
         closed_by = (current_member()).id, turn_no = (r ->> 'turn_no')::int
   where id = p_tab;
  return r || jsonb_build_object('tab_id', p_tab);
end $$;

-- ---------------------------------------------------------------------------
-- 3. The drawer: a void takes back the sale's cash, a refund gives back its own
-- ---------------------------------------------------------------------------
-- A void takes back what the sale put in the drawer: its cash payments, not
-- its card's. A refund's cash leaves with its cash payment, below.
create or replace function trg_cash_from_adjustment() returns trigger
language plpgsql security definer set search_path = public as $$
declare o sales_order; v_cash numeric;
begin
  if NEW.kind <> 'void' or coalesce(NEW.amount, 0) = 0 then return NEW; end if;
  select * into o from sales_order where id = NEW.sales_order_id;
  select coalesce(sum(amount), 0) into v_cash from cash_event
   where reference_type = 'sales_order' and reference_id = o.id and kind = 'sale';
  if v_cash <> 0 then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (o.business_id, o.location_id, 'void', -v_cash, 'sale_adjustment', NEW.id, NEW.requested_by);
  end if;
  return NEW;
end $$;

-- A refund's cash leaves the drawer's open session, which must hold it; its
-- card and platform parts do not touch the drawer. The event names the refund's
-- adjustment, as it did before 0042.
create or replace function trg_cash_from_refund_tender() returns trigger
language plpgsql security definer set search_path = public as $$
declare r sale_refund; o sales_order;
begin
  if NEW.tender_type <> 'cash' then return NEW; end if;
  select * into r from sale_refund where id = NEW.refund_id;
  select * into o from sales_order where id = r.sales_order_id;
  perform assert_drawer_can_pay(o.business_id, o.location_id, NEW.amount);
  insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
  values (o.business_id, o.location_id, 'refund', -NEW.amount, 'sale_adjustment', NEW.refund_id, r.requested_by);
  return NEW;
end $$;
drop trigger if exists sale_refund_tender_cash on sale_refund_tender;
create trigger sale_refund_tender_cash after insert on sale_refund_tender
  for each row execute function trg_cash_from_refund_tender();

-- ---------------------------------------------------------------------------
-- 4. A refund given back per payment
-- ---------------------------------------------------------------------------
-- What is left of each way a sale was paid: what its payments took, less what
-- refunds gave back of it. A refund from before 0037 names no payment: it gave
-- back the sale's one.
create or replace function refundable_payments(p_order uuid)
returns table (tender_type tender_type, paid numeric, refunded numeric, left_amount numeric)
language sql stable set search_path = public as $$
  with p as (
    select st.tender_type, min(st.position) as pos, sum(st.amount) as paid
      from sales_tender st where st.sales_order_id = p_order group by st.tender_type
  ), b as (
    select rt.tender_type, sum(rt.amount) as back
      from sale_refund r join sale_refund_tender rt on rt.refund_id = r.id
     where r.sales_order_id = p_order group by rt.tender_type
  ), old as (
    select coalesce(sum(a.amount), 0) as back from sale_adjustment a
     where a.sales_order_id = p_order and a.kind = 'refund'
       and not exists (select 1 from sale_refund r where r.id = a.id)
  )
  select p.tender_type, p.paid,
         coalesce(b.back, 0) + case when p.pos = (select min(pos) from p) then (select back from old) else 0 end,
         p.paid - coalesce(b.back, 0)
                - case when p.pos = (select min(pos) from p) then (select back from old) else 0 end
    from p left join b on b.tender_type = p.tender_type
   order by p.pos, p.tender_type
$$;

-- 0040's refund_lines_internal, giving the money back per payment (0042):
-- as p_tenders says ([{type, amount}], each at most what is left of that way of
-- paying, together the refund), or else in proportion to what is left of each.
-- The journal credits each payment's account; its cash leaves the drawer.
drop function if exists refund_lines_internal(uuid, uuid, uuid, jsonb, text, text, uuid);
create or replace function refund_lines_internal(p_business uuid, p_me uuid, p_order uuid, p_lines jsonb, p_reason_code text,
                                      p_reason text, p_approval uuid, p_tenders jsonb default null)
returns jsonb language plpgsql set search_path = public as $$
declare
  o sales_order; v_paid numeric; v_reason text; v_code text;
  v_approver uuid := p_me; a approval; v_id uuid := gen_random_uuid(); v_no bigint;
  v_has_lines boolean; v_legacy boolean; l record; it record;
  v_left numeric; v_left_amount numeric; v_want numeric; v_line_amount numeric; v_line_cost numeric;
  v_restocked boolean; v_q numeric; v_v numeric; v_rest boolean := false;
  v_plan jsonb := '[]'; v_moves jsonb := '[]'; v_amount numeric := 0; v_cost numeric := 0;
  v_journal uuid; v_status order_status; p jsonb; v_items text; v_before numeric;
  v_types tender_type[]; v_lefts numeric[]; v_parts numeric[]; v_left_total numeric; pt jsonb; i int;
  v_back jsonb := '[]';
begin
  select * into o from sales_order where id = p_order and business_id = p_business for update;
  if not found then raise exception 'Sale not found'; end if;
  if o.status = 'refunded' then raise exception 'This sale has been refunded in full already'; end if;
  if o.status = 'voided' then raise exception 'This sale was voided: there is nothing to refund'; end if;
  if o.status not in ('completed', 'partially_refunded') then
    raise exception 'Only a completed sale can be refunded; this one is %', o.status;
  end if;
  select array_agg(rp.tender_type order by rp.ord), array_agg(rp.left_amount order by rp.ord), sum(rp.paid)
    into v_types, v_lefts, v_paid
    from refundable_payments(p_order) with ordinality rp(tender_type, paid, refunded, left_amount, ord);
  if v_types is null or exists (select 1 from unnest(v_types) t where tender_account(t) is null) then
    raise exception 'This sale''s tender cannot be refunded here';
  end if;
  v_reason := reason_text('refund', p_reason_code, p_reason);
  v_code := coalesce(nullif(trim(p_reason_code), ''), 'other');
  if p_approval is not null then
    a := use_approval(p_business, p_approval, 'refund', p_order::text);
    if a.scope ->> 'order_id' is distinct from p_order::text then
      raise exception 'That approval is for another sale';
    end if;
    v_approver := a.approver_id;
  end if;

  if p_lines is not null then
    if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
      raise exception 'Choose what to refund';
    end if;
    if exists (select 1 from jsonb_array_elements(p_lines) x
                where jsonb_typeof(x) <> 'object'
                   or coalesce(x ->> 'line_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   or coalesce(x ->> 'qty', '') !~ '^[0-9]+(\.[0-9]+)?$') then
      raise exception 'The items to refund cannot be read';
    end if;
    if exists (select 1 from jsonb_array_elements(p_lines) x
                where not exists (select 1 from sales_order_line sl
                                   where sl.id = (x ->> 'line_id')::uuid and sl.sales_order_id = p_order)) then
      raise exception 'That item is not on this sale';
    end if;
    if (select count(*) from jsonb_array_elements(p_lines)) <>
       (select count(distinct x ->> 'line_id') from jsonb_array_elements(p_lines) x) then
      raise exception 'An item is named twice';
    end if;
  end if;
  if p_tenders is not null then
    if jsonb_typeof(p_tenders) <> 'array' or jsonb_array_length(p_tenders) = 0
       or exists (select 1 from jsonb_array_elements(p_tenders) x
                   where case when jsonb_typeof(x) = 'object' and jsonb_typeof(x -> 'amount') = 'number'
                                   and coalesce(x ->> 'type', '') in ('cash', 'card', 'platform_paid')
                              then (x ->> 'amount')::numeric <= 0
                                   or (x ->> 'amount')::numeric <> money_round(p_business, (x ->> 'amount')::numeric)
                              else true end) then
      raise exception 'The payments to give back cannot be read';
    end if;
    if (select count(*) from jsonb_array_elements(p_tenders)) <>
       (select count(distinct x ->> 'type') from jsonb_array_elements(p_tenders) x) then
      raise exception 'A payment is named twice';
    end if;
  end if;

  v_has_lines := exists (select 1 from sales_order_line where sales_order_id = p_order);
  -- Recorded before 0037: its stock movements do not name its lines.
  v_legacy := not v_has_lines
              or exists (select 1 from inventory_movement mv
                          where mv.reference_type = 'sales_order' and mv.reference_id = p_order
                            and mv.type = 'sale_consumption' and mv.sales_order_line_id is null);

  for l in
    select sl.id, sl.quantity, sl.line_net, coalesce(nullif(sl.product_name, ''), pr.name, pv.name) as name,
           coalesce((select sum(rl.qty) from sale_refund_line rl where rl.sales_order_line_id = sl.id), 0) as done_qty,
           coalesce((select sum(rl.amount) from sale_refund_line rl where rl.sales_order_line_id = sl.id), 0)
             as done_amount,
           (select (x ->> 'qty')::numeric from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) x
             where (x ->> 'line_id')::uuid = sl.id) as asked
      from sales_order_line sl
      left join product_variant pv on pv.id = sl.product_variant_id
      left join product pr on pr.id = pv.product_id
     where sl.sales_order_id = p_order
     order by sl.id
  loop
    v_left := l.quantity - l.done_qty;
    v_left_amount := l.line_net - l.done_amount;
    v_want := case when p_lines is null then v_left else coalesce(l.asked, 0) end;
    if v_want > v_left then
      raise exception 'Only % of % is left to refund', trim_scale(v_left), l.name;
    end if;
    if v_want > 0 then
      v_line_amount := case when v_want = v_left then v_left_amount
                            else least(v_left_amount, money_round(p_business, l.line_net * v_want / l.quantity)) end;
      v_line_cost := 0;
      v_restocked := false;
      if not v_legacy then
        -- The line's own stock that can go back on the shelf, in proportion:
        -- what it took, less what earlier refunds of it gave back.
        for it in
          select mv.item_id, -sum(mv.base_quantity_signed) as sold_q, coalesce(sum(mv.value), 0) as sold_v,
                 coalesce((select sum(r.base_quantity_signed) from inventory_movement r
                            where r.sales_order_line_id = l.id and r.item_id = mv.item_id
                              and r.type = 'refund_return_to_stock'), 0) as back_q,
                 coalesce((select sum(r.value) from inventory_movement r
                            where r.sales_order_line_id = l.id and r.item_id = mv.item_id
                              and r.type = 'refund_return_to_stock'), 0) as back_v
            from inventory_movement mv join item i on i.id = mv.item_id
           where mv.sales_order_line_id = l.id and mv.type = 'sale_consumption' and i.returnable_to_stock
           group by mv.item_id
           order by mv.item_id
        loop
          if v_want = v_left then
            v_q := it.sold_q - it.back_q;
            v_v := it.sold_v - it.back_v;
          else
            v_q := round(it.sold_q * v_want / l.quantity, 6);
            v_v := least(it.sold_v - it.back_v, money_round(p_business, it.sold_v * v_want / l.quantity));
          end if;
          if v_q > 0 then
            v_moves := v_moves || jsonb_build_object('line_id', l.id, 'item_id', it.item_id, 'qty', v_q, 'value', v_v);
            v_line_cost := v_line_cost + v_v;
            v_restocked := true;
          end if;
        end loop;
      end if;
      v_plan := v_plan || jsonb_build_object('line_id', l.id, 'name', l.name, 'qty', v_want, 'amount', v_line_amount,
                                             'cost_returned', v_line_cost, 'restocked', v_restocked);
      v_amount := v_amount + v_line_amount;
      v_cost := v_cost + v_line_cost;
    end if;
    if v_left - v_want > 0 then v_rest := true; end if;
  end loop;

  if v_legacy then
    -- Refunded whole, as before 0037: every movement of the sale's that can
    -- go back on the shelf does.
    if v_rest then raise exception 'This sale was recorded before refunds by item: refund all of it'; end if;
    for it in
      select mv.item_id, -mv.base_quantity_signed as q, coalesce(mv.value, 0) as v
        from inventory_movement mv join item i on i.id = mv.item_id
       where mv.reference_type = 'sales_order' and mv.reference_id = p_order
         and mv.type = 'sale_consumption' and i.returnable_to_stock
       order by mv.id
    loop
      v_moves := v_moves || jsonb_build_object('line_id', null, 'item_id', it.item_id, 'qty', it.q, 'value', it.v);
      v_cost := v_cost + it.v;
    end loop;
    if not v_has_lines then v_amount := o.net_amount - sale_refunded(p_order); end if;
  elsif jsonb_array_length(v_plan) = 0 then
    raise exception 'Choose what to refund';
  end if;
  if v_amount <= 0 then
    raise exception 'The items chosen were sold for nothing: there is no money to give back';
  end if;
  v_before := sale_refunded(p_order);
  select sum(t) into v_left_total from unnest(v_lefts) t;
  if v_amount > v_left_total then
    raise exception 'This refund is more than is left of what was paid (%)', trim_scale(v_left_total);
  end if;
  -- Over the limit of the refunder's roles, a second person approves it (0040).
  if p_approval is null and v_amount > member_rule_number(p_business, 'refund_approval_over', p_me) then
    raise exception 'A refund over % needs a second person to approve it',
      alert_money(member_rule_number(p_business, 'refund_approval_over', p_me));
  end if;

  -- The money back, per way it was paid (0042).
  v_parts := array_fill(0::numeric, array[cardinality(v_types)]);
  if p_tenders is not null then
    for pt in select * from jsonb_array_elements(p_tenders) loop
      i := array_position(v_types, (pt ->> 'type')::tender_type);
      if i is null or (pt ->> 'amount')::numeric > v_lefts[i] then
        if pt ->> 'type' = 'cash' then
          raise exception 'Only % of the cash paid is left to give back', trim_scale(coalesce(v_lefts[i], 0));
        elsif pt ->> 'type' = 'card' then
          raise exception 'Only % of the card payment is left to give back', trim_scale(coalesce(v_lefts[i], 0));
        end if;
        raise exception 'Only % of the platform''s payment is left to give back', trim_scale(coalesce(v_lefts[i], 0));
      end if;
      v_parts[i] := (pt ->> 'amount')::numeric;
    end loop;
    if (select sum(t) from unnest(v_parts) t) <> v_amount then
      raise exception 'The refund is %, but the payments given back come to %', trim_scale(v_amount),
        trim_scale((select sum(t) from unnest(v_parts) t));
    end if;
  else
    -- In proportion to what is left of each, in whole units, adding up to the
    -- refund exactly (the rounding receipts use for landed costs).
    v_parts := allocate_landed(p_business, (select array_agg(greatest(u.t, 0) order by u.ord)
                                              from unnest(v_lefts) with ordinality u(t, ord)),
                               v_amount - (select sum(greatest(t, 0)) from unnest(v_lefts) t));
  end if;
  for i in 1 .. cardinality(v_types) loop
    if v_parts[i] > 0 then
      v_back := v_back || jsonb_build_object('type', v_types[i], 'amount', v_parts[i]);
    end if;
  end loop;

  -- The adjustment first: the refund is the sale's adjustment (0037).
  insert into sale_adjustment (id, business_id, sales_order_id, kind, amount, reason, reason_code, requested_by,
                               approved_by)
  values (v_id, p_business, p_order, 'refund', v_amount, v_reason, v_code, p_me, v_approver);
  v_no := next_document_no(p_business, 'refund', 1);
  if jsonb_array_length(v_moves) > 0 then
    perform lock_items(array(select distinct (x ->> 'item_id')::uuid from jsonb_array_elements(v_moves) x));
  end if;
  v_journal := post_journal(p_business, now(),
    'Refund ' || v_no || ' of sale ' || left(p_order::text, 8) || ': ' || v_reason, 'sale_refund', v_id,
    jsonb_build_array(jsonb_build_object('code', '4200', 'debit', v_amount))
    || coalesce((select jsonb_agg(jsonb_build_object('code', tender_account((b ->> 'type')::tender_type),
                                                     'credit', (b ->> 'amount')::numeric) order by e.ord)
                   from jsonb_array_elements(v_back) with ordinality e(b, ord)), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('code', '1200', 'debit', v_cost),
      jsonb_build_object('code', '5000', 'credit', v_cost)));
  insert into sale_refund (id, business_id, refund_no, sales_order_id, location_id, work_shift_id, amount,
                           cost_returned, reason_code, reason, requested_by, approved_by, approval_id,
                           journal_entry_id, whole)
  values (v_id, p_business, v_no, p_order, o.location_id, open_session_at(p_business, o.location_id), v_amount,
          v_cost, v_code, v_reason, p_me, v_approver, p_approval, v_journal, not v_rest);
  for p in select * from jsonb_array_elements(v_plan) loop
    insert into sale_refund_line (business_id, refund_id, sales_order_line_id, qty, amount, cost_returned, restocked)
    values (p_business, v_id, (p ->> 'line_id')::uuid, (p ->> 'qty')::numeric, (p ->> 'amount')::numeric,
            (p ->> 'cost_returned')::numeric, (p ->> 'restocked')::boolean);
  end loop;
  -- Each way it goes back; the cash leaves the drawer's open session, which
  -- must hold it (trg_cash_from_refund_tender).
  for p in select * from jsonb_array_elements(v_back) loop
    insert into sale_refund_tender (business_id, refund_id, tender_type, amount)
    values (p_business, v_id, (p ->> 'type')::tender_type, (p ->> 'amount')::numeric);
  end loop;
  for p in select * from jsonb_array_elements(v_moves) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason, sales_order_line_id)
    values (p_business, (p ->> 'item_id')::uuid, o.location_id, 'refund_return_to_stock', (p ->> 'qty')::numeric,
            (p ->> 'value')::numeric / (p ->> 'qty')::numeric, (p ->> 'value')::numeric,
            'sale_refund', v_id, p_me, 'Refund: ' || v_reason, (p ->> 'line_id')::uuid);
  end loop;

  v_status := case when v_rest then 'partially_refunded' else 'refunded' end::order_status;
  if v_status is distinct from o.status then
    update sales_order set status = v_status where id = p_order;
  end if;
  select string_agg((x ->> 'name') || ' ×' || trim_scale((x ->> 'qty')::numeric), ', ')
    into v_items from jsonb_array_elements(v_plan) x;
  perform audit_event(p_business, 'sale.refund', 'sales_order', p_order::text, v_reason,
    jsonb_build_object('status', o.status, 'net', o.net_amount, 'refunded', v_before),
    jsonb_build_object('status', v_status, 'refund_no', v_no, 'refunded', v_before + v_amount,
                       'amount', v_amount, 'items', v_items, 'returned_to_stock', v_cost,
                       'approved_by', v_approver)
    || case when jsonb_array_length(v_back) > 1 then jsonb_build_object('tenders', v_back) else '{}'::jsonb end);
  return jsonb_build_object('order_id', p_order, 'refund_id', v_id, 'refund_no', v_no, 'refunded', v_amount,
    'returned_to_stock', v_cost, 'tender', v_back -> 0 ->> 'type', 'tenders', v_back, 'status', v_status,
    'whole', not v_rest, 'lines', v_plan,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- 0037's refund_sale_lines, with how the money goes back (p_tenders), before
-- the key as every keyed write takes it. A request sent without it is stored
-- as before, so a retry from a till loaded before 0042 is still answered.
drop function if exists refund_sale_lines(uuid, jsonb, text, text, uuid, uuid);
create or replace function refund_sale_lines(p_order uuid, p_lines jsonb, p_reason_code text default null,
  p_reason text default null, p_approval uuid default null, p_tenders jsonb default null,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.refund');
  v_req jsonb := jsonb_build_object('p_order', p_order, 'p_lines', p_lines, 'p_reason_code', p_reason_code,
                                    'p_reason', p_reason, 'p_approval', p_approval)
                 || case when p_tenders is not null then jsonb_build_object('p_tenders', p_tenders)
                         else '{}'::jsonb end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'refund_sale_lines', v_req);
  if v is not null then return v; end if;
  v := refund_lines_internal(v_business, (current_member()).id, p_order, p_lines, p_reason_code, p_reason,
                             p_approval, p_tenders);
  perform idem_finish(v_business, p_idempotency_key, 'refund_sale_lines', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 5. The day's and the drawer's figures, a split sale counted once
-- ---------------------------------------------------------------------------
-- 0036's day_cash_totals: the cash refunds are the cash each refund gave back
-- (a refund from before 0037 names no payment: all of it, if the sale was paid
-- in cash).
create or replace function day_cash_totals(p_business uuid, p_location uuid, p_day date,
  out cash_sales numeric, out cash_refunds numeric, out orders integer)
returns record language sql stable as $$
  select
    coalesce((select sum(t.amount) from sales_order o join sales_tender t on t.sales_order_id = o.id
               where o.business_id = p_business and o.location_id = p_location and t.tender_type = 'cash'
                 and o.status in ('completed', 'refunded', 'partially_refunded')
                 and business_local_date(p_business, o.placed_at) = p_day), 0),
    coalesce((select sum(case when exists (select 1 from sale_refund r where r.id = a.id)
                              then (select coalesce(sum(rt.amount), 0) from sale_refund_tender rt
                                     where rt.refund_id = a.id and rt.tender_type = 'cash')
                              when exists (select 1 from sales_tender t
                                            where t.sales_order_id = o.id and t.tender_type = 'cash')
                              then a.amount else 0 end)
               from sale_adjustment a join sales_order o on o.id = a.sales_order_id
              where a.business_id = p_business and o.location_id = p_location and a.kind = 'refund'
                and business_local_date(p_business, a.created_at) = p_day), 0),
    (select count(*)::int from sales_order o
      where o.business_id = p_business and o.location_id = p_location and o.status <> 'voided'
        and business_local_date(p_business, o.placed_at) = p_day)
$$;

-- 0036's drawer_status: a sale paid two ways is one order.
create or replace function drawer_status(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close', 'cost.view');
  v_see boolean := current_has_permission('cash.view_expected');
  v_location uuid; v_open uuid; d record; t record; s record;
begin
  v_location := resolve_location(v_business, p_location);
  v_open := open_session_at(v_business, v_location);
  d := drawer_position(v_business, v_location);
  select coalesce(sum(amount) filter (where kind = 'sale'), 0) as sales,
         coalesce(-sum(amount) filter (where kind = 'refund'), 0) as refunds,
         coalesce(-sum(amount) filter (where kind = 'void'), 0) as voids,
         coalesce(-sum(amount) filter (where kind in ('paid_out', 'paid_out_reversed')), 0) as paid_out,
         coalesce(sum(amount) filter (where kind = 'cash_in'), 0) as cash_in,
         coalesce(-sum(amount) filter (where kind = 'cash_out'), 0) as cash_out
    into t from cash_event
   where business_id = v_business and location_id = v_location
     and (work_shift_id = v_open or (v_open is null and work_shift_id is null));
  select count(distinct o.id) filter (where o.status <> 'voided') as orders,
         coalesce(sum(tn.amount) filter (where tn.tender_type = 'card' and o.status <> 'voided'), 0) as card,
         coalesce(sum(tn.amount) filter (where tn.tender_type = 'platform_paid' and o.status <> 'voided'), 0) as platform
    into s from sales_order o join sales_tender tn on tn.sales_order_id = o.id
   where o.business_id = v_business and o.location_id = v_location
     and (d.last_count_at is null or o.created_at > d.last_count_at);
  return jsonb_build_object(
    'location_id', v_location, 'since', d.last_count_at, 'needs_start', d.needs_start and v_see,
    'start', case when v_see then d.carry end,
    'cash_sales', case when v_see then t.sales end, 'refunds', case when v_see then t.refunds end,
    'voids', case when v_see then t.voids end, 'paid_out', case when v_see then t.paid_out end,
    'cash_in', case when v_see then t.cash_in end, 'cash_out', case when v_see then t.cash_out end,
    'moved', case when v_see then d.moved end, 'events', case when v_see then d.events end,
    'expected', case when v_see and not d.needs_start then d.carry + d.moved end,
    'orders', s.orders, 'card', s.card, 'platform', s.platform,
    'open_bills', (select count(*) from pos_tab where business_id = v_business and location_id = v_location and status = 'open'),
    'safe', gl_balance_at(v_business, '1005', 'infinity'),
    'session_open', v_open is not null);
end $$;

-- ---------------------------------------------------------------------------
-- 6. The takings by how they were paid
-- ---------------------------------------------------------------------------
-- Each way of paying (cost.view): the sales placed in the dates that it paid
-- for, voids left out, what it took of them, how many of those sales were paid
-- more than one way, the change cash gave; and what refunds made in the dates
-- gave back that way (a refund from before 0037: the sale's one payment).
create or replace function report_payments(p_from date, p_to date)
returns table (method tender_type, sales bigint, taken numeric, split_sales bigint, change_given numeric,
               refunded numeric, net numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record;
begin
  b := local_day_bounds(v_business, p_from, p_to);
  return query
    with t as (
      select st.tender_type as m, count(distinct o.id) as n, sum(st.amount) as amt,
             count(distinct o.id) filter (where exists (select 1 from sales_tender x
                                                          where x.sales_order_id = o.id
                                                            and x.tender_type <> st.tender_type)) as split,
             sum(coalesce(st.change_given, 0)) as change
        from sales_order o join sales_tender st on st.sales_order_id = o.id
       where o.business_id = v_business and o.status not in ('voided', 'open')
         and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
       group by 1
    ),
    r as (
      select rt.tender_type as m, rt.amount as back
        from sale_refund r join sale_refund_tender rt on rt.refund_id = r.id
       where r.business_id = v_business and r.created_at >= b.from_ts and r.created_at < b.to_ts
      union all
      select (select st.tender_type from sales_tender st where st.sales_order_id = a.sales_order_id
               order by st.position, st.id limit 1), a.amount
        from sale_adjustment a
       where a.business_id = v_business and a.kind = 'refund'
         and a.created_at >= b.from_ts and a.created_at < b.to_ts
         and not exists (select 1 from sale_refund r where r.id = a.id)
    ),
    rr as (select r.m, sum(r.back) as back from r where r.m is not null group by r.m)
    select coalesce(t.m, rr.m), coalesce(t.n, 0), coalesce(t.amt, 0), coalesce(t.split, 0), coalesce(t.change, 0),
           coalesce(rr.back, 0), coalesce(t.amt, 0) - coalesce(rr.back, 0)
      from t full join rr on rr.m = t.m
     order by 1;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  order_payments(uuid),
  sale_payments(uuid, sales_channel, tender_type, jsonb),
  post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb, int, uuid,
            jsonb, numeric),
  trg_cash_from_refund_tender(),
  refundable_payments(uuid),
  refund_lines_internal(uuid, uuid, uuid, jsonb, text, text, uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text, uuid,
              jsonb),
  settle_tab(uuid, int, uuid, tender_type, numeric, uuid, jsonb),
  refund_sale_lines(uuid, jsonb, text, text, uuid, jsonb, uuid),
  report_payments(date, date)
  from public, anon;
grant execute on function
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text, uuid,
              jsonb),
  settle_tab(uuid, int, uuid, tender_type, numeric, uuid, jsonb),
  refund_sale_lines(uuid, jsonb, text, text, uuid, jsonb, uuid),
  report_payments(date, date)
  to authenticated;
