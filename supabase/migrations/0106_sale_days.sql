-- 0106: sale days (plan 5 E). The owner (12 November): "N% off, from this day
-- to that day", hours optional, on everything or with some categories left
-- out; a banner and the new prices at the till, the saving on the receipt.
--
-- How it is kept:
--   * A sale day is a name, a percentage, the days it runs (and, if given, the
--     hours of each day) and the categories it leaves out. It ends by itself;
--     it can be stopped early. Two sale days are never on at once.
--   * The till gives it as the bill's discount, with the reason "Sale day" and
--     the sale day's name: on each line's own price (add-ons and meal deals at
--     theirs), never on top of another discount: the bigger one wins.
--   * The books are as for any discount: the full price to 4000, the discount
--     to 4100, the service charge on the price after it, points on what was
--     paid, and a refund gives back what was paid.
--   * While a sale day is on, a discount up to its percentage needs nobody's
--     approval (the cap of whoever gives it is at least the sale day's).
--   * Its result: what was sold while it was on, against the same days and
--     hours of the weeks before, the discount it gave and the profit gained or
--     lost.
--
-- Nothing recorded changes.

insert into reason_code (kind, code, label, sort_order) values ('discount', 'sale_day', 'Sale day', 6)
on conflict (kind, code) do nothing;

create table if not exists sale_day (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references business(id) on delete cascade,
  name                text not null check (length(trim(name)) between 1 and 80),
  percent             numeric(5, 2) not null check (percent > 0 and percent <= 90),
  starts_on           date not null,
  ends_on             date not null,
  from_time           time,
  to_time             time,
  excluded_categories uuid[] not null default '{}',
  created_by          uuid references app_user(id),
  created_at          timestamptz not null default now(),
  stopped_at          timestamptz,
  stopped_by          uuid references app_user(id),
  constraint sale_day_days check (ends_on >= starts_on),
  constraint sale_day_hours check ((from_time is null) = (to_time is null) and (from_time is null or from_time < to_time))
);
create index if not exists sale_day_business on sale_day (business_id, starts_on);
alter table sale_day enable row level security;
alter table sale_day force row level security;

-- When a sale day's days and hours begin and end, in the café's time.
create or replace function sale_day_bounds(s sale_day, out from_ts timestamptz, out to_ts timestamptz)
language sql stable set search_path = public as $$
  select (s.starts_on + coalesce(s.from_time, time '00:00'))::timestamp at time zone b.timezone,
         least(case when s.to_time is null then (s.ends_on + 1)::timestamp at time zone b.timezone
                    else (s.ends_on + s.to_time)::timestamp at time zone b.timezone end,
               coalesce(s.stopped_at, 'infinity'::timestamptz))
    from business b where b.id = s.business_id
$$;

-- True when the moment is one of the sale day's days and hours, and it has not been stopped.
create or replace function sale_day_on(s sale_day, p_at timestamptz) returns boolean
language sql stable set search_path = public as $$
  select (s.stopped_at is null or p_at < s.stopped_at)
     and (p_at at time zone b.timezone)::date between s.starts_on and s.ends_on
     and (s.from_time is null
          or ((p_at at time zone b.timezone)::time >= s.from_time and (p_at at time zone b.timezone)::time < s.to_time))
    from business b where b.id = s.business_id
$$;

-- The sale day on now, if any.
create or replace function sale_day_current(p_business uuid, p_at timestamptz default now()) returns sale_day
language sql stable security definer set search_path = public as $$
  select s.* from sale_day s
   where s.business_id = p_business and sale_day_on(s, p_at)
   order by s.percent desc, s.created_at limit 1
$$;

-- 0040's member_rule_number: while a sale day is on, the discount cap is at least its percentage.
alter function member_rule_number(uuid, text, uuid) rename to member_rule_number_0105;
create or replace function member_rule_number(p_business uuid, p_key text, p_member uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select case when p_key = 'discount_cap_percent'
              then greatest(member_rule_number_0105(p_business, p_key, p_member),
                            coalesce((sale_day_current(p_business)).percent, 0))
              else member_rule_number_0105(p_business, p_key, p_member) end
$$;

-- A sale day as the screens show it.
create or replace function sale_day_json(s sale_day) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'percent', s.percent, 'starts_on', s.starts_on, 'ends_on', s.ends_on,
    'from_time', to_char(s.from_time, 'HH24:MI'), 'to_time', to_char(s.to_time, 'HH24:MI'),
    'excluded_categories', to_jsonb(s.excluded_categories),
    'excluded_names', coalesce((select jsonb_agg(c.name order by c.name) from product_category c
                                 where c.id = any (s.excluded_categories)), '[]'::jsonb),
    'stopped_at', s.stopped_at,
    'status', case when s.stopped_at is not null and s.stopped_at <= now() then 'stopped'
                   when sale_day_on(s, now()) then 'on'
                   when (sale_day_bounds(s)).to_ts <= now() then 'ended'
                   when (sale_day_bounds(s)).from_ts > now() then 'planned'
                   else 'between' end)
$$;

-- A new sale day, or one that has not begun yet changed.
create or replace function save_sale_day(p_id uuid, p_name text, p_percent numeric, p_starts_on date, p_ends_on date,
                                         p_from_time time default null, p_to_time time default null,
                                         p_excluded uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_me uuid := (current_member()).id;
  v_today date := business_local_date(v_business, now());
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_excluded uuid[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_excluded, '{}')) x where x is not null), '{}');
  s sale_day; v_before jsonb; v_other text;
begin
  if v_name = '' then raise exception 'Give the sale day a name'; end if;
  if length(v_name) > 80 then raise exception 'A name is at most 80 letters'; end if;
  if p_percent is null or p_percent <= 0 or p_percent > 90 then
    raise exception '%', format('A sale day takes from %s%% to %s%% off', 1, 90);
  end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on then
    raise exception 'Choose the days, from and to';
  end if;
  if p_ends_on - p_starts_on > 60 then raise exception 'A sale day runs two months at most'; end if;
  if (p_from_time is null) <> (p_to_time is null) or (p_from_time is not null and p_from_time >= p_to_time) then
    raise exception 'Choose the hours, from and to, on the same day';
  end if;
  if exists (select 1 from unnest(v_excluded) x
              where not exists (select 1 from product_category c where c.id = x and c.business_id = v_business)) then
    raise exception 'Choose one of the café''s categories';
  end if;
  if p_id is not null then
    select * into s from sale_day where id = p_id and business_id = v_business for update;
    if s.id is null then raise exception 'That sale day is not one of the café''s'; end if;
    if s.stopped_at is not null or (sale_day_bounds(s)).from_ts <= now() then
      raise exception 'A sale day that has begun is not changed: stop it, and start another';
    end if;
    v_before := sale_day_json(s);
  end if;
  if p_starts_on < v_today then raise exception 'A sale day begins today or later'; end if;
  select o.name into v_other from sale_day o
   where o.business_id = v_business and o.id is distinct from p_id
     and (o.stopped_at is null or o.stopped_at > now())
     and o.starts_on <= p_ends_on and o.ends_on >= p_starts_on
     and (o.from_time is null or p_from_time is null or (o.from_time < p_to_time and p_from_time < o.to_time))
   limit 1;
  if v_other is not null then
    raise exception '%', format('Another sale day is on then: %s', v_other);
  end if;
  if p_id is null then
    insert into sale_day (business_id, name, percent, starts_on, ends_on, from_time, to_time, excluded_categories,
                          created_by)
    values (v_business, v_name, p_percent, p_starts_on, p_ends_on, p_from_time, p_to_time, v_excluded, v_me)
    returning * into s;
  else
    update sale_day set name = v_name, percent = p_percent, starts_on = p_starts_on, ends_on = p_ends_on,
                        from_time = p_from_time, to_time = p_to_time, excluded_categories = v_excluded
     where id = p_id returning * into s;
  end if;
  perform audit_event(v_business, 'sale_day.save', 'sale_day', s.id::text, null, v_before, sale_day_json(s));
  return sale_day_json(s);
end $$;

-- A sale day stopped now: one on ends, one not begun never begins.
create or replace function stop_sale_day(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  s sale_day; v_before jsonb;
begin
  select * into s from sale_day where id = p_id and business_id = v_business for update;
  if s.id is null then raise exception 'That sale day is not one of the café''s'; end if;
  if s.stopped_at is not null or (sale_day_bounds(s)).to_ts <= now() then
    raise exception 'That sale day is over already';
  end if;
  v_before := sale_day_json(s);
  update sale_day set stopped_at = now(), stopped_by = (current_member()).id where id = p_id returning * into s;
  perform audit_event(v_business, 'sale_day.stop', 'sale_day', s.id::text, null, v_before, sale_day_json(s));
  return sale_day_json(s);
end $$;

-- The café's sale days, the newest first.
create or replace function sale_days() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(sale_day_json(s) order by s.starts_on desc, s.created_at desc), '[]'::jsonb)
    from sale_day s
   where s.business_id = current_business_id()
     and (current_has_permission('settings.manage') or current_has_permission('profit.view'))
$$;

-- The sale day on now, for the till: its name, percentage and the categories it leaves out.
create or replace function sale_day_now() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); s sale_day;
begin
  s := sale_day_current(v_business);
  if s.id is null then return null; end if;
  return sale_day_json(s) || jsonb_build_object('ends_at', (sale_day_bounds(s)).to_ts);
end $$;

-- A sale day's result: while it was on (so far, if it still is), against the
-- same days and hours of the weeks just before it.
create or replace function report_sale_day(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  s sale_day; v_from timestamptz; v_to timestamptz; v_weeks int; v_shift interval; v_tz text;
  v_during jsonb; v_before jsonb;
begin
  select * into s from sale_day where id = p_id and business_id = v_business;
  if s.id is null then raise exception 'That sale day is not one of the café''s'; end if;
  select from_ts, least(to_ts, now()) into v_from, v_to from sale_day_bounds(s);
  v_tz := (select timezone from business where id = v_business);
  v_weeks := greatest(1, ceil((s.ends_on - s.starts_on + 1) / 7.0)::int);
  v_shift := make_interval(weeks => v_weeks);
  if v_to <= v_from then
    return jsonb_build_object('sale_day', sale_day_json(s), 'begun', false);
  end if;
  with windows as (
    select 'during' as w, v_from as f, v_to as t
    union all select 'before', v_from - v_shift, v_to - v_shift
  ),
  sold as (
    select w.w, o.*
      from windows w
      join sales_order o on o.business_id = v_business and o.status not in ('voided', 'open')
                        and o.placed_at >= w.f and o.placed_at < w.t
     where s.from_time is null
        or ((o.placed_at at time zone v_tz)::time >= s.from_time and (o.placed_at at time zone v_tz)::time < s.to_time)
  ),
  totals as (
    select w.w,
           count(o.id) as bills,
           coalesce(sum(o.gross_amount), 0) as full_price,
           coalesce(sum(o.discount_amount), 0) as discount,
           coalesce(sum(o.discount_amount) filter (where o.discount_reason like 'Sale day%'), 0) as sale_day_discount,
           count(o.id) filter (where o.discount_reason like 'Sale day%') as sale_day_bills,
           coalesce(sum(o.net_amount), 0) as sales,
           coalesce(sum(o.cogs_amount), 0) as cost
      from windows w left join sold o on o.w = w.w
     group by w.w
  )
  select jsonb_object_agg(t.w, jsonb_build_object(
           'bills', t.bills, 'full_price', t.full_price, 'discount', t.discount,
           'sale_day_discount', t.sale_day_discount, 'sale_day_bills', t.sale_day_bills,
           'sales', t.sales, 'cost', t.cost, 'profit', t.sales - t.cost))
    into v_during from totals t;
  v_before := v_during -> 'before';
  v_during := v_during -> 'during';
  return jsonb_build_object(
    'sale_day', sale_day_json(s), 'begun', true,
    'from', v_from, 'to', v_to, 'weeks_before', v_weeks,
    'during', v_during, 'before', v_before,
    'sales_change', (v_during ->> 'sales')::numeric - (v_before ->> 'sales')::numeric,
    'bills_change', (v_during ->> 'bills')::int - (v_before ->> 'bills')::int,
    'profit_change', (v_during ->> 'profit')::numeric - (v_before ->> 'profit')::numeric);
end $$;

revoke execute on function sale_day_bounds(sale_day), sale_day_on(sale_day, timestamptz),
  sale_day_current(uuid, timestamptz), member_rule_number(uuid, text, uuid), member_rule_number_0105(uuid, text, uuid),
  sale_day_json(sale_day) from public, anon, authenticated;
revoke execute on function save_sale_day(uuid, text, numeric, date, date, time, time, uuid[]), stop_sale_day(uuid),
  sale_days(), sale_day_now(), report_sale_day(uuid) from public, anon;
grant execute on function save_sale_day(uuid, text, numeric, date, date, time, time, uuid[]), stop_sale_day(uuid),
  sale_days(), sale_day_now(), report_sale_day(uuid) to authenticated;
