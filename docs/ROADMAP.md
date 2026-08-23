# Implementation Roadmap

Phased delivery. Priority order under constraint: **transaction accuracy,
inventory integrity, backups, and usability before decorative features or AI.**
Current status per module is in `docs/PROGRESS.md`.

## Phase 1 — Operational core

Authentication & roles · business/branch setup · products, units, ingredients,
recipes · POS · inventory ledger · purchasing & receiving · production batches ·
stock counting · core costing & profitability · responsive PWA + offline sales.

**Done in this delivery:** the tested calculation core for all of the above, the
full database schema with enforced integrity, demo data, and the PWA shell with
a live POS calculation screen.
**Remaining:** Supabase Auth wiring; the transactional UIs (POS cart→commit,
receiving, batch entry, counting flow, ledger browser); the IndexedDB offline
queue + replay.

**Exit checks:** format + typecheck + lint + unit + integration + e2e green;
phone/tablet/desktop verified; EN/AR/CKB verified; online + offline verified;
`PROGRESS.md` updated.

## Phase 2 — Financial & platform control

Double-entry ledger auto-posting · expenses & financial statements · Talabat
adapter architecture · CSV imports · settlement reconciliation · channel pricing
& promotions · advanced reports.

**Done:** the double-entry primitives + schema, the generic platform model, and
the tested payout/reconciliation logic.
**Remaining:** event→journal auto-posting; CSV import + mock Talabat adapter;
reconciliation workbench; P&L and the report views with exports.

## Phase 3 — AI & optimization

Forecasting · production & reorder suggestions · anomaly detection ·
natural-language analysis · explainability & approval workflows.

**Done:** the AI insight/audit schema and the non-authoritative, human-approval
design.
**Remaining:** the provider adapters and the insight screens. The core must
continue to work with no AI key configured.

## End-of-phase ritual (every phase)

1. `npm run verify` (format, typecheck, lint, tests) — fix all failures first.
2. Verify phone/tablet/desktop layouts.
3. Verify English, Arabic, Kurdish (RTL) layouts.
4. Verify online and offline behaviour.
5. Update `docs/PROGRESS.md` (completed / remaining / blocked).

## Known constraints

- Talabat live API needs Partner approval + credentials (🔒). Until then, CSV +
  mock adapter, clearly labelled.
- AI requires a provider key to activate; optional by design.
