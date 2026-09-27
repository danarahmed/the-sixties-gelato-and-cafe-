# Progress & Status

_Last updated: 2026-09-27._ This is the one place that says what works and what
does not. A feature is marked done only when it runs on the real database path
and is tested. Tested means the SQL suites on real PostgreSQL 16 and 17, the
browser tests through the real app, or both.

## Where things stand

- **Built and verified:** migrations `0014`–`0038` and the rebuilt app. The SQL
  checks (40, with the rehearsals of the upgrade, the clean start and clearing
  the test records), the browser suites (17, every role, every screen in
  Arabic and Kurdish, and a lost answer on each kind of screen), the unit and
  contract tests (304) and a production build all pass.
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
- **The system speaks (migration `0029`, the audit's P1-8):** the dashboard
  opens on what needs someone. Sixteen rules check the books each time it
  opens — cash below zero, a drawer not counted, a count left open, running
  out (by each item's use and its supplier's delivery time), below the reorder
  level, a delivery price confirmed, a product with no recipe, an ingredient
  with no cost, margins under the target or below cost, waste above its usual,
  one person's exceptions, card and platform money not in, bills due, price
  typos, possible duplicate payments — each saying what happened, why it
  matters, how urgent, what to do and how sure it is. An alert is answered
  with a note or snoozed with a reason (both audited), and resolves itself
  when the condition clears. Below it, yesterday's brief: facts, calculations
  and what to do, apart. The owner sets the thresholds on Settings; each
  vendor says how many days a delivery takes. Built and tested. The migration
  was applied to the live database on 25 September 2026, matches the tested
  build object by object (permissions included), and was checked as the owner
  in a transaction that was rolled back. The screens went live the same day
  with
  [pull request #15](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/15).
- **Card and platform money (migration `0030`, the audit's P1-9):** the card
  takings of each day, once it is over, are settled on Sales against the
  terminal's report and what reached the bank — the fee to 6500 Card and bank
  fees, a difference between the till and the terminal to 6300 with a note —
  and a settlement can be cancelled. A payment by card comes out of the bank.
  Every Talabat, Careem or Toters sale carries the order number from the
  platform's tablet, once. Delivery Platforms shows what each platform owes,
  order by order; a statement pasted from the platform's report is matched
  order by order (the orders it leaves out listed), and a person who keeps the
  books posts the payout it proposes. Built and tested. The migration was
  applied to the live database on 25 September 2026, matches the tested build
  object by object (permissions included), and was checked as the owner in a
  transaction that was rolled back. The screens went live the same day with
  [pull request #16](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/16).
- **Delivery platforms the owner adds (migration `0031`, asked for by the
  owner):** on Delivery Platforms the owner or the general manager adds a
  platform, with its name in Arabic and Kurdish, and copies the packaging and
  prices of the channel it works like; it is then a button on the till with
  its own prices, order numbers and statements. A platform can be renamed,
  taken out of use (it leaves the till and sells nothing more; what it owes
  stays) and brought back. The till, the menu, the reports and the audit trail
  read the channels from the database, and name each in the reader's
  language. Careem and Toters, never used, are listed as not in use. Built and
  tested. The migration was applied to the live database on 25 September
  2026, matches the tested build object by object (permissions included), and
  was checked as the owner in a transaction that was rolled back: a platform
  added (its code into the channel type), a second one of the same name
  refused, Careem brought into use and set up like Talabat (10 packaging
  lines, 7 prices) and sold at Talabat's price, and Talabat taken out of use
  and refused a sale while its 2 orders waiting stayed; the books reconciled
  to 0 before and after, and nothing was kept.
- **Arabic and Kurdish, right to left, fixed on every screen.** A hidden label
  in the page header, placed far off to the left, made every page in Arabic
  and Kurdish about 10,000 pixels wide, so a screen could scroll sideways into
  nothing; and the menu that slides in from ☰ (on a phone, and on the till at
  any width) sat over part of the page instead of sliding away, and would not
  open. Both are fixed, and the browser checks now read every screen in
  Arabic and Kurdish.
- **Every screen in Arabic and Kurdish, and languages the owner adds
  (release G, migration `0032`, asked for by the owner).** Before, only the
  menu, signing in and the till were translated. Now every screen is, in
  every detail: headings, buttons, forms, tables, hints and confirmations;
  every message a form or the database gives (the database's 333 included);
  the dashboard's alerts and the daily brief; the period-close checks, the
  reconciliation and the exceptions report; the audit trail; and the words
  the books write themselves (the chart of accounts set up, the narrations of
  the journals posted). On **Settings → Languages** the owner or the general
  manager adds a language (its code, its name, which way it is written),
  gives it words phrase by phrase or through a CSV a translator fills in,
  corrects any built-in Arabic or Kurdish word, and takes a language out of
  use; a phrase with no words yet shows its English. Every change is on the
  audit trail. The English is unchanged, word for word. Built and tested:
  every phrase checked to have its Arabic and Kurdish with the same values
  and marks, one translation per phrase, Kurdish in Kurdish letters; the
  alerts the database raises translated whole; and in the browser, every
  screen in Arabic and in Kurdish showing no English but what the café typed
  itself. The migration was applied to the live database on 26 September
  2026, matches the tested build object by object (permissions included), and
  was checked as the owner in a transaction that was rolled back: before, the
  pages read the three built-in languages and no words of the café's own;
  Turkish was added, and Arabic refused as a language to add (its words are
  corrected instead); three Turkish words were saved and words that dropped a
  value refused; a built-in Arabic word was corrected, read on the Arabic
  pages and cleared again; Turkish taken out of use left every page and kept
  its words; the audit trail gained exactly those five changes, and nothing
  was kept. See [`TRANSLATION.md`](TRANSLATION.md) and the owner's guide.
- **An item added while its delivery is received, and names that look alike
  (release H, migration `0033`, asked for by the owner).** Before, an item not
  in Inventory yet had to be added there first, and the receipt started
  again. Now each line of **Purchasing → Receive stock** offers **+ New item**:
  its names in English, Arabic and Kurdish, its type, how it is measured and
  the pack it is bought in (a carton of 24); it goes into Inventory, the line
  takes it by its pack, and its stock comes in with the delivery. While a name
  is typed, the items already there whose names look like it are shown — a
  slip of the keyboard ("Botled water" beside Bottled water), the same words in
  another order, Arabic and Kurdish letter forms — to use instead, or to add it
  all the same; the same name, whatever its capitals, cannot be added twice.
  Inventory's **Add stock item** is the same form and warns the same way.
  `0033` checks a pack given with a new item as one added later is checked (a
  name of its own, not the base unit's; a kilogram 1000 grams; no two of one
  name). Built and tested. The migration was applied to the live database on
  26 September 2026, matches the tested build object by object (permissions
  included), and was checked as the owner in a transaction that was rolled
  back: a pack named as the base unit, a kilogram of 500 grams and a carton
  holding nothing were refused; an item added with its carton of 24 and
  received by the carton, 2 at 6,000, came in as 48 at 250 each (receipt 9,
  12,000 IQD); the carton again under another size, and the same name in other
  capitals, were refused; the audit trail gained exactly the item and its
  carton; and nothing was kept — no item, unit, receipt, stock or journal, the
  receipts still numbered to 8 and the journals to 1072. The security and
  performance advisors report exactly what they did before.
- **A tidier till, and every order printed twice (release I, migration
  `0034`, asked for by the owner).** The till is now two panels the height of
  the screen. On the left, the menu: a search, the categories in a list down
  the side (along the top on a phone) with how many products each has, and
  larger tiles. On the right, the order as a ticket: who it is for and its
  number at the top, the channel chosen there, what is being sold in the
  middle, and the total, **Cash** and **Card** at the foot. How the till
  prints moved from under the order to **🖨** at the top: each till chooses
  whether it prints by itself and whether the barista's ticket comes out, and
  can print a test. Every order has a **number for the day**, from 1 each day,
  given by the database so two tills never give out the same one: a quick sale
  takes it as it is paid, a table's bill as it is opened, and its sale keeps
  it. Printing an order prints two slips, cut apart: the customer's
  **receipt**, redesigned (the café's mark and name, the number in a box, the
  order, date and cashier, each item with how many, the price of one and what
  they come to, and its note, the total, payment and change), and the
  **barista's ticket** (the number in large
  figures, who it is for, the channel, each item with how many and its note,
  without prices). A table's ticket prints when its order is saved, with only
  what was added and what was taken off; asked for again, it is the whole
  order, marked as a copy. Built and tested. The migration was applied to the
  live database on 26 September 2026, matches the tested build object by
  object (permissions included), and was
  checked as the owner in a transaction that was rolled back: a quick sale was
  number 1 and kept it when sent again; a sale at a total the customer was not
  shown was refused and took no number; a table's bill opened as number 2, the
  part split off it kept 2, and both sales kept 2 when paid; the next quick sale
  was 3; nobody could take a number by hand; the audit trail gained only the
  split; and nothing was kept (still 29 sales, 10 bills, journals to 1072, and
  no counter for the numbers). The security and performance advisors report
  exactly what they did before. After seeing it, the owner asked that each line of the
  receipt show the price of one as well as what the line comes to: the check
  and the bill printed before payment now read Qty · Item · Price · Amount
  (2 × 5,000 = 10,000).
- **Every write recorded once (release J, migration `0035`, the first step of
  [`COMPLETION_PLAN.md`](COMPLETION_PLAN.md)).** Until now only a quick sale and
  a bill's payment were safe against a lost answer; a delivery, a bill, a
  payment, an expense, a loss, a batch, a count, a cash move, a journal, a
  table's bill, a void or a refund sent again after a dropped connection was
  recorded again (a drawer count sent twice even moved the takings to the safe
  twice). Now all fifty such writes take a key: the screen makes it when the
  person submits, and the database stores its answer with the work, in the same
  transaction. With no answer the screen says _"Your previous submission may
  already have been saved. Checking…"_, sends it again with the same key, and
  shows what was done; the database answers a retry with what it did the first
  time, and refuses a key used for other details, another operation or by
  another person. Each function keeps its name and parameters; the key is its
  last, and the work itself, unchanged, is `<name>__run`, which only the
  database can call. The contract test fails any call from the app that does
  not send a key. Also: deliveries, supplier bills and payments, expenses,
  losses, batches, journals, count steps and tables are on the audit trail;
  only the owner may take away an owner's or a general manager's access; wrong
  PINs stop the person typing them (three in fifteen minutes), not the manager
  they name, and twenty in a day pause that manager's approvals by PIN until
  they set a new one; `close_day`, dead since `0024`, is closed; a loss valued
  at nothing is recorded instead of failing; a batch whose output has been used
  can no longer be cancelled; and the Expenses screen shows a card payment
  coming from the bank (1020), as the books record it. Built and tested. The
  migration was applied to the live database on 27 September 2026: the text
  stored there is the file byte for byte, and it matches the tested build
  object by object, permissions included (the one difference, as before, is
  the schema `citext` lives in). It was checked as the owner in a transaction
  that was rolled back: an expense sent twice with one key was recorded once,
  and the second answer said it was a replay; the same key with another amount
  was refused; cash moved twice with one key moved once; a bill opened twice
  with one key was one bill; nobody signed in could read the stored answers,
  call `record_expense__run` or call `close_day`; the audit trail gained the
  expense and the cash move; and nothing was kept (still 40 sales, 18 bills,
  4 expenses, journals to 1091, and no stored answers). The security advisors
  list the new table as function-only, as intended, and `close_day` as no
  longer callable; the performance advisors add only that `request_log`'s link
  to the person who sent it has no index, like 124 other such links (people
  are deactivated, never deleted).
- **The drawer in sessions, counted blind (release K, migration `0036`, the
  second step of [`COMPLETION_PLAN.md`](COMPLETION_PLAN.md)).** Until now the
  drawer was counted on the Sales screen, when a manager thought of it, and
  whoever counted it was shown first what it should hold. Now the person
  working the drawer opens it on the till by counting what is in it, and closes
  it by counting it again; only then is the count compared with what the
  drawer should have held, and the difference is posted to 6300 Cash over /
  short, as before. The count can be typed as a total or note by note. Cash is
  taken only while the drawer is open (a card sale needs no drawer), and every
  sale and every movement of cash belongs to the session open when it
  happened, so a session's cash sales, refunds, voids, paid-outs and takings
  add up to what it should hold, past midnight too. The drawer is handed to the
  next person in one step: counted, closed, and opened for them on what was
  left. A manager closes a session left open, with a reason, counted or not;
  a manager opening the drawer can put a float in from the safe. What an open
  drawer should hold is shown only to the owner, the general manager, the
  accountant and the auditor; a branch manager, cashier or barista sees it
  once their count is in. Sales lists the sessions, each with a statement of
  every movement of its cash; the dashboard warns of a session open too long
  (14 hours), one short by 5,000 IQD or more, and one a manager closed, both
  limits set on Settings. The first opening takes over from the
  drawer counts before sessions: what the last count left plus the cash since,
  or, on a drawer never counted, what the books say the till holds. From now
  on a write sent through the API without its retry key is refused. Built and
  tested. The migration was applied to the live database on 27 September
  2026: the text stored there is the file byte for byte, and it matches the
  tested build object by object, permissions included (the one difference,
  as before, is the schema `citext` lives in). It gave the Main Branch and the
  Central Kitchen their drawers. It was checked as the owner in a transaction
  that was rolled back: with the drawer closed, a cash sale, the old count and
  a keyed write through the API without its key were each refused; the first
  opening, counted at nothing, took over from the books, which say the till
  holds −320,000 IQD (the test records), took in the 20 movements of cash
  since the last day closed the old way, and posted the 320,000 to 6300 as
  over; opened twice with one key, it opened once; a cash sale of 3,000 named
  the session; the owner was shown that the drawer should hold 3,000, and the
  branch manager was not, nor its figures, its statement or the old screen's
  cash figures; the barista could not close the owner's session; closed at
  2,500, it was 500 short, posted to 6300, and the 2,500 went to the safe;
  cash was then refused again; no day was left uncounted and every movement
  of cash was in a session; the audit trail gained the opening and the close;
  and nothing was kept (still 40 sales, 18 bills, journals to 1091, the 20
  movements waiting for the first opening, and no stored answers). The
  security advisors add only the seven new functions signed-in users may
  call, each checking its permission, and three older functions no longer
  have a changeable search path; the performance advisors add only the new
  links without an index of their own (a drawer's business; a session's
  cashier, who closed it and the count it opened from) and the new index on a
  sale's session, not yet used. When the drawer is first opened on the live
  site, the same happens for real: the count is compared with the −320,000
  the test records leave in 1000, and the count plus 320,000 is posted to
  6300 as over, a test record like the rest.
- **Refunds by the item (release L, migration `0037`, the third step of
  [`COMPLETION_PLAN.md`](COMPLETION_PLAN.md)).** Until now a refund gave back
  the whole sale, so a customer bringing back one bottle of three was
  refunded everything and sold the rest again. Now **Refund** on Orders
  lists the sale's items, each with how many were sold and how many have gone
  back already, and gives back as many of each as are typed (all that is
  left, to begin with). Before anything is refunded it shows what each gives
  back: its share of what it was sold for after the bill's discount, in whole
  dinars, the last of an item giving back exactly what is left of it, so a
  sale's refunds always add up to the sale (three espressos with 500 off, 7,000,
  refunded one at a time: 2,333, 2,333 and 2,334). More than is left is
  refused. Each refund is a document of its own, numbered, with its items,
  the payment it went back to (cash from the drawer's open session, a card to
  1010, a platform's order off what it owes), its reason, who approved it,
  its journal (4200 against the payment's account; 1200 and 5000 for what
  went back on the shelf) and a slip printed on the till's printer. What can
  go back on the shelf does, at its own line's cost: every stock movement a
  sale makes now names its line. A sale is **Part-refunded** until nothing of
  it is left, lists its refunds on Orders, and can no longer be voided; what
  a platform owes for it is what is left of it. A second person's approval
  stays optional, as before (the limit that will require one is release O).
  A sale recorded before `0037` that took stock is refunded whole, as before.
  The old drawer count, `count_drawer`, kept through the update to `0036`, is
  closed. Built and tested: a new SQL suite, a race of ten refunds of one
  espresso each from a sale of three (three go through), a new browser suite,
  and a refund whose answer is lost given once. The migration was applied to
  the live database on 27 September 2026: the text stored there is the file
  byte for byte, and it matches the tested build object by object,
  permissions included (the one difference, as before, is the schema `citext`
  lives in). It was checked as the owner in a transaction that was rolled
  back: the old drawer count could no longer be called; the drawer, opened for
  the check, took over from the books as release K's check showed; a cash sale
  of three espressos (2,000 each) and two americanos (3,000 each, each with a
  bottle of water) named its line on all four of its stock movements; one of
  each refunded gave back 5,000 out of the drawer's session and put a bottle
  back on the shelf at its cost (212): refund 1, the sale part-refunded, its
  journal 1000 Cr 5,000, 4200 Dr 5,000, 1200 Dr 212, 5000 Cr 212; sent twice
  with one key, it was given once; three more espressos, a void and the
  cashier's refund were refused; the cashier read no refunds and the branch
  manager read it; the rest, refunded whole through the old call, was refund 2
  of 7,000, the two adding up to the sale's 12,000 with both bottles back; one
  espresso of a card sale went back to the card (1010) and nothing left the
  drawer; one americano of a Talabat order came off what Talabat owes, which
  then owed the 3,000 left; a sale from before `0037` was refused in part, and
  another was refunded whole (2,500, its bottle back on the shelf); every
  reconciliation check read as before; the five refunds were numbered 1 to 5,
  each its sale's adjustment with its payment; the audit trail gained the five
  refunds and the opening; and nothing was kept (still 40 sales, 4 voids and
  refunds, no refund documents, journals to 1091 and no stored answers). The
  security advisors add only `refund_sale_lines`, which signed-in users may
  call (it checks `sale.refund`), and no longer list `count_drawer`; the
  performance advisors add only the refund tables' links without an index of
  their own (a refund's approval, approver, journal, location, requester and
  session; the business of a refund's line and of its payment).
- **Delivery corrections, and the books checked account by account (release
  M, migration `0038`, the fourth step of
  [`COMPLETION_PLAN.md`](COMPLETION_PLAN.md)).** Until now a delivery entered
  wrong — two bottles fewer than came, a price typed wrong, the wrong item,
  supplier or day — could not be put right: a journal typed by hand left the
  stock, the delivery and its bill disagreeing. Now a delivery not yet billed
  has **Correct** and **Reverse** on Purchasing, for those who approve stock
  adjustments. Its lines, supplier and day are corrected as the invoice has
  them, and before anything is done the screen shows, item by item, what the
  correction does: the stock and its value, what is owed for it (2050) and the
  purchase price variance (5050). What was entered first is kept; each
  correction is a document of its own, numbered, with its before and after,
  its reason, who made it, its journal and its stock movements, listed under
  the delivery and on the audit trail. Units that come off or go on the shelf
  move at the delivery's own price as far as its stock is still there, and at
  the average cost for the rest; a price corrected revalues what is still on
  the shelf (a revaluation on the stock card) and puts the difference on what
  was already used to 5050, so the cost of what was sold is not restated. A
  reversal takes all of it off. Refused: once billed (cancel the bill first);
  the quantity of an item counted since; in a locked month; a delivery
  reversed or from before the controls; below zero until confirmed; a date
  outside the month it was entered, or after today. The bill is recorded for
  the delivery as it stands, and a reversed one has nothing to bill. **Do the
  books tie?** on Reports gains five checks, each blocking the month's lock
  too: the card takings not yet settled against 1010; the orders the platforms
  owe against 1100 (sales from before order numbers owed too, less the payouts
  typed by hand, as far as they go); what the drawers should hold against 1000
  (once a drawer has been counted in a session); the cash moved in and out of
  the safe against 1005, which no longer takes a manual journal; and every
  record with its one journal and every automatic journal with its record,
  the records to look into listed under the table, each with a link. Built and
  tested: two new SQL suites, a race of ten corrections of one delivery (one
  goes through), a new browser suite, and a correction whose answer is lost
  made once.

## The August 2026 audit, finding by finding

✅ closed · 🟡 partly · ⬜ open

| #    | Finding                                        | Status | How it is closed, or what remains                                                                                                                                |
| ---- | ---------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Public write access, no authentication         |   ✅   | Every person signs in; the database refuses the public key everything (`0016`, tested); no built-in key. Live since 23 September 2026                            |
| C-02 | Published journals editable and deletable      |   ✅   | Draft → lines → publish; a published entry never changes (`0014`)                                                                                                |
| C-03 | P&L not from the ledger                        |   ✅   | P&L, trial balance and reconciliation read published journal lines (`0017`)                                                                                      |
| C-04 | Sales journal best-effort                      |   ✅   | The sale, its stock and its journal are one function, one transaction                                                                                            |
| C-05 | Receipt and bill both debit Inventory          |   ✅   | Goods received not invoiced (2050); a bill clears it; price differences to 5050                                                                                  |
| C-06 | No transaction boundaries                      |   ✅   | Every operation is one database function (`0015`)                                                                                                                |
| C-07 | Period lock bypassable                         |   ✅   | Every route into a locked month is refused (tested route by route)                                                                                               |
| H-01 | Idempotency key made on the server             |   ✅   | Made by the till when payment starts; a retry returns the sale already recorded, and so does one after a lost answer from the database (P0-4)                    |
| H-02 | Journal numbering broken                       |   ✅   | Gapless numbers from the database, tested under 20 concurrent posts                                                                                              |
| H-03 | Card sales posted to Cash                      |   ✅   | Each tender posts to its own account (1000 / 1010 / 1100)                                                                                                        |
| H-04 | Offline advertised, not built                  |   ✅   | Honest instead: offline, the till says so and refuses the sale. A queue is not built (roadmap)                                                                   |
| H-05 | No voids or refunds                            |   ✅   | Void until the session holding its cash closes; refund after, whole or by the item, through 4200 (`0037`)                                                        |
| H-06 | Child tables readable across businesses        |   ✅   | `business_id` on every child table, row-level security on each                                                                                                   |
| H-07 | Floating-point posting                         |   ✅   | Exact decimal strings in, `NUMERIC` in the database                                                                                                              |
| H-08 | Period close checks nothing                    |   ✅   | Closing checklist; the lock refuses until it passes; year end closes to 3100                                                                                     |
| H-09 | Day boundaries in UTC                          |   ✅   | Trading days and periods in Asia/Baghdad time                                                                                                                    |
| H-10 | Negative stock unguarded                       |   ✅   | Enforced on sales when the business says so; otherwise shown, never hidden, and costed at the last incoming cost — so opening stock carries its cost             |
| H-11 | Races in payments and auto-posting             |   ✅   | Row locks and unique references; overpayment impossible (concurrency tests)                                                                                      |
| H-12 | Self-approved counts, client-supplied expected |   ✅   | Blind counts; expected read by the database when each item is counted (`0024`); a second person approves                                                         |
| M-01 | "Period" reports are lifetime totals           |   ✅   | Every report is for exactly the dates asked                                                                                                                      |
| M-02 | Drafts in the trial balance                    |   ✅   | Published entries only                                                                                                                                           |
| M-03 | Audit log never written                        |   ✅   | Every privileged action writes `audit_log` in its own transaction                                                                                                |
| M-04 | Recipe and price dates ignored                 |   ✅   | The recipe and price in force on the day are used                                                                                                                |
| M-05 | No closing entries or retained earnings        |   ✅   | 3100 Retained earnings; year-end close on locking the year's last month                                                                                          |
| M-06 | Chart incomplete, not configurable             |   🟡   | Bank, GRNI, retained earnings, drawings, returns, PPV, count variance, equipment, depreciation, other added. No screen to add or deactivate accounts             |
| M-07 | Duplicate supplier invoices                    |   ✅   | Refused; a bill entered in error is cancelled (kept on record)                                                                                                   |
| M-08 | Vendor balance and ageing disagree             |   ✅   | Both from the same bills and payments; payables reconciled to 2000                                                                                               |
| M-09 | Discarding a published journal "succeeds"      |   ✅   | Refused with a clear message                                                                                                                                     |
| M-10 | Platform reconciliation unreachable            |   ✅   | Each platform sale has its order number; a statement is matched order by order, and a person posts the payout (`0030`, [`guides/talabat.md`](guides/talabat.md)) |
| M-11 | Production has no write path                   |   ✅   | Batches recorded, costed and cancelled (0023); planning, lots and moves between locations not built                                                              |
| M-12 | Movement value ≠ unit cost × quantity          |   ✅   | Enforced by a constraint                                                                                                                                         |
| M-13 | Stock adjustments unchecked                    |   ✅   | Allowed types only, cost from the ledger, a reason, manager approval over the threshold, journal in the same transaction                                         |
| M-14 | Documents contradict the code                  |   🟡   | Rewritten against the code; the September 2026 audit (Appendix B) found drift again, and `0024` fixes the lines it touches. No automated check                   |
| L-01 | Journals with no lines                         |   ✅   | A published entry needs balanced lines                                                                                                                           |
| L-02 | A finished sale's cost can change              |   ✅   | Cost, lines and tenders frozen                                                                                                                                   |
| L-03 | Period names in UTC                            |   ✅   | Business timezone                                                                                                                                                |
| L-04 | Demo and real data mixed                       |   ✅   | The live trial records were cleared (`supabase/remediation/clean-start.sql`); the seed has no transactions; keep staging in a separate project                   |
| L-05 | No exports or attachments                      |   🟡   | CSV for trial balance, P&L and reconciliation. No PDF, no attachments on bills or expenses                                                                       |
| L-06 | Translations partial                           |   ✅   | Every screen, message and alert in English, Arabic and Kurdish; the owner adds languages and corrects words (`0032`). Limits: [`LIMITATIONS.md`](LIMITATIONS.md) |

## Screens

| Screen              | Who                                                        | What works                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in, My account | everyone                                                   | Sign in, create a login for an invited email, reset and change password                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Dashboard           | owner, managers, accountant, auditor                       | What needs someone first: the alerts, red then orange, answered with a note or snoozed with a reason (owner, managers, accountant); yesterday's brief; then today from the books: net revenue, gross profit, orders, stock value, low and negative stock                                                                                                                                                                                                                                        |
| POS                 | cashier, barista, managers                                 | Full-screen till: categories, search in three languages, photos, favourites; tables and bills paid later (print, split, move, cancel); cash with change (while the drawer is open), card, platform-paid with the platform's order number; the drawer opened, closed and handed over with a blind count; 80 mm bill and receipt printing; exactly-once payment and retry; honest offline                                                                                                         |
| Orders              | cost viewers                                               | Every sale; void (until its session closes) and refund (after), with reasons                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Sales               | cost viewers                                               | Daily summaries; the drawer: open, close or hand over a session with a blind count, keep a float and send the rest to the safe or the bank, close a session left open (managers), what an open drawer should hold (owner, general manager, accountant, auditor); the cash sessions, each with its statement and its over or short; move cash between the till, the safe, the bank and the owner; settle the card takings against the terminal and the bank (owner, general manager, accountant) |
| Vendors             | cost viewers                                               | Statements, bills (for a receipt or an account), payments saying where the money came from, cancel a bill, payable ageing; each vendor's details and how many days a delivery takes                                                                                                                                                                                                                                                                                                             |
| Expenses            | cost viewers (recording: managers, accountant)             | Proposed account from the narration, confirmed by the person; where the money came from, always said; posted in one step                                                                                                                                                                                                                                                                                                                                                                        |
| Purchasing          | cost viewers (purchasing, managers)                        | Suppliers; receive goods with landed costs into stock and GRNI                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Products & Recipes  | cost viewers                                               | Create a product: its recipe costed as it is typed, prices with their margin and a suggested price; change a price or the recipe from a date; menu costing; photos, categories, favourites, show or hide on the till                                                                                                                                                                                                                                                                            |
| Inventory           | cost viewers; waste for baristas                           | Stock board from the ledger, add items with opening stock, opening stock for items with none, record waste, manager corrections, movements                                                                                                                                                                                                                                                                                                                                                      |
| Stock Count         | counter; reviewers                                         | Blind count while trading, one at a time; submit or cancel; second-person review and approval                                                                                                                                                                                                                                                                                                                                                                                                   |
| Delivery Platforms  | cost viewers                                               | What each platform owes, order by order, and what 1100 holds that no order explains; match a pasted statement and post the payout it proposes (owner, general manager, accountant); cancel a statement posted; platform sales and their margin                                                                                                                                                                                                                                                  |
| Production          | cost viewers, baristas                                     | Record a batch with a preview of what it uses and makes; batch recipes (a base, then its flavours); batch history with cost per unit; cancel a batch                                                                                                                                                                                                                                                                                                                                            |
| Journals            | cost viewers (posting: accountant, owner, general manager) | Register, manual journals (draft/publish), reversal, owner's control correction                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Chart of Accounts   | cost viewers                                               | Trial balance by period, closing checklist, lock and reopen, audit trail, CSV                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Reports             | cost viewers                                               | P&L, "Do the books tie?", sales by channel, payable ageing, product margin, CSV                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Settings            | owner, general manager                                     | People and roles, business configuration, the alert thresholds, locations, the role matrix                                                                                                                                                                                                                                                                                                                                                                                                      |

## Tests

| Layer                        | What                                                                                                                                                                                                                                                                                                    | Result      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Unit, acceptance, contract   | `npm test`: the domain core, 12 acceptance scenarios, role matrix = database, every call = a granted function                                                                                                                                                                                           | 295 passing |
| SQL (PostgreSQL 16 and 17.6) | `scripts/test-sql.sh`: upgrade and clean-start rehearsals on the live migration order, clearing the test records, 26 suites, concurrency (sales, bills, keys and the drawer racing)                                                                                                                     | 37 passing  |
| Browser                      | `scripts/test-e2e.sh`: every screen as every role, the day's work, the drawer in sessions (opened, closed blind, handed over, closed by a manager), retry, and a lost answer on each kind of screen, offline, bills, pricing, production, master data, alerts, card and platform settlements, languages | 15 passing  |
| Build                        | `npm run build`, types, lint, formatting                                                                                                                                                                                                                                                                | green       |

What is not built, and why, is in [`LIMITATIONS.md`](LIMITATIONS.md); the order
of the next work is in [`ROADMAP.md`](ROADMAP.md).
