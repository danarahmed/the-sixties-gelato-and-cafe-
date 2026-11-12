-- 0104: comparing cashiers (plan 5 F). The owner (12 November): agreed;
-- cashiers do not see it (the owner and managers only).
--
-- One scorecard for a period, a row for each person who took the money: their
-- sales, bills, average bill, items and add-ons per bill, hours worked (from
-- the clock), sales per hour worked, voids, refunds and discounts they gave,
-- and their drawers' over or short. Ranked fairly: their sales per hour
-- against what the café usually sells in the same hours of the same weekdays
-- (the eight weeks before), since a Friday evening sells more than a Tuesday
-- morning: 100 is as usual, 120 a fifth more.
--
-- Nothing recorded changes.

create or replace function report_cashier_scorecard(p_from date, p_to date, p_location uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  b record; base record; v_tz text;
begin
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Choose the days, from and to'; end if;
  if p_to - p_from > 366 then raise exception 'Choose a year at most'; end if;
  if not current_has_permission('staff.manage') and not current_has_role('owner') then
    raise exception 'The cashier scorecard is for the owner and the managers' using errcode = '42501';
  end if;
  b := local_day_bounds(v_business, p_from, p_to);
  base := local_day_bounds(v_business, p_from - 56, p_from - 1);
  v_tz := (select timezone from business where id = v_business);
  return jsonb_build_object('from', p_from, 'to', p_to, 'location', p_location, 'cashiers', coalesce((
    with sales as (
      select o.* from sales_order o
       where o.business_id = v_business and o.status not in ('voided', 'open')
         and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
         and (p_location is null or o.location_id = p_location)
    ),
    -- What the café usually takes in each hour of each weekday, over the eight weeks before.
    usual as (
      select extract(isodow from o.placed_at at time zone v_tz)::int as dow,
             extract(hour from o.placed_at at time zone v_tz)::int as hr,
             sum(o.net_amount) / 8.0 as per_hour
        from sales_order o
       where o.business_id = v_business and o.status not in ('voided', 'open')
         and o.placed_at >= base.from_ts and o.placed_at < base.to_ts
         and (p_location is null or o.location_id = p_location)
       group by 1, 2
    ),
    -- Each person's clocked hours in the period, cut to it, by the hour of the day.
    worked as (
      select e.app_user_id, h.at, h.minutes
        from attendance a
        join employee e on e.id = a.employee_id
        cross join lateral (
          select g as at,
                 extract(epoch from least(g + interval '1 hour', coalesce(a.clock_out, now()), b.to_ts)
                                  - greatest(g, a.clock_in, b.from_ts)) / 60.0 as minutes
            from generate_series(date_trunc('hour', greatest(a.clock_in, b.from_ts)),
                                 least(coalesce(a.clock_out, now()), b.to_ts), interval '1 hour') g
        ) h
       where a.business_id = v_business and a.cancelled_at is null and e.app_user_id is not null
         and a.clock_in < b.to_ts and coalesce(a.clock_out, now()) > b.from_ts
         and (p_location is null or a.location_id = p_location)
         and h.minutes > 0
    ),
    hours as (
      select w.app_user_id, sum(w.minutes) / 60.0 as hours,
             sum(w.minutes / 60.0 * coalesce(u.per_hour, 0)) as expected
        from worked w
        left join usual u on u.dow = extract(isodow from w.at at time zone v_tz)::int
                         and u.hr = extract(hour from w.at at time zone v_tz)::int
       group by 1
    ),
    people as (
      select cashier_id as id from sales where cashier_id is not null
      union select app_user_id from hours
    ),
    rows as (
      select p.id,
             (select full_name from app_user where id = p.id) as name,
             (select count(*) from sales s where s.cashier_id = p.id) as bills,
             (select coalesce(sum(s.net_amount), 0) from sales s where s.cashier_id = p.id) as sales,
             (select coalesce(sum(l.quantity), 0) from sales_order_line l join sales s on s.id = l.sales_order_id
               where s.cashier_id = p.id) as items,
             (select count(*) from sales_order_line_modifier m join sales s on s.id = m.sales_order_id
               where s.cashier_id = p.id) as addons,
             (select count(*) from sale_adjustment sa
               where sa.business_id = v_business and sa.kind = 'void' and sa.requested_by = p.id
                 and sa.created_at >= b.from_ts and sa.created_at < b.to_ts) as voids,
             (select count(*) from sale_adjustment sa
               where sa.business_id = v_business and sa.kind = 'refund' and sa.requested_by = p.id
                 and sa.created_at >= b.from_ts and sa.created_at < b.to_ts) as refunds,
             (select count(*) from sales s where s.discount_by = p.id) as discounts,
             (select coalesce(sum(s.discount_amount), 0) from sales s where s.discount_by = p.id) as discounted,
             (select coalesce(sum(ws.variance), 0) from work_shift ws
               where ws.business_id = v_business and ws.closed_at >= b.from_ts and ws.closed_at < b.to_ts
                 and coalesce(ws.cashier_id, ws.opened_by) = p.id
                 and (p_location is null or ws.location_id = p_location)) as drawer,
             coalesce(h.hours, 0) as hours, coalesce(h.expected, 0) as expected
        from people p left join hours h on h.app_user_id = p.id
    )
    select jsonb_agg(jsonb_build_object(
             'member_id', r.id, 'name', r.name, 'bills', r.bills, 'sales', r.sales,
             'average_bill', case when r.bills > 0 then round(r.sales / r.bills) end,
             'items_per_bill', case when r.bills > 0 then round(r.items / r.bills, 1) end,
             'addons_per_bill', case when r.bills > 0 then round(r.addons::numeric / r.bills, 2) end,
             'hours', round(r.hours, 1),
             'sales_per_hour', case when r.hours > 0 then round(r.sales / r.hours) end,
             'against_usual', case when r.expected > 0 then round(r.sales / r.expected * 100) end,
             'voids', r.voids, 'refunds', r.refunds, 'discounts', r.discounts, 'discounted', r.discounted,
             'drawer', r.drawer)
           order by (case when r.expected > 0 then r.sales / r.expected end) desc nulls last, r.sales desc)
      from rows r
     where r.bills > 0 or r.hours > 0), '[]'::jsonb));
end $$;

revoke execute on function report_cashier_scorecard(date, date, uuid) from public, anon;
grant execute on function report_cashier_scorecard(date, date, uuid) to authenticated;
