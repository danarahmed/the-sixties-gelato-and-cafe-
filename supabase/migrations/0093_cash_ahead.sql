-- =============================================================================
-- 0093 — Cash ahead (SMART_PLAN part 5, step 9)
-- =============================================================================
-- The next days of the café's money, day by day: the safe, the bank and the
-- café as a whole, from what it holds now and what its own records say will
-- come in and go out; and a warning, days ahead, when the bank or the safe
-- would not cover what is due, with what to do. Rules and plain statistics,
-- learnt from the café's own records; nothing is moved or paid.
--
--  * Coming in: each weekday's takings as the last four weeks' same weekdays
--    brought them — the cash into the safe at each drawer's close, the card
--    money into the card account; the card money reaching the bank on the
--    weekdays the café's card settlements have come (less what the bank kept
--    of them); the safe banked on the weekdays the café has banked it, as much
--    of it as it has moved before; what customers on account owe, on each
--    invoice's due date (an overdue one is shown, not counted).
--  * Going out: each supplier bill still owed, on its due date, moved to the
--    days the café pays its bills and as late as it has paid them lately,
--    from where it pays them; what deliveries and orders still to be billed
--    will be billed for, due as the supplier's bills have been; and every
--    regular payment — the rent, the electricity, the salaries, the owner's
--    drawings, anything paid from the bank or the safe again and again —
--    on its next day (weekly, fortnightly, monthly or every three months, as
--    it has been), at what it was last.
--  * A warning for each spell the bank (or the safe) would be below nothing:
--    from when, how low, what is due then, and what to do: move takings from
--    the safe to the bank, ask a supplier to take a bill later, or put money
--    in.
--  * The phone and the Dashboard say so (alert rule cash_short_ahead), the
--    fortnight ahead, once the café's books go back four weeks.
--
--  * cash_ahead_for (internal), cash_ahead (profit.view).
--
-- Nothing recorded changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The forecast
-- -----------------------------------------------------------------------------
-- (internal) As at p_now, the p_days after it. Each day's figures are at its
-- end; the day of p_now is taken as it stands (what has happened by then).
create or replace function cash_ahead_for(p_business uuid, p_now timestamptz, p_days int default 30)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_tz text := (select timezone from business where id = p_business);
  v_today date := (p_now at time zone v_tz)::date;
  v_till numeric; v_safe numeric; v_card numeric; v_bank numeric; v_other numeric;
  v_cash_in numeric[]; v_card_in numeric[];
  v_settle int[]; v_fee numeric; v_bank_days int[]; v_bank_share numeric;
  v_pay_days int[]; v_pay_delay int; v_pay_from text;
  v_events jsonb := '[]'; v_days jsonb := '[]'; v_warn jsonb := '[]';
  d date; i int; v_wd int; e record; v_in_safe numeric; v_in_bank numeric; v_out_safe numeric; v_out_bank numeric;
  v_move numeric; v_card_due numeric; v_low numeric; v_spell_from date; v_spell_low numeric; v_spell_low_on date;
  v_spell_safe numeric; v_spell_due jsonb; v_overdue jsonb;
  v_end timestamptz;
begin
  if p_days is null or p_days not between 1 and 92 then raise exception 'Look 1 to 92 days ahead'; end if;
  v_end := ((v_today + 1)::timestamp at time zone v_tz);

  -- What it holds at the end of today (a journal dated today counts, whatever
  -- its hour).
  v_till := coalesce(gl_balance_at(p_business, '1000', v_end - interval '1 microsecond'), 0);
  v_safe := coalesce(gl_balance_at(p_business, '1005', v_end - interval '1 microsecond'), 0);
  v_card := coalesce(gl_balance_at(p_business, '1010', v_end - interval '1 microsecond'), 0);
  v_bank := coalesce(gl_balance_at(p_business, '1020', v_end - interval '1 microsecond'), 0);
  -- The ways to pay's own accounts (0069), held as they are.
  v_other := coalesce((select sum(coalesce(gl_balance_at(p_business, m.account_code, v_end - interval '1 microsecond'), 0))
                         from payment_method m
                        where m.business_id = p_business and m.account_code not in ('1000', '1005', '1010', '1020')), 0);

  -- Each weekday's takings over the last four weeks (1 Monday … 7 Sunday):
  -- the cash into the safe at each close, the card money into 1010.
  with days as (select (v_today - k) as day from generate_series(0, 27) k),
  moves as (
    select (je.occurred_at at time zone v_tz)::date as day, a.code,
           sum(l.debit) filter (where je.reference_type = 'cash_transfer' and a.code = '1005'
                                  and exists (select 1 from journal_line o join gl_account oa on oa.id = o.account_id
                                               where o.journal_entry_id = je.id and oa.code = '1000' and o.credit > 0)) as to_safe,
           sum(l.debit - l.credit) filter (where a.code = '1010' and je.reference_type <> 'card_settlement') as to_card
      from journal_entry je join journal_line l on l.journal_entry_id = je.id join gl_account a on a.id = l.account_id
     where je.business_id = p_business and a.code in ('1005', '1010')
       and je.occurred_at >= ((v_today - 27)::timestamp at time zone v_tz) and je.occurred_at < least(p_now, v_end)
     group by 1, 2
  )
  select array_agg(coalesce(c.v, 0) / greatest(c.n, 1) order by w.wd), array_agg(coalesce(k.v, 0) / greatest(k.n, 1) order by w.wd)
    into v_cash_in, v_card_in
    from generate_series(1, 7) w(wd)
    left join (select extract(isodow from dd.day)::int wd, count(*) n, sum(coalesce(m.to_safe, 0)) v
                 from days dd left join (select day, sum(to_safe) to_safe from moves group by day) m on m.day = dd.day
                group by 1) c on c.wd = w.wd
    left join (select extract(isodow from dd.day)::int wd, count(*) n, sum(coalesce(m.to_card, 0)) v
                 from days dd left join (select day, sum(to_card) to_card from moves group by day) m on m.day = dd.day
                group by 1) k on k.wd = w.wd;

  -- The weekdays the card money has reached the bank (on half the weeks or
  -- more, over eight weeks), and the share the bank kept.
  select coalesce(array_agg(wd), '{}') into v_settle
    from (select extract(isodow from (s.received_on))::int wd, count(distinct s.received_on) n
            from card_settlement s
           where s.business_id = p_business and s.cancelled_at is null
             and s.received_on > v_today - 56 and s.received_on <= v_today
           group by 1) x where n >= 4;
  select coalesce(1 - sum(s.received) / nullif(sum(s.terminal_total), 0), 0) into v_fee
    from card_settlement s
   where s.business_id = p_business and s.cancelled_at is null and s.received_on > v_today - 56 and s.received_on <= v_today;

  -- The weekdays the safe has been banked (half the weeks or more, over
  -- eight weeks), and how much of it each time (at most all of it).
  select coalesce(array_agg(wd), '{}') into v_bank_days
    from (select extract(isodow from (je.occurred_at at time zone v_tz))::int wd,
                 count(distinct (je.occurred_at at time zone v_tz)::date) n
            from journal_entry je
           where je.business_id = p_business and je.occurred_at > p_now - interval '56 days' and je.occurred_at <= p_now
             and exists (select 1 from journal_line l join gl_account a on a.id = l.account_id
                          where l.journal_entry_id = je.id and a.code = '1005' and l.credit > 0)
             and exists (select 1 from journal_line l join gl_account a on a.id = l.account_id
                          where l.journal_entry_id = je.id and a.code = '1020' and l.debit > 0)
           group by 1) x where n >= 4;
  select coalesce(least(percentile_cont(0.5) within group (order by m.share), 1), 1) into v_bank_share
    from (select l.credit / nullif(gl_balance_at(p_business, '1005', je.occurred_at - interval '1 microsecond'), 0) as share
            from journal_entry je join journal_line l on l.journal_entry_id = je.id join gl_account a on a.id = l.account_id
           where je.business_id = p_business and a.code = '1005' and l.credit > 0
             and je.occurred_at > p_now - interval '56 days' and je.occurred_at <= p_now
             and exists (select 1 from journal_line o join gl_account oa on oa.id = o.account_id
                          where o.journal_entry_id = je.id and oa.code = '1020' and o.debit > 0)) m
   where m.share > 0;

  -- How the café pays its bills: on which weekdays (a quarter of its payments
  -- or more, over three months), how many days after they fall due (the
  -- middle), and from where.
  select coalesce(array_agg(wd), '{}') into v_pay_days
    from (select extract(isodow from p.paid_on)::int wd, count(*) n, sum(count(*)) over () total
            from supplier_payment p
           where p.business_id = p_business and p.paid_on > v_today - 91 and p.paid_on <= v_today
           group by 1) x where n >= total / 4.0;
  select coalesce(percentile_disc(0.5) within group (order by greatest(p.paid_on - inv.due_date, 0)), 0)
    into v_pay_delay
    from supplier_payment p join purchase_invoice inv on inv.id = p.purchase_invoice_id
   where p.business_id = p_business and p.paid_on > v_today - 91 and p.paid_on <= v_today and inv.due_date is not null;
  select case when count(*) filter (where p.method in ('cash', 'safe')) > count(*) / 2 then 'safe' else 'bank' end
    into v_pay_from
    from supplier_payment p where p.business_id = p_business and p.paid_on > v_today - 91 and p.paid_on <= v_today;

  -- ---------------------------------------------------------------- the events
  -- Bills still owed, each on the day the café would pay it.
  for e in
    -- (as at p_now: what was paid of it since is put back)
    select * from (
      select inv.id, inv.invoice_no, s.name as supplier, inv.due_date,
             inv.amount_total - inv.paid_amount
               + coalesce((select sum(sp.amount) from supplier_payment sp
                            where sp.purchase_invoice_id = inv.id and sp.created_at > p_now), 0) as owed
        from purchase_invoice inv join supplier s on s.id = inv.supplier_id
       where inv.business_id = p_business and (inv.cancelled_at is null or inv.cancelled_at > p_now)
         and inv.created_at <= p_now) b
     where b.owed > 0
  loop
    d := greatest(coalesce(e.due_date, v_today) + v_pay_delay, v_today + 1);
    if cardinality(v_pay_days) > 0 then
      while not (extract(isodow from d)::int = any(v_pay_days)) loop d := d + 1; end loop;
    end if;
    if d <= v_today + p_days then
      v_events := v_events || jsonb_build_object('day', d, 'kind', 'bill', 'from', v_pay_from,
        'amount', -e.owed, 'label', e.supplier, 'ref', e.invoice_no, 'due', e.due_date, 'id', e.id);
    end if;
  end loop;

  -- What deliveries not billed yet, and orders still to come, will be billed
  -- for: due as the supplier's bills have been (else in 30 days).
  for e in
    with terms as (
      select inv.supplier_id, percentile_disc(0.5) within group (order by inv.due_date - inv.invoice_date) as days
        from purchase_invoice inv
       where inv.business_id = p_business and inv.cancelled_at is null and inv.due_date is not null
         and inv.invoice_date > v_today - 183
       group by 1
    )
    select s.name as supplier, x.amount, x.billed_on + coalesce(t.days, 30) as due, x.kind
      from (select g.supplier_id, (g.received_at at time zone v_tz)::date as billed_on,
                   coalesce((receipt_state(g.id) ->> 'value')::numeric, 0) as amount, 'delivery'::text as kind
              from goods_receipt g
             where g.business_id = p_business and g.received_at <= p_now and g.received_at > p_now - interval '60 days'
               and not exists (select 1 from purchase_invoice inv where inv.goods_receipt_id = g.id
                                  and inv.created_at <= p_now and (inv.cancelled_at is null or inv.cancelled_at > p_now))
            union all
            select o.supplier_id, greatest(coalesce(o.expected_on, v_today + 1), v_today + 1),
                   greatest(o.total - coalesce((select sum((l ->> 'landed')::numeric)
                                                  from goods_receipt r cross join lateral jsonb_array_elements(receipt_state(r.id) -> 'lines') l
                                                 where r.purchase_order_id = o.id and r.received_at <= p_now), 0), 0), 'order'
              from purchase_order o
             where o.business_id = p_business and o.approved_at <= p_now
               and (o.closed_at is null or o.closed_at > p_now) and (o.cancelled_at is null or o.cancelled_at > p_now)) x
      join supplier s on s.id = x.supplier_id
      left join terms t on t.supplier_id = x.supplier_id
     where x.amount > 0
  loop
    d := greatest(e.due + v_pay_delay, v_today + 1);
    if cardinality(v_pay_days) > 0 then
      while not (extract(isodow from d)::int = any(v_pay_days)) loop d := d + 1; end loop;
    end if;
    if d <= v_today + p_days then
      v_events := v_events || jsonb_build_object('day', d, 'kind', 'to_bill', 'from', v_pay_from,
        'amount', -e.amount, 'label', e.supplier, 'ref', e.kind, 'due', e.due);
    end if;
  end loop;

  -- What customers on account owe, invoice by invoice, oldest first, each on
  -- its due date; an overdue one is shown apart, not counted.
  v_overdue := '[]';
  for e in
    with owed as (
      select inv.id, inv.customer_id, inv.invoice_no, inv.amount, inv.due_on, c.full_name as name,
             sum(inv.amount) over (partition by inv.customer_id order by inv.issued_on, inv.invoice_no) as upto,
             coalesce((select sum(p.amount) from customer_payment p
                        where p.customer_id = inv.customer_id and p.created_at <= p_now), 0) as paid
        from customer_invoice inv join customer c on c.id = inv.customer_id
       where inv.business_id = p_business and inv.status = 'open' and inv.created_at <= p_now
    )
    select o.*, least(o.amount, o.upto - o.paid) as left_to_pay from owed o where o.upto - o.paid > 0
  loop
    if e.due_on <= v_today then
      v_overdue := v_overdue || jsonb_build_object('label', e.name, 'ref', e.invoice_no, 'amount', e.left_to_pay,
                                                   'due', e.due_on);
    elsif e.due_on <= v_today + p_days then
      v_events := v_events || jsonb_build_object('day', e.due_on, 'kind', 'customer', 'from', 'bank',
        'amount', e.left_to_pay, 'label', e.name, 'ref', e.invoice_no, 'due', e.due_on);
    end if;
  end loop;

  -- The regular payments: whatever has left (or come into) the bank or the
  -- safe again and again under the same words, but bills, takings, card
  -- money and the café's own moves between its accounts; each on its next
  -- day, at what it was last.
  for e in
    with hits as (
      select lower(trim(regexp_replace(regexp_replace(je.description, '[0-9]+', '', 'g'), '\s+', ' ', 'g'))) as what,
             je.description,
             (je.occurred_at at time zone v_tz)::date as day, a.code,
             sum(l.debit - l.credit) as amount
        from journal_entry je join journal_line l on l.journal_entry_id = je.id join gl_account a on a.id = l.account_id
       where je.business_id = p_business and a.code in ('1005', '1020')
         and je.occurred_at > p_now - interval '400 days' and je.occurred_at <= p_now
         and coalesce(je.reference_type, 'manual') not in
             ('supplier_payment', 'cash_transfer', 'card_settlement', 'sales_order', 'reversal', 'work_shift',
              'session_opening', 'money_move', 'customer_payment', 'platform_settlement', 'sale_refund')
         and not exists (select 1 from journal_line o join gl_account oa on oa.id = o.account_id
                          where o.journal_entry_id = je.id and o.id <> l.id
                            and oa.code in ('1000', '1005', '1010', '1020'))
       group by je.id, je.description, je.occurred_at, a.code
    ),
    series as (
      select what, code, array_agg(day order by day) as days, array_agg(amount order by day) as amounts,
             (array_agg(description order by day desc))[1] as words
        from hits where amount <> 0 group by what, code having count(*) >= 2
    ),
    gaps as (
      select s.*, (select percentile_disc(0.5) within group (order by g)
                     from (select s.days[k + 1] - s.days[k] as g from generate_subscripts(s.days, 1) k
                            where k < cardinality(s.days)) x) as gap,
             s.days[cardinality(s.days)] - s.days[cardinality(s.days) - 1] as last_gap
        from series s
    )
    select what, code, words, days[cardinality(days)] as last_day, amounts[cardinality(amounts)] as amount,
           case when gap between 6 and 8 and last_gap between 5 and 9 then 'week'
                when gap between 13 and 15 and last_gap between 12 and 16 then 'fortnight'
                when gap between 26 and 35 and last_gap between 25 and 36 then 'month'
                when gap between 84 and 98 and last_gap between 80 and 100 then 'quarter' end as every
      from gaps
  loop
    continue when e.every is null;
    i := 0;
    loop
      i := i + 1;
      d := case e.every when 'week' then e.last_day + 7 * i when 'fortnight' then e.last_day + 14 * i
                        when 'month' then (e.last_day + make_interval(months => i))::date
                        else (e.last_day + make_interval(months => 3 * i))::date end;
      exit when d > v_today + p_days;
      continue when d <= v_today;
      v_events := v_events || jsonb_build_object('day', d, 'kind', 'regular',
        'from', case e.code when '1005' then 'safe' else 'bank' end, 'amount', e.amount, 'label', e.words,
        'every', e.every, 'last', e.last_day);
    end loop;
  end loop;

  -- ---------------------------------------------------------------- day by day
  v_low := null;
  for i in 1..p_days loop
    d := v_today + i;
    v_wd := extract(isodow from d)::int;
    v_in_safe := coalesce(v_cash_in[v_wd], 0);
    v_in_bank := 0;
    -- The card money of the days before reaches the bank on its weekdays.
    v_card_due := 0;
    if v_wd = any(v_settle) then
      v_card_due := v_card;
      v_in_bank := v_in_bank + round(v_card * (1 - v_fee));
      v_card := 0;
    end if;
    v_card := v_card + coalesce(v_card_in[v_wd], 0);
    -- The safe banked on its weekdays, as it stood that morning: the day's
    -- own takings reach it at the close, after the bank's hours.
    v_move := 0;
    if v_wd = any(v_bank_days) and v_safe > 0 then
      v_move := floor(v_safe * v_bank_share / 1000) * 1000;
      v_safe := v_safe - v_move;
      v_bank := v_bank + v_move;
    end if;
    -- The events of the day.
    select coalesce(sum((x ->> 'amount')::numeric) filter (where x ->> 'from' = 'safe'), 0),
           coalesce(sum((x ->> 'amount')::numeric) filter (where x ->> 'from' <> 'safe'), 0)
      into v_out_safe, v_out_bank
      from jsonb_array_elements(v_events) x where (x ->> 'day')::date = d;
    v_safe := v_safe + v_in_safe + v_out_safe;
    v_bank := v_bank + v_in_bank + v_out_bank;
    v_days := v_days || jsonb_build_object(
      'day', d, 'safe', round(v_safe), 'bank', round(v_bank), 'card', round(v_card),
      'total', round(v_till + v_safe + v_card + v_bank + v_other),
      'takings', round(coalesce(v_cash_in[v_wd], 0) + coalesce(v_card_in[v_wd], 0)),
      'card_to_bank', round(v_card_due * (1 - v_fee)), 'banked', v_move,
      'paid', round(-(v_out_bank + v_out_safe)));
  end loop;

  -- ---------------------------------------------------------------- the warnings
  -- Each spell the bank or the safe would be below nothing: from when, how
  -- low, what is due its first day, and what to do.
  for e in
    with x as (
      select (y ->> 'day')::date as day, (y ->> 'bank')::numeric as bank, (y ->> 'safe')::numeric as safe, n
        from jsonb_array_elements(v_days) with ordinality t(y, n)
    ), flagged as (
      select x.*, (bank < 0 or safe < 0) as short,
             lag(bank < 0 or safe < 0) over (order by n) as was_short,
             lag(safe) over (order by n) as safe_before
        from x
    ), spells as (
      select f.*, sum(case when short and not coalesce(was_short, false) then 1 else 0 end) over (order by n) as spell
        from flagged f
    )
    select spell, min(day) as from_day, max(day) as to_day,
           min(least(bank, safe)) as lowest,
           (array_agg(day order by least(bank, safe), day))[1] as lowest_on,
           (array_agg(coalesce(safe_before, 0) order by day))[1] as safe_before,
           bool_or(bank < 0) as bank_short
      from spells where short group by spell order by spell
  loop
    select coalesce(jsonb_agg(x order by (x ->> 'amount')::numeric), '[]') into v_spell_due
      from jsonb_array_elements(v_events) x
     where (x ->> 'day')::date between e.from_day and e.to_day and (x ->> 'amount')::numeric < 0;
    v_warn := v_warn || jsonb_build_object(
      'from', e.from_day, 'to', e.to_day,
      'until', case when e.to_day < v_today + p_days then e.to_day + 1 end,
      'account', case when e.bank_short then 'bank' else 'safe' end,
      'lowest', round(e.lowest), 'lowest_on', e.lowest_on, 'days_ahead', e.from_day - v_today,
      'due', (select coalesce(jsonb_agg(x), '[]') from (select x from jsonb_array_elements(v_spell_due) x limit 3) y),
      'action', case when e.bank_short and e.safe_before >= -e.lowest then 'move'
                     when exists (select 1 from jsonb_array_elements(v_spell_due) x where x ->> 'kind' in ('bill', 'to_bill'))
                       then 'later'
                     else 'money_in' end,
      'move', case when e.bank_short and e.safe_before >= -e.lowest
                   then least(ceil(-e.lowest / 100000) * 100000, floor(e.safe_before / 1000) * 1000) end,
      'move_by', e.from_day - 1,
      'later', (select x from jsonb_array_elements(v_spell_due) x where x ->> 'kind' in ('bill', 'to_bill')
                 order by (x ->> 'amount')::numeric limit 1));
  end loop;

  return jsonb_build_object(
    'as_of', v_today, 'days_ahead', p_days,
    'now', jsonb_build_object('till', round(coalesce(gl_balance_at(p_business, '1000', v_end - interval '1 microsecond'), 0)),
                              'safe', round(coalesce(gl_balance_at(p_business, '1005', v_end - interval '1 microsecond'), 0)),
                              'card', round(coalesce(gl_balance_at(p_business, '1010', v_end - interval '1 microsecond'), 0)),
                              'bank', round(coalesce(gl_balance_at(p_business, '1020', v_end - interval '1 microsecond'), 0)),
                              'other', round(v_other)),
    'learnt', jsonb_build_object('cash_in', to_jsonb(v_cash_in), 'card_in', to_jsonb(v_card_in),
                                 'card_days', to_jsonb(v_settle), 'card_fee', round(v_fee, 4),
                                 'bank_days', to_jsonb(v_bank_days), 'bank_share', round(v_bank_share, 3),
                                 'pay_days', to_jsonb(v_pay_days), 'pay_delay', v_pay_delay, 'pay_from', v_pay_from),
    'days', v_days,
    'events', (select coalesce(jsonb_agg(x order by (x ->> 'day')::date, (x ->> 'amount')::numeric), '[]')
                 from jsonb_array_elements(v_events) x),
    'overdue', v_overdue,
    'warnings', v_warn);
end $$;

-- (profit.view) The next p_days (30 by default) from now, for Reports → Cash
-- ahead.
create or replace function cash_ahead(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('profit.view');
begin
  return cash_ahead_for(v_business, now(), coalesce(p_days, 30));
end $$;

-- -----------------------------------------------------------------------------
-- 2. The warning, on the Dashboard and the phone
-- -----------------------------------------------------------------------------
-- 0088's rules, and one more: the bank (or the safe) below nothing within the
-- fortnight ahead — red within three days — once the books go back four weeks.
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0088;
revoke execute on function alert_conditions_0088(uuid, timestamptz) from public, anon, authenticated;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0088(p_business, p_now) c
  union all
  select 'cash_short_ahead'::text, (w ->> 'from')::text,
         (case when (w ->> 'days_ahead')::int <= 3 then 'red' else 'orange' end)::text,
         case w ->> 'account'
           when 'bank' then format('The bank would be %s short on %s', trim_scale(-(w ->> 'lowest')::numeric), w ->> 'lowest_on')
           else format('The safe would be %s short on %s', trim_scale(-(w ->> 'lowest')::numeric), w ->> 'lowest_on') end,
         'From what it holds now, the usual takings and what is due, as the café''s own records have them.',
         case w ->> 'action'
           when 'move' then format('Move %s from the safe to the bank by %s.', trim_scale((w ->> 'move')::numeric), w ->> 'move_by')
           when 'later' then format('Ask %s to take %s later.', w -> 'later' ->> 'label',
                                     trim_scale(-(w -> 'later' ->> 'amount')::numeric))
           else 'Put money in, or pay something due later.' end,
         'medium', '/reports/cash-ahead', w
    from (select w from jsonb_array_elements(cash_ahead_for(p_business, p_now, 14) -> 'warnings') w limit 1) x
   -- Once the café's books go back four weeks: before, there is too little to judge the takings by.
   where exists (select 1 from journal_entry je where je.business_id = p_business
                   and je.occurred_at <= p_now - interval '28 days')
$$;

-- -----------------------------------------------------------------------------
-- 3. Who may call what
-- -----------------------------------------------------------------------------
revoke execute on function cash_ahead_for(uuid, timestamptz, int), alert_conditions(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function cash_ahead(int) from public, anon;
grant execute on function cash_ahead(int) to authenticated;
