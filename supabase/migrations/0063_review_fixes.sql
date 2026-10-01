-- =============================================================================
-- 0063 — What a review of the releases since 0035 found, put right (1 of 2)
-- =============================================================================
-- Five reviews, one for each part of what 0035 to 0057 built, each finding
-- checked against the code before it was put right. This migration and 0064
-- put right what they found; this one:
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
-- (0064: purchases, the till and the safe, and the staff report.)
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
-- 5. Who may call what
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
  record_advance__run(uuid, numeric, text, text, uuid)
  from public, anon, authenticated;
