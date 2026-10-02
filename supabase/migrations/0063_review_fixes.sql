-- =============================================================================
-- 0063 — What a review of the releases since 0035 found, put right (1 of 4)
-- =============================================================================
-- Five reviews, one for each part of what 0035 to 0057 built, each finding
-- checked against the code before it was put right. 0063 to 0066 put right
-- what they found, each small enough to apply in one call; this one:
--
--  * Counts (0024, 0046, 0048): a batch recorded with a time before one of its
--    items was counted, and a loss reversed after its item was counted, were
--    in that count already: posted again, the stock doubled.
--  * Places (0055): receiving a transfer as "nothing arrived", approving a
--    loss or correcting a delivery moved no stock, so nothing checked where
--    the person works; and the drawer could be handed to someone who works
--    elsewhere. (A credit on a delivery checks it in 0065.)
--  * Stock below zero (0040, 0044, 0054): a transfer or a return took an item
--    whose rule wants a manager's approval below zero on a confirmation alone.
-- No table changes, and nothing recorded changes.

-- =============================================================================
-- 1. What a count has seen is not posted again
-- =============================================================================
-- A count line's expected stock is what the books held when it was counted
-- (0024), and its approval posts what was found less that. A batch recorded
-- with a time before one of its items was counted, in a count still open or
-- approved, is in that count already. 0046 refused it only for a batch more
-- than an hour late, against approved counts; any batch given its time now.
alter function record_production__run(uuid, numeric, numeric, text, text, uuid, uuid, timestamptz, timestamptz, text)
  rename to record_production__run_0046;
create function record_production__run(
  p_recipe uuid, p_batches numeric, p_output_qty numeric, p_output_unit text, p_note text, p_location uuid,
  p_stock_approval uuid, p_produced_at timestamptz, p_use_by timestamptz, p_late_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_item text;
begin
  v := record_production__run_0046(p_recipe, p_batches, p_output_qty, p_output_unit, p_note, p_location,
                                   p_stock_approval, p_produced_at, p_use_by, p_late_reason);
  if p_produced_at is not null then
    select i.name into v_item
      from inventory_movement mv
      join stock_count_line cl on cl.item_id = mv.item_id and cl.counted_at > mv.occurred_at
      join stock_count c on c.id = cl.stock_count_id and c.location_id = mv.location_id
                         and c.status in ('counting', 'submitted', 'approved')
      join item i on i.id = mv.item_id
     where mv.reference_type = 'production_batch' and mv.reference_id = (v ->> 'batch_id')::uuid
     order by i.name
     limit 1;
    if v_item is not null then
      raise exception '% was counted after that time: a batch made before the count is in it already, and is not recorded now',
        v_item;
    end if;
  end if;
  return v;
end $$;

-- A loss waiting for approval is looked at by someone who works at its place
-- (0055); and one whose item was counted since it was recorded is put right
-- by that count, so it is not reversed: approved, the books stand as counted.
alter function review_loss__run(uuid, text, text) rename to review_loss__run_0048;
create function review_loss__run(p_movement uuid, p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m inventory_movement; v_item text;
begin
  select * into m from inventory_movement where id = p_movement and business_id = current_business_id();
  if found and m.approval_status = 'pending' then
    perform assert_works_at(m.location_id);
    if p_decision = 'reverse' then
      select i.name into v_item
        from inventory_movement o
        join stock_count_line cl on cl.item_id = o.item_id and cl.counted_at > o.occurred_at
        join stock_count c on c.id = cl.stock_count_id and c.location_id = o.location_id
                           and c.status in ('counting', 'submitted', 'approved')
        join item i on i.id = o.item_id
       where o.id = m.id
          or (m.reference_type = 'stock_loss' and o.reference_type = 'stock_loss' and o.reference_id = m.reference_id)
       order by i.name
       limit 1;
      if v_item is not null then
        raise exception '% was counted since the loss, and the count put its stock right: approve the loss instead',
          v_item;
      end if;
    end if;
  end if;
  return review_loss__run_0048(p_movement, p_decision, p_reason);
end $$;

-- =============================================================================
-- 2. Each place's work by those who work there
-- =============================================================================
-- 0055 checks a stock movement against where the person works. These move
-- none in some cases (a transfer received as "nothing arrived", a delivery's
-- supplier or price corrected), so they check it themselves.
alter function receive_stock_transfer__run(uuid, jsonb, text) rename to receive_stock_transfer__run_0054;
create function receive_stock_transfer__run(p_transfer uuid, p_lines jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform assert_works_at((select to_location_id from stock_transfer
                            where id = p_transfer and business_id = current_business_id()));
  return receive_stock_transfer__run_0054(p_transfer, p_lines, p_note);
end $$;

alter function correct_receipt__run(uuid, jsonb, uuid, date, text, boolean, boolean) rename to correct_receipt__run_0044;
create function correct_receipt__run(p_receipt uuid, p_lines jsonb, p_supplier uuid, p_received_on date,
                                     p_reason text, p_confirm boolean, p_reverse boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform assert_works_at((select location_id from goods_receipt
                            where id = p_receipt and business_id = current_business_id()));
  return correct_receipt__run_0044(p_receipt, p_lines, p_supplier, p_received_on, p_reason, p_confirm, p_reverse);
end $$;

-- 0043's hand-over, to someone who works at the drawer's place.

create or replace function hand_over_session(p_counted numeric, p_to uuid, p_denominations jsonb default null,
                                             p_left_in_drawer numeric default null, p_take_to text default null,
                                             p_location uuid default null, p_usd_counted numeric default null,
                                             p_usd_denominations jsonb default null,
                                             p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cash.session');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('p_counted', p_counted, 'p_to', p_to, 'p_denominations', p_denominations,
                                    'p_left_in_drawer', p_left_in_drawer, 'p_take_to', p_take_to,
                                    'p_location', p_location)
                 || jsonb_strip_nulls(jsonb_build_object('p_usd_counted', p_usd_counted,
                                                         'p_usd_denominations', p_usd_denominations));
  v jsonb; v_next jsonb; v_location uuid; v_session uuid; s work_shift; a app_user;
begin
  v := idem_begin(v_business, p_idempotency_key, 'hand_over_session', v_req);
  if v is not null then return v; end if;
  if p_counted is null then raise exception 'Enter the cash you counted'; end if;
  v_location := resolve_location(v_business, p_location);
  perform 1 from cash_drawer where location_id = v_location and business_id = v_business and is_active for update;
  v_session := open_session_at(v_business, v_location);
  select * into s from work_shift where id = v_session;
  if not found then raise exception 'The drawer is not open'; end if;
  if s.cashier_id <> v_me and not current_has_permission('cash.session.force') then
    raise exception 'Only % or a manager closes this session', (select full_name from app_user where id = s.cashier_id)
      using errcode = '42501';
  end if;
  select * into a from app_user where id = p_to and business_id = v_business and is_active;
  if not found or not member_has_permission(a.id, 'cash.session') then
    raise exception 'Choose someone who may take the drawer';
  end if;
  -- Someone who works at another place would hold a drawer they cannot close here (0063).
  if member_place(a.id) is not null and member_place(a.id) <> v_location then
    raise exception '% works at %, not here: choose someone who works here', a.full_name,
      (select name from location where id = member_place(a.id));
  end if;
  if a.id = s.cashier_id then raise exception 'Hand the drawer to someone else'; end if;
  v := close_session_internal(v_business, v_session, v_me, p_counted, p_denominations, p_left_in_drawer, p_take_to, null);
  v := v || close_session_dollars(v_business, v_session, v_me, p_usd_counted, p_usd_denominations);
  v_next := open_session_internal(v_business, v_location, a.id, v_me, (v ->> 'left')::numeric, null, v_session);
  v := v || jsonb_build_object('next_session_id', v_next -> 'session_id', 'next_session_no', v_next -> 'session_no',
                               'next_cashier', a.full_name);
  perform audit_event(v_business, 'cash.session.hand_over', 'work_shift', v_session::text, null, null,
    jsonb_build_object('session_no', v -> 'session_no', 'expected', v -> 'expected', 'counted', v -> 'counted',
                       'variance', v -> 'variance', 'left', v -> 'left', 'taken', v -> 'taken',
                       'taken_to', v -> 'taken_to', 'next_session_no', v -> 'next_session_no',
                       'next_cashier', a.id, 'notes', p_denominations)
    || jsonb_strip_nulls(jsonb_build_object('usd_expected', v -> 'usd_expected', 'usd_counted', v -> 'usd_counted',
                                            'usd_variance', v -> 'usd_variance', 'usd_carried', v -> 'usd_carried',
                                            'usd_notes', p_usd_denominations)));
  perform idem_finish(v_business, p_idempotency_key, 'hand_over_session', v_req, v);
  return v;
end $$;

-- 0043's drawer status: those offered to take the drawer work here.

create or replace function cash_session_status(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'cash.session', 'day.close', 'cash.view_expected');
  v_me uuid := (current_member()).id;
  v_location uuid := resolve_location(v_business, p_location);
  v_see boolean := current_has_permission('cash.view_expected');
  v_force boolean := current_has_permission('cash.session.force');
  v_may boolean := current_has_permission('cash.session');
  dr cash_drawer; s work_shift; f record; v_expected numeric; v_figures jsonb; h record;
begin
  select * into dr from cash_drawer where location_id = v_location and business_id = v_business and is_active;
  select * into s from work_shift where drawer_id = dr.id and kind = 'session' and closed_at is null;
  if s.id is not null and v_see then
    f := session_figures(s.id);
    v_expected := s.opening_counted + f.moved;
    v_figures := to_jsonb(f);
  end if;
  h := fx_place_balance(v_business, 'till', v_location);
  return jsonb_build_object(
    'location_id', v_location, 'location', (select name from location where id = v_location),
    'drawer_id', dr.id, 'drawer', dr.name,
    'open', s.id is not null,
    'session', case when s.id is not null then jsonb_build_object(
        'id', s.id, 'no', s.session_no, 'cashier_id', s.cashier_id,
        'cashier', (select full_name from app_user where id = s.cashier_id),
        'opened_at', s.opened_at, 'opened_by', (select full_name from app_user where id = s.opened_by),
        'mine', s.cashier_id = v_me) end,
    'may_open', v_may and dr.id is not null,
    'may_close', v_may and s.id is not null and (s.cashier_id = v_me or v_force),
    'may_force', v_force,
    'may_add_float', current_has_permission('day.close') or current_has_permission('accounting.post'),
    'sees_expected', v_see,
    'expected', v_expected,
    'figures', v_figures,
    -- The dollars in the till (0043): whether it holds any, to count at the
    -- close; how many and their value only for those who may see it.
    'dollars', jsonb_build_object('in_till', h.usd <> 0 or h.value <> 0,
                                  'usd', case when v_see then h.usd end, 'value', case when v_see then h.value end),
    'open_bills', (select count(*) from pos_tab
                    where business_id = v_business and location_id = v_location and status = 'open'),
    'takers', (select coalesce(jsonb_agg(jsonb_build_object('id', au.id, 'name', au.full_name) order by au.full_name),
                               '[]'::jsonb)
                 from app_user au
                where au.business_id = v_business and au.is_active and member_has_permission(au.id, 'cash.session')
                  and (member_place(au.id) is null or member_place(au.id) = v_location)
                  and au.id is distinct from s.cashier_id));
end $$;

-- =============================================================================
-- 3. Stock below zero by a transfer or a return: a manager approves it
-- =============================================================================
-- 0040's rule for an item may refuse stock below zero, allow it, or want a
-- manager's approval. A sale asks for it (stock_rules); a transfer and a
-- return refused 'block' and let everything else through on a confirmation.
-- Now an item whose rule wants approval is sent or returned below zero only by
-- someone who may approve it, and it is on the audit trail as stock_rules
-- puts it.
alter function send_stock_transfer__run(uuid, uuid, jsonb, text, boolean) rename to send_stock_transfer__run_0054;
create function send_stock_transfer__run(p_from uuid, p_to uuid, p_lines jsonb, p_note text, p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; t stock_transfer; v_names text;
begin
  v := send_stock_transfer__run_0054(p_from, p_to, p_lines, p_note, p_confirm);
  select * into t from stock_transfer where id = (v ->> 'transfer_id')::uuid;
  select string_agg(i.name, ', ' order by i.name) into v_names
    from item i
   where i.id in (select l.item_id from stock_transfer_line l where l.transfer_id = t.id)
     and rule_value(t.business_id, 'negative_stock', i.id) #>> '{}' = 'approve'
     and (item_position(t.business_id, i.id, t.from_location_id)).qty < 0;
  if v_names is not null then
    if not current_has_permission(approval_permission('negative_stock')) then
      raise exception 'This leaves % below zero, which a manager approves: ask one to send it', v_names;
    end if;
    perform audit_event(t.business_id, 'stock.below_zero', 'stock_transfer', t.id::text, null, null,
      jsonb_build_object('items', v_names, 'approved_by', (current_member()).id));
  end if;
  return v;
end $$;

alter function return_to_supplier__run(uuid, jsonb, text, uuid, uuid, boolean) rename to return_to_supplier__run_0044;
create function return_to_supplier__run(p_supplier uuid, p_lines jsonb, p_reason text, p_receipt uuid,
                                        p_location uuid, p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; s supplier_return; v_names text;
begin
  v := return_to_supplier__run_0044(p_supplier, p_lines, p_reason, p_receipt, p_location, p_confirm);
  select * into s from supplier_return where id = (v ->> 'return_id')::uuid;
  select string_agg(i.name, ', ' order by i.name) into v_names
    from item i
   where i.id in (select l.item_id from supplier_return_line l where l.supplier_return_id = s.id)
     and rule_value(s.business_id, 'negative_stock', i.id) #>> '{}' = 'approve'
     and (item_position(s.business_id, i.id, s.location_id)).qty < 0;
  if v_names is not null then
    if not current_has_permission(approval_permission('negative_stock')) then
      raise exception 'This leaves % below zero, which a manager approves: ask one to return it', v_names;
    end if;
    perform audit_event(s.business_id, 'stock.below_zero', 'supplier_return', s.id::text, null, null,
      jsonb_build_object('items', v_names, 'approved_by', (current_member()).id));
  end if;
  return v;
end $$;

-- =============================================================================
-- 4. Who may call what
-- =============================================================================
-- The work behind each keyed write, and the helpers, are called inside the
-- database only; the old versions kept their closed doors when renamed.
revoke execute on function
  record_production__run(uuid, numeric, numeric, text, text, uuid, uuid, timestamptz, timestamptz, text),
  review_loss__run(uuid, text, text),
  receive_stock_transfer__run(uuid, jsonb, text),
  correct_receipt__run(uuid, jsonb, uuid, date, text, boolean, boolean),
  send_stock_transfer__run(uuid, uuid, jsonb, text, boolean),
  return_to_supplier__run(uuid, jsonb, text, uuid, uuid, boolean)
  from public, anon, authenticated;
