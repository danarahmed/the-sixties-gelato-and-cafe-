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
9. [Customers](#9-customers) · `/customers`
10. [Vendors](#10-vendors) · `/vendors`
11. [Expenses](#11-expenses) · `/expenses`
12. [Purchasing](#12-purchasing) · `/purchasing`
13. [Products & Recipes](#13-products--recipes) · `/products`
14. [Inventory](#14-inventory) · `/inventory`
15. [Stock Count](#15-stock-count) · `/count`
16. [Production](#16-production) · `/production`
17. [Staff](#17-staff) · `/staff`
18. [Payroll](#18-payroll) · `/payroll`
19. [Journals](#19-journals) · `/journals`
20. [Chart of Accounts](#20-chart-of-accounts) · `/accounting`
21. [Reports](#21-reports) · `/reports`
22. [Audit trail](#22-audit-trail) · `/audit`
23. [Settings](#23-settings) · `/settings`
24. [Every feature, and where it is](#24-every-feature-and-where-it-is)

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

Someone who works at one place reads their place's day, with its name by the
title (`0057`): its sales and their costs, its orders, **Stock at** their
place, and its items low or below zero.

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
- **Stock value**: the value of stock in the books (1200 Inventory);
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
   no price on that channel. The categories beside the tiles (**All**,
   **★ Favourites**, then the café's own) narrow them; a product with no
   category is under **No category**. A product with **sizes or add-ons** (`0041`)
   opens one sheet: tap the size, then its add-ons — a group that asks for a
   choice (the milk) comes first, and the drink is not added until it has
   one; tap an add-on again to take it off, and **+** for another of it
   (two extra shots). **Add · 6,000 IQD** says what one comes to. Each line
   names its add-ons under it (**+ Oat milk, Extra shot ×2**); the same drink
   with the same add-ons adds up on one line. The receipt and the barista's
   ticket list them under the drink, and a printed bill keeps their prices.
3. **Cart.** **−** / **+** change quantities; **Clear** empties it. The total is
   shown. **🎁 Give away…** (a quick sale eaten in or taken away, `0048`)
   gives what is in the cart away instead of selling it: choose **Staff
   meal**, **On the house** or **Sample**, say why, and **Give it away**.
   Nothing is charged and it is not a sale: its cost goes to its own account
   (6110, 6610 or 6620), it takes the next number, and the barista's ticket
   prints with it, saying what it is. Over the loss limit a manager chooses
   their name and types their PIN there and then.
4. **Pay:**
   - in the shop: **💵 Cash** or **💳 Card**;
   - part in cash and part by card (`0042`): **➗ Split**. Type what goes on
     the card; the last payment, left empty, takes what is left (its box
     shows how much). **+ Add a payment** adds another (two cards, up to
     four payments, one of them in cash), **✕** takes one off. Type the cash
     handed over for the cash part to see the change. **Confirm** waits
     until the payments come to the total;
   - in US dollars (`0043`): **$ Dollars**, shown while a manager's rate is
     recent enough (the window says the rate). Type the dollars handed over,
     or tap one of the amounts suggested (the fewest that pay first): their
     value in dinars is shown, to the nearest 250, and the change, given in
     dinars. Dollars worth less than the total pay what they are worth: choose
     how the rest is paid, cash or card. If the rate changed since the till
     read it, the payment is refused and the till reads the new rate: confirm
     again;
   - on Talabat: **🧾 Complete (paid through the platform)**, then type the
     **Talabat order number** from the tablet (the `#` can be left out).
     Nothing is recorded without it, and a number already recorded is
     refused, with the sale it belongs to. The receipt prints it.
5. **✅ Sale recorded** confirms it, with the sale and journal numbers. The
   cost is shown only to people allowed to see costs.

**The drawer** (`0036`). The chip at the top of the till, **🔒 Open the
drawer** or **🔓 Session 12**, opens it. Cash is taken only while the drawer is
open: **💵 Cash** with it closed opens the drawer instead (a card sale needs
none).

- **Open the drawer:** count the cash in it before putting anything in — a
  total, or **Count note by note** — and **Open the drawer**. The answer says
  whether the count agrees with what the last session left; a difference posts
  to 6300 Cash over / short. A manager can put a float in from the safe in the
  same step.
- **Close the drawer:** count it again, say what **Stays in the drawer**
  (empty: all of it) and whether the rest goes to **the safe** or **the bank**.
  The count is blind: only the answer shows what the drawer should have held,
  with the difference, which posts to 6300; the takings leave 1000 for 1005 or 1020.
- **Hand over:** count it and choose who takes it: one step closes your
  session and opens theirs on what you leave.
- A bill still open does not stop a close; it is paid in the next session.

**If the connection drops mid-sale,** the till freezes that cart and says it did
not hear back:

- **Retry** sends it again with the same key. If the sale already went through,
  it is shown, not recorded twice.
- **Discard — a manager will check Orders** clears it from the till.

A cart left frozen when the page reloads is brought back for its retry.

**If an item is not in the books** and its rule on **Settings → Rules** asks a
manager (`0040`), the payment stops and says how much is there: a manager
chooses their name and types their **PIN**, and the same payment goes through.
An item whose rule refuses it cannot be sold until the delivery or the batch is
entered, or it is counted; one whose rule alerts is sold, and the dashboard
shows it below zero.

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

**🕐 Clock in or out** (`0049`), at the top of the till: everyone working at
this branch today, those in first with the time they came in, the others with
their shift. Tap a name, type that person's PIN, and **Clock in** or **Clock
out**. A wrong PIN is refused and counted; too many pause clocking by PIN.

**👤 Customer** (`0050`), under the order (not on a platform's): type their
phone number any way (with +964, or in Arabic digits) and **Find**. Found,
their name, number, notes, points and the rewards they can take show: **Put
them on the order**. Nobody has it: **Add them as a customer** (their name,
and notes about them). The order then shows them and their points (**Change**
to put someone else on it or take them off), a bill kept for later keeps them
and is named after them, and the receipt prints the points the sale earned
and spent and theirs now. At the payment, **+** takes a reward: each takes its
amount off (5,000 IQD for 100 points by default), whole, as the bill's only
discount (4100, "Loyalty reward"), never more than the bill comes to. A
**Direct delivery** asks for the customer before the money, and **where it
goes**: one of their addresses, or **+ Add an address** (a name for it, the
address, how to find it). The bill and the receipt print it, and the sale
keeps it as it was.

## 6. Orders

**Location:** Sidebar → **Orders** · `/orders` · **Who:** anyone who sees costs

Every sale: number, time, channel, items, how it was paid, status, net and
margin (the sale's price less the recipe cost of what it used). Each item keeps
the name it was sold under: renaming a product later does not relabel its past
sales. An item's add-ons follow it, in the order they were given: **Latte —
Large (+ Oat milk, Extra shot ×2)**. Choose **From**, **To** and a **Channel** to see the sales of those days;
a report's figures open here with them chosen.

- **Void.** For a sale rung in error, until the drawer's session holding its
  cash is closed (after midnight too: the close, not the date, decides).
  Revenue, payment, cost and stock all come back exactly.
- **Refund.** After that, all of the sale or some of its items. **Refund**
  opens a list of the sale's items, each with how many were sold and how many
  have gone back already; type how many of each go back (it starts from all
  that is left) and it shows what each gives back before anything is done: its
  share of what it was sold for, after the bill's discount, the last of an
  item giving back exactly what is left of it. The money goes back the way the
  sale was paid: cash from the open drawer, a card sale to the card, a
  platform's order off what the platform owes. A sale paid two ways
  (`0042`) shows each way with what is left of it, filled in with its share
  of the refund; change them (never more than is left of a way, together the
  refund) to give it back as the customer wants. It goes through 4200 Sales
  returns. Only items marked returnable come back into stock, at what they
  cost when sold; a used cup does not. The answer gives the refund's number
  and journal, and **Print the refund slip** prints it on the till's printer.
  A sale partly refunded shows **Part-refunded**, with each refund under it
  (its number, amount and items), and can be refunded again until nothing is
  left; it can no longer be voided. A sale that took stock and was recorded
  before refunds by the item began can only be refunded whole.

Both take a **reason from the list** ("Rang twice", "Customer changed their
mind"…, or "Other" in a few words), and both go on the audit trail. You need the
sale.void or sale.refund permission (managers and the owner). **Approved by**
lets a second person — another manager or the owner — approve it there with
their PIN; without one it waits for the owner on Reports → Exceptions. A refund
over the limit on **Settings → Rules** (25,000 IQD by default) cannot go
without one (`0040`). Each void or refund shows why, who asked and who
approved it.

## 7. Sales

**Location:** Sidebar → **Sales** · `/sales` · **Who:** anyone who sees costs;
the drawer: whoever may open it (a manager closes one left open); moving cash:
managers, the accountant and the owner; settling card takings: the owner, the
general manager and the accountant

- **Cards:**
  - net sales, after refunds, over the last 30 trading days;
  - refunds made in those days (on the day each was made);
  - the cost of what was sold (less what refunds put back on the shelf) and
    the sales margin;
  - **Days whose cash is not counted**, with how many are before today, and
    when a session was last closed.
- **Daily Sales Summaries:** one line per day and channel (voided sales left
  out), with orders (opening that day's sales), sales, refunds made that day,
  net sales, cost, and whether the day's cash is **Counted** or **Not
  counted**.
- **The Drawer** (`0036`): the same panel as the till's (see
  [POS](#5-pos)): whose session is open and since when, **Open the drawer**,
  **Close the drawer**, **Hand over**, and, for a manager, **Close it for
  them** on a session someone else left open, with the reason, counted or not
  (not counted, what it should hold stays in the drawer for the next opening
  count). The owner, the general manager, the accountant and the auditor also
  see what the open drawer **should hold**, with its cash sales and card
  takings so far; nobody else is shown it before their count is in. A session
  covers everything from its opening count to its closing count, past
  midnight too, so a sale rung after the close is in the next one. A month
  cannot lock while a day's cash is in no closed session.

- **Move Cash:** from the till, the safe, the bank or the owner to another of
  them — a float into the till, takings to the safe during the day, a bank
  deposit, money the owner puts in. Only the owner takes money out for
  themselves (3200 Owner drawings), and money to or from the owner says what it
  is for. Neither the till nor the safe can pay out more than the books say it
  holds.
- **Dollars** (`/sales#dollars`, `0043`): the dollar's rate, who set it, when
  and why, and the rates before. A manager (the owner, a general or branch
  manager) sets today's: **Today's rate: dinars a dollar**, **Where it comes
  from**, **Set the rate**. The till takes dollars at it for 36 hours; older,
  it says no dollars are taken until a new rate is set. Below, **Dollars
  held**: the safe's, and a till's if a close left some uncounted, each with
  what they were taken at. **Exchange dollars for dinars** (managers and
  accountants): from the safe or the till, how many, the **Dinars received**,
  and where they go (the till, the safe or the bank). The answer says what
  they were taken at and the gain or loss, posted to 6950 Exchange
  differences. When the till took dollars, closing the drawer asks for them
  too (**Dollars in the till**), counted blind like the dinars, total or note
  by note; they all go to the safe, and a dollar missing or found goes to
  6300 at what they were taken at.
- **Card Takings** (`/sales#card`): each day's card takings not yet settled,
  less card refunds and voids. When the bank pays them:
  1. Choose the last day the payment covers in **Settle the days up to**. Only
     days that are over are offered: the till takes cards until midnight, so
     today's wait for tomorrow. Days are settled in order, from the day after
     the last settlement; **The till took by card** shows their total.
  2. Type **The terminal's total** for those days, from its report (**Same as
     the till** fills in the till's), and what **Reached the bank**.
  3. The journal is shown before anything is posted: Dr 1020 Bank what
     arrived, Dr 6500 Card and bank fees the terminal's total less what
     arrived, Cr 1010 Card clearing the till's takings. If the till and the
     terminal differ (a sale rung as card and paid in cash, or the other way),
     the difference posts to 6300 Cash over / short, and the **Note** must say
     why.
  4. Say when it **Arrived on**, and the bank's reference if there is one, and
     **Record the settlement**.

  Past settlements are listed with their fee and difference. **Cancel…** the
  latest one, with the reason, to reverse its journal: its days wait again.

- **Cash Sessions** (the owner, managers, the accountant and the auditor):
  each session — whose, when it opened and closed, what it opened with (and
  any difference then), what it should have held, what was counted, over or
  short, what was taken out and where, and the card takings — newest first;
  **All sessions** (`/sales/sessions`) chooses the dates. Each opens its
  statement: the opening count, every movement of its cash, the close and the
  takings. An open session shows what it should hold only to those who may see
  it. The drawer counts before sessions, and days closed the old way, are
  listed too.

## 8. Delivery Platforms

**Location:** Sidebar → **Delivery Platforms** · `/platforms` · **Who:** anyone
who sees costs

- **Owed by the Platforms:** every platform order not yet paid out, by its
  order number, with the day it was sold and how many days it has waited; each
  platform's total and its oldest order; what they come to, **1100 Platform
  receivable**, and the difference — **Not explained by any order**, normally 0.
- **Match a Statement:** choose the platform and paste the statement's rows,
  with their column names (Order, Payout, and Commission and Fees if it gives
  them), from its report. The screen says how many lines it read. **Match to
  the orders waiting** shows, line by line, the sale each pays for, or why
  none (no sale has the number, already paid out, voided or refunded, on the
  statement twice); what it leaves out; what is not explained; and the journal
  it would post — nothing is written yet. The owner, the general manager or
  the accountant types the statement's number or date and the day the money
  arrived, a note when any line is not a clean match, and **Post the payout**:
  Dr 1020 Bank, Dr 5100 commission, Dr 5200 fees and anything short, Cr 1100
  the orders' value. Lines that match no order waiting are kept with the
  statement, not posted.
- **Statements Posted:** each statement, the orders it paid of its lines, what
  was paid for them, the journal and who posted it. **Cancel…** one posted by
  mistake, with the reason: its journal is reversed and its orders wait again.
- **Platform Sales:** the platform sales among the last 500, with their value
  before commission and their cost.

See [`guides/talabat.md`](guides/talabat.md) for the whole routine.

## 9. Customers

**Location:** Sidebar → **Customers** · `/customers` · **Who:** owner,
managers; the accountant and the auditor read it (`0050`)

- **The list:** everyone who buys from the café, with their number, their
  points, how many times they bought, what they spent (less what was given
  back) and when they last bought; **Search by name or number** (part of it
  is enough). **+ Add a customer** (name, phone number, notes about them); a
  number already a customer's is refused with their name.
- **A customer** (`/customers/…`): their details and notes, who added them
  and when; **Change their details**, **Put them away** (someone added twice,
  or who asked to be: kept with what they bought, no longer put on a sale) or
  bring them back. **Addresses** for the café's own deliveries (a name for it,
  the address, how to find it; at most 10), each changed or **Put it away**:
  an order delivered to it keeps what it said. **What they bought:** each sale
  with its number, channel, what it came to and what was given back, the
  points it earned and spent, and a delivery's address. **How their points
  moved:** each point earned, spent, taken back or given back on a void or a
  refund, or given or taken by hand, with who and why.
- **Give or take points** (owner, managers): the points (a minus takes them),
  and why; 10,000 at most at a time, never below nothing. On the audit trail.

The rules (a point for every 1,000 IQD, 100 points a reward of 5,000 IQD off,
loyalty on or off) are under **Settings → Rules**. Reports → **Customers**
gives the points earned, spent and outstanding, the rewards taken and who
bought the most.

## 10. Vendors

**Location:** Sidebar → **Vendors** · `/vendors` · **Who:** anyone who sees costs;
bills: purchasing, managers, accountant; payments: accountant, general manager,
owner

**At the top:** what is owed, aged: not yet due, 1–15, 16–30 and over 30 days
late.

**Left:** every vendor with their balance; those taken out of use are listed
last, marked, with their history. **Right,** five tabs:

- **Statement:** every bill, payment and credit to date, with a running
  balance. Cancelled bills stay on the statement, marked. **A statement
  between two dates, to print** opens the supplier's statement for the dates
  you choose: what was owed before them, each bill, cancelled bill, payment
  and credit with the balance after it, what was owed at the end, then the
  bills still owed and the credits not yet all set against a bill. **Print
  the statement** prints it alone, to send the supplier.
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

  - **Open bills,** with **Pay bill**: amount, and where the money came from —
    the till, the safe, the bank, a card (paid by the bank, 1020) or the
    owner. You cannot pay more than is outstanding.
  - **Cancel** a bill entered in error, if nothing was paid on it and no
    credit was set against it. Give a reason and a date. The bill stays on
    record and its journal is reversed.
- **Credit notes:** what this supplier owes back, each credit with its number,
  what it is for, the supplier's own note, its amount and what is left of it.
  - A credit for **goods returned** after their bill is made by the return
    (Purchasing). When the supplier's credit note comes, type its number and
    **Record it**; until then it shows **Awaiting their note**.
  - **Record their credit note** (purchasing, managers, accountant) for:
    - **A lower price on a delivery that was billed:** choose the delivery;
      the stock of it still on the shelf is revalued, what was used since goes
      to the price variance (5050), and the credit is set against its bill.
      A delivery not yet billed has its price corrected on Purchasing instead.
    - **Other** (a service, an overcharge): the account it comes off (the
      bill's own, for a bill for a service), and the bill to set it against,
      or none, to leave it on the account.

    Type the number on their credit note (each once for a supplier), the
    amount and what it is for.

  - **Set it against** a bill still owed (accountant, general manager, owner):
    what is left of a credit, no more than the bill owes. A bill is paid by
    payments and credits together.
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

## 11. Expenses

**Location:** Sidebar → **Expenses** · `/expenses` · **Who:** anyone who sees
costs; recording: managers, accountant, owner

**Record an Expense:**

1. Write the **Narration** in plain words ("September shop rent").
2. Enter the **Amount** and **Date**, and choose where it was **Paid from**:
   the till (today's drawer), the safe, the bank, a card (which the bank
   pays, 1020), or the owner personally. There is no default: the money came from somewhere, and the
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

## 12. Purchasing

**Location:** Sidebar → **Purchasing** · `/purchasing` · **Who:** anyone who sees
costs; orders and receiving: purchasing, managers; approving: owner, general
manager, branch manager

The page says in plain words what receiving does; **How it is booked** under
it gives the debits and credits, for the accountant.

- **Purchase orders:** every order with its supplier, the day it is expected,
  what has come of each line, its total and its stage: **Draft**,
  **Approved**, **Sent**, **Partly received**, **Received**, **Closed** or
  **Cancelled**.
  1. **New order:** the supplier, the day it is expected, a note for the
     supplier, and a line for each item: the quantity, the unit it is bought
     in and the price of one. The total shows as you type. **Save the draft.**
  2. **Approve** (owner, general manager, branch manager): an order whose
     total is within your limit, a rule on Settings (a branch manager 250,000,
     the owner and the general manager any order). Over it, the order says
     **Over your limit** and waits for someone whose limit covers it.
  3. **Change** a draft or an approved order: changed, an approved order is a
     draft again and is approved again.
  4. **Mark as sent** once it has gone to the supplier. The order number opens
     its own page, with **Print the order**: the order as approved, to send.
  5. Deliveries come against it (below). **Close** it when all has come, or
     with a reason when the rest is not coming; **Cancel** it, with a reason,
     while nothing has come.
- **What to buy** (`/purchasing/buying-list`, **Open What to buy**, or an
  alert on the dashboard that an item bought is running out or below its
  reorder level): every item bought, worked out for the branch now.
  1. The items **to order** are grouped by supplier, each line saying why,
     with its numbers: what is on hand, on order and in draft orders; its
     reorder level, its own (set on the item) or its use a day over the last
     28 days for the days a delivery takes and a day more; what it is ordered
     up to (its par level, or the reorder level and a week of use); and the
     packs, rounded up to whole ones. The supplier is its usual one, or the
     one its last delivery came from; the price is the one agreed or last
     paid, or what it costs now, to be checked. Items with no supplier yet are
     under **No supplier yet**.
  2. Change what needs changing: the quantity, the **Pack** (the price follows,
     per base unit), the **Price of a pack**, the **Supplier** (its own pack
     and price follow when it has sent the item before), and tick **Make it
     the usual one** to keep that supplier for the item. Untick what not to
     order.
  3. **Not to order now:** the rest, each with why — enough on hand and
     coming, **Not enough history** (under a week), or **Not used lately** —
     and **Add to an order** for any of them.
  4. **Create the orders:** a draft for each supplier, expected in its own
     delivery days, each linked; a manager approves them as any order. What is
     drafted is not suggested again.
- **🏭 Add supplier:** name, what they supply, phone.
- **📦 Receive stock (goods receipt):**
  1. Choose the supplier, and, when it comes against a purchase order, the
     order under **Against a purchase order**: the delivery is filled in with
     what is still to come, at the order's prices. Each line says how it
     differs from the order: less than is still to come, more, another price,
     or an item not on the order.
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
     to compare with. More than is still on the order is asked about the same
     way: **It is right: receive it** when the supplier sent it and it is being
     kept.

  Stock goes up in base units, and the landed cost is spread over the lines to
  the dinar. The books post Dr Inventory, Cr Goods received not invoiced (2050),
  until the bill arrives.

- **Recent goods receipts:** each receipt's supplier, lines, goods, landed extras,
  value into stock, and bill status: **Billed**, **Awaiting bill**, **Not
  journaled** (from the previous app; see Reports), **Before controls** or
  **Reversed**. A delivery that was corrected shows as it stands now, its
  corrections listed under it: when, by whom, what changed, why, and what each
  posted.
- **✏️ Correct a delivery** (those who approve stock adjustments: owner,
  managers): on a delivery not yet billed, **Correct** opens its lines as they
  stand, with its supplier and the day it came. Change what is wrong, as the
  invoice has it: a quantity, a price, a unit, an item; add a line, or take one
  off. **Show what it would do** lists, item by item, the delivery before and
  after, the stock on hand before and after, and what changes in the stock's
  value, in what is owed for it (2050) and in purchase price variance (5050) —
  nothing is done yet. Say why, and **Confirm the correction**. The answer names
  the correction and its journal.
  - Units that come off the shelf leave at the price they came in at, as far as
    that delivery's stock is still there. A price corrected after some of the
    stock was used changes the value of what is left; the part already used
    goes to 5050.
  - The day is corrected within the month the delivery was entered, and not
    after today.
  - Refused: a delivery already billed (cancel its bill on **Vendors** first,
    then correct it, then record the bill again); the quantity of an item
    counted since (its price can still be corrected); a delivery in a locked
    month. Stock left below zero is asked about first.
- **↩️ Reverse a delivery:** for one that should never have been entered.
  **Reverse** shows what it takes off, then, with a reason, takes all of its
  stock off the shelf and nothing is owed for it. It stays on the list, marked
  **Reversed**, and cannot be billed. A delivery goods went back from is no
  longer corrected or reversed.
- **↩️ Return goods to a supplier** (purchasing, managers): the supplier, the
  delivery they came in (or none), the items and quantities, and why they are
  going back. The stock leaves at what it costs now.
  - Named against a delivery not yet billed, the return comes off what its bill
    will clear: the bill is for what was kept.
  - Named against a billed delivery, the supplier owes back what the delivery
    charged for them, as a credit on their account, set against the bill as
    far as it is still owed (see **Vendors → Credit notes**).
  - Not named, the supplier owes back what they cost now, as a credit.

  No more of an item goes back than came in the delivery, less what went back
  before. **Recent returns to suppliers** lists each one and how it is owed
  back.

### The papers kept with a record (`0053`)

A delivery, a return, a bill, a supplier's credit note and an expense each keep
their papers: a photo or a PDF of the delivery note, the supplier's bill or
credit note, the return slip, or the receipt. **📎** by the record's number
opens them. It is on Purchasing's deliveries and returns, Vendors' bills,
credit notes and statements, and Expenses; its number says how many are kept.

- **📷 Take a photo** opens the phone's camera. **📄 Choose a picture or a
  PDF** takes a file.
- Give it a name if you like (the file's own is used otherwise) and a note,
  then **Attach**.
- A picture (JPEG, PNG or WebP) or a PDF, 10 MB at most, 20 to a record. A
  photo over 1.5 MB is made smaller before it is sent, and stays readable.
- A document opens in a new tab through a link that lasts a minute.
  **Download** saves it under its name.
- **Take off**, saying why, removes one that is wrong. It is never deleted: it
  is listed under **Taken off**, with who took it off and why, and the audit
  trail keeps both.

Whoever may record that kind of record attaches its papers: receiving for a
delivery, buying for a return, a bill or a credit, the accountant for a bill,
a credit or an expense. Whoever sees costs sees them.

## 13. Products & Recipes

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
- **Sizes and add-ons** (on each card, at the top of **Recipe, prices, sizes
  and add-ons**, `0041`):
  - **Sizes:** **+ Add a size** gives it a name in the three languages, a
    price per channel, and what one serving uses: **The recipe of** another
    size (change it afterwards, below), **Its own recipe**, or **It uses no
    stock, because…**. A product sold under its own name gets a name for the
    size it already has in the same step (Latte becomes **Regular**).
    **Rename…** a size, or **Retire…** it with a reason: it leaves the till
    and stays on the sales it was in; **Bring it back** puts it on again. The
    only size on sale is not retired: hide the product instead.
  - **Add-ons offered:** **Choose the add-ons…** ticks the groups the product
    offers, with **Every size** or **Only:** the sizes ticked (extra shots with
    the Large only).
- **Add-ons** (a section of its own): **+ New group of add-ons** — its name in
  the three languages, the **fewest** a line takes (1 or more: the till asks
  for it, as for the milk; 0: optional) and the **most** (empty: no limit);
  the form says what the till will ask ("Choose 1", "Up to 3"). In each group,
  **+ Add an add-on** with its price per channel (0 is free; empty, not sold
  there) and what one uses for every size. Each add-on can be renamed,
  repriced from a date (**Change a price…**), given **What it uses…** for
  every size or a size's own (a Large's 200 ml of oat milk), or taken off the
  till and brought back. For a choice such as the milk, take the milk out of
  the sizes' recipes and give each milk its own, so every cup counts the milk
  it was made with. Neither a group nor an add-on on an open bill is taken off
  the till.

## 14. Inventory

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
- **🗑️ Record a loss** (`0048`): first **what kind of loss** — the form says
  what each means and the account it is charged to: waste, spoilage,
  expired, damaged and melt to 5300; production waste (lost making a batch)
  and preparation waste (lost preparing to sell) to 5310; staff consumption
  to 6110, complimentary to 6610, sampling to 6620. Then **an item** — its
  quantity and unit, and for an item kept by batch, **from batch** (left as
  it is, the loss is taken as sales take stock) — or **a product, as made**,
  and how many: what its recipe uses to eat in comes out. And **why**. It is
  valued at what it costs now, in one journal. A loss over the limit on
  **Settings → Rules** — on its own, added to your other losses this session
  (or today), or to an item's losses today by anyone — needs a manager
  (`0040`): they choose their name and type their **PIN** there and then, or
  you **save it to wait for a manager's approval**. Either way the stock comes
  off at once.
- **Losses waiting for approval** (managers, `0040`): each loss saved to wait,
  oldest first, with its kind and account, what was lost (a product by how
  many, an item from the batch named), who recorded it and why; a loss is
  approved or reversed whole. **Approve** it, or **Reverse**
  one that did not happen, with a reason: the stock goes back at the loss's
  own value and its journal is reversed. Nobody approves a loss they recorded.
  The dashboard names the losses waiting under **Needs you**.
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
  - **Bought from:** its suppliers, the pack each sends it in, a pack's price
    agreed last, and **The usual supplier**, the one What to buy suggests.
    Whoever drafts orders adds or changes one (**Save the supplier**; a price
    left empty keeps the one agreed), makes one the usual one, or removes one.
    Each change is on the audit trail;
  - **Correct this item** (purchasing, managers, owner): its names, type,
    reorder and par levels, and whether it is **in use**, with **why**. It stays
    counted in its base unit. It is taken out of use only when it has no stock
    and no recipe, product or batch needs it; then its name is free again. Every
    change is on the audit trail with its values before and after.
- **Movements:** the most recent entries in the stock ledger.

### Where this device does its stock work (release AB)

With a second place — the central kitchen, or another branch — **Stock at**
beside the title of Inventory, Stock Count, Usage, Production, Purchasing and
What to buy says where this device works, and changes it. The device keeps it:
the kitchen's tablet is set to the kitchen once. There, the stock screens show
that place's stock, and record at it:

- a delivery with no order, a new order, and a return not named against a
  delivery (a delivery against an order comes in where the order was for; a
  return named against a delivery goes back from where it came in);
- a batch made, and the day's plan and the batches in stock;
- a loss, a correction, opening stock (a new item's too) and a count.

### The till at its branch, and who works where (`0055`)

- **The till sells at this device's branch.** With more than one branch,
  **Till at** above the till says which and changes it; the till loads anew
  there. It sells at that branch's prices, from its own turn numbers (1 each
  day), with its drawer, its tables and its open bills. A device at the
  central kitchen is told the kitchen does not sell, and chooses the branch
  its till is at (with one branch, it sells there).
- **Where a person works** (Settings → People → **Works at**): everywhere, or
  one place. Someone who works at one place has no other to choose, and the
  database refuses anything they record elsewhere, in words: "You work at
  Main Branch, not at Second Branch".
- **A branch's own price:** Products → a product → **Change a price…** →
  **At**: every branch, or one. The card lists each branch's own under the
  price table; one to come names its branch.
- **Paid from the till:** an expense, a supplier's bill or an advance paid
  from the till comes out of this device's branch's drawer.

### Transfers (`0054`)

**Location:** Inventory → **Transfers** (or Sidebar → **Transfers**) ·
`/inventory/transfers` · **Who:** owner, general manager, branch manager,
purchasing send, receive and cancel; whoever sees costs reads them

- **🚚 Send stock to another place:** from this device's place (or another
  chosen) to the other; each item, its quantity and unit, with what the place
  holds shown beside it; a note if you like. It leaves at what it costs there,
  the batch with the earliest use-by first, and is **on its way**: in neither
  place, but in 1210 Stock in transit. Sending more than the place holds is
  asked about first (refused, where the item's rule refuses stock below
  zero).
- **On their way:** each transfer, from where to where, what and at what,
  who sent it and when.
  - **Received: all of it** brings it into the other place at what it left
    at. A batch is kept there as the same batch, with its use-by.
  - **Not all of it arrived…** asks what arrived of each line, in the unit it
    was sent in: what did not is lost, to 5300, with a note of why.
  - **Cancel it…**, saying why, sends it back where it was, to the batches it
    left.
- **Received and cancelled:** the ones settled, with what arrived, what was
  lost and why, or why each was cancelled.

"Do the books tie?" checks what is on its way against 1210. The journals and
the audit trail name each transfer by its number. A batch's page follows it to
every place it is at: what was sold at the branch counts, what did not arrive
is lost, and what is on its way is shown apart until it arrives.

## 15. Stock Count

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

### Usage

**Location:** Sidebar → **Usage** · `/inventory/usage` · **Who:** anyone who
sees costs

Choose **From** and **To** (this month to begin with, or **Last month**, **Last
90 days**). Each item counted twice in those dates is shown between its first
and last count:

- **First count**, what **came in** (received, made, moved, opening stock,
  corrected by hand), **Last count**, and what was **lost** (waste, spoilage
  and the rest, recorded);
- **Used** — what the counts say went, less what was recorded as lost;
- **The recipes say** — what the sales of the products that use it, and the
  batches made with it, should have used (voids and refunds taken off);
- the **difference**, its **%** of what the recipes say and its **value**. Red,
  more went than anything explains: bigger portions, waste not recorded, sales
  not rung up. Below nothing, less went: smaller portions, or a delivery never
  entered.

Under each item, what may explain it (a recipe changed, a sale voided, a
delivery corrected, stock corrected by hand, the books below zero when it was
counted), and **What it is made of**: each figure's parts, the products whose
sales used it and the batches it went into. The item's name opens its stock
card. Items counted only once are listed below: a second count gives what
they used. The dashboard names an item whose last two counts, the later in
the last fortnight, differ from the recipes by 10% and 5,000 IQD or more (both
set on **Settings → Alerts**).

## 16. Production

**Location:** Sidebar → **Production** · `/production` · **Who:** anyone who sees
costs, and baristas (who make the batches); setting up what is made: owner,
general manager; cancelling a batch, changing its use-by, recording one made
earlier: owner, managers

What the café makes in batches: gelato, a base, syrup, cold brew, dough.

- **Record a batch:** what was made, how many batches (0.5 and 2 work too), and,
  if you weighed or counted it, what came out, in any of the item's units (kg,
  pans, trays, pieces). Left empty, it came out as the recipe says. Before you
  record it, the form shows what it will use (and how much of each is in stock),
  what it makes and how that compares with the recipe, and, for those who see
  costs, what it costs and the cost per kg (or per pan, or per piece).
  Recording takes the ingredients out of stock at their average cost and puts
  what came out in, at exactly that cost, as a batch with its own number and
  lot. Baristas are shown no costs. **Use by (optional):** left empty, the
  batch is used by its recipe's shelf life from when it was made (the form
  says how long), or not at all without one. A manager ticks **Made earlier**
  for a batch made earlier today or yesterday, with when and why; it is
  refused before the last approved count of its items.
- **What to make on…:** the day's plan (today, or **Tomorrow**). For each thing
  you make: what it sold and was used in batches on the same weekday over the
  last four to eight weeks, on average; what is on hand, and what of it is due
  before the day is out; and so how many batches to make, and what that makes.
  Ingredients the batches need beyond what is in stock are listed, with a link
  to What to buy. Under four weeks of history, it says how many days there are.
- **In stock by batch:** every batch with something left, the one to be used
  first first, with its use-by and whether it is past it, due today, due
  within a day or good. Sales, losses and other batches take from them in
  that order, one past its use-by last; what is thrown away as expired, or
  found missing on a count, comes off one past its use-by first. A manager
  **Change the use-by…** with why, on the audit trail.
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

  _What it makes keeps for_ (in days or hours, optional) sets each batch's
  use-by, and the card says it: "keeps 3 day(s)".

  **Change…** changes it from today; **Stop making it** hides it (it comes back
  with **Make it again**).

- **Batches:** every batch, newest first: its number, when, what, how many,
  what came out (against the recipe), what is left of it, its use-by, its cost
  (for those who see costs) and who made it; one recorded late is marked. A
  batch recorded in error is **Cancel…**led by a manager with a reason while
  all it made is still there: its stock movements are reversed at the values
  they had, and it stays on the list, struck through.
- **A batch's page** (its number): when it was made and by whom, why it was
  recorded late, what came out of what was planned, its use-by, and what
  became of it — sold, used in other batches, lost, found or missing on a
  count, still in stock — checked to add up to what was made, with every
  movement of it. Reports → **Production** lists the batches made in the
  dates.

A made item is then used like any other: in another batch, or in a product's
recipe on Products & Recipes (**Change the recipe…**), so a cup of gelato takes
120 g of the gelato you made.

## 17. Staff

**Location:** Sidebar → **Staff** · `/staff` · **Who:** owner, managers;
payroll readers (the accountant, the auditor) see it too

- **In now:** who is clocked in, and since when.
- **People:** everyone who works here, with where, since when, their login,
  whether they have a PIN, and, for those who see payroll, their pay and the
  advances they still owe. **+ Add someone who works here** (name, what they
  do, phone, where they work, the day they started, their login if they have
  one); **Edit**; **Set a PIN** / **New PIN** (they type it, twice: 4 to 8
  digits, not 1111 or 1234); **Set the pay…** (payroll: by the month, the day
  or the hour, a day's hours, their own overtime percentage, why it changes);
  **Last day…** (why; their shifts after it are taken off) or **Works here
  again…**.
- **The schedule:** a week, Saturday to Friday, for one branch (**← The week
  before** / **The week after →**, and the branches along the top). Type each
  person's hours as `08:00-16:00` (ending at or before the start: the next
  day), empty for a day off, or **The same hours as the week before**; then
  **Save the week**. Someone working at another branch that day shows it
  instead of a box; a month whose pay is approved no longer changes.
- **The hours, day by day:** who was on the schedule, when they clocked in and
  out, how long they worked, and badges: **Absent**, **Late by…**, **Left …
  early**, **Overtime…**, **Still in**. Below, **each record of hours**, with
  how it was recorded (at the till, or added by a manager) and every
  correction's who and why. A manager may **Correct…** a record (a forgotten
  clock-out), **Cancel…** a mistake, or **+ Add hours nobody clocked…**, each
  with the reason. Nothing here changes pay by itself: deductions are made on
  Payroll.

Clocking in and out is on the till: **🕐** at the top, then the name and the
PIN (see [POS](#5-pos)).

## 18. Payroll

**Location:** Sidebar → **Payroll** · `/payroll` · **Who:** owner, general
manager, accountant; the auditor reads it

- **Draft a payroll:** choose last month (or this one, to see what is owed so
  far) and **Draft the payroll**; the payroll opens.
- **The payrolls:** each month's, with its number, status (**Draft**,
  **Approved**, **Paid**), how many people, the gross, what is to be paid and
  what has been, and who approved it.
- **A payroll** (`/payroll/…`): each person's pay (a month's for the days
  employed, a day's for each day worked, or an hour's for each hour), the days
  and hours worked with overtime, lateness and absences, the base, the
  overtime, what was added and deducted (with why), the advance taken back,
  what is to be paid and what has been. On a draft: **Adjust…** a line (added,
  deducted, each with why; how much of an advance to take back), **Draft it
  again** when the hours or pay changed since, and **Approve the payroll** once
  the month is over. Approved: **Pay…** one person, or **Pay everyone still
  owed** from the bank, the safe, the till's drawer or the owner; **Reopen…**
  (with why) while nothing is paid from it. **Salaries paid** lists each
  payment, which can be **Cancel…**led with why.
- **Advances on pay:** who owes what; each advance given, from where, why and
  its journal; **+ Give an advance…** (to whom, how much, from where, what it is
  for); **Cancel…** one given by mistake while none of it is taken back.

The journals: an advance Dr 1300 / Cr where it came from; an approval Dr 6100
Salaries / Cr 2100 Salaries payable / Cr 1300 the advances taken back, on the
month's last day; a payment Dr 2100 / Cr where it came from. Reports → **Do the
books tie?** checks salaries owed against 2100 and advances against 1300.

## 19. Journals

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

## 20. Chart of Accounts

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

- Who changed what is on the [Audit trail](#22-audit-trail).

## 21. Reports

**Location:** Sidebar → **Reports** · `/reports` · **Who:** anyone who sees costs;
the P&L: owner, managers, accountant, auditor

Choose **From** and **To**, or **This month**, **Last month**, **This year**.
With more than one place, **Place** reads every report on the page for **The
whole café** or one of its places (`0057`), its name by the title; the links
to the analysis and the stock's value, and the CSVs, keep it. A line under the
dates says which parts stay the whole café's. Someone who works at one place
reads theirs and chooses no other.
**Every journal line (CSV)** downloads the whole ledger for those dates, for the
accountant's own tools. Two pages open from the top (`0051`):

- **Sales analysis** (`/reports/sales`): the sales of the dates **by** the
  hour, the day of the week, the date, the product, the category, the size,
  an add-on, who took the money, the payment, the channel or the branch,
  **then by** a second of them if you like, narrowed to a channel, a branch, a
  category or a person. Each row gives the orders, the items, what they sold
  for, the discount, the net, the cost and the margin, and what refunds gave
  back of them since, what was kept and the margin kept, with a bar for its
  share; the add-ons (times taken, sold for, net, cost) and the payments
  (paid, given back, kept) have their own. Every way adds up to the same
  sales; voided sales are left out and counted below with the bills
  cancelled. **CSV** downloads it. A year of dates at most.
- **Stock value on a day** (`/reports/stock`): every item's stock and value
  when the day ended, from the stock ledger, beside what 1200 Inventory held
  then (**They agree** when the books tie), by kind and item by item, with
  **CSV**. Read for one place (`0057`), it is that place's stock alone: 1200
  is the café's, so it stands beside the café's stock only.
- **Balance sheet and cash flow** (`/reports/statements`, for those who see
  profit, `0052`): what the café owned and owed at the end of the day before
  the dates and at their end, side by side (the cash, the rest of the current
  assets, the equipment; what it owes; the owner's, with the profit not yet
  closed), and whether it balances; then the cash flow of the dates: the cash
  at the start, what came from sales, what was paid for stock and to
  suppliers, to staff, for running costs, what the drawer counted over or
  short, equipment, the owner's money in and out, and dollars changed at
  another rate, each with the accounts that moved it, and the cash at the
  end, the till, the safe and the bank each; **It adds up** when the cash at
  the start and the end are the balance sheet's. Each account opens its
  journals; each statement has **CSV**.

**Print or save as PDF** (release AA), at the top of every report, prints it
as it stands on the screen, headed with the café, the report, its dates and
when it was read, without the menu, the forms or the buttons. In the print
window, choose **Save as PDF** to keep it as a file for the accountant or the
bank. It is on Reports and its three pages, the trial balance (Chart of
Accounts), the audit trail, Journals and an account's ledger, the usage
report, an item's movements, a cash session's statement and a payroll.

- **Do the books tie?** Each subledger against its control account, as at the
  **To** date, with **CSV**. When every check ties it folds to one line (**✅
  Every subledger agrees with its control account.**), the checks a click
  away; one that does not tie opens them:
  - stock vs Inventory;
  - unpaid bills (and deliveries the previous app posted to payables) vs
    Accounts payable;
  - deliveries not yet billed vs Goods received not invoiced;
  - sales vs revenue;
  - card takings not yet settled vs Card clearing (1010);
  - the orders the platforms owe vs what they owe in the books (1100);
  - what the drawers should hold vs Cash in the till (1000), once a drawer has
    been counted in a session;
  - the cash moved in and out of the safe vs the Safe (1005);
  - every record with its one journal, and every automatic journal with its
    record: a count, and **Records to look into** below lists each one, with a
    link to where it is.

  ✅ means they agree; a month is locked only when every one does. Each side
  opens what is behind it: the records (stock, unpaid bills, deliveries,
  orders, card takings, what the platforms owe, the drawer's sessions, cash
  moved) and the account's journal lines. Below it,
  **Stock the old app never journaled** lists any
  stock the previous app moved without a journal, each with the entry it would
  post. The owner reviews them and posts them in one step, with a reason (see
  [`REMEDIATION.md`](REMEDIATION.md)).

- **Profit & Loss:** income, cost of sales, **gross profit after waste & fees**,
  operating expenses and net, from published entries, with **CSV**. Each line
  opens its journal lines, which add up to it. Someone who works at one place
  reads **Profit & Loss at** their place (`0056`).
- **Profit & Loss by place** (`0056`, with more than one place, for those who
  work everywhere): the same lines, a column for each of the café's places,
  **Shared** for what is no one place's (the bank's card fees, journals by
  hand) and **Café total**, with **CSV**. A sale is at the branch that sold
  it, a loss where the stock was, an expense where it was recorded; a
  platform's payout is shared out by each order's branch, and a payroll by
  where each person works.
- **Sales by Channel:** per channel and in all, the orders (opening them),
  sales, refunds made in the dates, **net sales** (the P&L's net revenue) and
  the **sales margin** (net sales less the recipe cost of what was sold, before
  waste and fees).
- **Losses** (`0048`): what was lost or given away in the dates — how many
  and their value, what waits for a manager and what was reversed apart; by
  kind, with the account each is charged to and its share; the giveaways at
  the till by kind; the items lost most and who recorded them; and each loss,
  the latest first, a giveaway with its number, a loss from a batch with the
  batch.
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
- **Sizes and add-ons** (`0041`): each size of the products sold in more than
  one, and each add-on taken, in the dates: how many, net sales, cost and
  margin; for an add-on, on how many lines, and how often it is taken out of
  the lines of the products offering it. A size's figures leave out its
  add-ons; refunds are not taken off here.
- **Sales by payment method** (`0042`): cash, card and each platform's
  payments in the dates: the sales each paid for (and how many of those were
  paid two ways), what it took, what refunds gave back that way, the net, and
  the change cash gave. A sale paid in cash and by card counts under each,
  for its part; the net of all of them is the net of Sales by Channel.
- **Dollars** (`0043`): the sales paid in dollars in the dates, how many
  dollars, what they were taken at, what they paid and the change given in
  dinars; by rate; the exchanges with their differences; each close's count
  of the dollars; the exchange differences (6950) and the dollars counted
  over or short (6300); and what the tills and the safe hold now.
- **Purchasing** (`0044`): the purchase orders made in the dates, with their
  stage, what was ordered and what has come; the orders still open, waiting
  for goods; the prices that changed from each supplier's delivery before; the
  returns to suppliers, why, what is owed back and how; the suppliers'
  credits, with their note and what is left; and what was returned, credited,
  and not yet set against a bill. Then (`0051`) **what came in**, by supplier
  (deliveries, received, sent back, credited for price, net, billed) and by
  item (how much came in, what one cost, sent back, net), with **CSV**.
- **Staff** (`0049`; for those who keep the staff, their hours or their pay):
  each person's days on the schedule and worked, hours, overtime, lateness,
  leaving early and absences in the dates (a year at most); and, for those who
  see payroll, what 6100 Salaries holds each month against the month's sales.
- **Customers** (`0050`; for those who see customers): the points earned,
  spent, taken back on voids and refunds (and given back) and given or taken
  by hand in the dates; the rewards taken and what they took off; the points
  customers hold now and what they would take off (no debt in the books: a
  reward reaches them as a discount on 4100 when it is taken); how many
  customers there are, and how many are new in the dates; and the ten who
  bought the most, with their orders, what they spent and their points.

## 22. Audit trail

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
  sales, bills and discounts; cash; the books; staff, hours and payroll;
  customers and points; settings, places and people) and
  **Who** (anyone, a person, or no one signed in). **CSV** downloads every row
  chosen, with the values as the database stored them.

The trail is written in the same step as the change and is never edited or
deleted.

## 23. Settings

**Location:** Sidebar → **Settings** · `/settings` · **Who:** owner, general
manager

- **People:**
  - every member, with name, email, roles, and whether they have signed in;
  - **Add a person** (name, email, roles), change roles, **Deactivate** /
    **Reactivate**.

  Only the owner grants owner or general manager, and the business always keeps
  an active owner. Every change is on the audit trail.

- **Rules** (`0040`): the café's rules as they stand, and **Open Rules →**.
- **Business configuration** (shown, not edited here):
  - name;
  - currency and decimal places;
  - timezone (trading days and months run midnight to midnight there);
  - default language.
- **Alerts** (edited here, `0029`): the thresholds the dashboard's alerts use
  — the margin target, the days a delivery takes (for vendors without their
  own), how long a count may stay open, the days card and platform money take,
  how soon a bill due is shown, what counts as a waste spike, as one person's
  exceptions and as a price typo. Each shows its default and its limits; an
  empty box follows the default; a change is on the audit trail.
- **Locations:** the branch and the central kitchen.
- **Roles & what they may do:** the exact permission list of each role.

### Rules

**Location:** Settings → **Open Rules →** · `/settings/rules` · **Who:** owner,
general manager

Each rule, what it does, and every row that applies — the whole café's, and
any set for a role, a kind of item or one item — with who set it, when and
why, or **Default**:

- **Discounts a manager approves** (10% of the bill by default; per role);
- **Discounts rounded to** (the step a percentage discount is rounded to);
- **Refunds a second person approves** (over 25,000 IQD by default; per role);
- **Losses a manager approves** (over 50,000 IQD by default; per role), and
  **one person's losses are added up over** each loss, their cash session (or
  their day), or the day;
- **Using more stock than the books hold**: **Refused**, **A manager approves
  it**, **Allowed, with a red alert**, or (for one item only) **Allowed, with
  no alert** — for the whole café, a kind of item or one item. By default what
  is made here is refused and everything else alerts;
- **Purchase orders a manager approves, up to** (`0044`): 250,000 IQD for the
  café by default, and any order for the owner and the general manager; per
  role.
- **Overtime is paid at** (`0049`): 150% of an hour's pay by default (100% to
  300%); a person's own, set with their pay, comes first;
- **Late, or leaving early, by more than** (`0049`): 5 minutes by default;
- **Someone still clocked in after** (`0049`): 16 hours by default, then an
  alert;
- **Salaries are paid on the day of the month** (`0049`): the 1st by default;
  from then an unapproved or unpaid payroll is an alert.
- **Customers earn points, and take rewards** (`0050`): on by default; off,
  none are earned or taken, and the points held are kept;
- **A customer earns a point for every** (`0050`): 1,000 IQD by default, of
  what a sale comes to after its discount;
- **A reward takes** and **A reward is worth** (`0050`): 100 points for 5,000
  IQD off by default, taken whole as the bill's discount.

**Change** a row, **Back to default**, or **+ Set it for** a role, a kind of
item or an item: each takes a reason. **Every change** below lists them all,
from what to what, why and who; each is on the audit trail too. The most
particular row applies: an item's own, then its kind's, then the most any of
a person's roles allows, then the café's.

---

## 24. Every feature, and where it is

| Feature                                                                                                              | Where                                    | Who                                                                                   |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Sign in, create a login, reset password                                                                              | `/login`                                 | everyone                                                                              |
| Change password, see your permissions                                                                                | My account `/account`                    | everyone                                                                              |
| Language (EN / AR / CKB, right-to-left), light/dark                                                                  | top bar                                  | everyone                                                                              |
| Today at a glance, low stock, books reconcile                                                                        | `/dashboard`                             | owner, managers, accountant, auditor                                                  |
| What needs you: alerts answered or snoozed; yesterday's brief                                                        | `/dashboard`                             | owner, managers, accountant, auditor (answering: owner, managers, accountant)         |
| Alert thresholds; how many days each vendor takes to deliver                                                         | Settings `/settings`, Vendors `/vendors` | owner, general manager; vendors: purchasing, managers                                 |
| Sell by channel; cash, card, platform-paid                                                                           | `/pos`                                   | cashier, barista, managers, owner                                                     |
| Retry a sale without recording it twice                                                                              | `/pos`                                   | the same                                                                              |
| Void (until its session closes) and refund, whole or by the item, with a reason; a second person's PIN               | `/orders`                                | managers, owner                                                                       |
| Discount over the cap approved by a manager's name and PIN                                                           | `/pos`                                   | cashiers ask; managers, owner approve                                                 |
| Set your approval PIN                                                                                                | My account `/account`                    | managers, owner                                                                       |
| Exceptions by person: voids, refunds, discounts, cancelled bills, items taken off, wrong PINs; CSV                   | `/reports`                               | owner, managers, accountant, auditor                                                  |
| Daily summaries; the drawer in sessions; move cash between till, safe, bank and owner                                | `/sales`                                 | cost viewers; the drawer: whoever may open it                                         |
| Platform orders; payout by journal                                                                                   | `/platforms`, `/journals`                | cost viewers                                                                          |
| Vendor statements, bills, payments, cancel a bill, ageing; correct a vendor, take one out of use                     | `/vendors`                               | cost viewers (by permission)                                                          |
| Expenses with a proposed account                                                                                     | `/expenses`                              | managers, accountant, owner                                                           |
| Suppliers; receive goods at a price per unit, checked against the cost now; landed cost                              | `/purchasing`                            | purchasing, managers, owner                                                           |
| Purchase orders: drafted, approved within a limit, sent, printed, received against, closed or cancelled              | `/purchasing`                            | purchasing, managers, owner; approving: owner, managers                               |
| What to buy: each item's stock, use and levels, with why; draft orders for each supplier; an item's suppliers        | `/purchasing/buying-list`, `/inventory`  | cost viewers; drafting and suppliers: purchasing, managers, owner                     |
| Return goods to a supplier; their credit notes, set against bills; a statement between two dates                     | `/purchasing`, `/vendors`                | purchasing, managers, owner; setting against bills: accountant, owner                 |
| Products, recipes by channel, prices from a date, margins                                                            | `/products`                              | cost viewers; editing: owner, general manager                                         |
| Sizes; add-ons in groups, priced by channel, with recipes; which sizes offer them                                    | `/products`                              | cost viewers; editing: owner, general manager                                         |
| Sell a size with its add-ons, in one sheet                                                                           | `/pos`                                   | cashier, barista, managers, owner                                                     |
| Sizes and add-ons sold                                                                                               | `/reports`                               | cost viewers                                                                          |
| Stock board, add and correct items, pack units, price history, opening stock (owner), waste, corrections             | `/inventory`                             | cost viewers; waste: baristas too                                                     |
| Blind count while trading, second-person approval, cancel a count                                                    | `/count`                                 | counter; reviewers                                                                    |
| Journal register, manual journals, reversal                                                                          | `/journals`                              | cost viewers; posting: accountant, general manager, owner                             |
| Owner's correction to a control account                                                                              | `/journals`                              | owner                                                                                 |
| Trial balance, closing checklist, lock / reopen                                                                      | `/accounting`                            | cost viewers; lock: accountant, general manager, owner; reopen: owner                 |
| Who changed what, before and after, by kind and person; CSV                                                          | `/audit`                                 | owner, managers, accountant, auditor                                                  |
| Reconciliation, P&L, channels, ageing, margins, CSV                                                                  | `/reports`                               | cost viewers                                                                          |
| Post the stock the old app never journaled                                                                           | `/reports`                               | owner                                                                                 |
| People and roles, business configuration                                                                             | `/settings`                              | owner, general manager                                                                |
| Open, close and hand over the drawer, counted blind                                                                  | `/pos`, `/sales`                         | cashier, barista, managers, owner                                                     |
| Cash sessions and each one's statement                                                                               | `/sales/sessions`                        | owner, managers, accountant, auditor                                                  |
| Who works here, their PINs, the schedule, the hours corrected with why                                               | `/staff`                                 | owner, managers                                                                       |
| Pay, advances, payroll drafted, approved and paid                                                                    | `/staff`, `/payroll`                     | owner, general manager, accountant; the auditor reads                                 |
| Clock in and out with a name and a PIN                                                                               | `/pos`                                   | everyone who works here, at the till                                                  |
| Customers found by their number or added at the till; a reward taken; a delivery to their address                    | `/pos`                                   | cashier, barista, managers, owner                                                     |
| Customers, their addresses, what they bought and how their points moved; points by hand with why                     | `/customers`                             | owner, managers; the accountant and the auditor read; points by hand: owner, managers |
| Points earned, spent and outstanding; rewards taken; who bought the most                                             | `/reports`                               | owner, managers, accountant, auditor                                                  |
| Sales by hour, day, date, product, category, size, add-on, person, payment, channel or branch, and a second way; CSV | `/reports/sales`                         | cost viewers                                                                          |
| The stock's value on a day against 1200; what came in by supplier and by item                                        | `/reports/stock`, `/reports`             | cost viewers                                                                          |
| The balance sheet at the start and the end of the dates; the cash flow between; CSV                                  | `/reports/statements`                    | profit viewers                                                                        |
| Stock sent between the café's places, on its way in 1210; received, what did not arrive lost; or cancelled           | `/inventory/transfers`                   | owner, managers, purchasing; readers: cost viewers                                    |
| Photos and PDFs of a delivery note, a bill, a credit note, a return slip or a receipt, kept with its record (📎)     | `/purchasing`, `/vendors`, `/expenses`   | cost viewers; attaching: whoever records it                                           |
| **Not built:** offline selling                                                                                       | [`LIMITATIONS.md`](LIMITATIONS.md)       | —                                                                                     |
