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

The history recorded before this version is unverified. Follow
[`../REMEDIATION.md`](../REMEDIATION.md) to correct it, or start the books clean.
Until then, treat the reports as provisional.

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

## Every day

- **Dashboard:** today's revenue, gross profit, orders, stock value, low and
  negative stock, and whether the books reconcile.
- **Sales → Close the Day:** count the drawer, enter the opening float and the
  cash counted. Any difference posts to 6300 Cash over / short. Every trading day
  must be closed before its month can lock, and Sales lists every day still open,
  however old.
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
