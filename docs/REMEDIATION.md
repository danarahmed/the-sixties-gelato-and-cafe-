# Correcting the Books Recorded Before the Controls

Before migrations `0014`–`0017`, anyone holding the public key could write to
the books. The old app also posted some records twice, some not at all, and
some to the wrong account. The audit asked for two things: treat every record
posted while the system was public as **unverified until reviewed**, and do not
rely on the books until each subledger agrees with its control account.

This guide covers what the upgrade does to existing records, what the live books
show afterwards, and how to correct them. Every correction is a **new, dated,
audited entry**. Nothing recorded before the upgrade is edited or deleted.

> **The live database took option A (section 4) on 23 September 2026.** The
> owner confirmed its history was trial data, and it was cleared with
> [`supabase/remediation/clean-start.sql`](../supabase/remediation/clean-start.sql)
> before the upgrade. It has no history left to correct. Sections 3 and 5 record
> what that history held and how it would have been corrected. They remain the
> worked example for any database that keeps its history.

## 1. What the upgrade does to existing records

- **Kept as they are.** Every journal, line, sale, receipt, bill and payment
  survives unchanged. The upgrade test checks this line by line.
- **Marked "before controls"** (`legacy`) on the Journal Register, so it is
  always clear which entries were posted under the old rules.
- **Dated into periods.** A **July 2026** period is created for the July entry.
- **Numbered** where the old app left them unnumbered: 1026 to 1032 on the live
  data.
- **Made read-only.** From then on, the only way to change a published entry is
  a new entry that corrects it.
- **A day closed twice counts once.** The duplicate close stays on record.
- **Nothing is posted on your behalf.** Stock records the old app never
  journaled are listed for the owner to review and post (step 1 below).

## 2. Where the differences show

**Reports → Do the books tie?** compares each subledger with its control
account:

| Check     | Subledger                                                                          | Control account                                                   |
| --------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Inventory | the stock ledger: every movement, at its value                                     | 1200 Inventory                                                    |
| Payables  | unpaid bills, plus deliveries the old app posted to payables that await their bill | 2000 Accounts payable                                             |
| GRNI      | deliveries received but not yet billed                                             | 2050 Goods received not invoiced                                  |
| Sales     | recorded sales, less refunds                                                       | 4000 Sales revenue less 4100 Discounts and 4200 Returns & refunds |

**Chart of Accounts** shows the closing checklist for each period. A period
locks only when every check passes, earlier periods are locked, every trading
day is closed, no draft journal is left and no count awaits approval.

## 3. What the live books show after the upgrade

These are exact figures, not estimates. On 23 September 2026 the live rows were
copied read-only into a local PostgreSQL 17.6 database, and verified table by
table against a fingerprint taken on the live database. Migrations 0014–0017
were then applied to that copy exactly as the runbook says. The copy was used
only for this rehearsal; it is not in the repository.

| Check     | 31 July  | 31 August  | 23 September |
| --------- | -------- | ---------- | ------------ |
| Inventory | −640,000 | −1,343,350 | −1,243,350   |
| Payables  | 0        | 0          | 0            |
| GRNI      | 0        | 0          | 0            |
| Sales     | 0        | −15,000    | −15,000      |

A negative difference means the ledger holds more than the subledger explains.

### Why Inventory is out by 1,243,350

| #   | What happened                                                                                                                     | Journal          | Effect on the difference |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -----------------------: |
| a   | Opening stock for 8 items was entered on 21 Aug with no journal                                                                   | —                |                 +446,000 |
| b   | The 24 Aug count found 15 napkins fewer, with no journal                                                                          | —                |                     −150 |
| c   | 16 packs of milk were received from shazhir zharo on 22 Sep, with no journal                                                      | —                |                 +100,000 |
| d   | Bill INV-1041 (Erbil Dairy Supply, 28 Jul) debited Inventory; no goods were received into stock                                   | 1001             |                 −640,000 |
| e   | Bill INV-2207 (Zagros Coffee Roasters, 20 Aug) debited Inventory; no goods were received into stock                               | 1003             |                 −380,000 |
| f   | "Purchase on credit" debited Inventory, with no delivery and no bill                                                              | 1014             |                 −800,000 |
| g   | "Waste / spoilage write-off", "Talabat sale — full economics" and "Card sale — dine-in" credited Inventory with no stock movement | 1011, 1015, 1016 |                  +30,800 |
|     | **Total**                                                                                                                         |                  |           **−1,243,350** |

Items a to c are stock the old app moved but never journaled; the new app
journals every such record as it happens. Items d to g are entries in the
ledger with no stock behind them.

### Why Sales is out by 15,000

Journals 1015 (5,000) and 1016 (10,000) recorded revenue for sales that are not
in the sales records.

### Payables agree, and why

The Erbil Dairy Supply delivery of 22 Aug (110,000) was posted straight to
Accounts payable by the old app (journal 1028) and its bill has not been entered.
That payable is a real liability, so it counts as owed until its bill is
recorded.

### Other things to review (they do not block the close)

- **Journals with no record behind them:** 1008 (salaries 1,200,000), 1009
  (owner capital 5,000,000), 1010 (electricity 150,000), 1012 (Talabat payout
  3,000) and 1013 (supplier payment 800,000). All were created in the same
  second on 23 Aug, 18:46 Baghdad time, together with 1011 and 1014–1016.
- **Journal 1029, "Cash over/short — 2026-08-24", +44,000.** The 24 Aug day was
  closed on 22 Sep: 70,000 counted against 26,000 expected. The journal was
  dated 22 Sep, so it sits in September. If the 70,000 was 22 September's drawer
  and not 24 August's, reverse 1029. The day stays closed and its record keeps
  the count.
- **Journal 1032, marketing 200,000,** was posted to 6200 Utilities. To
  reclassify, post a manual journal: Dr 6900 Other expenses, Cr 6200.
- **Cash on hand is −515,000.** More expenses were recorded as paid from the till
  than cash ever came in. If some were paid from a bank account, move them
  (Dr 1000, Cr 1020) and record how the bank was funded. (Since `0024`, 1000
  takes no manual journal: that move is the owner's **Correction to a control
  account**, with its reason.)
- **Two items are called "Milk".** The second was created on 24 Aug; the 22 Sep
  delivery went to it. Stock for milk is split across both until counted.

## 4. First, decide what the history is

Most of the history was not typed through the app:

- **23 Aug, 18:46 (Baghdad).** Nine journals were created in the same second.
- **24 Aug, 22:35–22:38.** The bulk of the records were created in five
  batches, each sharing one timestamp to the microsecond: items, opening stock,
  suppliers, bills, a payment, a delivery, products, 7 sales, expenses, a count,
  a waste and a day close. Their business dates were back-filled from 28 Jul to
  24 Aug.

Only a few records carry the marks of the app in use:

- the August shop rent expense (23 Aug) and the supplier shazhir zharo;
- two till sales on the evening of 24 Aug;
- a new product and item;
- the old app's posting of the Erbil delivery;
- on 22 Sep: the 24 Aug day close, three expenses (rent 1,000,000, wages
  550,000, marketing 200,000) and the delivery from shazhir zharo.

Only you know which of these are real. Choose one of these:

- **A. Start the books clean (for trial data).** Run
  [`supabase/remediation/clean-start.sql`](../supabase/remediation/clean-start.sql)
  in the SQL editor, immediately before applying 0014. It keeps the business,
  its locations, its chart of accounts and its owner. It removes every other
  record: sales, stock, purchases, bills, payments, expenses, journals, periods,
  counts, the catalogue, suppliers, the other people and the logs. The audit
  trail then opens with a line recording the clean start, and journals number
  from 1001 again. The script runs as one transaction and checks its own result.
  It refuses to run once 0014 is applied. `scripts/test-sql.sh` rehearses it,
  followed by the upgrade and a first day's trading.

  Then apply the migrations, and enter real opening balances through the app:
  - stock on hand, bought outright: **Inventory → Add stock item** with its
    opening quantity and cost (Dr 1200, Cr 3000 Owner equity);
  - stock still owed to a supplier: **Purchasing → Receive stock**, then that
    supplier's bill on **Vendors**;
  - cash: a manual journal, Dr 1000 or 1020, Cr 3000 (since `0024`: cash in
    the till or the safe with **Sales → Move Cash** from the owner; money in
    the bank, a journal Dr 1020, Cr 3000).

  **Done on the live database on 23 September 2026**, at the owner's
  instruction. It had 32 journals, 9 sales, 52 stock movements, 9 items and
  4 products. It now holds the business, its 2 locations, its 16 accounts and
  the owner's place. Run the script once more immediately before 0014, in case
  anything was recorded through the old app in between.

- **B. Keep the history and correct it.** Follow section 5. Every step uses the
  app's own tools, so the history stays and every correction is on the audit
  trail.

## 5. Correcting the history (option B)

Sign in as the owner, and correct the months in order: July, then August, then
September. Date each correction in the month it corrects. The reversal and
cancellation forms, and the control-correction journal, all take a date.

### Step 1: post the stock the old app never journaled

**Reports → Do the books tie? → Stock the old app never journaled** lists the
10 records from items a to c, 546,150 in all. Each one shows the journal it would
post, as the new app posts the same record:

- opening stock: Dr 1200, Cr 3000;
- the count: Dr 5400, Cr 1200;
- the delivery: Dr 1200, Cr 2050 goods received not invoiced, so the supplier's
  bill will clear it.

Check the list against what was really on the shelf, give a reason, and press
**Post these 10 journal(s)**. Do this first: it posts into August and September,
and a locked month would refuse it.

### Step 2: July, bill INV-1041

INV-1041 debited Inventory 640,000 in July, but no goods went into stock. July's
Inventory must be zero on 31 Jul, so the cost must leave Inventory in July. Ask
where those goods went:

- **They are in the opening stock counted on 21 Aug.** That count was posted to
  Owner equity in step 1, so the same goods would be counted twice. Correct with
  Dr 3000 Owner equity, Cr 1200.
- **They were used or thrown away before the count.** Correct with Dr 5000 Cost
  of goods sold (or 5300 Waste), Cr 1200.
- **Both.** Split the 640,000 between the two.

Post it on **Journals → New Journal**:

- tick **Correction to a control account**;
- date it 31 Jul 2026, give the reason, and publish.

Then **Chart of Accounts → 2026-07 → Lock**.

### Step 3: August

- **Bill INV-2207, 380,000.** Correct it the same way as step 2, dated 31 Aug.
- **1014 "Purchase on credit" and 1013 "Supplier payment", 800,000 each.** If
  they did not happen, reverse both on **Journals**, dated 31 Aug. Reverse them
  together, because each cancels the other's effect on payables. If they did
  happen, correct 1014 like INV-2207.
- **1011, 1015, 1016.** If they did not happen, reverse each one, dated 31 Aug.
  This also clears the 15,000 sales difference. If one did happen, keep it: post
  the owner's correction Dr 1200, Cr 5000 (5300 for the waste) for the cost it
  took out of Inventory, and let the next count take the goods out of stock.
- Check **Reports → Do the books tie?** as at 31 Aug: every line should be zero.
  Then **Chart of Accounts → 2026-08 → Lock**.

### Step 4: September, then onwards

- When Erbil Dairy Supply's invoice for the 22 Aug delivery arrives, record it on
  **Vendors → Bills & payments → For goods received**. Choose the delivery marked
  **Before controls · Erbil Dairy Supply**. The bill is recorded against the
  payable already posted; only a price difference is booked, to 5050.
- When shazhir zharo's invoice for the 22 Sep milk arrives, bill it against that
  delivery in the same way.
- Consider the items in "Other things to review" above.
- Close September at month end, as any other month.

### The rehearsal

The sequence above was run on the exact copy of the live data, with one set of
answers:

- both bills' goods counted in the 21 Aug opening stock;
- 1011 and 1013–1016 did not happen.

Every check came to zero, and July and August both locked. The Erbil delivery was
then billed against its payable with no difference, and the books still tied.
Cash on hand ended at +285,000. Different answers change the amounts, not the
steps.

## 6. Any difference, any time

| The check shows                          | Usual cause                                                                   | Correct it with                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Inventory, with records listed in step 1 | stock the old app moved but never journaled                                   | **Post these journals** (owner)                                                                 |
| Inventory, ledger higher                 | a purchase posted to Inventory with no goods received; a journal posted twice | reverse the duplicate; owner's correction moving the cost out of 1200                           |
| Inventory, ledger lower                  | a cost credited to Inventory with no stock movement                           | reverse it if it did not happen; otherwise owner's correction Dr 1200 for that cost, then count |
| Payables                                 | an invoice entered twice; a payable with no bill                              | **Vendors → Cancel** the copy (only if nothing was paid on it); owner's correction to 2000      |
| GRNI                                     | a receipt billed twice or never                                               | cancel the wrong bill; record the missing one                                                   |
| Sales                                    | revenue journals with no sale; a sale with no journal                         | reverse the stray journal; refund or void through **Orders**                                    |

The rules behind every correction:

- **Never edit.** Published entries, sales, movements and bills cannot be changed.
  A mistake is corrected by a new entry, and both stay on the record.
- **Correct through the record where there is one:** void or refund a sale, cancel
  a bill, count the stock. **Reverse** is offered only for entries no record
  stands behind (manual journals, expenses, corrections, year-end closes) and for
  anything from before the controls.
- **Only the owner posts to a control account** (1200 Inventory, 2000 Accounts
  payable, 2050 GRNI, 3100 Retained earnings), with the reason recorded on the
  audit trail.
- **Close months in order.** A locked month refuses every posting. Reopening it is
  the owner's alone, with a reason.

## 7. How this is proven

- `tests/sql/upgrade/1-history.check.sql` rebuilds the live database's migration
  history in its exact order, loads history written the way the old app wrote
  it, applies 0014 onward and checks that nothing was lost or altered. The
  history includes a duplicated receipt journal, a purchase counted twice, a
  duplicate invoice, a card sale posted to cash, unjournaled stock and a
  delivery posted straight to payables.
- `tests/sql/upgrade/2-remediation.check.sql` applies the procedure above to
  that history, one tool at a time. It ends with every check at zero and August
  locked, and it proves no pre-existing line was touched.
- The rehearsal on the live copy (section 5) ran the same tools on the real
  records.
