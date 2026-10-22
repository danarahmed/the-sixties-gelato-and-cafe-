-- =============================================================================
-- 0094 — The watch list (SMART_PLAN part 2, step 10)
-- =============================================================================
-- Patterns a person may be hiding, found from the café's own records and set
-- against everyone else's at the same hours; shown to the owner (and the
-- general manager, if the owner allows it) as "worth a look", never as an
-- accusation, each with its evidence and how unusual it is. The owner marks
-- each explained or looked into.
--
--  * Voided sales far more often than the others who sold at the same hours
--    (the busy evening has more honest voids for everyone: each person is
--    set against those hours, not the whole day).
--  * Discounts just under the limit a cashier may give alone (within two
--    points of it), again and again, with the same reason — set against how
--    often the others gave that reason at those hours (a promotion everyone
--    gives in the afternoon is the afternoon's normal, not one person's).
--  * The drawer short by 5,000 IQD or more again and again, or on the same
--    weekday twice or more, when the others' are not.
--  * Each is shown only with enough cases to mean something and when the
--    chance of it by luck is less than 1 in 10,000 (Poisson, from what the
--    others' rates would give); "strong" below 1 in 1,000,000.
--  * Someone new is not judged in their first three weeks, while they learn.
--  * Worked out once a day (the database's timer, where it has one; else when
--    the list is opened and the last look is more than 20 hours old) over the
--    four weeks to yesterday's end. A finding settled is not raised again for
--    two weeks.
--  * The phone and the Dashboard say only that something strong is worth a
--    look, with no name: the names are for those who may read the list.
--
--  * watch_state, watch_finding; watch_scan (internal, as at a moment),
--    watch_refresh, watch_tick, watch_list, settle_watch_finding,
--    set_watch_visibility, watch_may_see; alert rule watch_strong.
--
-- Nothing recorded changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The tables
-- -----------------------------------------------------------------------------
create table if not exists watch_state (
  business_id uuid primary key references business (id) on delete cascade,
  scanned_at  timestamptz,
  -- The owner lets the general manager read the list too (Settings → Rules).
  gm_sees     boolean not null default false
);

create table if not exists watch_finding (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  app_user_id  uuid not null references app_user (id),
  kind         text not null check (kind in ('voids', 'discounts', 'drawer_short')),
  -- Discounts: the reason they were given with; the rest: ''.
  detail_key   text not null default '',
  first_seen   date not null,
  last_seen    date not null,
  window_from  date not null,
  window_to    date not null,
  observed     numeric not null,
  expected     numeric not null,
  cases        int not null,
  chance       float8 not null,
  strength     text not null check (strength in ('strong', 'worth_a_look')),
  evidence     jsonb not null default '{}',
  status       text not null default 'open' check (status in ('open', 'explained', 'looked_into')),
  settled_by   uuid references app_user (id),
  settled_at   timestamptz,
  note         text,
  created_at   timestamptz not null default now()
);
create unique index if not exists watch_finding_open
  on watch_finding (business_id, app_user_id, kind, detail_key) where status = 'open';
create index if not exists watch_finding_business on watch_finding (business_id, last_seen desc);

alter table watch_state enable row level security;
alter table watch_finding enable row level security;
alter table watch_state force row level security;
alter table watch_finding force row level security;
-- Read through the functions below only.
revoke all on watch_state, watch_finding from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. The chance of so many by luck
-- -----------------------------------------------------------------------------
-- (internal) P(X >= k) for X Poisson with mean p_mean.
create or replace function poisson_at_least(p_k int, p_mean float8) returns float8
language plpgsql immutable set search_path = public as $$
declare v_term float8; v_sum float8 := 0; i int;
begin
  if p_k <= 0 then return 1; end if;
  if p_mean <= 0 then return 0; end if;
  v_term := exp(-p_mean);
  for i in 0..p_k - 1 loop
    v_sum := v_sum + v_term;
    v_term := v_term * p_mean / (i + 1);
  end loop;
  return greatest(1 - v_sum, 0);
end $$;

-- -----------------------------------------------------------------------------
-- 3. What stands out, as at a moment
-- -----------------------------------------------------------------------------
-- (internal) Over the four weeks to the end of the day before p_as_of (each
-- person's from their fourth week on), what stands out.
create or replace function watch_scan(p_business uuid, p_as_of timestamptz)
returns table (app_user_id uuid, who text, kind text, detail_key text, window_from date, window_to date,
               observed numeric, expected numeric, cases int, chance float8, evidence jsonb)
language plpgsql stable set search_path = public as $$
declare
  v_tz text := (select timezone from business where id = p_business);
  v_to date := (p_as_of at time zone v_tz)::date - 1;
  v_from date := v_to - 27;
  v_end timestamptz := ((v_to + 1)::timestamp at time zone v_tz);
  v_cap numeric := coalesce((select discount_cap_percent from business where id = p_business), 10);
begin
  return query
  with starts as (
    -- When each person began here: their first sale, or the day they were hired.
    select o.cashier_id as person,
           least(min((o.placed_at at time zone v_tz)::date),
                 coalesce(min(e.hired_on), 'infinity'::date)) as began
      from sales_order o
      left join employee e on e.app_user_id = o.cashier_id and e.business_id = p_business
     where o.business_id = p_business and o.placed_at < v_end
     group by o.cashier_id
  ),
  sales as (
    select o.id, o.cashier_id as person, o.location_id as loc, o.placed_at,
           (o.placed_at at time zone v_tz)::date as day,
           extract(hour from o.placed_at at time zone v_tz)::int / 4 as band,
           o.discount_percent, coalesce(o.discount_reason, '') as reason,
           exists (select 1 from sale_adjustment a where a.sales_order_id = o.id and a.kind = 'void'
                     and a.created_at < v_end) as voided
      from sales_order o
     where o.business_id = p_business and o.cashier_id is not null
       and o.placed_at >= (v_from::timestamp at time zone v_tz) and o.placed_at < v_end
  ),
  judged as (
    -- Each person's own window: from their fourth week on.
    select s.*, greatest(v_from, st.began + 21) as own_from
      from sales s join starts st on st.person = s.person
  ),
  mine as (select * from judged where day >= own_from),
  -- ------------------------------------------------------------ voids
  v_band as (
    select loc, band, count(*) as n, count(*) filter (where voided) as v from sales group by loc, band
  ),
  v_person as (
    select m.person, m.loc, m.band, count(*) as n, count(*) filter (where m.voided) as v, min(m.own_from) as own_from
      from mine m group by m.person, m.loc, m.band
  ),
  voids as (
    select p.person, min(p.own_from) as own_from, sum(p.n)::int as n, sum(p.v)::int as v,
           sum(p.n * greatest((b.v - p.v)::numeric / nullif(b.n - p.n, 0), 0.0005)) as e
      from v_person p join v_band b on b.loc = p.loc and b.band = p.band
     group by p.person
  ),
  -- ------------------------------------------------------------ discounts near the limit, by reason
  d_band as (
    select loc, band, reason, count(*) filter (where discount_percent >= v_cap - 2 and discount_percent < v_cap) as d
      from sales group by loc, band, reason
  ),
  d_all as (select loc, band, count(*) as n from sales group by loc, band),
  d_person as (
    select m.person, m.loc, m.band, count(*) as n, min(m.own_from) as own_from from mine m group by m.person, m.loc, m.band
  ),
  d_person_reason as (
    select m.person, m.loc, m.band, m.reason,
           count(*) filter (where m.discount_percent >= v_cap - 2 and m.discount_percent < v_cap) as d
      from mine m group by m.person, m.loc, m.band, m.reason
  ),
  reasons as (select distinct reason from d_band where d > 0),
  discounts as (
    select p.person, r.reason, min(p.own_from) as own_from, sum(p.n)::int as n,
           coalesce(sum(pr.d), 0)::int as d,
           sum(p.n * greatest((coalesce(b.d, 0) - coalesce(pr.d, 0))::numeric / nullif(a.n - p.n, 0), 0.0005)) as e
      from d_person p cross join reasons r
      join d_all a on a.loc = p.loc and a.band = p.band
      left join d_band b on b.loc = p.loc and b.band = p.band and b.reason = r.reason
      left join d_person_reason pr on pr.person = p.person and pr.loc = p.loc and pr.band = p.band and pr.reason = r.reason
     group by p.person, r.reason
  ),
  -- ------------------------------------------------------------ the drawer short
  shifts as (
    select w.id, w.cashier_id as person, w.variance, (w.closed_at at time zone v_tz)::date as day,
           extract(isodow from (w.opened_at at time zone v_tz))::int as wd,
           extract(hour from w.opened_at at time zone v_tz)::int / 8 as part,
           greatest(v_from, st.began + 21) as own_from
      from work_shift w join starts st on st.person = w.cashier_id
     where w.business_id = p_business and w.kind = 'session' and w.closed_at is not null
       and w.closed_at >= (v_from::timestamp at time zone v_tz) and w.closed_at < v_end
  ),
  short_all as (select count(*) as n, count(*) filter (where variance <= -5000) as s from shifts),
  short_person as (
    select s.person, min(s.own_from) as own_from, count(*)::int as n,
           count(*) filter (where s.variance <= -5000)::int as s,
           coalesce(-sum(s.variance) filter (where s.variance <= -5000), 0) as amount,
           coalesce(max(x.same), 0)::int as same,
           (array_agg(x.wd order by x.same desc) filter (where x.same is not null))[1] as same_wd
      from shifts s
      left join (select person, wd, part, count(*) as same from shifts
                  where variance <= -5000 and day >= own_from group by person, wd, part) x
             on x.person = s.person and x.wd = s.wd and x.part = s.part
     where s.day >= s.own_from
     group by s.person
  )
  select v.person, u.full_name, 'voids'::text, ''::text, v.own_from, v_to, v.v::numeric, round(v.e, 2), v.v,
         poisson_at_least(v.v, v.e::float8),
         jsonb_build_object('sales', v.n, 'voids', v.v, 'expected', round(v.e, 2),
                            'times', round(v.v / nullif(v.e, 0), 1))
    from voids v join app_user u on u.id = v.person
   where v.n >= 50 and v.own_from <= v_to - 13 and v.v >= 8 and v.v >= 2.5 * v.e
     and poisson_at_least(v.v, v.e::float8) < 0.0001
  union all
  select d.person, u.full_name, 'discounts', d.reason, d.own_from, v_to, d.d::numeric, round(d.e, 2), d.d,
         poisson_at_least(d.d, d.e::float8),
         jsonb_build_object('sales', d.n, 'discounts', d.d, 'expected', round(d.e, 2), 'reason', d.reason,
                            'from', v_cap - 2, 'below', v_cap, 'times', round(d.d / nullif(d.e, 0), 1))
    from discounts d join app_user u on u.id = d.person
   where d.n >= 50 and d.own_from <= v_to - 13 and d.d >= 8 and d.d >= 3 * d.e
     and poisson_at_least(d.d, d.e::float8) < 0.0001
  union all
  select sp.person, u.full_name, 'drawer_short', '', sp.own_from, v_to, sp.s::numeric,
         round(sp.n * coalesce(((select s from short_all) - sp.s)::numeric
                                / nullif((select n from short_all) - sp.n, 0), 0), 2),
         sp.s,
         poisson_at_least(sp.s, greatest(sp.n * coalesce(((select s from short_all) - sp.s)::numeric
                                                          / nullif((select n from short_all) - sp.n, 0), 0), 0.05)::float8),
         jsonb_build_object('shifts', sp.n, 'short', sp.s, 'amount', sp.amount, 'same_weekday', sp.same,
                            'weekday', sp.same_wd)
    from short_person sp join app_user u on u.id = sp.person
   where sp.own_from <= v_to - 13 and (sp.same >= 2 or sp.s >= 3)
     and poisson_at_least(sp.s, greatest(sp.n * coalesce(((select s from short_all) - sp.s)::numeric
                                                          / nullif((select n from short_all) - sp.n, 0), 0), 0.05)::float8) < 0.0001;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Kept up to date
-- -----------------------------------------------------------------------------
-- (internal) The findings brought up to date as at now: one still standing
-- out is updated, a new one raised unless the same was settled in the last two
-- weeks; one that no longer stands out stays until it is settled.
create or replace function watch_refresh(p_business uuid) returns int
language plpgsql set search_path = public as $$
declare r record; n int := 0; v_today date;
begin
  v_today := business_local_date(p_business, now());
  for r in select * from watch_scan(p_business, now()) loop
    update watch_finding f
       set last_seen = v_today, window_from = r.window_from, window_to = r.window_to, observed = r.observed,
           expected = r.expected, cases = r.cases, chance = r.chance,
           strength = case when r.chance < 1e-6 then 'strong' else 'worth_a_look' end, evidence = r.evidence
     where f.business_id = p_business and f.app_user_id = r.app_user_id and f.kind = r.kind
       and f.detail_key = r.detail_key and f.status = 'open';
    if not found and not exists (
         select 1 from watch_finding f
          where f.business_id = p_business and f.app_user_id = r.app_user_id and f.kind = r.kind
            and f.detail_key = r.detail_key and f.settled_at > now() - interval '14 days') then
      insert into watch_finding (business_id, app_user_id, kind, detail_key, first_seen, last_seen, window_from,
                                 window_to, observed, expected, cases, chance, strength, evidence)
      values (p_business, r.app_user_id, r.kind, r.detail_key, v_today, v_today, r.window_from, r.window_to,
              r.observed, r.expected, r.cases, r.chance,
              case when r.chance < 1e-6 then 'strong' else 'worth_a_look' end, r.evidence);
      n := n + 1;
    end if;
  end loop;
  insert into watch_state (business_id, scanned_at) values (p_business, now())
  on conflict (business_id) do update set scanned_at = excluded.scanned_at;
  return n;
end $$;

-- (internal) Every café's, once a day by the database's timer.
create or replace function watch_tick() returns int
language plpgsql security definer set search_path = public as $$
declare b record; n int := 0;
begin
  for b in select id from business loop
    n := n + watch_refresh(b.id);
  end loop;
  return n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sixties-watch';
    -- 00:30 UTC: 03:30 in Erbil, after the café has closed.
    perform cron.schedule('sixties-watch', '30 0 * * *', 'select public.watch_tick()');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Who may read it, and the list
-- -----------------------------------------------------------------------------
-- The owner; the general manager when the owner allows it.
create or replace function watch_may_see() returns boolean
language sql stable security definer set search_path = public as $$
  select current_business_id() is not null
     and (current_has_role('owner')
          or (current_has_role('general_manager')
              and coalesce((select gm_sees from watch_state where business_id = current_business_id()), false)))
$$;

-- (the owner) Whether the general manager reads the list too.
create or replace function set_watch_visibility(p_gm_sees boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_business uuid := current_business_id();
begin
  if v_business is null or not current_has_role('owner') then
    raise exception 'Only the owner says who reads the watch list' using errcode = '42501';
  end if;
  insert into watch_state (business_id, gm_sees) values (v_business, coalesce(p_gm_sees, false))
  on conflict (business_id) do update set gm_sees = excluded.gm_sees;
  perform audit_event(v_business, 'settings.watch_visibility', 'business', v_business::text, null, null,
                      jsonb_build_object('gm_sees', coalesce(p_gm_sees, false)));
  return coalesce(p_gm_sees, false);
end $$;

-- (who may) The findings open, the strongest first, and those settled in the
-- last 30 days; brought up to date first when the last look is old.
create or replace function watch_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := current_business_id();
begin
  if not watch_may_see() then
    raise exception 'The watch list is for the owner' using errcode = '42501';
  end if;
  if coalesce((select scanned_at from watch_state where business_id = v_business), '-infinity') < now() - interval '20 hours' then
    perform watch_refresh(v_business);
  end if;
  return jsonb_build_object(
    'scanned_at', (select scanned_at from watch_state where business_id = v_business),
    'gm_sees', coalesce((select gm_sees from watch_state where business_id = v_business), false),
    'findings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'person', u.full_name, 'app_user_id', f.app_user_id, 'kind', f.kind,
               'reason', nullif(f.detail_key, ''), 'first_seen', f.first_seen, 'last_seen', f.last_seen,
               'from', f.window_from, 'to', f.window_to, 'observed', f.observed, 'expected', f.expected,
               'cases', f.cases, 'chance', f.chance, 'strength', f.strength, 'evidence', f.evidence,
               'status', f.status, 'settled_at', f.settled_at, 'settled_by', s.full_name, 'note', f.note)
             order by (f.status = 'open') desc, (f.strength = 'strong') desc, f.chance, f.first_seen desc)
        from watch_finding f join app_user u on u.id = f.app_user_id
        left join app_user s on s.id = f.settled_by
       where f.business_id = v_business
         and (f.status = 'open' or f.settled_at > now() - interval '30 days')), '[]'::jsonb));
end $$;

-- (who may) A finding marked explained or looked into, with a note.
create or replace function settle_watch_finding__run(p_finding uuid, p_status text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := current_business_id(); f watch_finding;
begin
  if not watch_may_see() then
    raise exception 'The watch list is for the owner' using errcode = '42501';
  end if;
  if p_status not in ('explained', 'looked_into') then raise exception 'Mark it explained or looked into'; end if;
  select * into f from watch_finding where id = p_finding and business_id = v_business for update;
  if not found then raise exception 'That finding is not on the watch list'; end if;
  if f.status <> 'open' then raise exception 'That finding is settled already'; end if;
  update watch_finding set status = p_status, settled_by = (current_member()).id, settled_at = now(),
         note = nullif(trim(coalesce(p_note, '')), '')
   where id = f.id;
  perform audit_event(v_business, 'watch.settle', 'watch_finding', f.id::text, nullif(trim(coalesce(p_note, '')), ''),
                      null, jsonb_build_object('status', p_status, 'kind', f.kind));
  return jsonb_build_object('id', f.id, 'status', p_status);
end $$;

create or replace function settle_watch_finding(p_finding uuid, p_status text, p_note text default null,
                                                p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_finding', p_finding, 'p_status', p_status, 'p_note', p_note);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'settle_watch_finding', v_req);
  if v is not null then return v; end if;
  v := settle_watch_finding__run(p_finding, p_status, p_note);
  perform idem_finish(v_business, p_idempotency_key, 'settle_watch_finding', v_req, v);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 6. The phone and the Dashboard: something strong, no name
-- -----------------------------------------------------------------------------
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0093;
revoke execute on function alert_conditions_0093(uuid, timestamptz) from public, anon, authenticated;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0093(p_business, p_now) c
  union all
  select 'watch_strong'::text, max(f.first_seen)::text, 'orange'::text,
         format('%s thing(s) on the watch list worth a look', count(*)),
         'A pattern far from what the others do at the same hours, by more than luck would give.',
         'Open the watch list (the owner).', 'medium', '/reports/watch',
         jsonb_build_object('count', count(*))
    from watch_finding f
   where f.business_id = p_business and f.status = 'open' and f.strength = 'strong'
  having count(*) > 0
$$;

-- -----------------------------------------------------------------------------
-- 7. Who may call what
-- -----------------------------------------------------------------------------
revoke execute on function poisson_at_least(int, float8), watch_scan(uuid, timestamptz), watch_refresh(uuid),
  watch_tick(), settle_watch_finding__run(uuid, text, text), alert_conditions(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function watch_may_see(), set_watch_visibility(boolean), watch_list(),
  settle_watch_finding(uuid, text, text, uuid) from public, anon;
grant execute on function watch_may_see(), set_watch_visibility(boolean), watch_list(),
  settle_watch_finding(uuid, text, text, uuid) to authenticated;
