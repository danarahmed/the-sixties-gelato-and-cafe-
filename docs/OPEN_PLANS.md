# Open plans

Plans the owner has kept to decide later. Nothing here is started; each waits
for the owner's word. When the owner asks for "the unfinished plans", this is
the list.

## 1. Supabase and the café's daily use

The owner decides when to talk about it: the plan (Free has no backups; Pro
keeps a daily copy for seven days), a nightly copy kept elsewhere, and
running the café on it day to day. See docs/guides/backup-restore.md.

## 2. Selling the system to other cafés

docs/SELLING_PLAN.md: each café's own data, a new café setting itself up,
the brand, how to charge, support. Decide questions 1, 3 and 4 first, then
one or two friendly cafés.

## 3. Use-by: two gaps (4 November 2026)

What is made on Production has a use-by, a label, warnings (orange within a
day, red past it, on the Dashboard and the phone), oldest sold first, and
markdowns suggested. Two gaps:

1. **The till sells a batch past its use-by without a word** when it is all
   that is left. To decide: the till **warns** the cashier, or **refuses**
   unless a manager approves.
2. **No use-by without a shelf life.** A recipe's "how long it keeps" is
   optional, so a batch of it has no use-by and no warning; bought goods
   (milk, croissants) have none at all. To decide: make the shelf life
   required on recipes, and give a delivery's lines an optional use-by.

## 4. The practice videos in each language (4 November 2026)

The videos of the practice tasks were recorded with the app in English; in
Arabic or Kurdish only the captions change, and the screens in the video stay
English. The fix: record each video three times, with the app in English,
Arabic and Kurdish (right to left for the last two), and play the one in the
person's language, its captions with it. About 11 MB in all instead of 4.
tests/e2e/videos.e2e.mjs already records them; it needs the language set
for each run, and src/lib/help/videos.ts a file per language.

## 5. Six points from the owner (6 November 2026): what exists, what to build

The owner chooses which to do first; then all six are done in turn.

**A. A supplier bill in dollars and dinars.**
Today: dollars exist only at the till (0043): a daily rate set by a manager with
a reason, a dollar drawer, exchanges, and differences to 6950. Bills and supplier
payments are in dinars only.
Plan: a bill can owe part in USD and part in IQD. The books stay in dinars; the
dollar part is turned into dinars at the day's rate when the bill is booked (so
stock and costs are in dinars), and the dollar amount is kept beside it. The
supplier's balance shows both: "owes $300 + 450,000 IQD". A payment in dollars
comes from the dollar drawer or safe; any change in the rate between the bill and
the payment goes to 6950 Exchange differences. Ageing, statements and the payables
report show both currencies.

**B. Use-by set once, for made and bought goods.**
Today: a batch's use-by comes from its recipe's shelf life, set once on the recipe.
Bought stock has no use-by (`item.track_expiry` exists but is unused;
`item.keeps_days` is for buying quantities only).
Plan: on each item, "Goes off: keeps N days from delivery" (set once; cups and
sugar left off). On delivery every lot gets its use-by from it, and the person can
change it when the package shows another date. Then everything bought has the same
alerts, phone warnings, first-to-expire order and waste report as batches. With
plan 3: the till warns (or refuses, the owner's choice) when an expired lot would
be sold.

**C. Packing counted at the till.**
Today: a recipe line can apply to one channel only (a cup for takeaway), and add-ons
can carry stock. Neither fits a bag that holds one thing or five.
Plan: the owner sets a Packing list once (small bag, big bag, cup carrier, box),
each linked to a stock item, free or charged. The pay screen shows a Packing row
with big + and − buttons; for takeaway and delivery it starts at one small bag,
changed with one tap; dine-in starts at none. The stock is taken and its cost goes
to the sale's cost. Cups and lids stay in recipes (one per drink). A report shows
packing used per day and per order, and by person.

**D. Cold brew: the bottle in its cost.**
Today: this already works. A recipe line can be any stock item, packaging included
(a bottle, a cap, a label); the cost on Menu costing is the concentrate (a batch)
plus the bottle, cap and label, and the margin is the price less that cost.
Plan (small): a target margin per product or category, a suggested price from it,
and a warning when a cost rise (the bottle's price) takes a product below its target.

**E. A sale day for everything.**
Today: markdowns on near-expiry batches (0079), time prices per size (0089),
deals, and a cashier's discount with a reason. There is no café-wide sale.
Plan: the owner sets "N% off, from this day to that day" (hours optional), for all
items or with some categories left out. The till shows a banner and the new
prices; the receipt shows the saving; reports show full price and the discount
apart. It ends by itself. It does not add on top of another discount: the bigger
one wins.

**F. Comparing cashiers.**
Today: Sales analysis by "Who took the money"; each drawer's over or short; the
exceptions (voids, refunds, discounts) by person; the watch list; tips.
Plan: one Cashier scorecard for a period: sales, bills, average bill, items per
bill, add-ons per bill, sales per hour worked (from the clock), voids, refunds and
discounts, and drawer over or short. Ranked fairly: per hour worked and against
the same hours of the day, since a Friday evening sells more than a Tuesday morning.

## 6. The books: every gap before they are guaranteed to anyone (6 November 2026)

What the books already do is strong (double entry posted by every record, nothing
edited, months locked, the year closed, stock at average cost with the cost of
each sale, waste, count and price differences on their own accounts, cash
sessions, cards, platforms, the bank, prepaid expenses, equipment, payroll, tips,
deposits, customer and supplier accounts, and "Do the books tie?"). What is
lacking, in the order it matters:

**Blockers (before the system is guaranteed to a customer):**
1. **Never run with real money.** Every record is a test. Run the café on it for
   2–3 real months, close each month, and have an outside accountant check the
   trial balance and balance sheet against the bank statement, the safe and a full
   stock count.
2. **No backups.** The free plan keeps none, and no restore has been drilled (with
   plan 1, the owner's call).
3. **Supplier bills in dinars only.** Bills and payments in dollars, or both
   (plan 5 A).
4. **Balance-sheet accounts added only by a migration.** The owner cannot add a
   second bank account, a loan, or another asset or debt; there is one bank
   (1020) and no loan account. Plan: add them from Chart of Accounts, placed by
   their kind; more than one bank, each reconciled; loans with their repayments
   and interest.
5. **No tax.** Out of scope by request. Plan: tax as an option per café (sales tax
   or VAT on sales, tax on purchases where it is claimed back, the rate set by the
   owner, a tax report for each period).

**Important (a customer can start without them):**
6. **Payroll:** no deductions the law asks for (social security and the like)
   worked out; no payslip; no leave, holidays or sick days; overtime only by the
   day.
7. **Loyalty points** are a discount when taken, not a liability while held.
   Plan: book points as owed as they are earned (optional, per café).
8. **Cards and platforms typed by hand:** totals come from the terminal's report,
   the bank's file or the platform's statement; nothing from the bank or the
   platform itself (Talabat needs a partner account).
9. **Reports:** no comparison with last month or last year, no budget against
   actual, no cash flow by the indirect method, no notes; a year of dates at most
   for the cash flow and the analysis.
10. **No monitoring:** no error alerts or uptime checks, and no channel for alerts
    or the daily brief (WhatsApp and email chosen, not set up).
11. **Smaller gaps:**
    - a supplier's refund in cash needs a journal by hand;
    - no back-dated supplier credits; a bill is dated no earlier than its delivery;
    - one dollar only, at a rate typed by a manager; dollars are not revalued at
      month end;
    - money moved through the till or the safe is dated the day it moves;
    - a prepaid expense is changed only by cancelling it and recording it again;
      a month's share is a whole month, released by a press, not by itself;
    - a payroll is shared between places by where people work, not their hours;
    - an approval limit on purchase orders by total only, with no second approver.

**Before selling:** do not promise a "guarantee" in absolute words. Promise what is
true (every record double-entry, balanced, locked and traceable), back it with
support, and have a lawyer write the terms (with plan 2).

## 7. Security: every gap found (6 November 2026)

Checked: the code, and the live database read-only (its grants, row-level
security, storage rules, users, and Supabase's security advisors). Not done:
an attack on the live site; that needs the owner's word or an outside tester.

What holds: no one signed in can write to a table; row-level security is on
for every table; each of the 332 functions a signed-in person can call checks
their permission first; a stranger who signs up sees nothing; a second step,
once turned on, is enforced by the database itself; approval PINs are hashed
and lock after five wrong tries; records are never edited or deleted; files
are private by café; the six functions open to the public each need a key
kept as a hash; practice only lowers what a person can do; no secret is in
the code or its history; no service-role key is used.

**Done on 6 November:** Next.js 15.5.26 → 15.5.29 (a critical hole in its
image service and a Server Actions crash), sharp 0.35.5, PostCSS 8.5.32 (made
the version Next uses), source-map-js 1.2.2.

**Urgent (the owner's own hands):**
1. Turn on the second step for the owner and every manager: none of the 6
   users has one (checked 6 November).
2. Change the owner's password and the approval PIN 4096: both have been
   written in chats.

**High:**
3. A second step and strong passwords on the Supabase, Vercel, GitHub and email
   accounts: each one opens everything, outside the app's controls.
4. Backups (with plan 1): nothing can be restored today.
5. Leaked-password protection is off (Supabase Auth; may need the paid plan).
   Open sign-up off; passwords of 10 characters or more (Supabase settings, not
   readable from here).
6. Zod 3 can be made to use up memory by a huge input (fixed in 4.6.6, a major
   version: every form's checks are retested).

**Medium:**
7. The page policy (CSP) limits framing and plug-ins but not scripts: add
   `script-src` with a nonce for the two inline scripts, and `connect-src` to
   the café's Supabase address.
8. Phone clock-in can be relayed: a colleague at the shop sends the six-digit
   code to someone at home. Add a check that the phone is on the shop's Wi-Fi
   or near the shop (the owner chooses), and flag clock-ins far apart in time
   from the screen's code being shown.
9. No alerts: no error monitoring, no uptime checks, no warning of many failed
   sign-ins or of a sign-in from a new country.
10. Shared tills stay signed in: an idle lock that asks the cashier's PIN after
    a few minutes, so a sale is never rung up under someone else's name.

**Low (tidying):**
11. 43 helper functions without a fixed `search_path` (none runs with raised
    rights); `citext` in the public schema.
12. Sales kept offline stay in that browser until sent.

**Before selling:** an outside penetration test by a security firm, and its
report kept for customers' IT people.
