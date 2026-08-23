# The Sixty's Gelato & Café — Business Management System

A production-oriented, offline-capable **Progressive Web App** for running a
gelato café: point of sale, an append-only inventory ledger, recipe costing,
production batches, purchasing, delivery-platform reconciliation (Talabat and
others), double-entry management accounting, and an AI-insight layer that only
ever _recommends_ — it never edits financial or inventory records.

Built for Sulaymaniyah, Iraq: **IQD** default currency (configurable
precision), **Asia/Baghdad** timezone, and **English / Arabic / Kurdish** with
full right-to-left support.

> ⚠️ **Demo data is clearly labelled.** All seed prices and costs are examples,
> not real business data.

**▶ New here? Read the [full screen-by-screen walkthrough](docs/USER_GUIDE_WALKTHROUGH.md)** —
a click-by-click tutorial of every module and feature, mapped to the exact UI
location, using the live demo. Live app: **https://sixties-gelato-cafe.vercel.app**

---

## Why this design

Two rules drive everything:

1. **Inventory is never a hand-editable number.** Current stock is _always_ the
   signed sum of an append-only movement ledger. Mistakes are fixed with
   reversals/adjustments, never edits. Even one straw, lid, or napkin is counted.
2. **Money and quantities use exact decimal arithmetic** (`decimal.js`) — never
   floating point. Historical cost snapshots mean a later price change never
   rewrites the profit of a past sale.

See [`docs/CALCULATIONS.md`](docs/CALCULATIONS.md) and
[`docs/adr/0001-architecture.md`](docs/adr/0001-architecture.md) for the reasoning.

## Tech stack

| Layer            | Choice                                                          |
| ---------------- | --------------------------------------------------------------- |
| App              | Next.js 15 (App Router) + React 19, TypeScript **strict**       |
| Money/quantities | `decimal.js` (exact decimal)                                    |
| Database         | PostgreSQL via **Supabase** (Auth, Storage, Row-Level Security) |
| Offline          | Service worker + IndexedDB queue with UUID idempotency keys     |
| Tests            | Vitest (domain + acceptance), validated SQL migrations          |
| i18n             | EN / AR / CKB with RTL                                          |

## Repository layout

```
src/domain/        Pure, tested calculation core (no DB, no framework)
  money/           Exact-decimal Money
  units/           Validated unit conversions
  costing/         Moving weighted-average cost + landed cost
  inventory/       Append-only ledger, production, counting
  sales/           Channel-aware recipes, refunds, idempotency
  platform/        Delivery-platform payout + settlement reconciliation
  accounting/      Double-entry journal
  auth/            Role-based permissions
src/app/           Next.js App Router pages (Dashboard, POS, …)
src/components/     Shell, nav, i18n providers
src/lib/           i18n dictionaries, demo catalog
supabase/
  migrations/      PostgreSQL schema (append-only ledger, RLS, triggers)
  seed/            Demonstration data (labelled EXAMPLE)
tests/             Vitest suites incl. the 12 acceptance scenarios
docs/              PRD, ADRs, data model, calc spec, security, guides
```

## Quick start (development)

Prerequisites: **Node ≥ 20**, and either the **Supabase CLI** (local Postgres)
or a Supabase cloud project.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local     # fill in Supabase URL + keys (see the file)

# 3. Database: local stack + migrations + demo seed
supabase start                 # starts local Postgres, Auth, Studio
supabase db reset              # applies supabase/migrations then supabase/seed.sql

# 4. Run the app
npm run dev                    # http://localhost:3000  → /dashboard, /pos
```

### Verify everything (run before every release)

```bash
npm run verify   # prettier --check + tsc strict + lint + vitest
```

The calculation core and all **12 acceptance scenarios** run with `npm test` and
need **no database** — they are pure functions.

## Installing as an app

- **Windows (Edge/Chrome):** open the site → install icon in the address bar.
  See [`docs/guides/install-windows.md`](docs/guides/install-windows.md).
- **iPhone/iPad (Safari):** Share → _Add to Home Screen_.
  See [`docs/guides/install-mobile.md`](docs/guides/install-mobile.md).
- **Android (Chrome):** menu → _Install app_. Same guide.

## Delivery platforms & AI

- **Talabat:** the schema and reconciliation are platform-agnostic. Until
  official Partner API credentials are granted, use the **CSV import + mock
  adapter**. See [`docs/guides/talabat.md`](docs/guides/talabat.md).
- **AI:** entirely optional. With no key configured, POS/inventory/accounting
  work fully. See [`docs/guides/ai-provider.md`](docs/guides/ai-provider.md).

## Status

This repository delivers a **verified Phase-1 foundation** — full docs, complete
DB schema with enforced integrity, the fully-tested calculation core (all 12
acceptance scenarios green), demo data, and a working trilingual PWA shell with
a live POS. Module UIs are being filled in per the phased plan. The honest,
current status of every module is in
[`docs/PROGRESS.md`](docs/PROGRESS.md); the plan is in
[`docs/ROADMAP.md`](docs/ROADMAP.md).

Nothing here is claimed complete unless it is tested. Mock integrations are
labelled as such with activation instructions.

## License / ownership

All code and data in this repository belong to the business owner. See
[`docs/guides/backup-restore.md`](docs/guides/backup-restore.md) for data export
and ownership.
