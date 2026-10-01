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
  pasted from its report or read from its file (see "Statements read from
  their files" below), and nothing comes from the platforms themselves
  (Talabat's partner feed needs an approved account). The
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
- **Production (M-11), what it does not do.** Batches are recorded, costed,
  numbered, used by a date and cancelled; made items are kept batch by batch
  and sold; the day's plan says what to make (see the walkthrough, and
  release U below). A batch is recorded at the place the device works at
  (the branch, or the central kitchen: release AB), when it is made, or by a
  manager up to a day late; what the kitchen makes goes to the branch by a
  transfer.
- **Batches, use-by dates and the plan, what they do not do (release U,
  `0046`).**
  - Stock is counted by item, not by batch: what a count finds missing comes
    off what is past its use-by first, then the stock with no lot, then the
    batch used by first; what it finds over is stock with no lot.
  - A batch past its use-by is sold last, not refused: its alert stays until
    what is left is recorded as expired (or counted, or its use-by changed).
  - What comes back to stock (a refund back on the shelf, a loss taken back)
    goes to the lots it left, the earliest use-by first, so a partial refund
    is taken to be the oldest of it; what a sale took beyond the stock is
    taken from the next batch that comes in, the latest sale first.
  - An item is kept batch by batch from its first batch after `0046`: what it
    had before is stock with no lot, and batches made before `0046` have no
    story of their own.
  - A batch is recorded late by a day at most, by a manager, and not with a
    time before one of its items was counted at its place, in a count open or
    approved (`0063`): the count found what it made and used, so its cost is
    in the count's difference, not in the production report.
  - The plan judges by the same weekday over the last 4 to 8 weeks alone: no
    season or holiday, and what is on hand now, so tomorrow's plan does not
    take off what today will still sell. A base is not planned for the
    flavours to be made from it.
  - The plan is for the place the device works at, judged by what was sold,
    made with and, since `0055`, sent to another place there: the central
    kitchen plans by what it sends the branch.
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
  - Each branch has one drawer (the owner's decision 1), with one session open
    on it at a time: two tills in one branch share it. Each branch's till
    counts its own drawer (`0055`).
  - The count is blind on the drawer's own screens. Someone who may read the
    sales (Orders, the daily summaries: a branch manager, say) can still add
    up the cash sales for themselves; a cashier and a barista may not read
    them.
  - Over and short is posted to 6300 with the session named on the journal;
    the profit and loss by place reads it at the session's branch (`0056`).
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
- **Finding things, what it does not do (the September audit's P2-20).**
  - **A sale, on Orders:**
    - The turn number called at the counter is not searched: it starts again
      each day.
    - A sale is not found by what was in it (a product's name) or by its
      amount.
    - A customer's sales are the ones they were named on at the till. Finding
      them by the customer also needs `customer.view`.
    - It shows at most 50 sales found each way, the latest first.
  - **A product, on Products & Recipes:** by its name or a size's only, not
    by what its recipe uses. A letter written differently in Kurdish and
    Arabic (ێ, ڕ, ڵ) is not taken for the other.
  - **A journal, on Journals:** by its number, or words in its description,
    its reference or a line's note; not by an account or an amount (an
    account's lines open from the trial balance). It shows at most 200, the
    newest first.
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
    finding. Stock sent to or from a place in the dates is counted as moved
    (release AB).
  - The alert looks only at each item's last two counts, the later in the
    last 14 days, and only at items a recipe uses.
- **The café's rules, what they do not do (release O, `0040`).**
  - A rule is set for the whole café, a role, a kind of item or one item. A
    rule for one branch is not built: the café's rules apply at every branch.
  - The margin target stays among the alert thresholds on Settings, where
    its history already is; a target per category comes with the reports
    (release Y).
  - A loss saved to wait for approval is in the stock and the books at once:
    approving it changes only its record, and reversing it puts the stock
    back at the loss's own value.
  - Giveaways (release V), returns to a supplier (release S) and transfers
    between places (release AB) ask the stock rule.
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
  - An add-on's price is the same at every branch: the till reads a branch's
    own add-on price (`0055`), but none can be set yet.
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
  - A bill is dated no earlier than the day its delivery came (`0063`): a
    supplier's invoice dated before the goods arrived is entered on the day
    they came, and its due date counts from that day.
- **What to buy, what it does not do (release T, `0045`).**
  - It is worked out when the page opens, for the place the device works at,
    and nothing is sent to anyone. What a place sends to another counts as its
    use, and what is on its way to it as coming (`0055`).
  - Use is judged on the last 28 days alone: no weekday or season, and a week
    of use more as the level to order up to when the item has no par level.
  - Items made here are left to Production. What their batches use is in each
    ingredient's use; what the day's plan will need (release U) is shown on
    Production, with what is short, and not added to the list.
  - Drafts count as coming: an item on a draft that is never approved is not
    suggested again until the draft is changed or cancelled.
  - The supplier suggested is the usual one, else the one the last delivery
    in a year came from; the price is the newer of the one agreed and that
    supplier's last delivery's. An order made on the purchase order form does
    not change the price agreed; its delivery does, once it comes.
  - One order is drafted for each supplier each time, even when a draft for
    that supplier is already open; a note for the supplier is added on the
    order itself.
- **Losses and giveaways, what they do not do (release V, `0047`–`0048`).**
  - A giveaway is given from a quick sale, not from a table's bill: to give
    away what is on a bill, take it off the bill (a manager, once the bill is
    printed) and give it away from a quick sale.
  - A giveaway is not on Orders and is not voided: once given, as the rules
    allow or with a manager's PIN, a mistake is corrected with a count or a
    stock correction. Only a loss saved to wait is reversed, whole.
  - A product recorded lost on Inventory comes out as its recipe makes it to
    eat in, without add-ons; what an add-on used is recorded as an item's
    loss. A product that uses no stock is refused there; at the till it is
    given away with the rest, costing nothing.
  - What is given away is costed at what its stock costs, not at the menu
    price: the report does not say what it would have sold for.
  - Reports → Losses lists the latest 300 losses in the dates; its totals
    count them all. A loss from before `0048` is counted as it was posted, to
    5300, whatever its kind.
  - 6110, 6610 and 6620 take expenses and bills too (a staff meal bought
    outside): Reports → Losses counts only what came out of stock.
- **Staff, their hours and their pay, what they do not do (release W,
  `0049`).**
  - Clocking is at the till, by name and PIN: there is no clock of its own, no
    fingerprint or face, and no clocking from a phone. The till clocks those
    who work at its branch, have a shift there today, or are clocked in there.
  - One shift a person a day, entered a week at a time; there are no breaks
    within a shift, and no rota templates beyond "the same hours as the week
    before".
  - Lateness, leaving early and absence are shown, not deducted: a manager
    deducts on the payroll, with a note. There are no leave, holidays or sick
    days: a day off is a day with no shift.
  - Overtime is each day's minutes beyond the person's standard hours; there
    is no weekly overtime, no night or holiday rate, and no pay for public
    holidays.
  - No tax, social security or other deduction the law may ask for is worked
    out: an amount deducted is typed, with why. No payslip is printed.
  - A payroll is one month, approved once the month is over. Someone paid by
    the month who starts or leaves within it is paid for the days employed,
    not the days worked.
  - A payroll is approved in the month it pays for: once that month is locked
    it cannot be posted, and the close warns (without blocking) when it is not
    approved. Reopened, its approval is reversed at its own date (`0063`), so
    a payroll whose month is locked is not reopened until the month is.
  - The people are kept when the test records are cleared; there is no
    screen to delete someone, only a last day.
- **Customers and their points, what they do not do (release X, `0050`).**
  - A customer is found at the till by their whole phone number: whoever sells
    can learn, number by number, who is a customer and their points, though
    not the list. The list, and a search by name or part of a number, are on
    Customers, for those who see customers.
  - Loyalty is by the dinar only: there is no loyalty by visits, no tiers, and
    points do not expire. A reward is a fixed amount off, taken whole; there is
    no free item, and a reward cannot join another discount on one bill.
  - Nothing is sent to a customer: there is no SMS, WhatsApp or email, no
    birthday offer, and no receipt by message. A customer's points are on
    their printed receipt.
  - A reward is a discount, not a liability: the points outstanding are shown
    on Reports → Customers, and their worth reaches the books only as rewards
    are taken.
  - A delivery platform's customers are its own and are not kept here; a bill
    split in two leaves the new bill with no customer; a sale already paid
    cannot be given a customer afterwards.
  - A delivery's address is kept on its sale, and the sales are read by
    whoever sees costs: someone who sees costs but not customers (a branch
    manager, purchasing) could read it from the database, though none of their
    screens shows it.
  - Customers are kept, and their points cleared, when the test records are
    cleared; a customer is put away, never deleted, and there is no merging
    of two customers into one.
- **The sales analysis and the stock's value, what they do not do (release
  Y, `0051`).**
  - The sales are seen one way and a second at most, from a fixed list, with
    the figures that go with it: there is no pivot of any three ways, no
    measure chosen by hand, no view saved, and no comparison with the same
    dates last month or last year.
  - A year of dates at most, and 2,000 rows (the totals count them all).
  - A refund is taken off the sale it gave back, whenever it was made, so the
    analysis of past dates changes when an old sale is refunded, and its
    total can differ from the P&L's for the same dates, which counts a refund
    on the day it was made. The add-ons are shown without their refunds.
  - The bars are the only picture: there are no charts. With more than one
    branch, the analysis can be narrowed to one.
  - The stock's value on a day is the stock ledger's, at the costs it
    carried; it is not a count, and it does not revalue stock at today's
    prices.
- **The balance sheet and the cash flow, what they do not do (release Z,
  `0052`).**
  - They are the books' own figures: the published journals, as the trial
    balance has them. A draft is not in them; a journal published later for a
    day in the dates is in them from then on.
  - Where an account's cash goes is read from its code, so a manual journal
    that moves cash is read by its other accounts, whatever it was for. A
    bill paid is read by the one account it was charged to; a bill for goods
    delivered counts as paid to a supplier.
  - Card takings become cash when they reach the bank (1010 is not cash), and
    a platform's when it pays out (1100).
  - Dollars stay at the value they were kept at: the statements do not
    revalue them at today's rate. What changing them gained or lost is a line
    of its own.
  - There is no indirect method (from the profit to the cash), no notes, and
    no comparison with the same dates of an earlier year: the balance sheet
    shows the start and the end of the dates side by side.
  - A year of dates at most for the cash flow; the balance sheet for any day
    up to today. They are the café's as a whole; each place's profit and loss
    is on Reports (`0056`).
- **Alerts, what they do not do (`0029`).** The rules are checked when the
  dashboard opens, not in the background, and nothing is sent: there is no
  email, WhatsApp or phone notification, and the daily brief waits on the
  dashboard rather than arriving at 07:00. The alert texts and the brief are
  in the reader's language, as the database words them translated whole
  (`0032`). Running out knows a delivery time per supplier, taken from
  the item's last delivery; an item with no delivery yet uses the café's.
  A batch's use-by date raises its own alert (`0046`): orange within a day,
  red once past with stock left. A late sale raises nothing: it cannot
  happen since `0024`.
- **Chart of accounts maintenance (M-06, `0058`).** An income (4000–4999) or
  a cost (5000–6999) is added, renamed, taken out of use and brought back on
  **Chart of Accounts**. What it does not do:
  - An asset, a debt or the owner's money is still added by a migration: the
    balance sheet and the cash flow place an account by its code, and one
    added there would be placed by a guess.
  - The accounts the system posts to (the till, the bank, sales, stock and the
    like) keep their names and stay in use; their names are the phrases every
    language translates.
  - An account is never deleted; one taken out of use stays in the reports,
    and its code and name stay taken. Out of use, it takes nothing new, but
    what was posted to it is still closed at the year's end, reversed, and
    shared out as a prepaid expense's months (`0062`).
  - Sales revenue (4000), its discounts (4100) and its returns (4200) take no
    journal by hand: they move with the sales and refunds recorded, which the
    books tie them to (`0062`). Other income (interest, a rebate) goes to an
    income account the café adds; the owner's correction of a control
    account still reaches them, with why.
  - Its other names are in Arabic and Kurdish, given on its own form. In a
    language the owner added, it shows as it was typed: **Settings →
    Languages** lists the built-in phrases, not the café's accounts.
  - Those names are kept as the café's own words for the account's English
    name, where **Settings → Languages** keeps its words for the screens. So
    an account named as a word the screens use (Delivery, Packaging) takes no
    Arabic or Kurdish of its own, and is not renamed so: the screen refuses
    it, in words. The database does not know the screens' words, so an
    account added by a call to it directly, not through the screen, is not
    checked. Renamed, its words for the old name stay with that name.
  - Taken out of use in the very second a journal is saved as a draft on it,
    an account may keep that draft, and the draft may still be published to
    it. A draft on it at any other time keeps it in use.
- **The bank against its statement, what it does not do (`0059`).**
  - The statement is read from the bank's file or pasted (below), or read by
    eye: its last day and balance typed, and each line on it ticked. Nothing
    comes from the bank itself.
  - One bank account, 1020 Bank. The dollars in the safe and the till are
    counted on their own (`0043`).
  - Only the latest statement is undone; an earlier one is undone by undoing
    each after it first.
  - A charge or interest the bank shows is recorded first (Expenses, or a
    journal), then found or ticked: nothing is recorded for you. **Record
    it** fills in Expenses for money out, and a journal into the bank for
    money in; the account is still the person's to choose. The Chart of
    Accounts has no income for interest until the café adds one: sales
    revenue does not take it (`0062`).
- **A payment like one posted already, what is not asked (P2-14).** Expenses
  asks about an expense or a prepaid expense to the same account, for the
  same amount, within three days of one posted: as it is typed, among the
  last 100 expenses and the prepaid expenses; and the database asks again as
  it would post it, among all of them (`0061`). Another amount (a price that
  went up by 250), four days apart, or another account is not asked about;
  nor are the words. A month's share of a prepaid expense counts as posted:
  this month's rent recorded again is asked about. A bill and a journal by
  hand are not asked about as they are entered: the dashboard's alert (a
  possible duplicate) finds any two to the same running-cost account within
  three days once they are posted, but not two shares of prepaid
  expenses.
- **Prepaid expenses, what they do not do (`0060`).**
  - The payment is dated when it is recorded: one made days before is
    recorded as of today. Its shares keep their months.
  - It starts this month or in one of the twelve after. What was paid for
    months already past is an expense of those months, recorded on Expenses
    with its date.
  - A share is a month's, not a number of days': one that starts mid-month
    takes a whole share that month.
  - A month's share is posted when someone presses **Release what is due**
    (or records it in its first month), not by itself on the first of the
    month. The Dashboard says when one is due, and the month is not locked
    until it is posted.
  - It stays as it was recorded: to change its amount, account or months,
    cancel it and record it again. Cancelled, its payment and its shares are
    reversed on the day it is cancelled, not in their months.
  - A month's share is undone with its prepaid expense, by cancelling it:
    Journals does not reverse it (`0061`). One reversed by hand before that
    is not posted again: its money stays in 1400 until the prepaid expense is
    cancelled, and the list says so.
  - The account its shares go to stays in use until the last share is
    posted, or it is cancelled (`0061`).
  - One recorded before `0060` as an expense (December's rent, 150,000,
    expensed in September) stays as it was. To move it, reverse that expense
    in the month it was posted in, and record it again as paid ahead from
    the same place: the reversal puts the money back where it came from and
    the prepaid expense takes it out again, so only the month it is an
    expense of changes. One paid from the till or the safe is reversed today
    (`0063`), so the month it was posted in keeps it and this month takes it
    back.
- **Statements read from their files, what they do not do.**
  - The files read are Excel workbooks (.xlsx), CSV and text files, and the
    web page or Excel 2003 XML some banks give as an ".xls". An Excel 97–2003
    file (a true .xls) and a PDF are not read: saved again as .xlsx or CSV,
    they are. A workbook's first sheet with something on it is read, not the
    others; 10 MB at most.
  - The file is read in the browser and not kept: the statement kept, or the
    payout posted, is what stays. Keep the file itself as a document where
    one is kept (an expense), or elsewhere.
  - The columns are found by their names, in English, Arabic or Kurdish, in
    the first 30 rows. A statement that names its columns otherwise is
    pasted with the names changed, or its columns given in order (a
    platform's only).
  - A date like 03/04/2026 is read day first, as dates are written in Iraq,
    unless a date on the same statement shows the month comes first
    (04/13/2026). A date with a time and its zone (2026-09-13T21:00:00Z, as
    some exports write them) is read as the day it was in Baghdad, the
    14th; one with no zone, as the day written.
  - An amount is read as the statement writes it: 1,500,000.50 or
    1.500.000,50, the decimal mark taken from the statement's own amounts
    and balances. Where none shows it (every amount like 1.500), a dot is
    taken. An amount that does not fit the statement's mark (500,00 on a
    statement of 1,500.00) is not read but listed as a problem.
  - In or out is read from the amount's sign or its columns, or from a type
    column's words: Dr, Cr, Debit, Credit, Withdrawal, Deposit, In, Out, and
    their Arabic and Kurdish (مدين، دائن، سحب، إيداع، صادر، وارد). Where the
    amounts carry no sign and the type says neither ("Transfer", "POS"), the
    line is listed as a problem, not guessed.
  - A line with more cells than the statement has columns (an amount with
    commas, not in quotes, in a CSV) is listed as a problem, not read.
  - A total is left out: a line with a cell that is only "Total" (or
    "المجموع", "کۆ"), or one with no date that starts like a total. So are
    the opening, beginning and closing balances. A dated line whose words
    only start like a total's ("Total Energies") is read.
  - **The bank's lines are found by their amount and day only.** A line is
    the books' line of the same amount, on the same day, else on the nearest
    day up to a month before or a week after; each of the books' lines once.
    Two payments of the same amount a few days apart may be found the other
    way round; that changes nothing kept, but tick them by eye if it
    matters. A payment the bank split, or joined with another, is not found:
    tick it by eye.
  - What was read stays on the bank's page for that browser tab until the
    statement is kept or cleared, so a charge can be recorded on Expenses in
    between; another tab or device does not see it.
- **Documents kept with the records, what they do not do (release AA,
  `0053`).**
  - Only deliveries, returns, bills, supplier's credit notes and expenses keep
    documents. A sale, a count, a payroll or a journal keeps none.
  - Documents are pictures (JPEG, PNG or WebP) and PDFs: 10 MB at most, 20 to a
    record.
    - A photo in another format must be saved as one of those first, as a
      phone does when it sends one through the browser; a picture the browser
      cannot open is refused.
    - A photo over 1.5 MB is made smaller in the browser. A PDF is kept as it
      was sent.
  - Nothing is read from a document: the bill's number and amount are typed as
    before. There is no search by document, and no thumbnail of a picture on
    the page.
  - A document taken off is never deleted. Its file stays in Storage, and the
    page lists it struck through, with why. There is no deleting a file from
    the app.
  - The link that opens a document lasts a minute. A link copied and sent to
    someone stops working after that.
  - The files are kept in Supabase Storage, apart from the database, so a copy
    of the database does not hold them (see
    [`guides/backup-restore.md`](guides/backup-restore.md)). Clearing the test
    records forgets which file went with which record; it does not remove the
    files.
- **Reports on paper, what they do not do (release AA).**
  - The PDF is the browser's: **Print or save as PDF** opens its print window,
    where the paper, the margins, upright or across, and whether the browser
    adds its own date and address at the edges are chosen. Nothing is made on
    the server, and nothing is sent by email.
  - A report prints as it stands on the screen, with the dates and choices
    made there; it has no cover, no page numbers of its own and no signature
    line. A long table runs on over as many pages as it takes.
  - The till's bills and receipts, a purchase order and a vendor's statement
    keep the print they had.
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
- **The café's places and the stock sent between them, what the first part of
  the branches does not do (release AB, `0054`).**
  - A device chooses where it does its **stock** work: deliveries without an
    order, new orders, returns not named against a delivery, batches, losses,
    corrections, opening stock and counts, and the stock screens. Since `0055`
    its till sells at it when it is a branch; since `0056` each place's profit
    and loss is read on Reports.
  - The place is kept on the device. Someone who works at one place (`0055`)
    works there whatever the device says; someone who works everywhere may
    change it.
  - A transfer goes whole: it cannot be received in two goes, or sent on from
    where it is going. What did not arrive is lost (5300) as it is received;
    finding it later is a correction at that place.
  - Since `0055`, a transfer is received only by someone who works at the
    place it goes to, or everywhere, and cancelled only by someone who works
    at the place it left, or everywhere.
  - Stock on its way is in neither place: the stock board and the
    running-out alerts do not count it until it arrives. The buying list
    counts it as coming (`0055`).
  - A batch keeps its number and use-by at the place it goes to; stock with no
    batch goes at the average cost where it left.
  - One stock count is open at a time at each place; the count screen shows
    the one at the device's place, and one's own wherever it is.
- **The tills at each branch and who works where, what they do not do
  (release AB, `0055`).**
  - A person works everywhere or at one place, all their roles at it: someone
    who works at two branches works everywhere. The owner and the general
    manager work everywhere.
  - Where a person works narrows what they record, not what they read: they
    see the café's records as their role allows, and record nothing at
    another place.
  - Only the turn numbers are each branch's. Bills, receipts, refunds,
    orders, transfers, sessions and journals keep the café's numbers, so each
    number is still one record.
  - An expense, a supplier's bill or an advance paid from the till comes out
    of the drawer at the device's branch; salaries paid from the till, out of
    the first branch's.
  - The alerts, the menu's costing and each item's cost now are judged at the
    first branch.
  - A branch's own price is for a product's size and channel; an add-on's
    price is the café's.
  - Someone clocked in at one branch clocks out there: a till whose person
    works only at another branch cannot clock them out.
  - The day's plan is each place's own: the kitchen's counts what it sends,
    and the branch's what it sells, so both may show a batch to make for the
    same sales. The kitchen makes; the branch's plan is for the branch to see.
- **The books by place, what they do not do (release AB, `0056`).**
  - Since `0057` every report that reads what was recorded at a place is
    read by place, and someone who works at one place reads theirs. What
    belongs to the café as a whole stays the café's: "Do the books tie?", the
    trial balance, the balance sheet and the cash flow, the journals, the
    payables and their ageing, the menu's costing, the dollar rates and the
    safe, the customers and the points they hold, and the daily brief.
  - A refused manager's approval (a wrong PIN) has no place: it is on the
    café's exceptions, not a place's.
  - The bank's card fees and journals by hand are shared: no one place's. So
    is a bill charged to an expense account with no delivery, and a supplier's
    credit on none.
  - An expense is the place's it was recorded at, the device's. A cost the
    café shares (one rent for all) is recorded at one place, or as a journal
    by hand, shared.
  - An expense kept without a place, from before expenses kept one, is
    shared (three on the live books when `0056` was applied).
  - A payroll is shared out by where each person works when it is approved,
    not by the hours they worked at each place.
  - What did not arrive of a transfer is the loss of the place that sent it.
  - The balance sheet and the cash flow are the café's.
- **Tax.** Out of scope by request. If the business is VAT-registered, that is a
  structural addition, not a setting.
- **Screen readers and the keyboard (AJ, AL), what is checked and what is
  not.** Every box, list and tick box, and every button that shows only a
  sign, has a name. The source is checked, and so is every screen as it is
  drawn. The keyboard's place is ringed, and its first stop leads past the
  menu. The theme's colours for words stand at least 4.5:1 against their
  backgrounds (AM), but a colour written into one screen by hand, or on a
  product's photo, is not checked. Whether a name says enough is left to a
  person to judge. The order the keyboard moves through each screen, and
  the till with a screen reader running, have not been tested.
- **What the safe and the till hold, under Paid from (AK).** The figures
  are those of when the page was opened. Money moved on another screen
  after that shows once the page is opened again. The database checks each
  payment when it is sent, as before. A salary paid from the till is
  warned of against the first branch's drawer, which it comes out of.

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
- Money from the till or the safe is recorded the day it moves (`0063`): an
  expense paid from either is dated today, and a journal that moved their cash
  is reversed today. The drawer's and the safe's own records are written when
  the money moves, and each day's count is checked against them. One forgotten
  from an earlier day is recorded today, saying when it was paid. Paid by the
  bank, a card or the owner, an expense keeps the date it is given.
- Full payment-card details are never stored.
