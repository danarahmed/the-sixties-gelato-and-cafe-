-- =============================================================================
-- 0024 — Counts that hold while the café trades, and a drawer that adds up
-- =============================================================================
-- The September 2026 audit (docs/SYSTEM_AUDIT_2026-09.md, P0-1 to P0-3) found
-- three ways everyday use could make the numbers wrong:
--
--  * A stock count compared what was counted with the stock saved when the
--    count OPENED. Anything sold, received or made before an item was counted
--    was posted a second time, and two open counts posted the same difference
--    twice. Now each item is compared with the stock at the moment it is
--    counted, only one count is open at a time, and an open count can be
--    cancelled.
--  * The day close counted the drawer against one calendar day's cash sales,
--    and sales kept landing in a day already closed. The café trades past
--    midnight, and its trading day ends at midnight, so a night's drawer holds
--    two calendar days. Now a drawer count covers every movement of cash at
--    the location since the previous count, whatever the day; a sale after a
--    count simply waits for the next one. What is left in the drawer carries
--    to the next count; the rest goes to the safe or the bank.
--  * Money paid "from cash" left the till's account (1000) without the close
--    knowing, and nothing checked the cash was there. Now every payment says
--    where the money came from: the till, the safe (new account 1005), the
--    bank, a card, or the owner personally. Paying out of the till lowers what
--    the drawer should hold; neither the till nor the safe may go below zero
--    in the books; and 1000 moves only through sales, refunds, payments, drawer
--    counts and moving cash, never a manual journal.
--
-- And an item with no stock history can be given its opening stock at what it
-- cost, as a new item can, so that clearing the test records before trading
-- does not leave the stock to be issued at a cost of zero.
--
-- Nothing recorded before this migration changes. Days closed the old way stay
-- closed; the first drawer count after them is told what the drawer held when
-- it began.

-- =============================================================================
-- 1. Stock counts compare with the stock when each item is counted
-- =============================================================================
alter table stock_count_line add column if not exists expected_at_count numeric;
alter table stock_count_line add column if not exists counted_at timestamptz;
-- Neither is granted to signed-in users (0016 grants stock_count_line column by
-- column): the counter never learns what the ledger expects.

-- One count at a time at a location: two open counts would each post the same
-- difference.
create or replace function start_stock_count(p_items uuid[] default null, p_location uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.count');
  v_me uuid := (current_member()).id;
  v_location uuid; v_count uuid; o record;
begin
  v_location := resolve_location(v_business, p_location);
  perform 1 from location where id = v_location for no key update;
  select c.started_at, c.status, u.full_name into o
    from stock_count c left join app_user u on u.id = c.counted_by
   where c.business_id = v_business and c.location_id = v_location and c.status in ('counting', 'submitted')
   order by c.started_at limit 1;
  if found then
    raise exception 'A count is already % here (started % by %). Finish or cancel it first',
      case when o.status = 'counting' then 'open' else 'waiting for review' end,
      to_char(o.started_at at time zone (select timezone from business where id = v_business), 'DD Mon HH24:MI'),
      coalesce(o.full_name, 'someone');
  end if;
  insert into stock_count (business_id, location_id, count_type, status, is_blind, counted_by)
  values (v_business, v_location, case when p_items is null then 'full' else 'cycle' end::count_type,
          'counting', true, v_me)
  returning id into v_count;
  insert into stock_count_line (stock_count_id, item_id, expected_base)
  select v_count, i.id, (item_position(v_business, i.id, v_location)).qty
    from item i where i.business_id = v_business and i.is_active
     and (p_items is null or i.id = any(p_items));
  return v_count;
end $$;

-- Each entry also records what the ledger held at that moment, out of the
-- counter's sight. Postings on the item wait for it, so the two agree.
create or replace function record_count(p_count uuid, p_item uuid, p_counted numeric, p_unit_code text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('inventory.count'); c stock_count;
begin
  select * into c from stock_count where id = p_count and business_id = v_business;
  if not found then raise exception 'Count not found'; end if;
  if c.counted_by is distinct from (current_member()).id then raise exception 'Only the person counting can enter counts'; end if;
  if c.status <> 'counting' then raise exception 'This count is already %', c.status; end if;
  if p_counted is null or p_counted < 0 then raise exception 'Enter what you counted'; end if;
  if not exists (select 1 from stock_count_line where stock_count_id = p_count and item_id = p_item) then
    raise exception 'That item is not in this count';
  end if;
  perform lock_items(array[p_item]);
  update stock_count_line
     set counted_base = to_base_qty(p_item, p_counted, p_unit_code),
         counted_at = now(),
         expected_at_count = (item_position(v_business, p_item, c.location_id)).qty
   where stock_count_id = p_count and item_id = p_item;
end $$;

-- What a reviewer sees. Expected is the stock when the item was counted; an
-- approved count shows the value it posted, not today's.
create or replace function review_stock_count(p_count uuid)
returns table (item_id uuid, item_name text, expected numeric, counted numeric, variance numeric, variance_value numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('inventory.count.view_expected'); c stock_count;
begin
  select * into c from stock_count where id = p_count and business_id = v_business;
  if not found then raise exception 'Count not found'; end if;
  return query
    select l.item_id, i.name, coalesce(l.expected_at_count, l.expected_base), l.counted_base,
           l.counted_base - coalesce(l.expected_at_count, l.expected_base),
           case when m.id is not null then m.value * sign(m.base_quantity_signed)
                else money_round(v_business, (l.counted_base - coalesce(l.expected_at_count, l.expected_base))
                                             * item_issue_cost(v_business, l.item_id, c.location_id)) end
      from stock_count_line l join item i on i.id = l.item_id
      left join inventory_movement m on m.id = l.adjustment_movement_id
     where l.stock_count_id = p_count
     order by i.name;
end $$;

-- A different person approves; each difference is counted against the stock
-- at the moment its item was counted, so trading during the count is never
-- posted twice. Posted as of the moment the count was submitted, as before.
create or replace function approve_stock_count(p_count uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  c stock_count; l record; v_delta numeric; v_cost numeric; v_value numeric; v_mv uuid;
  v_loss numeric := 0; v_gain numeric := 0; v_journal uuid; v_items uuid[];
begin
  select * into c from stock_count where id = p_count and business_id = v_business for update;
  if not found then raise exception 'Count not found'; end if;
  if c.status <> 'submitted' then raise exception 'Only a submitted count can be approved; this one is %', c.status; end if;
  if c.counted_by = v_me then
    raise exception 'A count must be approved by someone other than the person who counted it' using errcode = '42501';
  end if;
  select array_agg(item_id) into v_items from stock_count_line where stock_count_id = p_count;
  if v_items is not null then perform lock_items(v_items); end if;

  for l in select * from stock_count_line where stock_count_id = p_count loop
    v_delta := l.counted_base - coalesce(l.expected_at_count, l.expected_base);
    continue when v_delta = 0;
    v_cost := item_issue_cost(v_business, l.item_id, c.location_id);
    v_value := money_round(v_business, v_cost * abs(v_delta));
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason, approval_status, occurred_at)
    values (v_business, l.item_id, c.location_id, 'count_adjustment', v_delta, v_cost, v_value,
            'stock_count', p_count, v_me, 'Count variance', 'approved', c.submitted_at)
    returning id into v_mv;
    update stock_count_line set adjustment_movement_id = v_mv where id = l.id;
    if v_delta < 0 then v_loss := v_loss + v_value; else v_gain := v_gain + v_value; end if;
  end loop;

  if v_loss > 0 or v_gain > 0 then
    v_journal := post_journal(v_business, c.submitted_at, 'Stock count variance', 'stock_count', p_count,
      jsonb_build_array(
        jsonb_build_object('code', '5400', 'debit', v_loss), jsonb_build_object('code', '1200', 'credit', v_loss),
        jsonb_build_object('code', '1200', 'debit', v_gain), jsonb_build_object('code', '5400', 'credit', v_gain)));
  end if;
  update stock_count set status = 'approved', approved_by = v_me, approved_at = now() where id = p_count;
  perform audit_event(v_business, 'inventory.count.approve', 'stock_count', p_count::text, null, null,
                      jsonb_build_object('loss', v_loss, 'gain', v_gain));
  return jsonb_build_object('loss', v_loss, 'gain', v_gain,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- A count still being counted can be cancelled by its counter or a manager,
-- with a reason. Nothing was posted, and it stays on record as rejected.
create or replace function cancel_stock_count(p_count uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.count', 'inventory.adjust.approve');
  v_me uuid := (current_member()).id; c stock_count;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the count is cancelled'; end if;
  select * into c from stock_count where id = p_count and business_id = v_business for update;
  if not found then raise exception 'Count not found'; end if;
  if c.status <> 'counting' then
    raise exception 'Only a count still being counted can be cancelled; a submitted count is approved or rejected by its reviewer';
  end if;
  if c.counted_by is distinct from v_me and not current_has_permission('inventory.adjust.approve') then
    raise exception 'Only the person counting or a manager can cancel this count' using errcode = '42501';
  end if;
  update stock_count
     set status = 'rejected', approved_by = v_me, approved_at = now(), rejected_reason = 'Cancelled: ' || trim(p_reason)
   where id = p_count;
  perform audit_event(v_business, 'inventory.count.cancel', 'stock_count', p_count::text, trim(p_reason), null, null);
end $$;

-- =============================================================================
-- 2. Where cash is kept: the till (1000) and the safe (1005)
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
    ('6900','Other expenses',             'expense',   'debit')
  ) as a(code, name, t, nb)
  on conflict (business_id, code) do update set is_system = true;
end $$;

select provision_chart_of_accounts(id) from business;
-- 1000 is now exactly the till's cash; a name the owner chose is kept.
update gl_account set name = 'Cash in the till' where code = '1000' and name = 'Cash on hand';

-- Which account each way of paying uses. 'cash' is the till and 'transfer' the
-- bank, as before; money the owner pays personally is capital they put in.
create or replace function payment_account(p_method text) returns text
language sql immutable as $$
  select case lower(p_method) when 'till' then '1000' when 'cash' then '1000' when 'safe' then '1005'
                              when 'card' then '1010' when 'bank' then '1020' when 'transfer' then '1020'
                              when 'owner' then '3000' end
$$;

-- The till's own cash moves only through sales, refunds, payments, drawer
-- counts and moving cash, so the drawer and 1000 always tell the same story.
create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$ select p_code in ('1000', '1200', '2000', '2050', '3100') $$;

-- =============================================================================
-- 3. The drawer: every movement of cash at a location, until it is counted
-- =============================================================================
-- Sales, refunds and voids in cash; money paid out of the till; money moved in
-- and out. Signed: + into the drawer, − out of it. Each is taken in by exactly
-- one drawer count (work_shift_id, set once); none is ever changed or deleted.
create table if not exists cash_event (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business(id) on delete cascade,
  location_id    uuid not null references location(id),
  kind           text not null,
  amount         numeric not null,
  reference_type text not null,
  reference_id   uuid not null,
  work_shift_id  uuid references work_shift(id),
  created_by     uuid references app_user(id),
  created_at     timestamptz not null default now(),
  constraint cash_event_kind check (kind in ('sale', 'void', 'refund', 'paid_out', 'paid_out_reversed', 'cash_in', 'cash_out')),
  constraint cash_event_amount check (amount <> 0)
);
create index if not exists cash_event_uncounted on cash_event (business_id, location_id) where work_shift_id is null;
create index if not exists cash_event_reference on cash_event (reference_type, reference_id);
create index if not exists cash_event_shift on cash_event (work_shift_id);

-- Cash moved between the till, the safe, the bank and the owner. The takings
-- taken out after a drawer count name that count.
create table if not exists cash_transfer (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business(id) on delete cascade,
  location_id      uuid not null references location(id),
  from_place       text not null,
  to_place         text not null,
  amount           numeric not null,
  note             text,
  work_shift_id    uuid references work_shift(id),
  journal_entry_id uuid references journal_entry(id),
  created_by       uuid references app_user(id),
  created_at       timestamptz not null default now(),
  constraint cash_transfer_places check (from_place in ('till', 'safe', 'bank', 'owner')
                                         and to_place in ('till', 'safe', 'bank', 'owner') and from_place <> to_place),
  constraint cash_transfer_amount check (amount > 0)
);

create or replace function trg_cash_event_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Cash in and out of the drawer is never deleted' using errcode = 'check_violation';
  end if;
  -- The one change allowed: the drawer count that takes it in, once.
  if OLD.work_shift_id is null and NEW.work_shift_id is not null
     and (to_jsonb(NEW) - 'work_shift_id') = (to_jsonb(OLD) - 'work_shift_id') then
    return NEW;
  end if;
  raise exception 'Cash in and out of the drawer cannot change once recorded' using errcode = 'check_violation';
end $$;
drop trigger if exists cash_event_guard on cash_event;
create trigger cash_event_guard before update or delete on cash_event
  for each row execute function trg_cash_event_guard();

create or replace function trg_cash_transfer_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'A movement of cash cannot change or be deleted; record the opposite movement' using errcode = 'check_violation';
end $$;
drop trigger if exists cash_transfer_guard on cash_transfer;
create trigger cash_transfer_guard before update or delete on cash_transfer
  for each row execute function trg_cash_transfer_guard();

-- A drawer count: from the previous count to this one. The old day closes
-- stay as they are ('day'); from now on each count is a 'drawer' count, and
-- a calendar day may see two (one after midnight, one before the next).
alter table work_shift add column if not exists kind text not null default 'day';
alter table work_shift alter column kind set default 'drawer';
alter table work_shift add column if not exists covers_from timestamptz;
alter table work_shift add column if not exists left_in_drawer numeric;
alter table work_shift add column if not exists taken_out numeric;
alter table work_shift add column if not exists taken_to text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'work_shift_kind_ok') then
    alter table work_shift add constraint work_shift_kind_ok check (kind in ('day', 'drawer'));
  end if;
end $$;
drop index if exists work_shift_one_close_per_day;
create unique index if not exists work_shift_one_close_per_day
  on work_shift (business_id, location_id, business_day)
  where business_day is not null and closed_at is not null and kind = 'day';

-- The drawer at a location: its last count, what that count left in it, and
-- the cash in and out since. After a day closed the old way, or with cash
-- taken before drawer counts began, what it held at the start is not known:
-- the first drawer count is told.
create or replace function drawer_position(p_business uuid, p_location uuid,
  out last_count_id uuid, out last_count_at timestamptz, out carry numeric, out needs_start boolean,
  out moved numeric, out events int)
language plpgsql stable as $$
declare w work_shift;
begin
  select * into w from work_shift
   where business_id = p_business and location_id = p_location and closed_at is not null
   order by closed_at desc, id desc limit 1;
  last_count_id := w.id;
  last_count_at := w.closed_at;
  if w.id is not null and w.kind = 'drawer' then
    carry := coalesce(w.left_in_drawer, 0);
    needs_start := false;
  elsif w.id is null and not exists (
          select 1 from sales_order o join sales_tender t on t.sales_order_id = o.id and t.tender_type = 'cash'
           where o.business_id = p_business and o.location_id = p_location and o.status <> 'voided'
             and not exists (select 1 from cash_event e where e.reference_type = 'sales_order' and e.reference_id = o.id)) then
    carry := 0;
    needs_start := false;
  else
    carry := null;
    needs_start := true;
  end if;
  select coalesce(sum(amount), 0), count(*)::int into moved, events
    from cash_event where business_id = p_business and location_id = p_location and work_shift_id is null;
end $$;

-- Paying out of the till: the drawer must hold it, as far as the books know.
create or replace function assert_drawer_can_pay(p_business uuid, p_location uuid, p_amount numeric) returns void
language plpgsql as $$
declare d record;
begin
  d := drawer_position(p_business, p_location);
  if not d.needs_start and d.carry + d.moved < p_amount then
    raise exception 'The drawer should hold only % — not enough to pay %. Move cash into the till first, or pay from the safe, the bank or the owner',
      trim_scale(d.carry + d.moved), trim_scale(p_amount);
  end if;
end $$;

-- Paying out of the safe: after the payment, the safe must not be below zero.
create or replace function assert_safe_can_pay(p_business uuid, p_amount numeric) returns void
language plpgsql as $$
declare v numeric := gl_balance_at(p_business, '1005', 'infinity');
begin
  if v < 0 then
    raise exception 'The safe holds only % in the books — not enough to pay %. Put the takings in the safe first (Move cash), or say where the money came from',
      trim_scale(v + p_amount), trim_scale(p_amount);
  end if;
end $$;

-- Money paid out for an expense or a bill, after its journal is written.
create or replace function pay_out_of(p_business uuid, p_location uuid, p_from text, p_amount numeric,
                                      p_ref_type text, p_ref uuid, p_by uuid) returns void
language plpgsql as $$
begin
  if p_from = 'till' then
    perform assert_drawer_can_pay(p_business, p_location, p_amount);
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (p_business, p_location, 'paid_out', -p_amount, p_ref_type, p_ref, p_by);
  elsif p_from = 'safe' then
    perform assert_safe_can_pay(p_business, p_amount);
  end if;
end $$;

-- Every cash tender puts its money in the drawer of the sale's location.
create or replace function trg_cash_from_tender() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.tender_type = 'cash' and NEW.amount <> 0 then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    select o.business_id, o.location_id, 'sale', NEW.amount, 'sales_order', o.id, o.cashier_id
      from sales_order o where o.id = NEW.sales_order_id;
  end if;
  return NEW;
end $$;
drop trigger if exists sales_tender_cash on sales_tender;
create trigger sales_tender_cash after insert on sales_tender
  for each row execute function trg_cash_from_tender();

-- A refund paid in cash leaves the drawer (which must hold it); a void takes
-- back what its sale put in.
create or replace function trg_cash_from_adjustment() returns trigger
language plpgsql security definer set search_path = public as $$
declare o sales_order;
begin
  if NEW.kind not in ('refund', 'void') or coalesce(NEW.amount, 0) = 0 then return NEW; end if;
  select * into o from sales_order where id = NEW.sales_order_id;
  if NEW.kind = 'refund' then
    if exists (select 1 from sales_tender where sales_order_id = o.id and tender_type = 'cash') then
      perform assert_drawer_can_pay(o.business_id, o.location_id, NEW.amount);
      insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
      values (o.business_id, o.location_id, 'refund', -NEW.amount, 'sale_adjustment', NEW.id, NEW.requested_by);
    end if;
  elsif exists (select 1 from cash_event where reference_type = 'sales_order' and reference_id = o.id and kind = 'sale') then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (o.business_id, o.location_id, 'void', -NEW.amount, 'sale_adjustment', NEW.id, NEW.requested_by);
  end if;
  return NEW;
end $$;
drop trigger if exists sale_adjustment_cash on sale_adjustment;
create trigger sale_adjustment_cash after insert on sale_adjustment
  for each row execute function trg_cash_from_adjustment();

-- The cash already taken since a location's last day closed the old way (or
-- ever, where no day has closed) is in its drawer now. Before 0024 the till's
-- cash was account 1000, so each published movement of 1000 since then
-- becomes one of the drawer's first events, as the same record writes one
-- today: the first count expects it. Sales, voids and refunds take their
-- sale's location; what the old books did not place, the default location.
-- Once only, while there is no event yet (run below, as the migration goes
-- in: the triggers above already hold their tables, so nothing recorded
-- meanwhile is missed or taken twice).
create or replace function carry_cash_since_last_close() returns int
language plpgsql as $$
declare v_n int;
begin
  if exists (select 1 from cash_event) then return 0; end if;
  insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_at)
  select m.business_id, m.location_id, m.kind, m.amount, m.ref_type, m.ref_id, m.occurred_at
    from (
      select e.business_id, e.occurred_at, l.debit - l.credit as amount,
             coalesce(so.location_id, rso.location_id, rfo.location_id, default_location(e.business_id)) as location_id,
             case when e.reverses_entry is null and e.reference_type = 'sales_order' then 'sale'
                  when r.reference_type = 'sales_order' then 'void'
                  when e.reference_type = 'sale_refund' then 'refund'
                  when e.reverses_entry is null and e.reference_type in ('expense', 'supplier_payment') then 'paid_out'
                  when r.reference_type in ('expense', 'supplier_payment') then 'paid_out_reversed'
                  when l.debit > l.credit then 'cash_in'
                  else 'cash_out' end as kind,
             case when e.reverses_entry is null and e.reference_type = 'sales_order' and e.reference_id is not null
                    then 'sales_order'
                  when r.reference_type = 'sales_order' and va.id is not null then 'sale_adjustment'
                  when e.reference_type = 'sale_refund' and e.reference_id is not null then 'sale_adjustment'
                  when e.reverses_entry is null and e.reference_type in ('expense', 'supplier_payment')
                       and e.reference_id is not null then e.reference_type
                  else 'journal_entry' end as ref_type,
             case when e.reverses_entry is null and e.reference_type = 'sales_order' and e.reference_id is not null
                    then e.reference_id
                  when r.reference_type = 'sales_order' and va.id is not null then va.id
                  when e.reference_type = 'sale_refund' and e.reference_id is not null then e.reference_id
                  when e.reverses_entry is null and e.reference_type in ('expense', 'supplier_payment')
                       and e.reference_id is not null then e.reference_id
                  else e.id end as ref_id
        from journal_entry e
        join journal_line l on l.journal_entry_id = e.id and l.debit <> l.credit
        join gl_account a on a.id = l.account_id and a.code = '1000'
        left join journal_entry r on r.id = e.reverses_entry
        left join sales_order so on e.reverses_entry is null and e.reference_type = 'sales_order' and so.id = e.reference_id
        left join sales_order rso on r.reference_type = 'sales_order' and rso.id = r.reference_id
        left join lateral (select sa.id from sale_adjustment sa
                            where r.reference_type = 'sales_order' and sa.sales_order_id = r.reference_id and sa.kind = 'void'
                            order by sa.created_at limit 1) va on true
        left join sale_adjustment rf on e.reference_type = 'sale_refund' and rf.id = e.reference_id
        left join sales_order rfo on rfo.id = rf.sales_order_id
       where e.status = 'published'
    ) m
   where business_local_date(m.business_id, m.occurred_at) > coalesce(
           (select max(coalesce(w.business_day, business_local_date(w.business_id, w.opened_at))) from work_shift w
             where w.business_id = m.business_id and w.location_id = m.location_id and w.closed_at is not null),
           '-infinity'::date);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
select carry_cash_since_last_close();

-- =============================================================================
-- 4. Counting the drawer
-- =============================================================================
-- Count the cash, and say how much stays in the drawer for the next session;
-- the rest goes to the safe or the bank. Expected = what the last count left
-- (or, the first time, what the drawer held when trading began) + every cash
-- movement since. The difference posts to 6300 Cash over/short. Open bills
-- are settled or cancelled first, as before.
create or replace function count_drawer(p_counted numeric, p_left_in_drawer numeric default null,
                                        p_take_to text default null, p_start_cash numeric default null,
                                        p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close');
  v_me uuid := (current_member()).id;
  v_location uuid; d record; t record; v_start numeric; v_shift uuid; v_counted numeric; v_left numeric;
  v_taken numeric; v_to text := lower(nullif(trim(p_take_to), '')); v_open int; v_expected numeric;
  v_variance numeric; v_journal uuid; v_transfer uuid; v_take_journal uuid;
begin
  v_location := resolve_location(v_business, p_location);
  -- One count at a time here. Sales carry on meanwhile and wait for the next count.
  perform 1 from location where id = v_location for no key update;
  select count(*) into v_open from pos_tab
   where business_id = v_business and location_id = v_location and status = 'open';
  if v_open > 0 then
    raise exception '% bill(s) are still open. Take payment for them or cancel them before counting the drawer', v_open;
  end if;
  v_counted := money_round(v_business, p_counted);
  if v_counted is null or v_counted < 0 then raise exception 'Enter the cash you counted'; end if;
  v_left := money_round(v_business, coalesce(p_left_in_drawer, v_counted));
  if v_left < 0 or v_left > v_counted then
    raise exception 'What stays in the drawer must be between 0 and the % counted', trim_scale(v_counted);
  end if;
  v_taken := v_counted - v_left;
  if v_taken > 0 and v_to is distinct from 'safe' and v_to is distinct from 'bank' then
    raise exception 'Say where the rest of the cash goes: the safe or the bank';
  end if;
  d := drawer_position(v_business, v_location);
  if d.needs_start then
    if p_start_cash is null or p_start_cash < 0 then
      raise exception 'Enter the cash that was in the drawer when trading began after the last close';
    end if;
    v_start := money_round(v_business, p_start_cash);
  else
    v_start := d.carry;
  end if;

  insert into work_shift (business_id, location_id, opened_by, opened_at, opening_float, business_day, kind, covers_from)
  values (v_business, v_location, v_me,
          coalesce(d.last_count_at,
                   (select min(created_at) from cash_event
                     where business_id = v_business and location_id = v_location and work_shift_id is null),
                   now()),
          v_start, business_local_date(v_business, now()), 'drawer', d.last_count_at)
  returning id into v_shift;
  -- Every movement of cash here not yet counted is in this count; anything
  -- recorded after this moment waits for the next.
  with linked as (
    update cash_event set work_shift_id = v_shift
     where business_id = v_business and location_id = v_location and work_shift_id is null
    returning kind, amount)
  select coalesce(sum(amount), 0) as moved,
         coalesce(sum(amount) filter (where kind = 'sale'), 0) as sales,
         coalesce(-sum(amount) filter (where kind = 'refund'), 0) as refunds,
         coalesce(-sum(amount) filter (where kind = 'void'), 0) as voids,
         coalesce(-sum(amount) filter (where kind in ('paid_out', 'paid_out_reversed')), 0) as paid_out,
         coalesce(sum(amount) filter (where kind = 'cash_in'), 0) as cash_in,
         coalesce(-sum(amount) filter (where kind = 'cash_out'), 0) as cash_out
    into t from linked;
  v_expected := v_start + t.moved;
  v_variance := v_counted - v_expected;
  update work_shift
     set closed_at = now(), counted_cash = v_counted, expected_cash = v_expected, variance = v_variance,
         left_in_drawer = v_left, taken_out = v_taken, taken_to = case when v_taken > 0 then v_to end
   where id = v_shift;

  if v_variance <> 0 then
    v_journal := post_journal(v_business, now(), 'Cash over/short — drawer count', 'work_shift', v_shift,
      case when v_variance < 0
        then jsonb_build_array(jsonb_build_object('code', '6300', 'debit', -v_variance),
                               jsonb_build_object('code', '1000', 'credit', -v_variance))
        else jsonb_build_array(jsonb_build_object('code', '1000', 'debit', v_variance),
                               jsonb_build_object('code', '6300', 'credit', v_variance)) end);
  end if;
  -- The takings leave the till after the count; the next count starts from
  -- what stayed, so they are not a movement of the next session.
  if v_taken > 0 then
    v_transfer := gen_random_uuid();
    v_take_journal := post_journal(v_business, now(), 'Takings to the ' || v_to || ' after the drawer count',
      'cash_transfer', v_transfer,
      jsonb_build_array(jsonb_build_object('code', payment_account(v_to), 'debit', v_taken),
                        jsonb_build_object('code', '1000', 'credit', v_taken)));
    insert into cash_transfer (id, business_id, location_id, from_place, to_place, amount, note, work_shift_id,
                               journal_entry_id, created_by)
    values (v_transfer, v_business, v_location, 'till', v_to, v_taken, 'Takings after the drawer count', v_shift,
            v_take_journal, v_me);
  end if;
  perform audit_event(v_business, 'drawer.count', 'work_shift', v_shift::text, null, null,
    jsonb_build_object('start', v_start, 'expected', v_expected, 'counted', v_counted, 'variance', v_variance,
                       'left', v_left, 'taken', v_taken, 'taken_to', case when v_taken > 0 then v_to end));
  return jsonb_build_object('shift_id', v_shift, 'start', v_start, 'expected', v_expected, 'counted', v_counted,
    'variance', v_variance, 'left', v_left, 'taken', v_taken, 'taken_to', case when v_taken > 0 then v_to end,
    'cash_sales', t.sales, 'refunds', t.refunds, 'voids', t.voids, 'paid_out', t.paid_out,
    'cash_in', t.cash_in, 'cash_out', t.cash_out,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- Move cash between the till, the safe, the bank and the owner: a float put
-- in the drawer, takings taken to the safe during the day, a bank deposit,
-- money the owner puts in or takes out. Only the owner takes money out for
-- themselves.
create or replace function move_cash(p_from text, p_to text, p_amount numeric, p_note text default null,
                                     p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close', 'accounting.post');
  v_me uuid := (current_member()).id;
  v_from text := lower(trim(coalesce(p_from, ''))); v_to text := lower(trim(coalesce(p_to, '')));
  v_amount numeric; v_location uuid; v_id uuid := gen_random_uuid(); v_journal uuid; v_dr text; v_cr text;
begin
  if v_from not in ('till', 'safe', 'bank', 'owner') or v_to not in ('till', 'safe', 'bank', 'owner') or v_from = v_to then
    raise exception 'Move cash between two of: the till, the safe, the bank, the owner';
  end if;
  if v_to = 'owner' and not current_has_role('owner') then
    raise exception 'Only the owner takes money out for themselves' using errcode = '42501';
  end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if (v_from = 'owner' or v_to = 'owner') and nullif(trim(p_note), '') is null then
    raise exception 'Say what the money is for';
  end if;
  v_location := resolve_location(v_business, p_location);
  if v_from = 'till' then perform assert_drawer_can_pay(v_business, v_location, v_amount); end if;
  v_dr := case v_to when 'owner' then '3200' else payment_account(v_to) end;
  v_cr := payment_account(v_from);
  v_journal := post_journal(v_business, now(),
    'Cash from the ' || v_from || ' to the ' || v_to || coalesce(': ' || nullif(trim(p_note), ''), ''),
    'cash_transfer', v_id,
    jsonb_build_array(jsonb_build_object('code', v_dr, 'debit', v_amount),
                      jsonb_build_object('code', v_cr, 'credit', v_amount)));
  if v_from = 'safe' then perform assert_safe_can_pay(v_business, v_amount); end if;
  insert into cash_transfer (id, business_id, location_id, from_place, to_place, amount, note, journal_entry_id, created_by)
  values (v_id, v_business, v_location, v_from, v_to, v_amount, nullif(trim(p_note), ''), v_journal, v_me);
  if v_from = 'till' or v_to = 'till' then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (v_business, v_location, case when v_to = 'till' then 'cash_in' else 'cash_out' end,
            case when v_to = 'till' then v_amount else -v_amount end, 'cash_transfer', v_id, v_me);
  end if;
  perform audit_event(v_business, 'cash.move', 'cash_transfer', v_id::text, nullif(trim(p_note), ''), null,
                      jsonb_build_object('from', v_from, 'to', v_to, 'amount', v_amount));
  return jsonb_build_object('transfer_id', v_id, 'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- What the drawer should hold now, and what has moved since the last count.
create or replace function drawer_status(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('day.close', 'cost.view'); v_location uuid; d record; t record; s record;
begin
  v_location := resolve_location(v_business, p_location);
  d := drawer_position(v_business, v_location);
  select coalesce(sum(amount) filter (where kind = 'sale'), 0) as sales,
         coalesce(-sum(amount) filter (where kind = 'refund'), 0) as refunds,
         coalesce(-sum(amount) filter (where kind = 'void'), 0) as voids,
         coalesce(-sum(amount) filter (where kind in ('paid_out', 'paid_out_reversed')), 0) as paid_out,
         coalesce(sum(amount) filter (where kind = 'cash_in'), 0) as cash_in,
         coalesce(-sum(amount) filter (where kind = 'cash_out'), 0) as cash_out
    into t from cash_event
   where business_id = v_business and location_id = v_location and work_shift_id is null;
  select count(*) filter (where o.status <> 'voided') as orders,
         coalesce(sum(tn.amount) filter (where tn.tender_type = 'card' and o.status <> 'voided'), 0) as card,
         coalesce(sum(tn.amount) filter (where tn.tender_type = 'platform_paid' and o.status <> 'voided'), 0) as platform
    into s from sales_order o join sales_tender tn on tn.sales_order_id = o.id
   where o.business_id = v_business and o.location_id = v_location
     and (d.last_count_at is null or o.created_at > d.last_count_at);
  return jsonb_build_object(
    'location_id', v_location, 'since', d.last_count_at, 'start', d.carry, 'needs_start', d.needs_start,
    'cash_sales', t.sales, 'refunds', t.refunds, 'voids', t.voids, 'paid_out', t.paid_out,
    'cash_in', t.cash_in, 'cash_out', t.cash_out, 'moved', d.moved, 'events', d.events,
    'expected', case when d.needs_start then null else d.carry + d.moved end,
    'orders', s.orders, 'card', s.card, 'platform', s.platform,
    'open_bills', (select count(*) from pos_tab where business_id = v_business and location_id = v_location and status = 'open'),
    'safe', gl_balance_at(v_business, '1005', 'infinity'));
end $$;

-- Trading days whose cash has not been counted, per location: a day with
-- sales and no drawer count after its last sale (nor, before drawer counts, a
-- close of that day), and any movement of cash not yet taken in by a count.
create or replace function uncounted_days(p_business uuid) returns table (location_id uuid, day date)
language sql stable as $$
  with sold as (
    select o.location_id, business_local_date(p_business, o.placed_at) as d, max(o.created_at) as last_at
      from sales_order o
     where o.business_id = p_business and o.status <> 'voided'
     group by 1, 2
  )
  select s.location_id, s.d from sold s
   where not exists (select 1 from work_shift w
                      where w.business_id = p_business and w.location_id = s.location_id and w.closed_at is not null
                        and ((w.kind = 'day' and w.business_day = s.d)
                             or (w.kind = 'drawer' and w.closed_at >= s.last_at)))
  union
  select e.location_id, business_local_date(p_business, e.created_at)
    from cash_event e where e.business_id = p_business and e.work_shift_id is null
$$;

create or replace function report_unclosed_days()
returns table (day date)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('day.close', 'cost.view');
begin
  return query select distinct u.day from uncounted_days(v_business) u order by 1;
end $$;

-- The old per-day close. The page that called it is replaced by counting the
-- drawer; a page still open from before says so instead of posting.
create or replace function close_day(p_day date, p_counted_cash numeric, p_opening_float numeric default 0,
                                     p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('day.close');
begin
  raise exception 'The day close is now a drawer count. Refresh the page and count the drawer';
end $$;

-- =============================================================================
-- 5. Paying out: where the money came from
-- =============================================================================
create or replace function record_expense(
  p_description text, p_amount numeric, p_account_code text, p_paid_from text default 'cash', p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('expense.record');
  v_me uuid := (current_member()).id;
  v_amount numeric; v_date date; v_acct gl_account; v_exp uuid := gen_random_uuid(); v_journal uuid;
  v_from text := lower(coalesce(p_paid_from, '')); v_location uuid;
begin
  if v_from = 'cash' then v_from := 'till'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Describe the expense'; end if;
  select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
  if not found or v_acct.account_type <> 'expense' or p_account_code in ('5000', '5050', '5300', '5400') then
    raise exception 'Account % cannot take an expense (stock costs come from their own records)', p_account_code;
  end if;
  if v_from not in ('till', 'safe', 'bank', 'card', 'owner') then
    raise exception 'Say where the money came from: the till, the safe, the bank, a card or the owner';
  end if;
  v_date := coalesce(p_date, business_local_date(v_business, now()));
  v_location := resolve_location(v_business, null);

  v_journal := post_journal(v_business, (v_date + time '12:00') at time zone (select timezone from business where id = v_business),
    'Expense: ' || trim(p_description), 'expense', v_exp,
    jsonb_build_array(jsonb_build_object('code', p_account_code, 'debit', v_amount),
                      jsonb_build_object('code', payment_account(v_from), 'credit', v_amount)));
  insert into expense (id, business_id, location_id, amount, incurred_on, description, journal_entry_id, created_by)
  values (v_exp, v_business, v_location, v_amount, v_date, trim(p_description), v_journal, v_me);
  perform pay_out_of(v_business, v_location, v_from, v_amount, 'expense', v_exp, v_me);
  return jsonb_build_object('expense_id', v_exp, 'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- Pay a bill: Dr A/P, Cr where the money came from. The bill is locked for
-- the duration, and 0014 makes overpayment impossible even under a race.
create or replace function pay_bill(p_bill uuid, p_amount numeric, p_method text) returns jsonb
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
  if v_amount > b.amount_total - b.paid_amount then
    raise exception 'That is more than the % outstanding on this bill', b.amount_total - b.paid_amount;
  end if;
  v_location := resolve_location(v_business, null);
  v_journal := post_journal(v_business, now(), 'Payment — bill ' || coalesce(b.invoice_no, ''), 'supplier_payment', v_pay,
    jsonb_build_array(jsonb_build_object('code', '2000', 'debit', v_amount),
                      jsonb_build_object('code', payment_account(v_from), 'credit', v_amount)));
  insert into supplier_payment (id, business_id, supplier_id, purchase_invoice_id, amount, paid_on, method, journal_entry_id)
  values (v_pay, v_business, b.supplier_id, b.id, v_amount, business_local_date(v_business, now()), v_from, v_journal);
  perform pay_out_of(v_business, v_location, v_from, v_amount, 'supplier_payment', v_pay, v_me);
  return jsonb_build_object('payment_id', v_pay, 'journal_no', (select journal_no from journal_entry where id = v_journal),
    'outstanding', (select amount_total - paid_amount from purchase_invoice where id = p_bill));
end $$;

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
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- 0015's reversal by hand. Reversing an entry that moved the till's cash (an
-- expense paid out of the till, say) moves the drawer back with it.
create or replace function reverse_journal(p_entry uuid, p_reason text, p_date date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_rev uuid; e journal_entry; v_day date; v_till numeric; v_location uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the journal is being reversed'; end if;
  select * into e from journal_entry where id = p_entry and business_id = v_business;
  if not found then raise exception 'Journal not found'; end if;
  -- Dated when the correction belongs — the month being corrected — but never
  -- before the entry itself, nor in the future.
  v_day := coalesce(p_date, business_local_date(v_business, now()));
  if v_day > business_local_date(v_business, now()) then raise exception 'Choose a date that has happened'; end if;
  if v_day < business_local_date(v_business, e.occurred_at) then
    raise exception 'A reversal cannot be dated before the entry it reverses (%)', business_local_date(v_business, e.occurred_at);
  end if;
  -- A journal written by a record (a sale, a receipt, a bill, a payment, a
  -- stock movement, a count, a drawer count) is corrected through that record,
  -- so the record and the ledger never disagree. Entries from before the
  -- controls may be reversed: that is how their history is corrected.
  if not e.legacy and not journal_reversible_by_hand(e.reference_type) then
    raise exception 'Journal % was written by %; correct it there, not by reversing the journal',
      e.journal_no, journal_source_hint(e.reference_type);
  end if;
  v_rev := reverse_entry_internal(p_entry,
    (v_day + time '12:00') at time zone (select timezone from business where id = v_business),
    'Reversal: ' || trim(p_reason));
  select coalesce(sum(l.debit - l.credit), 0) into v_till
    from journal_line l join gl_account a on a.id = l.account_id
   where l.journal_entry_id = v_rev and a.code = '1000';
  if v_till <> 0 then
    select location_id into v_location from cash_event
     where reference_type = e.reference_type and reference_id = e.reference_id limit 1;
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (v_business, coalesce(v_location, resolve_location(v_business, null)),
            case when e.reference_type = 'expense' and v_till > 0 then 'paid_out_reversed'
                 when v_till > 0 then 'cash_in' else 'cash_out' end,
            v_till, 'journal_entry', v_rev, (current_member()).id);
  end if;
  perform audit_event(v_business, 'journal.reverse', 'journal_entry', p_entry::text, p_reason, null,
                      jsonb_build_object('reversal', v_rev));
  return jsonb_build_object('journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- =============================================================================
-- 6. A sale can be voided until the drawer holding it is counted
-- =============================================================================
create or replace function void_sale(p_order uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.void');
  v_me uuid := (current_member()).id;
  o sales_order; v_day date; v_journal uuid; v_rev uuid; m record;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason for the void'; end if;
  select * into o from sales_order where id = p_order and business_id = v_business for update;
  if not found then raise exception 'Sale not found'; end if;
  if o.status <> 'completed' then
    raise exception 'Only a completed sale can be voided; this one is %', o.status;
  end if;
  v_day := business_local_date(v_business, o.placed_at);
  if exists (select 1 from work_shift w where w.business_id = v_business and w.location_id = o.location_id
               and w.closed_at is not null
               and ((w.kind = 'day' and w.business_day = v_day) or (w.kind = 'drawer' and w.closed_at > o.created_at))) then
    raise exception 'The drawer has been counted since this sale; refund it instead of voiding it';
  end if;
  select id into v_journal from journal_entry
   where business_id = v_business and reference_type = 'sales_order' and reference_id = p_order
     and reverses_entry is null and status = 'published';
  if v_journal is null then
    raise exception 'This sale has no journal to reverse (it predates the controls); refund it instead';
  end if;

  v_rev := reverse_entry_internal(v_journal, now(), 'Void of sale ' || left(p_order::text, 8) || ': ' || p_reason);
  for m in select * from inventory_movement
            where reference_type = 'sales_order' and reference_id = p_order and type = 'sale_consumption' loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'reversal', -m.base_quantity_signed,
            m.unit_cost, m.value, 'sale_void', p_order, v_me, 'Void: ' || p_reason);
  end loop;
  insert into sale_adjustment (business_id, sales_order_id, kind, amount, reason, requested_by, approved_by)
  values (v_business, p_order, 'void', o.net_amount, p_reason, v_me, v_me);
  update sales_order set status = 'voided' where id = p_order;
  perform audit_event(v_business, 'sale.void', 'sales_order', p_order::text, p_reason,
    jsonb_build_object('status', o.status, 'net', o.net_amount), jsonb_build_object('status', 'voided'));
  return jsonb_build_object('order_id', p_order,
    'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- =============================================================================
-- 7. A period locks only when every trading day's cash is counted
-- =============================================================================
create or replace function period_close_checklist(p_period uuid)
returns table (check_key text, label text, ok boolean, detail text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.period.lock', 'accounting.post', 'audit.view');
  p accounting_period; tz text; v_end timestamptz; v numeric; g numeric; n int; v_days text;
begin
  select * into p from accounting_period where id = p_period and business_id = v_business;
  if not found then raise exception 'Period not found'; end if;
  select timezone into tz from business where id = v_business;
  v_end := ((p.ends_on + 1)::timestamp) at time zone tz;

  select count(*) into n from accounting_period
   where business_id = v_business and ends_on < p.starts_on and status = 'open';
  check_key := 'prior_periods'; label := 'Earlier periods are locked'; ok := n = 0;
  detail := case when n > 0 then n || ' earlier period(s) still open' end; return next;

  select count(*) into n from journal_entry where period_id = p_period and status = 'draft';
  check_key := 'drafts'; label := 'No draft journals'; ok := n = 0;
  detail := case when n > 0 then n || ' draft journal(s) must be published or discarded' end; return next;

  select string_agg(d::text, ', ' order by d) into v_days from (
    select distinct u.day d from uncounted_days(v_business) u where u.day between p.starts_on and p.ends_on
  ) x;
  check_key := 'days_closed'; label := 'Every trading day''s cash is counted'; ok := v_days is null;
  detail := case when v_days is not null then 'Not counted: ' || v_days end; return next;

  select count(*) into n from stock_count where business_id = v_business and status = 'submitted';
  check_key := 'counts'; label := 'No stock count awaiting approval'; ok := n = 0;
  detail := case when n > 0 then n || ' count(s) submitted and not yet approved or rejected' end; return next;

  select coalesce(sum(value * sign(base_quantity_signed)), 0) into v from inventory_movement
   where business_id = v_business and occurred_at < v_end;
  g := gl_balance_at(v_business, '1200', v_end);
  check_key := 'inventory'; label := 'Stock ledger agrees with Inventory (1200)'; ok := v = g;
  detail := case when v <> g then format('stock ledger %s, account 1200 %s, difference %s', v, g, v - g) end; return next;

  select coalesce(sum(b.amount_total), 0)
         - coalesce((select sum(sp.amount) from supplier_payment sp where sp.business_id = v_business
                      and sp.paid_on < p.ends_on + 1), 0)
    into v from purchase_invoice b where b.business_id = v_business and b.invoice_date <= p.ends_on
                                    and (b.cancelled_at is null or b.cancelled_at >= v_end);
  v := v + coalesce((select sum(receipt_legacy_payable(r.id, v_end)) from goods_receipt r
                      where r.business_id = v_business and r.received_at < v_end
                        and not exists (select 1 from purchase_invoice b where b.goods_receipt_id = r.id
                                          and b.invoice_date <= p.ends_on
                                          and (b.cancelled_at is null or b.cancelled_at >= v_end))), 0);
  g := -gl_balance_at(v_business, '2000', v_end);
  check_key := 'payables'; label := 'Unpaid bills agree with Accounts payable (2000)'; ok := v = g;
  detail := case when v <> g then format('unpaid bills %s, account 2000 %s, difference %s', v, g, v - g) end; return next;

  select coalesce(sum(receipt_grni_value(r.id)), 0) into v from goods_receipt r
   where r.business_id = v_business and r.received_at < v_end
     and not exists (select 1 from purchase_invoice b where b.goods_receipt_id = r.id and b.invoice_date <= p.ends_on
                        and (b.cancelled_at is null or b.cancelled_at >= v_end));
  g := -gl_balance_at(v_business, '2050', v_end);
  check_key := 'grni'; label := 'Unbilled receipts agree with GRNI (2050)'; ok := v = g;
  detail := case when v <> g then format('unbilled receipts %s, account 2050 %s, difference %s', v, g, v - g) end; return next;

  select coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0) into v
    from journal_line l join journal_entry e on e.id = l.journal_entry_id
   where e.period_id = p_period and e.status = 'published';
  check_key := 'trial_balance'; label := 'The period''s journals balance'; ok := v = 0;
  detail := case when v <> 0 then 'out by ' || v end; return next;
end $$;

-- =============================================================================
-- 8. Opening stock for an item that has none
-- =============================================================================
-- The stock already on the shelf when an item starts being tracked — at
-- go-live, after the test records are cleared, or for an item added without
-- it — at what it cost: Dr Inventory / Cr Owner equity, exactly as create_item
-- records opening stock. Only for an item with no stock history here: once
-- stock has moved, it is corrected by a count or a stock correction, never by
-- a second opening balance. Without it, an item with no stock history is
-- issued at a cost of zero (item_issue_cost), and every sale of it overstates
-- the margin.
create or replace function record_opening_stock(p_item uuid, p_qty numeric, p_unit_code text,
                                                p_unit_cost numeric, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  v_item item; v_location uuid; v_base numeric; v_value numeric; v_mv uuid; v_journal uuid;
begin
  select * into v_item from item where id = p_item and business_id = v_business;
  if not found then raise exception 'Unknown item'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Enter the quantity on the shelf'; end if;
  if p_unit_cost is null or p_unit_cost <= 0 then
    raise exception 'Enter what one % of % cost', coalesce(nullif(trim(p_unit_code), ''), v_item.base_unit_code), v_item.name;
  end if;
  v_base := to_base_qty(p_item, p_qty, nullif(trim(p_unit_code), ''));
  v_location := resolve_location(v_business, p_location);
  perform lock_items(array[p_item]);
  if exists (select 1 from inventory_movement
              where business_id = v_business and item_id = p_item and location_id = v_location) then
    raise exception '% already has stock recorded here. Correct it with a count or a stock correction', v_item.name;
  end if;
  v_value := money_round(v_business, p_qty * p_unit_cost);
  if v_value <= 0 then raise exception 'That stock is worth nothing at this cost: check the quantity and the cost'; end if;
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, app_user_id, reason)
  values (v_business, p_item, v_location, 'opening_balance', v_base, p_qty * p_unit_cost / v_base, v_value,
          'opening_balance', v_me, 'Opening balance')
  returning id into v_mv;
  v_journal := post_journal(v_business, now(), 'Opening stock: ' || v_item.name, 'inventory_movement', v_mv,
    jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_value),
                      jsonb_build_object('code', '3000', 'credit', v_value)));
  perform audit_event(v_business, 'inventory.opening', 'inventory_movement', v_mv::text, null, null,
                      jsonb_build_object('item', p_item, 'qty', v_base, 'value', v_value));
  return jsonb_build_object('movement_id', v_mv, 'qty', v_base, 'value', v_value,
                            'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- =============================================================================
-- 9. Who may read and call what (0016 closed everything by default)
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['cash_event', 'cash_transfer'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists cost_read on %I', t);
    execute format($p$create policy cost_read on %I for select to authenticated
                      using (business_id = (select current_business_id())
                             and (select current_has_permission('cost.view')))$p$, t);
    execute format('grant select on %I to authenticated', t);
  end loop;
end $$;

revoke execute on function
  drawer_position(uuid, uuid), assert_drawer_can_pay(uuid, uuid, numeric), assert_safe_can_pay(uuid, numeric),
  pay_out_of(uuid, uuid, text, numeric, text, uuid, uuid), uncounted_days(uuid), carry_cash_since_last_close(),
  trg_cash_from_tender(), trg_cash_from_adjustment(), trg_cash_event_guard(), trg_cash_transfer_guard()
  from public, anon, authenticated;

grant execute on function
  count_drawer(numeric, numeric, text, numeric, uuid),
  move_cash(text, text, numeric, text, uuid),
  drawer_status(uuid),
  cancel_stock_count(uuid, text),
  record_opening_stock(uuid, numeric, text, numeric, uuid)
to authenticated;
