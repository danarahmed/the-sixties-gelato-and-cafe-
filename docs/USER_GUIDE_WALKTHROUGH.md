# The Sixty's — Screen-by-Screen Guide

Every screen of the app: where it is, who sees it, what is on it, and how to do
each job.

- **Live app:** https://sixties-gelato-cafe.vercel.app. This guide describes the
  version in this repository. Until it is deployed
  ([`guides/deployment.md`](guides/deployment.md)), the live site runs the
  previous app.
- **Locations** are written as **Sidebar → _Label_** and the address, e.g.
  `/pos`.
- **Who sees it** depends on your roles. A screen you are not offered is not in
  your sidebar; typing its address sends you to your own starting screen.

## Contents

1. [Signing in and your account](#1-signing-in-and-your-account)
2. [The frame](#2-the-frame)
3. [Ideas used everywhere](#3-ideas-used-everywhere)
4. [Dashboard](#4-dashboard) · `/dashboard`
5. [POS](#5-pos) · `/pos`
6. [Orders](#6-orders) · `/orders`
7. [Sales](#7-sales) · `/sales`
8. [Delivery Platforms](#8-delivery-platforms) · `/platforms`
9. [Vendors](#9-vendors) · `/vendors`
10. [Expenses](#10-expenses) · `/expenses`
11. [Purchasing](#11-purchasing) · `/purchasing`
12. [Products & Recipes](#12-products--recipes) · `/products`
13. [Inventory](#13-inventory) · `/inventory`
14. [Stock Count](#14-stock-count) · `/count`
15. [Production](#15-production) · `/production`
16. [Journals](#16-journals) · `/journals`
17. [Chart of Accounts](#17-chart-of-accounts) · `/accounting`
18. [Reports](#18-reports) · `/reports`
19. [Audit trail](#19-audit-trail) · `/audit`
20. [Settings](#20-settings) · `/settings`
21. [Every feature, and where it is](#21-every-feature-and-where-it-is)

---

## 1. Signing in and your account

**Location:** `/login` · **My account** at the bottom of the sidebar (`/account`)

- **Sign in** with your own email and password.
- **First time here? Create your login.** It works only for an email the owner
  has added under Settings → People. Confirm the email you receive, then sign
  in. A login for an email nobody added sees nothing.
- **Forgot password?** sends a link; it opens **My account**, where you set a new
  password.
- **My account** shows your name, business and roles, and **What you may do**
  (your exact permissions). It also has **Change password** and **Sign out**. If
  it says your login is not linked, ask the owner to add you with exactly that
  email, then sign out and in again.
- **Your approval PIN** (owners and managers): the PIN you type on a till to
  approve a discount over the cap, or on Orders a void or refund. Four to eight
  digits, not one digit over and over nor a run like 1234; the database keeps
  only a hash of it. Five wrong PINs in fifteen minutes stop your approvals for
  fifteen minutes.

Where you land after signing in: owners, managers, accountants and auditors on
the **Dashboard**; cashiers and baristas on the **POS**; counters on **Stock
Count**; the purchasing role on **Reports**.

## 2. The frame

- **Sidebar**, grouped the way the books are:
  - **Dashboard**;
  - **Revenue:** Sales, Delivery Platforms;
  - **Spending:** Vendors, Expenses, Purchasing;
  - **Operations:** POS, Orders, Products & Recipes, Inventory, Stock Count,
    Production;
  - **Accountant:** Journals, Chart of Accounts, Reports, Settings;
  - **You:** My account.

  You see only the screens your roles allow.

- **Top bar:**
  - **☰** opens the sidebar on a phone;
  - the **language** menu: English, العربية, کوردی (Arabic and Kurdish turn the
    whole layout right-to-left);
  - **☀️ / 🌙** for light or dark.
- **Offline banner.** When the connection drops, a red banner says so. Selling and
  saving stop until it is back: nothing is saved offline, so nothing is recorded
  twice.

## 3. Ideas used everywhere

- **Channel** is how an order is fulfilled: **Dine-in, Takeaway, Direct
  delivery, Talabat**. It sets the price and the packaging.
- **Base unit** is the smallest unit an item is tracked in (each, g, ml). You buy
  in bigger units (a carton, a pack of 1,000) and the app converts.
- **Stock is a ledger.** Nobody types a stock level: it is the sum of every
  receipt, sale, waste, correction and count.
- **Nothing is edited.** A sale, a published journal and a bill never change. A
  mistake is corrected by a new, dated entry: a void, refund, reversal,
  cancellation or count. The original stays on record.
- **Months close in order.** A locked month refuses every posting. Only the owner
  reopens one, with a reason.
- **Before controls.** Entries recorded by the previous app carry this mark; see
  [`REMEDIATION.md`](REMEDIATION.md).

---

## 4. Dashboard

**Location:** Sidebar → **Dashboard** · `/dashboard` · **Who:** owner, general
manager, branch manager, accountant, auditor

**Needs you** comes first (`0029`): what the alert rules find in the books
each time the page opens.

- 🔴 **red** needs doing now, 🟠 **orange** soon; each says what happened, why
  it matters, what to do (a link to where it is done) and how sure the rule is
  (**Sure**, **Fairly sure**, **Early sign**). Orange alerts of one kind fold
  into one row: open it to see each.
- **Answer** (owner, managers, accountant): a line saying what was done, or
  why it is fine. **Snooze**: a day, from tomorrow to 30 days ahead, and why it
  can wait. Both are on the audit trail; the alert stays, marked 🔵 under
  **Answered or snoozed**, until its condition clears — then it leaves by
  itself. An orange one that turns red asks again. Nobody answers an alert
  about their own exceptions.
- 🟢 **Nothing needs you** when no alert waits.

**Yesterday**, the daily brief: its **Facts** (net sales and how many sales,
voids, refunds, discounts, waste, the drawer's difference, sales costed at
nothing), its **Calculations** (cost of goods, gross profit, against the same
day last week and a usual one) and **To do** (the red alerts nobody has
answered), kept apart.

**Today**, from the books:

- **Net sales today**, **Gross profit after waste & fees**, **Orders**,
  **Average order value**;
- **Inventory (1200)**: the value of stock in the ledger;
- **Low-stock items**: a count, and a list of items below their reorder level or
  negative;
- each figure opens what is behind it: net sales the Sales by Channel report,
  gross profit the P&L, orders today's orders, inventory and low stock the
  Inventory page;
- **Recent sales**;
- whether the **books reconcile**, with a link to the differences if they do not.

## 5. POS

**Location:** Sidebar → **POS** · `/pos` · **Who:** cashier, barista, managers,
owner

1. **Channel.** Choose **Dine-in**, **Takeaway**, **Direct delivery** or
   **Talabat**. Prices on the tiles change with it.
2. **Products.** Tap a tile to add it. A tile is greyed out when the product has
   no price on that channel.
3. **Cart.** **−** / **+** change quantities; **Clear** empties it. The total is
   shown.
4. **Pay:**
   - in the shop: **💵 Cash** or **💳 Card**;
   - on Talabat: **🧾 Complete (paid through the platform)**.
5. **✅ Sale recorded** confirms it, with the sale and journal numbers. The
   cost is shown only to people allowed to see costs.

**If the connection drops mid-sale,** the till freezes that cart and says it did
not hear back:

- **Retry** sends it again with the same key. If the sale already went through,
  it is shown, not recorded twice.
- **Discard — a manager will check Orders** clears it from the till.

A cart left frozen when the page reloads is brought back for its retry.

**If a price changed since the till loaded its menu,** the database refuses a
payment at the old total and nothing is recorded: the till says **“The total
is … now, not the … shown”**, fetches today's prices and shows the order at
them, to tell the customer before taking the money again. Tills fetch the
prices every ten minutes and whenever their screen comes back to the front. A
**printed bill** is always paid at the prices printed on it.

**Discounts** (**＋ Discount**) take a percentage or an amount, and a **reason
from the list** (staff meal, on the house, regular customer, a complaint, a
promotion, or "Other" in a few words). **Over 10% of the bill** someone who does
not approve discounts themselves taps **🔑 Ask a manager**: the manager chooses
their name and types their PIN, and the discount shows who approved it. Until
then the customer cannot pay. A discount already on a saved bill shows why, who
gave it and who approved it.

**What each sale posts:**

- Dr Cash (1000), Card clearing (1010) or Platform receivable (1100), by tender;
  Cr Sales (4000);
- Dr Cost of goods sold (5000), Cr Inventory (1200), for exactly the recipe and
  packaging used on that channel.

## 6. Orders

**Location:** Sidebar → **Orders** · `/orders` · **Who:** anyone who sees costs

Every sale: number, time, channel, items, how it was paid, status, net and
margin (the sale's price less the recipe cost of what it used). Each item keeps
the name it was sold under: renaming a product later does not relabel its past
sales. Choose **From**, **To** and a **Channel** to see the sales of those days;
a report's figures open here with them chosen.

- **Void.** For a sale rung in error, until the drawer holding its cash is
  counted (after midnight too: the count, not the date, decides).
  Revenue, payment, cost and stock all come back exactly.
- **Refund.** After that: the money goes back through 4200 Sales returns. Only
  items marked returnable come back into stock; a used cup does not.

Both take a **reason from the list** ("Rang twice", "Customer changed their
mind"…, or "Other" in a few words), and both go on the audit trail. You need the
sale.void or sale.refund permission (managers and the owner). **Approved by**
lets a second person — another manager or the owner — approve it there with
their PIN; without one it waits for the owner on Reports → Exceptions. Each
void or refund shows why, who asked and who approved it.

## 7. Sales

**Location:** Sidebar → **Sales** · `/sales` · **Who:** anyone who sees costs;
counting the drawer: managers and the owner; moving cash: managers, the
accountant and the owner

- **Cards:**
  - net sales, after refunds, over the last 30 trading days;
  - refunds made in those days (on the day each was made);
  - the cost of what was sold (less what refunds put back on the shelf) and
    the sales margin;
  - **Days whose cash is not counted**, with how many are before today, and
    when the drawer was last counted.
- **Daily Sales Summaries:** one line per day and channel (voided sales left
  out), with orders (opening that day's sales), sales, refunds made that day,
  net sales, cost, and whether the day's cash is **Counted** or **Not
  counted**.
- **Count the Drawer** — at the end of a shift or of the night, whatever the
  time. The café trades past midnight, so a count covers **everything since
  the last count**, not one calendar day; a sale rung after the count is in the
  next one.
  1. The screen lists what the drawer started with (what the last count left
     in it), the cash sales, refunds, voided sales, money paid out of the till,
     and cash put in or taken out since, and what **the drawer should hold**.
     (Only the first count after days were closed the old way asks what was in
     the drawer when trading began.)
  2. Enter the **Cash counted**. The **Over / short** shows at once.
  3. Say how much **Stays in the drawer** for next time (empty: all of it). The
     rest goes to **the safe** or **the bank** — choose which.
  4. **Count the drawer.** Any difference posts to 6300 Cash over / short; the
     takings leave 1000 for 1005 Cash in the safe or 1020 Bank.

  Every bill kept open on the till must be paid or cancelled first. A month
  cannot lock while a day's cash is not counted.

- **Move Cash:** from the till, the safe, the bank or the owner to another of
  them — a float into the till, takings to the safe during the day, a bank
  deposit, money the owner puts in. Only the owner takes money out for
  themselves (3200 Owner drawings), and money to or from the owner says what it
  is for. Neither the till nor the safe can pay out more than the books say it
  holds.
- **Drawer Counts:** each count — what it started with, should have held,
  counted, over/short, what stayed, what was taken out and where — and who
  counted it. Days closed the old way are listed too, marked "by day".

## 8. Delivery Platforms

**Location:** Sidebar → **Delivery Platforms** · `/platforms` · **Who:** anyone
who sees costs

Platform orders rung on the till, with their value before commission and their
cost, and the balance of 1100 Platform receivable.

Not built yet: settlement import and matching. Record each payout with a journal,
as described in [`guides/talabat.md`](guides/talabat.md).

## 9. Vendors

**Location:** Sidebar → **Vendors** · `/vendors` · **Who:** anyone who sees costs;
bills: purchasing, managers, accountant; payments: accountant, general manager,
owner

**At the top:** what is owed, aged: not yet due, 1–15, 16–30 and over 30 days
late.

**Left:** every vendor with their balance; those taken out of use are listed
last, marked, with their history. **Right,** four tabs:

- **Statement:** every bill and payment to date, with a running balance.
  Cancelled bills stay on the statement, marked.
- **Bills & payments:**
  - **Record a bill.** Choose one of two kinds:
    - **For goods received:** pick the delivery; the bill clears it, and any
      difference in price posts to 5050;
    - **For a service or asset:** pick the account.

    The **invoice number** is filled in with the café's own number
    (SGC-2026-0001, then -0002 …), given when the bill is recorded and never to
    another bill. If the supplier's invoice has its own number, type that
    instead; the same supplier number from the same vendor is refused. Then
    enter the date, the **amount the invoice says** and terms (due now, net 7,
    15 or 30). The amount is typed, never copied from the delivery, so a typo
    on the delivery is not billed and paid too; the screen shows what the
    delivery recorded, and any difference posts to 5050.

  - **Open bills,** with **Pay bill**: amount, and paid from 1000 Cash, 1010 Card
    or 1020 Bank. You cannot pay more than is outstanding.
  - **Cancel** a bill entered in error, if nothing was paid on it. Give a reason
    and a date. The bill stays on record and its journal is reversed.
- **Edit vendor:** correct the name, what they supply and the phone, say how
  many **days a delivery takes** (the dashboard's "running out" warns that much
  sooner for what they supply; empty follows the café's default), or take them
  **out of use** (not while they are owed money); say **why**. Every change is
  on the audit trail with its values before and after.
- **New vendor:** name, what they supply, phone. No two vendors in use share a
  name, whatever the capitals, spaces or punctuation ("Dairy Co" and "Dairy Co."
  are one vendor), so one invoice cannot be billed twice under two spellings.

Deliveries received before these controls show as **Before controls ·
(supplier's name)** under every vendor. The previous app did not record the
supplier on them. Their bill is recorded against the payable already posted.

## 10. Expenses

**Location:** Sidebar → **Expenses** · `/expenses` · **Who:** anyone who sees
costs; recording: managers, accountant, owner

**Record an Expense:**

1. Write the **Narration** in plain words ("September shop rent").
2. Enter the **Amount** and **Date**, and choose where it was **Paid from**:
   the till (today's drawer), the safe, the bank, a card, or the owner
   personally. There is no default: the money came from somewhere, and the
   books follow it. From the till it lowers what the drawer should hold, and
   neither the till nor the safe can pay more than the books say it holds.
3. An **Account** is proposed from the narration: rent → 6000, wages → 6100,
   electricity → 6200, anything unclear → 6900 Other expenses. **Confirm or
   change it.** A stock loss is sent to Inventory instead, because it is not an
   expense.
4. The entry is shown exactly as it will post (**Balanced — debits equal
   credits**), then **Post expense**.

Below: the **Expense Register** and totals **By Account**. An expense whose
journal has been reversed stays listed, marked **reversed by #…** and struck
through, and is left out of the totals: it is no longer spent.

## 11. Purchasing

**Location:** Sidebar → **Purchasing** · `/purchasing` · **Who:** anyone who sees
costs; receiving: purchasing, managers

- **🏭 Add supplier:** name, what they supply, phone.
- **📦 Receive stock (goods receipt):**
  1. Choose the supplier.
  2. Add a line for each item: the unit you bought it in, the quantity, and the
     **price of one unit** as the invoice gives it (a kilogram, a case of 24).
     The line shows its total, what that is a base unit (a gram, a bottle), and
     what the item costs now.
  3. Add freight, other landed costs and any rebate.
  4. **Receive goods.** A price more than 25% above or below what the item
     costs now stops here, with both figures, and nothing is received: "2.5 or
     50?" is asked before the stock is costed. **Let me correct it**, or, if the
     invoice really says so, **The price is right: receive it** — your
     confirmation goes on the audit trail. An item's first delivery has nothing
     to compare with.

  Stock goes up in base units, and the landed cost is spread over the lines to
  the dinar. The books post Dr Inventory, Cr Goods received not invoiced (2050),
  until the bill arrives.

- **Recent goods receipts:** each receipt's supplier, lines, goods, landed extras,
  value into stock, and bill status: **Billed**, **Awaiting bill**, **Not
  journaled** (from the previous app; see Reports) or **Before controls**.

## 12. Products & Recipes

**Location:** Sidebar → **Products & Recipes** · `/products` · **Who:** anyone who
sees costs; creating and pricing: owner, general manager

- **Add a menu product**, in three steps:
  1. **Name and category:** its name in English, Arabic and Kurdish, and its
     category on the till.
  2. **Recipe:** what goes into one serving, one line per item: the item, the
     quantity and unit, and what it is **used for**: **Every order**,
     **Takeaway & delivery** (a cup, a lid, a bag), **Dine-in only**, or **Some
     channels…** to tick them. Beside each line is what it costs, and what the
     item costs per unit; under the lines, **Cost of one serving**, on each
     channel where the packaging makes it differ. Costs are today's, worked out
     exactly as a sale will post them. An item never bought has no cost yet and
     counts as 0; the form says so.
  3. **Prices:** one per channel, left empty where it is not sold. Each channel
     shows its cost, and as a price is typed, what it leaves: **margin** in
     green, in amber when under the target margin, and **loss** in red. **Use
     4,000 IQD** takes the suggested price: the lowest price, in steps of the
     café's 250 IQD, that leaves the target margin (70% unless changed). A
     delivery platform's commission is not in the cost.

  The product, recipe and prices are created together, or not at all. A line
  with an item but no quantity (or a quantity but no item) stops the save. A
  product with no recipe needs **Why it uses no stock** (a service charge):
  without one it is not created.

- **Each product** shows its **Recipe** (component, quantity, applies to) and
  **Price & margin by channel**, costed exactly as a sale would post it today.
- **Change the recipe…:** the recipe in force today, to change, costed as you
  change it, in force from a date (today or later). Sales before that date keep
  the old recipe. Use it to switch a product to something made on Production
  (a cup of gelato: 120 g of the gelato made, a cup, a spoon).
- **Change a price…:** a new price for a channel, from today or a later date
  (never an earlier one). A sale always uses the price and the recipe in force
  on its own day; a printed bill, the prices printed on it.
- **Scheduled:** prices and recipes set for a later date, each with
  **Withdraw…** (with a reason) until it starts. A recipe changed today does
  not cancel one scheduled for later: each takes over on its own date.
- **Costed at nothing** (a red badge): no recipe, or an ingredient with no cost
  yet, so its sales show full profit. A product that truly uses no stock says
  why (**Uses no stock**), and is not flagged.

## 13. Inventory

**Location:** Sidebar → **Inventory** · `/inventory` · **Who:** anyone who sees
costs; baristas can record waste

- **Cards:** items tracked, stock value (from the ledger), items below reorder
  level, items with negative stock.
- **📦 Opening stock** (the owner's alone; shown while any item has no stock
  recorded yet — after the test records are cleared, or for an item added
  without it): choose the item, count what is on the shelf, and enter the
  quantity, its unit, **what one unit cost** and **where it came from** (the
  opening count, say). It is capital the owner puts into the business: posted
  Dr Inventory, Cr Owner equity, so the item's sales are costed from the first
  one, and on the audit trail. An item with stock history is corrected by a
  count or a correction instead.
- **➕ Add stock item:**
  - its name — one no other item in use has, whatever the capitals, spaces or
    punctuation (two "Milk"s would split the stock) — and its type
    (ingredient, packaging, consumable, finished good, resale);
  - what it is measured in and its base unit;
  - the owner only: an opening quantity and cost, and where it came from,
    posted as Dr Inventory, Cr Owner equity. Anyone else's new item gets its
    stock from a delivery.
- **🗑️ Record waste:** the item, what happened (waste, spoilage, expired,
  damaged, melt, staff, complimentary, sampling), the quantity and unit, and
  **why**. It is valued at average cost and posts to 5300. Waste above the
  business's threshold needs a manager.
- **✏️ Correct stock (manager):** a signed change (− to reduce), the cost per base
  unit for additions (blank = average), and **why**. It posts to 5400.
- **Stock on hand:** each item in use, with its quantity, unit, reorder level,
  average cost, value and status: **low**, or **negative** (shown, never
  hidden). Below it, the items with **no stock yet** and those **out of use**,
  each opening its card. Open an item for its **stock card**:
  - for the dates chosen (this month unless changed), what was on hand when
    the first day began; what was received, sold, used in batches, made,
    wasted, counted and corrected; and what was on hand at the end, which is
    what Stock on hand shows; then every movement, with the quantity and value
    on hand after it;
  - **What it has cost:** each delivery, newest first, with the supplier, what
    was paid a base unit and what it cost landed;
  - **Units:** what it is delivered and counted in, and **Add unit** for a new
    pack size (a case of 24, a bottle of 750 ml). A unit keeps its size for
    good, because every delivery and count in it was taken at that size: a
    different size is a new unit;
  - **Correct this item** (purchasing, managers, owner): its names, type,
    reorder and par levels, and whether it is **in use**, with **why**. It stays
    counted in its base unit. It is taken out of use only when it has no stock
    and no recipe, product or batch needs it; then its name is free again. Every
    change is on the audit trail with its values before and after.
- **Movements:** the most recent entries in the stock ledger.

## 14. Stock Count

**Location:** Sidebar → **Stock Count** · `/count` · **Who:** counter (counts);
branch manager, general manager, owner (review and approve)

- **Counting.** **Start count** lists every item by name and unit. Enter what is
  on the shelf; each entry saves as you go. Then **Submit count**. The counter
  never sees the expected quantities. The café can keep trading: each item is
  compared with the stock at the moment it is counted, so a sale or delivery
  while counting is not a difference. One count is open at a time; a count
  started by mistake is ended with **Cancel this count…** and a reason (by its
  counter or a manager).
- **Review.** Open a submitted count with **Review**: expected (the stock when
  each item was counted), counted, variance and value. Then either
  **Approve and post variances** (to 5400, dated when submitted) or **Reject**,
  with a reason for the recount. The person who counted cannot approve.
- **Counts:** every count with when it started, who counted, how many items,
  its status, and who approved or rejected it.

More in [`guides/counting-guide.md`](guides/counting-guide.md).

## 15. Production

**Location:** Sidebar → **Production** · `/production` · **Who:** anyone who sees
costs, and baristas (who make the batches); setting up what is made: owner,
general manager; cancelling a batch: owner, managers

What the café makes in batches: gelato, a base, syrup, cold brew, dough.

- **Record a batch:** what was made, how many batches (0.5 and 2 work too), and,
  if you weighed or counted it, what came out, in any of the item's units (kg,
  pans, trays, pieces). Left empty, it came out as the recipe says. Before you
  record it, the form shows what it will use (and how much of each is in stock),
  what it makes and how that compares with the recipe, and, for those who see
  costs, what it costs and the cost per kg (or per pan, or per piece).
  Recording takes the ingredients out of stock at their average cost and puts
  what came out in, at exactly that cost. Baristas are shown no costs.
- **What you make:** each batch recipe, with what one batch makes, what goes
  into it, how to make it, and (for those who see costs) what a batch costs.
  **➕ Add something you make** sets one up:
  1. **What it makes:** its name; something new to keep in stock (weighed,
     measured or counted in pieces, and optionally kept in a container such as a
     pan of 5 kg) or an item already kept; and how much one batch makes, roughly
     is fine.
  2. **What goes into one batch:** any stock item, bought or made here. A white
     base made first and then flavoured works the same as milk and sugar; so
     does a dough, then the croissants baked from it.
  3. **How to make it** (optional): shown to whoever records a batch.

  **Change…** changes it from today; **Stop making it** hides it (it comes back
  with **Make it again**).

- **Batches:** every batch, newest first: when, what, how many, what came out
  (against the recipe), its cost (for those who see costs) and who made it. A
  batch recorded in error is **Cancel…**led by a manager with a reason: its
  stock movements are reversed at the values they had, and it stays on the list,
  struck through.

A made item is then used like any other: in another batch, or in a product's
recipe on Products & Recipes (**Change the recipe…**), so a cup of gelato takes
120 g of the gelato you made.

## 16. Journals

**Location:** Sidebar → **Journals** · `/journals` · **Who:** anyone who sees
costs; posting: accountant, general manager, owner

- **Journal Register:** every entry by journal number, newest first (1054,
  1053, 1052 …; drafts, which have no number yet, above them): date, number,
  reference, status, notes, amount and who posted it. Each shows its source (Sale, Refund,
  Reversal, Receipt, Bill, Payment, Expense, Stock, Count, Drawer count, Cash
  moved, Manual, Year end). **Manual and reversals** filters to the hand-made ones. Open a row
  to see its lines. Entries from the previous app are marked **before
  controls**.
- **New Journal:**
  - a date, an optional **Reverse on** date (for accruals), a reference and
    notes;
  - lines of account, description, debit and credit, with **+ Add line**.

  **Save and publish** only when debits equal credits; the number is given on
  publish. **Save as draft** parks it outside the books. A draft blocks the month
  from closing until it is published or discarded. The till's cash, inventory,
  payables, goods received and retained earnings are not offered: they change
  only through their own records (the till's through sales, payments, drawer
  counts and **Move Cash** on Sales).

- **Correction to a control account (owner only).** Tick it on New Journal to
  post to one of those accounts, with a reason on the audit trail. It exists
  to correct history from before these controls.
- **Reverse:**
  - offered on manual journals, expenses, corrections, year-end closes and
    entries from before the controls;
  - asks why, and for a date: not before the entry, not in the future, in an
    open month;
  - posts a mirror entry.

  A journal written by a sale, receipt, bill, payment, stock movement, count,
  drawer count or cash moved is corrected through that record instead (cash
  moved: move it back).

- **An account's lines.** A trial-balance line, a P&L line or a
  reconciliation figure opens the journal lines behind it here: date, journal
  number, narration, where it came from, debit, credit and the balance after
  each, from the opening balance to the closing one (from the P&L: adding up to
  the P&L's figure, the year-end close left out). **CSV** downloads them.

## 17. Chart of Accounts

**Location:** Sidebar → **Chart of Accounts** · `/accounting` · **Who:** anyone
who sees costs; locking: accountant, general manager, owner; reopening: owner

- **Months** across the top, 🔒 when locked. Choose one.
- **Trial Balance** for that month: each account's opening balance, debits,
  credits and closing balance, from published entries only, with the totals and
  **Download CSV**. Open an account for its journal lines.
- **Closing the month:** the checklist, every item of which must pass:
  - earlier months locked;
  - no drafts;
  - every trading day's cash counted;
  - no count awaiting approval;
  - stock, unpaid bills and goods received each agree with their account;
  - the month's journals balance;
  - ⚠️ no sale costed at nothing: a warning only, which does not stop the lock
    (see **Uncosted Sales** on Reports).

  When they pass, **Lock** (with an optional note). Locking the last month of a
  year also posts the year-end close into 3100 Retained earnings. **Reopen** is
  the owner's alone, and needs a reason; reopen the most recent locked month
  first.

- Who changed what is on the [Audit trail](#19-audit-trail).

## 18. Reports

**Location:** Sidebar → **Reports** · `/reports` · **Who:** anyone who sees costs;
the P&L: owner, managers, accountant, auditor

Choose **From** and **To**, or **This month**, **Last month**, **This year**.
**Every journal line (CSV)** downloads the whole ledger for those dates, for the
accountant's own tools.

- **Do the books tie?** Each subledger against its control account, as at the
  **To** date, with **CSV**:
  - stock vs Inventory;
  - unpaid bills (and deliveries the previous app posted to payables) vs
    Accounts payable;
  - deliveries not yet billed vs Goods received not invoiced;
  - sales vs revenue.

  ✅ means they agree. Each side opens what is behind it: the records (stock,
  unpaid bills, deliveries, orders) and the account's journal lines. Below it,
  **Stock the old app never journaled** lists any
  stock the previous app moved without a journal, each with the entry it would
  post. The owner reviews them and posts them in one step, with a reason (see
  [`REMEDIATION.md`](REMEDIATION.md)).

- **Profit & Loss:** income, cost of sales, **gross profit after waste & fees**,
  operating expenses and net, from published entries, with **CSV**. Each line
  opens its journal lines, which add up to it.
- **Sales by Channel:** per channel and in all, the orders (opening them),
  sales, refunds made in the dates, **net sales** (the P&L's net revenue) and
  the **sales margin** (net sales less the recipe cost of what was sold, before
  waste and fees).
- **Uncosted Sales:** each sale in the dates recorded with no cost, or part of
  it missing (no recipe, or an ingredient used before it had a cost), and why.
  Their profit is overstated; the fix is for the next sales.
- **Exceptions** (owner, managers, accountant, auditor): every void, refund,
  discount, cancelled bill, item taken off a bill and wrong PIN in the dates,
  counted by person, then one by one with the reason and who approved it.
  **review** marks what waits for the owner: a void or refund nobody else
  approved, or a wrong PIN. **CSV** downloads them.
- **Payable Ageing:** each unpaid bill by vendor, due date and days late.
- **Product Margin by Channel:** price, cost and margin of every product on every
  channel.

## 19. Audit trail

**Location:** Sidebar → **Audit trail** · `/audit` · **Who:** owner, managers,
accountant, auditor

Every change the database recorded, newest first: **when**, **who**, **what
happened**, **what it was about** (by name), each value **before → after**,
and **why**.

- Prices set, changed or withdrawn, with the price each replaced; products,
  categories, stock items and their units, suppliers, business settings and
  places, added, changed or deleted; opening stock, with where it came from;
  batch recipes and their ingredients; a delivery's price confirmed, with what
  the person was told; and every void, refund, discount, count, correction,
  cash movement, journal reversal, period lock and change of roles.
- A change made in the database itself, with no one signed in, shows **No one
  signed in**: itself worth asking about.
- Choose the dates, **What** (prices; products and recipes; stock items and
  opening stock; suppliers and deliveries; counts, corrections and batches;
  sales, bills and discounts; cash; the books; settings, places and people) and
  **Who** (anyone, a person, or no one signed in). **CSV** downloads every row
  chosen, with the values as the database stored them.

The trail is written in the same step as the change and is never edited or
deleted.

## 20. Settings

**Location:** Sidebar → **Settings** · `/settings` · **Who:** owner, general
manager

- **People:**
  - every member, with name, email, roles, and whether they have signed in;
  - **Add a person** (name, email, roles), change roles, **Deactivate** /
    **Reactivate**.

  Only the owner grants owner or general manager, and the business always keeps
  an active owner. Every change is on the audit trail.

- **Business configuration** (shown, not edited here):
  - name;
  - currency and decimal places;
  - timezone (trading days and months run midnight to midnight there);
  - default language;
  - the negative-stock policy;
  - the waste value that needs a manager.
- **Alerts** (edited here, `0029`): the thresholds the dashboard's alerts use
  — the margin target, the days a delivery takes (for vendors without their
  own), how long a count may stay open, the days card and platform money take,
  how soon a bill due is shown, what counts as a waste spike, as one person's
  exceptions and as a price typo. Each shows its default and its limits; an
  empty box follows the default; a change is on the audit trail.
- **Locations:** the branch and the central kitchen.
- **Roles & what they may do:** the exact permission list of each role.

---

## 21. Every feature, and where it is

| Feature                                                                                                    | Where                                    | Who                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| Sign in, create a login, reset password                                                                    | `/login`                                 | everyone                                                                      |
| Change password, see your permissions                                                                      | My account `/account`                    | everyone                                                                      |
| Language (EN / AR / CKB, right-to-left), light/dark                                                        | top bar                                  | everyone                                                                      |
| Today at a glance, low stock, books reconcile                                                              | `/dashboard`                             | owner, managers, accountant, auditor                                          |
| What needs you: alerts answered or snoozed; yesterday's brief                                              | `/dashboard`                             | owner, managers, accountant, auditor (answering: owner, managers, accountant) |
| Alert thresholds; how many days each vendor takes to deliver                                               | Settings `/settings`, Vendors `/vendors` | owner, general manager; vendors: purchasing, managers                         |
| Sell by channel; cash, card, platform-paid                                                                 | `/pos`                                   | cashier, barista, managers, owner                                             |
| Retry a sale without recording it twice                                                                    | `/pos`                                   | the same                                                                      |
| Void (until the drawer is counted) and refund, with a reason; a second person's PIN                        | `/orders`                                | managers, owner                                                               |
| Discount over the cap approved by a manager's name and PIN                                                 | `/pos`                                   | cashiers ask; managers, owner approve                                         |
| Set your approval PIN                                                                                      | My account `/account`                    | managers, owner                                                               |
| Exceptions by person: voids, refunds, discounts, cancelled bills, items taken off, wrong PINs; CSV         | `/reports`                               | owner, managers, accountant, auditor                                          |
| Daily summaries; count the drawer; move cash between till, safe, bank and owner                            | `/sales`                                 | cost viewers; counting: managers, owner                                       |
| Platform orders; payout by journal                                                                         | `/platforms`, `/journals`                | cost viewers                                                                  |
| Vendor statements, bills, payments, cancel a bill, ageing; correct a vendor, take one out of use           | `/vendors`                               | cost viewers (by permission)                                                  |
| Expenses with a proposed account                                                                           | `/expenses`                              | managers, accountant, owner                                                   |
| Suppliers; receive goods at a price per unit, checked against the cost now; landed cost                    | `/purchasing`                            | purchasing, managers, owner                                                   |
| Products, recipes by channel, prices from a date, margins                                                  | `/products`                              | cost viewers; editing: owner, general manager                                 |
| Stock board, add and correct items, pack units, price history, opening stock (owner), waste, corrections   | `/inventory`                             | cost viewers; waste: baristas too                                             |
| Blind count while trading, second-person approval, cancel a count                                          | `/count`                                 | counter; reviewers                                                            |
| Journal register, manual journals, reversal                                                                | `/journals`                              | cost viewers; posting: accountant, general manager, owner                     |
| Owner's correction to a control account                                                                    | `/journals`                              | owner                                                                         |
| Trial balance, closing checklist, lock / reopen                                                            | `/accounting`                            | cost viewers; lock: accountant, general manager, owner; reopen: owner         |
| Who changed what, before and after, by kind and person; CSV                                                | `/audit`                                 | owner, managers, accountant, auditor                                          |
| Reconciliation, P&L, channels, ageing, margins, CSV                                                        | `/reports`                               | cost viewers                                                                  |
| Post the stock the old app never journaled                                                                 | `/reports`                               | owner                                                                         |
| People and roles, business configuration                                                                   | `/settings`                              | owner, general manager                                                        |
| **Not built:** settlement import (M-10), offline selling, partial refunds, balance sheet, PDF, attachments | [`LIMITATIONS.md`](LIMITATIONS.md)       | —                                                                             |
