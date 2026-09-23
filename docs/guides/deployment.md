# Deployment Runbook

How to put this version live. It replaces an app that let anyone holding the
public key read and write the books; after this, nothing is reachable without
signing in, and the database itself enforces who may see and do what.

**The migrations and the new app go live together.** Migration `0016` removes
every write permission the old app relied on, so the old till stops recording
sales the moment it is applied; the new app needs `0014`–`0017` to work at all.
Plan a short window when the café is closed.

## 0. Before you start

- **Take a backup.** Supabase dashboard → _Database → Backups_ (confirm today's
  backup exists), or `pg_dump "$DATABASE_URL" > before-0014.sql`. See
  [`backup-restore.md`](backup-restore.md).
- The live project is Supabase **`sixties-gelato-cafe`** (PostgreSQL 17.6) and
  Vercel project **`sixties-gelato-cafe`**.
- Until the steps below are done, the live site is still publicly writable. If
  you cannot do them today, turn on Vercel _Settings → Deployment Protection_
  for Production first.
- **Decide what the existing history is**
  ([`../REMEDIATION.md`](../REMEDIATION.md), section 4). Most of it was loaded in
  bulk, not typed through the app. If you choose to start the books clean, the
  trial records are cleared **before step 3**; afterwards they are read-only.
  If you keep the history, it is corrected after step 6.

## 1. Rehearse locally (optional, recommended)

Everything below was rehearsed against PostgreSQL 16 **and** 17.6, replaying the
live database's exact migration history on production-shaped data:

```bash
PGPORT=5432 scripts/test-sql.sh   # upgrade rehearsal + all SQL tests + concurrency
PGPORT=5432 scripts/test-e2e.sh   # the real app, in a browser, as every role
```

## 2. Point the app at the database (Vercel)

The app no longer carries a built-in database address. In Vercel → _Settings →
Environment Variables_, for **Production and Preview**, set:

| Name                            | Value                                                        |
| ------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → _Project Settings → API → Project URL_            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → _Project Settings → API → anon / publishable key_ |

No service-role key is needed or wanted: the app acts only as the signed-in
person. Without these two, a deployment shows a "Not configured" page and
touches nothing.

## 3. Apply migrations 0014 → 0017

The live database recorded its earlier migrations under timestamp versions, not
`0001`…`0013`, so **do not use `supabase db push`** — it would try to re-run
`0001` onward. Apply the four new files **in order, each as one transaction**, so
that a file either applies completely or not at all:

- **psql** (most predictable):
  ```bash
  for f in 0014 0015 0016 0017; do
    psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/${f}_*.sql || break
  done
  ```
- **Supabase SQL editor:** for each file in turn, run `begin;`, then the whole
  file, then `commit;` — as one script. If it reports an error, stop: nothing from
  that file was kept.
- **Supabase connector** (how the earlier migrations were applied): each file as
  one `apply_migration` call, which runs it in a transaction and records it in
  the project's migration history.

What they do to existing data: nothing is deleted or rewritten, and nothing is
posted. Existing journals are marked _legacy_ ("before controls"), dated into
periods (a **July 2026** period will be created for the entry dated then),
numbered where the old app left them unnumbered, and made immutable. See
[`../REMEDIATION.md`](../REMEDIATION.md) for what the reconciliation will then
show and how to correct it.

Rehearsed on 23 September 2026 on an exact copy of the live rows, taken with
read-only queries. Each table was checked against a fingerprint of the live one,
and the copy is not in the repository. All four files applied cleanly in under
half a second, nothing was lost or altered, and the four placeholder people link
to their logins on first sign-in. The earlier read-only pre-flight also found
nothing in the way: one business, periods that do not overlap, no duplicate
journal numbers, no orphaned rows, `btree_gist` available, and the migration role
allowed to add the sign-in trigger on `auth.users`.

## 4. Deploy the new app

Vercel deploys Production from the branch `claude/project-isolation-b6tshk`.
Merge this branch into it (a pull request), or change the production branch, and
let Vercel build. Check the deployment opens `/login`.

## 5. Sign-in settings (Supabase → Authentication)

- **Providers → Email:** enabled; **Confirm email: ON.** A login is linked to a
  member of the business only after its email is confirmed, so nobody can claim
  someone else's address.
- **URL Configuration → Site URL:** `https://sixties-gelato-cafe.vercel.app`
- **Redirect URLs:** add `https://sixties-gelato-cafe.vercel.app/auth/confirm`
  (and your preview domain pattern, e.g. `https://*-your-team.vercel.app/auth/confirm`).
- **Recommended — email links that work on any device:** in _Email Templates_,
  make the _Confirm signup_ link
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/`
  and the _Reset password_ link
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account`.
  (The default links also work, but only in the browser that asked for them.)
- Consider **MFA** for the owner, and turning off new sign-ups once everyone is
  in (people are added by the owner anyway; an uninvited sign-up sees nothing).

## 6. The owner's first sign-in

The database still holds the four seeded people (`owner@`, `manager@`,
`cashier@`, `counter@example.com`) and no logins. In the SQL editor, give the
owner's place your real email:

```sql
update app_user set email = 'you@your-domain' where email = 'owner@example.com';
```

Then open the site → _First time here? Create your login_ with that email →
confirm it from your inbox → sign in. You are the owner.

In **Settings → People**: deactivate the three `@example.com` placeholders (or
change their roles), and add your staff by email and role. Each of them creates
their own login with that email; they see only what their role allows.

## 7. Reconcile the old history, then close

Open **Reports → Do the books tie?**. Differences there come from the period
before these controls; on the live data they are listed, item by item, in
[`../REMEDIATION.md`](../REMEDIATION.md) section 3. Follow its section 5:

1. post the stock the old app never journaled (the list under the
   reconciliation);
2. correct July and lock it;
3. correct August and lock it.

The checklist on **Chart of Accounts** must pass before a period locks. The
whole sequence was rehearsed on the copy and leaves every check at zero.

## 8. Afterwards

- The site can stay public: every page needs a signed-in, active member, and the
  database refuses everything else. Keep Deployment Protection if you prefer.
- `npm run verify` and `scripts/test-sql.sh` on every change; `scripts/test-e2e.sh`
  before every release.
- Keep staging separate: a second Supabase project and a Preview environment
  pointed at it. There is no longer any way for a copy of the app to reach the
  live database by accident.
