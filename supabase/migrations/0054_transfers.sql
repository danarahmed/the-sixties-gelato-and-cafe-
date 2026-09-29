-- =============================================================================
-- 0054 — Stock sent between the café's places (release AB, first part)
--
-- The café has a branch and a central kitchen, and the stock of each is kept
-- apart; nothing moved it from one to the other (docs/COMPLETION_PLAN.md, B12
-- and release AB). Now a transfer does:
--   * sent: the stock leaves the place it is sent from at its cost there, by
--     the earliest use-by first, into 1210 Stock in transit;
--   * received: what arrived comes into the other place from 1210, each batch
--     it came from kept as that batch there, with its use-by; what did not
--     arrive is lost (5300);
--   * or cancelled while on its way: back where it came from, to the batches
--     it left;
--   * numbered, keyed, on the audit trail, and checked: what is on its way
--     against 1210 on "Do the books tie?".
-- A batch is now kept at each place it is at: the same batch, with the same
-- use-by, at the kitchen and at the branch.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. 1210 Stock in transit, and who may send stock
-- ---------------------------------------------------------------------------
-- Every café's chart gains 1210, closed to hand-written journals, bills and credits.
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
    ('1210','Stock in transit',           'asset',     'debit'),
    ('1300','Employee advances',          'asset',     'debit'),
    ('1500','Equipment',                  'asset',     'debit'),
    ('1590','Accumulated depreciation',   'asset',     'credit'),
    ('2000','Accounts payable',           'liability', 'credit'),
    ('2050','Goods received not invoiced','liability', 'credit'),
    ('2100','Salaries payable',           'liability', 'credit'),
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
    ('5310','Production and preparation loss', 'expense', 'debit'),
    ('5400','Inventory count variance',   'expense',   'debit'),
    ('6000','Rent',                       'expense',   'debit'),
    ('6100','Salaries',                   'expense',   'debit'),
    ('6110','Staff meals',                'expense',   'debit'),
    ('6200','Utilities',                  'expense',   'debit'),
    ('6300','Cash over / short',          'expense',   'debit'),
    ('6400','Depreciation',               'expense',   'debit'),
    ('6500','Card and bank fees',         'expense',   'debit'),
    ('6610','Complimentary items',        'expense',   'debit'),
    ('6620','Marketing samples',          'expense',   'debit'),
    ('6900','Other expenses',             'expense',   'debit'),
    ('6950','Exchange differences',       'expense',   'debit')
  ) as a(code, name, t, nb)
  on conflict (business_id, code) do update set is_system = true;
end $$;

select provision_chart_of_accounts(id) from business;

create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$
  select p_code in ('1000', '1001', '1005', '1006', '1200', '1210', '1300', '2000', '2050', '2100', '3100')
$$;


-- 1210 moves only with a transfer: no bill, credit, expense, reversal or
-- hand-written journal touches it.
create or replace function trg_transit_by_transfers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from gl_account a where a.id = new.account_id and a.code = '1210')
     and coalesce((select e.reference_type from journal_entry e where e.id = new.journal_entry_id), '')
         not in ('stock_transfer', 'stock_transfer_receipt', 'stock_transfer_cancel') then
    raise exception 'Stock in transit (1210) moves only with a transfer between places';
  end if;
  return new;
end $$;
drop trigger if exists journal_line_transit on journal_line;
create trigger journal_line_transit before insert on journal_line
  for each row execute function trg_transit_by_transfers();

-- stock.transfer: sending stock to another place, receiving it and cancelling
-- a transfer on its way. Whoever sees costs sees the transfers.
insert into role_permission (role, permission)
select r::app_role, p from (values
  ('owner','stock.transfer'),('general_manager','stock.transfer'),('branch_manager','stock.transfer'),
  ('purchasing','stock.transfer')
) as v(r, p)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. A batch at each place it is at
-- ---------------------------------------------------------------------------
-- The same batch, with the same code and use-by, is kept apart at each place:
-- what the kitchen made and sent is that batch at the branch too.
alter table item_lot drop constraint if exists item_lot_item_id_lot_code_key;
alter table item_lot add constraint item_lot_item_id_lot_code_key unique (item_id, lot_code, location_id);
drop index if exists item_lot_batch;
create unique index if not exists item_lot_batch on item_lot (production_batch_id, location_id)
  where production_batch_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Transfers
-- ---------------------------------------------------------------------------
create table if not exists stock_transfer (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business(id),
  transfer_no      bigint not null,
  from_location_id uuid not null references location(id),
  to_location_id   uuid not null references location(id),
  status           text not null default 'sent' check (status in ('sent', 'received', 'cancelled')),
  note             text check (note is null or length(note) <= 500),
  value_sent       numeric not null default 0,
  sent_by          uuid not null references app_user(id),
  sent_at          timestamptz not null default now(),
  value_received   numeric,
  value_short      numeric,
  receive_note     text check (receive_note is null or length(receive_note) <= 500),
  received_by      uuid references app_user(id),
  received_at      timestamptz,
  cancel_reason    text,
  cancelled_by     uuid references app_user(id),
  cancelled_at     timestamptz,
  unique (business_id, transfer_no),
  check (from_location_id <> to_location_id),
  check ((status = 'received') = (received_at is not null) and (received_at is null) = (received_by is null)),
  check ((status = 'cancelled') = (cancelled_at is not null) and (cancelled_at is null) = (cancelled_by is null)
         and (cancelled_at is null) = (cancel_reason is null))
);
create index if not exists stock_transfer_recent on stock_transfer (business_id, sent_at desc);

create table if not exists stock_transfer_line (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references business(id),
  transfer_id     uuid not null references stock_transfer(id),
  item_id         uuid not null references item(id),
  qty             numeric not null check (qty > 0),
  unit_code       text not null,
  base_qty        numeric not null check (base_qty > 0),
  value           numeric not null,
  out_movement_id uuid not null references inventory_movement(id),
  base_received   numeric check (base_received is null or base_received between 0 and base_qty),
  value_received  numeric,
  unique (transfer_id, item_id)
);
create index if not exists stock_transfer_line_transfer on stock_transfer_line (transfer_id);

alter table stock_transfer enable row level security;
alter table stock_transfer force row level security;
alter table stock_transfer_line enable row level security;
alter table stock_transfer_line force row level security;
drop policy if exists stock_transfer_read on stock_transfer;
create policy stock_transfer_read on stock_transfer for select to authenticated
  using (business_id = (select current_business_id())
         and ((select current_has_permission('cost.view')) or (select current_has_permission('stock.transfer'))));
drop policy if exists stock_transfer_line_read on stock_transfer_line;
create policy stock_transfer_line_read on stock_transfer_line for select to authenticated
  using (business_id = (select current_business_id())
         and ((select current_has_permission('cost.view')) or (select current_has_permission('stock.transfer'))));
revoke all on stock_transfer, stock_transfer_line from anon, authenticated;
grant select on stock_transfer, stock_transfer_line to authenticated;

-- What was sent stays as it was sent: a transfer is received or cancelled once,
-- and never deleted.
create or replace function trg_stock_transfer_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'A transfer is not deleted: cancel it while it is on its way'; end if;
  if old.status <> 'sent' then raise exception 'Transfer % is settled: it does not change', old.transfer_no; end if;
  if (new.business_id, new.transfer_no, new.from_location_id, new.to_location_id, new.note, new.value_sent,
      new.sent_by, new.sent_at)
     is distinct from (old.business_id, old.transfer_no, old.from_location_id, old.to_location_id, old.note,
                       old.value_sent, old.sent_by, old.sent_at) then
    raise exception 'What was sent does not change: cancel the transfer and send it again';
  end if;
  return new;
end $$;
drop trigger if exists stock_transfer_guard on stock_transfer;
create trigger stock_transfer_guard before update or delete on stock_transfer
  for each row execute function trg_stock_transfer_guard();

create or replace function trg_stock_transfer_line_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'A transfer is not deleted: cancel it while it is on its way'; end if;
  if old.base_received is not null then raise exception 'What arrived does not change'; end if;
  if (new.transfer_id, new.item_id, new.qty, new.unit_code, new.base_qty, new.value, new.out_movement_id)
     is distinct from (old.transfer_id, old.item_id, old.qty, old.unit_code, old.base_qty, old.value,
                       old.out_movement_id) then
    raise exception 'What was sent does not change: cancel the transfer and send it again';
  end if;
  return new;
end $$;
drop trigger if exists stock_transfer_line_guard on stock_transfer_line;
create trigger stock_transfer_line_guard before update or delete on stock_transfer_line
  for each row execute function trg_stock_transfer_line_guard();

-- ---------------------------------------------------------------------------
-- 4. Sending, receiving and cancelling
-- ---------------------------------------------------------------------------
-- (stock.transfer) Stock sent from a place (the café's first branch when none
-- is named) to another: each item at its cost where it leaves, the last of it
-- with the rest of its value, out by the earliest use-by first, into 1210.
-- Below zero as each item's rule says. p_lines: [{item_id, qty, unit_code}].
create or replace function send_stock_transfer__run(p_from uuid, p_to uuid, p_lines jsonb, p_note text,
                                                    p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('stock.transfer');
  v_me uuid := (current_member()).id;
  v_from uuid; v_to uuid; v_from_name text; v_to_name text; v_note text := nullif(trim(p_note), '');
  l jsonb; x jsonb; it item; p record; v_qty numeric; v_unit text; v_base numeric; v_value numeric;
  v_items uuid[] := '{}'; v_plan jsonb := '[]'; v_lines jsonb := '[]'; v_below jsonb := '[]';
  v_total numeric := 0; v_id uuid := gen_random_uuid(); v_no bigint; v_mv uuid;
begin
  v_from := resolve_location(v_business, p_from);
  if p_to is not null then
    select id, name into v_to, v_to_name from location where id = p_to and business_id = v_business and is_active;
  end if;
  if v_to is null then raise exception 'Choose where the stock goes'; end if;
  if v_to = v_from then raise exception 'The stock goes to another place'; end if;
  select name into v_from_name from location where id = v_from;
  if length(coalesce(v_note, '')) > 500 then raise exception 'A note is at most 500 letters'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line';
  end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    select * into it from item where id = (l ->> 'item_id')::uuid and business_id = v_business;
    if not found then raise exception 'Unknown item on the transfer'; end if;
    if exists (select 1 from jsonb_array_elements(v_plan) y where (y ->> 'item_id')::uuid = it.id) then
      raise exception '% is on the transfer twice: one line for it', it.name;
    end if;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Every line needs a quantity'; end if;
    v_unit := coalesce(nullif(l ->> 'unit_code', ''), it.base_unit_code);
    v_base := to_base_qty(it.id, v_qty, v_unit);
    v_items := v_items || it.id;
    v_plan := v_plan || jsonb_build_object('item_id', it.id, 'name', it.name, 'unit', it.base_unit_code,
                                           'qty', v_qty, 'unit_code', v_unit, 'base_qty', v_base);
  end loop;
  perform lock_items(v_items);

  for x in select * from jsonb_array_elements(v_plan) loop
    v_base := (x ->> 'base_qty')::numeric;
    p := item_position(v_business, (x ->> 'item_id')::uuid, v_from);
    -- At its cost where it leaves; the last of it with the rest of its value.
    v_value := case when p.qty > 0 and v_base = p.qty then greatest(p.value, 0)
                    else money_round(v_business, v_base * item_issue_cost(v_business, (x ->> 'item_id')::uuid, v_from))
               end;
    if p.qty - v_base < 0 then
      v_below := v_below || jsonb_build_object('item_id', x ->> 'item_id', 'name', x ->> 'name',
                                               'on_hand_after', p.qty - v_base, 'unit', x ->> 'unit');
    end if;
    v_lines := v_lines || (x || jsonb_build_object('value', v_value));
    v_total := v_total + v_value;
  end loop;

  -- An item whose rule refuses stock below zero is not taken below it (0040).
  if exists (select 1 from jsonb_array_elements(v_below) e
              where rule_value(v_business, 'negative_stock', (e ->> 'item_id')::uuid) #>> '{}' = 'block') then
    raise exception 'This leaves % below zero, which its rule refuses: count it, or send less',
      (select string_agg(format('%s (%s %s)', e ->> 'name', trim_scale((e ->> 'on_hand_after')::numeric), e ->> 'unit'), ', ')
         from jsonb_array_elements(v_below) e
        where rule_value(v_business, 'negative_stock', (e ->> 'item_id')::uuid) #>> '{}' = 'block');
  end if;
  if jsonb_array_length(v_below) > 0 and not coalesce(p_confirm, false) then
    raise exception 'This leaves % below zero: confirm to send it all the same',
      (select string_agg(format('%s (%s %s)', e ->> 'name', trim_scale((e ->> 'on_hand_after')::numeric), e ->> 'unit'), ', ')
         from jsonb_array_elements(v_below) e);
  end if;

  v_no := next_document_no(v_business, 'transfer', 1);
  insert into stock_transfer (id, business_id, transfer_no, from_location_id, to_location_id, note, value_sent, sent_by)
  values (v_id, v_business, v_no, v_from, v_to, v_note, v_total, v_me);
  if v_total <> 0 then
    perform post_journal(v_business, now(), 'Transfer ' || v_no || ' sent from ' || v_from_name || ' to ' || v_to_name,
      'stock_transfer', v_id, jsonb_build_array(signed_line('1210', v_total), signed_line('1200', -v_total)));
  end if;
  for x in select * from jsonb_array_elements(v_lines) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, (x ->> 'item_id')::uuid, v_from, 'transfer_out', -(x ->> 'base_qty')::numeric,
            (x ->> 'value')::numeric / (x ->> 'base_qty')::numeric, (x ->> 'value')::numeric,
            'stock_transfer', v_id, v_me, 'Transfer ' || v_no || ' to ' || v_to_name)
    returning id into v_mv;
    insert into stock_transfer_line (business_id, transfer_id, item_id, qty, unit_code, base_qty, value, out_movement_id)
    values (v_business, v_id, (x ->> 'item_id')::uuid, (x ->> 'qty')::numeric, x ->> 'unit_code',
            (x ->> 'base_qty')::numeric, (x ->> 'value')::numeric, v_mv);
  end loop;
  return jsonb_build_object('transfer_id', v_id, 'transfer_no', v_no, 'from', v_from_name, 'to', v_to_name,
                            'value', v_total, 'lines', jsonb_array_length(v_lines));
end $$;

create or replace function send_stock_transfer(p_from uuid, p_to uuid, p_lines jsonb, p_note text default null,
                                               p_confirm boolean default false, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_from', p_from, 'p_to', p_to, 'p_lines', p_lines, 'p_note', p_note,
                                    'p_confirm', p_confirm);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'send_stock_transfer', v_req);
  if v is not null then return v; end if;
  v := send_stock_transfer__run(p_from => p_from, p_to => p_to, p_lines => p_lines, p_note => p_note,
                                p_confirm => p_confirm);
  perform audit_event(v_business, 'stock.transfer_send', 'stock_transfer', v ->> 'transfer_id', null, null,
                      jsonb_build_object('transfer_no', (v ->> 'transfer_no')::bigint, 'from', v ->> 'from',
                                         'to', v ->> 'to', 'value', (v ->> 'value')::numeric));
  perform idem_finish(v_business, p_idempotency_key, 'send_stock_transfer', v_req, v);
  return v;
end $$;

-- (stock.transfer) A transfer received: what arrived of each line (all of it
-- when none is said), into the place it was sent to at what it left at, each
-- batch it left as that batch there, stock with no batch first, then the
-- earliest use-by; what did not arrive is lost (5300).
-- p_lines: [{line_id, qty}], each quantity in the unit the line was sent in.
create or replace function receive_stock_transfer__run(p_transfer uuid, p_lines jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('stock.transfer');
  v_me uuid := (current_member()).id;
  t stock_transfer; ln stock_transfer_line; it item; l jsonb; a record; src item_lot;
  v_note text := nullif(trim(p_note), ''); v_to_name text; v_from_name text; v_given jsonb := '{}';
  v_qty numeric; v_base numeric; v_value numeric; v_left numeric; v_left_value numeric; v_take numeric;
  v_chunk numeric; v_lot uuid; v_in numeric := 0; v_short numeric := 0;
begin
  select * into t from stock_transfer where id = p_transfer and business_id = v_business for update;
  if not found then raise exception 'Transfer not found'; end if;
  if t.status = 'received' then raise exception 'Transfer % was received already', t.transfer_no; end if;
  if t.status = 'cancelled' then raise exception 'Transfer % was cancelled', t.transfer_no; end if;
  if length(coalesce(v_note, '')) > 500 then raise exception 'A note is at most 500 letters'; end if;
  perform resolve_location(v_business, t.to_location_id);
  select name into v_to_name from location where id = t.to_location_id;
  select name into v_from_name from location where id = t.from_location_id;
  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    for l in select * from jsonb_array_elements(p_lines) loop
      if not exists (select 1 from stock_transfer_line
                      where id = (l ->> 'line_id')::uuid and transfer_id = t.id) then
        raise exception 'That line is not on this transfer';
      end if;
      v_given := v_given || jsonb_build_object(l ->> 'line_id', l -> 'qty');
    end loop;
  end if;
  perform lock_items(array(select item_id from stock_transfer_line where transfer_id = t.id));

  for ln in select * from stock_transfer_line where transfer_id = t.id order by id loop
    select * into it from item where id = ln.item_id;
    v_qty := case when v_given ? ln.id::text then (v_given ->> ln.id::text)::numeric else ln.qty end;
    if v_qty is null or v_qty < 0 then raise exception 'What arrived of % cannot be less than nothing', it.name; end if;
    if v_qty > ln.qty then
      raise exception 'More of % cannot arrive than was sent (% %)', it.name, trim_scale(ln.qty), ln.unit_code;
    end if;
    v_base := case when v_qty = ln.qty then ln.base_qty else least(to_base_qty(it.id, v_qty, ln.unit_code), ln.base_qty) end;
    v_value := case when v_base = ln.base_qty then ln.value
                    else money_round(v_business, ln.value * v_base / ln.base_qty) end;
    v_left := v_base; v_left_value := v_value;
    for a in
      select lm.lot_id, -sum(lm.base_qty) as qty
        from lot_movement lm left join item_lot lot on lot.id = lm.lot_id
       where lm.movement_id = ln.out_movement_id
       group by lm.lot_id, lot.use_by, lot.created_at
      having -sum(lm.base_qty) > 0
       order by (lm.lot_id is not null), lot.use_by nulls last, lot.created_at, lm.lot_id
    loop
      exit when v_left <= 0;
      v_take := least(v_left, a.qty);
      v_chunk := case when v_take = v_left then v_left_value else money_round(v_business, v_value * v_take / v_base) end;
      v_lot := null;
      if a.lot_id is not null then
        select * into src from item_lot where id = a.lot_id;
        select id into v_lot from item_lot
         where item_id = src.item_id and lot_code = src.lot_code and location_id = t.to_location_id;
        if v_lot is null then
          insert into item_lot (business_id, item_id, lot_code, expiry_date, received_at, use_by, production_batch_id,
                                location_id)
          values (src.business_id, src.item_id, src.lot_code, src.expiry_date, src.received_at, src.use_by,
                  src.production_batch_id, t.to_location_id)
          returning id into v_lot;
        end if;
      end if;
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                      reference_type, reference_id, app_user_id, reason, lot_id)
      values (v_business, ln.item_id, t.to_location_id, 'transfer_in', v_take, v_chunk / v_take, v_chunk,
              'stock_transfer', t.id, v_me, 'Transfer ' || t.transfer_no || ' from ' || v_from_name, v_lot);
      v_left := v_left - v_take; v_left_value := v_left_value - v_chunk;
    end loop;
    -- An item kept without batches, or sent below zero: stock with no batch.
    if v_left > 0 then
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                      reference_type, reference_id, app_user_id, reason)
      values (v_business, ln.item_id, t.to_location_id, 'transfer_in', v_left, v_left_value / v_left, v_left_value,
              'stock_transfer', t.id, v_me, 'Transfer ' || t.transfer_no || ' from ' || v_from_name);
    end if;
    update stock_transfer_line set base_received = v_base, value_received = v_value where id = ln.id;
    v_in := v_in + v_value;
    v_short := v_short + (ln.value - v_value);
  end loop;

  if t.value_sent <> 0 then
    perform post_journal(v_business, now(),
      'Transfer ' || t.transfer_no || ' received at ' || v_to_name || ' from ' || v_from_name,
      'stock_transfer_receipt', t.id,
      jsonb_build_array(signed_line('1200', v_in), signed_line('5300', v_short), signed_line('1210', -t.value_sent)));
  end if;
  update stock_transfer set status = 'received', received_by = v_me, received_at = now(), value_received = v_in,
                            value_short = v_short, receive_note = v_note
   where id = t.id;
  return jsonb_build_object('transfer_id', t.id, 'transfer_no', t.transfer_no, 'from', v_from_name, 'to', v_to_name,
                            'value', t.value_sent, 'received', v_in, 'short', v_short);
end $$;

create or replace function receive_stock_transfer(p_transfer uuid, p_lines jsonb default null, p_note text default null,
                                                  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_transfer', p_transfer, 'p_lines', p_lines, 'p_note', p_note);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'receive_stock_transfer', v_req);
  if v is not null then return v; end if;
  v := receive_stock_transfer__run(p_transfer => p_transfer, p_lines => p_lines, p_note => p_note);
  perform audit_event(v_business, 'stock.transfer_receive', 'stock_transfer', v ->> 'transfer_id',
                      nullif(trim(p_note), ''),
                      jsonb_build_object('transfer_no', (v ->> 'transfer_no')::bigint, 'value', (v ->> 'value')::numeric),
                      jsonb_build_object('transfer_no', (v ->> 'transfer_no')::bigint,
                                         'value', (v ->> 'received')::numeric, 'lost', (v ->> 'short')::numeric));
  perform idem_finish(v_business, p_idempotency_key, 'receive_stock_transfer', v_req, v);
  return v;
end $$;

-- (stock.transfer) A transfer cancelled while on its way, with why: back to
-- the place it was sent from, to the batches it left, at what it left at.
create or replace function cancel_stock_transfer__run(p_transfer uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('stock.transfer');
  v_me uuid := (current_member()).id;
  t stock_transfer; ln stock_transfer_line; v_reason text := nullif(trim(p_reason), ''); v_from_name text;
begin
  select * into t from stock_transfer where id = p_transfer and business_id = v_business for update;
  if not found then raise exception 'Transfer not found'; end if;
  if v_reason is null then raise exception 'Say why the transfer is cancelled'; end if;
  if t.status = 'received' then raise exception 'Transfer % was received: it is not cancelled', t.transfer_no; end if;
  if t.status = 'cancelled' then raise exception 'Transfer % was cancelled already', t.transfer_no; end if;
  select name into v_from_name from location where id = t.from_location_id;
  perform lock_items(array(select item_id from stock_transfer_line where transfer_id = t.id));
  for ln in select * from stock_transfer_line where transfer_id = t.id order by id loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, ln.item_id, t.from_location_id, 'reversal', ln.base_qty, ln.value / ln.base_qty, ln.value,
            'stock_transfer_cancel', t.id, v_me, 'Transfer ' || t.transfer_no || ' cancelled: ' || v_reason);
  end loop;
  if t.value_sent <> 0 then
    perform post_journal(v_business, now(), 'Transfer ' || t.transfer_no || ' cancelled, back to ' || v_from_name,
      'stock_transfer_cancel', t.id,
      jsonb_build_array(signed_line('1200', t.value_sent), signed_line('1210', -t.value_sent)));
  end if;
  update stock_transfer set status = 'cancelled', cancelled_by = v_me, cancelled_at = now(), cancel_reason = v_reason
   where id = t.id;
  return jsonb_build_object('transfer_id', t.id, 'transfer_no', t.transfer_no, 'value', t.value_sent,
                            'from', v_from_name);
end $$;

create or replace function cancel_stock_transfer(p_transfer uuid, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_transfer', p_transfer, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_stock_transfer', v_req);
  if v is not null then return v; end if;
  v := cancel_stock_transfer__run(p_transfer => p_transfer, p_reason => p_reason);
  perform audit_event(v_business, 'stock.transfer_cancel', 'stock_transfer', v ->> 'transfer_id',
                      nullif(trim(p_reason), ''),
                      jsonb_build_object('transfer_no', (v ->> 'transfer_no')::bigint, 'value', (v ->> 'value')::numeric),
                      null);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_stock_transfer', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 5. The transfers, and the places they go between
-- ---------------------------------------------------------------------------
-- (cost.view or stock.transfer) The transfers, the latest first: from where to
-- where, what, at what, and where each stands.
create or replace function stock_transfers(p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view', 'stock.transfer');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', t.id, 'no', t.transfer_no, 'status', t.status,
             'from_id', t.from_location_id, 'from', lf.name, 'to_id', t.to_location_id, 'to', lt.name,
             'note', t.note, 'value', t.value_sent, 'value_received', t.value_received, 'value_short', t.value_short,
             'sent_at', t.sent_at, 'sent_by', (select u.full_name from app_user u where u.id = t.sent_by),
             'received_at', t.received_at, 'received_by', (select u.full_name from app_user u where u.id = t.received_by),
             'receive_note', t.receive_note, 'cancelled_at', t.cancelled_at,
             'cancelled_by', (select u.full_name from app_user u where u.id = t.cancelled_by),
             'cancel_reason', t.cancel_reason,
             'lines', (select jsonb_agg(jsonb_build_object(
                                'id', l.id, 'item_id', l.item_id, 'item', i.name, 'qty', trim_scale(l.qty),
                                'unit_code', l.unit_code, 'base_qty', trim_scale(l.base_qty), 'base_unit', i.base_unit_code,
                                'value', l.value,
                                'qty_received', case when l.base_received is not null
                                                     then trim_scale(round(l.base_received * l.qty / l.base_qty, 6)) end,
                                'value_received', l.value_received)
                              order by i.name, l.id)
                         from stock_transfer_line l join item i on i.id = l.item_id where l.transfer_id = t.id))
           order by t.sent_at desc, t.transfer_no desc)
      from (select * from stock_transfer where business_id = v_business
             order by sent_at desc, transfer_no desc limit greatest(1, least(coalesce(p_limit, 50), 500))) t
      join location lf on lf.id = t.from_location_id
      join location lt on lt.id = t.to_location_id), '[]'::jsonb);
end $$;

-- (cost.view or stock.transfer) The café's places stock is kept at, those in
-- use, for choosing where stock goes: the branches first.
create or replace function stock_places() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view', 'stock.transfer');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'kind', l.kind,
                                        'default', l.id = default_location(v_business))
                     order by (l.kind <> 'branch'), l.created_at, l.id)
      from location l where l.business_id = v_business and l.is_active), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- 6. The stock card, the batches, and the books' checks
-- ---------------------------------------------------------------------------
create or replace function lot_sources(m inventory_movement) returns uuid[]
language sql stable set search_path = public as $$
  select case
    when m.type = 'refund_return_to_stock' and m.sales_order_line_id is not null then
      (select array_agg(o.id) from inventory_movement o
        where o.sales_order_line_id = m.sales_order_line_id and o.item_id = m.item_id
          and o.location_id = m.location_id and o.id <> m.id
          and o.type in ('sale_consumption', 'refund_return_to_stock'))
    when m.type = 'reversal' and m.reference_type = 'sale_void' then
      (select array_agg(o.id) from inventory_movement o
        where o.reference_id = m.reference_id and o.item_id = m.item_id and o.location_id = m.location_id
          and o.id <> m.id
          and ((o.type = 'sale_consumption' and o.reference_type = 'sales_order')
               or (o.type = 'reversal' and o.reference_type = 'sale_void')))
    when m.type = 'reversal' and m.reference_type = 'production_cancel' then
      (select array_agg(o.id) from inventory_movement o
        where o.reference_id = m.reference_id and o.item_id = m.item_id and o.location_id = m.location_id
          and o.id <> m.id
          and ((o.reference_type = 'production_batch'
                and o.type = case when m.base_quantity_signed > 0 then 'production_consumption'
                                  else 'production_output' end::movement_type)
               or (o.reference_type = 'production_cancel' and o.type = 'reversal'
                   and sign(o.base_quantity_signed) = sign(m.base_quantity_signed))))
    when m.type = 'reversal' and m.reference_type = 'loss_review' then
      (select array[o.id] from inventory_movement o
        where o.id = nullif(current_setting('lots.loss_reversed', true), '')::uuid
          and o.item_id = m.item_id and o.location_id = m.location_id)
    -- A transfer cancelled while on its way (0054): back to the batches it left.
    when m.type = 'reversal' and m.reference_type = 'stock_transfer_cancel' then
      (select array_agg(o.id) from inventory_movement o
        where o.reference_type = 'stock_transfer' and o.reference_id = m.reference_id and o.item_id = m.item_id
          and o.location_id = m.location_id and o.type = 'transfer_out')
  end
$$;


create or replace function stock_card_kind(p_type movement_type, p_reference text, p_qty numeric) returns text
language sql immutable set search_path = public as $$
  select case
    when p_type = 'opening_balance' then 'opening_stock'
    when p_type in ('purchase_receipt', 'supplier_return') then 'received'
    when p_type::text = 'receipt_correction' then 'received'
    when p_type::text = 'cost_adjustment' then 'revalued'
    when p_type in ('sale_consumption', 'refund_return_to_stock') then 'sold'
    when p_type = 'reversal' and p_reference in ('sale_void', 'sales_order') then 'sold'
    when p_type = 'production_consumption' then 'batches'
    when p_type = 'reversal' and p_reference = 'production_cancel' and p_qty > 0 then 'batches'
    when p_type = 'production_output' then 'made'
    when p_type = 'reversal' and p_reference = 'production_cancel' then 'made'
    when is_loss(p_type) then 'wasted'
    when p_type = 'reversal' and p_reference = 'loss_review' then 'wasted'
    when p_type = 'count_adjustment' then 'counted'
    when p_type in ('transfer_in', 'transfer_out') then 'transferred'
    when p_type = 'reversal' and p_reference = 'stock_transfer_cancel' then 'transferred'
    else 'corrected'
  end
$$;


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
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;


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
  select 'loss', s.id, s.created_at, 'A loss with no journal'
    from stock_loss s
   where s.business_id = p_business and s.created_at >= v_start and s.created_at < p_before and s.value > 0
     and not exists (select 1 from has h where h.reference_type = 'stock_loss' and h.reference_id = s.id)
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
  select 'return', x.id, x.created_at, 'A return to a supplier with no journal'
    from supplier_return x
   where x.business_id = p_business and x.created_at >= v_start and x.created_at < p_before
     and (x.value <> 0 or x.stock_value <> 0)
     and not exists (select 1 from has h where h.reference_type = 'supplier_return' and h.reference_id = x.id)
  union all
  select 'credit', c.id, c.created_at, 'A supplier''s credit with no journal'
    from supplier_credit c
   where c.business_id = p_business and c.kind <> 'goods_return' and c.created_at >= v_start and c.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'supplier_credit' and h.reference_id = c.id)
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
  select 'payroll', a.run_id, a.approved_at, 'An approved payroll with no journal'
    from payroll_approval a
   where a.business_id = p_business and a.approved_at < p_before and a.reopened_at is null and a.gross > 0
     and not exists (select 1 from has h where h.reference_type = 'payroll_approval' and h.reference_id = a.id)
  union all
  select 'advance', v.id, v.created_at, 'An advance with no journal'
    from employee_advance v
   where v.business_id = p_business and v.created_at < p_before and v.cancelled_at is null
     and not exists (select 1 from has h where h.reference_type = 'employee_advance' and h.reference_id = v.id)
  union all
  select 'transfer', t.id, t.sent_at, 'Stock sent to another place with no journal'
    from stock_transfer t
   where t.business_id = p_business and t.sent_at < p_before and t.value_sent <> 0
     and not exists (select 1 from has h where h.reference_type = 'stock_transfer' and h.reference_id = t.id)
  union all
  select 'transfer', t.id, t.received_at, 'Stock received from another place with no journal'
    from stock_transfer t
   where t.business_id = p_business and t.status = 'received' and t.received_at < p_before and t.value_sent <> 0
     and not exists (select 1 from has h where h.reference_type = 'stock_transfer_receipt' and h.reference_id = t.id)
  union all
  select 'transfer', t.id, t.cancelled_at, 'A transfer cancelled on its way with no journal'
    from stock_transfer t
   where t.business_id = p_business and t.status = 'cancelled' and t.cancelled_at < p_before and t.value_sent <> 0
     and not exists (select 1 from has h where h.reference_type = 'stock_transfer_cancel' and h.reference_id = t.id)
  union all
  select 'salary', s.id, s.created_at, 'A salary payment with no journal'
    from salary_payment s
   where s.business_id = p_business and s.created_at < p_before and s.cancelled_at is null
     and not exists (select 1 from has h where h.reference_type = 'salary_payment' and h.reference_id = s.id)
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
           when 'supplier_return' then 'return to a supplier' when 'supplier_credit' then 'supplier''s credit'
           when 'platform_settlement' then 'platform statement' when 'stock_loss' then 'loss'
           when 'payroll_approval' then 'payroll''s approval' when 'employee_advance' then 'advance'
           when 'salary_payment' then 'salary payment'
           when 'stock_transfer' then 'transfer' when 'stock_transfer_receipt' then 'transfer'
           when 'stock_transfer_cancel' then 'transfer'
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
           when 'supplier_return' then not exists (select 1 from supplier_return x where x.id = j.reference_id)
           when 'supplier_credit' then not exists (select 1 from supplier_credit x where x.id = j.reference_id)
           when 'card_settlement' then not exists (select 1 from card_settlement x where x.id = j.reference_id)
           when 'platform_settlement' then not exists (select 1 from platform_settlement x where x.id = j.reference_id)
           when 'stock_loss' then not exists (select 1 from stock_loss x where x.id = j.reference_id)
           when 'payroll_approval' then not exists (select 1 from payroll_approval x where x.id = j.reference_id)
           when 'employee_advance' then not exists (select 1 from employee_advance x where x.id = j.reference_id)
           when 'salary_payment' then not exists (select 1 from salary_payment x where x.id = j.reference_id)
           when 'stock_transfer' then not exists (select 1 from stock_transfer x where x.id = j.reference_id)
           when 'stock_transfer_receipt' then not exists (select 1 from stock_transfer x where x.id = j.reference_id
                                                            and x.status = 'received')
           when 'stock_transfer_cancel' then not exists (select 1 from stock_transfer x where x.id = j.reference_id
                                                           and x.status = 'cancelled')
           else false end;
end $$;


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
  -- Less what the suppliers owe back (0044): their credits, set against bills or not.
  subledger := subledger - coalesce((select sum(amount) from supplier_credit
                                      where business_id = p_business and credit_date < p_as_of + 1), 0);
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
  -- dinars from dollars exchanged into it (0043), and advances and salaries
  -- paid from it (0049), against the Safe (1005).
  check_key := 'safe'; label := 'Cash moved in and out of the safe vs Safe (1005)';
  select coalesce(sum(case when t.to_place = 'safe' then t.amount else -t.amount end), 0) into subledger
    from cash_transfer t join journal_entry j on j.id = t.journal_entry_id
   where t.business_id = p_business and 'safe' in (t.from_place, t.to_place) and j.occurred_at < v_end;
  subledger := subledger + coalesce((
    select sum(jl.debit - jl.credit)
      from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
     where e.business_id = p_business and e.status = 'published' and g.code = '1005' and e.occurred_at < v_end
       and (e.reference_type in ('expense', 'supplier_payment', 'fx_exchange', 'employee_advance', 'salary_payment')
            or (e.reference_type = 'reversal'
                and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                              and o.reference_type in ('expense', 'supplier_payment', 'employee_advance',
                                                       'salary_payment'))))), 0);
  ledger := gl_balance_at(p_business, '1005', v_end);
  difference := subledger - ledger; return next;

  -- The dollars (0043): what the till and the safe hold, at what they were
  -- taken at, against Cash in dollars (1001 and 1006).
  check_key := 'dollars'; label := 'Dollars held, at what they were taken at, vs Cash in dollars (1001 and 1006)';
  select coalesce(sum(value), 0) into subledger
    from fx_cash_event where business_id = p_business and created_at < v_end;
  ledger := gl_balance_at(p_business, '1001', v_end) + gl_balance_at(p_business, '1006', v_end);
  difference := subledger - ledger; return next;

  -- The salaries owed (0049): what each approval of a payroll left to be paid,
  -- from when its journal is dated until it is reversed, less the salaries
  -- paid, against Salaries payable (2100).
  check_key := 'payroll'; label := 'Salaries owed vs Salaries payable (2100)';
  select coalesce(sum(a.net), 0) into subledger
    from payroll_approval a join journal_entry j on j.id = a.journal_entry_id
   where a.business_id = p_business and j.occurred_at < v_end
     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end);
  subledger := subledger - coalesce((
    select sum(p.amount) from salary_payment p join journal_entry j on j.id = p.journal_entry_id
     where p.business_id = p_business and j.occurred_at < v_end
       and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end)), 0);
  ledger := -gl_balance_at(p_business, '2100', v_end);
  difference := subledger - ledger; return next;

  -- The advances (0049): given and not cancelled, less what approved payrolls
  -- took back, against Employee advances (1300).
  check_key := 'advances'; label := 'Advances not yet taken back vs Employee advances (1300)';
  select coalesce(sum(v.amount), 0) into subledger
    from employee_advance v join journal_entry j on j.id = v.journal_entry_id
   where v.business_id = p_business and j.occurred_at < v_end
     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end);
  subledger := subledger - coalesce((
    select sum(a.advances_recovered)
      from payroll_approval a join journal_entry j on j.id = a.journal_entry_id
     where a.business_id = p_business and j.occurred_at < v_end
       and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end)), 0);
  ledger := gl_balance_at(p_business, '1300', v_end);
  difference := subledger - ledger; return next;

  -- Stock on its way between places (0054): what was sent and has not yet
  -- arrived or been cancelled, at what it left at, against Stock in transit (1210).
  check_key := 'transit'; label := 'Stock on its way between places vs Stock in transit (1210)';
  select coalesce(sum(t.value_sent), 0) into subledger
    from stock_transfer t
   where t.business_id = p_business and t.sent_at < v_end
     and (t.received_at is null or t.received_at >= v_end) and (t.cancelled_at is null or t.cancelled_at >= v_end);
  ledger := gl_balance_at(p_business, '1210', v_end);
  difference := subledger - ledger; return next;

  -- The records themselves: how many lack their journal, or are journals
  -- lacking their record.
  check_key := 'documents'; label := 'Every record has its one journal, and every automatic journal its record';
  select count(*) into subledger from document_problems(p_business, v_end);
  ledger := 0;
  difference := subledger; return next;
end $$;


-- A new item's opening stock at the place it is added at (0033's, with the
-- place): the kitchen's own items open at the kitchen. No place named: the
-- first branch, as before.
drop function if exists create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric,
                                    numeric, boolean, text, uuid);
drop function if exists create_item__run(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric,
                                         numeric, boolean, text);
create or replace function create_item__run(
  p_name text, p_item_type item_type, p_base_unit text, p_dimension unit_dimension,
  p_name_ar text default null, p_name_ckb text default null, p_min_level numeric default null,
  p_units jsonb default '[]', p_opening_qty numeric default null, p_opening_unit_cost numeric default null,
  p_returnable boolean default false, p_opening_reason text default null, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage', 'purchase.create', 'inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  v_item uuid; u jsonb; v_code text; v_value numeric; v_mv uuid; v_journal uuid; v_location uuid;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name the item'; end if;
  if nullif(trim(p_base_unit), '') is null then raise exception 'Give the item a base unit'; end if;
  if coalesce(p_min_level, 0) < 0 then raise exception 'Levels cannot be negative'; end if;
  perform assert_name_free(v_business, 'item', p_name);
  if coalesce(p_opening_qty, 0) > 0 then perform assert_owner_opening(p_opening_reason); end if;
  insert into item (business_id, name, name_ar, name_ckb, item_type, base_unit_code, dimension,
                    min_level_base, returnable_to_stock)
  values (v_business, trim(p_name), nullif(trim(p_name_ar), ''), nullif(trim(p_name_ckb), ''), p_item_type,
          trim(p_base_unit), p_dimension, p_min_level, coalesce(p_returnable, false))
  returning id into v_item;
  for u in select * from jsonb_array_elements(coalesce(p_units, '[]')) loop
    v_code := trim(u ->> 'code');
    perform assert_unit_ok(trim(p_name), trim(p_base_unit), v_code, (u ->> 'factor')::numeric);
    if exists (select 1 from item_unit where item_id = v_item and lower(code) = lower(v_code)) then
      raise exception '% already has a unit called %: a unit in use keeps its size, so give a new size its own name',
        trim(p_name), v_code;
    end if;
    insert into item_unit (item_id, code, label, dimension, factor_to_base)
    values (v_item, v_code, coalesce(nullif(trim(u ->> 'label'), ''), v_code), p_dimension, (u ->> 'factor')::numeric);
  end loop;
  if coalesce(p_opening_qty, 0) > 0 then
    if p_opening_unit_cost is null or p_opening_unit_cost < 0 then
      raise exception 'Opening stock needs a unit cost';
    end if;
    v_location := resolve_location(v_business, p_location);
    v_value := money_round(v_business, p_opening_qty * p_opening_unit_cost);
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, app_user_id, reason)
    values (v_business, v_item, v_location, 'opening_balance', p_opening_qty, p_opening_unit_cost, v_value,
            'opening_balance', v_me, 'Opening balance: ' || trim(p_opening_reason))
    returning id into v_mv;
    if v_value > 0 then
      v_journal := post_journal(v_business, now(), 'Opening stock: ' || trim(p_name), 'inventory_movement', v_mv,
        jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_value),
                          jsonb_build_object('code', '3000', 'credit', v_value)));
    end if;
    perform audit_event(v_business, 'inventory.opening', 'inventory_movement', v_mv::text, trim(p_opening_reason),
                        null, jsonb_build_object('item', v_item, 'qty', p_opening_qty, 'value', v_value));
  end if;
  return jsonb_build_object('item_id', v_item, 'opening_value', coalesce(v_value, 0));
end $$;

create or replace function create_item(
  p_name text,
  p_item_type item_type,
  p_base_unit text,
  p_dimension unit_dimension,
  p_name_ar text default null,
  p_name_ckb text default null,
  p_min_level numeric default null,
  p_units jsonb default '[]'::jsonb,
  p_opening_qty numeric default null,
  p_opening_unit_cost numeric default null,
  p_returnable boolean default false,
  p_opening_reason text default null,
  p_location uuid default null,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  -- A retry from before the place was named asks the same question.
  v_req jsonb := jsonb_build_object('p_name', p_name, 'p_item_type', p_item_type, 'p_base_unit', p_base_unit,
                   'p_dimension', p_dimension, 'p_name_ar', p_name_ar, 'p_name_ckb', p_name_ckb,
                   'p_min_level', p_min_level, 'p_units', p_units, 'p_opening_qty', p_opening_qty,
                   'p_opening_unit_cost', p_opening_unit_cost, 'p_returnable', p_returnable,
                   'p_opening_reason', p_opening_reason)
                 || case when p_location is null then '{}'::jsonb
                         else jsonb_build_object('p_location', p_location) end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'create_item', v_req);
  if v is not null then return v; end if;
  v := create_item__run(p_name => p_name, p_item_type => p_item_type, p_base_unit => p_base_unit,
                        p_dimension => p_dimension, p_name_ar => p_name_ar, p_name_ckb => p_name_ckb,
                        p_min_level => p_min_level, p_units => p_units, p_opening_qty => p_opening_qty,
                        p_opening_unit_cost => p_opening_unit_cost, p_returnable => p_returnable,
                        p_opening_reason => p_opening_reason, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'create_item', v_req, v);
  return v;
end $$;

-- A batch at every place it is at (0046's story, now of all its lots): made =
-- sold + used + lost + on its way ± counted ± corrected + left. Sent between
-- its own places it has not moved at all; what did not arrive is lost; what is
-- on its way is apart until it arrives.
create or replace function batch_story(p_batch uuid) returns jsonb
language sql stable set search_path = public as $$
  with k as (
    select stock_card_kind(m.type, m.reference_type, m.base_quantity_signed) as kind, lm.base_qty,
           (m.type = 'transfer_out'
            and exists (select 1 from stock_transfer t where t.id = m.reference_id and t.status = 'sent')) as on_way
      from item_lot l
      join lot_movement lm on lm.lot_id = l.id
      join inventory_movement m on m.id = lm.movement_id
     where l.production_batch_id = p_batch
  ),
  s as (
    select coalesce(sum(base_qty) filter (where kind = 'made'), 0) as made,
           coalesce(-sum(base_qty) filter (where kind = 'sold'), 0) as sold,
           coalesce(-sum(base_qty) filter (where kind = 'batches'), 0) as used,
           coalesce(-sum(base_qty) filter (where kind = 'wasted'), 0) as wasted,
           coalesce(-sum(base_qty) filter (where kind = 'transferred'), 0) as away,
           coalesce(-sum(base_qty) filter (where on_way), 0) as on_way,
           coalesce(sum(base_qty) filter (where kind = 'counted'), 0) as counted,
           coalesce(sum(base_qty) filter (where kind not in ('made', 'sold', 'batches', 'wasted', 'counted',
                                                            'transferred')), 0) as corrected,
           coalesce(sum(base_qty), 0) as left_
      from k
  )
  select jsonb_build_object(
    'made', trim_scale(made), 'sold', trim_scale(sold), 'used', trim_scale(used),
    'lost', trim_scale(wasted + away - on_way), 'moved', trim_scale(on_way),
    'counted', trim_scale(counted), 'corrected', trim_scale(corrected), 'left', trim_scale(left_))
  from s
$$;

-- (production.record or cost.view) One batch (0046's), its story at every
-- place it is at, and each movement of it, with the place.
create or replace function batch_reconciliation(p_batch uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record', 'cost.view');
  b production_batch;
begin
  select * into b from production_batch where id = p_batch and business_id = v_business;
  if not found then raise exception 'Batch not found'; end if;
  return jsonb_build_object(
    'batch_id', b.id, 'batch_no', b.batch_no, 'status', b.status,
    'recipe_id', b.recipe_id, 'recipe', (select name from recipe where id = b.recipe_id),
    'item_id', b.output_item_id, 'item', (select name from item where id = b.output_item_id),
    'base_unit', (select base_unit_code from item where id = b.output_item_id),
    'entered_unit', b.output_unit_code,
    'batches', b.batches, 'planned', b.planned_yield_base, 'actual', b.actual_yield_base,
    'made_at', coalesce(b.produced_at, b.created_at), 'recorded_at', b.created_at,
    'made_by', (select full_name from app_user where id = b.responsible_user),
    'use_by', b.use_by, 'late_reason', b.late_reason, 'note', b.quality_note,
    'cancelled_at', b.cancelled_at, 'cancel_reason', b.cancel_reason,
    'lot_id', b.output_lot_id, 'lot', (select lot_code from item_lot where id = b.output_lot_id),
    'story', case when b.output_lot_id is not null then batch_story(b.id) end,
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'at', m.occurred_at, 'type', m.type,
               'kind', stock_card_kind(m.type, m.reference_type, m.base_quantity_signed),
               'qty', trim_scale(lm.base_qty), 'reference_type', m.reference_type,
               'reference_id', m.reference_id, 'reason', m.reason,
               'by', (select full_name from app_user where id = m.app_user_id),
               'place', (select name from location where id = m.location_id))
             order by m.occurred_at, m.created_at, lm.created_at, lm.id)
        from item_lot l
        join lot_movement lm on lm.lot_id = l.id
        join inventory_movement m on m.id = lm.movement_id
       where l.production_batch_id = b.id), '[]'::jsonb));
end $$;

-- (cost.view) Reports → Production (0046's), each batch's story at every place
-- it is at.
create or replace function report_production(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
begin
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Choose the dates, the first before the last'; end if;
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'batches', coalesce((
      select jsonb_agg(jsonb_build_object(
               'batch_id', b.id, 'batch_no', b.batch_no, 'recipe', r.name, 'item', i.name,
               'base_unit', i.base_unit_code, 'made_at', coalesce(b.produced_at, b.created_at), 'status', b.status,
               'planned', b.planned_yield_base, 'actual', b.actual_yield_base,
               'yield_pct', case when b.planned_yield_base > 0
                                 then round(100 * b.actual_yield_base / b.planned_yield_base, 1) end,
               'value', b.total_consumed_value, 'use_by', b.use_by,
               'story', case when b.output_lot_id is not null then batch_story(b.id) end)
             order by b.batch_no)
        from production_batch b join recipe r on r.id = b.recipe_id
        left join item i on i.id = coalesce(b.output_item_id, r.output_item_id)
       where b.business_id = v_business
         and business_local_date(v_business, coalesce(b.produced_at, b.created_at)) between p_from and p_to),
      '[]'::jsonb));
end $$;

-- 0026's dashboard, counting items rather than an item at each place: an item
-- is low when all the café holds of it is under its reorder level, and below
-- zero when it is below zero anywhere.
create or replace function dashboard_summary(p_day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('profit.view'); b record; v_rev numeric; v_cos numeric; v_orders bigint;
begin
  b := local_day_bounds(v_business, p_day, p_day);
  select coalesce(sum(case when a.account_type = 'revenue' then l.credit - l.debit end), 0),
         coalesce(sum(case when a.code like '5%' then l.debit - l.credit end), 0)
    into v_rev, v_cos
    from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id
   where e.business_id = v_business and e.status = 'published' and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts
     and e.reference_type is distinct from 'year_end_close';
  select count(*) into v_orders from sales_order
   where business_id = v_business and status not in ('voided', 'open') and placed_at >= b.from_ts and placed_at < b.to_ts;
  return jsonb_build_object(
    'net_revenue', v_rev, 'cost_of_sales', v_cos, 'gross_profit', v_rev - v_cos, 'orders', v_orders,
    'average_order', case when v_orders > 0 then round(v_rev / v_orders) else 0 end,
    'inventory_value', gl_balance_at(v_business, '1200', b.to_ts),
    'low_stock', (select count(*) from (
                    select s.item_id from stock_board s where s.business_id = v_business
                     group by s.item_id having sum(s.quantity_base) < coalesce(max(s.min_level_base), 0)) x),
    'negative_stock', (select count(distinct s.item_id) from stock_board s
                        where s.business_id = v_business and s.is_negative));
end $$;

-- 0049's closing checklist, with the stock on its way named like the others.
create or replace function period_close_checklist(p_period uuid)
returns table (check_key text, label text, ok boolean, detail text, blocks boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.period.lock', 'accounting.post', 'audit.view');
  p accounting_period; v numeric; n int; v_days text; c record;
begin
  select * into p from accounting_period where id = p_period and business_id = v_business;
  if not found then raise exception 'Period not found'; end if;
  blocks := true;

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

  -- Each subledger against its account, as at the month's last day.
  for c in select * from reconciliation_checks(v_business, p.ends_on) loop
    check_key := c.check_key;
    ok := c.difference = 0;
    label := case c.check_key
      when 'inventory' then 'Stock ledger agrees with Inventory (1200)'
      when 'payables' then 'Unpaid bills agree with Accounts payable (2000)'
      when 'grni' then 'Unbilled receipts agree with GRNI (2050)'
      when 'sales' then 'Sales agree with net revenue (4000 less 4100 and 4200)'
      when 'card' then 'Card takings not yet settled agree with Card clearing (1010)'
      when 'platform' then 'Orders the platforms owe agree with their receivable (1100)'
      when 'drawer' then 'What the drawers should hold agrees with Cash in the till (1000)'
      when 'safe' then 'Cash moved through the safe agrees with the Safe (1005)'
      when 'payroll' then 'Salaries owed agree with Salaries payable (2100)'
      when 'advances' then 'Advances not yet taken back agree with Employee advances (1300)'
      when 'transit' then 'Stock on its way agrees with Stock in transit (1210)'
      when 'documents' then 'Every record has its one journal'
      else c.label end;
    detail := case when c.difference = 0 then null
      when c.check_key = 'documents' then c.difference || ' record(s) to look into: see Reports, Do the books tie?'
      else format(case c.check_key
                    when 'inventory' then 'stock ledger %s, account 1200 %s, difference %s'
                    when 'payables' then 'unpaid bills %s, account 2000 %s, difference %s'
                    when 'grni' then 'unbilled receipts %s, account 2050 %s, difference %s'
                    when 'sales' then 'sales %s, net revenue %s, difference %s'
                    when 'card' then 'card takings %s, account 1010 %s, difference %s'
                    when 'platform' then 'orders owed %s, account 1100 %s, difference %s'
                    when 'drawer' then 'the drawers %s, account 1000 %s, difference %s'
                    when 'safe' then 'the safe''s records %s, account 1005 %s, difference %s'
                    when 'payroll' then 'salaries owed %s, account 2100 %s, difference %s'
                    when 'advances' then 'advances owed %s, account 1300 %s, difference %s'
                    when 'transit' then 'stock on its way %s, account 1210 %s, difference %s'
                    else 'records %s, account %s, difference %s' end,
                  c.subledger, c.ledger, c.difference) end;
    return next;
  end loop;

  select coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0) into v
    from journal_line l join journal_entry e on e.id = l.journal_entry_id
   where e.period_id = p_period and e.status = 'published';
  check_key := 'trial_balance'; label := 'The period''s journals balance'; ok := v = 0;
  detail := case when v <> 0 then 'out by ' || v end; return next;

  -- A warning, not a lock: a sale costed at nothing cannot be costed again, but
  -- the owner should know its profit is overstated, and why (0025).
  select count(*) into n from uncosted_sales(v_business, p.starts_on, p.ends_on);
  check_key := 'uncosted'; label := 'No sale costed at nothing'; ok := n = 0; blocks := false;
  detail := case when n > 0 then n || ' sale(s) costed at nothing or in part at nothing: see Reports, Uncosted sales. '
                                 || 'Their profit is overstated. The month can still be locked' end; return next;

  -- A warning (0049): the month's payroll, while people worked here in it.
  check_key := 'payroll_approved'; label := 'The month''s payroll is approved'; blocks := false;
  ok := not exists (select 1 from employee e where e.business_id = v_business and e.hired_on <= p.ends_on
                      and (e.left_on is null or e.left_on >= p.starts_on))
        or exists (select 1 from payroll_run r where r.business_id = v_business
                     and r.month = date_trunc('month', p.starts_on)::date and r.status in ('approved', 'paid'));
  detail := case when not ok then format('The payroll for %s is not approved: after the lock it cannot be posted into this month',
                                         to_char(p.starts_on, 'YYYY-MM')) end;
  return next;
end $$;


-- ---------------------------------------------------------------------------
-- 7. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function batch_story(uuid) from public, anon, authenticated;
revoke execute on function create_item__run(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric,
                                           numeric, boolean, text, uuid)
  from public, anon, authenticated;
revoke execute on function create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric,
                                       numeric, boolean, text, uuid, uuid) from public, anon;
grant execute on function create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric,
                                      numeric, boolean, text, uuid, uuid) to authenticated;
revoke execute on function send_stock_transfer__run(uuid, uuid, jsonb, text, boolean),
  receive_stock_transfer__run(uuid, jsonb, text), cancel_stock_transfer__run(uuid, text),
  trg_stock_transfer_guard(), trg_stock_transfer_line_guard(), trg_transit_by_transfers()
  from public, anon, authenticated;
revoke execute on function send_stock_transfer(uuid, uuid, jsonb, text, boolean, uuid),
  receive_stock_transfer(uuid, jsonb, text, uuid), cancel_stock_transfer(uuid, text, uuid),
  stock_transfers(int), stock_places() from public, anon;
grant execute on function send_stock_transfer(uuid, uuid, jsonb, text, boolean, uuid),
  receive_stock_transfer(uuid, jsonb, text, uuid), cancel_stock_transfer(uuid, text, uuid),
  stock_transfers(int), stock_places() to authenticated;
