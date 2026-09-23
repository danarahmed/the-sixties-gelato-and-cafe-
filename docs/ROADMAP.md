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

## Next

1. **Go live.** Deploy this version ([`guides/deployment.md`](guides/deployment.md))
   and correct or restart the existing history ([`REMEDIATION.md`](REMEDIATION.md)).
   Until then the live site is publicly writable.
2. **Delivery-platform settlements (M-10).** Import a Talabat statement, match it
   to platform orders with the tested `src/domain/platform/settlement.ts`, post
   the payout, commission and fees, and surface every unmatched line.
3. **Production batches (M-11).** Record a batch: consume ingredients at average
   cost, put the output into stock at the consumed cost, post the yield variance.
4. **Translations (L-06).** Move the remaining screen text into the dictionaries,
   then check Arabic and Kurdish layouts on a phone.
5. **Statements and exports (L-05).** Balance sheet and cash flow from the
   ledger; PDF; invoice scans attached to bills and expenses.
6. **Accounts maintenance (M-06).** Add and deactivate accounts on screen, within
   the rules the database already enforces.
7. **Partial refunds and till discounts,** each with a reason, an approval limit
   and the audit trail.
8. **Offline selling, if it is needed.** A queue with its own rules for prices
   and stock that change while offline, and a reconciliation of what synced.
9. **Operations.** Error monitoring, a scheduled restore drill, and staging as a
   separate Supabase project.

## Every release

1. `npm run verify`, `scripts/test-sql.sh` and `scripts/test-e2e.sh`, all green.
2. Phone, tablet and desktop checked; English, Arabic and Kurdish checked.
3. New migrations rehearsed on a copy of the live data before they are applied.
4. [`PROGRESS.md`](PROGRESS.md) and [`LIMITATIONS.md`](LIMITATIONS.md) updated to
   match what shipped.
