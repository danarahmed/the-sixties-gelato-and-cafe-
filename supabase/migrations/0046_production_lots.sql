-- =============================================================================
-- 0046 — Batches, use-by dates and lots; the day's production plan (release U)
--
-- A batch had no number and no use-by, and what it made was not told apart from
-- any other stock of the item: nobody could say of a batch how much of it was
-- sold, lost or left, nor what was about to go off (docs/COMPLETION_PLAN.md,
-- B11, D12).
--   * A batch is numbered (the café's `batch` counter) and has a use-by: the
--     recipe's shelf life from when it was made, or one given, changed later by
--     a manager with a reason.
--   * Each batch makes a lot of what it makes, and that item is tracked by lot
--     from then on. What leaves a tracked item is taken from its lots, kept in
--     lot_movement, each movement split by lot: stock with no lot first (from
--     before its first lot, or found on a count), then the lots by the earliest
--     use-by; what is past its use-by last, as it is not to be sold. What is
--     thrown away as expired, or found missing on a count, is taken from what
--     is past its use-by first. What comes back goes back to the lots it left:
--     a void, a refund back on the shelf, a loss taken back, a batch cancelled.
--     What was sold beyond the stock there was is taken from the next batch
--     that comes in.
--   * batch_reconciliation(batch): made = sold + used in batches + lost ±
--     counted ± moved ± corrected + left. production_plan(day, location): what
--     to make, from what each item was used on that weekday over the last 4 to
--     8 weeks, against what is on hand and good through the day, in whole
--     batches, with the ingredients that are short. What is past or near its
--     use-by is an alert, and listed on Production.
--   * A batch made earlier is recorded by a manager, with a reason, yesterday's
--     at the earliest, and not before the last approved count of its items.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Batches numbered, with a use-by; lots
-- ---------------------------------------------------------------------------
alter table recipe add column if not exists shelf_life_hours int;
alter table recipe drop constraint if exists recipe_shelf_life;
alter table recipe add constraint recipe_shelf_life check (shelf_life_hours between 1 and 8760);

alter table production_batch add column if not exists batch_no bigint;
alter table production_batch add column if not exists use_by timestamptz;
alter table production_batch add column if not exists late_reason text;

-- The batches recorded before: numbered in the order they were made.
do $$
declare b record;
begin
  for b in select id, business_id from production_batch where batch_no is null
            order by business_id, coalesce(produced_at, created_at), created_at, id loop
    update production_batch set batch_no = next_document_no(b.business_id, 'batch', 1) where id = b.id;
  end loop;
end $$;
alter table production_batch alter column batch_no set not null;
create unique index if not exists production_batch_no on production_batch (business_id, batch_no);

-- A lot is at the place it was made, and holds what is left of it (left_base,
-- kept with each row of lot_movement below).
alter table item_lot add column if not exists use_by timestamptz;
alter table item_lot add column if not exists production_batch_id uuid references production_batch (id);
alter table item_lot add column if not exists location_id uuid references location (id);
alter table item_lot add column if not exists left_base numeric not null default 0;
alter table item_lot add column if not exists created_at timestamptz not null default now();
create unique index if not exists item_lot_batch on item_lot (production_batch_id) where production_batch_id is not null;
create index if not exists item_lot_open on item_lot (business_id, item_id, location_id) where left_base > 0;

-- A movement of an item tracked by lot, split by lot: what each lot gave or
-- took. A row with no lot is stock with no lot; with no movement, the stock an
-- item had where it was when it began to be tracked. For a tracked item, the
-- rows of a place add up to its stock there.
create table if not exists lot_movement (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business (id) on delete cascade,
  movement_id uuid references inventory_movement (id),
  lot_id      uuid references item_lot (id),
  item_id     uuid not null references item (id),
  location_id uuid not null references location (id),
  base_qty    numeric not null check (base_qty <> 0),
  created_at  timestamptz not null default now(),
  constraint lot_movement_opening check (movement_id is not null or lot_id is null)
);
create index if not exists lot_movement_lot on lot_movement (lot_id) where lot_id is not null;
create index if not exists lot_movement_movement on lot_movement (movement_id);
create index if not exists lot_movement_loose on lot_movement (item_id, location_id) where lot_id is null;

alter table lot_movement enable row level security;
alter table lot_movement force row level security;
drop policy if exists cost_read on lot_movement;
create policy cost_read on lot_movement for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
grant select on lot_movement to authenticated;
drop trigger if exists lot_movement_append_only on lot_movement;
create trigger lot_movement_append_only before update or delete on lot_movement
  for each row execute function forbid_mutation();

-- What a lot holds now.
create or replace function lot_left(p_lot uuid) returns numeric
language sql stable set search_path = public as $$
  select coalesce((select left_base from item_lot where id = p_lot), 0)
$$;

-- A row of lot_movement, and what its lot holds with it.
create or replace function put_lot_row(p_business uuid, p_movement uuid, p_lot uuid, p_item uuid, p_location uuid,
                                       p_qty numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_qty is null or p_qty = 0 then return; end if;
  insert into lot_movement (business_id, movement_id, lot_id, item_id, location_id, base_qty)
  values (p_business, p_movement, p_lot, p_item, p_location, p_qty);
  if p_lot is not null then
    update item_lot set left_base = left_base + p_qty where id = p_lot;
  end if;
end $$;

-- An item tracked by lot from now: the stock it has at each place is kept as
-- stock with no lot, which leaves before any lot.
create or replace function start_lot_tracking(p_item uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_business uuid;
begin
  select business_id into v_business from item where id = p_item and not track_lot for update;
  if not found then return; end if;
  insert into lot_movement (business_id, movement_id, lot_id, item_id, location_id, base_qty)
  select v_business, null, null, p_item, m.location_id, sum(m.base_quantity_signed)
    from inventory_movement m
   where m.business_id = v_business and m.item_id = p_item
   group by m.location_id
  having sum(m.base_quantity_signed) <> 0;
  perform set_config('audit.reason', p_reason, true);
  update item set track_lot = true where id = p_item;
  perform set_config('audit.reason', '', true);
end $$;

-- Every item made in batches is tracked by lot from this migration on.
do $$
declare i record;
begin
  for i in select distinct r.output_item_id as id from recipe r
            join item it on it.id = r.output_item_id and not it.track_lot loop
    perform start_lot_tracking(i.id, 'Made in batches: its stock is kept batch by batch from its next batch on');
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Each movement of a tracked item split by lot
-- ---------------------------------------------------------------------------
-- The movements a return goes back against, when it is one: a refund back on
-- the shelf, against its sale line; a void, against its sale; a batch
-- cancelled, against the batch; a loss taken back, against the loss (named by
-- review_loss while it writes the reversal). What was given back of them
-- before is among them, so nothing goes back twice.
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
  end
$$;

-- Where a movement of a tracked item comes from, or goes to:
--   * coming in with its lot (a batch's output): to that lot; what was taken
--     beyond the stock there was before it came in is taken from it;
--   * a return: back to the lots it left, as far as they gave it, the
--     earliest use-by first (what comes back is taken to be the oldest); a
--     batch cancelled takes its output back from its own lot;
--   * anything else coming in: stock with no lot;
--   * going out: stock with no lot first, then the lots by the earliest
--     use-by, what is past its use-by last; thrown away as expired, or missing
--     on a count, what is past its use-by first. Beyond what they hold, below
--     zero with no lot.
-- A revaluation moves value, not stock: it is not split.
create or replace function allocate_lots(m inventory_movement) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_qty numeric := m.base_quantity_signed;
  v_need numeric := abs(m.base_quantity_signed);
  v_at timestamptz := coalesce(m.occurred_at, m.created_at, now());
  v_stale_first boolean := m.type::text in ('expired', 'count_adjustment');
  v_src uuid[]; v_take numeric; v_short numeric; l record;
begin
  if m.type::text = 'cost_adjustment' or coalesce(v_qty, 0) = 0 then return; end if;
  perform 1 from item where id = m.item_id for update;

  if v_qty > 0 and m.lot_id is not null then
    perform put_lot_row(m.business_id, m.id, m.lot_id, m.item_id, m.location_id, v_qty);
    -- Sold or used beyond the stock there was: from this lot, the latest first.
    select -coalesce(sum(base_qty), 0) into v_short from lot_movement
     where item_id = m.item_id and location_id = m.location_id and lot_id is null;
    v_short := least(greatest(v_short, 0), v_qty);
    if v_short > 0 then
      for l in
        select lm.movement_id, -sum(lm.base_qty) as short
          from lot_movement lm join inventory_movement o on o.id = lm.movement_id
         where lm.item_id = m.item_id and lm.location_id = m.location_id and lm.lot_id is null
           and lm.movement_id <> m.id
         group by lm.movement_id, o.occurred_at, o.created_at
        having sum(lm.base_qty) < 0
         order by o.occurred_at desc, o.created_at desc, lm.movement_id
      loop
        exit when v_short <= 0;
        v_take := least(v_short, l.short);
        perform put_lot_row(m.business_id, l.movement_id, null, m.item_id, m.location_id, v_take);
        perform put_lot_row(m.business_id, l.movement_id, m.lot_id, m.item_id, m.location_id, -v_take);
        v_short := v_short - v_take;
      end loop;
    end if;
    return;
  end if;

  v_src := lot_sources(m);
  if v_src is not null then
    for l in
      select lm.lot_id, -sign(v_qty) * sum(lm.base_qty) as avail
        from lot_movement lm join item_lot lot on lot.id = lm.lot_id
       where lm.movement_id = any(v_src) and lm.item_id = m.item_id and lm.location_id = m.location_id
       group by lm.lot_id, lot.use_by, lot.created_at
      having -sign(v_qty) * sum(lm.base_qty) > 0
       order by lot.use_by nulls last, lot.created_at, lm.lot_id
    loop
      exit when v_need <= 0;
      v_take := least(v_need, l.avail);
      if v_qty < 0 then v_take := least(v_take, greatest(lot_left(l.lot_id), 0)); end if;
      if v_take > 0 then
        perform put_lot_row(m.business_id, m.id, l.lot_id, m.item_id, m.location_id, sign(v_qty) * v_take);
        v_need := v_need - v_take;
      end if;
    end loop;
  end if;
  if v_need <= 0 then return; end if;
  if v_qty > 0 then
    perform put_lot_row(m.business_id, m.id, null, m.item_id, m.location_id, v_need);
    return;
  end if;

  for l in
    select x.lot_id, x.left_qty from (
      select null::uuid as lot_id, sum(lm.base_qty) as left_qty, null::timestamptz as use_by,
             null::timestamptz as made
        from lot_movement lm
       where lm.item_id = m.item_id and lm.location_id = m.location_id and lm.lot_id is null
      union all
      select lot.id, lot.left_base, lot.use_by, lot.created_at
        from item_lot lot
       where lot.business_id = m.business_id and lot.item_id = m.item_id and lot.location_id = m.location_id
         and lot.left_base > 0) x
     where x.left_qty > 0
     order by case when x.lot_id is null then case when v_stale_first then 1 else 0 end
                   when x.use_by <= v_at then case when v_stale_first then 0 else 2 end
                   else case when v_stale_first then 2 else 1 end end,
              x.use_by nulls last, x.made, x.lot_id
  loop
    exit when v_need <= 0;
    v_take := least(v_need, l.left_qty);
    perform put_lot_row(m.business_id, m.id, l.lot_id, m.item_id, m.location_id, -v_take);
    v_need := v_need - v_take;
  end loop;
  if v_need > 0 then
    perform put_lot_row(m.business_id, m.id, null, m.item_id, m.location_id, -v_need);
  end if;
end $$;

create or replace function trg_movement_lots() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from item where id = new.item_id and track_lot) then
    perform allocate_lots(new);
  end if;
  return null;
end $$;
drop trigger if exists inventory_movement_lots on inventory_movement;
create trigger inventory_movement_lots after insert on inventory_movement
  for each row execute function trg_movement_lots();

-- 0036's void_sale__run, with its items locked first, in one order, as every
-- other writer of stock does: a tracked item's lots are taken under that lock.
create or replace function void_sale__run(p_order uuid, p_reason text default null, p_reason_code text default null,
                                          p_approval uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.void');
  v_me uuid := (current_member()).id;
  o sales_order; v_day date; v_journal uuid; v_rev uuid; m record; v_reason text; v_approver uuid := v_me; a approval;
begin
  select * into o from sales_order where id = p_order and business_id = v_business for update;
  if not found then raise exception 'Sale not found'; end if;
  if o.status <> 'completed' then
    raise exception 'Only a completed sale can be voided; this one is %', o.status;
  end if;
  v_day := business_local_date(v_business, o.placed_at);
  if exists (select 1 from work_shift w where w.business_id = v_business and w.location_id = o.location_id
               and w.closed_at is not null
               and ((w.kind = 'day' and w.business_day = v_day)
                    or (w.kind in ('drawer', 'session') and w.closed_at > o.created_at))) then
    raise exception 'The drawer has been counted since this sale; refund it instead of voiding it';
  end if;
  select id into v_journal from journal_entry
   where business_id = v_business and reference_type = 'sales_order' and reference_id = p_order
     and reverses_entry is null and status = 'published';
  if v_journal is null then
    raise exception 'This sale has no journal to reverse (it predates the controls); refund it instead';
  end if;
  v_reason := reason_text('void', p_reason_code, p_reason);
  if p_approval is not null then
    a := use_approval(v_business, p_approval, 'void', p_order::text);
    if a.scope ->> 'order_id' is distinct from p_order::text then
      raise exception 'That approval is for another sale';
    end if;
    v_approver := a.approver_id;
  end if;

  v_rev := reverse_entry_internal(v_journal, now(), 'Void of sale ' || left(p_order::text, 8) || ': ' || v_reason);
  perform lock_items(array(select distinct item_id from inventory_movement
                            where reference_type = 'sales_order' and reference_id = p_order
                              and type = 'sale_consumption'));
  for m in select * from inventory_movement
            where reference_type = 'sales_order' and reference_id = p_order and type = 'sale_consumption'
            order by created_at, id loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'reversal', -m.base_quantity_signed,
            m.unit_cost, m.value, 'sale_void', p_order, v_me, 'Void: ' || v_reason);
  end loop;
  insert into sale_adjustment (business_id, sales_order_id, kind, amount, reason, reason_code, requested_by, approved_by)
  values (v_business, p_order, 'void', o.net_amount, v_reason, coalesce(nullif(trim(p_reason_code), ''), 'other'),
          v_me, v_approver);
  update sales_order set status = 'voided' where id = p_order;
  perform audit_event(v_business, 'sale.void', 'sales_order', p_order::text, v_reason,
    jsonb_build_object('status', o.status, 'net', o.net_amount),
    jsonb_build_object('status', 'voided', 'approved_by', v_approver));
  return jsonb_build_object('order_id', p_order,
    'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- 0040's review_loss__run, naming the loss its reversal takes back, so the
-- stock goes back to the lots the loss took it from.
create or replace function review_loss__run(p_movement uuid, p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('waste.approve');
  v_me uuid := (current_member()).id;
  m inventory_movement; v_id uuid := gen_random_uuid(); v_journal uuid; v_rev uuid; v_rev_mv uuid;
  v_reason text := nullif(trim(p_reason), ''); v_item text; v_decision text;
begin
  if p_decision is null or p_decision not in ('approve', 'reverse') then
    raise exception 'Approve the loss, or reverse it';
  end if;
  v_decision := case p_decision when 'approve' then 'approved' else 'reversed' end;
  select * into m from inventory_movement where id = p_movement and business_id = v_business;
  if not found or not is_loss(m.type) or m.base_quantity_signed >= 0 then raise exception 'Loss not found'; end if;
  perform lock_items(array[m.item_id]);
  if exists (select 1 from loss_review where movement_id = p_movement) then
    raise exception 'This loss has been looked at already';
  end if;
  if m.approval_status <> 'pending' then raise exception 'This loss is not waiting for approval'; end if;
  if m.app_user_id = v_me then raise exception 'Someone else approves a loss you recorded'; end if;
  if p_decision = 'reverse' and v_reason is null then raise exception 'Say why the loss is reversed'; end if;
  select name into v_item from item where id = m.item_id;
  if p_decision = 'reverse' then
    perform set_config('lots.loss_reversed', p_movement::text, true);
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'reversal', -m.base_quantity_signed, m.unit_cost, m.value,
            'loss_review', v_id, v_me, 'Loss reversed: ' || v_reason)
    returning id into v_rev_mv;
    perform set_config('lots.loss_reversed', '', true);
    select id into v_journal from journal_entry
     where business_id = v_business and reference_type = 'inventory_movement' and reference_id = p_movement
       and reverses_entry is null and status = 'published';
    if v_journal is not null then
      v_rev := reverse_entry_internal(v_journal, now(), 'Loss reversed: ' || v_item || ': ' || v_reason);
    end if;
  end if;
  insert into loss_review (id, business_id, movement_id, decision, reason, decided_by, reversal_movement_id,
                           journal_entry_id)
  values (v_id, v_business, p_movement, v_decision, v_reason, v_me, v_rev_mv, v_rev);
  perform audit_event(v_business, case p_decision when 'approve' then 'inventory.loss_approve'
                                                  else 'inventory.loss_reverse' end,
    'inventory_movement', p_movement::text, v_reason,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', v_decision, 'item', m.item_id, 'movement', m.type,
                       'qty', -m.base_quantity_signed, 'unit', (select base_unit_code from item where id = m.item_id),
                       'value', m.value));
  return jsonb_build_object('movement_id', p_movement, 'decision', v_decision,
    'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Recording a batch: its number, use-by and lot; one made earlier, by a
--    manager
-- ---------------------------------------------------------------------------
drop function if exists record_production(uuid, numeric, numeric, text, text, uuid, uuid, uuid);
drop function if exists record_production__run(uuid, numeric, numeric, text, text, uuid, uuid);

-- (production.record) A batch made: its ingredients out at what they cost
-- now, what came out in, into a lot of its own, numbered, used by the use-by
-- given or the recipe's shelf life from when it was made. Made more than an
-- hour ago (p_produced_at, yesterday at the earliest): recorded by a manager,
-- with why, not before the last approved count of its items there, nor in a
-- month locked; the recipe is the one in force that day.
create or replace function record_production__run(p_recipe uuid, p_batches numeric, p_output_qty numeric,
                                                  p_output_unit text, p_note text, p_location uuid,
                                                  p_stock_approval uuid, p_produced_at timestamptz,
                                                  p_use_by timestamptz, p_late_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record');
  v_me uuid := (current_member()).id;
  r recipe; v_on date; v_location uuid; v_planned numeric; v_actual numeric; v_unit text;
  v_batch uuid := gen_random_uuid(); v_items uuid[]; l record; v_cost numeric; v_value numeric; v_total numeric := 0;
  v_at timestamptz := coalesce(p_produced_at, now());
  v_late boolean := p_produced_at is not null and p_produced_at < now() - interval '1 hour';
  v_counted timestamptz; v_no bigint; v_use_by timestamptz; v_lot uuid;
begin
  select * into r from recipe where id = p_recipe and business_id = v_business;
  if not found or r.output_item_id is null then raise exception 'Choose what was made'; end if;
  if not r.is_active then raise exception '% is not made any more: show it again to record a batch', r.name; end if;
  if p_batches is null or p_batches <= 0 then raise exception 'Enter how many batches were made'; end if;
  if p_produced_at > now() + interval '5 minutes' then
    raise exception 'A batch is recorded once it is made, not before';
  end if;
  if v_late then
    if not current_has_permission('inventory.adjust.approve') then
      raise exception 'A batch made earlier is recorded by a manager';
    end if;
    if nullif(trim(p_late_reason), '') is null then raise exception 'Say why the batch is recorded late'; end if;
    if business_local_date(v_business, p_produced_at) < business_local_date(v_business, now()) - 1 then
      raise exception 'A batch is recorded late by a day at most: yesterday''s, not before';
    end if;
  end if;
  v_on := business_local_date(v_business, v_at);
  if exists (select 1 from accounting_period where business_id = v_business and status = 'locked'
                                               and v_on between starts_on and ends_on) then
    raise exception 'That day is in a locked month: nothing is recorded in it';
  end if;
  if recipe_version_on(r.id, v_on) is null then raise exception '% has no ingredients in force that day', r.name; end if;
  v_planned := trim_scale(r.batch_yield_base * p_batches);
  if p_output_qty is null then
    v_actual := v_planned;
    v_unit := r.batch_yield_unit;
  else
    v_unit := coalesce(nullif(p_output_unit, ''), (select base_unit_code from item where id = r.output_item_id));
    v_actual := to_base_qty(r.output_item_id, p_output_qty, v_unit);
    if v_actual is null or v_actual <= 0 then
      raise exception 'Enter what came out, or leave it empty if it came out as the recipe says';
    end if;
  end if;
  v_location := resolve_location(v_business, p_location);
  v_use_by := coalesce(p_use_by, v_at + make_interval(hours => r.shelf_life_hours));
  if v_use_by <= v_at then raise exception 'The use-by is after the batch was made'; end if;

  select array_agg(distinct e.item_id) into v_items from expand_recipe(r.id, 'dine_in', p_batches, v_on) e;
  if v_items is null then raise exception '% has no ingredients', r.name; end if;
  if r.output_item_id = any(v_items) then raise exception 'A batch cannot use what it makes'; end if;
  perform lock_items(v_items || r.output_item_id);
  if v_late then
    select max(coalesce(cl.counted_at, c.submitted_at, c.approved_at)) into v_counted
      from stock_count c join stock_count_line cl on cl.stock_count_id = c.id
     where c.business_id = v_business and c.location_id = v_location and c.status = 'approved'
       and cl.item_id = any(v_items || r.output_item_id);
    if v_counted > p_produced_at then
      raise exception 'A count of its items was approved after that time: a batch made before the count is not recorded now';
    end if;
  end if;
  -- What it uses beyond the books is as each ingredient's rule says (0040).
  perform stock_rules(v_business, v_location,
    (select jsonb_agg(jsonb_build_object('item_id', e.item_id, 'qty', e.base_qty))
       from expand_recipe(r.id, 'dine_in', p_batches, v_on) e),
    v_me, p_stock_approval, 'negative_stock', v_batch::text);

  for l in select e.item_id, sum(e.base_qty) as qty from expand_recipe(r.id, 'dine_in', p_batches, v_on) e
            group by e.item_id order by e.item_id loop
    v_cost := item_issue_cost(v_business, l.item_id, v_location);
    v_value := money_round(v_business, v_cost * l.qty);
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason, occurred_at)
    values (v_business, l.item_id, v_location, 'production_consumption', -l.qty, v_cost, v_value,
            'production_batch', v_batch, v_me, r.name, v_at);
    v_total := v_total + v_value;
  end loop;

  v_no := next_document_no(v_business, 'batch', 1);
  insert into production_batch (id, business_id, recipe_id, location_id, status, batches, planned_yield_base,
                                actual_yield_base, produced_at, responsible_user, quality_note, total_consumed_value,
                                output_item_id, output_unit_code, batch_no, use_by, expiry_date, late_reason)
  values (v_batch, v_business, r.id, v_location, 'completed', p_batches, v_planned, v_actual, v_at, v_me,
          nullif(trim(p_note), ''), v_total, r.output_item_id, v_unit, v_no, v_use_by,
          business_local_date(v_business, v_use_by), case when v_late then trim(p_late_reason) end);
  insert into item_lot (business_id, item_id, lot_code, expiry_date, received_at, use_by, production_batch_id,
                        location_id)
  values (v_business, r.output_item_id, 'B' || v_no, business_local_date(v_business, v_use_by), v_at, v_use_by,
          v_batch, v_location)
  returning id into v_lot;
  update production_batch set output_lot_id = v_lot where id = v_batch;
  perform start_lot_tracking(r.output_item_id, 'Made in batches: its stock is kept batch by batch from this batch on');
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, reference_id, app_user_id, reason, lot_id, occurred_at)
  values (v_business, r.output_item_id, v_location, 'production_output', v_actual, v_total / v_actual, v_total,
          'production_batch', v_batch, v_me, r.name, v_lot, v_at);

  return jsonb_build_object('batch_id', v_batch, 'batch_no', v_no, 'planned', v_planned, 'actual', v_actual,
                            'use_by', v_use_by, 'produced_at', v_at, 'lot', 'B' || v_no)
    || case when current_has_permission('cost.view')
            then jsonb_build_object('value', v_total, 'unit_cost', v_total / v_actual) else '{}' end;
end $$;

create or replace function record_production(p_recipe uuid, p_batches numeric default 1,
                                             p_output_qty numeric default null, p_output_unit text default null,
                                             p_note text default null, p_location uuid default null,
                                             p_stock_approval uuid default null,
                                             p_produced_at timestamptz default null,
                                             p_use_by timestamptz default null, p_late_reason text default null,
                                             p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_recipe', p_recipe, 'p_batches', p_batches, 'p_output_qty', p_output_qty,
                                    'p_output_unit', p_output_unit, 'p_note', p_note, 'p_location', p_location,
                                    'p_stock_approval', p_stock_approval, 'p_produced_at', p_produced_at,
                                    'p_use_by', p_use_by, 'p_late_reason', p_late_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_production', v_req);
  if v is not null then return v; end if;
  v := record_production__run(p_recipe => p_recipe, p_batches => p_batches, p_output_qty => p_output_qty,
                              p_output_unit => p_output_unit, p_note => p_note, p_location => p_location,
                              p_stock_approval => p_stock_approval, p_produced_at => p_produced_at,
                              p_use_by => p_use_by, p_late_reason => p_late_reason);
  perform audit_event(v_business, 'production.record', 'production_batch', v->>'batch_id',
    nullif(trim(p_late_reason), ''), null,
    jsonb_build_object('recipe', (select name from recipe where id = p_recipe), 'batch_no', v -> 'batch_no',
                       'batches', p_batches, 'qty', p_output_qty, 'unit', p_output_unit, 'note', p_note,
                       'use_by', v -> 'use_by')
    || case when p_produced_at is not null then jsonb_build_object('made_at', v -> 'produced_at') else '{}' end);
  perform idem_finish(v_business, p_idempotency_key, 'record_production', v_req, v);
  return v;
end $$;

-- 0035's cancel_production__run: refused once some of what the batch made has
-- left its lot (or, for a batch from before lots, the item's stock).
create or replace function cancel_production__run(p_batch uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  b production_batch; m record; v_items uuid[]; v_on_hand numeric;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the batch is cancelled'; end if;
  select * into b from production_batch where id = p_batch and business_id = v_business for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.status = 'cancelled' then raise exception 'This batch is already cancelled'; end if;
  if b.status <> 'completed' then raise exception 'Only a recorded batch can be cancelled'; end if;
  select array_agg(distinct item_id) into v_items from inventory_movement
   where reference_type = 'production_batch' and reference_id = p_batch;
  if v_items is not null then perform lock_items(v_items); end if;
  for m in select * from inventory_movement
            where reference_type = 'production_batch' and reference_id = p_batch
              and type = 'production_output' loop
    v_on_hand := case when m.lot_id is not null then lot_left(m.lot_id)
                      else (item_position(v_business, m.item_id, m.location_id)).qty end;
    if v_on_hand < m.base_quantity_signed then
      raise exception 'Some of what this batch made has already been used or sold: record a loss or a correction instead';
    end if;
  end loop;
  for m in select * from inventory_movement
            where reference_type = 'production_batch' and reference_id = p_batch
              and type in ('production_consumption', 'production_output')
            order by created_at, id loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'reversal', -m.base_quantity_signed, m.unit_cost, m.value,
            'production_cancel', p_batch, v_me, 'Cancelled: ' || trim(p_reason));
  end loop;
  update production_batch set status = 'cancelled', cancelled_at = now(), cancelled_by = v_me,
                              cancel_reason = trim(p_reason)
   where id = p_batch;
  perform audit_event(v_business, 'production.cancel', 'production_batch', p_batch::text, trim(p_reason),
    jsonb_build_object('status', b.status), jsonb_build_object('status', 'cancelled'));
  return jsonb_build_object('batch_id', p_batch);
end $$;

-- (inventory.adjust.approve) A batch's use-by changed, and its lot's, with why.
create or replace function set_batch_use_by__run(p_batch uuid, p_use_by timestamptz, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  b production_batch;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the use-by changes'; end if;
  select * into b from production_batch where id = p_batch and business_id = v_business for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.status = 'cancelled' then raise exception 'This batch is cancelled'; end if;
  if p_use_by is null or p_use_by <= coalesce(b.produced_at, b.created_at) then
    raise exception 'The use-by is after the batch was made';
  end if;
  update production_batch set use_by = p_use_by, expiry_date = business_local_date(v_business, p_use_by)
   where id = b.id;
  update item_lot set use_by = p_use_by, expiry_date = business_local_date(v_business, p_use_by)
   where production_batch_id = b.id;
  perform audit_event(v_business, 'production.use_by', 'production_batch', b.id::text, trim(p_reason),
    jsonb_build_object('batch_no', b.batch_no, 'use_by', b.use_by),
    jsonb_build_object('batch_no', b.batch_no, 'use_by', p_use_by));
  return jsonb_build_object('batch_id', b.id, 'batch_no', b.batch_no, 'use_by', p_use_by);
end $$;

create or replace function set_batch_use_by(p_batch uuid, p_use_by timestamptz, p_reason text,
                                            p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_batch', p_batch, 'p_use_by', p_use_by, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_batch_use_by', v_req);
  if v is not null then return v; end if;
  v := set_batch_use_by__run(p_batch => p_batch, p_use_by => p_use_by, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'set_batch_use_by', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 4. A batch recipe's shelf life
-- ---------------------------------------------------------------------------
drop function if exists save_batch_recipe(uuid, text, jsonb, numeric, text, jsonb, text, boolean, uuid);
drop function if exists save_batch_recipe__run(uuid, text, jsonb, numeric, text, jsonb, text, boolean);

-- 0035's, with how long what it makes keeps (p_shelf_life_hours): left out,
-- as it was (none for a new recipe); 0, none; else 1 hour to a year.
create or replace function save_batch_recipe__run(p_recipe uuid, p_name text, p_output jsonb, p_yield numeric,
                                                  p_yield_unit text, p_lines jsonb, p_instructions text,
                                                  p_is_active boolean, p_shelf_life_hours int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('recipe.edit');
  r recipe; v_item uuid; v_yield numeric; v_unit text; v_dim unit_dimension; v_base text;
  v_container text; v_code text; v_factor numeric; v_version uuid; v_new boolean := p_recipe is null;
  v_before jsonb; v_after jsonb; v_keeps int; v_had_keeps int;
begin
  if nullif(trim(p_name), '') is null then raise exception 'Name what the batch makes'; end if;
  if p_shelf_life_hours < 0 or p_shelf_life_hours > 8760 then
    raise exception 'What it makes keeps for an hour to a year';
  end if;
  if not v_new then
    select * into r from recipe where id = p_recipe and business_id = v_business for update;
    if not found or r.output_item_id is null then raise exception 'Batch recipe not found'; end if;
    v_item := r.output_item_id;
    v_had_keeps := r.shelf_life_hours;
    v_before := jsonb_build_object('name', r.name, 'yield', r.batch_yield_base, 'unit', r.batch_yield_unit,
      'is_active', r.is_active,
      'lines', recipe_lines_json(recipe_version_on(r.id, business_local_date(v_business, now()))));
  elsif nullif(p_output ->> 'item_id', '') is not null then
    v_item := (p_output ->> 'item_id')::uuid;
    if not exists (select 1 from item where id = v_item and business_id = v_business and is_active) then
      raise exception 'Unknown item';
    end if;
  else
    v_dim := case p_output ->> 'measure' when 'weight' then 'mass' when 'volume' then 'volume'
                                         when 'pieces' then 'count' end::unit_dimension;
    if v_dim is null then raise exception 'Say whether it is weighed, measured or counted in pieces'; end if;
    if exists (select 1 from item where business_id = v_business and is_active and name_key(name) = name_key(p_name)) then
      raise exception 'You already keep an item called %: choose it as what the batch makes', trim(p_name);
    end if;
    v_base := case v_dim when 'mass' then 'g' when 'volume' then 'ml' else 'each' end;
    insert into item (business_id, name, item_type, base_unit_code, dimension)
    values (v_business, trim(p_name), 'finished_good', v_base, v_dim)
    returning id into v_item;
    if v_dim = 'mass' then
      insert into item_unit (item_id, code, label, dimension, factor_to_base) values (v_item, 'kg', 'kg', 'mass', 1000);
    elsif v_dim = 'volume' then
      insert into item_unit (item_id, code, label, dimension, factor_to_base) values (v_item, 'L', 'L', 'volume', 1000);
    end if;
    -- A container it is kept or counted in: a pan, a tray, a tub.
    v_container := nullif(trim(p_output ->> 'container'), '');
    if v_container is not null then
      v_code := lower(v_container);
      if v_code in ('g', 'kg', 'ml', 'l', 'each') then
        raise exception '"%" is already a unit: name the container, such as pan or tray', v_container;
      end if;
      v_factor := to_base_qty(v_item, (p_output ->> 'container_qty')::numeric, nullif(p_output ->> 'container_unit', ''));
      if v_factor is null or v_factor <= 0 then raise exception 'Say how much one % holds', v_container; end if;
      insert into item_unit (item_id, code, label, dimension, factor_to_base)
      values (v_item, v_code, v_container, v_dim, v_factor);
    end if;
  end if;

  v_unit := coalesce(nullif(p_yield_unit, ''), (select base_unit_code from item where id = v_item));
  v_yield := to_base_qty(v_item, p_yield, v_unit);
  if v_yield is null or v_yield <= 0 then raise exception 'Say how much one batch makes'; end if;
  v_keeps := case when p_shelf_life_hours is null then r.shelf_life_hours
                  when p_shelf_life_hours = 0 then null else p_shelf_life_hours end;

  if v_new then
    insert into recipe (business_id, name, output_item_id, batch_yield_base, batch_yield_unit, prep_instructions,
                        is_active, shelf_life_hours)
    values (v_business, trim(p_name), v_item, v_yield, v_unit, nullif(trim(p_instructions), ''),
            coalesce(p_is_active, true), v_keeps)
    returning * into r;
  else
    update recipe set name = trim(p_name), batch_yield_base = v_yield, batch_yield_unit = v_unit,
                      prep_instructions = nullif(trim(p_instructions), ''), is_active = coalesce(p_is_active, true),
                      shelf_life_hours = v_keeps
     where id = r.id
    returning * into r;
  end if;
  if v_new or p_lines is not null then
    -- A batch uses the ingredients in force when it is made: a change counts from today.
    v_version := start_recipe_version(r.id, business_local_date(v_business, now()));
    perform write_recipe_lines(v_business, v_version, p_lines, v_item, false);
  end if;
  v_after := jsonb_build_object('name', r.name, 'yield', r.batch_yield_base, 'unit', r.batch_yield_unit,
    'is_active', r.is_active,
    'lines', recipe_lines_json(recipe_version_on(r.id, business_local_date(v_business, now()))));
  -- How long it keeps is on the trail once it has one, or had.
  if v_had_keeps is not null or r.shelf_life_hours is not null then
    v_before := v_before || jsonb_build_object('keeps_hours', v_had_keeps);
    v_after := v_after || jsonb_build_object('keeps_hours', r.shelf_life_hours);
  end if;
  perform audit_event(v_business, case when v_new then 'recipe.batch.create' else 'recipe.batch.change' end,
    'recipe', r.id::text, null, v_before, v_after);
  return jsonb_build_object('recipe_id', r.id, 'item_id', v_item);
end $$;

create or replace function save_batch_recipe(p_recipe uuid, p_name text, p_output jsonb, p_yield numeric,
                                             p_yield_unit text, p_lines jsonb, p_instructions text default null,
                                             p_is_active boolean default true, p_shelf_life_hours int default null,
                                             p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_recipe', p_recipe, 'p_name', p_name, 'p_output', p_output, 'p_yield', p_yield,
                                    'p_yield_unit', p_yield_unit, 'p_lines', p_lines, 'p_instructions', p_instructions,
                                    'p_is_active', p_is_active, 'p_shelf_life_hours', p_shelf_life_hours);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_batch_recipe', v_req);
  if v is not null then return v; end if;
  v := save_batch_recipe__run(p_recipe => p_recipe, p_name => p_name, p_output => p_output, p_yield => p_yield,
                              p_yield_unit => p_yield_unit, p_lines => p_lines, p_instructions => p_instructions,
                              p_is_active => p_is_active, p_shelf_life_hours => p_shelf_life_hours);
  perform idem_finish(v_business, p_idempotency_key, 'save_batch_recipe', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 5. What the screens read
-- ---------------------------------------------------------------------------
drop function if exists production_recipes();
-- 0023's, with the shelf life.
create or replace function production_recipes()
returns table (recipe_id uuid, name text, output_item_id uuid, output_name text, output_unit text, yield_base numeric,
               yield_unit text, instructions text, is_active boolean, lines jsonb, shelf_life_hours int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record', 'recipe.edit', 'cost.view');
  v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    select r.id, r.name, r.output_item_id, i.name, i.base_unit_code, r.batch_yield_base,
           coalesce(r.batch_yield_unit, i.base_unit_code), r.prep_instructions, r.is_active,
           coalesce((select jsonb_agg(jsonb_build_object(
                              'item_id', rl.item_id, 'name', li.name, 'quantity', rl.quantity,
                              'unit_code', rl.unit_code, 'base_qty', to_base_qty(rl.item_id, rl.quantity, rl.unit_code))
                            order by li.name)
                       from recipe_line rl join item li on li.id = rl.item_id
                      where rl.recipe_version_id = recipe_version_on(r.id, v_today)), '[]'::jsonb),
           r.shelf_life_hours
      from recipe r join item i on i.id = r.output_item_id
     where r.business_id = v_business and r.output_item_id is not null
     order by r.is_active desc, r.name;
end $$;

drop function if exists production_batches(int);
-- 0023's, with each batch's number, use-by and what is left of it.
create or replace function production_batches(p_limit int default 50)
returns table (batch_id uuid, recipe_id uuid, recipe_name text, output_item_id uuid, output_name text,
               output_unit text, batches numeric, planned_base numeric, actual_base numeric, entered_unit text,
               status text, produced_at timestamptz, made_by text, note text, cancelled_at timestamptz,
               cancelled_by text, cancel_reason text, value numeric, batch_no bigint, use_by timestamptz,
               left_base numeric, late_reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record', 'cost.view');
  v_costs boolean := current_has_permission('cost.view');
begin
  return query
    select b.id, b.recipe_id, r.name, coalesce(b.output_item_id, r.output_item_id), i.name, i.base_unit_code,
           b.batches, b.planned_yield_base, b.actual_yield_base, coalesce(b.output_unit_code, i.base_unit_code),
           b.status::text, coalesce(b.produced_at, b.created_at), mk.full_name, b.quality_note,
           b.cancelled_at, cx.full_name, b.cancel_reason,
           case when v_costs then b.total_consumed_value end,
           b.batch_no, b.use_by, lot.left_base, b.late_reason
      from production_batch b
      join recipe r on r.id = b.recipe_id
      left join item i on i.id = coalesce(b.output_item_id, r.output_item_id)
      left join item_lot lot on lot.id = b.output_lot_id
      left join app_user mk on mk.id = b.responsible_user
      left join app_user cx on cx.id = b.cancelled_by
     where b.business_id = v_business
     order by coalesce(b.produced_at, b.created_at) desc, b.batch_no desc
     limit greatest(coalesce(p_limit, 50), 1);
end $$;

-- A lot's movements by kind, as the stock card counts them.
create or replace function lot_story(p_lot uuid) returns jsonb
language sql stable set search_path = public as $$
  with k as (
    select stock_card_kind(m.type, m.reference_type, m.base_quantity_signed) as kind, lm.base_qty
      from lot_movement lm join inventory_movement m on m.id = lm.movement_id
     where lm.lot_id = p_lot
  )
  select jsonb_build_object(
    'made', trim_scale(coalesce(sum(base_qty) filter (where kind = 'made'), 0)),
    'sold', trim_scale(coalesce(-sum(base_qty) filter (where kind = 'sold'), 0)),
    'used', trim_scale(coalesce(-sum(base_qty) filter (where kind = 'batches'), 0)),
    'lost', trim_scale(coalesce(-sum(base_qty) filter (where kind = 'wasted'), 0)),
    'counted', trim_scale(coalesce(sum(base_qty) filter (where kind = 'counted'), 0)),
    'moved', trim_scale(coalesce(sum(base_qty) filter (where kind = 'transferred'), 0)),
    'corrected', trim_scale(coalesce(sum(base_qty) filter (where kind not in ('made', 'sold', 'batches', 'wasted',
                                                                             'counted', 'transferred')), 0)),
    'left', trim_scale(coalesce(sum(base_qty), 0)))
  from k
$$;

-- (production.record or cost.view) One batch, made = sold + used in batches +
-- lost ± counted ± moved ± corrected + left, and each movement of its lot.
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
    'story', case when b.output_lot_id is not null then lot_story(b.output_lot_id) end,
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'at', m.occurred_at, 'type', m.type,
               'kind', stock_card_kind(m.type, m.reference_type, m.base_quantity_signed),
               'qty', trim_scale(lm.base_qty), 'reference_type', m.reference_type,
               'reference_id', m.reference_id, 'reason', m.reason,
               'by', (select full_name from app_user where id = m.app_user_id))
             order by m.occurred_at, m.created_at, lm.created_at, lm.id)
        from lot_movement lm join inventory_movement m on m.id = lm.movement_id
       where lm.lot_id = b.output_lot_id), '[]'::jsonb));
end $$;

-- (production.record or cost.view) The lots with stock at a place, the
-- earliest use-by first: past it, due today, due within a day, or good.
create or replace function production_lots(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record', 'cost.view');
  v_loc uuid := resolve_location(v_business, p_location);
  v_tz text := (select timezone from business where id = v_business);
  v_day_end timestamptz := ((business_local_date(v_business, now()) + 1)::timestamp at time zone v_tz);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'lot_id', lot.id, 'lot', lot.lot_code, 'item_id', lot.item_id, 'item', i.name,
             'base_unit', i.base_unit_code, 'batch_id', lot.production_batch_id, 'batch_no', b.batch_no,
             'made_at', lot.received_at, 'use_by', lot.use_by, 'left', trim_scale(lot.left_base),
             'status', case when lot.use_by is null then 'good'
                            when lot.use_by <= now() then 'expired'
                            when lot.use_by <= v_day_end then 'today'
                            when lot.use_by <= now() + interval '24 hours' then 'soon'
                            else 'good' end)
           order by lot.use_by nulls last, lot.created_at)
      from item_lot lot
      join item i on i.id = lot.item_id
      left join production_batch b on b.id = lot.production_batch_id
     where lot.business_id = v_business and lot.location_id = v_loc and lot.left_base > 0), '[]'::jsonb);
end $$;

-- (production.record or cost.view) What to make on a day (today when none is
-- named), for each batch recipe in use:
--
--   demand     what was sold and used in batches of what it makes on the same
--              weekday, over the last 4 to 8 weeks there were (under 4 weeks
--              of history: not enough to judge by), on average;
--   good       what is on hand now, less what is in lots due before the day is
--              out;
--   to make    the demand less what is good, in whole batches;
--   short      each ingredient those batches need beyond what is on hand, for
--              each recipe and for all of them together.
create or replace function production_plan(p_day date default null, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record', 'cost.view');
  v_loc uuid := resolve_location(v_business, p_location);
  v_tz text := (select timezone from business where id = v_business);
  v_day date := coalesce(p_day, business_local_date(v_business, now()));
  v_day_end timestamptz;
  r record; v_out jsonb := '[]'; v_first date; v_history int; v_weeks int; v_days jsonb; v_demand numeric;
  v_on_hand numeric; v_due numeric; v_good numeric; v_make numeric; v_batches numeric; v_status text;
  v_needs jsonb; v_plan_recipes uuid[] := '{}'; v_plan_batches numeric[] := '{}'; v_all jsonb;
begin
  v_day_end := (v_day + 1)::timestamp at time zone v_tz;
  for r in
    select rc.id, rc.name, rc.output_item_id as item_id, i.name as item, i.base_unit_code as unit,
           rc.batch_yield_base as yield, coalesce(rc.batch_yield_unit, i.base_unit_code) as yield_unit
      from recipe rc join item i on i.id = rc.output_item_id
     where rc.business_id = v_business and rc.is_active and rc.output_item_id is not null
       and rc.batch_yield_base > 0
     order by rc.name
  loop
    select business_local_date(v_business, min(m.occurred_at)) into v_first
      from inventory_movement m
     where m.business_id = v_business and m.item_id = r.item_id and m.location_id = v_loc;
    v_history := case when v_first is not null then v_day - v_first end;
    v_weeks := least(8, greatest(coalesce(v_history, 0), 0) / 7);
    v_days := '[]'; v_demand := null;
    if v_weeks >= 4 then
      select jsonb_agg(jsonb_build_object('day', d, 'used', trim_scale(u)) order by d desc), avg(u)
        into v_days, v_demand
        from (select (v_day - 7 * k) as d,
                     coalesce((select -sum(m.base_quantity_signed) from inventory_movement m
                                where m.business_id = v_business and m.item_id = r.item_id and m.location_id = v_loc
                                  and m.occurred_at >= (v_day - 7 * k)::timestamp at time zone v_tz
                                  and m.occurred_at < (v_day - 7 * k + 1)::timestamp at time zone v_tz
                                  and stock_card_kind(m.type, m.reference_type, m.base_quantity_signed)
                                      in ('sold', 'batches')), 0) as u
                from generate_series(1, v_weeks) k) w;
    end if;
    v_on_hand := (item_position(v_business, r.item_id, v_loc)).qty;
    select coalesce(sum(lot.left_base), 0) into v_due
      from item_lot lot
     where lot.business_id = v_business and lot.item_id = r.item_id and lot.location_id = v_loc
       and lot.left_base > 0 and lot.use_by < v_day_end;
    v_good := greatest(v_on_hand - v_due, 0);
    if v_demand is null then
      v_status := 'no_history'; v_make := null; v_batches := 0;
    else
      v_make := greatest(v_demand - v_good, 0);
      v_batches := case when v_make > 0 then ceil(v_make / r.yield) else 0 end;
      v_status := case when v_batches > 0 then 'make' else 'enough' end;
    end if;
    v_needs := '[]';
    if v_batches > 0 then
      v_plan_recipes := v_plan_recipes || r.id;
      v_plan_batches := v_plan_batches || v_batches;
      select coalesce(jsonb_agg(jsonb_build_object(
               'item_id', n.item_id, 'item', i.name, 'base_unit', i.base_unit_code,
               'needed', trim_scale(n.qty), 'on_hand', trim_scale(n.on_hand),
               'short', trim_scale(greatest(n.qty - greatest(n.on_hand, 0), 0))) order by i.name), '[]'::jsonb)
        into v_needs
        from (select e.item_id, sum(e.base_qty) as qty, (item_position(v_business, e.item_id, v_loc)).qty as on_hand
                from expand_recipe(r.id, 'dine_in', v_batches, v_day) e group by e.item_id) n
        join item i on i.id = n.item_id;
    end if;
    v_out := v_out || jsonb_build_object(
      'recipe_id', r.id, 'recipe', r.name, 'item_id', r.item_id, 'item', r.item, 'base_unit', r.unit,
      'batch_yield', trim_scale(r.yield), 'yield_unit', r.yield_unit, 'status', v_status,
      'history_days', v_history, 'weeks', case when v_weeks >= 4 then v_weeks end, 'days', v_days,
      'demand', trim_scale(round(v_demand, 3)), 'on_hand', trim_scale(v_on_hand), 'due', trim_scale(v_due),
      'good', trim_scale(v_good), 'to_make', trim_scale(round(v_make, 3)), 'batches', v_batches,
      'makes', trim_scale(v_batches * r.yield), 'ingredients', v_needs);
  end loop;
  -- All the batches to make together: what each ingredient is short of.
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', n.item_id, 'item', i.name, 'base_unit', i.base_unit_code,
           'needed', trim_scale(n.qty), 'on_hand', trim_scale(n.on_hand),
           'short', trim_scale(greatest(n.qty - greatest(n.on_hand, 0), 0))) order by i.name), '[]'::jsonb)
    into v_all
    from (select e.item_id, sum(e.base_qty) as qty, (item_position(v_business, e.item_id, v_loc)).qty as on_hand
            from unnest(v_plan_recipes, v_plan_batches) p(recipe_id, batches),
                 lateral expand_recipe(p.recipe_id, 'dine_in', p.batches, v_day) e
           group by e.item_id) n
    join item i on i.id = n.item_id;
  return jsonb_build_object('day', v_day, 'weekday', extract(isodow from v_day)::int,
                            'location_id', v_loc, 'location', (select name from location where id = v_loc),
                            'recipes', v_out, 'ingredients', v_all);
end $$;

-- (cost.view) Reports → Production: the batches made in the dates, each with
-- what it was to make and what came out, and what became of it, by lot.
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
               'story', case when b.output_lot_id is not null then lot_story(b.output_lot_id) end)
             order by b.batch_no)
        from production_batch b join recipe r on r.id = b.recipe_id
        left join item i on i.id = coalesce(b.output_item_id, r.output_item_id)
       where b.business_id = v_business
         and business_local_date(v_business, coalesce(b.produced_at, b.created_at)) between p_from and p_to),
      '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 6. Stock past or near its use-by is an alert
-- ---------------------------------------------------------------------------
-- 0045's rules stay as they are. A lot with stock left due within a day:
-- orange, to go out first; past its use-by: red, to be recorded as expired.
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0045;
revoke execute on function alert_conditions_0045(uuid, timestamptz) from public, anon, authenticated;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0045(p_business, p_now) c
  union all
  select 'use_by'::text, lot.id::text,
         case when lot.use_by <= p_now then 'red' else 'orange' end,
         case when lot.use_by <= p_now
              then format('%s, batch %s, is past its use-by: %s %s left', i.name,
                          coalesce(b.batch_no::text, lot.lot_code), alert_qty(lot.left_base), i.base_unit_code)
              else format('%s, batch %s, is to be used by %s: %s %s left', i.name,
                          coalesce(b.batch_no::text, lot.lot_code),
                          to_char(lot.use_by at time zone bz.timezone, 'DD Mon HH24:MI'), alert_qty(lot.left_base),
                          i.base_unit_code) end,
         case when lot.use_by <= p_now
              then 'Past its use-by it is not to be sold: what is left is a loss.'
              else 'What is not used by then is lost.' end,
         case when lot.use_by <= p_now
              then 'Record what is left as expired on Inventory, or change its use-by if it was set wrong.'
              else 'Put it out before newer batches: sales take it first.' end,
         'high', '/production#lots',
         jsonb_build_object('lot_id', lot.id, 'batch_id', b.id, 'batch_no', b.batch_no, 'item_id', i.id,
                            'use_by', lot.use_by, 'left', lot.left_base)
    from item_lot lot
    join item i on i.id = lot.item_id
    join business bz on bz.id = lot.business_id
    left join production_batch b on b.id = lot.production_batch_id
   where lot.business_id = p_business and lot.left_base > 0 and lot.use_by <= p_now + interval '24 hours'
$$;

-- ---------------------------------------------------------------------------
-- 7. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  lot_left(uuid), put_lot_row(uuid, uuid, uuid, uuid, uuid, numeric), start_lot_tracking(uuid, text),
  lot_sources(inventory_movement), allocate_lots(inventory_movement), trg_movement_lots(), lot_story(uuid),
  alert_conditions(uuid, timestamptz), void_sale__run(uuid, text, text, uuid), review_loss__run(uuid, text, text),
  record_production__run(uuid, numeric, numeric, text, text, uuid, uuid, timestamptz, timestamptz, text),
  cancel_production__run(uuid, text), set_batch_use_by__run(uuid, timestamptz, text),
  save_batch_recipe__run(uuid, text, jsonb, numeric, text, jsonb, text, boolean, int)
  from public, anon, authenticated;
revoke execute on function
  record_production(uuid, numeric, numeric, text, text, uuid, uuid, timestamptz, timestamptz, text, uuid),
  set_batch_use_by(uuid, timestamptz, text, uuid),
  save_batch_recipe(uuid, text, jsonb, numeric, text, jsonb, text, boolean, int, uuid),
  production_recipes(), production_batches(int), batch_reconciliation(uuid), production_lots(uuid),
  production_plan(date, uuid), report_production(date, date)
  from public, anon;
grant execute on function
  record_production(uuid, numeric, numeric, text, text, uuid, uuid, timestamptz, timestamptz, text, uuid),
  set_batch_use_by(uuid, timestamptz, text, uuid),
  save_batch_recipe(uuid, text, jsonb, numeric, text, jsonb, text, boolean, int, uuid),
  production_recipes(), production_batches(int), batch_reconciliation(uuid), production_lots(uuid),
  production_plan(date, uuid), report_production(date, date)
  to authenticated;
