# Roadmap

Order of work, most important first. Transaction accuracy, access control and
the owner's ability to trust the books come before new features. Current status
is in [`PROGRESS.md`](PROGRESS.md).

## Done

Stages 0–5 of the August 2026 audit's roadmap:

- **Access closed.** Sign-in, roles, and a database that refuses anything else.
- **Postings made trustworthy.** One function per operation, immutable journals,
  and a period lock with no way around it.
- **Books reconciled.** GRNI, a P&L and trial balance from the ledger, card
  tenders, reports for exactly the dates asked, and a subledger reconciliation
  on screen.
- **Daily workflows completed.** Void and refund, exactly-once sales, business
  timezone, blind two-person counts, negative stock enforced.
- **Proved.** Golden accounting, controls, concurrency and upgrade tests on real
  PostgreSQL; browser tests as every role.

The one exception is H-04: offline selling was resolved by making the till
honest, not by building a queue.

Since then, each in [`PROGRESS.md`](PROGRESS.md):

- **The September 2026 audit's action matrix**
  ([`SYSTEM_AUDIT_2026-09.md`](SYSTEM_AUDIT_2026-09.md)): its P0s in `0024`,
  its P1s in `0025`–`0030`, the rest in releases J to AB
  ([`COMPLETION_PLAN.md`](COMPLETION_PLAN.md)), then the UX and integration
  pass. Orders finds a sale by its receipt, its journal, a refund, the
  platform's order number or the customer; Products & Recipes a product by
  its name in any language; Journals a journal by its number or words (P2-20).
- **Every screen in Arabic and Kurdish, and languages the owner adds (L-06),**
  from `0032`.
- **Statements and exports (L-05):** the balance sheet and the cash flow
  (`0052`), every report printed or saved as a PDF, and documents kept with
  the records (`0053`).
- **Partial refunds** (`0037`), and a reason and an approval limit on
  discounts (`0028`, `0040`).
- **Production and places (M-11):** batches, use-by dates and the day's plan
  (`0046`), stock sent between places (`0054`), tills and prices by branch
  (`0055`), and the books and every report by place (`0056`, `0057`).
- **The chart of accounts on a screen (M-06):** an income or a cost added,
  renamed, taken out of use and brought back (`0058`).
- **The bank against its statement** (`0059`).
- **Prepaid expenses** (`0060`, P2-14): a cost paid ahead is spread over the
  months it covers, each month's share an expense of that month; and a
  payment like one posted already is asked about before it is posted.
- **Statements read from their files.** A platform's report and the bank's
  statement are read from the file they come in (Excel, CSV, or the web page
  some banks give as an ".xls"), in the browser: the platform's orders are
  matched as before, and the bank's lines are found among the books' lines
  and ticked, with its lines not in the books listed to be recorded.

## Next

1. **What waits on the owner.** Backups and monitoring (the September audit's
   P1-11) wait for the choice of plans. The daily brief and red alerts sent by
   message (email or WhatsApp) wait for a channel. The test records are
   cleared, and the opening balances entered, on the owner's word
   ([`guides/deployment.md`](guides/deployment.md)). Talabat's own feed of
   orders and payouts waits on an approved partner account.
2. **Accounts, further (M-06), if it is needed.** An asset, a debt or the
   owner's money added on screen, with where each goes on the balance sheet
   and in the cash flow.
3. **Offline selling, if it is needed.** A queue with its own rules for prices
   and stock that change while offline, and a reconciliation of what synced.
4. **Operations.** Error monitoring (what the database refuses, and a call
   with no answer, are written to the app's log already), a scheduled restore
   drill, and staging as a separate Supabase project.

## Every release

1. `npm run verify`, `scripts/test-sql.sh` and `scripts/test-e2e.sh`, all green.
2. Phone, tablet and desktop checked; English, Arabic and Kurdish checked.
3. New migrations rehearsed on a copy of the live data before they are applied.
4. [`PROGRESS.md`](PROGRESS.md) and [`LIMITATIONS.md`](LIMITATIONS.md) updated to
   match what shipped.
