# Talabat and Other Delivery Platforms

## Selling

On the till, choose the **Talabat** channel. The product is sold at its Talabat
price, with its delivery packaging taken from stock. The only way to complete it
is **Complete (paid through the platform)**: Talabat collects the customer's
money, so none of it goes in the drawer.

**Type the order number from the Talabat tablet** before confirming. Talabat's
payout is matched to the sale by this number, so the till will not record the
sale without it:

- letters and digits as the tablet shows them; the `#` before the number, and
  any spaces, can be left out;
- a number already recorded is refused, with the sale it belongs to ("Talabat
  order 7001 is already recorded, on the sale of 25 Sep 14:05"). Check the
  tablet: an order rung twice is not rung again.

The receipt prints the order number. The books record:

- Dr 1100 Platform receivable, Cr 4000 Sales: Talabat now owes you the order;
- Dr 5000 Cost of goods sold, Cr 1200 Inventory: the recipe and packaging used.

**Prices.** On **Products & Recipes**, set each product's Talabat price. A price
change takes effect from the date you give it.

## What Talabat owes

**Delivery Platforms → Owed by the Platforms** lists every order not yet paid
out, by its number, with the day it was sold and how many days it has waited.
It shows three totals:

- **Waiting to be paid out:** the orders' value;
- **1100 Platform receivable:** what the books say the platforms owe;
- **Not explained by any order:** the difference, normally 0. It is not 0 when
  1100 holds sales from before order numbers (before `0030`, 25 September 2026)
  or a payout was recorded by hand with a journal.

The dashboard raises an alert when orders have waited longer than Talabat takes
to pay (7 days; change it on **Settings → Alerts**, "Days a delivery platform
takes to pay"), and when 1100 holds money no order explains.

## When Talabat pays out: match its statement

1. Open Talabat's statement: the report listing each order and what Talabat paid
   for it.
2. Copy its rows, **with the row of column names**, from the spreadsheet or the
   report, and paste them into **Delivery Platforms → Match a Statement**.
   Choose **Talabat**.
3. Press **Match to the orders waiting**. Nothing is recorded yet. Each line
   says what it is:
   - **Matched**: the sale with that order number, what it sold for, and what
     Talabat paid, kept as commission and charged as fees. "Not explained" is
     the rest: what Talabat paid short;
   - **No sale has this order number**, **Already paid out** (by an earlier
     statement), **The sale was voided or refunded**, or **On the statement
     twice**: these lines are not posted.

   Below them: the orders the statement leaves out (sold between the ones it
   pays, still waiting), and the journal it would post.

4. The owner, general manager or accountant types the statement's number or
   date and the day the money arrived, adds a note when any line is not a clean
   match (what each one is), and presses **Post the payout**. The journal:

   | Account                  | Debit                                                  | Credit                    |
   | ------------------------ | ------------------------------------------------------ | ------------------------- |
   | 1020 Bank                | what Talabat paid for the matched orders               |                           |
   | 5100 Platform commission | Talabat's commission                                   |                           |
   | 5200 Platform fees       | delivery, payment and other fees, and any amount short |                           |
   | 1100 Platform receivable |                                                        | the matched orders' value |

5. Raise with Talabat every line that did not match and every order left out:
   they are kept with the statement, and the orders left out wait for the next
   one.

**How the paste is read.** The columns are found by their names: **Order**
("Order ID", "Order number"…), **Payout** ("Net payout", "Amount paid"…),
**Commission** and **Fees**. Without a row of names, the columns are read in
that order. Amounts are read as printed ("1,500", "IQD 2,550", "(900)"); a
commission or fee printed as a deduction (−450) is what Talabat kept (450); the
Total row is left out. When the statement gives neither commission nor fees,
everything Talabat kept is its commission.

**A statement posted by mistake.** Under **Statements Posted**, press
**Cancel…** on it, with the reason. Its journal is reversed and its orders wait
again; then post the right one. A statement's number is posted once.

## An order Talabat cancelled or refunded

Refund the sale on **Orders**, with the reason (or void it before the drawer is
counted). That reverses the revenue against 1100, so the order no longer waits.
If a statement still pays or charges it, its line says **The sale was voided or
refunded** and is not posted: raise it with Talabat. Used packaging does not
come back into stock; only items marked returnable do.

## A payout for sales from before order numbers

Sales recorded before order numbers have none, so no statement can match them.
Record their payout with a journal on **Journals → New Journal**, as before:
Dr 1020 the amount that arrived, Dr 5100 the commission, Dr 5200 the fees, Cr
1100 the value of the orders it settles, dated the day the money arrived, with
the statement number in **Reference #**. The "Not explained by any order" figure
comes back to 0 once 1100 holds only the orders waiting.

## Not built yet

- **Reading the statement file itself**, and **Talabat's live feed**. The feed
  needs an approved Talabat partner account and credentials, arranged through
  Talabat. No endpoint or credential is invented here.
- **Careem and Toters at the till.** The books, the order numbers and the
  statement matching already know them as platforms; the till offers Talabat
  only.
