# The plan to 100%

Agreed with the owner on 20 October 2026. Three stages, in this order. Each
round is published as soon as its tests pass (the owner's standing rule); the
owner pastes any database migration in Supabase's SQL editor, as before.

## Stage 1 — Fill the gaps

| Round | What                                                                                                                                                                                                                                | Migration                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| G1    | **Table bills without internet.** An open bill keeps taking orders while the internet is down, and is sent when it is back, once, with the same key — as quick sales already are.                                                   | none expected              |
| G2    | **Speed under a real rush.** A heavy test on a copy (never the live data): several tills selling many items a minute; every live screen timed, read-only. What is slow is made fast, until a sale takes well under a second.        | only if an index is needed |
| G3    | **Branches in the books.** Stock sent between branches at cost, or cost plus a percentage the owner sets, so each branch's profit is right; a balance sheet for each branch beside the café's total. No tax (the owner's decision). | yes                        |
| G4    | **Test your devices.** One page before opening: a test receipt and label, the cash drawer, a barcode scan, the scale, the internet and the phone warnings; each problem in plain words with what to do.                             | none                       |
| G5    | **"Something's wrong" button** on every screen: a word or two from whoever taps it, kept with the screen and what they were doing; the owner sees the list and can send it on.                                                      | yes                        |

## Stage 2 — Clear the data

The owner runs `supabase/remediation/start-fresh.sql` in Supabase's SQL editor
(the steps are sent when Stage 1 is done). It keeps the logins and the chart
of accounts; everything else starts empty.

## Stage 3 — Run the business, then write the guide

1. **Run it as the owner** of a coffee shop and a bakery, on the live site,
   from an empty system: branches and sections, staff and roles, stock items
   and suppliers, recipes written from scratch (breads, cakes, gelato, coffee
   drinks), the menu with sizes, add-ons, photos, barcodes and weighed items;
   buying, deliveries, production and use-by dates; every way of selling
   (quick sales, tables, split payments, dollars, offline, pre-orders,
   wholesale on account, end-of-day markdowns); refunds, voids, waste, counts
   and transfers; staff hours and payroll; expenses, the bank, equipment, the
   owner's money, closing the day and the month; every report; two-step
   sign-in. Every feature is ticked off a checklist; what does not work is
   fixed and published. Everything entered stays (the owner's decision).
2. **The guide**, in English first: a real screenshot of every page, grouped
   by category; for each category how many features it has, how to use each
   one step by step, and what it is for.

Then the owner's trial of one to two weeks in one shop, with the "Something's
wrong" button, and the end-of-day check against the counted cash and the card
machine each evening.

## What cannot be tested from here

Physical devices: a printer printing, a scanner scanning, a scale weighing, a
warning reaching a phone. The pages and what they send are tested; the devices
themselves are checked in the shop with **Test your devices** (G4).
