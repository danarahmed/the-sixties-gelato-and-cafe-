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
  end, what lasts until the next delivery comes, and — as nobody knows which
  delivery will be late — enough for its supplier's worst lateness on top
  (a day for the dairy, three for the coffee importer, two for the
  packaging). The backtest also shows the stock against a café that knew
  which deliveries would be late too; no café can come near that one.
- **Cash ahead (step 9):** 7 days ahead, within 10% of what happened, every
  week; every real shortfall (a day the bank ends below nothing) warned of at
  least 3 days before.
- **Monday brief (step 11):** every number agrees with the report it comes
  from; the owner reads a sample and finds it useful.

## What the year showed

Run on 22 October 2026. The year bought by habit was lived to 9 September
(322 days; the run was stopped at the session's two-hour limit) and the year
bought through the drafts to the end; each backtest uses the days its year
lived. `python3 scripts/sim/backtest.py all` gives every line below.

**Watch list (step 10) — passes.** Looked over every night, as it runs:

| Planted problem                     | Began       | Found       | After   |
| ----------------------------------- | ----------- | ----------- | ------- |
| Dara's 9% discounts                 | 20 December | 27 December | 7 days  |
| Karwan's voided cash sales          | 15 March    | 23 March    | 8 days  |
| Bana's Thursday drawer, short       | 7 May       | 21 May      | 14 days |
| Lana, new, learning (not a problem) | 1 August    | not raised  | —       |
| The students' 8%, the busy evening  | —           | not raised  | —       |

One false alarm in 9.6 months (Dara's voids in her first weeks, 8 against
1.07 expected). The baseline (each cashier's rates over four weeks against
everyone else's, checked on Sundays) found Bana's drawer only after 80 days. Bana's is found on her
third short Thursday: two in a row are not yet beyond luck.

**Smarter buying (step 8) — passes.** 27 November to 2 September:

| Bought by            | Sales lost to a shortage | Stock held against needed |
| -------------------- | ------------------------ | ------------------------- |
| The café's habit     | 0                        | +35%                      |
| What to buy's drafts | 0                        | **+17%** (mark: ≤ 25%)    |

On the way there the year showed two things put right in `0092`: the busy-
day margin was counted twice (at the reorder level and again on top), and
the supplier's lateness and a busier day were added one on the other; they
are now kept once, as the root of their squares (+26%, then +31% over the
summer, before). Coffee beans are held at 1.09 million against 0.93 needed.

**Cash ahead (step 9) — better than every baseline; not the strict mark.**

| Measure (41 Sundays, 7 days ahead)                  | Nothing changes | The last 4 weeks' trend | Cash ahead   |
| --------------------------------------------------- | --------------- | ----------------------- | ------------ |
| Within 10% of what happened                         | 4 weeks         | 3 weeks                 | **24 weeks** |
| Average miss                                        | 92%             | 100%                    | **33%**      |
| Leaving out payments made for the first time        | 76%             | 83%                     | **10.7%**    |
| Short spells of the bank warned of ≥ 3 days before  | 12 of 15        | —                       | **12 of 15** |
| Days warned of when the bank in fact held something | 86 of 121       | —                       | **2 of 47**  |

The weeks it misses are mostly payments the books had never seen twice (the
first owner's drawings, the first and second quarterly rent, an 18,000,000
gelato machine) and Eid after Ramadan (the takings judged by the quiet
Ramadan weeks). The spells not warned of: the second quarterly rent, the
machine, and a 450,000 dip three days after it. The year showed one fault,
put right in `0093`: the safe was banked with the evening's takings in it,
about a million too hopeful each banking day. "Within 10% every week" is
measured on what the bank and safe hold, often near nothing in this year,
where 10% is a few hundred thousand; no forecast from the books can meet
it while one-off payments are unknown to them.

## Not in the year (yet)

Delivery by the café's own driver (it needs a customer and an address for
each order), Talabat's payouts (the platform's money is left owed), refunds,
stock counts, customers and their points, pre-orders and invoices. Each can
be added when a feature needs it.
