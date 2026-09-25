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

1. **The September 2026 audit's action matrix**
   ([`SYSTEM_AUDIT_2026-09.md`](SYSTEM_AUDIT_2026-09.md)). Its P0s — counts
   while trading, the drawer across midnight, where money came from, a lost
   answer from the database — are fixed in `0024`, and P1-5 to P1-7 (the
   recipe and price in force, printed bills, sales costed at nothing) in
   `0025`, P1-2 (reports that agree, and numbers that open) in `0026`, and
   P1-1, P1-3 and P1-4 (who changed what, delivery prices checked, items and
   suppliers kept right) in `0027`, and P1-10 (reasons, approvals with a
   manager's PIN, the exceptions report) in `0028`; the other P1s come next. Then,
   on the owner's word, clear the test records and enter the opening balances
   ([`guides/deployment.md`](guides/deployment.md)).
2. **Delivery-platform settlements (M-10).** Import a Talabat statement, match it
   to platform orders with the tested `src/domain/platform/settlement.ts`, post
   the payout, commission and fees, and surface every unmatched line.
3. **Production, further (M-11).** Planned batches, lots and expiry dates, and
   stock moved between the central kitchen and the branch. (Recording batches,
   made items and their costs are built.)
4. **Translations (L-06).** Move the remaining screen text into the dictionaries,
   then check Arabic and Kurdish layouts on a phone.
5. **Statements and exports (L-05).** Balance sheet and cash flow from the
   ledger; PDF; invoice scans attached to bills and expenses.
6. **Accounts maintenance (M-06).** Add and deactivate accounts on screen, within
   the rules the database already enforces.
7. **Partial refunds,** and a reason and an approval limit on discounts (which
   the till already gives), with the audit trail.
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
