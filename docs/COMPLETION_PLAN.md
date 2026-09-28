# Completing the operations system: implementation analysis

**Status:** analysis finished on 27 September 2026, before any change was made.
Release J (duplicate protection, `0035`), release K (cash sessions, `0036`),
release L (refunds by the item, `0037`), release M (delivery corrections and
the books checked account by account, `0038`), release N (usage against the
recipes, `0039`) and release O (the café's rules, `0040`) are live since 27
September 2026, and release P (sizes and add-ons, `0041`), release Q (split
payments, `0042`), release R (US dollars at the till, `0043`), release S
(purchase orders, returns to a supplier and their credit notes, `0044`),
release T (the buying list, `0045`) and release U (batches, their use-by dates
and lots, and the day's plan, `0046`) since 28 September.
What was built differs from the plan below in these ways.

Release J:

- **Keys.** The key is the last parameter, and the original is renamed
  `<name>__run`, instead of a second function under the same name, which made
  SQL calls ambiguous. The database protects every call that carries a key; the
  app sends one on every call (the contract test fails a call without one); from
  release K, a call through the API without a key is refused.
- **Location on the audit trail.** `audit_log.location_id` waits for tills with a
  branch (release AB), since nothing can fill it until then.

Release K:

- **Location on journal lines** moves to release AB with the audit trail's: with
  one branch trading, nothing but that branch could fill it. The over/short and
  takings journals name their session instead.
- **The opening's difference** posts with reference `session_opening`, and the
  close's with `work_shift`: each source is posted once
  (`journal_entry_one_per_source`), and a session can have both.
- **Taking over.** The first session on a drawer opens against what the drawer
  counts before sessions left, plus the cash since; on a drawer never counted,
  against what the books say the till holds. A closed `drawer` record is
  written for it first, so the take-over is on record.
- **A float at the opening.** A manager opening the drawer can put cash in from
  the safe in the same step (Dr 1000, Cr 1005).
- **No `status` column.** A session is open while `closed_at` is null, as the
  drawer counts were; `opened_from` records a hand-over.
- **`count_drawer`** closes the open session, counted, and is revoked in release
  L; the screen that called it is gone.
- **Keys from the API.** The refusal applies to the function the API called
  (`request.path` ends in `/rpc/<name>`), so the writes a keyed write makes
  inside it are not refused.

Release L:

- **A refund is the sale's adjustment.** `sale_refund` takes the id of the
  `sale_adjustment` of kind `refund` it is. The cash-refund trigger, the
  reports, the exceptions and the daily brief read refunds as before, and
  none of them needed changing: with one payment per sale, the cash part of a
  refund is all of it. Allocating a refund among payments comes with split
  payments (release Q), and so does the `tenders` parameter:
  `refund_sale_lines` gives the money back to the sale's one payment.
- **No `idempotency_key` column.** The refund is keyed like every write since
  release J, in `request_log`.
- **The movement's line is not a foreign key.** `post_sale` writes a line after
  the movements that cost it; the SQL suite checks that every movement names a
  line of its own sale.
- **Sales from before `0037`** that took stock are refunded whole: their
  movements name no line.
- **Approval stays optional**, as the owner decided: a second person's PIN,
  or the refund waits for the owner's review on the Exceptions report. The
  limit above which a refund needs one is a rule on Settings, in release O.
- **What a platform owes.** `platform_money` and the statement match read what
  is left of an order part-refunded; card takings, daily sales and the
  exceptions already read the refund adjustments.
- **`count_drawer`** is revoked, as release K planned.

Release M:

- **A correction's kinds are a list.** One correction may change several
  things at once (the quantity of one line and the price of another), so
  `receipt_correction.kinds` lists them, and the delivery's before and after
  are kept whole, not line by line.
- **A price is corrected as a pair of movements.** The stock still on the
  shelf goes out at its value and comes back in at the corrected one (two
  `cost_adjustment` movements), instead of one movement of no quantity, which
  the stock ledger's value-per-unit rules refuse.
- **What is still on the shelf** is the delivery's share of the stock after
  every use since (average cost spreads each use over all of it): a price
  corrected revalues that share, and the rest goes to 5050.
- **The date** is corrected within the month the delivery was entered, and
  never after today; its stock's own date does not move. One entered in the
  wrong month is reversed and received again.
- **The permission** is `inventory.adjust.approve` (who approves stock
  adjustments), not a new one.
- **Supplier balances against 2000** were already the payables check; it is
  kept as it was.
- **The safe (1005) takes no manual journal** from `0038`, like the till's
  cash: otherwise its check could never hold.
- **Platform sales from before order numbers** are owed too, explained by
  payouts typed by hand as far as they go, as `LIMITATIONS.md` said they
  would be; the live database has two.
- **The drawers' check** holds the books to the drawers only once a drawer has
  been counted in a session, as the first opening settles what came before.
- **No `idempotency_key` column.** Corrections are keyed in `request_log`,
  like every write since release J.

Release N:

- **The stretch between counts runs by when things were recorded.** Each
  count compares an item with the ledger at the moment it is counted, so the
  movements taken are those recorded after the first count's line and up to
  the last's, not those dated in between.
- **The window is the first and the last count in the dates.** Counts in
  between set nothing: their own adjustments are left out, and the
  difference is what the later counts found short.
- **Sales volume** is shown per product, from the sale lines the movements
  name (since `0037`); a sale voided is left out of it.
- **The branch** is the location asked for, the default one when none is
  given.
- **The alert** reads each item's last two counts, the later in the last 14
  days, with two thresholds on Settings (10% and 5,000 IQD).

Release O:

- **The scopes are the café, a role, a kind of item and an item.** Items have
  no categories of their own, so "category" is the kind of item (finished
  good, sub-recipe, ingredient…). A branch's own rule is kept for release AB.
- **The defaults are rows of their own.** Nobody's name is on them: the
  business row's old columns while they last, and the owner's decisions of
  §L.3 for the rest (refunds over 25,000; losses added up over the person's
  session; made items refused below zero, the rest alerted). A rule set back
  to its default keeps its row, with a null value, so its history stays.
- **The history is written by the rule's own trigger,** before the row, in the
  same statement; a rule is never deleted.
- **Losses:** over the limit, a manager's PIN on the spot, or the person saves
  it to wait; waiting, it is already in the stock and the books, and a manager
  other than its recorder approves it or reverses it. The person's window is
  their open cash session, or the day when they have none.
- **Stock below zero** is judged by every function that takes stock out
  today: sales and bills, losses, batches, corrections by hand and deliveries
  corrected. Giveaways, transfers and returns will ask when they are built.
- **The target margin** stays among the alert thresholds, which already have
  their history on the audit trail.
- **A cashier refunding with a manager's PIN** (decision 3) is not added:
  refunds stay with managers, with the limit above which a second person
  approves.

Release P:

- **Sizes are added on the product's card,** not on the new-product form:
  `create_product` keeps its signature. `add_variant` adds a size with its
  prices and one of: its own recipe, the recipe another size has in force
  today, or why it uses no stock; the product's one size is named in the same
  step (Latte becomes Regular).
- **A size is retired with a reason,** kept on the audit trail; the last size
  on sale is not retired (the product is hidden instead), nor one on an open
  bill.
- **An add-on's recipe is not dated:** a change applies from the next sale,
  and the audit trail keeps it before and after. Every sale keeps what it
  used.
- **An add-on's stock movements** name the sale's line, with the add-on's name
  in their reason, rather than an add-on of their own.
- **A group taken off the till** stays with the products that already offer it
  until they are changed; the till no longer offers it, and no product takes
  it up anew.
- **The report** leaves refunds in (Sales by Channel takes them off), and
  counts how often an add-on is taken against the lines of the products that
  offer its group today.

Release Q:

- **A payment keeps the cash handed over.** Each payment is `{type, amount,
received}`: `amount` is its part of the sale, `received` the cash handed
  over for it, and the change (`change_given`) is worked out from the two.
  The change is not in the books: the cash line is the cash part.
- **One tender or the list, not both.** `p_tender` stays for a till loaded
  before `0042`; the till sends the list, even for one payment, so the cash
  handed over is kept.
- **A void takes back what the sale put in the drawer:** its cash payments,
  read from the drawer's own events, not its net.
- **A refund of a sale paid two ways** gives back each way at most what is
  left of it: as the refunder chooses, or, when not said, in proportion, with
  the rounding the discount uses. Its cash part alone leaves the drawer: the
  drawer's event moved from the refund's adjustment to its cash payment.
  `refund_sale` gives back what is left of each way.
- **Two figures that counted a sale's one payment** were put right: the
  drawer's count of orders counted a split sale twice, and the day's cash
  refunds counted a whole refund as cash when the sale had any.
- **Limits:** ten payments at most, a platform's order paid once, amounts in
  whole units. The till offers four payments and one cash part.
- **Card takings** needed no change: 1010 now takes the card parts only.
- **The report** is by way of paying over the dates (Reports → Sales by
  payment method), not by day.

Release R:

- **The dollars have a drawer of their own** (`fx_cash_event`, the till's and
  the safe's), beside the dinars' and never mixed with them. `cash_event`,
  `cash_transfer` and the sessions' dinar figures did not gain a currency:
  every reader of the dinar drawer reads as before.
- **A payment in dollars is cash:** `{type: 'cash', currency: 'USD', usd,
rate, amount}`. The till sends the rate it showed; the database values the
  dollars at the rate now, to the nearest step of a rule (`usd_round_to`,
  250), and refuses the payment when the rate changed or is older than a
  second rule allows (`usd_rate_max_age_hours`, 36). `received` is what the
  dollars are worth; the change is in dinars, out of the dinar drawer, which
  must hold it. The rate is checked after a retry is recognised, so a sale
  sent again after the rate changed is the sale recorded.
- **No dollar float, and no opening count of dollars.** At every close the
  till's dollars are counted, blind, and all go to the safe (Dr 1006 / Cr
  1001), in one journal with any difference (6300). A close that does not
  count them leaves them in the till for the next. The count is kept in
  `session_dollar_count`, not on the session, so the dinar close is unchanged.
- **Dollars are carried at what they were taken at** (a place's average), and
  dollars leaving take their share of it, the last of them the rest.
- **One exchange function** (`exchange_dollars`): from the till or the safe,
  into the till, the safe or the bank, the difference to 6950. There is no
  function to move dollars between the till and the safe: they go to the safe
  at each close.
- **The rate is set on Sales → Dollars,** where the managers who set it
  (`fx.rate`: owner, general manager, branch manager) and the dollars held
  are; Settings shows the two rules.
- **The books** check the dollars held against 1001 and 1006 (a tenth check),
  and the safe's check takes the dinars exchanged into it.
- **Formats** still show dinars as IQD: the business has one currency; the
  dollars are shown as $.

Release S:

- **`save_po` instead of `create_po`:** one function drafts an order and
  changes a draft. An approved order changed goes back to being a draft, to be
  approved again; one sent is not changed (it is cancelled while nothing has
  come, or closed).
- **Five statuses, not seven:** `draft`, `approved`, `sent`, `closed`,
  `cancelled` (text, not the old `po_status` type). "Partly received" and
  "received" are what has come, worked out from the deliveries as they stand
  after their corrections, so a delivery corrected or reversed moves its order
  back. `purchase_order_line.received_base` is worked out the same way, not
  stored. The screens show the seven stages.
- **`expected_on`** (a day) instead of `expected_at`; sending, closing and
  cancelling keep who and when, closing short and cancelling a reason.
- **Approval by a rule:** `po_approve_up_to` (the café 250,000; the owner and
  the general manager 1,000,000,000), set by role on Settings, and a new
  permission `purchase.approve` (owner, general manager, branch manager). An
  order over the approver's limit waits for someone whose limit covers it.
- **Receiving against an order:** the order approved or sent, the delivery from
  its supplier and for its place; each line may name its order line. More than
  is still on order is asked about first, with the price check, and the
  confirmation goes on the audit trail. An item not on the order is received,
  and shown as such.
- **A return's stock leaves at what it costs now,** not at the delivery's cost:
  the average already moved when the delivery came. The supplier owes back
  what the delivery charged for it (its landed share), or, with no delivery
  named, its cost now; the difference goes to 5050. Before the delivery's bill,
  the return comes off what the bill will clear (2050); after it, it is owed
  back on the account (2000), as a credit of kind `goods_return` set against
  the bill as far as the bill is owed. A delivery goods went back from is no
  longer corrected, and one all of whose goods went back is not billed.
- **A credit is dated the day it is recorded:** there are no back-dated
  credits. A lower price revalues what is left on the shelf of the delivery it
  names (cost adjustments), the rest to 5050, and is set against that
  delivery's bill; "other" comes off an expense or asset account the owner
  chooses (not cash, the card's, the bank's or stock). A return's credit waits
  for the supplier's own note, whose number is then recorded against it.
- **A bill is paid by payments and credits:** its paid amount is both, so a
  bill can be settled by a credit alone, and a bill with a credit set against
  it is not cancelled. The payables check takes the credits off.
- **The statement** (`supplier_statement`) is on Vendors, between two dates, to
  print; Reports → Purchasing has the orders, the prices that changed, the
  returns and the credits.

Release T:

- **`item_supplier`** keeps the pack as one of the item's units and a pack's
  price with the day it was agreed (`last_price`, `last_price_on`);
  `preferred` is the item's usual supplier, one at most. It is set on the
  item's page (`set_item_supplier`, `remove_item_supplier`, both
  `purchase.create`, keyed) and remembered from the orders drafted from the
  list. A supplier new to an item, one made or unmade its usual one, and
  anything set by hand go on the audit trail (`item.supplier.set`,
  `.remove`); a pack or price kept from an order is on that order's own trail.
- **The list is for a location** (the first branch when none is named). What
  an item has is what is on hand there, what its approved and sent orders
  still wait for (from the deliveries as corrected), and what its draft orders
  hold, so nothing drafted is suggested again.
- **Use a day** is what the stock card counts as sold, used in batches, and
  wasted or given away (voids, refunds back on the shelf and losses taken back
  netted off) over the last 28 days, or the item's history there when
  shorter. Under 7 days of history there is not enough to judge by, as running
  out judges; an item not used in 28 days needs nothing.
- **The reorder level** is the item's own when it has one; otherwise the use
  until a delivery comes and a day more (running out's rule), and the safety
  stock. An item is ordered when what it has is below it (as the alert says), up to its par
  level, else the most it holds, else the reorder level and a week of use (the
  alert's week), in whole packs, one at least.
- **The supplier** is the usual one, else the one the item's last delivery in
  the last year came from, else the one last set. **A pack's price** is the
  newer of the one agreed and that supplier's last delivery's (the goods'
  price, before freight), else what the item costs now, marked to be checked.
  Every supplier the item came from or is set with is offered, each with its
  own pack and price.
- **`purchase_orders_from_list(lines, location)`** drafts through `save_po`,
  one order for each supplier, expected in the supplier's own delivery days
  (the café's when it has none), with no note: an order's note is printed for
  its supplier. Lines may make a supplier the item's usual one.
- **No separate report:** the list, each line with its reasons and numbers, is
  the report. Items made here (an active batch recipe's output) are left to
  Production.
- **The alerts lead to it:** running out and below the reorder level, for an
  item bought, link to What to buy instead of the item's card (0040's rules
  wrapped, unchanged otherwise).

Release U:

- **Split, not new movements.** A movement of an item tracked by lot is split
  by lot in `lot_movement`, by a trigger on `inventory_movement`, instead of
  one movement per lot: every writer of stock stays as it was, and the stock
  card, the books and the reports read the movements as before. Each lot
  keeps what it holds (`item_lot.left_base`) with its rows, and an item's rows
  at a place add up to its stock there.
- **Tracked from its first batch.** An item made in batches is tracked by lot
  (`track_lot`) from its first batch after `0046` (the recipe outputs already
  there from the migration itself); what it had then is stock with no lot,
  which leaves before any lot.
- **The order.** Out: stock with no lot first, then the lots by the earliest
  use-by, a lot past its use-by last (it is not to be sold); what is thrown
  away as expired, or found missing on a count, from what is past its use-by
  first. In: a batch's output to its own lot, which takes over what was sold
  beyond the stock before it came (the latest sale first); a return (a void,
  a refund back on the shelf, a loss taken back, a batch cancelled) back to
  the lots it left, the earliest use-by first; anything else (a count that
  finds more, a delivery) as stock with no lot. A revaluation is not split.
- **Counts are by item**, not by lot: the difference is allocated by the same
  order.
- **Returns name their source**: the sale, its line, the batch or the loss.
  `void_sale` now locks its items first, as every other writer of stock does,
  and `review_loss` names the loss its reversal takes back.
- **A batch made earlier** (more than an hour before it is recorded) is
  recorded by a manager (`inventory.adjust.approve`), with a reason,
  yesterday's at the earliest, not in a locked month, and not before the last
  approved count of its items there; its stock moves when it was made, by the
  recipe in force that day.
- **The plan's demand** is what the stock card counts as sold or used in
  batches, of what the recipe makes, on the same weekday over the last 4 to 8
  weeks there were (fewer than 4: not enough to judge by), on average; what is
  due before the day is out is not good for it; the batches are whole; the
  ingredients short are given for each recipe and for all together. A base is
  not planned for the flavours to be made from it.
- **The alert** (`use_by`) is orange within a day of the use-by and red once
  past it, and opens Production's list of what is in stock by batch.
- **Reports → Production** lists the batches made in the dates, with what came
  out of what was planned and what became of each.

Release V:

- **Two migrations** (D14): `0047` adds the kinds `production_waste` and
  `preparation_waste` alone, and `0048` uses them. The plan numbered release V
  `0047`: release W and those after it move up by one (`0049` staff, `0050`
  customers, and so on).
- **A loss is a document** (`stock_loss` and its lines), not a movement: an
  item in any of its units, or a product as its recipe makes it to eat in (at
  the till, as the till's channel makes it, with its add-ons). One movement
  for each item (and batch named), one journal for all of it: Dr the kind's
  account, Cr 1200 Inventory. `record_waste` stays, writing its loss the same
  way and answering as it did, its movement the loss's first.
- **The accounts**: 5300 for waste, spoilage, expired, damaged and melt; 5310
  Production and preparation loss, which, like 5300, takes no bill, expense
  or supplier's credit; 6110 Staff meals, 6610 Complimentary items and 6620
  Marketing samples, which are expenses a bill may be charged to too (a staff
  meal bought outside, say).
- **A giveaway is not an order.** The plan had `post_sale(… p_giveaway)`
  record an order with no revenue. The sales reports, the drawer's figures,
  the order counts and the average ticket count every order not voided, so an
  order with no revenue would be counted in each of them. A giveaway is
  instead a loss of its kind from the till, of what is in the cart with its
  add-ons, with a turn number so the bar makes it from its ticket. Its
  approval is the loss rules', with a manager's PIN at the till: nothing
  waits there. It is not on Orders; Reports → Losses lists it.
- **The rules** are 0040's, on the loss's whole value and on each of its
  items': the limit, the person's window, the item's day. A loss that waits is
  approved or reversed whole, by any of its movements; reversed, each movement
  goes back to the batches it left and the one journal is reversed.
- **A batch named**: the loss comes off it, and no more than it holds is
  accepted; without one, the loss is taken as sales take stock.
- **The report** (`report_losses`): by kind with its account, by item, by
  person and by day, the giveaways by kind, and each loss (the latest 300),
  what waits and what was reversed apart. A loss from before `0048` is one
  movement, counted as it was posted, to 5300.
- **The alerts**: waste well above its usual counts 5310 with 5300; running
  out counts the new kinds as use; the losses waiting are counted a loss at a
  time.
- **The checks**: `document_problems` finds a loss worth something with no
  journal, and a journal whose loss does not exist; a loss recorded whole is
  never offered as stock the old app did not journal.

**Basis:**

- The code at `d17436e`: migrations `0001`–`0034` and the app.
- The live database, read only (one branch, a central kitchen, one person per role, test records).
- The audit of September 2026 ([`SYSTEM_AUDIT_2026-09.md`](SYSTEM_AUDIT_2026-09.md)).

**Brief:** the owner's master prompt of 27 September 2026:

- Complete the system without rebuilding what works.
- Record an operation once and let the system carry its consequences everywhere.
- Accuracy and control come before convenience.

**Reading guide:**

- Sections **A–K** are the analysis the brief asks for. **§L** gives the order of work, the decisions only the owner can make, and the risks.
- "Release J", "release K", … continue the lettering of releases A–I already published. A **section** is always written **§**, for example §E.

---

## Summary

**What stays exactly as it is.** These are sound and tested. New work plugs into them and does not replace them:

- the posting engine (every sale, delivery, bill, payment, expense, count and loss becomes a balanced, numbered, unchangeable journal);
- the append-only stock ledger with moving-average cost;
- dated recipes and prices;
- blind two-person stock counts;
- exactly-once quick sales and bill payments;
- the till with its bills, discounts, turn numbers and two printed copies;
- reasons and manager PINs for voids, refunds and large discounts;
- card and platform settlements;
- month locks;
- the audit trail;
- the alert engine;
- the three languages.

**What is half built.** The database already anticipates much of what the brief asks for:

- several payments per sale (`sales_tender`);
- a "part-refunded" sale status;
- several sizes of a product (variants, each with its own recipe, already offered by the till);
- an unused add-ons column;
- purchase-order tables;
- a `supplier_return` stock movement;
- the kinds of loss (staff meal, complimentary, sample, expired, damaged);
- lots and use-by columns;
- a location on almost every record;
- a location on each person's role.

None of these is used yet. Extending them is cheaper and safer than adding parallel structures.

**What is missing.** Cashier sessions and a blind cash count; partial refunds; duplicate protection beyond sales; delivery corrections, supplier returns and credit notes; purchase orders and a buying list; usage variance; add-ons; split and US-dollar payments; production planning with batch traceability; loss classes with their own accounts; aggregated waste approval; rules on a settings screen; staff and payroll; customers and loyalty; the balance sheet and cash-flow statement; PDF and attachments; real multi-branch operation.

**The structural changes that make the rest possible:**

1. **One protection against double recording for every operation**, not just sales (a request log in the database).
2. **The drawer belongs to a cashier's session**, and is counted before its expected amount is shown.
3. **A sale can carry several payments and be refunded line by line.** Each stock deduction points to its sale line.
4. **Every journal line carries its branch**, so a branch's profit and loss is exact from the day it opens.
5. **Business rules live in a table the owner edits on Settings**, per role, branch, category or item, with history.
6. **A value-only stock movement.** It revalues stock on hand when a supplier's price is corrected or credited; stock can't do that today.

**How the work is ordered:**

- 19 releases in four stages: **P0** integrity, **P1** operational completeness, **P2** staff and customers, **P3** reports, statements and branches.
- Then a full UX and integration pass.
- Each release is built, tested and published on its own, as releases A–I were.

None of the owner's decisions (§L.3) blocks P0.

---

## A. Already implemented correctly — keep unchanged

New features must use these as they are. Where a line says "extend", the extension is additive and the existing behaviour is kept and re-tested.

| Area                                       | What works                                                                                                                                                                                                 | Where                                                                                                 | What new work must respect                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Quick sales                                | Recorded exactly once: a retry with the same key returns the original sale. The price and total the till showed are checked by the database.                                                               | `record_sale` → `post_sale`; `sales_order.idempotency_key` unique; `assert_sale_total`                | Split payments, add-ons and giveaways extend `post_sale`; they do not bypass it         |
| Bills                                      | Open, save, split, move, cancel, print, each under a version check. Printing freezes prices. After printing, only a manager changes the discount or takes a line off, and every line taken off is audited. | `open_tab`, `save_tab`, `split_tab`, `cancel_tab`, `mark_bill_printed`, `settle_tab`, `lock_open_tab` | Add-ons ride on bill lines; payment of a bill keeps going through `settle_tab`          |
| Discounts                                  | A percentage is rounded to 250 IQD. Above the 10% cap a manager's PIN is needed. The discount is spread over the lines by largest remainder.                                                               | `sale_discount`, `discount_approver`, `approval`, `use_approval`                                      | The cap and the rounding move to rules (release O); the logic stays                     |
| Voids and full refunds                     | Reason from a list and optional second-person approval. A void is exact and allowed until the drawer holding its cash is counted.                                                                          | `void_sale`, `refund_sale`, `reason_code`, `report_exceptions`                                        | A full refund becomes "refund every remaining line" of the new refund engine            |
| Receipts and barista tickets, turn numbers | Two copies in one print job; the customer's number for the day                                                                                                                                             | release I, `take_turn_no`                                                                             | Numbers become per branch in release AB                                                 |
| Delivery platforms                         | Order number required and unique; statements matched order by order; payout posted                                                                                                                         | `record_sale`, `platform_money`, `post_platform_settlement`                                           | Partial refunds and split payments feed `platform_money`                                |
| Stock ledger                               | Stock is the sum of append-only movements. Moving average cost per location. Every consumable counts.                                                                                                      | `inventory_movement`, `item_position`, `item_issue_cost`                                              | Every new operation writes movements; nothing stores a stock figure                     |
| Recipes and prices                         | Dated versions, scheduled changes and packaging by channel. Costs are frozen at sale and price history is kept.                                                                                            | `expand_variant`, `recipe_version_on`, `price_on`, `set_price`                                        | Sizes are variants; add-ons get recipes the same way                                    |
| Stock counts                               | Blind, two people, the ledger quantity captured when each item is counted, approved by someone else                                                                                                        | `start_stock_count` … `approve_stock_count`                                                           | Usage variance reads these counts as they are                                           |
| Receiving                                  | Price per unit with a ±25% check and confirmation. Landed costs spread exactly. GRNI (goods received not invoiced).                                                                                        | `receive_goods`, `allocate_landed`                                                                    | Purchase orders pre-fill it; corrections and returns net against it                     |
| Supplier bills and payments                | Bill against a receipt (Dr 2050, ±5050, Cr 2000) or an account. Café bill numbers. Duplicate invoice refused. Overpayment refused.                                                                         | `record_bill`, `pay_bill`, `cancel_bill`, `purchase_invoice` guard                                    | Credit notes join payments in the balance of a bill                                     |
| Production                                 | Batches of bases and flavours at exact input cost; cancellation reverses exactly                                                                                                                           | `record_production`, `cancel_production`, `save_batch_recipe`                                         | Batch numbers, use-by dates and lots are added around them                              |
| Posting engine                             | Draft → publish; balanced, non-zero, at least two lines; gapless numbers; one journal per source document; published entries immutable; reversals                                                          | `post_journal`, `validate_journal_entry`, `next_document_no`                                          | Every new transaction posts through `post_journal`                                      |
| Periods                                    | Monthly periods; a lock checklist that blocks; owner-only reopening; year-end close into 3100                                                                                                              | `lock_period`, `period_close_checklist`, `post_year_end_close`                                        | New checks are added to the checklist                                                   |
| Cash                                       | Every till movement is an event. The till and the safe can't go below zero. Over/short to 6300. Takings to the safe or bank.                                                                               | `cash_event`, `cash_transfer`, `pay_out_of`, `move_cash`                                              | Sessions attach these events to a cashier                                               |
| Card money                                 | Takings settled against the terminal and the bank; fee to 6500; differences to 6300                                                                                                                        | `record_card_settlement`                                                                              | Split and partial-refund amounts feed the card takings                                  |
| Reconciliation                             | Stock vs 1200, payables vs 2000, GRNI vs 2050, sales vs revenue                                                                                                                                            | `report_reconciliation`                                                                               | New subledgers join the same report (release M)                                         |
| Security                                   | 9 roles and 25 permissions, checked by the database. Read-only row security. Writes only through 112 checked functions. The public key reaches nothing.                                                    | `role_permission`, `require_permission`, `0016`                                                       | New permissions follow the same three-place pattern (SQL, `permissions.ts`, page gates) |
| Approvals                                  | Manager PIN (bcrypt), good once for 10 minutes, for the person who asked                                                                                                                                   | `request_approval`, `use_approval`                                                                    | Reused for waste, negative stock and refunds above a limit                              |
| Audit trail                                | Append-only, with before/after values. Triggers on master data; explicit events in sensitive functions.                                                                                                    | `audit_log`, `audit_event`, `audit_change`                                                            | Every new function writes its events                                                    |
| Alerts                                     | 16 rules, kept, answered, snoozed, resolving themselves; red/orange; each with an action                                                                                                                   | `alert`, `alert_conditions`, `refresh_alerts`                                                         | New rules are added to the same engine                                                  |
| Languages                                  | English, Arabic, Kurdish (right-to-left), owner-added languages and phrases, database messages translated                                                                                                  | `src/lib/i18n`, `app_words`                                                                           | Every new screen and message is added to the dictionaries in three languages            |
| Tests                                      | 24 SQL files and a concurrency script (PostgreSQL 16 and 17); 13 browser suites; 287 unit tests; a gateway that can lose any function's answer after it commits                                            | `scripts/test-sql.sh`, `scripts/test-e2e.sh`, `tests/e2e/gateway.mjs`                                 | Every release adds to them; none is weakened                                            |

---

## B. Partially implemented — extend

| #   | Capability                | Exists today                                                                                                                                                                                     | Missing                                                                                                            | Extension                                                                         | Release        |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------- |
| B1  | Several payments per sale | `sales_tender` allows many rows; `mixed`/`other` tender types                                                                                                                                    | `post_sale` writes one row for the whole net; the drawer, refunds and card takings assume one                      | `post_sale` takes a list of payments; the drawer takes each cash payment's amount | Q              |
| B2  | Partial refunds           | Status `partially_refunded` and its transitions; net and cost stored per line                                                                                                                    | `refund_sale` refunds everything; stock movements point to the order, not the line; `sale_adjustment` has no lines | Refund documents with lines; each movement carries its sale line                  | L              |
| B3  | Sizes                     | Variants, a recipe per variant, the till's size chooser                                                                                                                                          | `create_product` makes one variant; no screen adds another                                                         | Sizes in the product form; add, edit and retire a size                            | P              |
| B4  | Add-ons                   | Unused `sales_order_line.modifiers` column                                                                                                                                                       | A catalogue, prices, recipes, bill lines                                                                           | Add-on tables (§E)                                                                | P              |
| B5  | Cash drawer               | `work_shift`, `cash_event`, `cash_transfer`, `count_drawer`, `sales_order.shift_id` (never set)                                                                                                  | Cashier, opening, handover, blind closing                                                                          | Cashier sessions on `work_shift`                                                  | K              |
| B6  | Kinds of loss             | Movement types `staff_consumption`, `complimentary`, `sampling`, `expired`, `damaged`, `spoilage`, `melt_evaporation`, `waste`                                                                   | All post to 5300; refusal checked per entry; no review; staff meal also a discount reason                          | Accounts per kind; aggregated approval; giveaways at the till                     | O, V           |
| B7  | Purchase orders           | Tables `purchase_order`, `purchase_order_line`, status enum, `goods_receipt.purchase_order_id`                                                                                                   | No function or screen writes them                                                                                  | The PO workflow; receiving against it                                             | S              |
| B8  | Supplier returns          | Movement type `supplier_return`                                                                                                                                                                  | Nothing writes it                                                                                                  | A return document                                                                 | S              |
| B9  | Credit notes              | The bill guard's message "record a credit note instead"                                                                                                                                          | No table or function                                                                                               | Supplier credits, applied to bills                                                | S              |
| B10 | Reorder                   | `running_out` and `below_minimum` alerts; minimum and par levels; supplier lead time                                                                                                             | A list to act on; pack sizes; open orders                                                                          | The buying list                                                                   | T              |
| B11 | Production                | Batches, output item, `production_batch.expiry_date`, `item_lot`, `item.track_lot`                                                                                                               | Batch numbers, use-by dates, lots, a plan                                                                          | Lots for made items; the day's plan                                               | U              |
| B12 | Branches                  | A location on sales, bills, tables, stock, receipts, counts, production, cash, platform orders and expenses; a branch price in `channel_price`; a location on each role; transfer movement types | The app always uses the first branch; journals and roles ignore location; no transfers                             | Location on journal lines now; the rest in AB                                     | K, AB          |
| B13 | Business rules            | Columns on `business`; alert thresholds editable                                                                                                                                                 | Everything else only in SQL; `role_permission` and `reason_code` global                                            | A rules table and screen                                                          | O              |
| B14 | Negative stock            | One business-wide switch, checked only by sales                                                                                                                                                  | Policies; checks on losses, batches, corrections                                                                   | Policies by item and category                                                     | O              |
| B15 | Duplicate protection      | Sales and bill payments                                                                                                                                                                          | About 45 other write functions                                                                                     | The request log                                                                   | J              |
| B16 | Audit                     | Immutable log, before/after values                                                                                                                                                               | Receipts, bills, payments, expenses, losses, batches, journals and count steps write no event; no branch column    | Events everywhere; a location column                                              | J              |
| B17 | Reports                   | P&L, trial balance, daily sales, channels, margins, exceptions, stock card, account ledger, uncosted sales                                                                                       | Sales by hour/weekday/product/size/add-on/person/payment/branch; losses; usage; balance sheet; cash flow; PDF      | §J                                                                                | N, V, Y, Z, AA |
| B18 | Reconciliation            | Four subledger checks, card and platform matching                                                                                                                                                | Card clearing, drawer, safe and supplier credits against the ledger; source-document integrity                     | More checks, also at month end                                                    | M              |
| B19 | Customers                 | A name typed on a bill                                                                                                                                                                           | Profiles, addresses, history, loyalty                                                                              | Customers and loyalty                                                             | X              |
| B20 | Staff                     | Logins and roles                                                                                                                                                                                 | Employees, schedules, attendance, payroll                                                                          | Staff and payroll                                                                 | W              |
| B21 | Files                     | Product photos kept in the database                                                                                                                                                              | Invoices, delivery notes, credit notes                                                                             | Storage with access rules                                                         | AA             |

---

## C. Missing — build

| Priority     | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0**       | Request log and a "checking…" retry for every write · cashier sessions and handovers · blind cash count · partial refunds · delivery corrections (quantity, price, item, supplier, date) · new reconciliations and ledger-integrity checks · usage variance with its alert                                                                                                                                                                                                                                   |
| **P1**       | Rules on Settings (discount caps per role, rounding, waste limits and window, negative-stock policies, target margin) · aggregated waste approval · sizes on screen · add-ons · split payments · US dollars at the till with a stored rate · purchase orders · supplier returns · credit notes · buying list · the day's production plan, use-by dates, batch lots and batch reconciliation · loss classes with their own accounts · giveaways (staff meal, on the house, sample) at the till · waste report |
| **P2**       | Employees · shift schedules · clock-in/out · lateness, absence, overtime · payroll runs, advances, deductions and salary payments · customers with phone and addresses · order history · loyalty                                                                                                                                                                                                                                                                                                             |
| **P3**       | Sales analysis (hour, weekday, date, product, category, size, add-on, person, payment, branch) · purchases, supplier statements, stock valuation, production and cash-session reports · balance sheet · cash-flow statement · PDF · document attachments · branches (tills per branch, branch roles, transfers, branch numbers and prices, consolidated reports)                                                                                                                                             |
| **After P3** | The UX and integration pass (§L.5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Deliberately not built** (unchanged from the audit):

- AI that decides or accuses anyone;
- automatic orders to suppliers, and automatic price or stock changes;
- FIFO or lot _costing_ (lots track quantity and dates; cost stays the moving average);
- barcode scanning;
- tax, which is out of scope at the owner's request.

**One change from the audit:** payroll was listed there as "avoid inside the till system". The brief asks for it as its own operational process, so it is built as its own screens, not inside the till.

---

## D. Architecture conflicts and how each is resolved

| #   | Conflict                                                                                                                                                                                                                                                                                                                                   | Evidence                                                                                                                                              | Resolution                                                                                                                                                                                                                | Release       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| D1  | **Only sales and bill payments are protected against double recording.** About 45 functions insert new records on every call. `open_tab` opens a second bill. `count_drawer` retried after a lost answer compares the count with what was left in the drawer: it books a false over/short and moves the takings to the safe a second time. | `record_sale` is the only function with a key; `settle_tab` replays by bill status                                                                    | A **request log**: each write takes a key; the first call stores its answer in the same transaction; a retry returns it. The app always sends a key; from K, an API call without one is refused.                          | J, K          |
| D2  | **The drawer belongs to a location, not a person.** A count sweeps every uncounted event and opens and closes the shift in one call. The expected amount is shown first.                                                                                                                                                                   | `count_drawer`, `drawer_status`, `DrawerCount.tsx`                                                                                                    | Sessions on `work_shift` with a cashier, an opening count and a closing count. Events attach to the open session as they happen. `expected` is returned only after the count, or to holders of `cash.view_expected`.      | K             |
| D3  | **One payment per sale everywhere.** The cash-refund trigger removes the whole refund if any payment was cash. The drawer report joins sales to payments. Refunds read the first payment.                                                                                                                                                  | `post_sale`, `refund_sale`, drawer triggers, `drawer_status`                                                                                          | Payments as a list. Each cash payment is an event of its own amount. Refunds allocate to payments. Reports count orders, not payment rows.                                                                                | L, Q          |
| D4  | **Refunds are all or nothing, and stock movements point to the order, not the line**                                                                                                                                                                                                                                                       | `refund_sale`; movements `reference = sales_order`                                                                                                    | Refund documents with lines. `post_sale` writes the sale line on each movement from release L on. Sales recorded before that can only be refunded whole (all are test records).                                           | L             |
| D5  | **No currency dimension:** one business currency, one cash account; "IQD" hard-coded in the till, alerts and formats                                                                                                                                                                                                                       | `business.currency_*`, `fmtIQD`, alert titles                                                                                                         | A payment's currency, foreign amount and stored rate. USD cash accounts. Sessions counted per currency. Rates from a dated table, never guessed. Formats read the currency.                                               | R             |
| D6  | **Journal lines have no location, and nobody passes one.** Permissions ignore `user_role.location_id`.                                                                                                                                                                                                                                     | `post_journal`, `resolve_location`, `current_has_permission`                                                                                          | `journal_line.location_id`, filled by `post_journal` from each operation's location (existing lines: the main branch). Tills and permissions by branch in AB.                                                             | K, AB         |
| D7  | **Rules sit on one `business` row; permissions and reason codes are global and seeded by SQL**                                                                                                                                                                                                                                             | `discount_cap_percent`, `waste_approval_threshold`, `prevent_negative_stock`, `role_permission`, `reason_code`                                        | `business_rule` with scopes (business, role, branch, category, item) and history. The columns are read through `rule_value()` and kept as defaults until retired.                                                         | O             |
| D8  | **One journal per source document, and GRNI is read only from the receipt's own journal.** A return or a correction can't reuse the receipt as its source, and a bill clears the receipt's whole GRNI.                                                                                                                                     | unique index on `(reference_type, reference_id)`; `receipt_grni_value`                                                                                | Corrections, returns and credit notes are documents of their own. `receipt_grni_value` sums the receipt's journal and those of its corrections and returns.                                                               | M, S          |
| D9  | **A bill is one positive total, and its paid amount counts only payments**                                                                                                                                                                                                                                                                 | `purchase_invoice` guard; payables check = bills − payments                                                                                           | `supplier_credit` with allocations to bills. Paid and payables computed from payments and credits.                                                                                                                        | S             |
| D10 | **Stock can't be revalued without moving quantity:** quantity may not be 0, and value must be ≥ 0 and equal cost × quantity                                                                                                                                                                                                                | `inventory_movement` checks                                                                                                                           | A `cost_adjustment` movement type with zero quantity and signed value, allowed by relaxed checks for that type only. It revalues stock on hand when a price is corrected or credited; the part already sold goes to 5050. | M             |
| D11 | **Every kind of loss posts to 5300; the threshold is a hard refusal per entry.** Staff meal and on-the-house are also discount reasons: two paths for one event.                                                                                                                                                                           | `record_waste`, reason codes                                                                                                                          | Each kind maps to an account. Approval considers the person's and the item's recent losses. A giveaway at the till is an order with no revenue, its cost to the right account; a discount stays a reduced price.          | O, V          |
| D12 | **Lots and use-by dates are unused.** Sales, losses and counts carry no batch, so "made = sold + wasted + left" can't be shown per batch.                                                                                                                                                                                                  | `item_lot`, `lot_id`, `production_batch.expiry_date`                                                                                                  | Lots for made items (`track_lot`). Consumption allocated oldest use-by first. Counts by lot or allocated by the same rule. Batch numbers.                                                                                 | U             |
| D13 | **Many writes are not audited, and the audit has no branch**                                                                                                                                                                                                                                                                               | no `audit_event` in `receive_goods`, `record_bill`, `pay_bill`, `record_expense`, `record_waste`, `record_production`, journal functions, count steps | Events in each; `audit_log.location_id`                                                                                                                                                                                   | J             |
| D14 | **Enum values added in a migration can't be used in the same transaction**                                                                                                                                                                                                                                                                 | `movement_type`, `order_status`, `sales_channel` enums                                                                                                | New values in a migration of their own, applied before the one that uses them, or a text column with a check                                                                                                              | every release |
| D15 | **Three weaknesses found in callable functions:** a general manager can deactivate an owner or another general manager; any till user can lock a manager out of approving by typing wrong PINs; `close_day` is callable and dead                                                                                                           | `set_member_active`, `request_approval`, `close_day`                                                                                                  | Owner-only check; wrong PINs counted per requester, with an alert to the manager; `close_day` revoked                                                                                                                     | J             |
| D16 | **Small bugs found:** a zero-value loss can't be saved; cancelling a batch doesn't check its output is still on hand; the Expenses screen says a card payment credits 1010 while the database credits 1020                                                                                                                                 | `record_waste`, `cancel_production`, `ExpenseEntry.tsx`                                                                                               | Fixed                                                                                                                                                                                                                     | J             |
| D17 | **No PDF library, and Arabic/Kurdish shaping is poor in JavaScript PDF libraries**                                                                                                                                                                                                                                                         | `package.json`                                                                                                                                        | The browser's print-to-PDF with print layouts: exact right-to-left shaping, no new dependency, the same on Windows, Mac, iPad and Android                                                                                 | AA            |
| D18 | **No file storage**                                                                                                                                                                                                                                                                                                                        | no bucket or policy                                                                                                                                   | A private Supabase Storage bucket, with policies by business and permission, and an attachments table linking each file to its record                                                                                     | AA            |

---

## E. Database changes

Every migration follows the existing pattern:

- security-definer functions with `set search_path = public`;
- `revoke … from public, anon` then `grant execute … to authenticated`;
- row security forced, and read policies only;
- audit events;
- the allowlist in `tests/sql/controls.test.sql` updated.

### Release J — `0035_request_log.sql` (duplicate protection, audit, fixes)

- **`request_log`**: `business_id`, `key uuid`, `operation`, `request_hash`, `result jsonb`, `app_user_id`, `created_at`.
  - Primary key `(business_id, key)`. Row security forced, no grants.
- **`idem_begin(business, key, operation, args jsonb) → jsonb`**:
  1. Takes a transaction advisory lock on the key.
  2. Returns the stored answer, marked `replayed`, if the key was used before.
  3. Raises if the key was used for another operation or other arguments.
  4. Returns null to proceed.

  **`idem_finish(…)`** stores the answer in the same transaction as the work.

- **`p_idempotency_key uuid default null` added to every write that creates or changes money, stock or documents.** Return types are unchanged, so the app live during the deploy keeps working.
  - Bills: `open_tab`, `save_tab`, `split_tab`, `cancel_tab`, `mark_bill_printed`.
  - Sales: `void_sale`, `refund_sale`.
  - Purchasing: `receive_goods`, `record_bill`, `pay_bill`, `cancel_bill`.
  - Stock: `record_waste`, `adjust_stock`, `record_opening_stock`, `record_production`, `cancel_production`, `start_stock_count`, `submit_stock_count`, `approve_stock_count`, `reject_stock_count`, `cancel_stock_count`.
  - Cash and settlements: `move_cash`, `count_drawer`, `record_expense`, `record_card_settlement`, `cancel_card_settlement`, `post_platform_settlement`, `cancel_platform_settlement`.
  - Journals and periods: `save_journal`, `publish_journal`, `reverse_journal`, `discard_journal`, `post_control_correction`, `lock_period`, `unlock_period`.
  - Master data: `create_item`, `create_product`, `create_supplier`, `add_delivery_platform`, `set_price`, `change_product_recipe`, `save_batch_recipe`, `save_category`, `save_table`, `invite_member`.
- **Not keyed**, because repeating them changes nothing: `record_count`, `update_*`, `set_*` switches, `save_language`, `save_phrases`, `acknowledge_alert`, `snooze_alert`, `request_approval`.
- **Audit events** added to `receive_goods`, `record_bill`, `pay_bill`, `record_expense`, `record_waste`, `record_production`, the journal functions, the count steps and `save_table`.
- **Fixes (D15, D16):**
  - `set_member_active`: only the owner may change an owner or a general manager.
  - `request_approval`: wrong PINs counted per requester, with an alert.
  - `close_day`: revoked.
  - `record_waste`: a zero-value loss saves with no journal.
  - `cancel_production`: checks the output is on hand.

### Release K — `0036_cash_sessions.sql`

- **`cash_drawer`**: `location_id`, `name`, `is_active`; one per branch to begin with.
- **`work_shift`** gains:
  - `kind = 'session'`, `drawer_id`, `cashier_id`, `status` (open/closed);
  - `opening_counted`, `opening_expected`, `opening_variance`;
  - `closing_denominations jsonb`, `closed_by`, `forced_reason`.
  - Closed sessions are immutable (the existing guard).
- **Events join the session as they happen:** `cash_event.work_shift_id` is set on insert to the drawer's open session.
- **Cash needs an open session.** A cash payment, cash refund, paid-out or till move without one is refused: "Open the drawer first".
- **`sales_order.shift_id`** is set for every sale made during a session.
- **Location on journal lines:** `journal_line.location_id`, and `post_journal(… p_location)`. Existing lines are filled with the main branch.
- **Functions:**
  - `open_cash_session`, `close_cash_session`: blind, reveal on submission, over/short to 6300, takings to the safe or bank;
  - `hand_over_session`: close and open in one step;
  - `force_close_session`: a manager, with a reason;
  - `cash_session_status`: no expected amount;
  - `cash_sessions`: history with the figures after closing.
- **`count_drawer`** becomes "close the open session" until the old screen is gone, then is revoked.
- **Permissions:**
  - `cash.session` — owner, general manager, branch manager, cashier, barista;
  - `cash.view_expected` — owner, general manager, accountant, auditor;
  - `cash.session.force` — owner, general manager, branch manager.
- **Keys required from the API:** a keyed write called through the API (PostgREST sets `request.path`) with no key is refused; SQL callers are not affected.

### Release L — `0037_partial_refunds.sql`

- **`inventory_movement.sales_order_line_id`**, written by `post_sale` from now on.
- **`sale_refund`**:
  - `refund_no` (a document counter), `sales_order_id`, `location_id`, `work_shift_id`, `amount`, `cost_returned`;
  - `reason_code`, `reason`, `requested_by`, `approved_by`, `approval_id`, `journal_entry_id`, `idempotency_key`.
- **`sale_refund_line`**: `sales_order_line_id`, `qty`, `amount`, `cost_returned`, `restocked`.
- **`sale_refund_tender`**: `tender_type`, `amount`.
- **`refund_sale_lines(order, lines, tenders, reason_code, reason, approval, key)`** is the engine; `refund_sale` refunds every remaining line through it.
- **Guards:**
  - never more than the quantity sold, less what was already refunded;
  - the last refund of a line takes exactly what remains of its net;
  - a refund's total never exceeds a payment's remaining amount.
- **The cash-refund trigger** removes the cash part of each refund, not the whole sale.
- **Views and reports read the refund lines:** `platform_money`, card takings, daily sales and exceptions.

### Release M — `0038_receipt_corrections.sql`

- **`receipt_correction`**: `original_receipt_id`, `kind` (quantity, price, item, supplier, date, whole), `lines jsonb` (before/after), `reason`, `journal_entry_id`, `created_by`, `idempotency_key`.
- **Movement type `cost_adjustment`** (D10).
- **`correct_receipt(receipt, corrected lines, supplier, received_at, reason, confirm, key)`**:
  - Refused on a billed receipt until its bill is cancelled or credited.
  - Refused before an approved count of its items.
  - Refused in a locked month.
  - Stock going below zero needs a confirmation.
- **`reverse_receipt(receipt, reason, key)`** undoes a receipt that should not exist.
- **`receipt_grni_value`** includes corrections (and returns, in S).
- **`report_reconciliation`** gains:
  - card takings awaiting settlement vs 1010;
  - platform orders owed vs 1100;
  - the drawer (open session plus loose events) vs 1000;
  - the safe vs 1005;
  - supplier balances vs 2000;
  - source-document integrity (every sale, receipt, bill, payment, expense, loss, count and refund has its one journal, and no automatic journal lacks its source).
- **`period_close_checklist`** blocks on these.

### Release N — `0039_usage_variance.sql`

- **`report_usage_variance(location, from, to)`**, per item between its two approved counts:
  - opening count, received, made, transferred;
  - theoretical use (sales net of refunds and voids, plus batch ingredients);
  - recorded losses by kind, and closing count;
  - actual use, variance, %, value;
  - products sold that use it;
  - possible factors.
- **`usage_variance` alert**, with thresholds.

### Release O — `0040_business_rules.sql`

- **`business_rule`**: `key`, `scope_type` (business, role, location, category, item), `scope_id`, `value jsonb`, `reason`, `set_by`, `set_at`.
- **`business_rule_history`**: every change, old → new, written by trigger. Also on the audit trail.
- **`rule_value(key, context)`**: the most specific scope wins.
- **Rules:**
  - discount cap per role, and rounding step;
  - refund amount needing approval;
  - waste approval value and window (entry, session, day);
  - negative-stock policy (`block`, `approve`, `alert`, `allow`) per business, category or item;
  - target margin.
- **Approvals:** kinds `waste` and `negative_stock`.
- **Aggregated waste check:** the person's losses in the window, plus the item's losses by anyone that day, plus this entry.
- **Negative-stock policy** checked by every function that issues stock.

### Release P — `0041_sizes_and_addons.sql`

- **Sizes:** `add_variant`, `update_variant`, `retire_variant`, and `create_product(… p_sizes)`. A retired size stays on past sales.
- **Add-on tables:**
  - `modifier_group`: names ×3, required, min/max, sort;
  - `modifier`: names ×3, active, sort;
  - `modifier_price`: per channel, dated, with history;
  - `modifier_recipe_line`: item, quantity, unit, channels, optional size override;
  - `product_modifier_group`: which products and sizes offer a group.
- **Where add-ons are recorded:** `pos_tab_line_modifier` and `sales_order_line_modifier` (name, quantity, unit price, total and cost frozen). The unused `modifiers jsonb` is left alone.
- **`post_sale`, `open_tab` and `save_tab`** take add-ons per line.
- **Printing a bill** freezes add-on prices too.
- **`pos_catalogue`** returns each product's groups.

### Release Q — `0042_split_payments.sql`

- **`post_sale`, `record_sale` and `settle_tab`** take `p_tenders jsonb` (`[{type, amount}]`). The old `p_tender` is kept as a one-item list.
- The total must equal the net. Cash may exceed it: the change is recorded.
- One drawer event per cash payment.
- Voids and refunds per payment.
- Card takings from card payments.

### Release R — `0043_foreign_cash.sql`

- **`fx_rate`**: currency, IQD per unit, `effective_from`, `set_by`, `reason`, and a maximum age. Payment in a currency with no current rate is refused.
- **`sales_tender`** gains `currency`, `foreign_amount`, `rate`. The base amount stays in IQD.
- **`cash_event` and `cash_transfer`** gain the same.
- **Sessions** are counted per currency.
- **Accounts:** 1001 Cash in the till — USD, 1006 Cash in the safe — USD, 6950 Exchange differences.
- **`exchange_cash(from USD, to IQD, received, …)`** books the difference.

### Release S — `0044_purchasing.sql`

- **Purchase orders:**
  - `purchase_order` gains `po_no`, `approved_by/at`, `sent_at`, `closed_at`, `expected_at`, `cancel_reason`;
  - statuses: draft → approved → sent → partially received → received → closed / cancelled;
  - `purchase_order_line.received_base` is derived;
  - `goods_receipt_line.purchase_order_line_id`.
- **Supplier returns:**
  - `supplier_return` and its lines: `return_no`, supplier, optional receipt, item, quantity, value at the receipt's cost or the average, reason;
  - movement type `supplier_return`.
- **Credit notes:**
  - `supplier_credit`: `credit_no`, supplier's number, date, amount, kind (`goods_return`, `price`, `other`), links;
  - `supplier_credit_allocation`: to bills.
  - The bill guard's paid amount = payments + credits allocated.
- **Functions:**
  - `create_po`, `approve_po`, `send_po`, `close_po`, `cancel_po`;
  - `receive_goods(… p_purchase_order)`;
  - `return_to_supplier`, `record_supplier_credit`, `allocate_credit`;
  - `supplier_statement(supplier, from, to)`.

### Release T — `0045_buying_list.sql`

- **`item_supplier`**: item, supplier, pack unit, last price, preferred.
- **`buying_list(location)`** returns, per item:
  - on hand, on order, daily use (28 days) and lead time;
  - reorder and target levels;
  - the suggested quantity, rounded up to the pack;
  - the supplier;
  - the reason, with its numbers.
- **`purchase_orders_from_list(lines)`** makes one draft PO per supplier.

### Release U — `0046_production_lots.sql`

- **Batches:** batch number (document counter), `use_by` (from the recipe's `shelf_life_hours`, editable), and a lot per batch for made items (`track_lot`).
- **FEFO allocation:** consumption of tracked items (sales, losses, batch inputs, transfers) is taken from the lot with the earliest use-by first. A movement is split per lot.
- **Counting:** tracked items are counted per lot. Otherwise the difference is allocated by the same rule, as a documented adjustment.
- **Functions:** `batch_reconciliation(batch)` (made = sold + lost + moved + adjusted + left) and `production_plan(day, location)`.
- **Recording yesterday's batch:** a manager, with a reason, not before the last approved count.

### Release V — `0047_losses.sql`

- **Accounts:** 5310 Production and preparation loss, 6110 Staff meals, 6610 Complimentary items, 6620 Marketing samples.
- **Movement types:** `production_waste`, `preparation_waste`, in a migration of their own (D14).
- **`record_loss(kind, item or product, quantity, reason, lot, approval, key)`**. `record_waste` stays as a wrapper.
- **Giveaways:** `post_sale(… p_giveaway kind)` records an order with no revenue and no payment, its cost to the kind's account, a reason, and approval by the rules.
- **`report_losses(from, to, by)`**.

### Release W — `0048_staff.sql`

- **`employee`**: name, phone, title, hire date, status, branch, pay basis (monthly, daily, hourly), rate, standard hours, overtime multiplier, optional link to a login, clock PIN hash.
- **`shift_schedule`**, and **`attendance`** (in, out, source, edited by, edit reason).
- **Payroll:** `payroll_run` (month, status draft → approved → paid), `payroll_line`, `employee_advance`, `salary_payment`.
- **Accounts:** 1300 Employee advances, 2100 Salaries payable.
- **Functions:** `clock_in`, `clock_out` (PIN at the till), `save_schedule`, `correct_attendance` (reason, audited), `draft_payroll`, `approve_payroll`, `pay_salary`, `record_advance`.
- **Permissions:** `staff.manage`, `payroll.run`, `payroll.view`, `attendance.edit`.

### Release X — `0049_customers.sql`

- **`customer`**: name, phone normalised and unique, notes, preferences, active.
- **`customer_address`**.
- **`sales_order.customer_id` and `pos_tab.customer_id`**: optional; required for direct delivery.
- **Loyalty:** the rule in `business_rule` (points per IQD, or visits, reward, expiry), and `loyalty_ledger` (customer, sale, points ±, kind, reason, by, approved by), unique per sale and kind.
- **Functions:** `find_customer`, `save_customer`, `redeem_reward`, `adjust_points`.
- **Permissions:** `customer.edit`, `loyalty.adjust`.

### Release Y — `0050_reports.sql`

- `report_sales_analysis(from, to, group_by[], filters)`, with a whitelist of dimensions and measures.
- `report_purchases`, `inventory_valuation(as_of)`, `report_production`, `report_cash_sessions`.

### Release Z — `0051_statements.sql`

- `gl_account.cash_flow_class` (cash, operating, investing, financing).
- `report_balance_sheet(as_of)` and `report_cash_flow(from, to)`, both built from journal lines.

### Release AA — `0052_attachments.sql`

- Storage bucket `documents` (private), with policies by business and permission.
- `document_attachment`: entity type and id, path, type, size, uploaded by and when.
- `attach_document` and `detach_document` (audited).

### Release AB — `0053_branches.sql`

- **Tills:** `till` (name, location, drawer); each device chooses its till once, and every operation carries the till's location.
- **Permissions by branch:** `current_has_permission(p, location)`. A role with no branch applies everywhere.
- **Transfers:** `stock_transfer` and its lines (sent → received), in transit in 1210.
- **Per branch:** turn numbers, prices (the existing `channel_price.location_id`), and location filters on every report.

---

## F. Backend changes

**Cross-cutting, from release J on:**

1. **Every write takes a key.** In the database, `idem_begin` and `idem_finish` wrap the work in the same transaction.
   - A retry returns the stored answer, marked `replayed`.
   - A key reused for different arguments is refused.
   - Concurrent calls with one key queue on an advisory lock.
2. **Every write checks its permission, its rules and its location in the database.** A screen's checks are a convenience, never the control.
3. **Every write that changes money or stock:**
   - posts through `post_journal` with its location;
   - writes its movements with their references (order, line, lot, document);
   - writes an audit event with before/after, reason and approval;
   - lets the alerts see it.
4. **Server actions pass the key.** `callRpc` keeps its three outcomes: done, refused (a definite answer), or uncertain.
5. **Approvals reuse `request_approval` / `use_approval`.** New kinds: waste, negative stock, refund above the limit, PO approval, payroll approval.
6. **Numbers come from `next_document_no`,** gapless and per business (per branch from AB). New types: refund, return, credit, po, batch, session, transfer, payroll.
7. **Rules come from `rule_value`, never from constants.** The existing business columns are read through it until retired.

**Per release:**

| Release | Services and validations                                                                                                                                                                                                                                  |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J       | Request log; audit coverage; fixes (D15, D16)                                                                                                                                                                                                             |
| K       | Sessions: one open per drawer (locked); opening and closing counts blind; handover; manager force-close with reason; events attach to the open session; cash refused without a session; over/short per session; keys mandatory; location on journal lines |
| L       | Refund engine: quantities, the final remainder, allocation to payments (cash from the open session), returnable stock at the line's cost, the status, 4200/1200/5000 postings; reason and approval by rule; `refund_sale` through it                      |
| M       | Correction engine (quantity/price/item/supplier/date) with its guards; value-only revaluation; consumed share to 5050; wider reconciliation; month-end checks                                                                                             |
| N       | Usage variance between each item's two approved counts, split at each line's `counted_at`                                                                                                                                                                 |
| O       | Rules with history; the aggregated waste check; negative-stock policies at every issue; approvals                                                                                                                                                         |
| P       | Sizes; add-on catalogue; prices on the line (size price + add-ons); discount spread over add-ons; add-on recipes consumed with the line                                                                                                                   |
| Q       | Payments list; change; drawer events per cash payment; refunds and voids per payment; card takings by payment                                                                                                                                             |
| R       | Rates (dated, maximum age, reason); payments in USD; change in IQD or USD; sessions per currency; exchange differences                                                                                                                                    |
| S       | PO workflow and approval by rule; receiving against a PO with differences shown; returns (GRNI or payables); credit notes and allocations; supplier statements                                                                                            |
| T       | Buying list with its explanation; draft POs per supplier                                                                                                                                                                                                  |
| U       | Lots, FEFO, batch numbers and use-by; batch reconciliation; the day's plan (demand by weekday over 4+ weeks, "not enough history" before); expiring stock                                                                                                 |
| V       | Loss kinds and their accounts; giveaways; the loss report                                                                                                                                                                                                 |
| W       | Attendance from the till's PIN; schedules; lateness/absence/overtime by rule; payroll with advances and deductions; payments                                                                                                                              |
| X       | Customers; delivery details; loyalty earned on completion, reversed on void or refund (in proportion), redeemed as a discount; manual points with permission and reason                                                                                   |
| Y–AB    | Reports, statements, attachments, branches                                                                                                                                                                                                                |

---

## G. Frontend changes

**Shared pieces, from release J on:**

- **`useOperation`: one submit helper for every form.**
  - It makes the key when the person submits and sends it with the request.
  - On an uncertain answer it shows _"Your previous submission may already have been saved. Checking…"_ and retries by itself with the same key (1 s, 2 s, 4 s).
  - It then shows _Saved_ (or _It had already been saved_), or keeps the form frozen with **Retry**. The pending submission is kept in the tab (session storage), so a reload resumes it, exactly as the till does today.
  - A definite refusal shows its message; the next submission gets a new key.
- **The confirmation panel.** Before a consequential operation, it says what will happen in plain words: "Takes 20 kg of Milk out of stock (IQD 30,000) · Dairy Co is owed 30,000 less · Needs a manager's approval".
- **The result panel.** After the operation, it says what happened, with links to the records.
- **The approval dialog** from the till, reused everywhere an approval is needed.
- **The denomination counter**: notes of 250 … 50,000 IQD, and USD from release R. The total builds as the notes are typed.

| Release | Screens and workflows                                                                                                                                                                                                                                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J       | Every write form uses `useOperation` (till bills, orders, purchasing, vendors, expenses, sales, platforms, inventory, counts, production, products, journals, accounting, settings, tables). The Expenses card preview is corrected.                                                                                                            |
| K       | **Drawer** on the till's top bar: _Open the drawer_ (count the float) → trading → _Hand over_ or _Close_. A blind count with the denomination counter; the result is revealed after **Submit**. **Sales → Cash sessions**: the list, one session's statement, the manager's force-close. The old Drawer count screen becomes the session close. |
| L       | **Orders → a sale → Refund items**: lines with quantities (all by default), amounts computed, the reason, payment back to cash or card, approval when a rule needs it; a REFUND slip printed. The sale shows its refunds under it.                                                                                                              |
| M       | **Purchasing → a delivery → Correct**: the delivery's lines editable (quantity, price, item), the supplier and date; the consequences in the confirmation panel; the original kept and linked. **Reports → Reconciliation**: the new checks with drill-down.                                                                                    |
| N       | **Reports → Usage vs recipes**: count pairs, items sorted by value of variance, with drill-down to the movements; neutral wording ("not accounted for"). A dashboard alert with **Investigate**.                                                                                                                                                |
| O       | **Settings → Rules**: each rule with its value, scope, who changed it and when, and its history; changing one needs a reason. A waste entry above the limit asks for a manager's PIN, or is saved as _waiting for approval_ and shown under **Needs you**.                                                                                      |
| P       | **Products**: _Sizes_ (name, prices by channel, recipe per size, "copy from Regular"). _Add-ons_ (groups, prices, recipes, which products offer them). **Till**: tapping a product with options opens one sheet (size + add-ons; required groups first); quick chips for common add-ons; the ticket and receipt show add-ons under their item.  |
| Q       | **Pay dialog → Split**: amounts per payment with what remains shown; cash change computed; the receipt lists each payment.                                                                                                                                                                                                                      |
| R       | **Pay dialog**: USD with today's rate, the IQD equivalent and change in IQD. **Settings → Exchange rate** (a reason for each change; a warning when stale). The drawer counted in both currencies.                                                                                                                                              |
| S       | **Purchasing**: _Orders_ (draft → approve → send, printable). _Receive against an order_ pre-filled, with differences highlighted (ordered 100 / received 95; price 5.00 → 5.50; unexpected item). _Return to supplier_. _Credit note_. **Vendors**: supplier statement; a bill shows payments and credits.                                     |
| T       | **Purchasing → What to buy**: grouped by supplier, each line with its reason; accept, change, remove, add; _Create orders_.                                                                                                                                                                                                                     |
| U       | **Production → Today**: what to make, why and how much; ingredients needed vs available; expiring stock. Batches with their numbers and use-by. A batch page showing made / sold / lost / left.                                                                                                                                                 |
| V       | **Inventory → Record a loss**: the kind first, with plain explanations, then item and quantity. **Till → Give away** (staff meal, on the house, sample). **Reports → Losses**.                                                                                                                                                                  |
| W       | **Staff**: people, pay, schedules. **Till → Clock in/out** (PIN). **Payroll**: draft, review, approve, pay; advances.                                                                                                                                                                                                                           |
| X       | **Till → Customer** (optional; phone search, or a new customer in one step; required for direct delivery). **Customers**: profile, addresses, history, points.                                                                                                                                                                                  |
| Y–AB    | **Reports → Sales analysis** (dimension, measure, filters). **Statements** (balance sheet, cash flow). A **PDF** button on every report. **Attachments** on deliveries, bills, credit notes and expenses (camera on phones). **Branches**: the till's branch, branch filters, transfers.                                                        |

Every new text is added in English, Arabic and Kurdish, checked right-to-left and on a 390-pixel phone.

---

## H. Accounting changes

**Existing postings stay as they are.** For reference:

- Sale: Dr 1000/1010/1100 net, Dr 4100 discount, Cr 4000 gross; Dr 5000 / Cr 1200 cost.
- Void: the exact reversal.
- Refund: Dr 4200 / Cr payment account; stock returned: Dr 1200 / Cr 5000.
- Receipt: Dr 1200 / Cr 2050.
- Bill:
  - against a receipt: Dr 2050, ±5050, Cr 2000;
  - against an account: Dr account / Cr 2000.
- Payment: Dr 2000 / Cr 1000/1005/1020/3000.
- Expense: Dr 5100/5200/6xxx / Cr the source.
- Loss: Dr 5300 / Cr 1200.
- Count and correction:
  - loss: Dr 5400 / Cr 1200;
  - gain: Dr 1200 / Cr 5400.
- Opening stock: Dr 1200 / Cr 3000.
- Production: none (the value stays in 1200).
- Drawer over/short: 6300.
- Takings to the safe or bank: Dr 1005/1020 / Cr 1000.
- Card settlement: Dr 1020, Dr 6500, ±6300, Cr 1010.
- Platform settlement: Dr 1020, Dr 5100, Dr 5200, Cr 1100.
- Year end: into 3100.

**New accounts** (created by provisioning, as system accounts):

| Code | Name                            | Type                  | Release |
| ---- | ------------------------------- | --------------------- | ------- |
| 1001 | Cash in the till — USD          | asset                 | R       |
| 1006 | Cash in the safe — USD          | asset                 | R       |
| 1210 | Stock in transit                | asset                 | AB      |
| 1300 | Employee advances               | asset                 | W       |
| 2100 | Salaries payable                | liability             | W       |
| 5310 | Production and preparation loss | expense               | V       |
| 6110 | Staff meals                     | expense               | V       |
| 6610 | Complimentary items             | expense               | V       |
| 6620 | Marketing samples               | expense               | V       |
| 6950 | Exchange differences            | expense (either sign) | R       |

1001, 1006, 1210, 1300 and 2100 join the accounts closed to manual journals: they move only through their own operations.

**New postings:**

| Operation (release)                        | Debit                                       | Credit                                       | Notes                                                                                                                       |
| ------------------------------------------ | ------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Session opened, float differs (K)          | 6300 or 1000                                | 1000 or 6300                                 | The difference between the last close and this opening, per session                                                         |
| Session closed short / over (K)            | 6300 / 1000                                 | 1000 / 6300                                  | Per session, referencing it                                                                                                 |
| Session takings to safe / bank (K)         | 1005 / 1020                                 | 1000                                         | As today, per session                                                                                                       |
| Partial refund (L)                         | 4200 (refund amount = the line's net share) | the payment account(s) by allocation         | Cash from the open session                                                                                                  |
| Partial refund, returnable stock (L)       | 1200                                        | 5000                                         | At the line's original cost share                                                                                           |
| Receipt correction, quantity (M)           | 1200 / 2050                                 | 2050 / 1200                                  | At the corrected price (more) or the original price (less)                                                                  |
| Receipt correction, price (M)              | 2050 (less) or 1200 + 5050 (more)           | 1200 + 5050 (less) or 2050 (more)            | On-hand share revalues 1200 (`cost_adjustment`); the part already consumed goes to 5050                                     |
| Delivery reversed (M)                      | 2050                                        | 1200                                         | At its original value; refused once billed                                                                                  |
| Sale with add-ons (P)                      | as a sale                                   | as a sale                                    | Add-on prices in 4000; their recipes in 5000/1200                                                                           |
| Split payment (Q)                          | one line per payment account                | 4000 as a sale                               | Cash change reduces the cash line                                                                                           |
| Payment in USD (R)                         | 1001 (USD × stored rate)                    | 4000 as a sale; 1000 for IQD change          | Rate stored on the payment                                                                                                  |
| USD exchanged / deposited (R)              | 1000/1020 (IQD received)                    | 1001/1006 (carrying value)                   | Difference to 6950                                                                                                          |
| Supplier return, unbilled (S)              | 2050                                        | 1200                                         | At the receipt's cost                                                                                                       |
| Supplier return, billed (S)                | 2000                                        | 1200                                         | A credit awaiting the supplier's note; matched when it arrives, never posted twice                                          |
| Credit note, price (S)                     | 2000                                        | 1200 (on-hand share) + 5050 (consumed share) |                                                                                                                             |
| Credit note, service bill (S)              | 2000                                        | the bill's account                           |                                                                                                                             |
| Loss: expired, spoiled, damaged, other (V) | 5300                                        | 1200                                         |                                                                                                                             |
| Loss: production / preparation (V)         | 5310                                        | 1200                                         |                                                                                                                             |
| Staff meal (V)                             | 6110                                        | 1200                                         | At cost, through the till or the loss screen                                                                                |
| On the house (V)                           | 6610                                        | 1200                                         | No revenue, no discount                                                                                                     |
| Sample (V)                                 | 6620                                        | 1200                                         |                                                                                                                             |
| Advance to an employee (W)                 | 1300                                        | 1000/1005/1020                               |                                                                                                                             |
| Payroll approved (W)                       | 6100 (gross incl. overtime)                 | 2100 (net), 1300 (advances recovered)        | Deductions reduce gross                                                                                                     |
| Salary paid (W)                            | 2100                                        | 1000/1005/1020                               |                                                                                                                             |
| Loyalty reward (X)                         | 4100                                        | as a sale                                    | A discount with the reason "loyalty"; no liability accrued (a café's points are small; the report shows points outstanding) |
| Transfer sent / received (AB)              | 1210 / 1200 (receiving branch)              | 1200 (sending branch) / 1210                 | Shortage on arrival: Dr 5300 / Cr 1210                                                                                      |

**Statements (release Z):**

- **Balance sheet.** Built from closing balances by account type as at a date. "Profit this year" (revenue − expenses since the year began) is shown in equity until the year-end close moves it to 3100. Assets = liabilities + equity is checked, not assumed.
- **Cash-flow statement.** Built by the direct method from the journal lines on the cash accounts (1000, 1001, 1005, 1006, 1020). Each movement is classed by its counter-account's `cash_flow_class`:
  - investing: 1500 and 1590;
  - financing: 3000 and 3200;
  - operating: all the rest;
  - transfers between cash accounts are left out.

  Opening cash + net flow = closing cash is checked.

**Integrity:**

- Every new transaction posts through `post_journal`, in the same transaction as its movements.
- Each source document has exactly one journal. Its corrections, returns and credits are documents of their own.
- The reconciliation report compares every subledger with its account daily, and at month end, where a difference blocks the lock.

---

## I. Inventory changes

| Operation (release)            | Movement type                                                                                                                        | Quantity | Value basis                       | Reference                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------- | ------------------------------------------------ |
| Sale line (L on)               | `sale_consumption`                                                                                                                   | −        | average at the location           | order + **line** (+ **add-on**, P; + **lot**, U) |
| Void                           | `reversal`                                                                                                                           | +        | the original value                | order                                            |
| Partial refund, returnable (L) | `refund_return_to_stock`                                                                                                             | +        | the line's original value share   | refund + line                                    |
| Receipt                        | `purchase_receipt`                                                                                                                   | +        | landed value                      | receipt (+ PO line, S)                           |
| Correction, less / more (M)    | `reversal` / `purchase_receipt`                                                                                                      | − / +    | original / corrected price        | correction                                       |
| Correction, price (M)          | **`cost_adjustment`**                                                                                                                | 0        | signed value, on-hand share       | correction                                       |
| Supplier return (S)            | `supplier_return`                                                                                                                    | −        | the receipt's cost or the average | return                                           |
| Credit note, price (S)         | `cost_adjustment`                                                                                                                    | 0        | on-hand share                     | credit                                           |
| Loss (V)                       | `expired`, `spoilage`, `damaged`, `waste`, `production_waste`, `preparation_waste`, `staff_consumption`, `complimentary`, `sampling` | −        | average                           | loss (+ lot)                                     |
| Giveaway at the till (V)       | `staff_consumption` / `complimentary` / `sampling`                                                                                   | −        | average, through the recipe       | order + line                                     |
| Batch inputs / output          | `production_consumption` / `production_output`                                                                                       | − / +    | average / sum of inputs           | batch (+ lot, U)                                 |
| Count difference               | `count_adjustment`                                                                                                                   | ±        | average                           | count                                            |
| Transfer (AB)                  | `transfer_out` / `transfer_in`                                                                                                       | − / +    | the sending branch's average      | transfer                                         |

**Costing.**

- The moving average is unchanged.
- Returns leave at their receipt's cost, and the difference from the average goes to 5050.
- Transfers carry cost with the goods.
- Production output is at input cost, and yield variance is reported, not posted.
- Lots track quantity and dates only.

**Negative stock (release O).** Every function that issues stock asks `rule_value('negative_stock', item)`:

- **block** — refused, with the quantity short;
- **approve** — a manager's PIN;
- **alert** — allowed, with an immediate red alert;
- **allow** — for the selected items only.

The functions that ask are: sales, giveaways, losses, batch inputs, transfers, returns and corrections.

**Usage variance (release N)** needs no new movements. It reads the ledger between each item's two approved counts.

---

## J. Reporting changes

| Release | New or changed                                                                                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J       | Audit trail: the new events and a branch column                                                                                                                                                                                  |
| K       | Cash sessions (opening, cash sales, refunds, paid out, in/out, drops, expected, counted, over/short, times, cashier, overrides); a shortage alert per session; a session left open too long                                      |
| L       | Refunds by line in daily sales, the exceptions report, platform money and card takings; "refunded cost not recovered"                                                                                                            |
| M       | Reconciliation: card clearing, drawer, safe, supplier balances, source-document integrity; month-end blocks                                                                                                                      |
| N       | Usage vs recipes (theoretical, actual, variance, %, value, sales volume, period, branch, possible factors); an alert                                                                                                             |
| O       | Rule history; waste waiting for approval under **Needs you**                                                                                                                                                                     |
| P       | Sales by size and by add-on (count, revenue, cost, margin, how often each is added)                                                                                                                                              |
| Q       | Sales by payment method; the drawer by cash payment                                                                                                                                                                              |
| R       | USD takings, the rates used, exchange differences                                                                                                                                                                                |
| S       | PO status; received vs ordered; supplier price changes; supplier statements; returns and credits                                                                                                                                 |
| T       | The buying list (with reasons)                                                                                                                                                                                                   |
| U       | The day's plan; expiring stock; batch reconciliation; production yield (planned vs actual)                                                                                                                                       |
| V       | Losses by kind, item, person, day and value — "what are we losing?"                                                                                                                                                              |
| W       | Attendance (late, early, absent, overtime); payroll history; labour cost % of sales                                                                                                                                              |
| X       | Customer history; points outstanding; loyalty redemptions                                                                                                                                                                        |
| Y       | **Sales analysis:** by hour, weekday, date, product, category, size, add-on, employee, payment method, branch; discounts, refunds, voids, cancelled bills. Also purchases, stock valuation, production and cash-session reports. |
| Z       | Balance sheet; cash-flow statement                                                                                                                                                                                               |
| AA      | PDF of every report                                                                                                                                                                                                              |
| AB      | Branch filter on every report; consolidated and per-branch P&L                                                                                                                                                                   |

**The dashboard keeps its order:**

1. **Needs you** (red, then orange, each with its action).
2. **Yesterday's brief.**
3. **Today's figures.**

New rules join the same list, with an action button each:

- cash shortage by session;
- usage variance;
- negative stock;
- unusual waste;
- a supplier's price rise;
- a delivery that differs from its PO;
- a failed reconciliation;
- a possible duplicate;
- POs waiting for approval;
- waste waiting for review;
- expiring stock;
- a batch to make;
- a delivery due.

The dashboard shows no new numbers without a reason.

---

## K. Testing matrix

**Layers:**

- **SQL:** `tests/sql`, on PostgreSQL 16 and 17, each test in a fresh copy of the database.
- **Concurrency:** `scripts/test-sql-concurrency.sh`, with real parallel sessions.
- **Unit:** vitest.
- **Browser:** `tests/e2e`, the real app on PostgREST.

**Kinds of scenario:**

- normal (N);
- abnormal (A): refused, invalid, no permission, over a limit;
- concurrent (C);
- disconnected (D): the gateway loses the answer after the database commits, and the app retries.

| Area             | Scenario                                                                                                                                                            | N   | A                                                                                | C                                | D          | Layers                                               | Release       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------- | -------------------------------- | ---------- | ---------------------------------------------------- | ------------- |
| Sales            | Cash sale; card sale; platform sale                                                                                                                                 | ✓   | wrong total, no permission                                                       | two tills                        | ✓ (exists) | SQL, e2e                                             | existing      |
| Sales            | Split cash + card; cash with change                                                                                                                                 | ✓   | sum ≠ total; card > total                                                        | —                                | ✓          | SQL, e2e                                             | Q             |
| Sales            | Sale with add-ons; different sizes                                                                                                                                  | ✓   | retired size/add-on; required group empty                                        | —                                | ✓          | SQL, unit, e2e                                       | P             |
| Sales            | Discount; large discount with PIN                                                                                                                                   | ✓   | over cap without PIN; wrong PIN; lockout per requester                           | —                                | ✓          | SQL, e2e                                             | existing, J   |
| Sales            | Cancelled bill; void                                                                                                                                                | ✓   | void after the session closed                                                    | void while paying                | ✓          | SQL, e2e                                             | existing, K   |
| Sales            | Partial refund; full refund; refunds summing to the whole                                                                                                           | ✓   | more than sold; after full refund; no reason; over the limit without approval    | two refunds of one line          | ✓          | SQL, concurrency, e2e                                | L             |
| Sales            | Payment in USD, change in IQD                                                                                                                                       | ✓   | no rate; stale rate                                                              | rate changed while paying        | ✓          | SQL, e2e                                             | R             |
| Inventory        | Sale consumption per line and add-on                                                                                                                                | ✓   | —                                                                                | —                                | —          | SQL                                                  | L, P          |
| Inventory        | Loss of each kind; staff meal; giveaway                                                                                                                             | ✓   | over the limit alone; three small ones over the limit together; zero value       | two people at once               | ✓          | SQL, concurrency, e2e                                | O, V          |
| Inventory        | Batch; batch sold, wasted, expired, left; reconciliation per batch                                                                                                  | ✓   | cancel after its output is sold                                                  | two batches at once              | ✓          | SQL, e2e                                             | U             |
| Inventory        | Stock count; usage variance                                                                                                                                         | ✓   | a single count (no pair); cycle counts                                           | —                                | ✓          | SQL, e2e                                             | existing, N   |
| Inventory        | Negative stock under each policy                                                                                                                                    | ✓   | block; approve without PIN                                                       | two sales of the last unit       | ✓          | SQL, concurrency                                     | O             |
| Inventory        | Stock adjustment                                                                                                                                                    | ✓   | no permission                                                                    | —                                | ✓          | SQL                                                  | existing, J   |
| Purchasing       | PO draft → approve → send; partial then full delivery                                                                                                               | ✓   | receive more than ordered; approve own PO over the limit                         | two receipts against one PO line | ✓          | SQL, concurrency, e2e                                | S             |
| Purchasing       | Wrong quantity / price / item / supplier / date corrected                                                                                                           | ✓   | billed; before an approved count; locked month; stock below zero                 | two corrections at once          | ✓          | SQL, e2e                                             | M             |
| Purchasing       | Supplier return; credit note; allocation to a bill                                                                                                                  | ✓   | return more than received; credit over the balance                               | —                                | ✓          | SQL, e2e                                             | S             |
| Purchasing       | Buying list → orders                                                                                                                                                | ✓   | no supplier; no history                                                          | —                                | —          | SQL, e2e                                             | T             |
| Cash             | Open with float; cash sales; cash refund; drop to safe; blind close; shortage; overage; two sessions (handover)                                                     | ✓   | cash with no session; closing twice; seeing expected without permission          | two cashiers opening one drawer  | ✓          | SQL, concurrency, e2e                                | K             |
| Cash             | Manager force-close                                                                                                                                                 | ✓   | without reason; without permission                                               | —                                | ✓          | SQL, e2e                                             | K             |
| Production       | The day's plan; expiring stock                                                                                                                                      | ✓   | no demand history ("not enough history")                                         | —                                | —          | SQL, e2e                                             | U             |
| Staff            | Clock in/out; schedule; late / early / absent; overtime                                                                                                             | ✓   | wrong PIN; clocking out twice; edit without reason                               | two clock-ins                    | ✓          | SQL, e2e                                             | W             |
| Staff            | Payroll with advance; salary payment                                                                                                                                | ✓   | approve twice; pay more than owed                                                | two runs of one month            | ✓          | SQL, concurrency, e2e                                | W             |
| Customers        | Customer on a sale; delivery address; history                                                                                                                       | ✓   | duplicate phone; delivery without customer                                       | —                                | ✓          | SQL, e2e                                             | X             |
| Loyalty          | Earn; reverse on void and refund; redeem; manual points                                                                                                             | ✓   | points twice for one sale; points on a cancelled sale; manual without permission | two redemptions                  | ✓          | SQL, concurrency                                     | X             |
| Branches         | Sale in A and in B; per-branch stock and cash; transfer; consolidated report                                                                                        | ✓   | a role for A acting in B                                                         | transfer received twice          | ✓          | SQL, concurrency, e2e                                | AB            |
| Accounting       | Every posting above balances and references its source; reconciliation at zero after each scenario; balance sheet balances; cash flow reconciles                    | ✓   | —                                                                                | —                                | —          | SQL                                                  | every release |
| Rules            | Change a rule with a reason; history                                                                                                                                | ✓   | no reason; no permission                                                         | —                                | ✓          | SQL, e2e                                             | O             |
| **Connectivity** | **For every write function:** call → lose the answer → retry with the same key → one record, the same answer, `replayed`; the same key with other arguments refused | ✓   | ✓                                                                                | same key twice at once           | ✓          | SQL (every function), e2e (one operation per screen) | J             |

**Every release also runs the full existing suites unchanged:**

- the SQL checks, concurrency and upgrade rehearsals;
- the 13 browser suites;
- the unit tests;
- the translation checks, where no untranslated text and no untranslated database message are allowed.

**Acceptance (brief §46):** a release is finished only when all of these hold:

- the workflow reads naturally in all three languages, with a reasonable number of steps;
- errors say what to do;
- the controls can't be bypassed from the app or by calling the database directly;
- the postings, stock, reports, audit trail and permissions of each new scenario are asserted by tests, not just exercised.

---

## L. Plan

### L.1 Order of releases

| Stage | Release                                                                     | Migration | Depends on |
| ----- | --------------------------------------------------------------------------- | --------- | ---------- |
| P0    | **J** duplicate protection everywhere, audit coverage, fixes                | 0035      | —          |
| P0    | **K** cashier sessions, blind cash count, location on journal lines         | 0036      | J          |
| P0    | **L** partial refunds                                                       | 0037      | J, K       |
| P0    | **M** delivery corrections, reconciliation and ledger integrity             | 0038      | J          |
| P0    | **N** usage variance                                                        | 0039      | —          |
| P1    | **O** rules on Settings, negative-stock policies, aggregated waste approval | 0040      | J          |
| P1    | **P** sizes and add-ons                                                     | 0041      | L          |
| P1    | **Q** split payments                                                        | 0042      | K, L       |
| P1    | **R** US dollars at the till                                                | 0043      | O, Q       |
| P1    | **S** purchase orders, supplier returns, credit notes                       | 0044      | M          |
| P1    | **T** buying list                                                           | 0045      | S          |
| P1    | **U** production planning, use-by dates, batch lots                         | 0046      | O          |
| P1    | **V** loss kinds and accounts, giveaways, loss report                       | 0047      | O, U       |
| P2    | **W** staff, attendance, payroll                                            | 0048      | O          |
| P2    | **X** customers and loyalty                                                 | 0049      | L, O       |
| P3    | **Y** sales analysis and management reports                                 | 0050      | P, Q       |
| P3    | **Z** balance sheet and cash-flow statement                                 | 0051      | —          |
| P3    | **AA** PDF and attachments                                                  | 0052      | —          |
| P3    | **AB** branches                                                             | 0053      | K, O       |
| —     | **UX and integration pass**                                                 | —         | all        |

**Why this order.** The aggregated waste check (brief §21) is a control gap, so it comes with the rules at the start of P1 rather than at its end. The rules table must exist before the controls that read it. Partial refunds come before add-ons and split payments, because both change what a refund must reverse.

### L.2 Definition of done for each release (as for releases A–I)

1. A migration with SQL tests on PostgreSQL 16 and 17, concurrency checks, and the upgrade rehearsal.
2. The app, with `npm run verify` passing (format, types, lint, unit and translation tests).
3. Every browser suite passing, with the release's own checks added.
4. Docs updated: data model, test plan, limitations, progress and the guides.
5. **Go-live:**
   1. The migration is applied to the live database, then compared object by object with the tested build.
   2. It is checked as the owner in a transaction that is rolled back, so nothing is kept.
   3. The advisors are checked.
   4. A pull request is merged, and the live site is confirmed to serve the new build.

### L.3 Decisions only the owner can make

None blocks P0; each has a default that the rules screen can change later.

| #   | Decision                                                                                                                | Default until the owner says otherwise                                                     | Needed by                           |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | One cash drawer shared by cashiers with handovers, or one drawer per cashier?                                           | One drawer per branch, handed over with a count                                            | K                                   |
| 2   | Who may see the cash expected in an open drawer?                                                                        | Owner, general manager, accountant, auditor                                                | K                                   |
| 3   | May a cashier refund with a manager's PIN, or only managers?                                                            | Only managers (as today); cashiers with a PIN once rules exist                             | L, O                                |
| 4   | Refund amount needing a second person                                                                                   | Any refund over 25,000 IQD                                                                 | O                                   |
| 5   | Waste approval limit, and over what window it is added up                                                               | 50,000 IQD per person per session, and per item per day                                    | O                                   |
| 6   | Default negative-stock policy                                                                                           | Allow with an immediate alert; block for made items                                        | O                                   |
| 7   | US dollars: who sets the rate and how often; rounding; is change given in IQD only; are dollars deposited or exchanged? | A manager sets it daily with a reason; the IQD equivalent is rounded to 250; change in IQD | R                                   |
| 8   | Add-on prices: the same on every channel?                                                                               | Per channel, filled with the same price                                                    | P                                   |
| 9   | Staff meals and on-the-house: always through the till's "Give away"?                                                    | Yes for menu items; the loss screen for ingredients                                        | V                                   |
| 10  | PO approval: who, and above what amount?                                                                                | General manager or owner above 250,000 IQD; branch manager below                           | S                                   |
| 11  | Payroll: monthly or hourly; overtime rate; lateness and absence deductions; payday; advance limits                      | Monthly salary; overtime 1.5×; no automatic deductions; payday the 1st                     | W                                   |
| 12  | Loyalty: points or visits; the reward; expiry                                                                           | 1 point per 1,000 IQD; 100 points = 5,000 IQD off; no expiry                               | X                                   |
| 13  | Customer details kept, and customers' consent for messages                                                              | Name, phone, addresses, notes; no messages                                                 | X                                   |
| 14  | Tax                                                                                                                     | Out of scope (as requested)                                                                | —                                   |
| 15  | **Backups:** the live project keeps none on the free plan                                                               | Records so far are tests; decide before the real records begin                             | before the test records are cleared |

### L.4 Risks

- **Size.** Nineteen releases touch the core of sales, cash and the ledger. The rules that kept releases A–I safe apply to each one:
  - one migration per release, tested on both PostgreSQL versions;
  - applied live only after every suite passes;
  - compared object by object;
  - smoke-tested in a rolled-back transaction.
- **Deploy window.** Between a migration and its app, the old app keeps running. New parameters therefore always have defaults, and old signatures keep working until the release after.
- **Backups.** The free plan keeps no backups, so a mistake in a live migration could not be undone from a backup. Every change is additive and rehearsed, and today's records are tests, but the owner's decision (L.3 #15) should come before real trading records begin.
- **Learning curve.** Sessions and blind counts change the start and end of every shift. The cashier quick-start guide is updated with each release, and the till explains each new step on screen.

### L.5 The UX and integration pass (after P3)

Every screen is walked through as a new cashier, a new manager and the accountant, in all three languages, on a phone and a PC. The brief's questions (§47) are asked of each:

- **Confusion:** where would a cashier get confused, or a manager hesitate?
- **Wasted effort:** where is data entered twice, where are there too many clicks, and where does the system ask for what it already knows?
- **Risk:** where could someone make a financial mistake, and where should the system stop the user, or only warn?
- **Clarity:** where is important information hidden, and where must users understand accounting to work?
- **Automation:** where can the system safely automate?

Each finding is fixed and tested before the pass is closed.
