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

## 1. Unit (Vitest, 223 tests)

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
  Baghdad trading day; the expense-account suggestions; what the drawer count
  previews (expected, over or short, what stays and what is taken out);
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
  the settings; the platforms screen's words in all three languages (`0031`).
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

| Suite          | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke`        | The template builds and the fixtures load                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `sales`        | Golden postings per tender and channel; exactly-once by key; negative stock; recipe and price dates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `refunds`      | Void until the drawer is counted; refund after; only returnable stock comes back                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `stock`        | Waste, corrections, opening stock (for a new item, and for one with no stock yet), the owner's alone, with a reason; blind two-person counts compared with the stock when each item is counted, while trading; one count at a time; cancelling; every movement journaled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `purchasing`   | Receipt → GRNI → bill → payment; landed cost; duplicate invoices; cancellation; overpayment; the café's own bill numbers (yearly count, passed over when taken, never reused, never typed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `journals`     | Draft/publish; subledger accounts and the till's cash closed to manual journals; reversal rules and dates; numbering                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `close`        | The trading day in Baghdad time; the drawer count; the closing checklist; every route into a locked month                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `reports`      | Trial balance, P&L and reconciliation from published lines, for exactly the dates asked; menu costs; each item's cost today, to the last digit, only for those who see costs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `discounts`    | A percentage (rounded to the business's step: to the dinar, then to 500) or an amount; each line's share; 4000 at full price and 4100; refunds, voids and the reconciliation; who may give one; bills, printed bills and splits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `pos`          | Tables, categories, photos judged by their bytes; bills paid later post exactly like a counter sale, once; stale tills refused; printed bills and cancellations guarded; split; the day held open by an open bill                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `production`   | Batch recipes, both ways: a base then its flavour, kept in pans; a batch's ingredients out at their cost and what came out in at exactly that, no journal, the ledger still tied; costs hidden from baristas; a made item sold; a batch cancelled; a product's recipe changed from a date                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `drawer`       | The drawer: a float, cash in and card beside it; paying out of the till, the safe, the bank, a card or the owner, and neither the till nor the safe below zero; a void, a count with takings to the safe; a sale after the count in the next one; moving cash, and only the owner taking it; 1000 always what the drawer should hold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `drawer_carry` | The cash taken since the last day closed the old way, carried into the drawer once as its record would write it, and the first count expecting it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `menu_changes` | `0025`: the recipe that started last is in force, whatever was changed in between; a same-day version replaces the other; scheduled prices and recipes listed and withdrawn; past prices refused; a printed bill paid at its printed prices (splits too), a stale total refused, a replay returned; uncosted sales listed and warned of                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `drilldown`    | `0026`: sales by channel with refunds on the day made and the cost returned to stock, agreeing with the P&L; the dashboard's gross profit is the P&L's, without the year-end close; journal lines that balance, add up to the P&L and reconciliation figures and run from the trial balance's opening to its closing; the stock card's kinds, running balances and closing, a void and a cancelled batch netted; who may see them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `master_data`  | `0027`: every price set, changed or withdrawn on the audit trail with the price before and who (none for SQL); products, items, units, suppliers, settings, places and categories added, changed and deleted, only what changed, with why; a sale keeps the name it was sold under; names unique among those in use, ignoring case, spaces and punctuation; items and suppliers taken out of use only when nothing needs them; units that keep their size; batch recipes audited; deliveries at a price per unit, a price more than 25% from the cost now refused until confirmed, against the last delivery with none on hand; price history                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `exceptions`   | `0028`: reasons from the list for voids, refunds, discounts and cancelled bills, "Other" in real words; PINs set, checked as a hash, never readable; who may approve; a discount over the cap refused without an approval, one covering it used once, by its requester, within ten minutes; an amount judged by its share and re-checked as the bill shrinks; five wrong PINs lock a manager for fifteen minutes; voids and refunds with and without a second person; lines taken off audited; the exceptions report by person, with what waits for review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `alerts`       | `0029`: on a new café, only its uncosted ingredients; the brief of a day — its facts, calculations and what to do — to the dinar, and nobody below a manager given it; each rule raised, as red or orange, with how sure it is, and cleared by what fixes it: the bank below zero, a drawer not counted for one day and for two, a count left open, running out (quiet with under a week of history and on a delivery's day, a supplier's own delivery time), below the reorder level (items never stocked too), a delivery price confirmed, no recipe, no cost (once, with its products), margins below cost and under the target (less sure on a last delivery's cost), a price typo, a waste spike, one person's exceptions, card and platform money not in, bills due and overdue, a payment made twice; one alert per condition however often it is read; answered with a note, snoozed with a reason, both audited; an orange alert that turns red asks again; nobody answers an alert about themselves; thresholds within their limits, back to the default when emptied, audited; the dashboard lists exactly what the rules find                                                                                                      |
| `settlements`  | `0030`: a card payment out of the bank; each day's card takings not yet settled, and nobody below a manager shown them; a settlement only of days that are over, in order, from the day after the last; the fee (never negative) to 6500, a difference between the till and the terminal to 6300 with a note; the money arriving after the takings; cancelled only the latest, with a reason, its days waiting again; a platform sale needs its order number, as the tablet shows it, once per platform (a replay is not asked again), and a dine-in sale has none; what each platform owes by order, the voided one nothing; a statement matched line by line (voided, not found, on it twice), the order it leaves out, its totals and proposed journal, with nothing written; posted only by a person who keeps the books, named, once, with a note for the lines that do not match; the orders paid no longer wait, each keeping what it paid; every line that did not match kept with the statement; cancelled, the orders wait again and the statement can be posted rightly; each on the audit trail; the alerts for orders past the cycle and 1100 that no order explains; the settlements closed to direct reads; the books still tie |
| `platforms`    | `0031`: a platform added by the owner (not a manager nor a cashier), with its names in other languages, its code made from its name (or platform_N for one in Arabic letters); once only, whatever the capitals; not one of the shop's own; refused, nothing kept; the channels in order, those out of use marked; set up like Talabat: every packaging line a Talabat order takes and every price on Talabat, from today, once; selling on it by its order number, once; what it owes and its statement matched and posted; renamed, taken out of use (no sale but a replay, no margin or price alerts, what it owes kept) and brought back; each on the audit trail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `languages`    | `0032`: a language added by the owner (not a cashier), its code and name checked, the three built in refused; words given in it (a dotted key, a phrase with values), a correction to a built-in Arabic word and taken back, words that drop a `{placeholder}` refused, words already so changing nothing; every page reads the café's languages in use and its reader's words, a member without any permission too; a language out of use leaves every page, its words kept; nobody reads or writes the tables directly; each change on the audit trail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `new_items`    | `0033`: an item added with the pack it is bought in, the pack checked as one added later is (not the base unit, holding something, a kilogram 1000 g, no two of one name), each refusal adding nothing; a reorder level not negative; no opening stock, its stock coming in with the delivery, entered by the pack (2 cartons of 24 at 6,000: 48 at 250); the item and its carton on the audit trail; the same name still refused; the rule no one's to call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `controls`     | Who may do what; tenant isolation; the public can call nothing; the exact list of callable functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Concurrency** (`scripts/test-sql-concurrency.sh`), with real parallel
connections:

- 10 simultaneous submissions of one sale record one order and one journal;
- 10 simultaneous full payments of one bill pay it once;
- 10 tills racing for 5 bottles sell exactly 5;
- 20 simultaneous journals number without gaps or collisions;
- 10 tills pressing Pay on one table's bill record one sale, and the other nine
  are handed it;
- 10 tills saving one bill from the same version: one change wins, nine are
  told to reopen it;
- 10 cash sales racing a drawer count: all recorded, each one's cash counted
  exactly once, by that count or the next;
- 10 dashboards opened at once: all load, and each condition keeps one open
  alert (`0029`).

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
  - the drawer counted — 500 short, a float kept, the rest to the safe — and
    the safe banked, refused beyond what it holds;
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
    is recorded, it fetches the new price, and the sale records 3,000 (`0025`).
- `flows` also checks that a bill still open holds the drawer count.
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
