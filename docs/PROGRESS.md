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

**All generated demo/seed data has been removed.** Every screen now reads (and,
where marked, writes) the **live Supabase database** with the public anon key
through demo-scoped RLS policies (migration `0010`). The system starts empty and
fills only with data the user enters.

UI column: 🟢 = live DB read **and** write; 🔵 = live DB read (write path is the
next increment).

| Module             | Backend/Logic                | UI  | Live behaviour now                                                                 |
| ------------------ | ---------------------------- | --- | --------------------------------------------------------------------------------- |
| Dashboard          | ✅                           | 🔵  | KPIs, low-stock, recent sales, inventory value — all from live queries            |
| POS                | ✅                           | 🟢  | Sells live products → order + lines + tender + ledger movements + balanced journal |
| Orders             | ✅                           | 🔵  | Live order list with items, net/COGS/margin (void/refund UI next)                 |
| Products & Recipes | ✅                           | 🟢  | Create product + recipe (channel-gated lines) + prices; live per-channel margins  |
| Production         | ✅ (logic)                   | 🔵  | Live batch history (batch-entry recipe builder is the next increment)             |
| Inventory          | ✅                           | 🟢  | Live stock board (derived), add item + opening balance, adjust/waste, ledger browser |
| Stock Count        | ✅                           | 🟢  | Blind count → variance → posts real `count_adjustment` movements                  |
| Purchasing         | ✅                           | 🟢  | Add supplier, receive goods → unit conversion → landed cost → WAC → ledger; receipts list |
| Delivery Platforms | ✅ (logic)                   | 🔵  | Live delivery-order economics (settlement CSV import is the next increment)        |
| Accounting         | ✅                           | 🔵  | Live P&L from recorded sales + auto-posted balanced journals + chart of accounts   |
| Reports            | ✅                           | 🔵  | Live product/channel margins + channel mix from recorded sales                     |
| AI Insights        | 🟡                           | 🔵  | Live `ai_insight` reader + guardrails (provider adapters are the next increment)   |
| Settings           | ✅                           | 🔵  | Live business config + branches + tested role/permission policy                    |

Writes currently use the public anon key scoped to the single demo business by
RLS; the append-only triggers still make the ledger and journal immutable. The
next layer is **Supabase Auth** (per-user JWT so `tenant_isolation` replaces the
demo policies) for real multi-user, multi-tenant access.

## AI Accountant (level 2 — auto-draft, human-approved close)

Live on the **Accounting** screen, running on a **mock brain** (deterministic,
no API key) behind an `AIAccountant` interface — wiring the real Claude model is
a one-line swap in `src/lib/ai/accountant.ts` (`getAIAccountant`).

- **Auto-post** — drafts + posts balanced journals for purchases (Dr Inventory /
  Cr A/P) and waste (Dr Waste / Cr Inventory) that aren't journaled yet. Sales
  already auto-journal at POS.
- **Expense capture** — the AI classifies a typed description to a GL account
  (live preview + confidence), then posts Dr expense / Cr cash.
- **Month-end close** — reviews the period (P&L, unposted-item and trial-balance
  checks), and **your approval** locks the period; the `forbid_locked_period`
  trigger then blocks further posting. Corrections are reversing entries.
- **Audit** — every action is written to `ai_interaction_log` (provider/model/
  action), shown on-screen. The engine builds and the DB validates every entry;
  the AI only classifies/explains/reviews. Migration `0011` scopes the new
  period/insight/log writes to the demo business.

To go live: set `ANTHROPIC_API_KEY` (server-side) + add a Supabase service-role
key for the AI actor; no UI or flow changes needed.

## Cross-cutting

| Item                                          | Status | Notes                                                                                                  |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Live Supabase database (provisioned + seeded) | ✅     | project `sixties-gelato-cafe`; migrations 0001–0009 + seed applied; Inventory reads it live (verified) |
| Offline sale queue (IndexedDB)                | 🟡     | SW + idempotency model done; queue+replay UI remaining                                                 |
| Supabase Auth wiring (login, MFA, PIN)        | ⬜     | schema ready (`app_user.auth_user_id`, `pin_hash`); DB live; login next                                |
| Server APIs for protected ops                 | ⬜     | RLS baseline in place; route handlers next                                                             |
| Talabat live adapter                          | 🔒     | needs Partner API credentials; CSV+mock first                                                          |
| AI provider adapters                          | ⬜     | app runs fully without any key                                                                         |
| Automated backups + restore drill             | 🟡     | procedure documented; schedule to be configured                                                        |
| E2E (Playwright)                              | ⬜     | config to add; unit/acceptance done                                                                    |

## Recommended next steps (in priority order)

1. Supabase Auth + session + server route handlers (login, role guards).
2. POS cart → order commit → ledger movements, with the IndexedDB offline queue.
3. Inventory ledger browser + stock board + low-stock/expiry alerts.
4. Purchasing (PO → receive → costed movement) and Production batch entry.
5. Platform CSV import + reconciliation workbench.
6. Accounting auto-posting from sales/COGS/purchases + P&L.
7. Reports + exports; then AI insight layer.
