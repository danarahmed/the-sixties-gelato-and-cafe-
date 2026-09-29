-- =============================================================================
-- 0050 — Customers and loyalty (release X)
--
-- A customer was a name typed on a bill (pos_tab.label), kept nowhere else
-- (docs/COMPLETION_PLAN.md, B19).
--   * A customer: a name, a phone number kept one way (0770 123 4567, +964 770
--     123 4567 and ٠٧٧٠١٢٣٤٥٦٧ are one number, and one customer), notes, and
--     addresses for the café's own deliveries. Found at the till by their
--     number, added there, and listed on Customers with what they bought.
--   * On a sale: the till attaches the customer to a bill or a sale; a delivery
--     by the café's own driver (direct_delivery) needs the customer and their
--     address, kept on the sale as it was.
--   * Loyalty (decision 12): a point for every 1,000 IQD a sale comes to, once
--     it is paid; 100 points are a reward of 5,000 IQD off, taken at the till as
--     the bill's discount (Dr 4100, "Loyalty reward"): no liability is kept
--     (the report shows the points outstanding). A void takes back what the
--     sale earned and gives back what it spent; a refund does so in proportion.
--     Points given or taken by hand need loyalty.adjust and a reason. The rules
--     are on Settings, and loyalty can be turned off there.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Who may
-- ---------------------------------------------------------------------------
-- customer.edit: a customer added, their details and addresses changed (those
-- who take orders, and the managers); customer.view: the customers, what each
-- bought and their points, and the loyalty report; loyalty.adjust: points given
-- or taken by hand, with why.
insert into role_permission (role, permission)
select r::app_role, p from (values
  ('owner','customer.edit'),('general_manager','customer.edit'),('branch_manager','customer.edit'),
  ('cashier','customer.edit'),('barista','customer.edit'),
  ('owner','customer.view'),('general_manager','customer.view'),('branch_manager','customer.view'),
  ('accountant','customer.view'),('auditor','customer.view'),
  ('owner','loyalty.adjust'),('general_manager','loyalty.adjust'),('branch_manager','loyalty.adjust')
) as v(r, p)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. The rules: loyalty on or off, a point for every so many dinars, and the
--    reward (decision 12)
-- ---------------------------------------------------------------------------
create or replace function rule_definitions() returns jsonb
language sql immutable set search_path = public as $$
  select '{
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
                              "label": "A reward is worth"}
  }'::jsonb
$$;

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
$$;


-- A loyalty rule's number; loyalty_is_on, the switch.
create or replace function loyalty_rule(p_business uuid, p_key text) returns numeric
language sql stable set search_path = public as $$
  select (rule_value(p_business, p_key) #>> '{}')::numeric
$$;

create or replace function loyalty_is_on(p_business uuid) returns boolean
language sql stable set search_path = public as $$
  select coalesce(rule_value(p_business, 'loyalty') #>> '{}', 'on') = 'on'
$$;

-- ---------------------------------------------------------------------------
-- 3. A phone number, as the café keeps it
-- ---------------------------------------------------------------------------
-- Typed in any digits (Arabic-Indic and Persian too), with or without spaces,
-- dashes, the country code or its 00: kept as +964…, so 0770 123 4567,
-- +964 770 123 4567 and ٠٧٧٠١٢٣٤٥٦٧ are one number. Null: not a number.
create or replace function normalise_phone(p_phone text) returns text
language plpgsql immutable set search_path = public as $$
declare v text;
begin
  v := translate(coalesce(p_phone, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  v := regexp_replace(v, '[[:space:]()./-]', '', 'g');
  if v = '' then return null; end if;
  if v ~ '^00' then v := '+' || substr(v, 3); end if;
  if v ~ '^\+' then
    null;
  elsif v ~ '^964' then
    v := '+' || v;
  elsif v ~ '^0' then
    v := '+964' || substr(v, 2);
  elsif v ~ '^7[0-9]{9}$' then
    v := '+964' || v;
  else
    return null;
  end if;
  if v !~ '^\+[1-9][0-9]{7,14}$' then return null; end if;
  -- An Iraqi number: a mobile (7 and nine digits) or a landline with its area code.
  if v ~ '^\+964' and v !~ '^\+964[1-9][0-9]{7,9}$' then return null; end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Customers and their addresses
-- ---------------------------------------------------------------------------
create table if not exists customer (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  full_name    text not null,
  phone        text not null,
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references app_user (id),
  constraint customer_name check (length(trim(full_name)) between 1 and 80),
  constraint customer_phone check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint customer_notes check (notes is null or length(notes) <= 500),
  constraint customer_phone_once unique (business_id, phone)
);
create index if not exists customer_name on customer (business_id, lower(full_name));

create table if not exists customer_address (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  customer_id  uuid not null references customer (id) on delete cascade,
  label        text,
  address      text not null,
  directions   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references app_user (id),
  constraint customer_address_text check (length(trim(address)) between 1 and 300),
  constraint customer_address_label check (label is null or length(label) <= 40),
  constraint customer_address_directions check (directions is null or length(directions) <= 300)
);
create index if not exists customer_address_customer on customer_address (customer_id);

-- ---------------------------------------------------------------------------
-- 5. Points, and the customer on a bill and a sale
-- ---------------------------------------------------------------------------
-- Every point a customer earns or spends is a row, never changed: earned on a
-- sale (at the rule's rate then), spent on a reward, taken back or given back
-- when the sale is voided or refunded, or given or taken by hand with why. A
-- customer's points are the sum.
create table if not exists loyalty_ledger (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references business (id) on delete cascade,
  customer_id     uuid not null references customer (id),
  kind            text not null,
  points          integer not null,
  -- earn: the dinars that earned a point; redeem: what the reward took off.
  rate            numeric,
  value           numeric,
  sales_order_id  uuid references sales_order (id),
  sale_refund_id  uuid references sale_refund (id),
  reason          text,
  created_at      timestamptz not null default now(),
  created_by      uuid references app_user (id),
  constraint loyalty_kind check (kind in ('earn', 'redeem', 'earn_back', 'redeem_back', 'adjust')),
  constraint loyalty_points_sign check (
    points <> 0
    and (kind not in ('earn', 'redeem_back') or points > 0)
    and (kind not in ('redeem', 'earn_back') or points < 0)),
  constraint loyalty_source check (
    (kind = 'adjust' and sales_order_id is null and sale_refund_id is null and reason is not null)
    or (kind in ('earn', 'redeem') and sales_order_id is not null and sale_refund_id is null)
    or (kind in ('earn_back', 'redeem_back') and sales_order_id is not null)),
  constraint loyalty_earn_rate check (kind <> 'earn' or rate > 0),
  constraint loyalty_redeem_value check (kind <> 'redeem' or value > 0)
);
create index if not exists loyalty_ledger_customer on loyalty_ledger (customer_id, created_at);
-- Once per sale: what it earned, what it spent, and what its void took and gave back;
-- once per refund, what the refund did.
create unique index if not exists loyalty_ledger_once_per_sale on loyalty_ledger (sales_order_id, kind)
  where sales_order_id is not null and sale_refund_id is null;
create unique index if not exists loyalty_ledger_once_per_refund on loyalty_ledger (sale_refund_id, kind)
  where sale_refund_id is not null;

drop trigger if exists loyalty_ledger_immutable on loyalty_ledger;
create trigger loyalty_ledger_immutable
  before update or delete on loyalty_ledger
  for each row execute function forbid_mutation();

-- The customer on a bill, and the address a delivery goes to as it was when
-- the bill was saved; the same on the sale.
alter table pos_tab add column if not exists customer_id uuid references customer (id);
alter table pos_tab add column if not exists customer_address_id uuid references customer_address (id);
alter table pos_tab add column if not exists delivery_address text;
alter table sales_order add column if not exists customer_id uuid references customer (id);
alter table sales_order add column if not exists customer_address_id uuid references customer_address (id);
alter table sales_order add column if not exists delivery_address text;
create index if not exists sales_order_customer on sales_order (customer_id, placed_at) where customer_id is not null;

create or replace function customer_points(p_customer uuid) returns integer
language sql stable set search_path = public as $$
  select coalesce(sum(points), 0)::integer from loyalty_ledger where customer_id = p_customer
$$;

-- ---------------------------------------------------------------------------
-- 6. A customer added or changed; an address added, changed or put away
-- ---------------------------------------------------------------------------
create or replace function customer_of(p_business uuid, p_customer uuid, p_lock boolean default false)
returns customer language plpgsql set search_path = public as $$
declare c customer;
begin
  if p_lock then
    select * into c from customer where id = p_customer and business_id = p_business for update;
  else
    select * into c from customer where id = p_customer and business_id = p_business;
  end if;
  if c.id is null then raise exception 'Customer not found'; end if;
  return c;
end $$;

create or replace function save_customer__run(p_customer uuid, p_name text, p_phone text, p_notes text,
                                              p_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('customer.edit');
  v_me uuid := (current_member()).id;
  v_name text := nullif(trim(p_name), '');
  v_phone text := normalise_phone(p_phone);
  v_notes text := nullif(trim(p_notes), '');
  c customer; v_other customer; v_id uuid; v_before jsonb;
begin
  if v_name is null then raise exception 'Type the customer''s name'; end if;
  if length(v_name) > 80 then raise exception 'A name is at most 80 letters'; end if;
  if nullif(trim(p_phone), '') is null then raise exception 'Type the customer''s phone number'; end if;
  if v_phone is null then raise exception 'That is not a phone number: type it as 0770 123 4567'; end if;
  if length(coalesce(v_notes, '')) > 500 then raise exception 'Notes are at most 500 letters'; end if;
  select * into v_other from customer
   where business_id = v_business and phone = v_phone and id is distinct from p_customer;
  if v_other.id is not null then
    raise exception 'That number is %''s already', v_other.full_name;
  end if;
  if p_customer is null then
    insert into customer (business_id, full_name, phone, notes, created_by)
    values (v_business, v_name, v_phone, v_notes, v_me)
    returning id into v_id;
  else
    -- Put away (a customer twice over, or one who asked to be): kept with what
    -- they bought, but no longer put on a sale; and brought back.
    c := customer_of(v_business, p_customer, true);
    v_id := c.id;
    v_before := jsonb_build_object('name', c.full_name, 'phone', c.phone, 'customer_notes', c.notes,
                                   'kept_as_customer', c.is_active);
    update customer set full_name = v_name, phone = v_phone, notes = v_notes, is_active = coalesce(p_active, true)
     where id = c.id;
  end if;
  return jsonb_build_object('customer_id', v_id, 'phone', v_phone, 'before', v_before,
                            'after', jsonb_build_object('name', v_name, 'phone', v_phone, 'customer_notes', v_notes,
                                                        'kept_as_customer',
                                                        p_customer is null or coalesce(p_active, true)));
end $$;

create or replace function save_customer(p_customer uuid, p_name text, p_phone text, p_notes text default null,
                                         p_active boolean default true, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_customer', p_customer, 'p_name', p_name, 'p_phone', p_phone,
                                    'p_notes', p_notes, 'p_active', p_active);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_customer', v_req);
  if v is not null then return v; end if;
  v := save_customer__run(p_customer => p_customer, p_name => p_name, p_phone => p_phone, p_notes => p_notes,
                          p_active => p_active);
  perform audit_event(v_business, 'customer.save', 'customer', v ->> 'customer_id', null, v -> 'before', v -> 'after');
  v := jsonb_build_object('customer_id', v -> 'customer_id', 'phone', v -> 'phone');
  perform idem_finish(v_business, p_idempotency_key, 'save_customer', v_req, v);
  return v;
end $$;

-- An address: added (no id), changed, or put away (p_active false), never deleted:
-- an order delivered to it keeps what it said.
create or replace function save_customer_address__run(p_customer uuid, p_address uuid, p_label text,
                                                      p_text text, p_directions text, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('customer.edit');
  v_me uuid := (current_member()).id;
  c customer; a customer_address; v_id uuid; v_before jsonb;
  v_text text := nullif(trim(p_text), ''); v_label text := nullif(trim(p_label), '');
  v_directions text := nullif(trim(p_directions), '');
begin
  c := customer_of(v_business, p_customer, true);
  if coalesce(p_active, true) then
    if v_text is null then raise exception 'Type the address'; end if;
    if length(v_text) > 300 then raise exception 'An address is at most 300 letters'; end if;
    if length(coalesce(v_label, '')) > 40 then raise exception 'A name for the address is at most 40 letters'; end if;
    if length(coalesce(v_directions, '')) > 300 then raise exception 'Directions are at most 300 letters'; end if;
  end if;
  if p_address is null then
    if not coalesce(p_active, true) then raise exception 'Address not found'; end if;
    if (select count(*) from customer_address where customer_id = c.id and is_active) >= 10 then
      raise exception 'A customer keeps at most 10 addresses: put one away first';
    end if;
    insert into customer_address (business_id, customer_id, label, address, directions, created_by)
    values (v_business, c.id, v_label, v_text, v_directions, v_me)
    returning id into v_id;
  else
    select * into a from customer_address where id = p_address and customer_id = c.id for update;
    if a.id is null then raise exception 'Address not found'; end if;
    v_id := a.id;
    v_before := jsonb_build_object('customer', c.full_name, 'label', a.label, 'address', a.address,
                                   'directions', a.directions)
                || case when a.is_active then '{}'::jsonb else jsonb_build_object('put_away', true) end;
    if coalesce(p_active, true) then
      update customer_address set label = v_label, address = v_text, directions = v_directions, is_active = true
       where id = a.id;
    else
      update customer_address set is_active = false where id = a.id;
    end if;
  end if;
  return jsonb_build_object('customer_id', c.id, 'address_id', v_id, 'before', v_before,
    'after', case when coalesce(p_active, true)
                  then jsonb_build_object('customer', c.full_name, 'label', v_label, 'address', v_text,
                                          'directions', v_directions)
                  else (v_before - 'put_away') || jsonb_build_object('put_away', true) end);
end $$;

create or replace function save_customer_address(p_customer uuid, p_address uuid, p_label text, p_text text,
                                                 p_directions text default null, p_active boolean default true,
                                                 p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_customer', p_customer, 'p_address', p_address, 'p_label', p_label,
                                    'p_text', p_text, 'p_directions', p_directions, 'p_active', p_active);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_customer_address', v_req);
  if v is not null then return v; end if;
  v := save_customer_address__run(p_customer => p_customer, p_address => p_address, p_label => p_label,
                                  p_text => p_text, p_directions => p_directions, p_active => p_active);
  perform audit_event(v_business, 'customer.address', 'customer', v ->> 'customer_id', null,
                      v -> 'before', v -> 'after');
  v := jsonb_build_object('customer_id', v -> 'customer_id', 'address_id', v -> 'address_id');
  perform idem_finish(v_business, p_idempotency_key, 'save_customer_address', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 7. The customer at the till
-- ---------------------------------------------------------------------------
-- What the till shows of a customer: who they are, their points and the
-- rewards they come to, and where a delivery can go.
create or replace function customer_card(p_business uuid, c customer) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.full_name, 'phone', c.phone, 'notes', c.notes, 'active', c.is_active,
    'points', customer_points(c.id),
    'rewards', case when loyalty_is_on(p_business)
                    then floor(greatest(customer_points(c.id), 0) / loyalty_rule(p_business, 'loyalty_reward_points'))
                    else 0 end,
    'reward_points', loyalty_rule(p_business, 'loyalty_reward_points'),
    'reward_value', loyalty_rule(p_business, 'loyalty_reward_value'),
    'loyalty', loyalty_is_on(p_business),
    'addresses', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'label', a.label, 'address', a.address,
                                                               'directions', a.directions) order by a.created_at)
                             from customer_address a where a.customer_id = c.id and a.is_active), '[]'::jsonb))
$$;

-- A customer by their phone number, typed any way; null when there is none.
create or replace function find_customer(p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'customer.edit', 'customer.view');
  v_phone text := normalise_phone(p_phone); c customer;
begin
  if v_phone is null then raise exception 'That is not a phone number: type it as 0770 123 4567'; end if;
  select * into c from customer where business_id = v_business and phone = v_phone;
  if c.id is null then return null; end if;
  return customer_card(v_business, c);
end $$;

-- A customer by their id, as a bill or a sale names them.
create or replace function customer_at_till(p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create', 'customer.edit', 'customer.view');
begin
  return customer_card(v_business, customer_of(v_business, p_customer));
end $$;

-- ---------------------------------------------------------------------------
-- 8. The sale: its customer, the delivery, the reward, and the points
-- ---------------------------------------------------------------------------
-- Checked before the sale is written: the customer (still one), the address
-- named, and the rewards taken, the customer locked while their points are
-- spent. Null: no customer; also when the sale's key is found once the lock
-- is had (the sale is being replayed, and its points were counted then).
create or replace function sale_customer_check(p_business uuid, p_channel sales_channel, p_customer uuid,
                                               p_address uuid, p_rewards int, p_has_discount boolean,
                                               p_key uuid default null)
returns jsonb language plpgsql set search_path = public as $$
declare
  c customer; a customer_address; v_rewards int := coalesce(p_rewards, 0);
  v_points int; v_need int := 0; v_value numeric := 0; v_address text;
begin
  if p_customer is null then
    if v_rewards <> 0 then raise exception 'Choose the customer to take their reward'; end if;
    return null;
  end if;
  if is_platform_channel(p_channel) then
    raise exception 'A delivery platform''s customers are its own: none is added at the till';
  end if;
  if v_rewards < 0 or v_rewards > 20 then raise exception 'A sale takes from 1 to 20 rewards'; end if;
  c := customer_of(p_business, p_customer, v_rewards > 0);
  if p_key is not null and v_rewards > 0
     and exists (select 1 from sales_order where business_id = p_business and idempotency_key = p_key) then
    return null;
  end if;
  if not c.is_active then
    raise exception '% is no longer a customer here: bring them back on Customers first', c.full_name;
  end if;
  if p_address is not null then
    select * into a from customer_address where id = p_address and customer_id = c.id and is_active;
    if a.id is null then raise exception 'Choose one of the customer''s addresses'; end if;
    v_address := a.address || coalesce(' (' || a.directions || ')', '');
  end if;
  if v_rewards > 0 then
    if not loyalty_is_on(p_business) then
      raise exception 'Customers earn no points now: loyalty is off on Settings';
    end if;
    if p_has_discount then
      raise exception 'A reward is the bill''s discount: take the other discount off first';
    end if;
    v_points := customer_points(c.id);
    v_need := v_rewards * loyalty_rule(p_business, 'loyalty_reward_points')::int;
    if v_points < v_need then
      raise exception 'Not enough points: % has %, and this takes %', c.full_name, v_points, v_need;
    end if;
    v_value := v_rewards * loyalty_rule(p_business, 'loyalty_reward_value');
  end if;
  return jsonb_build_object('customer_id', c.id, 'name', c.full_name, 'address_id', a.id, 'address', v_address,
                            'rewards', v_rewards, 'points', v_need, 'value', v_value);
end $$;

-- A delivery by the café's own driver goes to a customer's address. Checked
-- once the sale is priced, so what refused a sale before 0050 still does, first;
-- the refusal takes the sale back with it.
create or replace function sale_delivery_check(p_channel sales_channel, p_check jsonb) returns void
language plpgsql immutable set search_path = public as $$
begin
  if p_channel = 'direct_delivery' and (p_check is null or nullif(p_check ->> 'address', '') is null) then
    raise exception 'A delivery by the café''s own driver needs the customer and their address';
  end if;
end $$;

-- What the sale did for its customer, as the till shows it: what it earned,
-- what it spent, and the points they have now.
create or replace function sale_customer_answer(p_order uuid) returns jsonb
language sql stable set search_path = public as $$
  select case when o.customer_id is null then null else jsonb_build_object(
    'customer_id', c.id, 'name', c.full_name,
    'earned', coalesce((select points from loyalty_ledger where sales_order_id = o.id and kind = 'earn'), 0),
    'spent', coalesce((select -points from loyalty_ledger where sales_order_id = o.id and kind = 'redeem'), 0),
    'points', customer_points(c.id)) end
    from sales_order o left join customer c on c.id = o.customer_id
   where o.id = p_order
$$;

-- Once the sale is written (its customer and delivery with it): the reward's
-- points spent, and the points it earns at the rule's rate now.
create or replace function sale_customer_record(p_business uuid, p_me uuid, p_order uuid, p_check jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare o sales_order; v_rate numeric; v_earn int; v_customer uuid := (p_check ->> 'customer_id')::uuid;
begin
  if v_customer is null then return null; end if;
  select * into o from sales_order where id = p_order;
  -- A reward is taken whole, never cut to what the bill comes to.
  if (p_check ->> 'value')::numeric > 0 and o.discount_amount < (p_check ->> 'value')::numeric then
    raise exception 'The bill comes to less than the reward (%): add to it, or keep the points for later',
      alert_money((p_check ->> 'value')::numeric);
  end if;
  if (p_check ->> 'rewards')::int > 0 then
    insert into loyalty_ledger (business_id, customer_id, kind, points, value, sales_order_id, created_by)
    values (p_business, v_customer, 'redeem', -(p_check ->> 'points')::int, (p_check ->> 'value')::numeric,
            p_order, p_me);
  end if;
  if loyalty_is_on(p_business) then
    v_rate := loyalty_rule(p_business, 'loyalty_point_per');
    v_earn := floor(o.net_amount / v_rate)::int;
    if v_earn > 0 then
      insert into loyalty_ledger (business_id, customer_id, kind, points, rate, sales_order_id, created_by)
      values (p_business, v_customer, 'earn', v_earn, v_rate, p_order, p_me);
    end if;
  end if;
  return sale_customer_answer(p_order);
end $$;

-- 0043's post_sale, with the sale's customer, the address a delivery goes to,
-- written with the sale (a sale once paid never changes).
drop function if exists post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean,
                                  jsonb, int, uuid, jsonb, numeric);
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
  -- dollars the dollars' (trg_cash_from_tender).
  insert into sales_tender (sales_order_id, tender_type, amount, received, position, currency, foreign_amount, rate)
  select v_order, (x ->> 'type')::tender_type, (x ->> 'amount')::numeric, (x ->> 'received')::numeric, o,
         coalesce(x ->> 'currency', 'IQD'), (x ->> 'usd')::numeric, (x ->> 'rate')::numeric
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
  -- it is zero). Dollars are debited to 1001 at their value, and their change
  -- in dinars leaves 1000 (0043).
  v_journal := post_journal(v_business, now(), 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
    coalesce((select jsonb_agg(signed_line(a.code, a.amount) order by a.pos)
                from (select p.code, sum(p.amount) as amount, min(p.pos) as pos
                        from jsonb_array_elements(v_pay) with ordinality e(x, o)
                        cross join lateral (
                          select tender_account((x ->> 'type')::tender_type) as code,
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

-- 0042's record_sale, with the customer, the delivery's address and the
-- rewards taken. A sale sent again with its key is the sale recorded, with
-- what it did for its customer then.
drop function if exists record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text,
                                    text, uuid, text, uuid, jsonb);
create or replace function record_sale(p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type, p_lines jsonb,
  p_location uuid default null, p_discount_percent numeric default null, p_discount_amount numeric default null,
  p_expected_net numeric default null, p_discount_reason text default null, p_discount_note text default null,
  p_approval uuid default null, p_platform_order_no text default null, p_stock_approval uuid default null,
  p_tenders jsonb default null, p_customer uuid default null, p_address uuid default null,
  p_rewards int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create'); r jsonb;
  v_me uuid := (current_member()).id;
  v_no text := nullif(trim(p_platform_order_no), ''); v_platform uuid; v_at timestamptz;
  v_pname text; v_active boolean; v_check jsonb; v_amount numeric := p_discount_amount; v_discount jsonb;
  v_replay boolean;
begin
  if (p_discount_percent is not null or p_discount_amount is not null)
     and not current_has_permission('discount.apply') then
    raise exception 'You do not have permission to give discounts' using errcode = '42501';
  end if;
  v_replay := exists (select 1 from sales_order where business_id = v_business and idempotency_key = p_idempotency_key);
  -- A platform sale goes through one of the café's platforms, in use; a sale
  -- it already recorded, sent again by a till that was offline, is replayed.
  if is_platform_channel(p_channel) and not v_replay then
    select id, name, is_active into v_platform, v_pname, v_active
      from delivery_platform where business_id = v_business and code = p_channel::text;
    if v_platform is null then
      raise exception '% is not one of the café''s delivery platforms: add it on Delivery Platforms', initcap(p_channel::text);
    end if;
    if not v_active then
      raise exception '% is no longer in use: bring it back on Delivery Platforms to sell through it', v_pname;
    end if;
  end if;
  if not v_replay then
    v_check := sale_customer_check(v_business, p_channel, p_customer, p_address, p_rewards,
                                   p_discount_percent is not null or p_discount_amount is not null,
                                   p_idempotency_key);
  end if;
  -- A reward is the sale's discount, given by the person at the till (0050).
  if coalesce((v_check ->> 'rewards')::int, 0) > 0 then
    v_amount := (v_check ->> 'value')::numeric;
    v_discount := jsonb_build_object('checked', true, 'by', v_me, 'approved_by', null, 'reason', 'Loyalty reward');
  else
    v_discount := jsonb_build_object('reason', p_discount_reason, 'note', p_discount_note, 'approval', p_approval);
  end if;
  r := post_sale(v_business, v_me, p_idempotency_key, p_channel, p_tender, p_lines,
                 p_location, p_discount_percent, v_amount, false, v_discount,
                 p_stock_approval => p_stock_approval, p_tenders => p_tenders, p_expected_net => p_expected_net,
                 p_customer => v_check);
  -- A replay is the sale already recorded, with its number.
  if is_platform_channel(p_channel) and not coalesce((r ->> 'replayed')::boolean, false) then
    select id, name into v_platform, v_pname
      from delivery_platform where business_id = v_business and code = p_channel::text;
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
  if coalesce((r ->> 'replayed')::boolean, false) then
    return r || jsonb_build_object('customer', sale_customer_answer((r ->> 'order_id')::uuid));
  end if;
  perform sale_delivery_check(p_channel, v_check);
  return r || jsonb_build_object('customer', sale_customer_record(v_business, v_me, (r ->> 'order_id')::uuid, v_check));
end $$;

-- 0042's settle_tab: the bill's customer (or one named as it is paid), its
-- delivery's address as the bill was printed with it, and the rewards taken.
drop function if exists settle_tab(uuid, integer, uuid, tender_type, numeric, uuid, jsonb);
create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type,
  p_expected_net numeric default null, p_stock_approval uuid default null, p_tenders jsonb default null,
  p_customer uuid default null, p_address uuid default null, p_rewards int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create'); t pos_tab; v_lines jsonb; r jsonb;
  v_me uuid := (current_member()).id; v_check jsonb; v_customer uuid; v_address uuid;
  v_percent numeric; v_amount numeric; v_discount jsonb;
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
              'turn_no', o.turn_no, 'payments', order_payments(o.id),
              'customer', sale_customer_answer(o.id))
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
  -- The bill's customer and address, unless others are named as it is paid.
  v_customer := coalesce(p_customer, t.customer_id);
  v_address := case when v_customer is distinct from t.customer_id then p_address
                    else coalesce(p_address, t.customer_address_id) end;
  v_check := sale_customer_check(v_business, t.channel, v_customer, v_address, p_rewards,
                                 t.discount_percent is not null or t.discount_amount is not null);
  if v_check is not null and v_address is not distinct from t.customer_address_id and t.delivery_address is not null then
    v_check := v_check || jsonb_build_object('address', t.delivery_address);
  end if;
  if coalesce((v_check ->> 'rewards')::int, 0) > 0 then
    v_amount := (v_check ->> 'value')::numeric;
    v_discount := jsonb_build_object('checked', true, 'by', v_me, 'approved_by', null, 'reason', 'Loyalty reward');
  else
    v_percent := t.discount_percent;
    v_amount := t.discount_amount;
    v_discount := jsonb_build_object('checked', true, 'by', t.discount_by, 'approved_by', t.discount_approved_by,
                                     'reason', t.discount_reason);
  end if;
  r := post_sale(v_business, v_me, p_idempotency_key, t.channel, p_tender, v_lines,
                 t.location_id, v_percent, v_amount, true, v_discount,
                 t.turn_no, p_stock_approval, p_tenders, p_expected_net, v_check);
  if coalesce((r ->> 'replayed')::boolean, false) then
    -- That key already paid for something else: never attach its sale to this bill.
    raise exception 'That payment was already used for another sale. Try again.';
  end if;
  perform sale_delivery_check(t.channel, v_check);
  update pos_tab
     set status = 'paid', sales_order_id = (r ->> 'order_id')::uuid, closed_at = now(),
         closed_by = v_me, turn_no = (r ->> 'turn_no')::int
   where id = p_tab;
  return r || jsonb_build_object('tab_id', p_tab,
    'customer', sale_customer_record(v_business, v_me, (r ->> 'order_id')::uuid, v_check));
end $$;

-- ---------------------------------------------------------------------------
-- 9. A bill's customer
-- ---------------------------------------------------------------------------
-- p_customer {"id": …, "address_id": …} puts the customer on the bill, with
-- the address a delivery goes to as it is now; {} takes them off; null leaves
-- the bill's as it is (a till loaded before 0050 sends none).
create or replace function tab_customer_set(p_business uuid, p_tab uuid, p_customer jsonb) returns void
language plpgsql set search_path = public as $$
declare t pos_tab; c customer; a customer_address; v_id uuid; v_address uuid;
begin
  if p_customer is null then return; end if;
  if jsonb_typeof(p_customer) <> 'object' then raise exception 'Choose the customer again'; end if;
  select * into t from pos_tab where id = p_tab and business_id = p_business;
  v_id := nullif(p_customer ->> 'id', '')::uuid;
  v_address := nullif(p_customer ->> 'address_id', '')::uuid;
  if v_id is null then
    update pos_tab set customer_id = null, customer_address_id = null, delivery_address = null where id = t.id;
    return;
  end if;
  if is_platform_channel(t.channel) then
    raise exception 'A delivery platform''s customers are its own: none is added at the till';
  end if;
  c := customer_of(p_business, v_id);
  if not c.is_active then
    raise exception '% is no longer a customer here: bring them back on Customers first', c.full_name;
  end if;
  if v_address is not null then
    select * into a from customer_address where id = v_address and customer_id = c.id and is_active;
    if a.id is null then raise exception 'Choose one of the customer''s addresses'; end if;
  end if;
  update pos_tab
     set customer_id = c.id, customer_address_id = a.id,
         delivery_address = case when a.id is not null then a.address || coalesce(' (' || a.directions || ')', '') end
   where id = t.id;
end $$;

-- A bill named for its customer when it has neither a table nor a name.
create or replace function tab_label_for(p_business uuid, p_label text, p_table uuid, p_customer jsonb) returns text
language sql stable set search_path = public as $$
  select case when nullif(trim(coalesce(p_label, '')), '') is null and p_table is null
                   and nullif(p_customer ->> 'id', '') is not null
              then (select full_name from customer
                     where id = nullif(p_customer ->> 'id', '')::uuid and business_id = p_business)
              else p_label end
$$;

-- 0035's open_tab and save_tab, with the bill's customer. A request sent
-- without one is fingerprinted as before, so a retry from a till loaded
-- before 0050 is still answered.
drop function if exists open_tab(sales_channel, uuid, text, uuid, jsonb, numeric, numeric, text, text, uuid, uuid);
create or replace function open_tab(
  p_channel sales_channel,
  p_table uuid default null,
  p_label text default null,
  p_location uuid default null,
  p_lines jsonb default null,
  p_discount_percent numeric default null,
  p_discount_amount numeric default null,
  p_discount_reason text default null,
  p_discount_note text default null,
  p_approval uuid default null,
  p_customer jsonb default null,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_channel', p_channel, 'p_table', p_table, 'p_label', p_label, 'p_location', p_location, 'p_lines', p_lines, 'p_discount_percent', p_discount_percent, 'p_discount_amount', p_discount_amount, 'p_discount_reason', p_discount_reason, 'p_discount_note', p_discount_note, 'p_approval', p_approval)
                 || case when p_customer is null then '{}'::jsonb else jsonb_build_object('p_customer', p_customer) end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'open_tab', v_req);
  if v is not null then return v; end if;
  v := open_tab__run(p_channel => p_channel, p_table => p_table,
                     p_label => tab_label_for(v_business, p_label, p_table, p_customer),
                     p_location => p_location, p_lines => p_lines, p_discount_percent => p_discount_percent,
                     p_discount_amount => p_discount_amount, p_discount_reason => p_discount_reason,
                     p_discount_note => p_discount_note, p_approval => p_approval);
  perform tab_customer_set(v_business, (v ->> 'tab_id')::uuid, p_customer);
  perform idem_finish(v_business, p_idempotency_key, 'open_tab', v_req, v);
  return v;
end $$;

drop function if exists save_tab(uuid, integer, jsonb, text, uuid, numeric, numeric, text, text, uuid, uuid);
create or replace function save_tab(
  p_tab uuid,
  p_version integer,
  p_lines jsonb,
  p_label text default null,
  p_table uuid default null,
  p_discount_percent numeric default null,
  p_discount_amount numeric default null,
  p_discount_reason text default null,
  p_discount_note text default null,
  p_approval uuid default null,
  p_customer jsonb default null,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_tab', p_tab, 'p_version', p_version, 'p_lines', p_lines, 'p_label', p_label, 'p_table', p_table, 'p_discount_percent', p_discount_percent, 'p_discount_amount', p_discount_amount, 'p_discount_reason', p_discount_reason, 'p_discount_note', p_discount_note, 'p_approval', p_approval)
                 || case when p_customer is null then '{}'::jsonb else jsonb_build_object('p_customer', p_customer) end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_tab', v_req);
  if v is not null then return v; end if;
  v := save_tab__run(p_tab => p_tab, p_version => p_version, p_lines => p_lines, p_label => p_label,
                     p_table => p_table, p_discount_percent => p_discount_percent,
                     p_discount_amount => p_discount_amount, p_discount_reason => p_discount_reason,
                     p_discount_note => p_discount_note, p_approval => p_approval);
  perform tab_customer_set(v_business, p_tab, p_customer);
  perform idem_finish(v_business, p_idempotency_key, 'save_tab', v_req, v);
  return v;
end $$;

-- 0041's open bills, with each one's customer, their points and where a
-- delivery goes.
drop function if exists pos_open_bills();
create or replace function pos_open_bills()
returns table (tab_id uuid, version integer, table_id uuid, table_name text, label text, channel sales_channel,
               business_day date, opened_at timestamptz, opened_by text, bill_printed_at timestamptz,
               bill_print_count integer, lines jsonb, total numeric, subtotal numeric, discount numeric,
               discount_percent numeric, discount_amount numeric, discount_reason text, discount_by text,
               discount_approved_by text, turn_no integer, customer_id uuid, customer_name text,
               customer_phone text, customer_points integer, customer_address_id uuid, delivery_address text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    with l as (
      select tl.tab_id, tl.id, tl.position, tl.product_variant_id, tl.qty, tl.note, p.name as product_name,
             pv.name as variant_name,
             coalesce(tl.unit_price, price_on(tl.product_variant_id, t.channel, t.location_id, v_today)) as price,
             (select coalesce(jsonb_agg(jsonb_build_object(
                        'modifier_id', lm.modifier_id, 'name', md.name, 'name_ar', md.name_ar,
                        'name_ckb', md.name_ckb, 'qty', lm.qty,
                        'price', coalesce(lm.unit_price, modifier_price_on(lm.modifier_id, t.channel, t.location_id,
                                                                           v_today)))
                      order by lm.position, lm.id), '[]')
                from pos_tab_line_modifier lm join modifier md on md.id = lm.modifier_id
               where lm.tab_line_id = tl.id) as modifiers
        from pos_tab t
        join pos_tab_line tl on tl.tab_id = t.id
        join product_variant pv on pv.id = tl.product_variant_id
        join product p on p.id = pv.product_id
       where t.business_id = v_business and t.status = 'open'
    ),
    b as (
      select t.*,
             coalesce((select sum(money_round(v_business,
                                  (l.price + coalesce((select sum((a ->> 'price')::numeric * (a ->> 'qty')::numeric)
                                                         from jsonb_array_elements(l.modifiers) a), 0)) * l.qty))
                         from l where l.tab_id = t.id), 0) as gross
        from pos_tab t
       where t.business_id = v_business and t.status = 'open'
    )
    select b.id, b.version, b.table_id, dt.name, b.label, b.channel, b.business_day, b.opened_at, au.full_name,
           b.bill_printed_at, b.bill_print_count,
           coalesce((select jsonb_agg(jsonb_build_object(
                               'line_id', l.id, 'variant_id', l.product_variant_id, 'qty', l.qty, 'note', l.note,
                               'product_name', l.product_name, 'variant_name', l.variant_name, 'price', l.price,
                               'modifiers', l.modifiers)
                             order by l.position)
                       from l where l.tab_id = b.id), '[]'::jsonb),
           b.gross - sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.gross,
           sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.discount_percent, b.discount_amount,
           b.discount_reason, db.full_name, dab.full_name, b.turn_no,
           b.customer_id, cu.full_name, cu.phone, case when cu.id is not null then customer_points(cu.id) end,
           b.customer_address_id, b.delivery_address
      from b
      left join dining_table dt on dt.id = b.table_id
      left join app_user au on au.id = b.opened_by
      left join app_user db on db.id = b.discount_by
      left join app_user dab on dab.id = b.discount_approved_by
      left join customer cu on cu.id = b.customer_id
     order by b.opened_at;
end $$;

-- ---------------------------------------------------------------------------
-- 10. A void, or a refund, and the points
-- ---------------------------------------------------------------------------
-- A void takes back all a sale earned and gives back all it spent. A refund
-- does so for what it gives back: what the sale still comes to earns at the
-- rate it earned at, and the reward comes back in the share given back, all of
-- it once the sale is refunded in full.
create or replace function loyalty_take_back(p_order uuid, p_refund uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o sales_order; e loyalty_ledger; v_spent int; v_refunded numeric; v_keep int;
  v_done_earn int; v_done_spent int; v_back_earn int := 0; v_back_spent int := 0;
begin
  select * into o from sales_order where id = p_order;
  if o.customer_id is null then return; end if;
  select * into e from loyalty_ledger where sales_order_id = p_order and kind = 'earn';
  v_spent := coalesce((select -points from loyalty_ledger where sales_order_id = p_order and kind = 'redeem'), 0);
  if e.id is null and v_spent = 0 then return; end if;
  v_done_earn := coalesce((select -sum(points) from loyalty_ledger where sales_order_id = p_order and kind = 'earn_back'), 0);
  v_done_spent := coalesce((select sum(points) from loyalty_ledger where sales_order_id = p_order and kind = 'redeem_back'), 0);
  if p_refund is not null then
    v_refunded := sale_refunded(p_order);
  end if;
  if p_refund is null or v_refunded >= o.net_amount then
    v_back_earn := coalesce(e.points, 0) - v_done_earn;
    v_back_spent := v_spent - v_done_spent;
  else
    v_keep := case when e.id is null then 0 else floor((o.net_amount - v_refunded) / e.rate)::int end;
    v_back_earn := greatest(coalesce(e.points, 0) - v_keep - v_done_earn, 0);
    v_back_spent := greatest(floor(v_spent * v_refunded / o.net_amount)::int - v_done_spent, 0);
  end if;
  if v_back_earn > 0 then
    insert into loyalty_ledger (business_id, customer_id, kind, points, sales_order_id, sale_refund_id, created_by)
    values (o.business_id, o.customer_id, 'earn_back', -v_back_earn, p_order, p_refund, current_app_user_id());
  end if;
  if v_back_spent > 0 then
    insert into loyalty_ledger (business_id, customer_id, kind, points, sales_order_id, sale_refund_id, created_by)
    values (o.business_id, o.customer_id, 'redeem_back', v_back_spent, p_order, p_refund, current_app_user_id());
  end if;
end $$;

create or replace function trg_loyalty_void() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'voided' and OLD.status is distinct from 'voided' and NEW.customer_id is not null then
    perform loyalty_take_back(NEW.id, null);
  end if;
  return NEW;
end $$;
drop trigger if exists sales_order_loyalty_void on sales_order;
create trigger sales_order_loyalty_void
  after update of status on sales_order
  for each row execute function trg_loyalty_void();

create or replace function trg_loyalty_refund() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform loyalty_take_back(NEW.sales_order_id, NEW.id);
  return NEW;
end $$;
drop trigger if exists sale_refund_loyalty on sale_refund;
create trigger sale_refund_loyalty
  after insert on sale_refund
  for each row execute function trg_loyalty_refund();

-- ---------------------------------------------------------------------------
-- 11. Points given or taken by hand
-- ---------------------------------------------------------------------------
create or replace function adjust_points__run(p_customer uuid, p_points int, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('loyalty.adjust');
  v_me uuid := (current_member()).id; c customer; v_before int; v_id uuid;
begin
  c := customer_of(v_business, p_customer, true);
  if p_points is null or p_points = 0 then
    raise exception 'Enter the points to give, or with a minus to take';
  end if;
  if abs(p_points) > 10000 then raise exception 'Points are given or taken 10,000 at most at a time'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the points change'; end if;
  v_before := customer_points(c.id);
  if p_points < 0 and v_before + p_points < 0 then
    raise exception '% has % points: no more can be taken', c.full_name, v_before;
  end if;
  insert into loyalty_ledger (business_id, customer_id, kind, points, reason, created_by)
  values (v_business, c.id, 'adjust', p_points, trim(p_reason), v_me)
  returning id into v_id;
  return jsonb_build_object('customer_id', c.id, 'entry_id', v_id, 'points', v_before + p_points,
                            'before', jsonb_build_object('customer', c.full_name, 'points', v_before),
                            'after', jsonb_build_object('customer', c.full_name, 'points', v_before + p_points,
                                                        'change', p_points));
end $$;

create or replace function adjust_points(p_customer uuid, p_points int, p_reason text,
                                         p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_customer', p_customer, 'p_points', p_points, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'adjust_points', v_req);
  if v is not null then return v; end if;
  v := adjust_points__run(p_customer => p_customer, p_points => p_points, p_reason => p_reason);
  perform audit_event(v_business, 'loyalty.adjust', 'customer', v ->> 'customer_id', trim(p_reason),
                      v -> 'before', v -> 'after');
  v := jsonb_build_object('customer_id', v -> 'customer_id', 'entry_id', v -> 'entry_id', 'points', v -> 'points');
  perform idem_finish(v_business, p_idempotency_key, 'adjust_points', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 12. Customers, what each bought, and the loyalty report
-- ---------------------------------------------------------------------------
-- What a sale that was paid for still comes to: less what was given back.
create or replace function customer_sales(p_business uuid, p_from timestamptz, p_to timestamptz)
returns table (customer_id uuid, orders bigint, spent numeric, last_at timestamptz)
language sql stable set search_path = public as $$
  select o.customer_id, count(*), sum(o.net_amount - sale_refunded(o.id)), max(o.placed_at)
    from sales_order o
   where o.business_id = p_business and o.customer_id is not null
     and o.status in ('completed', 'partially_refunded', 'refunded')
     and o.placed_at >= coalesce(p_from, '-infinity') and o.placed_at < coalesce(p_to, 'infinity')
   group by o.customer_id
$$;

create or replace function customer_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('customer.view');
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
             'id', c.id, 'name', c.full_name, 'phone', c.phone, 'notes', c.notes, 'active', c.is_active,
             'created_at', c.created_at, 'points', coalesce(l.points, 0),
             'orders', coalesce(s.orders, 0), 'spent', coalesce(s.spent, 0), 'last_order_at', s.last_at,
             'addresses', (select count(*) from customer_address a where a.customer_id = c.id and a.is_active))
           order by lower(c.full_name), c.phone)
      from customer c
      left join (select customer_id, sum(points)::int as points from loyalty_ledger
                  where business_id = v_business group by customer_id) l on l.customer_id = c.id
      left join customer_sales(v_business, null, null) s on s.customer_id = c.id
     where c.business_id = v_business), '[]'::jsonb);
end $$;

create or replace function customer_detail(p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('customer.view'); c customer;
begin
  c := customer_of(v_business, p_customer);
  return jsonb_build_object(
    'customer', jsonb_build_object('id', c.id, 'name', c.full_name, 'phone', c.phone, 'notes', c.notes,
                                   'active', c.is_active, 'created_at', c.created_at,
                                   'created_by', (select full_name from app_user where id = c.created_by)),
    'points', customer_points(c.id),
    'addresses', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'label', a.label, 'address', a.address,
                                                               'directions', a.directions, 'active', a.is_active)
                                            order by a.is_active desc, a.created_at)
                             from customer_address a where a.customer_id = c.id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(x.j order by x.placed_at desc) from (
        select o.placed_at, jsonb_build_object(
                 'order_id', o.id, 'placed_at', o.placed_at, 'channel', o.channel, 'status', o.status,
                 'turn_no', o.turn_no, 'gross', o.gross_amount, 'discount', o.discount_amount, 'net', o.net_amount,
                 'refunded', sale_refunded(o.id), 'delivery_address', o.delivery_address,
                 'earned', coalesce((select points from loyalty_ledger where sales_order_id = o.id and kind = 'earn'), 0),
                 'spent', coalesce((select -points from loyalty_ledger where sales_order_id = o.id and kind = 'redeem'), 0)) j
          from sales_order o
         where o.customer_id = c.id and o.status <> 'open'
         order by o.placed_at desc limit 200) x), '[]'::jsonb),
    'ledger', coalesce((select jsonb_agg(x.j order by x.created_at desc, x.id) from (
        select l.created_at, l.id, jsonb_build_object(
                 'id', l.id, 'at', l.created_at, 'kind', l.kind, 'points', l.points, 'value', l.value,
                 'rate', l.rate, 'order_id', l.sales_order_id,
                 'refund_no', (select r.refund_no from sale_refund r where r.id = l.sale_refund_id),
                 'reason', l.reason, 'by', (select full_name from app_user where id = l.created_by)) j
          from loyalty_ledger l
         where l.customer_id = c.id
         order by l.created_at desc, l.id limit 500) x), '[]'::jsonb));
end $$;

-- The points earned, spent, taken back and given by hand in the dates; the
-- rewards taken and what they took off; the points customers hold now, and
-- what they would take off; and who bought the most.
create or replace function report_customers(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('customer.view'); b record;
  v_outstanding bigint;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose the dates, the first on or before the last';
  end if;
  select * into b from local_day_bounds(v_business, p_from, p_to);
  select coalesce(sum(greatest(x.p, 0)), 0) into v_outstanding
    from (select sum(points) as p from loyalty_ledger where business_id = v_business group by customer_id) x;
  return jsonb_build_object(
    'points', (select jsonb_build_object(
        'earned', coalesce(sum(points) filter (where kind = 'earn'), 0),
        'spent', coalesce(-sum(points) filter (where kind = 'redeem'), 0),
        'taken_back', coalesce(-sum(points) filter (where kind = 'earn_back'), 0),
        'given_back', coalesce(sum(points) filter (where kind = 'redeem_back'), 0),
        'given_by_hand', coalesce(sum(points) filter (where kind = 'adjust' and points > 0), 0),
        'taken_by_hand', coalesce(-sum(points) filter (where kind = 'adjust' and points < 0), 0),
        'rewards', count(*) filter (where kind = 'redeem'),
        'rewards_value', coalesce(sum(value) filter (where kind = 'redeem'), 0))
        from loyalty_ledger
       where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts),
    'outstanding', v_outstanding,
    'outstanding_value', money_round(v_business, v_outstanding / loyalty_rule(v_business, 'loyalty_reward_points')
                                                  * loyalty_rule(v_business, 'loyalty_reward_value')),
    'customers', (select count(*) from customer where business_id = v_business and is_active),
    'new_customers', (select count(*) from customer
                       where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts),
    'sales', (select jsonb_build_object('orders', coalesce(sum(s.orders), 0), 'net', coalesce(sum(s.spent), 0))
                from customer_sales(v_business, b.from_ts, b.to_ts) s),
    'top', coalesce((select jsonb_agg(jsonb_build_object('customer_id', c.id, 'name', c.full_name,
                                                         'orders', s.orders, 'spent', s.spent,
                                                         'points', customer_points(c.id))
                                      order by s.spent desc, lower(c.full_name))
                       from (select * from customer_sales(v_business, b.from_ts, b.to_ts)
                              order by spent desc limit 10) s
                       join customer c on c.id = s.customer_id), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 13. Who may read and call what
-- ---------------------------------------------------------------------------
alter table customer enable row level security;
alter table customer force row level security;
alter table customer_address enable row level security;
alter table customer_address force row level security;
alter table loyalty_ledger enable row level security;
alter table loyalty_ledger force row level security;

-- The customers, their addresses and their points: whoever sees customers.
-- The till finds a customer by their number (find_customer), not the list.
drop policy if exists customer_read on customer;
create policy customer_read on customer for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('customer.view')));
drop policy if exists customer_read on customer_address;
create policy customer_read on customer_address for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('customer.view')));
drop policy if exists customer_read on loyalty_ledger;
create policy customer_read on loyalty_ledger for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('customer.view')));
grant select on customer, customer_address, loyalty_ledger to authenticated;

revoke execute on function
  rule_definitions(), rule_defaults(uuid), loyalty_rule(uuid, text), loyalty_is_on(uuid), normalise_phone(text),
  customer_of(uuid, uuid, boolean), save_customer__run(uuid, text, text, text, boolean),
  save_customer_address__run(uuid, uuid, text, text, text, boolean), customer_points(uuid),
  customer_card(uuid, customer), sale_customer_check(uuid, sales_channel, uuid, uuid, int, boolean, uuid),
  sale_customer_answer(uuid), sale_customer_record(uuid, uuid, uuid, jsonb), tab_customer_set(uuid, uuid, jsonb),
  tab_label_for(uuid, text, uuid, jsonb), loyalty_take_back(uuid, uuid), trg_loyalty_void(), trg_loyalty_refund(),
  sale_delivery_check(sales_channel, jsonb),
  post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb, int, uuid,
            jsonb, numeric, jsonb),
  adjust_points__run(uuid, int, text), customer_sales(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function
  save_customer(uuid, text, text, text, boolean, uuid), save_customer_address(uuid, uuid, text, text, text, boolean, uuid),
  find_customer(text), customer_at_till(uuid),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text, uuid,
              jsonb, uuid, uuid, int),
  settle_tab(uuid, int, uuid, tender_type, numeric, uuid, jsonb, uuid, uuid, int),
  open_tab(sales_channel, uuid, text, uuid, jsonb, numeric, numeric, text, text, uuid, jsonb, uuid),
  save_tab(uuid, integer, jsonb, text, uuid, numeric, numeric, text, text, uuid, jsonb, uuid),
  pos_open_bills(), adjust_points(uuid, int, text, uuid), customer_list(), customer_detail(uuid),
  report_customers(date, date)
  from public, anon;
grant execute on function
  save_customer(uuid, text, text, text, boolean, uuid), save_customer_address(uuid, uuid, text, text, text, boolean, uuid),
  find_customer(text), customer_at_till(uuid),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text, uuid,
              jsonb, uuid, uuid, int),
  settle_tab(uuid, int, uuid, tender_type, numeric, uuid, jsonb, uuid, uuid, int),
  open_tab(sales_channel, uuid, text, uuid, jsonb, numeric, numeric, text, text, uuid, jsonb, uuid),
  save_tab(uuid, integer, jsonb, text, uuid, numeric, numeric, text, text, uuid, jsonb, uuid),
  pos_open_bills(), adjust_points(uuid, int, text, uuid), customer_list(), customer_detail(uuid),
  report_customers(date, date)
  to authenticated;
