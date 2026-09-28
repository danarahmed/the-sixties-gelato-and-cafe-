# Known Limitations

What is **not** built, what is deliberately left out, and what depends on
something outside this repository. Nothing here is claimed to work. The status
of every audit finding is in [`PROGRESS.md`](PROGRESS.md).

## Before the books are relied on

- **The records so far are tests.** The live site has run this version, closed
  to the public, since 23 September 2026, when the trial history was cleared.
  Everything recorded since is a test too (the owner, 25 September), and is
  cleared when the owner says so, keeping the set-up
  ([`guides/deployment.md`](guides/deployment.md), "Clearing the test
  records"). Then each item needs its opening stock before its first sale, or
  that sale is costed at nothing.

## Not built

- **Settlements, what they do not do (`0030`).** A platform's statement is
  pasted from its report, not read from its file, and nothing comes from the
  platforms themselves (Talabat's partner feed needs an approved account). The
  statement is matched by order number, so the platform sales from before
  `0030`, which have none, are matched by nobody: the 1100 they hold is
  flagged until a journal explains it. Card takings are settled a run of whole
  days, once each day is over, and the totals are typed from the terminal's
  report and the bank statement, not read from them. A journal typed by hand
  into 1010 for a day already settled is left out of every settlement; it
  shows as 1010 holding more than the days waiting, and the card alert names
  it. The platform store and product maps and promotions of the original
  design are not used.
- **Delivery platforms the owner adds (`0031`), what they do not do.** A
  platform is never deleted, and its short name never changes: one no longer
  used is taken out of use, and its sales, orders and statements stay. A
  platform is named in the app's languages (English, Arabic, Kurdish). Its
  commission is not set on it: the statement says what the platform kept.
- **Look-alike names (release H, `0033`), what they do not catch.** A new
  item's names are compared with those of the items in use: a slip of the
  keyboard, the same words in another order, Arabic and Kurdish letter forms
  one hand writes for another. An abbreviation ("Choc sauce" beside "Chocolate
  sauce") or a word in another language that means the same is not caught, and
  items taken out of use are not compared (one is brought back on its own page,
  under Inventory). The same name, whatever its capitals, spaces or
  punctuation, is still refused by the database.
- **The barista's ticket (release I, `0034`), what it does not do.** It
  prints on the till's own printer, in the same print job as the customer's
  receipt, and is cut from it by the printer (or torn along the dashed line);
  a second printer at the bar would need a print server, since a browser sends
  a job to one printer. What the bar has had of a table's order is remembered
  by the till that saved it: on another till, or after the page is reloaded,
  **☕ Barista ticket** prints the whole order again, marked as a copy. A
  cancelled bill prints nothing for the bar. Turn numbers start again at
  midnight, the café's day, and are printed and shown on the till, not on the
  Sales and Orders screens.
- **Production (M-11), what it does not do.** Batches are recorded, costed and
  cancelled, and made items are kept and sold (see the walkthrough). It does not
  plan batches ahead, track lots or expiry dates, or move stock between the
  branch and the central kitchen; a batch is recorded at the branch, when it is
  made (not backdated).
- **Offline selling (H-04).** The till needs a connection. Offline, it says so
  and refuses the sale. A sale whose confirmation was lost is retried with the
  same key and recorded once, and since `0035` so is every other write from the
  app. An offline queue would need its own design for stock and prices that
  change while the till is offline.
- **Retry keys, what they do not cover (`0035`).** A screen keeps the key of an
  unanswered submission while it stays open; reloaded, it forgets it (only the
  till keeps its unanswered payment across a reload), so after a reload look
  before entering it again. Since `0036` a write sent through the API without
  a key is refused; SQL typed by hand without a key is done as before,
  unprotected.
- **Cash sessions, what they do not do (release K, `0036`).**
  - Each location has one drawer, with one session open on it at a time: two
    tills in one branch would share it. A drawer for each till comes with the
    branches (release AB).
  - The count is blind on the drawer's own screens. Someone who may read the
    sales (Orders, the daily summaries: a branch manager, say) can still add
    up the cash sales for themselves; a cashier and a barista may not read
    them.
  - Over and short is posted to 6300 with the session named on the journal,
    but not the branch: the location on journal lines comes with the branches
    (release AB). With one branch trading, every session is that branch's.
  - A session is never closed on its own. One left open stays open until its
    cashier or a manager closes it; the dashboard warns of it after 14 hours.
  - The count is in Iraqi dinars, typed as a total or counted in notes of 250
    to 50,000. Foreign cash is not counted (US dollars at the till are release
    R).
  - The Sales screen's old **Count the drawer** is gone, and since `0037` so
    is the database function behind it, `count_drawer`, which closed the open
    session during the update to `0036`.
  - The first opening takes over from the counts before sessions. On a drawer
    never counted, what it should hold is what the books say the till holds
    (1000 Cash in the till), so the first count is compared with the books,
    whatever they say.
- **Refunds, what they do not do (release L, `0037`).** A refund gives back
  some of a sale's items or all that is left of it. But:
  - The money goes back the way the sale was paid. A sale has one payment
    until split payments (release Q), so a refund has one too; a cash refund
    needs the drawer open, as since `0036`.
  - A sale recorded before `0037` that took stock is refunded whole, as
    before: its stock records do not say which of its lines took what.
  - A second person's approval is still optional: a refund nobody else
    approved waits for the owner on the Exceptions report. A limit above which
    a refund needs one is among the rules on Settings (release O).
  - A refund is never cancelled. One made by mistake is put right by selling
    the items again.
  - Only what can go back on the shelf does (a bottle of water, not a coffee
    made to order), at what it cost when it was sold.
  - A delivery platform's refund is taken off what the platform owes for the
    order; what the platform itself refunds its customer is not read from it.
- **Delivery corrections, what they do not do (release M, `0038`).** A
  delivery not yet billed is corrected on Purchasing, or reversed. But:
  - A billed delivery is not corrected: its bill is cancelled on Vendors
    first, the delivery corrected, and the bill recorded again. Credit notes
    and returns to the supplier are release S.
  - A date is corrected within the month the delivery was entered, and not
    after today. One entered in the wrong month is reversed and received
    again.
  - Freight, other costs and rebates are not corrected: they are shared out
    again over the corrected lines, by value, as when it was received.
  - The quantity of an item counted after the delivery is not corrected (the
    count set its stock); its price is.
  - A price corrected after some of the stock was used revalues only what is
    still on the shelf. The rest of the difference goes to purchase price
    variance (5050): the cost of what was already sold is not restated.
  - A delivery received before the controls is corrected by the owner, as in
    [`REMEDIATION.md`](REMEDIATION.md), not on Purchasing.
- **The books checked account by account, what they do not check (`0038`).**
  - The drawers are held to 1000 once a drawer has been counted in a session
    (0036). Before that the books are all there is, and the check says so.
  - The safe is held to what was moved in and out of it, and to the expenses
    and bills paid from it. Since `0038`, 1005 takes no manual journal: cash
    for the safe is moved in from the owner on Sales.
  - The platform sales from before order numbers are on no statement: a
    payout typed by hand into 1100 is taken to explain them, as far as they
    go. A payout typed by hand beyond them is flagged.
  - The check that every record has its journal covers what was recorded
    since the business's first journal of its own. What came before is the
    remediation's ([`REMEDIATION.md`](REMEDIATION.md)).
- **Usage against the recipes, what it does not do (release N, `0039`).**
  - It needs two approved counts of an item at a location: an item counted
    once in the dates is listed, waiting for a second count. Counts from
    before `0024`, which did not record when each item was counted, are not
    used.
  - What the difference is worth is at the stock's average cost when it was
    last counted, not at each day's cost.
  - A refund of something made to order puts nothing back on the shelf: what
    it used stays used, as the recipes say.
  - What may explain a difference is a list of things to look at, not a
    finding. Transfers between locations are not built, so nothing moves
    between them.
  - The alert looks only at each item's last two counts, the later in the
    last 14 days, and only at items a recipe uses.
- **The café's rules, what they do not do (release O, `0040`).**
  - A rule is set for the whole café, a role, a kind of item or one item. A
    rule for a branch waits for the branches (release AB).
  - The margin target stays among the alert thresholds on Settings, where
    its history already is; a target per category comes with the reports
    (release Y).
  - A loss saved to wait for approval is in the stock and the books at once:
    approving it changes only its record, and reversing it puts the stock
    back at the loss's own value.
  - Giveaways, transfers between branches and returns to a supplier will ask
    the stock rule when they are built (releases V, AB and S).
  - Refunds stay with managers (the owner's decision 3); what changed is the
    limit above which a second person approves one.
  - A delivery corrected keeps its own confirmation for stock left below
    zero; a rule that refuses it refuses the correction.
  - The business row's old columns stay, as the defaults, until they are
    retired. A journal's narration is still free text.
- **Sizes and add-ons, what they do not do (release P, `0041`).**
  - A new product starts with one size; the others are added on its card
    (the plan had them all on the new-product form).
  - An add-on adds what it uses; it does not take away what the size's own
    recipe uses. For a choice such as the milk, the milk comes out of the
    sizes' recipes and each choice carries its own (a group that asks for
    one), so every cup counts the milk it was made with.
  - An add-on's recipe changes from the next sale, not from a date, and is
    not versioned as a product's is: the audit trail keeps each change, and
    every sale keeps what it used.
  - An add-on's price is the same at every branch until the branches come
    (release AB).
  - The report does not take refunds off (Sales by Channel has them). How
    often an add-on is taken is counted against the products that offer its
    group today.
  - A group's fewest or most changed while a bill is open applies to that
    bill when it is next saved or paid: the till asks for the choice then.
  - An add-on on a platform's menu is priced for that platform like any
    channel; a platform whose own app sells add-ons still has them typed in
    at the till.
- **Split payments, what they do not do (release Q, `0042`).**
  - The till takes up to four payments, one of them in cash; the database
    takes ten.
  - The change is kept with the payment, not posted: it never stays in the
    drawer.
  - A refund gives back each way at most what that way paid: cash is not given
    back for a card payment (the card is refunded on the terminal).
  - A card slip's number is not recorded with its payment.
  - A delivery platform's order is paid once, by the platform.
  - Reports → Sales by payment method covers the dates chosen, not each day or
    each till. A part paid in dollars counts as cash there, at its part of the
    sale.
- **US dollars, what they do not do (release R, `0043`).**
  - One foreign currency, the US dollar, at the rate a manager sets: there is
    no rate fetched from a bank or an exchange office.
  - The till takes whole dollars, and the change is always given in dinars:
    dollars are never given back as change, and there is no dollar float.
  - A refund of a sale paid in dollars is given back in dinars.
  - The till's **Split** is in dinars and by card; dollars pay in the
    **$ Dollars** window, with the rest in dinars or by card.
  - Dollars are carried at what they were taken at (their average). A new
    rate does not revalue them; the difference shows when they are exchanged
    (6950 Exchange differences).
  - At each close all the till's dollars go to the safe. A close that does not
    count them (a till loaded before `0043`, or a manager's close without a
    count) leaves them in the till for the next count.
  - The drawer's figures are dinars only: the change given for dollars is a
    cash sale below nothing there. The day's cash sales count a part paid in
    dollars as cash.
  - Reports → Dollars shows what is held now, not as at the end of the dates.
- **Purchasing, what it does not do (release S, `0044`).**
  - An order is not sent to the supplier by the app: it is printed from its
    own page (or saved as a PDF from the print window) and sent by hand, then
    marked sent. There is no supplier portal and no email.
  - An order is for one supplier and one place. A delivery comes against one
    order at most; goods for two orders come as two deliveries. An order is
    not split, and a sent order is not changed (it is cancelled while nothing
    has come, or closed).
  - What has come of an order is counted by the item: a delivery's line of an
    item on the order counts against that order line, in its base unit.
  - The approval limit is on the order's total: there is no limit by supplier,
    by item or by month, and no second approver.
  - A credit is dated the day it is recorded; there are no back-dated credits.
    A credit that is never set against a bill stays on the supplier's account:
    the supplier refunding it in cash is not recorded here (a journal does it).
  - A return's credit is matched to the supplier's note at the return's own
    value: a note for another amount is recorded as the note it is, and the
    difference as a credit of its own (or a bill).
  - A return is not reversed or corrected: goods sent back by mistake come in
    again as a delivery. Nothing stops an item made here being returned
    without naming a delivery, at what it costs now.
  - A lower price revalues only what is still on the shelf of the delivery it
    names; what was used since goes to the price variance (5050), not back to
    the sales that used it.
- **Alerts, what they do not do (`0029`).** The rules are checked when the
  dashboard opens, not in the background, and nothing is sent: there is no
  email, WhatsApp or phone notification, and the daily brief waits on the
  dashboard rather than arriving at 07:00. The alert texts and the brief are
  in English only. Running out knows a delivery time per supplier, taken from
  the item's last delivery; an item with no delivery yet uses the café's.
  Use-by dates (P2-7) and a late sale (impossible since `0024`) raise
  nothing.
- **Balance sheet and cash-flow statements.** The trial balance carries every
  balance, and the P&L is built; the formatted balance sheet and cash-flow
  statements are not.
- **Chart of accounts maintenance (M-06).** The accounts a café needs are all
  there. Adding or deactivating one needs a migration: there is no screen for it.
- **Attachments and PDF (L-05).** There is no scan of an invoice on a bill or an
  expense, and no PDF export. CSV export exists for the trial balance, P&L and
  reconciliation.
- **Languages (L-06), what they do not do (release G, `0032`).** Every screen,
  message, alert and the books' own words are in English, Arabic and Kurdish,
  and the owner can add a language and give any phrase the café's own words.
  But:
  - The names the café types (products, variants, items, categories, suppliers,
    tables, people) are its own: products, items and categories have an Arabic
    and a Kurdish name beside the English; in a language the owner adds they
    show their English name. An account the owner adds or renames keeps the
    name typed.
  - CSV downloads keep English column names, so a spreadsheet or the
    accountant's software reads them the same whoever downloads them.
  - The expense rules propose an account from English words in the
    description ("rent", "salary"); a description written in Arabic or Kurdish
    gets no proposal, and the account is chosen by hand.
  - A page in Arabic or Kurdish carries that language's words (about 65 KB
    compressed on a full load).
  - Numbers are written with Western digits (1,500) in every language; typed
    Arabic-Indic and Eastern Arabic-Indic digits are accepted.
- **Transfers between locations.** The Central Kitchen exists as a location, but
  stock cannot yet move between locations.
- **Tax.** Out of scope by request. If the business is VAT-registered, that is a
  structural addition, not a setting.

## Needs something outside the repository

- **Talabat Partner API.** A live connection needs an approved partner account and
  credentials from Talabat.
- **Backups and restore drills.** The live project is on Supabase's free plan,
  which keeps no backups (checked on 26 September 2026); daily backups come with
  the Pro plan, which the owner has chosen not to take for now. A restore has
  not been drilled against this schema (see
  [`guides/backup-restore.md`](guides/backup-restore.md)).
- **MFA and sign-up policy.** Both are Supabase settings. The runbook recommends
  MFA for the owner, and turning off open sign-up once everyone has a login.
- **Monitoring.** No error monitoring or uptime checks are configured, and
  there is no channel to send alerts or the daily brief: the owner has chosen
  WhatsApp and email, to be set up later.

## Deliberate constraints (not bugs)

- Stock is never typed in: it is the sum of the movement ledger. It is corrected
  with a count or a manager's correction.
- A published journal, a finished sale and a bill are never edited. They are
  corrected by a reversal, a void or refund, or a cancellation, and both the
  original and the correction stay on record.
- A locked month refuses every posting. Reopening it is the owner's decision,
  with a reason on the audit trail.
- Full payment-card details are never stored.
