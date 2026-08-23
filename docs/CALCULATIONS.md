# Inventory & Financial Calculation Specification

This is the contract the code implements. Every formula here is realised as a
pure function in `src/domain/*` and covered by tests. All arithmetic is exact
decimal; rounding is banker's rounding (ROUND_HALF_EVEN) applied only at output
boundaries.

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

## 6. Production

- Consumes recipe inputs at current average cost; outputs finished goods valued
  at **total consumed value** (no cost created/lost). `outputUnitCost =
totalConsumed ÷ actualOutput`. `yieldVariance = plannedOutput − actualOutput`.
- Demo: pistachio batch consumes 18,300 IQD, actual yield 4,800 g →
  3.8125 IQD/g; planned 5,000 g → variance +200 g.
  (`src/domain/inventory/production.ts`)

## 7. Counting & variance

- `quantityVariance = counted − expected` (negative = shrinkage);
  `valueVariance = average_unit_cost × quantityVariance`. After approval a single
  signed `count_adjustment` movement is posted. Blind counts hide `expected`.
  (`src/domain/inventory/counting.ts`)

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

## 11. Double-entry accounting

Every journal entry must balance (Σ debits = Σ credits) to currency precision or
it is rejected (enforced in `src/domain/accounting/journal.ts` **and** by a
deferred DB trigger). Corrections are reversing entries. Representative auto-
postings (to be wired to events):

- Cash sale: Dr Cash / Cr Sales; Dr COGS / Cr Inventory.
- Platform sale: Dr Platform receivable / Cr Sales; Dr Commission+Fees / Cr
  Platform receivable; Dr Merchant-funded discount / Cr Sales(contra).
- Purchase receipt: Dr Inventory / Cr Accounts payable.
- Waste: Dr Waste & spoilage / Cr Inventory.
- Cash variance: Dr/Cr Cash short/over.
