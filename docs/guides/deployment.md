# Deployment Runbook

How to put this version live. It replaces an app that let anyone holding the
public key read and write the books; after this, nothing is reachable without
signing in, and the database itself enforces who may see and do what.

**The migrations and the new app go live together.** Migration `0016` removes
every write permission the old app relied on, so the old till stops recording
sales the moment it is applied; the new app needs `0014`–`0017` to work at all.
Plan a short window when the café is closed.

## Where the live system stands (25 September 2026)

| Step                           | Status                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. The old history             | ✅ Cleared: it was trial data                                                                                                                                                                                                                                                                                                                                                            |
| 2. The Vercel settings         | ✅ Added by the owner                                                                                                                                                                                                                                                                                                                                                                    |
| 3. Migrations `0014`–`0017`    | ✅ Applied on 23 September, then compared with the tested build object by object: functions, tables, rules, indexes, triggers and permissions are identical. The public key has no access                                                                                                                                                                                                |
| 4. The new app                 | ✅ Merged for production ([pull request #1](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/1)) and deployed                                                                                                                                                                                                                                                             |
| 5. Sign-in settings            | ✅ Set                                                                                                                                                                                                                                                                                                                                                                                   |
| 6. The owner's first sign-in   | ✅ 23 September                                                                                                                                                                                                                                                                                                                                                                          |
| The till update (`0018`)       | ✅ Migration applied on 24 September and compared object by object with the tested build: identical. The screens were merged ([pull request #2](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/2)) and deployed (see [After `0018`](#after-0018))                                                                                                                       |
| Discounts (`0019`)             | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back. The screens were merged ([pull request #3](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/3)) and deployed (see [After `0019`](#after-0019))                                                          |
| Discount rounding (`0020`)     | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back. The screens were merged ([pull request #4](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/4)) and deployed. The step was then set to 250 IQD at the owner's request (see [After `0020`](#after-0020)) |
| Bill numbers (`0021`)          | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back (see [After `0021`](#after-0021)). The form was merged ([pull request #6](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/6)) and deployed                                                              |
| Recipe costing (`0022`)        | ✅ Migration applied on 24 September, compared object by object with the tested build (identical) and checked as the owner in a transaction that was rolled back (see [After `0022`](#after-0022)). The form was merged ([pull request #8](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/8)) and deployed                                                              |
| Production (`0023`)            | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0023`](#after-0023)). The screens were merged ([pull request #9](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/9)) and deployed                                    |
| Counts and the drawer (`0024`) | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0024`](#after-0024)). The screens were merged ([pull request #10](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/10)) and deployed                                  |
| Prices, bills, costs (`0025`)  | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner in a transaction that was rolled back (see [After `0025`](#after-0025)). The screens were merged ([pull request #11](https://github.com/danarahmed/the-sixties-gelato-and-cafe-/pull/11)) and deployed                                  |
| Reports that agree (`0026`)    | ✅ Migration applied on 25 September, compared object by object with the tested build (identical, permissions included) and checked as the owner against the live records (see [After `0026`](#after-0026)). The screens follow by pull request                                                                                                                                          |

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

## Clearing the test records

Every record of trading in the live database so far is a test (the owner, 25
September 2026). They are cleared **when the owner says so**, and not before,
with [`supabase/remediation/reset-test-data.sql`](../../supabase/remediation/reset-test-data.sql):

1. It keeps the business and its locations, the chart of accounts, the people
   and their roles, the menu (products, variants, categories, photos, prices,
   recipes), the stock items and their units, suppliers, tables, and the audit
   trail, which gains one line saying what was cleared.
2. It clears sales, open bills, voids and refunds, drawer counts and cash
   moved, stock movements, counts and batches, deliveries, supplier bills and
   payments, expenses, every journal and period, and the document numbers
   (journals start again at 1001, the café's bill numbers at 0001).
3. Run it in the SQL editor with the confirmation set in the same session:
   `set sixties.reset = 'dry run';` first — it clears, checks, reports what it
   would clear and changes nothing — then
   `set sixties.reset = 'clear the test records';`. It is one transaction, and
   refuses without the confirmation, once a period is locked, or when a table
   it does not know holds records. `scripts/test-sql.sh` rehearses all of it
   on a day of test trading.
4. Then the opening balances (step 7): **Inventory → Opening stock** for each
   item before the first sale, and the float with **Sales → Move Cash**.
