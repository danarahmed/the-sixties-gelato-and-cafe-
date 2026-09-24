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
19. [Settings](#19-settings) · `/settings`
20. [Every feature, and where it is](#20-every-feature-and-where-it-is)

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

Today, from the books:

- **Net sales today**, **Gross profit**, **Orders**, **Average order value**;
- **Inventory (1200)**: the value of stock in the ledger;
- **Low-stock items**: a count, and a list of items below their reorder level or
  negative;
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

**What each sale posts:**

- Dr Cash (1000), Card clearing (1010) or Platform receivable (1100), by tender;
  Cr Sales (4000);
- Dr Cost of goods sold (5000), Cr Inventory (1200), for exactly the recipe and
  packaging used on that channel.

## 6. Orders

**Location:** Sidebar → **Orders** · `/orders` · **Who:** anyone who sees costs

Every sale: number, time, channel, items, how it was paid, status, net and
margin.

- **Void.** For a sale rung in error, the same day and before the day is closed.
  Revenue, payment, cost and stock all come back exactly.
- **Refund.** After that: the money goes back through 4200 Sales returns. Only
  items marked returnable come back into stock; a used cup does not.

Both ask **why**, and both go on the audit trail. You need the sale.void or
sale.refund permission (managers and the owner).

## 7. Sales

**Location:** Sidebar → **Sales** · `/sales` · **Who:** anyone who sees costs;
closing a day: managers and the owner

- **Cards:**
  - net sales over the last 30 trading days;
  - refunds since;
  - cost of sales and margin;
  - **Days not yet closed**, with how many are before today.
- **Daily Sales Summaries:** one line per day and channel (voided sales left
  out), with orders, net, later refunds, cost, and whether the day is **Open** or
  **Closed**.
- **Close the Day:**
  1. Pick the **Trading day**. Every day that sold and is not closed is listed,
     oldest first, however old.
  2. Enter the **Opening float** and the **Cash counted**. The screen shows what
     the **Drawer should hold** (float + cash sales − cash refunds) and the
     **Over / short**.
  3. **Close the day.** Any difference posts to 6300 Cash over / short, dated on
     that day.

  A day closes once. A month cannot lock while one of its trading days is open.

- **Closed Days:** each day's float, expected, counted, over/short and who
  closed it.

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

**Left:** every vendor with their balance. **Right,** three tabs:

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
    enter the date, amount and terms (due now, net 7, 15 or 30).

  - **Open bills,** with **Pay bill**: amount, and paid from 1000 Cash, 1010 Card
    or 1020 Bank. You cannot pay more than is outstanding.
  - **Cancel** a bill entered in error, if nothing was paid on it. Give a reason
    and a date. The bill stays on record and its journal is reversed.
- **New vendor:** name, what they supply, phone.

Deliveries received before these controls show as **Before controls ·
(supplier's name)** under every vendor. The previous app did not record the
supplier on them. Their bill is recorded against the payable already posted.

## 10. Expenses

**Location:** Sidebar → **Expenses** · `/expenses` · **Who:** anyone who sees
costs; recording: managers, accountant, owner

**Record an Expense:**

1. Write the **Narration** in plain words ("September shop rent").
2. Enter the **Amount**, **Date** and **Paid from** (Cash on hand, Card clearing
   or Bank).
3. An **Account** is proposed from the narration: rent → 6000, wages → 6100,
   electricity → 6200, anything unclear → 6900 Other expenses. **Confirm or
   change it.** A stock loss is sent to Inventory instead, because it is not an
   expense.
4. The entry is shown exactly as it will post (**Balanced — debits equal
   credits**), then **Post expense**.

Below: the **Expense Register** and totals **By Account**.

## 11. Purchasing

**Location:** Sidebar → **Purchasing** · `/purchasing` · **Who:** anyone who sees
costs; receiving: purchasing, managers

- **🏭 Add supplier:** name, what they supply, phone.
- **📦 Receive stock (goods receipt):**
  1. Choose the supplier.
  2. Add a line for each item: the unit you bought it in and the quantity, and
     the goods value.
  3. Add freight, other landed costs and any rebate.
  4. **Receive goods.**

  Stock goes up in base units, and the landed cost is spread over the lines to
  the dinar. The books post Dr Inventory, Cr Goods received not invoiced (2050),
  until the bill arrives.

- **Recent goods receipts:** each receipt's supplier, lines, goods, landed extras,
  value into stock, and bill status: **Billed**, **Awaiting bill**, **Not
  journaled** (from the previous app; see Reports) or **Before controls**.

## 12. Products & Recipes

**Location:** Sidebar → **Products & Recipes** · `/products` · **Who:** anyone who
sees costs; creating and pricing: owner, general manager

- **Add a menu product:**
  - its name in English, Arabic and Kurdish;
  - a **price per channel** (leave a channel empty if it is not sold there);
  - its **recipe** for one serving: each line is an item and a quantity. Leave
    the channels unticked for "all channels"; tick channels for lines used only
    there, such as a takeaway cup.

  The product, recipe and prices are created together, or not at all.

- **Each product** shows its **Recipe** (component, quantity, applies to) and
  **Price & margin by channel**, costed exactly as a sale would post it today.
- **Set price:** a new price for a channel, from a date. A sale always uses the
  price and the recipe in force on its own day.

## 13. Inventory

**Location:** Sidebar → **Inventory** · `/inventory` · **Who:** anyone who sees
costs; baristas can record waste

- **Cards:** items tracked, stock value (from the ledger), items below reorder
  level, items with negative stock.
- **➕ Add stock item:**
  - its name, type (ingredient, packaging, consumable, finished good, resale);
  - what it is measured in and its base unit;
  - optional purchase units (e.g. a carton of 1,000);
  - optional opening quantity and cost, posted as Dr Inventory, Cr Owner equity.
- **🗑️ Record waste:** the item, what happened (waste, spoilage, expired,
  damaged, melt, staff, complimentary, sampling), the quantity and unit, and
  **why**. It is valued at average cost and posts to 5300. Waste above the
  business's threshold needs a manager.
- **✏️ Correct stock (manager):** a signed change (− to reduce), the cost per base
  unit for additions (blank = average), and **why**. It posts to 5400.
- **Stock on hand:** each item's quantity, unit, reorder level, average cost,
  value and status: **low**, or **negative** (shown, never hidden).
- **Movements:** the most recent entries in the stock ledger.

## 14. Stock Count

**Location:** Sidebar → **Stock Count** · `/count` · **Who:** counter (counts);
branch manager, general manager, owner (review and approve)

- **Counting.** **Start count** lists every item by name and unit. Enter what is
  on the shelf; each entry saves as you go. Then **Submit count**. The counter
  never sees the expected quantities.
- **Review.** Open a submitted count with **Review**: expected (the database's
  snapshot from when the count started), counted, variance and value. Then either
  **Approve and post variances** (to 5400, dated when submitted) or **Reject**,
  with a reason for the recount. The person who counted cannot approve.
- **Counts:** every count with when it started, who counted, how many items,
  its status, and who approved or rejected it.

More in [`guides/counting-guide.md`](guides/counting-guide.md).

## 15. Production

**Location:** Sidebar → **Production** · `/production` · **Who:** anyone who sees
costs

Batch history only. **Recording a batch is not built yet**, and the screen says
so. Meanwhile, give products a recipe of their ingredients so each sale takes
them from stock.

## 16. Journals

**Location:** Sidebar → **Journals** · `/journals` · **Who:** anyone who sees
costs; posting: accountant, general manager, owner

- **Journal Register:** every entry by journal number, newest first (1054,
  1053, 1052 …; drafts, which have no number yet, above them): date, number,
  reference, status, notes, amount and who posted it. Each shows its source (Sale, Refund,
  Reversal, Receipt, Bill, Payment, Expense, Stock, Count, Day close, Manual,
  Year end). **Manual and reversals** filters to the hand-made ones. Open a row
  to see its lines. Entries from the previous app are marked **before
  controls**.
- **New Journal:**
  - a date, an optional **Reverse on** date (for accruals), a reference and
    notes;
  - lines of account, description, debit and credit, with **+ Add line**.

  **Save and publish** only when debits equal credits; the number is given on
  publish. **Save as draft** parks it outside the books. A draft blocks the month
  from closing until it is published or discarded. Inventory, payables, goods
  received and retained earnings are not offered: they change only through their
  own records.

- **Correction to a control account (owner only).** Tick it on New Journal to
  post to one of those four accounts, with a reason on the audit trail. It exists
  to correct history from before these controls.
- **Reverse:**
  - offered on manual journals, expenses, corrections, year-end closes and
    entries from before the controls;
  - asks why, and for a date: not before the entry, not in the future, in an
    open month;
  - posts a mirror entry.

  A journal written by a sale, receipt, bill, payment, stock movement, count or
  day close is corrected through that record instead.

## 17. Chart of Accounts

**Location:** Sidebar → **Chart of Accounts** · `/accounting` · **Who:** anyone
who sees costs; locking: accountant, general manager, owner; reopening: owner

- **Months** across the top, 🔒 when locked. Choose one.
- **Trial Balance** for that month: each account's opening balance, debits,
  credits and closing balance, from published entries only, with the totals and
  **Download CSV**.
- **Closing the month:** the checklist, every item of which must pass:
  - earlier months locked;
  - no drafts;
  - every trading day closed;
  - no count awaiting approval;
  - stock, unpaid bills and goods received each agree with their account;
  - the month's journals balance.

  When they pass, **Lock** (with an optional note). Locking the last month of a
  year also posts the year-end close into 3100 Retained earnings. **Reopen** is
  the owner's alone, and needs a reason; reopen the most recent locked month
  first.

- **Audit Trail:** the latest privileged actions: who, when, what and why.

## 18. Reports

**Location:** Sidebar → **Reports** · `/reports` · **Who:** anyone who sees costs;
the P&L: owner, managers, accountant, auditor

Choose **From** and **To**, or **This month**, **Last month**, **This year**.

- **Do the books tie?** Each subledger against its control account, as at the
  **To** date, with **CSV**:
  - stock vs Inventory;
  - unpaid bills (and deliveries the previous app posted to payables) vs
    Accounts payable;
  - deliveries not yet billed vs Goods received not invoiced;
  - sales vs revenue.

  ✅ means they agree. Below it, **Stock the old app never journaled** lists any
  stock the previous app moved without a journal, each with the entry it would
  post. The owner reviews them and posts them in one step, with a reason (see
  [`REMEDIATION.md`](REMEDIATION.md)).

- **Profit & Loss:** income, cost of sales, gross profit, operating expenses and
  net, from published entries, with **CSV**.
- **Sales by Channel:** orders, net sales and gross profit per channel.
- **Payable Ageing:** each unpaid bill by vendor, due date and days late.
- **Product Margin by Channel:** price, cost and margin of every product on every
  channel.

## 19. Settings

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
- **Locations:** the branch and the central kitchen.
- **Roles & what they may do:** the exact permission list of each role.

---

## 20. Every feature, and where it is

| Feature                                                                                                                                               | Where                              | Who                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| Sign in, create a login, reset password                                                                                                               | `/login`                           | everyone                                                              |
| Change password, see your permissions                                                                                                                 | My account `/account`              | everyone                                                              |
| Language (EN / AR / CKB, right-to-left), light/dark                                                                                                   | top bar                            | everyone                                                              |
| Today at a glance, low stock, books reconcile                                                                                                         | `/dashboard`                       | owner, managers, accountant, auditor                                  |
| Sell by channel; cash, card, platform-paid                                                                                                            | `/pos`                             | cashier, barista, managers, owner                                     |
| Retry a sale without recording it twice                                                                                                               | `/pos`                             | the same                                                              |
| Void (same day) and refund                                                                                                                            | `/orders`                          | managers, owner                                                       |
| Daily summaries; close the day against the drawer                                                                                                     | `/sales`                           | cost viewers; closing: managers, owner                                |
| Platform orders; payout by journal                                                                                                                    | `/platforms`, `/journals`          | cost viewers                                                          |
| Vendor statements, bills, payments, cancel a bill, ageing                                                                                             | `/vendors`                         | cost viewers (by permission)                                          |
| Expenses with a proposed account                                                                                                                      | `/expenses`                        | managers, accountant, owner                                           |
| Suppliers; receive goods with landed cost                                                                                                             | `/purchasing`                      | purchasing, managers, owner                                           |
| Products, recipes by channel, prices from a date, margins                                                                                             | `/products`                        | cost viewers; editing: owner, general manager                         |
| Stock board, add items, waste, corrections, movements                                                                                                 | `/inventory`                       | cost viewers; waste: baristas too                                     |
| Blind count, second-person approval                                                                                                                   | `/count`                           | counter; reviewers                                                    |
| Journal register, manual journals, reversal                                                                                                           | `/journals`                        | cost viewers; posting: accountant, general manager, owner             |
| Owner's correction to a control account                                                                                                               | `/journals`                        | owner                                                                 |
| Trial balance, closing checklist, lock / reopen, audit trail                                                                                          | `/accounting`                      | cost viewers; lock: accountant, general manager, owner; reopen: owner |
| Reconciliation, P&L, channels, ageing, margins, CSV                                                                                                   | `/reports`                         | cost viewers                                                          |
| Post the stock the old app never journaled                                                                                                            | `/reports`                         | owner                                                                 |
| People and roles, business configuration                                                                                                              | `/settings`                        | owner, general manager                                                |
| **Not built:** settlement import (M-10), production batches (M-11), offline selling, partial refunds, till discounts, balance sheet, PDF, attachments | [`LIMITATIONS.md`](LIMITATIONS.md) | —                                                                     |
