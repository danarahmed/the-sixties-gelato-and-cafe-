# Progress & Status

_Last updated: 2026-08-23._ This document is the single honest source of truth
for what is **complete**, **partial**, or **not started**. Nothing is marked
complete unless it is tested or otherwise verified.

## Legend

- ✅ Done and verified
- 🟡 Partial (backend/logic done, UI or wiring remaining)
- ⬜ Not started
- 🔒 Blocked (needs external access/credentials)

## Verified foundations (this delivery)

| Area                                          | Status | Evidence                                               |
| --------------------------------------------- | ------ | ------------------------------------------------------ |
| Exact-decimal money & quantities              | ✅     | `src/domain/money`, `units`; unit tests                |
| Unit conversions (purchase vs base unit)      | ✅     | `tests/primitives.test.ts`                             |
| Moving weighted-average costing + landed cost | ✅     | `src/domain/costing/wac.ts` + tests                    |
| Append-only inventory ledger + derived stock  | ✅     | migration `0003`; DB update/delete blocked (verified)  |
| Channel-aware recipe expansion                | ✅     | `src/domain/sales/recipe.ts`; scenarios 2–3            |
| Production yield/variance & valuation         | ✅     | `src/domain/inventory/production.ts`; scenario 6       |
| Blind counting & variance → adjustment        | ✅     | `src/domain/inventory/counting.ts`; scenario 8         |
| Platform payout + contribution                | ✅     | `src/domain/platform/settlement.ts`; scenario 4        |
| Settlement reconciliation                     | ✅     | scenario 12                                            |
| Offline / import idempotency (exactly-once)   | ✅     | scenarios 5, 10; DB UNIQUE verified                    |
| Double-entry journal (balance + reversal)     | ✅     | migration `0006`; unbalanced entry rejected (verified) |
| Role-based permissions                        | ✅     | `src/domain/auth/permissions.ts`; scenario 9           |
| PostgreSQL schema (48 tables) + RLS           | ✅     | migrations `0001`–`0007` applied to local PG16         |
| Demo seed (EN/AR/CKB, transactions)           | ✅     | `supabase/seed/*`; derived stock verified              |
| Trilingual PWA shell + RTL + theme            | ✅     | build green; LTR/RTL verified in served HTML           |
| Live POS calculation screen                   | ✅     | `/pos` renders engine output server-side               |
| **All 12 acceptance scenarios**               | ✅     | `tests/acceptance.test.ts` — 13 tests green            |

Run `npm test` → **25 tests passing**. `npm run typecheck` and `npm run build`
are green.

## Module UI status

| Module             | Backend/Logic                | UI  | Notes                                                                      |
| ------------------ | ---------------------------- | --- | -------------------------------------------------------------------------- |
| Dashboard          | ✅                           | 🟡  | KPI cards render (demo figures); wire to live queries next                 |
| POS                | ✅                           | 🟡  | Live cost/margin/deduction demo; cart, tender, receipt, offline queue next |
| Orders             | ✅ (schema)                  | ⬜  | list/filter/void/refund UI                                                 |
| Products & Recipes | ✅ (schema+logic)            | ⬜  | recipe editor, versioning UI                                               |
| Production         | ✅ (logic)                   | ⬜  | batch entry, planning screen                                               |
| Inventory          | ✅ (ledger)                  | ⬜  | ledger browser, alerts                                                     |
| Stock Count        | ✅ (logic)                   | ⬜  | mobile counting flow                                                       |
| Purchasing         | ✅ (schema+logic)            | ⬜  | PO builder, receiving                                                      |
| Delivery Platforms | ✅ (logic)                   | ⬜  | CSV import, reconciliation workbench                                       |
| Accounting         | ✅ (schema)                  | ⬜  | P&L, journal browser, period close                                         |
| Reports            | 🟡 (data captured)           | ⬜  | report views + exports                                                     |
| AI Insights        | 🟡 (schema+abstraction plan) | ⬜  | provider adapter + insight screens                                         |
| Settings           | ✅ (config model)            | ⬜  | setup wizard, user/role admin                                              |

## Cross-cutting

| Item                                   | Status | Notes                                                  |
| -------------------------------------- | ------ | ------------------------------------------------------ |
| Offline sale queue (IndexedDB)         | 🟡     | SW + idempotency model done; queue+replay UI remaining |
| Supabase Auth wiring (login, MFA, PIN) | ⬜     | schema ready (`app_user.auth_user_id`, `pin_hash`)     |
| Server APIs for protected ops          | ⬜     | RLS baseline in place; route handlers next             |
| Talabat live adapter                   | 🔒     | needs Partner API credentials; CSV+mock first          |
| AI provider adapters                   | ⬜     | app runs fully without any key                         |
| Automated backups + restore drill      | 🟡     | procedure documented; schedule to be configured        |
| E2E (Playwright)                       | ⬜     | config to add; unit/acceptance done                    |

## Recommended next steps (in priority order)

1. Supabase Auth + session + server route handlers (login, role guards).
2. POS cart → order commit → ledger movements, with the IndexedDB offline queue.
3. Inventory ledger browser + stock board + low-stock/expiry alerts.
4. Purchasing (PO → receive → costed movement) and Production batch entry.
5. Platform CSV import + reconciliation workbench.
6. Accounting auto-posting from sales/COGS/purchases + P&L.
7. Reports + exports; then AI insight layer.
