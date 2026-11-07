# Open plans

Plans the owner has kept to decide later. Nothing here is started; each waits
for the owner's word. When the owner asks for "the unfinished plans", this is
the list.

## How to give them back: by necessity, not by number

The owner's rule (6 November 2026): when the plans are asked for, give them in
the order they should be done, the most necessary first, not in the order of
their numbers. Weigh the order again each time (what is done, what changed);
the order below is the one recommended on 6 November.

**How they are given (the owner, 7 November):** one whole plan at a time, the
most necessary first; the owner checks it and says whether it needs changing
before the next one is given. The order of whole plans: **7** (security),
**1** (Supabase), **11** (going live and what else was missing), **3** (use-by),
**8** (speed), **6** (the books), **5** (the six points), **9** (many cafés),
**10** (every business), **4** (videos in each language), **2** (selling).
Checked so far: plan 7, plan 1 (7 November).

The steps across the plans, in the order they are done:

**From now on, always: plan 11, item 7** (one change at a time on the live
system, with a short note of what changed; no new features in the first two
weeks of real use, only fixes).

1. **Plan 7, the urgent items in the owner's hands:** the second step for the
   owner and every manager; a new password and approval PIN (4096 is known).
   Minutes of work, and the largest risk today.
2. **Plan 1, the Supabase decision:** Supabase Pro (daily backups, no sleeping,
   its own computer) and Vercel Pro (the free plan does not allow commercial
   use). Backups, security, speed, going live and selling all wait on it.
3. **Plan 9's safety net:** a test copy of the system and database changes
   applied automatically, not pasted by hand. Every later step is safer for it.
4. **Plan 11, items 1 and 5: going live at The Sixty's,** with the UPS for the
   till and the router and the tested devices. From here plan 6's 2–3 months of
   real use with an outside accountant run beside everything after it.
5. **Plan 3 and plan 5 B, use-by:** set once per item, bought goods with
   use-by dates, the till warning or refusing expired stock. Food safety.
6. **Plan 7, the rest of security:** Zod, the page policy, the idle lock on
   shared tills, monitoring, the phone clock-in relay.
7. **Plan 8, steps 1–2, speed:** measure from the café, then make the slow parts
   fast (the daily brief, the alerts, the heavy reports, the sign-in check).
8. **Plan 6, the books' blockers,** with **plan 5 A**: two-currency bills;
   accounts the owner adds (banks, loans); tax as an option.
9. **Plan 5, the rest:** C packing at the till, F the cashier scorecard, E sale
   days, D the target margin.
10. **Plan 10, step 1, the foundation:** plans, switches and the type of
    business, so every part after it plugs in (with the selling plan's section
    on plans for small and big cafés).
11. **Plan 9, the rest of running many cafés:** one shared system, the owner's
    admin console, "report a problem", support access with permission.
12. **Plan 8, step 4:** the till that never waits for the internet.
13. **Plan 10, the restaurant parts, then the supplier parts,** each tried by a
    friendly business while it is built.
14. **Plan 6, the important items** (payroll deductions and payslips, points as
    owed, report comparisons and budgets) and **its smaller gaps.**
15. **Plan 11, item 4: what the café's customers see** (QR menu and table
    ordering, WhatsApp receipts and messages, the café's own online ordering, a
    customer screen), as switched parts.
16. **Plan 4 and plan 10, step 5:** the videos in each language, and practice,
    help and videos for each type of business.
17. **Plan 11, items 3 and 2: before selling,** an independent code review by a
    human developer, and the legal and business basics.
18. **Plan 11, item 6: sales materials** (the demo café, a website, The Sixty's
    own story).
19. **Plan 2, selling:** the founding cafés, then selling (prices not yet
    decided).
20. **Plan 8, step 5:** a closer region, only if the measurements show it.

## 1. Supabase and the café's daily use

The owner decides when (the owner, 7 November: "before selling I will upgrade
Supabase"). See docs/guides/backup-restore.md.

**Today (both on free plans):**
- Supabase Free: **no backups at all**; the project sleeps after a week without
  use; a small shared computer (the spikes of 3–5 seconds, plan 8); 500 MB of
  database (28 MB used).
- Vercel Hobby: **not allowed for commercial use**; logs kept one hour; slow
  first pages after a quiet while.

**The choices:**
- A. Stay free: fine while everything is a test; real records with no backup
  could all be lost at once.
- B. **Supabase Pro** (about $25 a month): a backup every day, kept 7 days; no
  sleeping; its own small computer; 8 GB of database and 100 GB of files;
  email support. Recommended.
- C. On top of B, later if wanted: restore to any minute (point-in-time
  recovery), an add-on of about $100 a month more; worth it once many cafés pay.
- D. With B: a **nightly copy kept outside Supabase** (for example the owner's
  Google Drive), so the books survive even a problem with the Supabase account.
- **Vercel Pro** (about $20 a month): required before any café pays; logs kept
  longer, fewer slow first pages.

**The recommendation on timing:** upgrade Supabase **before going live at The
Sixty's** (plan 11), not only before selling: from that day the books are real,
and a day's sales, stock and accounts with no backup are the largest risk.
Vercel Pro can wait until the first café pays.

**After upgrading, Claude does:** checks that the daily backup runs; a restore
drill on a copy (the guide's steps), then every three months; the nightly
outside copy (D) if chosen; plan 7 items 4–5 (leaked passwords, sign-up off,
passwords of 10 or more) with the owner; and plan 9's safety net (a test copy
and database changes applied automatically, which needs a Supabase access
token the owner creates).

**Day to day after that:** nothing for the owner; once a month a look that the
backups ran (Claude can check); every three months the restore drill.

**The owner's decisions (7 November 2026):** agreed; the upgrade **only before
selling** (little technical work, kept for later). **D: the owner sees to it**
(useful before and after the upgrade: a copy outside Supabase, kept longer than
Pro's 7 days). **C: kept until there are many cafés; the owner says when.** Noted: going live at The Sixty's (plan 11) comes before
selling, so the real books would have no Supabase backup until then; D can run
on the free plan too and would cover that time.

## 2. Selling the system to other cafés

docs/SELLING_PLAN.md: each café's own data, a new café setting itself up,
the brand, how to charge, support, and plans for small and big cafés (one
system, parts switched per café). Decide questions 1, 3 and 4 first, then
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

**The owner's decisions (7 November 2026):**
- 1. The second step: set up when everything is finished and the system is
  ready to sell.
- 2. The password and PIN: the owner changes them later; keep reminding.
- 3. The accounts' second step: at selling time.
- 4. Backups: with the Supabase upgrade before selling.
- 5. Leaked passwords, sign-up, password length: later, with 4.
- 6, 7, 11: explained; none slows the system (Zod 4 checks faster than Zod 3; the
  page policy is a header the browser reads, and the signed-in pages are made
  fresh already; a fixed search_path and moving citext change no speed);
  **to be fixed** (the owner, 7 November).
- 12. Sales kept offline: **to be fixed** (the till shows how many wait to be
  sent and warns before signing out or closing; the manager is told when a till
  has kept sales too long; what is kept is encrypted on the device).
- 8. Phone clock-in: the phone must be **near the shop or inside it** (its
  location, within a distance the owner sets); **not** tied to the shop's Wi-Fi.
- 9. Alerts: **to be fixed** (error monitoring, uptime checks, many failed
  sign-ins, a sign-in from a new country).
- 10. The idle lock on shared tills: **optional, switched on or off** in
  Settings (with the minutes).

## 8. Speed: as fast as possible, staying on Supabase and Vercel (6 November 2026)

**Decision so far:** no physical server at the café. It would be fast inside the
café, but brings power cuts, a disk with no backup, no access from home or the
phone, branches that cannot see each other, and an IT job at every café sold to.

**What was measured (live, read-only, 6 November):**
- The database (Supabase, eu-central-1) and the app (Vercel, fra1) are both in
  Frankfurt: a few milliseconds apart. Iraq to Frankfurt adds about 0.1–0.2 s a
  request.
- The till is quick: a sale 0.06–0.17 s in the database, the menu about 0.05 s,
  open bills about 0.04 s.
- The slow parts:
  - `daily_brief` 0.6 s on average, 5.5 s at worst; `current_alerts` 0.5 s, 3.7 s
    at worst; both run each time the dashboard opens.
  - `report_reconciliation` 0.24 s (3.1 s at worst), `report_sales_analysis`
    0.14 s (3.0 s at worst), `menu_costing` 0.11 s (1.7 s at worst),
    `report_purchasing`, `report_purchases`, `period_close_checklist`,
    `report_staff`, `report_profit_and_loss_by_place` 0.2–0.3 s each.
  - The spikes of seconds come from the free plan's small shared computer.
  - Free plans: Supabase sleeps after a week unused; Vercel starts cold after a
    quiet while (0.5–2 s on the first page).
  - The middleware checks the sign-in before every page, and for anyone without
    a second step it asks about it again, which can be a trip to Frankfurt each
    time.

**The plan, in order:**
1. **Measure from the café.** A small Speed page: the trip from the device to
   the app, the app to the database, and each function's time on the page just
   opened (Server-Timing), saved so the owner can send it. The owner says which
   screens feel slow and how many seconds.
2. **Make my slow code fast (free).**
   - The daily brief and the alerts worked out every few minutes in the
     background (pg_cron) and kept; the dashboard reads what was kept, at once.
   - The heavy reports looked at one by one (indexes, fewer passes over the
     sales); their figures for closed days kept, not worked out again.
   - The sign-in check: the newer signing keys, so the token is checked on the
     spot without a trip; the second-step question asked once a session, not on
     every page.
   - Every page loads its data in parallel, shows its frame at once and fills in
     (loading states), and links fetch the next page ahead.
3. **Paid plans (with plan 1):** Supabase Pro (about $25 a month: no sleeping,
   its own computer, daily backups) and Vercel Pro (about $20 a month: far fewer
   cold starts). Removes the random spikes.
4. **A till that never waits for the internet.** Every till action (tables,
   discounts, customers, dollars, refunds) done on the device at once and sent
   to the cloud in the background, with the database still checking each one as
   it arrives. Local-server speed for the cashier, and the till keeps working
   when the internet drops. The largest piece of work; it matters most for
   selling to other cafés.
5. **A closer region (Vercel Dubai, and a Supabase region near it) only if the
   measurements show it.** Iraqi traffic often goes through Europe anyway, and
   moving the database means a new project.

**Recommended:** 1 and 2 first (free), 3 with the Supabase decision, then 4.

**Why the cloud, not a server in the café (recommended 6 November 2026):**

| | Supabase + Vercel (paid) | A server in the café |
|---|---|---|
| The cashier's speed | Fast once the till works offline (step 4) | Very fast inside the café |
| From home or a phone | The same everywhere | Slow or impossible unless opened to the internet (a risk) |
| Power cuts | Not affected | Down with the power; needs a UPS and generator; data can be damaged |
| Backups | Daily, by themselves (Supabase Pro) | Someone does them and tests them, every day |
| A broken machine | Theirs, replaced in minutes | Ours: days without the system |
| Security updates | Done for us | We patch the server, the database and the network |
| Branches | All see the same books at once | Each still reaches the server over the internet |
| Selling to other cafés | Set up in minutes; one update reaches all | A server to install, visit and repair at each |
| Cost | About $45 a month ($25 Supabase Pro + $20 Vercel Pro) | About $800–2,000 at first (PC, UPS, backup disk), then time and repairs |

**What staying on the cloud needs, in order:**
1. Supabase Pro: its own computer (no spikes of seconds), no sleeping, daily
   backups (which plan 7 needs anyway).
2. Vercel Pro: far fewer cold first pages, and logs kept longer for finding
   problems.
3. Step 2 above: my slow code made fast (free).
4. Step 4 above: the till that never waits for the internet.
5. Monitoring: the owner told when the site is down or errors appear (with
   plan 7, item 9).
6. A second internet line at the café, such as a 4G router, so the books sync
   when the main line is down (cheap; covers most outages).

**When a server in the café would be chosen instead:** only where the internet
is down for days, not hours, or a law requires the data to stay in the
country. Nothing in the system ties it to the cloud: the database can be moved
later if that ever happens.

## 9. Running many cafés: support, maintenance and people (6 November 2026)

The owner is not a software engineer. The aim: most problems never need one.

**Honest answer:** with the first 3–10 cafés, the owner and Claude can run it,
if the system is built so most problems never need an engineer. From the first
paying café there should still be one human developer on call (freelance, a
small retainer). Later, people are hired, mostly from cafés, not engineers.

**The kinds of work, and who does each:**

| Work | How often | Who |
|---|---|---|
| Selling and setting up a café | Each new one | The owner, with a setup wizard (details, menu imported from Excel, staff invited); practice mode, help and videos already exist |
| Training staff | Each new one | The app (practice, ? help, videos) and the owner's one-hour visit or call |
| "How do I…?" | Daily at first | The owner with the help pages; later a support person |
| The café's own mistakes | Weekly | The café, in the app (every correction exists); the owner guides |
| A real bug | Sometimes | Claude: the owner sends a screenshot and what happened; fixed, tested, sent; every café gets it at once |
| Supabase or Vercel down | Rare | No one can fix it; wait; the offline till sells (plan 8); the owner tells the cafés |
| Printers, tablets, drawers, internet | Often | A local hardware technician as a partner; a list of tested devices |
| Accounting questions | Monthly | A partner accountant |
| A security problem | Rare | Claude and the backup developer, with a written playbook |

**What could go wrong, and how it is handled:**

| Problem | What is done |
|---|---|
| A till cannot sell | It sells offline (plan 8); answered within 15 minutes; system or their internet checked |
| An update breaks something | Every change through the full tests and a test copy first; Vercel rolls back in one click (the owner can) |
| A café spoils its data | Nothing is truly deleted; corrections by reversal; daily backups (Pro) |
| Someone's account hacked | Deactivated in People; two-step and the audit trail show what they did |
| The owner's Supabase or Vercel account locked or hacked | Two-step on everything; a second trusted person with emergency access |
| The owner sick or away | The support person and the backup developer have written steps and access |
| Claude makes a mistake in code | Tests catch most; nothing untested is pasted; rollback undoes the rest |
| A café disputes a figure | "Do the books tie?" and the audit trail show who did what, when |
| A café wants its own feature | If every café gains, built for all (behind a switch); if not, no, or charged for |
| A café stops paying | Read-only, then closed; they can export their data |

**What to build before selling, so it stays manageable:**
1. One shared system for all cafés (below).
2. Database changes applied automatically, not pasted by hand into each.
3. A test copy of the system: every change tried there first.
4. The owner's admin console: every café on one page (last sale, errors, internet
   trouble, payments, who needs help).
5. "Report a problem" reaching the owner with the screen, the time and the error.
6. Support access only with the café's permission, recorded.
7. Monitoring: the owner told before the café calls (plan 7 item 9, plan 8).
8. Backups and restoring one café (Supabase Pro).

**People, step by step:** now the owner and Claude; before the first paying café
a freelance developer on a small retainer (Next.js and Supabase), a partner
accountant and a local hardware technician; at about 10–20 cafés a support person
who has worked in cafés; at about 30–50 a full-time developer.

**Day to day:** one WhatsApp Business number plus the in-app reports; three levels
of urgency (cannot sell: 15 minutes; a wrong figure: the same day; a question:
within a day); updates once a week with a short "what's new" to all cafés; a
written agreement with each café (what is supported, response times, who owns
the data, limits of responsibility); start small (the owner's café 2–3 months,
then 2–3 friendly cafés at a discount for 2–3 months, then sell).

**Claude's limits:** works only when a session is open (no 2 a.m. calls, no
watching alone: hence monitoring and the backup developer); remembers only what
is written in the project between sessions (hence these plans); can make
mistakes (tests catch most; a human developer can check in an emergency). Every
account in the owner's name, with two-step, and a second trusted person with
emergency access.

**The four questions answered (6 November):**

1. *Separate systems per café, or one shared?*
   - Separate: one café can differ, a problem cannot spread, data is easy to hand
     over; but every update is done once per café, the copies drift apart, each
     bug is fixed several times, it costs more, and someone must remember who
     has which version.
   - Shared: one update reaches every café, one place to watch, back up and
     support, the cheapest, and already built so (every record carries its café;
     the database refuses one café another's data); but a bad update reaches all
     (hence the test copy and rollback), an outage reaches all (the offline till
     sells), a very large café could slow others (a bigger plan, or moved out),
     and one café's data is removed by a script.
   - **Recommended: shared.**
2. *In a shared system, can one café be changed and not the others?* Yes, as
   settings, not separate code: settings per café (most differences already are);
   feature switches per café (built for all, on only where asked); and a pilot
   group that gets a new version a few days before the rest. Not code for one café
   alone: make it a switch, or charge for it.
3. *Paid once or per café?* Shared: once, growing with use, not with the number
   of cafés. Supabase Pro about $25 a month (a small database computer, 8 GB of
   database, 100 GB of files, daily backups), its computer raised as cafés grow
   (Small about $15 more, Medium about $60 more); Vercel Pro about $20 a month per
   person on the team, not per café. **Vercel's free plan does not allow
   commercial use: Pro before any café pays.** Separate: about $10 or more per
   café per month more for each Supabase project. About $45–60 a month up to ten
   cafés, $60–110 for 10–30, $110–200 for 30–60 (prices to be checked on the
   pricing pages before deciding).
4. *Will they run out of space?* No, for years. The live database is 28 MB today,
   mostly the system itself. A sale with everything it records is about 5–10 KB:
   a busy café (300 bills a day) about 0.5–1 GB a year; 20 busy cafés 10–20 GB a
   year (8 GB included, then about $0.125 a GB a month). Photos and documents are
   10 MB at most, usually 0.2–1 MB: 100 GB is about 100 café-years. Vercel's
   allowance (about 1 TB a month on Pro) is far beyond what tills and reports use.
   The real limit is the database computer's speed, raised a step at a time.

## 10. One flexible system for every business (6 November 2026)

The owner's decision: build one system that works for cafés, bakeries,
restaurants and suppliers, made complete for all of them; at selling time,
parts are only switched on or off. Configure, never customise.

**It does not spoil what is built, by these rules:**
1. New parts are new (tables, functions, screens beside the old); nothing
   existing is rewritten for them, as with every migration so far.
2. Everything new starts switched off: The Sixty's keeps working as today.
3. Every change passes all the tests before it goes live (1,020 unit tests,
   75 browser suites, 93 database tests).
4. The three changes that touch the core are known: selling stock items
   directly (the sale engine), station printing (printing), price lists per
   customer (pricing). For each, today's behaviour stays the default, with
   extra tests.

**What "no more updates" can mean:** no system goes without updates (bugs, laws
and tax, devices, platform files, requests). The aim: about 90% of what a new
business needs is switches and settings, no code; the other 10% is built once,
for everyone, behind a switch; never a version for one customer.

**What fits today:** cafés with a kitchen, fast food, casual restaurants and
bakeries (tables, open and split bills, split payments, sizes and add-ons,
deals, time prices, service charge, tips, recipes and costing, production,
use-by, delivery platforms, pre-orders, branches and a central kitchen,
approvals, offline sales); and much of a supplier (stock by place, transfers,
counts, purchasing, suppliers, returns, batches, barcodes, selling by weight,
wholesale customers on account with limits, terms, invoices and payments
(0077), full books).

**Missing for a full-service restaurant:**
- a kitchen screen, or printers per station (grill, cold kitchen, bar): today
  one ticket prints on the till's own printer;
- waiters ordering on their phones at the table;
- courses (starter, main, dessert), each sent when it is time;
- moving and joining tables, seat numbers;
- reservations and a waiting list;
- a menu engineering report (what sells well and earns well) as one report.

**Missing for a supplier or a business with inventory only:**
- selling stock items directly (today all that is sold is a menu product);
- a price list per customer (today only a percentage off the menu);
- quotes and sales orders before the invoice;
- delivery notes, drivers and routes;
- customer returns and credit notes for wholesale;
- selling by the carton or case;
- use-by for bought goods (plan 5 B);
- a setup with no till at all;
- tax on invoices (plan 6).

**How they fit the plans:** two choices for each business, by the same switches:
1. The type of business, chosen at setup, deciding what is shown by default:
   Café (as today); Bakery (café, production, wholesale on account);
   Restaurant (café, kitchen screens, waiter phones, courses, reservations);
   Supplier (stock, purchasing, wholesale sales, delivery notes, the books;
   no till, tables or menu screens).
2. The size of plan (Starter, Complete, Business: the selling plan), deciding
   how much of that type, and how many branches or warehouses.
The books, the security and the updates are the same for all.

**The order to build it:**
1. The foundation: plans, switches and the type of business.
2. The base every business needs: plans 3, 5, 6, 7, 8 and 9.
3. The restaurant parts.
4. The supplier and wholesale parts.
5. Practice tasks, help and videos for each type of business.

**The caution:** building everything first is a long time with no income and no
real users of the new parts. The middle path: the foundation first, then each
part tried by one friendly restaurant and one friendly supplier, for free, while
it is built. Everything is still built before selling.

## 11. What the other plans did not cover (6 November 2026)

1. **Going live at The Sixty's** (the real start of everything; the other plans
   say "run 2–3 months with real money" but not how to change over safely):
   - a date: a quiet day at the start of a month, so the first month's books are
     clean;
   - the test records cleared, keeping the set-up (`supabase/remediation/
     start-fresh.sql`);
   - opening balances on day one: the till's and the safe's cash, the bank, a
     full opening count of every item (or the first sales are costed at
     nothing), what is owed to suppliers, the equipment;
   - each person's own login, practice finished before day one, the second step
     for managers;
   - two weeks with the old way kept beside it, the day's sales and cash
     compared each day;
   - a daily checklist for the first month, and the first month's close checked
     with the accountant.
2. **Legal and business basics before selling:** the company registered; the
   system's name and brand registered; terms of service (what is included, who
   owns the data (the café), the limits of responsibility, cancelling); a
   privacy policy (customers' phone numbers, staff details and pay: what is
   kept, why, for how long); how long the law asks records to be kept (the
   accountant says; the system deletes none); professional liability insurance
   where it can be had.
3. **An independent code review by a human developer** (a week or two), besides
   plan 7's penetration test: someone other than Claude knows the system, finds
   what was missed, and starts as the backup developer of plan 9.
4. **What the café's customers see** (what often wins the sale): a QR menu and
   ordering from the table; receipts, points, offers and birthdays by WhatsApp;
   the café's own online ordering for pickup and delivery (no 20–30%
   commission); a customer screen at the till. Parts behind plan 10's switches,
   and good add-ons to charge for.
5. **A tested hardware kit:** a short list of devices tried with the system
   (receipt printer, cash drawer, barcode scanner, label printer for batches and
   use-by, tablet, kitchen printer), sold as a kit with setup at a margin; a
   small UPS for the till and the router (power cuts).
6. **Sales materials:** the practice café as the demo; a simple website with
   short videos in three languages; The Sixty's own story after going live, in
   real numbers.
7. **Discipline while building:** no new features in the first two weeks of real
   use, only fixes; one change at a time on the live system, with a short note
   of what changed. From now on.

**Beyond the eleven plans:** `docs/LIMITATIONS.md` lists many small "what it does
not do" points for each part (most minor; the large ones are in plans 6, 7 and
10). They are weighed when that part is worked on, and real use after going live
will add new ones.
