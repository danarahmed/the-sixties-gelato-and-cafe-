-- =============================================================================
-- 0081 — The books completed: equipment, banks and loans (round twenty-four)
-- =============================================================================
-- What the café owns and owes beyond its stock and its cash:
--
--  * fixed_asset: a piece of equipment (an oven, a gelato machine, a fridge),
--    what it cost, what it will be worth at the end, and how many months it
--    is used. Added, it is in the books (Dr 1500 Equipment) paid from the
--    bank, the safe, the owner's own money, a supplier's bill or a loan; or
--    already in them, when it was bought before.
--  * depreciate_to: each month's share of what it costs, the same each month
--    (straight line), posted once a month for the months gone (Dr 6400
--    Depreciation, Cr 1590 Accumulated depreciation), the last month taking
--    what is left so it comes to the cost less what it is worth at the end.
--    A month is posted once, whoever presses it, and never for a month to come.
--  * dispose_fixed_asset: sold or thrown out: what it was still worth leaves
--    the books (what it fetched in, the rest a loss or a gain).
--  * create_account adds, beside incomes and costs: another bank account
--    (1021–1029), a loan (2400–2499) and a kind of equipment (1501–1589). The
--    cash flow reads a bank as cash and a loan as money borrowed.
--
-- Nothing recorded changes.
-- =============================================================================

create table if not exists fixed_asset (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business (id) on delete cascade,
  location_id    uuid references location (id),
  name           text not null,
  account_code   text not null default '1500',
  cost           numeric not null,
  salvage        numeric not null default 0,
  life_months    int not null,
  start_on       date not null,
  paid_from      text,
  disposed_on    date,
  disposed_for   numeric,
  created_by     uuid references app_user (id),
  created_at     timestamptz not null default now(),
  constraint fixed_asset_name check (length(trim(name)) between 1 and 80),
  constraint fixed_asset_money check (cost > 0 and salvage >= 0 and salvage < cost),
  constraint fixed_asset_life check (life_months between 1 and 600)
);

create table if not exists depreciation_run (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references business (id) on delete cascade,
  month             date not null,
  amount            numeric not null,
  journal_entry_id  uuid references journal_entry (id),
  created_by        uuid references app_user (id),
  created_at        timestamptz not null default now(),
  unique (business_id, month)
);

create table if not exists asset_depreciation (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references fixed_asset (id) on delete cascade,
  run_id     uuid not null references depreciation_run (id) on delete cascade,
  month      date not null,
  amount     numeric not null,
  unique (asset_id, month)
);

alter table fixed_asset enable row level security;
alter table fixed_asset force row level security;
alter table depreciation_run enable row level security;
alter table depreciation_run force row level security;
alter table asset_depreciation enable row level security;
alter table asset_depreciation force row level security;
drop policy if exists books_read on fixed_asset;
create policy books_read on fixed_asset for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('profit.view')));
drop policy if exists books_read on depreciation_run;
create policy books_read on depreciation_run for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('profit.view')));
drop policy if exists books_read on asset_depreciation;
create policy books_read on asset_depreciation for select to authenticated
  using (exists (select 1 from fixed_asset a where a.id = asset_id
                  and a.business_id = (select current_business_id()))
         and (select current_has_permission('profit.view')));
grant select on fixed_asset, depreciation_run, asset_depreciation to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Equipment added
-- -----------------------------------------------------------------------------
-- p_paid_from: 'bank', 'safe', 'owner', 'supplier' (2000, a bill to pay), a
-- loan's or a bank's code, or null when it is in the books already.
create or replace function add_fixed_asset(p_name text, p_cost numeric, p_life_months int, p_start_on date,
  p_salvage numeric default 0, p_paid_from text default null, p_account text default '1500',
  p_location uuid default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('name', p_name, 'cost', p_cost, 'life', p_life_months, 'start', p_start_on,
                                    'salvage', p_salvage, 'paid_from', p_paid_from, 'account', p_account,
                                    'location', p_location);
  v jsonb; v_id uuid := gen_random_uuid(); v_name text := nullif(btrim(p_name), ''); v_from text;
  v_account text := coalesce(nullif(btrim(p_account), ''), '1500'); v_journal uuid;
begin
  v := idem_begin(v_business, p_idempotency_key, 'add_fixed_asset', v_req);
  if v is not null then return v; end if;
  if v_name is null then raise exception 'Name the equipment'; end if;
  if length(v_name) > 80 then raise exception 'A name is at most 80 letters'; end if;
  if p_cost is null or p_cost <= 0 or p_cost <> money_round(v_business, p_cost) then
    raise exception 'Enter what it cost';
  end if;
  if coalesce(p_salvage, 0) < 0 or coalesce(p_salvage, 0) >= p_cost then
    raise exception 'What it is worth at the end is less than what it cost';
  end if;
  if p_life_months is null or p_life_months not between 1 and 600 then
    raise exception 'It is used for 1 to 600 months';
  end if;
  if p_start_on is null or p_start_on > business_local_date(v_business, now()) then
    raise exception 'It was bought on a day up to today';
  end if;
  if v_account <> '1500' and not exists (select 1 from gl_account where business_id = v_business
                                            and code = v_account and code between '1501' and '1589') then
    raise exception 'Choose a kind of equipment from the chart';
  end if;
  v_from := case lower(coalesce(p_paid_from, ''))
              when '' then null when 'bank' then '1020' when 'safe' then '1005' when 'owner' then '3000'
              when 'supplier' then '2000' else p_paid_from end;
  if v_from is not null and not (v_from in ('1020', '1005', '3000', '2000')
                                 or exists (select 1 from gl_account where business_id = v_business and code = v_from
                                              and (code between '1021' and '1029' or code between '2400' and '2499')))
  then
    raise exception 'Say how it was paid: the bank, the safe, the owner, a supplier''s bill or a loan';
  end if;
  insert into fixed_asset (id, business_id, location_id, name, account_code, cost, salvage, life_months, start_on,
                           paid_from, created_by)
  values (v_id, v_business, resolve_location(v_business, p_location), v_name, v_account, p_cost,
          coalesce(p_salvage, 0), p_life_months, p_start_on, v_from, v_me);
  if v_from is not null then
    v_journal := post_journal(v_business, (p_start_on + time '12:00') at time zone
                                (select timezone from business where id = v_business),
      'Equipment bought: ' || v_name, 'fixed_asset', v_id,
      jsonb_build_array(jsonb_build_object('code', v_account, 'debit', p_cost),
                        jsonb_build_object('code', v_from, 'credit', p_cost)));
  end if;
  perform audit_event(v_business, 'asset.add', 'fixed_asset', v_id::text, null, null,
    jsonb_build_object('name', v_name, 'cost', p_cost, 'salvage', coalesce(p_salvage, 0),
                       'life_months', p_life_months, 'start_on', p_start_on, 'paid_from', v_from));
  v := jsonb_build_object('asset_id', v_id,
                          'journal_no', (select journal_no from journal_entry where id = v_journal));
  perform idem_finish(v_business, p_idempotency_key, 'add_fixed_asset', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Depreciation, month by month
-- -----------------------------------------------------------------------------
-- An asset's share of a month: the same each month; the last its remainder.
create or replace function asset_month_share(a fixed_asset, p_month date, p_business uuid) returns numeric
language plpgsql stable set search_path = public as $$
declare v_n int; v_each numeric; v_total numeric := a.cost - a.salvage;
begin
  v_n := (extract(year from p_month) - extract(year from a.start_on)) * 12
       + (extract(month from p_month) - extract(month from a.start_on)) + 1;
  if v_n < 1 or v_n > a.life_months then return 0; end if;
  if a.disposed_on is not null and p_month >= date_trunc('month', a.disposed_on)::date then return 0; end if;
  v_each := money_round(p_business, v_total / a.life_months);
  if v_n = a.life_months then return v_total - v_each * (a.life_months - 1); end if;
  return v_each;
end $$;

-- Every month gone, up to p_month's (never this month or later), not posted
-- yet: one journal a month for all the equipment.
create or replace function depreciate_to(p_month date default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('month', p_month);
  v jsonb; v_this date; v_last date; v_first date; m date; a fixed_asset; v_share numeric; v_total numeric;
  v_run uuid; v_posted int := 0; v_sum numeric := 0; v_journal uuid; v_tz text;
begin
  v := idem_begin(v_business, p_idempotency_key, 'depreciate_to', v_req);
  if v is not null then return v; end if;
  v_tz := (select timezone from business where id = v_business);
  v_this := date_trunc('month', business_local_date(v_business, now()))::date;
  v_last := least(date_trunc('month', coalesce(p_month, v_this - 1))::date, (v_this - interval '1 month')::date);
  perform pg_advisory_xact_lock(hashtext('depreciation:' || v_business::text));
  select date_trunc('month', min(start_on))::date into v_first from fixed_asset where business_id = v_business;
  if v_first is not null then
    m := v_first;
    while m <= v_last loop
      if not exists (select 1 from depreciation_run where business_id = v_business and month = m) then
        v_total := 0;
        for a in select * from fixed_asset where business_id = v_business loop
          v_total := v_total + asset_month_share(a, m, v_business);
        end loop;
        if v_total > 0 then
          v_run := gen_random_uuid();
          v_journal := post_journal(v_business,
            ((m + interval '1 month')::date - 1 + time '23:00') at time zone v_tz,
            'Depreciation ' || to_char(m, 'YYYY-MM'), 'depreciation_run', v_run,
            jsonb_build_array(jsonb_build_object('code', '6400', 'debit', v_total),
                              jsonb_build_object('code', '1590', 'credit', v_total)));
          insert into depreciation_run (id, business_id, month, amount, journal_entry_id, created_by)
          values (v_run, v_business, m, v_total, v_journal, v_me);
          for a in select * from fixed_asset where business_id = v_business loop
            v_share := asset_month_share(a, m, v_business);
            if v_share > 0 then
              insert into asset_depreciation (asset_id, run_id, month, amount) values (a.id, v_run, m, v_share);
            end if;
          end loop;
          v_posted := v_posted + 1;
          v_sum := v_sum + v_total;
        end if;
      end if;
      m := (m + interval '1 month')::date;
    end loop;
  end if;
  if v_posted > 0 then
    perform audit_event(v_business, 'asset.depreciate', 'depreciation_run', to_char(v_last, 'YYYY-MM'), null, null,
      jsonb_build_object('months', v_posted, 'amount', v_sum, 'to', v_last));
  end if;
  v := jsonb_build_object('months', v_posted, 'amount', v_sum, 'to', v_last);
  perform idem_finish(v_business, p_idempotency_key, 'depreciate_to', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Sold or thrown out
-- -----------------------------------------------------------------------------
-- Its months are posted up to the month before; what it was still worth
-- leaves the books: Dr 1590 (its depreciation), Dr what it fetched (into the
-- bank or the safe), the rest a loss, or a gain when it fetched more (6900).
create or replace function dispose_fixed_asset(p_asset uuid, p_on date, p_fetched numeric default 0,
  p_into text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_req jsonb := jsonb_build_object('asset', p_asset, 'on', p_on, 'fetched', p_fetched, 'into', p_into);
  v jsonb; a fixed_asset; v_dep numeric; v_book numeric; v_into text; v_journal uuid; v_lines jsonb;
  v_fetched numeric := coalesce(p_fetched, 0);
begin
  v := idem_begin(v_business, p_idempotency_key, 'dispose_fixed_asset', v_req);
  if v is not null then return v; end if;
  select * into a from fixed_asset where id = p_asset and business_id = v_business for update;
  if not found then raise exception 'Equipment not found'; end if;
  if a.disposed_on is not null then raise exception '% is gone already', a.name; end if;
  if p_on is null or p_on < a.start_on or p_on > business_local_date(v_business, now()) then
    raise exception 'It went on a day from when it was bought up to today';
  end if;
  if v_fetched < 0 or v_fetched <> money_round(v_business, v_fetched) then
    raise exception 'Enter what it fetched, 0 or more';
  end if;
  v_into := case lower(coalesce(p_into, '')) when 'bank' then '1020' when 'safe' then '1005' else null end;
  if v_fetched > 0 and v_into is null then raise exception 'Say where the money went: the bank or the safe'; end if;
  select coalesce(sum(amount), 0) into v_dep from asset_depreciation where asset_id = a.id;
  v_book := a.cost - v_dep;
  v_lines := jsonb_build_array(jsonb_build_object('code', a.account_code, 'credit', a.cost))
          || case when v_dep > 0 then jsonb_build_array(jsonb_build_object('code', '1590', 'debit', v_dep))
                  else '[]'::jsonb end
          || case when v_fetched > 0 then jsonb_build_array(jsonb_build_object('code', v_into, 'debit', v_fetched))
                  else '[]'::jsonb end
          || case when v_book > v_fetched
                  then jsonb_build_array(jsonb_build_object('code', '6900', 'debit', v_book - v_fetched))
                  when v_fetched > v_book
                  then jsonb_build_array(jsonb_build_object('code', '6900', 'credit', v_fetched - v_book))
                  else '[]'::jsonb end;
  update fixed_asset set disposed_on = p_on, disposed_for = v_fetched where id = a.id;
  v_journal := post_journal(v_business, (p_on + time '12:00') at time zone
                              (select timezone from business where id = v_business),
    'Equipment gone: ' || a.name, 'fixed_asset_disposal', a.id, v_lines);
  perform audit_event(v_business, 'asset.dispose', 'fixed_asset', a.id::text, null, null,
    jsonb_build_object('name', a.name, 'on', p_on, 'fetched', v_fetched, 'book_value', v_book));
  v := jsonb_build_object('book_value', v_book,
                          'journal_no', (select journal_no from journal_entry where id = v_journal));
  perform idem_finish(v_business, p_idempotency_key, 'dispose_fixed_asset', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 4. The equipment, for the screen
-- -----------------------------------------------------------------------------
create or replace function fixed_assets()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  v_this date := date_trunc('month', business_local_date(v_business, now()))::date;
  v_pending int;
begin
  select count(*) into v_pending
    from generate_series((select date_trunc('month', min(start_on))::date from fixed_asset where business_id = v_business),
                         (v_this - interval '1 month')::date, interval '1 month') g(m)
   where not exists (select 1 from depreciation_run r where r.business_id = v_business and r.month = g.m::date)
     and exists (select 1 from fixed_asset a where a.business_id = v_business
                  and asset_month_share(a, g.m::date, v_business) > 0);
  return jsonb_build_object(
    'pending_months', coalesce(v_pending, 0),
    'assets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'name', a.name, 'account', a.account_code, 'cost', a.cost, 'salvage', a.salvage,
               'life_months', a.life_months, 'start_on', a.start_on, 'paid_from', a.paid_from,
               'disposed_on', a.disposed_on,
               'each_month', money_round(v_business, (a.cost - a.salvage) / a.life_months),
               'depreciated', coalesce((select sum(d.amount) from asset_depreciation d where d.asset_id = a.id), 0),
               'book_value', a.cost - coalesce((select sum(d.amount) from asset_depreciation d
                                                 where d.asset_id = a.id), 0))
             order by a.disposed_on nulls first, a.start_on desc, a.name)
        from fixed_asset a where a.business_id = v_business), '[]'::jsonb));
end $$;

-- -----------------------------------------------------------------------------
-- 5. The owner's money, all told
-- -----------------------------------------------------------------------------
-- What the owner has put in (credited to 3000) and taken out (debited to 3000
-- or 3200), in published journals.
create or replace function owner_money()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'put_in', coalesce(sum(l.credit) filter (where a.code = '3000'), 0),
    'taken_out', coalesce(sum(l.debit) filter (where a.code in ('3000', '3200')), 0))
    from journal_line l join journal_entry e on e.id = l.journal_entry_id
    join gl_account a on a.id = l.account_id
   where e.business_id = require_permission('profit.view') and e.status = 'published'
     and a.code in ('3000', '3200')
$$;

-- -----------------------------------------------------------------------------
-- 6. Accounts added on the screen: banks, loans, kinds of equipment
-- -----------------------------------------------------------------------------
-- 0058's create_account__run: also 'bank' (1021–1029), 'loan' (2400–2499) and
-- 'equipment' (1501–1589).
create or replace function create_account__run(p_code text, p_name text, p_type text, p_names jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := account_name_ok(p_name);
  v_type account_type;
  v_other gl_account;
  v_names jsonb;
  v_kind text := p_type;
begin
  if p_type is null or p_type not in ('revenue', 'expense', 'bank', 'loan', 'equipment') then
    raise exception 'An account added here is an income, a cost, a bank, a loan or a kind of equipment';
  end if;
  v_type := case p_type when 'bank' then 'asset' when 'equipment' then 'asset' when 'loan' then 'liability'
                        else p_type end::account_type;
  if v_code !~ '^[0-9]{4}$' then raise exception 'An account''s code is four digits'; end if;
  if v_kind = 'revenue' and v_code not between '4000' and '4999' then
    raise exception 'An income''s code is from 4000 to 4999';
  end if;
  if v_kind = 'expense' and v_code not between '5000' and '6999' then
    raise exception 'A cost''s code is from 5000 to 6999: 5… for the cost of what was sold, 6… for the running costs';
  end if;
  if v_kind = 'bank' and v_code not between '1021' and '1029' then
    raise exception 'Another bank''s code is from 1021 to 1029';
  end if;
  if v_kind = 'loan' and v_code not between '2400' and '2499' then
    raise exception 'A loan''s code is from 2400 to 2499';
  end if;
  if v_kind = 'equipment' and v_code not between '1501' and '1589' then
    raise exception 'A kind of equipment''s code is from 1501 to 1589';
  end if;
  perform pg_advisory_xact_lock(hashtext('gl_account:' || v_business::text));
  select * into v_other from gl_account where business_id = v_business and code = v_code;
  if v_other.id is not null then raise exception 'Account % is %', v_code, v_other.name; end if;
  select * into v_other from gl_account where business_id = v_business and name_key(name) = name_key(v_name);
  if v_other.id is not null then raise exception '% is account % already', v_other.name, v_other.code; end if;
  insert into gl_account (business_id, code, name, account_type, normal_balance, is_active, is_system)
  values (v_business, v_code, v_name, v_type,
          (case when v_type in ('revenue', 'liability') then 'credit' else 'debit' end)::normal_balance, true, false);
  v_names := account_names_save(v_business, v_name, p_names);
  return jsonb_build_object('code', v_code, 'name', v_name, 'type', v_type::text, 'names', v_names);
end $$;

-- 0076's cash flow lines: another bank is cash; a loan is money borrowed.
create or replace function cash_flow_line(p_code text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_code in ('1000', '1001', '1005', '1006', '1020') or p_code ~ '^10[3-8][0-9]$'
         or p_code between '1021' and '1029' then 'cash'
    when p_code like '15%' then 'equipment'
    when p_code like '3%' or p_code between '2400' and '2499' then 'owner'
    when p_code = '6950' then 'exchange'
    when p_code = '6300' then 'counts'
    when p_code like '4%' or p_code in ('1010', '1100', '1110', '2300', '5100', '5200', '6500') then 'sales'
    when p_code like '12%' or p_code in ('2000', '2050') or p_code like '5%' then 'stock'
    when p_code in ('1300', '2100') or p_code like '61%' then 'staff'
    else 'running'
  end
$$;

-- 0076's journal_source_hint: the equipment's journals, and a customer's
-- payment (0077), say where they come from.
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
    when 'money_move' then 'a move of money (cancel it on Sales)'
    when 'pre_order' then 'a pre-order''s deposit (cancel the pre-order at the till)'
    when 'pre_order_cancel' then 'a pre-order cancelled'
    when 'customer_payment' then 'a customer''s payment on account'
    when 'fixed_asset' then 'equipment bought (record it sold or thrown out on Accounting instead)'
    when 'fixed_asset_disposal' then 'equipment sold or thrown out'
    when 'depreciation_run' then 'a month''s depreciation of the equipment'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

revoke execute on function add_fixed_asset(text, numeric, int, date, numeric, text, text, uuid, uuid) from public, anon;
grant execute on function add_fixed_asset(text, numeric, int, date, numeric, text, text, uuid, uuid) to authenticated;
revoke execute on function depreciate_to(date, uuid) from public, anon;
grant execute on function depreciate_to(date, uuid) to authenticated;
revoke execute on function dispose_fixed_asset(uuid, date, numeric, text, uuid) from public, anon;
grant execute on function dispose_fixed_asset(uuid, date, numeric, text, uuid) to authenticated;
revoke execute on function owner_money() from public, anon;
grant execute on function owner_money() to authenticated;
revoke execute on function fixed_assets() from public, anon;
grant execute on function fixed_assets() to authenticated;
revoke execute on function asset_month_share(fixed_asset, date, uuid) from public, anon, authenticated;
