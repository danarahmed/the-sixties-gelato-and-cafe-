# Owner's Guide

The system is your set of books. Every sale, delivery, bill, payment and count
writes its own entry, and the books check themselves. Your job is to keep people
and records honest, and to close each month.

## The ideas behind it

- **Stock counts itself.** Nobody types a stock level. Stock is the sum of
  everything received, sold, wasted and counted, down to a single lid.
- **Nothing is quietly changed.** A finished sale, a published journal and a bill
  are never edited. A mistake is corrected by a new entry, and both stay on the
  record.
- **The books prove themselves.** **Reports → Do the books tie?** compares stock,
  unpaid bills, goods awaiting their bill, and sales with their accounts. A month
  can be locked only when every check shows ✅.

## Before you rely on the books

Your books start empty: the trial records were cleared on 23 September 2026,
before the upgrade. Everything recorded since is a test too, and is cleared
once more when you say so, keeping the menu, the stock items, suppliers,
tables and people ([deployment runbook](deployment.md), "Clearing the test
records"). Then enter your opening balances before the first sale:

- **Inventory → Opening stock:** each item — what is on the shelf, what one
  unit cost, and where it came from (the opening count, say). It is capital you
  put into the business, so only you can record it, and it is on the audit
  trail. Until an item has it, its sales are costed at nothing.
- Stock not yet paid for: as a delivery and its bill (**Purchasing**,
  **Vendors**).
- **Sales → Move Cash:** the float you put in the till, and any cash in the
  safe, from the owner. Money already in the bank: a journal, Dr 1020 Bank,
  Cr 3000 Owner equity.

Then **Reports → Do the books tie?** shows ✅ on every line.

A database that keeps history from before this version must treat it as
unverified until it is corrected ([`../REMEDIATION.md`](../REMEDIATION.md)).

## People

**Settings → People**:

- **Add a person** by name and email and tick their roles. They create their own
  login with that email, and see only what their roles allow.
- **Change roles** or **Deactivate** someone the day they leave. A deactivated
  person keeps their login but can no longer see or do anything in the books.
- Only you can make someone an owner or general manager, and the business always
  keeps at least one active owner.

| Role              | Typically does                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Owner             | Everything, including reopening a locked month and control corrections                        |
| General manager   | Everything except reopening a locked month                                                    |
| Branch manager    | Sells, voids and refunds, counts the drawer, receives stock, reviews counts, records expenses |
| Cashier           | Sells                                                                                         |
| Barista           | Sells and records waste                                                                       |
| Inventory counter | Counts stock, blind                                                                           |
| Purchasing        | Adds suppliers, receives goods, records bills                                                 |
| Accountant        | Expenses, journals, locking months, the reports                                               |
| Auditor           | Reads everything with a cost on it; changes nothing                                           |

The exact matrix is under **Settings → Roles & what they may do**.

## Setting up the till

A café with a hundred products and twenty tables needs a till that finds things
fast. Set it up once, on **Products** and on the till itself:

- **Categories** (Products, at the top): name each one in English, Arabic and
  Kurdish, and number them in the order the till should show them. Untick **On
  the till** to hide a whole category, a seasonal menu say, without touching its
  products.
- **Each product** (Products): **Add photo** takes a picture from the phone or
  the computer. The browser shrinks it to a small file first, and only PNG, JPEG
  and WebP pictures are accepted, judged by their contents. Choose its
  **category**, tick **★ Favourite** for the ten or so things sold all day
  (they get a chip of their own), and untick **On the till** for anything not
  sold now. A hidden product keeps its recipe, prices and history, and comes
  back by ticking the box again.
- **A new product** (Products, **➕ Add menu product**): build its recipe
  first. The form costs it as you type, at today's stock costs and exactly as a
  sale will post it: each ingredient, then **Cost of one serving** (more for
  takeaway and delivery, where the cup and lid are used). Then choose the
  prices: each channel shows its cost and, as you type, the margin, in amber
  when under your target and red for a loss. **Use 4,000 IQD** takes the
  suggested price, the lowest in 250 IQD steps that leaves your target margin
  (70% unless you change it; as a rule of thumb, coffee drinks leave 75–80%
  and food 65–70%). Delivery
  platforms take their commission from the price, so price them higher. An
  ingredient never bought counts as 0: receive it first, or give it its
  opening stock on Inventory, for a true cost. A product with no ingredients
  (a service charge, say) needs a reason for using no stock; without a recipe
  or a reason it is not created, since every sale of it would show full
  profit.
- **Changing a price or a recipe** (Products, open **Recipe, prices and
  margin**): **Change a price…** starts today or on a later date, never an
  earlier one, so every sale keeps the price it was made at; each change is on
  the audit trail (**price.set**). A change for a later date is listed under
  **Scheduled** on the product, and can be withdrawn with a reason until it
  starts. A recipe changed today does not cancel one scheduled for later: each
  takes over on its own date. A new price reaches every till within ten
  minutes, or at once when its screen comes back to the front; a till that has
  not caught up yet is stopped at payment and fetches it then. A bill already
  printed is paid at the prices printed on it.
- **Costed at nothing:** a product flagged this way on Products has no recipe,
  or uses an ingredient with no cost yet, so its sales show full profit. Give
  it its recipe (or say why it uses no stock), or give the ingredient its cost.
  **Reports → Uncosted Sales** lists the sales it has affected; they keep the
  cost they were recorded with.
- **What you make** (Production): set up each thing made in batches once, with
  what one batch makes (roughly; weighing is optional) and what goes in. Make a
  base first and flavour it, or make each flavour from scratch: both work, since
  a batch may use anything in stock, bought or made. Then have whoever makes it
  record each batch on Production (baristas can; they see no costs). Switch the
  product to the made item with **Change the recipe…** on Products (a cup of
  pistachio gelato: 120 g of pistachio gelato, a cup, a spoon), so each sale
  takes the gelato out at what it cost to make.
- **Tables** (on the till: **🪑 Tables → Edit tables**, for owners, general
  managers and branch managers): add them one by one, or twenty at once
  ("Add 20 tables named Table starting at 1"). Give them an **area** (Inside,
  Garden) to group them, and a number to order them. A table with an open bill
  cannot be taken out of use.
- **Printers:** see the [cashier quick-start](cashier-quickstart.md#printing).
  Bills and receipts are laid out for an 80 mm receipt printer.

**How bills are controlled.** A table's bill is not a sale until it is paid,
and then it is recorded exactly like a sale at the counter. So a served drink
cannot quietly disappear from a bill:

- once the bill has been printed for the customer, **only a manager can take
  anything off it**, and each reduction is on the audit trail (**bill.reduce**);
  and it is paid at the prices printed on it, whatever the menu says by then;
- **cancelling a bill with anything on it needs a manager and a reason**
  (**bill.cancel**);
- splitting a bill needs no manager, because nothing leaves the table's bills;
  it is logged too (**bill.split**);
- **the day cannot be closed while a bill is still open.**

**Discounts.** A cashier can give a discount as a percentage or an amount.
The permission is "discount.apply": owners, managers and cashiers have it, and
a barista does not. If only managers should give discounts, the cashier role
can lose it; that is a change to the role matrix, not a setting on a screen. Every discount is on the audit trail (**sale.discount**), and once a
bill is printed only a manager can change its discount (**bill.discount**).
A percentage comes to the nearest **250 IQD** (shown on **Settings**), so the
till never asks a customer for a few odd dinars; an amount is taken as typed.
The step is a business setting: changing it (to 500 or 1,000, say) needs no
new version of the app, and each till follows it once it is refreshed.
In the books, revenue is recorded at the full price and the discounts in
**4100**, so the P&L shows how much was given away, and **Do the books tie?**
counts them.

**Reasons and approvals** (since `0028`). Every discount, void, refund and
cancelled bill takes a reason from a list; "Other" needs a few real words. A
discount over **10%** of the bill needs a manager's approval on the till: the
manager chooses their name and types their **PIN**, which each owner and
manager sets on **My account** (four to eight digits, not a run like 1234; the
database keeps only a hash). Owners and managers give larger discounts
themselves. A void or refund may be approved on **Orders** by a second person
the same way; one without goes on your review. Each sale keeps who gave its
discount, why and who approved it. The 10% is a business setting (shown on
**Settings**): to change it, ask for it to be changed in the database.

## Every day

- **Dashboard:** it opens on **what needs you** — 🔴 now, 🟠 soon. Each says
  what happened, why it matters, what to do (follow it to the screen where it
  is done) and how sure the rule is. When you have dealt with one, **Answer**
  it in a line (what was done, or why it is fine); if it can wait, **Snooze**
  it until a day, with a reason. Either way it stays, marked 🔵, until its
  condition clears, and then leaves by itself; one that turns from orange to
  red asks again. Many of one kind (say, twenty ingredients with no cost yet)
  fold into one row to open. 🟢 means nothing needs you. Below it,
  **yesterday's brief** — what happened, what follows from it, and what to do,
  kept apart — then today's revenue, gross profit, orders, stock value, low
  and negative stock, and whether the books reconcile.
- **Sales → Count the Drawer**, when the till closes — after midnight too: a
  count covers everything since the last one, whatever the date, so one
  night's count takes in both calendar days. Enter the cash counted and how
  much stays in the drawer for next time; the rest goes to the safe or the
  bank. Any difference posts to 6300 Cash over / short. Every bill kept open on
  the till must be paid or cancelled first. Sales shows every day whose cash
  is not yet counted, however old; a month cannot lock until each is.
- **Paying for something:** always say where the money came from — the till,
  the safe, the bank, a card (which the bank pays), or you personally. From
  the till it comes out of
  what the drawer should hold, and neither the till nor the safe can pay out
  more than the books say it holds. Put money into the till (a float), take
  takings to the safe, or bank them with **Sales → Move Cash**; only you can
  take money out for yourself.
- **Orders:** a sale rung in error is **voided** until the drawer holding its
  cash is counted; after that, it is **refunded**.
- **Reports → Exceptions:** every void, refund, discount, cancelled bill, item
  taken off a bill and wrong PIN, by person, with the reason and who approved
  it. Those marked **review** are yours to look at: a void or refund nobody
  else approved, or a wrong PIN. It downloads as CSV.
- **The alerts' thresholds** are yours (and the general manager's): on
  **Settings → Alerts**, the margin you aim for (70%), how long a count may
  stay open (8 hours), how many days card and platform money take to arrive
  (3 and 7), and the rest; an empty box follows its default, and every change
  is on the audit trail. On **Vendors → Edit vendor**, say how many days each
  supplier takes to deliver: running out warns that much sooner for what they
  supply.

## Every week

- **Purchasing:** receive deliveries as they arrive, each line at its price
  per unit as the invoice gives it. A price more than 25% above or below what
  the item costs now is asked about before anything is received ("2.5 or
  50?"): correct it, or confirm it, and the confirmation is on the audit trail.
  Stock goes up, and the goods wait in 2050 Goods received not invoiced for
  their bill. Each item's card on Inventory shows what every delivery cost.
- **Vendors:** record each supplier's bill against its delivery, typing the
  amount from the invoice (the screen shows what the delivery recorded; a
  difference posts to 5050), and pay bills from the till, the safe, the bank, a
  card or your own pocket. Watch **Payable ageing** on Reports. A bill without
  the supplier's own number takes the café's (SGC-2026-0001, -0002 …): each is
  given once, is never reused (not even after a cancellation), and cannot be
  typed in by hand, so it can never be mistaken for a supplier's invoice.
- **Card takings, when the bank pays them** (**Sales → Card Takings**): choose
  the last day the bank's payment covers — a day that is over; today's card
  takings wait for tomorrow — then type the terminal's total for those days,
  from its report, and what reached the bank. The difference between the two
  is the card company's fee (6500 Card and bank fees). When the till and the
  terminal differ — a sale rung as card and paid in cash, or the other way —
  say why in the note; it posts to 6300 Cash over / short. Days are settled in
  order; the latest settlement can be cancelled, with the reason, and settled
  again.
- **Delivery platforms, when a statement comes:** paste it on **Delivery
  Platforms → Match a Statement**, check what matched, what did not and which
  orders it left out, and post the payout (see the [Talabat guide](talabat.md)).
  The dashboard names the orders a platform has not paid after 7 days.
- **A new delivery platform:** add it on **Delivery Platforms → Your Delivery
  Platforms**, with its name in Arabic and Kurdish, and copy the packaging and
  prices of the channel it works like (usually Talabat). It is then a button on
  the till, with its own prices, order numbers and statements. Rename one, or
  take one out of use, on the same list (see
  [Adding a platform](talabat.md#adding-a-platform)).
- **Stock Count:** have a counter count, then review and approve it yourself (see
  the [counting guide](counting-guide.md)).
- **Audit trail:** read who changed what — prices, products, items, suppliers,
  settings — with each value before and after. Anything marked **No one signed
  in** was changed in the database itself: ask who did it, and why.
- **Reports → Product margin by channel:** what each product earns on each
  channel.

## Every month

1. Count the cash of every trading day, approve or reject any pending count,
   and publish or discard any draft journal.
2. **Reports → Do the books tie?**, as at the last day of the month: every line
   should show ✅.
3. **Chart of Accounts:** choose the month and read its checklist. When every
   check passes, **Lock** it. The last month of the year also closes the year
   into 3100 Retained earnings. A ⚠️ line (sales costed at nothing) is a
   warning, not a lock: those sales' profit is overstated, and **Reports →
   Uncosted Sales** lists them and what to fix.
4. A locked month refuses every posting. Only you can reopen it, with a reason
   on the audit trail. Reopen the most recent locked month first.

## Why is a number what it is?

Open it. Every figure on the Dashboard, every line of the P&L and of the trial
balance, and each side of **Do the books tie?** opens the records or the
journal lines behind it; an item on Inventory opens its **stock card** (what it
opened with, what came in and went out, and what is left); a day on Sales opens
its orders. Two profits are shown, each named for what it is: **gross profit
after waste & fees** (Dashboard, P&L) and the **sales margin** (price less the
recipe cost, on Sales by Channel, Sales and Orders). A refund counts on the day
it is made, so net sales are the same on every report. **Reports → every journal
line (CSV)** gives your accountant the whole ledger.

## Correcting a mistake

| The mistake                                                              | Correct it with                                                                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| A sale rung wrongly                                                      | **Orders → Void** (until the drawer is counted) or **Refund**                                                                    |
| A bill entered twice or wrongly                                          | **Vendors → Cancel** (only if nothing was paid on it), then enter it correctly                                                   |
| Stock that is wrong                                                      | a **count**, or **Inventory → Correct stock** (manager), with the reason                                                         |
| An item or a vendor named, typed or levelled wrongly                     | its card on **Inventory → Correct this item**, or **Vendors → Edit vendor**, with the reason; take one no longer used out of use |
| A manual journal or an expense                                           | **Journals → Reverse**, dated in the month it corrects                                                                           |
| A control account (the till's cash, Inventory, payables, goods received) | your **Correction to a control account** on Journals — owner only, with a reason. Meant for history from before these controls   |

## Golden rules

- Enter waste when it happens: it keeps stock and cost right.
- Ring each order on the right channel: the packaging depends on it.
- Replace the example prices and costs with your own before relying on margins.
- Give everyone their own login, and deactivate leavers the same day.
