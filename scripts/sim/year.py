#!/usr/bin/env python3
"""The simulated year (SMART_PLAN step 7): a year of an Erbil café, written as
SQL for the copy (sixties_sim on the clock-controlled server; run.sh pipes it
to psql). Each day, at its own hours: the gelato and croissants are made, the
drawer is opened, customers buy, deliveries come (some late), the safe is
banked, the card money arrives, bills and salaries are paid, the drawer is
closed and the croissants left are thrown away.

The year has a life: busy Fridays and evenings; hot summer months, when gelato,
iced drinks and slushies sell and hot coffee less; Ramadan (quiet days, late
busy evenings), Eid al-Fitr with Newroz, Eid al-Adha; New Year's Eve; a café
growing slowly. And it has problems planted in it, as sim.planted says:
Dara's 9% discounts, Karwan's voided cash sales, Bana's short Thursday
drawers; and Lana, a new cashier, whose beginner's voids are not a problem.

Deterministic: the same seed gives the same year.

    python3 scripts/sim/year.py [--days N] [--seed S] | psql ... sixties_sim
"""
import argparse
import datetime as dt
import math
import random
import sys

START = dt.date(2025, 10, 23)
END = dt.date(2026, 10, 21)

OWNER = "owner@example.com"
MANAGER = "manager@example.com"
BARISTA = "shno@sim.example"
EMAIL = {n: f"{n.lower()}@sim.example" for n in ["Avin", "Dara", "Karwan", "Bana", "Shno", "Lana"]}

# Who works the till: mornings 08–16, evenings 16–24 (Monday = 0).
MORNING = ["Avin", "Dara", "Avin", "Dara", "Avin", "Dara", "Avin"]
EVENING = ["Karwan", "Bana", "Karwan", "Bana", "Karwan", "Bana", "Karwan"]
LANA_FROM = dt.date(2026, 8, 1)

# With --buying drafts: the habit for the first four weeks (What to buy judges
# use over four weeks), What to buy's drafts from then.
DRAFTS_FROM_DAY = 28

# The planted problems (the answer key is sim.planted, written by cafe.sql).
DARA_DISCOUNTS_FROM = dt.date(2025, 12, 20)
KARWAN_VOIDS_FROM = dt.date(2026, 3, 15)
BANA_SHORT_FROM = dt.date(2026, 5, 7)
LANA_LEARNING_UNTIL = dt.date(2026, 8, 21)

# Ramadan 1447 and the days around it.
RAMADAN = (dt.date(2026, 2, 18), dt.date(2026, 3, 19))
EVENTS = {
    dt.date(2025, 12, 31): 1.35,  # New Year's Eve
    dt.date(2026, 3, 20): 1.7,  # Eid al-Fitr
    dt.date(2026, 3, 21): 1.9,  # Eid and Newroz
    dt.date(2026, 3, 22): 1.6,
    dt.date(2026, 5, 26): 1.4,  # Eid al-Adha
    dt.date(2026, 5, 27): 1.6,
    dt.date(2026, 5, 28): 1.5,
    dt.date(2026, 5, 29): 1.3,
}

BASE_SALES = 290  # an ordinary weekday in October
WEEKDAY = [0.95, 0.92, 0.95, 1.08, 1.32, 1.18, 0.98]  # Friday and Saturday busiest
MONTH = {1: 0.82, 2: 0.86, 3: 0.95, 4: 1.0, 5: 1.08, 6: 1.18, 7: 1.28, 8: 1.3, 9: 1.15, 10: 1.0, 11: 0.92, 12: 0.9}

# Hourly shape of a day (weights), and of a Ramadan day.
HOURS = {8: 6, 9: 7, 10: 6, 11: 5, 12: 6, 13: 6, 14: 5, 15: 5, 16: 6, 17: 8, 18: 9, 19: 10, 20: 10, 21: 9, 22: 7, 23: 4}
RAMADAN_HOURS = {8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 2, 18: 3, 19: 9, 20: 13, 21: 14, 22: 13, 23: 11}

# The menu, by what sells when: (key, weight in a mild month, how summer moves it).
MENU = [
    ("espresso", 10, -0.5), ("americano", 12, -0.4), ("latte", 16, -0.45), ("vanilla_latte", 9, -0.35),
    ("iced_latte", 7, 1.3), ("slushy", 4, 1.6), ("cone_pistachio", 6, 1.2), ("cup_chocolate", 6, 1.2),
    ("cup_vanilla", 6, 1.2), ("cup_pistachio", 5, 1.2), ("croissant", 9, -0.2), ("water", 5, 0.6),
]


def heat(day):
    """How summery the day is: 0 in January, 1 at the end of July."""
    return (1 - math.cos((day.timetuple().tm_yday - 15) / 365 * 2 * math.pi)) / 2


def in_ramadan(day):
    return RAMADAN[0] <= day <= RAMADAN[1]


class Year:
    def __init__(self, seed, days, buying="habit"):
        self.r = random.Random(seed)
        self.days = days
        # How the café buys: its own simple habit (each supplier's delivery
        # on its days, ordered as it comes), or, from the fifth week, through
        # What to buy's drafts (step 8), approved and sent each morning and
        # delivered as each supplier takes.
        self.buying = buying
        self.who = None  # who the session is acting as
        self.order_no = 50000
        self.out = sys.stdout

    # ------------------------------------------------------------------ output
    def sql(self, line):
        self.out.write(line + "\n")

    def at(self, day, hour, minute=0, second=0):
        t = dt.datetime.combine(day, dt.time(0)) + dt.timedelta(hours=hour, minutes=minute, seconds=second)
        self.sql(f"select sim.at('{t:%Y-%m-%d %H:%M:%S}');")

    def act(self, email):
        if self.who != email:
            self.sql(f"select test.act_as('{email}');")
            self.who = email

    def admin(self):
        self.sql("select test.as_admin();")
        self.who = None

    # ------------------------------------------------------------------ a day's shape
    def sales_today(self, day):
        n = BASE_SALES * WEEKDAY[day.weekday()] * MONTH[day.month]
        n *= 1 + 0.1 * (day - START).days / 365  # a café growing slowly
        n *= EVENTS.get(day, 1.0)
        if in_ramadan(day):
            n *= 0.9
        n *= self.r.gauss(1, 0.07)
        return max(40, int(n))

    def basket(self, day, hour):
        h = heat(day)
        weights = []
        for key, w, summer in MENU:
            w = w * max(0.15, 1 + summer * (h - 0.4))
            if key == "croissant" and hour < 12:
                w *= 2.5
            weights.append(w)
        n = self.r.choices([1, 2, 3], [0.6, 0.3, 0.1])[0]
        picks = {}
        for _ in range(n):
            k = self.r.choices([m[0] for m in MENU], weights)[0]
            picks[k] = picks.get(k, 0) + (2 if self.r.random() < 0.08 else 1)
        return ",".join(f"{k}*{q}" for k, q in picks.items())

    def channel(self, hour):
        talabat = 0.08 if hour < 11 else 0.2 if hour >= 18 else 0.15
        x = self.r.random()
        if x < talabat:
            return "talabat"
        return "takeaway" if self.r.random() < 0.42 else "dine_in"

    # ------------------------------------------------------------------ the year
    def run(self):
        self.prelude()
        day = START
        n = 0
        while day <= END and (self.days is None or n < self.days):
            self.live(day)
            day += dt.timedelta(days=1)
            n += 1
        self.admin()
        self.sql("select 'the year ends';")

    def prelude(self):
        """The eve: the till left open by the template is closed, the first deliveries come."""
        eve = START - dt.timedelta(days=1)
        self.at(eve, 18)
        self.act("cashier@example.com")
        self.sql("select sim.close_drawer(0);")
        self.at(eve, 19)
        self.act(OWNER)
        for supplier in ["Sulaymaniyah Dairy Co.", "Kurdistan Coffee Imports", "City Packaging Supplies"]:
            self.sql(f"select sim.deliver('{supplier}');")

    def cashiers(self, day):
        wd = day.weekday()
        morning, evening = MORNING[wd], EVENING[wd]
        if day >= LANA_FROM:
            if wd == 5:
                morning = "Lana"
            if wd == 6:
                evening = "Lana"
        return morning, evening

    def live(self, day):
        r = self.r
        morning, evening = self.cashiers(day)
        events = []  # (seconds into the day, order, action)

        def ev(hour, minute, action, second=0, order=5):
            events.append((hour * 3600 + minute * 60 + second, order, action))

        # The kitchen makes the day's gelato and croissants, and tops them up
        # for the evening.
        ev(7, 30, ("make", 1.15))
        ev(15, 30, ("make", 0.55))
        ev(7, 58, ("open", morning))
        ev(16, 0, ("close", morning, self.short(day, morning, "morning")), order=1)
        ev(16, 0, ("open", evening), second=30, order=2)
        ev(23, 58, ("close", evening, self.short(day, evening, "evening")))
        ev(23, 59, ("leftovers",))

        # Deliveries: the dairy every other day, the coffee importer on
        # Sundays, the packaging every other Saturday; now and then late.
        # The draws are made the same way whichever way the café buys, so the
        # customers are the same.
        k = (day - START).days
        drafts = self.buying == "drafts" and k >= DRAFTS_FROM_DAY
        if k % 2 == 0:
            late = 1 if r.random() < 0.15 else 0
            if not drafts:
                self.later(day, late, 9, 0, ("deliver", "Sulaymaniyah Dairy Co."))
        if day.weekday() == 6:
            late = r.choice([1, 2, 3]) if r.random() < 0.2 else 0
            if not drafts:
                self.later(day, late, 11, 0, ("deliver", "Kurdistan Coffee Imports"))
        if day.weekday() == 5 and (k // 7) % 2 == 0:
            late = r.choice([1, 2]) if r.random() < 0.15 else 0
            if not drafts:
                self.later(day, late, 12, 0, ("deliver", "City Packaging Supplies"))
        if self.buying == "drafts":
            # What was ordered and is due comes in; then the morning's drafts.
            ev(9, 0, ("arrivals",))
            if drafts:
                ev(9, 30, ("drafts",))
        for hour, minute, action in self.pending.pop(day, []):
            ev(hour, minute, action)

        # Money: the safe banked twice a week, the card money arrives twice a
        # week, the bills paid on Sundays (a few days late now and then), the
        # rent on the 1st, the electricity on the 5th, last month's salaries on
        # the 1st (a month's pay is approved once the month is over).
        if day.weekday() in (2, 5):
            ev(10, 30, ("bank",))
        if day.weekday() in (0, 3):
            ev(10, 15, ("cards",))
        if day.weekday() == 6:
            ev(10, 0, ("bills", r.choice([0, 0, 0, 3])))
        if day.day == 1:
            ev(10, 5, ("expense", "Rent", 2500000, "6000"))
        if day.day == 5:
            power = int(round(450000 + 650000 * heat(day), -4))
            ev(10, 10, ("expense", "Electricity and generator", power, "6200"))
        if day.day == 1:
            ev(11, 0, ("payroll",))

        # The customers.
        hours = RAMADAN_HOURS if in_ramadan(day) else HOURS
        total = self.sales_today(day)
        weight = sum(hours.values())
        for hour, w in hours.items():
            for _ in range(self.poisson(total * w / weight)):
                minute, second = r.randrange(60), r.randrange(60)
                if hour == 7 or (hour == 16 and minute == 0):
                    minute = 1
                if hour == 23 and minute >= 57:
                    minute = 56
                cashier = morning if hour < 16 else evening
                ev(hour, minute, ("sale", cashier), second=second)

        events.sort(key=lambda e: (e[0], e[1]))
        sold = 0
        for secs, _, action in events:
            self.at(day, secs // 3600, (secs % 3600) // 60, secs % 60)
            sold += self.do(day, secs, action)
        self.admin()
        self.sql(f"insert into sim.day_log values ('{day}', {sold}, 0, null) on conflict (day) do nothing;")

    pending = {}

    def later(self, day, late, hour, minute, action):
        when = day + dt.timedelta(days=late)
        self.pending.setdefault(when, []).append((hour, minute, action))

    def poisson(self, lam):
        # Knuth for small, normal for large.
        if lam > 30:
            return max(0, int(round(self.r.gauss(lam, math.sqrt(lam)))))
        L, k, p = math.exp(-lam), 0, 1.0
        while True:
            p *= self.r.random()
            if p <= L:
                return k
            k += 1

    def short(self, day, cashier, shift):
        """How much short a drawer closes: Bana's planted Thursdays, or a small honest difference."""
        if cashier == "Bana" and shift == "evening" and day.weekday() == 3 and day >= BANA_SHORT_FROM:
            return self.r.randrange(15, 31) * 1000
        if self.r.random() < 0.1:
            return self.r.choice([-1000, -500, -250, 250, 500, 1000])
        return 0

    # ------------------------------------------------------------------ doing
    def do(self, day, secs, action):
        r = self.r
        kind = action[0]
        if kind == "make":
            self.act(BARISTA)
            self.sql(f"select sim.make({action[1]});")
        elif kind == "open":
            self.act(EMAIL[action[1]])
            self.sql("select open_cash_session(50000, null, null, null, gen_random_uuid());")
        elif kind == "close":
            self.act(EMAIL[action[1]])
            self.sql(f"select sim.close_drawer({action[2]});")
        elif kind == "leftovers":
            self.act(MANAGER)
            self.sql("select sim.throw_leftovers();")
        elif kind == "deliver":
            self.act(OWNER)
            self.sql(f"select sim.deliver('{action[1]}');")
        elif kind == "bank":
            self.act(MANAGER)
            self.sql("select sim.bank_the_safe();")
        elif kind == "cards":
            self.act(OWNER)
            self.sql("select sim.settle_cards();")
        elif kind == "bills":
            self.act(OWNER)
            self.sql(f"select sim.pay_due({action[1]});")
        elif kind == "expense":
            _, what, amount, code = action
            self.act(OWNER)
            self.sql(f"select record_expense('{what}', {amount}, '{code}', 'bank', current_date, sim.main(), false, gen_random_uuid());")
        elif kind == "arrivals":
            self.act(OWNER)
            self.sql("select sim.receive_due();")
        elif kind == "drafts":
            self.act(OWNER)
            self.sql("select sim.order_drafts();")
        elif kind == "payroll":
            self.act(OWNER)
            self.sql(
                "do $$ declare v uuid; begin "
                "v := (draft_payroll((date_trunc('month', current_date) - interval '1 month')::date, gen_random_uuid()) ->> 'run_id')::uuid; "
                "perform approve_payroll(v, gen_random_uuid()); perform pay_payroll(v, 'bank', gen_random_uuid()); end $$;"
            )
        elif kind == "sale":
            return self.sale(day, secs, action[1])
        return 0

    def sale(self, day, secs, cashier):
        r = self.r
        hour = secs // 3600
        channel = self.channel(hour)
        if channel == "talabat":
            tender = "platform_paid"
        else:
            tender = "cash" if r.random() < 0.62 else "card"
        discount = "null"
        if channel != "talabat":
            if cashier == "Dara" and day >= DARA_DISCOUNTS_FROM and r.random() < 0.14:
                discount = "9"
            elif r.random() < 0.02:
                discount = "10"
        order_no = "null"
        if channel == "talabat":
            self.order_no += 1
            order_no = f"'{self.order_no}'"
        self.act(EMAIL[cashier])
        self.sql(f"select sim.sale('{channel}', '{tender}', '{self.basket(day, hour)}', {discount}, {order_no});")

        # A void a few minutes later, by the manager: an honest mistake now
        # and then; Karwan's planted ones; Lana's while she learns.
        void = None
        if tender == "cash":
            if cashier == "Karwan" and day >= KARWAN_VOIDS_FROM and r.random() < 0.04:
                void = ("customer_left", r.randrange(3, 11))
            elif cashier == "Lana" and day <= LANA_LEARNING_UNTIL and r.random() < 0.02:
                void = ("rang_wrong_item", r.randrange(1, 4))
            elif r.random() < 0.004:
                void = (r.choice(["rang_twice", "rang_wrong_item"]), r.randrange(1, 5))
        if void and secs + void[1] * 60 < 23 * 3600 + 57 * 60:
            t = secs + void[1] * 60
            self.at(day, t // 3600, (t % 3600) // 60, t % 60)
            self.act(MANAGER)
            self.sql(f"select sim.void_last('{cashier}', '{void[0]}');")
        return 1


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--days", type=int, default=None, help="only the first N days")
    a.add_argument("--seed", type=int, default=2026)
    a.add_argument("--buying", choices=["habit", "drafts"], default="habit",
                   help="the café's own ordering habit, or What to buy's drafts (step 8)")
    args = a.parse_args()
    Year(args.seed, args.days, args.buying).run()


if __name__ == "__main__":
    main()
