# ADR 0001 — Architecture & stack

**Status:** Accepted · **Date:** 2026-08-23

## Context

We need a production-ready, cross-platform, offline-capable business system with
uncompromising transaction and inventory integrity, maintainable by another
competent developer, trilingual with RTL, and safe for a non-technical owner.

## Decision

### Application: Next.js 15 (App Router) + React 19 + TypeScript strict

- One codebase serves installable PWA on Windows/iOS/Android and desktop/mobile
  browsers. Server components + route handlers give us server-side protected
  operations without a separate backend service.
- TypeScript **strict** (plus `noUncheckedIndexedAccess`) catches whole classes
  of errors at compile time.

### Money & quantities: `decimal.js`, never floating point

- A dedicated `Money` type carries currency + precision and rounds with banker's
  rounding only at boundaries. Quantities are exact decimals with explicit,
  validated unit conversions. This is the single most important correctness
  decision; see `docs/CALCULATIONS.md`.

### A pure domain core, independent of DB and framework

- All business math lives in `src/domain/*` as pure functions with no I/O. It is
  unit-tested in isolation (the 12 acceptance scenarios run with no database).
  This keeps the rules verifiable, portable, and easy to reason about, and means
  the same logic can back the UI, server APIs, and offline replay.

### Database: PostgreSQL via Supabase (Auth, Storage, RLS)

- Postgres gives exact `NUMERIC`, transactions, constraints, and triggers to
  enforce integrity at the storage layer (append-only ledger, idempotency
  uniqueness, journal balancing, period locks). Supabase adds authentication,
  row-level security, and storage without operating our own services.
- The cloud DB is authoritative. We do **not** auto-provision or share a project
  across tenants; RLS isolates every business's data.

### Inventory as an append-only ledger

- No editable stock field anywhere. `current_stock` is a view over
  `inventory_movement`. Corrections are reversals/adjustments. This is what makes
  stock trustworthy and auditable.

### Offline: service worker + IndexedDB queue with idempotency

- Offline sales are queued locally with UUID idempotency keys, device id, and
  timestamps, then replayed. A DB `UNIQUE(business_id, idempotency_key)`
  guarantees exactly-once application — no last-write-wins on financial data.

### AI: provider abstraction, optional, non-authoritative

- An interface lets Anthropic/OpenAI/others be selected without touching the
  app. All deterministic math stays in app code; AI only classifies, forecasts,
  explains, and recommends, gated by human approval and fully audited. The core
  runs with no AI key.

### Deployment: Vercel + Supabase

- Managed hosting keeps operations simple for a non-technical owner. Any Node
  host works for the app.

## Alternatives considered

- **Plain SPA + custom Node/Express API:** more moving parts, more security
  surface, no RLS out of the box. Rejected for maintainability.
- **Prisma/ORM as the source of schema:** we preferred hand-written SQL
  migrations so DB-level integrity (triggers, constraints, RLS, views) is
  explicit and reviewable. A typed query layer can still be added.
- **Storing money as integers-of-minor-unit:** works, but a `Decimal`-backed
  `Money` type is clearer for multi-currency precision and mixed-scale math.
  We still store exact `NUMERIC` in Postgres.
- **Float for "good enough" reporting:** rejected outright; accounting must be
  exact and reproducible.

## Consequences

- The correctness-critical logic is small, pure, and thoroughly tested.
- Integrity is enforced twice: in the domain core and again by the database, so
  a bug in one layer cannot silently corrupt data.
- Some ceremony (append-only + reversals) is required instead of quick edits —
  an intentional trade for auditability.
