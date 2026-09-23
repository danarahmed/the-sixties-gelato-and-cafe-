# Talabat and Other Delivery Platforms

## What works today

**Selling.** On the till, choose the **Talabat** channel. The product is sold at
its Talabat price, with its delivery packaging taken from stock. The only way to
complete it is **Complete (paid through the platform)**: Talabat collects the
customer's money, so none of it goes in the drawer. The books record:

- Dr 1100 Platform receivable, Cr 4000 Sales: Talabat now owes you the order;
- Dr 5000 Cost of goods sold, Cr 1200 Inventory: the recipe and packaging used.

**Seeing it.** **Delivery Platforms** lists the platform orders and their value
before commission. **Chart of Accounts** shows 1100 Platform receivable: what the
platforms owe and have not yet paid.

**Prices.** On **Products & Recipes**, set each product's Talabat price. A price
change takes effect from the date you give it.

## When Talabat pays out

Settlement import is not built yet (see below), so record each payout with a
journal on **Journals → New Journal**, from Talabat's statement:

| Account                  | Debit                            | Credit                                   |
| ------------------------ | -------------------------------- | ---------------------------------------- |
| 1020 Bank                | the amount that arrived          |                                          |
| 5100 Platform commission | Talabat's commission             |                                          |
| 5200 Platform fees       | delivery, payment and other fees |                                          |
| 1100 Platform receivable |                                  | the total value of the orders it settles |

- Date it the day the money arrived, and put the statement number in
  **Reference #**.
- The journal publishes only when debits equal credits.
- Afterwards, 1100 should equal the orders Talabat has not yet paid for. If it
  does not, an order is missing from the statement or was charged wrongly.
  Raise it with Talabat.

## An order Talabat cancelled or refunded

Refund the sale on **Orders**, with the reason. That reverses the revenue
against 1100, so Talabat is no longer shown as owing it. Used packaging does not
come back into stock; only items marked returnable do.

## Not built yet

- **Statement import and automatic matching** (audit M-10). The matching logic is
  written and tested (`src/domain/platform/settlement.ts`, acceptance scenarios 4
  and 12): expected against reported payout, wrong commission, missing payouts,
  duplicate lines. It still needs its import screen and posting. It is next on
  the [roadmap](../ROADMAP.md).
- **Careem and Toters at the till.** The books and reports already know them as
  platform channels; the till offers Talabat only.
- **Talabat's live API.** It needs an approved Talabat partner account and
  credentials, arranged through Talabat. No endpoint or credential is invented
  here.
