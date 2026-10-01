-- =============================================================================
-- 0063 — What a review of the releases since 0035 found, put right
-- =============================================================================
-- Five reviews, one for each part of what 0035 to 0057 built, each finding
-- checked against the code before it was put right here:
--
--  * Counts (0024, 0046, 0048): a batch recorded with a time before one of its
--    items was counted, and a loss reversed after its item was counted, were
--    in that count already: posted again, the stock doubled.
--  * Places (0055): receiving a transfer as "nothing arrived", approving a
--    loss, correcting a delivery or recording a credit on it moved no stock,
--    so nothing checked where the person works; and the drawer could be
--    handed to someone who works elsewhere.
--  * Stock below zero (0040, 0044, 0054): a transfer or a return took an item
--    whose rule wants a manager's approval below zero on a confirmation alone.
--  * Payroll (0049): reopened in a later month, a payroll's cost moved into
--    that month; a cancelled payment left the month's payroll undraftable; and
--    the journals of salaries paid and advances given named the people, read
--    by everyone who sees costs.
--  * Purchases (0038, 0044, 0049): a delivery's share still on the shelf
--    forgot what was used before a correction, and counted what went back as
--    used; a bill dated before its delivery put goods received not invoiced
--    below nothing for those days; a supplier settled by a credit could not be
--    taken out of use; an order whose delivery was reversed could not be
--    cancelled.
--  * The till (0024, 0055): an expense from the till or the safe dated an
--    earlier day put that day's drawer or safe out for good.
--  * Reports (0057): the café's staff cost counted the year-end close.
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
-- supplier or price corrected, a credit on it), so they check it themselves.
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
-- 4. Payroll
-- =============================================================================
-- 0049's reopen, reversing the approval in its own month: reopened later, the
-- cost went out of the month it was reopened in and stayed in its own. A
-- locked month now refuses the reopen as it refuses the approval.

create or replace function reopen_payroll__run(p_run uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  r payroll_run; a payroll_approval; v_rev uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the payroll is reopened'; end if;
  select * into r from payroll_run where id = p_run and business_id = v_business for update;
  if not found then raise exception 'Payroll not found'; end if;
  if r.status = 'draft' then raise exception 'This payroll is a draft already'; end if;
  if exists (select 1 from salary_payment p where p.run_id = r.id and p.cancelled_at is null) then
    raise exception 'Salaries were paid from this payroll: cancel the payments first';
  end if;
  select * into a from payroll_approval where run_id = r.id and reopened_at is null for update;
  if a.journal_entry_id is not null then
    -- In the month the approval was posted in: reopened later, the cost stayed
    -- there and went out of the month it was reopened in (0063).
    v_rev := reverse_entry_internal(a.journal_entry_id,
                                    (select occurred_at from journal_entry where id = a.journal_entry_id),
                                    'Payroll reopened: ' || trim(p_reason));
  end if;
  update payroll_approval set reopened_by = v_me, reopened_at = now(), reopen_reason = trim(p_reason),
                              reopen_journal_id = v_rev
   where id = a.id;
  update payroll_run set status = 'draft', approved_by = null, approved_at = null, journal_entry_id = null
   where id = r.id;
  return jsonb_build_object('run_id', r.id, 'run_no', r.run_no, 'month', r.month, 'was', r.status,
                            'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- 0049's draft, keeping a line once paid from: a payment cancelled is kept for
-- good, and its lines point at the payroll's line, so deleting it failed and
-- the month could not be drafted again.

create or replace function payroll_refresh(p_business uuid, p_run uuid) returns void
language plpgsql set search_path = public as $$
declare
  r payroll_run; e employee; f record; l payroll_line; v_start date; v_end date; v_owed numeric; v_gross numeric;
  v_recover numeric; v_ded numeric;
begin
  select * into r from payroll_run where id = p_run;
  v_start := r.month;
  v_end := (r.month + interval '1 month - 1 day')::date;
  -- Someone not employed that month leaves the payroll. A line paid from once
  -- (a payment since cancelled, which is kept for good) stays, at nothing (0063).
  update payroll_line x
     set base_pay = 0, overtime_pay = 0, additions = 0, deductions = 0, advance_owed = 0, advance_recovered = 0,
         recovery_set = false, gross = 0, net = 0, days_employed = 0, days_worked = 0, minutes_worked = 0,
         overtime_minutes = 0, days_scheduled = 0, days_absent = 0, times_late = 0, minutes_late = 0,
         still_in = false
   where x.run_id = r.id
     and not exists (select 1 from employee y where y.id = x.employee_id and y.hired_on <= v_end
                       and (y.left_on is null or y.left_on >= v_start))
     and exists (select 1 from salary_payment_line pl where pl.line_id = x.id);
  delete from payroll_line x where x.run_id = r.id
     and not exists (select 1 from employee y where y.id = x.employee_id and y.hired_on <= v_end
                       and (y.left_on is null or y.left_on >= v_start))
     and not exists (select 1 from salary_payment_line pl where pl.line_id = x.id);
  for e in select * from employee y where y.business_id = p_business and y.hired_on <= v_end
                                     and (y.left_on is null or y.left_on >= v_start)
            order by y.full_name loop
    select * into f from payroll_figures(p_business, e, r.month);
    select * into l from payroll_line x where x.run_id = r.id and x.employee_id = e.id;
    v_owed := advance_owed(p_business, e.id);
    -- Deductions beyond what is now earned are cut to it.
    v_ded := least(coalesce(l.deductions, 0), f.base_pay + f.overtime_pay + coalesce(l.additions, 0));
    v_gross := f.base_pay + f.overtime_pay + coalesce(l.additions, 0) - v_ded;
    v_recover := case when coalesce(l.recovery_set, false) then least(l.advance_recovered, greatest(v_owed, 0), v_gross)
                      else least(greatest(v_owed, 0), v_gross) end;
    if l.id is null then
      insert into payroll_line (run_id, business_id, employee_id, pay_basis, rate, standard_hours, overtime_percent,
                                days_in_month, days_employed, days_worked, minutes_worked, overtime_minutes,
                                days_scheduled, days_absent, times_late, minutes_late, still_in, base_pay, overtime_pay,
                                advance_owed, advance_recovered, gross, net)
      values (r.id, p_business, e.id, e.pay_basis, e.rate, e.standard_hours, f.overtime_percent,
              f.days_in_month, f.days_employed, f.days_worked, f.minutes_worked, f.overtime_minutes,
              f.days_scheduled, f.days_absent, f.times_late, f.minutes_late, f.still_in, f.base_pay, f.overtime_pay,
              v_owed, v_recover, v_gross, v_gross - v_recover);
    else
      update payroll_line set pay_basis = e.pay_basis, rate = e.rate, standard_hours = e.standard_hours,
             overtime_percent = f.overtime_percent, days_in_month = f.days_in_month,
             days_employed = f.days_employed, days_worked = f.days_worked, minutes_worked = f.minutes_worked,
             overtime_minutes = f.overtime_minutes, days_scheduled = f.days_scheduled, days_absent = f.days_absent,
             times_late = f.times_late, minutes_late = f.minutes_late, still_in = f.still_in,
             base_pay = f.base_pay, overtime_pay = f.overtime_pay,
             deductions = v_ded,
             advance_owed = v_owed, advance_recovered = v_recover, gross = v_gross, net = v_gross - v_recover
       where id = l.id;
    end if;
  end loop;
  update payroll_run set drafted_at = now(), drafted_by = (current_member()).id where id = r.id;
end $$;

-- 0049's check that a draft is as the records stand, with such a line in it.

create or replace function payroll_current(p_business uuid, p_run uuid) returns boolean
language plpgsql stable set search_path = public as $$
declare r payroll_run; e employee; f record; l payroll_line; v_start date; v_end date;
begin
  select * into r from payroll_run where id = p_run;
  v_start := r.month;
  v_end := (r.month + interval '1 month - 1 day')::date;
  if exists (select 1 from payroll_line x join employee y on y.id = x.employee_id
              where x.run_id = r.id and not (y.hired_on <= v_end and (y.left_on is null or y.left_on >= v_start))
                -- A line paid from once, kept at nothing, is as it should be (0063).
                and not (x.gross = 0 and x.net = 0 and x.advance_recovered = 0
                         and exists (select 1 from salary_payment_line pl where pl.line_id = x.id))) then
    return false;
  end if;
  for e in select * from employee y where y.business_id = p_business and y.hired_on <= v_end
                                     and (y.left_on is null or y.left_on >= v_start) loop
    select * into l from payroll_line x where x.run_id = r.id and x.employee_id = e.id;
    if l.id is null then return false; end if;
    select * into f from payroll_figures(p_business, e, r.month);
    if (l.pay_basis, l.rate, l.standard_hours, l.overtime_percent, l.days_employed, l.days_worked, l.minutes_worked,
        l.overtime_minutes, l.still_in, l.base_pay, l.overtime_pay)
       is distinct from (e.pay_basis, e.rate, e.standard_hours, f.overtime_percent, f.days_employed, f.days_worked,
                         f.minutes_worked, f.overtime_minutes, f.still_in, f.base_pay, f.overtime_pay) then
      return false;
    end if;
    if l.advance_recovered > greatest(advance_owed(p_business, e.id), 0)
       or (not l.recovery_set and l.advance_recovered <> least(greatest(advance_owed(p_business, e.id), 0), l.gross)) then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- 0049's payment and 0055's advance, their journals no longer naming anyone:
-- the journals are read by those who see costs, pay by those who see payroll.

create or replace function pay_salaries(p_business uuid, r payroll_run, p_lines jsonb, p_from text, p_me uuid)
returns uuid language plpgsql set search_path = public as $$
declare
  v_id uuid := gen_random_uuid(); v_total numeric; v_loc uuid := resolve_location(p_business, null); v_journal uuid;
begin
  select coalesce(sum((x ->> 'amount')::numeric), 0) into v_total from jsonb_array_elements(p_lines) x;
  -- Named by its payroll, not by whom it pays: the journals are read by those
  -- who see costs, and pay is for those who see payroll (0063).
  v_journal := post_journal(p_business, now(),
    'Salaries ' || payroll_month_text(r.month) || ' (payroll ' || r.run_no || ')', 'salary_payment', v_id,
    jsonb_build_array(jsonb_build_object('code', '2100', 'debit', v_total),
                      jsonb_build_object('code', payment_account(p_from), 'credit', v_total)));
  insert into salary_payment (id, business_id, run_id, paid_from, location_id, amount, paid_on, journal_entry_id,
                              created_by)
  values (v_id, p_business, r.id, p_from, v_loc, v_total, business_local_date(p_business, now()), v_journal, p_me);
  insert into salary_payment_line (payment_id, business_id, line_id, employee_id, amount)
  select v_id, p_business, l.id, l.employee_id, (x ->> 'amount')::numeric
    from jsonb_array_elements(p_lines) x join payroll_line l on l.id = (x ->> 'line_id')::uuid;
  perform pay_out_of(p_business, v_loc, p_from, v_total, 'salary_payment', v_id, p_me);
  -- Paid in full, the payroll is paid.
  if not exists (select 1 from payroll_line l where l.run_id = r.id and l.net > payroll_line_paid(l.id)) then
    update payroll_run set status = 'paid' where id = r.id;
  end if;
  return v_id;
end $$;

create or replace function record_advance__run(p_employee uuid, p_amount numeric, p_paid_from text, p_reason text,
                                               p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  v_from text := staff_paid_from(p_paid_from);
  v_amount numeric := money_round(v_business, p_amount);
  v_today date := business_local_date(v_business, now());
  e employee; v_id uuid := gen_random_uuid(); v_journal uuid; v_loc uuid;
begin
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say what the advance is for'; end if;
  e := staff_member(v_business, p_employee, true);
  if not works_on(e, v_today) then raise exception '% does not work here on %', e.full_name, v_today; end if;
  v_loc := resolve_location(v_business, p_location);
  -- Not named, nor why: an advance is for those who see payroll (0063).
  v_journal := post_journal(v_business, now(), 'Advance on pay',
    'employee_advance', v_id,
    jsonb_build_array(jsonb_build_object('code', '1300', 'debit', v_amount),
                      jsonb_build_object('code', payment_account(v_from), 'credit', v_amount)));
  insert into employee_advance (id, business_id, employee_id, amount, paid_from, location_id, reason, given_on,
                                journal_entry_id, created_by)
  values (v_id, v_business, e.id, v_amount, v_from, v_loc, trim(p_reason), v_today, v_journal, v_me);
  perform pay_out_of(v_business, v_loc, v_from, v_amount, 'employee_advance', v_id, v_me);
  return jsonb_build_object('advance_id', v_id, 'employee_id', e.id, 'name', e.full_name, 'amount', v_amount,
                            'paid_from', v_from, 'owed', advance_owed(v_business, e.id),
                            'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- =============================================================================
-- 5. Purchases
-- =============================================================================
-- 0038's share of a delivery still on the shelf, from where its units first
-- came in: a correction's top-up started it again at all of it, forgetting
-- what was used before; and what went back to the supplier, from it or from
-- another delivery, was counted as used. Its own corrections and returns
-- change the delivery, not the share; another delivery's change neither.

create or replace function receipt_share_on_hand(p_business uuid, p_receipt uuid, p_item uuid, p_location uuid)
returns numeric language plpgsql stable set search_path = public as $$
declare k record; m record; v_s numeric; v_mine numeric; v_size numeric;
begin
  -- Where the delivery's units of the item first came in.
  select mv.occurred_at, mv.created_at, mv.id, mv.base_quantity_signed as q into k
    from inventory_movement mv
   where mv.business_id = p_business and mv.item_id = p_item and mv.location_id = p_location
     and mv.base_quantity_signed > 0
     and ((mv.reference_type = 'goods_receipt' and mv.reference_id = p_receipt)
          or (mv.reference_type = 'receipt_correction'
              and mv.reference_id in (select c.id from receipt_correction c where c.goods_receipt_id = p_receipt)
              and mv.type::text = 'receipt_correction'))
   order by mv.occurred_at, mv.created_at, mv.id
   limit 1;
  if not found then return 1; end if;
  v_mine := k.q; v_size := k.q;
  select coalesce(sum(base_quantity_signed), 0) into v_s
    from inventory_movement
   where business_id = p_business and item_id = p_item and location_id = p_location
     and (occurred_at, created_at, id) <= (k.occurred_at, k.created_at, k.id);
  for m in
    select mv.base_quantity_signed as q, mv.type::text as t,
           (mv.reference_type = 'goods_receipt' and mv.reference_id = p_receipt)
           or (mv.reference_type = 'receipt_correction' and mv.type::text = 'receipt_correction'
               and mv.reference_id in (select c.id from receipt_correction c where c.goods_receipt_id = p_receipt))
           or (mv.reference_type = 'supplier_return'
               and mv.reference_id in (select sr.id from supplier_return sr where sr.goods_receipt_id = p_receipt))
             as own,
           mv.reference_type = 'supplier_return'
             and mv.reference_id in (select sr.id from supplier_return sr
                                      where sr.goods_receipt_id is not null and sr.goods_receipt_id <> p_receipt)
             as other
      from inventory_movement mv
     where mv.business_id = p_business and mv.item_id = p_item and mv.location_id = p_location
       and (mv.occurred_at, mv.created_at, mv.id) > (k.occurred_at, k.created_at, k.id)
     order by mv.occurred_at, mv.created_at, mv.id
  loop
    if m.own then
      -- The delivery itself changed: corrected, or some of it sent back. Its
      -- units on the shelf and its size change with it; nothing was used.
      v_mine := greatest(v_mine + m.q, 0);
      v_size := v_size + m.q;
    elsif m.q < 0 and m.t not in ('cost_adjustment', 'receipt_correction') and not m.other then
      -- A use takes its share of every unit on the shelf. Another delivery's
      -- units sent back were that delivery's, as its corrections are.
      v_mine := case when v_s <= 0 then 0 else v_mine * greatest(0, (v_s + m.q) / v_s) end;
    end if;
    v_s := v_s + m.q;
  end loop;
  return case when v_size <= 0 then 0 else least(greatest(v_mine / v_size, 0), 1) end;
end $$;

-- 0049's supplier credit: checked against where the person works, and shared
-- over what of the delivery stayed (what went back is taken off each item).

create or replace function record_supplier_credit__run(p_supplier uuid, p_kind text, p_amount numeric,
                                                       p_supplier_ref text, p_reason text, p_receipt uuid,
                                                       p_bill uuid, p_account_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_me uuid := (current_member()).id;
  v_kind text := lower(nullif(trim(p_kind), '')); v_ref text := nullif(trim(p_supplier_ref), '');
  v_reason text := nullif(trim(p_reason), ''); v_amount numeric; v_day date; v_account text;
  r goods_receipt; v_state jsonb; b purchase_invoice; acct gl_account;
  v_id uuid := gen_random_uuid(); v_no bigint; v_journal uuid; v_lines jsonb; v_alloc numeric := 0;
  v_items uuid[]; v_values numeric[]; v_after numeric[]; v_worth numeric; v_taken numeric; i int; p record;
  v_share numeric; v_on numeric; v_stock numeric := 0; v_part numeric; v_moves jsonb := '[]'; x jsonb;
begin
  if v_kind is null or v_kind not in ('price', 'other', 'goods_return') then
    raise exception 'Say what the credit is for: a price, or other';
  end if;
  if v_kind = 'goods_return' then
    raise exception 'A return makes its own credit: record the supplier''s note on it instead';
  end if;
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business) then
    raise exception 'Choose a supplier';
  end if;
  if v_ref is null then raise exception 'Type the number on the supplier''s credit note'; end if;
  if exists (select 1 from supplier_credit where business_id = v_business and supplier_id = p_supplier
               and lower(supplier_ref) = lower(v_ref)) then
    raise exception 'Credit note % from this supplier is already recorded', v_ref;
  end if;
  if v_reason is null then raise exception 'Say what the credit is for'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  v_day := business_local_date(v_business, now());
  if p_bill is not null then
    select * into b from purchase_invoice where id = p_bill and business_id = v_business;
    if not found then raise exception 'Bill not found'; end if;
    if b.supplier_id <> p_supplier then raise exception 'That bill is from another supplier'; end if;
    if b.cancelled_at is not null then raise exception 'That bill was cancelled; it is not owed'; end if;
  end if;

  if v_kind = 'price' then
    if p_receipt is null then raise exception 'Choose the delivery the price was for'; end if;
    select * into r from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Delivery not found'; end if;
    -- Recorded by someone who works at the delivery's place (0055), stock moved or not (0063).
    perform assert_works_at(r.location_id);
    v_state := receipt_state(p_receipt);
    if (v_state ->> 'supplier_id')::uuid is distinct from p_supplier then
      raise exception 'Delivery % came from another supplier', coalesce(r.receipt_no::text, '');
    end if;
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'Delivery % was reversed: there is no price to reduce', r.receipt_no;
    end if;
    if p_bill is null then
      select * into b from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null;
    elsif b.goods_receipt_id is distinct from p_receipt then
      raise exception 'Bill % is not for delivery %', b.invoice_no, r.receipt_no;
    end if;
    if b.id is null then
      raise exception 'Delivery % is not billed yet: correct its price on Purchasing instead', r.receipt_no;
    end if;
    -- What the delivery is still worth to the supplier: each item's value less
    -- what of it went back (the credit is shared over what stayed, 0063), less
    -- earlier credits.
    select array_agg(g.item_id order by g.item_id), array_agg(g.v order by g.item_id), coalesce(sum(g.v), 0)
      into v_items, v_values, v_worth
      from (select d.item_id,
                   d.v - coalesce((select sum(sl.value) from supplier_return_line sl
                                     join supplier_return sr on sr.id = sl.supplier_return_id
                                    where sr.goods_receipt_id = p_receipt and sl.item_id = d.item_id), 0) as v
              from (select (e ->> 'item_id')::uuid as item_id, sum((e ->> 'landed')::numeric) as v
                      from jsonb_array_elements(v_state -> 'lines') e group by 1) d) g
     where g.v > 0;
    v_taken := coalesce((select sum(amount) from supplier_credit where goods_receipt_id = p_receipt and kind = 'price'), 0);
    if v_worth - v_taken <= 0 or v_amount > v_worth - v_taken then
      raise exception 'That is more than delivery % is still worth (%)', r.receipt_no,
        trim_scale(greatest(v_worth - v_taken, 0));
    end if;
    -- Shared over its items by value; each item's share still on hand revalues it, the rest is variance.
    v_after := allocate_landed(v_business, v_values, -v_amount);
    perform lock_items(v_items);
    for i in 1 .. cardinality(v_items) loop
      v_share := v_values[i] - v_after[i];
      p := item_position(v_business, v_items[i], r.location_id);
      v_on := receipt_share_on_hand(v_business, p_receipt, v_items[i], r.location_id);
      v_part := case when p.qty > 0 and p.value > 0
                     then least(money_round(v_business, v_share * v_on), p.value) else 0 end;
      if v_part > 0 then
        v_moves := v_moves || jsonb_build_object('item_id', v_items[i], 'qty', p.qty, 'from', p.value,
                                                 'to', p.value - v_part);
      end if;
      v_stock := v_stock + v_part;
    end loop;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line('1200', -v_stock),
                                 signed_line('5050', v_stock - v_amount));
  else
    v_account := coalesce(nullif(trim(p_account_code), ''), b.expense_account_code);
    if v_account is null then raise exception 'Choose the account the credit is taken off'; end if;
    select * into acct from gl_account where business_id = v_business and code = v_account and is_active;
    if not found or acct.account_type not in ('expense', 'asset')
       or v_account in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '1300', '5000', '5300', '5310',
                       '5400') then
      raise exception 'Account % cannot take a supplier''s credit', v_account;
    end if;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line(v_account, -v_amount));
  end if;

  v_no := next_document_no(v_business, 'supplier_credit', 1);
  v_journal := post_journal(v_business, now(),
    'Credit ' || v_no || ' from ' || (select name from supplier where id = p_supplier) || ' (' || v_ref || '): ' || v_reason,
    'supplier_credit', v_id, v_lines, null, v_ref);
  insert into supplier_credit (id, business_id, credit_no, supplier_id, kind, amount, credit_date, supplier_ref, reason,
                               goods_receipt_id, purchase_invoice_id, account_code, journal_entry_id, matched_at,
                               matched_by, created_by)
  values (v_id, v_business, v_no, p_supplier, v_kind, v_amount, v_day, v_ref, v_reason, p_receipt, b.id, v_account,
          v_journal, now(), v_me, v_me);
  for x in select * from jsonb_array_elements(v_moves) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, (x ->> 'item_id')::uuid, r.location_id, 'cost_adjustment', -(x ->> 'qty')::numeric,
            (x ->> 'from')::numeric / (x ->> 'qty')::numeric, (x ->> 'from')::numeric,
            'supplier_credit', v_id, v_me, 'Revalued: credit ' || v_no || ' on delivery ' || r.receipt_no),
           (v_business, (x ->> 'item_id')::uuid, r.location_id, 'cost_adjustment', (x ->> 'qty')::numeric,
            (x ->> 'to')::numeric / (x ->> 'qty')::numeric, (x ->> 'to')::numeric,
            'supplier_credit', v_id, v_me, 'Revalued: credit ' || v_no || ' on delivery ' || r.receipt_no);
  end loop;
  if b.id is not null then
    v_alloc := set_credit_against(v_business, v_id, b.id, null, v_me, false);
  end if;
  perform audit_event(v_business, 'purchase.credit', 'supplier_credit', v_id::text, v_reason, null,
    jsonb_build_object('credit_no', v_no, 'supplier', p_supplier, 'credit_kind', v_kind, 'amount', v_amount,
                       'supplier_ref', v_ref, 'receipt_no', r.receipt_no, 'bill', b.invoice_no,
                       'account', v_account, 'stock_change', -v_stock, 'set_against_bill', v_alloc));
  return jsonb_build_object('credit_id', v_id, 'credit_no', v_no, 'kind', v_kind, 'amount', v_amount,
    'stock', -v_stock, 'variance', case when v_kind = 'price' then v_stock - v_amount else 0 end,
    'set_against_bill', v_alloc, 'bill_no', b.invoice_no,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- 0049's bill, dated no earlier than the delivery it is for came.

create or replace function record_bill__run(
  p_supplier uuid, p_invoice_no text, p_invoice_date date, p_amount numeric, p_term_days int default 0,
  p_receipt uuid default null, p_account_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_amount numeric; v_grni numeric; v_legacy numeric; v_ppv numeric; v_bill uuid; v_journal uuid; v_lines jsonb;
  v_acct gl_account; v_state jsonb;
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
    v_state := receipt_state(p_receipt);
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'That delivery was reversed: there is nothing to bill';
    end if;
    -- The old app did not record the supplier on a receipt; any supplier may bill those.
    if (v_state ->> 'supplier_id') is not null and (v_state ->> 'supplier_id')::uuid <> p_supplier then
      raise exception 'That receipt is from a different supplier';
    end if;
    if exists (select 1 from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null) then
      raise exception 'That receipt has already been billed';
    end if;
    -- Not dated before the goods came: it clears what their receipt raised,
    -- and before it there is nothing to clear (0063).
    if coalesce(p_invoice_date, business_local_date(v_business, now())) < (v_state ->> 'received_on')::date then
      raise exception 'Delivery % came on %: date its bill that day or later',
        (select receipt_no from goods_receipt where id = p_receipt), v_state ->> 'received_on';
    end if;
    v_grni := receipt_grni_value(p_receipt);
    if v_grni <= 0 and exists (select 1 from supplier_return where goods_receipt_id = p_receipt and against = 'delivery') then
      raise exception 'Everything delivery % brought went back to the supplier: there is nothing to bill',
        (select receipt_no from goods_receipt where id = p_receipt);
    end if;
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
       or p_account_code in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '1300', '5000', '5050',
                          '5300', '5310', '5400') then
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

-- 0029's supplier change: what is owed is what the bills still owe, credits
-- set against them counted as payments are.

create or replace function update_supplier(p_supplier uuid, p_name text, p_contact text default null,
                                           p_phone text default null, p_is_active boolean default true,
                                           p_reason text default null, p_lead_time_days int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('purchase.create'); s supplier; v_owed numeric;
begin
  select * into s from supplier where id = p_supplier and business_id = v_business for update;
  if not found then raise exception 'Unknown supplier'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Name the supplier'; end if;
  if p_lead_time_days is not null and p_lead_time_days not between 0 and 30 then
    raise exception 'A delivery takes 0 to 30 days';
  end if;
  if coalesce(p_is_active, true) then perform assert_name_free(v_business, 'supplier', p_name, p_supplier); end if;
  if not coalesce(p_is_active, true) and s.is_active then
    -- What the bills still owe: payments and credits set against them both count (0063).
    select coalesce(sum(amount_total - paid_amount), 0) into v_owed
      from purchase_invoice where supplier_id = p_supplier and cancelled_at is null;
    if v_owed > 0 then
      raise exception '% is still owed %: pay or cancel their bills before taking them out of use', s.name, trim_scale(v_owed);
    end if;
  end if;
  perform set_config('audit.reason', coalesce(trim(p_reason), ''), true);
  update supplier
     set name = trim(p_name), contact = nullif(trim(p_contact), ''), phone = nullif(trim(p_phone), ''),
         is_active = coalesce(p_is_active, true), lead_time_days = p_lead_time_days
   where id = p_supplier;
  perform set_config('audit.reason', '', true);
end $$;

-- 0044's order: how far it has come, and whether it can be cancelled, by what
-- came and stayed, not by whether a delivery was ever recorded against it.

create or replace function po_view(p_po uuid) returns jsonb
language sql stable set search_path = public as $$
  with po as (select * from purchase_order where id = p_po),
  lines as (
    select l.*, i.name as item_name, i.base_unit_code, coalesce(g.base_qty, 0) as received_base,
           greatest(l.base_qty - coalesce(g.base_qty, 0), 0) as outstanding_base
      from purchase_order_line l join item i on i.id = l.item_id
      left join po_received(p_po) g on g.item_id = l.item_id
     where l.purchase_order_id = p_po
  )
  select jsonb_build_object(
    'id', po.id, 'po_no', po.po_no, 'status', po.status,
    'receiving', case when not exists (select 1 from po_received(p_po) g where g.base_qty > 0) then 'none'
                      when exists (select 1 from lines where outstanding_base > 0) then 'part'
                      else 'all' end,
    'supplier_id', po.supplier_id, 'supplier', (select name from supplier where id = po.supplier_id),
    'location_id', po.location_id, 'location', (select name from location where id = po.location_id),
    'expected_on', po.expected_on, 'note', po.note, 'total', po.total,
    'created_at', po.ordered_at, 'created_by', (select full_name from app_user where id = po.created_by),
    'approved_at', po.approved_at, 'approved_by', (select full_name from app_user where id = po.approved_by),
    'sent_at', po.sent_at, 'sent_by', (select full_name from app_user where id = po.sent_by),
    'closed_at', po.closed_at, 'closed_by', (select full_name from app_user where id = po.closed_by),
    'close_reason', po.close_reason,
    'cancelled_at', po.cancelled_at, 'cancelled_by', (select full_name from app_user where id = po.cancelled_by),
    'cancel_reason', po.cancel_reason,
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
                'line_id', l.id, 'line_no', l.line_no, 'item_id', l.item_id, 'item', l.item_name,
                'qty', l.order_qty, 'unit_code', l.order_unit_code, 'unit_price', l.unit_price,
                'amount', money_round(po.business_id, l.order_qty * l.unit_price),
                'base_qty', l.base_qty, 'base_unit', l.base_unit_code,
                'received_base', l.received_base, 'outstanding_base', l.outstanding_base)
              order by l.line_no) from lines l), '[]'::jsonb),
    'unexpected', coalesce((select jsonb_agg(jsonb_build_object('item_id', g.item_id, 'item', i.name,
                                                                'base_qty', g.base_qty, 'base_unit', i.base_unit_code)
                                             order by i.name)
                              from po_received(p_po) g join item i on i.id = g.item_id
                             where not exists (select 1 from lines l where l.item_id = g.item_id)
                               and g.base_qty <> 0), '[]'::jsonb),
    'deliveries', coalesce((select jsonb_agg(jsonb_build_object('receipt_id', r.id, 'receipt_no', r.receipt_no,
                                                                'received_at', r.received_at)
                                             order by r.received_at, r.receipt_no)
                              from goods_receipt r where r.purchase_order_id = p_po), '[]'::jsonb))
  from po
$$;

create or replace function cancel_po__run(p_po uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'purchase.approve');
  v_me uuid := (current_member()).id;
  o purchase_order; v_reason text := nullif(trim(p_reason), '');
begin
  if v_reason is null then raise exception 'Say why the order is being cancelled'; end if;
  select * into o from purchase_order where id = p_po and business_id = v_business for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status in ('closed', 'cancelled') then raise exception 'Order % is not open', o.po_no; end if;
  -- What came and stayed: a delivery reversed brought nothing (0063).
  if exists (select 1 from po_received(o.id) g where g.base_qty > 0) then
    raise exception 'Goods have come against order %: close it instead', o.po_no;
  end if;
  update purchase_order set status = 'cancelled', cancelled_by = v_me, cancelled_at = now(),
                            cancel_reason = v_reason, updated_at = now()
   where id = o.id;
  perform audit_event(v_business, 'purchase.order.cancel', 'purchase_order', o.id::text, v_reason,
    jsonb_build_object('status', o.status), jsonb_build_object('po_no', o.po_no, 'total', o.total));
  return jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'status', 'cancelled');
end $$;

-- =============================================================================
-- 6. Money from the till or the safe, recorded the day it is taken out
-- =============================================================================
-- The drawer's and the safe's own records are written when the money moves;
-- the journal took the date chosen. An expense from either dated an earlier
-- day, or the reversal of a journal that moved their cash dated so, put that
-- day out for good, and its month could not be locked.
alter function record_expense__run(text, numeric, text, text, date, uuid) rename to record_expense__run_0055;
create function record_expense__run(p_description text, p_amount numeric, p_account_code text,
                                    p_paid_from text default 'cash', p_date date default null,
                                    p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(p_paid_from, '')) in ('cash', 'till', 'safe') and p_date is not null
     and p_date <> business_local_date(current_business_id(), now()) then
    raise exception 'Money from the till or the safe is recorded the day it is taken out: today';
  end if;
  return record_expense__run_0055(p_description, p_amount, p_account_code, p_paid_from, p_date, p_location);
end $$;

alter function reverse_journal__run(uuid, text, date) rename to reverse_journal__run_0035;
create function reverse_journal__run(p_entry uuid, p_reason text, p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_date is not null and p_date <> business_local_date(current_business_id(), now())
     and exists (select 1 from journal_line l join gl_account a on a.id = l.account_id
                  where l.journal_entry_id = p_entry and a.code in ('1000', '1001', '1005', '1006')) then
    raise exception 'A journal that moved the till''s or the safe''s cash is reversed today, when they count it';
  end if;
  return reverse_journal__run_0035(p_entry, p_reason, p_date);
end $$;

-- =============================================================================
-- 7. The staff's cost without the year-end close
-- =============================================================================
-- 0057's staff report: the café's whole cost of staff left the year-end
-- close out, as each place's did, so December's is not minus the year's.

create or replace function report_staff(p_from date, p_to date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('staff.manage', 'attendance.edit', 'payroll.view');
  v_pay boolean := current_has_permission('payroll.view');
  v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Choose the dates, the first before the last'; end if;
  if p_to - p_from > 366 then raise exception 'Choose up to a year'; end if;
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
               'employee_id', e.id, 'name', e.full_name, 'title', e.title,
               'days_scheduled', x.scheduled, 'days_worked', x.worked, 'minutes', x.minutes,
               'overtime_minutes', x.overtime, 'times_late', x.late, 'minutes_late', x.late_minutes,
               'times_early', x.early, 'minutes_early', x.early_minutes, 'days_absent', x.absent)
             order by e.full_name)
        from (select d.employee_id, count(*) filter (where d.shift_starts is not null) as scheduled,
                     count(*) filter (where d.minutes > 0) as worked, coalesce(sum(d.minutes), 0) as minutes,
                     coalesce(sum(d.overtime_minutes), 0) as overtime,
                     count(*) filter (where d.late_minutes is not null) as late,
                     coalesce(sum(d.late_minutes), 0) as late_minutes,
                     count(*) filter (where d.early_minutes is not null) as early,
                     coalesce(sum(d.early_minutes), 0) as early_minutes,
                     count(*) filter (where d.absent) as absent
                from staff_days(v_business, p_from, p_to) d group by d.employee_id) x
        join employee e on e.id = x.employee_id
       where v_loc is null or e.location_id = v_loc), '[]'::jsonb),
    -- What staff cost (6100, by the month its journals are dated in) against
    -- the month's sales: only for those who see payroll.
    'labour', case when v_pay then coalesce((
      select jsonb_agg(jsonb_build_object('month', m.month, 'cost', m.cost, 'sales', m.sales,
                                          'percent', case when m.sales > 0 then round(100 * m.cost / m.sales, 1) end)
                       order by m.month)
        from (select mm.month,
                     case when v_loc is null
                          then coalesce((select sum(l.debit - l.credit) from journal_line l
                                           join journal_entry j on j.id = l.journal_entry_id
                                           join gl_account g on g.id = l.account_id
                                          where j.business_id = v_business and j.status = 'published' and g.code = '6100'
                                            and not year_end_entry(j)
                                            and business_local_date(v_business, j.occurred_at)
                                                between mm.month and (mm.month + interval '1 month - 1 day')::date), 0)
                          -- A place's: its share of each payroll (0056).
                          else coalesce((select sum(p.amount)
                                           from local_day_bounds(v_business, mm.month,
                                                                 (mm.month + interval '1 month - 1 day')::date) lb,
                                                pnl_by_place(v_business, lb.from_ts, lb.to_ts) p
                                           join gl_account g on g.id = p.account_id
                                          where g.code = '6100' and p.location_id = v_loc), 0) end as cost,
                     coalesce((select sum(o.net_amount) from sales_order o
                                where o.business_id = v_business and o.status not in ('voided', 'open')
                                  and (v_loc is null or o.location_id = v_loc)
                                  and business_local_date(v_business, o.placed_at)
                                      between mm.month and (mm.month + interval '1 month - 1 day')::date), 0)
                     - coalesce((select sum(a.amount) from sale_adjustment a
                                  where a.business_id = v_business and a.kind = 'refund'
                                    and (v_loc is null or exists (select 1 from sales_order o
                                                                   where o.id = a.sales_order_id and o.location_id = v_loc))
                                    and business_local_date(v_business, a.created_at)
                                        between mm.month and (mm.month + interval '1 month - 1 day')::date), 0) as sales
                from (select generate_series(date_trunc('month', p_from), date_trunc('month', p_to),
                                             interval '1 month')::date as month) mm) m), '[]'::jsonb) end);
end $$;

-- =============================================================================
-- 8. Who may call what
-- =============================================================================
-- The work behind each keyed write, and the helpers, are called inside the
-- database only; the old versions kept their closed doors when renamed.
revoke execute on function
  record_production__run(uuid, numeric, numeric, text, text, uuid, uuid, timestamptz, timestamptz, text),
  review_loss__run(uuid, text, text),
  receive_stock_transfer__run(uuid, jsonb, text),
  correct_receipt__run(uuid, jsonb, uuid, date, text, boolean, boolean),
  send_stock_transfer__run(uuid, uuid, jsonb, text, boolean),
  return_to_supplier__run(uuid, jsonb, text, uuid, uuid, boolean),
  reopen_payroll__run(uuid, text),
  payroll_refresh(uuid, uuid),
  payroll_current(uuid, uuid),
  pay_salaries(uuid, payroll_run, jsonb, text, uuid),
  record_advance__run(uuid, numeric, text, text, uuid),
  receipt_share_on_hand(uuid, uuid, uuid, uuid),
  record_supplier_credit__run(uuid, text, numeric, text, text, uuid, uuid, text),
  record_bill__run(uuid, text, date, numeric, int, uuid, text),
  po_view(uuid),
  cancel_po__run(uuid, text),
  record_expense__run(text, numeric, text, text, date, uuid),
  reverse_journal__run(uuid, text, date)
  from public, anon, authenticated;
