# Progress & Status

_Last updated: 2026-09-25._ This is the one place that says what works and what
does not. A feature is marked done only when it runs on the real database path
and is tested. Tested means the SQL suites on real PostgreSQL 16 and 17, the
browser tests through the real app, or both.

## Where things stand

- **Built and verified:** migrations `0014`–`0028` and the rebuilt app. The SQL
  checks (29, with the rehearsals of the upgrade, the clean start and clearing
  the test records), the browser suites (9, every role), the unit and contract
  tests (204) and a production build all pass.
- **Rehearsed on a copy of the live data:** the upgrade applied cleanly, and the
  correction sequence in [`REMEDIATION.md`](REMEDIATION.md) left every check at
  zero and locked July and August.
- **Live trial data cleared.** On 23 September 2026 the owner confirmed the
  live history was trial data, and it was cleared with
  [`supabase/remediation/clean-start.sql`](../supabase/remediation/clean-start.sql).
  The live database keeps the business, its locations, its chart of accounts
  and the owner's place, and nothing else.
- **Database upgraded on 23 September 2026.** Migrations `0014`–`0017` were
  applied to the live project and compared with the tested build object by
  object: identical. The public key can no longer read or write anything.
- **Live since 23 September 2026.** The owner added the Vercel settings, the
  app was redeployed, and the owner signs in. See
  [`guides/deployment.md`](guides/deployment.md).
- **The till for a busy café (migration `0018`):** tables, bills that wait for
  their money (printed, split, moved, cancelled only by a manager), product
  photos, categories and favourites, 80 mm printing. Built and tested. The
  migration was applied to the live database on 24 September 2026 and matches
  the tested build object by object; the screens went live the same day with
  [pull request #2](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/2). See
  [`guides/cashier-quickstart.md`](guides/cashier-quickstart.md).
- **Discounts (migration `0019`):** a percentage or an amount on the till, each
  filling in the other; revenue at full price in 4000, discounts in 4100; only
  a manager changes the discount on a printed bill. Built and tested. The
  migration was applied to the live database on 24 September 2026, matches the
  tested build object by object, and was checked as the owner in a transaction
  that was rolled back; the screens went live the same day with
  [pull request #3](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/3). See
  [`guides/cashier-quickstart.md`](guides/cashier-quickstart.md#giving-a-discount).
- **Discounts rounded (migration `0020`):** a percentage comes to the nearest
  step, so the till never asks for a few odd dinars (47% of 8,500 is 4,000 off,
  not 3,995); an amount is taken as typed. The till shows the figure the books
  record. Built and tested. The migration was applied to the live database on
  24 September 2026, matches the tested build object by object, and was checked
  as the owner in a transaction that was rolled back; the screens went live the
  same day with [pull request #4](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/4). The café's step was then changed from
  500 to **250 IQD** at the owner's request (a setting, on the audit trail).
- **The café's own bill numbers (migration `0021`):** a bill entered without
  the supplier's number is given SGC-2026-0001, -0002 …, filled in on the form.
  Each is given once, even to two people at the same moment, is never reused,
  and cannot be typed by hand; a supplier's own number can still be typed.
  Built and tested. The migration was applied to the live database on
  24 September 2026, matches the tested build object by object, and was
  checked as the owner in a transaction that was rolled back; the form went
  live the same day with
  [pull request #6](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/6).
- **Pricing a new product (migration `0022`):** the product form asks for the
  recipe first and costs it as it is typed, at today's stock costs and exactly
  as a sale will post it: each ingredient, then one serving on each channel.
  Each price then shows its margin (amber under the target, red for a loss),
  and a suggested price leaves the target margin, rounded up to 250 IQD. Where
  each line is used is one choice (every order, takeaway and delivery, dine-in
  only, or some channels) instead of a row of boxes. Built and tested. The
  migration was applied to the live database on 24 September 2026, matches
  the tested build object by object, and was checked as the owner in a
  transaction that was rolled back: for every price on the live menu, the
  form's cost equals the product card's. The form went live the same day with
  [pull request #8](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/8).
- **Production (migration `0023`):** batches of what the café makes (gelato, a
  base, syrup, dough), set up either way: a base made first and then flavoured,
  or each flavour from scratch. Recording a batch takes the ingredients out at
  their average cost and puts what came out in at exactly that cost, weighed,
  counted in pans or pieces, or as the recipe says; baristas record batches and
  are shown no cost; a manager cancels one with a reason. A product's recipe can
  now be changed from a date on Products & Recipes, to use what was made. Built
  and tested. The migration was applied to the live database on 25 September
  2026, matches the tested build object by object (permissions included), and
  was checked as the owner in a transaction that was rolled back.
- **Counts and the drawer (migration `0024`, the September 2026 audit's
  P0s):** a stock count compares each item with the stock when it is counted,
  so the café can trade while counting; one count at a time, and one can be
  cancelled. The day close becomes a drawer count covering everything since
  the last count, whatever the date — the café trades past midnight — with
  what stays in the drawer carried to the next count and the rest to the safe
  (new account 1005) or the bank. Every expense and bill payment says where the
  money came from; neither the till nor the safe pays more than it holds; 1000
  takes no manual journal. Cash moves between the till, the safe, the bank and
  the owner. An item with no stock history takes its opening stock at its cost.
  The till treats a lost answer from the database as "may have been saved"
  (P0-4). And [`supabase/remediation/reset-test-data.sql`](../supabase/remediation/reset-test-data.sql)
  clears the test records, keeping the set-up, when the owner says so. Built
  and tested. The migration was applied to the live database on 25 September
  2026, matches the tested build object by object (permissions included), and
  was checked as the owner in a transaction that was rolled back; the screens
  went live the same day with
  [pull request #10](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/10).
  The test records have not been cleared: that waits for the owner's word.
- **Prices, recipes and costs (migration `0025`, the audit's P1-5, P1-6 and
  P1-7):** the recipe in force is the one that started last, so a change made
  today no longer hides one scheduled for later; scheduled prices and recipes
  are listed on each product and can be withdrawn; a price cannot be dated in
  the past, and each is audited. A printed bill is paid at its printed prices,
  and every payment carries the total the till showed: the database refuses
  one it would record at another, and the till then fetches today's prices
  (it also does every ten minutes). Sales costed at nothing (no recipe, or an
  ingredient used before it had a cost) are listed on Reports and warned of at
  month end; a new product needs a recipe or a reason it uses no stock. Built
  and tested. The migration was applied to the live database on 25 September
  2026, matches the tested build object by object (permissions included), and
  was checked as the owner in a transaction that was rolled back.
  The screens went live the same day with
  [pull request #11](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/11).
- **Reports that agree, and numbers that open (migration `0026`, the audit's
  P1-2):** a refund counts on the day it is made, so net sales on Sales by
  Channel and Sales are the P&L's net revenue; the two profits are named for
  what they are (gross profit after waste & fees, and the sales margin); the
  dashboard no longer counts a year-end close as trading; a reversed expense is
  no longer counted as spent. Every dashboard figure, P&L and trial-balance
  line and reconciliation figure opens the records or journal lines behind it;
  every item has a stock card; every journal line downloads as CSV. Built and
  tested. The migration was applied to the live database on 25 September
  2026, matches the tested build object by object (permissions included), and
  its reports were checked as the owner against the live records. The screens
  went live the same day with
  [pull request #12](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/12).
- **Who changed what, delivery prices, items and suppliers (migration `0027`,
  the audit's P1-1, P1-3 and P1-4):** every change to prices, products, stock
  items and their units, suppliers, settings and places is on the new **Audit
  trail** screen, with the values before and after and the person — a change
  made in the database itself shows no one — and downloads as CSV. Opening
  stock is the owner's alone, with a reason; batch recipes are audited; each
  sale keeps the name it was sold under. A delivery is entered at its price
  per unit, and a price more than 25% from what the item costs now is asked
  about before anything is received; each item's card shows its price
  history; a bill's amount is typed from the invoice. Items and suppliers are
  corrected and taken out of use on their screens, pack units are added, and
  no two in use share a name. The merge tool waits until a duplicate exists
  (none do). Built and tested. The migration was applied to the live database
  on 25 September 2026, matches the tested build object by object
  (permissions included), and was checked as the owner in a transaction that
  was rolled back. The screens went live the same day with
  [pull request #13](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/13).
- **Exceptions under control (migration `0028`, the audit's P1-10):** every
  void, refund, discount and cancelled bill takes a reason from a list, and
  "Other" a few real words. A discount over 10% of the bill needs a manager's
  approval on the till — their name and the PIN they set on My account; a
  void or refund may be approved there by a second person, and without one it
  waits for the owner's review. Each sale keeps who gave its discount, why and
  who approved it; every line taken off a bill is on the audit trail; five
  wrong PINs in fifteen minutes stop that manager's approvals for a while. The
  **Exceptions** report on Reports lists all of it by person and downloads as
  CSV. Built and tested. The migration was applied to the live database on 25
  September 2026, matches the tested build object by object (permissions
  included), and was checked as the owner in a transaction that was rolled
  back. The screens went live the same day with
  [pull request #14](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/14).

## The August 2026 audit, finding by finding

✅ closed · 🟡 partly · ⬜ open

| #    | Finding                                        | Status | How it is closed, or what remains                                                                                                                    |
| ---- | ---------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Public write access, no authentication         |   ✅   | Every person signs in; the database refuses the public key everything (`0016`, tested); no built-in key. Live since 23 September 2026                |
| C-02 | Published journals editable and deletable      |   ✅   | Draft → lines → publish; a published entry never changes (`0014`)                                                                                    |
| C-03 | P&L not from the ledger                        |   ✅   | P&L, trial balance and reconciliation read published journal lines (`0017`)                                                                          |
| C-04 | Sales journal best-effort                      |   ✅   | The sale, its stock and its journal are one function, one transaction                                                                                |
| C-05 | Receipt and bill both debit Inventory          |   ✅   | Goods received not invoiced (2050); a bill clears it; price differences to 5050                                                                      |
| C-06 | No transaction boundaries                      |   ✅   | Every operation is one database function (`0015`)                                                                                                    |
| C-07 | Period lock bypassable                         |   ✅   | Every route into a locked month is refused (tested route by route)                                                                                   |
| H-01 | Idempotency key made on the server             |   ✅   | Made by the till when payment starts; a retry returns the sale already recorded, and so does one after a lost answer from the database (P0-4)        |
| H-02 | Journal numbering broken                       |   ✅   | Gapless numbers from the database, tested under 20 concurrent posts                                                                                  |
| H-03 | Card sales posted to Cash                      |   ✅   | Each tender posts to its own account (1000 / 1010 / 1100)                                                                                            |
| H-04 | Offline advertised, not built                  |   ✅   | Honest instead: offline, the till says so and refuses the sale. A queue is not built (roadmap)                                                       |
| H-05 | No voids or refunds                            |   ✅   | Void until the drawer holding its cash is counted; refund after, through 4200. Whole-sale refunds only                                               |
| H-06 | Child tables readable across businesses        |   ✅   | `business_id` on every child table, row-level security on each                                                                                       |
| H-07 | Floating-point posting                         |   ✅   | Exact decimal strings in, `NUMERIC` in the database                                                                                                  |
| H-08 | Period close checks nothing                    |   ✅   | Closing checklist; the lock refuses until it passes; year end closes to 3100                                                                         |
| H-09 | Day boundaries in UTC                          |   ✅   | Trading days and periods in Asia/Baghdad time                                                                                                        |
| H-10 | Negative stock unguarded                       |   ✅   | Enforced on sales when the business says so; otherwise shown, never hidden, and costed at the last incoming cost — so opening stock carries its cost |
| H-11 | Races in payments and auto-posting             |   ✅   | Row locks and unique references; overpayment impossible (concurrency tests)                                                                          |
| H-12 | Self-approved counts, client-supplied expected |   ✅   | Blind counts; expected read by the database when each item is counted (`0024`); a second person approves                                             |
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
| M-11 | Production has no write path                   |   ✅   | Batches recorded, costed and cancelled (0023); planning, lots and moves between locations not built                                                  |
| M-12 | Movement value ≠ unit cost × quantity          |   ✅   | Enforced by a constraint                                                                                                                             |
| M-13 | Stock adjustments unchecked                    |   ✅   | Allowed types only, cost from the ledger, a reason, manager approval over the threshold, journal in the same transaction                             |
| M-14 | Documents contradict the code                  |   🟡   | Rewritten against the code; the September 2026 audit (Appendix B) found drift again, and `0024` fixes the lines it touches. No automated check       |
| L-01 | Journals with no lines                         |   ✅   | A published entry needs balanced lines                                                                                                               |
| L-02 | A finished sale's cost can change              |   ✅   | Cost, lines and tenders frozen                                                                                                                       |
| L-03 | Period names in UTC                            |   ✅   | Business timezone                                                                                                                                    |
| L-04 | Demo and real data mixed                       |   ✅   | The live trial records were cleared (`supabase/remediation/clean-start.sql`); the seed has no transactions; keep staging in a separate project       |
| L-05 | No exports or attachments                      |   🟡   | CSV for trial balance, P&L and reconciliation. No PDF, no attachments on bills or expenses                                                           |
| L-06 | Translations partial                           |   🟡   | Navigation, sign-in, the till and the offline messages in all three languages; most screen bodies still English                                      |

## Screens

| Screen              | Who                                                        | What works                                                                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in, My account | everyone                                                   | Sign in, create a login for an invited email, reset and change password                                                                                                                                                                                       |
| Dashboard           | owner, managers, accountant, auditor                       | Today from the books: net revenue, gross profit, orders, stock value, low and negative stock                                                                                                                                                                  |
| POS                 | cashier, barista, managers                                 | Full-screen till: categories, search in three languages, photos, favourites; tables and bills paid later (print, split, move, cancel); cash with change, card, platform-paid; 80 mm bill and receipt printing; exactly-once payment and retry; honest offline |
| Orders              | cost viewers                                               | Every sale; void (until the drawer is counted) and refund (after), with reasons                                                                                                                                                                               |
| Sales               | cost viewers                                               | Daily summaries; count the drawer (everything since the last count, past midnight too), keep a float and send the rest to the safe or the bank; move cash between the till, the safe, the bank and the owner; every count's over or short                     |
| Vendors             | cost viewers                                               | Statements, bills (for a receipt or an account), payments saying where the money came from, cancel a bill, payable ageing                                                                                                                                     |
| Expenses            | cost viewers (recording: managers, accountant)             | Proposed account from the narration, confirmed by the person; where the money came from, always said; posted in one step                                                                                                                                      |
| Purchasing          | cost viewers (purchasing, managers)                        | Suppliers; receive goods with landed costs into stock and GRNI                                                                                                                                                                                                |
| Products & Recipes  | cost viewers                                               | Create a product: its recipe costed as it is typed, prices with their margin and a suggested price; change a price or the recipe from a date; menu costing; photos, categories, favourites, show or hide on the till                                          |
| Inventory           | cost viewers; waste for baristas                           | Stock board from the ledger, add items with opening stock, opening stock for items with none, record waste, manager corrections, movements                                                                                                                    |
| Stock Count         | counter; reviewers                                         | Blind count while trading, one at a time; submit or cancel; second-person review and approval                                                                                                                                                                 |
| Delivery Platforms  | cost viewers                                               | Platform orders and their value; settlement import not built (M-10)                                                                                                                                                                                           |
| Production          | cost viewers, baristas                                     | Record a batch with a preview of what it uses and makes; batch recipes (a base, then its flavours); batch history with cost per unit; cancel a batch                                                                                                          |
| Journals            | cost viewers (posting: accountant, owner, general manager) | Register, manual journals (draft/publish), reversal, owner's control correction                                                                                                                                                                               |
| Chart of Accounts   | cost viewers                                               | Trial balance by period, closing checklist, lock and reopen, audit trail, CSV                                                                                                                                                                                 |
| Reports             | cost viewers                                               | P&L, "Do the books tie?", sales by channel, payable ageing, product margin, CSV                                                                                                                                                                               |
| Settings            | owner, general manager                                     | People and roles, business configuration, locations, the role matrix                                                                                                                                                                                          |

## Tests

| Layer                        | What                                                                                                                                             | Result      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Unit, acceptance, contract   | `npm test`: the domain core, 12 acceptance scenarios, role matrix = database, every call = a granted function                                    | 163 passing |
| SQL (PostgreSQL 16 and 17.6) | `scripts/test-sql.sh`: upgrade and clean-start rehearsals on the live migration order, clearing the test records, 14 suites, concurrency         | 25 passing  |
| Browser                      | `scripts/test-e2e.sh`: every screen as every role, the day's work and the drawer, retry (a lost answer too), offline, bills, pricing, production | 7 passing   |
| Build                        | `npm run build`, types, lint, formatting                                                                                                         | green       |

What is not built, and why, is in [`LIMITATIONS.md`](LIMITATIONS.md); the order
of the next work is in [`ROADMAP.md`](ROADMAP.md).
