#!/usr/bin/env python3
"""Backtests on the simulated year (SMART_PLAN step 7).

Each feature is replayed week by week on the copy (sixties_sim): it sees only
what was recorded before the week, says what it would have said, and is scored
against what happened, and against the answer key of planted problems
(sim.planted). Until a feature exists, its baseline (scripts/sim/baselines.sql)
stands in: the simplest rule it must beat.

    python3 scripts/sim/backtest.py summary            # is the year believable?
    python3 scripts/sim/backtest.py watch [--fn F]     # part 2: problems people hide
    python3 scripts/sim/backtest.py cash [--fn F]      # part 5: cash ahead
    python3 scripts/sim/backtest.py buying             # part 3: stock-outs and stock held
    python3 scripts/sim/backtest.py all

F is a SQL function on the copy: for watch, F(as_of date) returning
(who, kind, detail); for cash, F(as_of date, days int) returning the money
held that many days later. Pass marks are SMART_PLAN's.
"""
import argparse
import datetime as dt
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB = ["psql", "-h", os.environ.get("PGHOST", "127.0.0.1"), "-p", os.environ.get("SIM_PORT", "5433"),
      "-U", os.environ.get("PGUSER", "postgres"), "-X", "-q", "-At", "-F", "\t", "-d", "sixties_sim"]


def q(sql):
    out = subprocess.run(DB + ["-c", sql], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"✗ {out.stderr.strip()}")
    return [line.split("\t") for line in out.stdout.splitlines() if line]


def load_baselines():
    out = subprocess.run(DB + ["-f", os.path.join(HERE, "baselines.sql")], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"✗ baselines: {out.stderr.strip()}")


def year():
    (start, end), = q("select (select value from sim.config where key = 'start'), "
                      "(select max(day)::text from sim.day_log)")
    return dt.date.fromisoformat(start), dt.date.fromisoformat(end)


def sundays(start, end, after_days=28):
    d = start + dt.timedelta(days=after_days)
    d += dt.timedelta(days=(6 - d.weekday()) % 7)
    while d <= end:
        yield d
        d += dt.timedelta(days=7)


def money(n):
    return f"{round(float(n)):,} IQD"


# ---------------------------------------------------------------------- summary
def summary():
    start, end = year()
    print(f"The simulated year: {start} to {end}\n")
    (n, voided, net, refused), = q(
        "select count(*), count(*) filter (where status = 'voided'), "
        "sum(net_amount) filter (where status <> 'voided'), (select count(*) from sim.refused) from sales_order "
        f"where placed_at >= '{start}'")
    print(f"  {int(n):,} sales, {int(voided):,} voided, {money(net)} taken; {int(refused):,} sales refused")
    print("\n  Each month (sales a day on average, and what was taken):")
    for m, perday, take in q(
            "select to_char(d, 'YYYY-MM'), round(avg(sales)), "
            "(select sum(net_amount) from sales_order o where o.status <> 'voided' "
            "  and to_char(o.placed_at at time zone 'Asia/Baghdad', 'YYYY-MM') = to_char(d, 'YYYY-MM')) "
            "from (select date_trunc('month', day) as d, sales from sim.day_log) x group by d order by d"):
        print(f"    {m}  {perday:>4} a day   {money(take):>18}")
    print("\n  Each day of the week (sales a day on average):")
    names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for dow, perday in q("select extract(isodow from day)::int, round(avg(sales)) from sim.day_log group by 1 order by 1"):
        print(f"    {names[int(dow) - 1]:<10} {perday}")
    print("\n  Hours, an ordinary day against a Ramadan day (share of the day's sales):")
    rows = q("""
      with s as (select extract(hour from placed_at at time zone 'Asia/Baghdad')::int as h,
                        (placed_at at time zone 'Asia/Baghdad')::date between '2026-02-18' and '2026-03-19' as ramadan
                   from sales_order where status <> 'voided')
      select h, round(100.0 * count(*) filter (where not ramadan) / sum(count(*) filter (where not ramadan)) over (), 1),
                round(100.0 * count(*) filter (where ramadan) / nullif(sum(count(*) filter (where ramadan)) over (), 0), 1)
        from s group by h order by h""")
    for h, normal, ramadan in rows:
        print(f"    {int(h):02d}:00  {normal:>5}%  {ramadan:>5}%")
    print("\n  What sells, January against July (share of items sold):")
    for name, jan, jul in q("""
      with l as (select p.name, to_char(o.placed_at at time zone 'Asia/Baghdad', 'MM') as m, sum(sl.quantity) as qty
                   from sales_order o join sales_order_line sl on sl.sales_order_id = o.id
                   join product_variant v on v.id = sl.product_variant_id join product p on p.id = v.product_id
                  where o.status <> 'voided' group by 1, 2)
      select name, round(100.0 * sum(qty) filter (where m = '01') / sum(sum(qty) filter (where m = '01')) over (), 1),
                   round(100.0 * sum(qty) filter (where m = '07') / sum(sum(qty) filter (where m = '07')) over (), 1)
        from l group by name order by 3 desc nulls last"""):
        print(f"    {name:<20} {jan or '-':>5}%  {jul or '-':>5}%")
    print("\n  The planted problems (the answer key):")
    for kind, who, s, e, problem, note in q(
            "select kind, who, starts, ends, problem, note from sim.planted order by starts"):
        tag = "problem" if problem == "t" else "NOT a problem"
        print(f"    {who:<7} {kind:<13} {s} → {e}  ({tag}) {note}")


# ---------------------------------------------------------------------- watch
def watch(fn):
    """Part 2's pass mark: every planted problem found within two weeks, at most one false alarm a month."""
    start, end = year()
    planted = [dict(kind=k, who=w, starts=dt.date.fromisoformat(s), ends=dt.date.fromisoformat(e), problem=p == "t")
               for k, w, s, e, p in q("select kind, who, starts, ends, problem from sim.planted")]
    found, false = {}, []
    weeks = list(sundays(start, end))
    for as_of in weeks:
        for who, kind, detail in q(f"select * from {fn}('{as_of}')"):
            match = next((p for p in planted if p["who"] == who and p["kind"] == kind and p["problem"]
                          and p["starts"] <= as_of <= p["ends"] + dt.timedelta(days=28)), None)
            if match:
                found.setdefault((who, kind), as_of)
            else:
                false.append((as_of, who, kind, detail))
    print(f"Watch list backtest: {fn}, {len(weeks)} Sundays from {weeks[0]} to {weeks[-1]}\n")
    ok = True
    for p in [p for p in planted if p["problem"]]:
        when = found.get((p["who"], p["kind"]))
        if when is None:
            ok = False
            print(f"  ✗ {p['who']}'s {p['kind']} (from {p['starts']}): never found")
        else:
            lag = (when - p["starts"]).days
            mark = "✓" if lag <= 14 else "✗"
            ok = ok and lag <= 14
            print(f"  {mark} {p['who']}'s {p['kind']} (from {p['starts']}): found on {when}, {lag} days after it began")
    months = max(1, (weeks[-1] - weeks[0]).days / 30.4)
    rate = len(false) / months
    print(f"\n  False alarms: {len(false)} in {months:.1f} months, {rate:.1f} a month (pass mark: at most 1)")
    for as_of, who, kind, detail in false[:12]:
        print(f"    {as_of}  {who:<12} {kind:<13} {detail}")
    if len(false) > 12:
        print(f"    … and {len(false) - 12} more")
    passed = ok and rate <= 1
    print(f"\n  {'PASSES' if passed else 'DOES NOT PASS'} SMART_PLAN's mark for part 2")
    return passed


# ---------------------------------------------------------------------- cash
def cash(fn, days=7):
    """Part 5's pass mark: 7 days ahead within 10% of what happened."""
    start, end = year()
    errors = []
    for as_of in sundays(start, end):
        target = as_of + dt.timedelta(days=days)
        if target > end:
            break
        (said, actual), = q(f"select {fn}('{as_of}', {days}), sim.cash_on('{target}')")
        errors.append((as_of, float(said), float(actual)))
    print(f"Cash ahead backtest: {fn}, {days} days ahead, {len(errors)} Sundays\n")
    within = sum(1 for _, s, a in errors if a and abs(s - a) / abs(a) <= 0.10)
    mape = sum(abs(s - a) / abs(a) for _, s, a in errors if a) / len(errors)
    print(f"  Within 10%: {within} of {len(errors)} weeks; average miss {mape * 100:.1f}%")
    worst = sorted(errors, key=lambda e: -abs(e[1] - e[2]) / max(1, abs(e[2])))[:5]
    for as_of, s, a in worst:
        print(f"    {as_of}: said {money(s)}, was {money(a)}")
    passed = within == len(errors)
    print(f"\n  {'PASSES' if passed else 'DOES NOT PASS'} SMART_PLAN's mark for part 5 (within 10% every week)")
    return passed


# ---------------------------------------------------------------------- buying
def buying():
    """Part 3's pass mark: nothing out of stock, at most 25% extra stock on average.
    Until smart buying exists, this scores the simulated café's own simple habit
    (order up to so many days of the last fortnight's use)."""
    start, end = year()
    print("Buying backtest: the simulated café's own ordering habit (the baseline)\n")
    rows = q("""select to_char(at at time zone 'Asia/Baghdad', 'YYYY-MM'), count(*),
                       string_agg(distinct substring(reason from 'of ([A-Za-z ]+) is in stock'), ', ')
                  from sim.refused where reason like '%is in stock%' group by 1 order by 1""")
    total = sum(int(r[1]) for r in rows)
    print(f"  Sales lost to something out of stock: {total}")
    for m, n, what in rows:
        print(f"    {m}  {n:>4}  {what}")
    held = q("""
      with u as (select item_id, -sum(base_quantity_signed) / 365.0 as daily
                   from inventory_movement where type in ('sale_consumption', 'production_consumption')
                    and location_id = sim.main() group by item_id),
           v as (select i.name, b.qty, u.daily from stock_balance b join u using (item_id)
                   join item i on i.id = b.item_id where b.location_id = sim.main() and u.daily > 0)
      select name, round(qty / daily, 1) from v order by 2 desc""")
    print("\n  Days of use held at the year's end, by item (the needs differ by supplier):")
    for name, d in held[:10]:
        print(f"    {name:<32} {d:>6} days")
    print("\n  The real feature (step 8) must lose no sale to a shortage and hold at most 25% more than it needs.")
    return total == 0


def main():
    a = argparse.ArgumentParser()
    a.add_argument("what", choices=["summary", "watch", "cash", "buying", "all"])
    a.add_argument("--fn", default=None)
    a.add_argument("--days", type=int, default=7)
    args = a.parse_args()
    load_baselines()
    if args.what in ("summary", "all"):
        summary()
        print()
    if args.what in ("watch", "all"):
        watch(args.fn or "sim.naive_watch")
        print()
    if args.what in ("cash", "all"):
        cash(args.fn or "sim.naive_cash", args.days)
        if not args.fn:
            print()
            cash("sim.naive_cash_trend", args.days)
        print()
    if args.what in ("buying", "all"):
        buying()


if __name__ == "__main__":
    main()
