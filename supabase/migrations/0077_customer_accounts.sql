-- =============================================================================
-- 0077 — Wholesale customers, on account (round nineteen)
-- =============================================================================
-- A shop, an office or a hotel buys from the bakery and pays later. So:
--
--  * A customer may buy on account: a credit limit (what they may owe at
--    most), terms (days to pay each invoice), and a standing wholesale price
--    (a percentage off the menu), set by those who manage credit.
--  * invoice_customer records the sale at the wholesale prices, charged to
--    the customer's account (Dr 1110 Customer accounts, 0076), as an invoice
--    numbered in order and due after the terms. Its stock and its cost go as
--    any sale's. It is refused when it would take them past their limit.
--  * receive_customer_payment records money they pay: into the till's drawer,
--    the bank, or one of the café's ways to pay (Dr it, Cr 1110). It pays
--    their oldest invoices first.
--  * customer_account reads what they owe, invoice by invoice, oldest first,
--    with what is paid of each and how late it is; customer_accounts every
--    customer on account, with what they owe and how much is overdue.
--  * An invoice's sale voided voids the invoice: what it charged leaves the
--    account with the sale's own reversal. It is not refunded by the item.
--  * 1110 moves only with invoices and payments (0076): no journal by hand.
--
-- Nothing recorded changes. Before it, no customer buys on account.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Who may
-- -----------------------------------------------------------------------------
-- credit.manage: a customer put on account, their limit, terms and wholesale
-- price; an invoice made; a payment received.
insert into role_permission (role, permission)
select r::app_role, p from (values
  ('owner','credit.manage'),('general_manager','credit.manage'),('branch_manager','credit.manage'),
  ('accountant','credit.manage')
) as v(r, p)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. A customer on account
-- -----------------------------------------------------------------------------
alter table customer add column if not exists on_account boolean not null default false;
alter table customer add column if not exists credit_limit numeric not null default 0;
alter table customer add column if not exists terms_days int not null default 30;
alter table customer add column if not exists wholesale_percent numeric not null default 0;
alter table customer drop constraint if exists customer_credit;
alter table customer add constraint customer_credit check (
  credit_limit >= 0 and terms_days between 0 and 365 and wholesale_percent >= 0 and wholesale_percent <= 90);

create table if not exists customer_invoice (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references business (id) on delete cascade,
  customer_id     uuid not null references customer (id),
  invoice_no      int not null,
  sales_order_id  uuid not null unique references sales_order (id),
  location_id     uuid references location (id),
  amount          numeric not null,
  issued_on       date not null,
  due_on          date not null,
  status          text not null default 'open',
  note            text,
  created_by      uuid references app_user (id),
  created_at      timestamptz not null default now(),
  constraint customer_invoice_status check (status in ('open', 'void')),
  constraint customer_invoice_amount check (amount > 0),
  constraint customer_invoice_note check (note is null or length(note) <= 300),
  unique (business_id, invoice_no)
);
create index if not exists customer_invoice_customer on customer_invoice (customer_id, issued_on);

create table if not exists customer_payment (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references business (id) on delete cascade,
  customer_id       uuid not null references customer (id),
  amount            numeric not null,
  -- Where the money went: the till's drawer (1000), the bank (1020), or one of
  -- the café's ways to pay (its account).
  account_code      text not null,
  payment_method_id uuid references payment_method (id),
  location_id       uuid references location (id),
  reference         text,
  journal_entry_id  uuid references journal_entry (id),
  created_by        uuid references app_user (id),
  created_at        timestamptz not null default now(),
  constraint customer_payment_amount check (amount > 0),
  constraint customer_payment_reference check (reference is null or length(reference) <= 60)
);
create index if not exists customer_payment_customer on customer_payment (customer_id, created_at);

alter table customer_invoice enable row level security;
alter table customer_invoice force row level security;
alter table customer_payment enable row level security;
alter table customer_payment force row level security;
drop policy if exists customer_read on customer_invoice;
create policy customer_read on customer_invoice for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('customer.view')));
drop policy if exists customer_read on customer_payment;
create policy customer_read on customer_payment for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('customer.view')));
grant select on customer_invoice, customer_payment to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Setting a customer's account
-- -----------------------------------------------------------------------------
create or replace function set_customer_account(p_customer uuid, p_on_account boolean, p_credit_limit numeric,
  p_terms_days int default 30, p_wholesale_percent numeric default 0, p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('credit.manage');
  v_req jsonb := jsonb_build_object('customer', p_customer, 'on', p_on_account, 'limit', p_credit_limit,
                                    'terms', p_terms_days, 'wholesale', p_wholesale_percent);
  v jsonb; c customer;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_customer_account', v_req);
  if v is not null then return; end if;
  select * into c from customer where id = p_customer and business_id = v_business for update;
  if not found then raise exception 'Customer not found'; end if;
  if p_credit_limit is null or p_credit_limit < 0 or p_credit_limit <> money_round(v_business, p_credit_limit) then
    raise exception 'A credit limit is an amount of 0 or more';
  end if;
  if p_terms_days is null or p_terms_days not between 0 and 365 then
    raise exception 'Terms are from 0 to 365 days';
  end if;
  if p_wholesale_percent is null or p_wholesale_percent < 0 or p_wholesale_percent > 90
     or p_wholesale_percent <> round(p_wholesale_percent, 2) then
    raise exception 'A wholesale price is from 0%% to 90%% off';
  end if;
  update customer set on_account = coalesce(p_on_account, false), credit_limit = p_credit_limit,
                      terms_days = p_terms_days, wholesale_percent = p_wholesale_percent
   where id = c.id;
  perform audit_event(v_business, 'customer.account', 'customer', c.id::text, null,
    jsonb_build_object('customer', c.full_name, 'on_account', c.on_account, 'credit_limit', c.credit_limit,
                       'terms_days', c.terms_days, 'wholesale_percent', c.wholesale_percent),
    jsonb_build_object('customer', c.full_name, 'on_account', coalesce(p_on_account, false),
                       'credit_limit', p_credit_limit, 'terms_days', p_terms_days,
                       'wholesale_percent', p_wholesale_percent));
  perform idem_finish(v_business, p_idempotency_key, 'set_customer_account', v_req, 'null'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 4. What a customer owes
-- -----------------------------------------------------------------------------
-- Each open invoice with what is paid of it: payments pay the oldest first.
create or replace function customer_invoices_paid(p_customer uuid)
returns table (invoice_id uuid, amount numeric, paid numeric, left_amount numeric)
language sql stable security definer set search_path = public as $$
  with i as (
    select ci.id, ci.amount, ci.issued_on, ci.invoice_no,
           sum(ci.amount) over (order by ci.issued_on, ci.invoice_no) as upto
      from customer_invoice ci where ci.customer_id = p_customer and ci.status = 'open'
  ), p as (
    select coalesce(sum(amount), 0) as total from customer_payment where customer_id = p_customer
  )
  select i.id, i.amount,
         least(i.amount, greatest(0, p.total - (i.upto - i.amount))),
         i.amount - least(i.amount, greatest(0, p.total - (i.upto - i.amount)))
    from i cross join p
   order by i.issued_on, i.invoice_no
$$;

create or replace function customer_balance(p_customer uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(amount) from customer_invoice where customer_id = p_customer and status = 'open'), 0)
       - coalesce((select sum(amount) from customer_payment where customer_id = p_customer), 0)
$$;

-- -----------------------------------------------------------------------------
-- 5. An invoice: a sale charged to the customer's account
-- -----------------------------------------------------------------------------
-- p_lines: [{variant_id, qty}], each at the channel's price less the
-- customer's wholesale percentage, rounded as the café rounds money. Keyed:
-- sent again, it is the invoice made.
create or replace function invoice_customer(p_customer uuid, p_lines jsonb, p_idempotency_key uuid,
  p_note text default null, p_channel sales_channel default 'takeaway', p_location uuid default null,
  p_expected_net numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('credit.manage');
  v_me uuid := (current_member()).id;
  c customer; v_location uuid; v_today date; l jsonb; v_price numeric; v_qty numeric; v_total numeric := 0;
  v_lines jsonb := '[]'; r jsonb; v_no int; v_owed numeric; v_inv customer_invoice;
begin
  if p_idempotency_key is null then raise exception 'A sale needs its idempotency key'; end if;
  -- Sent again: the invoice it made.
  select ci.* into v_inv from customer_invoice ci join sales_order o on o.id = ci.sales_order_id
   where o.business_id = v_business and o.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('invoice_id', v_inv.id, 'invoice_no', v_inv.invoice_no, 'order_id',
                              v_inv.sales_order_id, 'amount', v_inv.amount, 'due_on', v_inv.due_on,
                              'replayed', true);
  end if;
  select * into c from customer where id = p_customer and business_id = v_business for update;
  if not found then raise exception 'Customer not found'; end if;
  if not c.is_active then raise exception '% is no longer a customer', c.full_name; end if;
  if not c.on_account then raise exception '% does not buy on account', c.full_name; end if;
  if is_platform_channel(p_channel) or p_channel = 'direct_delivery' then
    raise exception 'An invoice is for take-away or eat-in prices';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  if nullif(trim(p_note), '') is not null and length(trim(p_note)) > 300 then
    raise exception 'A note is at most 300 letters';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, now());
  for l in select * from jsonb_array_elements(p_lines) loop
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = (l ->> 'variant_id')::uuid and pv.business_id = v_business
                      and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    v_price := price_on((l ->> 'variant_id')::uuid, p_channel, v_location, v_today);
    if v_price is null then raise exception 'No % price is set for this product', p_channel; end if;
    v_price := money_round(v_business, v_price * (100 - c.wholesale_percent) / 100);
    v_lines := v_lines || jsonb_build_object('variant_id', l ->> 'variant_id', 'qty', v_qty, 'price', v_price,
                                             'modifiers', '[]'::jsonb);
    v_total := v_total + money_round(v_business, v_price * v_qty);
  end loop;
  -- Within their limit: what they owe now and this invoice.
  v_owed := customer_balance(c.id);
  if v_owed + v_total > c.credit_limit then
    raise exception '% may owe at most %: they owe % already, and this is %', c.full_name,
      trim_scale(c.credit_limit), trim_scale(v_owed), trim_scale(v_total);
  end if;
  perform set_config('sixties.on_account', c.id::text, true);
  r := post_sale(v_business, v_me, p_idempotency_key, p_channel, null, v_lines, v_location, null, null, true,
                 jsonb_build_object('reason', null, 'note', null, 'approval', null),
                 p_tenders => jsonb_build_array(jsonb_build_object('type', 'other', 'amount', v_total,
                                                                   'on_account', c.id::text)),
                 p_expected_net => p_expected_net);
  perform set_config('sixties.on_account', '', true);
  perform pg_advisory_xact_lock(hashtext('customer_invoice:' || v_business::text));
  select coalesce(max(invoice_no), 0) + 1 into v_no from customer_invoice where business_id = v_business;
  insert into customer_invoice (business_id, customer_id, invoice_no, sales_order_id, location_id, amount,
                                issued_on, due_on, note, created_by)
  values (v_business, c.id, v_no, (r ->> 'order_id')::uuid, v_location, (r ->> 'net')::numeric, v_today,
          v_today + c.terms_days, nullif(trim(p_note), ''), v_me)
  returning * into v_inv;
  perform audit_event(v_business, 'customer.invoice', 'customer_invoice', v_inv.id::text, null, null,
    jsonb_build_object('customer', c.full_name, 'invoice_no', v_no, 'amount', v_inv.amount,
                       'due_on', v_inv.due_on));
  return jsonb_build_object('invoice_id', v_inv.id, 'invoice_no', v_no, 'order_id', v_inv.sales_order_id,
                            'amount', v_inv.amount, 'due_on', v_inv.due_on, 'replayed', false);
end $$;

-- An invoice's sale voided: the invoice is void, its charge reversed with
-- the sale's journal.
create or replace function trg_customer_invoice_voided() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.kind = 'void' then
    update customer_invoice set status = 'void' where sales_order_id = NEW.sales_order_id and status = 'open';
  end if;
  return NEW;
end $$;
drop trigger if exists customer_invoice_voided on sale_adjustment;
create trigger customer_invoice_voided after insert on sale_adjustment
  for each row execute function trg_customer_invoice_voided();

-- -----------------------------------------------------------------------------
-- 6. A payment received
-- -----------------------------------------------------------------------------
-- p_into: 'till' (cash into the drawer, which must be open), 'bank', or a way
-- to pay's id. At most what they owe.
create or replace function receive_customer_payment(p_customer uuid, p_amount numeric, p_into text,
  p_reference text default null, p_location uuid default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('credit.manage');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('customer', p_customer, 'amount', p_amount, 'into', p_into,
                                    'reference', p_reference, 'location', p_location);
  v jsonb; c customer; v_code text; v_method uuid; v_location uuid; v_owed numeric; v_id uuid := gen_random_uuid();
  v_journal uuid; v_ref text := nullif(trim(p_reference), '');
begin
  v := idem_begin(v_business, p_idempotency_key, 'receive_customer_payment', v_req);
  if v is not null then return v; end if;
  select * into c from customer where id = p_customer and business_id = v_business for update;
  if not found then raise exception 'Customer not found'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> money_round(v_business, p_amount) then
    raise exception 'Each payment needs an amount more than 0';
  end if;
  v_owed := customer_balance(c.id);
  if p_amount > v_owed then
    raise exception '% owes %: a payment is at most that', c.full_name, trim_scale(v_owed);
  end if;
  if v_ref is not null and length(v_ref) > 60 then
    raise exception 'A payment''s reference is at most 60 letters';
  end if;
  v_location := resolve_location(v_business, p_location);
  if p_into = 'till' then v_code := '1000';
  elsif p_into = 'bank' then v_code := '1020';
  elsif p_into ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id, account_code into v_method, v_code from payment_method
     where id = p_into::uuid and business_id = v_business and is_active;
    if v_method is null then raise exception 'That way to pay is not one of the café''s'; end if;
  else
    raise exception 'Say where the money went: the till, the bank or a way to pay';
  end if;
  insert into customer_payment (id, business_id, customer_id, amount, account_code, payment_method_id, location_id,
                                reference, created_by)
  values (v_id, v_business, c.id, p_amount, v_code, v_method, v_location, v_ref, v_me);
  v_journal := post_journal(v_business, now(), 'Payment from ' || c.full_name, 'customer_payment', v_id,
    jsonb_build_array(jsonb_build_object('code', v_code, 'debit', p_amount),
                      jsonb_build_object('code', '1110', 'credit', p_amount)));
  update customer_payment set journal_entry_id = v_journal where id = v_id;
  -- Cash goes into the drawer, which must be open.
  if v_code = '1000' then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (v_business, v_location, 'cash_in', p_amount, 'customer_payment', v_id, v_me);
  end if;
  perform audit_event(v_business, 'customer.payment', 'customer_payment', v_id::text, null, null,
    jsonb_build_object('customer', c.full_name, 'amount', p_amount, 'account', v_code, 'reference', v_ref));
  v := jsonb_build_object('payment_id', v_id, 'balance', v_owed - p_amount,
                          'journal_no', (select journal_no from journal_entry where id = v_journal));
  perform idem_finish(v_business, p_idempotency_key, 'receive_customer_payment', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Reading the accounts
-- -----------------------------------------------------------------------------
-- One customer's account: their terms, what they owe, each invoice (open and
-- void) with what is paid of it and how many days late, each payment.
create or replace function customer_account(p_customer uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('customer.view'); c customer; v_today date;
begin
  select * into c from customer where id = p_customer and business_id = v_business;
  if not found then raise exception 'Customer not found'; end if;
  v_today := business_local_date(v_business, now());
  return jsonb_build_object(
    'customer', c.id, 'name', c.full_name, 'phone', c.phone,
    'on_account', c.on_account, 'credit_limit', c.credit_limit, 'terms_days', c.terms_days,
    'wholesale_percent', c.wholesale_percent, 'balance', customer_balance(c.id), 'today', v_today,
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ci.id, 'no', ci.invoice_no, 'issued_on', ci.issued_on, 'due_on', ci.due_on,
               'amount', ci.amount, 'status', ci.status, 'note', ci.note, 'sale', ci.sales_order_id,
               'paid', coalesce(p.paid, case when ci.status = 'void' then 0 end),
               'left', coalesce(p.left_amount, 0),
               'days_late', case when coalesce(p.left_amount, 0) > 0 and ci.due_on < v_today
                                 then v_today - ci.due_on else 0 end)
             order by ci.issued_on desc, ci.invoice_no desc)
        from customer_invoice ci left join customer_invoices_paid(c.id) p on p.invoice_id = ci.id
       where ci.customer_id = c.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('id', cp.id, 'amount', cp.amount, 'at', cp.created_at,
                                          'account', cp.account_code, 'method', m.name, 'reference', cp.reference)
                       order by cp.created_at desc)
        from customer_payment cp left join payment_method m on m.id = cp.payment_method_id
       where cp.customer_id = c.id), '[]'::jsonb));
end $$;

-- Every customer on account, or who still owes: what they owe, how much of
-- it is overdue, by how long (1–30, 31–60, over 60 days late), and their
-- limit; the most owed first. And what 1110 holds, for those who see the books.
create or replace function customer_accounts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('customer.view'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return jsonb_build_object(
    'customers', coalesce((
      select jsonb_agg(x order by (x ->> 'balance')::numeric desc, x ->> 'name')
        from (select jsonb_build_object(
                       'id', c.id, 'name', c.full_name, 'phone', c.phone, 'on_account', c.on_account,
                       'credit_limit', c.credit_limit, 'terms_days', c.terms_days,
                       'wholesale_percent', c.wholesale_percent, 'balance', customer_balance(c.id),
                       'overdue', coalesce(sum(p.left_amount) filter (where ci.due_on < v_today), 0),
                       'late_30', coalesce(sum(p.left_amount) filter (where v_today - ci.due_on between 1 and 30), 0),
                       'late_60', coalesce(sum(p.left_amount) filter (where v_today - ci.due_on between 31 and 60), 0),
                       'late_more', coalesce(sum(p.left_amount) filter (where v_today - ci.due_on > 60), 0)) as x
                from customer c
                left join lateral customer_invoices_paid(c.id) p on true
                left join customer_invoice ci on ci.id = p.invoice_id
               where c.business_id = v_business
                 and (c.on_account or exists (select 1 from customer_invoice i where i.customer_id = c.id))
               group by c.id) s), '[]'::jsonb),
    'books', case when current_has_permission('profit.view')
                  then gl_balance_at(v_business, '1110', now() + interval '1 second') end);
end $$;

revoke execute on function set_customer_account(uuid, boolean, numeric, int, numeric, uuid) from public, anon;
grant execute on function set_customer_account(uuid, boolean, numeric, int, numeric, uuid) to authenticated;
revoke execute on function invoice_customer(uuid, jsonb, uuid, text, sales_channel, uuid, numeric) from public, anon;
grant execute on function invoice_customer(uuid, jsonb, uuid, text, sales_channel, uuid, numeric) to authenticated;
revoke execute on function receive_customer_payment(uuid, numeric, text, text, uuid, uuid) from public, anon;
grant execute on function receive_customer_payment(uuid, numeric, text, text, uuid, uuid) to authenticated;
revoke execute on function customer_account(uuid) from public, anon;
grant execute on function customer_account(uuid) to authenticated;
revoke execute on function customer_accounts() from public, anon;
grant execute on function customer_accounts() to authenticated;
revoke execute on function customer_invoices_paid(uuid) from public, anon, authenticated;
revoke execute on function customer_balance(uuid) from public, anon, authenticated;
