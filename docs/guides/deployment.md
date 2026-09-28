# Deployment Runbook

How to put this version live. It replaces an app that let anyone holding the
public key read and write the books; after this, nothing is reachable without
signing in, and the database itself enforces who may see and do what.

**The migrations and the new app go live together.** Migration `0016` removes
every write permission the old app relied on, so the old till stops recording
sales the moment it is applied; the new app needs `0014`–`0017` to work at all.
Plan a short window when the café is closed.

## Where the live system stands (27 September 2026)

| Step                                    | Status                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. The old history                      | ✅ Cleared: it was trial data                                                                                                                                                                                                                                                                                                                                                            |
| 2. The Vercel settings                  | ✅ Added by the owner                                                                                                                                                                                                                                                                                                                                                                    |
| 3. Migrations `0014`–`0017`             | ✅ Applied on 23 September, then compared with the tested build object by object: functions, tables, rules, indexes, triggers and permissions are identical. The public key has no access                                                                                                                                                                                                |
| 4. The new app                          | ✅ Merged for production ([pull request #1](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/1)) and deployed                                                                                                                                                                                                                                                             |
| 5. Sign-in settings                     | ✅ Set                                                                                                                                                                                                                                                                                                                                                                                   |
| 6. The owner's first sign-in            | ✅ 23 September                                                                                                                                                                                                                                                                                                                                                                          |
| The till update (`0018`)                | ✅ Migration applied on 24 September and compared object by object with the tested build: identical. The screens were merged ([pull request #2](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/2)) and deployed (see [After `0018`](#after-0018))                                                                                                                       |
| Discounts (`0019`)                      | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back. The screens were merged ([pull request #3](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/3)) and deployed (see [After `0019`](#after-0019))                                                          |
| Discount rounding (`0020`)              | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back. The screens were merged ([pull request #4](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/4)) and deployed. The step was then set to 250 IQD at the owner's request (see [After `0020`](#after-0020)) |
| Bill numbers (`0021`)                   | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back (see [After `0021`](#after-0021)). The form was merged ([pull request #6](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/6)) and deployed                                                              |
| Recipe costing (`0022`)                 | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back (see [After `0022`](#after-0022)). The form was merged ([pull request #8](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/8)) and deployed                                                              |
| Production (`0023`)                     | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0023`](#after-0023)). The screens were merged ([pull request #9](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/9)) and deployed                                    |
| Counts and the drawer (`0024`)          | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0024`](#after-0024)). The screens were merged ([pull request #10](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/10)) and deployed                                  |
| Prices, bills, costs (`0025`)           | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0025`](#after-0025)). The screens were merged ([pull request #11](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/11)) and deployed                                  |
| Reports that agree (`0026`)             | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner against the live records (see [After `0026`](#after-0026)). The screens were merged ([pull request #12](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/12)) and deployed                                               |
| Master data (`0027`)                    | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0027`](#after-0027)). The screens were merged ([pull request #13](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/13)) and deployed                                  |
| Exceptions (`0028`)                     | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0028`](#after-0028)). The screens were merged ([pull request #14](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/14)) and deployed                                  |
| Alerts and the brief (`0029`)           | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0029`](#after-0029)). The screens were merged ([pull request #15](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/15)) and deployed                                  |
| Card and platform money (`0030`)        | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0030`](#after-0030)). The screens were merged ([pull request #16](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/16)) and deployed                                  |
| Platforms to retry keys (`0031`–`0035`) | ✅ Migrations applied between 25 and 27 September, each compared object by object with its tested build and checked in a transaction that was rolled back; the screens deployed with each (see [`../PROGRESS.md`](../PROGRESS.md))                                                                                                                                                       |
| Cash sessions (`0036`)                  | ✅ Migration applied on 27 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0036`](#after-0036)). The screens were merged ([pull request #25](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/25)) and deployed                                  |
| Refunds by the item (`0037`)            | ✅ Migration applied on 27 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0037`](#after-0037)). The screens were merged ([pull request #26](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/26)) and deployed                                  |
| Delivery corrections (`0038`)           | ✅ Migration applied on 27 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0038`](#after-0038)). The screens were merged ([pull request #27](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/27)) and deployed                                  |
| Usage against the recipes (`0039`)      | ✅ Migration applied on 27 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0039`](#after-0039)). The screen was merged ([pull request #28](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/28)) and deployed                                    |
| The café's rules (`0040`)               | ✅ Migration applied on 27 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0040`](#after-0040)). The screens were merged ([pull request #29](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/29)) and deployed                                  |
| Sizes and add-ons (`0041`)              | ✅ Migration applied on 28 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0041`](#after-0041)). The screens were merged ([pull request #30](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/30)) and deployed                                  |

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
  unit cost (Dr 1200 Inventory, Cr 3000 Owner equity); an item that already
  exists with no stock recorded (after the test records are cleared) takes it
  on **Inventory → Opening stock**;
- stock not yet paid for: **Purchasing → Receive stock**, then the supplier's
  bill on **Vendors**;
- cash in the drawer or the safe: **Sales → Move Cash**, from the owner (Dr
  1000 Cash in the till or 1005 Cash in the safe, Cr 3000 Owner equity); money
  in the bank: **Journals → New Journal**, Dr 1020 Bank, Cr 3000 Owner equity
  (since `0024` no manual journal touches 1000: the till's cash moves only
  through its own records);
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

## After `0022`

Migration `0022` adds one read-only function, `item_costs()`: each item's cost
per base unit today, as `menu_costing` charges a serving, for the product form
to cost a recipe while it is typed. It needs `cost.view`. It goes in before the
form that uses it; the app deployed before it does not call it.

It was applied on 24 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0021` build. It was then compared
with the tested build, object by object: identical. The one difference from
`0021` is the new function, callable by signed-in users only, never by the
public. A check as the owner, in a transaction that was rolled back:

- all 9 live items were given their cost, each to the last digit of what a sale
  is charged; none lacked a cost;
- for all 19 prices on the live menu (product and channel), one serving costed
  from those figures, the way the form costs it, came to exactly the cost the
  product's card shows.

The check only read: nothing was written, and nothing was kept.

## After `0023`

Migration `0023` makes production real: batch recipes (what the café makes,
from what, and how much a batch makes), recording a batch, cancelling one, and
changing a product's recipe from a date. It adds seven columns (to `recipe` and
`production_batch`), the `production.record` permission (owner, general
manager, branch manager, barista) and six functions signed-in users may call,
each checking the person's permission; it tightens `new_recipe_version` and
names each line's item in `menu_recipe_lines`. It goes in before the screens:
the app deployed before it calls none of the new functions, and reads
`menu_recipe_lines` as before.

It was applied on 25 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0022` build, with no batch recipes
and no batches. It was then compared with the tested build, object by object,
the role permissions and column grants included: identical. A check as the
owner, in a transaction that was rolled back:

- a batch recipe from the live milk and sugar, two batches recorded: 2,000 ml
  of milk out at 1.5 a ml (3,000 IQD), 200 g of sugar at its average (318), and
  the base in at exactly 3,318;
- no journal written (67 before and after), and every reconciliation check zero
  before the batch, after it, and after cancelling it;
- the cancelled batch's movements net to zero;
- the Latte's recipe saved again from today, unchanged: version 2, its costs the
  same on every channel;
- every live recipe line names its item.

Nothing was kept.

## After `0024`

Migration `0024` puts right what the September 2026 audit
([`../SYSTEM_AUDIT_2026-09.md`](../SYSTEM_AUDIT_2026-09.md), P0-1 to P0-3)
found could make the numbers wrong in everyday use:

- **Counts while trading.** Each item is compared with the stock at the moment
  it is counted, not when the count opened; one count at a time; a count can
  be cancelled.
- **The drawer.** The day close becomes a drawer count covering everything
  since the last count, whatever the date — the café trades past midnight.
  What stays in the drawer carries to the next count; the rest goes to the
  safe (new account 1005) or the bank. Cash can be moved between the till, the
  safe, the bank and the owner.
- **Where money came from.** Every expense and bill payment says: the till,
  the safe, the bank, a card, or the owner personally. Neither the till nor
  the safe pays out more than the books say it holds, and 1000 takes no
  manual journal.
- **Opening stock** for an item with no stock history, at its cost.

It adds two tables (`cash_event`, `cash_transfer`), columns on `work_shift`
and `stock_count_line`, account 1005, and five functions signed-in users may
call (`count_drawer`, `move_cash`, `drawer_status`, `cancel_stock_count`,
`record_opening_stock`); it redefines the counting, expense, bill-payment,
void and reversal functions, and `close_day` now only asks an open page to
refresh. Nothing recorded before it changes; the cash taken since the last
day closed the old way (in the live database, four sales of 25 September) is
carried into the drawer as its first events, so the first count expects it. It
goes in before the screens,
as before: the app deployed before it keeps working — its "cash" still means
the till and "transfer" the bank — except closing a day, which asks the page to
be refreshed; the new screens follow within minutes.

The app also treats a lost answer from the database as "may have been saved"
(audit P0-4): the till keeps the sale and retries it with the same key, which
cannot record it twice.

It was applied on 25 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0023` build, with no bill open. It
was then compared with the tested build, object by object, the role
permissions and column grants included: identical. It added 1005 Cash in the
safe, renamed 1000 Cash in the till, and carried the four cash sales since the
last day closed (24 September; 50,500 IQD) into the drawer. A check as the
owner, in a transaction that was rolled back:

- the drawer asked what it began with, and already held the 50,500 taken since;
  25 September was listed as not counted;
- a float of 10,000 from the owner and 1,000 of ice paid out of the till moved
  it; paying from the empty safe was refused;
- the first count, told the drawer began with 20,000, expected 79,500 and
  counted true; 5,000 stayed and 74,500 went to the safe; no day was left
  uncounted, and the next count starts from the 5,000;
- banking the safe emptied it; voiding a sale in that count was refused; a
  second opening balance for a live item was refused;
- every reconciliation check stayed at zero.

Nothing was kept. The till's account (1000) on the test records stands at
−220,000, from test expenses paid "from cash" before `0024`; clearing the test
records clears it.

## After `0025`

Migration `0025` is the September 2026 audit's first P1s
([`../SYSTEM_AUDIT_2026-09.md`](../SYSTEM_AUDIT_2026-09.md), P1-5 to P1-7):

- **The recipe and price in force.** The recipe that started last is used, so
  a change made today no longer hides one scheduled for later. Scheduled
  prices and recipes are listed on each product and can be withdrawn with a
  reason. A price cannot be dated in the past; each one set is audited.
- **Printed bills.** Printing a bill fixes its prices, and it is paid at them.
  Every payment carries the total the till showed, and the database refuses
  one it would record at another total; the till then fetches today's prices
  (as it also does every ten minutes and when its screen comes back to the
  front).
- **Sales costed at nothing** are listed on Reports and warned of on the
  month-end checklist, without stopping the lock. A new product needs a
  recipe, or a reason it uses no stock.

It adds two columns (`pos_tab_line.unit_price`, `product_variant.no_stock_reason`)
and five functions signed-in users may call (`menu_scheduled`,
`cancel_scheduled_price`, `cancel_scheduled_recipe`, `set_no_stock`,
`report_uncosted_sales`); it redefines the recipe-version and price rules,
printing, saving, splitting and listing bills, the sale and bill payment
functions (which take the till's total, optionally), creating a product,
changing its recipe, and the period checklist and lock. Nothing recorded before
it changes. It goes in before the screens, as before: the app deployed before
it keeps working (the total is optional), except that creating a product with
no recipe is refused until the new form, which asks why, follows within
minutes.

It was applied on 25 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0024` build, with no bill open,
nothing sold since 00:27, nothing scheduled, and every live recipe (seven, one
version each) in force under the new rule exactly as under the old. It was
then compared with the tested build, object by object, the role permissions
and column grants included: identical. A check as the owner, in a transaction
that was rolled back:

- the Americano's dine-in price (3,000) dated yesterday was refused; set for
  next week, it was listed as scheduled while 3,000 stayed in force, then
  withdrawn with a reason, on the audit trail;
- a bill of two printed at 3,000, then the price put up to 3,500 from today:
  the bill still showed 3,000 a cup, 6,000 in all; paying it at 7,000 was
  refused, at 6,000 it was paid;
- a quick sale from a till still showing 3,000 was refused ("The total is 3500
  now, not the 3000 shown"); at 3,500 it was recorded;
- a product with no recipe and no reason was refused; with "A service charge"
  it was created;
- the live records have no sale costed at nothing; the month's checklist shows
  that line as a warning that does not block; every reconciliation check
  stayed at zero.

Nothing was kept. The security advisor's only new lines are the five new
functions signed-in users may call (each checks its permission, as every one
does) and an internal helper (`assert_sale_total`) that sets no search path;
no one can call it directly.

## After `0026`

Migration `0026` is the audit's P1-2: reports that agree, and numbers that
open. A refund counts on the day it is made, so Sales by Channel's net sales
are the P&L's net revenue; the dashboard no longer counts a year-end close as
trading; and three reports are added for the screens: the journal lines behind
any account and dates (the trial balance's, the P&L's and the reconciliation's
figures open onto them, and they download as CSV), and each item's stock card.
No table changes and nothing recorded changes. `report_daily_sales` returns
refunds and their returned cost in place of `refunded`: the Sales page deployed
before it shows no refunds until the new screens follow, minutes later.

It was applied on 25 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0025` build. Compared with the tested
build object by object, permissions included: identical. A check as the owner
against the live records of September, in a transaction that was rolled back:

- by channel, takeaway sold 49,000 and refunded 4,500: net 44,500, the audit's
  own example put right; net sales in all, 180,750, are the P&L's net revenue,
  and their cost, 47,226, is the P&L's cost of goods sold;
- the month's 196 journal lines balance (4,282,090 each side); 4000's add up
  to the P&L's 186,250; 1000's run from the trial balance's opening to its
  closing (−220,000, from the test records);
- the stock card of each of the nine items in use closes at the stock board's
  quantity and value.

The security advisor's only new lines are the two new report functions
signed-in users may call (each checks `cost.view`).

## After `0027`

Migration `0027` is the audit's P1-1, P1-3 and P1-4: who changed what,
delivery prices checked, and items and suppliers kept right. Every change to
products, stock items and their units, suppliers, categories, business
settings and places is recorded by the database with its values before and
after, and every price with the one it replaced; opening stock becomes the
owner's, with a reason; a delivery far from what the item costs now waits for
the person to confirm it; items and suppliers can be corrected and taken out of
use; names are unique among those in use. Nothing recorded changes: the prices
set before it say no one set them, and sales before it show their product's
name as it is now. Until the new screens follow, minutes later, the Inventory
page deployed before it cannot record opening stock (it sends no reason), and
a delivery far from the cost now is refused without a way to confirm it.

It was applied on 25 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0026` build, and that no two items,
suppliers or products in use would share a name (9 items, 4 suppliers and 7
products, all different). Compared with the tested build object by object,
permissions included: identical. A check as the owner against the live
records, in a transaction that was rolled back:

- a price set for next week recorded the 3,000 it would replace and 3,500,
  against the owner, who is also on the price itself; withdrawn, it left one
  row with its reason;
- "BOTTLED WATER." was refused as a second Bottled water, and "erbil dairy
  supply." as a second Erbil Dairy Supply;
- an item added, corrected (with its reason), given a kilogram and given its
  opening stock by the owner (refused without a reason) left four rows saying
  so, and a kilogram of another size was refused;
- coffee beans received at 1.61 a gram, when they cost 32.18, were stopped
  ("95% below its cost now"); confirmed, they were received and the
  confirmation recorded; at their cost they went straight in;
- a drink sold and then renamed kept its name on the sale;
- the older recipe change was refused; every reconciliation check stayed at
  zero.

Nothing was kept. The security advisor's only new lines are the four new
functions signed-in users may call (each checks its permission); every new
function sets its search path.

## After `0028`

Migration `0028` is the audit's P1-10: every void, refund, discount and
cancelled bill takes a reason from a list; a discount over 10% of the bill
needs a manager's approval — their name and PIN, typed on the till; a void or
refund may be approved by a second person, and without one waits for the
owner's review; every line taken off a bill is recorded; and the exceptions
report lists it all by person. Owners and managers each set their PIN on **My
account** once the new screens are live: until one has, nobody can approve a
cashier's discount over 10% (managers and the owner still give any discount
themselves). Nothing recorded changes: a discount given before it says "No
reason kept". Until the new screens follow, minutes later, the till deployed
before it cannot give a discount (it sends no reason); voids, refunds and
cancelled bills from the older screens still work, their reason taken as
"Other", which needs a few real words.

It was applied on 25 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0027` build, that bcrypt hashing
works where the migration expects it (`extensions.crypt`), and that no bill
was open. Compared with the tested build object by object, permissions
included: identical. A check as the owner against the live records, in a
transaction that was rolled back (in which, alone, a barista was allowed to
give discounts, so the cap could be tried by someone who does not approve
them):

- the owner's PIN "1234" was refused as too easy to guess; another was kept,
  as a hash;
- the barista's 10% discount without a reason was refused, and given with
  "Regular customer", approved by no one;
- 20% was refused ("A discount over 10% needs a manager's approval"); the
  owner was the only one listed to approve it; a wrong PIN was refused, the
  right one approved it, and the sale recorded the barista as giving it and
  the owner as approving it; the same approval used again was refused;
- a bill with 10% off showed its reason and who gave it, and an item taken
  off it before printing was recorded;
- "hjjjhjjk" was refused as a reason; the owner's void ("Rang twice") and
  refund ("Something was wrong with it: too sweet for them") were kept with
  their codes, and the bill was cancelled as "Customer left without ordering";
- the exceptions report listed the void, the refund and the wrong PIN for
  review, the two discounts, the cancelled bill and the line taken off; every
  reconciliation check stayed at zero.

Nothing was kept (no approvals, PIN attempts, PINs or test rows remained).
The security advisor's only new lines are the four new functions signed-in
users may call (each checks its permission) and the two approval tables,
which no one signed in may read: only the functions use them. Every new
function sets its search path.

## After `0029`

Migration `0029` is the audit's P1-8: the dashboard opens on what needs
someone. Sixteen rules check the books each time it opens and say what
happened, why it matters, how urgent (🔴 now, 🟠 soon), what to do and how sure
they are; an alert is answered with a note or snoozed with a reason (both on
the audit trail) and resolves itself when its condition clears. Below them,
yesterday's brief: facts, calculations and what to do, apart. The thresholds
are on **Settings → Alerts**, and each vendor may say how many days a
delivery takes (**Vendors → Edit vendor**). Nothing recorded changes. Until
the new screens follow, minutes later, the dashboard deployed before it
shows no alerts, and editing a vendor still works (its delivery time left
empty).

It was applied on 25 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0028` build. Compared with the
tested build object by object, permissions included: identical. A check as
the owner against the live records, in a transaction that was rolled back:

- the first look at the live books took 143 ms, and found what the audit
  found by hand: the till at −220,000 IQD (red), the stock count open since
  24 September 14:55, rent of 150,000 recorded twice, Bottled Water at 5,000
  dine-in but 500 takeaway, the owner's seven voids, refunds and discounts in
  the week (10.6% of their sales), and nine prices under the 70% margin
  target; card (19,000) and Talabat (5,250) money were too recent to be late;
- yesterday's brief read net sales 130,250 over 20 sales, 2 voids (16,000),
  2 refunds (4,500), 1 discount (1,000), waste 3,400; cost of goods 36,168
  (27.8%), gross profit 86,682 (66.6%); to do: the till below zero;
- the bank taken 50,000 below zero was red and first; "ok" was refused as an
  answer and a real one kept, with the owner's name; the money put back, the
  alert resolved itself;
- an orange alert could not be snoozed until today, and was snoozed a week;
  a 96% margin target was refused and 65% kept; eleven thresholds listed;
- the audit trail gained exactly the answer, the snooze and the threshold;
  every reconciliation check stayed at zero.

Nothing was kept (no alerts, answers, thresholds or journals remained). The
security advisor's only new lines are the six new functions signed-in users
may call (each checks its permission) and the alerts table, which no one
signed in may read. Every new function sets its search path.

## After `0030`

Migration `0030` is the audit's P1-9: card and platform money reconciled.

- **Card takings are settled** on **Sales → Card Takings**, a run of days at a
  time and each day once it is over, against the terminal's report and what
  reached the bank: the bank's money to 1020, the card company's fee to the
  new **6500 Card and bank fees** (added to the chart of accounts), and a
  difference between the till and the terminal to 6300 with a note. A
  settlement can be cancelled. A payment by card — an expense or a supplier
  bill — now comes out of the bank.
- **A platform sale needs the order number** from the platform's tablet, once
  per platform; the till asks for it. Talabat, Careem and Toters are added to
  the delivery platforms.
- **Delivery Platforms** shows what each platform owes, order by order, and
  matches a pasted statement to the orders; a person who keeps the books posts
  the payout. See [`talabat.md`](talabat.md).
- Until the new screens follow, minutes later, the till deployed before it
  cannot record a Talabat sale: it has no box for the order number, and the
  database asks for one. Everything else carries on.

Nothing recorded changes. The two Talabat sales from before `0030` have no
order number, so their 5,250 IQD in 1100 is matched to no order: the dashboard
flags it until a journal explains it, or the test records are cleared.

It was applied on 25 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0029` build. Compared with the
tested build object by object, permissions included: identical; the chart of
accounts gained exactly 6500, and the three platforms were added. A check as
the owner against the live records, in a transaction that was rolled back:

- the card takings read 19,000 IQD, all of 24 September, in 7 ms; settling
  today was refused (a day is settled once it is over); a terminal total
  differing from the till was refused without a note; 24 September settled at
  a 1% fee posted Dr 1020 18,810, Dr 6500 190, Cr 1010 19,000 and left nothing
  waiting; cancelled, the 19,000 waited again;
- an expense paid by card posted Cr 1020, not 1010;
- a Talabat sale without an order number was refused; with SMOKE-1 it was
  recorded (3,000 IQD); the same number again, in small letters, was refused
  with the sale it belongs to; Delivery Platforms read 1 order waiting (3,000),
  1100 at 8,250 and 5,250 matched to no order, which the dashboard flagged;
- a statement paying SMOKE-1 2,550 with 450 commission, and a line for no
  sale of ours, matched one and not the other and proposed Dr 1020 2,550, Dr
  5100 450, Cr 1100 3,000; without a note it was refused; with one it posted
  exactly that, the order stopped waiting, and cancelled, it waited again;
- the audit trail gained exactly the two settlements and their cancellations;
  every reconciliation check stayed at zero.

Nothing was kept: no settlement, platform order, sale, expense or journal
remained, the journals are still numbered 1001–1067 without a gap, and 1010,
1020 and 1100 read as before. The security advisor's only new lines are the
seven new functions signed-in users may call and the new `record_sale` (each
checks its permission), and the card settlements table, which no one signed
in may read; every new function sets its search path. The performance
advisor adds only the new tables' foreign keys to its list of those without
an index of their own, as for every table before them.

The screens went live the same day with
[pull request #16](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/16):
the deployment and the production address serve the same build, so the till
asks for the Talabat order number from then on.

Migrations `0031` to `0035` went live the same way, between 25 and 27
September; what each did and how it was checked is in
[`../PROGRESS.md`](../PROGRESS.md).

## After `0036`

Migration `0036` (release K) puts the drawer in sessions, counted blind:

- **The drawer is opened and closed with a count**, on the till, by whoever
  works it; cash is taken only while it is open. A card sale needs no drawer.
- **The count is blind**: only the owner, general managers, accountants and
  auditors see what an open drawer should hold. Everyone else sees it in the
  answer, once their count is in.
- **Differences post to 6300** for their session: at the close, against what
  it should have held; at the opening, against what the last session left.
- **Hand-over, a manager's close of a session left open (with a reason), and
  a float from the safe** at the opening.
- **Alerts** for a session open too long, one short, and one a manager
  closed. **Keys**: a write through the API without its retry key is refused.

It adds `cash_drawer` (one per branch), session columns on `work_shift`, a
foreign key from `sales_order.shift_id`, three permissions, and seven
functions signed-in users may call (`open_cash_session`, `close_cash_session`,
`hand_over_session`, `force_close_session`, `cash_session_status`,
`cash_sessions`, `cash_session_statement`). It goes in before the screens: on
the app deployed before it, cash is refused (**Open the drawer first**) until
the new till is deployed, since the old one cannot open the drawer; card
sales and everything else keep working. The old Sales screen's count closes
the open session, or says to open the drawer on the till first.

**The first opening takes over from the books.** A drawer never counted in
sessions opens against what the books say the till holds (1000); the count
settles the difference to 6300, as a drawer count of its own, and the first
session starts from the count.

It was applied on 27 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0035` build. The text stored there
is the file byte for byte, and it was then compared with the tested build,
object by object, the role permissions and column grants included: identical,
but for the schema `citext` lives in, as before. It gave the Main Branch and
the Central Kitchen their drawers. A check as the owner, in a transaction
that was rolled back:

- with the drawer closed, a cash sale, the old count and a keyed write
  through the API without its key were each refused;
- the first opening, counted at nothing, took over from the books, which say
  the till holds −320,000 IQD (test expenses paid "from cash" before
  `0024`), took in the 20 movements of cash since the last day closed the old
  way, and posted 320,000 to 6300 as over; opened twice with one key, it
  opened once;
- a cash sale of 3,000 named the session; the owner was shown that the drawer
  should hold 3,000, the branch manager was not (nor its figures, its
  statement or the old screen's cash figures), and the barista could not
  close the owner's session;
- closed at 2,500, it was 500 short, posted to 6300, and the 2,500 went to the
  safe; cash was then refused again; no day was left uncounted, and every
  movement of cash was in a session.

Nothing was kept: still 40 sales, 18 bills (2 open), journals to 1091, the 20
movements of cash waiting for the first opening, and no stored answers. **The
first opening on the live site will do the same for real**: whatever is
counted, the count plus 320,000 is posted to 6300 as over, a test record like
the rest, cleared with them. The security advisor's only new lines are the
seven new functions signed-in users may call (each checks its permission),
and three older functions now set their search path; the performance advisor
adds only the new links without an index of their own and the new index on a
sale's session, not yet used.

## After `0037`

Migration `0037` (release L) refunds by the item:

- **A refund gives back some of a sale's items, or all that is left of it.**
  Each item gives back its share of what it was sold for after the bill's
  discount; the last of an item gives back exactly what is left of it.
- **Each refund is a document**: numbered, with its items, the payment it went
  back to (the sale's), its reason, who approved it, its journal and its
  slip. A sale is **part-refunded** until nothing of it is left, and a sale
  part-refunded is not voided.
- **What can go back on the shelf does**, at what it cost when sold: every
  stock movement a sale makes now names its line. A sale recorded before
  `0037` that took stock is refunded whole.
- **What a platform owes** for an order part-refunded is what is left of it.
- **`count_drawer`**, kept through the deploy of `0036`, is closed.

It adds a column on `inventory_movement`, three tables (`sale_refund`,
`sale_refund_line`, `sale_refund_tender`, read only with `cost.view`, never
changed) and one function signed-in users may call, `refund_sale_lines`
(`sale.refund`, keyed). It goes in before the screens: the Orders screen
deployed before it keeps refunding whole sales through `refund_sale`, which
now does its work through the new refund, and the new screens need the new
tables.

It was applied on 27 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0036` build. The text stored there
is the file byte for byte, and it was then compared with the tested build,
object by object, the role permissions and column grants included: identical,
but for the schema `citext` lives in, as before. A check as the owner, in a
transaction that was rolled back:

- the old drawer count could no longer be called; the drawer, opened for the
  check, took over from the books as release K's check showed;
- a cash sale of three espressos and two americanos named its line on all
  four of its stock movements; one of each refunded gave back 5,000 out of
  the drawer's session and put a bottle of water back on the shelf at its
  cost (212): refund 1, the sale part-refunded, 1000 Cr 5,000, 4200 Dr 5,000,
  1200 Dr 212, 5000 Cr 212; sent twice with one key, it was given once;
- more than was left, a void and the cashier's refund were refused; the
  cashier read no refunds and the branch manager read it;
- the rest, through the old call, was refund 2 of 7,000: the two added up to
  the sale's 12,000, both bottles back;
- one espresso of a card sale went back to the card (1010), nothing out of the
  drawer; one americano of a Talabat order came off what Talabat owes, which
  then owed the 3,000 left;
- a sale from before `0037` was refused in part, and another was refunded
  whole (2,500, its bottle back on the shelf);
- every reconciliation check read as before, and the refunds were numbered 1
  to 5, each its sale's adjustment with its payment.

Nothing was kept: still 40 sales, 4 voids and refunds, no refund documents,
journals to 1091 and no stored answers. The security advisor adds only
`refund_sale_lines`, which signed-in users may call (it checks
`sale.refund`), and no longer lists `count_drawer`; the performance advisor
adds only the refund tables' links without an index of their own.

## After `0038`

Migration `0038` (release M) corrects a delivery, and checks the books account
by account:

- **A delivery not yet billed is corrected, or reversed**, by a document of its
  own: numbered, with the delivery before and after, the reason, what it moved
  and its journal. What was entered first is never changed. Units move at the
  delivery's own price as far as its stock is still on the shelf; a price
  corrected revalues what is still there and puts the rest to 5050.
- **Refused:** once billed (cancel the bill first), the quantity of an item
  counted since, in a locked month, a delivery reversed or from before the
  controls, a date outside the month it was entered or after today; below zero
  until confirmed.
- **The bill** is for the delivery as it stands; a reversed one has nothing to
  bill.
- **Do the books tie?** gains card takings (1010), what the platforms owe
  (1100), the drawers (1000), the safe (1005, which no longer takes a manual
  journal) and every record with its journal. The month's lock waits on all
  nine.

It adds two movement types, a table (`receipt_correction`, read only with
`cost.view`, never changed) and four functions signed-in users may call:
`preview_receipt_correction`, `correct_receipt` and `reverse_receipt`
(`inventory.adjust.approve`, the last two keyed) and `report_document_problems`
(`cost.view`). It goes in before the screens: the screens deployed before it
keep working (Purchasing lists deliveries as before, Reports shows the nine
checks, the journal form still offers the safe, which the database refuses),
and the new screens need the new table.

It was applied on 27 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0037` build and that each new check
would read zero on the live records. The text stored there is the file byte
for byte, and it was then compared with the tested build, object by object,
the role permissions and column grants included: identical, but for the
schema `citext` lives in, as before. All nine checks read zero: card takings
19,000 as 1010 holds; the platforms owing 34,500 as 1100 holds (two Talabat
sales from before order numbers, explained by the payout typed by hand as far
as it goes); the drawers not yet counted in a session; the safe at nothing; no
record to look into. A check as the owner, in a transaction that was rolled
back:

- 10 g of coffee beans received at 29 a gram and corrected to 8 g: the preview
  first, writing nothing (58 less in stock and owed, all of it still on the
  shelf), then correction 1, 1200 Cr 58, 2050 Dr 58; sent twice with one key,
  it was made once;
- its price corrected to 30: correction 2, 1200 Dr 8, 2050 Cr 8, the 12,898 g
  on the shelf revalued as a pair; its journal was refused for reversal, with
  where to correct it instead;
- a second delivery reversed: correction 3, 1200 Cr 145, 2050 Dr 145, nothing
  owed, and its bill refused;
- the first billed at 240, no variance, then corrected no more;
- a manual journal to the safe, and the barista's preview and reading of the
  records to look into, were refused; the branch manager read the three
  corrections;
- the price history showed the delivery as corrected; every check's difference
  was unchanged; the month's checklist listed the nine checks, each passing
  and blocking (September's lock still waits, as before, on three days' cash
  not counted and a count awaiting approval).

Nothing was kept: still 9 deliveries, no corrections, 9 bills, journals to
1091, 286 stock movements, 35 audit rows and no stored answers. The security
advisor adds only the four functions signed-in users may call, and no longer
lists `receipt_grni_value`'s search path; the performance advisor adds only
the correction table's links to its journal and its author without an index of
their own.

## After `0039`

Migration `0039` (release N) sets what each item used against its recipes,
between two counts:

- **Usage**, under Operations (`cost.view`): each item between its first and
  last approved count in the dates chosen. The first count, what came in, the
  last count and what was recorded as lost give what was used; set against
  what the recipes of what was sold and made say, the difference, its share
  and its value at the stock's average cost; with what may explain it, and the
  products and batches that used it. An item counted once waits for a second
  count.
- **An alert** names an item whose last two counts, the later in the last 14
  days, differ from its recipes by at least 10% and 5,000 IQD; both thresholds
  are on Settings.

It records nothing new. It adds one function signed-in users may call,
`report_usage_variance` (`cost.view`), one internal function, and the alert's
rule and its two thresholds; the alerts of `0036` are unchanged, kept as
`alert_conditions_0036`. It goes in before the screen: the screens deployed
before it keep working (the alert has nothing to name until an item has two
approved counts, and Settings lists the two thresholds last, under their
English labels), and the new screen needs the new function.

It was applied on 27 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0038` build. The text stored there
is the file byte for byte, and it was then compared with the tested build,
object by object, the role permissions and column grants included: identical,
but for the schema `citext` lives in, as before. No count has been approved on
live yet (one of 26 September, of 12 items, waits for review), so Usage is
empty and the alert silent. A check as the owner, in a transaction that was
rolled back:

- the waiting count approved by the manager (the owner counted it): Coffee
  beans and caramel gelato were then counted once, with no difference yet;
- a second count, the beans 10 g short of the books and the gelato as they
  say: the beans at 7,500 g at the first count, 2,000 g in, 9,472 g at the
  last, 28 g used where the recipes say 18, a difference of 10 g (55.6%, 287
  IQD) with "More was used than the recipes say"; the gelato at 1,000 g at
  both, with no difference;
- the alert silent at the default thresholds (287 IQD is under 5,000); lowered
  to 1% and 1 IQD, "red: Coffee beans: 10 g more used than the recipes say
  between the counts of 26 Sep and 27 Sep (55.6%, 287 IQD)", the other ten
  alert rules still there;
- the seller refused (it needs `cost.view`); the branch manager read the
  report's 12 rows;
- the two approvals' count journals left all nine checks at zero.

Nothing was kept: still one count waiting and one rejected, 21 count lines, 286
stock movements, journals to 1091, 35 audit rows, 18 alerts and the thresholds
as they were. The security advisor adds only `report_usage_variance`; the
performance advisor adds nothing.

## After `0040`

Migration `0040` (release O) puts the café's rules on Settings, each with who
set it, when and why:

- **Settings → Rules** (`settings.manage`) holds these rules:
  - the discount a cashier gives without a manager, for the café or a role;
  - the step a percentage discount is rounded to;
  - the refund above which a second person approves it, for the café or a
    role (25,000 IQD by default);
  - the loss above which a manager approves it, for the café or a role, and
    what one person's losses are added up over (their session by default);
  - what happens when more stock is used than the books hold, for the café, a
    kind of item or one item. It is refused, needs a manager's PIN, or is
    allowed with a red alert; for chosen items it can be allowed with no
    alert.

  Every change is kept, from what to what, with its reason, and on the audit
  trail.

- **Stock below zero** is checked on every sale and bill, loss, batch,
  correction by hand and corrected delivery. By default made items (finished
  goods and sub-recipes) are refused, and everything else is allowed with a
  red alert.
- **Losses are added up**: one person's over their session (or the day), and
  an item's by anyone over the day. Over the limit, a manager types their PIN,
  or the loss is saved to wait. A manager then approves it or reverses it on
  Inventory, under **Losses waiting for approval**, and an alert names them.
- **Refunds** over the limit of the refunder's roles need a second person's
  PIN.

What it adds:

- three tables: the rules, their history, and the managers' reviews of losses;
- four functions signed-in users may call: `set_business_rule` and
  `list_business_rules` (`settings.manage`), and `review_loss` and
  `losses_waiting` (`waste.approve`);
- a new parameter, with a default, on `record_sale`, `settle_tab`,
  `record_waste` and `record_production`;
- two alert rules. The alerts of `0039` are unchanged, kept as
  `alert_conditions_0039`.

The four columns of the business row stay, as the defaults, until they are
retired. It goes in before the screens: those deployed before it keep working
(every new parameter has a default), and the new ones need the new functions.

It was applied on 27 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0039` build. The text stored there
is the file byte for byte. It was then compared with the tested build, object
by object, the role permissions and column grants included: identical, but
for the schema `citext` lives in, as before.

Nobody has set a rule on live yet, so each is at its default:

- made items are refused below zero (the caramel gelato has 3,000 g in the
  books), and the rest are alerted;
- refunds over 25,000 IQD need a second person;
- losses over 50,000 IQD need a manager, added up over the person's session;
- discounts over 10% need a manager, and are rounded to 250.

A check as the owner, the branch manager and the barista, in a transaction
that was rolled back:

- **The rules:** all at their defaults to start. A cap of 5% for cashiers was
  set beside the café's 10%, with its history. The branch manager was refused
  ("needs settings.manage").
- **Bottled water set to refuse:** "Only 59 each of Bottled water is in
  stock: record the delivery or the batch first, or count it".
- **Bottled water set to ask a manager:** refused without one, then sold with
  the branch manager's PIN. It went to −1 in the books, with "red: Bottled
  water is below zero in the books: -1 each" and the approver on the audit
  trail.
- **Losses limited to 1,000 IQD:**
  - the barista's first loss of coffee beans (10 g) was recorded with no
    approval;
  - the second (30 g) was refused on its own, the two together being over the
    limit;
  - it and a third (50 g) were saved to wait: "orange: 2 loss(es) waiting for
    a manager's approval (2,299 IQD)";
  - the manager approved one and reversed the other. The beans came back by
    50 g and its journal was reversed (1200 Dr 1,437, 5300 Cr 1,437), leaving
    none waiting.
- **A refund of ten lattes (35,000 IQD, by card):** the branch manager's
  refund was refused alone ("A refund over 25,000 needs a second person to
  approve it"), then given with the owner's PIN.
- **The barista's profile:** a cap of 10%, a step of 250, losses 1,000,
  refunds 25,000, added up over the session.
- **The books:** all nine checks at zero.

Nothing was kept: 286 stock movements, journals to 1091, 35 audit rows, 18
alerts, and no PIN, rule or review.

The security advisor adds only the four functions above, each checking its
permission, and lists `record_sale`, `settle_tab`, `record_waste` and
`record_production` under their new signatures. The performance advisor adds
only notes that the new tables' links to their authors, journals and
reversals have no index of their own.

## After `0041`

Migration `0041` (release P) lets a product have sizes added on its card, and
the till sell add-ons:

- **Sizes** (`recipe.edit`): a size is added with its prices and one of: its
  own recipe, the recipe another size has in force today, or why it uses no
  stock; the product's one size is named in the same step (Latte becomes
  Regular). A size is renamed, retired with a reason, or brought back; the
  last size on sale and one on an open bill stay on sale.
- **Add-ons** (`recipe.edit`): groups that say the fewest and the most a line
  takes (1 or more: the till asks for it), add-ons with a price per channel
  from a date and what one uses (for every size, or a size's own), and the
  groups each product offers, with every size or some.
- **Selling**: a line carries its add-ons: priced with it, its discount shared
  over them, what they use taken from stock under the stock rules and costed
  with it. A printed bill keeps its add-ons' prices; splitting, paying,
  refunds and voids carry them.
- **Reports → Sizes and add-ons** (`cost.view`).

What it adds:

- seven tables: the groups, the add-ons, their prices, their recipes, the
  groups each product offers, a bill line's add-ons and a sale line's add-ons
  (append-only);
- ten functions signed-in users may call: `add_variant`, `update_variant`,
  `retire_variant`, `save_modifier_group`, `save_modifier`,
  `set_modifier_price`, `set_modifier_recipe` and `set_product_modifiers`
  (`recipe.edit`, keyed), `pos_addons` (`sale.create`) and
  `report_sizes_and_addons` (`cost.view`);
- add-ons on `post_sale`, `save_tab`, `split_tab`, `mark_bill_printed`,
  `settle_tab` and `pos_open_bills`, each keeping its signature.

It goes in before the screens: those deployed before it keep working (a line
with no add-ons is sold as before, and the open bills gain a field the old
till ignores), and the new ones need the new functions.

It was applied on 28 September 2026 with the Supabase connector (one
`apply_migration` call, one transaction), after a read-only check that the
live database still matched the verified `0040` build. The text stored there
is the file byte for byte. It was then compared with the tested build, object
by object, the role permissions and column grants included: identical, but
for the schema `citext` lives in, as before.

No group or add-on exists on live yet, and the menu is as it was: the till
sells exactly as before until the owner adds some.

It was checked as the owner and the barista, in a transaction that was rolled
back:

- **Sizes:** the Latte, one size named like the product, was given a Large at
  4,500, its recipe copied and its one size renamed Regular in the same step.
  The same name again was refused.
- **Add-ons:** a milk group (whole, free; oat, 500, with its milk, and the
  Large's own 200 ml) and an extras group (a shot at 750, 18 g of beans),
  offered with every size and with the Large only. The barista's till read
  both groups and the two offers.
- **A Large without its milk** was refused: "Choose Smoke milk for Latte —
  Smoke large".
- **A sale** of a Large with oat milk and two shots and a Regular with whole
  milk came to 10,000, the total the till works out. The lines were 6,500 and
  3,500, costing 2,151 and 817, each add-on with its price and cost. It used
  600 ml of milk and 72 g of beans, and its journal balanced.
- **A bill** printed at 4,000 was paid at 4,000 after the oat milk went up to
  700: the oat milk at 500.
- **The report** gave each size and add-on its sales and cost.
- **Retiring:** the Large was retired with a reason; the last size on sale was
  kept.
- **The books:** all nine checks at zero.

Nothing was kept: 286 stock movements, journals to 1091, 35 audit rows, the
Latte's size still named Latte, and the seven new tables empty.

The security advisor adds only the ten functions above, each checking its
permission. The performance advisor adds only notes that thirteen of the new
tables' links have no index of their own, and that two new indexes are not
used yet.

## Clearing the test records

Every record of trading in the live database so far is a test (the owner, 25
September 2026). They are cleared **when the owner says so**, and not before,
with [`supabase/remediation/reset-test-data.sql`](../../supabase/remediation/reset-test-data.sql):

1. It keeps the business and its locations, the chart of accounts, the people
   and their roles, the menu (products, their sizes, categories, photos,
   prices, recipes, and the add-ons with their groups, prices and recipes),
   the stock items and their units, suppliers, tables, the café's rules and
   their history, and the audit trail, which gains one line saying what was
   cleared.
2. It clears sales (with their add-ons), open bills, voids and refunds, cash
   sessions, drawer counts and cash moved (each branch keeps its drawer), stock
   movements and the reviews of losses, counts and batches, deliveries,
   supplier bills and payments, expenses, every journal and period, and the
   document numbers (journals start again at 1001, the café's bill numbers at
   0001, the cash sessions and refunds at 1).
3. Run it in the SQL editor with the confirmation set in the same session:
   `set sixties.reset = 'dry run';` first — it clears, checks, reports what it
   would clear and changes nothing — then
   `set sixties.reset = 'clear the test records';`. It is one transaction, and
   refuses without the confirmation, once a period is locked, or when a table
   it does not know holds records. `scripts/test-sql.sh` rehearses all of it
   on a day of test trading.
4. Then the opening balances (step 7): **Inventory → Opening stock** for each
   item before the first sale; open the drawer on the till, counting what is
   in it; and the float with **Sales → Move Cash**.
