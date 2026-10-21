# The smarter café — plan

Chosen by the owner on 21 October 2026 from the ideas after the live run:
**2 · spotting problems people hide**, **3 · smarter buying**, **5 · cash
planning**, **6 · the Monday brief**. Not started: it begins when the owner
says _start_.

Every part works from the café's own records, with rules and plain
statistics — no outside AI service, no monthly cost. Each says how sure it
is, learns from the café's own trading as it grows, and is first proven on a
copy with a simulated year (below) before it advises anyone.

---

## How each is proven before it is trusted

1. **A simulated year on a copy** (`sixties_load`, built for G2: 110,000
   sales), given a life: busy Fridays and evenings, hot months, Ramadan
   evenings, Eid and Newroz; deliveries late now and then; prices that rise;
   bills and salaries due; and **planted problems** for part 2 — a cashier
   who voids too much, discounts kept just under the approval limit, a
   drawer short every Thursday.
2. **Backtests**: each feature looks only at the weeks before a week, says
   what it would have said, and is scored against what then happened —
   how many planted problems it found, how many false alarms, how close the
   cash and delivery forecasts came.
3. **A threshold to pass** for each (below). A feature that does not pass is
   tuned, not shipped.
4. Then the usual: SQL tests, unit tests, browser tests, the full suites,
   a migration the owner pastes, and a check on the live site.

---

## Part 2 — Spotting problems people hide

**What the owner gets.** A private card on the Dashboard and a page,
**Reports → Watch list**, seen by the owner (and the general manager, if the
owner allows it on Settings → Rules). Each item names the person, the
pattern, the evidence (the sales, with links), how unusual it is against
the café's normal, and how sure it is. It never accuses: it says "worth a
look", and the owner marks it _explained_ or _looked into_.

**Patterns watched**, each person against the others on the same shifts:

| Pattern                                                                               | Evidence                     |
| ------------------------------------------------------------------------------------- | ---------------------------- |
| Voids, refunds or cancelled bills far above the others                                | the sales, reasons, times    |
| Discounts just under the approval limit, again and again                              | the discounts and the limit  |
| Giveaways and staff meals above normal                                                | the items and reasons        |
| Drawer short often, or short on the same weekday or shift                             | the counts                   |
| Refunds to cash for sales paid by card, or refunds long after the sale                | the refunds                  |
| A sale voided right after the customer paid cash (sale rung, then voided)             | the pair, minutes apart      |
| Sales rung with a big gap between bills and the drawer's count (cash taken, not rung) | counts against sales by hour |
| Stock of one item missing again and again on counts, at one place                     | the counts                   |

**How.** A daily database job (pg_cron, as the phone warnings use) works out
each person's rates over 28 days against the median of everyone on the same
place and hours; a pattern is shown when it is far from normal _and_ has
enough cases to mean something. New staff are not judged in their first
week. Phone warning for the strongest only.

**Build.** Migration: `watch_findings` table, `watch_tick()` job,
`watch_list()` and `settle_watch_finding()`; rule `watch_visible_to`.
Screens: Dashboard card, Reports → Watch list. Tests: SQL (each pattern
found, nothing found on honest trading, new staff skipped, who may read
it), browser (the list, settling one, a cashier cannot open it).

**Passes when** on the simulated year it finds every planted problem within
two weeks and raises no more than one false alarm a month.

---

## Part 3 — Smarter buying

**What the owner gets.**

- **Draft orders, ready to approve.** On Purchasing, each supplier's order
  for what will run out before their next delivery could arrive: from the
  stock now, what each item uses a day (the weekday's pattern), the
  supplier's real delivery time, and a safety margin. One tap approves and
  sends it.
- **Each supplier's real delivery time**, learnt from orders against
  deliveries: "Erbil Dairy: usually 1 day, late 1 in 6."
- **The cheaper supplier**, where more than one sells an item: the price per
  base unit over the last deliveries, and which one to order from.
- **A price rise, followed through.** When a delivery comes in dearer, the
  products whose margin drops below the target are listed with the price
  that would restore it (rounded to the café's step), one tap to set it.
- **Reorder levels that learn.** A suggested reorder level for each item
  from its use and its supplier's delivery time, beside the one set by hand.

**Build.** Migration: `supplier_lead_time()` and `buying_suggestions()`
reading orders, deliveries and usage; `draft_purchase_orders()`;
`margin_after_price_change()`. Screens: Purchasing (drafts, lead times,
cheaper supplier), Price watch (the products and the new price), Inventory
(suggested reorder level). Tests: SQL (lead time from late and on-time
deliveries, a draft covers until the next delivery, a cheaper supplier
chosen, the restoring price), browser (approve a draft, set a suggested
price).

**Passes when** on the simulated year the drafts would have left nothing
out of stock and held no more than 25% extra stock on average.

---

## Part 5 — Cash planning

**What the owner gets.** **Reports → Cash ahead**: the next 30 days for the
safe, the bank, and the café as a whole, day by day, as a chart and a table:

- money expected in: the usual takings for each weekday (cash to the safe,
  cards and FIB / Qi Card / FastPay to the bank after their usual delay),
  what customers on account owe by their due dates, what platforms owe;
- money going out: supplier bills by their due dates, the draft orders,
  salaries at the month's end, rent and other regular expenses, advances
  coming back;
- a warning, days ahead, when the safe or the bank would not cover what is
  due — on the Dashboard and as a phone warning — with what to do: move
  takings to the bank, pay a bill from the other, agree a later date with
  the supplier.

**Build.** Migration: `cash_ahead(p_days)` from the ledger, due dates, the
weekday pattern of takings and the payment methods' delays; a new alert
kind `cash_short_ahead`. Screen: Reports → Cash ahead, a Dashboard line.
Tests: SQL (a bill due when the safe is short is warned of, a customer's
invoice counted on its due date, salaries at month end), browser (the
chart and table, the warning).

**Passes when** on the simulated year the forecast for 7 days ahead is
within 10% of what happened, and every real shortfall was warned of at
least 3 days before.

---

## Part 6 — The Monday brief

**What the owner gets.** Every Monday morning (07:30, Erbil time), on the
phone and on the Dashboard, in the owner's own language (English, Arabic or
Kurdish):

- **Last week in plain words:** sales and profit against the week before and
  the same week last month; the best and worst sellers; waste; labour cost
  against its target.
- **What changed from normal:** anything well above or below its usual level
  (a product selling less, a cost rising, a branch falling behind).
- **The three things to do this week**, chosen from parts 2, 3 and 5 and the
  alerts: the watch list's strongest item, the orders to approve, a cash
  shortfall ahead, a price to raise.
- A link to the full brief, which can be printed or saved as a PDF.

**Build.** Migration: `weekly_brief(p_week)` putting the week's numbers
and the chosen actions together (from the reports that already exist), a
`brief` table kept per week, a Monday pg_cron job, and a phone warning.
Screen: Dashboard card, **Reports → Monday brief** (this week and past
weeks). Words in the three languages. Tests: SQL (the numbers agree with
the reports, three actions chosen in order of what matters most), unit
(the sentences in each language), browser (the card, the page, the PDF).

**Passes when** every number in the brief agrees with the report it comes
from, and the owner reads a sample brief from the simulated year and finds
it useful.

---

## Order and size

| Step | What                                                                         | Migration |
| ---- | ---------------------------------------------------------------------------- | --------- |
| 0    | The simulated year on the copy, with the planted problems; the backtest tool | —         |
| 1    | Part 3, smarter buying (parts 5 and 6 use its drafts and lead times)         | `0088`    |
| 2    | Part 5, cash planning                                                        | `0089`    |
| 3    | Part 2, the watch list                                                       | `0090`    |
| 4    | Part 6, the Monday brief (gathers 2, 3 and 5)                                | `0091`    |
| 5    | The guide brought up to date with the new screens                            | —         |

Each step is its own pull request, tested, published, its migration pasted
by the owner, then checked on the live site and reported in English and
Kurdish, as before.

## What it does not do

- It does not act alone: drafts wait for approval, prices wait for a tap,
  the watch list only says "worth a look".
- It does not judge from little: a pattern needs enough cases, and new
  staff and new items are given time.
- It is only as good as what is recorded: the more of the café's day goes
  through the system, the better it learns.
