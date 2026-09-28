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

## 1. Unit (Vitest, 305 tests)

- `tests/primitives.test.ts`: exact money, unit conversions, moving average
  cost, journal balancing.
- `tests/acceptance.test.ts`: the 12 business scenarios of the specification
  (below), through the domain core.
- `tests/permissions-sync.test.ts`: the role matrix in TypeScript equals the
  `role_permission` rows the migrations insert (0015 sets them; later ones, such
  as 0023's `production.record`, add to them).
- `tests/rpc-contract.test.ts`: every function the app calls exists in the
  migrations, takes the parameters the app passes, and is granted to signed-in
  users.
- `tests/app-rules.test.ts`: where each role lands and what its menu offers,
  numbers typed in Arabic-Indic digits, what a till discount comes to (the
  percentage and the amount filling each other in, a percentage rounded to the
  nearest 500 IQD, and to the café's 250, as the books round it), what a new
  recipe costs as it is typed (units, lines of one item added before rounding,
  halves to even, every digit of the cost kept), where each line is used, the
  margin and the suggested price; what a batch uses and costs, before it is
  recorded, in any of the made item's units; a recipe reopened to change it; the
  Baghdad trading day; the expense-account suggestions; the drawer's count,
  typed or note by note, what stays and what is taken out at a close, and the
  answer and the drawer's state as the database gives them (`0036`); what a
  refund of some of a sale's items gives back, as the database works it out
  (each line's share of what it was sold for, half to even, the last of a line
  taking exactly what is left of it, so three refunds of one of three add up
  to the line) and more than is left refused (`0037`);
  which failed database calls are refusals and which may have been saved (no
  answer, a gateway giving up, the database unreachable); and a printed bill
  on the till at its printed prices (one more of the same too), and a bill on
  screen replaced when another till or a new price changed it (`0025`); when a
  trading day starts, across a change of clocks too, and sales by channel net
  of refunds (`0026`); the audit trail in words — what happened, what it was
  about, each value before and after with ids given their names, and who may
  read it — and a delivery line's total, its cost a base unit and how far that
  is from the cost now (`0027`); and the dashboard's alerts — red first, then
  orange, oldest first; answered and snoozed apart; one rule's orange alerts
  folded together; nobody answering their own exceptions; a snooze from
  tomorrow to 30 days — the thresholds checked as the database checks them
  (and every rule and threshold named as the migration names it), and the
  daily brief's facts, calculations and what to do, from the SQL test's day
  (`0029`); a platform's order number as its tablet shows it, in any script,
  kept to the database's rule; a card settlement's fee and difference as the
  database works them out; amounts as statements print them; a statement
  pasted from a spreadsheet, read by its column names (or in order without
  them), total rows left out, and what cannot be read said by its line; the
  match's lines, the orders it leaves out and its balanced journal; what each
  platform owes; the settlements named on the audit trail; the till's words
  for the order number in all three languages (`0030`); a delivery platform
  told from the shop's own three by its code; the channels in use, and "to go"
  as every one of them but a table (a platform the café added included, one
  out of use not); a recipe line's channels out of use kept when it is
  reopened; each channel named in the reader's language (a platform as the
  café named it there); the platform events named on the audit trail, with
  the settings; the platforms screen's words in all three languages (`0031`);
  and sizes and add-ons at the till (`0041`): the groups a size offers, those
  that ask for a choice first; a line added only when every group has what it
  asks, and no more; one of a line priced as the database prices it, and none
  where an add-on has no price on the channel; one more onto a line only with
  the same add-ons, whatever their order; a printed bill's add-on price kept
  for more of it; a bill on screen replaced when its add-ons changed; add-ons
  named in the reader's language, or by the bill's name once off the menu;
  the barista told of a line with other add-ons; and split payments
  (`0042`): a split's parts as the database checks them (the last, left
  empty, taking what is left; over or short of the total; a part of nothing;
  not whole dinars; cash handed over short of its part), the change, the list
  or the one tender of a payment an older till left waiting, the payments and
  change the database answers with, a refund shared over what is left of each
  payment as `allocate_landed` shares it, what is left of each way, and a
  refund's parts checked, in the database's words.
- `tests/i18n.test.ts` (release G): every phrase in Arabic and Kurdish, with the
  English's `{placeholders}` and `<tags>`, translated the same wherever it is
  repeated, and Kurdish in Kurdish letters; every `t("…")` a phrase the books
  have; no screen with English written straight into it
  (`scripts/i18n-scan.mjs`); every message a form, an action or the database
  gives (`scripts/db-messages.mjs`) translated; the alerts the database tests
  raise, and the daily brief, translated whole with their values, dates and
  account names; a translator's CSV read back as it was written.

## 2. SQL (`scripts/test-sql.sh`, about 800 assertions)

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
  cash and a Talabat sale, every reconciliation check at zero, the drawer
  counted, journals numbered from 1001.

The script is also run with a table it does not know still holding a record,
where it must change nothing, and again after the upgrade, where it must refuse.

**Clearing the test records.** A day of test trading
(`reset/trading.sql`: a float, cash and card sales, a void and a refund, a
delivery billed and paid, a bill under the café's own number, an expense,
waste, a count, a batch, a drawer count, cash banked, a journal and its
reversal, a bill left open) is cleared by
[`supabase/remediation/reset-test-data.sql`](../supabase/remediation/reset-test-data.sql).
It must refuse, changing nothing, without the owner's confirmation, with a
table it does not know holding a record, and with a period locked; a dry run
must report what it would clear and change nothing; run twice, it must do no
harm; and `reset/after.check.sql` proves the set-up is all there, the records
of trading are gone and the audit trail says so, and the café trades again
from nothing: journals from 1001, bills from 0001, opening stock at its cost
costing the first sale, the drawer from its float.

**Suites**, each in a fresh copy of a template database:

| Suite                 | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke`               | The template builds and the fixtures load                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `sales`               | Golden postings per tender and channel; exactly-once by key; negative stock; recipe and price dates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `refunds`             | Void until the drawer is counted; refund after; only returnable stock comes back                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `stock`               | Waste, corrections, opening stock (for a new item, and for one with no stock yet), the owner's alone, with a reason; blind two-person counts compared with the stock when each item is counted, while trading; one count at a time; cancelling; every movement journaled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `purchasing`          | Receipt → GRNI → bill → payment; landed cost; duplicate invoices; cancellation; overpayment; the café's own bill numbers (yearly count, passed over when taken, never reused, never typed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `journals`            | Draft/publish; subledger accounts and the till's cash closed to manual journals; reversal rules and dates; numbering                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `close`               | The trading day in Baghdad time; a session's close (the old drawer count closed since `0037`); the closing checklist; every route into a locked month                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `reports`             | Trial balance, P&L and reconciliation from published lines, for exactly the dates asked; menu costs; each item's cost today, to the last digit, only for those who see costs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `discounts`           | A percentage (rounded to the business's step: to the dinar, then to 500) or an amount; each line's share; 4000 at full price and 4100; refunds, voids and the reconciliation; who may give one; bills, printed bills and splits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `pos`                 | Tables, categories, photos judged by their bytes; bills paid later post exactly like a counter sale, once; stale tills refused; printed bills and cancellations guarded; split; the day held open by an open bill; a session closed with a bill open, the bill paid in the next one, its cash waiting for the drawer to open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `production`          | Batch recipes, both ways: a base then its flavour, kept in pans; a batch's ingredients out at their cost and what came out in at exactly that, no journal, the ledger still tied; costs hidden from baristas; a made item sold; a batch cancelled; a product's recipe changed from a date                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `drawer`              | The drawer in sessions (`0036`): nobody below the accountant is shown what it should hold before counting; a float, cash in and card beside it; paying out of the till only while it is open and holds the money, the amount it holds told only to those who may see it; the safe, the bank, a card or the owner; a void, a close with takings to the safe; no cash after the close until the drawer is opened again; cash refunds; moving cash, and only the owner taking it; a supplier paid and an expense reversed through the till; 1000 always what the drawer should hold; a month locked only when its sessions are closed; cash events never changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `drawer_carry`        | The cash taken since the last day closed the old way, carried into the drawer once as its record would write it; the first session then takes over from the books (what 1000 says the till holds), its opening count settling the difference                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `menu_changes`        | `0025`: the recipe that started last is in force, whatever was changed in between; a same-day version replaces the other; scheduled prices and recipes listed and withdrawn; past prices refused; a printed bill paid at its printed prices (splits too), a stale total refused, a replay returned; uncosted sales listed and warned of                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `drilldown`           | `0026`: sales by channel with refunds on the day made and the cost returned to stock, agreeing with the P&L; the dashboard's gross profit is the P&L's, without the year-end close; journal lines that balance, add up to the P&L and reconciliation figures and run from the trial balance's opening to its closing; the stock card's kinds, running balances and closing, a void and a cancelled batch netted; who may see them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `master_data`         | `0027`: every price set, changed or withdrawn on the audit trail with the price before and who (none for SQL); products, items, units, suppliers, settings, places and categories added, changed and deleted, only what changed, with why; a sale keeps the name it was sold under; names unique among those in use, ignoring case, spaces and punctuation; items and suppliers taken out of use only when nothing needs them; units that keep their size; batch recipes audited; deliveries at a price per unit, a price more than 25% from the cost now refused until confirmed, against the last delivery with none on hand; price history                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `exceptions`          | `0028`: reasons from the list for voids, refunds, discounts and cancelled bills, "Other" in real words; PINs set, checked as a hash, never readable; who may approve; a discount over the cap refused without an approval, one covering it used once, by its requester, within ten minutes; an amount judged by its share and re-checked as the bill shrinks; five wrong PINs lock a manager for fifteen minutes; voids and refunds with and without a second person; lines taken off audited; the exceptions report by person, with what waits for review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `alerts`              | `0029`: on a new café, only its uncosted ingredients; the brief of a day — its facts, calculations and what to do — to the dinar, and nobody below a manager given it; each rule raised, as red or orange, with how sure it is, and cleared by what fixes it: the bank below zero, a day's cash not counted for one day and for two, a session open too long (red at twice the limit), one short by the limit or more at its opening or its close (red at five times), one a manager closed (`0036`), a count left open, running out (quiet with under a week of history and on a delivery's day, a supplier's own delivery time), below the reorder level (items never stocked too), a delivery price confirmed, no recipe, no cost (once, with its products), margins below cost and under the target (less sure on a last delivery's cost), a price typo, a waste spike, one person's exceptions, card and platform money not in, bills due and overdue, a payment made twice; one alert per condition however often it is read; answered with a note, snoozed with a reason, both audited; an orange alert that turns red asks again; nobody answers an alert about themselves; thresholds within their limits, back to the default when emptied, audited; the dashboard lists exactly what the rules find                                                                                                                                                                                                                                                                                                                                                                                                       |
| `settlements`         | `0030`: a card payment out of the bank; each day's card takings not yet settled, and nobody below a manager shown them; a settlement only of days that are over, in order, from the day after the last; the fee (never negative) to 6500, a difference between the till and the terminal to 6300 with a note; the money arriving after the takings; cancelled only the latest, with a reason, its days waiting again; a platform sale needs its order number, as the tablet shows it, once per platform (a replay is not asked again), and a dine-in sale has none; what each platform owes by order, the voided one nothing; a statement matched line by line (voided, not found, on it twice), the order it leaves out, its totals and proposed journal, with nothing written; posted only by a person who keeps the books, named, once, with a note for the lines that do not match; the orders paid no longer wait, each keeping what it paid; every line that did not match kept with the statement; cancelled, the orders wait again and the statement can be posted rightly; each on the audit trail; the alerts for orders past the cycle and 1100 that no order explains; the settlements closed to direct reads; the books still tie                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `platforms`           | `0031`: a platform added by the owner (not a manager nor a cashier), with its names in other languages, its code made from its name (or platform_N for one in Arabic letters); once only, whatever the capitals; not one of the shop's own; refused, nothing kept; the channels in order, those out of use marked; set up like Talabat: every packaging line a Talabat order takes and every price on Talabat, from today, once; selling on it by its order number, once; what it owes and its statement matched and posted; renamed, taken out of use (no sale but a replay, no margin or price alerts, what it owes kept) and brought back; each on the audit trail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `languages`           | `0032`: a language added by the owner (not a cashier), its code and name checked, the three built in refused; words given in it (a dotted key, a phrase with values), a correction to a built-in Arabic word and taken back, words that drop a `{placeholder}` refused, words already so changing nothing; every page reads the café's languages in use and its reader's words, a member without any permission too; a language out of use leaves every page, its words kept; nobody reads or writes the tables directly; each change on the audit trail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `new_items`           | `0033`: an item added with the pack it is bought in, the pack checked as one added later is (not the base unit, holding something, a kilogram 1000 g, no two of one name), each refusal adding nothing; a reorder level not negative; no opening stock, its stock coming in with the delivery, entered by the pack (2 cartons of 24 at 6,000: 48 at 250); the item and its carton on the audit trail; the same name still refused; the rule no one's to call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `turn_numbers`        | `0034`: each day's orders numbered from 1: a quick sale as it is paid, a bill as it is opened, its sale and the part split off keeping its number, one from before numbers taking one when paid; a replay keeps its number; a refused sale or bill takes none, so none is skipped; each day and each business numbered apart; nobody takes a number by hand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `request_log`         | `0035`: fifty writes keyed (the old drawer count among them, closed since `0037`), each one function under its own name with the key last and the work in `<name>__run`, closed to callers; each kind of write sent twice with one key is recorded once and the retry told so (an expense, a delivery, a bill and its payment, a drawer count and its takings, a cash move, a loss, a correction, a count started, a bill opened, saved and cancelled, a void, a refund, a journal, a supplier, a price); a key with other details, another operation or another person refused; a refused call leaves its key free; no key, no protection (SQL), but refused through the API (`0036`), the writes a keyed write makes inside it excepted; the drawer's four writes and the refund by the item (`0037`) keyed; the new audit events; a loss valued at nothing recorded without a journal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `cash_sessions`       | `0036`: who may open, close and hand over the drawer, close another's session and see what it should hold; each sale and each movement of cash in the session open then, the sale naming it; closed blind, the answer the first place its figures appear; the notes counted and their total checked; over and short each posted to 6300 for its session, at the opening and at the close; a closed session takes no cash and closes once; handed over in one step; a manager's close with a reason, counted or not; a float from the safe at the opening, a manager's only; each sent twice with one key done once; the list of sessions and a session's statement, an open one's figures only to those who may see them; the audit trail; 6300 the sum of the differences; a closed session never changed; a new branch given its drawer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `partial_refunds`     | `0037`: each stock movement a sale makes names its line; a cashier may not refund; some of a sale's items given back, each its share of what its line was sold for after the bill's discount, the last of a line taking exactly what is left (three refunds of one of three: 2,333, 2,333 and 2,334); the rest refunded whole; more than is left, an item not on the sale or named twice, nothing chosen and nothing to give back each refused, changing nothing; sent twice with one key, given once; a sale part-refunded is not voided; cash from the drawer's open session and refused with the drawer closed, card off 1010, a platform's order off 1100, and what the platform owes and its statement's match reading what is left of the order; only returnable stock back on the shelf, at its own line's cost and in proportion, the last taking the rest; a sale from before `0037` refunded whole only; refunds numbered per business; the journal (4200 and the payment's account; 1200 and 5000); the audit trail; never changed; read only with `cost.view`; the day's sales and the reconciliation after; the old drawer count closed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `receipt_corrections` | `0038`: a delivery of 10 bottles corrected to the 8 that came, nothing used since: the two go out at the 300 they came in at, 2050 owes 600 less, as if 8 had been entered; the reason required; sent twice with one key, made once; a bill then records it at 2,400 and it is corrected no more; a price corrected after 50 espressos used 1 kg of 2: its preview first (8,000 onto the stock left, 12,000 more owed, 4,000 to 5050, two-thirds still on the shelf), then the revaluation as a pair of movements on the stock card; a sleeve for a single, an item for another, a supplier changed and billed with the new one, a date within the month only and never after today; a reversal taking all of it off; an item counted after the delivery refused for its quantity but not its price; below zero refused until confirmed; the permission (a cashier and a counter refused); a locked month; numbered across the business, never changed, on the audit trail; the stock ledger, GRNI and the records' check still at zero                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `reconciliation`      | `0038`: nine checks in order; a day of cash, card and Talabat sales ties everywhere; a payout typed by hand shows on the platforms' check and the month's checklist; the owner's correction of the till's cash, which no count supports, on the drawers' check; the takings moved to the safe on its check, and 1005 refusing a manual journal; a journal whose expense does not exist, and an expense with no journal, found, listed and blocking the lock; each check as at the end of its day; a cashier reads no records to look into; a platform sale from before order numbers owed until a payout typed by hand explains it, and flagged beyond it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `usage_variance`      | `0039`: beans counted at 990 g (10 g short, its adjustment left out of the use), 500 g received, fifteen espressos sold and two more voided, 30 g spoiled, counted at 1,130 g: 330 used where the recipes say 300, a difference of 30 g, 10%, 300 IQD, with the loss by its kind, the product that used it and what may explain it (more used; a voided sale); water sold three, one refunded back on the shelf and one found by hand: two used as the sales say, the correction by hand named; the cups, counted once, waiting for a second count; a day with no count empty; dates the wrong way refused; a cashier and the counter refused; the alert quiet under 5,000 IQD, naming the beans once the owner lowers it, and quiet again under the percentage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `business_rules`      | `0040`: every rule at its default (the business row's columns, the plan's for the rest); a rule set for a role with a reason, refused without one, out of its limits, in words, for a scope it does not take, as "allow" for the whole café, for an unknown rule, role or item, by a branch manager; set back to its default, the history from what to what and why, on the audit trail, never deleted; a cashier's own cap and the rounding step at the till; a refund over 25,000 refused without a second person and given with the owner's PIN, and one under the branch manager's own limit; water sold below zero with a red alert, refused under its own rule, sold with the manager's PIN (who approved it on the audit trail) or by the manager themselves, allowed with no alert; a made item refused by default; a correction by hand below zero refused; losses added up by person and by item: under the limit, waiting, approved with a PIN, worth nothing, each on its own, a manager's own; the list waiting, the dashboard's alert, approved once, reversed with a reason (stock and journal back), the books still tying; a batch beyond the beans approved, then refused; a delivery reversed below zero refused                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `sizes_addons`        | `0041`: a size added with its prices and the Regular's recipe copied (the one size renamed Regular in the same step), sent twice under one key and added once; one with its own recipe; refused: a name the product has (a retired one too), no recipe nor reason, a product sold as bought, a cashier; renamed, retired with a reason and brought back; the only size on sale kept; groups that ask for one (Milk), up to three (Extras) and any number, sensible numbers only, one of a name; add-ons with prices by channel (free, and one sold at a table only), recipes for every size and a Double's own, one of a name in a group; the till's catalogue; a sale refused without its milk, with two milks, over three extras, with an add-on not offered, twice, 21 of it, unknown, or where it has no price; a discounted sale of Triples with oat milk, an extra shot and vanilla and a Regular with whole milk: 16,000 less 1,600, each line and add-on's price, share and cost, each in its place, the stock and the journal; append-only; an add-on's item refused below zero; a bill kept, printed, its add-ons frozen when the price rises, more of the same at that price, reduced only by a manager (audited), an add-on on an open bill kept on sale, split and paid at the frozen prices, a Double's own vanilla used; a refund with the add-ons; a void putting them back; a group taken off the till kept by its product and taken up by no other; the report by size and add-on; the books still tying                                                                                                                                                                                           |
| `split_payments`      | `0042`: two espressos and a water paid 2,000 in cash (5,000 handed over, 3,000 change) and 4,000 by card: each payment in its order, the answer listing them, each account debited its part, the drawer taking the cash part; refused, recording nothing: payments short of the total or over it (a card for more), cash handed over short of its part, a card handed over, a part of nothing or below, half a dinar, an amount in words, platform-paid in the café or a card on Talabat, another way of paying, a tender and a list together, neither, eleven payments, a platform's order split, and a price that changed told as such first; sent again with its key, the sale as recorded; cash alone with its change; the old single tender; two cards on one line of 1010; a Talabat order paid once; a bill of 3,500 refused at 3,000 and still open, then paid in cash and by card; a void taking back the cash only; refunds: a water shared 333 in cash and 667 to the card, the cash from the drawer and the journal crediting each account; more cash than is left, parts that do not come to the refund, a way not paid, a way twice, a part of nothing and a part not in a list each refused; an espresso given back as the manager chose, sent twice with its key and given once, the same key another way refused; the rest to the card, the only way left; each payment given back exactly; the day's cash sales and refunds, the day's totals and the drawer counting a split sale once; the takings by payment; a cashier refused them; the cash, card and platform accounts; the books tying; a refund from before `0037` taken off the sale's one payment and counted in the day's cash refunds |
| `controls`            | Who may do what; tenant isolation; the public can call nothing; the exact list of callable functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Concurrency** (`scripts/test-sql-concurrency.sh`), with real parallel
connections:

- 10 simultaneous submissions of one sale record one order and one journal;
- 10 simultaneous full payments of one bill pay it once;
- 10 tills racing for 5 bottles sell exactly 5;
- 20 simultaneous journals number without gaps or collisions;
- 10 tills pressing Pay on one table's bill record one sale, and the other nine
  are handed it;
- through all of these races (`0034`), every sale has a turn number of its
  own, and none is skipped, though sales were refused and payments replayed;
- 10 tills saving one bill from the same version: one change wins, nine are
  told to reopen it;
- 10 cash sales racing the close of the drawer's session (`0036`): each
  recorded before it closes or refused after, the close going through beside
  them on exactly the cash that came in before it, and no cash outside a
  session;
- 10 people opening the drawer at once open one session, and the other nine
  are told it is open (`0036`);
- 10 dashboards opened at once: all load, and each condition keeps one open
  alert (`0029`);
- 10 connections sending one delivery, one expense and one close of the
  drawer, each with one key, at the same instant: each recorded once, the
  takings moved to the safe once, and the other nine told it already was
  (`0035`, `0036`);
- 10 refunds of one espresso each, at once, from a sale of three (`0037`):
  three go through, 7,500 is given back, and the sale is refunded in full once;
- 10 corrections of one delivery of 10 sleeves of cups to 8, at once
  (`0038`): one goes through, the other nine are told nothing was changed,
  and the stock comes off once.
- two baristas losing the same cream at once, each under the limit alone and
  together over it (`0040`): one loss is recorded and the other is told a
  manager approves it; and 10 tills selling the last bottle under a rule that
  refuses stock below zero: one sells it, nine are told there is none, and the
  books hold none, not less.

Tests date things by the business's own day (`test.today()`), never by the
server's clock: from 21:00 to midnight UTC, Baghdad is already on the next day.

## 3. Browser (`scripts/test-e2e.sh`)

Builds the real app and runs it against a real PostgREST on the same scratch
database, behind a small local stand-in for Supabase's auth service.

- `pages`: every screen signed out redirects to sign-in. Signed in as owner,
  manager, cashier and counter, every screen a role is offered renders, and every
  other one sends it home. The session cookie is HTTP-only. On a 390px phone,
  no screen reaches past the edge or is cut off: wide tables, the till's
  category chips and a vendor's tabs scroll inside their own box. Right to
  left too: every screen, header and menu included, fits in English and
  Arabic at 1280px and in Kurdish at 390px (nothing past the left edge, where
  a right-to-left page would scroll to it); and the menu that slides in from
  ☰, on a phone and on the till, is out of sight until opened and then wholly
  in view, in English, Arabic and Kurdish.
- `flows`: the day's work through the screens:
  - cash and platform-paid sales, a void and a refund; a Talabat sale waits
    for its order number (a colon refused), prints it, and the same number is
    refused a second time (`0030`);
  - an expense that must say where its money came from, refused from a till
    that cannot pay it, then paid from the bank; a manual journal and its
    reversal, with the till's cash not offered;
  - a blind count approved by a second person; opening stock for an item with
    none;
  - the drawer's session (`0036`): a bill still open named when it closes, and
    cancelled by a manager; a branch manager shown the drawer open but not
    what it should hold, the owner shown it; the cashier closing it on the
    till, counted note by note and blind — 500 short, posted to 6300, a float
    kept and the rest to the safe; Sales listing the session; cash then waiting
    for the drawer to open, and the next session opening on what was left;
  - the safe banked, refused beyond what it holds;
  - the reports and CSV;
  - adding a person, cancelling a bill, the owner's control correction;
  - posting the stock the old app never journaled, and billing that old
    delivery;
  - a bill left with the number the form offers is recorded as SGC-…, its
    journal carries it, the next is offered, and a used SGC number typed by
    hand is refused.
- `reports` (after flows, on its trading, `0026`): sales by channel net of the
  refund equal the P&L's net revenue; the P&L's 4000 opens lines that add up
  to it, and the trial balance's 1020 opens lines that close where it does;
  every journal line downloads as CSV, balanced and complete; the beans' stock
  card closes at the stock board's quantity; the dashboard's tiles say which
  gross profit they show and open today's orders; a reversed rent is marked
  and left out of the expenses' total; a cashier downloads no journal lines.
- `retry`: a sale whose confirmation is lost is retried and recorded once —
  also when it is the database's answer to the app's server that is lost.
- `offline`: offline, the till says so and refuses the sale, in each language.
- `resend` (`0035`): on each kind of screen the database does the work and its
  answer is lost — an expense, cash moved, a void, a refund of one item of two
  (`0037`), a journal, a bill kept open at the till, a delivery, a delivery's
  correction (`0038`) — and the screen says it is checking, sends it again
  with the same key and shows what was done, with the database holding it
  once; no subledger moves away from its account.
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
    showed: 5,000 to 4000 and 2,500 to 4100;
  - a bill printed at 2,500 a cup, then the price put up to 3,000 on Products:
    the bill is paid at 5,000; a till still showing 2,500 is refused, nothing
    is recorded, it fetches the new price, and the sale records 3,000 (`0025`);
  - two copies (release I): a quick sale takes the day's next number, shown
    for the customer; one press prints the receipt (the number and every
    amount, each line as how many, the price of one and what they come to:
    2 × 3,000 = 6,000) and the barista's ticket (the number, what to make and its note,
    no prices); printed again, the receipt comes alone and the ticket is
    marked as a copy. On a till set to print by itself, a table's bill takes
    the next number as it is opened, its ticket prints when it is saved, more
    for the table prints only what was added, the ticket asked for by hand is
    the whole order marked as a copy, and the paid bill's receipt prints alone,
    its sale keeping the bill's number.
- `drawer` (last, `0036`): the cashier hands the drawer to the manager on the
  till, counted, and the manager's session opens on what was left; the
  cashier's next cash sale goes into it and names it; the owner, shown what it
  should hold, closes it without a count, with a reason, the session keeping
  both; the manager opens the drawer with a float from the safe; the manager
  reads the week's sessions (the open one without what it should hold) and a
  closed session's statement, a cashier is sent home from them, and they fit
  a phone. The drawer is left open, as it was found.
- `refunds` (last, `0037`): on Orders a manager refunds one espresso and one
  water of a sale of three and two. The dialog starts from all that is left
  (9,500 back in cash, from the drawer), refuses 5 espressos when 3 are left,
  shows what one of each gives back (3,500) and waits for a reason; the answer
  names the refund, its journal and that the rest can still be refunded, and
  its slip prints REFUND, its number, 3,500 given back and why. Orders then
  shows the sale part-refunded, what went back and no Void; the bottle is back
  on the shelf. The rest (6,000) refunds it whole. One espresso of a card
  sale goes back to the card, and nothing leaves the drawer. The dialog fits
  a phone.
- `corrections` (last, `0038`): on Purchasing a manager corrects a delivery
  of 10 bottles to the 8 that came. What it does is shown first — 10 become 8
  on the delivery, the stock 600 less and 600 less owed — and nothing is done
  until it is confirmed with a reason; the answer names the correction and its
  journal (Cr 1200, Dr 2050, 600); the list shows the delivery at 2,400, with
  the correction, who made it, when and why under it; the stock card names the
  movement. A delivery entered by mistake is reversed: its ten cups go back out
  and nothing is owed, and the list marks it reversed with no correction
  offered. Billed, the corrected delivery offers none either. Reports shows all
  nine checks, the corrections leaving the stock's and GRNI's differences as
  they were; a journal whose expense does not exist
  is counted, listed among the records to look into with a link, and gone once
  reversed.
- `usage` (last, `0039`): cups counted, four taken away, and two fewer found
  at the next count: whatever earlier suites counted and sold, the Usage
  screen shows the cups two more used than the recipes explain, with the share
  and value the database has, what may explain it and, opened, the product
  that used them; with the owner's thresholds lowered the dashboard names them;
  the screen reads in Arabic, and a cashier is sent to their own screen.
- `rules` (`0040`): the owner opens Rules from Settings, changes the refund
  limit with a reason (not without one), sets a cap for the cashier, and sets
  the limit back to its default, each change kept and on the audit trail; at
  the till a juice the books do not hold is sold once a manager types their
  PIN, the approver kept and the dashboard's alert saying it is below zero; a
  barista's loss over the limit is saved to wait, the dashboard names it, and
  the manager approves it on Inventory; a refund over 25,000 waits for a second
  person and is given with the owner's PIN; the screen reads in Arabic, and a
  branch manager and a cashier are kept out.
- `payments` (`0042`): at the till two espressos are paid by **Split**, part
  by card and the rest in cash: parts over the total held back, the last part
  left empty taking what is left, 5,000 handed over for the cash part giving
  4,000 change; the receipt card and the printed receipt list each payment and
  the change; the database keeps each payment, the drawer takes the cash part
  and each account is debited its part. A named bill is paid by two cards.
  Orders shows each payment; a refund of an espresso starts from each way's
  share, refuses more cash than was paid and parts that do not add up, says
  how the money goes back each way, and its slip lists them; only the cash
  part leaves the drawer. Reports → Sales by payment method shows cash and
  card as the database has them.
- `addons` (`0041`): on Products the owner gives a latte a Large, its recipe
  copied and its one size named Regular in the same step; makes a group of
  milks the till asks for (whole, free; oat, 500, with its milk) and one of
  extras (up to three shots at 750), the form saying what the till will ask;
  gives the Large its own oat milk; and offers the milks with every size, the
  extras with the Large only, each change on the audit trail. At the till the
  Large is one sheet: the milk asked for first, nothing added until it is
  chosen, 6,000 as two shots are added; a Regular offered the milks alone; each
  line names its add-ons; the sale is recorded at the till's 9,000, the receipt
  and the barista's ticket list the add-ons, and the Large uses its own 200 ml.
  A table's bill printed at 3,500 is paid at 3,500 after the oat milk goes up.
  Orders names a line with its add-ons in their places; the report shows each
  size and add-on; a size is retired with a reason (on the audit trail) and
  brought back; Products reads in Arabic.
- `menu` (run last, as the costs stand after the others): a new product built
  on Products & Recipes shows each ingredient's cost, one serving's cost at a
  table and with the takeaway cup, each channel's cost beside its price, the
  margin (amber under the target, a loss in red) and a suggested price that one
  click takes; a line without its quantity stops the save; the recipe, where
  each line is used and the prices are saved as shown; and the saved product's
  card shows the same costs, the ones a sale posts. Then (`0025`) a price
  dated yesterday is refused; one for next week is listed as scheduled and
  withdrawn with a reason; a product with no recipe is refused until it says
  why it uses no stock, and flagged "Costed at nothing" when that is taken
  back; sold so, it posts no cost, Reports' Uncosted Sales lists it and why
  (exactly the database's list), and the month's checklist warns of it without
  counting it among the checks that stop the lock.
- `production` (run last, as it adds a barista): the owner sets up a base and a
  flavour made from it, kept in pans of 5 kg; a barista records two batches of
  the base, sees what they use, and is shown no cost anywhere; the owner records
  a batch of the flavour weighed short and sees its cost per kg; batches (and
  their cancelling) leave the stock reconciliation where it was; a manager
  cancels the batch with a reason; and
  a product's recipe is changed from today and costed on its card. The script
  refuses to start if servers from an earlier `E2E_KEEP` run still hold its
  ports, so the checks never run against an old build.
- `0028` in the suites above: in `flows`, a void with a reason from the list
  and no second person, and a refund with "Other" in real words approved by
  the owner's PIN after a wrong one, and Orders saying who approved each; in
  `bills`, a manager sets their PIN on My account (a run like 1234 refused, the
  PIN kept as a hash), a cashier's 47% discount waits for its reason and then
  for a manager's name and PIN (a wrong one refused), and the sale keeps who
  gave it, why and who approved it; a bill is cancelled with a reason from the
  list; in `reports`, the owner reads the exceptions by person, the unapproved
  void marked for review, and downloads them; a cashier cannot.
- `alerts` (`0029`): the owner's dashboard opens on what needs someone, red
  first (the bank taken below zero), with why, what to do and how sure; then
  yesterday's brief, its facts, calculations and what to do apart; then today's
  figures. A manager answers the red alert (a note too short is not taken) and
  it moves to answered, on the audit trail; the uncosted ingredients fold into
  one row, and the owner snoozes one with a reason; the money put back, the
  alert leaves by itself. The owner sets the margin target on Settings (96%
  refused) and empties it back to the default; a manager says the dairy takes
  4 days to deliver.
- `masterdata` (`0027`): a manager corrects an item (a name another
  item has is refused) and adds the bottle it comes in (a unit in use keeps
  its size); deliveries entered at a price per bottle show each line's total
  and cost a millilitre as typed; a price a digit short is asked about before
  anything is received, corrected and received, and a real rise is confirmed
  and audited; the item's price history lists each delivery; a vendor is
  renamed; a bill's amount starts empty; a sale keeps its name after the
  product is renamed; the owner reads each change with its values before and
  after, narrowed by kind and by person (prices set in the database show no
  one), and downloads the trail as CSV; a cashier cannot. On Purchasing
  (release H, `0033`), a receipt line's **+ New item** opens the new-item
  form and nothing can be received until it is added: "E2E vanila syrup"
  shows E2E vanilla syrup, which **Use it** puts on the line; the same name in
  other capitals cannot be added; "E2E sparkling water", named in Arabic and
  Kurdish and bought by the carton of 24 (not added until the carton says
  what it holds), is added, the line takes it by the carton, and 2 cartons at
  6,000 come in as 48 at 250; an item added elsewhere since the page opened
  is shown by the server before anything is added, and added only when the
  person says it is different; Inventory's form warns the same way, a
  look-alike opening its page.
- `settlements` (run last, `0030`): a manager sees the card takings waiting
  on Sales but cannot settle them; the owner sees today's wait for the day to
  end, settles yesterday's with the terminal 2,500 short and a fee of 50 (the
  fee and the difference shown before anything is posted, a note asked for),
  cancels it with a reason and settles again; on Delivery Platforms a manager
  sees the Talabat orders owed by number (the voided one not), pastes a
  statement — read by its column names, its total row left out — and matches
  it: each line matched or why not, the 50 not explained, the order it leaves
  out, the journal it would post, and no Post button; the owner posts it with
  a note, the orders paid leave the list, and cancels it; each on the audit
  trail.
- `platforms` (after `settlements`, `0031`): a branch manager sees Talabat in
  use and Careem and Toters not, and can add, rename or retire none; the owner
  adds Lezzoo with its Arabic and Kurdish names, set up like Talabat (its
  prices and packaging copied, counted in the message), and cannot add it
  twice; the cashier sells an espresso on its tab by the number from its
  tablet, at its Lezzoo price, taking the cup; in Arabic its tab reads ليزو;
  renamed; taken out of use it leaves the till while what it owes stays;
  brought back it is on the till again; each on the audit trail.
- `languages` (last, release G, `0032`): in Arabic and in Kurdish, every screen
  shows no English but what the café typed itself (names, codes, notes); a
  cashier opening Languages is sent home; the owner adds Turkish, gives it
  words on screen and by uploading a translator's CSV, and the page, its
  heading and its menu are in Turkish, left to right, a phrase with no words
  showing its English; a better Arabic word replaces the built-in one and,
  cleared, gives it back; Persian, written right to left, fits the screen;
  Turkish taken out of use leaves the menu, its words kept; each on the audit
  trail.

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

Scenarios 4 and 12 are proven in the domain core only: their live path,
platform settlements (M-10), is not built yet. Scenario 6's is (production
batches, `0023`).

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
