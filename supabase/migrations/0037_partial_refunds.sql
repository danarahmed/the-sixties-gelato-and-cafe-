-- =============================================================================
-- 0037 — Refunds by the item (release L)
--
-- Until now a refund gave back the whole sale, and a sale's stock movements
-- named the sale but not its lines (docs/COMPLETION_PLAN.md, D4). Now:
--   * A refund names the items it gives back and how many of each: all that
--     is left, unless told otherwise. Each gives back its share of what its
--     line was sold for (after the bill's discount), and the last refund of a
--     line takes exactly what is left of it, so a sale's refunds add up to it.
--   * A refund is a document of its own: numbered, with its lines, the
--     payment it went back to (the sale's), its reason and who approved it.
--     It is also the sale's adjustment of kind refund, with the same id, so
--     everything that reads refunds (the drawer, the reports, the exceptions,
--     the daily brief) reads it as before.
--   * What can go back on the shelf goes back at its own line's cost: every
--     stock movement a sale makes now names its line. A sale recorded before
--     this is refunded whole, as before.
--   * A sale is part-refunded until nothing of it is left, then refunded.
--   * Cash goes back from the drawer's open session, card comes off the card
--     takings, and a platform's order off what the platform owes: what it owes
--     for an order part-refunded is what is left of it.
-- Also: count_drawer, kept for the deploy of 0036, is closed.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Every stock movement a sale makes names its line
-- ---------------------------------------------------------------------------
-- Named by post_sale as it writes the line. Not a foreign key: a line is
-- written once, complete, after the movements it costs.
alter table inventory_movement add column if not exists sales_order_line_id uuid;
create index if not exists inventory_movement_sale_line_idx on inventory_movement (sales_order_line_id)
  where sales_order_line_id is not null;

-- 0034's post_sale, writing each movement's line.
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
  v_disc_by uuid; v_disc_approved uuid; v_disc_reason text; v_turn int; v_line uuid;
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
    -- Cost first, then write the line once: lines are append-only. Each
    -- movement names its line (0037), so a refund of the line takes back its
    -- own stock.
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

    insert into sales_order_line (id, sales_order_id, product_variant_id, quantity, unit_price, line_discount, line_net,
                                  cogs_amount)
    values (v_line, v_order, v_variants[i], v_qtys[i], v_prices[i], v_gross_lines[i] - v_nets[i], v_nets[i],
            v_line_cogs);
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

-- ---------------------------------------------------------------------------
-- 2. Refunds, as documents
-- ---------------------------------------------------------------------------
-- A refund is the sale's adjustment of kind refund (same id), numbered, with
-- the lines it gave back and the payment it went back to. Never changed.
create table if not exists sale_refund (
  id               uuid primary key references sale_adjustment (id),
  business_id      uuid not null references business (id) on delete cascade,
  refund_no        bigint not null,
  sales_order_id   uuid not null references sales_order (id),
  location_id      uuid not null references location (id),
  -- The drawer's session open when it was made (its cash left that drawer).
  work_shift_id    uuid references work_shift (id),
  amount           numeric not null check (amount > 0),
  cost_returned    numeric not null default 0 check (cost_returned >= 0),
  reason_code      text not null,
  reason           text not null,
  requested_by     uuid references app_user (id),
  approved_by      uuid references app_user (id),
  approval_id      uuid references approval (id),
  journal_entry_id uuid references journal_entry (id),
  -- It took everything that was left of the sale.
  whole            boolean not null,
  created_at       timestamptz not null default now()
);
create unique index if not exists sale_refund_no on sale_refund (business_id, refund_no);
create index if not exists sale_refund_order_idx on sale_refund (sales_order_id);

create table if not exists sale_refund_line (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references business (id) on delete cascade,
  refund_id           uuid not null references sale_refund (id),
  sales_order_line_id uuid not null references sales_order_line (id),
  qty                 numeric not null check (qty > 0),
  amount              numeric not null check (amount >= 0),
  cost_returned       numeric not null default 0 check (cost_returned >= 0),
  -- Something of it went back on the shelf.
  restocked           boolean not null default false,
  unique (refund_id, sales_order_line_id)
);
create index if not exists sale_refund_line_line_idx on sale_refund_line (sales_order_line_id);

create table if not exists sale_refund_tender (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business (id) on delete cascade,
  refund_id   uuid not null references sale_refund (id),
  tender_type tender_type not null,
  amount      numeric not null check (amount > 0)
);
create index if not exists sale_refund_tender_refund_idx on sale_refund_tender (refund_id);

do $$
declare t text;
begin
  foreach t in array array['sale_refund', 'sale_refund_line', 'sale_refund_tender'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists cost_read on %I', t);
    execute format($p$create policy cost_read on %I for select to authenticated
                      using (business_id = (select current_business_id())
                             and (select current_has_permission('cost.view')))$p$, t);
    execute format('grant select on %I to authenticated', t);
    execute format('drop trigger if exists %I on %I', t || '_append_only', t);
    execute format('create trigger %I before update or delete on %I for each row execute function forbid_mutation()',
                   t || '_append_only', t);
  end loop;
end $$;

-- What has been given back of a sale so far, by every refund, before 0037 too.
create or replace function sale_refunded(p_order uuid) returns numeric
language sql stable set search_path = public as $$
  select coalesce(sum(amount), 0) from sale_adjustment where sales_order_id = p_order and kind = 'refund'
$$;

-- ---------------------------------------------------------------------------
-- 3. The refund
-- ---------------------------------------------------------------------------
-- Gives back the lines asked for ([{line_id, qty}]), or all that is left of
-- the sale (p_lines null). Each line gives back its share of its net; the
-- last refund of a line takes exactly what is left of its net, and of the
-- stock it took that can go back on the shelf. The money goes back to the
-- sale's payment: cash from the drawer's open session (0024, 0036), card off
-- 1010, a platform's order off what it owes (1100).
create or replace function refund_lines_internal(p_business uuid, p_me uuid, p_order uuid, p_lines jsonb,
                                                 p_reason_code text, p_reason text, p_approval uuid)
returns jsonb language plpgsql set search_path = public as $$
declare
  o sales_order; v_tender tender_type; v_paid numeric; v_reason text; v_code text;
  v_approver uuid := p_me; a approval; v_id uuid := gen_random_uuid(); v_no bigint;
  v_has_lines boolean; v_legacy boolean; l record; it record;
  v_left numeric; v_left_amount numeric; v_want numeric; v_line_amount numeric; v_line_cost numeric;
  v_restocked boolean; v_q numeric; v_v numeric; v_rest boolean := false;
  v_plan jsonb := '[]'; v_moves jsonb := '[]'; v_amount numeric := 0; v_cost numeric := 0;
  v_journal uuid; v_status order_status; p jsonb; v_items text; v_before numeric;
begin
  select * into o from sales_order where id = p_order and business_id = p_business for update;
  if not found then raise exception 'Sale not found'; end if;
  if o.status = 'refunded' then raise exception 'This sale has been refunded in full already'; end if;
  if o.status = 'voided' then raise exception 'This sale was voided: there is nothing to refund'; end if;
  if o.status not in ('completed', 'partially_refunded') then
    raise exception 'Only a completed sale can be refunded; this one is %', o.status;
  end if;
  select tender_type, amount into v_tender, v_paid from sales_tender where sales_order_id = p_order
   order by id limit 1;
  if tender_account(v_tender) is null then raise exception 'This sale''s tender cannot be refunded here'; end if;
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
  if v_amount > v_paid - v_before then
    raise exception 'This refund is more than is left of what was paid (%)', trim_scale(v_paid - v_before);
  end if;

  -- The adjustment first: a cash refund leaves the drawer's open session,
  -- which must hold it.
  insert into sale_adjustment (id, business_id, sales_order_id, kind, amount, reason, reason_code, requested_by,
                               approved_by)
  values (v_id, p_business, p_order, 'refund', v_amount, v_reason, v_code, p_me, v_approver);
  v_no := next_document_no(p_business, 'refund', 1);
  if jsonb_array_length(v_moves) > 0 then
    perform lock_items(array(select distinct (x ->> 'item_id')::uuid from jsonb_array_elements(v_moves) x));
  end if;
  v_journal := post_journal(p_business, now(),
    'Refund ' || v_no || ' of sale ' || left(p_order::text, 8) || ': ' || v_reason, 'sale_refund', v_id,
    jsonb_build_array(
      jsonb_build_object('code', '4200', 'debit', v_amount),
      jsonb_build_object('code', tender_account(v_tender), 'credit', v_amount),
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
  insert into sale_refund_tender (business_id, refund_id, tender_type, amount)
  values (p_business, v_id, v_tender, v_amount);
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
                       'approved_by', v_approver));
  return jsonb_build_object('order_id', p_order, 'refund_id', v_id, 'refund_no', v_no, 'refunded', v_amount,
    'returned_to_stock', v_cost, 'tender', v_tender, 'status', v_status, 'whole', not v_rest, 'lines', v_plan,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- ---------------------------------------------------------------------------
-- 4. What the Orders screen calls
-- ---------------------------------------------------------------------------
-- Some of a sale's items, keyed like every other write (0035).
create or replace function refund_sale_lines(p_order uuid, p_lines jsonb, p_reason_code text default null,
                                             p_reason text default null, p_approval uuid default null,
                                             p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.refund');
  v_req jsonb := jsonb_build_object('p_order', p_order, 'p_lines', p_lines, 'p_reason_code', p_reason_code,
                                    'p_reason', p_reason, 'p_approval', p_approval);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'refund_sale_lines', v_req);
  if v is not null then return v; end if;
  v := refund_lines_internal(v_business, (current_member()).id, p_order, p_lines, p_reason_code, p_reason,
                             p_approval);
  perform idem_finish(v_business, p_idempotency_key, 'refund_sale_lines', v_req, v);
  return v;
end $$;

-- The whole of what is left of a sale (0028's refund_sale, through the refund above).
create or replace function refund_sale__run(p_order uuid, p_reason text default null, p_reason_code text default null,
                                            p_approval uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.refund');
begin
  return refund_lines_internal(v_business, (current_member()).id, p_order, null, p_reason_code, p_reason, p_approval);
end $$;

-- A journal a refund posted is corrected through the sale.
create or replace function journal_source_hint(p_ref_type text) returns text
language sql immutable as $$
  select case p_ref_type
    when 'sales_order' then 'a sale (void or refund it on Orders)'
    when 'sale_adjustment' then 'a refund'
    when 'sale_refund' then 'a refund (refund the rest of the sale on Orders if more should go back)'
    when 'goods_receipt' then 'a goods receipt'
    when 'purchase_invoice' then 'a bill (cancel it on Vendors)'
    when 'supplier_payment' then 'a supplier payment'
    when 'inventory_movement' then 'a stock record (correct stock with a count or a stock correction)'
    when 'stock_count' then 'a stock count (correct stock with a new count)'
    when 'work_shift' then 'a drawer count'
    when 'session_opening' then 'the opening count of a cash session'
    when 'cash_transfer' then 'a movement of cash (move it back instead)'
    when 'reversal' then 'a reversal (post the entry again instead)'
    when 'card_settlement' then 'a card settlement (cancel it on Sales)'
    when 'platform_settlement' then 'a platform settlement (cancel it on Delivery Platforms)'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- ---------------------------------------------------------------------------
-- 5. What a platform owes for an order part-refunded: what is left of it
-- ---------------------------------------------------------------------------
-- 0031's platform_money and 0030's statement match, reading what is left of
-- each order (its net less its refunds) where they read its net.
create or replace function platform_money() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_waiting numeric; v_bal numeric; v_today date;
begin
  v_today := business_local_date(v_business, now());
  select coalesce(sum(o.net_amount - sale_refunded(o.id)), 0) into v_waiting
    from platform_order po join sales_order o on o.id = po.sales_order_id
   where po.business_id = v_business and po.settlement_id is null and o.status not in ('voided', 'refunded');
  v_bal := gl_balance_at(v_business, '1100', 'infinity');
  return jsonb_build_object(
    'platforms', coalesce((
      select jsonb_agg(jsonb_build_object('code', dp.code, 'name', dp.name, 'names', dp.names, 'active', dp.is_active,
                                          'waiting', (select count(*) from platform_order po join sales_order o on o.id = po.sales_order_id
                                                       where po.platform_id = dp.id and po.settlement_id is null
                                                         and o.status not in ('voided', 'refunded')),
                                          -- What the till could sell on it today: products on the menu with a price there.
                                          'priced', (select count(distinct cp.product_variant_id)
                                                       from channel_price cp
                                                       join product_variant pv on pv.id = cp.product_variant_id
                                                       join product p on p.id = pv.product_id
                                                      where cp.business_id = v_business and cp.channel::text = dp.code
                                                        and pv.is_active and p.is_active and cp.effective_from <= v_today
                                                        and (cp.effective_to is null or cp.effective_to >= v_today)))
                       order by dp.sort_order, dp.name)
        from delivery_platform dp where dp.business_id = v_business), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('platform', dp.code, 'order_no', po.external_order_id, 'sale_id', o.id,
                                          'placed_at', o.placed_at, 'amount', o.net_amount - sale_refunded(o.id),
                                          'days', v_today - business_local_date(v_business, o.placed_at))
                       order by o.placed_at)
        from platform_order po join delivery_platform dp on dp.id = po.platform_id
        join sales_order o on o.id = po.sales_order_id
       where po.business_id = v_business and po.settlement_id is null and o.status not in ('voided', 'refunded')), '[]'::jsonb),
    'waiting', v_waiting, 'receivable', v_bal, 'unmatched', v_bal - v_waiting,
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'platform', dp.code, 'reference', s.reference, 'received_on', s.received_on,
               'period_start', s.period_start, 'period_end', s.period_end,
               'orders', (select count(*) from platform_settlement_line sl where sl.settlement_id = s.id and sl.status = 'matched'),
               'lines', (select count(*) from platform_settlement_line sl where sl.settlement_id = s.id),
               'payout', (select coalesce(sum(sl.reported_payout), 0) from platform_settlement_line sl
                           where sl.settlement_id = s.id and sl.status = 'matched'),
               'statement_total', s.statement_total, 'note', s.note,
               'journal_no', (select journal_no from journal_entry where id = s.journal_entry_id),
               'by', u.full_name, 'at', s.imported_at, 'cancelled_at', s.cancelled_at, 'cancel_reason', s.cancel_reason)
             order by s.imported_at desc)
        from (select * from platform_settlement where business_id = v_business order by imported_at desc limit 30) s
        join delivery_platform dp on dp.id = s.platform_id
        left join app_user u on u.id = s.created_by), '[]'::jsonb));
end $$;

create or replace function platform_statement_match(p_business uuid, p_platform text, p_lines jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_platform uuid; l jsonb; i int := 0; v_no text; v_payout numeric; v_comm numeric; v_fees numeric;
  v_po record; v_status text; v_seen text[] := '{}'; v_out jsonb := '[]'; v_amount numeric; v_diff numeric;
  t_amount numeric := 0; t_payout numeric := 0; t_comm numeric := 0; t_fees numeric := 0; t_diff numeric := 0;
  t_other numeric := 0; n_matched int := 0; v_last timestamptz; v_missing jsonb;
begin
  select id into v_platform from delivery_platform where business_id = p_business and code = lower(trim(p_platform));
  if v_platform is null then raise exception 'Choose the platform the statement is from'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The statement has no lines';
  end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    v_no := nullif(trim(l ->> 'order_no'), '');
    if v_no is null then raise exception 'Line % has no order number', i; end if;
    begin
      v_payout := money_round(p_business, (l ->> 'payout')::numeric);
      v_comm := money_round(p_business, nullif(l ->> 'commission', '')::numeric);
      v_fees := money_round(p_business, nullif(l ->> 'fees', '')::numeric);
    exception when others then
      raise exception 'Line % (order %): the amounts must be numbers', i, v_no;
    end;
    if v_payout is null then raise exception 'Line % (order %) has no payout', i, v_no; end if;
    if coalesce(v_comm, 0) < 0 or coalesce(v_fees, 0) < 0 then
      raise exception 'Line % (order %): commission and fees are what the platform kept, never less than zero', i, v_no;
    end if;
    select po.id, po.settlement_id, o.id as sale_id, o.net_amount - sale_refunded(o.id) as net_amount, o.status,
           o.placed_at, s.reference as paid_by
      into v_po
      from platform_order po join sales_order o on o.id = po.sales_order_id
      left join platform_settlement s on s.id = po.settlement_id
     where po.business_id = p_business and po.platform_id = v_platform and lower(po.external_order_id) = lower(v_no);
    v_amount := null; v_diff := null;
    if lower(v_no) = any (v_seen) then
      v_status := 'duplicate';
    elsif v_po.id is null then
      v_status := 'not_found';
    elsif v_po.settlement_id is not null then
      v_status := 'already_paid';
    elsif v_po.status in ('voided', 'refunded') then
      v_status := 'voided';
    else
      v_status := 'matched';
      v_amount := v_po.net_amount;
      if v_comm is null and v_fees is null then
        v_comm := v_amount - v_payout; v_fees := 0;
      else
        v_comm := coalesce(v_comm, 0); v_fees := coalesce(v_fees, 0);
      end if;
      v_diff := v_amount - v_payout - v_comm - v_fees;
      n_matched := n_matched + 1;
      t_amount := t_amount + v_amount; t_payout := t_payout + v_payout; t_comm := t_comm + v_comm;
      t_fees := t_fees + v_fees; t_diff := t_diff + v_diff;
      v_last := greatest(v_last, v_po.placed_at);
    end if;
    if v_status <> 'matched' then t_other := t_other + v_payout; end if;
    v_seen := v_seen || lower(v_no);
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'line', i, 'order_no', v_no, 'status', v_status, 'payout', v_payout, 'commission', v_comm, 'fees', v_fees,
      'expected', v_amount, 'difference', v_diff, 'sale_id', v_po.sale_id, 'placed_at', v_po.placed_at,
      'paid_by', case when v_status = 'already_paid' then v_po.paid_by end));
  end loop;
  -- Orders waiting to be paid out, from before the latest one on the statement, that it leaves out.
  select coalesce(jsonb_agg(jsonb_build_object('order_no', po.external_order_id, 'sale_id', o.id,
                                               'placed_at', o.placed_at, 'amount', o.net_amount - sale_refunded(o.id))
                          order by o.placed_at), '[]')
    into v_missing
    from platform_order po join sales_order o on o.id = po.sales_order_id
   where po.business_id = p_business and po.platform_id = v_platform and po.settlement_id is null
     and o.status not in ('voided', 'refunded') and v_last is not null and o.placed_at <= v_last
     and not (lower(po.external_order_id) = any (v_seen));
  return jsonb_build_object(
    'platform', lower(trim(p_platform)), 'lines', v_out, 'missing', v_missing, 'matched', n_matched,
    'totals', jsonb_build_object('orders', t_amount, 'payout', t_payout, 'commission', t_comm, 'fees', t_fees,
                                 'difference', t_diff, 'not_posted', t_other),
    'journal', case when n_matched > 0 then
      (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(jsonb_build_array(
         signed_line('1020', t_payout), signed_line('5100', t_comm), signed_line('5200', t_fees + t_diff),
         signed_line('1100', -t_amount))) x
        where coalesce((x ->> 'debit')::numeric, (x ->> 'credit')::numeric) <> 0)
      else '[]'::jsonb end);
end $$;

-- ---------------------------------------------------------------------------
-- 6. The old drawer count, kept for the deploy of 0036, is closed
-- ---------------------------------------------------------------------------
revoke execute on function count_drawer(numeric, numeric, text, numeric, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb, int),
  sale_refunded(uuid), refund_lines_internal(uuid, uuid, uuid, jsonb, text, text, uuid),
  refund_sale__run(uuid, text, text, uuid), journal_source_hint(text),
  platform_statement_match(uuid, text, jsonb)
  from public, anon, authenticated;
revoke execute on function refund_sale_lines(uuid, jsonb, text, text, uuid, uuid), platform_money() from public, anon;
grant execute on function refund_sale_lines(uuid, jsonb, text, text, uuid, uuid), platform_money() to authenticated;
