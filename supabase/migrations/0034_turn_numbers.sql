-- =============================================================================
-- 0034 — A turn number on every order, for the barista's ticket
-- =============================================================================
-- The owner asked that an order printed at the till comes out twice: the full
-- check for the cashier and the customer, and a ticket for the barista with
-- what to make and the order's number, so each customer is called in turn.
-- The number is the database's, so two tills never give out the same one:
--
--  * every order takes the next number of its day, starting at 1 each day
--    (the day by the café's clock, as for everything else). A number is taken
--    in the same transaction as its order: an order refused takes none, and
--    no number is skipped;
--  * a bill takes its number when it is opened, since its ticket goes to the
--    bar when it is saved, long before it is paid. Paid, its sale keeps that
--    number, and so does the part of it split off to be paid on its own;
--  * a quick sale takes its number as it is recorded. A payment sent again
--    after a lost answer is the sale already recorded, with its number.
--
-- A finalized sale never changes (0014), so the number is written as the sale
-- is completed, inside post_sale; record_sale returns post_sale's answer, and
-- so returns the number unchanged. Nothing else changes: not what is sold,
-- paid or posted.

-- =============================================================================
-- 1. The numbers
-- =============================================================================
alter table pos_tab add column if not exists turn_no int;
alter table sales_order add column if not exists turn_no int;

-- The next number of the day, from the counters every document number comes from.
create or replace function take_turn_no(p_business uuid, p_day date) returns int
language sql set search_path = public as $$
  select next_document_no(p_business, 'turn:' || p_day::text, 1)::int
$$;

-- A bill takes its number as it is opened, however it is opened.
create or replace function trg_pos_tab_turn_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.turn_no is null then
    NEW.turn_no := take_turn_no(NEW.business_id, NEW.business_day);
  end if;
  return NEW;
end $$;

drop trigger if exists pos_tab_turn_no on pos_tab;
create trigger pos_tab_turn_no
  before insert on pos_tab
  for each row execute function trg_pos_tab_turn_no();

-- =============================================================================
-- 2. A sale takes its number as it is recorded
-- =============================================================================
-- 0028's post_sale, told the number of the bill being paid (p_turn_no), or
-- taking the next of the day for a quick sale.
drop function if exists post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb);
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric,
  p_trust_line_prices boolean default false, p_discount jsonb default null, p_turn_no int default null)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_business uuid := p_business;
  v_me uuid := p_me;
  v_location uuid;
  v_order uuid;
  v_existing record;
  v_today date;
  v_prevent_negative boolean;
  l jsonb; v_variant uuid; v_qty numeric; v_price numeric;
  v_variants uuid[] := '{}'; v_qtys numeric[] := '{}'; v_prices numeric[] := '{}'; v_gross_lines numeric[] := '{}';
  v_nets numeric[]; v_gross numeric := 0; v_discount numeric := 0; v_net numeric; v_cogs numeric := 0;
  d record; v_cost numeric; v_value numeric; v_line_cogs numeric; n int; i int;
  v_items uuid[];
  v_journal uuid;
  v_disc_by uuid; v_disc_approved uuid; v_disc_reason text; v_turn int;
begin
  if p_idempotency_key is null then
    raise exception 'A sale needs its idempotency key';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  if p_tender not in ('cash', 'card', 'platform_paid') then
    raise exception 'Tender % is not supported', p_tender;
  end if;
  if is_platform_channel(p_channel) <> (p_tender = 'platform_paid') then
    raise exception 'Delivery-platform orders are platform-paid, and only they are';
  end if;

  -- Replay: the same key returns the sale it already recorded.
  select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
    from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'turn_no', v_existing.turn_no)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  if (p_discount_percent is not null or p_discount_amount is not null) and is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets its own discounts; none is given at the till';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, now());
  select prevent_negative_stock into v_prevent_negative from business where id = v_business;

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
             'turn_no', v_existing.turn_no)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  -- Lock every item this sale touches, in a stable order.
  select array_agg(distinct e.item_id) into v_items
    from jsonb_array_elements(p_lines) x,
         lateral expand_variant((x ->> 'variant_id')::uuid, p_channel, (x ->> 'qty')::numeric, v_today) e;
  if v_items is not null then perform lock_items(v_items); end if;

  -- Refuse to sell what is not there, when the business asks for that.
  if v_prevent_negative and v_items is not null then
    for d in
      select e.item_id, sum(e.base_qty) as need, i2.name
        from jsonb_array_elements(p_lines) x,
             lateral expand_variant((x ->> 'variant_id')::uuid, p_channel, (x ->> 'qty')::numeric, v_today) e
        join item i2 on i2.id = e.item_id
       group by e.item_id, i2.name
    loop
      if (item_position(v_business, d.item_id, v_location)).qty < d.need then
        raise exception 'Not enough % in stock to make this sale', d.name;
      end if;
    end loop;
  end if;

  -- Price every line first: the discount is shared out over the whole bill.
  for l in select * from jsonb_array_elements(p_lines) loop
    v_variant := (l ->> 'variant_id')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = v_variant and pv.business_id = v_business and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    -- A bill's printed price, passed by settle_tab alone (0025); otherwise today's.
    v_price := case when p_trust_line_prices and nullif(l ->> 'price', '') is not null
                    then (l ->> 'price')::numeric
                    else price_on(v_variant, p_channel, v_location, v_today) end;
    if v_price is null then
      raise exception 'No % price is set for this product', p_channel;
    end if;
    v_variants := v_variants || v_variant;
    v_qtys := v_qtys || v_qty;
    v_prices := v_prices || v_price;
    v_gross_lines := v_gross_lines || money_round(v_business, v_price * v_qty);
    v_gross := v_gross + money_round(v_business, v_price * v_qty);
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

  n := cardinality(v_variants);
  for i in 1 .. n loop
    -- One costed movement per component per line, so every figure ties:
    -- line COGS = its movements; order COGS = all movements = the journal.
    -- Cost first, then write the line once: lines are append-only.
    v_line_cogs := 0;
    for d in select * from expand_variant(v_variants[i], p_channel, v_qtys[i], v_today) loop
      v_cost := item_issue_cost(v_business, d.item_id, v_location);
      v_value := money_round(v_business, v_cost * d.base_qty);
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                      unit_cost, value, reference_type, reference_id, app_user_id, reason)
      values (v_business, d.item_id, v_location, 'sale_consumption', -d.base_qty,
              case when d.base_qty > 0 then v_value / d.base_qty end, v_value,
              'sales_order', v_order, v_me, 'Sale');
      v_line_cogs := v_line_cogs + v_value;
    end loop;

    insert into sales_order_line (sales_order_id, product_variant_id, quantity, unit_price, line_discount, line_net, cogs_amount)
    values (v_order, v_variants[i], v_qtys[i], v_prices[i], v_gross_lines[i] - v_nets[i], v_nets[i], v_line_cogs);
    v_cogs := v_cogs + v_line_cogs;
  end loop;

  insert into sales_tender (sales_order_id, tender_type, amount) values (v_order, p_tender, v_net);

  -- Its turn number (0034): the bill's own, or the next of the day. Taken in
  -- the sale's own transaction, so a sale refused takes none.
  v_turn := coalesce(p_turn_no, take_turn_no(v_business, v_today));
  update sales_order
     set gross_amount = v_gross, discount_amount = v_discount, net_amount = v_net, cogs_amount = v_cogs,
         discount_percent = case when v_discount > 0 then p_discount_percent end,
         discount_by = v_disc_by, discount_approved_by = v_disc_approved, discount_reason = v_disc_reason,
         status = 'completed', turn_no = v_turn
   where id = v_order;

  -- Revenue at the full price; the discount on its own line (none posts when it is zero).
  v_journal := post_journal(v_business, now(), 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
    jsonb_build_array(
      jsonb_build_object('code', tender_account(p_tender), 'debit', v_net),
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
    'turn_no', v_turn)
    || sale_cost_view(v_cogs);
end $$;

-- =============================================================================
-- 3. A bill's sale keeps the bill's number
-- =============================================================================
-- 0028's settle_tab, passing the bill's number to its sale.
create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type,
                                      p_expected_net numeric default null)
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
              'turn_no', o.turn_no)
              from sales_order o where o.id = t.sales_order_id);
  end if;
  t := lock_open_tab(v_business, p_tab, p_version);
  select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty, 'price', unit_price)
                   order by position)
    into v_lines from pos_tab_line where tab_id = p_tab;
  if v_lines is null then raise exception 'The bill is empty'; end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, t.channel, p_tender, v_lines,
                 t.location_id, t.discount_percent, t.discount_amount, true,
                 jsonb_build_object('checked', true, 'by', t.discount_by, 'approved_by', t.discount_approved_by,
                                    'reason', t.discount_reason),
                 t.turn_no);
  if coalesce((r ->> 'replayed')::boolean, false) then
    -- That key already paid for something else: never attach its sale to this bill.
    raise exception 'That payment was already used for another sale. Try again.';
  end if;
  perform assert_sale_total(r, p_expected_net);
  update pos_tab
     set status = 'paid', sales_order_id = (r ->> 'order_id')::uuid, closed_at = now(),
         closed_by = (current_member()).id, turn_no = (r ->> 'turn_no')::int
   where id = p_tab;
  return r || jsonb_build_object('tab_id', p_tab);
end $$;

-- 0028's split_tab: the new bill keeps the number of the bill it came from.
create or replace function split_tab(p_tab uuid, p_version int, p_move jsonb, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  t pos_tab; m jsonb; v_line pos_tab_line; v_qty numeric; v_new uuid; i int := 0;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  if p_move is null or jsonb_typeof(p_move) <> 'array' or jsonb_array_length(p_move) = 0 then
    raise exception 'Choose what to move to the new bill';
  end if;
  if (select count(distinct x ->> 'line_id') from jsonb_array_elements(p_move) x) <> jsonb_array_length(p_move) then
    raise exception 'Each line can be moved once';
  end if;
  insert into pos_tab (business_id, location_id, table_id, label, channel, business_day, opened_by,
                       bill_printed_at, discount_percent, discount_by, discount_approved_by, discount_reason,
                       turn_no)
  values (v_business, t.location_id, t.table_id,
          coalesce(nullif(trim(p_label), ''), t.label), t.channel, t.business_day, v_me, t.bill_printed_at,
          t.discount_percent,
          case when t.discount_percent is not null then t.discount_by end,
          case when t.discount_percent is not null then t.discount_approved_by end,
          case when t.discount_percent is not null then t.discount_reason end,
          t.turn_no)
  returning id into v_new;
  for m in select * from jsonb_array_elements(p_move) loop
    select * into v_line from pos_tab_line where id = (m ->> 'line_id')::uuid and tab_id = p_tab;
    if not found then raise exception 'That line is not on this bill'; end if;
    v_qty := (m ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > v_line.qty then
      raise exception 'Move between 1 and % of %', v_line.qty,
        (select p.name from product_variant pv join product p on p.id = pv.product_id where pv.id = v_line.product_variant_id);
    end if;
    i := i + 1;
    insert into pos_tab_line (tab_id, business_id, product_variant_id, qty, note, position, added_by, unit_price)
    values (v_new, v_business, v_line.product_variant_id, v_qty, v_line.note, i, v_me, v_line.unit_price);
    if v_qty = v_line.qty then
      delete from pos_tab_line where id = v_line.id;
    else
      update pos_tab_line set qty = qty - v_qty where id = v_line.id;
    end if;
  end loop;
  update pos_tab set version = version + 1 where id = p_tab;
  perform audit_event(v_business, 'bill.split', 'pos_tab', p_tab::text, null, null,
                      jsonb_build_object('new_tab', v_new, 'moved', p_move));
  return jsonb_build_object('tab_id', v_new, 'version', 1, 'from_tab', p_tab, 'from_version', t.version + 1);
end $$;

-- 0028's pos_open_bills, with each bill's number.
drop function if exists pos_open_bills();
create or replace function pos_open_bills()
returns table (tab_id uuid, version int, table_id uuid, table_name text, label text, channel sales_channel,
               business_day date, opened_at timestamptz, opened_by text, bill_printed_at timestamptz,
               bill_print_count int, lines jsonb, total numeric,
               subtotal numeric, discount numeric, discount_percent numeric, discount_amount numeric,
               discount_reason text, discount_by text, discount_approved_by text, turn_no int)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    with l as (
      select tl.tab_id, tl.id, tl.position, tl.product_variant_id, tl.qty, tl.note, p.name as product_name,
             pv.name as variant_name,
             coalesce(tl.unit_price, price_on(tl.product_variant_id, t.channel, t.location_id, v_today)) as price
        from pos_tab t
        join pos_tab_line tl on tl.tab_id = t.id
        join product_variant pv on pv.id = tl.product_variant_id
        join product p on p.id = pv.product_id
       where t.business_id = v_business and t.status = 'open'
    ),
    b as (
      select t.*,
             coalesce((select sum(money_round(v_business, l.price * l.qty)) from l where l.tab_id = t.id), 0) as gross
        from pos_tab t
       where t.business_id = v_business and t.status = 'open'
    )
    select b.id, b.version, b.table_id, dt.name, b.label, b.channel, b.business_day, b.opened_at, au.full_name,
           b.bill_printed_at, b.bill_print_count,
           coalesce((select jsonb_agg(jsonb_build_object(
                               'line_id', l.id, 'variant_id', l.product_variant_id, 'qty', l.qty, 'note', l.note,
                               'product_name', l.product_name, 'variant_name', l.variant_name, 'price', l.price)
                             order by l.position)
                       from l where l.tab_id = b.id), '[]'::jsonb),
           b.gross - sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.gross,
           sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.discount_percent, b.discount_amount,
           b.discount_reason, db.full_name, dab.full_name, b.turn_no
      from b
      left join dining_table dt on dt.id = b.table_id
      left join app_user au on au.id = b.opened_by
      left join app_user db on db.id = b.discount_by
      left join app_user dab on dab.id = b.discount_approved_by
     order by b.opened_at;
end $$;

-- =============================================================================
-- 4. Who may call what
-- =============================================================================
-- The numbers are taken inside the till's own functions, never by hand.
revoke execute on function
  take_turn_no(uuid, date), trg_pos_tab_turn_no(),
  post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb, int)
  from public, anon, authenticated;
-- pos_open_bills was made anew: open to signed-in people, as it was.
revoke execute on function pos_open_bills() from public, anon;
grant execute on function pos_open_bills() to authenticated;
