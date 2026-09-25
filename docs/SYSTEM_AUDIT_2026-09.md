# System Audit — September 2026

The Sixty's Gelato & Café operating system, as it runs on **25 September 2026**.

**How this was done.** Read-only. The review read the 23 database migrations, which
hold the functions that post every sale, receipt, count and journal, together with
every screen and the test suites. It also queried the live database on 25 September.
Four area reviews ran in parallel: sales and cash, stock and purchasing, recipes and
production, and books, reports and permissions. Every finding below was checked against
the code before it was included. Nothing in the app or the database was changed.
Evidence is given as `file:line`; migrations are cited by number, for example
`0015:1218` means `supabase/migrations/0015_posting_functions.sql`, line 1218.

## The short version

- **Keep the foundation.** The database is the only thing that writes to the books.
  - Every sale, delivery, bill, payment, waste entry, count and batch is **one checked
    transaction**.
  - Stock is never typed in, and published records never change.
  - The books check themselves: _"Do the books tie?"_ runs four checks, and a month cannot
    lock until they pass.
  - Roles are enforced by the database, not the screens.

  This is the most valuable part of the system. Everything recommended here builds on it.

- **Four problems can make the numbers wrong in normal daily use (P0).** Three of them
  already have, in the live books:
  1. **A stock count posts stock that moved while the count was open.** The count left
     open since 24 Sep would post about **177,000 IQD** of stock that does not exist if it
     were finished today.
  2. **Closing a day does not stop sales into it.** 24 Sep was closed at 01:37, then
     **7 cash sales worth 58,000 IQD** were recorded into that same day. No drawer count
     covers them.
  3. **Cash paid out is not part of the drawer calculation.** There is one "cash" account
     for the till, the safe and the owner's pocket. Live cash on hand is **−220,000 IQD**.
  4. **A sale can be recorded twice** if the database's answer is lost on its way back to
     the till. Rare, but it breaks the "recorded exactly once" guarantee.
- **The next gap is visibility, not features.** The system records well but tells the owner
  little:
  - no alerts and no daily brief;
  - no way to open a number and see the transactions behind it;
  - an audit trail that is hard to read;
  - reports that disagree with each other.
- **Recommended order:**
  1. Fix the four P0s, as one change.
  2. Make every number traceable and trustworthy (P1).
  3. Add alerts and the owner's daily brief (P1).
  4. Only then add new capabilities (P2).
- **Decisions only you can make about the live books** are in [Appendix A](#appendix-a--the-live-books-today-decisions-for-the-owner).

---

## 1. The existing system

### 1.1 Modules

✅ built and working · 🟡 partly built · ⬜ not built

| Module                    |              | What exists                                                                                                                                                              | What is missing                                                                                                                                   |
| ------------------------- | :----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Till (POS)                |      ✅      | Quick sales; tables; bills paid later (print, split, move, cancel); discounts; cash, card and platform-paid; 80 mm printing; search in 3 languages; exactly-once payment | Add-ons (extra scoop, oat milk); split tender; one key per cart (P0-4)                                                                            |
| Orders                    |      ✅      | Every sale; void on a day not yet closed; refund afterwards; reasons required                                                                                            | Partial refunds; search; anything older than the last 300 sales                                                                                   |
| Day close (cash)          |      🟡      | One close per day and location; the difference goes to 6300 Cash over/short; open bills block the close                                                                  | Paid-outs, blind count, a float recorded when the day opens, per-cashier sessions, reopening a day, refusing sales into a closed day (P0-2, P0-3) |
| Products, prices, menu    |      ✅      | Dated prices per channel; categories, photos, favourites; recipe costed as it is typed; suggested price                                                                  | Sizes (one variant per product), add-ons, price and recipe history on screen, audit of who changed a price                                        |
| Recipes                   |      ✅      | Dated versions; packaging lines by channel; costs frozen at sale                                                                                                         | Waste/yield factor; scheduled versions shown; a precedence bug (P1-5)                                                                             |
| Production                |      ✅      | Batch recipes both ways (a base then flavours, or from scratch); batches valued at exact cost; cancel with a reason                                                      | Use-by dates, make list, recording yesterday's batch, reconciliation (made vs sold vs wasted)                                                     |
| Inventory                 |      ✅      | Stock ledger; waste; manager corrections; stock board; last 60 movements                                                                                                 | Item and supplier editing, pack units in the app, stock card, reorder list                                                                        |
| Stock counts              |      🟡      | Blind, two-person, expected quantity snapshotted by the database                                                                                                         | Correct variance while trading (P0-1); cycle counts in the app; cancelling a count                                                                |
| Purchasing & suppliers    |      ✅      | Receive goods with landed costs; bills clear GRNI (goods received not invoiced); payments; duplicate invoices refused; bill numbers                                      | Purchase orders (table unused), supplier returns, credit notes, reversing a receipt, price history                                                |
| Expenses                  |      ✅      | Account suggested from the description; posted in one step                                                                                                               | Prepaid expenses; duplicate warning; location; "paid by the owner personally"                                                                     |
| Accounting                |      ✅      | Draft → publish journals; gapless numbers; period lock with a checklist; year end; reversals; owner's control correction                                                 | Balance sheet, cash-flow statement, chart-of-accounts screen                                                                                      |
| Reconciliation            |      🟡      | Four checks: stock vs 1200, bills vs 2000, unbilled receipts vs 2050, sales vs revenue                                                                                   | Cash (1000), card (1010), bank (1020), platform (1100)                                                                                            |
| Reports                   |      🟡      | P&L, trial balance, daily sales, sales by channel, payable ageing, product margin, CSV                                                                                   | Waste, variance, price history, exceptions by person, product mix, sales by hour; drill-down; report bugs (P1-2)                                  |
| Dashboard                 |      🟡      | Today: net sales, gross profit, orders, average order, stock value, low-stock count; recent sales; reconciliation badge                                                  | Comparisons, alerts, drill-down, yesterday                                                                                                        |
| Delivery platforms        |      🟡      | Platform sales post to 1100 at the platform price                                                                                                                        | Platform order number, settlement matching (audit M-10)                                                                                           |
| People & roles            |      ✅      | 9 roles, enforced by the database; invite, roles, deactivate                                                                                                             | Location-scoped roles; manager PIN on the till                                                                                                    |
| Settings                  |      🟡      | Shown read-only                                                                                                                                                          | Editing business rules (currently only by SQL)                                                                                                    |
| Audit trail               |      🟡      | About 20 kinds of action recorded                                                                                                                                        | Prices, products, items, opening stock, settings, day close; a usable viewer                                                                      |
| Multi-location            |      🟡      | Locations exist (branch + central kitchen); average cost per location                                                                                                    | The app always uses the first branch; journals have no location; no transfers                                                                     |
| Alerts & notifications    |      ⬜      | —                                                                                                                                                                        | Everything                                                                                                                                        |
| Customers & loyalty       |      ⬜      | A name on a bill                                                                                                                                                         | Everything (low value today)                                                                                                                      |
| Staff, attendance, labour |      ⬜      | Logins and roles only; salaries are expenses                                                                                                                             | Everything (low value today)                                                                                                                      |
| Offline selling           | ⬜ by design | The till says it is offline and refuses; a lost confirmation is retried exactly once                                                                                     | A queue (deliberately not built)                                                                                                                  |
| AI                        | ⬜ by design | None: expense suggestions are fixed rules                                                                                                                                | —                                                                                                                                                 |

### 1.2 Who does what

| Role            | Starts on | Can                                                                                                                | Cannot                                                            |
| --------------- | --------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Owner           | Dashboard | Everything, including reopening a locked month and control-account corrections                                     | —                                                                 |
| General manager | Dashboard | Everything except reopening a month                                                                                | Reopen a month                                                    |
| Branch manager  | Dashboard | Sell, void, refund, discount; see costs; approve counts and waste; production; purchasing; expenses; close the day | Edit recipes or prices; post journals; lock months; manage people |
| Cashier         | Till      | Sell; give discounts                                                                                               | See any cost; void; refund                                        |
| Barista         | Till      | Sell; record waste; record batches                                                                                 | See any cost                                                      |
| Counter         | Count     | Count stock (blind)                                                                                                | See what the ledger expects                                       |
| Purchasing      | Reports   | Suppliers; receive goods; see costs                                                                                | Pay bills                                                         |
| Accountant      | Dashboard | Costs and profit; expenses; journals; lock months                                                                  | Close a day; reopen a month                                       |
| Auditor         | Dashboard | See everything, including the audit trail                                                                          | Change anything                                                   |

The live business has 7 people, one per role. The cashier has not yet created their login.

### 1.3 How the data connects

```
Supplier ─► Goods receipt ─► stock movement (+) ─────────────┐        Bill ─► clears 2050 GRNI ─► 2000 Payables ─► Payment (1000 / 1010 / 1020)
                                                             ▼
Opening stock, correction, count ─► STOCK LEDGER (append-only, per item and location) ═══ reconciled daily ═══ 1200 Inventory
                                                             │
          Item cost = moving average at the location ◄───────┤
                                                             │
Batch recipe ─► Production batch: ingredients out (−), made item in (+), same value, no journal
                                                             │
Product ─► variant ─► dated price per channel                │
        └► dated recipe version ─► lines (item, quantity, channels) ─┐
                                                                     ▼
Till: quick sale, or a bill paid later ─► SALE (one transaction): lines, one tender, stock out at average cost (cost frozen), journal
          ├─► Void (day not yet closed): exact reversal       └─► Refund (whole sale): 4200, stock back only if returnable
Waste ─► 5300 · Count variance ─► 5400 · Stock correction ─► 5400 · Day close difference ─► 6300 · Expense ─► 6xxx
All published journals ─► Trial balance · P&L · Dashboard  ◄── "Do the books tie?" (4 checks) ◄── period lock checklist
```

### 1.4 Where each important number comes from

| Number                                  | Source of truth                     | Exact formula                                                                                                                                | Can you open it to see why?                  |
| --------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Net sales (Dashboard, P&L)              | Published journal lines             | 4000 Sales − 4100 Discounts − 4200 Refunds, by journal date in Baghdad time (`0017:200-218`, `0017:53-74`)                                   | No                                           |
| Orders, average order                   | Sales records                       | Sales placed that day that are not voided (refunded included). Average = ledger revenue ÷ orders (`0017:210-214`)                            | No                                           |
| Cost of goods sold                      | Frozen at the moment of sale        | For each ingredient: average cost at the location × quantity, rounded to the dinar per item. Posted to 5000 (`0019:163-198`)                 | Per sale, on Orders (last 300)               |
| Gross profit (Dashboard, P&L)           | Journal lines                       | Net sales − **every 5xxx account**: cost of goods, purchase price variance, platform commission and fees, waste, count variance (`0017:206`) | P&L lists each account; no drill to journals |
| Gross profit (Sales by channel, Orders) | Sales records                       | Net of each sale − its frozen cost. **Refunded sales are not subtracted** (P1-2)                                                             | No                                           |
| Stock on hand                           | Stock ledger                        | Sum of all movements for the item at the location                                                                                            | Only the last 60 movements, all items mixed  |
| Stock value                             | Stock ledger = 1200                 | Sum of movement values. Checked against 1200 by "Do the books tie?"                                                                          | Totals only                                  |
| Item cost                               | Stock ledger                        | Value ÷ quantity at the location. If none, the last incoming cost of **any** kind anywhere. If none, **0** (`0015:188-201`)                  | No history screen                            |
| Menu cost and margin                    | Today's recipe × today's item costs | Per channel. Margin = price − serving cost, **before platform commission** (`0017:224-255`)                                                  | The product card lists each line             |
| Cash the drawer should hold             | Sales and refunds of the day        | **Float typed at the close** + cash sales − cash refunds (`0018:576-577`). Paid-outs are not included (P0-3)                                 | The close form                               |
| Payables                                | Bills − payments = 2000             | Checked against 2000                                                                                                                         | Vendor statements                            |
| Low stock                               | Stock board                         | On hand < minimum level, **only for items that have moved** (`0014:708-727`)                                                                 | The dashboard list                           |

---

## 2. What is already strong — keep it as it is

These work correctly and are tested. None of the recommendations replaces them.

1. **One transaction per business event.** Each sale, receipt, bill, payment, waste
   entry, correction, count approval, batch and journal is a single database function. It
   checks the person's permission, validates the input, writes the record, its stock
   movements and its journal, and commits them all together or nothing (ADR 0002).
2. **Records that cannot be edited.** Stock movements, published journals, finished
   sales, their lines and tenders, and the audit log refuse any edit or delete. A bill is
   cancelled, never deleted. Mistakes are corrected with new entries, and both stay on the
   record.
3. **Stock is never typed in.** It is the sum of the movement ledger, and its value is
   reconciled to account 1200 every day.
4. **The books check themselves.** "Do the books tie?" compares four subledgers with their
   control accounts. A month locks only if they agree, every day is closed, no draft
   journal is left and no count is waiting.
5. **Exactly-once payment on the till.** Each payment carries a key made on the till. A
   bill can be paid only once. Two tills cannot overwrite each other's changes to a bill.
   All three are tested with real parallel connections. (P0-4 closes the one gap.)
6. **Prices come from the server.** The till cannot override a price. The channel and the
   tender must agree. A discount is posted as full price to 4000 and the discount to 4100,
   shared exactly across the lines.
7. **Cost is frozen at the moment of sale.** A later cost or recipe change never rewrites
   past profit.
8. **Dated prices and recipes.** Packaging lines apply only on the channels that need
   them, so one recipe serves dine-in, takeaway and delivery.
9. **Blind, two-person counts.** The counter never receives the expected quantity, and a
   different person approves.
10. **Least privilege, enforced by the database.** Cashiers and baristas never see a cost.
    The role matrix in the code and in the database are kept identical by a test.
11. **Exact decimal arithmetic, and the business's own timezone** for days and months.
12. **Honest offline behaviour.** There is no queue that could lose or duplicate sales.
13. **Production keeps value inside Inventory.** Batches are valued at exact cost, both
    ways of making things are supported, and costs are hidden from baristas.
14. **Tests.** About 450 database assertions on PostgreSQL 16 and 17, 150 unit tests,
    7 browser suites covering every role, and rehearsals of every upgrade.

---

## 3. Data risks

Each risk: what goes wrong, the evidence, why it matters, and the action that fixes it.
The actions are listed in the [action matrix](#action-matrix).

### 3.1 A stock count posts, a second time, stock that moved while it was open — **P0-1**

- **What goes wrong.** Opening a count saves what the ledger expects
  (`start_stock_count`, `0015:1135-1152`). The counter may count hours or days later: the
  counting guide says "you can stop and come back". Approval posts _counted − the expected
  quantity saved when the count opened_ (`0015:1218`).
  - Anything sold, received, wasted or made in between is counted a second time.
  - Two counts open at the same time post the same difference twice.
- **Live evidence.** A count opened on 24 Sep at 14:55 is still open, with 0 of 9 items
  counted. Stock has moved 37 times since. A perfectly accurate count finished today would
  post false gains:
  - coffee beans +4,390 g (141,251 IQD);
  - milk +8,740 ml;
  - sugar +4,915 g;
  - cup lids +999.

  The total is about **+177,000 IQD** of stock that does not exist, credited to 5400 as a
  "gain".

- **Why it matters.** Counts are how the books learn the truth. Today, counting while the
  café trades makes stock and profit wrong. It also hides real shortages behind false ones.
- **Do not approve that count until P0-1 is fixed.** After the fix it can be finished
  safely.

### 3.2 Sales and refunds go into a day that is already closed — **P0-2**

- **What goes wrong.** The close accepts today's date at any hour
  (`0018:563`), and the Sales page always offers today (`src/app/sales/page.tsx:37-40`).
  Once a day is closed:
  - `post_sale`, `settle_tab` and `refund_sale` never check it (`0019:49-209`), so sales
    and refunds are still recorded into that day;
  - the day no longer appears as unclosed;
  - it cannot be reopened.
- **Live evidence.** 24 Sep was closed at **01:37** that morning: float 25,000, expected
  62,000, counted 61,500. From 01:39 to 12:56, **7 cash sales totalling 58,000 IQD** were
  recorded into 24 Sep. That cash is in the books but in no drawer count, and nothing
  shows it.
- **Why it matters.** A day close is the only cash control. Cash taken after an early
  close can go missing with no variance anywhere.

### 3.3 Cash paid out is not part of the drawer calculation — **P0-3**

- **What goes wrong.**
  - Expenses and supplier bills "paid from cash" credit **1000**, the same account the till
    uses (`payment_account`, `0015:808-812`). The expense form defaults to cash.
  - The close expects only _float + cash sales − cash refunds_ (`0018:577`).
  - There is no paid-out, no drop to the safe, and no "paid by the owner personally".
  - Nothing checks whether the cash is there.
- **Two ways it goes wrong.**
  - **The money came out of the drawer.** The close then shows a false shortage and posts it
    to 6300. The cost is counted twice: once as the expense, once as cash short.
  - **The money came from somewhere else.** Account 1000 then no longer describes any real
    cash.
- **Live evidence.** Cash on hand is **−220,000 IQD**:
  - 250,000 of opening cash in the till;
  - 465,000 paid out "from cash": three expenses of 150,000, one supplier payment of
    15,000, and a manual journal of 150,000 described "xxxxxxxxxx";
  - plus cash sales, and the −500 close difference.

  315,000 of those payments were recorded before the 24 Sep close. Yet that close found
  the drawer only 500 short of the 62,000 expected, so the money cannot have come out of the
  drawer. The books also say the till opened with **250,000** (journal 1010), while the
  close was given a float of **25,000**.

- **Why it matters.** Cash is where losses happen. Today neither the drawer figure nor the
  cash balance can be trusted.

### 3.4 A sale can be recorded twice after a lost answer — **P0-4**

- **What goes wrong.** A failure between the app server and the database is returned by
  the database library as an ordinary error, not thrown (`@supabase/postgrest-js`).
  - `callRpc` therefore reports it as a refusal (`src/lib/db/rpc.ts`, `callRpc`), and the
    till clears its frozen order (`src/components/pos/PosClient.tsx:717-724`).
  - If the sale had in fact been saved and the cashier reopens payment, a **new key** is
    made (`PosClient.tsx:658`), and the sale is recorded again.
- **Why it matters.** "Recorded exactly once" (audit finding H-01) is a promise the whole
  till relies on. The fix is small.

### 3.5 A scheduled recipe change can be hidden forever — **P1-5**

- **What goes wrong.** The recipe in force is the highest version number among versions
  that cover the date (`recipe_version_on`, `0015:261-267`). A new version only closes
  versions that started **before** it (`0023:73-74`).
- **Example.**
  1. On 20 Sep you schedule a new latte recipe from 1 Oct.
  2. On 25 Sep you change today's recipe.
  3. From 1 Oct, both versions are in force and the 25 Sep one wins, forever. Nothing on
     screen shows the scheduled one.
- **Why it matters.** Wrong stock deductions and wrong costs, silently.

### 3.6 Uncosted ingredients and products with no recipe sell at zero cost, unflagged — **P1-6**

- **What goes wrong.**
  - An item never bought or made costs **0** (`0015:200`), even though the comment above it
    says "never to zero".
  - A product can be saved with no recipe (`src/lib/actions/menu.ts:28-35`) and then takes
    nothing from stock.
  - Only the product form warns. Nothing warns at sale time, on the product card (which
    shows a green margin), in reports, or in the month-end checklist.
- **Why it matters.** Profit is overstated. When the item is later received, its cost lands
  in a later month. A batch made from it is worth 0, and so is every product that uses it.
- **Live today:** every item has a cost. Items added through the app without opening stock
  will not.

### 3.7 A printed bill is re-priced when it is paid — **P1-7**

- **What goes wrong.** Bill lines carry no price (`0018:69-79`). Payment prices them again
  at the price on the payment date (`0019:381-386`, via `price_on`).
- **Example.** A bill is printed at 4,000 for an Iced Latte on 24 Sep at 23:50. The live
  price rises to 4,500 from 25 Sep. The bill is paid at 00:10: the customer pays the
  printed 4,000, the books record 4,500, and the drawer is 500 short.
- **Also.** The quick-sale menu is loaded once when the till opens
  (`src/app/pos/page.tsx:14`) and never refreshed. A till left open across a price change
  shows old prices while the database records new ones.

### 3.8 A mistyped purchase price goes straight into costs — **P1-3**

- **What goes wrong.** A receipt checks only quantity > 0 and value ≥ 0 (`0015:658-659`).
  - The form takes a line total, not a unit price, and a blank value becomes 0
    (`src/components/ReceiveStockForm.tsx:138`).
  - The bill is pre-filled with the receipt's value (`VendorsClient.tsx:283`), so a typo
    carries through.
  - Any difference goes to 5050 while the item keeps the wrong average.
  - There is no price history.
- **Live evidence.**
  - Cup lids: opening stock at **50 IQD each**, then a purchase of 1,000 at **2.5 each**
    (−95%). One of the two is wrong.
  - Coffee beans: received at between **25 and 65 IQD per gram**.
  - Nothing questioned either.

### 3.9 Duplicate items, suppliers and products are allowed — **P1-4**

- **What goes wrong.** There is no unique name on item, supplier or product. Only
  categories and newly made items are checked (live database indexes).
  - The duplicate-invoice check is per supplier (`0021:101-104`). So "Dairy Co" and
    "Dairy Co." can each be billed and paid for the same invoice.
  - Two "Milk" items split stock: one goes negative and the other never moves. The old
    trial data had exactly this.

### 3.10 Reports that disagree with each other — **P1-2**

- **Sales by channel adds refunded sales into net sales.** `report_daily_sales` includes
  refunded sales (`0017:136`), and the page never subtracts them
  (`src/app/reports/page.tsx:44-52`). Live: takeaway shows 49,000 instead of 44,500.
- **"Gross profit" means three things.**
  - Dashboard and P&L: after waste, count variance, price variance and platform fees.
  - Sales by channel and Orders: sale price − frozen cost only.
  - CALCULATIONS.md: net − cost of goods.

  None of the labels says which.

- **Reviewing an approved count values it at today's cost,** not the value that was posted
  (`0015:1191-1192`).
- **A reversed expense still shows as live** on the Expenses register and in its totals
  (`src/lib/db/books.ts`, `getExpenses`).
- **The dashboard does not exclude the year-end close** on the day it posts, although the
  P&L does (`0017:209` vs `0017:69`).

### 3.11 Changes to prices, products, items, opening stock and settings leave no trace of who — **P1-1**

- **Not recorded anywhere:**
  - `set_price`, and the price table has no creator column (`0015:1090-1100`);
  - creating, renaming or hiding a product;
  - creating an item, **including its opening stock** (Dr 1200 / Cr 3000, no reason,
    `0015:1005-1046`);
  - creating a supplier;
  - changing a batch recipe;
  - every business setting, which is changed by SQL;
  - the older `new_recipe_version` path, still callable, which bypasses the audited
    "Change the recipe".
- **Hard to read even when recorded.** The audit trail screen shows only the latest 40 rows,
  without before/after values (`src/app/accounting/page.tsx:47`).
- **Renaming a product relabels every past sale,** because sales show the current name.
- **Live evidence.** Three price changes have been made, including bottled water dine-in
  **500 → 5,000**. There is no record of who made them.

### 3.12 Smaller risks

| Risk                                                                                                                                                                              | Evidence                       | Action |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------ |
| The fallback cost is the last incoming cost of _any_ kind: a typed correction, a void, a count gain, another location. A receipt that covers negative stock distorts the average. | `0015:196-199`                 | P2-19  |
| Receipts are always dated when entered. A bill dated before its receipt stops the month from locking.                                                                             | `0015:633-690`, `0021:146-148` | P2-11  |
| Receipts, expenses, waste, corrections, payments and batches have no retry protection; a lost answer plus a retry records them twice.                                             | `rpc.ts`; no key               | P2-12  |
| A sale can be voided the day after (if that day is still open); the reversal is dated the day of the void, so "Do the books tie?" as at the sale's day shows a difference.        | `0015:516-528`                 | P2-13  |
| "Prevent negative stock" is checked only on sales, never on waste, corrections or production. It cannot be turned on in the app.                                                  | `0019:118-130`                 | P2-8   |
| Waste worth 0 IQD fails with a database error. A sale with a 100% discount and nothing returnable cannot be refunded. Both produce an empty journal, which the database refuses.  | `0015:941-944`, `0015:577-582` | P2-19  |
| An unused "sub-recipe" path would treat "120 g" as 120 batches if it were ever switched on.                                                                                       | `0015:293-294`                 | P2-19  |

---

## 4. Workflow problems

Where people do unnecessary work, or cannot finish a job in the app:

- **Items and suppliers cannot be edited after they are created.**
  - A wrong name, minimum level or type can be fixed only in SQL.
  - Pack units (a carton of 24, a sleeve of 50) cannot be added in the app: the Add-item
    form sends none (`src/lib/actions/stock.ts:54`). The live items have pack units only
    because they were loaded by SQL.
  - Retired items stay on every count.
- **Business rules can be changed only in SQL.** This covers negative stock, the waste
  threshold, the rounding step and the target margin. Settings are shown read-only.
- **A closed day cannot be reopened.** A typing error at the close (1,500,000 for 150,000)
  is permanent.
- **Partial refunds.** The documented workaround (refund all, re-ring what was kept)
  deducts the kept items' ingredients a second time.
- **Purchasing.**
  - One bill per delivery.
  - No credit notes or supplier returns.
  - A delivery entered under the wrong supplier or item can never be reversed.
  - Receiving takes line totals instead of unit prices, with no date and no invoice-number
    field.
- **Counting.**
  - Full counts only; cycle counts exist in the database but not the app.
  - Base units only: 12,000 ml, not "12 L".
  - A count cannot be cancelled, and a rejected count means counting everything again.
- **Waste.** One item per entry; no end-of-day sheet.
- **Finding things.**
  - Orders: last 300 only, no search.
  - Journals: last 200, no filter by account or date.
  - Audit trail: last 40.
  - Products: no search.
- **Products.**
  - One size per product.
  - No add-ons: "extra scoop" typed as a note has no price and takes no stock.
  - Careem and Toters cannot be priced.
  - A hidden product cannot be set up before it goes on the till.
- **Production.**
  - Yesterday's forgotten batch cannot be recorded for yesterday.
  - Baristas record batches without seeing whether the ingredients are in stock.
- **Manager approvals on the till** need the manager to sign in instead of the cashier.
- **Staff screens are in English only:** Stock Count, Production and waste. The till is in
  all three languages.

---

## 5. Automation opportunities, ranked by safety and value

**Already automated, and correct:**

- a sale takes its stock out, freezes its cost and posts its journal;
- menu costs and margins are recalculated as costs move;
- the books reconcile themselves;
- the café's bill numbers are given automatically;
- discounts round themselves;
- batches value what they make.

| Rank | Opportunity                                                                                                                                                                                                                                                                              | Level | Why it is safe                    | Value                               | Data ready?                                                 |
| ---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---: | --------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
|    1 | **Alert detection** ([§7](#7-alert-gaps))                                                                                                                                                                                                                                                |   1   | Reads only                        | High: exceptions surface themselves | Yes for ledger facts; demand needs history                  |
|    2 | **Owner's daily brief** ([§6](#6-reporting-gaps))                                                                                                                                                                                                                                        |   1   | Reads only                        | High                                | Yes                                                         |
|    3 | **Stock card and drill-down** from every number                                                                                                                                                                                                                                          |   1   | Reads only                        | High: every number explained        | Yes (every movement is typed and referenced)                |
|    4 | **Plausibility checks when entering**, which warn and ask for confirmation but never change anything: purchase price more than 25% off the average; batch output outside 70–130% of plan; a price more than 3 times its other channels; a large correction; a possible duplicate expense |   1   | The person still decides          | High: stops typos at the door       | Yes                                                         |
|    5 | **Reorder list**: par − on hand, adjusted by days of cover                                                                                                                                                                                                                               |   2   | Suggests; a person orders         | Medium-high                         | Min levels yes; par and usage need entry or history         |
|    6 | **Production make-list** per flavour, from par levels                                                                                                                                                                                                                                    |   2   | Suggests                          | Medium-high                         | Needs par levels (not settable today)                       |
|    7 | **Card and Talabat settlement matching**: proposes the payout journal                                                                                                                                                                                                                    |   2   | A person posts it                 | Medium-high                         | Needs platform order numbers (P1-9)                         |
|    8 | **Demand forecast** for gelato and purchases                                                                                                                                                                                                                                             |   2   | Suggests, with a confidence level | Medium                              | **Insufficient data** until about 4–6 weeks of real trading |

**Never automatic (level 3, a person decides):**

- reopening a day or a month;
- control-account corrections;
- approving counts;
- voids and refunds;
- large corrections;
- price changes;
- merging duplicates;
- clearing test data.

---

## 6. Reporting gaps

| The owner's question                                               | Today                                              | Missing                                                                                          | Action     |
| ------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- |
| How did we do yesterday, and what needs me?                        | Dashboard shows **today** only, with no comparison | A daily brief: facts, calculations, recommendations                                              | P1-8       |
| Why is this number what it is?                                     | No drill-down anywhere                             | Every tile, P&L line and reconciliation row opens its transactions; journal-line CSV; stock card | P1-2       |
| Which products make money?                                         | Product margin, theoretical, at today's cost       | Product mix: quantity, revenue, actual frozen cost, margin; popularity × margin; margin trend    | P2-16      |
| Where do the books and the shelf differ?                           | One count at a time                                | Variance history; actual vs theoretical usage between two counts                                 | P2-5       |
| Where are we losing money to waste?                                | The 5300 total, plus the last 60 movements         | Waste by item, type, person and day                                                              | P2-4       |
| What did we buy, from whom, at what price, and how has it changed? | Lifetime vendor statements                         | Price history per item and supplier; spend by period                                             | P1-3       |
| Where should the money be?                                         | Day close only                                     | Cash by account (till, safe, bank); card and Talabat money not yet received                      | P0-3, P1-9 |
| Who voided, refunded, discounted, or cancelled bills?              | Reasons only, on Orders                            | An exceptions report by person                                                                   | P1-10      |
| When are we busy?                                                  | —                                                  | Sales by hour and weekday                                                                        | P2-16      |
| Labour; returning customers                                        | No data                                            | Not now (P3)                                                                                     | P3         |
| Balance sheet, cash flow                                           | Trial balance only                                 | Statements                                                                                       | P3-6       |

**What the daily brief would have said this morning,** from the live data.
Facts, calculations and recommendations are kept apart:

> **Yesterday, 24 Sep** · _Facts:_ net sales 130,250 IQD over 20 sales; 2 voids; 2 refunds
> (4,500); 1 discount (1,000); waste 3,400; drawer −500.
> _Calculations:_ cost of goods 36,168 (27.8% of sales).
> 🔴 **7 cash sales (58,000) were recorded after the day was closed at 01:37.** Reopen and
> recount.
> 🔴 **Cash on hand is −220,000.** 465,000 was paid out "from cash" that the till never held.
> 🟠 **A stock count has been open since 24 Sep 14:55**, and stock has moved 37 times since.
> Do not approve it.
> 🟠 **Possible duplicate:** rent of 150,000 appears twice on 24 Sep, once as an expense and
> once as journal "xxxxxxxxxx".
> 🟠 **Possible price typo:** Bottled Water is 5,000 dine-in but 500 takeaway.
> 🟠 **Card money not yet banked:** 19,000. **Talabat money not yet received:** 5,250.
> _Recommendations:_ confirm the four items above; after that there is nothing to do
> today.

---

## 7. Alert gaps

**Today:**

- the dashboard's low-stock list (minimum level only; items that have never moved can
  never appear);
- a reconciliation badge;
- no notifications of any kind.

**Proposed alert rules, version 1 (P1-8).** They are deterministic, read-only, and each one
says what happened, why it matters, how urgent it is, what to do, and how confident it is.
They can be acknowledged with a note, and they resolve themselves once the condition
clears.

| Alert                      | Fires when                                                                                                         | Urgency                  | What to do                                   | Confidence                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Cash below zero            | Any cash account's balance is below 0                                                                              | 🔴                       | Record where the money really came from      | High (a ledger fact)                                                                 |
| Day not closed             | A day before today has sales and no close                                                                          | 🟠 (1 day), 🔴 (2+ days) | Close it                                     | High                                                                                 |
| Late sale                  | A sale or refund recorded after its day was closed (until P0-2 prevents it)                                        | 🔴                       | Reopen and recount                           | High                                                                                 |
| Count going stale          | A count open for more than 8 hours, or with movements since it started (until P0-1)                                | 🟠                       | Finish or cancel it                          | High                                                                                 |
| Running out                | Days of cover (on hand ÷ average daily use over 14 days) < supplier lead time + 1 day                              | 🔴 under 1 day, else 🟠  | Order about 7 days of use                    | High with 28+ days of history, medium 14–27, low 7–13, **insufficient data** under 7 |
| Below minimum              | On hand < minimum, including items never moved                                                                     | 🟠                       | Order                                        | High                                                                                 |
| Purchase price jump        | A receipt's cost per unit is more than 25% off the item's average or its last receipt                              | 🟠                       | Check the invoice                            | High                                                                                 |
| Margin below target        | A product's margin on any channel falls below the target (70%) after a cost change; red if the price is below cost | 🟠 / 🔴                  | Review the price or recipe                   | High; medium if an ingredient uses a fallback cost                                   |
| Uncosted                   | A recipe uses an item with cost 0, or a product on sale has no recipe                                              | 🟠                       | Receive it with its cost, or add the recipe  | High                                                                                 |
| Waste spike                | Waste over 7 days > 1.5 × the 4-week weekly average and > 20,000 IQD                                               | 🟠                       | Look at the top items and people             | Medium; low under 4 weeks                                                            |
| Exceptions by person       | One person's voids, refunds, discounts and cancelled bills in a week exceed 3% of their sales, or a set count      | 🟠                       | Review the list: evidence, not an accusation | Medium                                                                               |
| Card money not banked      | Card sales older than 3 days not yet settled from 1010                                                             | 🟠                       | Record the card settlement                   | High                                                                                 |
| Talabat money not received | Platform-paid sales older than the payout cycle, not yet settled                                                   | 🟠                       | Check the statement                          | High once order numbers exist                                                        |
| Bills due                  | A supplier bill due within 3 days, or overdue                                                                      | 🟠                       | Pay or schedule it                           | High                                                                                 |
| Price typo                 | One channel's price is more than 3× or less than ⅓ of the same product's other channels                            | 🟠                       | Confirm it                                   | Medium                                                                               |
| Possible duplicate payment | Two expenses or journals to the same account for the same amount within 3 days                                     | 🟠                       | Confirm it, or reverse one                   | Medium                                                                               |
| Made item past use-by      | A batch reaches its use-by date with stock left (after P2-7)                                                       | 🔴 on the day            | Use it or waste it                           | High                                                                                 |

**Guarding against false alerts:**

- one open alert per rule and subject;
- "running out" is suppressed on the day a delivery for that item is received;
- lead times are set per supplier (default 1 day);
- thresholds are settings;
- a rule that relies on history stays quiet, with "insufficient data", until it has at
  least 7 days of it;
- snoozing takes a reason.

---

## 8. UX gaps

Keep the till as it is: fast, big tiles, three languages, search, favourites. Keep the
product form with its live costing. The gaps are elsewhere:

- **Numbers that do not open.** No tile or report line leads to its transactions (P1-2).
- **Labels that do not say what they mean.**
  - "Gross profit" (P1-2).
  - The correction form's "cost per base unit": a manager entering kg can type a price per
    kg into a field that expects a price per gram (P1-4).
- **Scheduled changes you cannot see.** Future prices and recipes are invisible once saved,
  and a past date typed for a price is silently ignored while the screen says it took
  effect (P1-5).
- **The day close shows the expected cash before the count is entered.** A cash count
  should be blind, like stock counts are (P2-1).
- **Baristas record batches without seeing whether the ingredients are there.** A
  quantity-only stock view is enough and reveals no cost (P2-7).
- **Staff screens in English only:** Count, Production and waste (P2-15).
- **No search** on Products or Orders (P2-20).
- **Settings you can read but not change** (P2-8).
- **Error messages from the database** in rare cases, such as a zero-value waste entry
  (P2-19).
- **Manager approval means signing out the cashier** (P2-1: a manager PIN).

---

## 9. Financial control gaps

| Area                   | Gap                                                                                                                                                                                    | Action     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Cash                   | Sales into closed days; paid-outs outside the close; one cash account for everything; negative cash accepted                                                                           | P0-2, P0-3 |
| Cash                   | The close is not blind; the float is typed at the close and never recorded at opening; no drops; no per-cashier sessions                                                               | P2-1       |
| Card                   | 1010 is never cleared or checked against the terminal. "Paid by card" expenses and bills also credit 1010. A cash sale rung up as card cannot be detected. Live: 19,000 sits in 1010.  | P1-9       |
| Platforms              | No Talabat order number on the sale, and no matching of payouts. A cash sale rung up as Talabat is never expected in the drawer. Live: 5,250 unmatched in 1100 after a payout journal. | P1-9       |
| Discounts              | Cashiers can give up to 100% with no reason, no cap and no approval before the bill is printed. The record names whoever took payment, not whoever gave the discount.                  | P1-10      |
| Voids and refunds      | The requester is also the approver. Live: 4 of 4.                                                                                                                                      | P1-10      |
| Bills                  | Before printing, lines can be removed and the emptied bill cancelled by anyone, without a reason, leaving no record of what was on it (`0018` `cancel_tab`)                            | P1-10      |
| Reasons                | Any text is accepted. Live: void "hjjjhjjk", bill cancellations "dhfddsajfsa" and "sfsdfs", journal "xxxxxxxxxx".                                                                      | P1-10      |
| Opening stock          | Anyone who can create items (purchasing included) can create stock from owner equity, at any cost, with no reason and no audit                                                         | P1-1, P2-9 |
| Owner-only controls    | The accountant or GM can reverse the owner's control corrections and the year-end close (`0015:1397-1398`). A GM can deactivate or reactivate an owner or another GM (`0016:199-213`). | P2-9       |
| Seeing the ledger      | "See costs" also opens every journal, expense and the trial balance (`0016:94-100`), so the purchasing role can read salaries and profit                                               | P2-9       |
| Expenses               | Prepaid expenses are expensed at once, and a possible duplicate is not flagged. Live: "december shop prepaid rent" 150,000 expensed in September; rent posted twice on 24 Sep?         | P2-14      |
| Direct database access | SQL bypasses every app control. Live: one transaction on 24 Sep at 00:55 created 9 items, 5 products, 5 sales, a delivery, a bill and 19 journals, with no audit entries.              | P1-11      |
| Backup and monitoring  | No restore has been drilled, and there is no error or uptime monitoring (LIMITATIONS)                                                                                                  | P1-11      |

---

## 10. Inventory and production gaps

- **Counts post wrong variances while trading** (P0-1). This must come first; every stock
  report depends on counts being right.
- **No stock card.** No screen answers "82 kg of flour: opening + received − sold − used in
  batches − wasted ± counted = on hand" (P1-2).
- **Low stock misses items that never moved.** There is no reorder list, and par, maximum
  and safety levels exist in the data but are never used (P2-6).
- **Items are frozen after creation.** No pack units in the app, and duplicates are allowed
  (P1-4).
- **Deliveries cannot be corrected.** No supplier returns or credit notes (P2-10).
- **Negative stock is policed only at the till.** Production, waste and corrections ignore
  the setting (P2-8).
- **Production gaps** (P2-7):
  - no use-by dates;
  - no make-list;
  - yesterday's batch cannot be recorded for yesterday;
  - no made / sold / wasted / on-hand reconciliation;
  - a batch has no retry protection;
  - an output typed in the wrong unit (4.6 pans for 4.6 kg) is not questioned.
- **Waste** (P2-4):
  - the 50,000 approval limit applies per entry, so it can be split;
  - staff meals, comps and samples all go to 5300 Waste;
  - there is no waste report.
- **Transfers** between the central kitchen and the branch are not built. They are needed
  when the kitchen starts supplying (P2-18).
- **Not needed:** lot tracking and FIFO costing. The moving average is right for a café.

---

## 11. Recommended improvements

**P0 — fix first, as one change.**

| ID   | Improvement                                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | Counts compare with the stock at the time each item is counted; one open count at a time; a count can be cancelled            |
| P0-2 | No sales or refunds into a closed day; a manager can reopen a day (with a reason, audited); closing today is confirmed        |
| P0-3 | Paid-outs and drops are part of the close; separate till and safe cash; "paid by the owner"; negative cash warned and refused |
| P0-4 | A lost answer from the database freezes the payment and retries with the same key; one key per order                          |

**P1 — make every number trustworthy, then make the system speak.**

| ID    | Improvement                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| P1-1  | Audit prices, products, items, opening stock, suppliers, batch recipes and settings, with before/after values; a readable audit screen   |
| P1-2  | Correct and label the reports; every number opens its transactions; stock card; journal-line CSV                                         |
| P1-3  | Unit prices on receipts; warnings above ±25%; price history                                                                              |
| P1-4  | Edit items and suppliers; add pack units; no duplicate names; merge with audit                                                           |
| P1-5  | Recipe precedence bug fixed; scheduled prices and recipes shown; no past-dated prices                                                    |
| P1-6  | Uncosted items and products with no recipe flagged at sale time, in reports and at month end                                             |
| P1-7  | Freeze prices on printed bills; refresh the till's menu when the day changes                                                             |
| P1-8  | Alert engine v1 and an exception-first dashboard with the daily brief                                                                    |
| P1-9  | Card settlement and checking 1010; card payments out of 1020; Talabat order number; payout matching                                      |
| P1-10 | Discount caps with manager approval; reason codes; line removals audited; second approval for your own void or refund; exceptions report |
| P1-11 | Backups checked and a restore drilled; error and uptime monitoring; database admin access limited and logged                             |
| P1-12 | Trading-day cut-off (for example 04:00) if the café trades after midnight. Live sales at 00:16–01:39 suggest it does.                    |

**P2 — valuable next.** Details in the [action matrix](#action-matrix):

- blind drawer count, floats and cashier sessions;
- partial refunds;
- add-ons;
- waste controls and report;
- variance history;
- reorder list;
- production additions;
- a settings screen;
- permission tightening;
- deliveries, returns and credit notes;
- receipt and bill dates;
- retry keys everywhere;
- same-day voids;
- prepaid expenses;
- translations for staff screens;
- product mix;
- forecasts (later);
- multi-location readiness;
- small bugs;
- finding things;
- document corrections.

**P3 — nice to have:**

- customers and loyalty;
- labour and attendance;
- split tender;
- kitchen tickets;
- USD cash;
- balance sheet and cash flow;
- chart-of-accounts screen;
- PDF and invoice scans;
- switching modules on or off by business type;
- an offline queue.

**P4 — avoid:**

- AI that decides or accuses;
- automatic orders sent to suppliers;
- automatic price changes or stock corrections;
- FIFO or lot costing;
- payroll inside the till system;
- barcode scanning and three-way matching for one café;
- dashboards with 30 numbers.

---

## 12. Future architecture

How the system can grow without becoming complicated:

1. **Keep the database as the only writer.**
   - Every new business action is one checked function with its own tests.
   - Nothing writes around it: no direct table writes, and no second path to the same
     record.
2. **Add a read-only "signals" layer beside the books.**
   - Alerts, the daily brief, the stock card and the reorder list are SQL functions that
     _read_ the ledger.
   - Alert instances are stored with their status, but these functions never write to the
     books.
   - A daily scheduled job (Supabase supports `pg_cron`) saves the morning brief.
3. **Settings are data.**
   - One typed, audited table of business rules, each with a default: negative stock, waste
     limit, rounding step, target margin, discount caps, day cut-off, alert thresholds.
   - A branch can override a rule.
4. **Location everywhere.**
   - Each till and device belongs to a location, and passes it to every function.
   - Journals and expenses carry a location, so each branch has its own P&L.
   - Days close per branch, roles apply per branch, stock transfers between locations, and
     menus are costed per branch.
5. **Master data with history.** Prices, recipes, items and products change only through
   dated, audited functions. Documents keep the name they were made with.
6. **Modules switch on per business type.**
   - Tables, production, delivery platforms, use-by dates and add-ons are switches, over one
     engine.
   - A juice bar never sees production. A bakery gets production, use-by dates and
     pre-orders. A coffee shop gets add-ons.
7. **Notifications through an outbox.**
   - Alerts go to an outbox table, shown in the app first; email, WhatsApp or Telegram
     later.
   - Delivery is at-least-once, and the rule, not the message, is the source of truth.
8. **AI only on top, and only later.**
   - It reads the computed facts and summarises them. Every sentence cites its numbers.
   - It never writes, and it says "insufficient data" when the rules do.
   - Database → validated data → calculations → signals → (optional) summary. Never the
     other way round.
9. **Scale is not a concern for years.** Hundreds of sales a day are tiny for PostgreSQL.
   Keep the indexes on `business_id` and dates, and archive nothing.

---

## Action matrix

Automation levels: **1** = safe to run automatically · **2** = recommends, a person approves
· **3** = a person decides; the system only records and checks.

| ID    | Priority | Problem                                                                       | Existing behaviour                                                                                                                                                  | Proposed improvement — how it works and how accuracy is protected                                                                                                                                                                                                                                                                                                                                               | Data required                                                | Automation level                   | Risk of the change                                                                                                                              | Expected benefit                                                                                   |
| ----- | :------: | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| P0-1  |    P0    | Counts post, a second time, stock that moved while the count was open         | Expected quantity saved when the count opens; approval posts counted − that; counts can overlap; no cancel                                                          | Record when each item is counted. At approval, expected = the saved quantity + that item's movements between opening and counting, so the counter stays blind. One open count per location. A manager can cancel an open count, with a reason. Past approved counts stay as they are.                                                                                                                           | Time counted per line (new column); movements (exist)        | 1 (calculation); approval stays 3  | Low: changes only how new approvals calculate. Tests: a sale, a delivery and a batch during a count; two overlapping counts                     | Counts stop corrupting stock and 5400. The live open count (+177,000 false) becomes safe to finish |
| P0-2  |    P0    | Sales and refunds go into closed days                                         | Close accepted at any hour, including today; sales, bill payments and refunds never check it; no reopening                                                          | Sales, bill payments and refunds into a closed location-day are refused: "Today's till was closed at 01:37 by … — a manager can reopen it". **Reopen day** (manager, reason, audited) reverses the over/short journal and offers the close again. Closing today asks "No more sales today?"                                                                                                                     | The close record (exists); reopen record                     | 1 (guard); reopening 3             | Medium: the till refuses after an early close, so the reopen path and message must be clear. Tests: every route in; a bill paid after the close | Every dinar sits inside exactly one drawer count                                                   |
| P0-3  |    P0    | Cash paid out is not part of the drawer; cash can go negative                 | Expenses and bills "from cash" credit 1000, the till's account; expected = float + cash sales − cash refunds; no balance check                                      | Where money is paid from: **Till** (subtracted in that day's close), **Safe** (new account 1005), **Bank**, **Owner personally** (Cr 3000). Record **drops** from till to safe. Warn, and refuse unless the owner confirms, a payment that would take a cash account below 0. Show cash by account on the dashboard.                                                                                            | New account 1005; paid-out and drop records per location-day | 1 (calculation and guard)          | Medium: changes the payment form and the close formula; past entries unchanged; the live −220,000 needs your answer (Appendix A)                | A drawer difference means a real shortage; cash on hand is true                                    |
| P0-4  |    P0    | A sale can be recorded twice after a lost answer                              | A network failure to the database is treated as a refusal; the till forgets the key; reopening payment makes a new key                                              | Treat "no answer" (no status or a 5xx) as **uncertain**: the till freezes and retries with the same key. One key per order, kept until a definite answer. Test by dropping the answer after the database commits.                                                                                                                                                                                               | None                                                         | 1                                  | Low: a small change in `rpc.ts` and the till                                                                                                    | "Recorded exactly once" holds on every connection                                                  |
| P1-1  |    P1    | Changes to prices and master data leave no trace of who                       | `set_price`, products, items, opening stock, suppliers, batch recipes and settings not audited; audit screen shows 40 rows without values                           | Audit each, with before/after values and the person: price, product rename or hide, item and opening stock (owner-only, with a reason), supplier, batch recipe, setting. Retire the unaudited `new_recipe_version`. Keep the product name on each sale line. Audit screen with filters by action, person and date, the before/after values, and CSV.                                                            | A creator column on prices; audit rows                       | 1                                  | Low: adds records, changes no postings                                                                                                          | Every sensitive change is traceable; history keeps its names                                       |
| P1-2  |    P1    | Numbers disagree and cannot be opened                                         | Sales by channel includes refunded sales; "gross profit" means three things; counts revalued at today's cost; reversed expenses shown as live; no drill-down        | Fix the four report bugs. One definition of each figure, shown in the label: "Gross profit after waste and fees" vs "Sales margin". Every dashboard tile, P&L and trial-balance line and reconciliation row opens the transactions behind it. **Stock card** per item: opening, received, sold, used in batches, made, wasted, counted and corrected, closing. CSV of journal lines.                            | Existing ledger                                              | 1                                  | Low: read-only; figures change where they were wrong; say so in the release notes                                                               | No unexplained number                                                                              |
| P1-3  |    P1    | Mistyped purchase prices go straight into costs                               | Line totals only; no checks; bill pre-filled from the receipt                                                                                                       | Enter **price per unit × quantity**, and show the cost per base unit. If it is more than ±25% from the item's average or last receipt, show both and ask for confirmation. **Price history** per item and supplier. The bill amount is typed from the invoice, not pre-filled.                                                                                                                                  | Receipt lines (exist)                                        | 1 (warning; the person decides)    | Low                                                                                                                                             | Stops the "2.5 vs 50" and "25 vs 65" cases at entry                                                |
| P1-4  |    P1    | Items and suppliers frozen; duplicates allowed                                | No edit functions; no pack units from the app; no unique names                                                                                                      | Edit name, type, minimum and par levels, active flag. **Add** pack units; a unit already in use keeps its factor (a new code instead). Unique names ignoring case and spaces, for active items, suppliers and products. A merge tool: shows both, a person confirms, audited, history kept.                                                                                                                     | Item and supplier edit functions                             | 3 for merges; 1 for checks         | Medium: merging must re-point references without editing the ledger (use deactivation plus mapping)                                             | Clean master data; the duplicate-invoice rule holds again                                          |
| P1-5  |    P1    | Recipe precedence bug; invisible scheduled changes; past-dated prices ignored | Highest version number wins; scheduled versions not shown; `set_price` accepts any date                                                                             | Choose the version by **latest start date**, then version number. A new version is closed the day before the next scheduled one. Show scheduled prices and recipes, and let them be cancelled. Refuse past-dated prices on the server.                                                                                                                                                                          | Existing                                                     | 1                                  | Low: tests for every ordering of versions                                                                                                       | The recipe in force is always the one intended                                                     |
| P1-6  |    P1    | Zero-cost sales are silent                                                    | Cost 0 when never bought; empty recipes allowed; only the form warns                                                                                                | Flag each line costed at 0. "Uncosted sales" report. Month-end checklist item. A red badge on the product card. A product needs a recipe, or an explicit "uses no stock" with a reason.                                                                                                                                                                                                                         | A flag on sale lines                                         | 1                                  | Low                                                                                                                                             | Profit is never overstated without saying so                                                       |
| P1-7  |    P1    | Printed bills re-priced at payment; stale till menu                           | Bill lines carry no price; menu loaded once                                                                                                                         | Freeze the price on each bill line when it is printed, and pay at the printed price. Before payment, confirm the server's total; refresh the menu when the day or price list changes.                                                                                                                                                                                                                           | A price column on bill lines                                 | 1                                  | Low-medium: the bill total must equal the sale                                                                                                  | What the customer pays is what the books record                                                    |
| P1-8  |    P1    | The system does not speak                                                     | Low-stock list and reconciliation badge only                                                                                                                        | **Alert engine v1**: the rules in §7, stored with their status, acknowledged with a note, resolving themselves. **Exception-first dashboard**: 🔴 / 🟠 / 🟢 / 🔵 at the top, today's numbers below. **Daily brief** (§6) at 07:00 Baghdad time: facts, calculations and recommendations apart.                                                                                                                  | Existing ledger; settings for thresholds                     | 1 (detection); actions stay 2 or 3 | Low: read-only; tune the thresholds to avoid noise                                                                                              | Exceptions surface themselves                                                                      |
| P1-9  |    P1    | Card and Talabat money cannot be reconciled                                   | 1010 never cleared; expenses and bills paid by card credit 1010; no order number on platform sales; payouts by manual journal                                       | **Card settlement** entry: Dr 1020 bank + Dr fees, Cr 1010, with a check against the terminal's daily total. Card payments out go to 1020, or a card-payable account. **Talabat order number required** on platform sales. Receivable shown by order. Statement import matches orders and proposes the payout journal for a person to post (audit M-10).                                                        | Order number; statement file                                 | 2 (matching proposes); posting 3   | Medium: new posting paths, fully tested                                                                                                         | 1010 and 1100 explain themselves; tender switching becomes visible                                 |
| P1-10 |    P1    | Discounts, voids, refunds and bill edits are lightly controlled               | Up to 100% with no reason; requester = approver; unprinted bills emptied without a trace; any text accepted as a reason                                             | **Reason codes** with an optional note, for example "rang wrong item", "customer changed mind", "comp", "staff meal". Discount cap per role (for example cashier ≤ 10%), with a **manager PIN** above it. Record who gave the discount. Audit every line removal and every cancelled bill. Your own void or refund needs a second person, or goes on the owner's daily review. **Exceptions report** by person. | Reason list; PIN per manager                                 | 3 (approvals); 1 (report)          | Medium: adds a step only for exceptions, never for normal sales                                                                                 | Leakage becomes visible without slowing the till                                                   |
| P1-11 |    P1    | Recovery and access not proven                                                | Backups not drilled; no monitoring; SQL access bypasses controls                                                                                                    | Confirm Supabase backups or point-in-time recovery for the plan. Restore into a scratch project and compare fingerprints. Error and uptime monitoring alerting the owner. Only the owner holds database-admin access; any maintenance in SQL writes a signed audit entry.                                                                                                                                       | Supabase and Vercel settings                                 | —                                  | Low                                                                                                                                             | The books survive an incident; admin changes are visible                                           |
| P1-12 |    P1    | Trading day ends at midnight                                                  | Day = calendar date in Baghdad; sales after midnight belong to the next day                                                                                         | A **day cut-off** setting (for example 04:00): sales before the cut-off belong to the previous trading day. **Needs your opening hours.**                                                                                                                                                                                                                                                                       | Setting                                                      | 1                                  | Medium: every day-based report uses one function (`business_local_date`); change it there, with tests                                           | One night = one drawer = one day                                                                   |
| P2-1  |    P2    | Weak drawer control                                                           | Expected shown before counting; float typed at the close; one close per day                                                                                         | Blind close: the count is entered first, then the expected amount and difference are shown. Float recorded when the day opens (carried from the last close). Drops recorded. **Cashier sessions** when more than one cashier shares a drawer.                                                                                                                                                                   | Opening record; sessions                                     | 1                                  | Low                                                                                                                                             | Shortages can be attributed                                                                        |
| P2-2  |    P2    | Only whole-sale refunds                                                       | The workaround deducts ingredients twice                                                                                                                            | Refund chosen lines (`partially_refunded` exists); stock back only for returnable items                                                                                                                                                                                                                                                                                                                         | Refund lines                                                 | 3                                  | Medium                                                                                                                                          | Correct stock and cost                                                                             |
| P2-3  |    P2    | No priced add-ons                                                             | "Extra scoop" is a note: no price, no stock                                                                                                                         | Add-on groups (scoop flavour, topping, milk, extra shot), each with a price and recipe lines, posted with the sale                                                                                                                                                                                                                                                                                              | Add-on catalogue (the `modifiers` column exists)             | 1                                  | Medium: touches the sale posting; needs golden tests                                                                                            | Correct revenue and stock for gelato and coffee                                                    |
| P2-4  |    P2    | Waste controls and reporting                                                  | 50,000 limit per entry, can be split; comps and staff meals in 5300; no report                                                                                      | Daily limit per person; a second person reviews above the limit; separate accounts for comps and staff meals; waste report by item, type, person and day; an end-of-day waste sheet                                                                                                                                                                                                                             | Existing movements                                           | 1 / 3                              | Low                                                                                                                                             | Visible losses                                                                                     |
| P2-5  |    P2    | No variance history                                                           | One count at a time                                                                                                                                                 | Variance history by item; **actual vs theoretical usage** between two approved counts (milk, paste, cups)                                                                                                                                                                                                                                                                                                       | Approved counts (after P0-1)                                 | 1                                  | Low                                                                                                                                             | The key food-cost control                                                                          |
| P2-6  |    P2    | No reorder list                                                               | Low flag only for items that moved; par, maximum and safety levels unused                                                                                           | Reorder list: par − on hand, days of cover and lead time, including items never moved                                                                                                                                                                                                                                                                                                                           | Par levels; usage                                            | 2                                  | Low                                                                                                                                             | Fewer stockouts                                                                                    |
| P2-7  |    P2    | Production gaps                                                               | No use-by, make-list, back-dating, reconciliation or retry protection; wrong-unit output unchecked; baristas don't see stock                                        | Use-by date per batch, and "expiring today". Make-list from par levels per flavour. A manager records yesterday's batch (reason, audited; not before the last approved count). Made / sold / wasted / on-hand report. A retry key. Output outside 70–130% of plan asks to confirm. Quantity-only stock for baristas.                                                                                            | `production_batch.expiry_date` (exists, unused)              | 1 / 2                              | Low                                                                                                                                             | Food safety and yield control                                                                      |
| P2-8  |    P2    | Rules only changeable in SQL                                                  | Settings read-only; negative-stock rule on sales only                                                                                                               | Settings screen (owner): negative stock (sales, waste, batches, corrections), waste limit, rounding step, target margin, discount caps, day cut-off, alert thresholds. Every change audited.                                                                                                                                                                                                                    | Settings table                                               | 3                                  | Low                                                                                                                                             | The owner runs the rules                                                                           |
| P2-9  |    P2    | Permissions leak in places                                                    | "See costs" opens the ledger; GM can deactivate or reactivate owners; accountant or GM can reverse owner corrections and year end; opening stock open to purchasing | A separate "see the books" permission for journals, expenses and the trial balance. Owners and GMs activated only by the owner. Corrections and year end reversed only by the owner. Opening stock owner-only. Purchasing bills limited to deliveries.                                                                                                                                                          | Role matrix (kept in sync by the test)                       | —                                  | Low                                                                                                                                             | Least privilege                                                                                    |
| P2-10 |    P2    | Deliveries cannot be corrected                                                | Receipts append-only; no returns or credit notes; one bill per receipt                                                                                              | Reverse an **unbilled** receipt at its original values; supplier return; credit note against 2000; one bill covering several deliveries                                                                                                                                                                                                                                                                         | New postings                                                 | 3                                  | Medium                                                                                                                                          | Mistakes fixable without SQL                                                                       |
| P2-11 |    P2    | Receipt and bill dates                                                        | Receipt dated when entered; bill may predate the receipt                                                                                                            | Receipt date within an open period; refuse a bill dated before its receipt                                                                                                                                                                                                                                                                                                                                      | Existing                                                     | 1                                  | Low                                                                                                                                             | Months lock cleanly                                                                                |
| P2-12 |    P2    | Retries can duplicate non-sale postings                                       | Only sales carry a key                                                                                                                                              | Retry keys on receipts, expenses, waste, corrections, payments, batches and new bills                                                                                                                                                                                                                                                                                                                           | A key column on each record                                  | 1                                  | Low                                                                                                                                             | Exactly once everywhere                                                                            |
| P2-13 |    P2    | Voids on a later day                                                          | Any unclosed day                                                                                                                                                    | Void only on the sale's own trading day; otherwise refund                                                                                                                                                                                                                                                                                                                                                       | —                                                            | 1                                  | Low                                                                                                                                             | The books tie on every date                                                                        |
| P2-14 |    P2    | Prepaid and duplicate expenses                                                | Expensed at once; no duplicate check                                                                                                                                | "For period" or prepaid (asset, released monthly); warning when an expense or journal matches a recent one                                                                                                                                                                                                                                                                                                      | A prepaid account                                            | 1 / 3                              | Low                                                                                                                                             | Months carry their own costs                                                                       |
| P2-15 |    P2    | Staff screens in English only                                                 | The till is in 3 languages; Count, Production and waste are not                                                                                                     | Move their text into the dictionaries; check the Arabic and Kurdish layouts on a phone                                                                                                                                                                                                                                                                                                                          | —                                                            | —                                  | Low                                                                                                                                             | Fewer counting and batch mistakes                                                                  |
| P2-16 |    P2    | No product mix or trends                                                      | Theoretical margin at today's cost                                                                                                                                  | Product mix (quantity, revenue, actual cost, margin); popularity × margin; margin trend when costs move; sales by hour and weekday                                                                                                                                                                                                                                                                              | Sale lines (exist)                                           | 1                                  | Low                                                                                                                                             | Menu decisions from facts                                                                          |
| P2-17 |    P2    | No demand-based suggestions                                                   | —                                                                                                                                                                   | Production and purchase suggestions from 4+ weeks of sales, by weekday, with a confidence level; "insufficient data" until then                                                                                                                                                                                                                                                                                 | History                                                      | 2                                  | Low (suggest only)                                                                                                                              | Less waste, fewer stockouts                                                                        |
| P2-18 |    P2    | Not ready for a second branch                                                 | The app always uses the first branch; journals carry no location; no transfers                                                                                      | Location per till; per-branch closes and open-day checks; location on journals and expenses; branch roles; transfers from the central kitchen; per-branch menu costing. **Becomes P1 once a second branch is planned.**                                                                                                                                                                                         | Location on records                                          | 1                                  | Medium                                                                                                                                          | Growth without rebuilding                                                                          |
| P2-19 |    P2    | Small correctness bugs                                                        | See §3.12                                                                                                                                                           | Zero-value waste; refunding a 100%-discount sale; fallback cost (last receipt or batch at the location); write off value left at zero stock; retire the unit-blind sub-recipe path                                                                                                                                                                                                                              | —                                                            | 1                                  | Low                                                                                                                                             | Fewer surprises                                                                                    |
| P2-20 |    P2    | Hard to find things                                                           | Orders 300, journals 200, audit 40; no search                                                                                                                       | Search and date filters on Orders, Journals, Products and the audit trail; paging                                                                                                                                                                                                                                                                                                                               | —                                                            | —                                  | Low                                                                                                                                             | Quicker checks                                                                                     |
| P2-21 |    P2    | Documents contradict the code                                                 | See Appendix B                                                                                                                                                      | Correct each; add a check to the release list                                                                                                                                                                                                                                                                                                                                                                   | —                                                            | —                                  | None                                                                                                                                            | Documents you can trust                                                                            |
| P3-1  |    P3    | No customer data                                                              | A name on a bill                                                                                                                                                    | Phone and address for direct delivery; loyalty later                                                                                                                                                                                                                                                                                                                                                            | Customer table                                               | 1                                  | Low                                                                                                                                             | Retention metrics become possible                                                                  |
| P3-2  |    P3    | No labour data                                                                | Salaries as expenses                                                                                                                                                | Attendance, and labour % of sales                                                                                                                                                                                                                                                                                                                                                                               | Clock-in data                                                | 1                                  | Low                                                                                                                                             | Staffing to demand                                                                                 |
| P3-3  |    P3    | One tender per sale                                                           | Split by items only                                                                                                                                                 | Cash + card on one sale                                                                                                                                                                                                                                                                                                                                                                                         | —                                                            | 1                                  | Medium                                                                                                                                          | Convenience                                                                                        |
| P3-4  |    P3    | No kitchen tickets                                                            | —                                                                                                                                                                   | Bar and kitchen order tickets for table orders                                                                                                                                                                                                                                                                                                                                                                  | —                                                            | 1                                  | Low                                                                                                                                             | Service speed                                                                                      |
| P3-5  |    P3    | Dollars at the till                                                           | IQD only                                                                                                                                                            | USD cash tender at a set rate                                                                                                                                                                                                                                                                                                                                                                                   | Rate setting                                                 | 3                                  | Medium                                                                                                                                          | Local practice                                                                                     |
| P3-6  |    P3    | Statements                                                                    | Trial balance only                                                                                                                                                  | Balance sheet and cash-flow statement from the ledger; PDF; invoice scans; chart-of-accounts screen                                                                                                                                                                                                                                                                                                             | —                                                            | 1                                  | Low                                                                                                                                             | Bank and partner reporting                                                                         |
| P3-7  |    P3    | One layout for every business                                                 | All modules shown                                                                                                                                                   | Modules switched on per business type                                                                                                                                                                                                                                                                                                                                                                           | Settings                                                     | —                                  | Low                                                                                                                                             | Simpler screens for other shops                                                                    |
| P3-8  |    P3    | Offline selling                                                               | Honest refusal                                                                                                                                                      | Keep the refusal; a manager's "late entry" (dated, reason) for paper sales covers most needs                                                                                                                                                                                                                                                                                                                    | —                                                            | 3                                  | High for a real queue                                                                                                                           | Paper sales recorded on their day                                                                  |
| P4    |    P4    | Avoid                                                                         | —                                                                                                                                                                   | AI deciding or "detecting theft"; automatic orders to suppliers; automatic price changes or stock corrections; FIFO or lot costing; payroll; barcode scanning and three-way matching for one café; a 30-number dashboard                                                                                                                                                                                        | —                                                            | —                                  | —                                                                                                                                               | Complexity avoided                                                                                 |

---

## Appendix A — The live books today: decisions for the owner

These need your knowledge. None of them was changed.

1. **Is 24–25 September real trading or testing?** Several entries look like tests:
   - void "hjjjhjjk";
   - bill cancellations "dhfddsajfsa" and "sfsdfs";
   - journal "xxxxxxxxxx";
   - sales after midnight.

   If they are tests, choose between:
   - **keep them and correct them.** The amounts are small; voids, refunds, reversals and a
     count fix them;
   - **a one-time reset before real trading.** The clean-start script refuses to run after
     the upgrade, so this would need a new, owner-authorised script. It is your decision
     (level 3).

2. **The stock count opened on 24 Sep at 14:55: do not approve it.** After P0-1 it can be
   finished safely, or cancelled.
3. **The 58,000 IQD of cash sales on 24 Sep after the close.** Was that cash in the drawer?
   After P0-2 the day can be reopened and recounted.
4. **Cash on hand is −220,000.** Where did the 465,000 paid "from cash" really come from:
   the drawer, a safe, your own pocket? Each answer has a different correction. For
   example, money paid by you personally is Dr 1000 / Cr 3000 Owner equity.
   - Also: the books say the till opened with 250,000 (journal 1010), but the 24 Sep close
     was given a float of 25,000. Which is right?
5. **Rent on 24 Sep appears twice:** expense "december shop prepaid rent" (150,000) and
   manual journal "xxxxxxxxxx" (6000 Rent, 150,000). If they are the same payment, reverse
   the journal. December's rent is also in September's costs.
6. **Bottled Water is 5,000 IQD dine-in, 500 takeaway and 750 on Talabat.** It was changed
   from 500 to 5,000 at 01:19 on 24 Sep. Is 5,000 a typo?
7. **Cup lids: opening stock at 50 IQD each, bought at 2.5 each.** Which is right? The
   average is now 18. **Coffee beans** were received at between 25 and 65 IQD per gram:
   were they different beans?
8. **Card clearing holds 19,000** (never banked), and **Talabat receivable 5,250** (not
   matched after statement TLB-0924).
9. **The americano** costs more dine-in (875) than takeaway (857), because its lid is set
   for dine-in only. Fix it with **Change the recipe…**.
10. **The cashier** has not created a login yet.
11. **Your opening hours:** does the café trade after midnight? This decides P1-12.

## Appendix B — Documentation that no longer matches the code

| Document                                                                                                                           | Says                                                                            | The code                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `LIMITATIONS.md:9-15`, `ROADMAP.md:27-29`, `PROGRESS.md:88`                                                                        | The live site is publicly writable; history unverified; "go live" is next       | Live and closed since 23 Sep; history cleared                                                    |
| `LIMITATIONS.md:34`, `ROADMAP.md:42`, `USER_GUIDE_WALKTHROUGH.md:526`                                                              | No till discounts; "with a reason, an approval limit" planned                   | Discounts shipped (0019/0020), with neither a reason nor a limit                                 |
| `TEST_PLAN.md:172-173`                                                                                                             | Production's live path not built                                                | Built (0023)                                                                                     |
| `deployment.md:27`                                                                                                                 | Production screens "go live with the pull request"                              | Merged and deployed ([PR #9](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/9)) |
| `owner-guide.md:27`                                                                                                                | History unverified                                                              | Cleared                                                                                          |
| `CALCULATIONS.md:40`, `:50-53`; `ASSUMPTIONS.md:24`                                                                                | The average is unchanged by issues; FIFO is an option                           | Rounding moves it slightly; no FIFO                                                              |
| `CALCULATIONS.md:146`                                                                                                              | Gross profit = net − cost of goods                                              | Dashboard and P&L subtract all 5xxx                                                              |
| `CALCULATIONS.md` §6                                                                                                               | The domain rule is the same as the database's                                   | The domain rounds once and refuses a missing cost; the database rounds per item and uses 0       |
| Many places (`CALCULATIONS.md:173`, `owner-guide.md:131`, `cashier-quickstart.md:143`, `PROGRESS.md:99`)                           | A void is same-day only                                                         | Any day not yet closed                                                                           |
| `PROGRESS.md:95`, `0019:211-213`                                                                                                   | The sale key is made when the cart starts                                       | Made when the pay dialog opens                                                                   |
| `PROGRESS.md:104` (H-10), settings screen                                                                                          | Negative stock enforced; otherwise "costed at last purchase cost"               | Enforced on sales only; fallback is the last incoming cost of any kind, or 0                     |
| `PROGRESS.md:109` (M-03), `:119` (M-13)                                                                                            | Every privileged action is audited; corrections have a threshold                | See §3.11; only waste has a threshold                                                            |
| `PROGRESS.md:120` (M-14)                                                                                                           | Documents rewritten against the code ✅                                         | Should be 🟡 (this table)                                                                        |
| `SECURITY.md:21`, `:37`                                                                                                            | Only the owner grants owner or GM, and posts to control accounts                | A GM can reactivate either; the accountant or GM can reverse the owner's corrections             |
| `DATA_MODEL.md` (roles per location, `sale_adjustment` for discounts, `work_shift` as sessions, purchase orders, lots, par levels) | Described as working                                                            | Unused or not enforced                                                                           |
| `owner-guide.md:97-99`                                                                                                             | A served drink cannot quietly disappear from a bill                             | Only after the bill is printed                                                                   |
| `counting-guide.md:13`, `:44`                                                                                                      | You can stop and come back; a wrong approval is corrected only by another count | Pausing while trading creates false variances (P0-1); Correct stock can also fix it              |
| `offline.html:26`                                                                                                                  | Ring paper sales up when the connection returns                                 | They are dated when entered                                                                      |

## Appendix C — How this audit was done

- **Code.**
  - The last definition of every function in migrations 0001–0023.
  - The screens and actions under `src/`.
  - The SQL, unit and browser tests.
  - Four area reviews in parallel: sales and cash; stock and purchasing; recipes and
    production; books, reports and permissions.
  - Each finding kept here was checked in the code again. Two over-statements were
    corrected:
    - the live items do have pack units (loaded by SQL); only items added in the app lack
      them;
    - the duplicate-sale gap needs a lost answer between the app server and the database,
      not a lost connection at the till.
- **Live data.**
  - Read-only queries on 25 September 2026: row counts, business rules, balances, stock
    by item and movement type, sales by status, adjustments, the day close, open bills and
    counts, prices, indexes and the audit log.
  - Nothing was written.
- **Not covered.**
  - Load and performance.
  - Supabase and Vercel account settings: backups, MFA, sign-up.
  - A security penetration test.
  - Arabic and Kurdish layouts on a phone.
