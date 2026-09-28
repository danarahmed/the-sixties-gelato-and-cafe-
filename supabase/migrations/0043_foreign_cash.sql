-- =============================================================================
-- 0043 — US dollars at the till (release R)
--
-- The till took dinars and cards only: a customer paying in dollars was
-- turned away or rung up at a rate nobody recorded (docs/COMPLETION_PLAN.md,
-- D5). The owner's defaults (decision 7): a manager sets the rate each day
-- with a reason; dollars are counted in dinars to the nearest 250; the change
-- is given in dinars.
--   * The rate: set with a reason, kept with its history; older than the
--     café's limit (36 hours), dollars are refused until a manager sets today's.
--   * A payment in dollars is cash in dollars: the dollars handed over, the
--     rate the till showed (checked against the rate now), their value in
--     dinars (rounded), its part of the sale, and the change in dinars, from
--     the dinar drawer.
--   * The dollars have a drawer of their own, beside the dinars' and never
--     mixed with them: every dinar figure reads as before. At each close they
--     are counted, blind, and go to the safe; a difference goes to cash over
--     and short at their carrying value.
--   * Dollars are exchanged for dinars from the safe or the till, into the
--     safe, the till or the bank; the difference from what they were taken at
--     goes to 6950 Exchange differences.
--   * Accounts: 1001 Cash in the till — USD, 1006 Cash in the safe — USD, in
--     dinars at what the dollars were taken at. The books check them against
--     the dollars held.
--   * report_dollars: the dollars taken, the rates, the exchanges, what is held.
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
    ('5400','Inventory count variance',   'expense',   'debit'),
    ('6000','Rent',                       'expense',   'debit'),
    ('6100','Salaries',                   'expense',   'debit'),
    ('6200','Utilities',                  'expense',   'debit'),
    ('6300','Cash over / short',          'expense',   'debit'),
    ('6400','Depreciation',               'expense',   'debit'),
    ('6500','Card and bank fees',         'expense',   'debit'),
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

-- Dollars move only through their records, as the dinars in the till and the safe do.
create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$ select p_code in ('1000', '1001', '1005', '1006', '1200', '2000', '2050', '3100') $$;

-- ---------------------------------------------------------------------------
-- 2. The rules: how old a rate may be, and what dollars are rounded to
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
                              "label": "Dollars are counted in dinars to the nearest"}
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
$$;

-- Who sets the dollar's rate: the owner and the managers (decision 7).
insert into role_permission (role, permission)
select r::app_role, p from (values
  ('owner','fx.rate'),('general_manager','fx.rate'),('branch_manager','fx.rate')
) as v(r, p)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. The rate
-- ---------------------------------------------------------------------------
-- Dinars per dollar, from when it was set, by whom and why. Never changed: a
-- new rate is a new row, and the latest is the rate.
create table if not exists fx_rate (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business (id) on delete cascade,
  currency       text not null default 'USD' check (currency = 'USD'),
  rate           numeric not null check (rate >= 100 and rate <= 100000 and rate = trunc(rate)),
  effective_from timestamptz not null default now(),
  set_by         uuid references app_user (id),
  reason         text not null check (length(trim(reason)) > 0),
  created_at     timestamptz not null default now()
);
create index if not exists fx_rate_latest on fx_rate (business_id, currency, effective_from desc);
alter table fx_rate enable row level security;
alter table fx_rate force row level security;
drop policy if exists member_read on fx_rate;
create policy member_read on fx_rate for select to authenticated
  using (business_id = (select current_business_id()));
grant select on fx_rate to authenticated;
drop trigger if exists fx_rate_append_only on fx_rate;
create trigger fx_rate_append_only before update or delete on fx_rate
  for each row execute function forbid_mutation();

-- The rate in force: the latest, and how old it is.
create or replace function usd_rate_row(p_business uuid) returns fx_rate
language sql stable set search_path = public as $$
  select * from fx_rate where business_id = p_business and currency = 'USD' and effective_from <= now()
   order by effective_from desc, created_at desc limit 1
$$;

-- The rate dollars are taken at now; refused when there is none, or it is
-- older than the café allows.
create or replace function usd_rate_now(p_business uuid) returns numeric
language plpgsql stable set search_path = public as $$
declare r fx_rate := usd_rate_row(p_business);
  v_max numeric := (rule_value(p_business, 'usd_rate_max_age_hours') #>> '{}')::numeric;
begin
  if r.id is null then
    raise exception 'No dollar rate is set: a manager sets today''s on Sales → Dollars';
  end if;
  if now() - r.effective_from > make_interval(hours => v_max::int) then
    raise exception 'The dollar rate was set % hours ago: a manager sets today''s before dollars are taken',
      floor(extract(epoch from now() - r.effective_from) / 3600)::int;
  end if;
  return r.rate;
end $$;

-- Dollars in dinars: at the rate, to the nearest step (half up).
create or replace function usd_value(p_business uuid, p_usd numeric, p_rate numeric) returns numeric
language sql stable set search_path = public as $$
  select money_round(p_business,
           floor(p_usd * p_rate / (rule_value(p_business, 'usd_round_to') #>> '{}')::numeric + 0.5)
           * (rule_value(p_business, 'usd_round_to') #>> '{}')::numeric)
$$;

create or replace function set_fx_rate__run(p_currency text, p_rate numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('fx.rate');
  v_me uuid := (current_member()).id;
  v_old fx_rate; v_id uuid := gen_random_uuid(); v_rate numeric;
begin
  if coalesce(upper(trim(p_currency)), '') <> 'USD' then raise exception 'Only the dollar''s rate is kept'; end if;
  v_rate := p_rate;
  if v_rate is null or v_rate < 100 or v_rate > 100000 or v_rate <> trunc(v_rate) then
    raise exception 'A dollar is a whole number of dinars, from 100 to 100,000';
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say where the rate comes from'; end if;
  v_old := usd_rate_row(v_business);
  insert into fx_rate (id, business_id, currency, rate, set_by, reason)
  values (v_id, v_business, 'USD', v_rate, v_me, trim(p_reason));
  perform audit_event(v_business, 'fx.rate.set', 'fx_rate', v_id::text, trim(p_reason),
    case when v_old.id is not null then jsonb_build_object('rate', v_old.rate, 'set_at', v_old.effective_from) end,
    jsonb_build_object('currency', 'USD', 'rate', v_rate));
  return jsonb_build_object('rate_id', v_id, 'currency', 'USD', 'rate', v_rate, 'set_at', now(),
                            'was', v_old.rate);
end $$;

create or replace function set_fx_rate(p_currency text, p_rate numeric, p_reason text,
                                       p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_currency', p_currency, 'p_rate', p_rate, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_fx_rate', v_req);
  if v is not null then return v; end if;
  v := set_fx_rate__run(p_currency => p_currency, p_rate => p_rate, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'set_fx_rate', v_req, v);
  return v;
end $$;

-- The dollar as the till and Settings show it: the rate, from when, by whom
-- and why, whether dollars are taken at it now, the rules, and the rates before.
create or replace function fx_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'fx.rate', 'cost.view', 'cash.session', 'day.close');
  r fx_rate; v_max numeric; v_age numeric;
begin
  r := usd_rate_row(v_business);
  v_max := (rule_value(v_business, 'usd_rate_max_age_hours') #>> '{}')::numeric;
  v_age := case when r.id is not null then extract(epoch from now() - r.effective_from) / 3600 end;
  return jsonb_build_object(
    'currency', 'USD', 'rate', r.rate, 'set_at', r.effective_from,
    'set_by', (select full_name from app_user where id = r.set_by), 'reason', r.reason,
    'age_hours', floor(v_age), 'max_age_hours', v_max,
    'usable', r.id is not null and v_age <= v_max,
    'round_to', (rule_value(v_business, 'usd_round_to') #>> '{}')::numeric,
    'may_set', current_has_permission('fx.rate'),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('rate', h.rate, 'set_at', h.effective_from,
                                                             'set_by', u.full_name, 'reason', h.reason)
                                          order by h.effective_from desc, h.created_at desc), '[]'::jsonb)
                  from (select * from fx_rate where business_id = v_business and currency = 'USD'
                         order by effective_from desc, created_at desc limit 30) h
                  left join app_user u on u.id = h.set_by));
end $$;

-- ---------------------------------------------------------------------------
-- 4. The dollars' own drawer: the till's and the safe's
-- ---------------------------------------------------------------------------
-- Every dollar in or out of the till or the safe, signed (+ in, − out), with
-- its value in dinars: what it was taken at. A place's dollars are carried at
-- their average; dollars leaving take their share of it, and the last dollar
-- the rest. Never changed or deleted. The till's name the drawer's session they
-- were counted in, as the dinars do.
create table if not exists fx_cash_event (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business (id) on delete cascade,
  location_id    uuid not null references location (id),
  place          text not null,
  currency       text not null default 'USD',
  kind           text not null,
  usd            numeric not null,
  value          numeric not null,
  rate           numeric,
  reference_type text not null,
  reference_id   uuid not null,
  work_shift_id  uuid references work_shift (id),
  created_by     uuid references app_user (id),
  created_at     timestamptz not null default now(),
  constraint fx_cash_event_place check (place in ('till', 'safe')),
  constraint fx_cash_event_currency check (currency = 'USD'),
  constraint fx_cash_event_kind check (kind in ('sale', 'void', 'count', 'take', 'exchange')),
  constraint fx_cash_event_amount check (usd = trunc(usd) and (usd <> 0 or value <> 0)),
  constraint fx_cash_event_session check (place <> 'till' or work_shift_id is not null)
);
create index if not exists fx_cash_event_place_idx on fx_cash_event (business_id, place, location_id);
create index if not exists fx_cash_event_reference on fx_cash_event (reference_type, reference_id);
create index if not exists fx_cash_event_shift on fx_cash_event (work_shift_id);
alter table fx_cash_event enable row level security;
alter table fx_cash_event force row level security;
drop policy if exists cost_read on fx_cash_event;
create policy cost_read on fx_cash_event for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view'))
         and ((select current_has_permission('cash.view_expected'))
              or work_shift_id is null
              or exists (select 1 from work_shift w where w.id = fx_cash_event.work_shift_id and w.closed_at is not null)));
grant select on fx_cash_event to authenticated;
drop trigger if exists fx_cash_event_append_only on fx_cash_event;
create trigger fx_cash_event_append_only before update or delete on fx_cash_event
  for each row execute function forbid_mutation();

-- Dollars move at the till only in an open session, and join it as they
-- happen (as the dinars, 0036). What the close counts names its session.
create or replace function trg_fx_cash_event_session() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_session uuid;
begin
  if NEW.place <> 'till' or NEW.work_shift_id is not null then return NEW; end if;
  select w.id into v_session
    from work_shift w join cash_drawer d on d.id = w.drawer_id
   where w.business_id = NEW.business_id and d.location_id = NEW.location_id and d.is_active
     and w.kind = 'session' and w.closed_at is null
     for share of w;
  if v_session is null then
    raise exception 'Open the drawer first: on the till, count the cash in it';
  end if;
  NEW.work_shift_id := v_session;
  return NEW;
end $$;
drop trigger if exists fx_cash_event_session on fx_cash_event;
create trigger fx_cash_event_session before insert on fx_cash_event
  for each row execute function trg_fx_cash_event_session();

-- The dollars a place holds and their value: a branch's till, or the safe.
create or replace function fx_place_balance(p_business uuid, p_place text, p_location uuid,
  out usd numeric, out value numeric)
language sql stable set search_path = public as $$
  select coalesce(sum(e.usd), 0), coalesce(sum(e.value), 0) from fx_cash_event e
   where e.business_id = p_business and e.place = p_place and e.currency = 'USD'
     and (p_place = 'safe' or e.location_id = p_location)
$$;

-- The value of dollars leaving a place: their share of what it holds, or,
-- for the last of them, all of it.
create or replace function fx_value_out(p_business uuid, p_held_usd numeric, p_held_value numeric, p_usd numeric)
returns numeric language sql stable set search_path = public as $$
  select case when p_usd >= p_held_usd then p_held_value
              when p_held_usd > 0 then money_round(p_business, p_held_value * p_usd / p_held_usd)
              else 0 end
$$;

-- One at a time: what the till or the safe holds in dollars, checked and moved.
create or replace function lock_dollars(p_business uuid) returns void
language sql set search_path = public as $$
  select pg_advisory_xact_lock(hashtextextended('fx_cash:' || p_business::text, 0))
$$;

-- ---------------------------------------------------------------------------
-- 5. A payment in dollars
-- ---------------------------------------------------------------------------
-- A cash payment is in dinars or in dollars. In dollars: the dollars handed
-- over (foreign_amount), the rate they were taken at, and `received` their
-- value in dinars; the change, received less the part it pays, is in dinars.
alter table sales_tender add column if not exists currency text not null default 'IQD';
alter table sales_tender add column if not exists foreign_amount numeric;
alter table sales_tender add column if not exists rate numeric;
alter table sales_tender drop constraint if exists sales_tender_currency_check;
alter table sales_tender add constraint sales_tender_currency_check check (
  (currency = 'IQD' and foreign_amount is null and rate is null)
  or (currency = 'USD' and tender_type = 'cash' and foreign_amount > 0 and foreign_amount = trunc(foreign_amount)
      and rate > 0 and received is not null));

-- A sale's payments, as the till and the receipts show them; one in dollars
-- with its dollars and rate.
create or replace function order_payments(p_order uuid) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('type', tender_type, 'amount', amount, 'received', received,
                                               'change', change_given)
                            || case when currency = 'USD'
                                    then jsonb_build_object('currency', 'USD', 'usd', foreign_amount, 'rate', rate)
                                    else '{}'::jsonb end
                            order by position, id), '[]'::jsonb)
    from sales_tender where sales_order_id = p_order
$$;

-- 0042's sale_payments, with payments in dollars: {type: 'cash', currency:
-- 'USD', usd, rate, amount}, whole dollars, the rate the till showed; what
-- they are worth is worked out once the sale is priced (sale_dollars).
create or replace function sale_payments(p_business uuid, p_channel sales_channel, p_tender tender_type,
                                         p_tenders jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  x jsonb; v_out jsonb := '[]'; n int; v_amount numeric; v_received numeric; v_currency text;
  v_usd numeric; v_rate numeric;
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
         or coalesce(jsonb_typeof(x -> 'received'), 'null') not in ('number', 'null')
         or coalesce(jsonb_typeof(x -> 'currency'), 'null') not in ('string', 'null')
         or coalesce(jsonb_typeof(x -> 'usd'), 'null') not in ('number', 'null')
         or coalesce(jsonb_typeof(x -> 'rate'), 'null') not in ('number', 'null') then
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
        v_out := v_out || jsonb_build_object('type', x ->> 'type', 'amount', v_amount, 'received', v_received);
      else
        raise exception 'Payments are taken in dinars or dollars';
      end if;
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

-- The dollars among a sale's payments, once it is priced: at the rate now,
-- which must be the rate the till showed, worth (usd_value) at least the part
-- they pay. Their value is what was received; the rest of it is the change.
create or replace function sale_dollars(p_business uuid, p_pay jsonb) returns jsonb
language plpgsql stable set search_path = public as $$
declare x jsonb; v_out jsonb := '[]'; v_rate numeric; v_value numeric;
begin
  for x in select e.x from jsonb_array_elements(p_pay) with ordinality e(x, o) order by e.o loop
    if x ->> 'currency' = 'USD' then
      v_rate := coalesce(v_rate, usd_rate_now(p_business));
      if (x ->> 'rate')::numeric <> v_rate then
        raise exception 'The dollar rate is now %, not the % shown: take the payment again',
          trim_scale(v_rate), trim_scale((x ->> 'rate')::numeric);
      end if;
      v_value := usd_value(p_business, (x ->> 'usd')::numeric, v_rate);
      if (x ->> 'amount')::numeric > v_value then
        raise exception '$% come to %, less than the % they pay', trim_scale((x ->> 'usd')::numeric),
          trim_scale(v_value), trim_scale((x ->> 'amount')::numeric);
      end if;
      x := x || jsonb_build_object('received', v_value);
    end if;
    v_out := v_out || x;
  end loop;
  return v_out;
end $$;

-- ---------------------------------------------------------------------------
-- 6. A sale taken in dollars
-- ---------------------------------------------------------------------------
-- 0042's post_sale: its dollars priced at the rate now once the sale is (the
-- total first, then the payments, then the dollars), each payment written with
-- its currency, and the journal netted per account: dollars to 1001 at their
-- value, their change out of 1000.
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

-- A cash payment in dinars puts its part in the drawer. One in dollars puts
-- the dollars in the till's dollars, at their value, and takes the change out
-- of the drawer, which must hold it. Both need the open session.
create or replace function trg_cash_from_tender() returns trigger
language plpgsql security definer set search_path = public as $$
declare o sales_order; d record; v_change numeric;
begin
  if NEW.tender_type <> 'cash' then return NEW; end if;
  select * into o from sales_order where id = NEW.sales_order_id;
  if NEW.currency = 'USD' then
    insert into fx_cash_event (business_id, location_id, place, kind, usd, value, rate, reference_type, reference_id,
                               created_by)
    values (o.business_id, o.location_id, 'till', 'sale', NEW.foreign_amount, NEW.received, NEW.rate,
            'sales_order', o.id, o.cashier_id);
    v_change := NEW.received - NEW.amount;
    if v_change > 0 then
      d := drawer_position(o.business_id, o.location_id);
      if d.carry + d.moved < v_change then
        raise exception 'The drawer does not hold the % change in dinars: take the payment in dinars, or put cash in the till first',
          trim_scale(v_change);
      end if;
      insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
      values (o.business_id, o.location_id, 'sale', -v_change, 'sales_order', o.id, o.cashier_id);
    end if;
  elsif NEW.amount <> 0 then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (o.business_id, o.location_id, 'sale', NEW.amount, 'sales_order', o.id, o.cashier_id);
  end if;
  return NEW;
end $$;

-- 0042's void: the drawer gives back what the sale put in it (its dinars,
-- less the change it gave for dollars), and the till's dollars what they took,
-- if they still hold them.
create or replace function trg_cash_from_adjustment() returns trigger
language plpgsql security definer set search_path = public as $$
declare o sales_order; v_cash numeric; v_usd numeric; v_value numeric; h record;
begin
  if NEW.kind <> 'void' or coalesce(NEW.amount, 0) = 0 then return NEW; end if;
  select * into o from sales_order where id = NEW.sales_order_id;
  select coalesce(sum(amount), 0) into v_cash from cash_event
   where reference_type = 'sales_order' and reference_id = o.id and kind = 'sale';
  if v_cash <> 0 then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (o.business_id, o.location_id, 'void', -v_cash, 'sale_adjustment', NEW.id, NEW.requested_by);
  end if;
  select coalesce(sum(usd), 0), coalesce(sum(value), 0) into v_usd, v_value from fx_cash_event
   where reference_type = 'sales_order' and reference_id = o.id and kind = 'sale';
  if v_usd <> 0 then
    perform lock_dollars(o.business_id);
    h := fx_place_balance(o.business_id, 'till', o.location_id);
    if h.usd < v_usd then
      raise exception 'The till no longer holds the $% this sale was paid with: refund it instead', trim_scale(v_usd);
    end if;
    insert into fx_cash_event (business_id, location_id, place, kind, usd, value, reference_type, reference_id,
                               created_by)
    values (o.business_id, o.location_id, 'till', 'void', -v_usd, -v_value, 'sale_adjustment', NEW.id,
            NEW.requested_by);
  end if;
  return NEW;
end $$;

-- ---------------------------------------------------------------------------
-- 7. The dollars counted at each close, and taken to the safe
-- ---------------------------------------------------------------------------
-- A till never needs dollars: change is in dinars. So at each close its
-- dollars are counted, blind, beside the dinars, and all go to the safe. A
-- difference goes to cash over and short, at what the till held them at (more
-- than it held: at its average, or the rate if it held none). A close that
-- does not count them (a till loaded before 0043, a manager's close without a
-- count) leaves them in the till for the next close to count.
create table if not exists session_dollar_count (
  work_shift_id    uuid primary key references work_shift (id),
  business_id      uuid not null references business (id) on delete cascade,
  location_id      uuid not null references location (id),
  expected         numeric not null,
  counted          numeric,
  variance         numeric,
  variance_value   numeric not null default 0,
  taken            numeric not null default 0,
  taken_value      numeric not null default 0,
  denominations    jsonb,
  journal_entry_id uuid references journal_entry (id),
  counted_by       uuid references app_user (id),
  created_at       timestamptz not null default now(),
  constraint session_dollar_count_counted check (counted is null or (counted >= 0 and counted = trunc(counted)))
);
alter table session_dollar_count enable row level security;
alter table session_dollar_count force row level security;
drop policy if exists cost_read on session_dollar_count;
create policy cost_read on session_dollar_count for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
grant select on session_dollar_count to authenticated;
drop trigger if exists session_dollar_count_append_only on session_dollar_count;
create trigger session_dollar_count_append_only before update or delete on session_dollar_count
  for each row execute function forbid_mutation();

-- Dollars counted: whole dollars, and the notes, when given, adding up to them.
create or replace function counted_dollars(p_counted numeric, p_notes jsonb) returns numeric
language plpgsql immutable set search_path = public as $$
declare v_sum numeric := 0; r record; n numeric;
begin
  if p_counted is null or p_counted < 0 or p_counted <> trunc(p_counted) then
    raise exception 'Enter the dollars you counted, in whole dollars';
  end if;
  if p_notes is null or p_notes = '{}'::jsonb then return trim_scale(p_counted); end if;
  if jsonb_typeof(p_notes) <> 'object' then raise exception 'The dollar notes counted cannot be read'; end if;
  for r in select key, value from jsonb_each(p_notes) loop
    if r.key !~ '^[0-9]+$' or jsonb_typeof(r.value) <> 'number' then
      raise exception 'The dollar notes counted cannot be read';
    end if;
    n := (r.value #>> '{}')::numeric;
    if r.key::numeric <= 0 or n < 0 or n <> trunc(n) then
      raise exception 'The dollar notes counted cannot be read';
    end if;
    v_sum := v_sum + r.key::numeric * n;
  end loop;
  if v_sum <> p_counted then
    raise exception 'The dollar notes counted come to $%, not the $% entered', trim_scale(v_sum), trim_scale(p_counted);
  end if;
  return trim_scale(p_counted);
end $$;

-- A session just closed: its till's dollars counted (p_counted) and taken to
-- the safe, in one journal, or, not counted, left in the till.
create or replace function close_session_dollars(p_business uuid, p_session uuid, p_by uuid, p_counted numeric,
                                                 p_notes jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  s work_shift; h record; v_counted numeric; v_var numeric; v_rate numeric; v_taken_value numeric;
  v_var_value numeric; v_journal uuid;
begin
  select * into s from work_shift where id = p_session and business_id = p_business and kind = 'session';
  if not found then raise exception 'Session not found'; end if;
  perform lock_dollars(p_business);
  h := fx_place_balance(p_business, 'till', s.location_id);
  if p_counted is null then
    if h.usd = 0 and h.value = 0 then return '{}'::jsonb; end if;
    insert into session_dollar_count (work_shift_id, business_id, location_id, expected, counted_by)
    values (p_session, p_business, s.location_id, h.usd, p_by);
    return jsonb_build_object('usd_carried', h.usd);
  end if;
  v_counted := counted_dollars(p_counted, p_notes);
  if v_counted = 0 and h.usd = 0 and h.value = 0 then
    return jsonb_build_object('usd_expected', 0, 'usd_counted', 0, 'usd_variance', 0, 'usd_taken', 0);
  end if;
  v_var := v_counted - h.usd;
  -- What the dollars counted are worth: what the till holds them at; fewer,
  -- less the share of those missing; more, the rest at its average, or at the
  -- rate if it held none.
  if v_counted = 0 then
    v_taken_value := 0;
  elsif v_var <= 0 then
    v_taken_value := h.value - fx_value_out(p_business, h.usd, h.value, -v_var);
  else
    v_rate := case when h.usd > 0 then round(h.value / h.usd, 4) else (usd_rate_row(p_business)).rate end;
    v_taken_value := h.value + money_round(p_business, v_var * coalesce(v_rate, 0));
  end if;
  v_var_value := v_taken_value - h.value;
  if v_var <> 0 or v_var_value <> 0 then
    insert into fx_cash_event (business_id, location_id, place, kind, usd, value, rate, reference_type, reference_id,
                               work_shift_id, created_by)
    values (p_business, s.location_id, 'till', 'count', v_var, v_var_value, v_rate, 'session_dollars', p_session,
            p_session, p_by);
  end if;
  if v_counted > 0 then
    insert into fx_cash_event (business_id, location_id, place, kind, usd, value, reference_type, reference_id,
                               work_shift_id, created_by)
    values (p_business, s.location_id, 'till', 'take', -v_counted, -v_taken_value, 'session_dollars', p_session,
            p_session, p_by),
           (p_business, s.location_id, 'safe', 'take', v_counted, v_taken_value, 'session_dollars', p_session,
            p_session, p_by);
  end if;
  if v_var_value <> 0 or v_taken_value <> 0 then
    v_journal := post_journal(p_business, now(), 'Dollars counted after session ' || s.session_no || ', to the safe',
      'session_dollars', p_session,
      jsonb_build_array(signed_line('1001', v_var_value - v_taken_value), signed_line('6300', -v_var_value),
                        signed_line('1006', v_taken_value)));
  end if;
  insert into session_dollar_count (work_shift_id, business_id, location_id, expected, counted, variance,
                                    variance_value, taken, taken_value, denominations, journal_entry_id, counted_by)
  values (p_session, p_business, s.location_id, h.usd, v_counted, v_var, v_var_value, v_counted, v_taken_value,
          nullif(p_notes, '{}'::jsonb), v_journal, p_by);
  return jsonb_build_object('usd_expected', h.usd, 'usd_counted', v_counted, 'usd_variance', v_var,
    'usd_variance_value', v_var_value, 'usd_taken', v_counted, 'usd_taken_value', v_taken_value,
    'usd_journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- 0036's close, hand over and a manager's close, counting the dollars too
-- (p_usd_counted, p_usd_denominations). A request from a till loaded before
-- 0043 sends neither, and is the same request as it was.
drop function if exists close_cash_session(numeric, jsonb, numeric, text, uuid, uuid, uuid);
create or replace function close_cash_session(p_counted numeric, p_denominations jsonb default null,
                                              p_left_in_drawer numeric default null, p_take_to text default null,
                                              p_session uuid default null, p_location uuid default null,
                                              p_usd_counted numeric default null,
                                              p_usd_denominations jsonb default null,
                                              p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cash.session');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('p_counted', p_counted, 'p_denominations', p_denominations,
                                    'p_left_in_drawer', p_left_in_drawer, 'p_take_to', p_take_to,
                                    'p_session', p_session, 'p_location', p_location)
                 || jsonb_strip_nulls(jsonb_build_object('p_usd_counted', p_usd_counted,
                                                         'p_usd_denominations', p_usd_denominations));
  v jsonb; v_session uuid; s work_shift;
begin
  v := idem_begin(v_business, p_idempotency_key, 'close_cash_session', v_req);
  if v is not null then return v; end if;
  if p_counted is null then raise exception 'Enter the cash you counted'; end if;
  v_session := coalesce(p_session, open_session_at(v_business, resolve_location(v_business, p_location)));
  select * into s from work_shift where id = v_session and business_id = v_business and kind = 'session';
  if not found then raise exception 'The drawer is not open'; end if;
  if s.cashier_id <> v_me and not current_has_permission('cash.session.force') then
    raise exception 'Only % or a manager closes this session', (select full_name from app_user where id = s.cashier_id)
      using errcode = '42501';
  end if;
  v := close_session_internal(v_business, v_session, v_me, p_counted, p_denominations, p_left_in_drawer, p_take_to, null);
  v := v || close_session_dollars(v_business, v_session, v_me, p_usd_counted, p_usd_denominations);
  perform audit_event(v_business, 'cash.session.close', 'work_shift', v_session::text, null, null,
    jsonb_build_object('session_no', v -> 'session_no', 'expected', v -> 'expected', 'counted', v -> 'counted',
                       'variance', v -> 'variance', 'left', v -> 'left', 'taken', v -> 'taken',
                       'taken_to', v -> 'taken_to', 'notes', p_denominations)
    || jsonb_strip_nulls(jsonb_build_object('usd_expected', v -> 'usd_expected', 'usd_counted', v -> 'usd_counted',
                                            'usd_variance', v -> 'usd_variance', 'usd_carried', v -> 'usd_carried',
                                            'usd_notes', p_usd_denominations)));
  perform idem_finish(v_business, p_idempotency_key, 'close_cash_session', v_req, v);
  return v;
end $$;

drop function if exists hand_over_session(numeric, uuid, jsonb, numeric, text, uuid, uuid);
create or replace function hand_over_session(p_counted numeric, p_to uuid, p_denominations jsonb default null,
                                             p_left_in_drawer numeric default null, p_take_to text default null,
                                             p_location uuid default null, p_usd_counted numeric default null,
                                             p_usd_denominations jsonb default null,
                                             p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cash.session');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('p_counted', p_counted, 'p_to', p_to, 'p_denominations', p_denominations,
                                    'p_left_in_drawer', p_left_in_drawer, 'p_take_to', p_take_to,
                                    'p_location', p_location)
                 || jsonb_strip_nulls(jsonb_build_object('p_usd_counted', p_usd_counted,
                                                         'p_usd_denominations', p_usd_denominations));
  v jsonb; v_next jsonb; v_location uuid; v_session uuid; s work_shift; a app_user;
begin
  v := idem_begin(v_business, p_idempotency_key, 'hand_over_session', v_req);
  if v is not null then return v; end if;
  if p_counted is null then raise exception 'Enter the cash you counted'; end if;
  v_location := resolve_location(v_business, p_location);
  perform 1 from cash_drawer where location_id = v_location and business_id = v_business and is_active for update;
  v_session := open_session_at(v_business, v_location);
  select * into s from work_shift where id = v_session;
  if not found then raise exception 'The drawer is not open'; end if;
  if s.cashier_id <> v_me and not current_has_permission('cash.session.force') then
    raise exception 'Only % or a manager closes this session', (select full_name from app_user where id = s.cashier_id)
      using errcode = '42501';
  end if;
  select * into a from app_user where id = p_to and business_id = v_business and is_active;
  if not found or not member_has_permission(a.id, 'cash.session') then
    raise exception 'Choose someone who may take the drawer';
  end if;
  if a.id = s.cashier_id then raise exception 'Hand the drawer to someone else'; end if;
  v := close_session_internal(v_business, v_session, v_me, p_counted, p_denominations, p_left_in_drawer, p_take_to, null);
  v := v || close_session_dollars(v_business, v_session, v_me, p_usd_counted, p_usd_denominations);
  v_next := open_session_internal(v_business, v_location, a.id, v_me, (v ->> 'left')::numeric, null, v_session);
  v := v || jsonb_build_object('next_session_id', v_next -> 'session_id', 'next_session_no', v_next -> 'session_no',
                               'next_cashier', a.full_name);
  perform audit_event(v_business, 'cash.session.hand_over', 'work_shift', v_session::text, null, null,
    jsonb_build_object('session_no', v -> 'session_no', 'expected', v -> 'expected', 'counted', v -> 'counted',
                       'variance', v -> 'variance', 'left', v -> 'left', 'taken', v -> 'taken',
                       'taken_to', v -> 'taken_to', 'next_session_no', v -> 'next_session_no',
                       'next_cashier', a.id, 'notes', p_denominations)
    || jsonb_strip_nulls(jsonb_build_object('usd_expected', v -> 'usd_expected', 'usd_counted', v -> 'usd_counted',
                                            'usd_variance', v -> 'usd_variance', 'usd_carried', v -> 'usd_carried',
                                            'usd_notes', p_usd_denominations)));
  perform idem_finish(v_business, p_idempotency_key, 'hand_over_session', v_req, v);
  return v;
end $$;

drop function if exists force_close_session(uuid, text, numeric, jsonb, uuid);
create or replace function force_close_session(p_session uuid, p_reason text, p_counted numeric default null,
                                               p_denominations jsonb default null,
                                               p_usd_counted numeric default null,
                                               p_usd_denominations jsonb default null,
                                               p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cash.session.force');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('p_session', p_session, 'p_reason', p_reason, 'p_counted', p_counted,
                                    'p_denominations', p_denominations)
                 || jsonb_strip_nulls(jsonb_build_object('p_usd_counted', p_usd_counted,
                                                         'p_usd_denominations', p_usd_denominations));
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'force_close_session', v_req);
  if v is not null then return v; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the session is being closed'; end if;
  v := close_session_internal(v_business, p_session, v_me, p_counted, p_denominations, null, null, trim(p_reason));
  v := v || close_session_dollars(v_business, p_session, v_me, p_usd_counted, p_usd_denominations);
  perform audit_event(v_business, 'cash.session.force_close', 'work_shift', p_session::text, trim(p_reason), null,
    jsonb_build_object('session_no', v -> 'session_no', 'expected', v -> 'expected', 'counted', v -> 'counted',
                       'variance', v -> 'variance', 'notes', p_denominations)
    || jsonb_strip_nulls(jsonb_build_object('usd_expected', v -> 'usd_expected', 'usd_counted', v -> 'usd_counted',
                                            'usd_variance', v -> 'usd_variance', 'usd_carried', v -> 'usd_carried',
                                            'usd_notes', p_usd_denominations)));
  perform idem_finish(v_business, p_idempotency_key, 'force_close_session', v_req, v);
  return v;
end $$;

-- 0036's drawer as the till shows it, with its dollars (0043).
create or replace function cash_session_status(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'cash.session', 'day.close', 'cash.view_expected');
  v_me uuid := (current_member()).id;
  v_location uuid := resolve_location(v_business, p_location);
  v_see boolean := current_has_permission('cash.view_expected');
  v_force boolean := current_has_permission('cash.session.force');
  v_may boolean := current_has_permission('cash.session');
  dr cash_drawer; s work_shift; f record; v_expected numeric; v_figures jsonb; h record;
begin
  select * into dr from cash_drawer where location_id = v_location and business_id = v_business and is_active;
  select * into s from work_shift where drawer_id = dr.id and kind = 'session' and closed_at is null;
  if s.id is not null and v_see then
    f := session_figures(s.id);
    v_expected := s.opening_counted + f.moved;
    v_figures := to_jsonb(f);
  end if;
  h := fx_place_balance(v_business, 'till', v_location);
  return jsonb_build_object(
    'location_id', v_location, 'location', (select name from location where id = v_location),
    'drawer_id', dr.id, 'drawer', dr.name,
    'open', s.id is not null,
    'session', case when s.id is not null then jsonb_build_object(
        'id', s.id, 'no', s.session_no, 'cashier_id', s.cashier_id,
        'cashier', (select full_name from app_user where id = s.cashier_id),
        'opened_at', s.opened_at, 'opened_by', (select full_name from app_user where id = s.opened_by),
        'mine', s.cashier_id = v_me) end,
    'may_open', v_may and dr.id is not null,
    'may_close', v_may and s.id is not null and (s.cashier_id = v_me or v_force),
    'may_force', v_force,
    'may_add_float', current_has_permission('day.close') or current_has_permission('accounting.post'),
    'sees_expected', v_see,
    'expected', v_expected,
    'figures', v_figures,
    -- The dollars in the till (0043): whether it holds any, to count at the
    -- close; how many and their value only for those who may see it.
    'dollars', jsonb_build_object('in_till', h.usd <> 0 or h.value <> 0,
                                  'usd', case when v_see then h.usd end, 'value', case when v_see then h.value end),
    'open_bills', (select count(*) from pos_tab
                    where business_id = v_business and location_id = v_location and status = 'open'),
    'takers', (select coalesce(jsonb_agg(jsonb_build_object('id', au.id, 'name', au.full_name) order by au.full_name),
                               '[]'::jsonb)
                 from app_user au
                where au.business_id = v_business and au.is_active and member_has_permission(au.id, 'cash.session')
                  and au.id is distinct from s.cashier_id));
end $$;

-- 0036's statement of a session, with its dollars (0043).
create or replace function cash_session_statement(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close', 'cash.view_expected', 'audit.view');
  w work_shift; v_day date;
begin
  select * into w from work_shift where id = p_session and business_id = v_business;
  if not found then raise exception 'Session not found'; end if;
  if w.closed_at is null and not current_has_permission('cash.view_expected') then
    raise exception 'What an open drawer should hold is shown once it is counted' using errcode = '42501';
  end if;
  v_day := business_local_date(v_business, w.opened_at);
  return jsonb_build_object(
    'session', (select to_jsonb(r) from cash_sessions(v_day, v_day, w.location_id) r where r.id = p_session),
    'notes', jsonb_build_object('opening', w.opening_denominations, 'closing', w.closing_denominations),
    'events', (select coalesce(jsonb_agg(jsonb_build_object(
                  'at', e.created_at, 'kind', e.kind, 'amount', e.amount, 'by', u.full_name,
                  'reference_type', e.reference_type, 'reference_id', e.reference_id,
                  'turn_no', coalesce(o.turn_no, ao.turn_no),
                  'note', coalesce(x.description, ct.note, sa.reason, sup.name, je.description))
                  order by e.created_at, e.id), '[]'::jsonb)
                 from cash_event e
                 left join app_user u on u.id = e.created_by
                 left join sales_order o on e.reference_type = 'sales_order' and o.id = e.reference_id
                 left join sale_adjustment sa on e.reference_type = 'sale_adjustment' and sa.id = e.reference_id
                 left join sales_order ao on ao.id = sa.sales_order_id
                 left join expense x on e.reference_type = 'expense' and x.id = e.reference_id
                 left join cash_transfer ct on e.reference_type = 'cash_transfer' and ct.id = e.reference_id
                 left join supplier_payment sp on e.reference_type = 'supplier_payment' and sp.id = e.reference_id
                 left join supplier sup on sup.id = sp.supplier_id
                 left join journal_entry je on e.reference_type = 'journal_entry' and je.id = e.reference_id
                where e.work_shift_id = p_session),
    'takings', (select coalesce(jsonb_agg(jsonb_build_object('at', t.created_at, 'to', t.to_place, 'amount', t.amount,
                                                              'journal_no', j.journal_no) order by t.created_at),
                                '[]'::jsonb)
                  from cash_transfer t left join journal_entry j on j.id = t.journal_entry_id
                 where t.work_shift_id = p_session and t.from_place = 'till'),
    -- The till's dollars in the session, and their count at its close (0043).
    'dollars', (select jsonb_build_object('expected', c.expected, 'counted', c.counted, 'variance', c.variance,
                                          'variance_value', c.variance_value, 'taken', c.taken,
                                          'taken_value', c.taken_value, 'notes', c.denominations,
                                          'journal_no', j.journal_no)
                  from session_dollar_count c left join journal_entry j on j.id = c.journal_entry_id
                 where c.work_shift_id = p_session),
    'dollar_events', (select coalesce(jsonb_agg(jsonb_build_object(
                         'at', e.created_at, 'kind', e.kind, 'usd', e.usd, 'value', e.value, 'rate', e.rate,
                         'by', u.full_name, 'turn_no', coalesce(o.turn_no, ao.turn_no))
                         order by e.created_at, e.kind, e.id), '[]'::jsonb)
                        from fx_cash_event e
                        left join app_user u on u.id = e.created_by
                        left join sales_order o on e.reference_type = 'sales_order' and o.id = e.reference_id
                        left join sale_adjustment sa on e.reference_type = 'sale_adjustment' and sa.id = e.reference_id
                        left join sales_order ao on ao.id = sa.sales_order_id
                       where e.work_shift_id = p_session and e.place = 'till'));
end $$;

-- ---------------------------------------------------------------------------
-- 8. Dollars exchanged for dinars
-- ---------------------------------------------------------------------------
-- Dollars from the safe or the till, exchanged for dinars into the till, the
-- safe or the bank. The dollars leave at what they were taken at; the
-- difference from the dinars received goes to 6950 Exchange differences.
create table if not exists fx_exchange (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business (id) on delete cascade,
  location_id      uuid not null references location (id),
  from_place       text not null,
  to_place         text not null,
  currency         text not null default 'USD',
  usd              numeric not null,
  value            numeric not null,
  received         numeric not null,
  difference       numeric generated always as (received - value) stored,
  note             text,
  journal_entry_id uuid references journal_entry (id),
  created_by       uuid references app_user (id),
  created_at       timestamptz not null default now(),
  constraint fx_exchange_places check (from_place in ('till', 'safe') and to_place in ('till', 'safe', 'bank')),
  constraint fx_exchange_currency check (currency = 'USD'),
  constraint fx_exchange_amounts check (usd > 0 and usd = trunc(usd) and value >= 0 and received > 0)
);
create index if not exists fx_exchange_business on fx_exchange (business_id, created_at);
alter table fx_exchange enable row level security;
alter table fx_exchange force row level security;
drop policy if exists cost_read on fx_exchange;
create policy cost_read on fx_exchange for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
grant select on fx_exchange to authenticated;
drop trigger if exists fx_exchange_append_only on fx_exchange;
create trigger fx_exchange_append_only before update or delete on fx_exchange
  for each row execute function forbid_mutation();

create or replace function exchange_dollars__run(p_from text, p_usd numeric, p_received numeric, p_to text,
                                                 p_note text, p_location uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close', 'accounting.post');
  v_me uuid := (current_member()).id;
  v_from text := lower(nullif(trim(p_from), '')); v_to text := lower(nullif(trim(p_to), ''));
  v_location uuid; v_id uuid := gen_random_uuid(); v_received numeric; h record; v_value numeric;
  v_journal uuid; v_note text := nullif(trim(p_note), '');
begin
  if v_from is null or v_from not in ('till', 'safe') then
    raise exception 'Say where the dollars come from: the till or the safe';
  end if;
  if v_to is null or v_to not in ('till', 'safe', 'bank') then
    raise exception 'Say where the dinars go: the till, the safe or the bank';
  end if;
  if p_usd is null or p_usd <= 0 or p_usd <> trunc(p_usd) then
    raise exception 'Enter the dollars exchanged, in whole dollars';
  end if;
  v_received := money_round(v_business, p_received);
  if v_received is null or v_received <= 0 or v_received <> p_received then
    raise exception 'Enter the dinars received for them';
  end if;
  if v_received / p_usd < 100 or v_received / p_usd > 100000 then
    raise exception 'That is % dinars a dollar: check the dinars received', trim_scale(round(v_received / p_usd, 2));
  end if;
  v_location := resolve_location(v_business, p_location);
  perform lock_dollars(v_business);
  h := fx_place_balance(v_business, v_from, v_location);
  if p_usd > h.usd then
    if v_from = 'safe' then
      raise exception 'The safe holds only $% in the books', trim_scale(h.usd);
    end if;
    raise exception 'The till holds only $% in the books', trim_scale(h.usd);
  end if;
  v_value := fx_value_out(v_business, h.usd, h.value, p_usd);
  v_journal := post_journal(v_business, now(), 'Dollars exchanged: $' || trim_scale(p_usd) || ' from the ' || v_from
                                               || ' for ' || trim_scale(v_received) || ' into the ' || v_to,
    'fx_exchange', v_id,
    jsonb_build_array(signed_line(payment_account(v_to), v_received),
                      signed_line(case v_from when 'till' then '1001' else '1006' end, -v_value),
                      signed_line('6950', v_value - v_received)));
  insert into fx_exchange (id, business_id, location_id, from_place, to_place, usd, value, received, note,
                           journal_entry_id, created_by)
  values (v_id, v_business, v_location, v_from, v_to, p_usd, v_value, v_received, v_note, v_journal, v_me);
  insert into fx_cash_event (business_id, location_id, place, kind, usd, value, rate, reference_type, reference_id,
                             created_by)
  values (v_business, v_location, v_from, 'exchange', -p_usd, -v_value, round(v_received / p_usd, 4),
          'fx_exchange', v_id, v_me);
  -- Dinars into the till are the drawer's, in its open session.
  if v_to = 'till' then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (v_business, v_location, 'cash_in', v_received, 'fx_exchange', v_id, v_me);
  end if;
  perform audit_event(v_business, 'fx.exchange', 'fx_exchange', v_id::text, v_note, null,
    jsonb_build_object('from', v_from, 'to', v_to, 'usd', p_usd, 'value', v_value, 'dinars', v_received,
                       'difference', v_received - v_value));
  return jsonb_build_object('exchange_id', v_id, 'from', v_from, 'to', v_to, 'usd', p_usd, 'value', v_value,
    'received', v_received, 'difference', v_received - v_value, 'rate', round(v_received / p_usd, 2),
    'left_usd', h.usd - p_usd,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

create or replace function exchange_dollars(p_from text, p_usd numeric, p_received numeric, p_to text,
                                            p_note text default null, p_location uuid default null,
                                            p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_from', p_from, 'p_usd', p_usd, 'p_received', p_received, 'p_to', p_to,
                                    'p_note', p_note, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'exchange_dollars', v_req);
  if v is not null then return v; end if;
  v := exchange_dollars__run(p_from => p_from, p_usd => p_usd, p_received => p_received, p_to => p_to,
                             p_note => p_note, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'exchange_dollars', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 9. The dollars' report
-- ---------------------------------------------------------------------------
-- (cost.view) In the dates: the dollars sales took, at which rates, and the
-- change they gave in dinars; the rates set; the dollars exchanged and the
-- difference; the counts that found a difference. Now: what the tills and the
-- safe hold, and the rate.
create or replace function report_dollars(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record; r fx_rate;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose the dates, the first before the last';
  end if;
  b := local_day_bounds(v_business, p_from, p_to);
  r := usd_rate_row(v_business);
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'rate', jsonb_build_object('rate', r.rate, 'set_at', r.effective_from,
                               'set_by', (select full_name from app_user where id = r.set_by), 'reason', r.reason),
    'taken', (select jsonb_build_object('sales', count(distinct o.id), 'usd', coalesce(sum(t.foreign_amount), 0),
                                        'value', coalesce(sum(t.received), 0), 'paid', coalesce(sum(t.amount), 0),
                                        'change', coalesce(sum(t.change_given), 0))
                from sales_order o join sales_tender t on t.sales_order_id = o.id
               where o.business_id = v_business and t.currency = 'USD' and o.status not in ('voided', 'open')
                 and o.placed_at >= b.from_ts and o.placed_at < b.to_ts),
    'by_rate', (select coalesce(jsonb_agg(jsonb_build_object('rate', x.rate, 'sales', x.sales, 'usd', x.usd,
                                                             'value', x.value) order by x.rate), '[]'::jsonb)
                  from (select t.rate, count(distinct o.id) as sales, sum(t.foreign_amount) as usd,
                               sum(t.received) as value
                          from sales_order o join sales_tender t on t.sales_order_id = o.id
                         where o.business_id = v_business and t.currency = 'USD' and o.status not in ('voided', 'open')
                           and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
                         group by t.rate) x),
    'rates', (select coalesce(jsonb_agg(jsonb_build_object('rate', f.rate, 'set_at', f.effective_from,
                                                           'set_by', u.full_name, 'reason', f.reason)
                                        order by f.effective_from desc, f.created_at desc), '[]'::jsonb)
                from fx_rate f left join app_user u on u.id = f.set_by
               where f.business_id = v_business and f.effective_from >= b.from_ts and f.effective_from < b.to_ts),
    'exchanges', (select coalesce(jsonb_agg(jsonb_build_object(
                     'id', x.id, 'at', x.created_at, 'from', x.from_place, 'to', x.to_place, 'usd', x.usd,
                     'value', x.value, 'received', x.received, 'difference', x.difference,
                     'rate', round(x.received / x.usd, 2), 'note', x.note, 'by', u.full_name,
                     'journal_no', j.journal_no) order by x.created_at desc, x.id), '[]'::jsonb)
                    from fx_exchange x left join app_user u on u.id = x.created_by
                    left join journal_entry j on j.id = x.journal_entry_id
                   where x.business_id = v_business and x.created_at >= b.from_ts and x.created_at < b.to_ts),
    'counts', (select coalesce(jsonb_agg(jsonb_build_object(
                  'session_id', c.work_shift_id, 'session_no', w.session_no, 'at', c.created_at,
                  'location', l.name, 'expected', c.expected, 'counted', c.counted, 'variance', c.variance,
                  'variance_value', c.variance_value, 'taken', c.taken, 'taken_value', c.taken_value)
                  order by c.created_at desc), '[]'::jsonb)
                 from session_dollar_count c join work_shift w on w.id = c.work_shift_id
                 join location l on l.id = c.location_id
                where c.business_id = v_business and c.created_at >= b.from_ts and c.created_at < b.to_ts),
    'differences', jsonb_build_object(
       'exchanges', (select coalesce(sum(difference), 0) from fx_exchange
                      where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts),
       'counts', (select coalesce(sum(variance_value), 0) from session_dollar_count
                   where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts)),
    'held', jsonb_build_object(
       'tills', (select coalesce(jsonb_agg(jsonb_build_object('location_id', l.id, 'location', l.name,
                                                             'usd', h.usd, 'value', h.value) order by l.name),
                                 '[]'::jsonb)
                   from location l cross join lateral fx_place_balance(v_business, 'till', l.id) h
                  where l.business_id = v_business and (h.usd <> 0 or h.value <> 0)),
       'safe', (select jsonb_build_object('usd', h.usd, 'value', h.value)
                  from fx_place_balance(v_business, 'safe', null) h)));
end $$;

-- ---------------------------------------------------------------------------
-- 10. The books: the dollars held against their accounts
-- ---------------------------------------------------------------------------
-- 0038's checks, with the dollars, and the dinars exchanged into the safe.
create or replace function reconciliation_checks(p_business uuid, p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable set search_path = public as $$
declare
  v_end timestamptz; v_settled date; v_known boolean := true; v_sum numeric := 0; d record; l record;
  v_unnumbered numeric; v_by_hand numeric;
begin
  v_end := (local_day_bounds(p_business, p_as_of, p_as_of)).to_ts;

  check_key := 'inventory'; label := 'Stock ledger vs Inventory (1200)';
  select coalesce(sum(value * sign(base_quantity_signed)), 0) into subledger
    from inventory_movement where business_id = p_business and occurred_at < v_end;
  ledger := gl_balance_at(p_business, '1200', v_end);
  difference := subledger - ledger; return next;

  check_key := 'payables'; label := 'Unpaid bills vs Accounts payable (2000)';
  select coalesce(sum(amount_total), 0) into subledger
    from purchase_invoice where business_id = p_business and invoice_date < p_as_of + 1
                            and (cancelled_at is null or cancelled_at >= v_end);
  subledger := subledger - coalesce((select sum(amount) from supplier_payment
                                      where business_id = p_business and paid_on < p_as_of + 1), 0);
  -- Receipts the old app posted straight to A/P are owed until their bill is recorded.
  subledger := subledger + coalesce((select sum(receipt_legacy_payable(r.id, v_end)) from goods_receipt r
                                      where r.business_id = p_business and r.received_at < v_end
                                        and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id
                                                          and p.invoice_date < p_as_of + 1
                                                          and (p.cancelled_at is null or p.cancelled_at >= v_end))), 0);
  ledger := -gl_balance_at(p_business, '2000', v_end);
  difference := subledger - ledger; return next;

  check_key := 'grni'; label := 'Unbilled receipts vs Goods received not invoiced (2050)';
  select coalesce(sum(receipt_grni_value_at(r.id, v_end)), 0) into subledger
    from goods_receipt r
   where r.business_id = p_business and r.received_at < v_end
     and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id and p.invoice_date < p_as_of + 1
                        and (p.cancelled_at is null or p.cancelled_at >= v_end));
  ledger := -gl_balance_at(p_business, '2050', v_end);
  difference := subledger - ledger; return next;

  check_key := 'sales'; label := 'Sales recorded vs net revenue in the ledger (4000 less 4100 and 4200)';
  select coalesce(sum(net_amount), 0) into subledger
    from sales_order where business_id = p_business and status <> 'voided' and status <> 'open' and placed_at < v_end;
  subledger := subledger - coalesce((select sum(amount) from sale_adjustment
                                      where business_id = p_business and kind = 'refund' and created_at < v_end), 0);
  ledger := -(gl_balance_at(p_business, '4000', v_end) + gl_balance_at(p_business, '4100', v_end)
              + gl_balance_at(p_business, '4200', v_end));
  difference := subledger - ledger; return next;

  -- Card: what the till took by card on the days not yet settled (0030),
  -- against Card clearing. What else sits in 1010 was posted on a day
  -- already settled, and no settlement will ever take it.
  check_key := 'card'; label := 'Card takings not yet settled vs Card clearing (1010)';
  select max(s.covers_to) into v_settled
    from card_settlement s join journal_entry j on j.id = s.journal_entry_id
   where s.business_id = p_business and j.occurred_at < v_end
     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end);
  select coalesce(sum(jl.debit - jl.credit), 0) into subledger
    from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
   where e.business_id = p_business and e.status = 'published' and g.code = '1010' and e.occurred_at < v_end
     and e.reference_type is distinct from 'card_settlement'
     and not (e.reference_type = 'reversal'
              and exists (select 1 from journal_entry o where o.id = e.reverses_entry and o.reference_type = 'card_settlement'))
     and (v_settled is null or business_local_date(p_business, e.occurred_at) > v_settled);
  ledger := gl_balance_at(p_business, '1010', v_end);
  difference := subledger - ledger; return next;

  -- Platforms: each platform order not voided, less what was refunded of it
  -- and what a statement has paid out for it, against what they owe (1100).
  -- The platform sales from before order numbers (0030) are on no statement:
  -- a payout typed by hand into 1100 is what explains them, as far as they
  -- go (docs/LIMITATIONS.md). A payout typed by hand beyond them is flagged.
  check_key := 'platform'; label := 'Orders the platforms owe vs Receivable from platforms (1100)';
  select coalesce(sum(o.net_amount
                      - coalesce((select sum(a.amount) from sale_adjustment a
                                   where a.sales_order_id = o.id and a.kind = 'refund' and a.created_at < v_end), 0)
                      - coalesce((select sum(sl.expected) from platform_settlement_line sl
                                    join platform_settlement s on s.id = sl.settlement_id
                                    join journal_entry j on j.id = s.journal_entry_id
                                   where sl.sales_order_id = o.id and sl.status = 'matched' and j.occurred_at < v_end
                                     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id
                                                       and rv.occurred_at < v_end)), 0)), 0)
    into subledger
    from platform_order po join sales_order o on o.id = po.sales_order_id
   where po.business_id = p_business and o.placed_at < v_end and o.status <> 'open'
     and not exists (select 1 from sale_adjustment a where a.sales_order_id = o.id and a.kind = 'void'
                       and a.created_at < v_end);
  select coalesce(sum(o.net_amount - coalesce((select sum(a.amount) from sale_adjustment a
                                                where a.sales_order_id = o.id and a.kind = 'refund'
                                                  and a.created_at < v_end), 0)), 0)
    into v_unnumbered
    from sales_order o
   where o.business_id = p_business and o.placed_at < v_end and o.status <> 'open'
     and exists (select 1 from sales_tender t where t.sales_order_id = o.id and t.tender_type = 'platform_paid')
     and not exists (select 1 from platform_order po where po.sales_order_id = o.id)
     and not exists (select 1 from sale_adjustment a where a.sales_order_id = o.id and a.kind = 'void'
                       and a.created_at < v_end);
  select coalesce(sum(jl.debit - jl.credit), 0) into v_by_hand
    from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
   where e.business_id = p_business and e.status = 'published' and g.code = '1100' and e.occurred_at < v_end
     and e.reference_type is distinct from 'sales_order' and e.reference_type is distinct from 'sale_refund'
     and e.reference_type is distinct from 'platform_settlement'
     and not (e.reference_type = 'reversal'
              and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                            and o.reference_type in ('sales_order', 'sale_refund', 'platform_settlement')));
  subledger := subledger + greatest(v_unnumbered + v_by_hand, 0);
  ledger := gl_balance_at(p_business, '1100', v_end);
  difference := subledger - ledger; return next;

  -- The drawers: what each should hold, from its counts and its cash since,
  -- against Cash in the till. Before a drawer is first counted in a session,
  -- the books are all there is (the first opening settles the difference, 0036).
  for l in select id from location where business_id = p_business loop
    d := drawer_position_at(p_business, l.id, v_end);
    if not d.known then v_known := false; end if;
    v_sum := v_sum + coalesce(d.amount, 0);
  end loop;
  -- Nothing to hold the books to until some drawer has been counted.
  if not exists (select 1 from work_shift w
                  where w.business_id = p_business
                    and ((w.kind = 'session' and w.opened_at < v_end) or (w.kind = 'drawer' and w.closed_at < v_end))) then
    v_known := false;
  end if;
  check_key := 'drawer';
  ledger := gl_balance_at(p_business, '1000', v_end);
  if v_known then
    label := 'What the drawers should hold vs Cash in the till (1000)';
    subledger := v_sum;
  else
    label := 'What the drawers should hold vs Cash in the till (1000): not yet counted, the first opening settles it';
    subledger := ledger;
  end if;
  difference := subledger - ledger; return next;

  -- The safe: cash moved in and out of it, expenses and bills paid from it,
  -- and dinars from dollars exchanged into it (0043), against the Safe (1005).
  check_key := 'safe'; label := 'Cash moved in and out of the safe vs Safe (1005)';
  select coalesce(sum(case when t.to_place = 'safe' then t.amount else -t.amount end), 0) into subledger
    from cash_transfer t join journal_entry j on j.id = t.journal_entry_id
   where t.business_id = p_business and 'safe' in (t.from_place, t.to_place) and j.occurred_at < v_end;
  subledger := subledger + coalesce((
    select sum(jl.debit - jl.credit)
      from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
     where e.business_id = p_business and e.status = 'published' and g.code = '1005' and e.occurred_at < v_end
       and (e.reference_type in ('expense', 'supplier_payment', 'fx_exchange')
            or (e.reference_type = 'reversal'
                and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                              and o.reference_type in ('expense', 'supplier_payment'))))), 0);
  ledger := gl_balance_at(p_business, '1005', v_end);
  difference := subledger - ledger; return next;

  -- The dollars (0043): what the till and the safe hold, at what they were
  -- taken at, against Cash in dollars (1001 and 1006).
  check_key := 'dollars'; label := 'Dollars held, at what they were taken at, vs Cash in dollars (1001 and 1006)';
  select coalesce(sum(value), 0) into subledger
    from fx_cash_event where business_id = p_business and created_at < v_end;
  ledger := gl_balance_at(p_business, '1001', v_end) + gl_balance_at(p_business, '1006', v_end);
  difference := subledger - ledger; return next;

  -- The records themselves: how many lack their journal, or are journals
  -- lacking their record.
  check_key := 'documents'; label := 'Every record has its one journal, and every automatic journal its record';
  select count(*) into subledger from document_problems(p_business, v_end);
  ledger := 0;
  difference := subledger; return next;
end $$;

-- 0038's records to look into, with a drawer's dollars and their exchanges.
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
           when 'platform_settlement' then 'platform statement'
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
           when 'card_settlement' then not exists (select 1 from card_settlement x where x.id = j.reference_id)
           when 'platform_settlement' then not exists (select 1 from platform_settlement x where x.id = j.reference_id)
           else false end;
end $$;

-- 0038's hints, with the dollars.
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
    when 'cash_transfer' then 'a movement of cash (move it back instead)'
    when 'reversal' then 'a reversal (post the entry again instead)'
    when 'card_settlement' then 'a card settlement (cancel it on Sales)'
    when 'platform_settlement' then 'a platform settlement (cancel it on Delivery Platforms)'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- ---------------------------------------------------------------------------
-- 11. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  provision_chart_of_accounts(uuid), usd_rate_row(uuid), usd_rate_now(uuid), usd_value(uuid, numeric, numeric),
  set_fx_rate__run(text, numeric, text), trg_fx_cash_event_session(), fx_place_balance(uuid, text, uuid),
  fx_value_out(uuid, numeric, numeric, numeric), lock_dollars(uuid), order_payments(uuid),
  sale_payments(uuid, sales_channel, tender_type, jsonb), sale_dollars(uuid, jsonb),
  post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb, int, uuid,
            jsonb, numeric),
  trg_cash_from_tender(), trg_cash_from_adjustment(), counted_dollars(numeric, jsonb),
  close_session_dollars(uuid, uuid, uuid, numeric, jsonb), exchange_dollars__run(text, numeric, numeric, text, text, uuid),
  reconciliation_checks(uuid, date), document_problems(uuid, timestamptz), journal_source_hint(text),
  manual_journal_blocked(text), rule_definitions(), rule_defaults(uuid)
  from public, anon, authenticated;
revoke execute on function
  set_fx_rate(text, numeric, text, uuid), fx_status(),
  close_cash_session(numeric, jsonb, numeric, text, uuid, uuid, numeric, jsonb, uuid),
  hand_over_session(numeric, uuid, jsonb, numeric, text, uuid, numeric, jsonb, uuid),
  force_close_session(uuid, text, numeric, jsonb, numeric, jsonb, uuid),
  cash_session_status(uuid), cash_session_statement(uuid),
  exchange_dollars(text, numeric, numeric, text, text, uuid, uuid), report_dollars(date, date)
  from public, anon;
grant execute on function
  set_fx_rate(text, numeric, text, uuid), fx_status(),
  close_cash_session(numeric, jsonb, numeric, text, uuid, uuid, numeric, jsonb, uuid),
  hand_over_session(numeric, uuid, jsonb, numeric, text, uuid, numeric, jsonb, uuid),
  force_close_session(uuid, text, numeric, jsonb, numeric, jsonb, uuid),
  cash_session_status(uuid), cash_session_statement(uuid),
  exchange_dollars(text, numeric, numeric, text, text, uuid, uuid), report_dollars(date, date)
  to authenticated;
