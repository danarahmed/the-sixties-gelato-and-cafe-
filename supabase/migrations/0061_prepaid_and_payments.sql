-- =============================================================================
-- 0061 — Prepaid expenses and payments put right after review
-- =============================================================================
-- A review of 0060 (prepaid expenses) and of the question asked before an
-- expense like one posted already (the September audit's P2-14) found:
--
--  * A prepaid expense paid from the safe put the safe's tie-out out by what
--    it paid: the check counted what expenses, bills, advances and salaries
--    took out of the safe, not a prepaid expense, nor its cancellation.
--  * An account the café added could be taken out of use while a prepaid
--    expense on it still had months to come. Each month's share would then be
--    refused (its account out of use), and every other share due with it.
--  * A month's share could be reversed by hand on Journals (its journal is an
--    expense's). Its month stayed posted, so its share was never posted again
--    and stayed in 1400 for good. A share is undone with its prepaid expense,
--    by cancelling it.
--  * The question before an expense like one posted already was asked by the
--    app, from what it had read. Two people posting the same rent at once were
--    both let through; and a submission sent again after no answer was not
--    asked, though the first might never have arrived. The database asks it
--    now, in the same step that posts, one payment to an account at a time;
--    its answer is kept with the submission's key like any other.
--  * Smaller: the list of prepaid expenses worked out every share due once for
--    each prepaid expense; a share released before noon on the 1st was dated
--    later that day; and two shares (of one prepaid expense, on the last days
--    of its first month and the 1st of the next, or of two for the same
--    monthly amount) were flagged on the dashboard as a possible duplicate
--    payment. Only shares: a share and an expense like it are still flagged,
--    as that is this month's rent posted twice.

-- =============================================================================
-- 1. The safe's tie-out counts a prepaid expense paid from it
-- =============================================================================
-- 0054's check of the safe, with what a prepaid expense paid from the safe
-- took out of it, and what its cancellation put back.
alter function reconciliation_checks(uuid, date) rename to reconciliation_checks_0060;
revoke execute on function reconciliation_checks_0060(uuid, date) from public, anon, authenticated;
create or replace function reconciliation_checks(p_business uuid, p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable set search_path = public as $$
declare v_end timestamptz; v_prepaid numeric;
begin
  v_end := (local_day_bounds(p_business, p_as_of, p_as_of)).to_ts;
  select coalesce(sum(jl.debit - jl.credit), 0) into v_prepaid
    from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
   where e.business_id = p_business and e.status = 'published' and g.code = '1005' and e.occurred_at < v_end
     and (e.reference_type = 'prepaid_expense'
          or (e.reference_type = 'reversal'
              and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                            and o.reference_type = 'prepaid_expense')));
  return query
    select c.check_key, c.label,
           c.subledger + case when c.check_key = 'safe' then v_prepaid else 0 end,
           c.ledger,
           c.difference + case when c.check_key = 'safe' then v_prepaid else 0 end
      from reconciliation_checks_0060(p_business, p_as_of) c;
end $$;

-- =============================================================================
-- 2. An account out of use while a prepaid expense still takes shares from it
-- =============================================================================
-- 0058's, and one more refusal: an account a prepaid expense still has months
-- to come on stays in use until its last share is posted, or it is cancelled.
create or replace function set_account_in_use__run(p_code text, p_in_use boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  a gl_account; v_draft journal_entry; v_prepaid prepaid_expense;
begin
  if p_in_use is null then raise exception 'Say whether the account is in use'; end if;
  if v_reason is null then raise exception 'Say why'; end if;
  if length(v_reason) > 300 then raise exception 'A reason is at most 300 letters'; end if;
  a := account_to_change(v_business, p_code);
  if a.is_active and p_in_use then raise exception 'Account % % is in use already', a.code, a.name; end if;
  if not a.is_active and not p_in_use then raise exception 'Account % % is out of use already', a.code, a.name; end if;
  if not p_in_use then
    select e.* into v_draft from journal_entry e
     where e.business_id = v_business and e.status = 'draft'
       and exists (select 1 from journal_line l where l.journal_entry_id = e.id and l.account_id = a.id)
     order by e.created_at limit 1;
    if v_draft.id is not null then
      raise exception 'A draft journal (%) has a line on account % %: publish it or change the line first',
        coalesce(v_draft.description, '—'), a.code, a.name;
    end if;
    select pe.* into v_prepaid from prepaid_expense pe
     where pe.business_id = v_business and pe.account_id = a.id and pe.cancelled_at is null
       and (select count(*) from prepaid_release r where r.prepaid_id = pe.id) < pe.months
     order by pe.created_at limit 1;
    if v_prepaid.id is not null then
      raise exception 'A prepaid expense (%) takes a share from account % % each month until %: take it out of use once the last share is posted, or cancel the prepaid expense first',
        v_prepaid.description, a.code, a.name,
        to_char(v_prepaid.first_month + make_interval(months => v_prepaid.months - 1), 'YYYY-MM');
    end if;
  end if;
  update gl_account set is_active = p_in_use where id = a.id;
  return jsonb_build_object('code', a.code, 'reason', v_reason,
                            'before', jsonb_build_object('name', a.name, 'is_active', a.is_active),
                            'after', jsonb_build_object('name', a.name, 'is_active', p_in_use));
end $$;

-- =============================================================================
-- 3. A month's share undone only with its prepaid expense
-- =============================================================================
-- 0060's rule for 1400, but a share's reversal comes only from cancelling its
-- prepaid expense (which says so, ledger.prepaid_cancel): by hand, its month
-- would stay posted and its share in 1400 for good.
create or replace function trg_prepaid_by_its_records() returns trigger
language plpgsql security definer set search_path = public as $$
declare e journal_entry;
begin
  if not exists (select 1 from gl_account a where a.id = new.account_id and a.code = '1400') then
    return new;
  end if;
  select * into e from journal_entry where id = new.journal_entry_id;
  if e.reference_type = 'prepaid_expense' or current_setting('ledger.prepaid_share', true) = 'on' then
    return new;
  end if;
  if e.reference_type = 'reversal' then
    -- Its payment's: reversed by nothing but its cancellation (journal_reversible_by_hand).
    if exists (select 1 from journal_entry o where o.id = e.reverses_entry and o.reference_type = 'prepaid_expense') then
      return new;
    end if;
    if exists (select 1 from prepaid_release r where r.journal_entry_id = e.reverses_entry) then
      if current_setting('ledger.prepaid_cancel', true) = 'on' then
        return new;
      end if;
      raise exception 'A month''s share of a prepaid expense is undone by cancelling the prepaid expense on Expenses';
    end if;
  end if;
  raise exception 'Prepaid expenses (1400) move only with a prepaid expense: record one on Expenses';
end $$;

-- 0060's cancellation, saying so while it reverses the shares.
create or replace function cancel_prepaid_expense__run(p_prepaid uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  pe prepaid_expense; r record; v_rev uuid; v_n int := 0;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the prepaid expense is cancelled'; end if;
  select * into pe from prepaid_expense where id = p_prepaid and business_id = v_business for update;
  if not found then raise exception 'Prepaid expense not found'; end if;
  if pe.cancelled_at is not null then raise exception 'That prepaid expense was cancelled already'; end if;
  -- Each share posted reversed today (one reversed by hand before 0061 is not reversed again).
  perform set_config('ledger.prepaid_cancel', 'on', true);
  for r in select pr.journal_entry_id from prepaid_release pr
            where pr.prepaid_id = pe.id
              and not exists (select 1 from journal_entry x where x.reverses_entry = pr.journal_entry_id)
            order by pr.month
  loop
    perform reverse_entry_internal(r.journal_entry_id, now(), 'Reversal: ' || trim(p_reason));
    v_n := v_n + 1;
  end loop;
  perform set_config('ledger.prepaid_cancel', 'off', true);
  v_rev := reverse_entry_internal(pe.journal_entry_id, now(), 'Reversal: ' || trim(p_reason));
  -- Cash paid out of the drawer goes back in it; the safe and the bank are
  -- their accounts, put right by the reversal.
  if pe.paid_from = 'till' then
    insert into cash_event (business_id, location_id, kind, amount, reference_type, reference_id, created_by)
    values (v_business, pe.location_id, 'paid_out_reversed', pe.amount, 'journal_entry', v_rev, v_me);
  end if;
  update prepaid_expense
     set cancelled_at = now(), cancelled_by = v_me, cancel_reason = trim(p_reason), cancel_journal_entry_id = v_rev
   where id = pe.id;
  return jsonb_build_object('prepaid_id', pe.id, 'description', pe.description, 'shares_reversed', v_n,
                            'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- =============================================================================
-- 4. A share dated when it was released at the latest
-- =============================================================================
-- 0060's release, but a share posted before noon on its month's 1st is dated
-- when it was posted, not later that day. (A month still to come is posted
-- only by the tests, which say a later day has come: dated in its month.)
create or replace function release_prepaid__run(p_business uuid, p_through date, p_me uuid,
                                                p_prepaid uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  x record; v_exp uuid; v_journal uuid; v_at timestamptz; v_code text; v_text text;
  v_tz text := (select timezone from business where id = p_business);
  v_this date := date_trunc('month', business_local_date(p_business, now()))::date;
  v_out jsonb := '[]'::jsonb;
begin
  -- One release at a time for the café: two presses of the button post once.
  perform 1 from prepaid_expense
   where business_id = p_business and cancelled_at is null and (p_prepaid is null or id = p_prepaid)
   for update;
  for x in
    select pe.id, pe.location_id, pe.description, pe.account_id, pe.created_at, s.month, s.amount as share
      from prepaid_expense pe
      cross join lateral prepaid_shares(p_business, pe.amount, pe.months, pe.first_month) s
     where pe.business_id = p_business and pe.cancelled_at is null
       and (p_prepaid is null or pe.id = p_prepaid)
       and s.month <= date_trunc('month', p_through)::date
       and not exists (select 1 from prepaid_release r where r.prepaid_id = pe.id and r.month = s.month)
     order by s.month, pe.created_at
  loop
    v_exp := gen_random_uuid();
    v_at := greatest((x.month + time '12:00') at time zone v_tz, x.created_at);
    if v_at > now() and x.month <= v_this then v_at := now(); end if;
    v_text := x.description || ' (' || to_char(x.month, 'YYYY-MM') || ')';
    select code into v_code from gl_account where id = x.account_id;
    perform set_config('ledger.prepaid_share', 'on', true);
    v_journal := post_journal(p_business, v_at, 'Expense: ' || v_text, 'expense', v_exp,
      jsonb_build_array(jsonb_build_object('code', v_code, 'debit', x.share),
                        jsonb_build_object('code', '1400', 'credit', x.share)));
    perform set_config('ledger.prepaid_share', 'off', true);
    insert into expense (id, business_id, location_id, amount, incurred_on, description, journal_entry_id, created_by)
    values (v_exp, p_business, x.location_id, x.share, business_local_date(p_business, v_at), v_text, v_journal, p_me);
    insert into prepaid_release (prepaid_id, business_id, month, amount, expense_id, journal_entry_id, created_by)
    values (x.id, p_business, x.month, x.share, v_exp, v_journal, p_me);
    v_out := v_out || jsonb_build_object('prepaid_id', x.id, 'description', x.description,
                                         'month', to_char(x.month, 'YYYY-MM'), 'amount', x.share,
                                         'journal_no', (select journal_no from journal_entry where id = v_journal));
  end loop;
  return v_out;
end $$;

-- =============================================================================
-- 5. The list of prepaid expenses, each read once
-- =============================================================================
-- 0060's list, each one's shares due worked out from its own shares.
create or replace function prepaid_expenses() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_this date := date_trunc('month', business_local_date(v_business, now()))::date;
begin
  return coalesce((
    select jsonb_agg(x order by x.created_at desc)
      from (select pe.id, pe.description, a.code as account_code, a.name as account_name, pe.paid_from,
                   pe.amount, to_char(pe.first_month, 'YYYY-MM') as first_month, pe.months,
                   to_char((pe.first_month + make_interval(months => pe.months - 1))::date, 'YYYY-MM') as last_month,
                   pe.created_at, j.journal_no, l.name as location,
                   (select count(*) from prepaid_release r where r.prepaid_id = pe.id) as released,
                   -- What the shares took out of 1400: a share reversed by hand (before 0061) put its back.
                   (select coalesce(sum(r.amount), 0) from prepaid_release r
                     where r.prepaid_id = pe.id
                       and not exists (select 1 from journal_entry x where x.reverses_entry = r.journal_entry_id))
                     as released_amount,
                   (select count(*) from prepaid_release r
                     where r.prepaid_id = pe.id
                       and exists (select 1 from journal_entry x where x.reverses_entry = r.journal_entry_id))
                     as reversed,
                   (select count(*) from prepaid_shares(v_business, pe.amount, pe.months, pe.first_month) s
                     where pe.cancelled_at is null and s.month <= v_this
                       and not exists (select 1 from prepaid_release r
                                        where r.prepaid_id = pe.id and r.month = s.month)) as due,
                   (select to_char(min(s.month), 'YYYY-MM')
                      from prepaid_shares(v_business, pe.amount, pe.months, pe.first_month) s
                     where not exists (select 1 from prepaid_release r
                                        where r.prepaid_id = pe.id and r.month = s.month)) as next_month,
                   pe.cancelled_at, pe.cancel_reason
              from prepaid_expense pe
              join gl_account a on a.id = pe.account_id
              join journal_entry j on j.id = pe.journal_entry_id
              left join location l on l.id = pe.location_id
             where pe.business_id = v_business) x), '[]'::jsonb);
end $$;

-- =============================================================================
-- 6. Two shares are not a payment made twice
-- =============================================================================
-- 0060's rules, but a possible duplicate payment (0029) whose two journals are
-- both shares of prepaid expenses is not one: the shares were posted by the
-- café's prepaid expenses, each asked about when it was paid.
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0060;
revoke execute on function alert_conditions_0060(uuid, timestamptz) from public, anon, authenticated;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0060(p_business, p_now) c
   where not (c.rule = 'duplicate_payment'
              and exists (select 1 from prepaid_release r
                           where r.journal_entry_id::text = split_part(c.subject, ':', 1))
              and exists (select 1 from prepaid_release r
                           where r.journal_entry_id::text = split_part(c.subject, ':', 2)))
$$;

-- =============================================================================
-- 7. A payment like one posted already, asked about by the database
-- =============================================================================
-- The payments like one about to be posted (P2-14): to the same account, for
-- the same amount, within three days of its day. The expenses not reversed (a
-- prepaid expense's share too: this month's rent posted already) and the
-- prepaid expenses not cancelled, each on the day it was paid in the café's
-- time; the latest first.
create or replace function same_payments(p_business uuid, p_account_code text, p_amount numeric, p_day date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('account_code', x.code, 'amount', x.amount, 'date', x.day,
                                               'journal_no', x.journal_no, 'description', x.description)
                            order by x.day desc, x.journal_no desc nulls last), '[]'::jsonb)
    from (select a.code, e.amount, e.incurred_on as day, j.journal_no, e.description
            from expense e
            join journal_entry j on j.id = e.journal_entry_id and j.status = 'published'
            join journal_line l on l.journal_entry_id = j.id and l.debit > 0
            join gl_account a on a.id = l.account_id
           where e.business_id = p_business and a.code = p_account_code and e.amount = p_amount
             and e.incurred_on between p_day - 3 and p_day + 3
             and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.status = 'published')
          union all
          select a.code, pe.amount, business_local_date(p_business, pe.created_at), j.journal_no, pe.description
            from prepaid_expense pe
            join gl_account a on a.id = pe.account_id
            join journal_entry j on j.id = pe.journal_entry_id
           where pe.business_id = p_business and a.code = p_account_code and pe.amount = p_amount
             and pe.cancelled_at is null
             and business_local_date(p_business, pe.created_at) between p_day - 3 and p_day + 3) x
$$;

-- One payment to an account at a time, asked about or not: of two sent at
-- once, the second waits for the first and then sees it. Asked (p_ask: the
-- person has not said it is another payment), the payments like it, as the
-- answer {"same": [...]}, or null to post it.
create or replace function same_payment_question(p_business uuid, p_account_code text, p_amount numeric,
                                                 p_day date, p_ask boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_business is null or nullif(btrim(coalesce(p_account_code, '')), '') is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment:' || p_business::text || ':' || btrim(p_account_code), 0));
  if not coalesce(p_ask, false) then return null; end if;
  v := same_payments(p_business, btrim(p_account_code), money_round(p_business, p_amount), p_day);
  return case when jsonb_array_length(v) > 0 then jsonb_build_object('same', v) end;
end $$;

-- 0055's record_expense: asked first, when the screen asks (p_ask_same), by
-- someone who may record it. From SQL, and from a screen told it is another
-- payment, it posts as before.
drop function if exists record_expense(text, numeric, text, text, date, uuid, uuid);
create or replace function record_expense(
  p_description text,
  p_amount numeric,
  p_account_code text,
  p_paid_from text DEFAULT 'cash'::text,
  p_date date DEFAULT NULL::date,
  p_location uuid default null,
  p_ask_same boolean default false,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_description', p_description, 'p_amount', p_amount, 'p_account_code', p_account_code, 'p_paid_from', p_paid_from, 'p_date', p_date)
                 || case when p_location is not null then jsonb_build_object('p_location', p_location) else '{}'::jsonb end
                 || case when p_ask_same then jsonb_build_object('p_ask_same', true) else '{}'::jsonb end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_expense', v_req);
  if v is not null then return v; end if;
  if p_ask_same then perform require_permission('expense.record'); end if;
  v := same_payment_question(v_business, p_account_code, p_amount,
                             coalesce(p_date, business_local_date(v_business, now())), p_ask_same);
  if v is null then
    v := record_expense__run(p_description => p_description, p_amount => p_amount, p_account_code => p_account_code, p_paid_from => p_paid_from, p_date => p_date,
                             p_location => p_location);
    perform audit_event(v_business, 'expense.record', 'expense', v->>'expense_id', null, null,
      jsonb_build_object('description', p_description, 'amount', p_amount, 'account', p_account_code, 'paid_from', p_paid_from, 'journal_no', v->'journal_no'));
  end if;
  perform idem_finish(v_business, p_idempotency_key, 'record_expense', v_req, v);
  return v;
end $$;

-- 0060's record_prepaid_expense, asked first the same way: it is paid today.
drop function if exists record_prepaid_expense(text, numeric, text, text, date, int, uuid, uuid);
create or replace function record_prepaid_expense(
  p_description text, p_amount numeric, p_account_code text, p_paid_from text,
  p_first_month date, p_months int, p_location uuid default null, p_ask_same boolean default false,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_description', p_description, 'p_amount', p_amount,
                                    'p_account_code', p_account_code, 'p_paid_from', p_paid_from,
                                    'p_first_month', p_first_month, 'p_months', p_months)
                 || case when p_location is not null then jsonb_build_object('p_location', p_location)
                         else '{}'::jsonb end
                 || case when p_ask_same then jsonb_build_object('p_ask_same', true) else '{}'::jsonb end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_prepaid_expense', v_req);
  if v is not null then return v; end if;
  if p_ask_same then perform require_permission('expense.record'); end if;
  v := same_payment_question(v_business, p_account_code, p_amount, business_local_date(v_business, now()),
                             p_ask_same);
  if v is null then
    v := record_prepaid_expense__run(p_description => p_description, p_amount => p_amount,
                                     p_account_code => p_account_code, p_paid_from => p_paid_from,
                                     p_first_month => p_first_month, p_months => p_months,
                                     p_location => p_location);
    perform audit_event(v_business, 'prepaid.record', 'prepaid_expense', v->>'prepaid_id', null, null,
      jsonb_build_object('description', p_description, 'amount', v->'amount', 'account', p_account_code,
                         'paid_from', p_paid_from, 'first_month', p_first_month, 'months', p_months,
                         'journal_no', v->'journal_no'));
  end if;
  perform idem_finish(v_business, p_idempotency_key, 'record_prepaid_expense', v_req, v);
  return v;
end $$;

-- =============================================================================
-- 8. Who may call what
-- =============================================================================
revoke execute on function
  reconciliation_checks_0060(uuid, date), alert_conditions_0060(uuid, timestamptz),
  set_account_in_use__run(text, boolean, text), trg_prepaid_by_its_records(),
  cancel_prepaid_expense__run(uuid, text), release_prepaid__run(uuid, date, uuid, uuid),
  same_payments(uuid, text, numeric, date), same_payment_question(uuid, text, numeric, date, boolean),
  reconciliation_checks(uuid, date), alert_conditions(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function
  record_expense(text, numeric, text, text, date, uuid, boolean, uuid),
  record_prepaid_expense(text, numeric, text, text, date, int, uuid, boolean, uuid), prepaid_expenses()
  from public, anon;
grant execute on function
  record_expense(text, numeric, text, text, date, uuid, boolean, uuid),
  record_prepaid_expense(text, numeric, text, text, date, int, uuid, boolean, uuid), prepaid_expenses()
  to authenticated;
