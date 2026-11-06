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
