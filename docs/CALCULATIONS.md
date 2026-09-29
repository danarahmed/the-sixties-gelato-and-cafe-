# Inventory & Financial Calculation Specification

This is the contract the code implements. Every formula here is realised as a
pure function in `src/domain/*` and covered by tests. Everything that is
recorded is posted by the database functions of migration `0015`, which apply
the same formulas in exact `NUMERIC` and are tested against real PostgreSQL
(`tests/sql/`). The domain functions remain their specification. All arithmetic
is exact decimal; rounding is applied only at output boundaries.

## 1. Money

- `Money` = (amount: Decimal, currency). Currency defines `decimalPlaces`
  (IQD = 0). Mixing currencies throws. `quantize()` applies the scale at
  boundaries (receipt totals, journal lines, settlement figures).
- Never use `number` for money. (`src/domain/money/money.ts`)

## 2. Units & conversions

- Each item has one **base unit** (`factorToBase = 1`). Alternate units convert
  by an explicit factor: `base = value × factorToBase`; `target = base ÷
targetFactor`. Conversions are only valid within one dimension
  (count/mass/volume) and are validated + tested.
- Example: `1 carton_1000 = 1000 each`; `1 case_12x1L = 12000 ml`;
  `1 kg = 1000 g`; `1 bottle_700 = 700 ml`. (`src/domain/units/units.ts`)
- A unit in use keeps its size for good (`0027`): every delivery and count in
  it was taken at that size, so a different size is a new unit under its own
  name (`case_12`, not `case_24` changed). A kilogram is always 1,000 g and a
  litre 1,000 ml.

## 3. Inventory ledger & current stock

- `current_stock(item, location) = Σ base_quantity_signed` over all movements.
- Directional movement types apply a fixed sign (receipts +, issues −);
  adjustment/correction/reversal carry an already-signed magnitude.
- No edits/deletes. A reversal posts a `reversal` movement negating the original.
  (`src/domain/inventory/ledger.ts`, migration `0003`)

## 4. Moving weighted-average cost (WAC) — default

- State = (quantityBase, totalValue).
- **Receipt:** `quantity += q; value += landedValue`. Average `= value ÷
quantity`.
- **Issue** (sale/consumption/waste): valued at the current average;
  `value −= q × average`; the **average is unchanged** by issues.
- `unitCostSnapshot` returned on each issue is persisted against the source
  transaction so later cost changes never alter historical COGS.
  (`src/domain/costing/wac.ts`)

### Landed cost

`landedValue = goods + freight + otherLanded − rebate`; `unitCost = landedValue
÷ quantityBase`. Freight/rebates/discounts are allocated to lines before costing.

### A delivery's price, checked (`0027`, audit P1-3)

- A line is entered at its **price per unit received**, as the invoice gives it
  (a kilogram, a case of 24): `goods = unitPrice × quantity`, and what it cost a
  base unit is `goods ÷ (quantity × the unit's size)`. The form shows both as
  they are typed.
- That is set against **what the item costs now**: its average cost where it
  is received, or, with none on hand, what it cost at its last delivery. More
  than **25%** above or below, the delivery is refused, with both figures and
  nothing recorded, until the person confirms the price; the confirmation goes
  on the audit trail with what they were told. An item's first delivery has
  nothing to compare with.
- Worked example (the SQL test): cups that cost 50 each, received at 2.5 each,
  are refused ("95% below its cost now (50 each)"); confirmed, they are
  received. Two kilograms of beans at 9,000 a kilogram with 2,000 freight cost
  9 a gram as paid and 10 landed.
- A supplier's bill is typed from the invoice, never copied from the receipt;
  any difference from what the receipt recorded goes to 5050.
- Each item's **price history** lists its deliveries, newest first, with the
  supplier, what was paid a base unit and what it cost landed.

### A delivery corrected (`0038`)

A correction compares the delivery as it stands with the delivery as it
should be, item by item, and moves only the difference. What was entered
first is never changed.

- **How much of the delivery is still on the shelf**, `σ`, from 0 to 1: at the
  delivery it is 1; each use of the item since (a sale, a batch, a loss, a
  count) leaves `after ÷ before` of it, as average cost spreads every use over
  all the stock. Corrections and revaluations are not uses.
- **A price corrected**: `Δp = the line's corrected goods value − its value as
it stands` (freight and rebates shared out again by value, as on receipt).
  The part still on the shelf revalues the stock: `round(Δp × σ)`, as a pair
  of `cost_adjustment` movements (the stock out at its value, back in at the
  corrected value), so its quantity does not move. The rest, what was already
  used at the old price, goes to 5050 Purchase price variance; the cost of
  what was sold is not restated.
- **A quantity corrected**: the units that come off (or go on) the shelf move
  at `σ × the delivery's price + (1 − σ) × the average cost now`: at the price
  they came in at, as far as the delivery's stock is still there, and at the
  average for the rest. The stock left is never valued below zero: with
  nothing left its value is nothing, and below zero it is valued at the
  corrected price.
- **An item changed** is the old item's quantity off and the new one's on; a
  **reversal** is every line off. A supplier or a date changes the document
  only.
- **The journal**: Dr/Cr 1200 by the change in stock value, Cr/Dr 2050 by the
  change in what is owed (the corrected goods value less what it was), and
  5050 the difference between the two. With nothing to post, no journal.
- **Worked example** (the SQL test): beans 1,000 g at 10 a gram; 2 kg received
  at 6,000 a kilogram (12,000), 3,000 g now worth 22,000; fifty espressos use
  1,000 g, leaving 2,000 g and `σ = 2,000 ÷ 3,000`. The invoice says 12,000 a
  kilogram: `Δp = 24,000 − 12,000 = 12,000`, of which `round(12,000 × ⅔) =
8,000` revalues the 2,000 g on the shelf (14,667 → 22,667) and 4,000 goes to 5050. The journal: Dr 1200 8,000, Dr 5050 4,000, Cr 2050 12,000.
- Ten bottles entered at 300 of which eight came, nothing used since (`σ = 1`):
  the two go out at 300: Cr 1200 600, Dr 2050 600, exactly as if eight had
  been entered.

### FIFO (optional)

Where lot costing is required, issues consume oldest lots first at their lot
cost. WAC is the default; FIFO is a per-item/business option.

## 5. Recipe cost & channel-aware deduction

- A recipe expands to base-unit deductions **for a given channel**. Lines with
  no `appliesToChannels` apply to every channel; gated lines apply only to their
  channels. Sub-recipes expand recursively (cycles rejected).
- `recipeServingCost(channel) = Σ (average_unit_cost(item) × baseQty)` over the
  expanded deductions.
- Worked example — Iced Latte (demo costs):
  - **dine-in** deducts ingredients only (reusable glass).
  - **takeaway** adds cup + lid + straw.
  - **Talabat** adds cup, lid, straw, delivery bag, 2 napkins, sticker, tamper
    seal, carrier → demo COGS = **1,910 IQD**.
    (`src/domain/sales/recipe.ts`)

### Pricing a new recipe (the product form)

- The form costs a recipe while it is typed, the way `menu_costing` costs a
  sale: each line's quantity in its item's base unit (`quantity × factor`),
  lines of the same item added together for the channel, times the item's cost
  today (`item_issue_cost` at the default location, sent exactly by
  `item_costs()`), rounded to the currency unit, halves to even, once per item,
  then summed. The form's figure is therefore the product card's once saved.
  (`src/components/menu/recipeCost.ts`)
- **Margin** = price − cost of a serving on that channel; as a share of the
  price. Before any platform commission.
- **Suggested price** = cost ÷ (1 − target margin), rounded **up** to the
  business's rounding step (`discount_round_to`, 250 IQD at the café): the
  lowest round price that leaves at least the target (70% unless changed).
  Example: a serving costing 1,180 IQD at 70% → 3,933.33 → **4,000 IQD**
  (70.5%).

### The recipe and the price in force (`0025`)

- A sale, or a batch, uses the recipe version **that started last** on or
  before its day (latest `effective_from`, then the highest version number).
  A new version ends the day before a change already scheduled, so what is
  scheduled still takes over on its date; a new version starting the same day
  as another replaces it, and that one is never used. Example: a new recipe
  is scheduled for 1 November; on 10 October the recipe is changed again from
  that day. The 10 October recipe is used from 10 to 31 October, the
  1 November one from then on. (Before `0025` the 10 October change stayed in
  force for ever.)
- A price is in force from its date: the latest one dated on or before the
  day. A price can start today or later, never in the past, so every sale
  keeps the price it was made at. Each price set is on the audit trail.
- A price or recipe scheduled for a later date is listed on its product, and
  can be withdrawn (with a reason, on the audit trail) until it starts. A
  withdrawn recipe leaves the one it would have replaced in force.

### A line with its size and add-ons (`0041`)

A size is priced and costed as any product always was. A line's add-ons are
priced on the line's channel, on the sale's day (the latest price in force,
as for a product), and added to one of it:

- **one of the line** = the size's price + Σ (add-on's price × how many of it
  go into one); `sales_order_line.unit_price` is this.
- **the line** = one of it × the line's quantity, rounded to the currency
  unit; the sale's discount is spread over the lines as before.
- **each add-on's amount** = its price × how many × the line's quantity,
  rounded; the size's part is the line less its add-ons. A discounted line's
  discount is shared over its size and its add-ons in proportion
  (`allocate_landed`, the pennies to the largest), so each add-on keeps
  what it made (`sales_order_line_modifier.net_amount`).
- **what the line uses**: the size's recipe for the channel, and each
  add-on's lines (the size's own when it has any, otherwise those for every
  size; gated by channel as a recipe's are) × how many × the line's
  quantity, all checked against the rules for stock below zero together and
  costed at the average cost, as a recipe is. The line's cost includes them;
  each add-on keeps its own.
- **a printed bill** keeps each add-on at the price printed, as it keeps the
  line's own: more of the same add-on on that bill, on any line, is at that
  price too.

Worked example (the SQL test): two Triples (5,000) with oat milk (500), an
extra shot (750) and vanilla (500) are 6,750 each, 13,500; a Regular (2,500)
with whole milk (free) is 2,500; 16,000 in all. A discount of 1,600 leaves
12,150 on the Triples and 2,250 on the Regular; of the Triples' 1,350
discount the extra shots (1,500) bear 150, the oat milk and the vanilla
(1,000 each) 100 each, and the size's part (10,000) the other 1,000.

**The report** (Reports → Sizes and add-ons) gives each size's quantity,
sales and cost less its add-ons, and each add-on's own, from the sales
themselves (voids left out, refunds not taken off). How often an add-on is
taken is its lines out of the lines sold of the products that offer its
group today.

## 6. Production

- A batch consumes its recipe's ingredients (the version in force that day),
  each at its current average cost: `value = round(cost × quantity)`, lines of
  one item added together and rounded once, as a sale is. What came out goes
  into stock valued at **the total consumed**, so no cost is created or lost:
  `outputUnitCost = totalConsumed ÷ actualOutput`.
- `actualOutput` is what was weighed or counted, in any of the made item's units
  (kg, pans, pieces), or the recipe's yield × batches when left empty. The batch
  keeps both; `plannedOutput − actualOutput` is its yield difference. A short
  batch makes each unit cost more; nothing goes to profit and loss.
- Value only moves inside Inventory (1200), so a batch writes **no journal** and
  the stock ledger still agrees with 1200. Cancelling a batch reverses each of
  its movements at the value it had.
- Worked example (the SQL test): 2 batches of base use 8 L of milk at 1.5 a ml
  (12,000) and 1.6 kg of sugar at 1.2 a g (1,920): 10 L of base at 13,920, so
  1.392 a ml. One batch of pistachio gelato uses 4.5 L of base (6,264) and 500 g
  of paste at 30 a g (15,000): 21,264 for the 4.6 kg that came out of a planned
  5 kg, 4,622.61 a kg. A 120 g cup of it costs 554.71, rounded to 555.
  (`supabase/migrations/0023_production.sql`,
  `src/components/production/batchMath.ts`; the domain rule,
  `src/domain/inventory/production.ts`, is the same)

### The stock card (`0026`)

For any item and dates: **on hand when the first day began + each kind of
movement = on hand at the end of the last day**, which is what the stock board
shows. The kinds: opening stock recorded; received (less returns to
suppliers); sold (less voids, and refunds back on the shelf); used in batches;
made; wasted (waste, spoilage, melting, staff, complimentary, samples, damage,
expiry); counted; corrected; moved between locations. A void nets in "sold",
and a cancelled batch in "used in batches" or "made", so each line is what
really happened. Every movement is listed with the quantity and value on hand
after it.

### What to buy (`0045`)

For a location, each item bought (not an active batch recipe's output):

```
has        = on hand + on order (approved and sent orders, what they still wait for)
             + in draft orders
history    = days since the item was first at the location
days       = min(28, history)
used       = − Σ movements over the last 28 days that the stock card counts as
             sold, used in batches, or wasted and given away (voids, refunds
             back on the shelf and losses taken back net them off)
use a day  = used ÷ days                       (none with under 7 days of history)
lead       = the supplier's delivery days, else the café's (lead_time_days, 1)
reorder    = the item's reorder level, when it has one
             else use a day × (lead + 1) + safety stock
up to      = par level, else the most it holds, else reorder + 7 × use a day,
             else reorder; never below reorder
to order   when has < reorder (below it, as the alert says; at it is enough):
             packs = max(⌈(up to − has) ÷ pack⌉, 1)
```

With no reorder level of its own, an item with under 7 days of history has
**not enough history**; one not used in 28 days needs nothing.

Milk, 2,000 ml on hand, 1,000 ml a day for 25 days, a dairy two days away,
by the litre carton: reorder = 1,000 × 3 = 3,000; up to = 3,000 + 7,000 =
10,000; 2,000 < 3,000, so ⌈8,000 ÷ 1,000⌉ = 8 cartons.

**A pack's price:** the newer of the price agreed with the supplier and their
last delivery's (its goods' value ÷ its base quantity × the pack, before
freight), else what the item costs now × the pack, to be checked. Changing a
line's pack keeps its price per base unit (1.5 a millilitre is 1,500 a
carton) and works its packs out again.

### Batches by lot, and the day's plan (`0046`)

**A batch's use-by** = the use-by given, else when it was made + its recipe's
shelf life (none without one). A lot is made for each batch; the item is
kept batch by batch from then on.

**Which lot a movement takes from or gives to** (`lot_movement`, one row a
lot):

```
out      stock with no lot, then the lots by the earliest use-by, a lot past
         its use-by (at the movement's time) last;
         an "expired" loss, or a count's shortfall: past its use-by first,
         then stock with no lot, then the rest by the earliest use-by;
         beyond all of them: below zero, with no lot
a batch  its own lot; then what was taken beyond the stock before it came
         (stock with no lot below zero) is taken from it, the latest sale first
a return back to the lots it left, as far as they gave it, the earliest use-by
         first (a void: the sale; a refund back on the shelf: its line; a loss
         taken back: the loss; a batch cancelled: its batch, its output out of
         its own lot); the rest as stock with no lot
else in  stock with no lot (a count's surplus, a delivery)
```

At every place, Σ an item's rows = its stock; a lot's `left_base` = Σ its rows.

**What became of a batch** (`batch_reconciliation`), each from its lot's rows
by the kind the stock card gives their movement:

```
made = sold + used in batches + lost − counted − moved − corrected + left
```

(counted, moved and corrected are signed: 500 g missing on a count is −500).
Batch 3 of the SQL suite: 1,000 made = 100 sold + 400 lost − (−500) counted + 0
left.

**The day's plan** (`production_plan(day)`), for each batch recipe in use:

```
weeks    = min(8, ⌊days of history ÷ 7⌋)       (under 4: not enough history)
demand   = average over those weeks of what was sold and used in batches on
           the same weekday (voids and refunds netted off)
good     = max(on hand now − what is in lots due before the day is out, 0)
to make  = max(demand − good, 0)
batches  = ⌈to make ÷ a batch's yield⌉
short    = for each ingredient of those batches: max(needed − on hand, 0),
           for each recipe and for all of them together
```

Chocolate, 6 weeks of Mondays selling 1, 2, 3, 1, 2 and 3 kg (2 kg on
average), 1 kg good on a Monday: 1 kg to make, one batch of 4 kg; its 500 g
of cocoa against 300 g on hand: 200 g short.

## 7. Counting & variance

- `quantityVariance = counted − expected` (negative = shrinkage);
  `valueVariance = average_unit_cost × quantityVariance`. After approval a single
  signed `count_adjustment` movement is posted. Blind counts hide `expected`.
  (`src/domain/inventory/counting.ts`)
- `expected` is the stock **at the moment the item is counted** (`0024`,
  `stock_count_line.expected_at_count`, read under the item's lock when the
  line is recorded), not when the count opened. The café keeps trading while
  it counts: a sale, a delivery or a batch made before or after the item is
  counted is already in the ledger and is not posted again as a variance.
  Only one count is open at a location at a time; a count still being counted
  can be cancelled, with a reason, by its counter or a manager.

### Stock below zero, as the rules say (`0040`)

When a sale, a bill paid, a loss, a batch's inputs, a correction by hand or a
delivery corrected would take an item beyond what the books hold at the
location, the item's rule decides (Settings → Rules; the item's own, then its
kind's, then the café's):

- **refused**: nothing is recorded, and the answer says how much is there:
  "Only 0 g of Golden gelato is in stock: record the delivery or the batch
  first, or count it";
- **a manager approves it**: someone who approves stock corrections uses it
  themselves; anyone else needs one to type their PIN, and the approval is
  kept with the record and on the audit trail;
- **allowed, with a red alert**: recorded; the dashboard shows the item below
  zero until a delivery, a batch or a count puts it right;
- **allowed, with no alert**: for chosen items only.

By default what is made here (finished goods and sub-recipes) is refused, and
everything else is allowed with a red alert. The quantity short is judged
under the item's lock, so two tills selling the last unit at once sell it
once. A delivery corrected keeps its own confirmation for stock left below
zero; under a refusing rule the correction is refused.

### Losses, added up (`0040`)

A loss is valued as before, at the item's average cost. It needs a manager's
approval when, over the limit of the recorder's roles (_50,000 IQD_ by
default):

- the loss alone is over it; or
- the person's losses over the window, with this one, are over it — the
  window being each loss alone, the person's open cash session (the day, when
  they have none; _the default_), or the day; or
- the item's losses today by anyone, with this one, are over it.

A loss reversed on review is left out of every sum. A manager's own loss is
approved as it is recorded. Anyone else's loss over the limit is refused
unless a manager types their PIN, or the person saves it to wait: then it is
recorded at once (the stock is gone either way) and waits under **Needs you**
until a manager other than its recorder approves it, or reverses it (the stock
back at the loss's own value, its journal reversed, with a reason).

Worked example (the SQL test, a limit of 500): a barista's first 30 g of beans
(300) is under it; a second 30 g makes their day 600, so it waits; a second
barista's 20 g (200) is under the limit alone, but the beans' losses today
would be 800, so a manager approves it with their PIN.

### Losses by kind, and giveaways (`0048`)

A loss is recorded whole: an item in any of its units, or a product as its
recipe makes it (to eat in on Inventory; at the till as the till's channel
makes it, with its add-ons). What each line takes is added up item by item
(and by batch, when one is named); each item's movement is valued once, at
its average cost now, rounded to the dinar; the loss's value is the sum of its
movements, and one journal carries it: Dr the kind's account, Cr 1200
Inventory. Each line's share of it is its items' quantities at their costs,
rounded, the largest line taking what rounding leaves, so the lines add up to
the loss.

| Kind                                                  | Account                              |
| ----------------------------------------------------- | ------------------------------------ |
| waste, spoilage, expired, damaged, melt / evaporation | 5300 Waste & spoilage                |
| production waste, preparation waste                   | 5310 Production and preparation loss |
| staff consumption (a staff meal)                      | 6110 Staff meals                     |
| complimentary (on the house)                          | 6610 Complimentary items             |
| sampling (a sample)                                   | 6620 Marketing samples               |

5300 and 5310 are cost of sales, in the gross profit; 6110, 6610 and 6620 are
expenses below it. The approval is as above, on the loss's whole value and on
each of its items' day. A batch named gives what the loss takes, and no more
than it holds.

Worked example (the SQL test): two espressos given away as a staff meal, eaten
in, are 40 g of beans at 10: 400 IQD, Dr 6110, Cr 1200. One on the house to
take away is 20 g of beans and its cup: 200 + 50 = 250 IQD to 6610. A sample
with a shot of syrup (10 ml of milk at 1.5) is 200 + 15 = 215 IQD to 6620.

The report adds up the losses in the dates that were not reversed: by kind
(with the account each went to; a loss from before `0048`, to 5300), by item,
by person and by day; what waits for a manager is counted, and said apart.

### Usage against the recipes (`0039`)

Between two approved counts of an item at a location — from its line in the
first to its line in the last, each at the moment it was counted — the stock
ledger is split by what each movement is:

- **came in** = received (less returns, with the deliveries' corrections) +
  made + moved between locations + opening stock + corrected by hand;
- **the recipes say** = what the sales took, less what voids and refunds put
  back, + what the batches took;
- **lost** = what was recorded as waste, spoilage, melt, staff meals,
  giveaways, samples, damage or expiry, by its kind;
- what the counts themselves set, and revaluations, are left out: they are not
  use.

`used = first count + came in − last count − lost`;
`difference = used − the recipes say`; `% = difference ÷ the recipes say`;
`value = difference × the stock's average cost when last counted` (what the
item costs now, when there was none). A difference above nothing is stock
gone that nothing explains; below nothing, less went than the recipes say.
Since each count sets the ledger to what was counted, the difference is also
what the counts after the first found short.

Worked example (the SQL test): beans counted at 990 g; 500 g received;
fifteen espressos sold (300 g; two more voided); 30 g spoiled; counted at
1,130 g. `used = 990 + 500 − 1,130 − 30 = 330`; the recipes say 300; the
difference is 30 g, 10%, 300 IQD at 10 a gram.

What may explain a difference is said beside it: more or less used than the
recipes; no recipe using it; a recipe that changed between the counts; sales
voided after they may have been made; a delivery corrected; stock corrected by
hand; the books below zero when it was counted.

## 8. Delivery-platform economics

Customer payment ≠ revenue ≠ payout. Stored components drive a deterministic
payout:

```
grossSales        = merchantListValue
netMerchantSales  = grossSales − merchantFundedDiscount     (platform-funded not subtracted)
totalPlatformFees = commission + paymentProcessing + service + advertising + deliveryToMerchant
expectedPayout    = netMerchantSales − totalPlatformFees − refunds + otherAdjustments
channelContribution = expectedPayout − COGS
```

- Worked example (scenario 4): list 6,000; merchant-funded 500 → net 5,500;
  fees 1,350; refunds 500 → **payout 3,650**; COGS 1,910 → **contribution
  1,740**. (`src/domain/platform/settlement.ts`)

## 9. Settlement reconciliation (`0030`, audit P1-9)

**Card takings.** A settlement covers the days from the first one not yet
settled to a day that is over (the till takes cards until midnight):

```
till       = Σ 1010 lines of those days (card sales, less card refunds and voids)
fee        = the terminal's total − what reached the bank      (never below 0)
difference = till − the terminal's total                       (a note says why, when not 0)
journal:     Dr 1020 received · Dr 6500 fee · Dr 6300 difference (Cr when negative) · Cr 1010 till
```

Worked example (the SQL test): yesterday the till took 4,000 by card, the
terminal 1,500 (a sale of 2,500 rung as card was paid in cash) and 1,450
reached the bank: fee 50, difference 2,500 — Dr 1020 1,450, Dr 6500 50, Dr
6300 2,500, Cr 1010 4,000.

**A platform's statement.** Each line (order number, payout, and commission
and fees when the statement gives them) is matched to the platform order with
that number, ignoring case: `matched` when it waits to be paid out;
otherwise `not_found`, `already_paid`, `voided` (voided or refunded) or
`duplicate` (on the statement twice), and not posted. For a matched line:

```
expected   = the sale's net value (what 1100 took for it)
commission = expected − payout, when the line gives neither commission nor fees
difference = expected − payout − commission − fees            (a note says why, when not 0)
journal:     Dr 1020 Σ payout · Dr 5100 Σ commission · Dr 5200 Σ (fees + difference) · Cr 1100 Σ expected
```

The orders it leaves out are those waiting, sold no later than the latest one
it pays. Worked example (the SQL test): 5501 and 5503, 3,000 each, paid 2,550
and 2,400 with 450 commission each and 100 fees on 5503: Dr 1020 4,950, Dr
5100 900, Dr 5200 150 (100 fees and 50 not explained), Cr 1100 6,000; 5502,
sold between them, is left out.

Statements are pasted from the platform's report: amounts are read as
printed ("1,500", "IQD 2,550", "(900)"), a total row is left out, and
commission and fees printed as deductions (−450) are read as what the
platform kept (450).

## 10. Profit, shown separately (never one number)

Two figures carry a profit name, and each is labelled for what it is
(`0026`, audit P1-2):

- **Gross profit after waste & fees** (Dashboard, P&L): net revenue (4000 less
  4100 and 4200) less everything in cost of sales, 5000–5400: the cost of
  goods sold, purchase price differences, platform commission and fees, waste
  and count differences. The dashboard leaves out a year-end close posted that
  day, as the P&L always has.
- **Sales margin** (Sales by channel, Sales, Orders): net sales less the
  recipe cost of what was sold. Before waste, counts and fees.

**Net sales** are sales less refunds, a refund counted **on the day it is
made**, against the channel of the sale it refunds, and the cost of whatever
went back on the shelf taken off the cost: the ledger's own basis (4200 and
5000 on the day of the refund). So for any dates, Sales by channel's net sales
are the P&L's net revenue. Worked example (the SQL test): two takeaway
espressos (5,000, cost 500) and a bottle of water (1,000, cost 250) refunded
the same day, and a card espresso kept (2,500, cost 200): sales 8,500, refunds
6,000, net sales 2,500; cost 950 less the 250 bottle back on the shelf, 700;
sales margin 1,800.

1. **Gross sales** — before discounts.
2. **Net sales** — after merchant-funded discounts and refunds.
3. **Theoretical product cost** — recipe COGS at current cost.
4. **Gross profit** — net sales − COGS.
5. **Channel contribution** — expected payout − variable COGS (no fixed
   overhead).
6. **Allocated profit** — after an _optional, explicitly-labelled_ fixed-overhead
   allocation (rent/salaries/utilities). This is an estimate; the allocation
   method is a business choice.

### A discount's share, and the cap (`0028`, audit P1-10)

- A discount's **share of the bill** is what is judged against the cap
  (10%): a **percentage as it was asked** — rounding it to the business's
  step is the business's doing, not the cashier's, so 10% of 2,500 (250,
  given as 500 at a step of 500) is still 10% — and an **amount as the part
  of the bill it takes off**, never more than the bill, to two places.
- Above the cap, someone without `discount.approve` needs a manager's approval
  of at least that share; the till asks for the share rounded up to a whole
  percent (1,000 off 6,000 is 16.67%, asked as 17%).
- Worked examples (the SQL test): 300 off 2,500 is 12%, over the cap; 250 off
  2,500 is exactly 10%, within it; an approval of 20% does not cover 25%.
- The cap is a rule on Settings (`0040`): the café's, or one set for a role,
  the most any of the giver's roles allows. The step a percentage is rounded
  to is a rule too.
- An amount stays as it was given while a bill changes. Taken down from four
  espressos (10,000) to one (2,500), 1,000 off would be 40% of the bill:
  refused for a cashier, who takes the discount off or makes it fit (750 off
  three espressos, 10%).

### A refund a second person approves (`0040`)

A refund of more than the limit of the refunder's roles (_25,000 IQD_ by
default, the most any of their roles allows) needs a second person's name and
PIN; at or under it, a second person is optional, and a refund without one
waits for the owner on the exceptions report, as before. The amount judged
is what the refund gives back: 30,000 back is over the default; 25,000 is not.

### Sales costed at nothing (`0025`)

A sale's cost is what its recipe's ingredients cost when it was made. It is
**understated** — so its profit is overstated — when:

- a line has no cost because the product has **no recipe**, and was not
  marked as using no stock (a service charge, with its reason); or
- an ingredient was used **before it had any cost** (never received, and no
  opening stock at a cost), so its share went out at nothing.

An ingredient that has a cost but whose share rounds to nothing (a pinch of
salt) is not one of them. Such sales are listed on Reports (Uncosted Sales)
and counted as a **warning** on the month-end checklist: it does not stop the
lock, since a sale keeps the cost it was recorded with; the fix is for the
next sales — give the product its recipe, or the item its cost. A new product
must list what one serving uses, or say why it uses none.

## 11. Double-entry accounting

Every journal entry must balance (Σ debits = Σ credits) to currency precision or
it is rejected (enforced in `src/domain/accounting/journal.ts` **and** by the
database when the entry is published). A published entry never changes;
corrections are new entries. What each record posts (migration `0015`):

- Sale: Dr 1000 Cash in the till / 1010 Card clearing / 1100 Platform receivable (by
  tender) / Cr 4000 Sales; Dr 5000 COGS / Cr 1200 Inventory. A platform sale
  carries the platform's order number (`0030`), once. With a discount
  (`0019`): Cr 4000 at the full price, Dr 4100 Merchant-funded discount for the
  discount, and the tender at what was paid.
- The price a sale is made at (`0025`): the price in force that day, except a
  bill printed for the customer, which is paid at the prices printed on it —
  printing fixes each line's price, and more of the same product added later
  is at that price too (anything new is priced when the bill is printed
  again, or paid). The till sends the total it showed; if the database would
  record another (a price changed since the till loaded its menu), nothing is
  recorded, the till fetches today's prices, and the cashier tells the
  customer before taking the money again.
- Discount: a percentage of the bill, rounded to the nearest multiple of the
  business's `discount_round_to` (`0020`; a new business starts at 500; the
  café has used 250 IQD since 24 September 2026), exactly half-way rounding
  up. At 250: 47% of 8,500 is 3,995, given as 4,000; 7% of 5,000 is 350,
  given as 250; 5% of 2,500 is 125, exactly half-way, given as 250; 2% of
  2,500 is 50, given as nothing. Or a fixed amount,
  taken as typed. Never more than the bill. Each line carries its share in proportion to its
  value, the shares adding up to the discount exactly, so a refund returns
  what was paid.
- Void (until the drawer's session holding its cash closes, `0036`, and never
  once part-refunded, `0037`): the sale's journal reversed exactly.
- Refund: Dr 4200 Sales returns / Cr the tender's account (1000 cash, from
  the drawer's open session; 1010 card; 1100 what a platform owes); stock
  comes back only for items that are `returnable_to_stock`, Dr 1200 / Cr 5000
  at what it cost when it was sold. One journal per refund, reference
  `sale_refund`, narrated _"Refund 3 of sale 1a2b3c4d: Customer changed their
  mind"_.
- Refund by the item (`0037`): a line gives back its share of what it was
  sold for after the bill's discount (its `line_net`):

  ```
  gives back = money_round(line_net × how many ÷ how many were sold)
  last of the line = line_net − what earlier refunds of it gave back
  ```

  `money_round` is to the whole dinar, half to even. Three espressos with 500
  off the bill are 7,000; refunded one at a time they give back 2,333, 2,333
  and the 2,334 left, so a sale's refunds always add up to the sale. The
  stock a line took that can go back on the shelf comes back in the same
  proportion (to six decimal places, at the value it went out at, rounded as
  money), and the line's last refund takes exactly what is left of it. A
  refund can never give back more than was paid, less what earlier refunds
  gave. Worked example (the SQL test): 3 espressos at 2,500 and 2 bottles of
  water at 1,000, in cash; one of each refunded gives back 3,500 and puts the
  bottle (250) back on the shelf: 1000 Cr 3,500, 4200 Dr 3,500, 1200 Dr 250,
  5000 Cr 250.

- Split payment (`0042`): a sale paid in parts, each its own payment
  (`amount`, and for cash `received`, what was handed over), together the net
  exactly. The journal debits each payment's account with its parts, one line
  per account (two cards are one 1010 line). The change is not in the books:
  the cash line is the cash part, what was handed over less the change. Each
  cash part is a drawer event. Worked example (the SQL test): two espressos
  and a water, 6,000, paid 4,000 by card and 2,000 in cash with 5,000 handed
  over: 1000 Dr 2,000, 1010 Dr 4,000, 4000 Cr 6,000, 5000 Dr 650, 1200 Cr 650;
  the drawer takes 2,000 and the change is 3,000.
- A void of a split sale reverses its journal and takes back from the drawer
  what the sale put in it: its cash parts.
- A refund of a split sale gives back each way at most what is left of it
  (what it paid, less what earlier refunds gave back that way), together the
  refund: as the refunder chooses, or in proportion to what is left of each,
  in whole dinars adding up exactly (`allocate_landed`: the odd dinars to the
  largest remainders, the first of equals first). Its journal credits each
  way's account; only its cash leaves the drawer. Worked example (the SQL
  test): of the sale above, the water (1,000) gives back 333 in cash and 667
  to the card (2,000 : 4,000); an espresso, 1,667 in cash and 833 to the card,
  as the manager chose; the last espresso, the 2,500 left, all to the card,
  the only way something is left of.
- Payment in dollars (`0043`): dollars are worth `floor(usd × rate ÷ step +
0.5) × step` dinars (the step is the café's rule, 250; half-way rounds up),
  at the rate a manager set, which must be the rate the till showed and set
  within the rule's hours (36). They pay at most what they are worth; the
  rest of their value is the change, in dinars. The journal debits 1001 with
  their value and credits 1000 with the change, netted with the sale's other
  payments, one line per account. Worked example (the SQL test): an espresso,
  2,500, paid with $5 at 1,310: 6,550, counted as 6,500; change 4,000: 1001 Dr
  6,500, 1000 Cr 4,000, 4000 Cr 2,500, 5000 Dr 200, 1200 Cr 200. With 1,000 in
  dinars and $5 for the other 5,000 of a 6,000 sale, 1000 nets to Cr 500.
- The dollars held (a till's, or the safe's) are carried at what they were
  taken at: their value over their number is their average. Dollars leaving
  take their share, `value × usd out ÷ usd held`, rounded to the dinar; the
  last of them take all that is left.
- A close counts the till's dollars: a dollar short leaves at its share; one
  over comes in at the till's average (or, if it held none, the rate), to the
  dinar. The difference goes to 6300; all the dollars counted go to the safe:
  Dr 1006 / Cr 1001 at their value. Worked example: the till held $2 at
  2,588; $1 counted: the missing dollar 1,294 to 6300, the other 1,294 to the
  safe.
- An exchange: the dollars leave at their share of what the place holds; the
  dinars received go to the till, the safe or the bank; received less value is
  the difference, to 6950 (a gain credited, a loss debited). Worked example:
  $10 of the safe's $23, held at 30,166: their share 13,116, exchanged for
  12,500: 1005 Dr 12,500, 1006 Cr 13,116, 6950 Dr 616.

- Goods receipt: Dr 1200 Inventory / Cr 2050 Goods received not invoiced.
- Bill for a receipt: Dr 2050 (what the receipt raised), Dr/Cr 5050 Purchase
  price variance (the difference) / Cr 2000 Accounts payable. A bill for
  anything else: Dr its account / Cr 2000.
- A purchase order (`0044`) posts nothing. Its total is each line's quantity
  times its price, rounded to the dinar (half to even), added up; the
  approver's limit is compared with it. What has come of a line is the base
  quantity of its item in the deliveries against the order, as they stand
  after their corrections, reversed ones left out; still to come is the line's
  base quantity less that, never below zero; in the unit ordered it is `base ×
qty ordered ÷ base ordered`, to three places.
- A return to a supplier (`0044`): each line leaves stock at the item's cost
  now (the last of it with all that is left of its value). The supplier owes
  back the line's share of what the delivery named charged for that item,
  `landed × base returned ÷ base received`, rounded to the dinar, the last of
  it the rest of what the delivery charged less what went back before; with no
  delivery named, the stock value. Journal: Dr 2050 (the delivery not yet
  billed) or Dr 2000 (billed, or no delivery named) with what is owed back,
  Cr 1200 the stock value, the difference to 5050 (Dr when the stock was worth
  more). A delivery's goods received not invoiced is its landed value less
  what went back from it. Worked example (the SQL test): a delivery of 3,000
  in stock since used at a lower average, returned after the bill: 1200 Cr
  2,778, 2000 Dr 3,000, 5050 Cr 222, and credit 3,000 set against its bill.
- A supplier's credit (`0044`) for a lower price on a delivery: no more than
  the delivery is still worth to the supplier (its landed value less what went
  back and earlier price credits). It is shared over the delivery's items by
  their value; of each item's share, the part still on the shelf (reckoned as
  a delivery's correction reckons it, `0038`) comes off the item's stock value
  (a pair of cost adjustments), and the rest, for what was used since, goes
  to 5050: Dr 2000 the credit / Cr 1200 the share / Cr 5050 the rest. For
  other: Dr 2000 / Cr the account chosen. Set against a bill, a credit counts as paid: a bill's paid
  amount is its payments plus the credits set against it; a credit is set
  against a bill no more than the bill still owes and no more than is left of
  the credit. What a supplier is owed is their bills less their payments less
  their credits, whether set against a bill or not.
- A supplier's statement (`0044`): what was owed before the first day
  (bills, less payments, less credits, a cancelled bill's charge taken back
  on the day it was cancelled), then each record in date order with the
  balance after it; what was owed at the end is the last balance.
- Payment of a bill: Dr 2000 / Cr where the money came from (`0024`): 1000
  the till, 1005 the safe, 1020 the bank or a card (a card paid from 1010
  until `0030`), or 3000 Owner equity when the owner paid personally (capital
  they put in).
- Expense: Dr its account / Cr where the money came from, the same five.
- Waste: Dr 5300 Waste & spoilage / Cr 1200. Stock correction and approved
  count variance: 5400 Inventory count variance against 1200.
- Opening stock: Dr 1200 / Cr 3000 Owner equity — for a new item, or (`0024`)
  for an item with no stock history yet, at the cost typed; once an item's
  stock has moved it changes only through its own records.
- Cash session (`0036`, replacing the drawer count of `0024`, which replaced
  the day close): a session covers every movement of cash at its drawer from
  its opening count to its closing count, whatever the date — the café trades
  past midnight, so one night's session covers two calendar days. At the
  opening, `opening_variance = opening_counted − opening_expected`, where
  `opening_expected` is what the last session left in the drawer. At the
  close, `expected = opening_counted + Σ cash events in the session`, the
  events being: cash sales +, cash refunds −, voids of cash sales −, paid out
  of the till −, cash put into the till +, cash taken out −; and
  `variance = counted − expected`. Each variance posts Dr 6300 Cash over /
  short / Cr 1000 when short, the reverse when over. What does not stay in the drawer goes to
  the safe (Dr 1005) or the bank (Dr 1020), Cr 1000. A session a manager
  closes without a count posts nothing: all of `expected` stays, for the next
  opening count. A float from the safe at the opening is Dr 1000 / Cr 1005,
  after the count. The first session on a drawer takes over from what came
  before: `opening_expected` is what the last drawer count left plus the cash
  events since (the cash taken since the last day closed the old way was
  carried in as events when `0024` went in), or, for a drawer never counted,
  the balance of 1000 less the cash the other locations' drawers are known to
  hold. A sale recorded after the close is in the next session.
- Moving cash between the till, the safe (1005), the bank (1020) and the
  owner: Dr where it goes / Cr where it came from; money the owner takes for
  themselves is Dr 3200 Owner drawings, and only the owner may take it.
- The till's account 1000 always equals what the drawer should hold; it moves
  only through sales, refunds, payments, counts and moving cash, never a
  manual journal. Neither the till nor the safe may pay out more than the
  books say it holds.
- Card settlement and a platform's payout (`0030`): see §9. Cancelling one
  reverses its journal exactly.
- A delivery's correction (`0038`): see §4, _A delivery corrected_. One
  journal per correction, reference `receipt_correction`, narrated
  _"Correction 3 of delivery 12: Two bottles short on the invoice"_.
- **Do the books tie?** (`0019`, `0038`) Each subledger against its account,
  as at the end of a day; every one must be zero to lock the month:
  - the stock ledger's value against 1200;
  - the bills not yet paid against 2000;
  - what is owed for deliveries not yet billed (as corrected) against 2050;
  - the sales less their refunds against 4000 less 4100 and 4200;
  - the card takings of the days not yet settled against 1010;
  - the orders the platforms owe, less what was refunded and what a statement
    paid out, against 1100 (the sales from before order numbers owed too,
    less the payouts typed by hand, as far as they go);
  - what each drawer should hold (its session's opening count and cash since,
    or what its last count left and the cash since) against 1000, once a
    drawer has been counted in a session;
  - the cash moved in and out of the safe, and the expenses and bills paid
    from it, against 1005;
  - the records without their one journal, and the automatic journals
    without their record: a count, which must be nothing.
- Year end: revenue and expense accounts closed to 3100 Retained earnings.

## 12. Alerts and the daily brief (`0029`, audit P1-8)

Each rule reads the books as they are when the dashboard opens; the numbers in
_italics_ are thresholds the owner can change on Settings (their defaults
shown).

- **Cash below zero** (🔴): the balance of 1000 (till), 1005 (safe) or 1020
  (bank) under 0.
- **Drawer not counted:** days before today with cash no closed session (or
  drawer count) has taken in; 🟠 for one day, 🔴 for two or more.
- **Session open too long** (`0036`): a session open longer than _14 hours_;
  🔴 at twice that.
- **Session short** (`0036`): in the last 7 days, a session that closed short
  of what it should have held, or opened short of what the last one left, by
  _5,000 IQD_ or more; 🔴 at five times that.
- **Session closed by a manager** (`0036`, 🟠): in the last 7 days, with the
  reason and whether it was counted.
- **Stock count left open** (🟠): open longer than _8 hours_.
- **Running out:** `daily use = use over the last 14 days ÷ min(14, days of
history)`, where use is what sales, production, waste and spoilage took off
  the shelf, less what refunds and voids put back. `days of cover = on hand ÷
daily use`; it fires when that is under `lead + 1` days, the lead being the
  item's last supplier's delivery time or the café's _1 day_. 🔴 under a day,
  🟠 otherwise. Quiet with under 7 days of history, and on a day the item is
  received. Sure with 28 days of history or more, fairly sure with 14–27, an
  early sign with 7–13. It suggests ordering `ceil(daily use × 7)`, a week's
  worth (or a batch, for an item made on Production).
- **Below the reorder level** (🟠): on hand under the item's reorder level,
  items never stocked included; not said again for an item running out.
- **Delivery price confirmed** (🟠): a receipt confirmed at a price more than
  25% from the item's cost (`0027`), for 7 days after.
- **Margins:** each product on each channel it is priced on, at today's cost
  (every ingredient at what a sale would take it off the shelf at now): `cost
= Σ round(quantity × cost a base unit)`, `margin = (price − cost) ÷ price`.
  🔴 when the price is under the cost; 🟠 when the margin is under _70%_. The
  margin is shown cut, not rounded, to one decimal (`0030`): 69.97% is "69.9%
  margin", never "70%".
  Fairly sure when an ingredient has none on hand, so its cost is its last
  delivery's. A product whose ingredient has no cost yet waits: that
  ingredient is named once instead, with the products that use it (🟠 no
  cost); a product sold with no recipe, and no reason for using no stock, is
  🟠 once, whatever its channels.
- **Waste above its usual** (🟠): waste (5300) in the last 7 days against the
  usual week, `prior waste ÷ prior days × 7`, the prior days being days 8–35
  back, at most 28 and at least 7 (so the books need 14 days of history). It
  fires above _1.5_ times the usual week and above _20,000 IQD_. Fairly sure
  with four weeks to compare with, an early sign with fewer.
- **One person's exceptions** (🟠, fairly sure): over the last 7 days, the
  voids and refunds they made, the discounts they gave and the bills with
  items they cancelled — at least _10_ of them, or their amount more than _3%_
  of the person's own sales (every sale they rang, voided ones included).
- **Card money not banked** (🟠, sure; `0030`): 1010's balance less what came
  into it in the last _3_ days — card takings older than that, not yet
  settled.
- **Platform money not received** (`0030`): for each platform, its orders not
  paid out and sold more than _7_ days ago, by number, with the oldest (🟠,
  sure); and what 1100 holds that the orders waiting do not explain, either
  way (🟠, fairly sure) — sales from before order numbers, or a payout recorded
  by hand.
- **Bill due** (🟠): a supplier bill not paid in full, due within _3 days_ or
  overdue.
- **Price typo** (🟠, fairly sure): a product's highest channel price more than
  _3_ times its lowest.
- **Possible duplicate payment** (🟠, fairly sure): two expenses, bills or
  journals to the same 6xxx account for the same amount within 3 days in the
  last 30, neither reversed.
- **Usage unlike the recipes** (`0039`, fairly sure): an item whose last two
  approved counts at a location, the later in the last 14 days, show a
  difference (see §7) of at least _10%_ of what the recipes say and at least
  _5,000 IQD_; 🟠, or 🔴 at five times the amount. An item no recipe uses has
  no share, and is left to the Usage screen.
- **Stock below zero** (`0040`, 🔴, sure): an item the books hold less than
  nothing of at a location, unless its rule allows that with no alert. It
  clears when a delivery, a batch or a count puts the item back at zero or
  more.
- **Losses waiting for approval** (`0040`, 🟠, sure): losses saved to wait for
  a manager, with how many and what they are worth; 🔴 once one has waited
  two days.
- **Clocked in a long time** (`0049`, 🟠, sure): someone clocked in for more
  than the rule's hours (_16_); 🔴 after a day. Hours left open are paid as
  worked, so a forgotten clock-out becomes overtime.
- **Salaries due** (`0049`, 🟠, sure): from payday (the _1st_), last month's
  payroll not approved, or approved and not paid in full; 🔴 a week after
  payday.

**The brief** of a day (midnight to midnight, Baghdad time):

- _Facts:_ sales (not voided, bills paid), net sales (the revenue accounts,
  credit less debit, as the P&L has them — after voids, refunds and
  discounts), voids and refunds made that day and their amounts, discounts
  and their amounts, waste (5300), the drawer's closes (sessions since `0036`,
  counts before) and the sum of their differences, sales costed at nothing.
- _Calculations:_ `cost of goods` (5000) and its share of net sales; `gross
profit = net sales − every 5xxx account` (waste, count differences, price
  differences and platform fees included) and its share; the same weekday a
  week before, and `change = (net sales − last week) ÷ last week`; the usual
  for the weekday, the average of the four before that had sales.
- _To do:_ the action of every red alert nobody has answered; else how many
  orange ones wait; else nothing.

Worked example (the SQL test): two espressos (5,000, cash), one takeaway on
card (2,500, voided), a water with 10% off (900, refunded, the bottle back on
the shelf), 100 g of beans wasted (1,000) and the drawer counted at 4,500:
net sales 5,000 over 2 sales; cost of goods 400 (8%); gross profit 3,600
(72%); the drawer 500 short.

## 13. Staff, their hours and their pay (`0049`)

**A day's hours.** A person's records of a day (by the café's clock, the day
they clocked in) add up to the minutes worked, a record still open counting
until now. Against the schedule, with the rule's grace (_5_ minutes):

```
late        = first in − shift start     (when first in > shift start + grace)
left early  = shift end − last out       (when last out < shift end − grace)
absent      = a shift that has ended with no record that day
overtime    = max(minutes worked − standard hours × 60, 0)
```

Overtime is counted each day, scheduled or not. Lateness, leaving early and
absence are shown on Staff, Payroll and Reports, and deducted only when a
manager deducts them on the payroll, with a note.

**An hour's pay**, for overtime:

| Paid         | An hour's pay              |
| ------------ | -------------------------- |
| by the hour  | the rate                   |
| by the day   | rate ÷ standard hours      |
| by the month | rate ÷ 30 ÷ standard hours |

**A month's pay**, each person who worked here some of the month:

```
base      by the month: rate × days employed ÷ days in the month
          by the day:   rate × days worked (days with minutes worked)
          by the hour:  rate × (minutes worked − overtime minutes) ÷ 60
overtime  = money_round(an hour's pay × overtime % ÷ 100 × overtime minutes ÷ 60)
gross     = base + overtime + added − deducted     (deducted no more than earned)
taken back = what the advances still owe, as far as the gross goes
             (or the amount chosen, no more than that)
to be paid = gross − taken back
```

The overtime percentage is the person's, or the café's rule (_150%_). Each
figure is rounded to the whole dinar, half to even.

**The journals:**

- An advance: Dr 1300 Employee advances, Cr where the money came from (1000
  the till, from the open drawer; 1005 the safe; 1020 the bank; 3000 the
  owner). Cancelled, the journal is reversed.
- A payroll approved: Dr 6100 Salaries the gross, Cr 2100 Salaries payable
  what is to be paid, Cr 1300 the advances taken back, dated on the month's
  last day at noon, so the cost lands in the month worked. Reopened, that
  journal is reversed; approved again, a new one is posted.
- A salary paid (to one person, or everyone at once): Dr 2100, Cr where the
  money came from. Cancelled, the journal is reversed.

**The checks:** salaries owed (what is to be paid of every approval not
reopened, less what was paid and not cancelled) against 2100 Salaries payable,
and advances not taken back (advances not cancelled, less what approved
payrolls took back) against 1300 Employee advances, each difference zero.

Worked example (the browser test): Rana, 600,000 a month, 8 hours a day, works
the whole of August with one day of 10 hours, and owes an advance of 50,000;
Omar, 3,000 an hour, works 6 hours. An hour of Rana's pay is 600,000 ÷ 30 ÷ 8 =
2,500, and her two hours of overtime at 150% are 7,500; with a bonus of 25,000
her gross is 632,500, and she is paid 582,500 after the advance. Omar's gross
is 18,000. The payroll posts Dr 6100 650,500, Cr 2100 600,500, Cr 1300 50,000,
and paying everyone from the bank Dr 2100 600,500, Cr 1020 600,500.

## 14. Customers and their points (`0050`)

**A phone number** is kept one way, so a customer is found however it is
typed: Arabic and Persian digits become 0–9; spaces, dashes, dots and brackets
go; `00` becomes `+`; a number starting `964` gains its `+`, one starting `0`
loses the 0 for `+964`, and ten digits starting 7 gain `+964`. What is left is
a number when it is `+` and 8 to 15 digits, and an Iraqi one (`+964`) has 8 to
10 digits after the code. `0770 123 4567`, `+964 770 123 4567` and
`٠٧٧٠١٢٣٤٥٦٧` are all `+9647701234567`, one customer.

**Points.** Every point is a row that never changes; a customer's points are
the sum of theirs. With the rules (_1 point per 1,000 IQD, 100 points a reward
of 5,000 IQD_, both on Settings):

```
earned     = floor(what the sale comes to, after its discount ÷ 1,000)
             once, when the sale is paid; the rate is kept on the row
rewards    = floor(points ÷ 100)          what a customer can take now
a reward   = 5,000 off the bill, whole, for 100 points
             no more rewards than the bill comes to, 20 at most
```

A reward is the bill's discount (Dr 4100, reason "Loyalty reward"), so a bill
with another discount takes none, and a sale with a reward earns on what is
left to pay. Nothing is kept as a liability; the report's points outstanding
are what customers hold:

```
outstanding       = the sum over customers of max(their points, 0)
outstanding value = money_round(outstanding ÷ 100 × 5,000)
```

**A void** takes back all the sale earned and gives back all it spent.
**A refund** does so for what it gives back:

```
kept        = floor((what the sale came to − all given back so far) ÷ the rate it earned at)
taken back  = what it earned − kept − what refunds took back before
given back  = floor(points spent × all given back so far ÷ what the sale came to)
              − what refunds gave back before
```

Once the sale is refunded in full, all it earned is taken back and all it spent
given back. Points by hand (`loyalty.adjust`) are 10,000 at most at a time,
with a reason, and never take a customer below nothing.

**What a customer bought** (Customers, the report): their sales paid (in full
or refunded in part or whole), each at what it came to less what was given
back; a voided sale counts nothing.

Worked example (the SQL test): Rozh has 100 points and buys four espressos,
10,000, taking a reward: the sale comes to 5,000 and earns 5, and the reward
spends 100, leaving 5. Two espressos given back are 2,500: the 2,500 kept earns
2, so 3 are taken back, and half the 100 spent (50) comes back: 52. The other
two given back take back the last 2 and give back the other 50: 100, as before
the sale.

## 15. The sales analysis, the stock's value on a day, and what was bought (`0051`)

**The sales of the dates** are those paid in them by the café's clock, voided
ones left out. Seen by the lines they sold (every way but the add-ons and the
payments), each line counts as it was sold, its add-ons with it:

```
sold for   = what the line came to before the discount (quantity × unit price, add-ons in)
discount   = its share of the sale's discount
net        = sold for − discount                  (the lines of a sale add up to it)
cost       = what it used, at the cost it was sold at
margin     = net − cost
given back = what the sale's refunds gave back of the line, whenever they were made
kept       = net − given back
margin kept = kept − (cost − the cost the refunds put back)
```

So the products, the categories, the sizes, the hours, the days, the people,
the channels and the branches all add up to the same sales. An order is
counted once in a row however many of its lines are in it, so the rows' orders
can add up to more than the total's. A refund from before refunds by the item
(`0037`) gave back the whole sale; the cost it put back is shared over the
sale's lines by their cost.

**The hour and the weekday** are the café's clock's: the hour 00 to 23, and
the weekday from Saturday (0) to Friday (6).

**The add-ons** are each as sold on its line, its share of the line's
discount taken off (as on the receipt); refunds are not taken off them.

**The payments** are what each way of paying took of the sales, their refunds
given back the same way (a refund from before refunds by the item, by its
sale's first payment): paid − given back = kept, and all the ways come to the
sales' net.

**The stock's value at the end of a day**, item by item and in all:

```
in stock = Σ quantity of every movement before the day's end
value    = Σ value × sign(quantity) of the same movements
```

— the stock ledger side of the books check, set against what 1200 held then
(`gl_balance_at`); the two agree when the books tie.

**What was bought in the dates:** each delivery received in them, as its
latest correction left it (a delivery reversed whole counts nothing), its
landed costs shared in; by supplier, less what went back to them in the dates
(at what they owe back) and the credits they gave for price; and by item, what
a unit came to (received ÷ quantity).

Worked example (the SQL test): four sales of a day come to 17,300 (17,750 less
a 450 discount) and used 1,750: a margin of 15,550. One espresso of a sale
given back, 2,500, leaves 14,800 kept and a margin kept of 13,050. By product,
the espressos come to 15,500 and the waters 1,800; by payment, the card took
11,250 (2,500 given back that way) and the cash 6,050, together the 17,300.

## 16. The balance sheet and the cash-flow statement (`0052`)

**The balance sheet at the end of a day** reads every published journal dated
before the day ended by the café's clock:

```
an asset                 = its debits − its credits   (accumulated depreciation, 1590, is negative)
a liability, the equity  = its credits − its debits   (the owner's drawings, 3200, are negative)
profit this year         = revenue − expenses from 1 January to the day's end, not yet closed
profit of earlier years  = revenue − expenses before 1 January, not yet closed
equity in all            = the equity accounts + profit this year + profit of earlier years
difference               = assets − liabilities − equity in all        (nought: it balances)
```

The cash is 1000, 1001, 1005, 1006 and 1020; the fixed assets 15xx; the other
assets are current. The year-end close (on locking December) moves the year's
revenue and expenses into 3100 Retained earnings, dated the year's last
minute: after it, that year's profit is in 3100 and nowhere else.

**The cash flow of the dates**, by the direct method. The cash at the start is
the cash accounts' balance when the day before the dates ended; at the end,
when their last day ended. Every published journal of the dates with a line on
a cash account is read by its other lines,

```
each other line = its credits − its debits: cash came from it (+), or went to it (−)
```

summed, journal by journal, by the line of the statement its account is on:

| Line                            | Accounts                                 | Section   |
| ------------------------------- | ---------------------------------------- | --------- |
| Received from sales             | 4xxx, 1010, 1100, 5100, 5200, 6500       | operating |
| Paid for stock and to suppliers | 12xx, 2000, 2050, the rest of 5xxx       | operating |
| Paid to staff, and advances     | 1300, 2100, 61xx                         | operating |
| Running costs                   | every other account (6000, 6200, 6900 …) | operating |
| The drawer counted over/short   | 6300                                     | operating |
| Equipment bought or sold        | 15xx                                     | investing |
| The owner's money in and out    | 3xxx                                     | financing |
| Dollars changed at another rate | 6950                                     | exchange  |

A line whose accounts cancel in a journal (a sale's cost, 5000, and the stock
it used, 1200) is no flow. A bill paid (Dr 2000) is read as the account the
bill was charged to, when it was charged to one: a grinder's bill, paid, is
equipment; a bill for goods delivered stays paid to a supplier. Money moved
between cash accounts has no other line, and is no flow.

```
cash at the start + every line = cash at the end        (the difference nought)
```

Worked example (the SQL test). Two days ago the owner put 400,000 in the bank
and 50,000 in the safe; yesterday the card takings of 3,000 reached the bank,
less a 60 fee. Today: 5,000 of sales in cash; 4,500 by card; 5,000 split,
2,000 in cash and 3,000 by card; an espresso paid with $5 (kept at 6,500,
4,000 change in dinars), the $5 then changed for 6,700; 2,500 refunded in
cash; 1,000 of cloths from the till; 1,500 from the till to the safe; 20,000
to the owner; a 150,000 grinder, billed and paid from the bank; 10,000 paid of
an 18,000 bill for beans; a 20,000 electricity bill paid from the safe; 5,000
advanced to someone who works here; 700 of cleaning paid from the bank and
reversed; and the drawer counted 500 short. Today's cash flow:

```
received from sales          7,000   (5,000 + 2,000 + 2,500 − 2,500 refunded)
paid to suppliers          −10,000
paid to staff               −5,000
running costs              −21,000   (the cloths and the electricity; the cleaning came back)
the drawer short              −500
from running the café      −29,500
the grinder               −150,000
the owner                  −20,000
dollars changed               +200
net                       −199,300   452,940 at the start → 253,640 at the end
```

The balance sheet that evening: 453,440 of assets (253,640 of cash, 7,500 of
card takings not yet in the bank, 37,300 of stock, the 5,000 advance and the
150,000 grinder) = 8,000 owed for the beans + the owner's 451,000 (471,000 put
in, the stock included, less the 20,000 taken) − the 5,560 lost so far this
year.
