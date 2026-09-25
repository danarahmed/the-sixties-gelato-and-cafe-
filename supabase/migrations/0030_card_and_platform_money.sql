-- =============================================================================
-- 0030 — Card and platform money, reconciled
-- =============================================================================
-- The September 2026 audit's P1-9 (docs/SYSTEM_AUDIT_2026-09.md §9): 1010
-- Card clearing was never cleared or checked against the card terminal, and
-- payments "by card" credited it too; platform sales carried no order number,
-- and a platform's payout was a journal typed by hand, matched to nothing.
--
--  * Card takings are settled against the terminal: the till's card takings
--    for a run of days, the terminal's total for them, and what reached the
--    bank. Dr 1020 what arrived, Dr 6500 the fee (the terminal's total less
--    what arrived), a difference between the till and the terminal to 6300
--    Cash over / short with its reason, Cr 1010 the till's takings. The latest
--    settlement can be cancelled.
--  * A payment made by card comes out of the bank (1020), not 1010.
--  * Every platform sale carries the platform's order number, once.
--  * A platform statement, pasted in, is matched to the orders: what each
--    paid, its commission and fees, and what is missing or matches nothing.
--    The payout journal is proposed and a person posts it — Dr 1020, Dr 5100
--    commission, Dr 5200 fees and differences, Cr 1100 the orders' value — and
--    the orders are marked paid out. A settlement can be cancelled.
--  * The alerts read platform money by order, and a margin reads to one
--    decimal, never rounded up to its target.

-- =============================================================================
-- 1. Accounts: card and bank fees; a card payment comes from the bank
-- =============================================================================
create or replace function provision_chart_of_accounts(p_business uuid)
returns void language plpgsql as $$
begin
  insert into gl_account (business_id, code, name, account_type, normal_balance, is_system)
  select p_business, a.code, a.name, a.t::account_type, a.nb::normal_balance, true
  from (values
    ('1000','Cash in the till',           'asset',     'debit'),
    ('1005','Cash in the safe',           'asset',     'debit'),
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
    ('6900','Other expenses',             'expense',   'debit')
  ) as a(code, name, t, nb)
  on conflict (business_id, code) do update set is_system = true;
end $$;

select provision_chart_of_accounts(id) from business;

-- A card is paid from the bank account behind it: a payment by card comes out
-- of 1020, and 1010 holds only the card takings waiting to reach the bank.
create or replace function payment_account(p_method text) returns text
language sql immutable as $$
  select case lower(p_method) when 'till' then '1000' when 'cash' then '1000' when 'safe' then '1005'
                              when 'card' then '1020' when 'bank' then '1020' when 'transfer' then '1020'
                              when 'owner' then '3000' end
$$;

create or replace function journal_source_hint(p_ref_type text) returns text
language sql immutable as $$
  select case p_ref_type
    when 'sales_order' then 'a sale (void or refund it on Orders)'
    when 'sale_adjustment' then 'a refund'
    when 'goods_receipt' then 'a goods receipt'
    when 'purchase_invoice' then 'a bill (cancel it on Vendors)'
    when 'supplier_payment' then 'a supplier payment'
    when 'inventory_movement' then 'a stock record (correct stock with a count or a stock correction)'
    when 'stock_count' then 'a stock count (correct stock with a new count)'
    when 'work_shift' then 'a drawer count'
    when 'cash_transfer' then 'a movement of cash (move it back instead)'
    when 'reversal' then 'a reversal (post the entry again instead)'
    when 'card_settlement' then 'a card settlement (cancel it on Sales)'
    when 'platform_settlement' then 'a platform settlement (cancel it on Delivery Platforms)'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- A journal line from a signed amount: more than zero a debit, less a credit.
create or replace function signed_line(p_code text, p_amount numeric) returns jsonb
language sql immutable set search_path = public as $$
  select case when coalesce(p_amount, 0) >= 0 then jsonb_build_object('code', p_code, 'debit', coalesce(p_amount, 0))
              else jsonb_build_object('code', p_code, 'credit', -p_amount) end
$$;

-- =============================================================================
-- 2. Card takings, settled against the terminal
-- =============================================================================
create table if not exists card_settlement (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business (id) on delete cascade,
  covers_from      date not null,
  covers_to        date not null,
  till_total       numeric not null,          -- what the till took by card those days (1010, less refunds and voids)
  terminal_total   numeric not null,          -- what the card terminal's reports say it took
  received         numeric not null,          -- what reached the bank
  fee              numeric not null,          -- the terminal's total less what arrived
  difference       numeric not null,          -- the till's takings less the terminal's
  received_on      date not null,
  reference        text,
  note             text,
  journal_entry_id uuid references journal_entry (id),
  created_by       uuid references app_user (id),
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz,
  cancelled_by     uuid references app_user (id),
  cancel_reason    text,
  check (covers_from <= covers_to)
);
-- Each day's takings are settled once: a settlement starts the day after the last.
create unique index if not exists card_settlement_from on card_settlement (business_id, covers_from) where cancelled_at is null;
alter table card_settlement enable row level security;
alter table card_settlement force row level security;

-- The card takings of each day not yet settled, and the settlements made.
create or replace function card_takings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_from date;
begin
  select max(covers_to) + 1 into v_from from card_settlement where business_id = v_business and cancelled_at is null;
  return jsonb_build_object(
    'from', v_from,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'amount', d.amount) order by d.day)
        from (select business_local_date(v_business, e.occurred_at) as day, sum(l.debit - l.credit) as amount
                from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
               where e.business_id = v_business and e.status = 'published' and g.code = '1010'
                 and e.reference_type is distinct from 'card_settlement'
                 and (e.reference_type is distinct from 'reversal'
                      or not exists (select 1 from journal_entry o where o.id = e.reverses_entry and o.reference_type = 'card_settlement'))
                 and (v_from is null or business_local_date(v_business, e.occurred_at) >= v_from)
               group by 1) d
       where d.amount <> 0), '[]'::jsonb),
    'balance', gl_balance_at(v_business, '1010', 'infinity'),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'covers_from', s.covers_from, 'covers_to', s.covers_to, 'till_total', s.till_total,
               'terminal_total', s.terminal_total, 'received', s.received, 'fee', s.fee, 'difference', s.difference,
               'received_on', s.received_on, 'reference', s.reference, 'note', s.note,
               'journal_no', (select journal_no from journal_entry where id = s.journal_entry_id),
               'by', u.full_name, 'at', s.created_at, 'cancelled_at', s.cancelled_at, 'cancel_reason', s.cancel_reason)
             order by s.covers_to desc, s.created_at desc)
        from (select * from card_settlement where business_id = v_business
               order by covers_to desc, created_at desc limit 30) s
        left join app_user u on u.id = s.created_by), '[]'::jsonb));
end $$;

-- The card takings from the day after the last settlement up to p_through (a
-- day that is over), against the terminal's total for them and what reached
-- the bank.
create or replace function record_card_settlement(p_through date, p_terminal_total numeric, p_received numeric,
                                                  p_received_on date default null, p_reference text default null,
                                                  p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  v_today date; v_from date; v_till numeric; v_terminal numeric; v_received numeric; v_fee numeric; v_diff numeric;
  v_on date; v_id uuid := gen_random_uuid(); v_journal uuid;
begin
  perform pg_advisory_xact_lock(hashtext('card_settlement:' || v_business::text));
  v_today := business_local_date(v_business, now());
  select max(covers_to) + 1 into v_from from card_settlement where business_id = v_business and cancelled_at is null;
  if v_from is null then
    select min(business_local_date(v_business, e.occurred_at)) into v_from
      from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
     where e.business_id = v_business and e.status = 'published' and g.code = '1010';
  end if;
  if v_from is null then raise exception 'Nothing has been taken by card yet'; end if;
  -- A day is settled once it is over: the till takes cards until midnight, and
  -- a sale after a settlement of its own day would be left out of every one.
  if v_from >= v_today then
    raise exception 'Card takings are settled once the day is over: today''s wait until tomorrow';
  end if;
  if p_through is null or p_through < v_from or p_through >= v_today then
    raise exception 'Settle the card takings of days that are over: from % to %',
      to_char(v_from, 'DD Mon'), to_char(v_today - 1, 'DD Mon');
  end if;
  v_terminal := money_round(v_business, p_terminal_total);
  v_received := money_round(v_business, p_received);
  if v_terminal is null or v_terminal < 0 then raise exception 'Enter the terminal''s total for those days'; end if;
  if v_received is null or v_received < 0 then raise exception 'Enter what reached the bank'; end if;
  if v_received > v_terminal then
    raise exception 'The bank cannot receive more than the terminal took: the difference is its fee';
  end if;
  select coalesce(sum(l.debit - l.credit), 0) into v_till
    from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
   where e.business_id = v_business and e.status = 'published' and g.code = '1010'
     and e.reference_type is distinct from 'card_settlement'
     and (e.reference_type is distinct from 'reversal'
          or not exists (select 1 from journal_entry o where o.id = e.reverses_entry and o.reference_type = 'card_settlement'))
     and business_local_date(v_business, e.occurred_at) between v_from and p_through;
  if v_till = 0 and v_terminal = 0 then raise exception 'Nothing was taken by card on those days'; end if;
  v_fee := v_terminal - v_received;
  v_diff := v_till - v_terminal;
  if v_diff <> 0 and length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'The till took % by card and the terminal %: say why they differ', trim_scale(v_till), trim_scale(v_terminal);
  end if;
  v_on := coalesce(p_received_on, v_today);
  if v_on < p_through or v_on > v_today then
    raise exception 'The money arrived on a day from % to today', to_char(p_through, 'DD Mon');
  end if;
  v_journal := post_journal(v_business, (v_on + time '12:00') at time zone (select timezone from business where id = v_business),
    format('Card takings %s to %s settled', to_char(v_from, 'DD Mon'), to_char(p_through, 'DD Mon'))
      || coalesce(': ' || nullif(trim(p_reference), ''), ''),
    'card_settlement', v_id,
    jsonb_build_array(signed_line('1020', v_received), signed_line('6500', v_fee),
                      signed_line('6300', v_diff), signed_line('1010', -v_till)),
    null, nullif(trim(p_reference), ''));
  insert into card_settlement (id, business_id, covers_from, covers_to, till_total, terminal_total, received, fee,
                               difference, received_on, reference, note, journal_entry_id, created_by)
  values (v_id, v_business, v_from, p_through, v_till, v_terminal, v_received, v_fee, v_diff, v_on,
          nullif(trim(p_reference), ''), nullif(trim(p_note), ''), v_journal, v_me);
  perform audit_event(v_business, 'card.settlement', 'card_settlement', v_id::text, nullif(trim(p_note), ''), null,
    jsonb_build_object('from', v_from, 'to', p_through, 'till', v_till, 'terminal', v_terminal, 'received', v_received,
                       'fee', v_fee, 'difference', v_diff));
  return jsonb_build_object('settlement_id', v_id, 'covers_from', v_from, 'covers_to', p_through, 'till_total', v_till,
    'fee', v_fee, 'difference', v_diff, 'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- The latest settlement, undone: its journal reversed, its days waiting again.
create or replace function cancel_card_settlement(p_settlement uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('accounting.post'); s card_settlement;
begin
  perform pg_advisory_xact_lock(hashtext('card_settlement:' || v_business::text));
  select * into s from card_settlement where id = p_settlement and business_id = v_business for update;
  if not found or s.cancelled_at is not null then raise exception 'That settlement is not in force'; end if;
  if exists (select 1 from card_settlement where business_id = v_business and cancelled_at is null
                                            and covers_from > s.covers_from) then
    raise exception 'Cancel the latest settlement first: card takings are settled in order';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why it is cancelled'; end if;
  perform reverse_entry_internal(s.journal_entry_id,
    (business_local_date(v_business, now()) + time '12:00') at time zone (select timezone from business where id = v_business),
    'Reversal: card settlement cancelled: ' || trim(p_reason));
  update card_settlement set cancelled_at = now(), cancelled_by = (current_member()).id, cancel_reason = trim(p_reason)
   where id = p_settlement;
  perform audit_event(v_business, 'card.settlement_cancel', 'card_settlement', p_settlement::text, trim(p_reason), null,
    jsonb_build_object('from', s.covers_from, 'to', s.covers_to, 'received', s.received));
end $$;

-- =============================================================================
-- 3. Platform sales carry their order number
-- =============================================================================
insert into delivery_platform (business_id, code, name)
select b.id, c.code, c.name
  from business b cross join (values ('talabat', 'Talabat'), ('careem', 'Careem'), ('toters', 'Toters')) c(code, name)
on conflict (business_id, code) do nothing;

-- The platform a channel sells through, set up the first time it is needed.
create or replace function platform_id_for(p_business uuid, p_channel sales_channel) returns uuid
language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from delivery_platform where business_id = p_business and code = p_channel::text;
  if v_id is null then
    insert into delivery_platform (business_id, code, name)
    values (p_business, p_channel::text, initcap(p_channel::text))
    on conflict (business_id, code) do nothing;
    select id into v_id from delivery_platform where business_id = p_business and code = p_channel::text;
  end if;
  return v_id;
end $$;

-- 0028's record_sale, with the platform's order number for a platform sale.
drop function if exists record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid);
create or replace function record_sale(
  p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type, p_lines jsonb,
  p_location uuid default null, p_discount_percent numeric default null, p_discount_amount numeric default null,
  p_expected_net numeric default null, p_discount_reason text default null, p_discount_note text default null,
  p_approval uuid default null, p_platform_order_no text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create'); r jsonb;
  v_no text := nullif(trim(p_platform_order_no), ''); v_platform uuid; v_at timestamptz;
begin
  if (p_discount_percent is not null or p_discount_amount is not null)
     and not current_has_permission('discount.apply') then
    raise exception 'You do not have permission to give discounts' using errcode = '42501';
  end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, p_channel, p_tender, p_lines,
                 p_location, p_discount_percent, p_discount_amount, false,
                 jsonb_build_object('reason', p_discount_reason, 'note', p_discount_note, 'approval', p_approval));
  perform assert_sale_total(r, p_expected_net);
  -- A replay is the sale already recorded, with its number.
  if is_platform_channel(p_channel) and not coalesce((r ->> 'replayed')::boolean, false) then
    if v_no is null then
      raise exception 'Enter the % order number', initcap(p_channel::text);
    end if;
    if length(v_no) > 40 or v_no !~ '^[A-Za-z0-9#/_.-]+$' then
      raise exception 'An order number is letters and digits, as the % tablet shows it', initcap(p_channel::text);
    end if;
    v_platform := platform_id_for(v_business, p_channel);
    select o.placed_at into v_at
      from platform_order po join sales_order o on o.id = po.sales_order_id
     where po.business_id = v_business and po.platform_id = v_platform and lower(po.external_order_id) = lower(v_no);
    if found then
      raise exception '% order % is already recorded, on the sale of %', initcap(p_channel::text), v_no,
        to_char(v_at at time zone (select timezone from business where id = v_business), 'DD Mon HH24:MI');
    end if;
    insert into platform_order (business_id, platform_id, location_id, external_order_id, status, store_list_value,
                                customer_payment, sales_order_id, placed_at, import_source)
    select v_business, v_platform, o.location_id, v_no, 'completed', o.gross_amount, o.net_amount, o.id, o.placed_at, 'till'
      from sales_order o where o.id = (r ->> 'order_id')::uuid;
    r := r || jsonb_build_object('platform_order_no', v_no);
  end if;
  return r;
end $$;

-- =============================================================================
-- 4. Platform money: owed by order; a statement matched; the payout posted
-- =============================================================================
alter table platform_settlement add column if not exists received_on date;
alter table platform_settlement add column if not exists journal_entry_id uuid references journal_entry (id);
alter table platform_settlement add column if not exists note text;
alter table platform_settlement add column if not exists created_by uuid references app_user (id);
alter table platform_settlement add column if not exists cancelled_at timestamptz;
alter table platform_settlement add column if not exists cancelled_by uuid references app_user (id);
alter table platform_settlement add column if not exists cancel_reason text;
alter table platform_settlement_line add column if not exists reported_fees numeric not null default 0;
alter table platform_settlement_line add column if not exists status text;
alter table platform_settlement_line add column if not exists sales_order_id uuid references sales_order (id);
alter table platform_settlement_line add column if not exists expected numeric;
-- One statement is recorded once.
create unique index if not exists platform_settlement_reference
  on platform_settlement (business_id, platform_id, lower(reference)) where cancelled_at is null;

-- What the platforms owe, order by order; what platform receivable holds that
-- no order explains; and the settlements recorded.
create or replace function platform_money() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_waiting numeric; v_bal numeric;
begin
  select coalesce(sum(o.net_amount), 0) into v_waiting
    from platform_order po join sales_order o on o.id = po.sales_order_id
   where po.business_id = v_business and po.settlement_id is null and o.status not in ('voided', 'refunded');
  v_bal := gl_balance_at(v_business, '1100', 'infinity');
  return jsonb_build_object(
    'platforms', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'name', name) order by name)
                             from delivery_platform where business_id = v_business and is_active), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('platform', dp.code, 'order_no', po.external_order_id, 'sale_id', o.id,
                                          'placed_at', o.placed_at, 'amount', o.net_amount,
                                          'days', business_local_date(v_business, now()) - business_local_date(v_business, o.placed_at))
                       order by o.placed_at)
        from platform_order po join delivery_platform dp on dp.id = po.platform_id
        join sales_order o on o.id = po.sales_order_id
       where po.business_id = v_business and po.settlement_id is null and o.status not in ('voided', 'refunded')), '[]'::jsonb),
    'waiting', v_waiting, 'receivable', v_bal, 'unmatched', v_bal - v_waiting,
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'platform', dp.code, 'reference', s.reference, 'received_on', s.received_on,
               'period_start', s.period_start, 'period_end', s.period_end,
               'orders', (select count(*) from platform_settlement_line sl where sl.settlement_id = s.id and sl.status = 'matched'),
               'lines', (select count(*) from platform_settlement_line sl where sl.settlement_id = s.id),
               'payout', (select coalesce(sum(sl.reported_payout), 0) from platform_settlement_line sl
                           where sl.settlement_id = s.id and sl.status = 'matched'),
               'statement_total', s.statement_total, 'note', s.note,
               'journal_no', (select journal_no from journal_entry where id = s.journal_entry_id),
               'by', u.full_name, 'at', s.imported_at, 'cancelled_at', s.cancelled_at, 'cancel_reason', s.cancel_reason)
             order by s.imported_at desc)
        from (select * from platform_settlement where business_id = v_business order by imported_at desc limit 30) s
        join delivery_platform dp on dp.id = s.platform_id
        left join app_user u on u.id = s.created_by), '[]'::jsonb));
end $$;

-- A statement's lines against the orders waiting to be paid out: each line
-- matched, or why not; the orders it leaves out; and the journal it proposes.
-- p_lines: [{order_no, payout, commission?, fees?}]. With neither commission
-- nor fees given, all the platform kept is its commission.
create or replace function platform_statement_match(p_business uuid, p_platform text, p_lines jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_platform uuid; l jsonb; i int := 0; v_no text; v_payout numeric; v_comm numeric; v_fees numeric;
  v_po record; v_status text; v_seen text[] := '{}'; v_out jsonb := '[]'; v_amount numeric; v_diff numeric;
  t_amount numeric := 0; t_payout numeric := 0; t_comm numeric := 0; t_fees numeric := 0; t_diff numeric := 0;
  t_other numeric := 0; n_matched int := 0; v_last timestamptz; v_missing jsonb;
begin
  select id into v_platform from delivery_platform where business_id = p_business and code = lower(trim(p_platform));
  if v_platform is null then raise exception 'Choose the platform the statement is from'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The statement has no lines';
  end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    v_no := nullif(trim(l ->> 'order_no'), '');
    if v_no is null then raise exception 'Line % has no order number', i; end if;
    begin
      v_payout := money_round(p_business, (l ->> 'payout')::numeric);
      v_comm := money_round(p_business, nullif(l ->> 'commission', '')::numeric);
      v_fees := money_round(p_business, nullif(l ->> 'fees', '')::numeric);
    exception when others then
      raise exception 'Line % (order %): the amounts must be numbers', i, v_no;
    end;
    if v_payout is null then raise exception 'Line % (order %) has no payout', i, v_no; end if;
    if coalesce(v_comm, 0) < 0 or coalesce(v_fees, 0) < 0 then
      raise exception 'Line % (order %): commission and fees are what the platform kept, never less than zero', i, v_no;
    end if;
    select po.id, po.settlement_id, o.id as sale_id, o.net_amount, o.status, o.placed_at, s.reference as paid_by
      into v_po
      from platform_order po join sales_order o on o.id = po.sales_order_id
      left join platform_settlement s on s.id = po.settlement_id
     where po.business_id = p_business and po.platform_id = v_platform and lower(po.external_order_id) = lower(v_no);
    v_amount := null; v_diff := null;
    if lower(v_no) = any (v_seen) then
      v_status := 'duplicate';
    elsif v_po.id is null then
      v_status := 'not_found';
    elsif v_po.settlement_id is not null then
      v_status := 'already_paid';
    elsif v_po.status in ('voided', 'refunded') then
      v_status := 'voided';
    else
      v_status := 'matched';
      v_amount := v_po.net_amount;
      if v_comm is null and v_fees is null then
        v_comm := v_amount - v_payout; v_fees := 0;
      else
        v_comm := coalesce(v_comm, 0); v_fees := coalesce(v_fees, 0);
      end if;
      v_diff := v_amount - v_payout - v_comm - v_fees;
      n_matched := n_matched + 1;
      t_amount := t_amount + v_amount; t_payout := t_payout + v_payout; t_comm := t_comm + v_comm;
      t_fees := t_fees + v_fees; t_diff := t_diff + v_diff;
      v_last := greatest(v_last, v_po.placed_at);
    end if;
    if v_status <> 'matched' then t_other := t_other + v_payout; end if;
    v_seen := v_seen || lower(v_no);
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'line', i, 'order_no', v_no, 'status', v_status, 'payout', v_payout, 'commission', v_comm, 'fees', v_fees,
      'expected', v_amount, 'difference', v_diff, 'sale_id', v_po.sale_id, 'placed_at', v_po.placed_at,
      'paid_by', case when v_status = 'already_paid' then v_po.paid_by end));
  end loop;
  -- Orders waiting to be paid out, from before the latest one on the statement, that it leaves out.
  select coalesce(jsonb_agg(jsonb_build_object('order_no', po.external_order_id, 'sale_id', o.id,
                                               'placed_at', o.placed_at, 'amount', o.net_amount) order by o.placed_at), '[]')
    into v_missing
    from platform_order po join sales_order o on o.id = po.sales_order_id
   where po.business_id = p_business and po.platform_id = v_platform and po.settlement_id is null
     and o.status not in ('voided', 'refunded') and v_last is not null and o.placed_at <= v_last
     and not (lower(po.external_order_id) = any (v_seen));
  return jsonb_build_object(
    'platform', lower(trim(p_platform)), 'lines', v_out, 'missing', v_missing, 'matched', n_matched,
    'totals', jsonb_build_object('orders', t_amount, 'payout', t_payout, 'commission', t_comm, 'fees', t_fees,
                                 'difference', t_diff, 'not_posted', t_other),
    'journal', case when n_matched > 0 then
      (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(jsonb_build_array(
         signed_line('1020', t_payout), signed_line('5100', t_comm), signed_line('5200', t_fees + t_diff),
         signed_line('1100', -t_amount))) x
        where coalesce((x ->> 'debit')::numeric, (x ->> 'credit')::numeric) <> 0)
      else '[]'::jsonb end);
end $$;

-- The match, for the Delivery Platforms screen (nothing is written).
create or replace function match_platform_statement(p_platform text, p_lines jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  return platform_statement_match(v_business, p_platform, p_lines);
end $$;

-- A person posts what the match proposes: the payout into the bank, the
-- commission and fees, the orders' value out of platform receivable. Lines
-- that match no order waiting are recorded with the statement, not posted.
create or replace function post_platform_settlement(p_platform text, p_reference text, p_lines jsonb,
                                                    p_received_on date default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  m jsonb; v_platform uuid; v_name text; v_id uuid := gen_random_uuid(); v_journal uuid; v_on date; v_today date;
  v_ref text := nullif(trim(p_reference), ''); v_issues int; l jsonb; v_first date; v_last date;
begin
  perform pg_advisory_xact_lock(hashtext('platform_settlement:' || v_business::text));
  m := platform_statement_match(v_business, p_platform, p_lines);
  select id, name into v_platform, v_name from delivery_platform where business_id = v_business and code = m ->> 'platform';
  if (m ->> 'matched')::int = 0 then
    raise exception 'Nothing on the statement matches a % order waiting to be paid out', v_name;
  end if;
  if v_ref is null then raise exception 'Enter the statement''s number or date, as the platform gives it'; end if;
  if exists (select 1 from platform_settlement where business_id = v_business and platform_id = v_platform
                                                and lower(reference) = lower(v_ref) and cancelled_at is null) then
    raise exception '% statement % is already recorded', v_name, v_ref;
  end if;
  select count(*) into v_issues from jsonb_array_elements(m -> 'lines') x
   where x ->> 'status' <> 'matched' or coalesce((x ->> 'difference')::numeric, 0) <> 0;
  if v_issues > 0 and length(trim(coalesce(p_note, ''))) < 3 then
    raise exception '% line(s) of the statement do not match: say what they are', v_issues;
  end if;
  v_today := business_local_date(v_business, now());
  select min(business_local_date(v_business, (x ->> 'placed_at')::timestamptz)),
         max(business_local_date(v_business, (x ->> 'placed_at')::timestamptz))
    into v_first, v_last
    from jsonb_array_elements(m -> 'lines') x where x ->> 'status' = 'matched';
  v_on := coalesce(p_received_on, v_today);
  if v_on < v_last or v_on > v_today then
    raise exception 'The payout arrived on a day from % to today', to_char(v_last, 'DD Mon');
  end if;
  insert into platform_settlement (id, business_id, platform_id, reference, period_start, period_end, statement_total,
                                   import_source, received_on, note, created_by)
  values (v_id, v_business, v_platform, v_ref, v_first, v_last,
          (select coalesce(sum((x ->> 'payout')::numeric), 0) from jsonb_array_elements(m -> 'lines') x),
          'paste', v_on, nullif(trim(p_note), ''), v_me);
  for l in select * from jsonb_array_elements(m -> 'lines') loop
    insert into platform_settlement_line (settlement_id, external_order_id, reported_payout, reported_commission,
                                          reported_fees, status, sales_order_id, expected, adjustment_note)
    values (v_id, l ->> 'order_no', (l ->> 'payout')::numeric, coalesce((l ->> 'commission')::numeric, 0),
            coalesce((l ->> 'fees')::numeric, 0), l ->> 'status',
            case when l ->> 'status' = 'matched' then (l ->> 'sale_id')::uuid end,
            (l ->> 'expected')::numeric,
            case l ->> 'status' when 'not_found' then 'No sale has this order number'
                                when 'duplicate' then 'On the statement twice'
                                when 'already_paid' then 'Already paid out by statement ' || (l ->> 'paid_by')
                                when 'voided' then 'The sale was voided or refunded' end);
    if l ->> 'status' <> 'matched' or coalesce((l ->> 'difference')::numeric, 0) <> 0 then
      insert into reconciliation_issue (settlement_id, issue_type, external_order_id, detail, delta_amount)
      values (v_id,
              (case l ->> 'status' when 'not_found' then 'unmatched_settlement_line'
                                   when 'duplicate' then 'duplicate_settlement_line'
                                   when 'already_paid' then 'duplicate_settlement_line'
                                   when 'voided' then 'cancelled_still_charged'
                                   else 'payout_difference' end)::reconciliation_issue_type,
              l ->> 'order_no',
              case when l ->> 'status' = 'matched'
                   then format('Expected %s; paid %s, commission %s, fees %s', l ->> 'expected', l ->> 'payout',
                               l ->> 'commission', l ->> 'fees')
                   else 'Not posted: ' || (l ->> 'status') end,
              coalesce((l ->> 'difference')::numeric, (l ->> 'payout')::numeric));
    end if;
  end loop;
  update platform_order po
     set settlement_id = v_id, settlement_reference = v_ref, settled_at = now(),
         actual_payout = (x ->> 'payout')::numeric
    from jsonb_array_elements(m -> 'lines') x
   where x ->> 'status' = 'matched' and po.business_id = v_business and po.platform_id = v_platform
     and po.sales_order_id = (x ->> 'sale_id')::uuid;
  v_journal := post_journal(v_business, (v_on + time '12:00') at time zone (select timezone from business where id = v_business),
    format('%s payout, statement %s (%s orders)', v_name, v_ref, m ->> 'matched'),
    'platform_settlement', v_id, m -> 'journal', null, v_ref);
  update platform_settlement set journal_entry_id = v_journal where id = v_id;
  perform audit_event(v_business, 'platform.settlement', 'platform_settlement', v_id::text, nullif(trim(p_note), ''), null,
    jsonb_build_object('platform', v_name, 'reference', v_ref, 'order_count', (m ->> 'matched')::int) || (m -> 'totals'));
  -- 'orders' (in the totals) is their value; 'order_count' how many were paid out.
  return jsonb_build_object('settlement_id', v_id, 'journal_no', (select journal_no from journal_entry where id = v_journal),
                            'order_count', (m ->> 'matched')::int, 'issues', v_issues) || (m -> 'totals');
end $$;

-- A settlement undone: its journal reversed, its orders waiting to be paid out again.
create or replace function cancel_platform_settlement(p_settlement uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('accounting.post'); s platform_settlement;
begin
  select * into s from platform_settlement where id = p_settlement and business_id = v_business for update;
  if not found or s.cancelled_at is not null or s.journal_entry_id is null then
    raise exception 'That settlement is not in force';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why it is cancelled'; end if;
  perform reverse_entry_internal(s.journal_entry_id,
    (business_local_date(v_business, now()) + time '12:00') at time zone (select timezone from business where id = v_business),
    'Reversal: platform settlement cancelled: ' || trim(p_reason));
  update platform_order set settlement_id = null, settlement_reference = null, settled_at = null, actual_payout = null
   where settlement_id = p_settlement;
  update platform_settlement set cancelled_at = now(), cancelled_by = (current_member()).id, cancel_reason = trim(p_reason)
   where id = p_settlement;
  perform audit_event(v_business, 'platform.settlement_cancel', 'platform_settlement', p_settlement::text, trim(p_reason),
    null, jsonb_build_object('reference', s.reference));
end $$;

-- =============================================================================
-- 5. The alerts: platform money by order, margins never rounded up
-- =============================================================================
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language plpgsql stable set search_path = public as $$
declare
  v_tz text; v_today date; v_loc uuid;
  v_use_types movement_type[] := array['sale_consumption', 'production_consumption', 'waste', 'spoilage',
    'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling', 'damaged', 'expired']::movement_type[];
  v_lead numeric := alert_setting(p_business, 'lead_time_days');
  v_target numeric := alert_setting(p_business, 'margin_target_percent');
  v_running uuid[] := '{}';
  v_seen text[] := '{}';
  v_costs jsonb;                                       -- item id -> its cost now, and whether it is a fallback
  v_nocost jsonb := '{}';                              -- item id -> the products that use it
  r record; v_daily numeric; v_cost numeric; v_n int; v_zero uuid[]; v_fallback boolean; v_broken boolean;
  v_item uuid; v_pname text;
begin
  select timezone into v_tz from business where id = p_business;
  v_today := business_local_date(p_business, p_now);
  v_loc := default_location(p_business);

  -- Cash below zero: a till, safe or bank balance under nothing.
  return query
    select 'cash_negative'::text, a.code::text, 'red'::text,
           format('%s is %s IQD: below zero', a.name, alert_money(a.bal)),
           'Money cannot leave a place before it is there: a payment was recorded from the wrong place, or takings are missing.'::text,
           'Open the account''s journal lines and record where the money really came from.'::text,
           'high'::text, '/journals?account=' || a.code,
           jsonb_build_object('account', a.code, 'balance', a.bal)
      from (select g.code, g.name, gl_balance_at(p_business, g.code, 'infinity') as bal
              from gl_account g
             where g.business_id = p_business and g.code in ('1000', '1005', '1020')) a
     where a.bal < 0;

  -- A drawer not counted: days before today whose cash no count has covered.
  return query
    select 'drawer_uncounted'::text, u.location_id::text,
           case when count(*) >= 2 then 'red' else 'orange' end::text,
           case when count(*) = 1
                then format('The drawer at %s has not been counted for %s', l.name, to_char(min(u.day), 'DD Mon'))
                else format('The drawer at %s has not been counted for %s days, since %s', l.name, count(*),
                            to_char(min(u.day), 'DD Mon')) end,
           'Until the drawer is counted, nobody knows whether the cash is all there.'::text,
           'Count the drawer on Sales.'::text, 'high'::text, '/sales'::text,
           jsonb_build_object('days', jsonb_agg(u.day order by u.day))
      from uncounted_days(p_business) u join location l on l.id = u.location_id
     where u.day < v_today
     group by u.location_id, l.name;

  -- A stock count left open.
  return query
    select 'count_stale'::text, c.id::text, 'orange'::text,
           format('A stock count has been open since %s', to_char(c.started_at at time zone v_tz, 'DD Mon HH24:MI')),
           'An open count is not in the books yet, and the longer it stays open the harder it is to finish honestly.'::text,
           'Finish it, or cancel it, on Stock Count.'::text, 'high'::text, '/count'::text,
           jsonb_build_object('count_id', c.id, 'status', c.status, 'started_at', c.started_at)
      from stock_count c
     where c.business_id = p_business and c.status in ('draft', 'counting', 'submitted')
       and c.started_at < p_now - make_interval(hours => alert_setting(p_business, 'count_stale_hours')::int);

  -- Running out: days of cover (on hand ÷ average daily use over the last 14
  -- days) under the time a delivery takes plus a day — the item's last
  -- supplier's own, or the café's. Quiet with under 7 days of history, and on
  -- a day the item was received.
  for r in
    with hist as (
      select m.item_id, min(business_local_date(p_business, m.occurred_at)) as first_day,
             -sum(m.base_quantity_signed) filter (
                where m.occurred_at >= p_now - interval '14 days'
                  and (m.type = any (v_use_types) or m.type = 'refund_return_to_stock'
                       or (m.type = 'reversal' and m.reference_type = 'sale_void')
                       or (m.type = 'reversal' and m.reference_type = 'production_cancel' and m.base_quantity_signed > 0)))
               as used,
             bool_or(m.type = 'purchase_receipt' and business_local_date(p_business, m.occurred_at) = v_today) as received_today
        from inventory_movement m
       where m.business_id = p_business
       group by m.item_id
    ),
    onhand as (
      select cs.item_id, sum(cs.quantity_base) as qty from current_stock cs where cs.business_id = p_business group by 1
    ),
    supplied as (
      select distinct on (m.item_id) m.item_id, s.lead_time_days
        from inventory_movement m
        join goods_receipt g on g.id = m.reference_id
        join supplier s on s.id = g.supplier_id
       where m.business_id = p_business and m.type = 'purchase_receipt' and m.reference_type = 'goods_receipt'
       order by m.item_id, m.occurred_at desc, m.created_at desc
    )
    select i.id, i.name, i.base_unit_code, coalesce(o.qty, 0) as qty, h.used,
           least(14, v_today - h.first_day) as window_days, v_today - h.first_day as history_days, h.received_today,
           coalesce(sp.lead_time_days, v_lead) as lead,
           exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active) as made
      from item i join hist h on h.item_id = i.id
      left join onhand o on o.item_id = i.id
      left join supplied sp on sp.item_id = i.id
     where i.business_id = p_business and i.is_active
  loop
    continue when r.history_days < 7 or r.received_today or coalesce(r.used, 0) <= 0;
    v_daily := r.used / r.window_days;                  -- average use a day
    continue when r.qty / v_daily >= r.lead + 1;
    v_running := v_running || r.id;
    rule := 'running_out'; subject := r.id::text;
    urgency := case when r.qty / v_daily < 1 then 'red' else 'orange' end;
    title := format('%s runs out in %s: %s %s left, using about %s a day', r.name,
                    case when r.qty <= 0 then 'no time' when r.qty / v_daily < 1 then 'under a day'
                         else trim_scale(round(r.qty / v_daily, 1)) || ' days' end,
                    alert_qty(r.qty), r.base_unit_code, alert_qty(v_daily));
    why := 'What is sold without stock is costed wrongly, and customers are turned away.';
    action := case when r.made then 'Make a batch on Production.'
                   else format('Order about %s %s (a week of use).', alert_qty(ceil(v_daily * 7)), r.base_unit_code) end;
    confidence := case when r.history_days >= 28 then 'high' when r.history_days >= 14 then 'medium' else 'low' end;
    link := '/inventory/' || r.id;
    facts := jsonb_build_object('on_hand', r.qty, 'daily_use', round(v_daily, 4), 'history_days', r.history_days,
                                'lead_time_days', r.lead);
    return next;
  end loop;

  -- Below its reorder level, items never moved included (unless running out says it already).
  return query
    select 'below_minimum'::text, i.id::text, 'orange'::text,
           format('%s: %s %s on hand, below its reorder level of %s', i.name, alert_qty(coalesce(o.qty, 0)),
                  i.base_unit_code, alert_qty(i.min_level_base)),
           'Below the reorder level there may not be enough until the next delivery.'::text,
           case when exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active)
                then 'Make a batch on Production.' else 'Order it.' end,
           'high'::text, '/inventory/' || i.id,
           jsonb_build_object('on_hand', coalesce(o.qty, 0), 'min_level', i.min_level_base)
      from item i
      left join (select cs.item_id, sum(cs.quantity_base) as qty from current_stock cs
                  where cs.business_id = p_business group by 1) o on o.item_id = i.id
     where i.business_id = p_business and i.is_active and i.min_level_base > 0
       and coalesce(o.qty, 0) < i.min_level_base and not (i.id = any (v_running));

  -- A delivery price far from the cost now, confirmed in the last week (0027).
  return query
    select 'price_confirmed'::text, a.id::text, 'orange'::text,
           coalesce(a.reason, 'A delivery price was confirmed') || coalesce(' — confirmed by ' || u.full_name, ''),
           'A price typed wrongly changes the cost of everything made from the item until it is corrected.'::text,
           'Check it against the supplier''s invoice.'::text, 'high'::text, '/purchasing'::text,
           jsonb_build_object('receipt_id', a.entity_id, 'confirmed_at', a.occurred_at)
      from audit_log a left join app_user u on u.id = a.app_user_id
     where a.business_id = p_business and a.action = 'purchase.price_confirmed'
       and a.occurred_at >= p_now - interval '7 days';

  -- Margins: sold below cost (red), or under the target margin (orange); a
  -- product sold with no recipe; and an ingredient with no cost yet, named
  -- once with the products that use it. Every item is costed once, as a sale
  -- would take it off the shelf now; a cost from the last delivery, for an
  -- item with none on hand, makes the margin less sure.
  select coalesce(jsonb_object_agg(i.id, jsonb_build_object(
           'c', item_issue_cost(p_business, i.id, v_loc), 'f', not (p.qty > 0 and p.value > 0))), '{}')
    into v_costs
    from item i cross join lateral item_position(p_business, i.id, v_loc) p
   where i.business_id = p_business;
  for r in
    select pv.id as vid, p.name as pname, pv.name as vname, ch, price_on(pv.id, ch, v_loc, v_today) as price
      from product_variant pv join product p on p.id = pv.product_id
      cross join unnest(enum_range(null::sales_channel)) ch
     where pv.business_id = p_business and pv.is_active and p.is_active and pv.no_stock_reason is null
  loop
    continue when r.price is null or r.price <= 0;
    v_pname := r.pname || case when r.vname <> r.pname then ' — ' || r.vname else '' end;
    v_broken := false;
    begin
      select count(*), coalesce(sum(money_round(p_business, (v_costs -> e.item_id::text ->> 'c')::numeric * e.base_qty)), 0),
             coalesce(array_agg(e.item_id) filter (
               where coalesce((v_costs -> e.item_id::text ->> 'c')::numeric, 0) <= 0 and e.base_qty > 0), '{}'),
             coalesce(bool_or((v_costs -> e.item_id::text ->> 'f')::boolean), false)
        into v_n, v_cost, v_zero, v_fallback
        from expand_variant(r.vid, r.ch, 1, v_today) e;
    exception when others then
      v_n := 0; v_broken := true;                      -- its recipe cannot be read today
    end;
    if v_n = 0 then
      subject := r.vid::text;
      continue when subject = any (v_seen);            -- once, whichever channels it is sold on
      v_seen := v_seen || subject;
      rule := 'no_recipe'; urgency := 'orange'; confidence := 'high'; link := '/products';
      title := case when v_broken then format('%s cannot be sold: its recipe has no version in force today', v_pname)
                    else format('%s is sold with no recipe: its sales are costed at nothing', v_pname) end;
      why := 'A sale costed at nothing overstates the profit, and its stock is never taken off the shelf.';
      action := 'Give it its recipe on Products, or say why it uses no stock.';
      facts := jsonb_build_object('variant_id', r.vid);
      return next;
      continue;
    end if;
    if cardinality(v_zero) > 0 then
      foreach v_item in array v_zero loop
        if not coalesce(v_nocost -> v_item::text, '[]'::jsonb) ? v_pname then
          v_nocost := jsonb_set(v_nocost, array[v_item::text],
                                coalesce(v_nocost -> v_item::text, '[]'::jsonb) || to_jsonb(v_pname));
        end if;
      end loop;
      continue;                                        -- its margin waits for every ingredient's cost
    end if;
    if r.price < v_cost or (r.price - v_cost) / r.price * 100 < v_target then
      rule := 'margin'; subject := r.vid || ':' || r.ch;
      urgency := case when r.price < v_cost then 'red' else 'orange' end;
      title := format('%s (%s): %s at %s IQD, costing %s', v_pname, alert_channel(r.ch),
                      case when r.price < v_cost then 'sold below cost'
                           else trim_scale(trunc((r.price - v_cost) / r.price * 100, 1)) || '% margin' end,
                      alert_money(r.price), alert_money(v_cost));
      why := case when r.price < v_cost then 'Every one sold loses money.'
                  else format('Under the %s%% target, the price no longer covers what the recipe costs now.', trim_scale(v_target)) end;
      action := 'Review the price, or the recipe, on Products.';
      confidence := case when v_fallback then 'medium' else 'high' end;
      link := '/products';
      facts := jsonb_build_object('variant_id', r.vid, 'channel', r.ch, 'price', r.price, 'cost', v_cost,
                                  'target_percent', v_target, 'cost_from_last_delivery', v_fallback);
      return next;
    end if;
  end loop;

  return query
    select 'no_cost'::text, i.id::text, 'orange'::text,
           format('%s has no cost yet, and %s use%s it: %s', i.name,
                  case when jsonb_array_length(x.v) = 1 then '1 product' else jsonb_array_length(x.v) || ' products' end,
                  case when jsonb_array_length(x.v) = 1 then 's' else '' end,
                  (select string_agg(n, ', ' order by n) from (select jsonb_array_elements_text(x.v) n order by 1 limit 4) q)
                  || case when jsonb_array_length(x.v) > 4 then format(' and %s more', jsonb_array_length(x.v) - 4) else '' end),
           'Every sale that uses it is costed at nothing for it, so its profit is overstated.'::text,
           case when exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active)
                then 'Make a batch on Production: its cost comes from its ingredients.'
                else 'Receive it with its cost, or give it its opening stock, on Inventory.' end,
           'high'::text, '/inventory/' || i.id,
           jsonb_build_object('item_id', i.id, 'products', x.v)
      from jsonb_each(v_nocost) x(k, v) join item i on i.id = x.k::uuid;

  -- Waste well above its usual: the last 7 days against the weeks before.
  return query
    with w as (
      select coalesce(sum(l.debit - l.credit) filter (where e.occurred_at >= p_now - interval '7 days'), 0) as last7,
             coalesce(sum(l.debit - l.credit) filter (where e.occurred_at < p_now - interval '7 days'
                                                        and e.occurred_at >= p_now - interval '35 days'), 0) as prior,
             (select v_today - min(business_local_date(p_business, e2.occurred_at))
                from journal_entry e2 where e2.business_id = p_business and e2.status = 'published') as history_days
        from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
       where e.business_id = p_business and e.status = 'published' and g.code = '5300'
         and e.occurred_at >= p_now - interval '35 days' and e.occurred_at < p_now
    ), x as (
      select w.*, least(28, w.history_days - 7) as prior_days from w
    )
    select 'waste_spike'::text, 'waste'::text, 'orange'::text,
           format('Waste of %s IQD in the last 7 days, against about %s in a usual week', alert_money(x.last7),
                  alert_money(x.prior / x.prior_days * 7)),
           'Waste well above its usual is money leaving through the bin: a delivery gone off, a recipe, or a habit.'::text,
           'Look at the waste on Inventory: which items, and who recorded them.'::text,
           (case when x.prior_days >= 28 then 'medium' else 'low' end)::text, '/inventory'::text,
           jsonb_build_object('last7', x.last7, 'usual_week', round(x.prior / x.prior_days * 7), 'prior_days', x.prior_days)
      from x
     where x.prior_days >= 7 and x.prior > 0
       and x.last7 > alert_setting(p_business, 'waste_spike_factor') * (x.prior / x.prior_days * 7)
       and x.last7 > alert_setting(p_business, 'waste_spike_min');

  -- One person's voids, refunds, discounts and cancelled bills in the last 7
  -- days: more than a share of their own sales, or more than a set number.
  return query
    with ex as (
      select sa.requested_by as person, sa.amount, 1 as n
        from sale_adjustment sa
       where sa.business_id = p_business and sa.kind in ('void', 'refund') and sa.created_at >= p_now - interval '7 days'
      union all
      select coalesce(o.discount_by, o.cashier_id), o.discount_amount, 1
        from sales_order o
       where o.business_id = p_business and o.discount_amount > 0 and o.status <> 'open'
         and o.placed_at >= p_now - interval '7 days'
      union all
      select a.app_user_id, 0, 1
        from audit_log a
       where a.business_id = p_business and a.action = 'bill.cancel'
         and jsonb_typeof(a.before_state -> 'lines') = 'array' and a.occurred_at >= p_now - interval '7 days'
    ), per as (
      select ex.person, sum(ex.amount) as amount, sum(ex.n) as n,
             (select coalesce(sum(o.gross_amount), 0) from sales_order o
               where o.business_id = p_business and o.cashier_id = ex.person and o.status <> 'open'
                 and o.placed_at >= p_now - interval '7 days') as own_sales
        from ex where ex.person is not null group by ex.person
    )
    select 'exceptions_person'::text, per.person::text, 'orange'::text,
           format('%s: %s void(s), refund(s), discount(s) or cancelled bill(s) in 7 days, %s IQD%s', u.full_name, per.n,
                  alert_money(per.amount),
                  case when per.own_sales > 0 then format(' (%s%% of their sales)', trim_scale(round(per.amount / per.own_sales * 100, 1)))
                       else '' end),
           'Most exceptions have good reasons; a pattern is worth a look. This is evidence, not an accusation.'::text,
           'Review them on Reports → Exceptions.'::text, 'medium'::text, '/reports#exceptions'::text,
           jsonb_build_object('count', per.n, 'amount', per.amount, 'own_sales', per.own_sales)
      from per join app_user u on u.id = per.person
     where per.n >= alert_setting(p_business, 'exceptions_count')
        or (per.own_sales > 0 and per.amount > 0
            and per.amount / per.own_sales * 100 > alert_setting(p_business, 'exceptions_share_percent'));

  -- Card money not banked: what 1010 holds beyond the takings of the last few
  -- days (a settlement clears the oldest first).
  return query
    select 'card_not_banked'::text, '1010'::text, 'orange'::text,
           format('%s IQD of card money is more than %s days old and not yet recorded as settled', alert_money(c.old), c.days),
           'Card takings should reach the bank within a few days; money that does not may never have been taken.'::text,
           'Record the card settlement on Sales, from the terminal''s report and the bank statement.'::text,
           'high'::text, '/sales#card'::text,
           jsonb_build_object('balance', c.bal, 'older_than_days', c.days, 'amount', c.old)
      from (select t.days, t.bal,
                   t.bal - coalesce((select sum(l.debit) from journal_line l
                                       join journal_entry e on e.id = l.journal_entry_id
                                       join gl_account g on g.id = l.account_id
                                      where e.business_id = p_business and e.status = 'published' and g.code = '1010'
                                        and e.occurred_at >= p_now - make_interval(days => t.days)), 0) as old
              from (select alert_setting(p_business, 'card_days')::int as days,
                           gl_balance_at(p_business, '1010', 'infinity') as bal) t) c
     where c.old > 0;

  -- Platform money not received: orders not paid out past the platform's
  -- cycle, by order number (0030); and what platform receivable holds that
  -- no order explains (sales from before order numbers, or a payout
  -- recorded by hand).
  return query
    select 'platform_not_received'::text, dp.code, 'orange'::text,
           format('%s %s order%s, %s IQD, %s more than %s days old and not yet paid out; the oldest from %s',
                  count(*), dp.name, case when count(*) = 1 then '' else 's' end, alert_money(sum(o.net_amount)),
                  case when count(*) = 1 then 'is' else 'are' end, alert_setting(p_business, 'platform_days')::int,
                  to_char(min(o.placed_at) at time zone v_tz, 'DD Mon')),
           'Platform payouts come on a cycle; an order past it may be missing from a statement.'::text,
           'Match the platform''s statement on Delivery Platforms, and raise any order it left out.'::text,
           'high'::text, '/platforms'::text,
           jsonb_build_object('orders', count(*), 'amount', sum(o.net_amount), 'oldest', min(o.placed_at))
      from platform_order po
      join delivery_platform dp on dp.id = po.platform_id
      join sales_order o on o.id = po.sales_order_id
     where po.business_id = p_business and po.settlement_id is null and o.status not in ('voided', 'refunded')
       and o.placed_at < p_now - make_interval(days => alert_setting(p_business, 'platform_days')::int)
     group by dp.code, dp.name;
  return query
    select 'platform_not_received'::text, 'unmatched'::text, 'orange'::text,
           case when x.gap > 0
                then format('%s IQD in platform receivable is matched to no order', alert_money(x.gap))
                else format('Platform receivable is %s IQD short of the orders waiting to be paid out', alert_money(-x.gap)) end,
           'Sales from before order numbers, or a payout recorded by hand, leave platform receivable unexplained by any order.'::text,
           'Find the statement it belongs to; correct it with a journal on Journals if it was recorded by hand.'::text,
           'medium'::text, '/journals?account=1100'::text,
           jsonb_build_object('receivable', x.bal, 'orders_waiting', x.waiting, 'gap', x.gap)
      from (select b.bal, b.waiting, b.bal - b.waiting as gap
              from (select gl_balance_at(p_business, '1100', 'infinity') as bal,
                           coalesce((select sum(o.net_amount) from platform_order po
                                       join sales_order o on o.id = po.sales_order_id
                                      where po.business_id = p_business and po.settlement_id is null
                                        and o.status not in ('voided', 'refunded')), 0) as waiting) b) x
     where x.gap <> 0;

  -- Supplier bills due within a few days, or overdue.
  return query
    select 'bill_due'::text, pi.id::text, 'orange'::text,
           format('%s: %s IQD %s', coalesce(s.name, 'A supplier'), alert_money(pi.amount_total - pi.paid_amount),
                  case when pi.due_date < v_today then format('overdue by %s day(s)', v_today - pi.due_date)
                       when pi.due_date = v_today then 'due today'
                       else format('due on %s', to_char(pi.due_date, 'DD Mon')) end),
           'Bills paid late cost goodwill, and sometimes a late fee.'::text,
           'Pay it, or agree a date with the supplier, on Vendors.'::text, 'high'::text, '/vendors'::text,
           jsonb_build_object('bill_id', pi.id, 'invoice_no', pi.invoice_no, 'due_date', pi.due_date,
                              'owed', pi.amount_total - pi.paid_amount)
      from purchase_invoice pi left join supplier s on s.id = pi.supplier_id
     where pi.business_id = p_business and pi.cancelled_at is null and pi.amount_total - pi.paid_amount > 0
       and pi.due_date is not null and pi.due_date <= v_today + alert_setting(p_business, 'bill_due_days')::int;

  -- A price that looks typed wrongly: one channel more than 3× another.
  return query
    with pr as (
      select pv.id as vid, p.name || case when pv.name <> p.name then ' — ' || pv.name else '' end as pname,
             ch, price_on(pv.id, ch, v_loc, v_today) as price
        from product_variant pv join product p on p.id = pv.product_id
        cross join unnest(enum_range(null::sales_channel)) ch
       where pv.business_id = p_business and pv.is_active and p.is_active
    ), mm as (
      select vid, pname, max(price) as hi, min(price) as lo,
             (array_agg(ch order by price desc))[1] as hi_ch, (array_agg(ch order by price))[1] as lo_ch
        from pr where price > 0 group by vid, pname having count(*) >= 2
    )
    select 'price_typo'::text, mm.vid::text, 'orange'::text,
           format('%s is %s IQD on %s but %s on %s', mm.pname, alert_money(mm.hi), alert_channel(mm.hi_ch),
                  alert_money(mm.lo), alert_channel(mm.lo_ch)),
           'A price more than three times another channel''s is usually a missing or extra zero.'::text,
           'Confirm it on Products.'::text, 'medium'::text, '/products'::text,
           jsonb_build_object('variant_id', mm.vid, 'high', mm.hi, 'low', mm.lo)
      from mm
     where mm.hi > alert_setting(p_business, 'price_typo_factor') * mm.lo;

  -- A payment that may have been recorded twice: two expenses, bills or
  -- journals to the same running-cost account, for the same amount, within 3 days.
  return query
    with pay as (
      select e.id, e.journal_no, e.occurred_at, g.code, g.name as account, l.debit as amount
        from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
       where e.business_id = p_business and e.status = 'published' and e.reverses_entry is null
         and not exists (select 1 from journal_entry rv where rv.reverses_entry = e.id and rv.status = 'published')
         and e.reference_type in ('manual', 'expense', 'purchase_invoice', 'correction')
         and g.code like '6%' and l.debit > 0 and e.occurred_at >= p_now - interval '30 days'
    )
    select 'duplicate_payment'::text, a.id::text || ':' || b.id::text, 'orange'::text,
           format('Possible duplicate: %s %s IQD in journal %s (%s) and journal %s (%s)', a.account, alert_money(a.amount),
                  a.journal_no, to_char(a.occurred_at at time zone v_tz, 'DD Mon'),
                  b.journal_no, to_char(b.occurred_at at time zone v_tz, 'DD Mon')),
           'The same amount to the same account twice in a few days is sometimes paid twice.'::text,
           'Confirm both are right, or reverse one on Journals.'::text, 'medium'::text,
           '/journals?account=' || a.code,
           jsonb_build_object('entries', jsonb_build_array(a.journal_no, b.journal_no), 'amount', a.amount)
      from pay a join pay b on b.code = a.code and b.amount = a.amount and a.journal_no < b.journal_no
                           and abs(extract(epoch from b.occurred_at - a.occurred_at)) <= 3 * 86400;
end $$;

-- =============================================================================
-- 6. Who may call what
-- =============================================================================
revoke execute on function
  signed_line(text, numeric), platform_id_for(uuid, sales_channel), platform_statement_match(uuid, text, jsonb)
  from public, anon, authenticated;
revoke execute on function
  card_takings(), record_card_settlement(date, numeric, numeric, date, text, text), cancel_card_settlement(uuid, text),
  platform_money(), match_platform_statement(text, jsonb), post_platform_settlement(text, text, jsonb, date, text),
  cancel_platform_settlement(uuid, text),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text)
  from public, anon;
grant execute on function
  card_takings(), record_card_settlement(date, numeric, numeric, date, text, text), cancel_card_settlement(uuid, text),
  platform_money(), match_platform_statement(text, jsonb), post_platform_settlement(text, text, jsonb, date, text),
  cancel_platform_settlement(uuid, text),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text)
  to authenticated;
