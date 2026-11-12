-- 0103: a supplier bill in dollars and dinars (plan 5 A; plan 6, item 3).
--
-- The owner's decisions (12 November): the books stay in dinars; every dollar
-- line keeps its dollar amount and rate beside the dinars; a supplier's
-- balance in two columns, the dollar debt followed in dollars; a dollar debt
-- paid in dollars (from the till or the safe) or in dinars at a rate typed
-- then, the difference to 6950 by itself; what is still owed in dollars
-- valued again at month close at a rate typed once (IAS 21), the difference
-- recorded. No daily rate: each record takes its own, typed at the time.
--
--   * `purchase_invoice.usd_amount` and `usd_rate`: the dollar part of a bill
--     and the rate it was booked at; `usd_paid` the dollars settled since;
--     `usd_value` what the dollars still owed are carried at in dinars, and
--     `usd_carried_rate` the rate that is (the booking's, or the last
--     revaluation's). The bill's total is its dinar part and its dollar part's
--     value; what is still owed in dinars alone is the total, less what was
--     paid, less `usd_value`.
--   * `record_dollar_bill`: a bill with a dollar part (`p_usd`, `p_rate`;
--     `p_amount` its dinar part, none for a bill all in dollars).
--   * `pay_bill_dollars`: the dollars owed, handed over from the till or the
--     safe (at what they are held at), or dinars for them at the rate typed;
--     the difference from what they were carried at goes to 6950. `pay_bill`
--     pays the dinars owed, as before.
--   * `revalue_dollar_bills(rate, reason)`: what is still owed in dollars,
--     carried again at the rate typed; the change to 6950, in one journal.
--
-- Nothing recorded changes: a bill before 0103 has no dollar part.

-- -----------------------------------------------------------------------------
-- 1. A bill's dollar part
-- -----------------------------------------------------------------------------
alter table purchase_invoice add column if not exists usd_amount numeric(14, 2) not null default 0;
alter table purchase_invoice add column if not exists usd_rate numeric(12, 4);
alter table purchase_invoice add column if not exists usd_paid numeric(14, 2) not null default 0;
alter table purchase_invoice add column if not exists usd_value numeric(18, 4) not null default 0;
alter table purchase_invoice add column if not exists usd_carried_rate numeric(12, 4);
alter table purchase_invoice drop constraint if exists purchase_invoice_usd;
alter table purchase_invoice add constraint purchase_invoice_usd check (
  usd_amount >= 0 and usd_paid >= 0 and usd_paid <= usd_amount and usd_value >= 0
  and (usd_amount = 0) = (usd_rate is null) and (usd_rate is null or usd_rate > 0)
  and (usd_amount = 0 or usd_carried_rate > 0));

alter table supplier_payment add column if not exists currency text not null default 'IQD';
alter table supplier_payment add column if not exists usd numeric(14, 2);
alter table supplier_payment add column if not exists rate numeric(12, 4);
alter table supplier_payment drop constraint if exists supplier_payment_usd;
alter table supplier_payment add constraint supplier_payment_usd check (
  currency in ('IQD', 'USD') and (usd is null or usd > 0) and (currency = 'IQD' or usd is not null));

-- Dollars handed to a supplier leave the till or the safe as their own kind.
alter table fx_cash_event drop constraint if exists fx_cash_event_kind;
alter table fx_cash_event drop constraint if exists fx_cash_event_kind_check;
alter table fx_cash_event add constraint fx_cash_event_kind
  check (kind in ('sale', 'void', 'count', 'take', 'exchange', 'supplier'));

-- 0044's bill guard: besides what was paid and a cancelling, the dollars
-- settled and their value change with each payment; and the total and the
-- dollars' value change only by revaluing them (sixties.fx_revalue). A new
-- bill takes its dollar part from the bill being recorded (sixties.bill_usd).
create or replace function trg_purchase_invoice_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_usd jsonb := nullif(current_setting('sixties.bill_usd', true), '')::jsonb;
        v_revalue boolean := coalesce(current_setting('sixties.fx_revalue', true), '') = 'on';
begin
  if TG_OP = 'DELETE' then
    raise exception 'Bills are append-only; record a credit note instead' using errcode = 'check_violation';
  end if;
  if TG_OP = 'INSERT' then
    NEW.legacy := false;
    NEW.cancelled_at := null;
    NEW.cancel_reason := null;
    if v_usd is not null and (v_usd ->> 'usd')::numeric > 0 then
      NEW.usd_amount := (v_usd ->> 'usd')::numeric;
      NEW.usd_rate := (v_usd ->> 'rate')::numeric;
      NEW.usd_carried_rate := (v_usd ->> 'rate')::numeric;
      NEW.usd_value := (v_usd ->> 'value')::numeric;
    else
      NEW.usd_amount := 0; NEW.usd_rate := null; NEW.usd_carried_rate := null; NEW.usd_value := 0;
    end if;
    NEW.usd_paid := 0;
  elsif (to_jsonb(NEW) - 'paid_amount' - 'is_paid' - 'cancelled_at' - 'cancel_reason' - 'usd_paid' - 'usd_value'
         - 'usd_carried_rate' - 'amount_total')
        is distinct from (to_jsonb(OLD) - 'paid_amount' - 'is_paid' - 'cancelled_at' - 'cancel_reason' - 'usd_paid'
         - 'usd_value' - 'usd_carried_rate' - 'amount_total') then
    raise exception 'A bill''s supplier, number, date and amount cannot change' using errcode = 'check_violation';
  elsif (NEW.amount_total, NEW.usd_carried_rate) is distinct from (OLD.amount_total, OLD.usd_carried_rate)
        and not v_revalue then
    raise exception 'A bill''s supplier, number, date and amount cannot change' using errcode = 'check_violation';
  elsif (NEW.cancelled_at, NEW.cancel_reason) is distinct from (OLD.cancelled_at, OLD.cancel_reason) then
    -- Cancelling is one-way, needs a reason, and only for a bill nothing was paid on or set against.
    if OLD.cancelled_at is not null then
      raise exception 'This bill is already cancelled' using errcode = 'check_violation';
    end if;
    if NEW.cancelled_at is null or nullif(trim(NEW.cancel_reason), '') is null then
      raise exception 'Cancelling a bill needs a date and a reason' using errcode = 'check_violation';
    end if;
    if exists (select 1 from supplier_payment where purchase_invoice_id = NEW.id) then
      raise exception 'A bill with payments against it cannot be cancelled' using errcode = 'check_violation';
    end if;
    if exists (select 1 from supplier_credit_allocation where purchase_invoice_id = NEW.id) then
      raise exception 'A bill with credits set against it cannot be cancelled' using errcode = 'check_violation';
    end if;
  end if;
  NEW.paid_amount := coalesce((select sum(amount) from supplier_payment where purchase_invoice_id = NEW.id), 0)
                     + coalesce((select sum(amount) from supplier_credit_allocation where purchase_invoice_id = NEW.id), 0);
  NEW.usd_paid := coalesce((select sum(usd) from supplier_payment where purchase_invoice_id = NEW.id), 0);
  NEW.is_paid := NEW.paid_amount >= NEW.amount_total;
  if NEW.paid_amount > NEW.amount_total then
    raise exception 'Payments of % would exceed the bill total of %', NEW.paid_amount, NEW.amount_total
      using errcode = 'check_violation';
  end if;
  if NEW.usd_paid > NEW.usd_amount then
    raise exception 'Payments of $% would exceed the $% owed in dollars', NEW.usd_paid, NEW.usd_amount
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

-- What a bill still owes: in dinars alone, and in dollars (with what they are carried at).
create or replace function bill_owed(b purchase_invoice) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'iqd', b.amount_total - b.paid_amount - b.usd_value,
    'usd', b.usd_amount - b.usd_paid,
    'usd_value', b.usd_value,
    'usd_rate', b.usd_carried_rate,
    'total', b.amount_total - b.paid_amount)
$$;

-- -----------------------------------------------------------------------------
-- 2. A bill with a dollar part
-- -----------------------------------------------------------------------------
-- A rate typed with a record, as the database checks it.
create or replace function usd_rate_ok(p_rate numeric) returns numeric
language plpgsql immutable set search_path = public as $$
begin
  if p_rate is null or p_rate <= 0 then raise exception 'Type the dollar''s rate, in dinars'; end if;
  if p_rate < 100 or p_rate > 100000 then
    raise exception 'That is % dinars a dollar: check the rate', trim_scale(p_rate);
  end if;
  return round(p_rate, 4);
end $$;

-- A bill with a dollar part: 0035's record_bill for its dinars and the
-- dollars' value, the dollars and their rate kept beside them.
create or replace function record_dollar_bill__run(p_supplier uuid, p_invoice_no text, p_invoice_date date,
  p_amount numeric, p_usd numeric, p_rate numeric, p_term_days int, p_receipt uuid, p_account_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_usd numeric := coalesce(p_usd, 0); v_rate numeric; v_value numeric; v_dinars numeric := coalesce(p_amount, 0); v jsonb;
begin
  if v_usd <= 0 or v_usd <> round(v_usd, 2) then
    raise exception 'Enter the dollars owed, in dollars and cents';
  end if;
  if v_dinars < 0 then raise exception 'Enter the dinars owed, or none'; end if;
  v_rate := usd_rate_ok(p_rate);
  v_value := money_round(v_business, v_usd * v_rate);
  perform set_config('sixties.bill_usd', jsonb_build_object('usd', v_usd, 'rate', v_rate, 'value', v_value)::text, true);
  v := record_bill__run(p_supplier => p_supplier, p_invoice_no => p_invoice_no, p_invoice_date => p_invoice_date,
                        p_amount => v_dinars + v_value, p_term_days => coalesce(p_term_days, 0), p_receipt => p_receipt,
                        p_account_code => p_account_code);
  perform set_config('sixties.bill_usd', '', true);
  perform audit_event(v_business, 'purchase.bill', 'purchase_invoice', v->>'bill_id', null, null,
    jsonb_build_object('invoice_no', v->'invoice_no', 'supplier', p_supplier, 'amount', v_dinars + v_value,
                       'receipt_no', (select receipt_no from goods_receipt where id = p_receipt),
                       'account', p_account_code, 'usd', v_usd, 'rate', v_rate, 'dinars', v_dinars));
  return v || jsonb_build_object('usd', v_usd, 'rate', v_rate, 'usd_value', v_value, 'dinars', v_dinars);
end $$;

create or replace function record_dollar_bill(p_supplier uuid, p_invoice_no text, p_invoice_date date,
  p_amount numeric, p_usd numeric, p_rate numeric, p_term_days int default 0, p_receipt uuid default null,
  p_account_code text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_supplier', p_supplier, 'p_invoice_no', p_invoice_no,
    'p_invoice_date', p_invoice_date, 'p_amount', p_amount, 'p_usd', p_usd, 'p_rate', p_rate,
    'p_term_days', p_term_days, 'p_receipt', p_receipt, 'p_account_code', p_account_code);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_dollar_bill', v_req);
  if v is not null then return v; end if;
  v := record_dollar_bill__run(p_supplier, p_invoice_no, p_invoice_date, p_amount, p_usd, p_rate, p_term_days,
                               p_receipt, p_account_code);
  perform idem_finish(v_business, p_idempotency_key, 'record_dollar_bill', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Paying it: the dinars as before; the dollars in dollars, or in dinars at a rate
-- -----------------------------------------------------------------------------
-- 0055's pay_bill__run: the dinars owed are paid in dinars; the dollars, apart.
create or replace function pay_bill__run(p_bill uuid, p_amount numeric, p_method text, p_location uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  b purchase_invoice; v_amount numeric; v_pay uuid := gen_random_uuid(); v_journal uuid;
  v_from text := lower(coalesce(p_method, '')); v_location uuid;
begin
  if v_from = 'cash' then v_from := 'till'; elsif v_from = 'transfer' then v_from := 'bank'; end if;
  select * into b from purchase_invoice where id = p_bill and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if b.cancelled_at is not null then raise exception 'That bill was cancelled; it is not owed'; end if;
  if v_from not in ('till', 'safe', 'bank', 'card', 'owner') then
    raise exception 'Say where the money came from: the till, the safe, the bank, a card or the owner';
  end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if v_amount > b.amount_total - b.paid_amount - b.usd_value then
    if b.usd_amount > b.usd_paid then
      raise exception 'That is more than the % owed in dinars on this bill: pay its $% in dollars, or in dinars at a rate',
        b.amount_total - b.paid_amount - b.usd_value, b.usd_amount - b.usd_paid;
    end if;
    raise exception 'That is more than the % outstanding on this bill', b.amount_total - b.paid_amount;
  end if;
  v_location := resolve_location(v_business, p_location);
  v_journal := post_journal(v_business, now(), 'Payment — bill ' || coalesce(b.invoice_no, ''), 'supplier_payment', v_pay,
    jsonb_build_array(jsonb_build_object('code', '2000', 'debit', v_amount),
                      jsonb_build_object('code', payment_account(v_from), 'credit', v_amount)));
  insert into supplier_payment (id, business_id, supplier_id, purchase_invoice_id, amount, paid_on, method, journal_entry_id)
  values (v_pay, v_business, b.supplier_id, b.id, v_amount, business_local_date(v_business, now()), v_from, v_journal);
  perform pay_out_of(v_business, v_location, v_from, v_amount, 'supplier_payment', v_pay, v_me);
  return jsonb_build_object('payment_id', v_pay, 'journal_no', (select journal_no from journal_entry where id = v_journal),
    'outstanding', (select amount_total - paid_amount from purchase_invoice where id = p_bill),
    'owed', bill_owed((select x from purchase_invoice x where x.id = p_bill)));
end $$;

create or replace function pay_bill_dollars__run(p_bill uuid, p_usd numeric, p_currency text, p_rate numeric,
                                                 p_method text, p_location uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  b purchase_invoice; v_pay uuid := gen_random_uuid(); v_journal uuid;
  v_from text := lower(coalesce(p_method, '')); v_location uuid;
  v_usd numeric := p_usd; v_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'IQD'));
  v_owed_usd numeric; v_carried numeric; v_out numeric; v_rate numeric; h record; v_desc text;
begin
  if v_from = 'cash' then v_from := 'till'; elsif v_from = 'transfer' then v_from := 'bank'; end if;
  select * into b from purchase_invoice where id = p_bill and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if b.cancelled_at is not null then raise exception 'That bill was cancelled; it is not owed'; end if;
  if v_from not in ('till', 'safe', 'bank', 'card', 'owner') then
    raise exception 'Say where the money came from: the till, the safe, the bank, a card or the owner';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_desc := 'Payment — bill ' || coalesce(b.invoice_no, '');
  v_owed_usd := b.usd_amount - b.usd_paid;
  if v_usd is null or v_usd <= 0 or v_usd <> round(v_usd, 2) then
    raise exception 'Enter the dollars paid, in dollars and cents';
  end if;
  if v_owed_usd <= 0 then raise exception 'Nothing is owed in dollars on this bill'; end if;
  if v_usd > v_owed_usd then
    raise exception 'That is more than the $% owed in dollars on this bill', trim_scale(v_owed_usd);
  end if;
  -- What the dollars paid were carried at leaves the payable.
  v_carried := case when v_usd = v_owed_usd then b.usd_value
                    else money_round(v_business, b.usd_value * v_usd / v_owed_usd) end;
  if v_currency = 'USD' then
    -- Dollars handed over, from the till or the safe, at what they are held at.
    if v_from not in ('till', 'safe') then
      raise exception 'Dollars are paid from the till or the safe: from the bank, pay them in dinars at the rate';
    end if;
    if v_usd <> trunc(v_usd) then raise exception 'Dollars are handed over in whole dollars'; end if;
    perform lock_dollars(v_business);
    h := fx_place_balance(v_business, v_from, v_location);
    if v_usd > h.usd then
      if v_from = 'safe' then raise exception 'The safe holds only $% in the books', trim_scale(h.usd); end if;
      raise exception 'The till holds only $% in the books', trim_scale(h.usd);
    end if;
    v_out := fx_value_out(v_business, h.usd, h.value, v_usd);
    v_rate := round(v_out / v_usd, 4);
    v_journal := post_journal(v_business, now(), v_desc || ': $' || trim_scale(v_usd), 'supplier_payment', v_pay,
      jsonb_build_array(signed_line('2000', v_carried),
                        signed_line(case v_from when 'till' then '1001' else '1006' end, -v_out),
                        signed_line('6950', v_out - v_carried)));
    insert into supplier_payment (id, business_id, supplier_id, purchase_invoice_id, amount, paid_on, method,
                                  journal_entry_id, currency, usd, rate)
    values (v_pay, v_business, b.supplier_id, b.id, v_carried, business_local_date(v_business, now()), v_from,
            v_journal, 'USD', v_usd, v_rate);
    insert into fx_cash_event (business_id, location_id, place, kind, usd, value, rate, reference_type, reference_id,
                               created_by)
    values (v_business, v_location, v_from, 'supplier', -v_usd, -v_out, v_rate, 'supplier_payment', v_pay, v_me);
  elsif v_currency = 'IQD' then
    -- Dinars for the dollars owed, at the rate typed now.
    v_rate := usd_rate_ok(p_rate);
    v_out := money_round(v_business, v_usd * v_rate);
    v_journal := post_journal(v_business, now(), v_desc || ': $' || trim_scale(v_usd) || ' at ' || trim_scale(v_rate),
      'supplier_payment', v_pay,
      jsonb_build_array(signed_line('2000', v_carried),
                        signed_line(payment_account(v_from), -v_out),
                        signed_line('6950', v_out - v_carried)));
    insert into supplier_payment (id, business_id, supplier_id, purchase_invoice_id, amount, paid_on, method,
                                  journal_entry_id, currency, usd, rate)
    values (v_pay, v_business, b.supplier_id, b.id, v_carried, business_local_date(v_business, now()), v_from,
            v_journal, 'IQD', v_usd, v_rate);
    perform pay_out_of(v_business, v_location, v_from, v_out, 'supplier_payment', v_pay, v_me);
  else
    raise exception 'Pay it in dollars or in dinars';
  end if;
  -- What is still owed in dollars is carried at the rest of their value.
  update purchase_invoice set usd_value = usd_value - v_carried where id = b.id;
  perform audit_event(v_business, 'purchase.pay', 'purchase_invoice', p_bill::text, null, null,
    jsonb_build_object('invoice_no', b.invoice_no, 'amount', v_out, 'paid_from', v_from, 'usd', v_usd,
                       'currency', v_currency, 'rate', v_rate, 'difference', v_out - v_carried));
  return jsonb_build_object('payment_id', v_pay, 'journal_no', (select journal_no from journal_entry where id = v_journal),
    'usd', v_usd, 'paid', v_out, 'rate', v_rate, 'carried', v_carried, 'difference', v_out - v_carried,
    'outstanding', (select amount_total - paid_amount from purchase_invoice where id = p_bill),
    'owed', bill_owed((select x from purchase_invoice x where x.id = p_bill)));
end $$;

create or replace function pay_bill_dollars(p_bill uuid, p_usd numeric, p_currency text, p_rate numeric,
                                            p_method text, p_location uuid default null,
                                            p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_bill', p_bill, 'p_usd', p_usd, 'p_currency', p_currency, 'p_rate', p_rate,
                                    'p_method', p_method, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'pay_bill_dollars', v_req);
  if v is not null then return v; end if;
  v := pay_bill_dollars__run(p_bill, p_usd, p_currency, p_rate, p_method, p_location);
  perform idem_finish(v_business, p_idempotency_key, 'pay_bill_dollars', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 4. What is still owed in dollars, valued again
-- -----------------------------------------------------------------------------
create table if not exists fx_revaluation (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business (id) on delete cascade,
  rate             numeric(12, 4) not null check (rate > 0),
  usd              numeric(14, 2) not null,
  difference       numeric(18, 4) not null,
  bills            int not null,
  reason           text not null,
  journal_entry_id uuid references journal_entry (id),
  created_by       uuid references app_user (id),
  created_at       timestamptz not null default now()
);
alter table fx_revaluation enable row level security;
alter table fx_revaluation force row level security;
revoke all on fx_revaluation from public, anon, authenticated;

create or replace function revalue_dollar_bills__run(p_rate numeric, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_rate numeric := usd_rate_ok(p_rate); v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_id uuid := gen_random_uuid(); v_journal uuid; v_total numeric := 0; v_usd numeric := 0; v_n int := 0;
  b purchase_invoice; v_new numeric; v_delta numeric;
begin
  if v_reason is null or length(v_reason) < 6 then raise exception 'Say why, in a few words'; end if;
  perform set_config('sixties.fx_revalue', 'on', true);
  for b in select * from purchase_invoice
            where business_id = v_business and cancelled_at is null and usd_amount > usd_paid
            order by invoice_date, created_at for update loop
    v_new := money_round(v_business, (b.usd_amount - b.usd_paid) * v_rate);
    v_delta := v_new - b.usd_value;
    if v_delta <> 0 or b.usd_carried_rate <> v_rate then
      update purchase_invoice
         set usd_value = v_new, usd_carried_rate = v_rate, amount_total = amount_total + v_delta
       where id = b.id;
      v_total := v_total + v_delta;
      v_usd := v_usd + (b.usd_amount - b.usd_paid);
      v_n := v_n + 1;
    end if;
  end loop;
  perform set_config('sixties.fx_revalue', '', true);
  if v_n = 0 then
    return jsonb_build_object('bills', 0, 'usd', 0, 'difference', 0, 'rate', v_rate);
  end if;
  if v_total <> 0 then
    v_journal := post_journal(v_business, now(), 'Dollars owed to suppliers valued again at ' || trim_scale(v_rate),
      'fx_revaluation', v_id,
      jsonb_build_array(signed_line('6950', v_total), signed_line('2000', -v_total)));
  end if;
  insert into fx_revaluation (id, business_id, rate, usd, difference, bills, reason, journal_entry_id, created_by)
  values (v_id, v_business, v_rate, v_usd, v_total, v_n, v_reason, v_journal, (current_member()).id);
  perform audit_event(v_business, 'fx.revalue', 'fx_revaluation', v_id::text, v_reason, null,
    jsonb_build_object('rate', v_rate, 'usd', v_usd, 'difference', v_total, 'bills', v_n));
  return jsonb_build_object('revaluation_id', v_id, 'bills', v_n, 'usd', v_usd, 'difference', v_total, 'rate', v_rate,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

create or replace function revalue_dollar_bills(p_rate numeric, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_rate', p_rate, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'revalue_dollar_bills', v_req);
  if v is not null then return v; end if;
  v := revalue_dollar_bills__run(p_rate, p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'revalue_dollar_bills', v_req, v);
  return v;
end $$;

-- What the café owes in dollars, by supplier, and what it is carried at now.
create or replace function dollars_owed() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('accounting.post', 'profit.view');
begin
  return jsonb_build_object(
    'usd', coalesce((select sum(usd_amount - usd_paid) from purchase_invoice
                      where business_id = v_business and cancelled_at is null), 0),
    'value', coalesce((select sum(usd_value) from purchase_invoice
                        where business_id = v_business and cancelled_at is null), 0),
    'last_rate', (select rate from fx_revaluation where business_id = v_business order by created_at desc limit 1),
    'last_at', (select created_at from fx_revaluation where business_id = v_business order by created_at desc limit 1),
    'suppliers', coalesce((
      select jsonb_agg(jsonb_build_object('supplier_id', s.id, 'name', s.name, 'usd', x.usd, 'value', x.value,
                                          'iqd', x.iqd) order by s.name)
        from (select supplier_id, sum(usd_amount - usd_paid) as usd, sum(usd_value) as value,
                     sum(amount_total - paid_amount - usd_value) as iqd
                from purchase_invoice where business_id = v_business and cancelled_at is null
               group by supplier_id having sum(usd_amount - usd_paid) > 0) x
        join supplier s on s.id = x.supplier_id), '[]'::jsonb));
end $$;

revoke execute on function bill_owed(purchase_invoice), usd_rate_ok(numeric),
  pay_bill__run(uuid, numeric, text, uuid), record_dollar_bill__run(uuid, text, date, numeric, numeric, numeric, int, uuid, text),
  pay_bill_dollars__run(uuid, numeric, text, numeric, text, uuid), revalue_dollar_bills__run(numeric, text)
  from public, anon, authenticated;
revoke execute on function record_dollar_bill(uuid, text, date, numeric, numeric, numeric, int, uuid, text, uuid),
  pay_bill_dollars(uuid, numeric, text, numeric, text, uuid, uuid), revalue_dollar_bills(numeric, text, uuid),
  dollars_owed() from public, anon;
grant execute on function record_dollar_bill(uuid, text, date, numeric, numeric, numeric, int, uuid, text, uuid),
  pay_bill_dollars(uuid, numeric, text, numeric, text, uuid, uuid), revalue_dollar_bills(numeric, text, uuid),
  dollars_owed() to authenticated;
