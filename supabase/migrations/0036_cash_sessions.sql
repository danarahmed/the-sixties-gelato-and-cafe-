-- =============================================================================
-- 0036 — The drawer in sessions, counted blind (release K)
--
-- Until now the drawer belonged to a branch: a count swept up every movement
-- of cash since the last one, and the Sales screen showed what the drawer
-- should hold before anyone counted it (docs/COMPLETION_PLAN.md, D2). Now:
--   * Each branch has a drawer. A cashier opens a session on it by counting
--     what is in it, and closes the session by counting again. Whoever counts
--     is not shown what the drawer should hold until their count is in; the
--     answer then shows it, with the difference.
--   * Cash cannot move without an open session. A cash sale, a cash refund,
--     the void of a cash sale, money paid out of the till and cash moved in or
--     out of it are refused until the drawer is open, and each joins the open
--     session as it happens.
--   * A difference when the drawer opens (against what the last session left)
--     or closes (against what it should hold) posts to 6300 Cash over/short,
--     for that session. The takings go to the safe or the bank after the
--     close, as after a drawer count.
--   * A session is handed over (closed, and the next opened with what was
--     left in the drawer), and a manager may close one left open, with a
--     reason, counted or not.
--   * Every sale made while a session is open names it, so each session's
--     card takings and orders are known too.
--   * Only the owner, general managers, accountants and auditors see what an
--     open drawer should hold (cash.view_expected, COMPLETION_PLAN §L.3 #2).
--   * The first session on a drawer takes over from the drawer counts: the
--     cash moved since the last count (or, after days closed the old way, what
--     the books say the till holds) is counted at its opening, as a drawer
--     count of its own.
--   * From now on a write that takes a retry key (0035) refuses a call through
--     the API without one. Calls from SQL, and a write's own inner calls, are
--     not affected.
-- Also: the alerts and the daily brief know sessions (one left open too long,
-- one short, one closed by a manager). count_drawer and drawer_status serve
-- the old Sales screen until the new one is deployed: count_drawer closes the
-- open session, and neither shows what the drawer should hold without the
-- permission. count_drawer is revoked in the next release.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Who may open a drawer, see what it should hold, and close one left open
-- ---------------------------------------------------------------------------
insert into role_permission (role, permission)
select r::app_role, p from (values
  ('owner','cash.session'),('general_manager','cash.session'),('branch_manager','cash.session'),
  ('cashier','cash.session'),('barista','cash.session'),
  ('owner','cash.view_expected'),('general_manager','cash.view_expected'),
  ('accountant','cash.view_expected'),('auditor','cash.view_expected'),
  ('owner','cash.session.force'),('general_manager','cash.session.force'),('branch_manager','cash.session.force')
) as v(r, p)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Drawers: one per branch to begin with (COMPLETION_PLAN §L.3 #1)
-- ---------------------------------------------------------------------------
create table if not exists cash_drawer (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references business (id) on delete cascade,
  location_id uuid not null references location (id),
  name        text not null default 'Till',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists cash_drawer_one_per_location on cash_drawer (location_id) where is_active;
alter table cash_drawer enable row level security;
alter table cash_drawer force row level security;
drop policy if exists member_read on cash_drawer;
create policy member_read on cash_drawer for select to authenticated
  using (business_id = (select current_business_id()));
grant select on cash_drawer to authenticated;

insert into cash_drawer (business_id, location_id)
select l.business_id, l.id from location l
 where not exists (select 1 from cash_drawer d where d.location_id = l.id and d.is_active);

-- A new branch gets its drawer.
create or replace function trg_location_drawer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into cash_drawer (business_id, location_id) values (NEW.business_id, NEW.id);
  return NEW;
end $$;
drop trigger if exists location_drawer on location;
create trigger location_drawer after insert on location
  for each row execute function trg_location_drawer();

-- ---------------------------------------------------------------------------
-- 3. Sessions
-- ---------------------------------------------------------------------------
-- A session is opened by counting the drawer and closed by counting it again.
-- opening_expected is what the last session left in it; the close's
-- expected_cash is the opening count and every movement of cash in the
-- session. Once closed it never changes (the guard of 0014).
alter table work_shift add column if not exists drawer_id uuid references cash_drawer (id);
alter table work_shift add column if not exists session_no bigint;
alter table work_shift add column if not exists cashier_id uuid references app_user (id);
alter table work_shift add column if not exists opening_counted numeric;
alter table work_shift add column if not exists opening_expected numeric;
alter table work_shift add column if not exists opening_variance numeric;
alter table work_shift add column if not exists opening_denominations jsonb;
alter table work_shift add column if not exists closing_denominations jsonb;
alter table work_shift add column if not exists closed_by uuid references app_user (id);
alter table work_shift add column if not exists forced_reason text;
-- The count this session's opening came from when that count closed something
-- else: the session handed over to this one, or the drawer counts it took
-- over from.
alter table work_shift add column if not exists opened_from uuid references work_shift (id);

alter table work_shift drop constraint if exists work_shift_kind_ok;
alter table work_shift add constraint work_shift_kind_ok check (kind in ('day', 'drawer', 'session'));
alter table work_shift drop constraint if exists work_shift_session_ok;
alter table work_shift add constraint work_shift_session_ok check (
  kind <> 'session' or (drawer_id is not null and session_no is not null and cashier_id is not null
                        and opening_counted is not null and opening_counted >= 0));
-- One open session per drawer, numbered per business.
create unique index if not exists work_shift_one_open_session on work_shift (drawer_id)
  where kind = 'session' and closed_at is null;
create unique index if not exists work_shift_session_no on work_shift (business_id, session_no)
  where session_no is not null;

-- The open session on a branch's drawer, if any.
create or replace function open_session_at(p_business uuid, p_location uuid) returns uuid
language sql stable set search_path = public as $$
  select w.id from work_shift w join cash_drawer d on d.id = w.drawer_id
   where w.business_id = p_business and d.location_id = p_location and d.is_active
     and w.kind = 'session' and w.closed_at is null
$$;

-- ---------------------------------------------------------------------------
-- 4. Every sale made while a session is open names it
-- ---------------------------------------------------------------------------
alter table sales_order drop constraint if exists sales_order_shift_fk;
alter table sales_order add constraint sales_order_shift_fk foreign key (shift_id) references work_shift (id);
create index if not exists sales_order_shift_idx on sales_order (shift_id) where shift_id is not null;

create or replace function trg_sales_order_session() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  NEW.shift_id := open_session_at(NEW.business_id, NEW.location_id);
  return NEW;
end $$;
drop trigger if exists sales_order_session on sales_order;
create trigger sales_order_session before insert on sales_order
  for each row execute function trg_sales_order_session();

-- ---------------------------------------------------------------------------
-- 5. Cash moves only in an open session, and joins it as it happens
-- ---------------------------------------------------------------------------
-- The session is locked in share mode: a close waits for the cash already on
-- its way in, and cash that comes after the close finds no open session.
create or replace function trg_cash_event_session() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_session uuid;
begin
  select w.id into v_session
    from work_shift w join cash_drawer d on d.id = w.drawer_id
   where w.business_id = NEW.business_id and d.location_id = NEW.location_id and d.is_active
     and w.kind = 'session' and w.closed_at is null
     for share of w;
  if v_session is null then
    raise exception 'Open the drawer first: on the till, count the cash in it';
  end if;
  NEW.work_shift_id := v_session;
  return NEW;
end $$;
drop trigger if exists cash_event_session on cash_event;
create trigger cash_event_session before insert on cash_event
  for each row execute function trg_cash_event_session();

-- An open drawer's movements are read only by those who may see what it
-- should hold; once its session is closed, by everyone who reads the ledger.
drop policy if exists cost_read on cash_event;
create policy cost_read on cash_event for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view'))
         and ((select current_has_permission('cash.view_expected'))
              or exists (select 1 from work_shift w where w.id = cash_event.work_shift_id and w.closed_at is not null)));

-- ---------------------------------------------------------------------------
-- 6. What the drawer should hold
-- ---------------------------------------------------------------------------
-- With a session open: its opening count and every movement in it. Otherwise,
-- as 0024: what the last session or count left, and any movement not yet
-- counted (which can only date from before sessions).
create or replace function drawer_position(p_business uuid, p_location uuid,
  out last_count_id uuid, out last_count_at timestamptz, out carry numeric, out needs_start boolean,
  out moved numeric, out events int)
language plpgsql stable set search_path = public as $$
declare w work_shift; v_open uuid := open_session_at(p_business, p_location);
begin
  if v_open is not null then
    select * into w from work_shift where id = v_open;
    last_count_id := w.id;
    last_count_at := w.opened_at;
    carry := w.opening_counted;
    needs_start := false;
    select coalesce(sum(amount), 0), count(*)::int into moved, events from cash_event where work_shift_id = v_open;
    return;
  end if;
  select * into w from work_shift
   where business_id = p_business and location_id = p_location and closed_at is not null
   order by closed_at desc, id desc limit 1;
  last_count_id := w.id;
  last_count_at := w.closed_at;
  if w.id is not null and w.kind in ('drawer', 'session') then
    carry := coalesce(w.left_in_drawer, 0);
    needs_start := false;
  elsif w.id is null and not exists (
          select 1 from sales_order o join sales_tender t on t.sales_order_id = o.id and t.tender_type = 'cash'
           where o.business_id = p_business and o.location_id = p_location and o.status <> 'voided'
             and not exists (select 1 from cash_event e where e.reference_type = 'sales_order' and e.reference_id = o.id)) then
    carry := 0;
    needs_start := false;
  else
    carry := null;
    needs_start := true;
  end if;
  select coalesce(sum(amount), 0), count(*)::int into moved, events
    from cash_event where business_id = p_business and location_id = p_location and work_shift_id is null;
end $$;

-- Paying out of the till: the drawer must be open and hold the money. Only
-- those who may see what it should hold are told how much that is.
create or replace function assert_drawer_can_pay(p_business uuid, p_location uuid, p_amount numeric) returns void
language plpgsql set search_path = public as $$
declare d record;
begin
  if open_session_at(p_business, p_location) is null then
    raise exception 'Open the drawer first: on the till, count the cash in it';
  end if;
  d := drawer_position(p_business, p_location);
  if d.carry + d.moved < p_amount then
    if current_has_permission('cash.view_expected') then
      raise exception 'The drawer should hold only % — not enough to pay %. Move cash into the till first, or pay from the safe, the bank or the owner',
        trim_scale(d.carry + d.moved), trim_scale(p_amount);
    end if;
    raise exception 'The drawer does not hold enough to pay %. Move cash into the till first, or pay from the safe, the bank or the owner',
      trim_scale(p_amount);
  end if;
end $$;

-- A session's movements of cash, by kind, and its card takings and orders.
create or replace function session_figures(p_session uuid,
  out moved numeric, out cash_sales numeric, out refunds numeric, out voids numeric, out paid_out numeric,
  out cash_in numeric, out cash_out numeric, out events int, out card numeric, out orders int)
language sql stable set search_path = public as $$
  select coalesce(sum(e.amount), 0),
         coalesce(sum(e.amount) filter (where e.kind = 'sale'), 0),
         coalesce(-sum(e.amount) filter (where e.kind = 'refund'), 0),
         coalesce(-sum(e.amount) filter (where e.kind = 'void'), 0),
         coalesce(-sum(e.amount) filter (where e.kind in ('paid_out', 'paid_out_reversed')), 0),
         coalesce(sum(e.amount) filter (where e.kind = 'cash_in'), 0),
         coalesce(-sum(e.amount) filter (where e.kind = 'cash_out'), 0),
         count(e.id)::int,
         (select coalesce(sum(tn.amount), 0) from sales_order o join sales_tender tn on tn.sales_order_id = o.id
           where o.shift_id = p_session and o.status <> 'voided' and tn.tender_type = 'card'),
         (select count(*)::int from sales_order o where o.shift_id = p_session and o.status <> 'voided')
    from cash_event e where e.work_shift_id = p_session
$$;

-- ---------------------------------------------------------------------------
-- 7. Opening and closing
-- ---------------------------------------------------------------------------
-- The cash counted: its total and, when the notes are given (the note's value
-- -> how many of it), they must come to that total.
create or replace function counted_cash(p_business uuid, p_counted numeric, p_notes jsonb) returns numeric
language plpgsql stable set search_path = public as $$
declare v numeric := money_round(p_business, p_counted); v_sum numeric := 0; r record; n numeric;
begin
  if v is null or v < 0 then raise exception 'Enter the cash you counted'; end if;
  if p_notes is null or p_notes = '{}'::jsonb then return v; end if;
  if jsonb_typeof(p_notes) <> 'object' then raise exception 'The notes counted cannot be read'; end if;
  for r in select key, value from jsonb_each(p_notes) loop
    if r.key !~ '^[0-9]+(\.[0-9]+)?$' or jsonb_typeof(r.value) <> 'number' then
      raise exception 'The notes counted cannot be read';
    end if;
    n := (r.value #>> '{}')::numeric;
    if r.key::numeric <= 0 or n < 0 or n <> trunc(n) then raise exception 'The notes counted cannot be read'; end if;
    v_sum := v_sum + r.key::numeric * n;
  end loop;
  if v_sum <> v then
    raise exception 'The notes counted come to %, not the % entered', trim_scale(v_sum), trim_scale(v);
  end if;
  return v;
end $$;

-- Open a session on a branch's drawer, for a cashier, with what is in it now.
-- Against what the last session left, the difference goes to 6300, for this
-- session. The first session takes over from the drawer counts: the cash moved
-- since the last count (or, after days closed the old way, what the books say
-- the till holds) is counted now, by a drawer count of its own that closes
-- where this session opens. p_from: the session handed over to this one.
create or replace function open_session_internal(p_business uuid, p_location uuid, p_cashier uuid, p_by uuid,
                                                 p_counted numeric, p_notes jsonb, p_from uuid)
returns jsonb language plpgsql set search_path = public as $$
declare
  dr cash_drawer; s work_shift; d record;
  v_counted numeric := counted_cash(p_business, p_counted, p_notes);
  v_id uuid := gen_random_uuid(); v_no bigint; v_from uuid := p_from; v_take uuid;
  v_expected numeric; v_variance numeric; v_start numeric; v_others numeric;
  s_expected numeric; s_variance numeric; v_journal uuid;
begin
  select * into dr from cash_drawer where location_id = p_location and business_id = p_business and is_active for update;
  if not found then raise exception 'This branch has no drawer'; end if;
  select * into s from work_shift where drawer_id = dr.id and kind = 'session' and closed_at is null;
  if found then
    raise exception 'The drawer is already open: session % since %, with %', s.session_no,
      to_char(s.opened_at at time zone (select timezone from business where id = p_business), 'HH24:MI'),
      (select full_name from app_user where id = s.cashier_id);
  end if;
  d := drawer_position(p_business, p_location);
  v_expected := d.carry;
  if d.needs_start or d.events > 0 then
    if d.needs_start then
      -- After days closed the old way, the books know what the till holds:
      -- 1000, less what the business's other drawers should hold.
      select coalesce(sum(x.carry + x.moved), 0) into v_others
        from location l cross join lateral drawer_position(p_business, l.id) x
       where l.business_id = p_business and l.id <> p_location and not x.needs_start;
      v_expected := gl_balance_at(p_business, '1000', 'infinity') - v_others;
      v_start := v_expected - d.moved;
    else
      v_start := d.carry;
      v_expected := d.carry + d.moved;
    end if;
    v_take := gen_random_uuid();
    v_variance := v_counted - v_expected;
    insert into work_shift (id, business_id, location_id, opened_by, opened_at, closed_at, opening_float,
                            business_day, kind, covers_from, counted_cash, expected_cash, variance,
                            left_in_drawer, taken_out, closed_by)
    values (v_take, p_business, p_location, p_by,
            coalesce(d.last_count_at,
                     (select min(created_at) from cash_event
                       where business_id = p_business and location_id = p_location and work_shift_id is null),
                     now()),
            now(), v_start, business_local_date(p_business, now()), 'drawer', d.last_count_at,
            v_counted, v_expected, v_variance, v_counted, 0, p_by);
    update cash_event set work_shift_id = v_take
     where business_id = p_business and location_id = p_location and work_shift_id is null;
    if v_variance <> 0 then
      v_journal := post_journal(p_business, now(), 'Cash over/short — the drawer counted as sessions began',
        'work_shift', v_take, jsonb_build_array(signed_line('1000', v_variance), signed_line('6300', -v_variance)));
    end if;
    v_from := v_take;
    s_expected := v_counted;
    s_variance := 0;
  else
    v_variance := v_counted - v_expected;
    s_expected := v_expected;
    s_variance := v_variance;
  end if;

  v_no := next_document_no(p_business, 'session', 1);
  insert into work_shift (id, business_id, location_id, drawer_id, kind, session_no, cashier_id, opened_by, opened_at,
                          opening_float, opening_counted, opening_expected, opening_variance, opening_denominations,
                          business_day, covers_from, opened_from)
  values (v_id, p_business, p_location, dr.id, 'session', v_no, p_cashier, p_by, now(),
          v_counted, v_counted, s_expected, s_variance, nullif(p_notes, '{}'::jsonb),
          business_local_date(p_business, now()), d.last_count_at, v_from);
  if s_variance <> 0 then
    v_journal := post_journal(p_business, now(), 'Cash over/short — session ' || v_no || ' opened',
      'session_opening', v_id, jsonb_build_array(signed_line('1000', s_variance), signed_line('6300', -s_variance)));
  end if;
  return jsonb_build_object('session_id', v_id, 'session_no', v_no, 'opened_at', now(), 'cashier_id', p_cashier,
    'counted', v_counted, 'expected', v_expected, 'variance', v_variance, 'took_over', v_take is not null,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- Close a session, counted: the answer shows what it should have held and
-- the difference. Closed by a manager without a count (p_counted null),
-- everything it should hold stays in the drawer for the next opening count to
-- find. What does not stay goes to the safe or the bank.
create or replace function close_session_internal(p_business uuid, p_session uuid, p_by uuid, p_counted numeric,
                                                  p_notes jsonb, p_left numeric, p_take_to text, p_forced_reason text)
returns jsonb language plpgsql set search_path = public as $$
declare
  s work_shift; f record; v_counted numeric; v_left numeric; v_taken numeric := 0; v_expected numeric;
  v_variance numeric; v_to text := lower(nullif(trim(p_take_to), '')); v_journal uuid; v_transfer uuid;
  v_take_journal uuid;
begin
  select * into s from work_shift where id = p_session and business_id = p_business and kind = 'session' for update;
  if not found then raise exception 'Session not found'; end if;
  if s.closed_at is not null then raise exception 'Session % is already closed', s.session_no; end if;
  f := session_figures(p_session);
  v_expected := s.opening_counted + f.moved;
  if p_counted is null then
    v_left := v_expected;
  else
    v_counted := counted_cash(p_business, p_counted, p_notes);
    v_left := money_round(p_business, coalesce(p_left, v_counted));
    if v_left < 0 or v_left > v_counted then
      raise exception 'What stays in the drawer must be between 0 and the % counted', trim_scale(v_counted);
    end if;
    v_taken := v_counted - v_left;
    if v_taken > 0 and v_to is distinct from 'safe' and v_to is distinct from 'bank' then
      raise exception 'Say where the rest of the cash goes: the safe or the bank';
    end if;
    v_variance := v_counted - v_expected;
  end if;
  update work_shift
     set closed_at = now(), closed_by = p_by, counted_cash = v_counted, expected_cash = v_expected,
         variance = v_variance, left_in_drawer = v_left, taken_out = v_taken,
         taken_to = case when v_taken > 0 then v_to end, closing_denominations = nullif(p_notes, '{}'::jsonb),
         forced_reason = p_forced_reason
   where id = p_session;
  if coalesce(v_variance, 0) <> 0 then
    v_journal := post_journal(p_business, now(), 'Cash over/short — session ' || s.session_no || ' closed',
      'work_shift', p_session, jsonb_build_array(signed_line('1000', v_variance), signed_line('6300', -v_variance)));
  end if;
  -- The takings leave the till after the count; the next session opens with
  -- what stayed.
  if v_taken > 0 then
    v_transfer := gen_random_uuid();
    v_take_journal := post_journal(p_business, now(), 'Takings to the ' || v_to || ' after session ' || s.session_no,
      'cash_transfer', v_transfer,
      jsonb_build_array(jsonb_build_object('code', payment_account(v_to), 'debit', v_taken),
                        jsonb_build_object('code', '1000', 'credit', v_taken)));
    insert into cash_transfer (id, business_id, location_id, from_place, to_place, amount, note, work_shift_id,
                               journal_entry_id, created_by)
    values (v_transfer, p_business, s.location_id, 'till', v_to, v_taken, 'Takings after session ' || s.session_no,
            p_session, v_take_journal, p_by);
  end if;
  return jsonb_build_object('session_id', p_session, 'session_no', s.session_no, 'opening', s.opening_counted,
    'expected', v_expected, 'counted', v_counted, 'variance', v_variance, 'left', v_left, 'taken', v_taken,
    'taken_to', case when v_taken > 0 then v_to end,
    'cash_sales', f.cash_sales, 'refunds', f.refunds, 'voids', f.voids, 'paid_out', f.paid_out,
    'cash_in', f.cash_in, 'cash_out', f.cash_out, 'card', f.card, 'orders', f.orders,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- ---------------------------------------------------------------------------
-- 8. What the till calls
-- ---------------------------------------------------------------------------
-- Open the drawer, counting what is in it. A manager may put in a float from
-- the safe at the same time (after the count, so the count is of what the
-- last session left).
create or replace function open_cash_session(p_counted numeric, p_denominations jsonb default null,
                                             p_float_from_safe numeric default null, p_location uuid default null,
                                             p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cash.session');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('p_counted', p_counted, 'p_denominations', p_denominations,
                                    'p_float_from_safe', p_float_from_safe, 'p_location', p_location);
  v jsonb; v_location uuid; v_add numeric; v_transfer uuid; v_journal uuid;
begin
  v := idem_begin(v_business, p_idempotency_key, 'open_cash_session', v_req);
  if v is not null then return v; end if;
  v_location := resolve_location(v_business, p_location);
  v_add := money_round(v_business, coalesce(p_float_from_safe, 0));
  if v_add < 0 then raise exception 'Enter the cash put in from the safe, or leave it empty'; end if;
  if v_add > 0 and not (current_has_permission('day.close') or current_has_permission('accounting.post')) then
    raise exception 'Only a manager puts cash in from the safe' using errcode = '42501';
  end if;
  v := open_session_internal(v_business, v_location, v_me, v_me, p_counted, p_denominations, null);
  if v_add > 0 then
    v_transfer := gen_random_uuid();
    v_journal := post_journal(v_business, now(), 'Float from the safe into the till, session ' || (v ->> 'session_no'),
      'cash_transfer', v_transfer,
      jsonb_build_array(jsonb_build_object('code', '1000', 'debit', v_add),
                        jsonb_build_object('code', '1005', 'credit', v_add)));
    perform assert_safe_can_pay(v_business, v_add);
    insert into cash_transfer (id, business_id, location_id, from_place, to_place, amount, note, work_shift_id,
                               journal_entry_id, created_by)
    values (v_transfer, v_business, v_location, 'safe', 'till', v_add,
            'Float at the opening of session ' || (v ->> 'session_no'), (v ->> 'session_id')::uuid, v_journal, v_me);
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (v_business, v_location, 'cash_in', v_add, 'cash_transfer', v_transfer, v_me);
    v := v || jsonb_build_object('float_from_safe', v_add);
  end if;
  perform audit_event(v_business, 'cash.session.open', 'work_shift', v ->> 'session_id', null, null,
    jsonb_build_object('session_no', v -> 'session_no', 'counted', v -> 'counted', 'expected', v -> 'expected',
                       'variance', v -> 'variance', 'took_over', v -> 'took_over',
                       'float_from_safe', v -> 'float_from_safe', 'notes', p_denominations));
  perform idem_finish(v_business, p_idempotency_key, 'open_cash_session', v_req, v);
  return v;
end $$;

-- Close the drawer's session, counting it blind: the answer is the first
-- place its cashier sees what it should have held. The session's cashier
-- closes it, or a manager.
create or replace function close_cash_session(p_counted numeric, p_denominations jsonb default null,
                                              p_left_in_drawer numeric default null, p_take_to text default null,
                                              p_session uuid default null, p_location uuid default null,
                                              p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cash.session');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('p_counted', p_counted, 'p_denominations', p_denominations,
                                    'p_left_in_drawer', p_left_in_drawer, 'p_take_to', p_take_to,
                                    'p_session', p_session, 'p_location', p_location);
  v jsonb; v_session uuid; s work_shift;
begin
  v := idem_begin(v_business, p_idempotency_key, 'close_cash_session', v_req);
  if v is not null then return v; end if;
  if p_counted is null then raise exception 'Enter the cash you counted'; end if;
  v_session := coalesce(p_session, open_session_at(v_business, resolve_location(v_business, p_location)));
  select * into s from work_shift where id = v_session and business_id = v_business and kind = 'session';
  if not found then raise exception 'The drawer is not open'; end if;
  if s.cashier_id <> v_me and not current_has_permission('cash.session.force') then
    raise exception 'Only % or a manager closes this session', (select full_name from app_user where id = s.cashier_id)
      using errcode = '42501';
  end if;
  v := close_session_internal(v_business, v_session, v_me, p_counted, p_denominations, p_left_in_drawer, p_take_to, null);
  perform audit_event(v_business, 'cash.session.close', 'work_shift', v_session::text, null, null,
    jsonb_build_object('session_no', v -> 'session_no', 'expected', v -> 'expected', 'counted', v -> 'counted',
                       'variance', v -> 'variance', 'left', v -> 'left', 'taken', v -> 'taken',
                       'taken_to', v -> 'taken_to', 'notes', p_denominations));
  perform idem_finish(v_business, p_idempotency_key, 'close_cash_session', v_req, v);
  return v;
end $$;

-- Hand the drawer to the next person: the session closes with its count, and
-- theirs opens with what was left in the drawer, in one step, so nobody opens
-- it in between.
create or replace function hand_over_session(p_counted numeric, p_to uuid, p_denominations jsonb default null,
                                             p_left_in_drawer numeric default null, p_take_to text default null,
                                             p_location uuid default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cash.session');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('p_counted', p_counted, 'p_to', p_to, 'p_denominations', p_denominations,
                                    'p_left_in_drawer', p_left_in_drawer, 'p_take_to', p_take_to,
                                    'p_location', p_location);
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
  if a.id = s.cashier_id then raise exception 'Hand the drawer to someone else'; end if;
  v := close_session_internal(v_business, v_session, v_me, p_counted, p_denominations, p_left_in_drawer, p_take_to, null);
  v_next := open_session_internal(v_business, v_location, a.id, v_me, (v ->> 'left')::numeric, null, v_session);
  v := v || jsonb_build_object('next_session_id', v_next -> 'session_id', 'next_session_no', v_next -> 'session_no',
                               'next_cashier', a.full_name);
  perform audit_event(v_business, 'cash.session.hand_over', 'work_shift', v_session::text, null, null,
    jsonb_build_object('session_no', v -> 'session_no', 'expected', v -> 'expected', 'counted', v -> 'counted',
                       'variance', v -> 'variance', 'left', v -> 'left', 'taken', v -> 'taken',
                       'taken_to', v -> 'taken_to', 'next_session_no', v -> 'next_session_no',
                       'next_cashier', a.id, 'notes', p_denominations));
  perform idem_finish(v_business, p_idempotency_key, 'hand_over_session', v_req, v);
  return v;
end $$;

-- A manager closes a session left open, with a reason: counted, or not (then
-- the next opening count finds what it held).
create or replace function force_close_session(p_session uuid, p_reason text, p_counted numeric default null,
                                               p_denominations jsonb default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cash.session.force');
  v_me uuid := (current_member()).id;
  v_req jsonb := jsonb_build_object('p_session', p_session, 'p_reason', p_reason, 'p_counted', p_counted,
                                    'p_denominations', p_denominations);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'force_close_session', v_req);
  if v is not null then return v; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the session is being closed'; end if;
  v := close_session_internal(v_business, p_session, v_me, p_counted, p_denominations, null, null, trim(p_reason));
  perform audit_event(v_business, 'cash.session.force_close', 'work_shift', p_session::text, trim(p_reason), null,
    jsonb_build_object('session_no', v -> 'session_no', 'expected', v -> 'expected', 'counted', v -> 'counted',
                       'variance', v -> 'variance', 'notes', p_denominations));
  perform idem_finish(v_business, p_idempotency_key, 'force_close_session', v_req, v);
  return v;
end $$;

-- The drawer as the till shows it: open or not, whose session, and what each
-- may do. What it should hold only for those who may see it.
create or replace function cash_session_status(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'cash.session', 'day.close', 'cash.view_expected');
  v_me uuid := (current_member()).id;
  v_location uuid := resolve_location(v_business, p_location);
  v_see boolean := current_has_permission('cash.view_expected');
  v_force boolean := current_has_permission('cash.session.force');
  v_may boolean := current_has_permission('cash.session');
  dr cash_drawer; s work_shift; f record; v_expected numeric; v_figures jsonb;
begin
  select * into dr from cash_drawer where location_id = v_location and business_id = v_business and is_active;
  select * into s from work_shift where drawer_id = dr.id and kind = 'session' and closed_at is null;
  if s.id is not null and v_see then
    f := session_figures(s.id);
    v_expected := s.opening_counted + f.moved;
    v_figures := to_jsonb(f);
  end if;
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
    'open_bills', (select count(*) from pos_tab
                    where business_id = v_business and location_id = v_location and status = 'open'),
    'takers', (select coalesce(jsonb_agg(jsonb_build_object('id', au.id, 'name', au.full_name) order by au.full_name),
                               '[]'::jsonb)
                 from app_user au
                where au.business_id = v_business and au.is_active and member_has_permission(au.id, 'cash.session')
                  and au.id is distinct from s.cashier_id));
end $$;

-- Sessions (and the drawer counts and day closes before them) opened or closed
-- in the dates, or still open, newest first. An open session's figures only
-- for those who may see what a drawer should hold.
create or replace function cash_sessions(p_from date, p_to date, p_location uuid default null)
returns table (id uuid, kind text, session_no bigint, location_id uuid, location text, cashier text,
               opened_at timestamptz, opened_by text, closed_at timestamptz, closed_by text, is_open boolean,
               forced_reason text, opening_counted numeric, opening_expected numeric, opening_variance numeric,
               cash_sales numeric, refunds numeric, voids numeric, paid_out numeric, cash_in numeric, cash_out numeric,
               expected numeric, counted numeric, variance numeric, left_in_drawer numeric, taken_out numeric,
               taken_to text, card numeric, orders int, opened_from_no bigint, took_over boolean,
               handed_to_no bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close', 'cash.view_expected', 'audit.view');
  v_see boolean := current_has_permission('cash.view_expected');
  b record;
begin
  b := local_day_bounds(v_business, p_from, p_to);
  return query
    select w.id, w.kind, w.session_no, w.location_id, l.name, coalesce(ca.full_name, ob.full_name),
           w.opened_at, ob.full_name, w.closed_at, cb.full_name, w.closed_at is null, w.forced_reason,
           w.opening_counted, w.opening_expected, w.opening_variance,
           case when w.closed_at is not null or v_see then f.cash_sales end,
           case when w.closed_at is not null or v_see then f.refunds end,
           case when w.closed_at is not null or v_see then f.voids end,
           case when w.closed_at is not null or v_see then f.paid_out end,
           case when w.closed_at is not null or v_see then f.cash_in end,
           case when w.closed_at is not null or v_see then f.cash_out end,
           case when w.closed_at is not null then w.expected_cash
                when v_see then w.opening_counted + f.moved end,
           w.counted_cash, w.variance, w.left_in_drawer, w.taken_out, w.taken_to,
           case when w.closed_at is not null or v_see then f.card end,
           case when w.closed_at is not null or v_see then f.orders end,
           pf.session_no, pf.kind = 'drawer', nx.session_no
      from work_shift w
      join location l on l.id = w.location_id
      left join app_user ca on ca.id = w.cashier_id
      left join app_user ob on ob.id = w.opened_by
      left join app_user cb on cb.id = w.closed_by
      left join work_shift pf on pf.id = w.opened_from
      left join lateral (select n.session_no from work_shift n
                          where n.opened_from = w.id and n.kind = 'session' and w.kind = 'session' limit 1) nx on true
      cross join lateral session_figures(w.id) f
     where w.business_id = v_business and (p_location is null or w.location_id = p_location)
       and (w.closed_at is null
            or (w.opened_at >= b.from_ts and w.opened_at < b.to_ts)
            or (w.closed_at >= b.from_ts and w.closed_at < b.to_ts))
     order by w.closed_at desc nulls first, w.opened_at desc;
end $$;

-- One session's statement: the session, then every movement of cash in it and
-- the takings after it. An open session only for those who may see what the
-- drawer should hold.
create or replace function cash_session_statement(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close', 'cash.view_expected', 'audit.view');
  w work_shift; v_day date;
begin
  select * into w from work_shift where id = p_session and business_id = v_business;
  if not found then raise exception 'Session not found'; end if;
  if w.closed_at is null and not current_has_permission('cash.view_expected') then
    raise exception 'What an open drawer should hold is shown once it is counted' using errcode = '42501';
  end if;
  v_day := business_local_date(v_business, w.opened_at);
  return jsonb_build_object(
    'session', (select to_jsonb(r) from cash_sessions(v_day, v_day, w.location_id) r where r.id = p_session),
    'notes', jsonb_build_object('opening', w.opening_denominations, 'closing', w.closing_denominations),
    'events', (select coalesce(jsonb_agg(jsonb_build_object(
                  'at', e.created_at, 'kind', e.kind, 'amount', e.amount, 'by', u.full_name,
                  'reference_type', e.reference_type, 'reference_id', e.reference_id,
                  'turn_no', coalesce(o.turn_no, ao.turn_no),
                  'note', coalesce(x.description, ct.note, sa.reason, sup.name, je.description))
                  order by e.created_at, e.id), '[]'::jsonb)
                 from cash_event e
                 left join app_user u on u.id = e.created_by
                 left join sales_order o on e.reference_type = 'sales_order' and o.id = e.reference_id
                 left join sale_adjustment sa on e.reference_type = 'sale_adjustment' and sa.id = e.reference_id
                 left join sales_order ao on ao.id = sa.sales_order_id
                 left join expense x on e.reference_type = 'expense' and x.id = e.reference_id
                 left join cash_transfer ct on e.reference_type = 'cash_transfer' and ct.id = e.reference_id
                 left join supplier_payment sp on e.reference_type = 'supplier_payment' and sp.id = e.reference_id
                 left join supplier sup on sup.id = sp.supplier_id
                 left join journal_entry je on e.reference_type = 'journal_entry' and je.id = e.reference_id
                where e.work_shift_id = p_session),
    'takings', (select coalesce(jsonb_agg(jsonb_build_object('at', t.created_at, 'to', t.to_place, 'amount', t.amount,
                                                              'journal_no', j.journal_no) order by t.created_at),
                                '[]'::jsonb)
                  from cash_transfer t left join journal_entry j on j.id = t.journal_entry_id
                 where t.work_shift_id = p_session and t.from_place = 'till'));
end $$;

-- ---------------------------------------------------------------------------
-- 9. The old Sales screen, until the new one is deployed
-- ---------------------------------------------------------------------------
-- Its count closes the open session (revoked in the next release).
create or replace function count_drawer__run(p_counted numeric, p_left_in_drawer numeric default null,
                                             p_take_to text default null, p_start_cash numeric default null,
                                             p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('day.close'); v_session uuid; v jsonb;
begin
  v_session := open_session_at(v_business, resolve_location(v_business, p_location));
  if v_session is null then
    raise exception 'Open the drawer on the till first: counting it now closes its session';
  end if;
  v := close_session_internal(v_business, v_session, (current_member()).id, p_counted, null, p_left_in_drawer,
                              p_take_to, null);
  perform audit_event(v_business, 'cash.session.close', 'work_shift', v_session::text, null, null,
    jsonb_build_object('session_no', v -> 'session_no', 'expected', v -> 'expected', 'counted', v -> 'counted',
                       'variance', v -> 'variance', 'left', v -> 'left', 'taken', v -> 'taken',
                       'taken_to', v -> 'taken_to'));
  return v || jsonb_build_object('shift_id', v_session, 'start', v -> 'opening');
end $$;

-- What it shows of the drawer: the cash figures only to those who may see
-- what the drawer should hold.
create or replace function drawer_status(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('day.close', 'cost.view');
  v_see boolean := current_has_permission('cash.view_expected');
  v_location uuid; v_open uuid; d record; t record; s record;
begin
  v_location := resolve_location(v_business, p_location);
  v_open := open_session_at(v_business, v_location);
  d := drawer_position(v_business, v_location);
  select coalesce(sum(amount) filter (where kind = 'sale'), 0) as sales,
         coalesce(-sum(amount) filter (where kind = 'refund'), 0) as refunds,
         coalesce(-sum(amount) filter (where kind = 'void'), 0) as voids,
         coalesce(-sum(amount) filter (where kind in ('paid_out', 'paid_out_reversed')), 0) as paid_out,
         coalesce(sum(amount) filter (where kind = 'cash_in'), 0) as cash_in,
         coalesce(-sum(amount) filter (where kind = 'cash_out'), 0) as cash_out
    into t from cash_event
   where business_id = v_business and location_id = v_location
     and (work_shift_id = v_open or (v_open is null and work_shift_id is null));
  select count(*) filter (where o.status <> 'voided') as orders,
         coalesce(sum(tn.amount) filter (where tn.tender_type = 'card' and o.status <> 'voided'), 0) as card,
         coalesce(sum(tn.amount) filter (where tn.tender_type = 'platform_paid' and o.status <> 'voided'), 0) as platform
    into s from sales_order o join sales_tender tn on tn.sales_order_id = o.id
   where o.business_id = v_business and o.location_id = v_location
     and (d.last_count_at is null or o.created_at > d.last_count_at);
  return jsonb_build_object(
    'location_id', v_location, 'since', d.last_count_at, 'needs_start', d.needs_start and v_see,
    'start', case when v_see then d.carry end,
    'cash_sales', case when v_see then t.sales end, 'refunds', case when v_see then t.refunds end,
    'voids', case when v_see then t.voids end, 'paid_out', case when v_see then t.paid_out end,
    'cash_in', case when v_see then t.cash_in end, 'cash_out', case when v_see then t.cash_out end,
    'moved', case when v_see then d.moved end, 'events', case when v_see then d.events end,
    'expected', case when v_see and not d.needs_start then d.carry + d.moved end,
    'orders', s.orders, 'card', s.card, 'platform', s.platform,
    'open_bills', (select count(*) from pos_tab where business_id = v_business and location_id = v_location and status = 'open'),
    'safe', gl_balance_at(v_business, '1005', 'infinity'),
    'session_open', v_open is not null);
end $$;

-- ---------------------------------------------------------------------------
-- 10. What sessions change elsewhere
-- ---------------------------------------------------------------------------
-- A sale is voided until the session holding it closes (0024's rule, with
-- sessions); after that it is refunded, from the session open then.
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
  for m in select * from inventory_movement
            where reference_type = 'sales_order' and reference_id = p_order and type = 'sale_consumption' loop
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

-- Days whose cash is not counted: as 0024, and a session's days until it
-- closes.
create or replace function uncounted_days(p_business uuid) returns table (location_id uuid, day date)
language sql stable set search_path = public as $$
  with sold as (
    select o.location_id, business_local_date(p_business, o.placed_at) as d, max(o.created_at) as last_at
      from sales_order o
     where o.business_id = p_business and o.status <> 'voided'
     group by 1, 2
  )
  select s.location_id, s.d from sold s
   where not exists (select 1 from work_shift w
                      where w.business_id = p_business and w.location_id = s.location_id and w.closed_at is not null
                        and ((w.kind = 'day' and w.business_day = s.d)
                             or (w.kind in ('drawer', 'session') and w.closed_at >= s.last_at)))
  union
  select e.location_id, business_local_date(p_business, e.created_at)
    from cash_event e left join work_shift w on w.id = e.work_shift_id
   where e.business_id = p_business and (e.work_shift_id is null or w.closed_at is null)
$$;

-- A journal written by a session is corrected through the session.
create or replace function journal_source_hint(p_ref_type text) returns text
language sql immutable as $$
  select case p_ref_type
    when 'sales_order' then 'a sale (void or refund it on Orders)'
    when 'sale_adjustment' then 'a refund'
    when 'goods_receipt' then 'a goods receipt'
    when 'purchase_invoice' then 'a bill (cancel it on Vendors)'
    when 'supplier_payment' then 'a supplier payment'
    when 'inventory_movement' then 'a stock record (correct stock with a count or a stock correction)'
    when 'stock_count' then 'a stock count (correct stock with a new count)'
    when 'work_shift' then 'a drawer count'
    when 'session_opening' then 'the opening count of a cash session'
    when 'cash_transfer' then 'a movement of cash (move it back instead)'
    when 'reversal' then 'a reversal (post the entry again instead)'
    when 'card_settlement' then 'a card settlement (cancel it on Sales)'
    when 'platform_settlement' then 'a platform settlement (cancel it on Delivery Platforms)'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- ---------------------------------------------------------------------------
-- 11. Alerts and the daily brief know sessions
-- ---------------------------------------------------------------------------
create or replace function alert_threshold_rules() returns jsonb
language sql immutable set search_path = public as $$
  select '{
    "lead_time_days":           {"default": 1,     "min": 0,   "max": 30,        "whole": true,
                                 "label": "Days a delivery takes (vendors without their own)"},
    "margin_target_percent":    {"default": 70,    "min": 0,   "max": 95,        "whole": false,
                                 "label": "Margin target (%)"},
    "count_stale_hours":        {"default": 8,     "min": 1,   "max": 72,        "whole": true,
                                 "label": "Hours a stock count may stay open"},
    "waste_spike_factor":       {"default": 1.5,   "min": 1,   "max": 10,        "whole": false,
                                 "label": "Waste spike: times a usual week"},
    "waste_spike_min":          {"default": 20000, "min": 0,   "max": 100000000, "whole": true,
                                 "label": "Waste spike: at least (IQD)"},
    "exceptions_count":         {"default": 10,    "min": 1,   "max": 1000,      "whole": true,
                                 "label": "Exceptions by one person in 7 days"},
    "exceptions_share_percent": {"default": 3,     "min": 0.1, "max": 100,       "whole": false,
                                 "label": "Exceptions as a share of their sales (%)"},
    "card_days":                {"default": 3,     "min": 1,   "max": 30,        "whole": true,
                                 "label": "Days card money takes to reach the bank"},
    "platform_days":            {"default": 7,     "min": 1,   "max": 60,        "whole": true,
                                 "label": "Days a delivery platform takes to pay"},
    "bill_due_days":            {"default": 3,     "min": 0,   "max": 30,        "whole": true,
                                 "label": "Days before a bill is due to warn"},
    "price_typo_factor":        {"default": 3,     "min": 1.5, "max": 20,        "whole": false,
                                 "label": "Price typo: times another channel''s price"},
    "session_open_hours":       {"default": 14,    "min": 1,   "max": 72,        "whole": true,
                                 "label": "Hours a cash session may stay open"},
    "session_short_min":        {"default": 5000,  "min": 0,   "max": 100000000, "whole": true,
                                 "label": "A cash session short by at least (IQD)"}
  }'::jsonb
$$;

-- 0031's rules stay as they were, but for the drawer's, which now points to
-- its session; the session rules follow.
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0031;
revoke execute on function alert_conditions_0031(uuid, timestamptz) from public, anon, authenticated;

create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language plpgsql stable set search_path = public as $$
declare
  v_tz text; v_today date;
  v_hours numeric := alert_setting(p_business, 'session_open_hours');
  v_short numeric := greatest(alert_setting(p_business, 'session_short_min'), 1);
begin
  select timezone into v_tz from business where id = p_business;
  v_today := business_local_date(p_business, p_now);

  return query
    select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
      from alert_conditions_0031(p_business, p_now) c
     where c.rule <> 'drawer_uncounted';

  -- A drawer not counted: days before today whose cash no session or count
  -- has covered.
  return query
    select 'drawer_uncounted'::text, u.location_id::text,
           case when count(*) >= 2 then 'red' else 'orange' end::text,
           case when count(*) = 1
                then format('The drawer at %s has not been counted for %s', l.name, to_char(min(u.day), 'DD Mon'))
                else format('The drawer at %s has not been counted for %s days, since %s', l.name, count(*),
                            to_char(min(u.day), 'DD Mon')) end,
           'Until the drawer is counted, nobody knows whether the cash is all there.'::text,
           'Close its session on the till, counting the cash; a manager can close one left open on Cash sessions.'::text,
           'high'::text, '/sales/sessions'::text,
           jsonb_build_object('days', jsonb_agg(u.day order by u.day))
      from uncounted_days(p_business) u join location l on l.id = u.location_id
     where u.day < v_today
     group by u.location_id, l.name;

  -- A session left open too long.
  return query
    select 'session_open_long'::text, w.id::text,
           case when w.opened_at < p_now - make_interval(hours => (v_hours * 2)::int) then 'red' else 'orange' end::text,
           format('Session %s at %s has been open since %s', w.session_no, l.name,
                  to_char(w.opened_at at time zone v_tz, 'DD Mon HH24:MI')),
           'The cash in an open session has not been counted: the longer it stays open, the more passes through it unchecked.'::text,
           'Close it on the till, counting the cash; a manager can close it on Cash sessions.'::text,
           'high'::text, '/sales/sessions'::text,
           jsonb_build_object('session_id', w.id, 'session_no', w.session_no, 'opened_at', w.opened_at,
                              'cashier', w.cashier_id)
      from work_shift w join location l on l.id = w.location_id
     where w.business_id = p_business and w.kind = 'session' and w.closed_at is null
       and w.opened_at < p_now - make_interval(hours => v_hours::int);

  -- A session short, at its close or at its opening, in the last week.
  return query
    select 'session_short'::text, x.subject,
           case when x.short >= v_short * 5 then 'red' else 'orange' end::text,
           case when x.at_opening
                then format('Session %s at %s opened %s IQD short of what the last session left', x.session_no,
                            x.location, alert_money(x.short))
                else format('Session %s at %s closed %s IQD short', x.session_no, x.location, alert_money(x.short)) end,
           'Cash that should be in the drawer is not: change miscounted, a sale not rung up, or money taken.'::text,
           'Look at the session''s statement on Cash sessions, and ask whoever had the drawer.'::text,
           'high'::text, '/sales/sessions/' || x.id,
           jsonb_build_object('session_id', x.id, 'session_no', x.session_no, 'short', x.short,
                              'at_opening', x.at_opening, 'cashier', x.cashier_id)
      from (select w.id, w.id::text as subject, w.session_no, l.name as location, w.cashier_id,
                   -w.variance as short, false as at_opening
              from work_shift w join location l on l.id = w.location_id
             where w.business_id = p_business and w.kind = 'session' and w.closed_at >= p_now - interval '7 days'
               and w.variance <= -v_short
            union all
            select w.id, 'opening:' || w.id, w.session_no, l.name, w.cashier_id, -w.opening_variance, true
              from work_shift w join location l on l.id = w.location_id
             where w.business_id = p_business and w.kind = 'session' and w.opened_at >= p_now - interval '7 days'
               and w.opening_variance <= -v_short) x;

  -- A session closed by a manager, in the last week.
  return query
    select 'session_forced'::text, w.id::text, 'orange'::text,
           format('Session %s at %s was closed by %s: %s', w.session_no, l.name, cb.full_name, w.forced_reason),
           case when w.counted_cash is null
                then 'It was closed without a count: what it held is counted when the drawer next opens.'
                else 'Its cashier did not close it: the count was not theirs.' end::text,
           'Check it with the cashier on Cash sessions.'::text,
           'high'::text, '/sales/sessions/' || w.id,
           jsonb_build_object('session_id', w.id, 'session_no', w.session_no, 'closed_by', w.closed_by,
                              'counted', w.counted_cash is not null)
      from work_shift w join location l on l.id = w.location_id left join app_user cb on cb.id = w.closed_by
     where w.business_id = p_business and w.kind = 'session' and w.forced_reason is not null
       and w.closed_at >= p_now - interval '7 days';
end $$;
revoke execute on function alert_conditions(uuid, timestamptz) from public, anon, authenticated;

-- The daily brief's drawer counts include sessions: those closed that day,
-- with their differences at the close and at the opening.
alter function daily_brief(date) rename to daily_brief_0029;
revoke execute on function daily_brief_0029(date) from public, anon, authenticated;

create or replace function daily_brief(p_day date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  v jsonb := daily_brief_0029(p_day);
  b record; v_n bigint; v_diff numeric;
begin
  b := local_day_bounds(v_business, p_day, p_day);
  select count(*) filter (where w.closed_at >= b.from_ts and w.closed_at < b.to_ts),
         coalesce(sum(w.variance) filter (where w.closed_at >= b.from_ts and w.closed_at < b.to_ts), 0)
           + coalesce(sum(w.opening_variance) filter (where w.opened_at >= b.from_ts and w.opened_at < b.to_ts), 0)
    into v_n, v_diff
    from work_shift w
   where w.business_id = v_business and w.kind in ('drawer', 'session');
  return jsonb_set(jsonb_set(v, '{facts,drawer_counts}', to_jsonb(v_n)), '{facts,drawer_difference}', to_jsonb(v_diff));
end $$;

-- ---------------------------------------------------------------------------
-- 12. A keyed write called through the API must carry its key (0035)
-- ---------------------------------------------------------------------------
-- PostgREST names the path it serves (request.path, /rpc/<function>). A call
-- without a key to the function that path names is refused: the screen that
-- sent it would record twice on a retry. SQL callers, and a write's own inner
-- calls (open_tab's save_tab), are not affected.
create or replace function idem_begin(p_business uuid, p_key uuid, p_operation text, p_request jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r request_log; v_path text := coalesce(current_setting('request.path', true), '');
begin
  if p_business is null then return null; end if;   -- not signed in: the operation itself refuses
  if p_key is null then
    if right(v_path, length(p_operation) + 5) = '/rpc/' || p_operation then
      raise exception 'This screen sent no retry key: reload the page and try again' using errcode = '22023';
    end if;
    return null;                                      -- from SQL: done as before, unprotected
  end if;
  -- One key at a time: a second call with it waits for the first to finish.
  perform pg_advisory_xact_lock(hashtextextended('request:' || p_business::text || ':' || p_key::text, 0));
  select * into r from request_log where business_id = p_business and key = p_key;
  if not found then return null; end if;
  if r.operation <> p_operation or r.request_hash <> md5(p_request::text) then
    raise exception 'This retry does not match what was first sent: reload the page and check before doing it again';
  end if;
  if r.app_user_id is distinct from current_app_user_id() then
    raise exception 'This was sent by someone else' using errcode = '42501';
  end if;
  return case when jsonb_typeof(r.result) = 'object'
              then r.result || jsonb_build_object('replayed', true)
              else r.result end;
end $$;

-- ---------------------------------------------------------------------------
-- 13. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  trg_location_drawer(), open_session_at(uuid, uuid), trg_sales_order_session(), trg_cash_event_session(),
  drawer_position(uuid, uuid), assert_drawer_can_pay(uuid, uuid, numeric), session_figures(uuid),
  counted_cash(uuid, numeric, jsonb), open_session_internal(uuid, uuid, uuid, uuid, numeric, jsonb, uuid),
  close_session_internal(uuid, uuid, uuid, numeric, jsonb, numeric, text, text), uncounted_days(uuid),
  journal_source_hint(text), alert_threshold_rules(), idem_begin(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke execute on function
  open_cash_session(numeric, jsonb, numeric, uuid, uuid),
  close_cash_session(numeric, jsonb, numeric, text, uuid, uuid, uuid),
  hand_over_session(numeric, uuid, jsonb, numeric, text, uuid, uuid),
  force_close_session(uuid, text, numeric, jsonb, uuid),
  cash_session_status(uuid), cash_sessions(date, date, uuid), cash_session_statement(uuid),
  daily_brief(date)
  from public, anon;
grant execute on function
  open_cash_session(numeric, jsonb, numeric, uuid, uuid),
  close_cash_session(numeric, jsonb, numeric, text, uuid, uuid, uuid),
  hand_over_session(numeric, uuid, jsonb, numeric, text, uuid, uuid),
  force_close_session(uuid, text, numeric, jsonb, uuid),
  cash_session_status(uuid), cash_sessions(date, date, uuid), cash_session_statement(uuid),
  daily_brief(date)
  to authenticated;
