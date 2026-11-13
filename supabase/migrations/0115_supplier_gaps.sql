-- 0115: the supplier's smaller gaps (plan 6, item 11; the owner, 8 November).
--
--   * a. A supplier's refund in cash or to the bank, its own button: what is
--     left of their credit, paid back to the till, the safe or the bank (Dr the
--     money, Cr 2000). Kept as a use of the credit, so what is left of it, the
--     statement and "Do the books tie?" all count it.
--   * b. Credits and bills dated as the supplier dated them, within open
--     months. A credit's books take its day (a price credit that changes what
--     the stock is worth stays today's). A bill keeps the supplier's date and
--     its due date counts from it; one dated before its delivery is booked on
--     the delivery's day, since before the goods came there is nothing it
--     clears. Neither is dated after today.
--
-- Nothing recorded changes.

-- =============================================================================
-- a. A supplier's refund
-- =============================================================================
create table if not exists supplier_refund (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references business(id) on delete cascade,
  supplier_id        uuid not null references supplier(id),
  supplier_credit_id uuid not null references supplier_credit(id),
  amount             numeric not null check (amount > 0),
  refunded_on        date not null,
  method             text not null check (method in ('till', 'safe', 'bank')),
  location_id        uuid references location(id),
  reference          text check (reference is null or length(reference) <= 60),
  journal_entry_id   uuid not null references journal_entry(id),
  created_by         uuid references app_user(id),
  created_at         timestamptz not null default now()
);
create index if not exists supplier_refund_supplier on supplier_refund (supplier_id, refunded_on);
alter table supplier_refund enable row level security;
alter table supplier_refund force row level security;
drop policy if exists cost_read on supplier_refund;
create policy cost_read on supplier_refund for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
grant select on supplier_refund to authenticated;
drop trigger if exists supplier_refund_append_only on supplier_refund;
create trigger supplier_refund_append_only before update or delete on supplier_refund
  for each row execute function forbid_mutation();

-- A credit's use: set against a bill, or paid back.
alter table supplier_credit_allocation alter column purchase_invoice_id drop not null;
alter table supplier_credit_allocation add column if not exists supplier_refund_id uuid references supplier_refund(id);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'supplier_credit_allocation_one_use') then
    alter table supplier_credit_allocation add constraint supplier_credit_allocation_one_use
      check ((purchase_invoice_id is null) <> (supplier_refund_id is null));
  end if;
end $$;

-- (purchase.create or accounting.post) What is left of a credit, paid back.
create or replace function record_supplier_refund(p_credit uuid, p_amount numeric, p_method text,
                                                  p_reference text default null, p_location uuid default null,
                                                  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_req jsonb := jsonb_build_object('credit', p_credit, 'amount', p_amount, 'method', p_method, 'ref', p_reference);
  v jsonb; c supplier_credit; v_left numeric; v_amount numeric; v_method text := lower(coalesce(p_method, ''));
  v_id uuid := gen_random_uuid(); v_journal uuid; v_me uuid := (current_member()).id; v_location uuid;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_supplier_refund', v_req);
  if v is not null then return v; end if;
  select * into c from supplier_credit where id = p_credit and business_id = v_business for update;
  if c.id is null then raise exception 'Credit not found'; end if;
  if v_method not in ('till', 'safe', 'bank') then
    raise exception 'Say where the money went: the till, the safe or the bank';
  end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  v_left := c.amount - coalesce((select sum(amount) from supplier_credit_allocation where supplier_credit_id = c.id), 0);
  if v_amount > v_left then
    raise exception '%', format('Credit %s has %s left: a refund is at most that', c.credit_no, trim_scale(v_left));
  end if;
  v_location := case when v_method = 'till' then resolve_location(v_business, p_location) end;
  v_journal := post_journal(v_business, now(),
    'Refund from ' || (select name from supplier where id = c.supplier_id) || ' on credit ' || c.credit_no,
    'supplier_refund', v_id,
    jsonb_build_array(jsonb_build_object('code', payment_account(v_method), 'debit', v_amount),
                      jsonb_build_object('code', '2000', 'credit', v_amount)),
    null, nullif(trim(p_reference), ''));
  insert into supplier_refund (id, business_id, supplier_id, supplier_credit_id, amount, refunded_on, method,
                               location_id, reference, journal_entry_id, created_by)
  values (v_id, v_business, c.supplier_id, c.id, v_amount, business_local_date(v_business, now()), v_method,
          v_location, left(nullif(trim(p_reference), ''), 60), v_journal, v_me);
  insert into supplier_credit_allocation (business_id, supplier_credit_id, purchase_invoice_id, supplier_refund_id,
                                          amount, created_by)
  values (v_business, c.id, null, v_id, v_amount, v_me);
  if v_method = 'till' then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (v_business, v_location, 'cash_in', v_amount, 'supplier_refund', v_id, v_me);
  end if;
  perform audit_event(v_business, 'purchase.credit.refund', 'supplier_credit', c.id::text, null, null,
    jsonb_build_object('credit_no', c.credit_no, 'amount', v_amount, 'method', v_method));
  v := jsonb_build_object('refund_id', v_id, 'credit_no', c.credit_no, 'amount', v_amount, 'left', v_left - v_amount,
                          'journal_no', (select journal_no from journal_entry where id = v_journal));
  perform idem_finish(v_business, p_idempotency_key, 'record_supplier_refund', v_req, v);
  return v;
end $$;

-- "Do the books tie?": what suppliers owe the café back is less what they
-- paid back; the safe holds what came into it.
do $$
begin
  if to_regprocedure('reconciliation_checks_0114(uuid, date)') is null then
    alter function reconciliation_checks(uuid, date) rename to reconciliation_checks_0114;
  end if;
end $$;
revoke execute on function reconciliation_checks_0114(uuid, date) from public, anon, authenticated;
create or replace function reconciliation_checks(p_business uuid, p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable set search_path = public as $$
declare v_end timestamptz; v_back numeric; v_safe numeric;
begin
  v_end := (local_day_bounds(p_business, p_as_of, p_as_of)).to_ts;
  select coalesce(sum(amount), 0) into v_back from supplier_refund
   where business_id = p_business and refunded_on < p_as_of + 1;
  select coalesce(sum(f.amount), 0) into v_safe
    from supplier_refund f join journal_entry e on e.id = f.journal_entry_id
   where f.business_id = p_business and f.method = 'safe' and e.occurred_at < v_end;
  return query
    select c.check_key, c.label,
           c.subledger + case c.check_key when 'payables' then v_back when 'safe' then v_safe else 0 end,
           c.ledger,
           c.difference + case c.check_key when 'payables' then v_back when 'safe' then v_safe else 0 end
      from reconciliation_checks_0114(p_business, p_as_of) c;
end $$;

-- 0044's statement, with what they paid back of their credits (0115).
create or replace function supplier_statement(p_supplier uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); s supplier; v_today date; v_out jsonb;
begin
  select * into s from supplier where id = p_supplier and business_id = v_business;
  if not found then raise exception 'Supplier not found'; end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose the dates, the first before the last';
  end if;
  v_today := business_local_date(v_business, now());
  with doc as (
    select b.invoice_date as day, 1 as ord, b.created_at as at, 'bill'::text as kind, b.id, b.invoice_no as ref,
           null::text as note, b.amount_total as charge, 0::numeric as credit,
           jsonb_build_object('due', b.due_date, 'legacy', b.legacy,
                              'receipt_no', (select receipt_no from goods_receipt where id = b.goods_receipt_id)) as more
      from purchase_invoice b where b.business_id = v_business and b.supplier_id = p_supplier
    union all
    select business_local_date(v_business, b.cancelled_at), 2, b.cancelled_at, 'cancelled', b.id, b.invoice_no,
           b.cancel_reason, 0, b.amount_total, '{}'::jsonb
      from purchase_invoice b
     where b.business_id = v_business and b.supplier_id = p_supplier and b.cancelled_at is not null
    union all
    select p.paid_on, 3, p.created_at, 'payment', p.id, null, null, 0, p.amount,
           jsonb_build_object('method', p.method, 'bill', (select invoice_no from purchase_invoice where id = p.purchase_invoice_id))
      from supplier_payment p where p.business_id = v_business and p.supplier_id = p_supplier
    union all
    select c.credit_date, 4, c.created_at, 'credit', c.id, c.supplier_ref, c.reason, 0, c.amount,
           jsonb_build_object('credit_no', c.credit_no, 'credit_kind', c.kind,
                              'return_no', (select return_no from supplier_return where id = c.supplier_return_id),
                              'receipt_no', (select receipt_no from goods_receipt where id = c.goods_receipt_id))
      from supplier_credit c where c.business_id = v_business and c.supplier_id = p_supplier
    union all
    -- What they paid back of a credit (0115): owed to the café no more.
    select f.refunded_on, 5, f.created_at, 'refund', f.id, f.reference, null, f.amount, 0,
           jsonb_build_object('method', f.method,
                              'credit_no', (select credit_no from supplier_credit where id = f.supplier_credit_id))
      from supplier_refund f where f.business_id = v_business and f.supplier_id = p_supplier
  ),
  before as (select coalesce(sum(charge - credit), 0) as bal from doc where day < p_from),
  inside as (
    select d.*, (select bal from before) + sum(d.charge - d.credit) over (order by d.day, d.ord, d.at, d.id) as balance
      from doc d where d.day between p_from and p_to
  )
  select jsonb_build_object(
    'supplier', jsonb_build_object('id', s.id, 'name', s.name, 'contact', s.contact, 'phone', s.phone),
    'from', p_from, 'to', p_to,
    'opening', (select bal from before),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('date', i.day, 'kind', i.kind, 'id', i.id, 'ref', i.ref,
                                                           'note', i.note, 'charge', i.charge, 'credit', i.credit,
                                                           'balance', i.balance) || i.more
                                        order by i.day, i.ord, i.at, i.id) from inside i), '[]'::jsonb),
    'closing', (select bal from before) + coalesce((select sum(charge - credit) from inside), 0),
    'billed', coalesce((select sum(charge) from inside where kind = 'bill'), 0),
    'cancelled', coalesce((select sum(credit) from inside where kind = 'cancelled'), 0),
    'paid', coalesce((select sum(credit) from inside where kind = 'payment'), 0),
    'credited', coalesce((select sum(credit) from inside where kind = 'credit'), 0),
    'refunded', coalesce((select sum(charge) from inside where kind = 'refund'), 0),
    'open_bills', coalesce((
      select jsonb_agg(jsonb_build_object(
               'bill_id', b.id, 'invoice_no', b.invoice_no, 'date', b.invoice_date, 'due', b.due_date,
               'total', b.amount_total,
               'paid', coalesce((select sum(amount) from supplier_payment where purchase_invoice_id = b.id), 0),
               'credited', coalesce((select sum(amount) from supplier_credit_allocation where purchase_invoice_id = b.id), 0),
               'outstanding', b.amount_total - b.paid_amount,
               'days_overdue', greatest(v_today - coalesce(b.due_date, b.invoice_date), 0))
             order by b.invoice_date, b.invoice_no)
        from purchase_invoice b
       where b.business_id = v_business and b.supplier_id = p_supplier and b.cancelled_at is null
         and b.amount_total > b.paid_amount), '[]'::jsonb),
    'open_credits', coalesce((
      select jsonb_agg(jsonb_build_object(
               'credit_id', c.id, 'credit_no', c.credit_no, 'date', c.credit_date, 'kind', c.kind,
               'supplier_ref', c.supplier_ref, 'amount', c.amount, 'left', c.amount - a.used)
             order by c.credit_no)
        from supplier_credit c
        cross join lateral (select coalesce(sum(amount), 0) as used from supplier_credit_allocation
                             where supplier_credit_id = c.id) a
       where c.business_id = v_business and c.supplier_id = p_supplier and c.amount > a.used), '[]'::jsonb))
    into v_out;
  return v_out;
end $$;
-- 0065's credit, dated as the supplier dated it (0115): its books on that day.
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
  -- The day the supplier dated it (0115), given by record_supplier_credit; else today.
  v_day := coalesce(nullif(current_setting('sixties.credit_date', true), '')::date,
                    business_local_date(v_business, now()));
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
    -- Recorded by someone who works at the delivery's place (0055), stock moved or not (0065).
    perform assert_works_at(r.location_id);
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
    -- What the delivery is still worth to the supplier: each item's value less
    -- what of it went back (the credit is shared over what stayed, 0065), less
    -- earlier credits.
    select array_agg(g.item_id order by g.item_id), array_agg(g.v order by g.item_id), coalesce(sum(g.v), 0)
      into v_items, v_values, v_worth
      from (select d.item_id,
                   d.v - coalesce((select sum(sl.value) from supplier_return_line sl
                                     join supplier_return sr on sr.id = sl.supplier_return_id
                                    where sr.goods_receipt_id = p_receipt and sl.item_id = d.item_id), 0) as v
              from (select (e ->> 'item_id')::uuid as item_id, sum((e ->> 'landed')::numeric) as v
                      from jsonb_array_elements(v_state -> 'lines') e group by 1) d) g
     where g.v > 0;
    v_taken := coalesce((select sum(amount) from supplier_credit where goods_receipt_id = p_receipt and kind = 'price'), 0);
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
       or v_account in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '1300', '5000', '5300', '5310',
                       '5400') then
      raise exception 'Account % cannot take a supplier''s credit', v_account;
    end if;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line(v_account, -v_amount));
  end if;

  if v_day < business_local_date(v_business, now()) then
    if v_stock > 0 then
      raise exception 'A price credit that changes what the stock is worth is dated today';
    end if;
    if b.id is not null and v_day < b.invoice_date then
      raise exception '%', format('Date the credit on or after its bill''s day, %s', b.invoice_date);
    end if;
  end if;
  v_no := next_document_no(v_business, 'supplier_credit', 1);
  v_journal := post_journal(v_business,
    case when v_day < business_local_date(v_business, now())
         then (v_day + time '12:00') at time zone (select timezone from business where id = v_business) else now() end,
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
-- =============================================================================
-- b. Credits dated as the supplier dated them
-- =============================================================================
-- A day in a locked month, and its name.
create or replace function locked_month_of(p_business uuid, p_day date) returns text
language sql stable security definer set search_path = public as $$
  select name from accounting_period
   where business_id = p_business and status = 'locked' and p_day between starts_on and ends_on
   limit 1
$$;

drop function if exists record_supplier_credit(uuid, text, numeric, text, text, uuid, uuid, text, uuid);
create or replace function record_supplier_credit(p_supplier uuid, p_kind text, p_amount numeric, p_supplier_ref text,
                                                  p_reason text, p_receipt uuid default null, p_bill uuid default null,
                                                  p_account_code text default null, p_idempotency_key uuid default null,
                                                  p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_supplier', p_supplier, 'p_kind', p_kind, 'p_amount', p_amount,
                                    'p_supplier_ref', p_supplier_ref, 'p_reason', p_reason,
                                    'p_receipt', p_receipt, 'p_bill', p_bill, 'p_account_code', p_account_code)
                 || case when p_date is not null then jsonb_build_object('p_date', p_date) else '{}'::jsonb end;
  v jsonb; v_today date;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_supplier_credit', v_req);
  if v is not null then return v; end if;
  v_today := business_local_date(v_business, now());
  if p_date is not null then
    if p_date > v_today then raise exception 'A credit note is dated today or earlier'; end if;
    if locked_month_of(v_business, p_date) is not null then
      raise exception '%', format('%s is in a locked month: date it in an open month', p_date);
    end if;
    perform set_config('sixties.credit_date', p_date::text, true);
  end if;
  v := record_supplier_credit__run(p_supplier => p_supplier, p_kind => p_kind, p_amount => p_amount,
                                   p_supplier_ref => p_supplier_ref, p_reason => p_reason, p_receipt => p_receipt,
                                   p_bill => p_bill, p_account_code => p_account_code);
  perform set_config('sixties.credit_date', '', true);
  perform idem_finish(v_business, p_idempotency_key, 'record_supplier_credit', v_req, v);
  return v;
end $$;

-- =============================================================================
-- b. Bills dated as the supplier dated them
-- =============================================================================
alter table purchase_invoice add column if not exists supplier_date date;

-- A bill the supplier dated before its delivery: their date kept, its due date from it.
create or replace function trg_purchase_invoice_supplier_date() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_date date := nullif(current_setting('sixties.bill_supplier_date', true), '')::date;
begin
  if v_date is not null then
    NEW.supplier_date := v_date;
    NEW.due_date := v_date + coalesce(NEW.due_date - NEW.invoice_date, 0);
  end if;
  return NEW;
end $$;
drop trigger if exists purchase_invoice_supplier_date on purchase_invoice;
create trigger purchase_invoice_supplier_date before insert on purchase_invoice
  for each row execute function trg_purchase_invoice_supplier_date();

alter function record_bill__run(uuid, text, date, numeric, int, uuid, text) rename to record_bill__run_0114;
create or replace function record_bill__run(
  p_supplier uuid, p_invoice_no text, p_invoice_date date, p_amount numeric, p_term_days int default 0,
  p_receipt uuid default null, p_account_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_date date := coalesce(p_invoice_date, business_local_date(v_business, now())); v_came date; v jsonb;
begin
  if v_date > business_local_date(v_business, now()) then raise exception 'A bill is dated today or earlier'; end if;
  if locked_month_of(v_business, v_date) is not null then
    raise exception '%', format('%s is in a locked month: date it in an open month', v_date);
  end if;
  if p_receipt is not null and exists (select 1 from goods_receipt where id = p_receipt and business_id = v_business) then
    v_came := (receipt_state(p_receipt) ->> 'received_on')::date;
  end if;
  if v_came is not null and v_date < v_came then
    perform set_config('sixties.bill_supplier_date', v_date::text, true);
    v := record_bill__run_0114(p_supplier, p_invoice_no, v_came, p_amount, p_term_days, p_receipt, p_account_code);
    perform set_config('sixties.bill_supplier_date', '', true);
    return v || jsonb_build_object('supplier_date', v_date, 'booked_on', v_came);
  end if;
  return record_bill__run_0114(p_supplier, p_invoice_no, p_invoice_date, p_amount, p_term_days, p_receipt,
                               p_account_code);
end $$;

revoke execute on function record_bill__run_0114(uuid, text, date, numeric, int, uuid, text),
  record_bill__run(uuid, text, date, numeric, int, uuid, text), locked_month_of(uuid, date),
  trg_purchase_invoice_supplier_date()
  from public, anon, authenticated;
revoke execute on function record_supplier_refund(uuid, numeric, text, text, uuid, uuid),
  record_supplier_credit(uuid, text, numeric, text, text, uuid, uuid, text, uuid, date)
  from public, anon;
grant execute on function record_supplier_refund(uuid, numeric, text, text, uuid, uuid),
  record_supplier_credit(uuid, text, numeric, text, text, uuid, uuid, text, uuid, date)
  to authenticated;
