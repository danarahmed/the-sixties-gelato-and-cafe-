-- =============================================================================
-- 0098 — Use-by for everything that goes off (OPEN_PLANS plan 3 and plan 5 B)
-- =============================================================================
-- The owner's choices (8 November 2026):
--
--  * Every item chooses how it keeps (item.expiry_mode): it doesn't go off
--    (cups, sugar); it keeps a number of days from delivery (item.keeps_days,
--    the same days the buying list reads); or each delivery's line carries the
--    exact date printed on the pack. A delivery of an item that goes off makes
--    a lot of its own, with that use-by, and the item is kept lot by lot from
--    then on, as batches are (0046): sales take the oldest first, and what is
--    past its use-by last.
--  * A lot's use-by is changed afterwards only by those who approve stock
--    corrections, with a reason, on the audit trail (set_lot_use_by).
--  * A batch recipe says how long what it makes keeps, or that it doesn't go
--    off (recipe.never_goes_off): one or the other, when it is saved.
--  * Expired stock is caught before the till: warnings ahead of time (the
--    café's use_by_warn_hours, a day by default) on the alerts and the phone;
--    use_by_lots for Today and Inventory (what to take off the shelf, what goes
--    off today, what soon); pos_use_by marks a product on the till whose stock
--    is near or past its use-by.
--  * The last guard (the café's rule expired_sale, for the café or a branch):
--    a sale that would take stock past its use-by is warned of (the default)
--    and kept on the audit trail, or refused unless a manager approves with
--    their PIN, the same approval that covers selling beyond the books.
--  * A return to the supplier, or a delivery corrected down, takes from that
--    delivery's own lot first.
--
-- Nothing recorded changes: lots start with the next delivery of each item.
-- Rehearsed with tests/sql/use_by.test.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. How each item keeps; recipes that don't go off
-- -----------------------------------------------------------------------------
alter table item add column if not exists expiry_mode text;
alter table item drop constraint if exists item_expiry_mode;
alter table item add constraint item_expiry_mode
  check (expiry_mode is null or expiry_mode in ('none', 'keeps_days', 'exact_date'));
alter table recipe add column if not exists never_goes_off boolean not null default false;

-- Packaging and consumables do not go off; the rest is the café's to choose.
update item set expiry_mode = 'none'
 where expiry_mode is null and item_type::text in ('packaging', 'consumable');

-- And a new one, as it is made.
create or replace function trg_item_keeps() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.expiry_mode is null and new.item_type::text in ('packaging', 'consumable') then
    new.expiry_mode := 'none';
  end if;
  return new;
end $$;
drop trigger if exists item_keeps on item;
create trigger item_keeps before insert on item for each row execute function trg_item_keeps();

-- The rules: what a sale past its use-by does, and how far ahead to warn.
-- 0084's definitions, and two more.
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
                              "label": "Stock sent to another branch is charged at cost plus (%; 0: at cost)"},
    "expired_sale":          {"kind": "choice", "choices": ["warn", "refuse"],
                              "scopes": ["business", "location"],
                              "label": "Selling stock past its use-by"},
    "use_by_warn_hours":     {"kind": "hours", "min": 1, "max": 168, "whole": true,
                              "scopes": ["business"],
                              "label": "Warn of a use-by this many hours ahead"}
  }'::jsonb
$$;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rule_defaults_0097') then
    execute 'alter function rule_defaults(uuid) rename to rule_defaults_0097';
  end if;
end $$;
create or replace function rule_defaults(p_business uuid)
returns table (key text, scope_type text, scope_id text, value jsonb)
language sql stable set search_path = public as $$
  select d.key, d.scope_type, d.scope_id, d.value from rule_defaults_0097(p_business) d
  union all
  select 'expired_sale', 'business', '', to_jsonb('warn'::text)
  union all
  select 'use_by_warn_hours', 'business', '', to_jsonb(24)
$$;

-- How far ahead the café warns of a use-by.
create or replace function use_by_lead(p_business uuid) returns interval
language sql stable set search_path = public as $$
  select make_interval(hours => coalesce((rule_value(p_business, 'use_by_warn_hours') #>> '{}')::int, 24))
$$;

-- The end of a day at the café: a pack "used by 12 Nov" keeps through the 12th.
create or replace function use_by_end_of(p_business uuid, p_day date) returns timestamptz
language sql stable set search_path = public as $$
  select ((p_day + 1)::timestamp at time zone (select timezone from business where id = p_business))
$$;

-- An item's way of keeping, chosen once.
create or replace function set_item_use_by__run(p_item uuid, p_mode text, p_days int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  i item;
begin
  select * into i from item where id = p_item and business_id = v_business for update;
  if not found then raise exception 'Unknown item'; end if;
  if p_mode is null or p_mode not in ('none', 'keeps_days', 'exact_date') then
    raise exception 'Choose how it keeps: it doesn''t go off, it keeps some days from delivery, or each delivery has its date';
  end if;
  if p_mode = 'keeps_days' and (p_days is null or p_days < 1 or p_days > 365) then
    raise exception 'Say how many days it keeps from delivery: 1 to 365';
  end if;
  update item set expiry_mode = p_mode,
                  keeps_days = case when p_mode = 'keeps_days' then p_days else keeps_days end
   where id = i.id;
  perform audit_event(v_business, 'item.use_by', 'item', i.id::text, null,
    jsonb_build_object('name', i.name, 'expiry_mode', i.expiry_mode, 'keeps_days', i.keeps_days),
    jsonb_build_object('name', i.name, 'expiry_mode', p_mode,
                       'keeps_days', case when p_mode = 'keeps_days' then p_days else i.keeps_days end));
  return jsonb_build_object('item_id', i.id, 'expiry_mode', p_mode,
                            'keeps_days', case when p_mode = 'keeps_days' then p_days else i.keeps_days end);
end $$;

create or replace function set_item_use_by(p_item uuid, p_mode text, p_days int default null,
                                           p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_item', p_item, 'p_mode', p_mode, 'p_days', p_days);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_item_use_by', v_req);
  if v is not null then return v; end if;
  v := set_item_use_by__run(p_item => p_item, p_mode => p_mode, p_days => p_days);
  perform idem_finish(v_business, p_idempotency_key, 'set_item_use_by', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 2. A batch recipe keeps a while, or doesn't go off: one or the other
-- -----------------------------------------------------------------------------
-- 0046's save: p_shelf_life_hours left out keeps what it was; 0 now means "it
-- doesn't go off"; a number is how long it keeps. Saved with neither, it is
-- refused.
alter function save_batch_recipe__run(uuid, text, jsonb, numeric, text, jsonb, text, boolean, int)
  rename to save_batch_recipe__run_0046;
create function save_batch_recipe__run(p_recipe uuid, p_name text, p_output jsonb, p_yield numeric,
                                       p_yield_unit text, p_lines jsonb, p_instructions text,
                                       p_is_active boolean, p_shelf_life_hours int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_id uuid; r recipe;
begin
  v := save_batch_recipe__run_0046(p_recipe, p_name, p_output, p_yield, p_yield_unit, p_lines, p_instructions,
                                   p_is_active, p_shelf_life_hours);
  v_id := coalesce(p_recipe, (v ->> 'recipe_id')::uuid, (v ->> 'id')::uuid);
  if p_shelf_life_hours = 0 then
    update recipe set never_goes_off = true where id = v_id;
  elsif p_shelf_life_hours > 0 then
    update recipe set never_goes_off = false where id = v_id;
  end if;
  select * into r from recipe where id = v_id;
  if r.id is not null and r.shelf_life_hours is null and not r.never_goes_off then
    raise exception 'Say how long what it makes keeps, or that it doesn''t go off';
  end if;
  return v || jsonb_build_object('never_goes_off', coalesce(r.never_goes_off, false));
end $$;

-- -----------------------------------------------------------------------------
-- 3. A delivery of what goes off makes a lot, with its use-by
-- -----------------------------------------------------------------------------
-- 0095's receive_goods__run, with each line's use-by: from the item's days, or
-- the date typed (l.use_by, 'YYYY-MM-DD'), which an item kept by the exact date
-- must have. Not one already past.
create or replace function receive_goods__run(
  p_supplier uuid, p_lines jsonb, p_freight numeric default 0, p_other numeric default 0,
  p_rebate numeric default 0, p_note text default null, p_location uuid default null,
  p_confirm boolean default false, p_purchase_order uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.receive');
  v_me uuid := (current_member()).id;
  v_location uuid; v_receipt uuid; v_no bigint;
  v_goods numeric[] := '{}'; v_landed numeric[]; v_items uuid[] := '{}'; v_po_lines uuid[] := '{}';
  l jsonb; i int := 0; v_item uuid; v_base numeric; v_mv uuid; v_total numeric := 0; v_journal uuid;
  v_value numeric; v_cost numeric; v_ref numeric; v_warn text[] := '{}'; v_more text[] := '{}'; v_per text; it item;
  o purchase_order; pl purchase_order_line; v_line uuid; v_came numeric; v_now jsonb := '{}';
  v_today date := business_local_date(v_business, now());
  v_days date[] := '{}'; v_day date; v_lot uuid; v_lots jsonb := '[]';
begin
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business and is_active) then
    raise exception 'Choose an active supplier';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one line'; end if;
  if coalesce(p_freight, 0) < 0 or coalesce(p_other, 0) < 0 or coalesce(p_rebate, 0) < 0 then
    raise exception 'Freight, other costs and rebates cannot be negative';
  end if;
  if p_purchase_order is not null then
    select * into o from purchase_order where id = p_purchase_order and business_id = v_business for update;
    if not found then raise exception 'Order not found'; end if;
    if o.status = 'draft' then
      raise exception 'Order % is not approved yet: approve it, or receive without it', o.po_no;
    end if;
    if o.status = 'closed' then raise exception 'Order % is closed: receive without it', o.po_no; end if;
    if o.status = 'cancelled' then raise exception 'Order % was cancelled: receive without it', o.po_no; end if;
    if o.supplier_id <> p_supplier then
      raise exception 'Order % is from %: receive it from them', o.po_no,
        (select name from supplier where id = o.supplier_id);
    end if;
    if p_location is not null and p_location <> o.location_id then
      raise exception 'Order % is for %: receive it there', o.po_no, (select name from location where id = o.location_id);
    end if;
    v_location := o.location_id;
  else
    v_location := resolve_location(v_business, p_location);
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    v_item := (l ->> 'item_id')::uuid;
    select * into it from item where id = v_item and business_id = v_business;
    if not found then raise exception 'Unknown item on the receipt'; end if;
    if not it.is_active then raise exception '% is out of use: bring it back into use first', it.name; end if;
    if coalesce((l ->> 'qty')::numeric, 0) <= 0 then raise exception 'Every received line needs a quantity'; end if;
    -- Its use-by (0098): the date typed, or its days from today; none if it doesn't go off.
    v_day := case when coalesce(it.expiry_mode, 'none') = 'none' then null
                  else coalesce(nullif(l ->> 'use_by', '')::date,
                                case when it.expiry_mode = 'keeps_days' and it.keeps_days is not null
                                     then v_today + it.keeps_days end) end;
    if it.expiry_mode = 'exact_date' and v_day is null then
      raise exception 'Type the use-by printed on the pack of %', it.name;
    end if;
    if v_day is not null and v_day < v_today then
      raise exception '% is already past its use-by (%): send it back rather than receive it', it.name,
        to_char(v_day, 'DD Mon YYYY');
    end if;
    v_days := v_days || v_day;
    -- A price per unit (of the unit received), or the line's total.
    v_value := case when nullif(l ->> 'unit_price', '') is not null
                    then (l ->> 'unit_price')::numeric * (l ->> 'qty')::numeric
                    else (l ->> 'goods_value')::numeric end;
    if coalesce(v_value, -1) < 0 then raise exception 'Every received line needs a price'; end if;
    v_goods := v_goods || money_round(v_business, v_value);
    v_items := v_items || v_item;
    -- Its cost per base unit, against what the item costs now.
    v_base := to_base_qty(v_item, (l ->> 'qty')::numeric, l ->> 'unit_code');
    v_cost := v_value / v_base;
    v_ref := item_reference_cost(v_business, v_item, v_location);
    v_per := case when it.base_unit_code = 'each' then ' each' else ' a ' || it.base_unit_code end;
    if v_ref > 0 and abs(v_cost - v_ref) > 0.25 * v_ref then
      v_warn := v_warn || format('%s at %s%s is %s%% %s its cost now (%s%s)', it.name,
        trim_scale(round(v_cost, 4)), v_per, round(abs(v_cost - v_ref) / v_ref * 100),
        case when v_cost > v_ref then 'above' else 'below' end, trim_scale(round(v_ref, 4)), v_per);
    end if;
    -- Its line on the order, and more of it than is still on order.
    v_line := null;
    if o.id is not null then
      if nullif(l ->> 'po_line_id', '') is not null then
        select * into pl from purchase_order_line
         where id = (l ->> 'po_line_id')::uuid and purchase_order_id = o.id;
        if not found or pl.item_id <> v_item then raise exception 'That line is not on order %', o.po_no; end if;
        v_line := pl.id;
      else
        select * into pl from purchase_order_line where purchase_order_id = o.id and item_id = v_item;
        if found then v_line := pl.id; end if;
      end if;
      if v_line is not null then
        v_came := coalesce((select g.base_qty from po_received(o.id) g where g.item_id = v_item), 0)
                  + coalesce((v_now ->> v_item::text)::numeric, 0) + v_base;
        if v_came > pl.base_qty then
          v_more := v_more || format('%s: %s %s ordered, %s with this delivery', it.name,
            trim_scale(round(pl.base_qty, 3)), it.base_unit_code, trim_scale(round(v_came, 3)));
        end if;
      end if;
      v_now := v_now || jsonb_build_object(v_item::text, coalesce((v_now ->> v_item::text)::numeric, 0) + v_base);
    end if;
    v_po_lines := v_po_lines || v_line;
  end loop;
  if not coalesce(p_confirm, false) then
    if cardinality(v_warn) > 0 and cardinality(v_more) > 0 then
      raise exception 'Check the price and the quantity: %. If it is right, confirm it and receive again',
        array_to_string(v_warn || v_more, '; ');
    elsif cardinality(v_warn) > 0 then
      raise exception 'Check the price: %. If it is right, confirm it and receive again', array_to_string(v_warn, '; ');
    elsif cardinality(v_more) > 0 then
      raise exception 'Check the quantity: %. If it is right, confirm it and receive again',
        array_to_string(v_more, '; ');
    end if;
  end if;
  perform lock_items(v_items);
  v_landed := allocate_landed(v_business, v_goods, coalesce(p_freight, 0) + coalesce(p_other, 0) - coalesce(p_rebate, 0));

  v_no := next_document_no(v_business, 'receipt', 1);
  insert into goods_receipt (business_id, location_id, supplier_id, receipt_no, freight_total,
                             other_landed_total, rebate_total, received_by, note, purchase_order_id)
  values (v_business, v_location, p_supplier, v_no, coalesce(p_freight, 0), coalesce(p_other, 0),
          coalesce(p_rebate, 0), v_me, nullif(trim(p_note), ''), o.id)
  returning id into v_receipt;

  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    v_item := (l ->> 'item_id')::uuid;
    v_base := to_base_qty(v_item, (l ->> 'qty')::numeric, l ->> 'unit_code');
    -- What goes off comes in as a lot of its own (0098).
    v_lot := null;
    if v_days[i] is not null then
      perform start_lot_tracking(v_item, 'Kept delivery by delivery from now, each with its use-by');
      insert into item_lot (business_id, item_id, lot_code, expiry_date, received_at, use_by, location_id, left_base)
      values (v_business, v_item, 'D' || v_no || '-' || i, v_days[i], now(), use_by_end_of(v_business, v_days[i]),
              v_location, 0)
      returning id into v_lot;
      v_lots := v_lots || jsonb_build_object('item_id', v_item, 'lot_id', v_lot, 'use_by', v_days[i]);
    end if;
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, app_user_id, reason, lot_id)
    values (v_business, v_item, v_location, 'purchase_receipt', v_base, v_landed[i] / v_base, v_landed[i],
            'goods_receipt', v_receipt, v_me, 'Goods received', v_lot)
    returning id into v_mv;
    insert into goods_receipt_line (goods_receipt_id, item_id, received_qty, received_unit_code, goods_value, movement_id,
                                    purchase_order_line_id, lot_id)
    values (v_receipt, v_item, (l ->> 'qty')::numeric,
            coalesce(l ->> 'unit_code', (select base_unit_code from item where id = v_item)), v_goods[i], v_mv,
            v_po_lines[i], v_lot);
    v_total := v_total + v_landed[i];
  end loop;

  -- A delivery worth nothing moves nothing in the books: it has no journal.
  if v_total > 0 then
    v_journal := post_journal(v_business, now(), 'Goods received — receipt ' || v_no, 'goods_receipt', v_receipt,
      jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_total),
                        jsonb_build_object('code', '2050', 'credit', v_total)));
  end if;
  if cardinality(v_warn) > 0 then
    perform audit_event(v_business, 'purchase.price_confirmed', 'goods_receipt', v_receipt::text,
                        array_to_string(v_warn, '; '), null, jsonb_build_object('receipt_no', v_no));
  end if;
  if cardinality(v_more) > 0 then
    perform audit_event(v_business, 'purchase.quantity_confirmed', 'goods_receipt', v_receipt::text,
                        array_to_string(v_more, '; '), null, jsonb_build_object('receipt_no', v_no, 'po_no', o.po_no));
  end if;
  return jsonb_build_object('receipt_id', v_receipt, 'receipt_no', v_no, 'value', v_total,
    'journal_no', (select journal_no from journal_entry where id = v_journal), 'lots', v_lots)
    || case when o.id is not null
            then jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'po_receiving', po_view(o.id) ->> 'receiving')
            else '{}'::jsonb end;
end $$;

-- A return to the supplier, or a delivery corrected down: from that delivery's
-- lots first (0054's sources, and these two).
create or replace function lot_sources(m inventory_movement) returns uuid[]
language sql stable set search_path = public as $$
  select case
    when m.type = 'refund_return_to_stock' and m.sales_order_line_id is not null then
      (select array_agg(o.id) from inventory_movement o
        where o.sales_order_line_id = m.sales_order_line_id and o.item_id = m.item_id
          and o.location_id = m.location_id and o.id <> m.id
          and o.type in ('sale_consumption', 'refund_return_to_stock'))
    when m.type = 'reversal' and m.reference_type = 'sale_void' then
      (select array_agg(o.id) from inventory_movement o
        where o.reference_id = m.reference_id and o.item_id = m.item_id and o.location_id = m.location_id
          and o.id <> m.id
          and ((o.type = 'sale_consumption' and o.reference_type = 'sales_order')
               or (o.type = 'reversal' and o.reference_type = 'sale_void')))
    when m.type = 'reversal' and m.reference_type = 'production_cancel' then
      (select array_agg(o.id) from inventory_movement o
        where o.reference_id = m.reference_id and o.item_id = m.item_id and o.location_id = m.location_id
          and o.id <> m.id
          and ((o.reference_type = 'production_batch'
                and o.type = case when m.base_quantity_signed > 0 then 'production_consumption'
                                  else 'production_output' end::movement_type)
               or (o.reference_type = 'production_cancel' and o.type = 'reversal'
                   and sign(o.base_quantity_signed) = sign(m.base_quantity_signed))))
    when m.type = 'reversal' and m.reference_type = 'loss_review' then
      (select array[o.id] from inventory_movement o
        where o.id = nullif(current_setting('lots.loss_reversed', true), '')::uuid
          and o.item_id = m.item_id and o.location_id = m.location_id)
    when m.type = 'reversal' and m.reference_type = 'stock_transfer_cancel' then
      (select array_agg(o.id) from inventory_movement o
        where o.reference_type = 'stock_transfer' and o.reference_id = m.reference_id and o.item_id = m.item_id
          and o.location_id = m.location_id and o.type = 'transfer_out')
    when m.type = 'supplier_return' and m.base_quantity_signed < 0 then
      (select array_agg(o.id) from inventory_movement o
         join supplier_return sr on sr.id = m.reference_id and sr.goods_receipt_id is not null
        where o.reference_type = 'goods_receipt' and o.reference_id = sr.goods_receipt_id
          and o.item_id = m.item_id and o.location_id = m.location_id and o.type = 'purchase_receipt')
    when m.type::text = 'receipt_correction' and m.base_quantity_signed < 0 then
      (select array_agg(o.id) from inventory_movement o
         join receipt_correction rc on rc.id = m.reference_id
        where o.reference_type = 'goods_receipt' and o.reference_id = rc.goods_receipt_id
          and o.item_id = m.item_id and o.location_id = m.location_id and o.type = 'purchase_receipt')
  end
$$;

-- -----------------------------------------------------------------------------
-- 4. A lot's use-by changed afterwards: with a reason, on the trail
-- -----------------------------------------------------------------------------
create or replace function set_lot_use_by__run(p_lot uuid, p_use_by date, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  lot item_lot; v_name text; v_to timestamptz;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the use-by changes'; end if;
  if p_use_by is null then raise exception 'Give the new use-by'; end if;
  select * into lot from item_lot where id = p_lot and business_id = v_business for update;
  if not found then raise exception 'Lot not found'; end if;
  if lot.production_batch_id is not null then
    -- A batch's is changed with its batch, as it was (0046).
    return set_batch_use_by__run(lot.production_batch_id, use_by_end_of(v_business, p_use_by), p_reason);
  end if;
  if p_use_by < business_local_date(v_business, coalesce(lot.received_at, lot.created_at)) then
    raise exception 'The use-by is not before the day it came';
  end if;
  v_to := use_by_end_of(v_business, p_use_by);
  if v_to is not distinct from lot.use_by then raise exception 'That is its use-by already'; end if;
  select name into v_name from item where id = lot.item_id;
  update item_lot set use_by = v_to, expiry_date = p_use_by where id = lot.id;
  perform audit_event(v_business, 'stock.use_by', 'item_lot', lot.id::text, trim(p_reason),
    jsonb_build_object('item', v_name, 'lot', lot.lot_code, 'use_by', lot.expiry_date),
    jsonb_build_object('item', v_name, 'lot', lot.lot_code, 'use_by', p_use_by));
  return jsonb_build_object('lot_id', lot.id, 'lot', lot.lot_code, 'use_by', p_use_by);
end $$;

create or replace function set_lot_use_by(p_lot uuid, p_use_by date, p_reason text,
                                          p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_lot', p_lot, 'p_use_by', p_use_by, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_lot_use_by', v_req);
  if v is not null then return v; end if;
  v := set_lot_use_by__run(p_lot => p_lot, p_use_by => p_use_by, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'set_lot_use_by', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 5. What is near or past its use-by: for Today, Inventory and the till
-- -----------------------------------------------------------------------------
-- A lot's state: past its use-by, going off today, within the café's warning
-- time, or good.
create or replace function use_by_state(p_business uuid, p_use_by timestamptz, p_now timestamptz default now())
returns text language sql stable set search_path = public as $$
  select case when p_use_by is null then 'good'
              when p_use_by <= p_now then 'expired'
              when p_use_by <= use_by_end_of(p_business, business_local_date(p_business, p_now)) then 'today'
              when p_use_by <= p_now + use_by_lead(p_business) then 'soon'
              else 'good' end
$$;

-- The lots at a place that are near or past their use-by (all of them with a
-- use-by, with p_all), the batches' and the deliveries'; and, for those who set
-- items and recipes up, the items and recipes that have not said how they keep.
create or replace function use_by_lots(p_location uuid default null, p_all boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'production.record', 'waste.record', 'inventory.count',
                                        'purchase.receive', 'inventory.adjust.approve', 'cost.view');
  v_loc uuid := resolve_location(v_business, p_location);
  v_tz text := (select timezone from business where id = v_business);
begin
  return jsonb_build_object(
    'lead_hours', extract(epoch from use_by_lead(v_business)) / 3600,
    'can_edit', current_has_permission('inventory.adjust.approve'),
    'lots', coalesce((
      select jsonb_agg(jsonb_build_object(
               'lot_id', lot.id, 'lot', lot.lot_code, 'item_id', lot.item_id, 'item', i.name,
               'unit', i.base_unit_code,
               'kind', case when lot.production_batch_id is not null then 'batch' else 'delivery' end,
               'batch_no', b.batch_no, 'came', lot.received_at,
               'came_on', business_local_date(v_business, coalesce(lot.received_at, lot.created_at)),
               'use_by', lot.use_by,
               'use_by_on', case when lot.production_batch_id is null then lot.expiry_date
                                 else (lot.use_by at time zone v_tz)::date end,
               'left', trim_scale(lot.left_base),
               'status', use_by_state(v_business, lot.use_by))
             order by lot.use_by, i.name, lot.created_at)
        from item_lot lot
        join item i on i.id = lot.item_id
        left join production_batch b on b.id = lot.production_batch_id
       where lot.business_id = v_business and lot.location_id = v_loc and lot.left_base > 0
         and lot.use_by is not null
         and (p_all or use_by_state(v_business, lot.use_by) <> 'good')), '[]'::jsonb),
    'unset_items', case when current_has_permission('settings.manage') or current_has_permission('purchase.create')
                          or current_has_permission('inventory.adjust.approve') then coalesce((
      select jsonb_agg(jsonb_build_object('item_id', i.id, 'name', i.name) order by i.name)
        from item i
       where i.business_id = v_business and i.is_active and i.expiry_mode is null
         and not exists (select 1 from recipe r where r.output_item_id = i.id and r.is_active)), '[]'::jsonb)
      else '[]'::jsonb end,
    'unset_recipes', case when current_has_permission('production.record')
                            or current_has_permission('recipe.edit') then coalesce((
      select jsonb_agg(jsonb_build_object('recipe_id', r.id, 'name', r.name) order by r.name)
        from recipe r
       where r.business_id = v_business and r.is_active and r.output_item_id is not null
         and r.shelf_life_hours is null and not r.never_goes_off), '[]'::jsonb)
      else '[]'::jsonb end);
end $$;

-- How each tracked item stands at a place: stock with no lot, what is still
-- good, what is past its use-by, and the next use-by it will sell from.
create or replace function lot_standing(p_business uuid, p_location uuid, p_now timestamptz default now())
returns table (item_id uuid, loose numeric, good numeric, expired numeric, next_use_by timestamptz)
language sql stable set search_path = public as $$
  select i.id,
         coalesce((select sum(lm.base_qty) from lot_movement lm
                    where lm.item_id = i.id and lm.location_id = p_location and lm.lot_id is null), 0),
         coalesce((select sum(l.left_base) from item_lot l
                    where l.item_id = i.id and l.location_id = p_location and l.left_base > 0
                      and (l.use_by is null or l.use_by > p_now)), 0),
         coalesce((select sum(l.left_base) from item_lot l
                    where l.item_id = i.id and l.location_id = p_location and l.left_base > 0
                      and l.use_by <= p_now), 0),
         (select min(l.use_by) from item_lot l
           where l.item_id = i.id and l.location_id = p_location and l.left_base > 0 and l.use_by > p_now)
    from item i
   where i.business_id = p_business and i.track_lot
$$;

-- A product size's recipe in force today, or nothing when it has none: one
-- product with no recipe never takes the till's marks away from the rest.
create or replace function expand_variant_safe(p_variant uuid, p_channel sales_channel, p_qty numeric, p_on date)
returns table (item_id uuid, base_qty numeric)
language plpgsql stable set search_path = public as $$
begin
  return query select e.item_id, e.base_qty from expand_variant(p_variant, p_channel, p_qty, p_on) e;
exception when others then
  return;
end $$;

-- The till's marks: each product size whose next unit would come from stock
-- past its use-by ('expired'), or from stock within the warning time ('soon'),
-- with the item that makes it so. Sales take stock with no lot first, then the
-- lots by their use-by, what is past it last (0046).
create or replace function pos_use_by(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_loc uuid := resolve_location(v_business, p_location);
  v_today date := business_local_date(v_business, now());
  v_lead interval := use_by_lead(v_business);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('variant_id', x.variant_id, 'state', x.state, 'item', x.item,
                                        'use_by', x.use_by) order by x.variant_id)
      from (select distinct on (pv.id) pv.id as variant_id, i.name as item,
                   case when s.expired > 0 and greatest(s.loose, 0) + s.good < e.base_qty then 'expired'
                        else 'soon' end as state,
                   s.next_use_by as use_by,
                   case when s.expired > 0 and greatest(s.loose, 0) + s.good < e.base_qty then 0 else 1 end as rank
              from product_variant pv
              join product p on p.id = pv.product_id and p.is_active
              cross join lateral expand_variant_safe(pv.id, 'dine_in', 1, v_today) e
              join lot_standing(v_business, v_loc) s on s.item_id = e.item_id
              join item i on i.id = e.item_id
             where pv.business_id = v_business and pv.is_active and e.base_qty > 0
               and ((s.expired > 0 and greatest(s.loose, 0) + s.good < e.base_qty)
                    or (greatest(s.loose, 0) < e.base_qty and s.next_use_by <= now() + v_lead))
             order by pv.id, rank, i.name) x), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 6. The last guard: a sale that would take stock past its use-by
-- -----------------------------------------------------------------------------
-- What a sale's needs would take from stock past its use-by: each tracked item
-- whose good stock (no lot, and lots still good) is less than it needs.
create or replace function expired_takes(p_business uuid, p_location uuid, p_needs jsonb)
returns table (item_id uuid, name text, unit text, need numeric, good numeric, expired numeric)
language sql stable set search_path = public as $$
  select n.item_id, i.name, i.base_unit_code, n.need, greatest(s.loose, 0) + s.good, s.expired
    from (select (x ->> 'item_id')::uuid as item_id, sum((x ->> 'qty')::numeric) as need
            from jsonb_array_elements(coalesce(p_needs, '[]'::jsonb)) x group by 1) n
    join item i on i.id = n.item_id and i.track_lot
    join lot_standing(p_business, p_location) s on s.item_id = n.item_id
   where n.need > 0 and s.expired > 0 and greatest(s.loose, 0) + s.good < n.need
   order by i.name, n.item_id
$$;

-- 0095's stock_rules, with the use-by (0098) for a sale: the café's rule
-- expired_sale warns (kept on the audit trail; the till marked it before) or
-- refuses unless a manager approves; one approval covers both, as one is used
-- once.
create or replace function stock_rules(p_business uuid, p_location uuid, p_needs jsonb, p_member uuid,
                                       p_approval uuid, p_kind text, p_for text, p_approved_by uuid default null)
returns uuid language plpgsql set search_path = public as $$
declare s record; v_names text; v_have numeric; v_unit text; v_name text; v_by uuid; a approval;
  v_offline boolean := current_setting('sixties.sale_offline', true) = 'on';
  v_agreed text := case
    when nullif(current_setting('sixties.pre_order', true), '') is not null then 'Pre-order collected'
    when nullif(current_setting('sixties.on_account', true), '') is not null then 'Customer invoiced' end;
  v_sale boolean := p_kind = 'negative_stock'
    and exists (select 1 from sales_order so where so.id::text = p_for and so.business_id = p_business);
  v_old text; v_old_name text; v_rule text;
begin
  -- Past its use-by (0098): only for a sale.
  if v_sale then
    for s in select * from expired_takes(p_business, p_location, p_needs) loop
      v_old := concat_ws(', ', v_old, format('%s ×%s %s', s.name, trim_scale(s.need - s.good), s.unit));
      v_old_name := coalesce(v_old_name, s.name);
    end loop;
    if v_old is not null then
      v_rule := coalesce(rule_value(p_business, 'expired_sale', null, null, p_location) #>> '{}', 'warn');
      if v_offline or v_rule = 'warn' or v_agreed is not null then
        perform audit_event(p_business, 'stock.expired_sold', 'stock', p_for,
          case when v_offline then 'Sold offline' else v_agreed end, null,
          jsonb_build_object('items', v_old, 'rule', v_rule));
        v_old := null;
      end if;
    end if;
  end if;

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
  if v_name is not null and v_agreed is not null then
    perform audit_event(p_business, 'stock.below_zero', 'stock', p_for, v_agreed, null,
      jsonb_build_object('items', v_names, 'approved_by', null, 'agreed', v_agreed));
    v_name := null;
  end if;
  if v_name is null and v_old is null then return null; end if;

  if p_approved_by is not null then
    v_by := p_approved_by;
  elsif member_has_permission(p_member, approval_permission(p_kind)) then
    v_by := p_member;
  elsif p_approval is not null then
    a := use_approval(p_business, p_approval, p_kind, p_for);
    v_by := a.approver_id;
  elsif v_old is not null then
    raise exception '%', format('%s is past its use-by: a manager approves selling it', v_old_name);
  else
    raise exception '%', format('Only %s %s of %s is in stock: a manager approves using more than that',
                                trim_scale(v_have), v_unit, v_name);
  end if;
  if v_name is not null then
    perform audit_event(p_business, 'stock.below_zero', 'stock', p_for, null, null,
      jsonb_build_object('items', v_names, 'approved_by', v_by));
  end if;
  if v_old is not null then
    perform audit_event(p_business, 'stock.expired_sold', 'stock', p_for, null, null,
      jsonb_build_object('items', v_old, 'rule', 'refuse', 'approved_by', v_by));
  end if;
  return v_by;
end $$;

-- -----------------------------------------------------------------------------
-- 7. The alerts: the café's warning time, and the deliveries' lots
-- -----------------------------------------------------------------------------
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0095;
create function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0095(p_business, p_now) c
   where c.rule <> 'use_by'
  union all
  select 'use_by'::text, lot.id::text,
         case when lot.use_by <= p_now then 'red' else 'orange' end,
         case when b.id is not null and lot.use_by <= p_now
              then format('%s, batch %s, is past its use-by: %s %s left', i.name, b.batch_no,
                          alert_qty(lot.left_base), i.base_unit_code)
              when b.id is not null
              then format('%s, batch %s, is to be used by %s: %s %s left', i.name, b.batch_no,
                          to_char(lot.use_by at time zone bz.timezone, 'DD Mon HH24:MI'), alert_qty(lot.left_base),
                          i.base_unit_code)
              when lot.use_by <= p_now
              then format('%s, delivered %s, is past its use-by: %s %s left', i.name,
                          to_char(coalesce(lot.received_at, lot.created_at) at time zone bz.timezone, 'DD Mon'),
                          alert_qty(lot.left_base), i.base_unit_code)
              else format('%s, delivered %s, is to be used by %s: %s %s left', i.name,
                          to_char(coalesce(lot.received_at, lot.created_at) at time zone bz.timezone, 'DD Mon'),
                          to_char(coalesce(lot.expiry_date, (lot.use_by at time zone bz.timezone)::date), 'DD Mon'),
                          alert_qty(lot.left_base), i.base_unit_code) end,
         case when lot.use_by <= p_now
              then 'Past its use-by it is not to be sold: what is left is a loss.'
              else 'What is not used by then is lost.' end,
         case when lot.use_by <= p_now
              then 'Record what is left as expired on Inventory, or change its use-by if it was set wrong.'
              when b.id is not null then 'Put it out before newer batches: sales take it first.'
              else 'Sell or use it first: sales take it before newer deliveries.' end,
         'high', case when b.id is not null then '/production#lots' else '/inventory#use-by' end,
         jsonb_build_object('lot_id', lot.id, 'batch_id', b.id, 'batch_no', b.batch_no, 'item_id', i.id,
                            'use_by', lot.use_by, 'left', lot.left_base)
    from item_lot lot
    join item i on i.id = lot.item_id
    join business bz on bz.id = lot.business_id
    left join production_batch b on b.id = lot.production_batch_id
   where lot.business_id = p_business and lot.left_base > 0 and lot.use_by is not null
     and lot.use_by <= p_now + use_by_lead(p_business)
$$;

-- -----------------------------------------------------------------------------
-- 8. A delivery's line knows its lot
-- -----------------------------------------------------------------------------
alter table goods_receipt_line add column if not exists lot_id uuid references item_lot (id);

-- -----------------------------------------------------------------------------
-- 9. Who may call what
-- -----------------------------------------------------------------------------
revoke execute on function rule_defaults_0097(uuid), rule_definitions(),
  rule_defaults(uuid), expand_variant_safe(uuid, sales_channel, numeric, date), use_by_lead(uuid),
  use_by_end_of(uuid, date), trg_item_keeps(), set_item_use_by__run(uuid, text, int), save_batch_recipe__run_0046(uuid, text, jsonb,
  numeric, text, jsonb, text, boolean, int), save_batch_recipe__run(uuid, text, jsonb, numeric, text, jsonb, text,
  boolean, int), receive_goods__run(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean, uuid),
  lot_sources(inventory_movement), set_lot_use_by__run(uuid, date, text), use_by_state(uuid, timestamptz, timestamptz),
  lot_standing(uuid, uuid, timestamptz), expired_takes(uuid, uuid, jsonb),
  stock_rules(uuid, uuid, jsonb, uuid, uuid, text, text, uuid), alert_conditions_0095(uuid, timestamptz),
  alert_conditions(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function set_item_use_by(uuid, text, int, uuid), set_lot_use_by(uuid, date, text, uuid),
  use_by_lots(uuid, boolean), pos_use_by(uuid) from public, anon;
grant execute on function set_item_use_by(uuid, text, int, uuid), set_lot_use_by(uuid, date, text, uuid),
  use_by_lots(uuid, boolean), pos_use_by(uuid) to authenticated;
