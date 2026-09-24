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
before the upgrade. Enter your opening balances first: each stock item with its
opening quantity and cost, stock not yet paid for as a delivery and its bill,
and your cash as a journal (see the [deployment runbook](deployment.md), step
7). Then **Reports → Do the books tie?** shows ✅ on every line.

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

| Role              | Typically does                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Owner             | Everything, including reopening a locked month and control corrections                     |
| General manager   | Everything except reopening a locked month                                                 |
| Branch manager    | Sells, voids and refunds, closes the day, receives stock, reviews counts, records expenses |
| Cashier           | Sells                                                                                      |
| Barista           | Sells and records waste                                                                    |
| Inventory counter | Counts stock, blind                                                                        |
| Purchasing        | Adds suppliers, receives goods, records bills                                              |
| Accountant        | Expenses, journals, locking months, the reports                                            |
| Auditor           | Reads everything with a cost on it; changes nothing                                        |

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

## Every day

- **Dashboard:** today's revenue, gross profit, orders, stock value, low and
  negative stock, and whether the books reconcile.
- **Sales → Close the Day:** count the drawer, enter the opening float and the
  cash counted. Any difference posts to 6300 Cash over / short. Every trading day
  must be closed before its month can lock, and Sales lists every day still open,
  however old. A day with a bill still open on the till cannot be closed: take
  payment for it, or cancel it, first.
- **Orders:** a sale rung in error is **voided** the same day, before the close;
  after that, it is **refunded**.

## Every week

- **Purchasing:** receive deliveries as they arrive. Stock goes up, and the
  goods wait in 2050 Goods received not invoiced for their bill.
- **Vendors:** record each supplier's bill against its delivery, and pay bills
  from cash, card or bank. Watch **Payable ageing** on Reports.
- **Stock Count:** have a counter count, then review and approve it yourself (see
  the [counting guide](counting-guide.md)).
- **Reports → Product margin by channel:** what each product earns on each
  channel.

## Every month

1. Close every trading day, approve or reject any pending count, and publish or
   discard any draft journal.
2. **Reports → Do the books tie?**, as at the last day of the month: every line
   should show ✅.
3. **Chart of Accounts:** choose the month and read its checklist. When every
   check passes, **Lock** it. The last month of the year also closes the year
   into 3100 Retained earnings.
4. A locked month refuses every posting. Only you can reopen it, with a reason
   on the audit trail. Reopen the most recent locked month first.

## Correcting a mistake

| The mistake                                             | Correct it with                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A sale rung wrongly                                     | **Orders → Void** (same day) or **Refund**                                                                                     |
| A bill entered twice or wrongly                         | **Vendors → Cancel** (only if nothing was paid on it), then enter it correctly                                                 |
| Stock that is wrong                                     | a **count**, or **Inventory → Correct stock** (manager), with the reason                                                       |
| A manual journal or an expense                          | **Journals → Reverse**, dated in the month it corrects                                                                         |
| A control account (Inventory, payables, goods received) | your **Correction to a control account** on Journals — owner only, with a reason. Meant for history from before these controls |

## Golden rules

- Enter waste when it happens: it keeps stock and cost right.
- Ring each order on the right channel: the packaging depends on it.
- Replace the example prices and costs with your own before relying on margins.
- Give everyone their own login, and deactivate leavers the same day.
