# Known Limitations & Recommended Next Improvements

Honest accounting of what is **not** finished, mocked, or blocked. Nothing here
is claimed to work that does not. See `docs/PROGRESS.md` for the module matrix.

## Not yet implemented (scheduled)

- **Auth wiring & server APIs:** the schema, RLS baseline, and permission model
  exist, but login/session, MFA setup, PIN flow, and protected route handlers
  are not yet built. Do not expose the app publicly until these are in place.
- **Transactional UIs:** POS cart→commit, receiving, production batch entry,
  counting flow, ledger browser, reconciliation workbench, accounting screens,
  reports, and the settings/setup wizard are placeholders backed by tested logic.
- **Offline queue:** the service worker and idempotency model are in place; the
  IndexedDB queue + replay UI is not yet wired to a live commit endpoint.
- **Accounting auto-posting:** journal primitives and schema exist; automatic
  posting from sales/COGS/purchases/settlements is not yet wired to events.
- **Exports (CSV/Excel/PDF):** raw SQL/`pg_dump` export works; in-app report
  exports are Phase 2.
- **E2E tests:** unit + acceptance + SQL-integrity are done; Playwright E2E
  across devices/locales/offline is planned.

## Mocked / blocked (needs external access)

- **Talabat live API:** requires an approved Partner account and credentials from
  Talabat. Until granted, the CSV import + a clearly-labelled mock adapter are
  used. Activation steps: `docs/guides/talabat.md`.
- **AI provider:** optional; requires a provider API key to activate. The core
  runs fully without it. Activation steps: `docs/guides/ai-provider.md`.

## Deliberate design constraints (not bugs)

- No editable "current stock" field — corrections are reversals/adjustments.
- Finalized sales cannot be edited — use voids/refunds.
- Tax calculation is out of scope by request.
- Full payment-card details are never stored.

## Recommended next improvements (priority order)

1. Supabase Auth + session + role-guarded server route handlers.
2. POS cart → order commit → costed ledger movements, with the offline queue.
3. Inventory ledger browser + stock board + low-stock/expiry alerts.
4. Purchasing (PO → receive → costed movement) and production batch entry.
5. Platform CSV import + reconciliation workbench + mock Talabat adapter.
6. Accounting auto-posting + P&L + period close + exports.
7. Reports (menu engineering, channel margin, actual-vs-theoretical usage).
8. AI insight layer (provider adapters + approval workflows).
9. Playwright E2E; error monitoring + health checks; backup restore drill in CI.
