# Test Plan

Three layers, each answering a different question. All three run locally
against databases they create and drop. None of them ever touches a deployed
project.

| Layer   | Command               | Answers                                                            | Needs                                               |
| ------- | --------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| Unit    | `npm test`            | Are the rules right, and does the app call the database correctly? | Node                                                |
| SQL     | `scripts/test-sql.sh` | Do the books post, refuse, reconcile and upgrade correctly?        | a PostgreSQL 15+ server you may create databases on |
| Browser | `scripts/test-e2e.sh` | Does each person, on each screen, get exactly what they should?    | the same, plus Chromium (Playwright)                |

`npm run verify` runs formatting, types, lint and the unit layer. Run all three
layers before every release.

## 1. Unit (Vitest, 137 tests)

- `tests/primitives.test.ts`: exact money, unit conversions, moving average
  cost, journal balancing.
- `tests/acceptance.test.ts`: the 12 business scenarios of the specification
  (below), through the domain core.
- `tests/permissions-sync.test.ts`: the role matrix in TypeScript equals the
  `role_permission` rows in the migrations.
- `tests/rpc-contract.test.ts`: every function the app calls exists in the
  migrations, takes the parameters the app passes, and is granted to signed-in
  users.
- `tests/app-rules.test.ts`: where each role lands and what its menu offers,
  numbers typed in Arabic-Indic digits, what a till discount comes to (the
  percentage and the amount filling each other in, a percentage rounded to the
  nearest 500 IQD, and to the café's 250, as the books round it), what a new
  recipe costs as it is typed (units, lines of one item added before rounding,
  halves to even, every digit of the cost kept), where each line is used, the
  margin and the suggested price, the Baghdad trading day, and the
  expense-account suggestions.

## 2. SQL (`scripts/test-sql.sh`, about 450 assertions)

Runs against real PostgreSQL, with a small shim for Supabase's `auth` schema
and roles. Tested on 16 and 17.6 (the live version).

**Upgrade rehearsal.** The script:

1. replays the live database's migrations in the order it had them (0008 before
   0007; 0009 never);
2. loads history written the way the old app wrote it;
3. applies 0014 onward.

Then:

- `upgrade/1-history.check.sql`: nothing lost or altered; every entry dated,
  numbered, marked and made read-only; the reconciliation shows the damage to
  the dinar; the stock the old app never journaled is listed and not posted.
- `upgrade/2-remediation.check.sql`: the procedure in
  [`REMEDIATION.md`](REMEDIATION.md), one tool at a time, ends with every check
  at zero and August locked.

**Clean start.** The same history is cleared by
[`supabase/remediation/clean-start.sql`](../supabase/remediation/clean-start.sql),
the upgrade follows, and `clean-start/after-upgrade.check.sql` proves the result:

- only the business, its locations, its chart and its owner are left, and the
  upgrade adds no records back;
- the owner's real address links their confirmed sign-up;
- a first day of trading from empty books ties: opening stock, a menu item, a
  cash and a Talabat sale, every reconciliation check at zero, the day closed,
  journals numbered from 1001.

The script is also run with a table it does not know still holding a record,
where it must change nothing, and again after the upgrade, where it must refuse.

**Suites**, each in a fresh copy of a template database:

| Suite        | Proves                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke`      | The template builds and the fixtures load                                                                                                                                                                                       |
| `sales`      | Golden postings per tender and channel; exactly-once by key; negative stock; recipe and price dates                                                                                                                             |
| `refunds`    | Void same day before the close; refund after; only returnable stock comes back                                                                                                                                                  |
| `stock`      | Waste, corrections, opening stock; blind two-person counts; every movement journaled                                                                                                                                            |
| `purchasing` | Receipt → GRNI → bill → payment; landed cost; duplicate invoices; cancellation; overpayment; the café's own bill numbers (yearly count, passed over when taken, never reused, never typed)                                      |
| `journals`   | Draft/publish; subledger accounts closed to manual journals; reversal rules and dates; numbering                                                                                                                                |
| `close`      | The trading day in Baghdad time; day close once; the closing checklist; every route into a locked month                                                                                                                         |
| `reports`    | Trial balance, P&L and reconciliation from published lines, for exactly the dates asked; menu costs; each item's cost today, to the last digit, only for those who see costs                                                    |
| `discounts`  | A percentage (rounded to the business's step: to the dinar, then to 500) or an amount; each line's share; 4000 at full price and 4100; refunds, voids and the reconciliation; who may give one; bills, printed bills and splits |
| `pos`        | Tables, categories, photos judged by their bytes; bills paid later post exactly like a counter sale, once; stale tills refused; printed bills and cancellations guarded; split; the day held open by an open bill               |
| `controls`   | Who may do what; tenant isolation; the public can call nothing; the exact list of callable functions                                                                                                                            |

**Concurrency** (`scripts/test-sql-concurrency.sh`), with real parallel
connections:

- 10 simultaneous submissions of one sale record one order and one journal;
- 10 simultaneous full payments of one bill pay it once;
- 10 tills racing for 5 bottles sell exactly 5;
- 20 simultaneous journals number without gaps or collisions;
- 10 tills pressing Pay on one table's bill record one sale, and the other nine
  are handed it;
- 10 tills saving one bill from the same version: one change wins, nine are
  told to reopen it.

Tests date things by the business's own day (`test.today()`), never by the
server's clock: from 21:00 to midnight UTC, Baghdad is already on the next day.

## 3. Browser (`scripts/test-e2e.sh`)

Builds the real app and runs it against a real PostgREST on the same scratch
database, behind a small local stand-in for Supabase's auth service.

- `pages`: every screen signed out redirects to sign-in. Signed in as owner,
  manager, cashier and counter, every screen a role is offered renders, and every
  other one sends it home. The session cookie is HTTP-only.
- `flows`: the day's work through the screens:
  - cash and platform-paid sales, a void and a refund;
  - an expense, and a manual journal and its reversal;
  - a blind count approved by a second person, and the day close;
  - the reports and CSV;
  - adding a person, cancelling a bill, the owner's control correction;
  - posting the stock the old app never journaled, and billing that old
    delivery;
  - a bill left with the number the form offers is recorded as SGC-…, its
    journal carries it, the next is offered, and a used SGC number typed by
    hand is refused.
- `retry`: a sale whose confirmation is lost is retried and recorded once.
- `offline`: offline, the till says so and refuses the sale, in each language.
- `bills`: the till for a busy café:
  - a photo, a category and a ★ set on Products, and the photo served only to
    signed-in members;
  - three tables laid out by a manager;
  - a table's bill saved, printed, refused a cashier's reduction, and paid in
    cash with the change worked out;
  - a table split between two payers; a bill kept under a customer's name;
  - a bill cancelled by a manager with a reason;
  - a discount typed as 10% fills in 500 and typed as 750 fills in 15%; 7% of
    5,000 rounds to 500 and 47% to 2,500, and the sale posts what the till
    showed: 5,000 to 4000 and 2,500 to 4100.
- `flows` also checks that a bill still open holds the day open.
- `menu` (run last, as the costs stand after the others): a new product built
  on Products & Recipes shows each ingredient's cost, one serving's cost at a
  table and with the takeaway cup, each channel's cost beside its price, the
  margin (amber under the target, a loss in red) and a suggested price that one
  click takes; a line without its quantity stops the save; the recipe, where
  each line is used and the prices are saved as shown; and the saved product's
  card shows the same costs, the ones a sale posts.

## The 12 acceptance scenarios

| #   | Scenario                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------- |
| 1   | Receiving a carton of 1,000 straws adds exactly 1,000                                                 |
| 2   | A takeaway iced latte deducts coffee, milk, syrup, ice, cup, lid and straw, and no delivery packaging |
| 3   | The same drink via Talabat uses its price and adds the delivery packaging                             |
| 4   | A Talabat order's discount, commission, fee and refund give the right payout and contribution         |
| 5   | Re-importing the same external order does not duplicate the sale or the deduction                     |
| 6   | A gelato batch consumes ingredients and creates finished stock at the actual yield                    |
| 7   | A later recipe or price change does not change a completed sale's profit                              |
| 8   | A count of 930 against 950 expected posts −20 after approval                                          |
| 9   | A manager can approve an adjustment; a cashier cannot                                                 |
| 10  | A sale sent twice is recorded exactly once                                                            |
| 11  | A refunded consumable does not return used packaging to stock                                         |
| 12  | Settlement reconciliation finds a missing payout and a wrong fee                                      |

Scenarios 4, 6 and 12 are proven in the domain core only. Their live paths —
platform settlements (M-10) and production batches (M-11) — are not built yet.

## Adding a test

- **A new posting or control:** add assertions to the SQL suite that owns it.
  Write the golden entry the way an accountant would ("1000 Dr 5000 | 4000 Cr
  5000"), and assert every refusal with its message.
- **A new database function the app calls:** grant it in a migration, and add it
  to the list in `tests/sql/controls.test.sql`. The contract test checks the rest.
- **A new screen or role:** it is covered by `pages` once it is in the navigation.
  Add its main action to `flows`.
- **A migration:** run the upgrade rehearsal. Before it goes live, rehearse it on
  a copy of the live data (see [`REMEDIATION.md`](REMEDIATION.md), section 3).
