-- =============================================================================
-- 0088 — One approvals inbox (SMART_PLAN E5)
-- =============================================================================
-- What waits for a manager was found on four screens: a submitted stock count
-- on Stock Count, a loss saved to wait on Inventory, a purchase order drafted
-- on Purchasing, the month's pay on Payroll. Now it is gathered in one list,
-- each with who asked, when, why and how much, and whether the reader may
-- decide it; the menu counts it, and a phone is warned when one arrives.
--
--  * approvals_waiting(): the list, for the reader's own permissions and
--    place. Each kind is decided by the database function that decides it
--    today (approve_stock_count, reject_stock_count, review_loss, approve_po,
--    cancel_po, approve_payroll), with its own checks: nothing here approves.
--  * approvals_waiting_count(): how many, for the menu.
--  * The alert approvals_waiting: a count submitted, or an order drafted and
--    left an hour, opens it; its subject is the newest one waiting, so each
--    new arrival is a new alert and reaches a phone (0072).
--
-- Nothing recorded changes.
-- =============================================================================

-- A purchase order waits once it has lines and has been left an hour: before
-- that it is still being written.
create or replace function po_waits(o purchase_order, p_now timestamptz) returns boolean
language sql stable set search_path = public as $$
  select o.status = 'draft' and o.total > 0
     and coalesce(o.updated_at, o.ordered_at) <= p_now - interval '1 hour'
     and exists (select 1 from purchase_order_line l where l.purchase_order_id = o.id)
$$;

create or replace function approvals_waiting() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve', 'waste.approve', 'purchase.approve',
                                        'payroll.run');
  v_me uuid := (current_member()).id;
  v_place uuid := current_work_place();
  v_cost boolean := current_has_permission('cost.view');
  v_limit numeric := case when current_has_permission('purchase.approve')
                          then member_rule_number(v_business, 'po_approve_up_to', v_me) end;
  v_out jsonb := '[]'::jsonb;
begin
  -- Stock counts submitted: approving posts the differences; the counter may only withdraw it.
  if current_has_permission('inventory.adjust.approve') then
    v_out := v_out || coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', 'count', 'id', c.id, 'at', c.submitted_at,
               'by', u.full_name, 'mine', c.counted_by = v_me,
               'what', l.name,
               'detail', jsonb_build_object(
                 'items', (select count(*) from stock_count_line x where x.stock_count_id = c.id),
                 'differ', (select count(*) from stock_count_line x
                             where x.stock_count_id = c.id and x.counted_base is distinct from x.expected_base)),
               'value', null, 'reason', null,
               'may_approve', c.counted_by is distinct from v_me, 'may_reject', true,
               'href', '/count')
             order by c.submitted_at)
        from stock_count c
        join location l on l.id = c.location_id
        left join app_user u on u.id = c.counted_by
       where c.business_id = v_business and c.status = 'submitted'
         and (v_place is null or c.location_id = v_place)), '[]'::jsonb);
  end if;

  -- Losses saved to wait: approved, or reversed with why; never by whoever recorded them.
  if current_has_permission('waste.approve') then
    v_out := v_out || coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', 'loss', 'id', w.movement_id, 'at', w.at,
               'by', w.recorded_by, 'mine', w.recorded_by_id = v_me,
               'what', w.item,
               'detail', jsonb_build_object('qty', w.qty, 'unit', w.unit, 'loss_kind', w.kind),
               'value', w.value, 'reason', w.reason,
               'may_approve', w.recorded_by_id is distinct from v_me,
               'may_reject', w.recorded_by_id is distinct from v_me,
               'href', '/inventory#losses-waiting')
             order by w.at)
        from losses_waiting() w), '[]'::jsonb);
  end if;

  -- Purchase orders drafted and left: approved within one's limit, or cancelled with why.
  if current_has_permission('purchase.approve') then
    v_out := v_out || coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', 'order', 'id', o.id, 'at', coalesce(o.updated_at, o.ordered_at),
               'by', u.full_name, 'mine', o.created_by = v_me,
               'what', '#' || o.po_no || coalesce(' · ' || s.name, ''),
               'detail', jsonb_build_object(
                 'lines', (select count(*) from purchase_order_line x where x.purchase_order_id = o.id),
                 'over_limit', v_limit is null or o.total > v_limit),
               'value', case when v_cost then o.total end, 'reason', o.note,
               'may_approve', v_limit is not null and o.total <= v_limit, 'may_reject', true,
               'href', '/purchasing')
             order by o.po_no)
        from purchase_order o
        left join supplier s on s.id = o.supplier_id
        left join app_user u on u.id = o.created_by
       where o.business_id = v_business and po_waits(o, now())), '[]'::jsonb);
  end if;

  -- The month's pay drafted: approved on its own page, where each line is seen.
  if current_has_permission('payroll.run') then
    v_out := v_out || coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', 'payroll', 'id', r.id, 'at', r.drafted_at,
               'by', u.full_name, 'mine', r.drafted_by = v_me,
               'what', to_char(r.month, 'YYYY-MM'),
               'detail', jsonb_build_object('people', (select count(*) from payroll_line x where x.run_id = r.id)),
               'value', (select coalesce(sum(x.net), 0) from payroll_line x where x.run_id = r.id),
               'reason', null, 'may_approve', true, 'may_reject', false,
               'href', '/payroll/' || r.id)
             order by r.month)
        from payroll_run r
        left join app_user u on u.id = r.drafted_by
       where r.business_id = v_business and r.status = 'draft'), '[]'::jsonb);
  end if;

  return coalesce((select jsonb_agg(e order by e ->> 'at') from jsonb_array_elements(v_out) e), '[]'::jsonb);
end $$;

-- How many, for the menu: nothing for whoever approves nothing.
create or replace function approvals_waiting_count() returns int
language plpgsql stable security definer set search_path = public as $$
begin
  if not (current_has_permission('inventory.adjust.approve') or current_has_permission('waste.approve')
          or current_has_permission('purchase.approve') or current_has_permission('payroll.run')) then
    return 0;
  end if;
  return jsonb_array_length(approvals_waiting());
end $$;

-- 0061's rules, and one more: counts and orders waiting for a manager. Losses
-- (0040) and the month's pay (0049) keep the alerts they have.
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0061;
revoke execute on function alert_conditions_0061(uuid, timestamptz) from public, anon, authenticated;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0061(p_business, p_now) c
  union all
  select 'approvals_waiting'::text, x.newest::text,
         (case when x.since < p_now - interval '1 day' then 'red' else 'orange' end)::text,
         format('%s waiting for a manager''s approval: %s count(s), %s order(s)', x.n, x.counts, x.orders),
         'A stock count posts nothing, and an order goes to no supplier, until a manager approves it.',
         'Open Approvals: approve each one, or send it back with why.',
         'high', '/approvals', jsonb_build_object('counts', x.counts, 'orders', x.orders, 'since', x.since)
    from (select count(*) n, count(*) filter (where w.kind = 'count') counts,
                 count(*) filter (where w.kind = 'order') orders,
                 min(w.at) since, (array_agg(w.id order by w.at desc, w.id))[1] newest
            from (select 'count' kind, c.id, c.submitted_at at
                    from stock_count c
                   where c.business_id = p_business and c.status = 'submitted' and c.submitted_at <= p_now
                  union all
                  select 'order', o.id, coalesce(o.updated_at, o.ordered_at)
                    from purchase_order o
                   where o.business_id = p_business and po_waits(o, p_now)) w) x
   where x.n > 0
$$;

revoke execute on function po_waits(purchase_order, timestamptz), alert_conditions(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function approvals_waiting() from public, anon;
grant execute on function approvals_waiting() to authenticated;
revoke execute on function approvals_waiting_count() from public, anon;
grant execute on function approvals_waiting_count() to authenticated;
