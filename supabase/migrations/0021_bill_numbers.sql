-- =============================================================================
-- 0021_bill_numbers.sql — every bill can carry the café's own number.
--
-- A supplier's invoice may have no number, or one that looks like another
-- supplier's. Left as the form fills it, a bill now takes the café's own
-- number: SGC-2026-0001, SGC-2026-0002, … — the business's prefix (SGC, for
-- The Sixty's Gelato & Café), the year the bill is entered, and a count that
-- starts again each year.
--
-- Such a number is never given twice. The count comes from document_counter,
-- whose row stays locked until the bill is saved, so two people recording
-- bills at once are given different numbers; a number that any bill already
-- carries (from any supplier, cancelled or not) is passed over; and a number
-- in the café's own form cannot be typed in by hand. A supplier's own number,
-- typed in, is kept as before: unique for that supplier.
-- =============================================================================

alter table business add column if not exists bill_prefix text not null default 'SGC';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'business_bill_prefix_ok') then
    alter table business add constraint business_bill_prefix_ok check (bill_prefix ~ '^[A-Z][A-Z0-9]{1,7}$');
  end if;
end $$;

-- The café's number for the n-th bill entered in a year.
create or replace function bill_number_format(p_prefix text, p_year int, p_n bigint) returns text
language sql immutable set search_path = public as $$
  select p_prefix || '-' || p_year || '-' || lpad(p_n::text, greatest(4, length(p_n::text)), '0')
$$;

-- A number in the café's own form, whoever typed it.
create or replace function is_own_bill_number(p_business uuid, p_no text) returns boolean
language sql stable set search_path = public as $$
  select p_no ~* ('^' || (select bill_prefix from business where id = p_business) || '-[0-9]{4}-[0-9]{4,}$')
$$;

-- The number the next bill will be given, without taking it.
create or replace function bill_number_peek(p_business uuid) returns text
language plpgsql stable set search_path = public as $$
declare v_prefix text; v_year int; v_n bigint; v_no text;
begin
  select bill_prefix into v_prefix from business where id = p_business;
  v_year := extract(year from business_local_date(p_business, now()));
  select next_no into v_n from document_counter where business_id = p_business and doc_type = 'bill:' || v_year;
  v_n := coalesce(v_n, 1);
  loop
    v_no := bill_number_format(v_prefix, v_year, v_n);
    exit when not exists (select 1 from purchase_invoice where business_id = p_business and lower(invoice_no) = lower(v_no));
    v_n := v_n + 1;
  end loop;
  return v_no;
end $$;

-- Taking the next number; the counter's row stays locked until the bill is saved.
create or replace function bill_number_take(p_business uuid) returns text
language plpgsql set search_path = public as $$
declare v_prefix text; v_year int; v_no text;
begin
  select bill_prefix into v_prefix from business where id = p_business;
  v_year := extract(year from business_local_date(p_business, now()));
  loop
    v_no := bill_number_format(v_prefix, v_year, next_document_no(p_business, 'bill:' || v_year, 1));
    exit when not exists (select 1 from purchase_invoice where business_id = p_business and lower(invoice_no) = lower(v_no));
  end loop;
  return v_no;
end $$;

-- What the bill form offers, to those who may record a bill.
create or replace function next_bill_number() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  return bill_number_peek(require_permission('purchase.create', 'accounting.post'));
end $$;

-- 0015's record_bill: with no number, the bill takes the café's own.
create or replace function record_bill(
  p_supplier uuid, p_invoice_no text, p_invoice_date date, p_amount numeric, p_term_days int default 0,
  p_receipt uuid default null, p_account_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_amount numeric; v_grni numeric; v_legacy numeric; v_ppv numeric; v_bill uuid; v_journal uuid; v_lines jsonb;
  v_acct gl_account;
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
    -- The old app did not record the supplier on a receipt; any supplier may bill those.
    if exists (select 1 from goods_receipt where id = p_receipt and supplier_id <> p_supplier) then
      raise exception 'That receipt is from a different supplier';
    end if;
    if exists (select 1 from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null) then
      raise exception 'That receipt has already been billed';
    end if;
    v_grni := receipt_grni_value(p_receipt);
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
       or p_account_code in ('1000', '1010', '1020', '1100', '1200', '5000', '5050', '5300', '5400') then
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

revoke execute on function bill_number_format(text, int, bigint), is_own_bill_number(uuid, text),
  bill_number_peek(uuid), bill_number_take(uuid)
  from public, anon, authenticated;
grant execute on function next_bill_number() to authenticated;
