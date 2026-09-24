# Deployment Runbook

How to put this version live. It replaces an app that let anyone holding the
public key read and write the books; after this, nothing is reachable without
signing in, and the database itself enforces who may see and do what.

**The migrations and the new app go live together.** Migration `0016` removes
every write permission the old app relied on, so the old till stops recording
sales the moment it is applied; the new app needs `0014`–`0017` to work at all.
Plan a short window when the café is closed.

## Where the live system stands (24 September 2026)

| Step                         | Status                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. The old history           | ✅ Cleared: it was trial data                                                                                                                                                                                                                                                                                                                                                            |
| 2. The Vercel settings       | ✅ Added by the owner                                                                                                                                                                                                                                                                                                                                                                    |
| 3. Migrations `0014`–`0017`  | ✅ Applied on 23 September, then compared with the tested build object by object: functions, tables, rules, indexes, triggers and permissions are identical. The public key has no access                                                                                                                                                                                                |
| 4. The new app               | ✅ Merged for production ([pull request #1](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/1)) and deployed                                                                                                                                                                                                                                                             |
| 5. Sign-in settings          | ✅ Set                                                                                                                                                                                                                                                                                                                                                                                   |
| 6. The owner's first sign-in | ✅ 23 September                                                                                                                                                                                                                                                                                                                                                                          |
| The till update (`0018`)     | ✅ Migration applied on 24 September and compared object by object with the tested build: identical. The screens were merged ([pull request #2](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/2)) and deployed (see [After `0018`](#after-0018))                                                                                                                       |
| Discounts (`0019`)           | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back. The screens were merged ([pull request #3](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/3)) and deployed (see [After `0019`](#after-0019))                                                          |
| Discount rounding (`0020`)   | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back. The screens were merged ([pull request #4](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/4)) and deployed. The step was then set to 250 IQD at the owner's request (see [After `0020`](#after-0020)) |
| Bill numbers (`0021`)        | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back (see [After `0021`](#after-0021)). The form was merged ([pull request #6](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/6)) and deployed                                                              |

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

## After `0018`

Migration `0018` (tables, bills paid later, product photos, categories) only
adds to the database, and the app deployed before it keeps working unchanged:
its menu function returns the same five columns first, and the day close
refuses only when a bill is open, which that app cannot create. So `0018` goes
in first and the screens that use it follow. It was applied on 24 September
2026 with the Supabase connector (one `apply_migration` call, one transaction),
after a read-only check found no category names that would collide.

When the new screens are deployed:

1. **Products:** add the categories, then a photo, a category and a ★ for each
   product ([owner's guide](owner-guide.md#setting-up-the-till)).
2. **POS → Tables → Edit tables:** add the tables.
3. **Printers:** set the receipt printer as the till's default printer
   ([cashier quick-start](cashier-quickstart.md#printing)).

## After `0019`

Migration `0019` (discounts) also goes in before its screens. The app
deployed before it keeps working: every new parameter defaults to no
discount, and the open-bills function keeps its first thirteen columns. It
was applied on 24 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
functions it replaces had the signatures it drops.

It was then compared with the tested build, object by object: identical. It
was also checked as the owner in a transaction that was rolled back:

- 10% off a 1,000 IQD sale came to 100 off;
- a bill with 750 IQD off 1,500, paid by card, came to 750;
- both journals posted revenue at the full price, the discount in 4100 and
  the payment at what was paid;
- every reconciliation check was zero.

Nothing was kept, and the journal numbering is unchanged.

Nothing needs setting up. Owners, managers and cashiers can give discounts.
To keep discounts to managers, take `discount.apply` from the cashier role
(see the [owner's guide](owner-guide.md#setting-up-the-till)).

## After `0020`

Migration `0020` rounds a discount given as a percentage to the nearest
500 IQD (`business.discount_round_to`), so the till never asks for a few odd
dinars. It goes in before its screens: the app deployed before it keeps
working, because every function keeps its signature and its grants. Until the
new screens are deployed, that app shows a percentage to the dinar while the
sale records it rounded to 500, so apply it and deploy together.

It was applied on 24 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the two
functions it replaces were exactly the verified `0019` ones. It was then
compared with the tested build, object by object: identical. It was also
checked as the owner in a transaction that was rolled back, on the café's own
menu:

- 47% off Espresso, Iced Latte and iced spanish latte (8,500 IQD) came to
  4,000 off and 4,500 to pay;
- a bill with 7% off 6,000 (420) came to 500 off and 5,500 to pay;
- both journals posted revenue at the full price, the discount in 4100 and
  the payment at what was paid;
- every reconciliation check was zero.

Nothing was kept, and the journal numbering is unchanged.

The same day the owner asked for 250 IQD instead of 500. That is a setting,
not a migration:

```sql
select audit_event(id, 'settings.discount_round_to', 'business', id::text, '<why, and at whose request>',
                   jsonb_build_object('discount_round_to', discount_round_to),
                   jsonb_build_object('discount_round_to', 250))
  from business;
update business set discount_round_to = 250;
```

It was run in one transaction with the Supabase connector, and the audit
trail records it as `settings.discount_round_to`, 500 → 250. A check as the
owner, in a transaction that was rolled back:

- 7% of 5,000 (350) came to 250 off;
- a bill with 3% of 8,500 (255) came to 250 off;
- 47% of 8,500 still came to 4,000 off;
- the till was told 250, and every reconciliation check was zero.

To round to a different step, run the same two statements with the new value.
**Settings** shows it at once; each till follows it once it is refreshed.

## After `0021`

Migration `0021` gives a bill entered without the supplier's own number the
café's number: SGC-2026-0001, -0002 … (`business.bill_prefix`, a count per
year). It goes in before the form that fills the number in: the app deployed
before it keeps working, because `record_bill` keeps its signature, still
takes any number typed in, and only adds the number it used to its answer.

It was applied on 24 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that
`record_bill` was exactly the verified `0020` one and that no bill already
carried an SGC number. It was then compared with the tested build, object by
object: identical. Only `next_bill_number()` is new to signed-in users; the
helpers behind it cannot be called from outside. A check as the owner, in a
transaction that was rolled back:

- the form was offered SGC-2026-0001, and a bill left with it took it, as did
  its journal (`Bill SGC-2026-0001`);
- the next bill, for another supplier, took SGC-2026-0002;
- SGC-2026-0009 typed by hand was refused;
- a supplier's own number (ERBIL-555) was kept, and used none of the café's;
- every reconciliation check was zero.

Nothing was kept: no bill, no counter, and the journal numbering is unchanged.
