# Deployment Runbook

How to put this version live. It replaces an app that let anyone holding the
public key read and write the books; after this, nothing is reachable without
signing in, and the database itself enforces who may see and do what.

**The migrations and the new app go live together.** Migration `0016` removes
every write permission the old app relied on, so the old till stops recording
sales the moment it is applied; the new app needs `0014`–`0017` to work at all.
Plan a short window when the café is closed.

## Where the live system stands (23 September 2026)

| Step                         | Status                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0. The old history           | ✅ Cleared: it was trial data                                                                                                                                                  |
| 2. The Vercel settings       | ⬜ **The owner adds them.** The Vercel connector used for the rest is not allowed to create Production variables                                                               |
| 3. Migrations `0014`–`0017`  | ✅ Applied, then compared with the tested build object by object: functions, tables, rules, indexes, triggers and permissions are identical. The public key has no access      |
| 4. The new app               | ✅ Merged for production ([pull request #1](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/1)). It shows "Not configured" until step 2 is done and redeployed |
| 5. Sign-in settings          | ⬜ The owner sets them                                                                                                                                                         |
| 6. The owner's first sign-in | ⬜ The owner's place already carries the owner's real address; the owner creates the login                                                                                     |

## 0. Before you start

- **Take a backup.** Supabase dashboard → _Database → Backups_ (confirm today's
  backup exists), or `pg_dump "$DATABASE_URL" > before-0014.sql`. See
  [`backup-restore.md`](backup-restore.md).
- The live project is Supabase **`sixties-gelato-cafe`** (PostgreSQL 17.6) and
  Vercel project **`sixties-gelato-cafe`**.
- Before step 3, the database accepted reads and writes from anyone holding the
  public key. Until step 3 is done on a database, turn on Vercel _Settings →
  Deployment Protection_ for Production.
- **The existing history: cleared.** The owner confirmed it was trial data, and
  on 23 September 2026 it was cleared with
  [`supabase/remediation/clean-start.sql`](../../supabase/remediation/clean-start.sql)
  ([`../REMEDIATION.md`](../REMEDIATION.md), section 4, option A). Nothing was
  recorded between the clean start and step 3, so it did not need running
  again. On another database, run it immediately before step 3; it refuses to
  run once step 3 is done.

## 1. Rehearse locally (optional, recommended)

Everything below was rehearsed against PostgreSQL 16 **and** 17.6, replaying the
live database's exact migration history on production-shaped data:

```bash
PGPORT=5432 scripts/test-sql.sh   # upgrade rehearsal + all SQL tests + concurrency
PGPORT=5432 scripts/test-e2e.sh   # the real app, in a browser, as every role
```

## 2. Point the app at the database (Vercel)

The app no longer carries a built-in database address. In Vercel → _Settings →
Environment Variables_, for **Production**, set:

| Name                            | Value                                                        |
| ------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → _Project Settings → API → Project URL_            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → _Project Settings → API → anon / publishable key_ |

No service-role key is needed or wanted: the app acts only as the signed-in
person. Without these two, a deployment shows a "Not configured" page and
touches nothing. Then open _Deployments_, and on the latest Production
deployment choose **Redeploy**: the settings are built into the app, so a
deployment made before they existed does not see them.

Leave Preview without them. Preview deployments then cannot reach the live
books. To try changes on real screens, point Preview at a separate staging
project (step 8).

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
periods, numbered where the old app left them unnumbered, and made immutable.
After the clean start there are none, so the books open empty. (A database that
keeps its history: see [`../REMEDIATION.md`](../REMEDIATION.md) for what the
reconciliation will then show and how to correct it.)

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

Since the clean start, the database holds one person, the owner's place
(`owner@example.com`), and no logins. In the SQL editor, give it your real
email:

```sql
update app_user set email = 'you@your-domain' where email = 'owner@example.com';
```

Then open the site → _First time here? Create your login_ with that email →
confirm it from your inbox → sign in. You are the owner.

In **Settings → People**, add your staff by email and role. Each of them creates
their own login with that email; they see only what their role allows. The
order does not matter: a login is linked to its person once its email is
confirmed.

**Confirmation emails on Supabase's free plan.** Supabase's built-in email only
sends to addresses in your Supabase organization's team, and only a few an
hour. Your staff will not receive theirs (nor will you, if your login email is
not on that team). Choose one:

- **Create each login yourself (free, no email):** Supabase → _Authentication →
  Users → Add user → Create new user_. Enter their email and a temporary
  password, and tick **Auto Confirm User**. They sign in with it and change the
  password under **Account**.
- **Send real emails:** set up custom SMTP in Supabase's Authentication
  settings, using an email provider (several have free tiers).

## 7. Opening balances

The books start empty. Enter what the café has on the day you start:

- **Inventory → Add stock item** for each item, with its opening quantity and
  unit cost (Dr 1200 Inventory, Cr 3000 Owner equity);
- stock not yet paid for: **Purchasing → Receive stock**, then the supplier's
  bill on **Vendors**;
- cash in the drawer or the bank: **Journals → New Journal**, Dr 1000 Cash or
  1020 Bank, Cr 3000 Owner equity;
- the menu on **Products & Recipes**, with each channel's price.

**Reports → Do the books tie?** should then show ✅ on every line.

A database that keeps its pre-upgrade history instead reconciles it here,
following [`../REMEDIATION.md`](../REMEDIATION.md) section 5.

## 8. Afterwards

- The site can stay public: every page needs a signed-in, active member, and the
  database refuses everything else. Keep Deployment Protection if you prefer.
- `npm run verify` and `scripts/test-sql.sh` on every change; `scripts/test-e2e.sh`
  before every release.
- Keep staging separate: a second Supabase project and a Preview environment
  pointed at it. There is no longer any way for a copy of the app to reach the
  live database by accident.
