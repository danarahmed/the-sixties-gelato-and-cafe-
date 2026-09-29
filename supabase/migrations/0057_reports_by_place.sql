-- =============================================================================
-- 0057 — Every report at a place (release AB, fourth part)
--
-- 0056 read the profit and loss by place; every other report still added the
-- café up as one (docs/COMPLETION_PLAN.md, B12 and release AB: "a branch
-- filter on every report"). Now each report that reads what was recorded at
-- a place is read for the café (no place named, as before) or for one of its
-- places, and someone who works at one place reads theirs, and no other:
--   * the day's sales, the payments, the sales costed at nothing, the losses,
--     the sizes and add-ons, and the exceptions: by the sale's, the loss's or
--     the bill's place;
--   * what was bought, purchasing and production: by the delivery's, the
--     order's, the return's or the batch's place; a supplier's credit by its
--     delivery's, its return's or its bill's;
--   * the dollars: the sales, exchanges, counts and tills at the place; the
--     rates and the safe stay the café's;
--   * the staff: the people who work at the place, and its share of each
--     payroll (0056) against its sales;
--   * the customers: the points and sales on the place's sales; the café's
--     customers and their points held stay the café's;
--   * the sales analysis, the stock's value and the usage against the recipes
--     already took a place: someone who works at one place now reads only
--     theirs;
--   * the dashboard of someone who works at one place is that place's day.
-- Nothing recorded changes: these are reports.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
-- A supplier's credit at the place of its delivery, of the goods it takes
-- back, or of its bill's delivery; none for one on none of them.
create or replace function supplier_credit_place(c supplier_credit) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select g.location_id from goods_receipt g where g.id = c.goods_receipt_id),
                  (select r.location_id from supplier_return r where r.id = c.supplier_return_id),
                  (select g.location_id from purchase_invoice i join goods_receipt g on g.id = i.goods_receipt_id
                    where i.id = c.purchase_invoice_id))
$$;

-- 0050's customer_sales, at a place (none: every place's).
drop function if exists customer_sales(uuid, timestamptz, timestamptz);
create or replace function customer_sales(p_business uuid, p_from timestamptz, p_to timestamptz,
                                          p_location uuid default null)
returns table (customer_id uuid, orders bigint, spent numeric, last_at timestamptz)
language sql stable set search_path = public as $$
  select o.customer_id, count(*), sum(o.net_amount - sale_refunded(o.id)), max(o.placed_at)
    from sales_order o
   where o.business_id = p_business and o.customer_id is not null
     and o.status in ('completed', 'partially_refunded', 'refunded')
     and o.placed_at >= coalesce(p_from, '-infinity') and o.placed_at < coalesce(p_to, 'infinity')
     and (p_location is null or o.location_id = p_location)
   group by o.customer_id
$$;

-- ---------------------------------------------------------------------------
-- 2. The reports, for the café or a place
-- ---------------------------------------------------------------------------
-- Each made anew with the place (none named: the café's, as before), read
-- through report_place: someone who works at one place gets theirs.
drop function if exists report_daily_sales(date, date);
drop function if exists report_payments(date, date);
drop function if exists report_uncosted_sales(date, date);
drop function if exists report_losses(date, date);
drop function if exists report_sizes_and_addons(date, date);
drop function if exists report_exceptions(date, date);
drop function if exists report_purchases(date, date);
drop function if exists report_dollars(date, date);
drop function if exists report_purchasing(date, date);
drop function if exists report_production(date, date);
drop function if exists report_staff(date, date);
drop function if exists report_customers(date, date);

-- 0026's sales by day and channel.
create or replace function report_daily_sales(p_from date, p_to date, p_location uuid default null)
returns table (day date, channel sales_channel, orders bigint, net numeric, cogs numeric,
               refunds numeric, returned_cost numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  b := local_day_bounds(v_business, p_from, p_to);
  return query
    with s as (
      select business_local_date(v_business, o.placed_at) as d, o.channel as ch, count(*) as n,
             sum(o.net_amount) as net, sum(o.cogs_amount) as cogs
        from sales_order o
       where o.business_id = v_business and o.status not in ('voided', 'open')
         and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
         and (v_loc is null or o.location_id = v_loc)
       group by 1, 2
    ),
    r as (
      select business_local_date(v_business, a.created_at) as d, o.channel as ch, sum(a.amount) as refunds,
             sum(coalesce((select sum(m.value) from inventory_movement m
                            where m.reference_type = 'sale_refund' and m.reference_id = a.id
                              and m.type = 'refund_return_to_stock'), 0)) as returned
        from sale_adjustment a join sales_order o on o.id = a.sales_order_id
       where a.business_id = v_business and a.kind = 'refund'
         and a.created_at >= b.from_ts and a.created_at < b.to_ts
         and (v_loc is null or o.location_id = v_loc)
       group by 1, 2
    )
    select coalesce(s.d, r.d), coalesce(s.ch, r.ch), coalesce(s.n, 0), coalesce(s.net, 0), coalesce(s.cogs, 0),
           coalesce(r.refunds, 0), coalesce(r.returned, 0)
      from s full join r on r.d = s.d and r.ch = s.ch
     order by 1 desc, 2;
end $$;

-- 0042's payments.
create or replace function report_payments(p_from date, p_to date, p_location uuid default null)
returns table (method tender_type, sales bigint, taken numeric, split_sales bigint, change_given numeric,
               refunded numeric, net numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  b := local_day_bounds(v_business, p_from, p_to);
  return query
    with t as (
      select st.tender_type as m, count(distinct o.id) as n, sum(st.amount) as amt,
             count(distinct o.id) filter (where exists (select 1 from sales_tender x
                                                          where x.sales_order_id = o.id
                                                            and x.tender_type <> st.tender_type)) as split,
             sum(coalesce(st.change_given, 0)) as change
        from sales_order o join sales_tender st on st.sales_order_id = o.id
       where o.business_id = v_business and o.status not in ('voided', 'open')
         and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
         and (v_loc is null or o.location_id = v_loc)
       group by 1
    ),
    r as (
      select rt.tender_type as m, rt.amount as back
        from sale_refund r join sale_refund_tender rt on rt.refund_id = r.id
       where r.business_id = v_business and r.created_at >= b.from_ts and r.created_at < b.to_ts
         and (v_loc is null or r.location_id = v_loc)
      union all
      select (select st.tender_type from sales_tender st where st.sales_order_id = a.sales_order_id
               order by st.position, st.id limit 1), a.amount
        from sale_adjustment a
       where a.business_id = v_business and a.kind = 'refund'
         and a.created_at >= b.from_ts and a.created_at < b.to_ts
         and not exists (select 1 from sale_refund r where r.id = a.id)
         and (v_loc is null or exists (select 1 from sales_order o where o.id = a.sales_order_id and o.location_id = v_loc))
    ),
    rr as (select r.m, sum(r.back) as back from r where r.m is not null group by r.m)
    select coalesce(t.m, rr.m), coalesce(t.n, 0), coalesce(t.amt, 0), coalesce(t.split, 0), coalesce(t.change, 0),
           coalesce(rr.back, 0), coalesce(t.amt, 0) - coalesce(rr.back, 0)
      from t full join rr on rr.m = t.m
     order by 1;
end $$;

-- 0025's sales costed at nothing.
create or replace function report_uncosted_sales(p_from date, p_to date, p_location uuid default null)
returns table (order_id uuid, placed_at timestamptz, channel sales_channel, products text, net numeric,
               cogs numeric, reasons text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  return query select u.* from uncosted_sales(v_business, p_from, p_to) u
                where v_loc is null or exists (select 1 from sales_order o where o.id = u.order_id and o.location_id = v_loc);
end $$;

-- 0048's losses.
create or replace function report_losses(p_from date, p_to date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_from timestamptz; v_to timestamptz; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Choose the dates, the first before the last'; end if;
  select b.from_ts, b.to_ts into v_from, v_to from local_day_bounds(v_business, p_from, p_to) b;
  return (
    with lm as (
      -- Every movement of a loss in the dates, with the loss it belongs to.
      select m.id, m.item_id, -m.base_quantity_signed as qty, m.value, m.created_at, m.type, m.reason,
             m.app_user_id, m.approval_status,
             case when m.reference_type = 'stock_loss' then m.reference_id else m.id end as loss_id,
             exists (select 1 from loss_review r where r.movement_id = m.id and r.decision = 'reversed') as reversed,
             exists (select 1 from loss_review r where r.movement_id = m.id) as reviewed
        from inventory_movement m
       where m.business_id = v_business and is_loss(m.type) and m.base_quantity_signed < 0
         and m.created_at >= v_from and m.created_at < v_to
         and (v_loc is null or m.location_id = v_loc)
    ),
    losses as (
      select lm.loss_id, min(lm.created_at) as at, coalesce(s.kind, min(lm.type::text)::movement_type) as kind,
             coalesce(s.value, sum(lm.value)) as value, coalesce(s.reason, min(lm.reason)) as reason,
             coalesce(s.recorded_by, (array_agg(lm.app_user_id))[1]) as person,
             case when s.id is not null then loss_account(s.kind) else '5300' end as account,
             bool_or(lm.reversed) as reversed,
             bool_or(lm.approval_status = 'pending' and not lm.reviewed) as pending,
             coalesce(s.status, min(lm.approval_status::text)::approval_status) as status,
             coalesce(s.at_till, false) as at_till, s.turn_no, s.approved_by, s.id is not null as documented
        from lm left join stock_loss s on s.id = lm.loss_id
       group by lm.loss_id, s.id
    ),
    kept as (select * from losses where not reversed)
    select jsonb_build_object(
      'from', p_from, 'to', p_to,
      'total', jsonb_build_object(
        'value', coalesce((select sum(value) from kept), 0),
        'count', (select count(*) from kept),
        'pending_count', (select count(*) from kept where pending),
        'pending_value', coalesce((select sum(value) from kept where pending), 0),
        'reversed_count', (select count(*) from losses where reversed),
        'reversed_value', coalesce((select sum(value) from losses where reversed), 0)),
      'by_kind', coalesce((
        select jsonb_agg(jsonb_build_object('kind', k.kind, 'account', k.account, 'account_name', g.name,
                                            'count', k.n, 'value', k.value) order by k.value desc, k.kind)
          from (select kind::text as kind, account, count(*) as n, sum(value) as value from kept group by 1, 2) k
          left join gl_account g on g.business_id = v_business and g.code = k.account), '[]'),
      'by_item', coalesce((
        select jsonb_agg(jsonb_build_object('item_id', x.item_id, 'item', i.name, 'unit', i.base_unit_code,
                                            'qty', trim_scale(x.qty), 'value', x.value, 'count', x.n)
                         order by x.value desc, i.name)
          from (select item_id, sum(qty) as qty, sum(value) as value, count(distinct loss_id) as n
                  from lm where not reversed group by item_id) x
          join item i on i.id = x.item_id), '[]'),
      'by_person', coalesce((
        select jsonb_agg(jsonb_build_object('person_id', x.person, 'person', u.full_name, 'count', x.n,
                                            'value', x.value) order by x.value desc, u.full_name)
          from (select person, count(*) as n, sum(value) as value from kept group by person) x
          left join app_user u on u.id = x.person), '[]'),
      'by_day', coalesce((
        select jsonb_agg(jsonb_build_object('day', x.day, 'count', x.n, 'value', x.value) order by x.day)
          from (select business_local_date(v_business, at) as day, count(*) as n, sum(value) as value
                  from kept group by 1) x), '[]'),
      'giveaways', coalesce((
        select jsonb_agg(jsonb_build_object('kind', x.kind, 'count', x.n, 'value', x.value) order by x.kind)
          from (select kind::text as kind, count(*) as n, sum(value) as value from kept where at_till group by 1) x),
        '[]'),
      'losses', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'loss_id', case when l.documented then l.loss_id end,
                 'movement_id', (select min(lm2.id::text) from lm lm2 where lm2.loss_id = l.loss_id),
                 'at', l.at, 'kind', l.kind, 'account', l.account, 'value', l.value, 'reason', l.reason,
                 'person', u.full_name, 'approved_by', a.full_name, 'status', l.status, 'pending', l.pending,
                 'reversed', l.reversed, 'at_till', l.at_till, 'turn_no', l.turn_no,
                 'what', coalesce((select jsonb_agg(jsonb_build_object(
                                            'name', coalesce(i.name, p.name), 'size',
                                            case when pv.id is not null and (select count(*) from product_variant v2
                                                                               where v2.product_id = p.id) > 1
                                                 then pv.name end,
                                            'qty', trim_scale(sl.qty), 'unit', coalesce(sl.unit_code, i.base_unit_code),
                                            'batch_no', b.batch_no,
                                            'addons', (select jsonb_agg(mo ->> 'name') from jsonb_array_elements(sl.modifiers) mo))
                                          order by sl.position)
                                     from stock_loss_line sl
                                     left join item i on i.id = sl.item_id
                                     left join product_variant pv on pv.id = sl.product_variant_id
                                     left join product p on p.id = pv.product_id
                                     left join item_lot lot on lot.id = sl.lot_id
                                     left join production_batch b on b.id = lot.production_batch_id
                                    where l.documented and sl.stock_loss_id = l.loss_id),
                                  (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', trim_scale(lm3.qty),
                                                                       'unit', i.base_unit_code))
                                     from lm lm3 join item i on i.id = lm3.item_id
                                    where not l.documented and lm3.loss_id = l.loss_id)))
               order by l.at desc, l.loss_id)
          from (select * from losses order by at desc, loss_id limit 300) l
          left join app_user u on u.id = l.person
          left join app_user a on a.id = l.approved_by), '[]'))
  );
end $$;

-- 0041's sizes and add-ons.
create or replace function report_sizes_and_addons(p_from date, p_to date, p_location uuid default null)
returns table (kind text, product text, name text, qty numeric, lines bigint, sales numeric, cost numeric,
               margin numeric, offered bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_start timestamptz; v_end timestamptz; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Choose the dates, the first before the last'; end if;
  select bd.from_ts, bd.to_ts into v_start, v_end from local_day_bounds(v_business, p_from, p_to) bd;
  return query
    with sold as (
      select sl.id as line_id, sl.product_variant_id as variant_id, pv.product_id as product_id,
             sl.quantity as line_qty, sl.line_net as line_net, coalesce(sl.cogs_amount, 0) as line_cost
        from sales_order_line sl
        join sales_order so on so.id = sl.sales_order_id
        join product_variant pv on pv.id = sl.product_variant_id
       where so.business_id = v_business and so.status not in ('voided', 'open')
         and so.placed_at >= v_start and so.placed_at < v_end
         and (v_loc is null or so.location_id = v_loc)),
    added as (
      select lm.sales_order_line_id as line_id, lm.modifier_id as modifier_id, lm.group_id as group_id,
             lm.name as addon_name, lm.qty as addon_qty, lm.net_amount as addon_net, lm.cost as addon_cost
        from sales_order_line_modifier lm join sold s on s.line_id = lm.sales_order_line_id),
    per_line as (
      select a.line_id, sum(a.addon_net) as addon_net, sum(a.addon_cost) as addon_cost
        from added a group by a.line_id)
    select 'size'::text, pr.name, pv.name, sum(s.line_qty), count(*),
           sum(s.line_net - coalesce(pl.addon_net, 0)),
           sum(s.line_cost - coalesce(pl.addon_cost, 0)),
           sum(s.line_net - coalesce(pl.addon_net, 0)) - sum(s.line_cost - coalesce(pl.addon_cost, 0)),
           null::bigint
      from sold s
      join product_variant pv on pv.id = s.variant_id
      join product pr on pr.id = pv.product_id
      left join per_line pl on pl.line_id = s.line_id
     group by pr.id, pr.name, pv.id, pv.name
    union all
    select 'addon'::text, coalesce(g.name, ''), a.addon_name, sum(a.addon_qty), count(distinct a.line_id),
           sum(a.addon_net), sum(a.addon_cost), sum(a.addon_net) - sum(a.addon_cost),
           (select count(*) from sold s2
             where exists (select 1 from product_modifier_group o
                            where o.group_id = a.group_id and o.product_id = s2.product_id
                              and (o.product_variant_id is null or o.product_variant_id = s2.variant_id)))
      from added a
      left join modifier_group g on g.id = a.group_id
     group by a.modifier_id, a.group_id, g.name, a.addon_name
     order by 1 desc, 2, 3;
end $$;

-- 0040's exceptions.
create or replace function report_exceptions(p_from date, p_to date, p_location uuid default null)
returns table (at timestamptz, kind text, person_id uuid, person text, amount numeric, reason text,
               approved_by text, needs_review boolean, reference text, detail text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('audit.view'); b record; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  select * into b from local_day_bounds(v_business, p_from, p_to);
  return query
    select sa.created_at, sa.kind::text, sa.requested_by, rq.full_name, sa.amount, sa.reason,
           case when sa.approved_by is distinct from sa.requested_by then ap.full_name end,
           sa.approved_by is null or sa.approved_by = sa.requested_by,
           'Sale ' || left(o.id::text, 8),
           'Rung by ' || coalesce(ca.full_name, 'someone') ||
             case when o.cashier_id = sa.requested_by then ' (their own sale)' else '' end
      from sale_adjustment sa
      join sales_order o on o.id = sa.sales_order_id
      left join app_user rq on rq.id = sa.requested_by
      left join app_user ap on ap.id = sa.approved_by
      left join app_user ca on ca.id = o.cashier_id
     where sa.business_id = v_business and sa.kind in ('void', 'refund')
       and sa.created_at >= b.from_ts and sa.created_at < b.to_ts
       and (v_loc is null or o.location_id = v_loc)
    union all
    select o.placed_at, 'discount', coalesce(o.discount_by, o.cashier_id), gv.full_name, o.discount_amount,
           coalesce(o.discount_reason, 'No reason kept (given before reasons were asked)'), dap.full_name,
           o.discount_reason is null and o.discount_approved_by is null
             and discount_share(o.gross_amount, o.discount_percent, o.discount_amount)
                 > member_rule_number(v_business, 'discount_cap_percent', coalesce(o.discount_by, o.cashier_id))
             and not member_has_permission(coalesce(o.discount_by, o.cashier_id), 'discount.approve'),
           'Sale ' || left(o.id::text, 8),
           coalesce(trim_scale(o.discount_percent) || '% asked, ', '')
             || trim_scale(round(o.discount_amount / nullif(o.gross_amount, 0) * 100, 1)) || '% of '
             || trim_scale(o.gross_amount)
             || case when o.discount_by is null then ', given before who gave it was kept' else '' end
             || case when o.status = 'voided' then ', later voided'
                     when o.status = 'refunded' then ', later refunded' else '' end
      from sales_order o
      left join app_user gv on gv.id = coalesce(o.discount_by, o.cashier_id)
      left join app_user dap on dap.id = o.discount_approved_by
     where o.business_id = v_business and o.discount_amount > 0 and o.status <> 'open'
       and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
       and (v_loc is null or o.location_id = v_loc)
    union all
    select a.occurred_at,
           case a.action when 'bill.cancel' then 'bill_cancel' when 'bill.reduce' then 'printed_bill_reduced'
                         when 'bill.line_remove' then 'line_removed' else 'wrong_pin' end,
           a.app_user_id, u.full_name, null::numeric, a.reason, null::text,
           a.action = 'approval.refused',
           case when a.action = 'approval.refused' then 'Approval by ' || coalesce(ap.full_name, 'someone')
                else 'Bill ' || left(a.entity_id, 8) end,
           case when a.action = 'bill.cancel'
                  then coalesce(jsonb_array_length(a.before_state -> 'lines'), 0) || ' line(s) on it'
                when a.action in ('bill.reduce', 'bill.line_remove')
                  then (select coalesce(sum(greatest(bq.q - coalesce(nq.q, 0), 0)), 0)
                          from (select x ->> 'variant_id' v, sum((x ->> 'qty')::numeric) q
                                  from jsonb_array_elements(a.before_state -> 'lines') x group by 1) bq
                          left join (select x ->> 'variant_id' v, sum((x ->> 'qty')::numeric) q
                                       from jsonb_array_elements(a.after_state -> 'lines') x group by 1) nq
                            on nq.v = bq.v) || ' item(s) taken off'
                else a.after_state ->> 'kind' end
      from audit_log a
      left join app_user u on u.id = a.app_user_id
      left join app_user ap on ap.id::text = a.entity_id and a.action = 'approval.refused'
     where a.business_id = v_business
       and (a.action in ('bill.reduce', 'bill.line_remove', 'approval.refused')
            or (a.action = 'bill.cancel' and jsonb_typeof(a.before_state -> 'lines') = 'array'))
       and a.occurred_at >= b.from_ts and a.occurred_at < b.to_ts
       -- A bill's change is its branch's; a refused approval, the café's.
       and (v_loc is null or (a.action <> 'approval.refused'
                              and exists (select 1 from pos_tab t where t.id::text = a.entity_id and t.location_id = v_loc)))
     order by 1;
end $$;

-- 0051's what was bought.
create or replace function report_purchases(p_from date, p_to date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose the dates, the first on or before the last';
  end if;
  select * into b from local_day_bounds(v_business, p_from, p_to);
  return (
    with st as (
      select g.id, receipt_state(g.id) as s from goods_receipt g
       where g.business_id = v_business and (v_loc is null or g.location_id = v_loc)
    ),
    got as (
      select st.id, (st.s ->> 'supplier_id')::uuid as supplier_id, st.s -> 'lines' as lines
        from st
       where (st.s ->> 'received_on')::date between p_from and p_to
         and not coalesce((st.s ->> 'reversed')::boolean, false)
    ),
    lines as (
      select got.id as receipt_id, got.supplier_id, (x ->> 'item_id')::uuid as item_id,
             (x ->> 'base_qty')::numeric as qty, coalesce((x ->> 'landed')::numeric, (x ->> 'goods_value')::numeric) as value
        from got cross join lateral jsonb_array_elements(got.lines) x
    ),
    back as (
      select r.id as return_id, r.supplier_id, l.item_id, l.base_qty as qty, l.value
        from supplier_return r join supplier_return_line l on l.supplier_return_id = r.id
       where r.business_id = v_business and r.created_at >= b.from_ts and r.created_at < b.to_ts
         and (v_loc is null or r.location_id = v_loc)
    ),
    price as (
      select c.supplier_id, sum(c.amount) as amount from supplier_credit c
       where c.business_id = v_business and c.kind = 'price' and c.credit_date between p_from and p_to
         and (v_loc is null or supplier_credit_place(c) = v_loc)
       group by c.supplier_id
    ),
    billed as (
      select i.supplier_id, count(*) as bills, sum(i.amount_total) as amount from purchase_invoice i
       where i.business_id = v_business and i.cancelled_at is null
         and coalesce(i.invoice_date, business_local_date(v_business, i.created_at)) between p_from and p_to
         and (v_loc is null or exists (select 1 from goods_receipt g where g.id = i.goods_receipt_id and g.location_id = v_loc))
       group by i.supplier_id
    ),
    sup as (
      select s.id, s.name,
             (select count(distinct l.receipt_id) from lines l where l.supplier_id = s.id) as deliveries,
             coalesce((select sum(l.value) from lines l where l.supplier_id = s.id), 0) as received,
             coalesce((select sum(k.value) from back k where k.supplier_id = s.id), 0) as returned,
             coalesce((select p.amount from price p where p.supplier_id = s.id), 0) as price_credits,
             coalesce((select bi.bills from billed bi where bi.supplier_id = s.id), 0) as bills,
             coalesce((select bi.amount from billed bi where bi.supplier_id = s.id), 0) as billed
        from supplier s
       where s.business_id = v_business
         and (exists (select 1 from lines l where l.supplier_id = s.id)
              or exists (select 1 from back k where k.supplier_id = s.id)
              or exists (select 1 from price p where p.supplier_id = s.id)
              or exists (select 1 from billed bi where bi.supplier_id = s.id))
    ),
    itm as (
      select i.id, i.name, i.name_ar, i.name_ckb, i.base_unit_code,
             coalesce((select sum(l.qty) from lines l where l.item_id = i.id), 0) as qty,
             coalesce((select sum(l.value) from lines l where l.item_id = i.id), 0) as received,
             (select count(distinct l.supplier_id) from lines l where l.item_id = i.id) as suppliers,
             coalesce((select sum(k.qty) from back k where k.item_id = i.id), 0) as qty_back,
             coalesce((select sum(k.value) from back k where k.item_id = i.id), 0) as returned
        from item i
       where i.business_id = v_business
         and (exists (select 1 from lines l where l.item_id = i.id) or exists (select 1 from back k where k.item_id = i.id))
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to,
      'suppliers', coalesce((select jsonb_agg(jsonb_build_object(
                       'supplier_id', sup.id, 'name', sup.name, 'deliveries', sup.deliveries,
                       'received', money_round(v_business, sup.received), 'returned', sup.returned,
                       'price_credits', sup.price_credits,
                       'net', money_round(v_business, sup.received) - sup.returned - sup.price_credits,
                       'bills', sup.bills, 'billed', sup.billed)
                     order by sup.received desc, lower(sup.name)) from sup), '[]'::jsonb),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
                   'item_id', itm.id, 'name', itm.name, 'name_ar', itm.name_ar, 'name_ckb', itm.name_ckb,
                   'unit', itm.base_unit_code, 'qty', itm.qty, 'received', money_round(v_business, itm.received),
                   'unit_cost', case when itm.qty > 0 then round(itm.received / itm.qty, 4) end,
                   'suppliers', itm.suppliers, 'qty_back', itm.qty_back, 'returned', itm.returned,
                   'net', money_round(v_business, itm.received) - itm.returned)
                 order by itm.received desc, lower(itm.name)) from itm), '[]'::jsonb),
      'total', jsonb_build_object(
        'deliveries', (select count(distinct receipt_id) from lines),
        'received', money_round(v_business, coalesce((select sum(value) from lines), 0)),
        'returns', (select count(distinct return_id) from back),
        'returned', coalesce((select sum(value) from back), 0),
        'price_credits', coalesce((select sum(amount) from price), 0),
        'net', money_round(v_business, coalesce((select sum(value) from lines), 0))
               - coalesce((select sum(value) from back), 0) - coalesce((select sum(amount) from price), 0),
        'bills', coalesce((select sum(bills) from billed), 0),
        'billed', coalesce((select sum(amount) from billed), 0)))
  );
end $$;

-- 0043's dollars.
create or replace function report_dollars(p_from date, p_to date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record; r fx_rate; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose the dates, the first before the last';
  end if;
  b := local_day_bounds(v_business, p_from, p_to);
  r := usd_rate_row(v_business);
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'rate', jsonb_build_object('rate', r.rate, 'set_at', r.effective_from,
                               'set_by', (select full_name from app_user where id = r.set_by), 'reason', r.reason),
    'taken', (select jsonb_build_object('sales', count(distinct o.id), 'usd', coalesce(sum(t.foreign_amount), 0),
                                        'value', coalesce(sum(t.received), 0), 'paid', coalesce(sum(t.amount), 0),
                                        'change', coalesce(sum(t.change_given), 0))
                from sales_order o join sales_tender t on t.sales_order_id = o.id
               where o.business_id = v_business and t.currency = 'USD' and o.status not in ('voided', 'open')
                 and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
                 and (v_loc is null or o.location_id = v_loc)),
    'by_rate', (select coalesce(jsonb_agg(jsonb_build_object('rate', x.rate, 'sales', x.sales, 'usd', x.usd,
                                                             'value', x.value) order by x.rate), '[]'::jsonb)
                  from (select t.rate, count(distinct o.id) as sales, sum(t.foreign_amount) as usd,
                               sum(t.received) as value
                          from sales_order o join sales_tender t on t.sales_order_id = o.id
                         where o.business_id = v_business and t.currency = 'USD' and o.status not in ('voided', 'open')
                           and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
                           and (v_loc is null or o.location_id = v_loc)
                         group by t.rate) x),
    'rates', (select coalesce(jsonb_agg(jsonb_build_object('rate', f.rate, 'set_at', f.effective_from,
                                                           'set_by', u.full_name, 'reason', f.reason)
                                        order by f.effective_from desc, f.created_at desc), '[]'::jsonb)
                from fx_rate f left join app_user u on u.id = f.set_by
               where f.business_id = v_business and f.effective_from >= b.from_ts and f.effective_from < b.to_ts),
    'exchanges', (select coalesce(jsonb_agg(jsonb_build_object(
                     'id', x.id, 'at', x.created_at, 'from', x.from_place, 'to', x.to_place, 'usd', x.usd,
                     'value', x.value, 'received', x.received, 'difference', x.difference,
                     'rate', round(x.received / x.usd, 2), 'note', x.note, 'by', u.full_name,
                     'journal_no', j.journal_no) order by x.created_at desc, x.id), '[]'::jsonb)
                    from fx_exchange x left join app_user u on u.id = x.created_by
                    left join journal_entry j on j.id = x.journal_entry_id
                   where x.business_id = v_business and x.created_at >= b.from_ts and x.created_at < b.to_ts
                     and (v_loc is null or x.location_id = v_loc)),
    'counts', (select coalesce(jsonb_agg(jsonb_build_object(
                  'session_id', c.work_shift_id, 'session_no', w.session_no, 'at', c.created_at,
                  'location', l.name, 'expected', c.expected, 'counted', c.counted, 'variance', c.variance,
                  'variance_value', c.variance_value, 'taken', c.taken, 'taken_value', c.taken_value)
                  order by c.created_at desc), '[]'::jsonb)
                 from session_dollar_count c join work_shift w on w.id = c.work_shift_id
                 join location l on l.id = c.location_id
                where c.business_id = v_business and c.created_at >= b.from_ts and c.created_at < b.to_ts
                  and (v_loc is null or c.location_id = v_loc)),
    'differences', jsonb_build_object(
       'exchanges', (select coalesce(sum(difference), 0) from fx_exchange
                      where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts
                        and (v_loc is null or location_id = v_loc)),
       'counts', (select coalesce(sum(variance_value), 0) from session_dollar_count
                   where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts
                     and (v_loc is null or location_id = v_loc))),
    'held', jsonb_build_object(
       'tills', (select coalesce(jsonb_agg(jsonb_build_object('location_id', l.id, 'location', l.name,
                                                             'usd', h.usd, 'value', h.value) order by l.name),
                                 '[]'::jsonb)
                   from location l cross join lateral fx_place_balance(v_business, 'till', l.id) h
                  where l.business_id = v_business and (h.usd <> 0 or h.value <> 0)
                    and (v_loc is null or l.id = v_loc)),
       'safe', (select jsonb_build_object('usd', h.usd, 'value', h.value)
                  from fx_place_balance(v_business, 'safe', null) h)));
end $$;

-- 0044's purchasing.
create or replace function report_purchasing(p_from date, p_to date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose the dates, the first before the last';
  end if;
  b := local_day_bounds(v_business, p_from, p_to);
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'orders', coalesce((select jsonb_agg(jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'status', o.status,
                                                            'receiving', v ->> 'receiving', 'supplier', v ->> 'supplier',
                                                            'ordered', o.total,
                                                            'received', coalesce((select sum(g.value) from po_received(o.id) g), 0),
                                                            'created_at', o.ordered_at)
                                         order by o.po_no)
                          from purchase_order o cross join lateral po_view(o.id) v
                         where o.business_id = v_business and o.ordered_at >= b.from_ts and o.ordered_at < b.to_ts
                           and (v_loc is null or o.location_id = v_loc)),
                       '[]'::jsonb),
    'open', coalesce((select jsonb_agg(po_view(o.id) order by o.po_no)
                        from purchase_order o
                       where o.business_id = v_business and o.status in ('approved', 'sent')
                         and (v_loc is null or o.location_id = v_loc)), '[]'::jsonb),
    'price_changes', coalesce((
      with lines as (
        select r.id as receipt_id, r.receipt_no, r.received_at, (st ->> 'supplier_id')::uuid as supplier_id,
               (e ->> 'item_id')::uuid as item_id,
               sum((e ->> 'goods_value')::numeric) / nullif(sum((e ->> 'base_qty')::numeric), 0) as price
          from goods_receipt r
          cross join lateral receipt_state(r.id) st
          cross join lateral jsonb_array_elements(st -> 'lines') e
         where r.business_id = v_business and r.received_at < b.to_ts
           and (v_loc is null or r.location_id = v_loc)
         group by 1, 2, 3, 4, 5
      ),
      seq as (
        select l.*, lag(l.price) over (partition by l.supplier_id, l.item_id order by l.received_at, l.receipt_no) as before
          from lines l
      )
      select jsonb_agg(jsonb_build_object('receipt_no', q.receipt_no, 'received_at', q.received_at,
                                          'supplier', s.name, 'item', i.name, 'unit', i.base_unit_code,
                                          'before', round(q.before, 4), 'now', round(q.price, 4),
                                          'change_percent', round((q.price - q.before) / q.before * 100, 1))
                       order by q.received_at, q.receipt_no, i.name)
        from seq q join item i on i.id = q.item_id left join supplier s on s.id = q.supplier_id
       where q.received_at >= b.from_ts and q.before > 0 and q.price is not null and q.price <> q.before),
      '[]'::jsonb),
    'returns', coalesce((select jsonb_agg(jsonb_build_object(
                            'return_id', x.id, 'return_no', x.return_no, 'at', x.created_at, 'supplier', s.name,
                            'receipt_no', r.receipt_no, 'reason', x.reason, 'value', x.value,
                            'stock_value', x.stock_value, 'against', x.against,
                            'credit_no', (select credit_no from supplier_credit where supplier_return_id = x.id),
                            'lines', (select jsonb_agg(jsonb_build_object('item', i.name, 'qty', rl.qty,
                                                                          'unit_code', rl.unit_code, 'value', rl.value)
                                                       order by i.name)
                                        from supplier_return_line rl join item i on i.id = rl.item_id
                                       where rl.supplier_return_id = x.id))
                          order by x.return_no)
                           from supplier_return x join supplier s on s.id = x.supplier_id
                           left join goods_receipt r on r.id = x.goods_receipt_id
                          where x.business_id = v_business and x.created_at >= b.from_ts and x.created_at < b.to_ts
                            and (v_loc is null or x.location_id = v_loc)),
                        '[]'::jsonb),
    'credits', coalesce((select jsonb_agg(jsonb_build_object(
                            'credit_id', c.id, 'credit_no', c.credit_no, 'date', c.credit_date, 'supplier', s.name,
                            'kind', c.kind, 'supplier_ref', c.supplier_ref, 'reason', c.reason, 'amount', c.amount,
                            'set_against', a.used, 'left', c.amount - a.used)
                          order by c.credit_no)
                           from supplier_credit c join supplier s on s.id = c.supplier_id
                           cross join lateral (select coalesce(sum(amount), 0) as used from supplier_credit_allocation
                                                where supplier_credit_id = c.id) a
                          where c.business_id = v_business and c.credit_date between p_from and p_to
                            and (v_loc is null or supplier_credit_place(c) = v_loc)), '[]'::jsonb),
    'totals', jsonb_build_object(
       'returned', coalesce((select sum(value) from supplier_return
                              where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts
                                and (v_loc is null or location_id = v_loc)), 0),
       'credited', coalesce((select sum(c.amount) from supplier_credit c
                              where c.business_id = v_business and c.credit_date between p_from and p_to
                                and (v_loc is null or supplier_credit_place(c) = v_loc)), 0),
       'credits_left', coalesce((select sum(c.amount - a.used)
                                   from supplier_credit c
                                   cross join lateral (select coalesce(sum(amount), 0) as used
                                                         from supplier_credit_allocation where supplier_credit_id = c.id) a
                                  where c.business_id = v_business
                                    and (v_loc is null or supplier_credit_place(c) = v_loc)), 0)));
end $$;

-- 0054's production.
create or replace function report_production(p_from date, p_to date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view'); v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
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
         and business_local_date(v_business, coalesce(b.produced_at, b.created_at)) between p_from and p_to
         and (v_loc is null or b.location_id = v_loc)),
      '[]'::jsonb));
end $$;

-- 0049's staff: the people who work at the place, its share of the payroll.
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

-- 0050's customers: the points and sales on the place's sales.
create or replace function report_customers(p_from date, p_to date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('customer.view'); b record;
  v_outstanding bigint; v_loc uuid;
begin
  v_loc := report_place(v_business, p_location);
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose the dates, the first on or before the last';
  end if;
  select * into b from local_day_bounds(v_business, p_from, p_to);
  select coalesce(sum(greatest(x.p, 0)), 0) into v_outstanding
    from (select sum(points) as p from loyalty_ledger where business_id = v_business group by customer_id) x;
  return jsonb_build_object(
    'points', (select jsonb_build_object(
        'earned', coalesce(sum(points) filter (where kind = 'earn'), 0),
        'spent', coalesce(-sum(points) filter (where kind = 'redeem'), 0),
        'taken_back', coalesce(-sum(points) filter (where kind = 'earn_back'), 0),
        'given_back', coalesce(sum(points) filter (where kind = 'redeem_back'), 0),
        'given_by_hand', coalesce(sum(points) filter (where kind = 'adjust' and points > 0), 0),
        'taken_by_hand', coalesce(-sum(points) filter (where kind = 'adjust' and points < 0), 0),
        'rewards', count(*) filter (where kind = 'redeem'),
        'rewards_value', coalesce(sum(value) filter (where kind = 'redeem'), 0))
        from loyalty_ledger ll
       where ll.business_id = v_business and ll.created_at >= b.from_ts and ll.created_at < b.to_ts
         -- Points earned or spent on a sale are its branch's; given by hand, the café's.
         and (v_loc is null or exists (select 1 from sales_order o
                                        where o.id = coalesce(ll.sales_order_id,
                                                              (select a.sales_order_id from sale_adjustment a where a.id = ll.sale_refund_id))
                                          and o.location_id = v_loc))),
    'outstanding', v_outstanding,
    'outstanding_value', money_round(v_business, v_outstanding / loyalty_rule(v_business, 'loyalty_reward_points')
                                                  * loyalty_rule(v_business, 'loyalty_reward_value')),
    'customers', (select count(*) from customer where business_id = v_business and is_active),
    'new_customers', (select count(*) from customer
                       where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts),
    'sales', (select jsonb_build_object('orders', coalesce(sum(s.orders), 0), 'net', coalesce(sum(s.spent), 0))
                from customer_sales(v_business, b.from_ts, b.to_ts, v_loc) s),
    'top', coalesce((select jsonb_agg(jsonb_build_object('customer_id', c.id, 'name', c.full_name,
                                                         'orders', s.orders, 'spent', s.spent,
                                                         'points', customer_points(c.id))
                                      order by s.spent desc, lower(c.full_name))
                       from (select * from customer_sales(v_business, b.from_ts, b.to_ts, v_loc)
                              order by spent desc limit 10) s
                       join customer c on c.id = s.customer_id), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 3. The reports that already took a place: someone at one place reads theirs
-- ---------------------------------------------------------------------------
-- 0051's sales analysis, 0051's stock value and 0039's usage against the
-- recipes, kept as they are under their release's name, read through
-- report_place.
alter function report_sales_analysis(date, date, text, text, sales_channel, uuid, uuid, uuid)
  rename to report_sales_analysis_0051;
alter function inventory_valuation(date, uuid) rename to inventory_valuation_0051;
alter function report_usage_variance(date, date, uuid) rename to report_usage_variance_0039;

create or replace function report_sales_analysis(p_from date, p_to date, p_by text, p_then text default null,
                                                 p_channel sales_channel default null, p_location uuid default null,
                                                 p_category uuid default null, p_cashier uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  return report_sales_analysis_0051(p_from, p_to, p_by, p_then, p_channel, report_place(v_business, p_location),
                                    p_category, p_cashier);
end $$;

create or replace function inventory_valuation(p_as_of date, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  return inventory_valuation_0051(p_as_of, report_place(v_business, p_location));
end $$;

create or replace function report_usage_variance(p_from date, p_to date, p_location uuid default null)
returns table (item_id uuid, name text, unit text, counts integer, opened_at timestamptz, closed_at timestamptz,
               opening numeric, closing numeric, received numeric, made numeric, transferred numeric,
               opening_stock numeric, corrected numeric, sold numeric, batches numeric, theoretical numeric,
               lost numeric, losses jsonb, actual numeric, variance numeric, variance_percent numeric,
               unit_cost numeric, variance_value numeric, products jsonb, recipes jsonb, factors text[])
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view');
begin
  return query select * from report_usage_variance_0039(p_from, p_to, report_place(v_business, p_location)) u;
end $$;

-- ---------------------------------------------------------------------------
-- 4. The dashboard of someone who works at one place is that place's day
-- ---------------------------------------------------------------------------
-- 0056's dashboard: for someone who works everywhere, the café's, as before;
-- for someone at one place, its sales and their costs (0056), its orders, the
-- stock it holds, and its items low or below zero.
create or replace function dashboard_summary(p_day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view'); b record; v_rev numeric; v_cos numeric; v_orders bigint;
  v_loc uuid;
begin
  v_loc := report_place(v_business, null);
  b := local_day_bounds(v_business, p_day, p_day);
  if v_loc is null then
    select coalesce(sum(case when a.account_type = 'revenue' then l.credit - l.debit end), 0),
           coalesce(sum(case when a.code like '5%' then l.debit - l.credit end), 0)
      into v_rev, v_cos
      from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id
     where e.business_id = v_business and e.status = 'published' and e.occurred_at >= b.from_ts and e.occurred_at < b.to_ts
       and not year_end_entry(e);
  else
    select coalesce(sum(case when a.account_type = 'revenue' then -p.amount end), 0),
           coalesce(sum(case when a.code like '5%' then p.amount end), 0)
      into v_rev, v_cos
      from pnl_by_place(v_business, b.from_ts, b.to_ts) p join gl_account a on a.id = p.account_id
     where p.location_id = v_loc;
  end if;
  select count(*) into v_orders from sales_order
   where business_id = v_business and status not in ('voided', 'open') and placed_at >= b.from_ts and placed_at < b.to_ts
     and (v_loc is null or location_id = v_loc);
  return jsonb_build_object(
    'net_revenue', v_rev, 'cost_of_sales', v_cos, 'gross_profit', v_rev - v_cos, 'orders', v_orders,
    'average_order', case when v_orders > 0 then round(v_rev / v_orders) else 0 end,
    'inventory_value', case when v_loc is null then gl_balance_at(v_business, '1200', b.to_ts)
                            else (select coalesce(sum(m.value * sign(m.base_quantity_signed)), 0) from inventory_movement m
                                   where m.business_id = v_business and m.location_id = v_loc and m.occurred_at < b.to_ts)
                       end,
    'low_stock', (select count(*) from (
                    select s.item_id from stock_board s
                     where s.business_id = v_business and (v_loc is null or s.location_id = v_loc)
                     group by s.item_id having sum(s.quantity_base) < coalesce(max(s.min_level_base), 0)) x),
    'negative_stock', (select count(distinct s.item_id) from stock_board s
                        where s.business_id = v_business and s.is_negative
                          and (v_loc is null or s.location_id = v_loc)),
    'location', (select name from location where id = v_loc));
end $$;

-- ---------------------------------------------------------------------------
-- 5. Who may call what
-- ---------------------------------------------------------------------------
-- The helpers and the reports kept under their release's name are called
-- inside, never by hand.
revoke execute on function
  supplier_credit_place(supplier_credit), customer_sales(uuid, timestamptz, timestamptz, uuid),
  report_sales_analysis_0051(date, date, text, text, sales_channel, uuid, uuid, uuid),
  inventory_valuation_0051(date, uuid), report_usage_variance_0039(date, date, uuid)
  from public, anon, authenticated;
-- The reports made anew, open to signed-in people; each checks its permission.
revoke execute on function
  report_daily_sales(date, date, uuid), report_payments(date, date, uuid), report_uncosted_sales(date, date, uuid),
  report_losses(date, date, uuid), report_sizes_and_addons(date, date, uuid), report_exceptions(date, date, uuid),
  report_purchases(date, date, uuid), report_dollars(date, date, uuid), report_purchasing(date, date, uuid),
  report_production(date, date, uuid), report_staff(date, date, uuid), report_customers(date, date, uuid),
  report_sales_analysis(date, date, text, text, sales_channel, uuid, uuid, uuid), inventory_valuation(date, uuid),
  report_usage_variance(date, date, uuid)
  from public, anon;
grant execute on function
  report_daily_sales(date, date, uuid), report_payments(date, date, uuid), report_uncosted_sales(date, date, uuid),
  report_losses(date, date, uuid), report_sizes_and_addons(date, date, uuid), report_exceptions(date, date, uuid),
  report_purchases(date, date, uuid), report_dollars(date, date, uuid), report_purchasing(date, date, uuid),
  report_production(date, date, uuid), report_staff(date, date, uuid), report_customers(date, date, uuid),
  report_sales_analysis(date, date, text, text, sales_channel, uuid, uuid, uuid), inventory_valuation(date, uuid),
  report_usage_variance(date, date, uuid)
  to authenticated;
