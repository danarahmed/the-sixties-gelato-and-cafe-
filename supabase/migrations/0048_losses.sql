-- =============================================================================
-- 0048 — The kinds of loss and their accounts; giveaways at the till; the loss
-- report (release V)
--
-- Every kind of loss posted to 5300 Waste & spoilage: a staff meal and a drink
-- on the house as much as milk gone off (docs/COMPLETION_PLAN.md, B6, D11).
--   * Each kind has its account: waste, spoilage, expired, damaged and melt to
--     5300; what is lost in making a batch or in preparing to sell (0047) to
--     5310 Production and preparation loss; a staff meal to 6110 Staff meals,
--     on the house to 6610 Complimentary items, a sample to 6620 Marketing
--     samples. 5310, like 5300, takes no bill, expense or supplier's credit.
--   * A loss is a document (stock_loss) with its lines: an item, or a product
--     (its recipe, as eaten in), in any quantity; an item kept by batch loses
--     from the batch named, when one is. One journal for it: Dr the kind's
--     account, Cr 1200 Inventory. The rules of 0040 still decide who may: over
--     the limit (the loss, the person's losses in the window, or an item's
--     today), a manager approves it, with their PIN, or it waits for one; a
--     manager approves or reverses a loss that waits whole. record_waste stays,
--     writing its loss the same way.
--   * A giveaway at the till (a staff meal, on the house, a sample) is a loss
--     of that kind, of the products in the cart with their add-ons: no revenue,
--     no payment, a turn number for the bar, a manager's PIN over the limit. It
--     is not an order: the sales, the drawer, the orders and the average ticket
--     count only what was sold.
--   * report_losses: what was lost, by kind and its account, by item, by
--     person and by day, what waits and what was reversed apart, and the
--     giveaways.
--   * The alerts: waste well above its usual counts 5310 too; running out
--     counts the new kinds as use; losses waiting are counted a loss at a time.
--   * A loss's journal and its record are checked like any other's.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The accounts
-- ---------------------------------------------------------------------------
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
    ('1200','Inventory',                  'asset',     'debit'),
    ('1500','Equipment',                  'asset',     'debit'),
    ('1590','Accumulated depreciation',   'asset',     'credit'),
    ('2000','Accounts payable',           'liability', 'credit'),
    ('2050','Goods received not invoiced','liability', 'credit'),
    ('3000','Owner equity',               'equity',    'credit'),
    ('3100','Retained earnings',          'equity',    'credit'),
    ('3200','Owner drawings',             'equity',    'debit'),
    ('4000','Sales revenue',              'revenue',   'credit'),
    ('4100','Merchant-funded discount',   'revenue',   'debit'),
    ('4200','Sales returns & refunds',    'revenue',   'debit'),
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

do $$
declare b record;
begin
  for b in select id from business loop
    perform provision_chart_of_accounts(b.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. The kinds of loss
-- ---------------------------------------------------------------------------
create or replace function is_loss(p_type movement_type) returns boolean
language sql immutable set search_path = public as $$
  select p_type::text in ('waste', 'spoilage', 'expired', 'damaged', 'melt_evaporation', 'production_waste',
                          'preparation_waste', 'staff_consumption', 'complimentary', 'sampling')
$$;

-- The account each kind of loss is charged to.
create or replace function loss_account(p_type movement_type) returns text
language sql immutable set search_path = public as $$
  select case
    when p_type::text in ('production_waste', 'preparation_waste') then '5310'
    when p_type::text = 'staff_consumption' then '6110'
    when p_type::text = 'complimentary' then '6610'
    when p_type::text = 'sampling' then '6620'
    else '5300' end
$$;

-- The kinds given away at the till.
create or replace function is_giveaway(p_type movement_type) returns boolean
language sql immutable set search_path = public as $$
  select p_type::text in ('staff_consumption', 'complimentary', 'sampling')
$$;

-- 0040's stock_card_kind, with the kinds of 0047.
create or replace function stock_card_kind(p_type movement_type, p_reference text, p_qty numeric) returns text
language sql immutable set search_path = public as $$
  select case
    when p_type = 'opening_balance' then 'opening_stock'
    when p_type in ('purchase_receipt', 'supplier_return') then 'received'
    when p_type::text = 'receipt_correction' then 'received'
    when p_type::text = 'cost_adjustment' then 'revalued'
    when p_type in ('sale_consumption', 'refund_return_to_stock') then 'sold'
    when p_type = 'reversal' and p_reference in ('sale_void', 'sales_order') then 'sold'
    when p_type = 'production_consumption' then 'batches'
    when p_type = 'reversal' and p_reference = 'production_cancel' and p_qty > 0 then 'batches'
    when p_type = 'production_output' then 'made'
    when p_type = 'reversal' and p_reference = 'production_cancel' then 'made'
    when is_loss(p_type) then 'wasted'
    when p_type = 'reversal' and p_reference = 'loss_review' then 'wasted'
    when p_type = 'count_adjustment' then 'counted'
    when p_type in ('transfer_in', 'transfer_out') then 'transferred'
    else 'corrected'
  end
$$;

-- ---------------------------------------------------------------------------
-- 3. A loss, and what was lost
-- ---------------------------------------------------------------------------
create table if not exists stock_loss (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business (id) on delete cascade,
  location_id      uuid not null references location (id),
  kind             movement_type not null,
  reason           text not null,
  -- What it cost, as the stock went out; approved as it was recorded, or waiting.
  value            numeric not null default 0,
  status           approval_status not null,
  approved_by      uuid references app_user (id),
  recorded_by      uuid references app_user (id),
  -- A giveaway at the till: as the till's channel makes it, with its turn
  -- number for the bar.
  at_till          boolean not null default false,
  channel          sales_channel,
  turn_no          int,
  journal_entry_id uuid references journal_entry (id),
  created_at       timestamptz not null default now(),
  constraint stock_loss_kind check (is_loss(kind)),
  constraint stock_loss_till check (not at_till or (is_giveaway(kind) and turn_no is not null))
);
create index if not exists stock_loss_business on stock_loss (business_id, created_at);

-- What was lost: an item (from a batch, when one was named), or a product with
-- its add-ons, in the quantity and unit given, and what it cost.
create table if not exists stock_loss_line (
  id                 uuid primary key default gen_random_uuid(),
  stock_loss_id      uuid not null references stock_loss (id),
  business_id        uuid not null references business (id) on delete cascade,
  item_id            uuid references item (id),
  product_variant_id uuid references product_variant (id),
  qty                numeric not null check (qty > 0),
  unit_code          text,
  lot_id             uuid references item_lot (id),
  modifiers          jsonb not null default '[]',
  value              numeric not null default 0,
  position           int not null default 1,
  constraint stock_loss_line_what check ((item_id is null) <> (product_variant_id is null)),
  constraint stock_loss_line_lot check (lot_id is null or item_id is not null)
);
create index if not exists stock_loss_line_loss on stock_loss_line (stock_loss_id);

alter table stock_loss enable row level security;
alter table stock_loss force row level security;
alter table stock_loss_line enable row level security;
alter table stock_loss_line force row level security;
drop policy if exists cost_read on stock_loss;
create policy cost_read on stock_loss for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
drop policy if exists cost_read on stock_loss_line;
create policy cost_read on stock_loss_line for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
grant select on stock_loss, stock_loss_line to authenticated;
drop trigger if exists stock_loss_append_only on stock_loss;
create trigger stock_loss_append_only before update or delete on stock_loss
  for each row execute function forbid_mutation();
drop trigger if exists stock_loss_line_append_only on stock_loss_line;
create trigger stock_loss_line_append_only before update or delete on stock_loss_line
  for each row execute function forbid_mutation();

-- ---------------------------------------------------------------------------
-- 4. A loss from the batch named
-- ---------------------------------------------------------------------------
-- 0046's allocate_lots: a loss that names a batch takes from it first, as far
-- as it holds, then as any other movement going out.
create or replace function allocate_lots(m inventory_movement) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_qty numeric := m.base_quantity_signed;
  v_need numeric := abs(m.base_quantity_signed);
  v_at timestamptz := coalesce(m.occurred_at, m.created_at, now());
  v_stale_first boolean := m.type::text in ('expired', 'count_adjustment');
  v_src uuid[]; v_take numeric; v_short numeric; l record;
begin
  if m.type::text = 'cost_adjustment' or coalesce(v_qty, 0) = 0 then return; end if;
  perform 1 from item where id = m.item_id for update;

  if v_qty > 0 and m.lot_id is not null then
    perform put_lot_row(m.business_id, m.id, m.lot_id, m.item_id, m.location_id, v_qty);
    -- Sold or used beyond the stock there was: from this lot, the latest first.
    select -coalesce(sum(base_qty), 0) into v_short from lot_movement
     where item_id = m.item_id and location_id = m.location_id and lot_id is null;
    v_short := least(greatest(v_short, 0), v_qty);
    if v_short > 0 then
      for l in
        select lm.movement_id, -sum(lm.base_qty) as short
          from lot_movement lm join inventory_movement o on o.id = lm.movement_id
         where lm.item_id = m.item_id and lm.location_id = m.location_id and lm.lot_id is null
           and lm.movement_id <> m.id
         group by lm.movement_id, o.occurred_at, o.created_at
        having sum(lm.base_qty) < 0
         order by o.occurred_at desc, o.created_at desc, lm.movement_id
      loop
        exit when v_short <= 0;
        v_take := least(v_short, l.short);
        perform put_lot_row(m.business_id, l.movement_id, null, m.item_id, m.location_id, v_take);
        perform put_lot_row(m.business_id, l.movement_id, m.lot_id, m.item_id, m.location_id, -v_take);
        v_short := v_short - v_take;
      end loop;
    end if;
    return;
  end if;

  -- Going out from the batch it names (0048), as far as the batch holds.
  if v_qty < 0 and m.lot_id is not null then
    v_take := least(v_need, greatest(lot_left(m.lot_id), 0));
    if v_take > 0 then
      perform put_lot_row(m.business_id, m.id, m.lot_id, m.item_id, m.location_id, -v_take);
      v_need := v_need - v_take;
    end if;
    if v_need <= 0 then return; end if;
  end if;

  v_src := lot_sources(m);
  if v_src is not null then
    for l in
      select lm.lot_id, -sign(v_qty) * sum(lm.base_qty) as avail
        from lot_movement lm join item_lot lot on lot.id = lm.lot_id
       where lm.movement_id = any(v_src) and lm.item_id = m.item_id and lm.location_id = m.location_id
       group by lm.lot_id, lot.use_by, lot.created_at
      having -sign(v_qty) * sum(lm.base_qty) > 0
       order by lot.use_by nulls last, lot.created_at, lm.lot_id
    loop
      exit when v_need <= 0;
      v_take := least(v_need, l.avail);
      if v_qty < 0 then v_take := least(v_take, greatest(lot_left(l.lot_id), 0)); end if;
      if v_take > 0 then
        perform put_lot_row(m.business_id, m.id, l.lot_id, m.item_id, m.location_id, sign(v_qty) * v_take);
        v_need := v_need - v_take;
      end if;
    end loop;
  end if;
  if v_need <= 0 then return; end if;
  if v_qty > 0 then
    perform put_lot_row(m.business_id, m.id, null, m.item_id, m.location_id, v_need);
    return;
  end if;

  for l in
    select x.lot_id, x.left_qty from (
      select null::uuid as lot_id, sum(lm.base_qty) as left_qty, null::timestamptz as use_by,
             null::timestamptz as made
        from lot_movement lm
       where lm.item_id = m.item_id and lm.location_id = m.location_id and lm.lot_id is null
      union all
      select lot.id, lot.left_base, lot.use_by, lot.created_at
        from item_lot lot
       where lot.business_id = m.business_id and lot.item_id = m.item_id and lot.location_id = m.location_id
         and lot.left_base > 0) x
     where x.left_qty > 0
     order by case when x.lot_id is null then case when v_stale_first then 1 else 0 end
                   when x.use_by <= v_at then case when v_stale_first then 0 else 2 end
                   else case when v_stale_first then 2 else 1 end end,
              x.use_by nulls last, x.made, x.lot_id
  loop
    exit when v_need <= 0;
    v_take := least(v_need, l.left_qty);
    perform put_lot_row(m.business_id, m.id, l.lot_id, m.item_id, m.location_id, -v_take);
    v_need := v_need - v_take;
  end loop;
  if v_need > 0 then
    perform put_lot_row(m.business_id, m.id, null, m.item_id, m.location_id, -v_need);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Recording a loss
-- ---------------------------------------------------------------------------
-- Who may lose this much (0040's rules, for any loss): a manager approves it
-- by recording it, or with their PIN; over the limit on its own, or added to
-- the person's losses over the window (their open session, or the day), or
-- to an item's losses by anyone today, it waits for a manager when asked
-- (p_wait), or is refused. What is lost beyond the books is as each item's
-- rule says. p_values: [{item_id, qty, value}].
create or replace function loss_approval(p_business uuid, p_me uuid, p_location uuid, p_values jsonb,
                                         p_approval uuid, p_wait boolean, p_for text,
                                         out status approval_status, out approver uuid)
language plpgsql set search_path = public as $$
declare
  a approval; v_value numeric; v_limit numeric; v_window text; v_today date; v_day_start timestamptz;
  v_since timestamptz; v_over boolean; r record;
begin
  -- One person's losses are added up one at a time; so are an item's.
  perform pg_advisory_xact_lock(hashtextextended('losses:' || p_business::text || ':' || p_me::text, 0));
  if current_has_permission('waste.approve') then
    approver := p_me;
  elsif p_approval is not null then
    a := use_approval(p_business, p_approval, 'waste', p_for);
    approver := a.approver_id;
  end if;
  -- More than the books hold is lost as each item's rule says.
  perform stock_rules(p_business, p_location,
    (select jsonb_agg(jsonb_build_object('item_id', x ->> 'item_id', 'qty', (x ->> 'qty')::numeric))
       from jsonb_array_elements(p_values) x),
    p_me, null, 'waste', p_for, approver);
  select coalesce(sum((x ->> 'value')::numeric), 0) into v_value from jsonb_array_elements(p_values) x;
  v_limit := member_rule_number(p_business, 'waste_approval_over', p_me);
  v_window := coalesce(rule_value(p_business, 'waste_approval_window') #>> '{}', 'session');
  v_today := business_local_date(p_business, now());
  v_day_start := (local_day_bounds(p_business, v_today, v_today)).from_ts;
  v_over := v_value > v_limit;
  if not v_over and v_window <> 'entry' and v_value > 0 then
    v_since := v_day_start;
    if v_window = 'session' then
      select coalesce(max(w.opened_at), v_day_start) into v_since from work_shift w
       where w.business_id = p_business and w.kind = 'session' and w.closed_at is null and w.cashier_id = p_me;
    end if;
    v_over := losses_since(p_business, p_me, null, v_since) + v_value > v_limit;
    for r in select (e ->> 'item_id')::uuid as item_id, sum((e ->> 'value')::numeric) as value
               from jsonb_array_elements(p_values) e group by 1 loop
      exit when v_over;
      v_over := losses_since(p_business, null, r.item_id, v_day_start) + r.value > v_limit;
    end loop;
  end if;
  if v_over and approver is null then
    if not coalesce(p_wait, false) then
      -- Not saying the value: whoever lacks waste.approve may also lack cost.view.
      raise exception 'This loss needs a manager''s approval: ask one to approve it now, or save it to wait for their approval';
    end if;
    status := 'pending';
  elsif approver is not null then
    status := 'approved';
  else
    status := 'not_required';
  end if;
end $$;

-- A loss written: its lines (an item in any of its units, from a batch when
-- one is named; a product as its recipe is made on the channel, dine-in unless
-- given, with its add-ons at the till), each item's movement of the kind at
-- what it costs now, and one journal to the kind's account. p_lines:
-- [{item_id | variant_id, qty, unit_code, lot_id, modifiers}].
create or replace function write_loss(p_business uuid, p_me uuid, p_location uuid, p_kind movement_type,
                                      p_lines jsonb, p_reason text, p_approval uuid, p_wait boolean,
                                      p_at_till boolean, p_channel sales_channel default 'dine_in')
returns jsonb language plpgsql set search_path = public as $$
declare
  v_loss uuid := gen_random_uuid(); v_today date := business_local_date(p_business, now());
  v_channel sales_channel := coalesce(p_channel, 'dine_in');
  l jsonb; n int := 0; v_item uuid; v_variant uuid; v_qty numeric; v_base numeric; v_lot item_lot;
  v_mods jsonb; v_kept jsonb := '[]'; v_parts jsonb := '[]'; v_moves jsonb := '[]'; v_line_values jsonb; p jsonb;
  v_cost numeric; v_value numeric; v_total numeric := 0; v_status approval_status; v_approver uuid;
  v_journal uuid; v_first uuid; v_mv uuid; v_turn int; v_name text; v_unit text; v_top int; v_gap numeric;
begin
  if p_kind is null or not is_loss(p_kind) then raise exception 'Choose what kind of loss it is'; end if;
  if p_at_till and not is_giveaway(p_kind) then
    raise exception 'At the till, a staff meal, on the house or a sample is given away';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception '%', case when p_at_till then 'Say why it is given away' else 'Say why the stock was lost' end;
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception '%', case when p_at_till then 'The cart is empty' else 'Choose what was lost' end;
  end if;
  if jsonb_array_length(p_lines) > 50 then raise exception 'At most 50 lines at once'; end if;

  -- What each line takes out, item by item.
  for l in select * from jsonb_array_elements(p_lines) loop
    n := n + 1;
    v_item := nullif(l ->> 'item_id', '')::uuid;
    v_variant := nullif(l ->> 'variant_id', '')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    v_mods := '[]';
    if (v_item is null) = (v_variant is null) then raise exception 'Choose an item or a product that was lost'; end if;
    if v_item is not null then
      if p_at_till then raise exception 'At the till, products are given away'; end if;
      if not exists (select 1 from item where id = v_item and business_id = p_business) then
        raise exception 'Unknown item';
      end if;
      if v_qty is null or v_qty <= 0 then raise exception 'Enter a quantity greater than zero'; end if;
      v_base := to_base_qty(v_item, v_qty, nullif(l ->> 'unit_code', ''));
      if v_base is null or v_base <= 0 then raise exception 'Enter a quantity greater than zero'; end if;
      if nullif(l ->> 'lot_id', '') is not null then
        select * into v_lot from item_lot where id = (l ->> 'lot_id')::uuid and business_id = p_business;
        if not found or v_lot.item_id <> v_item or v_lot.location_id is distinct from p_location then
          raise exception 'That batch is not of this item, here';
        end if;
      end if;
      v_parts := v_parts || jsonb_build_object('line', n, 'item_id', v_item, 'qty', v_base,
                                               'lot_id', nullif(l ->> 'lot_id', ''));
    else
      if nullif(l ->> 'lot_id', '') is not null then raise exception 'A batch is named for an item, not a product'; end if;
      if v_qty is null or v_qty <= 0 then raise exception 'Enter a quantity greater than zero'; end if;
      select pr.name into v_name from product_variant pv join product pr on pr.id = pv.product_id
       where pv.id = v_variant and pv.business_id = p_business and pv.is_active and pr.is_active;
      if not found then raise exception 'That product is not on sale'; end if;
      -- At the till, its add-ons as the product offers them (0041).
      if p_at_till then
        v_mods := coalesce(line_modifiers(p_business, v_variant, l -> 'modifiers', v_channel, p_location, v_today),
                           '[]');
      end if;
      select coalesce(jsonb_agg(jsonb_build_object('line', n, 'item_id', u.item_id, 'qty', u.qty, 'lot_id', null)),
                      '[]')
        into p
        from (select e.item_id, sum(e.base_qty) as qty
                from (select x.item_id, x.base_qty from expand_variant(v_variant, v_channel, v_qty, v_today) x
                      union all
                      select x.item_id, x.base_qty
                        from jsonb_array_elements(v_mods) a(m),
                             lateral expand_modifier((a.m ->> 'modifier_id')::uuid, v_variant, v_channel,
                                                     v_qty * (a.m ->> 'qty')::numeric) x) e
               group by e.item_id having sum(e.base_qty) > 0) u;
      -- On Inventory, a product that uses no stock loses nothing; at the till it
      -- is given away with the rest (a glass of water), costing nothing.
      if jsonb_array_length(p) = 0 and not p_at_till then
        raise exception '% uses no stock: nothing is lost with it', v_name;
      end if;
      v_parts := v_parts || p;
    end if;
    v_kept := v_kept || jsonb_build_object('line', n, 'item_id', v_item, 'variant_id', v_variant, 'qty', v_qty,
                                           'unit_code', case when v_item is not null then nullif(l ->> 'unit_code', '') end,
                                           'lot_id', nullif(l ->> 'lot_id', ''), 'modifiers', v_mods);
  end loop;
  if jsonb_array_length(v_parts) = 0 then
    raise exception 'Nothing given uses any stock: there is nothing to record';
  end if;

  -- Its items locked in a stable order; a batch named holds enough.
  perform lock_items(array(select distinct (x ->> 'item_id')::uuid from jsonb_array_elements(v_parts) x));
  for p in select x from jsonb_array_elements(v_parts) x where x ->> 'lot_id' is not null loop
    select * into v_lot from item_lot where id = (p ->> 'lot_id')::uuid;
    if v_lot.left_base < (p ->> 'qty')::numeric then
      select base_unit_code into v_unit from item where id = v_lot.item_id;
      raise exception '%', format('Only %s %s of batch %s is left', trim_scale(greatest(v_lot.left_base, 0)), v_unit,
                                  coalesce((select b.batch_no::text from production_batch b
                                             where b.id = v_lot.production_batch_id), v_lot.lot_code));
    end if;
  end loop;
  -- One movement for each item (and batch named), at what it costs now,
  -- rounded once; the lines' shares add up to the whole.
  for p in
    select jsonb_build_object('item_id', x ->> 'item_id', 'lot_id', x ->> 'lot_id', 'qty', sum((x ->> 'qty')::numeric))
      from jsonb_array_elements(v_parts) x
     group by x ->> 'item_id', x ->> 'lot_id'
     order by min((x ->> 'line')::int), x ->> 'item_id', x ->> 'lot_id'
  loop
    v_cost := item_issue_cost(p_business, (p ->> 'item_id')::uuid, p_location);
    v_value := money_round(p_business, v_cost * (p ->> 'qty')::numeric);
    v_moves := v_moves || (p || jsonb_build_object('cost', v_cost, 'value', v_value));
    v_total := v_total + v_value;
  end loop;
  select coalesce(jsonb_object_agg(y.line::text, y.val), '{}') into v_line_values
    from (select (x ->> 'line')::int as line,
                 money_round(p_business, sum((x ->> 'qty')::numeric
                   * (select (mv ->> 'cost')::numeric from jsonb_array_elements(v_moves) mv
                       where mv ->> 'item_id' = x ->> 'item_id' limit 1))) as val
            from jsonb_array_elements(v_parts) x group by 1) y;
  select v_total - coalesce(sum((e.value)::numeric), 0) into v_gap from jsonb_each_text(v_line_values) e;
  if v_gap <> 0 then
    select (e.key)::int into v_top from jsonb_each_text(v_line_values) e
     order by (e.value)::numeric desc, (e.key)::int limit 1;
    v_line_values := jsonb_set(v_line_values, array[v_top::text],
                               to_jsonb((v_line_values ->> v_top::text)::numeric + v_gap));
  end if;
  select a.status, a.approver into v_status, v_approver
    from loss_approval(p_business, p_me, p_location, v_moves, p_approval, p_wait, v_loss::text) a;
  if p_at_till then v_turn := take_turn_no(p_business, v_today); end if;

  if v_total > 0 then
    v_journal := post_journal(p_business, now(),
      initcap(replace(p_kind::text, '_', ' ')) || ': ' || trim(p_reason), 'stock_loss', v_loss,
      jsonb_build_array(jsonb_build_object('code', loss_account(p_kind), 'debit', v_total),
                        jsonb_build_object('code', '1200', 'credit', v_total)));
  end if;
  insert into stock_loss (id, business_id, location_id, kind, reason, value, status, approved_by, recorded_by,
                          at_till, channel, turn_no, journal_entry_id)
  values (v_loss, p_business, p_location, p_kind, trim(p_reason), v_total, v_status, v_approver, p_me,
          coalesce(p_at_till, false), case when p_at_till then v_channel end, v_turn, v_journal);
  insert into stock_loss_line (stock_loss_id, business_id, item_id, product_variant_id, qty, unit_code, lot_id,
                               modifiers, value, position)
  select v_loss, p_business, (k ->> 'item_id')::uuid, (k ->> 'variant_id')::uuid, (k ->> 'qty')::numeric,
         k ->> 'unit_code', (k ->> 'lot_id')::uuid, k -> 'modifiers',
         coalesce((v_line_values ->> (k ->> 'line'))::numeric, 0), (k ->> 'line')::int
    from jsonb_array_elements(v_kept) k;
  for p in select * from jsonb_array_elements(v_moves) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason, approval_status, lot_id)
    values (p_business, (p ->> 'item_id')::uuid, p_location, p_kind, -(p ->> 'qty')::numeric,
            (p ->> 'cost')::numeric, (p ->> 'value')::numeric, 'stock_loss', v_loss, p_me, trim(p_reason), v_status,
            (p ->> 'lot_id')::uuid)
    returning id into v_mv;
    v_first := coalesce(v_first, v_mv);
  end loop;
  -- The manager who approved it with their PIN is kept with each of its movements.
  if v_approver is not null and v_approver is distinct from p_me then
    insert into loss_review (business_id, movement_id, decision, decided_by)
    select p_business, m.id, 'approved', v_approver from inventory_movement m
     where m.reference_type = 'stock_loss' and m.reference_id = v_loss;
  end if;
  return jsonb_build_object('loss_id', v_loss, 'movement_id', v_first, 'status', v_status, 'approver_id', v_approver,
    'approved_by', (select full_name from app_user where id = v_approver), 'turn_no', v_turn,
    'journal_no', (select journal_no from journal_entry where id = v_journal))
    || case when current_has_permission('cost.view') then jsonb_build_object('value', v_total) else '{}' end;
end $$;

-- A loss recorded on Inventory: of a kind, an item (from a batch, when one is
-- named) or a product (as it is made to eat in), with why.
create or replace function record_loss__run(p_kind movement_type, p_item uuid, p_variant uuid, p_qty numeric,
                                            p_unit_code text, p_reason text, p_lot uuid, p_location uuid,
                                            p_approval uuid, p_wait boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('waste.record');
begin
  return write_loss(v_business, (current_member()).id, resolve_location(v_business, p_location), p_kind,
    jsonb_build_array(jsonb_build_object('item_id', p_item, 'variant_id', p_variant, 'qty', p_qty,
                                         'unit_code', p_unit_code, 'lot_id', p_lot)),
    p_reason, p_approval, p_wait, false);
end $$;

create or replace function record_loss(p_kind movement_type, p_item uuid, p_variant uuid, p_qty numeric,
                                       p_unit_code text, p_reason text, p_lot uuid default null,
                                       p_location uuid default null, p_approval uuid default null,
                                       p_wait boolean default false, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_kind', p_kind, 'p_item', p_item, 'p_variant', p_variant, 'p_qty', p_qty,
                                    'p_unit_code', p_unit_code, 'p_reason', p_reason, 'p_lot', p_lot,
                                    'p_location', p_location, 'p_approval', p_approval, 'p_wait', p_wait);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_loss', v_req);
  if v is not null then return v; end if;
  v := record_loss__run(p_kind => p_kind, p_item => p_item, p_variant => p_variant, p_qty => p_qty,
                        p_unit_code => p_unit_code, p_reason => p_reason, p_lot => p_lot, p_location => p_location,
                        p_approval => p_approval, p_wait => p_wait);
  perform audit_event(v_business, 'inventory.loss', 'stock_loss', v ->> 'loss_id', p_reason, null,
    jsonb_build_object('kind', p_kind, 'account', loss_account(p_kind), 'item', p_item, 'product', p_variant,
                       'qty', p_qty, 'unit', p_unit_code,
                       'batch_no', (select b.batch_no from item_lot l join production_batch b on b.id = l.production_batch_id
                                     where l.id = p_lot),
                       'value', v -> 'value', 'status', v ->> 'status', 'approved_by', v -> 'approver_id'));
  perform idem_finish(v_business, p_idempotency_key, 'record_loss', v_req, v);
  return v;
end $$;

-- 0040's record_waste__run: a loss of one item, as record_loss writes it, each
-- kind to its account. The same answer (the loss's first movement).
create or replace function record_waste__run(p_item uuid, p_qty numeric, p_unit_code text, p_type movement_type,
                                  p_reason text, p_location uuid default null, p_approval uuid default null,
                                  p_wait boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('waste.record');
begin
  if p_type is null or not is_loss(p_type) then
    raise exception 'Not a waste type: %', p_type;
  end if;
  return write_loss(v_business, (current_member()).id, resolve_location(v_business, p_location), p_type,
    jsonb_build_array(jsonb_build_object('item_id', p_item, 'qty', p_qty, 'unit_code', p_unit_code)),
    p_reason, p_approval, p_wait, false);
end $$;

-- A giveaway at the till: a staff meal, on the house, or a sample, of what is
-- in the cart with its add-ons, made to eat in or take away. No revenue and no
-- payment: a loss of that kind to its account, with a turn number so the bar
-- makes it from its ticket. Over the limit, a manager's PIN on the spot.
-- p_lines: [{variant_id, qty, modifiers}], as a sale's.
create or replace function give_away__run(p_kind movement_type, p_channel sales_channel, p_lines jsonb,
                                          p_reason text, p_location uuid, p_approval uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
begin
  if p_kind is null or not is_giveaway(p_kind) then
    raise exception 'Give it away as a staff meal, on the house or a sample';
  end if;
  if p_channel is null or p_channel not in ('dine_in', 'takeaway') then
    raise exception 'What is given away is eaten in or taken away';
  end if;
  return write_loss(v_business, (current_member()).id, resolve_location(v_business, p_location), p_kind,
                    (select coalesce(jsonb_agg(jsonb_build_object('variant_id', x ->> 'variant_id', 'qty', x -> 'qty',
                                                                  'modifiers', coalesce(x -> 'modifiers', '[]'))), '[]')
                       from jsonb_array_elements(case when jsonb_typeof(p_lines) = 'array' then p_lines else '[]' end) x),
                    p_reason, p_approval, false, true, p_channel);
end $$;

create or replace function give_away(p_kind movement_type, p_channel sales_channel, p_lines jsonb, p_reason text,
                                     p_location uuid default null, p_approval uuid default null,
                                     p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_kind', p_kind, 'p_channel', p_channel, 'p_lines', p_lines,
                                    'p_reason', p_reason, 'p_location', p_location, 'p_approval', p_approval);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'give_away', v_req);
  if v is not null then return v; end if;
  v := give_away__run(p_kind => p_kind, p_channel => p_channel, p_lines => p_lines, p_reason => p_reason,
                      p_location => p_location, p_approval => p_approval);
  perform audit_event(v_business, 'sale.giveaway', 'stock_loss', v ->> 'loss_id', p_reason, null,
    jsonb_build_object('kind', p_kind, 'account', loss_account(p_kind), 'channel', p_channel,
                       'turn_no', v -> 'turn_no', 'lines', jsonb_array_length(p_lines), 'value', v -> 'value',
                       'approved_by', v -> 'approver_id'));
  perform idem_finish(v_business, p_idempotency_key, 'give_away', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 6. A loss looked at, whole
-- ---------------------------------------------------------------------------
-- 0046's review_loss__run: a loss recorded as a document is approved or
-- reversed whole, by any of its movements — each movement back to the batches
-- it took from, and its one journal reversed. A loss from before 0048 is one
-- movement, looked at as it was.
create or replace function review_loss__run(p_movement uuid, p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('waste.approve');
  v_me uuid := (current_member()).id;
  m inventory_movement; x inventory_movement; v_moves uuid[]; v_journal uuid; v_rev uuid; v_rev_mv uuid;
  v_review uuid; v_reason text := nullif(trim(p_reason), ''); v_what text; v_decision text; v_value numeric;
  v_loss stock_loss;
begin
  if p_decision is null or p_decision not in ('approve', 'reverse') then
    raise exception 'Approve the loss, or reverse it';
  end if;
  v_decision := case p_decision when 'approve' then 'approved' else 'reversed' end;
  select * into m from inventory_movement where id = p_movement and business_id = v_business;
  if not found or not is_loss(m.type) or m.base_quantity_signed >= 0 then raise exception 'Loss not found'; end if;
  if m.reference_type = 'stock_loss' then
    select * into v_loss from stock_loss where id = m.reference_id;
    v_moves := array(select o.id from inventory_movement o
                      where o.reference_type = 'stock_loss' and o.reference_id = v_loss.id
                      order by o.created_at, o.id);
  else
    v_moves := array[m.id];
  end if;
  perform lock_items(array(select distinct o.item_id from inventory_movement o where o.id = any(v_moves)));
  if exists (select 1 from loss_review where movement_id = any(v_moves)) then
    raise exception 'This loss has been looked at already';
  end if;
  if m.approval_status <> 'pending' then raise exception 'This loss is not waiting for approval'; end if;
  if m.app_user_id = v_me then raise exception 'Someone else approves a loss you recorded'; end if;
  if p_decision = 'reverse' and v_reason is null then raise exception 'Say why the loss is reversed'; end if;
  v_what := coalesce((select string_agg(coalesce(i.name, p.name), ', ' order by sl.position)
                        from stock_loss_line sl
                        left join item i on i.id = sl.item_id
                        left join product_variant pv on pv.id = sl.product_variant_id
                        left join product p on p.id = pv.product_id
                       where sl.stock_loss_id = v_loss.id),
                     (select name from item where id = m.item_id));
  if p_decision = 'reverse' then
    select id into v_journal from journal_entry
     where business_id = v_business and reverses_entry is null and status = 'published'
       and ((v_loss.id is not null and reference_type = 'stock_loss' and reference_id = v_loss.id)
            or (v_loss.id is null and reference_type = 'inventory_movement' and reference_id = m.id));
    if v_journal is not null then
      v_rev := reverse_entry_internal(v_journal, now(), 'Loss reversed: ' || v_what || ': ' || v_reason);
    end if;
  end if;
  for x in select * from inventory_movement where id = any(v_moves) order by created_at, id loop
    v_review := gen_random_uuid(); v_rev_mv := null;
    if p_decision = 'reverse' then
      -- Back to the batches this movement took it from (0046).
      perform set_config('lots.loss_reversed', x.id::text, true);
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                      reference_type, reference_id, app_user_id, reason)
      values (v_business, x.item_id, x.location_id, 'reversal', -x.base_quantity_signed, x.unit_cost, x.value,
              'loss_review', v_review, v_me, 'Loss reversed: ' || v_reason)
      returning id into v_rev_mv;
      perform set_config('lots.loss_reversed', '', true);
    end if;
    insert into loss_review (id, business_id, movement_id, decision, reason, decided_by, reversal_movement_id,
                             journal_entry_id)
    values (v_review, v_business, x.id, v_decision, v_reason, v_me, v_rev_mv, v_rev);
  end loop;
  select sum(value) into v_value from inventory_movement where id = any(v_moves);
  perform audit_event(v_business, case p_decision when 'approve' then 'inventory.loss_approve'
                                                  else 'inventory.loss_reverse' end,
    case when v_loss.id is not null then 'stock_loss' else 'inventory_movement' end,
    coalesce(v_loss.id, m.id)::text, v_reason,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', v_decision, 'item', case when v_loss.id is null then m.item_id end,
                       'what', v_what, 'movement', m.type,
                       'qty', case when v_loss.id is null then -m.base_quantity_signed end,
                       'unit', case when v_loss.id is null then (select base_unit_code from item where id = m.item_id) end,
                       'value', v_value));
  return jsonb_build_object('movement_id', p_movement, 'loss_id', v_loss.id, 'decision', v_decision,
    'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- The losses waiting for a manager, oldest first: a loss recorded whole (0048)
-- once, with what was lost as it was given; one from before, as it was.
drop function if exists losses_waiting();
create or replace function losses_waiting()
returns table (movement_id uuid, at timestamptz, item_id uuid, item text, kind text, qty numeric, unit text,
               value numeric, reason text, recorded_by_id uuid, recorded_by text, loss_id uuid, account text,
               batch_no bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('waste.approve'); v_cost boolean := current_has_permission('cost.view');
begin
  return query
    select w.movement_id, w.at, w.item_id, w.item, w.kind, w.qty, w.unit, case when v_cost then w.value end,
           w.reason, w.recorded_by_id, u.full_name, w.loss_id, w.account, w.batch_no
      from (
        select (select o.id from inventory_movement o
                 where o.reference_type = 'stock_loss' and o.reference_id = s.id
                 order by o.created_at, o.id limit 1) as movement_id,
               s.created_at as at, sl.item_id,
               coalesce(i.name, p.name || case when (select count(*) from product_variant v2
                                                      where v2.product_id = p.id) > 1
                                                 then ' — ' || pv.name else '' end) as item,
               s.kind::text as kind, sl.qty, coalesce(sl.unit_code, i.base_unit_code) as unit, s.value, s.reason,
               s.recorded_by as recorded_by_id, s.id as loss_id, loss_account(s.kind) as account, b.batch_no
          from stock_loss s
          join lateral (select * from stock_loss_line x where x.stock_loss_id = s.id
                         order by x.position limit 1) sl on true
          left join item i on i.id = sl.item_id
          left join product_variant pv on pv.id = sl.product_variant_id
          left join product p on p.id = pv.product_id
          left join item_lot lot on lot.id = sl.lot_id
          left join production_batch b on b.id = lot.production_batch_id
         where s.business_id = v_business and s.status = 'pending'
           and not exists (select 1 from loss_review r join inventory_movement o on o.id = r.movement_id
                            where o.reference_type = 'stock_loss' and o.reference_id = s.id)
        union all
        select m.id, m.created_at, m.item_id, i.name, m.type::text, -m.base_quantity_signed, i.base_unit_code,
               m.value, m.reason, m.app_user_id, null::uuid, '5300'::text, null::bigint
          from inventory_movement m
          join item i on i.id = m.item_id
         where m.business_id = v_business and m.approval_status = 'pending' and is_loss(m.type)
           and m.reference_type is distinct from 'stock_loss'
           and not exists (select 1 from loss_review r where r.movement_id = m.id)
      ) w
      left join app_user u on u.id = w.recorded_by_id
     order by w.at, w.movement_id;
end $$;

-- ---------------------------------------------------------------------------
-- 7. What was lost, and given away
-- ---------------------------------------------------------------------------
-- The losses recorded in the dates: each whole (0048), or each movement from
-- before; what was reversed and what waits apart. By kind with its account, by
-- item, by person, by day, the giveaways at the till by kind, and the losses
-- themselves, the latest first.
create or replace function report_losses(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_from timestamptz; v_to timestamptz;
begin
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Choose the dates, the first before the last'; end if;
  select b.from_ts, b.to_ts into v_from, v_to from local_day_bounds(v_business, p_from, p_to) b;
  return (
    with lm as (
      -- Every movement of a loss in the dates, with the loss it belongs to.
      select m.id, m.item_id, -m.base_quantity_signed as qty, m.value, m.created_at, m.type, m.reason,
             m.app_user_id, m.approval_status,
             case when m.reference_type = 'stock_loss' then m.reference_id else m.id end as loss_id,
             exists (select 1 from loss_review r where r.movement_id = m.id and r.decision = 'reversed') as reversed,
             exists (select 1 from loss_review r where r.movement_id = m.id) as reviewed
        from inventory_movement m
       where m.business_id = v_business and is_loss(m.type) and m.base_quantity_signed < 0
         and m.created_at >= v_from and m.created_at < v_to
    ),
    losses as (
      select lm.loss_id, min(lm.created_at) as at, coalesce(s.kind, min(lm.type::text)::movement_type) as kind,
             coalesce(s.value, sum(lm.value)) as value, coalesce(s.reason, min(lm.reason)) as reason,
             coalesce(s.recorded_by, (array_agg(lm.app_user_id))[1]) as person,
             case when s.id is not null then loss_account(s.kind) else '5300' end as account,
             bool_or(lm.reversed) as reversed,
             bool_or(lm.approval_status = 'pending' and not lm.reviewed) as pending,
             coalesce(s.status, min(lm.approval_status::text)::approval_status) as status,
             coalesce(s.at_till, false) as at_till, s.turn_no, s.approved_by, s.id is not null as documented
        from lm left join stock_loss s on s.id = lm.loss_id
       group by lm.loss_id, s.id
    ),
    kept as (select * from losses where not reversed)
    select jsonb_build_object(
      'from', p_from, 'to', p_to,
      'total', jsonb_build_object(
        'value', coalesce((select sum(value) from kept), 0),
        'count', (select count(*) from kept),
        'pending_count', (select count(*) from kept where pending),
        'pending_value', coalesce((select sum(value) from kept where pending), 0),
        'reversed_count', (select count(*) from losses where reversed),
        'reversed_value', coalesce((select sum(value) from losses where reversed), 0)),
      'by_kind', coalesce((
        select jsonb_agg(jsonb_build_object('kind', k.kind, 'account', k.account, 'account_name', g.name,
                                            'count', k.n, 'value', k.value) order by k.value desc, k.kind)
          from (select kind::text as kind, account, count(*) as n, sum(value) as value from kept group by 1, 2) k
          left join gl_account g on g.business_id = v_business and g.code = k.account), '[]'),
      'by_item', coalesce((
        select jsonb_agg(jsonb_build_object('item_id', x.item_id, 'item', i.name, 'unit', i.base_unit_code,
                                            'qty', trim_scale(x.qty), 'value', x.value, 'count', x.n)
                         order by x.value desc, i.name)
          from (select item_id, sum(qty) as qty, sum(value) as value, count(distinct loss_id) as n
                  from lm where not reversed group by item_id) x
          join item i on i.id = x.item_id), '[]'),
      'by_person', coalesce((
        select jsonb_agg(jsonb_build_object('person_id', x.person, 'person', u.full_name, 'count', x.n,
                                            'value', x.value) order by x.value desc, u.full_name)
          from (select person, count(*) as n, sum(value) as value from kept group by person) x
          left join app_user u on u.id = x.person), '[]'),
      'by_day', coalesce((
        select jsonb_agg(jsonb_build_object('day', x.day, 'count', x.n, 'value', x.value) order by x.day)
          from (select business_local_date(v_business, at) as day, count(*) as n, sum(value) as value
                  from kept group by 1) x), '[]'),
      'giveaways', coalesce((
        select jsonb_agg(jsonb_build_object('kind', x.kind, 'count', x.n, 'value', x.value) order by x.kind)
          from (select kind::text as kind, count(*) as n, sum(value) as value from kept where at_till group by 1) x),
        '[]'),
      'losses', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'loss_id', case when l.documented then l.loss_id end,
                 'movement_id', (select min(lm2.id::text) from lm lm2 where lm2.loss_id = l.loss_id),
                 'at', l.at, 'kind', l.kind, 'account', l.account, 'value', l.value, 'reason', l.reason,
                 'person', u.full_name, 'approved_by', a.full_name, 'status', l.status, 'pending', l.pending,
                 'reversed', l.reversed, 'at_till', l.at_till, 'turn_no', l.turn_no,
                 'what', coalesce((select jsonb_agg(jsonb_build_object(
                                            'name', coalesce(i.name, p.name), 'size',
                                            case when pv.id is not null and (select count(*) from product_variant v2
                                                                               where v2.product_id = p.id) > 1
                                                 then pv.name end,
                                            'qty', trim_scale(sl.qty), 'unit', coalesce(sl.unit_code, i.base_unit_code),
                                            'batch_no', b.batch_no,
                                            'addons', (select jsonb_agg(mo ->> 'name') from jsonb_array_elements(sl.modifiers) mo))
                                          order by sl.position)
                                     from stock_loss_line sl
                                     left join item i on i.id = sl.item_id
                                     left join product_variant pv on pv.id = sl.product_variant_id
                                     left join product p on p.id = pv.product_id
                                     left join item_lot lot on lot.id = sl.lot_id
                                     left join production_batch b on b.id = lot.production_batch_id
                                    where l.documented and sl.stock_loss_id = l.loss_id),
                                  (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', trim_scale(lm3.qty),
                                                                       'unit', i.base_unit_code))
                                     from lm lm3 join item i on i.id = lm3.item_id
                                    where not l.documented and lm3.loss_id = l.loss_id)))
               order by l.at desc, l.loss_id)
          from (select * from losses order by at desc, loss_id limit 300) l
          left join app_user u on u.id = l.person
          left join app_user a on a.id = l.approved_by), '[]'))
  );
end $$;

-- ---------------------------------------------------------------------------
-- 8. The alerts
-- ---------------------------------------------------------------------------
-- 0031's rules (kept as alert_conditions_0031 since 0036), as they were, but
-- for two: running out counts what is lost in production and preparation as
-- use, and waste well above its usual is 5300 and 5310 together.
create or replace function alert_conditions_0031(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language plpgsql stable set search_path = public as $$
declare
  v_tz text; v_today date; v_loc uuid;
  v_use_types movement_type[] := array['sale_consumption', 'production_consumption', 'waste', 'spoilage',
    'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling', 'damaged', 'expired',
    'production_waste', 'preparation_waste']::movement_type[];
  v_lead numeric := alert_setting(p_business, 'lead_time_days');
  v_target numeric := alert_setting(p_business, 'margin_target_percent');
  v_running uuid[] := '{}';
  v_seen text[] := '{}';
  v_costs jsonb;                                       -- item id -> its cost now, and whether it is a fallback
  v_nocost jsonb := '{}';                              -- item id -> the products that use it
  r record; v_daily numeric; v_cost numeric; v_n int; v_zero uuid[]; v_fallback boolean; v_broken boolean;
  v_item uuid; v_pname text;
begin
  select timezone into v_tz from business where id = p_business;
  v_today := business_local_date(p_business, p_now);
  v_loc := default_location(p_business);

  -- Cash below zero: a till, safe or bank balance under nothing.
  return query
    select 'cash_negative'::text, a.code::text, 'red'::text,
           format('%s is %s IQD: below zero', a.name, alert_money(a.bal)),
           'Money cannot leave a place before it is there: a payment was recorded from the wrong place, or takings are missing.'::text,
           'Open the account''s journal lines and record where the money really came from.'::text,
           'high'::text, '/journals?account=' || a.code,
           jsonb_build_object('account', a.code, 'balance', a.bal)
      from (select g.code, g.name, gl_balance_at(p_business, g.code, 'infinity') as bal
              from gl_account g
             where g.business_id = p_business and g.code in ('1000', '1005', '1020')) a
     where a.bal < 0;

  -- A drawer not counted: days before today whose cash no count has covered.
  return query
    select 'drawer_uncounted'::text, u.location_id::text,
           case when count(*) >= 2 then 'red' else 'orange' end::text,
           case when count(*) = 1
                then format('The drawer at %s has not been counted for %s', l.name, to_char(min(u.day), 'DD Mon'))
                else format('The drawer at %s has not been counted for %s days, since %s', l.name, count(*),
                            to_char(min(u.day), 'DD Mon')) end,
           'Until the drawer is counted, nobody knows whether the cash is all there.'::text,
           'Count the drawer on Sales.'::text, 'high'::text, '/sales'::text,
           jsonb_build_object('days', jsonb_agg(u.day order by u.day))
      from uncounted_days(p_business) u join location l on l.id = u.location_id
     where u.day < v_today
     group by u.location_id, l.name;

  -- A stock count left open.
  return query
    select 'count_stale'::text, c.id::text, 'orange'::text,
           format('A stock count has been open since %s', to_char(c.started_at at time zone v_tz, 'DD Mon HH24:MI')),
           'An open count is not in the books yet, and the longer it stays open the harder it is to finish honestly.'::text,
           'Finish it, or cancel it, on Stock Count.'::text, 'high'::text, '/count'::text,
           jsonb_build_object('count_id', c.id, 'status', c.status, 'started_at', c.started_at)
      from stock_count c
     where c.business_id = p_business and c.status in ('draft', 'counting', 'submitted')
       and c.started_at < p_now - make_interval(hours => alert_setting(p_business, 'count_stale_hours')::int);

  -- Running out: days of cover (on hand ÷ average daily use over the last 14
  -- days) under the time a delivery takes plus a day — the item's last
  -- supplier's own, or the café's. Quiet with under 7 days of history, and on
  -- a day the item was received.
  for r in
    with hist as (
      select m.item_id, min(business_local_date(p_business, m.occurred_at)) as first_day,
             -sum(m.base_quantity_signed) filter (
                where m.occurred_at >= p_now - interval '14 days'
                  and (m.type = any (v_use_types) or m.type = 'refund_return_to_stock'
                       or (m.type = 'reversal' and m.reference_type = 'sale_void')
                       or (m.type = 'reversal' and m.reference_type = 'production_cancel' and m.base_quantity_signed > 0)))
               as used,
             bool_or(m.type = 'purchase_receipt' and business_local_date(p_business, m.occurred_at) = v_today) as received_today
        from inventory_movement m
       where m.business_id = p_business
       group by m.item_id
    ),
    onhand as (
      select cs.item_id, sum(cs.quantity_base) as qty from current_stock cs where cs.business_id = p_business group by 1
    ),
    supplied as (
      select distinct on (m.item_id) m.item_id, s.lead_time_days
        from inventory_movement m
        join goods_receipt g on g.id = m.reference_id
        join supplier s on s.id = g.supplier_id
       where m.business_id = p_business and m.type = 'purchase_receipt' and m.reference_type = 'goods_receipt'
       order by m.item_id, m.occurred_at desc, m.created_at desc
    )
    select i.id, i.name, i.base_unit_code, coalesce(o.qty, 0) as qty, h.used,
           least(14, v_today - h.first_day) as window_days, v_today - h.first_day as history_days, h.received_today,
           coalesce(sp.lead_time_days, v_lead) as lead,
           exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active) as made
      from item i join hist h on h.item_id = i.id
      left join onhand o on o.item_id = i.id
      left join supplied sp on sp.item_id = i.id
     where i.business_id = p_business and i.is_active
  loop
    continue when r.history_days < 7 or r.received_today or coalesce(r.used, 0) <= 0;
    v_daily := r.used / r.window_days;                  -- average use a day
    continue when r.qty / v_daily >= r.lead + 1;
    v_running := v_running || r.id;
    rule := 'running_out'; subject := r.id::text;
    urgency := case when r.qty / v_daily < 1 then 'red' else 'orange' end;
    title := format('%s runs out in %s: %s %s left, using about %s a day', r.name,
                    case when r.qty <= 0 then 'no time' when r.qty / v_daily < 1 then 'under a day'
                         else trim_scale(round(r.qty / v_daily, 1)) || ' days' end,
                    alert_qty(r.qty), r.base_unit_code, alert_qty(v_daily));
    why := 'What is sold without stock is costed wrongly, and customers are turned away.';
    action := case when r.made then 'Make a batch on Production.'
                   else format('Order about %s %s (a week of use).', alert_qty(ceil(v_daily * 7)), r.base_unit_code) end;
    confidence := case when r.history_days >= 28 then 'high' when r.history_days >= 14 then 'medium' else 'low' end;
    link := '/inventory/' || r.id;
    facts := jsonb_build_object('on_hand', r.qty, 'daily_use', round(v_daily, 4), 'history_days', r.history_days,
                                'lead_time_days', r.lead);
    return next;
  end loop;

  -- Below its reorder level, items never moved included (unless running out says it already).
  return query
    select 'below_minimum'::text, i.id::text, 'orange'::text,
           format('%s: %s %s on hand, below its reorder level of %s', i.name, alert_qty(coalesce(o.qty, 0)),
                  i.base_unit_code, alert_qty(i.min_level_base)),
           'Below the reorder level there may not be enough until the next delivery.'::text,
           case when exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active)
                then 'Make a batch on Production.' else 'Order it.' end,
           'high'::text, '/inventory/' || i.id,
           jsonb_build_object('on_hand', coalesce(o.qty, 0), 'min_level', i.min_level_base)
      from item i
      left join (select cs.item_id, sum(cs.quantity_base) as qty from current_stock cs
                  where cs.business_id = p_business group by 1) o on o.item_id = i.id
     where i.business_id = p_business and i.is_active and i.min_level_base > 0
       and coalesce(o.qty, 0) < i.min_level_base and not (i.id = any (v_running));

  -- A delivery price far from the cost now, confirmed in the last week (0027).
  return query
    select 'price_confirmed'::text, a.id::text, 'orange'::text,
           coalesce(a.reason, 'A delivery price was confirmed') || coalesce(' — confirmed by ' || u.full_name, ''),
           'A price typed wrongly changes the cost of everything made from the item until it is corrected.'::text,
           'Check it against the supplier''s invoice.'::text, 'high'::text, '/purchasing'::text,
           jsonb_build_object('receipt_id', a.entity_id, 'confirmed_at', a.occurred_at)
      from audit_log a left join app_user u on u.id = a.app_user_id
     where a.business_id = p_business and a.action = 'purchase.price_confirmed'
       and a.occurred_at >= p_now - interval '7 days';

  -- Margins: sold below cost (red), or under the target margin (orange); a
  -- product sold with no recipe; and an ingredient with no cost yet, named
  -- once with the products that use it. Every item is costed once, as a sale
  -- would take it off the shelf now; a cost from the last delivery, for an
  -- item with none on hand, makes the margin less sure.
  select coalesce(jsonb_object_agg(i.id, jsonb_build_object(
           'c', item_issue_cost(p_business, i.id, v_loc), 'f', not (p.qty > 0 and p.value > 0))), '{}')
    into v_costs
    from item i cross join lateral item_position(p_business, i.id, v_loc) p
   where i.business_id = p_business;
  for r in
    select pv.id as vid, p.name as pname, pv.name as vname, ch, price_on(pv.id, ch, v_loc, v_today) as price
      from product_variant pv join product p on p.id = pv.product_id
      cross join unnest(enum_range(null::sales_channel)) ch
     where pv.business_id = p_business and pv.is_active and p.is_active and pv.no_stock_reason is null
       and channel_in_use(p_business, ch)
  loop
    continue when r.price is null or r.price <= 0;
    v_pname := r.pname || case when r.vname <> r.pname then ' — ' || r.vname else '' end;
    v_broken := false;
    begin
      select count(*), coalesce(sum(money_round(p_business, (v_costs -> e.item_id::text ->> 'c')::numeric * e.base_qty)), 0),
             coalesce(array_agg(e.item_id) filter (
               where coalesce((v_costs -> e.item_id::text ->> 'c')::numeric, 0) <= 0 and e.base_qty > 0), '{}'),
             coalesce(bool_or((v_costs -> e.item_id::text ->> 'f')::boolean), false)
        into v_n, v_cost, v_zero, v_fallback
        from expand_variant(r.vid, r.ch, 1, v_today) e;
    exception when others then
      v_n := 0; v_broken := true;                      -- its recipe cannot be read today
    end;
    if v_n = 0 then
      subject := r.vid::text;
      continue when subject = any (v_seen);            -- once, whichever channels it is sold on
      v_seen := v_seen || subject;
      rule := 'no_recipe'; urgency := 'orange'; confidence := 'high'; link := '/products';
      title := case when v_broken then format('%s cannot be sold: its recipe has no version in force today', v_pname)
                    else format('%s is sold with no recipe: its sales are costed at nothing', v_pname) end;
      why := 'A sale costed at nothing overstates the profit, and its stock is never taken off the shelf.';
      action := 'Give it its recipe on Products, or say why it uses no stock.';
      facts := jsonb_build_object('variant_id', r.vid);
      return next;
      continue;
    end if;
    if cardinality(v_zero) > 0 then
      foreach v_item in array v_zero loop
        if not coalesce(v_nocost -> v_item::text, '[]'::jsonb) ? v_pname then
          v_nocost := jsonb_set(v_nocost, array[v_item::text],
                                coalesce(v_nocost -> v_item::text, '[]'::jsonb) || to_jsonb(v_pname));
        end if;
      end loop;
      continue;                                        -- its margin waits for every ingredient's cost
    end if;
    if r.price < v_cost or (r.price - v_cost) / r.price * 100 < v_target then
      rule := 'margin'; subject := r.vid || ':' || r.ch;
      urgency := case when r.price < v_cost then 'red' else 'orange' end;
      title := format('%s (%s): %s at %s IQD, costing %s', v_pname, alert_channel(p_business, r.ch),
                      case when r.price < v_cost then 'sold below cost'
                           else trim_scale(trunc((r.price - v_cost) / r.price * 100, 1)) || '% margin' end,
                      alert_money(r.price), alert_money(v_cost));
      why := case when r.price < v_cost then 'Every one sold loses money.'
                  else format('Under the %s%% target, the price no longer covers what the recipe costs now.', trim_scale(v_target)) end;
      action := 'Review the price, or the recipe, on Products.';
      confidence := case when v_fallback then 'medium' else 'high' end;
      link := '/products';
      facts := jsonb_build_object('variant_id', r.vid, 'channel', r.ch, 'price', r.price, 'cost', v_cost,
                                  'target_percent', v_target, 'cost_from_last_delivery', v_fallback);
      return next;
    end if;
  end loop;

  return query
    select 'no_cost'::text, i.id::text, 'orange'::text,
           format('%s has no cost yet, and %s use%s it: %s', i.name,
                  case when jsonb_array_length(x.v) = 1 then '1 product' else jsonb_array_length(x.v) || ' products' end,
                  case when jsonb_array_length(x.v) = 1 then 's' else '' end,
                  (select string_agg(n, ', ' order by n) from (select jsonb_array_elements_text(x.v) n order by 1 limit 4) q)
                  || case when jsonb_array_length(x.v) > 4 then format(' and %s more', jsonb_array_length(x.v) - 4) else '' end),
           'Every sale that uses it is costed at nothing for it, so its profit is overstated.'::text,
           case when exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active)
                then 'Make a batch on Production: its cost comes from its ingredients.'
                else 'Receive it with its cost, or give it its opening stock, on Inventory.' end,
           'high'::text, '/inventory/' || i.id,
           jsonb_build_object('item_id', i.id, 'products', x.v)
      from jsonb_each(v_nocost) x(k, v) join item i on i.id = x.k::uuid;

  -- Waste well above its usual: the last 7 days against the weeks before.
  return query
    with w as (
      select coalesce(sum(l.debit - l.credit) filter (where e.occurred_at >= p_now - interval '7 days'), 0) as last7,
             coalesce(sum(l.debit - l.credit) filter (where e.occurred_at < p_now - interval '7 days'
                                                        and e.occurred_at >= p_now - interval '35 days'), 0) as prior,
             (select v_today - min(business_local_date(p_business, e2.occurred_at))
                from journal_entry e2 where e2.business_id = p_business and e2.status = 'published') as history_days
        from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
       where e.business_id = p_business and e.status = 'published' and g.code in ('5300', '5310')
         and e.occurred_at >= p_now - interval '35 days' and e.occurred_at < p_now
    ), x as (
      select w.*, least(28, w.history_days - 7) as prior_days from w
    )
    select 'waste_spike'::text, 'waste'::text, 'orange'::text,
           format('Waste of %s IQD in the last 7 days, against about %s in a usual week', alert_money(x.last7),
                  alert_money(x.prior / x.prior_days * 7)),
           'Waste well above its usual is money leaving through the bin: a delivery gone off, a recipe, or a habit.'::text,
           'Look at the waste on Inventory: which items, and who recorded them.'::text,
           (case when x.prior_days >= 28 then 'medium' else 'low' end)::text, '/inventory'::text,
           jsonb_build_object('last7', x.last7, 'usual_week', round(x.prior / x.prior_days * 7), 'prior_days', x.prior_days)
      from x
     where x.prior_days >= 7 and x.prior > 0
       and x.last7 > alert_setting(p_business, 'waste_spike_factor') * (x.prior / x.prior_days * 7)
       and x.last7 > alert_setting(p_business, 'waste_spike_min');

  -- One person's voids, refunds, discounts and cancelled bills in the last 7
  -- days: more than a share of their own sales, or more than a set number.
  return query
    with ex as (
      select sa.requested_by as person, sa.amount, 1 as n
        from sale_adjustment sa
       where sa.business_id = p_business and sa.kind in ('void', 'refund') and sa.created_at >= p_now - interval '7 days'
      union all
      select coalesce(o.discount_by, o.cashier_id), o.discount_amount, 1
        from sales_order o
       where o.business_id = p_business and o.discount_amount > 0 and o.status <> 'open'
         and o.placed_at >= p_now - interval '7 days'
      union all
      select a.app_user_id, 0, 1
        from audit_log a
       where a.business_id = p_business and a.action = 'bill.cancel'
         and jsonb_typeof(a.before_state -> 'lines') = 'array' and a.occurred_at >= p_now - interval '7 days'
    ), per as (
      select ex.person, sum(ex.amount) as amount, sum(ex.n) as n,
             (select coalesce(sum(o.gross_amount), 0) from sales_order o
               where o.business_id = p_business and o.cashier_id = ex.person and o.status <> 'open'
                 and o.placed_at >= p_now - interval '7 days') as own_sales
        from ex where ex.person is not null group by ex.person
    )
    select 'exceptions_person'::text, per.person::text, 'orange'::text,
           format('%s: %s void(s), refund(s), discount(s) or cancelled bill(s) in 7 days, %s IQD%s', u.full_name, per.n,
                  alert_money(per.amount),
                  case when per.own_sales > 0 then format(' (%s%% of their sales)', trim_scale(round(per.amount / per.own_sales * 100, 1)))
                       else '' end),
           'Most exceptions have good reasons; a pattern is worth a look. This is evidence, not an accusation.'::text,
           'Review them on Reports → Exceptions.'::text, 'medium'::text, '/reports#exceptions'::text,
           jsonb_build_object('count', per.n, 'amount', per.amount, 'own_sales', per.own_sales)
      from per join app_user u on u.id = per.person
     where per.n >= alert_setting(p_business, 'exceptions_count')
        or (per.own_sales > 0 and per.amount > 0
            and per.amount / per.own_sales * 100 > alert_setting(p_business, 'exceptions_share_percent'));

  -- Card money not banked: what 1010 holds beyond the takings of the last few
  -- days (a settlement clears the oldest first).
  return query
    select 'card_not_banked'::text, '1010'::text, 'orange'::text,
           format('%s IQD of card money is more than %s days old and not yet recorded as settled', alert_money(c.old), c.days),
           'Card takings should reach the bank within a few days; money that does not may never have been taken.'::text,
           'Record the card settlement on Sales, from the terminal''s report and the bank statement.'::text,
           'high'::text, '/sales#card'::text,
           jsonb_build_object('balance', c.bal, 'older_than_days', c.days, 'amount', c.old)
      from (select t.days, t.bal,
                   t.bal - coalesce((select sum(l.debit) from journal_line l
                                       join journal_entry e on e.id = l.journal_entry_id
                                       join gl_account g on g.id = l.account_id
                                      where e.business_id = p_business and e.status = 'published' and g.code = '1010'
                                        and e.occurred_at >= p_now - make_interval(days => t.days)), 0) as old
              from (select alert_setting(p_business, 'card_days')::int as days,
                           gl_balance_at(p_business, '1010', 'infinity') as bal) t) c
     where c.old > 0;

  -- Platform money not received: orders not paid out past the platform's
  -- cycle, by order number (0030); and what platform receivable holds that
  -- no order explains (sales from before order numbers, or a payout
  -- recorded by hand).
  return query
    select 'platform_not_received'::text, dp.code, 'orange'::text,
           format('%s %s order%s, %s IQD, %s more than %s days old and not yet paid out; the oldest from %s',
                  count(*), dp.name, case when count(*) = 1 then '' else 's' end, alert_money(sum(o.net_amount)),
                  case when count(*) = 1 then 'is' else 'are' end, alert_setting(p_business, 'platform_days')::int,
                  to_char(min(o.placed_at) at time zone v_tz, 'DD Mon')),
           'Platform payouts come on a cycle; an order past it may be missing from a statement.'::text,
           'Match the platform''s statement on Delivery Platforms, and raise any order it left out.'::text,
           'high'::text, '/platforms'::text,
           jsonb_build_object('orders', count(*), 'amount', sum(o.net_amount), 'oldest', min(o.placed_at))
      from platform_order po
      join delivery_platform dp on dp.id = po.platform_id
      join sales_order o on o.id = po.sales_order_id
     where po.business_id = p_business and po.settlement_id is null and o.status not in ('voided', 'refunded')
       and o.placed_at < p_now - make_interval(days => alert_setting(p_business, 'platform_days')::int)
     group by dp.code, dp.name;
  return query
    select 'platform_not_received'::text, 'unmatched'::text, 'orange'::text,
           case when x.gap > 0
                then format('%s IQD in platform receivable is matched to no order', alert_money(x.gap))
                else format('Platform receivable is %s IQD short of the orders waiting to be paid out', alert_money(-x.gap)) end,
           'Sales from before order numbers, or a payout recorded by hand, leave platform receivable unexplained by any order.'::text,
           'Find the statement it belongs to; correct it with a journal on Journals if it was recorded by hand.'::text,
           'medium'::text, '/journals?account=1100'::text,
           jsonb_build_object('receivable', x.bal, 'orders_waiting', x.waiting, 'gap', x.gap)
      from (select b.bal, b.waiting, b.bal - b.waiting as gap
              from (select gl_balance_at(p_business, '1100', 'infinity') as bal,
                           coalesce((select sum(o.net_amount) from platform_order po
                                       join sales_order o on o.id = po.sales_order_id
                                      where po.business_id = p_business and po.settlement_id is null
                                        and o.status not in ('voided', 'refunded')), 0) as waiting) b) x
     where x.gap <> 0;

  -- Supplier bills due within a few days, or overdue.
  return query
    select 'bill_due'::text, pi.id::text, 'orange'::text,
           format('%s: %s IQD %s', coalesce(s.name, 'A supplier'), alert_money(pi.amount_total - pi.paid_amount),
                  case when pi.due_date < v_today then format('overdue by %s day(s)', v_today - pi.due_date)
                       when pi.due_date = v_today then 'due today'
                       else format('due on %s', to_char(pi.due_date, 'DD Mon')) end),
           'Bills paid late cost goodwill, and sometimes a late fee.'::text,
           'Pay it, or agree a date with the supplier, on Vendors.'::text, 'high'::text, '/vendors'::text,
           jsonb_build_object('bill_id', pi.id, 'invoice_no', pi.invoice_no, 'due_date', pi.due_date,
                              'owed', pi.amount_total - pi.paid_amount)
      from purchase_invoice pi left join supplier s on s.id = pi.supplier_id
     where pi.business_id = p_business and pi.cancelled_at is null and pi.amount_total - pi.paid_amount > 0
       and pi.due_date is not null and pi.due_date <= v_today + alert_setting(p_business, 'bill_due_days')::int;

  -- A price that looks typed wrongly: one channel more than 3× another.
  return query
    with pr as (
      select pv.id as vid, p.name || case when pv.name <> p.name then ' — ' || pv.name else '' end as pname,
             ch, price_on(pv.id, ch, v_loc, v_today) as price
        from product_variant pv join product p on p.id = pv.product_id
        cross join unnest(enum_range(null::sales_channel)) ch
       where pv.business_id = p_business and pv.is_active and p.is_active
         and channel_in_use(p_business, ch)
    ), mm as (
      select vid, pname, max(price) as hi, min(price) as lo,
             (array_agg(ch order by price desc, ch))[1] as hi_ch, (array_agg(ch order by price, ch))[1] as lo_ch
        from pr where price > 0 group by vid, pname having count(*) >= 2
    )
    select 'price_typo'::text, mm.vid::text, 'orange'::text,
           format('%s is %s IQD on %s but %s on %s', mm.pname, alert_money(mm.hi), alert_channel(p_business, mm.hi_ch),
                  alert_money(mm.lo), alert_channel(p_business, mm.lo_ch)),
           'A price more than three times another channel''s is usually a missing or extra zero.'::text,
           'Confirm it on Products.'::text, 'medium'::text, '/products'::text,
           jsonb_build_object('variant_id', mm.vid, 'high', mm.hi, 'low', mm.lo)
      from mm
     where mm.hi > alert_setting(p_business, 'price_typo_factor') * mm.lo;

  -- A payment that may have been recorded twice: two expenses, bills or
  -- journals to the same running-cost account, for the same amount, within 3 days.
  return query
    with pay as (
      select e.id, e.journal_no, e.occurred_at, g.code, g.name as account, l.debit as amount
        from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
       where e.business_id = p_business and e.status = 'published' and e.reverses_entry is null
         and not exists (select 1 from journal_entry rv where rv.reverses_entry = e.id and rv.status = 'published')
         and e.reference_type in ('manual', 'expense', 'purchase_invoice', 'correction')
         and g.code like '6%' and l.debit > 0 and e.occurred_at >= p_now - interval '30 days'
    )
    select 'duplicate_payment'::text, a.id::text || ':' || b.id::text, 'orange'::text,
           format('Possible duplicate: %s %s IQD in journal %s (%s) and journal %s (%s)', a.account, alert_money(a.amount),
                  a.journal_no, to_char(a.occurred_at at time zone v_tz, 'DD Mon'),
                  b.journal_no, to_char(b.occurred_at at time zone v_tz, 'DD Mon')),
           'The same amount to the same account twice in a few days is sometimes paid twice.'::text,
           'Confirm both are right, or reverse one on Journals.'::text, 'medium'::text,
           '/journals?account=' || a.code,
           jsonb_build_object('entries', jsonb_build_array(a.journal_no, b.journal_no), 'amount', a.amount)
      from pay a join pay b on b.code = a.code and b.amount = a.amount and a.journal_no < b.journal_no
                           and abs(extract(epoch from b.occurred_at - a.occurred_at)) <= 3 * 86400;
end $$;

-- 0040's rules (kept as alert_conditions_0040 since 0045), as they were, but
-- for the losses waiting: a loss recorded whole is one loss, however many
-- items it took.
create or replace function alert_conditions_0040(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language plpgsql stable set search_path = public as $$
begin
  return query
    select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
      from alert_conditions_0039(p_business, p_now) c;

  -- An item the books hold less than nothing of, unless its rule allows that
  -- without an alert.
  return query
    select 'stock_below_zero'::text, p.location_id || ':' || p.item_id, 'red'::text,
           format('%s is below zero in the books: %s %s', i.name, alert_qty(p.qty), i.base_unit_code),
           'Stock cannot be less than nothing: a delivery or a batch was not entered, or more was used than was recorded.'::text,
           'Enter the delivery or the batch that is missing, or count the item on Stock Count.'::text,
           'high'::text, '/inventory/' || i.id,
           jsonb_build_object('item_id', i.id, 'location_id', p.location_id, 'qty', p.qty)
      from (select m.item_id, m.location_id, sum(m.base_quantity_signed) as qty
              from inventory_movement m
             where m.business_id = p_business and m.created_at <= p_now
             group by m.item_id, m.location_id
            having sum(m.base_quantity_signed) < 0) p
      join item i on i.id = p.item_id
     where coalesce(rule_value(p_business, 'negative_stock', i.id) #>> '{}', 'alert') <> 'allow'
     order by i.name;

  -- Losses saved to wait for a manager's approval: red once one has waited two days.
  return query
    select 'losses_waiting'::text, (array_agg(m.id order by m.created_at, m.id))[1]::text,
           (case when min(m.created_at) < p_now - interval '2 days' then 'red' else 'orange' end)::text,
           format('%s loss(es) waiting for a manager''s approval (%s IQD)',
                  count(distinct case when m.reference_type = 'stock_loss' then m.reference_id else m.id end),
                  alert_money(sum(m.value))),
           'A loss over the limit was saved to wait for a manager: until one approves it, or reverses it, nobody has looked at it.'::text,
           'Open Inventory: approve each loss, or reverse one that did not happen.'::text,
           'high'::text, '/inventory#losses-waiting'::text,
           jsonb_build_object('count', count(distinct case when m.reference_type = 'stock_loss' then m.reference_id
                                                          else m.id end),
                              'value', sum(m.value), 'since', min(m.created_at))
      from inventory_movement m
     where m.business_id = p_business and m.approval_status = 'pending' and is_loss(m.type)
       and m.created_at <= p_now
       and not exists (select 1 from loss_review r where r.movement_id = m.id)
    having count(*) > 0;
end $$;

-- ---------------------------------------------------------------------------
-- 9. A loss's journal checked; 5310 closed to bills, expenses and credits
-- ---------------------------------------------------------------------------
-- 0044's records to look into, with losses: one with a value and no journal,
-- and a journal whose loss does not exist.
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
  ),
  has as (select distinct reference_type, reference_id from j where reverses_entry is null and reference_id is not null)
  -- Records without their journal.
  select 'sale'::text, o.id, o.placed_at, 'A sale with no journal'::text
    from sales_order o
   where o.business_id = p_business and o.status <> 'open' and o.created_at >= v_start and o.placed_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'sales_order' and h.reference_id = o.id)
  union all
  select 'void', a.id, a.created_at, 'A void whose sale''s journal was not reversed'
    from sale_adjustment a
   where a.business_id = p_business and a.kind = 'void' and a.created_at >= v_start and a.created_at < p_before
     and not exists (select 1 from j s join j rv on rv.reverses_entry = s.id
                      where s.reference_type = 'sales_order' and s.reference_id = a.sales_order_id)
  union all
  select 'refund', a.id, a.created_at, 'A refund with no journal'
    from sale_adjustment a
   where a.business_id = p_business and a.kind = 'refund' and a.created_at >= v_start and a.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'sale_refund' and h.reference_id = a.id)
  union all
  select 'delivery', r.id, r.received_at, 'A delivery with no journal'
    from goods_receipt r
   where r.business_id = p_business and r.received_at >= v_start and r.received_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'goods_receipt' and h.reference_id = r.id)
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
     and not exists (select 1 from has h where h.reference_type = 'supplier_payment' and h.reference_id = p.id)
  union all
  select 'expense', x.id, x.created_at, 'An expense with no journal'
    from expense x
   where x.business_id = p_business and x.created_at >= v_start and x.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'expense' and h.reference_id = x.id)
  union all
  select 'stock', m.id, m.created_at, 'A loss, stock correction or opening stock with no journal'
    from inventory_movement m
   where m.business_id = p_business and m.created_at >= v_start and m.created_at < p_before and m.value > 0
     and m.type in ('waste', 'spoilage', 'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling',
                    'damaged', 'expired', 'manual_correction', 'opening_balance')
     and m.reference_id is null
     and not exists (select 1 from has h where h.reference_type = 'inventory_movement' and h.reference_id = m.id)
  union all
  select 'loss', s.id, s.created_at, 'A loss with no journal'
    from stock_loss s
   where s.business_id = p_business and s.created_at >= v_start and s.created_at < p_before and s.value > 0
     and not exists (select 1 from has h where h.reference_type = 'stock_loss' and h.reference_id = s.id)
  union all
  select 'count', c.id, c.approved_at, 'An approved count with no journal'
    from stock_count c
   where c.business_id = p_business and c.status = 'approved' and not c.legacy
     and c.approved_at >= v_start and c.approved_at < p_before
     and exists (select 1 from stock_count_line l join inventory_movement m on m.id = l.adjustment_movement_id
                  where l.stock_count_id = c.id and m.value > 0)
     and not exists (select 1 from has h where h.reference_type = 'stock_count' and h.reference_id = c.id)
  union all
  select 'cash', t.id, t.created_at, 'Cash moved with no journal'
    from cash_transfer t
   where t.business_id = p_business and t.created_at >= v_start and t.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'cash_transfer' and h.reference_id = t.id)
  union all
  select 'session', w.id, w.closed_at, 'A drawer counted over or short with no journal'
    from work_shift w
   where w.business_id = p_business and w.kind in ('session', 'drawer') and coalesce(w.variance, 0) <> 0
     and w.closed_at >= v_start and w.closed_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'work_shift' and h.reference_id = w.id)
  union all
  select 'session', w.id, w.opened_at, 'A drawer opened over or short with no journal'
    from work_shift w
   where w.business_id = p_business and w.kind = 'session' and coalesce(w.opening_variance, 0) <> 0
     and w.opened_at >= v_start and w.opened_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'session_opening' and h.reference_id = w.id)
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
     and not exists (select 1 from has h where h.reference_type = 'supplier_return' and h.reference_id = x.id)
  union all
  select 'credit', c.id, c.created_at, 'A supplier''s credit with no journal'
    from supplier_credit c
   where c.business_id = p_business and c.kind <> 'goods_return' and c.created_at >= v_start and c.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'supplier_credit' and h.reference_id = c.id)
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
           else replace(j.reference_type, '_', ' ') end || ' does not exist'
    from j
   where j.created_at < p_before and j.reverses_entry is null and j.reference_id is not null
     and not exists (select 1 from j rv where rv.reverses_entry = j.id and rv.created_at < p_before)
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
           else false end;
end $$;

-- 0015's stock the old app never journaled: a loss recorded whole (0048) has its
-- journal as a loss, so none of its movements is ever offered for posting.
create or replace function legacy_unposted_internal(p_business uuid)
returns table (kind text, ref_type text, ref_id uuid, at timestamptz, description text, amount numeric, lines jsonb)
language sql stable as $$
  select 'opening_stock', 'inventory_movement', m.id, m.occurred_at, 'Opening stock: ' || i.name, m.value,
         jsonb_build_array(jsonb_build_object('code', '1200', 'debit', m.value),
                           jsonb_build_object('code', '3000', 'credit', m.value))
    from inventory_movement m join item i on i.id = m.item_id
   where m.business_id = p_business and m.type = 'opening_balance' and m.value > 0
     and not exists (select 1 from journal_entry j where j.reference_type = 'inventory_movement' and j.reference_id = m.id)
  union all
  select 'goods_received', 'goods_receipt', r.id, r.received_at,
         'Goods received — ' || coalesce(s.name, nullif(trim(r.note), ''), 'receipt'), v.total,
         jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v.total),
                           jsonb_build_object('code', '2050', 'credit', v.total))
    from goods_receipt r
    left join supplier s on s.id = r.supplier_id
    cross join lateral (select coalesce(sum(m.value), 0) total from inventory_movement m
                         where m.reference_type = 'goods_receipt' and m.reference_id = r.id
                           and m.type = 'purchase_receipt') v
   where r.business_id = p_business and v.total > 0
     and not exists (select 1 from journal_entry j where j.reference_type = 'goods_receipt' and j.reference_id = r.id)
  union all
  select 'count_variance', 'stock_count', c.id, v.at, 'Stock count variance', abs(v.net),
         case when v.net < 0
           then jsonb_build_array(jsonb_build_object('code', '5400', 'debit', -v.net), jsonb_build_object('code', '1200', 'credit', -v.net))
           else jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v.net), jsonb_build_object('code', '5400', 'credit', v.net)) end
    from stock_count c
    cross join lateral (select coalesce(sum(m.value * sign(m.base_quantity_signed)), 0) net, max(m.occurred_at) at
                          from inventory_movement m
                         where m.reference_type = 'stock_count' and m.reference_id = c.id
                           and m.type = 'count_adjustment') v
   where c.business_id = p_business and v.net <> 0
     and not exists (select 1 from journal_entry j where j.reference_type = 'stock_count' and j.reference_id = c.id)
     and not exists (select 1 from journal_entry j join inventory_movement m on m.id = j.reference_id
                      where j.reference_type = 'inventory_movement'
                        and m.reference_type = 'stock_count' and m.reference_id = c.id)
  union all
  select case when m.type = 'manual_correction' then 'stock_correction' else 'waste' end,
         'inventory_movement', m.id, m.occurred_at,
         initcap(replace(m.type::text, '_', ' ')) || ': ' || i.name, m.value,
         case when m.type <> 'manual_correction'
             then jsonb_build_array(jsonb_build_object('code', '5300', 'debit', m.value), jsonb_build_object('code', '1200', 'credit', m.value))
           when m.base_quantity_signed < 0
             then jsonb_build_array(jsonb_build_object('code', '5400', 'debit', m.value), jsonb_build_object('code', '1200', 'credit', m.value))
           else jsonb_build_array(jsonb_build_object('code', '1200', 'debit', m.value), jsonb_build_object('code', '5400', 'credit', m.value)) end
    from inventory_movement m join item i on i.id = m.item_id
   where m.business_id = p_business and m.value > 0
     and m.type in ('waste', 'spoilage', 'expired', 'damaged', 'melt_evaporation', 'staff_consumption',
                    'complimentary', 'sampling', 'manual_correction')
     -- A loss recorded whole (0048) is journaled as a loss, not movement by movement.
     and m.reference_type is distinct from 'stock_loss'
     and not exists (select 1 from journal_entry j where j.reference_type = 'inventory_movement' and j.reference_id = m.id)
$$;

-- 0044's hints, with losses.
create or replace function journal_source_hint(p_ref_type text) returns text
language sql immutable as $$
  select case p_ref_type
    when 'sales_order' then 'a sale (void or refund it on Orders)'
    when 'sale_adjustment' then 'a refund'
    when 'sale_refund' then 'a refund (refund the rest of the sale on Orders if more should go back)'
    when 'goods_receipt' then 'a goods receipt (correct it on Purchasing)'
    when 'receipt_correction' then 'a delivery''s correction (correct the delivery again on Purchasing)'
    when 'purchase_invoice' then 'a bill (cancel it on Vendors)'
    when 'supplier_payment' then 'a supplier payment'
    when 'inventory_movement' then 'a stock record (correct stock with a count or a stock correction)'
    when 'stock_count' then 'a stock count (correct stock with a new count)'
    when 'work_shift' then 'a drawer count'
    when 'session_opening' then 'the opening count of a cash session'
    when 'session_dollars' then 'the dollars counted at a drawer''s close'
    when 'fx_exchange' then 'an exchange of dollars'
    when 'supplier_return' then 'a return to a supplier (record a credit on Vendors if more is owed back)'
    when 'supplier_credit' then 'a supplier''s credit'
    when 'cash_transfer' then 'a movement of cash (move it back instead)'
    when 'reversal' then 'a reversal (post the entry again instead)'
    when 'card_settlement' then 'a card settlement (cancel it on Sales)'
    when 'platform_settlement' then 'a platform settlement (cancel it on Delivery Platforms)'
    when 'stock_loss' then 'a loss (correct stock with a count or a stock correction)'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- 0024's record_expense (0035's __run): 5310 takes no expense, as 5300 does not.
create or replace function record_expense__run(
  p_description text, p_amount numeric, p_account_code text, p_paid_from text default 'cash', p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('expense.record');
  v_me uuid := (current_member()).id;
  v_amount numeric; v_date date; v_acct gl_account; v_exp uuid := gen_random_uuid(); v_journal uuid;
  v_from text := lower(coalesce(p_paid_from, '')); v_location uuid;
begin
  if v_from = 'cash' then v_from := 'till'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Describe the expense'; end if;
  select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
  if not found or v_acct.account_type <> 'expense' or p_account_code in ('5000', '5050', '5300', '5310', '5400') then
    raise exception 'Account % cannot take an expense (stock costs come from their own records)', p_account_code;
  end if;
  if v_from not in ('till', 'safe', 'bank', 'card', 'owner') then
    raise exception 'Say where the money came from: the till, the safe, the bank, a card or the owner';
  end if;
  v_date := coalesce(p_date, business_local_date(v_business, now()));
  v_location := resolve_location(v_business, null);

  v_journal := post_journal(v_business, (v_date + time '12:00') at time zone (select timezone from business where id = v_business),
    'Expense: ' || trim(p_description), 'expense', v_exp,
    jsonb_build_array(jsonb_build_object('code', p_account_code, 'debit', v_amount),
                      jsonb_build_object('code', payment_account(v_from), 'credit', v_amount)));
  insert into expense (id, business_id, location_id, amount, incurred_on, description, journal_entry_id, created_by)
  values (v_exp, v_business, v_location, v_amount, v_date, trim(p_description), v_journal, v_me);
  perform pay_out_of(v_business, v_location, v_from, v_amount, 'expense', v_exp, v_me);
  return jsonb_build_object('expense_id', v_exp, 'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- 0044's record_bill__run: 5310 takes no bill.
create or replace function record_bill__run(
  p_supplier uuid, p_invoice_no text, p_invoice_date date, p_amount numeric, p_term_days int default 0,
  p_receipt uuid default null, p_account_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_amount numeric; v_grni numeric; v_legacy numeric; v_ppv numeric; v_bill uuid; v_journal uuid; v_lines jsonb;
  v_acct gl_account; v_state jsonb;
  v_no text := nullif(trim(p_invoice_no), '');
begin
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business) then
    raise exception 'Choose a supplier';
  end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if (p_receipt is null) = (p_account_code is null) then
    raise exception 'A bill is either for a goods receipt or for an expense account — choose one';
  end if;
  if v_no is null then
    v_no := bill_number_take(v_business);
  elsif is_own_bill_number(v_business, v_no) then
    raise exception 'Numbers like % are the café''s own and are given automatically: leave the box as it is, or type the supplier''s invoice number', v_no;
  end if;
  -- Against every bill ever entered, including those before the controls (M-07).
  if exists (select 1 from purchase_invoice where business_id = v_business and supplier_id = p_supplier
               and lower(invoice_no) = lower(v_no) and cancelled_at is null) then
    raise exception 'Invoice % from this supplier is already recorded', v_no;
  end if;

  v_bill := gen_random_uuid();
  if p_receipt is not null then
    perform 1 from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Receipt not found'; end if;
    v_state := receipt_state(p_receipt);
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'That delivery was reversed: there is nothing to bill';
    end if;
    -- The old app did not record the supplier on a receipt; any supplier may bill those.
    if (v_state ->> 'supplier_id') is not null and (v_state ->> 'supplier_id')::uuid <> p_supplier then
      raise exception 'That receipt is from a different supplier';
    end if;
    if exists (select 1 from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null) then
      raise exception 'That receipt has already been billed';
    end if;
    v_grni := receipt_grni_value(p_receipt);
    if v_grni <= 0 and exists (select 1 from supplier_return where goods_receipt_id = p_receipt and against = 'delivery') then
      raise exception 'Everything delivery % brought went back to the supplier: there is nothing to bill',
        (select receipt_no from goods_receipt where id = p_receipt);
    end if;
    if v_grni > 0 then
      v_ppv := v_amount - v_grni;
      v_lines := jsonb_build_array(
        jsonb_build_object('code', '2050', 'debit', v_grni),
        jsonb_build_object('code', '5050', 'debit', greatest(v_ppv, 0), 'credit', greatest(-v_ppv, 0)),
        jsonb_build_object('code', '2000', 'credit', v_amount));
    else
      v_legacy := receipt_legacy_payable(p_receipt);
      if v_legacy <= 0 then
        raise exception 'That receipt has no payable to bill against: its journal was reversed or never written (see docs/REMEDIATION.md)';
      end if;
      v_ppv := v_amount - v_legacy;
      v_lines := case when v_ppv <> 0 then jsonb_build_array(
        jsonb_build_object('code', '5050', 'debit', greatest(v_ppv, 0), 'credit', greatest(-v_ppv, 0)),
        jsonb_build_object('code', '2000', 'debit', greatest(-v_ppv, 0), 'credit', greatest(v_ppv, 0))) end;
    end if;
  else
    select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
    if not found or v_acct.account_type not in ('expense', 'asset')
       or p_account_code in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '5000', '5050',
                          '5300', '5310', '5400') then
      raise exception 'Account % cannot take a bill; stock is billed against its goods receipt', p_account_code;
    end if;
    v_lines := jsonb_build_array(
      jsonb_build_object('code', p_account_code, 'debit', v_amount),
      jsonb_build_object('code', '2000', 'credit', v_amount));
  end if;

  if v_lines is not null then
    v_journal := post_journal(v_business, (coalesce(p_invoice_date, business_local_date(v_business, now())) + time '12:00')
                                            at time zone (select timezone from business where id = v_business),
      'Bill ' || v_no, 'purchase_invoice', v_bill, v_lines, null, v_no);
  end if;
  insert into purchase_invoice (id, business_id, supplier_id, invoice_no, invoice_date, due_date, amount_total,
                                goods_receipt_id, expense_account_code, journal_entry_id)
  values (v_bill, v_business, p_supplier, v_no,
          coalesce(p_invoice_date, business_local_date(v_business, now())),
          coalesce(p_invoice_date, business_local_date(v_business, now())) + greatest(coalesce(p_term_days, 0), 0),
          v_amount, p_receipt, p_account_code, v_journal);
  return jsonb_build_object('bill_id', v_bill, 'invoice_no', v_no,
                            'journal_no', (select journal_no from journal_entry where id = v_journal),
                            'price_variance', coalesce(v_ppv, 0));
end $$;

-- 0044's record_supplier_credit__run: 5310 takes no supplier's credit.
create or replace function record_supplier_credit__run(p_supplier uuid, p_kind text, p_amount numeric,
                                                       p_supplier_ref text, p_reason text, p_receipt uuid,
                                                       p_bill uuid, p_account_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_me uuid := (current_member()).id;
  v_kind text := lower(nullif(trim(p_kind), '')); v_ref text := nullif(trim(p_supplier_ref), '');
  v_reason text := nullif(trim(p_reason), ''); v_amount numeric; v_day date; v_account text;
  r goods_receipt; v_state jsonb; b purchase_invoice; acct gl_account;
  v_id uuid := gen_random_uuid(); v_no bigint; v_journal uuid; v_lines jsonb; v_alloc numeric := 0;
  v_items uuid[]; v_values numeric[]; v_after numeric[]; v_worth numeric; v_taken numeric; i int; p record;
  v_share numeric; v_on numeric; v_stock numeric := 0; v_part numeric; v_moves jsonb := '[]'; x jsonb;
begin
  if v_kind is null or v_kind not in ('price', 'other', 'goods_return') then
    raise exception 'Say what the credit is for: a price, or other';
  end if;
  if v_kind = 'goods_return' then
    raise exception 'A return makes its own credit: record the supplier''s note on it instead';
  end if;
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business) then
    raise exception 'Choose a supplier';
  end if;
  if v_ref is null then raise exception 'Type the number on the supplier''s credit note'; end if;
  if exists (select 1 from supplier_credit where business_id = v_business and supplier_id = p_supplier
               and lower(supplier_ref) = lower(v_ref)) then
    raise exception 'Credit note % from this supplier is already recorded', v_ref;
  end if;
  if v_reason is null then raise exception 'Say what the credit is for'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  v_day := business_local_date(v_business, now());
  if p_bill is not null then
    select * into b from purchase_invoice where id = p_bill and business_id = v_business;
    if not found then raise exception 'Bill not found'; end if;
    if b.supplier_id <> p_supplier then raise exception 'That bill is from another supplier'; end if;
    if b.cancelled_at is not null then raise exception 'That bill was cancelled; it is not owed'; end if;
  end if;

  if v_kind = 'price' then
    if p_receipt is null then raise exception 'Choose the delivery the price was for'; end if;
    select * into r from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Delivery not found'; end if;
    v_state := receipt_state(p_receipt);
    if (v_state ->> 'supplier_id')::uuid is distinct from p_supplier then
      raise exception 'Delivery % came from another supplier', coalesce(r.receipt_no::text, '');
    end if;
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'Delivery % was reversed: there is no price to reduce', r.receipt_no;
    end if;
    if p_bill is null then
      select * into b from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null;
    elsif b.goods_receipt_id is distinct from p_receipt then
      raise exception 'Bill % is not for delivery %', b.invoice_no, r.receipt_no;
    end if;
    if b.id is null then
      raise exception 'Delivery % is not billed yet: correct its price on Purchasing instead', r.receipt_no;
    end if;
    -- What the delivery is still worth to the supplier: its value less what went back and earlier credits.
    select array_agg(g.item_id order by g.item_id), array_agg(g.v order by g.item_id), coalesce(sum(g.v), 0)
      into v_items, v_values, v_worth
      from (select (e ->> 'item_id')::uuid as item_id, sum((e ->> 'landed')::numeric) as v
              from jsonb_array_elements(v_state -> 'lines') e group by 1) g
     where g.v > 0;
    v_taken := coalesce((select sum(value) from supplier_return where goods_receipt_id = p_receipt), 0)
               + coalesce((select sum(amount) from supplier_credit where goods_receipt_id = p_receipt and kind = 'price'), 0);
    if v_worth - v_taken <= 0 or v_amount > v_worth - v_taken then
      raise exception 'That is more than delivery % is still worth (%)', r.receipt_no,
        trim_scale(greatest(v_worth - v_taken, 0));
    end if;
    -- Shared over its items by value; each item's share still on hand revalues it, the rest is variance.
    v_after := allocate_landed(v_business, v_values, -v_amount);
    perform lock_items(v_items);
    for i in 1 .. cardinality(v_items) loop
      v_share := v_values[i] - v_after[i];
      p := item_position(v_business, v_items[i], r.location_id);
      v_on := receipt_share_on_hand(v_business, p_receipt, v_items[i], r.location_id);
      v_part := case when p.qty > 0 and p.value > 0
                     then least(money_round(v_business, v_share * v_on), p.value) else 0 end;
      if v_part > 0 then
        v_moves := v_moves || jsonb_build_object('item_id', v_items[i], 'qty', p.qty, 'from', p.value,
                                                 'to', p.value - v_part);
      end if;
      v_stock := v_stock + v_part;
    end loop;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line('1200', -v_stock),
                                 signed_line('5050', v_stock - v_amount));
  else
    v_account := coalesce(nullif(trim(p_account_code), ''), b.expense_account_code);
    if v_account is null then raise exception 'Choose the account the credit is taken off'; end if;
    select * into acct from gl_account where business_id = v_business and code = v_account and is_active;
    if not found or acct.account_type not in ('expense', 'asset')
       or v_account in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '5000', '5300', '5310',
                       '5400') then
      raise exception 'Account % cannot take a supplier''s credit', v_account;
    end if;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line(v_account, -v_amount));
  end if;

  v_no := next_document_no(v_business, 'supplier_credit', 1);
  v_journal := post_journal(v_business, now(),
    'Credit ' || v_no || ' from ' || (select name from supplier where id = p_supplier) || ' (' || v_ref || '): ' || v_reason,
    'supplier_credit', v_id, v_lines, null, v_ref);
  insert into supplier_credit (id, business_id, credit_no, supplier_id, kind, amount, credit_date, supplier_ref, reason,
                               goods_receipt_id, purchase_invoice_id, account_code, journal_entry_id, matched_at,
                               matched_by, created_by)
  values (v_id, v_business, v_no, p_supplier, v_kind, v_amount, v_day, v_ref, v_reason, p_receipt, b.id, v_account,
          v_journal, now(), v_me, v_me);
  for x in select * from jsonb_array_elements(v_moves) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, (x ->> 'item_id')::uuid, r.location_id, 'cost_adjustment', -(x ->> 'qty')::numeric,
            (x ->> 'from')::numeric / (x ->> 'qty')::numeric, (x ->> 'from')::numeric,
            'supplier_credit', v_id, v_me, 'Revalued: credit ' || v_no || ' on delivery ' || r.receipt_no),
           (v_business, (x ->> 'item_id')::uuid, r.location_id, 'cost_adjustment', (x ->> 'qty')::numeric,
            (x ->> 'to')::numeric / (x ->> 'qty')::numeric, (x ->> 'to')::numeric,
            'supplier_credit', v_id, v_me, 'Revalued: credit ' || v_no || ' on delivery ' || r.receipt_no);
  end loop;
  if b.id is not null then
    v_alloc := set_credit_against(v_business, v_id, b.id, null, v_me, false);
  end if;
  perform audit_event(v_business, 'purchase.credit', 'supplier_credit', v_id::text, v_reason, null,
    jsonb_build_object('credit_no', v_no, 'supplier', p_supplier, 'credit_kind', v_kind, 'amount', v_amount,
                       'supplier_ref', v_ref, 'receipt_no', r.receipt_no, 'bill', b.invoice_no,
                       'account', v_account, 'stock_change', -v_stock, 'set_against_bill', v_alloc));
  return jsonb_build_object('credit_id', v_id, 'credit_no', v_no, 'kind', v_kind, 'amount', v_amount,
    'stock', -v_stock, 'variance', case when v_kind = 'price' then v_stock - v_amount else 0 end,
    'set_against_bill', v_alloc, 'bill_no', b.invoice_no,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- ---------------------------------------------------------------------------
-- 10. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  provision_chart_of_accounts(uuid), is_loss(movement_type), loss_account(movement_type),
  is_giveaway(movement_type), stock_card_kind(movement_type, text, numeric), allocate_lots(inventory_movement),
  loss_approval(uuid, uuid, uuid, jsonb, uuid, boolean, text),
  write_loss(uuid, uuid, uuid, movement_type, jsonb, text, uuid, boolean, boolean, sales_channel),
  record_loss__run(movement_type, uuid, uuid, numeric, text, text, uuid, uuid, uuid, boolean),
  record_waste__run(uuid, numeric, text, movement_type, text, uuid, uuid, boolean),
  give_away__run(movement_type, sales_channel, jsonb, text, uuid, uuid), review_loss__run(uuid, text, text),
  alert_conditions_0031(uuid, timestamptz), alert_conditions_0040(uuid, timestamptz),
  document_problems(uuid, timestamptz), journal_source_hint(text), legacy_unposted_internal(uuid),
  record_expense__run(text, numeric, text, text, date), record_bill__run(uuid, text, date, numeric, int, uuid, text),
  record_supplier_credit__run(uuid, text, numeric, text, text, uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function
  record_loss(movement_type, uuid, uuid, numeric, text, text, uuid, uuid, uuid, boolean, uuid),
  give_away(movement_type, sales_channel, jsonb, text, uuid, uuid, uuid), losses_waiting(), report_losses(date, date)
  from public, anon;
grant execute on function
  record_loss(movement_type, uuid, uuid, numeric, text, text, uuid, uuid, uuid, boolean, uuid),
  give_away(movement_type, sales_channel, jsonb, text, uuid, uuid, uuid), losses_waiting(), report_losses(date, date)
  to authenticated;
