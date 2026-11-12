-- 0102: the books' blockers, first part (plan 6, items 4 and 5).
--
--   * Accounts the owner adds: besides an income, a cost, a bank, a loan or a
--     kind of equipment (0081), any other asset (1700–1799: a deposit paid, a
--     loan given) or debt (2500–2599: owed to a partner, a tax owed later).
--   * Tax, built in and switched off (the owner, 8 November: "not known yet;
--     the system must be able to take it later"). The café turns it on when
--     the time comes, with its kind and rate: the tax part of what each sale
--     takes in (the products, after discounts, and the service charge; never
--     a tip) is then owed (2600 Tax owed on sales) instead of income, and a
--     refund gives it back; a report shows what was collected, given back and
--     paid for any period. Prices are taken to include the tax, as menus in
--     Iraq show them. Off, nothing changes.
--
-- Nothing recorded changes.

-- -----------------------------------------------------------------------------
-- 1. Other assets and debts, added by the owner
-- -----------------------------------------------------------------------------
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
  if p_type is null or p_type not in ('revenue', 'expense', 'bank', 'loan', 'equipment', 'asset', 'liability') then
    raise exception 'An account added here is an income, a cost, a bank, a loan, a kind of equipment, another asset or another debt';
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
  if v_kind = 'asset' and v_code not between '1700' and '1799' then
    raise exception 'Another asset''s code is from 1700 to 1799';
  end if;
  if v_kind = 'liability' and v_code not between '2500' and '2599' then
    raise exception 'Another debt''s code is from 2500 to 2599';
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

-- -----------------------------------------------------------------------------
-- 2. Tax, built in and off
-- -----------------------------------------------------------------------------
create table if not exists tax_setup (
  business_id uuid primary key references business (id) on delete cascade,
  enabled     boolean not null default false,
  kind        text not null default 'vat' check (kind in ('vat', 'sales_tax')),
  rate        numeric(5, 2) not null default 0 check (rate >= 0 and rate <= 50),
  changed_at  timestamptz not null default now(),
  changed_by  uuid references app_user (id),
  check (not enabled or rate > 0)
);
alter table tax_setup enable row level security;
alter table tax_setup force row level security;
revoke all on tax_setup from public, anon, authenticated;

-- The tax on what a café takes in, as it stands now: off (0) until it is turned on.
create or replace function tax_rate_now(p_business uuid) returns numeric
language sql stable set search_path = public as $$
  select coalesce((select rate from tax_setup where business_id = p_business and enabled), 0)
$$;

create or replace function tax_setup() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('accounting.post', 'settings.manage'); t tax_setup;
begin
  select * into t from tax_setup where business_id = v_business;
  return jsonb_build_object('enabled', coalesce(t.enabled, false), 'kind', coalesce(t.kind, 'vat'),
                            'rate', coalesce(t.rate, 0), 'changed_at', t.changed_at,
                            'account', (select code from gl_account where business_id = v_business and code = '2600'));
end $$;

-- Turned on or off, its kind and rate: the owner's, from now on; on the audit trail.
create or replace function set_tax_setup(p_enabled boolean, p_kind text, p_rate numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_before jsonb; v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not current_has_role('owner') then
    raise exception 'Only the owner turns tax on or off' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('vat', 'sales_tax') then raise exception 'Choose the kind of tax'; end if;
  if p_rate is null or p_rate < 0 or p_rate > 50 then raise exception '%', format('A tax rate is from %s%% to %s%%', 0, 50); end if;
  if coalesce(p_enabled, false) and p_rate <= 0 then raise exception 'Tax turned on needs its rate'; end if;
  if v_reason is null or length(v_reason) < 6 then raise exception 'Say why, in a few words'; end if;
  v_before := (select to_jsonb(t) - 'business_id' from tax_setup t where business_id = v_business);
  -- What is owed has its own account, made the first time tax is turned on.
  if coalesce(p_enabled, false) then
    insert into gl_account (business_id, code, name, account_type, normal_balance, is_active, is_system)
    values (v_business, '2600', 'Tax owed on sales', 'liability', 'credit', true, true)
    on conflict do nothing;
  end if;
  insert into tax_setup (business_id, enabled, kind, rate, changed_at, changed_by)
  values (v_business, coalesce(p_enabled, false), p_kind, p_rate, now(), (current_member()).id)
  on conflict (business_id) do update
     set enabled = excluded.enabled, kind = excluded.kind, rate = excluded.rate,
         changed_at = excluded.changed_at, changed_by = excluded.changed_by;
  perform audit_event(v_business, 'tax.setup', 'business', v_business::text, v_reason, v_before,
    jsonb_build_object('enabled', coalesce(p_enabled, false), 'kind', p_kind, 'rate', p_rate));
  return tax_setup();
end $$;

-- A sale's, a refund's or a receipt correction's journal, with its tax owed:
-- the tax part of the income it moves (products after discounts, and the
-- service charge; a refund's returns) taken off sales (4000, or 4200 for a
-- refund) and owed (2600). A reversal (a void)
-- copies the lines it reverses, tax included, so it is left as it is.
alter function post_journal(uuid, timestamptz, text, text, uuid, jsonb, uuid, text) rename to post_journal_0101;
create or replace function post_journal(p_business uuid, p_at timestamptz, p_description text, p_ref_type text,
                                        p_ref_id uuid, p_lines jsonb, p_reverses uuid default null,
                                        p_reference_no text default null)
returns uuid language plpgsql set search_path = public as $$
declare v_rate numeric; v_income numeric; v_tax numeric; v_lines jsonb := p_lines;
begin
  if p_reverses is null and p_ref_type in ('sales_order', 'sale_refund', 'receipt_correction') then
    v_rate := tax_rate_now(p_business);
    if v_rate > 0 then
      select coalesce(sum(coalesce((x ->> 'credit')::numeric, 0) - coalesce((x ->> 'debit')::numeric, 0)), 0)
        into v_income
        from jsonb_array_elements(p_lines) x
       where x ->> 'code' in ('4000', '4100', '4200', '4300');
      v_tax := money_round(p_business, v_income * v_rate / (100 + v_rate));
      -- On the sale's income, or a refund's returns (4200), as it moved.
      if v_tax <> 0 then
        v_lines := p_lines || jsonb_build_array(
          signed_line(case when p_ref_type = 'sale_refund' then '4200' else '4000' end, v_tax),
          signed_line('2600', -v_tax));
      end if;
    end if;
  end if;
  return post_journal_0101(p_business, p_at, p_description, p_ref_type, p_ref_id, v_lines, p_reverses,
                           p_reference_no);
end $$;

-- What tax was collected, given back and paid in a period.
create or replace function report_tax(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('accounting.post', 'profit.view'); b record;
begin
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Choose the days, from and to'; end if;
  b := local_day_bounds(v_business, p_from, p_to);
  return jsonb_build_object(
    'setup', tax_setup(),
    -- A sale's, less a void's (which reverses it).
    'collected', coalesce((select sum(l.credit - l.debit) from journal_line l
                             join journal_entry e on e.id = l.journal_entry_id
                             join gl_account g on g.id = l.account_id
                             left join journal_entry r on r.id = e.reverses_entry
                            where e.business_id = v_business and e.status = 'published' and g.code = '2600'
                              and (e.reference_type = 'sales_order' or r.reference_type = 'sales_order')
                              and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts), 0),
    'given_back', coalesce((select sum(l.debit - l.credit) from journal_line l
                              join journal_entry e on e.id = l.journal_entry_id
                              join gl_account g on g.id = l.account_id
                             where e.business_id = v_business and e.status = 'published' and g.code = '2600'
                               and e.reference_type in ('sale_refund', 'receipt_correction')
                               and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts), 0),
    'paid', coalesce((select sum(l.debit - l.credit) from journal_line l
                        join journal_entry e on e.id = l.journal_entry_id
                        join gl_account g on g.id = l.account_id
                       where e.business_id = v_business and e.status = 'published' and g.code = '2600'
                         and coalesce(e.reference_type, '') not in ('sales_order', 'sale_refund', 'receipt_correction')
                         and not exists (select 1 from journal_entry r where r.id = e.reverses_entry
                                            and r.reference_type in ('sales_order', 'sale_refund', 'receipt_correction'))
                         and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts), 0),
    'owed', coalesce((select sum(l.credit - l.debit) from journal_line l
                        join journal_entry e on e.id = l.journal_entry_id
                        join gl_account g on g.id = l.account_id
                       where e.business_id = v_business and e.status = 'published' and g.code = '2600'
                         and e.occurred_at < b.to_ts), 0));
end $$;

revoke execute on function tax_rate_now(uuid), post_journal(uuid, timestamptz, text, text, uuid, jsonb, uuid, text),
  post_journal_0101(uuid, timestamptz, text, text, uuid, jsonb, uuid, text) from public, anon, authenticated;
revoke execute on function tax_setup(), set_tax_setup(boolean, text, numeric, text), report_tax(date, date)
  from public, anon;
grant execute on function tax_setup(), set_tax_setup(boolean, text, numeric, text), report_tax(date, date)
  to authenticated;
