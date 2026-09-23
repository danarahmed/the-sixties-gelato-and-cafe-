# Progress & Status

_Last updated: 2026-09-23._ This is the one place that says what works and what
does not. A feature is marked done only when it runs on the real database path
and is tested. Tested means the SQL suites on real PostgreSQL 16 and 17, the
browser tests through the real app, or both.

## Where things stand

- **Built and verified:** migrations `0014`–`0017` and the rebuilt app. The SQL
  checks (15), the browser suites (4, every role), the unit and contract tests
  (105) and a production build all pass.
- **Rehearsed on a copy of the live data:** the upgrade applied cleanly, and the
  correction sequence in [`REMEDIATION.md`](REMEDIATION.md) left every check at
  zero and locked July and August.
- **Live trial data cleared.** On 23 September 2026 the owner confirmed the
  live history was trial data, and it was cleared with
  [`supabase/remediation/clean-start.sql`](../supabase/remediation/clean-start.sql).
  The live database keeps the business, its locations, its chart of accounts
  and the owner's place, and nothing else.
- **Not yet live.** The live site still runs the previous app, and it is
  **publicly writable until this version is deployed.** See
  [`guides/deployment.md`](guides/deployment.md).

## The August 2026 audit, finding by finding

✅ closed · 🟡 partly · ⬜ open

| #    | Finding                                        | Status | How it is closed, or what remains                                                                                                                    |
| ---- | ---------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Public write access, no authentication         |   ✅   | Every person signs in; the database refuses the public key everything (`0016`, tested); no built-in key. _Live until deployed._                      |
| C-02 | Published journals editable and deletable      |   ✅   | Draft → lines → publish; a published entry never changes (`0014`)                                                                                    |
| C-03 | P&L not from the ledger                        |   ✅   | P&L, trial balance and reconciliation read published journal lines (`0017`)                                                                          |
| C-04 | Sales journal best-effort                      |   ✅   | The sale, its stock and its journal are one function, one transaction                                                                                |
| C-05 | Receipt and bill both debit Inventory          |   ✅   | Goods received not invoiced (2050); a bill clears it; price differences to 5050                                                                      |
| C-06 | No transaction boundaries                      |   ✅   | Every operation is one database function (`0015`)                                                                                                    |
| C-07 | Period lock bypassable                         |   ✅   | Every route into a locked month is refused (tested route by route)                                                                                   |
| H-01 | Idempotency key made on the server             |   ✅   | Made when the cart starts; a retry returns the sale already recorded                                                                                 |
| H-02 | Journal numbering broken                       |   ✅   | Gapless numbers from the database, tested under 20 concurrent posts                                                                                  |
| H-03 | Card sales posted to Cash                      |   ✅   | Each tender posts to its own account (1000 / 1010 / 1100)                                                                                            |
| H-04 | Offline advertised, not built                  |   ✅   | Honest instead: offline, the till says so and refuses the sale. A queue is not built (roadmap)                                                       |
| H-05 | No voids or refunds                            |   ✅   | Void the same day before the close; refund after, through 4200. Whole-sale refunds only                                                              |
| H-06 | Child tables readable across businesses        |   ✅   | `business_id` on every child table, row-level security on each                                                                                       |
| H-07 | Floating-point posting                         |   ✅   | Exact decimal strings in, `NUMERIC` in the database                                                                                                  |
| H-08 | Period close checks nothing                    |   ✅   | Closing checklist; the lock refuses until it passes; year end closes to 3100                                                                         |
| H-09 | Day boundaries in UTC                          |   ✅   | Trading days and periods in Asia/Baghdad time                                                                                                        |
| H-10 | Negative stock unguarded                       |   ✅   | Enforced when the business says so; otherwise costed at last cost and shown, never hidden                                                            |
| H-11 | Races in payments and auto-posting             |   ✅   | Row locks and unique references; overpayment impossible (concurrency tests)                                                                          |
| H-12 | Self-approved counts, client-supplied expected |   ✅   | Blind counts; expected snapshotted by the database; a second person approves                                                                         |
| M-01 | "Period" reports are lifetime totals           |   ✅   | Every report is for exactly the dates asked                                                                                                          |
| M-02 | Drafts in the trial balance                    |   ✅   | Published entries only                                                                                                                               |
| M-03 | Audit log never written                        |   ✅   | Every privileged action writes `audit_log` in its own transaction                                                                                    |
| M-04 | Recipe and price dates ignored                 |   ✅   | The recipe and price in force on the day are used                                                                                                    |
| M-05 | No closing entries or retained earnings        |   ✅   | 3100 Retained earnings; year-end close on locking the year's last month                                                                              |
| M-06 | Chart incomplete, not configurable             |   🟡   | Bank, GRNI, retained earnings, drawings, returns, PPV, count variance, equipment, depreciation, other added. No screen to add or deactivate accounts |
| M-07 | Duplicate supplier invoices                    |   ✅   | Refused; a bill entered in error is cancelled (kept on record)                                                                                       |
| M-08 | Vendor balance and ageing disagree             |   ✅   | Both from the same bills and payments; payables reconciled to 2000                                                                                   |
| M-09 | Discarding a published journal "succeeds"      |   ✅   | Refused with a clear message                                                                                                                         |
| M-10 | Platform reconciliation unreachable            |   ⬜   | Not built. Platform orders post to 1100; payouts are recorded by a journal ([`guides/talabat.md`](guides/talabat.md))                                |
| M-11 | Production has no write path                   |   ⬜   | Not built; the Production screen says so                                                                                                             |
| M-12 | Movement value ≠ unit cost × quantity          |   ✅   | Enforced by a constraint                                                                                                                             |
| M-13 | Stock adjustments unchecked                    |   ✅   | Allowed types only, cost from the ledger, a reason, manager approval over the threshold, journal in the same transaction                             |
| M-14 | Documents contradict the code                  |   ✅   | Rewritten against the code (this set). No automated check keeps them so                                                                              |
| L-01 | Journals with no lines                         |   ✅   | A published entry needs balanced lines                                                                                                               |
| L-02 | A finished sale's cost can change              |   ✅   | Cost, lines and tenders frozen                                                                                                                       |
| L-03 | Period names in UTC                            |   ✅   | Business timezone                                                                                                                                    |
| L-04 | Demo and real data mixed                       |   ✅   | The live trial records were cleared (`supabase/remediation/clean-start.sql`); the seed has no transactions; keep staging in a separate project       |
| L-05 | No exports or attachments                      |   🟡   | CSV for trial balance, P&L and reconciliation. No PDF, no attachments on bills or expenses                                                           |
| L-06 | Translations partial                           |   🟡   | Navigation, sign-in, the till and the offline messages in all three languages; most screen bodies still English                                      |

## Screens

| Screen              | Who                                                        | What works                                                                                              |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Sign-in, My account | everyone                                                   | Sign in, create a login for an invited email, reset and change password                                 |
| Dashboard           | owner, managers, accountant, auditor                       | Today from the books: net revenue, gross profit, orders, stock value, low and negative stock            |
| POS                 | cashier, barista, managers                                 | Channel-aware till, cash / card / platform-paid, exactly-once retry, honest offline                     |
| Orders              | cost viewers                                               | Every sale; void (same day) and refund (after), with reasons                                            |
| Sales               | cost viewers                                               | Daily summaries; close each trading day against the counted drawer                                      |
| Vendors             | cost viewers                                               | Statements, bills (for a receipt or an account), payments, cancel a bill, payable ageing                |
| Expenses            | cost viewers (recording: managers, accountant)             | Proposed account from the narration, confirmed by the person, posted in one step                        |
| Purchasing          | cost viewers (purchasing, managers)                        | Suppliers; receive goods with landed costs into stock and GRNI                                          |
| Products & Recipes  | cost viewers                                               | Create a product with its recipe and channel prices; change a price from a date; menu costing           |
| Inventory           | cost viewers; waste for baristas                           | Stock board from the ledger, add items with opening stock, record waste, manager corrections, movements |
| Stock Count         | counter; reviewers                                         | Blind count, submit, second-person review and approval                                                  |
| Delivery Platforms  | cost viewers                                               | Platform orders and their value; settlement import not built (M-10)                                     |
| Production          | cost viewers                                               | Batch history; batch entry not built (M-11)                                                             |
| Journals            | cost viewers (posting: accountant, owner, general manager) | Register, manual journals (draft/publish), reversal, owner's control correction                         |
| Chart of Accounts   | cost viewers                                               | Trial balance by period, closing checklist, lock and reopen, audit trail, CSV                           |
| Reports             | cost viewers                                               | P&L, "Do the books tie?", sales by channel, payable ageing, product margin, CSV                         |
| Settings            | owner, general manager                                     | People and roles, business configuration, locations, the role matrix                                    |

## Tests

| Layer                        | What                                                                                                          | Result      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| Unit, acceptance, contract   | `npm test`: the domain core, 12 acceptance scenarios, role matrix = database, every call = a granted function | 105 passing |
| SQL (PostgreSQL 16 and 17.6) | `scripts/test-sql.sh`: upgrade and clean-start rehearsals on the live migration order, 9 suites, concurrency  | 15 passing  |
| Browser                      | `scripts/test-e2e.sh`: every screen as every role, the day's work, retry, offline                             | 4 passing   |
| Build                        | `npm run build`, types, lint, formatting                                                                      | green       |

What is not built, and why, is in [`LIMITATIONS.md`](LIMITATIONS.md); the order
of the next work is in [`ROADMAP.md`](ROADMAP.md).
