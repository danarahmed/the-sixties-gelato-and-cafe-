# The Sixty's Gelato & Café — Books

The till, the stock ledger, purchasing to payment, expenses, journals, the
period close and the reports for a gelato café in Sulaymaniyah — kept as one set
of books that the database posts and proves.

- **English / العربية / کوردی**, right-to-left where it should be. **IQD**
  (whole dinar by default) and the **Asia/Baghdad** trading day.
- **Every person signs in** and sees only what their role allows: the till for a
  cashier, the count for a counter, the books for the owner and accountant.
- **Every transaction is one database function in one transaction.** A sale
  writes its order, its stock movements and its journal together, or nothing.
- **The books prove themselves.** Each subledger is reconciled with its control
  account on screen, and a month locks only when every check passes.

Live: **https://sixties-gelato-cafe.vercel.app**. To put this version live, follow
[`docs/guides/deployment.md`](docs/guides/deployment.md). Until then, the site
runs the previous app.

**New here?** Read the [guide to every screen](docs/USER_GUIDE_WALKTHROUGH.md).

---

## How it stays right

1. **Stock is never typed in.** It is the sum of an append-only movement
   ledger. A mistake is corrected with a count or a correction, never an edit.
2. **Money is exact.** Amounts travel as decimal strings and are computed in
   PostgreSQL `NUMERIC`, never in floating point.
3. **A published journal never changes.** Corrections are new entries: a
   reversal, a cancelled bill, a void or refund, a count. Months close in order;
   a locked month refuses every posting.
4. **The app cannot bypass the rules.** Signed-in users can read (row-level
   security decides what) and can call the posting functions their role allows.
   They cannot write to a table directly.
5. **A retry never records a sale twice.** Each sale carries an idempotency key;
   offline, the till says so instead of pretending to sell.

The reasoning is in [ADR 0002](docs/adr/0002-database-posting-engine.md) and the
formulas in [`docs/CALCULATIONS.md`](docs/CALCULATIONS.md).

## Stack

| Layer    | Choice                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------- |
| App      | Next.js 15 (App Router), React 19, TypeScript strict                                                 |
| Sign-in  | Supabase Auth, cookie sessions via `@supabase/ssr`                                                   |
| Database | PostgreSQL (Supabase): row-level security, posting functions, triggers                               |
| Input    | `zod` validation; Arabic-Indic digits accepted                                                       |
| Tests    | Vitest; SQL suites on real PostgreSQL 16 and 17; browser tests (Playwright) through a real PostgREST |

## Repository

```
src/app/            Screens (App Router): /pos, /sales, /vendors, /journals, …
src/components/     Screen components (forms, tables, the shell)
src/lib/auth/       Session, role gating, sign-in actions
src/lib/db/         Reads (row-level security decides what comes back)
src/lib/actions/    Writes: each calls one posting function
src/lib/supabase/   Supabase clients; no built-in address or key
src/domain/         The tested specification: money, units, costing, recipes, permissions
supabase/migrations 0001–0017; 0014–0017 are the controls
supabase/seed/      Demonstration master data (examples, not real figures)
tests/              Vitest suites, tests/sql (SQL suites), tests/e2e (browser)
scripts/            test-sql.sh, test-e2e.sh
docs/               Guides, remediation, security, test plan, status
```

## Configuration

Two environment variables, both required (copy `.env.example` to `.env.local`):

| Name                            | Where to find it                                |
| ------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon key    |

There is no default. Without them the app shows **Not configured** and touches
nothing, so a copy can never write to another business's books by accident. No
service-role key is used; the app acts only as the signed-in person.

## Running it locally

Prerequisites: Node 20+, and the Supabase CLI or a Supabase project of your own
(never the live one).

```bash
npm install
supabase start && supabase db reset   # migrations + demonstration master data
cp .env.example .env.local      # URL http://127.0.0.1:54321; anon key from `supabase status`
npm run dev                     # http://localhost:3000 → sign in
```

The seed creates four placeholder people (`owner@`, `manager@`, `cashier@`,
`counter@example.com`) with no logins. Choose **First time here? Create your
login** with one of those emails. The local stack does not ask for email
confirmation by default, so you can sign in straight away; any email it sends
appears in Inbucket at http://localhost:54324.

## Checks

```bash
npm run verify           # formatting, types, lint, unit + contract tests (Vitest)
scripts/test-sql.sh      # upgrade rehearsal + SQL suites + concurrency (PostgreSQL 15+)
scripts/test-e2e.sh      # the real app in a browser, as every role
```

The SQL and browser tests create and drop their own databases on the PostgreSQL
server you point them at (`PGHOST`, `PGPORT`, `PGUSER`). They never touch a
deployed project. See [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md).

## Documents

- **Using it:** [walkthrough](docs/USER_GUIDE_WALKTHROUGH.md) ·
  [owner](docs/guides/owner-guide.md) · [cashier](docs/guides/cashier-quickstart.md) ·
  [counting](docs/guides/counting-guide.md) · [delivery platforms](docs/guides/talabat.md) ·
  install on [Windows](docs/guides/install-windows.md) / [phones](docs/guides/install-mobile.md)
- **Running it:** [deployment](docs/guides/deployment.md) ·
  [correcting old history](docs/REMEDIATION.md) · [backup & restore](docs/guides/backup-restore.md) ·
  [security](docs/SECURITY.md)
- **Building on it:** [ADRs](docs/adr/) · [data model](docs/DATA_MODEL.md) ·
  [calculations](docs/CALCULATIONS.md) · [test plan](docs/TEST_PLAN.md)
- **Status:** [progress](docs/PROGRESS.md) · [limitations](docs/LIMITATIONS.md) ·
  [roadmap](docs/ROADMAP.md)

## Ownership

All code and data belong to the business owner. A `pg_dump` moves everything to
any PostgreSQL host; see [`docs/guides/backup-restore.md`](docs/guides/backup-restore.md).
