-- =============================================================================
-- 0069 — Ways to pay, each with its own account (round ten)
-- =============================================================================
-- The owner's answer, as chosen: the café takes the card machine, FIB,
-- FastPay, ZainCash and Qi Card, and "since we have different banks and
-- payments each stays in their account till they move it".
--
--  * Ways to pay. Besides cash and the card machine, the café adds its own on
--    Settings (FIB, FastPay, ZainCash, Qi Card, …), each named once. Each is
--    given an account of its own among the cash (1030 to 1089, named after
--    it), where what it takes stays until it is moved. A way to pay taken out
--    of use is no longer offered at the till; its account keeps what it holds.
--  * At the till, a payment by one of them is a payment of its own (the tender
--    'other', with the way to pay), alone or as a part of a split, with the
--    reference the app or the bank showed, if any. Its account is debited
--    with what it took. A refund gives back to the way it was paid and
--    credits its account. The card machine stays the card (1010, settled to
--    the bank as before).
--  * Money moved: out of a way to pay's account to the bank, the safe or
--    another way to pay, or into one from the bank or the safe; with what the
--    bank or the app kept, its fee (6500); or a charge alone. Each move is one
--    journal, and is cancelled with why (its journal reversed). The safe's
--    tie-out counts what was moved in and out of it.
--  * The balance sheet and the cash-flow statement count the ways to pay's
--    accounts as cash. The reports read what each way to pay took, gave back,
--    was charged and holds; the end of the day, what each took since the
--    drawer was counted.
--
-- Nothing changes for a sale paid in cash or by card, nor for a till loaded
-- before this: it offers cash and the card, as it did.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. What is kept
-- -----------------------------------------------------------------------------
create table if not exists payment_method (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  name         text not null,
  -- Its account, among the cash: what it takes stays there until it is moved.
  account_code text not null,
  position     int not null default 0,
  is_active    boolean not null default true,
  created_by   uuid references app_user (id),
  created_at   timestamptz not null default now(),
  constraint payment_method_name check (length(trim(name)) between 1 and 40),
  constraint payment_method_account check (account_code ~ '^10[3-8][0-9]$'),
  unique (business_id, account_code)
);
create unique index if not exists payment_method_named_once on payment_method (business_id, lower(name));

-- Everyone at the café reads the ways to pay (the till offers them); only the
-- functions below write them.
alter table payment_method enable row level security;
alter table payment_method force row level security;
drop policy if exists member_read on payment_method;
create policy member_read on payment_method for select to authenticated
  using (business_id = (select current_business_id()));
grant select on payment_method to authenticated;

-- A payment, and a refund's part, by one of them says which; a payment by a
-- card or one of them may carry the reference the machine, the app or the
-- bank showed.
alter table sales_tender add column if not exists payment_method_id uuid references payment_method (id);
alter table sales_tender add column if not exists reference text;
alter table sales_tender drop constraint if exists sales_tender_method_check;
alter table sales_tender add constraint sales_tender_method_check check (
  (tender_type = 'other') = (payment_method_id is not null)
  and (reference is null or (tender_type in ('card', 'other') and length(reference) between 1 and 60)));
create index if not exists sales_tender_by_method on sales_tender (payment_method_id) where payment_method_id is not null;
alter table sale_refund_tender add column if not exists payment_method_id uuid references payment_method (id);
alter table sale_refund_tender drop constraint if exists sale_refund_tender_method_check;
alter table sale_refund_tender add constraint sale_refund_tender_method_check check (
  (tender_type = 'other') = (payment_method_id is not null));

-- Money moved between a way to pay's account and the bank, the safe or
-- another's, and the charges taken from one.
create table if not exists money_move (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business (id) on delete cascade,
  from_code        text not null,
  to_code          text,                       -- none: a charge alone
  amount           numeric not null,           -- what reached where it went
  fee              numeric not null default 0, -- what the bank or the app kept (6500)
  moved_on         date not null,
  reference        text,
  note             text,
  journal_entry_id uuid references journal_entry (id),
  created_by       uuid references app_user (id),
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz,
  cancelled_by     uuid references app_user (id),
  cancel_reason    text,
  constraint money_move_amounts check (amount >= 0 and fee >= 0 and amount + fee > 0),
  constraint money_move_places check ((to_code is null) = (amount = 0) and to_code is distinct from from_code)
);
create index if not exists money_move_recent on money_move (business_id, moved_on desc, created_at desc);
alter table money_move enable row level security;
alter table money_move force row level security;
revoke all on money_move from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. A way to pay's account, and where money is moved
-- -----------------------------------------------------------------------------
-- The first code free for a new way to pay's account: 1030 to 1089.
create or replace function payment_method_free_code(p_business uuid) returns text
language sql stable set search_path = public as $$
  select min(c)::text from generate_series(1030, 1089) c
   where not exists (select 1 from gl_account a where a.business_id = p_business and a.code = c::text)
$$;

-- Where money may be moved from or to: a way to pay's account, the bank or the safe.
create or replace function money_place(p_business uuid, p_code text) returns boolean
language sql stable set search_path = public as $$
  select p_code in ('1020', '1005')
         or exists (select 1 from payment_method m where m.business_id = p_business and m.account_code = p_code)
$$;

-- -----------------------------------------------------------------------------
-- 3. The café's ways to pay
-- -----------------------------------------------------------------------------
-- In their order, for the till, Settings and the reports. Each says the
-- account its money is kept in.
create or replace function payment_methods() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'settings.manage', 'cost.view', 'accounting.post', 'day.close');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'account', m.account_code,
                                        'position', m.position, 'active', m.is_active)
                     order by m.position, lower(m.name))
      from payment_method m where m.business_id = v_business), '[]'::jsonb);
end $$;

-- A new way to pay (p_method null), with an account of its own, or one
-- renamed, put in another place in the list, taken out of use or brought back.
-- Its account is renamed with it.
create or replace function save_payment_method__run(p_method uuid, p_name text, p_active boolean, p_position int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_me uuid := (current_member()).id;
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  m payment_method; v_before payment_method; v_code text;
begin
  if length(v_name) = 0 or length(v_name) > 40 then
    raise exception 'Name the way to pay, in 40 letters at most';
  end if;
  if p_position is not null and (p_position < 0 or p_position > 1000) then
    raise exception 'The ways to pay cannot be read';
  end if;
  perform pg_advisory_xact_lock(hashtext('payment_method:' || v_business::text));
  if exists (select 1 from payment_method x where x.business_id = v_business and lower(x.name) = lower(v_name)
                                             and x.id is distinct from p_method) then
    raise exception 'There is already a way to pay called %', v_name;
  end if;
  if p_method is null then
    v_code := payment_method_free_code(v_business);
    if v_code is null then raise exception 'The café has 60 ways to pay already: take one out of use'; end if;
    insert into gl_account (business_id, code, name, account_type, normal_balance, is_system)
    values (v_business, v_code, v_name, 'asset', 'debit', true);
    insert into payment_method (business_id, name, account_code, position, is_active, created_by)
    values (v_business, v_name, v_code,
            coalesce(p_position, (select coalesce(max(x.position), 0) + 1 from payment_method x
                                   where x.business_id = v_business)),
            coalesce(p_active, true), v_me)
    returning * into m;
    perform audit_event(v_business, 'payment_method.add', 'payment_method', m.id::text, null, null,
      jsonb_build_object('name', m.name, 'account', m.account_code, 'active', m.is_active));
  else
    select * into v_before from payment_method where id = p_method and business_id = v_business for update;
    if not found then raise exception 'That way to pay is not one of the café''s'; end if;
    update payment_method
       set name = v_name, is_active = coalesce(p_active, is_active), position = coalesce(p_position, position)
     where id = p_method
    returning * into m;
    update gl_account set name = v_name where business_id = v_business and code = m.account_code and name <> v_name;
    if (m.name, m.is_active, m.position) is distinct from (v_before.name, v_before.is_active, v_before.position) then
      perform audit_event(v_business, 'payment_method.change', 'payment_method', m.id::text, null,
        jsonb_build_object('name', v_before.name, 'active', v_before.is_active, 'position', v_before.position),
        jsonb_build_object('name', m.name, 'active', m.is_active, 'position', m.position));
    end if;
  end if;
  return jsonb_build_object('id', m.id, 'name', m.name, 'account', m.account_code, 'position', m.position,
                            'active', m.is_active);
end $$;

create or replace function save_payment_method(p_method uuid, p_name text, p_active boolean default null,
                                               p_position int default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_method', p_method, 'p_name', p_name, 'p_active', p_active,
                                    'p_position', p_position);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_payment_method', v_req);
  if v is not null then return v; end if;
  v := save_payment_method__run(p_method => p_method, p_name => p_name, p_active => p_active, p_position => p_position);
  perform idem_finish(v_business, p_idempotency_key, 'save_payment_method', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 4. A sale paid by one of them
-- -----------------------------------------------------------------------------
-- 0043's sale_payments, with a payment by one of the café's ways to pay:
-- {type: 'other', method, amount, reference}, the way to pay one of the
-- café's; and a reference for a payment by a card or one of them. Each such
-- payment carries its account.
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
         or coalesce(jsonb_typeof(x -> 'reference'), 'null') not in ('string', 'null') then
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
      if x ->> 'type' = 'other' then
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

-- A new sale's ways to pay are in use: one taken out of use takes no more
-- (a sale sent again with its key is the sale already recorded).
create or replace function sale_methods_in_use(p_business uuid, p_pay jsonb) returns void
language plpgsql stable set search_path = public as $$
declare v_name text;
begin
  select m.name into v_name
    from jsonb_array_elements(p_pay) x join payment_method m on m.id = (x ->> 'method')::uuid
   where x ->> 'method' is not null and m.business_id = p_business and not m.is_active
   limit 1;
  if v_name is not null then
    raise exception '% is no longer taken: choose another way to pay', v_name;
  end if;
end $$;

-- 0055's post_sale: a payment by one of the café's ways to pay is recorded as
-- such, and debited to its account; one taken out of use takes no new sale.
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
  v_today := business_local_date(v_business, now());

  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
                           gross_amount, discount_amount, net_amount, cogs_amount, cashier_id,
                           customer_id, customer_address_id, delivery_address)
  values (v_business, v_location, p_channel, 'open', p_idempotency_key, 0, 0, 0, 0, v_me,
          (p_customer ->> 'customer_id')::uuid, (p_customer ->> 'address_id')::uuid, p_customer ->> 'address')
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
  v_journal := post_journal(v_business, now(), 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
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

-- 0043's order_payments, with the way to pay of a payment by one of the
-- café's, and the reference shown.
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
                            order by t.position, t.id), '[]'::jsonb)
    from sales_tender t left join payment_method m on m.id = t.payment_method_id
   where t.sales_order_id = p_order
$$;

-- -----------------------------------------------------------------------------
-- 5. Given back the way it was paid
-- -----------------------------------------------------------------------------
-- 0042's refundable_payments, by the way to pay too: what is left of each way
-- a sale was paid, FIB apart from FastPay. Its columns change, so it is made
-- again; only refund_lines_internal reads it.
drop function if exists refundable_payments(uuid);
create or replace function refundable_payments(p_order uuid)
returns table (tender_type tender_type, method uuid, paid numeric, refunded numeric, left_amount numeric)
language sql stable set search_path = public as $$
  with p as (
    select st.tender_type, st.payment_method_id as method, min(st.position) as pos, sum(st.amount) as paid
      from sales_tender st where st.sales_order_id = p_order group by st.tender_type, st.payment_method_id
  ), b as (
    select rt.tender_type, rt.payment_method_id as method, sum(rt.amount) as back
      from sale_refund r join sale_refund_tender rt on rt.refund_id = r.id
     where r.sales_order_id = p_order group by rt.tender_type, rt.payment_method_id
  ), old as (
    select coalesce(sum(a.amount), 0) as back from sale_adjustment a
     where a.sales_order_id = p_order and a.kind = 'refund'
       and not exists (select 1 from sale_refund r where r.id = a.id)
  )
  select p.tender_type, p.method, p.paid,
         coalesce(b.back, 0) + case when p.pos = (select min(pos) from p) then (select back from old) else 0 end,
         p.paid - coalesce(b.back, 0)
                - case when p.pos = (select min(pos) from p) then (select back from old) else 0 end
    from p left join b on b.tender_type = p.tender_type and b.method is not distinct from p.method
   order by p.pos, p.tender_type
$$;

-- 0042's refund_lines_internal, by the way to pay too (0069): p_tenders names
-- one of the café's ways to pay as {type: 'other', method, amount}; the
-- money goes back to the way it was paid, and its account is credited.
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
  v_types tender_type[]; v_methods uuid[]; v_lefts numeric[]; v_parts numeric[]; v_left_total numeric; pt jsonb;
  i int;
  v_back jsonb := '[]';
begin
  select * into o from sales_order where id = p_order and business_id = p_business for update;
  if not found then raise exception 'Sale not found'; end if;
  if o.status = 'refunded' then raise exception 'This sale has been refunded in full already'; end if;
  if o.status = 'voided' then raise exception 'This sale was voided: there is nothing to refund'; end if;
  if o.status not in ('completed', 'partially_refunded') then
    raise exception 'Only a completed sale can be refunded; this one is %', o.status;
  end if;
  select array_agg(rp.tender_type order by rp.ord), array_agg(rp.method order by rp.ord),
         array_agg(rp.left_amount order by rp.ord), sum(rp.paid)
    into v_types, v_methods, v_lefts, v_paid
    from refundable_payments(p_order) with ordinality rp(tender_type, method, paid, refunded, left_amount, ord);
  if v_types is null or exists (select 1 from unnest(v_types, v_methods) u(t, m)
                                 where tender_account(u.t) is null and u.m is null) then
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
                                   and (coalesce(x ->> 'type', '') in ('cash', 'card', 'platform_paid')
                                          and x ->> 'method' is null
                                        or x ->> 'type' = 'other' and jsonb_typeof(x -> 'method') = 'string'
                                           and x ->> 'method'
                                               ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
                              then (x ->> 'amount')::numeric <= 0
                                   or (x ->> 'amount')::numeric <> money_round(p_business, (x ->> 'amount')::numeric)
                              else true end) then
      raise exception 'The payments to give back cannot be read';
    end if;
    if (select count(*) from jsonb_array_elements(p_tenders)) <>
       (select count(distinct (x ->> 'type') || ':' || coalesce(lower(x ->> 'method'), ''))
          from jsonb_array_elements(p_tenders) x) then
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
      -- The way it was paid: its type, and for a way to pay, which (0069).
      select u.ord into i from unnest(v_types, v_methods) with ordinality u(t, m, ord)
       where u.t = (pt ->> 'type')::tender_type and u.m is not distinct from (pt ->> 'method')::uuid;
      if i is null or (pt ->> 'amount')::numeric > v_lefts[i] then
        if pt ->> 'type' = 'cash' then
          raise exception 'Only % of the cash paid is left to give back', trim_scale(coalesce(v_lefts[i], 0));
        elsif pt ->> 'type' = 'card' then
          raise exception 'Only % of the card payment is left to give back', trim_scale(coalesce(v_lefts[i], 0));
        elsif pt ->> 'type' = 'other' then
          if i is null then raise exception 'This sale was not paid that way'; end if;
          raise exception 'Only % of what % took is left to give back', trim_scale(v_lefts[i]),
            (select m.name from payment_method m where m.id = v_methods[i]);
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
      v_back := v_back || (jsonb_build_object('type', v_types[i], 'amount', v_parts[i])
                           || case when v_methods[i] is not null
                                   then jsonb_build_object('method', v_methods[i], 'method_name',
                                          (select m.name from payment_method m where m.id = v_methods[i]))
                                   else '{}'::jsonb end);
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
    || coalesce((select jsonb_agg(jsonb_build_object('code',
                                    coalesce((select m.account_code from payment_method m
                                               where m.id = (b ->> 'method')::uuid),
                                             tender_account((b ->> 'type')::tender_type)),
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
    insert into sale_refund_tender (business_id, refund_id, tender_type, amount, payment_method_id)
    values (p_business, v_id, (p ->> 'type')::tender_type, (p ->> 'amount')::numeric, (p ->> 'method')::uuid);
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

-- -----------------------------------------------------------------------------
-- 6. Money moved
-- -----------------------------------------------------------------------------
-- Out of a way to pay's account to the bank, the safe or another way to pay,
-- or into one from the bank or the safe: p_amount is what arrived, p_fee what
-- the bank or the app kept (6500). No place to go (p_to null) is a charge
-- alone, the fee. A way to pay's account, and the safe, gives no more than it
-- holds; the bank is the bank's to say.
create or replace function move_money__run(p_from text, p_to text, p_amount numeric, p_fee numeric, p_on date,
                                           p_reference text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  v_from text := nullif(btrim(coalesce(p_from, '')), '');
  v_to text := nullif(btrim(coalesce(p_to, '')), '');
  v_amount numeric := money_round(v_business, coalesce(p_amount, 0));
  v_fee numeric := money_round(v_business, coalesce(p_fee, 0));
  v_today date := business_local_date(v_business, now());
  v_on date := coalesce(p_on, business_local_date(v_business, now()));
  v_ref text := nullif(regexp_replace(btrim(coalesce(p_reference, '')), '\s+', ' ', 'g'), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_held numeric; v_id uuid := gen_random_uuid(); v_journal uuid; v_from_name text; v_to_name text;
begin
  if v_from is null or not money_place(v_business, v_from) then
    raise exception 'Choose where the money is moved from';
  end if;
  if v_to is not null and (v_to = v_from or not money_place(v_business, v_to)) then
    raise exception 'Choose where the money goes: the bank, the safe or another way to pay';
  end if;
  if not exists (select 1 from payment_method m
                  where m.business_id = v_business and m.account_code in (v_from, coalesce(v_to, v_from))) then
    raise exception 'Money is moved out of a way to pay''s account, or into one';
  end if;
  if v_amount < 0 or v_fee < 0 then raise exception 'Enter amounts of 0 or more'; end if;
  if v_to is null then
    if v_amount <> 0 or v_fee <= 0 then
      raise exception 'A charge alone is what the bank or the app took: enter it as the fee';
    end if;
  elsif v_amount <= 0 then
    raise exception 'Enter how much arrived';
  end if;
  if v_on > v_today then raise exception 'Money is moved on a day up to today'; end if;
  if length(v_ref) > 60 then raise exception 'A reference is at most 60 letters'; end if;
  if length(v_note) > 300 then raise exception 'A note is at most 300 letters'; end if;

  perform pg_advisory_xact_lock(hashtext('money_move:' || v_business::text));
  select name into v_from_name from gl_account where business_id = v_business and code = v_from;
  select name into v_to_name from gl_account where business_id = v_business and code = v_to;
  if v_from <> '1020' then
    v_held := gl_balance_at(v_business, v_from, 'infinity');
    if v_amount + v_fee > v_held then
      if v_from = '1005' then
        raise exception 'The safe holds %: no more can be moved out of it', trim_scale(v_held);
      end if;
      raise exception '% holds %: no more can be moved out of it',
        (select m.name from payment_method m where m.business_id = v_business and m.account_code = v_from),
        trim_scale(v_held);
    end if;
  end if;

  v_journal := post_journal(v_business, (v_on + time '12:00') at time zone (select timezone from business where id = v_business),
    case when v_to is null then 'Charge taken by ' || v_from_name
         else 'Money moved from ' || v_from_name || ' to ' || v_to_name end || coalesce(': ' || v_ref, ''),
    'money_move', v_id,
    jsonb_build_array(signed_line('6500', v_fee), signed_line(v_from, -(v_amount + v_fee)))
    || case when v_to is not null then jsonb_build_array(signed_line(v_to, v_amount)) else '[]'::jsonb end,
    null, v_ref);
  insert into money_move (id, business_id, from_code, to_code, amount, fee, moved_on, reference, note,
                          journal_entry_id, created_by)
  values (v_id, v_business, v_from, v_to, v_amount, v_fee, v_on, v_ref, v_note, v_journal, v_me);
  perform audit_event(v_business, 'money.move', 'money_move', v_id::text, v_note, null,
    jsonb_build_object('from', v_from, 'to', v_to, 'amount', v_amount, 'fee', v_fee, 'on', v_on,
                       'reference', v_ref));
  return jsonb_build_object('move_id', v_id, 'from', v_from, 'to', v_to, 'amount', v_amount, 'fee', v_fee,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

create or replace function move_money(p_from text, p_to text, p_amount numeric, p_fee numeric default 0,
                                      p_on date default null, p_reference text default null,
                                      p_note text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_from', p_from, 'p_to', p_to, 'p_amount', p_amount, 'p_fee', p_fee,
                                    'p_on', p_on, 'p_reference', p_reference, 'p_note', p_note);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'move_money', v_req);
  if v is not null then return v; end if;
  v := move_money__run(p_from => p_from, p_to => p_to, p_amount => p_amount, p_fee => p_fee, p_on => p_on,
                       p_reference => p_reference, p_note => p_note);
  perform idem_finish(v_business, p_idempotency_key, 'move_money', v_req, v);
  return v;
end $$;

-- A move undone, with why: its journal reversed today.
create or replace function cancel_money_move__run(p_move uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  mv money_move; v_journal uuid;
begin
  perform pg_advisory_xact_lock(hashtext('money_move:' || v_business::text));
  select * into mv from money_move where id = p_move and business_id = v_business for update;
  if not found or mv.cancelled_at is not null then raise exception 'That move of money is not in force'; end if;
  if length(coalesce(v_reason, '')) < 3 then raise exception 'Say why it is cancelled'; end if;
  if length(v_reason) > 300 then raise exception 'A reason is at most 300 letters'; end if;
  v_journal := reverse_entry_internal(mv.journal_entry_id,
    (business_local_date(v_business, now()) + time '12:00') at time zone (select timezone from business where id = v_business),
    'Reversal: money move cancelled: ' || v_reason);
  update money_move set cancelled_at = now(), cancelled_by = (current_member()).id, cancel_reason = v_reason
   where id = p_move;
  perform audit_event(v_business, 'money.move_cancel', 'money_move', p_move::text, v_reason, null,
    jsonb_build_object('from', mv.from_code, 'to', mv.to_code, 'amount', mv.amount, 'fee', mv.fee,
                       'on', mv.moved_on));
  return jsonb_build_object('move_id', p_move, 'cancelled', true,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

create or replace function cancel_money_move(p_move uuid, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_move', p_move, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_money_move', v_req);
  if v is not null then return v; end if;
  v := cancel_money_move__run(p_move => p_move, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_money_move', v_req, v);
  return v;
end $$;

-- What each way to pay's account holds, and the bank and the safe, with the
-- moves of money most recent first (50).
create or replace function money_accounts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('accounting.post', 'cost.view');
begin
  return jsonb_build_object(
    'methods', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'account', m.account_code,
                                          'active', m.is_active,
                                          'balance', gl_balance_at(v_business, m.account_code, 'infinity'))
                       order by m.position, lower(m.name))
        from payment_method m where m.business_id = v_business), '[]'::jsonb),
    'bank', gl_balance_at(v_business, '1020', 'infinity'),
    'safe', gl_balance_at(v_business, '1005', 'infinity'),
    'moves', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'from', x.from_code, 'to', x.to_code, 'amount', x.amount, 'fee', x.fee,
               'on', x.moved_on, 'reference', x.reference, 'note', x.note,
               'journal_no', (select journal_no from journal_entry where id = x.journal_entry_id),
               'by', u.full_name, 'at', x.created_at, 'cancelled_at', x.cancelled_at,
               'cancel_reason', x.cancel_reason)
             order by x.moved_on desc, x.created_at desc)
        from (select * from money_move where business_id = v_business
               order by moved_on desc, created_at desc limit 50) x
        left join app_user u on u.id = x.created_by), '[]'::jsonb));
end $$;

-- 0061's checks, the safe's with what was moved in and out of it (and what a
-- cancelled move put back).
do $$
begin
  if to_regprocedure('public.reconciliation_checks_0061(uuid, date)') is null then
    alter function reconciliation_checks(uuid, date) rename to reconciliation_checks_0061;
  end if;
end $$;
revoke execute on function reconciliation_checks_0061(uuid, date) from public, anon, authenticated;
create or replace function reconciliation_checks(p_business uuid, p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable set search_path = public as $$
declare v_end timestamptz; v_moved numeric;
begin
  v_end := (local_day_bounds(p_business, p_as_of, p_as_of)).to_ts;
  select coalesce(sum(jl.debit - jl.credit), 0) into v_moved
    from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
   where e.business_id = p_business and e.status = 'published' and g.code = '1005' and e.occurred_at < v_end
     and (e.reference_type = 'money_move'
          or (e.reference_type = 'reversal'
              and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                            and o.reference_type = 'money_move')));
  return query
    select c.check_key, c.label,
           c.subledger + case when c.check_key = 'safe' then v_moved else 0 end,
           c.ledger,
           c.difference + case when c.check_key = 'safe' then v_moved else 0 end
      from reconciliation_checks_0061(p_business, p_as_of) c;
end $$;

-- -----------------------------------------------------------------------------
-- 7. What each way to pay took
-- -----------------------------------------------------------------------------
-- At a place since its drawer was last counted (as drawer_status reads the
-- card's): what each way to pay took and in how many payments, for the end
-- of the day, to be checked against the app's or the bank's own list.
create or replace function drawer_methods(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close', 'cost.view');
  v_location uuid; d record;
begin
  v_location := resolve_location(v_business, p_location);
  d := drawer_position(v_business, v_location);
  return coalesce((
    select jsonb_agg(jsonb_build_object('method', m.id, 'name', m.name, 'amount', x.amount, 'payments', x.n)
                     order by m.position, lower(m.name))
      from (select tn.payment_method_id as id, sum(tn.amount) as amount, count(*)::int as n
              from sales_order o join sales_tender tn on tn.sales_order_id = o.id
             where o.business_id = v_business and o.location_id = v_location and o.status <> 'voided'
               and tn.payment_method_id is not null
               and (d.last_count_at is null or o.created_at > d.last_count_at)
             group by 1) x
      join payment_method m on m.id = x.id), '[]'::jsonb);
end $$;

-- Each way to pay (cost.view) in the dates, at a place or the whole café: the
-- sales it paid for, voids left out, and what it took of them; what refunds
-- made in the dates gave back by it; and, for the whole café, what moves of
-- money in the dates took out of its account and the fees they paid, and what
-- its account held at the end of the dates. One in use is listed though it
-- took nothing.
create or replace function report_payment_methods(p_from date, p_to date, p_location uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  b := local_day_bounds(v_business, p_from, p_to);
  return coalesce((
    with t as (
      select st.payment_method_id as id, count(distinct o.id) as n, sum(st.amount) as amt
        from sales_order o join sales_tender st on st.sales_order_id = o.id
       where o.business_id = v_business and o.status not in ('voided', 'open') and st.payment_method_id is not null
         and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
         and (v_loc is null or o.location_id = v_loc)
       group by 1
    ), r as (
      select rt.payment_method_id as id, sum(rt.amount) as back
        from sale_refund rf join sale_refund_tender rt on rt.refund_id = rf.id
       where rf.business_id = v_business and rt.payment_method_id is not null
         and rf.created_at >= b.from_ts and rf.created_at < b.to_ts
         and (v_loc is null or rf.location_id = v_loc)
       group by 1
    ), f as (
      select mv.from_code as code, sum(mv.amount) as moved, sum(mv.fee) as fees
        from money_move mv
       where mv.business_id = v_business and mv.cancelled_at is null and mv.moved_on between p_from and p_to
       group by 1
    )
    select jsonb_agg(jsonb_build_object(
             'method', m.id, 'name', m.name, 'account', m.account_code, 'active', m.is_active,
             'sales', coalesce(t.n, 0), 'taken', coalesce(t.amt, 0), 'refunded', coalesce(r.back, 0),
             'net', coalesce(t.amt, 0) - coalesce(r.back, 0))
           || case when v_loc is null
                   then jsonb_build_object('moved_out', coalesce(f.moved, 0), 'fees', coalesce(f.fees, 0),
                                           'balance', gl_balance_at(v_business, m.account_code, b.to_ts))
                   else '{}'::jsonb end
           order by m.position, lower(m.name))
      from payment_method m
      left join t on t.id = m.id left join r on r.id = m.id left join f on f.code = m.account_code
     where m.business_id = v_business and (m.is_active or t.id is not null or r.id is not null or f.code is not null)
  ), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 8. The statements
-- -----------------------------------------------------------------------------
-- 0052's lines, the ways to pay's accounts (1030 to 1089) among the cash.
create or replace function cash_flow_line(p_code text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_code in ('1000', '1001', '1005', '1006', '1020') or p_code ~ '^10[3-8][0-9]$' then 'cash'
    when p_code like '15%' then 'equipment'
    when p_code like '3%' then 'owner'
    when p_code = '6950' then 'exchange'
    when p_code = '6300' then 'counts'
    when p_code like '4%' or p_code in ('1010', '1100', '5100', '5200', '6500') then 'sales'
    when p_code like '12%' or p_code in ('2000', '2050') or p_code like '5%' then 'stock'
    when p_code in ('1300', '2100') or p_code like '61%' then 'staff'
    else 'running'
  end
$$;

-- 0060's hints, and a move of money's: cancelled on Money.
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
    when 'payroll_approval' then 'a payroll''s approval (reopen the payroll on Payroll while nothing is paid from it)'
    when 'employee_advance' then 'an advance to someone who works here (cancel it on Payroll)'
    when 'salary_payment' then 'a salary payment (cancel it on Payroll)'
    when 'stock_transfer' then 'stock sent to another place (cancel the transfer on Inventory while it is on its way)'
    when 'stock_transfer_receipt' then 'stock received from another place'
    when 'stock_transfer_cancel' then 'a transfer cancelled on its way'
    when 'prepaid_expense' then 'a prepaid expense (cancel it on Expenses)'
    when 'money_move' then 'a move of money (cancel it on Money)'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- -----------------------------------------------------------------------------
-- 9. Who may call what
-- -----------------------------------------------------------------------------
revoke execute on function
  payment_method_free_code(uuid), money_place(uuid, text), sale_methods_in_use(uuid, jsonb),
  refundable_payments(uuid), save_payment_method__run(uuid, text, boolean, int),
  move_money__run(text, text, numeric, numeric, date, text, text), cancel_money_move__run(uuid, text),
  reconciliation_checks(uuid, date)
from public, anon, authenticated;

revoke execute on function
  payment_methods(), save_payment_method(uuid, text, boolean, int, uuid),
  move_money(text, text, numeric, numeric, date, text, text, uuid), cancel_money_move(uuid, text, uuid),
  money_accounts(), drawer_methods(uuid), report_payment_methods(date, date, uuid)
from public, anon;
grant execute on function
  payment_methods(), save_payment_method(uuid, text, boolean, int, uuid),
  move_money(text, text, numeric, numeric, date, text, text, uuid), cancel_money_move(uuid, text, uuid),
  money_accounts(), drawer_methods(uuid), report_payment_methods(date, date, uuid)
to authenticated;
