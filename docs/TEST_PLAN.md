# Test Plan

## Layers

1. **Domain unit tests** (`tests/primitives.test.ts`, `src/domain/**`) — money
   precision, unit conversions, WAC, journal balancing.
2. **Acceptance scenarios** (`tests/acceptance.test.ts`) — the 12 required
   business scenarios, end-to-end through the domain core, no database.
3. **Database integrity** — migrations applied to PostgreSQL 16; append-only,
   idempotency-uniqueness, financial-immutability, and journal-balance guards
   exercised directly in SQL (documented in commit history; reproducible via
   `supabase db reset`).
4. **Build/type** — `tsc --noEmit` (strict) and `next build` must pass.
5. **E2E (planned)** — Playwright across phone/tablet/desktop and EN/AR/CKB,
   online and offline.

Run everything: `npm run verify`. Domain + acceptance only: `npm test`.
**Current result: 25 tests passing; typecheck and build green.**

## The 12 acceptance scenarios (spec §16) — all automated & passing

| #   | Scenario                                                                                                     | Where         |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------- |
| 1   | Receiving 1 carton of 1,000 straws increases stock by exactly 1,000 each                                     | `Scenario 1`  |
| 2   | Medium takeaway iced latte deducts correct coffee, milk, syrup, ice, cup, lid, straw (no delivery packaging) | `Scenario 2`  |
| 3   | Same drink via Talabat uses its channel price and deducts extra delivery packaging                           | `Scenario 3`  |
| 4   | Talabat order with different price, shared discount, commission, fee, refund → correct payout & contribution | `Scenario 4`  |
| 5   | Re-importing the same external order does not duplicate the sale or deduction                                | `Scenario 5`  |
| 6   | Producing a gelato batch consumes ingredients and creates finished stock at actual yield                     | `Scenario 6`  |
| 7   | A recipe/price change does not change historical profitability for completed sales                           | `Scenario 7`  |
| 8   | Count of 930 when 950 expected → variance adjustment of −20 after approval                                   | `Scenario 8`  |
| 9   | A manager can approve an adjustment while a cashier cannot                                                   | `Scenario 9`  |
| 10  | An offline sale survives restart and synchronizes exactly once                                               | `Scenario 10` |
| 11  | A refunded consumable does not auto-return used packaging to inventory                                       | `Scenario 11` |
| 12  | Settlement reconciliation identifies a missing payout / incorrect fee                                        | `Scenario 12` |

Plus: ledger reversal preserves history.

## Database-level guarantees verified

- `inventory_movement` UPDATE/DELETE rejected (append-only).
- `sales_order UNIQUE(business_id, idempotency_key)` rejects a duplicate offline sale.
- Finalized `sales_order` monetary amounts cannot be edited.
- Unbalanced journal entry rejected at commit (deferred trigger); balanced one accepted.
- `current_stock` view derives correct quantities from the ledger (demo verified:
  straws 10,000 received − 1 sold − 20 count variance = 9,979).

## Adding tests

- New business rule → add a pure function in `src/domain` + a unit test.
- New acceptance criterion → add a scenario to `tests/acceptance.test.ts`.
- New table/trigger → add an SQL assertion to the migration validation routine.
