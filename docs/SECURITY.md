# Security Model

Aligned with current OWASP application-security guidance. Security is enforced
in depth: the database (RLS, constraints, triggers), the server (validation,
authorization), and the client (least-privilege UI).

## Authentication

- Supabase Auth (email + password). Strong password handling and secure session
  tokens are provided by Supabase; transport is HTTPS only.
- **Optional MFA** for Owner and Manager roles (enable in the Supabase project).
- **POS PIN:** an optional hashed numeric PIN (`app_user.pin_hash`) allows fast
  user switching on a shared POS device without exposing full credentials. The
  PIN is never stored in plaintext.

## Authorization (least privilege)

- Roles: owner, general_manager, branch_manager, cashier, barista,
  inventory_counter, purchasing, accountant, auditor.
- The permission matrix lives in `src/domain/auth/permissions.ts` (tested) and is
  the single source of truth. Examples: cashiers cannot edit recipe costs;
  counters cannot see expected quantities unless authorized; only accountants
  lock/reopen periods; managers approve adjustments/waste/refunds within limits.
- **UI hiding is never the only guard.** Every protected operation is re-checked
  server-side before it touches the database.

## Row-Level Security (RLS)

- Enabled and **forced** on every business table. The baseline policy restricts
  all rows to the caller's own `business_id` (via `current_business_id()`), which
  also guarantees this project's data never mixes with any other tenant.
- Helper functions (`current_has_role`, `current_can_view_costs`) drive finer
  server-side checks (e.g. hiding cost/profit columns from cashiers).

## Data integrity as security

- Append-only ledgers (`inventory_movement`, `audit_log`, `ai_interaction_log`)
  block UPDATE/DELETE via triggers — tampering leaves a trace, corrections are
  new rows.
- Finalized `sales_order` monetary amounts are immutable; journal entries must
  balance; locked periods reject posting. These prevent silent financial edits.

## Input handling

- Server-side validation with `zod` on all API inputs (never trust the client).
- Parameterised queries / Supabase client — no string-built SQL — prevents
  injection. CSP and standard security headers in production.
- Rate limiting on authentication and write endpoints (configure at the edge /
  route handler).
- CSRF: same-site cookies + server-verified auth on state-changing requests.

## Secrets

- No credentials in client code. `NEXT_PUBLIC_*` are the only client-exposed
  values (anon key only). The service-role key and provider API keys are
  server-only, provided via environment variables (see `.env.example`).
- AI: only the minimum non-sensitive data is sent to a provider; no secrets or
  unnecessary PII. Every call is audited.

## Audit

- Immutable `audit_log` records who/what/when/device/reason with before/after
  state for sensitive actions (voids, refunds, adjustments, approvals, price and
  recipe changes, period locks, AI approvals).

## Payments

- Full payment-card details are **never** stored. If online payment is added,
  use payment-provider tokens only.

## Reliability

- Automated database backups (Supabase) with a **tested restore procedure**
  (`docs/guides/backup-restore.md`). Data export and ownership are the business's.
- Error monitoring and health checks to be configured at deploy time.

## Reporting a concern

Rotate any exposed key immediately in the Supabase/provider dashboard, then
review `audit_log` and `ai_interaction_log` for affected records.
