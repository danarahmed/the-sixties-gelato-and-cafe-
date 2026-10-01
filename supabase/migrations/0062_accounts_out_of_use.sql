-- =============================================================================
-- 0062 — Accounts out of use, and sales by hand, put right after review
-- =============================================================================
-- A review of the chart of accounts on a screen (0058) and the bank against
-- its statement (0059) found:
--
--  * An account the café added and took out of use still takes the café's own
--    history: the year-end close of a year it was used in, the reversal of a
--    journal on it (a bill cancelled, an expense reversed, a prepaid expense
--    cancelled), and a share of a prepaid expense recorded on it while it was
--    in use. Each was refused ("Account … is missing or inactive"): locking
--    December stopped, with every check on its list clear, and so did every
--    month after it; a wrong bill on it stayed owed. Out of use, an account
--    takes nothing new; what was posted to it is still closed, reversed and
--    shared out.
--  * Sales revenue (4000), the merchant-funded discount (4100) and sales
--    returns (4200) took a journal by hand. The books tie sales recorded to
--    those three, and the month is not locked until they do: money in from
--    the bank's statement ("Record it") credited to 4000 stopped the month's
--    lock. They move only with sales and refunds now, as stock, payables and
--    the cash do; other income goes to an income account the café adds.

-- =============================================================================
-- 1. The journal builder: history posts to an account out of use
-- =============================================================================
-- 0015's, with one change: a reversal, the year-end close and a prepaid
-- expense's share (ledger.prepaid_share, 0060) may post to an account taken
-- out of use. Anything else still needs it in use.
create or replace function post_journal(
  p_business uuid, p_at timestamptz, p_description text,
  p_ref_type text, p_ref_id uuid, p_lines jsonb,
  p_reverses uuid default null, p_reference_no text default null)
returns uuid language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  l jsonb; v_account uuid; v_dr numeric; v_cr numeric;
  v_total_dr numeric := 0; v_total_cr numeric := 0;
  v_history boolean := p_ref_type in ('reversal', 'year_end_close')
                       or current_setting('ledger.prepaid_share', true) = 'on';
begin
  insert into journal_entry (id, business_id, description, reference_type, reference_id,
                             occurred_at, status, reverses_entry, reference_no)
  values (v_id, p_business, p_description, p_ref_type, p_ref_id,
          coalesce(p_at, now()), 'draft', p_reverses, p_reference_no);

  for l in select * from jsonb_array_elements(p_lines) loop
    v_dr := money_round(p_business, coalesce((l ->> 'debit')::numeric, 0));
    v_cr := money_round(p_business, coalesce((l ->> 'credit')::numeric, 0));
    if v_dr < 0 or v_cr < 0 then
      raise exception 'Journal line amounts cannot be negative (account %)', l ->> 'code';
    end if;
    continue when v_dr = 0 and v_cr = 0;
    select id into v_account from gl_account
     where business_id = p_business and code = l ->> 'code' and (is_active or v_history);
    if v_account is null then
      raise exception 'Account % is missing or inactive', l ->> 'code';
    end if;
    insert into journal_line (journal_entry_id, account_id, debit, credit, memo)
    values (v_id, v_account, v_dr, v_cr, nullif(l ->> 'memo', ''));
    v_total_dr := v_total_dr + v_dr;
    v_total_cr := v_total_cr + v_cr;
  end loop;

  if v_total_dr <> v_total_cr then
    raise exception 'Entry "%" does not balance: debits % <> credits %', p_description, v_total_dr, v_total_cr;
  end if;

  update journal_entry set status = 'published' where id = v_id;
  return v_id;
end $$;

-- =============================================================================
-- 2. Sales revenue moves only with sales and refunds
-- =============================================================================
-- 0060's list, with 4000, 4100 and 4200: the books' check ties them to the
-- sales and refunds recorded.
create or replace function manual_journal_blocked(p_code text) returns boolean
language sql immutable as $$
  select p_code in ('1000', '1001', '1005', '1006', '1200', '1210', '1300', '1400', '2000', '2050', '2100', '3100',
                    '4000', '4100', '4200')
$$;

-- =============================================================================
-- 3. Who may call what
-- =============================================================================
-- Both are called inside the database's own functions, never by hand.
revoke execute on function
  post_journal(uuid, timestamptz, text, text, uuid, jsonb, uuid, text), manual_journal_blocked(text)
  from public, anon, authenticated;
