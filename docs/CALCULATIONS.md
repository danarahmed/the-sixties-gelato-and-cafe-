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

## 9. Settlement reconciliation

Match our expected orders to a settlement statement and flag: `missing_payout`,
`unmatched_settlement_line`, `duplicate_settlement_line`, `payout_difference`,
`incorrect_commission`, `cancelled_still_charged`, `unexplained_adjustment`. A
tolerance handles rounding (0 for IQD). Commission is re-derived from rate × base
to validate charges.

## 10. Profit, shown separately (never one number)

1. **Gross sales** — before discounts.
2. **Net sales** — after merchant-funded discounts and refunds.
3. **Theoretical product cost** — recipe COGS at current cost.
4. **Gross profit** — net sales − COGS.
5. **Channel contribution** — expected payout − variable COGS (no fixed
   overhead).
6. **Allocated profit** — after an _optional, explicitly-labelled_ fixed-overhead
   allocation (rent/salaries/utilities). This is an estimate; the allocation
   method is a business choice.

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
  tender) / Cr 4000 Sales; Dr 5000 COGS / Cr 1200 Inventory. With a discount
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
- Void (before the drawer holding its cash is counted, `0024`): the sale's journal reversed exactly.
- Refund: Dr 4200 Sales returns / Cr the tender's account; stock comes back
  only for items that are `returnable_to_stock`.
- Goods receipt: Dr 1200 Inventory / Cr 2050 Goods received not invoiced.
- Bill for a receipt: Dr 2050 (what the receipt raised), Dr/Cr 5050 Purchase
  price variance (the difference) / Cr 2000 Accounts payable. A bill for
  anything else: Dr its account / Cr 2000.
- Payment of a bill: Dr 2000 / Cr where the money came from (`0024`): 1000
  the till, 1005 the safe, 1020 the bank, 1010 a card, or 3000 Owner equity
  when the owner paid personally (capital they put in).
- Expense: Dr its account / Cr where the money came from, the same five.
- Waste: Dr 5300 Waste & spoilage / Cr 1200. Stock correction and approved
  count variance: 5400 Inventory count variance against 1200.
- Opening stock: Dr 1200 / Cr 3000 Owner equity — for a new item, or (`0024`)
  for an item with no stock history yet, at the cost typed; once an item's
  stock has moved it changes only through its own records.
- Drawer count (`0024`, replacing the day close): a count covers every
  movement of cash at the location since the last count, whatever the date —
  the café trades past midnight, so one night's count covers two calendar
  days. `expected = start + Σ cash events`, where `start` is what the last
  count left in the drawer (for the first count after days closed the old
  way, the cash typed in — the cash taken since the last such close was
  carried in as events when `0024` went in) and the events are: cash sales +, cash refunds −,
  voids of cash sales −, paid out of the till −, cash put into the till +,
  cash taken out −. `variance = counted − expected`, posted Dr 6300 Cash over
  / short / Cr 1000 when short, the reverse when over. What does not stay in
  the drawer goes to the safe (Dr 1005) or the bank (Dr 1020), Cr 1000. A
  sale recorded after the count is in the next one.
- Moving cash between the till, the safe (1005), the bank (1020) and the
  owner: Dr where it goes / Cr where it came from; money the owner takes for
  themselves is Dr 3200 Owner drawings, and only the owner may take it.
- The till's account 1000 always equals what the drawer should hold; it moves
  only through sales, refunds, payments, counts and moving cash, never a
  manual journal. Neither the till nor the safe may pay out more than the
  books say it holds.
- Year end: revenue and expense accounts closed to 3100 Retained earnings.
