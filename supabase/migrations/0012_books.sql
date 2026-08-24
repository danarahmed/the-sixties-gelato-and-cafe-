-- =============================================================================
-- 0012_books.sql — bookkeeping layer on top of operations.
--
-- Adds what a real set of books needs beyond the operational ledger:
--   * vendor BILLS with a due date (so payables can be aged), linked to the
--     goods receipt that brought the stock in;
--   * supplier PAYMENTS against those bills (vendor statement = bills - payments);
--   * a Cash over/short account, so the daily till count can be reconciled
--     against what the POS says the day should have taken.
-- =============================================================================

-- --- Bills -------------------------------------------------------------------
alter table purchase_invoice add column if not exists due_date date;
alter table purchase_invoice add column if not exists paid_amount numeric not null default 0;
alter table purchase_invoice add column if not exists goods_receipt_id uuid references goods_receipt(id);
alter table purchase_invoice add column if not exists journal_entry_id uuid references journal_entry(id);
create index if not exists purchase_invoice_supplier_idx on purchase_invoice (business_id, supplier_id);

-- --- Payments against bills --------------------------------------------------
create table if not exists supplier_payment (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references business(id) on delete cascade,
  supplier_id         uuid not null references supplier(id),
  purchase_invoice_id uuid references purchase_invoice(id),
  amount              numeric not null check (amount > 0),
  paid_on             date not null default current_date,
  method              text,                       -- 'cash','card','transfer'
  journal_entry_id    uuid references journal_entry(id),
  note                text,
  created_at          timestamptz not null default now()
);
create index if not exists supplier_payment_supplier_idx on supplier_payment (business_id, supplier_id);

-- --- Cash over/short account (day close) -------------------------------------
insert into gl_account (business_id, code, name, account_type, normal_balance)
select '00000000-0000-0000-0000-0000000000b1', '6300', 'Cash over / short', 'expense', 'debit'
where not exists (
  select 1 from gl_account
  where business_id = '00000000-0000-0000-0000-0000000000b1' and code = '6300'
);

-- --- Row-level security (demo-scoped, same pattern as 0010/0011) -------------
alter table supplier_payment enable row level security;
alter table supplier_payment force row level security;

drop policy if exists demo_rw_sel on supplier_payment;
create policy demo_rw_sel on supplier_payment
  for select using (business_id = '00000000-0000-0000-0000-0000000000b1');
drop policy if exists demo_rw_ins on supplier_payment;
create policy demo_rw_ins on supplier_payment
  for insert with check (business_id = '00000000-0000-0000-0000-0000000000b1');
grant select, insert on supplier_payment to anon, authenticated;

-- A bill's paid_amount is updated as payments land; a shift is closed out.
drop policy if exists demo_rw_upd on purchase_invoice;
create policy demo_rw_upd on purchase_invoice
  for update using (business_id = '00000000-0000-0000-0000-0000000000b1')
  with check (business_id = '00000000-0000-0000-0000-0000000000b1');
grant update on purchase_invoice to anon, authenticated;

drop policy if exists demo_rw_upd on work_shift;
create policy demo_rw_upd on work_shift
  for update using (business_id = '00000000-0000-0000-0000-0000000000b1')
  with check (business_id = '00000000-0000-0000-0000-0000000000b1');
grant update on work_shift to anon, authenticated;
