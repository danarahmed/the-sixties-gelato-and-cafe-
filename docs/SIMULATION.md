# The simulated year

Step 7 of [SMART_PLAN.md](SMART_PLAN.md): a year of an Erbil café, lived on a
copy of the database, so the smart parts (smarter buying, cash ahead, the
watch list, the Monday brief) are proven before they advise anyone. It never
touches the live database.

## How it is made

A second PostgreSQL server runs under **libfaketime**, so its clock can be set
to any moment. The year is lived day by day through the café's own functions
(the same ones the app calls), each sale at its own hour, by the person whose
shift it is. The books, the stock and every report agree as they would in a
real café, and the café's own rules apply: a sale of something run out is
refused, a void needs a reason from the list.

| File                        | What it does                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/sim/run.sh`        | Starts the clock-controlled server (port 5433), copies the test template into `sixties_sim`, ages it a year, sets the café up, lives the year.                            |
| `scripts/sim/age.sql`       | Moves every date of the starting café back 400 days, so its menu, prices and recipes are in place a year ago (each month's books in its own period).                      |
| `scripts/sim/setup.sql`     | `sim.at` (the clock), and the habits a day leans on: deliveries, the kitchen's batches, closing a drawer, banking the safe, the card money, paying bills, a sale, a void. |
| `scripts/sim/cafe.sql`      | The café on the eve of its year: its people and their pay, suppliers and prices (and the rises to come), the opening money, the answer key.                               |
| `scripts/sim/year.py`       | The year itself, written as SQL. Deterministic: the same seed, the same year.                                                                                             |
| `scripts/sim/baselines.sql` | The simplest rules each feature must beat.                                                                                                                                |
| `scripts/sim/backtest.py`   | Replays the year week by week and scores a feature (or its baseline) against what happened and against the answer key.                                                    |

```sh
sudo apt-get install faketime                    # once
scripts/test-sql.sh tests/sql/smoke.test.sql     # (re)builds the template
scripts/sim/run.sh                               # about 40 minutes
SIM_DB=sixties_sim_drafts scripts/sim/run.sh --buying drafts
                                                 # the same year, bought through
                                                 # What to buy's drafts (step 8)
python3 scripts/sim/backtest.py all              # is it believable; the scores
```

The server has one clock, so one year at a time; a second server on another
port (`SIM_PORT=5434 SIM_DIR=/var/lib/postgresql/sim2`) lives another beside
it (`SIM_DRAFTS_PORT=5434` for the backtest then).

## The year's life

23 October 2025 to 21 October 2026, about 300 sales a day.

- **The week:** Friday busiest, then Saturday and Thursday.
- **The day:** a morning peak, quieter early afternoon, the evening busiest.
- **The seasons:** hot coffee and croissants in winter; gelato, iced lattes
  and slushies in summer, when the café sells most.
- **Ramadan** (18 February – 19 March 2026): quiet days, busy late evenings.
  **Eid al-Fitr with Newroz** (20–22 March) and **Eid al-Adha** (26–29 May)
  are the busiest days; New Year's Eve is busy too.
- **The café grows**, about 10% over the year.
- **Channels:** at a table, to take away, and Talabat (more in the evening).
  Cash about six sales in ten, card the rest.
- **The shifts:** mornings 08:00–16:00 (Avin, Dara), evenings 16:00–24:00
  (Karwan, Bana); Shno makes the gelato and croissants each morning and tops
  them up in the afternoon; the croissants left at closing are thrown away.
  Each shift opens its own drawer and closes it with a blind count.
- **Suppliers:** the dairy every other day, the coffee importer weekly, the
  packaging every fortnight; each sometimes late by a day or three. Prices
  rise: coffee in January and September, milk and cream in April, pistachio
  in June, cups in July. Each delivery is billed, due in 30 days, paid on a
  Sunday (now and then a few days late).
- **Money, kept tight on purpose:** the owner starts the year with only
  6,000,000 IQD in the bank and takes 16,000,000 out on the 20th of every
  month; the rent is paid three months at a time (7,500,000 on 1 January,
  April, July and October); a second gelato machine is bought on 8 June
  (18,000,000). The safe is banked twice a week, the card machine's money
  arrives twice a week less the bank's 1.5%, electricity on the 5th (dearer
  in summer), last month's salaries on the 1st. So the bank runs short now
  and then — the shortfalls cash ahead (step 9) must warn of.

## The answer key (`sim.planted`)

| Who    | What                                                                                                  | From        | Problem? |
| ------ | ----------------------------------------------------------------------------------------------------- | ----------- | -------- |
| Dara   | A 9% discount (just under the 10% a cashier may give alone) on about one sale in fourteen             | 20 Dec 2025 | yes      |
| Karwan | About one in thirty of his cash sales voided a few minutes later                                      | 15 Mar 2026 | yes      |
| Bana   | Her Thursday evening drawer 6,000–14,000 IQD short                                                    | 7 May 2026  | yes      |
| Lana   | New (from 1 August): voids one sale in fifty, and half her drawers 2,000–9,000 short, for three weeks | 1 Aug 2026  | **no**   |

And honest look-alikes, so a rule that only counts is fooled:

- **The students' 8%** (a promotion, its reason given as such): from
  February, whoever is on in the afternoon gives it on about one sale in
  seventeen — near the limit, like Dara's, but everyone's and explained.
- **The busy evening:** a customer gone before the coffee came is voided
  more often in the evening, whoever is on (1 cash sale in 100, against 1 in
  250 in the morning) — Karwan and Bana are the evening's.
- Everyone makes honest mistakes: a 10% discount for a regular, a drawer a
  few hundred dinars out.

A good watch list finds the three problems, compares each person with those
on the same shifts, reads a discount's reason, and leaves Lana, the students
and the evening alone.

Every sale draws the same random numbers whatever they come to, and the
look-alikes draw from their own, so a rate changed leaves the customers as
they were; and the year bought through the drafts has the same customers as
the year bought by habit.

## What each feature must pass (SMART_PLAN's marks)

- **Watch list (step 10):** every planted problem found within two weeks of
  its start; at most one false alarm a month.
- **Smarter buying (step 8):** no sale lost to something bought running out;
  at most 25% more stock held than needed, on average. _Needed_ is what a café
  that knew each day's use would hold with the same deliveries: at each day's
  end, just what lasts until the next delivery comes.
- **Cash ahead (step 9):** 7 days ahead, within 10% of what happened, every
  week; every real shortfall (a day the bank ends below nothing) warned of at
  least 3 days before.
- **Monday brief (step 11):** every number agrees with the report it comes
  from; the owner reads a sample and finds it useful.

## Not in the year (yet)

Delivery by the café's own driver (it needs a customer and an address for
each order), Talabat's payouts (the platform's money is left owed), refunds,
stock counts, customers and their points, pre-orders and invoices. Each can
be added when a feature needs it.
