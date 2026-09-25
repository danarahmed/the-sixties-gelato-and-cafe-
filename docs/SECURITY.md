# Security Model

The books are protected in the database, not in the screens. The app is a
convenience on top: hiding a button is never the control. Every read passes
row-level security and every write goes through a function that checks the
caller's permission itself.

## Signing in

- **Supabase Auth, email and password.** Each person has their own login.
  The session is an HTTP-only cookie that no script in the page can read, and
  the middleware verifies and refreshes it on every request
  (`src/middleware.ts`, `src/lib/supabase/middleware.ts`).
- **Everything needs a session.** Only `/login`, `/auth/*` (the links in sign-up
  and reset emails) and `/setup` open without one. Signed-in pages are sent with
  `Cache-Control: no-store`.
- **A login is not membership.** A login is linked to a member of the business
  only when its email is confirmed and matches an active member the owner has
  added (`0016`, trigger on `auth.users`). A stranger who signs up sees nothing.
- **The owner manages people** in Settings → People: add by email, set roles,
  deactivate. Only the owner can grant owner or general manager, and the
  business always keeps an active owner. Every change is on the audit trail.
- **Recommended:** email confirmation on, MFA for the owner, and open sign-up
  turned off once everyone has a login (Supabase settings; see the runbook).
  There is no shared PIN. Owners and managers each set their own **approval
  PIN** (`0028`) for discounts over the cap, voids and refunds on a till
  someone else is signed in to: 4 to 8 digits, no runs or repeats, kept only
  as a bcrypt hash nobody can read; checked by the database, which counts
  every attempt and locks that person's approvals for fifteen minutes after
  five wrong PINs. An approval is good once, for ten minutes, for whoever
  asked for it, and never lets someone approve their own.

## What each role may do

- The matrix is `src/domain/auth/permissions.ts`. The database holds the same
  matrix in `role_permission`, and `tests/permissions-sync.test.ts` fails if they
  ever differ.
- **Cashiers and counters never see costs.** The till's catalogue carries prices
  only. A sale returns its cost only to someone allowed to see costs. A count
  never sends the expected quantities to the person counting: the database takes
  a snapshot when the count opens, and a second person reviews and approves.
- **Separation of duties.** A count is approved by someone other than the
  counter. Only the owner reopens a locked month, posts to a control account by
  hand, or posts the stock the old app never journaled — always with a reason on
  the audit trail.

## The database boundary

- **No direct writes.** `0016` revokes every table and sequence privilege from
  the public (`anon`) and signed-in (`authenticated`) roles. Signed-in users get
  `SELECT` only, filtered by row-level security.
- **Only a listed set of functions** can be called by a signed-in user, and the
  public can call none. `tests/sql/controls.test.sql` fails if a migration exposes
  anything else.
- **Each function checks for itself.** `require_permission()` runs first in every
  posting function; they are `SECURITY DEFINER` with a fixed `search_path`.
- **Tenancy.** Every table, including child tables such as journal and order
  lines, carries `business_id`, and row-level security confines each person to
  their own business.

## Integrity as security

- **Append-only records.** Stock movements, the audit log and published journals
  refuse `UPDATE` and `DELETE`. A finished sale's amounts, cost, lines and
  tenders are frozen. A bill is never deleted: it is cancelled, one way, with a
  reason.
- **Locked months refuse everything:** sales, journals, expenses, bills,
  payments, reversals.
- **Races are closed** with row locks and unique keys: a sale, an auto-posted
  journal and a bill payment each happen once, however many times they are sent
  (concurrency tests in `scripts/test-sql-concurrency.sh`).
- **The audit log** (`audit_log`, append-only) records who, what, when and why for
  voids, refunds, stock corrections, count approvals, reversals, cancelled
  bills, control corrections, posting the old app's stock, period locks and
  reopenings, and people added, activated, deactivated or given roles. Every
  stock movement also carries the person and the reason.
- **Alerts (`0029`)** are kept in a table no one signed in can read; the
  dashboard reads them through `current_alerts` (those who see profits), and
  only the owner, managers and the accountant answer or snooze them — each
  answer audited with its note. Nobody answers an alert about their own
  exceptions, and an answer never hides one: it stays on the dashboard,
  marked answered, until its condition clears, and turns back into a question
  if it goes from orange to red. The rules only read; nothing in the books is
  written from them. Only the owner and general manager change the
  thresholds, audited as a change to the business.

## Input and output

- Server actions validate every input with `zod` before calling the database.
  Amounts travel as exact decimal strings, and the database validates again.
- No SQL is built from strings: the app calls named functions with parameters.
- CSV exports neutralise values that a spreadsheet would run as formulas.
- The service worker caches only static files and the offline page, never
  business data.

## Secrets

- **The app has no built-in database address or key.** It needs
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` per environment,
  and without them it shows "Not configured".
- **No service-role key** is used anywhere; the app acts only as the signed-in
  person.
- **The previous app published the anon key in its source.** Once `0016` is
  applied, that key can no longer read or write anything in the database; it
  reaches only the sign-in service, as every visitor's browser must. Moving to
  Supabase's newer publishable keys after go-live, and disabling the legacy anon
  key, retires it altogether.

## Payments

Full payment-card details are never stored. Card takings are recorded as an
amount against 1010 Card clearing, and settled against the terminal's report
and the bank by the owner, the general manager or the accountant (`0030`).
Platform order numbers are the platform's references for an order, not a
customer's details.

## If something looks wrong

1. Turn on Vercel deployment protection, and deactivate the person in Settings →
   People.
2. Rotate the project's keys in the Supabase dashboard if one may be exposed.
3. Review the audit trail on **Chart of Accounts**, and the reconciliation on
   **Reports**.
4. Correct with new entries ([`REMEDIATION.md`](REMEDIATION.md)); nothing needs
   to be edited or deleted.
