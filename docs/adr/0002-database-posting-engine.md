# ADR 0002 — The database is the posting engine

**Status:** Accepted · **Date:** 2026-09-23 · **Supersedes** the offline, AI
and "integrity enforced twice" parts of [ADR 0001](0001-architecture.md)

## Context

The August 2026 audit found that the app posted each business operation as
several separate writes from the browser's server action, using the public
key. A dropped connection left half a sale; a retry recorded it twice; anyone
holding the key could write to the books; and nothing compared the ledger with
the records behind it. The TypeScript domain core was correct and tested, but
it was not what wrote to the books.

## Decision

### Every write is one database function, in one transaction

- Recording a sale, receiving goods, billing, paying, closing a day, counting
  stock and journaling are each a single `SECURITY DEFINER` function in
  PostgreSQL (migration `0015`). The function checks the caller's permission,
  validates the input, writes the record, its stock movements and its journal,
  and commits — or refuses and leaves nothing behind.
- The app calls these functions and nothing else (`src/lib/db/rpc.ts`). The
  database revokes every direct table write from signed-in users (`0016`).
  `tests/rpc-contract.test.ts` fails if the app calls a function, or passes a
  parameter, that the migrations do not define and grant.
- Amounts travel as exact decimal strings and are computed in `NUMERIC`; the
  TypeScript domain core remains the tested specification of the rules and the
  source of the acceptance scenarios.

### The books prove themselves

- A journal is born a draft, receives its lines, then is published; a
  published journal can never change (`0014`). Corrections are new entries:
  a reversal, a cancelled bill, a void or refund, a count.
- Each subledger is reconciled with its control account on screen
  (`report_reconciliation`, `0017`), and a period locks only when every check
  passes (`period_close_checklist`).
- Only the owner may post to a control account by hand, with a reason on the
  audit trail. It exists to correct history recorded before these controls
  ([`../REMEDIATION.md`](../REMEDIATION.md)).

### Access is by signed-in role

- Supabase Auth with cookie sessions; a login is linked to a member of the
  business only once its email is confirmed. The role matrix in
  `src/domain/auth/permissions.ts` and the database's `role_permission` table
  are kept identical by `tests/permissions-sync.test.ts`.
- There is no built-in database address or key. An unconfigured deployment
  shows "Not configured" and touches nothing.

### Offline: refuse honestly, retry exactly once

- There is no offline queue. Offline, the till says so and does not take the
  sale. A sale whose confirmation was lost is frozen with its idempotency key
  and retried with the same key; the database returns the sale already
  recorded instead of recording it twice.

### No AI in the loop

- Expense classification is a small set of local, deterministic rules. It
  proposes an account; a person confirms it; the database decides whether that
  account may take an expense.

## Consequences

- Integrity no longer depends on the app being correct: a bug in a screen
  cannot write an unbalanced entry, post into a locked month, sell stock that
  is not there, or bypass a role.
- Business rules now live in SQL. They are tested against real PostgreSQL 16
  and 17 (`scripts/test-sql.sh`: golden accounting, controls, concurrency and
  an upgrade rehearsal) and through the real app in a browser
  (`scripts/test-e2e.sh`).
- Selling needs a connection. Queued offline selling would need a reconciliation
  design of its own (see `docs/ROADMAP.md`).
