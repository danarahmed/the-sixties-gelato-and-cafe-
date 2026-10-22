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
    python3 scripts/sim/backtest.py buying             # part 3: the habit against the drafts year
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
      "-U", os.environ.get("PGUSER", "postgres"), "-X", "-q", "-At", "-F", "\t", "-d",
      os.environ.get("SIM_DB", "sixties_sim")]


def q(sql, db=None, port=None):
    """Rows of a query on the year's copy (or another database, on another port)."""
    cmd = DB[:-1] + [db or DB[-1], "-c", sql]
    if port:
        cmd[cmd.index("-p") + 1] = port
    out = subprocess.run(cmd, capture_output=True, text=True)
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
def stock_story(db, port, first, last):
    """For each item the café buys: its stock at each day's end, what it used
    each day and the days its deliveries came, from the year's movements."""
    items = {name: float(price) for name, price in q("select item, price from sim.supply", db, port)}
    used, came, opening = {}, {}, {}
    for name, day, u, c in q(f"""
        select i.name, (m.occurred_at at time zone 'Asia/Baghdad')::date,
               -coalesce(sum(m.base_quantity_signed) filter (where m.type <> 'purchase_receipt'), 0),
               coalesce(sum(m.base_quantity_signed) filter (where m.type = 'purchase_receipt'), 0)
          from inventory_movement m join item i on i.id = m.item_id
         where i.name in (select item from sim.supply) and m.location_id = sim.main()
         group by 1, 2""", db, port):
        d = dt.date.fromisoformat(day)
        if d < first:
            opening[name] = opening.get(name, 0) - float(u) + float(c)
        else:
            used[(name, d)] = float(u)
            came[(name, d)] = float(c)
    return items, used, came, opening


def buying_score(db, port, first, last):
    """Sales lost to a shortage of something bought, and the stock held against
    what was needed: a café that knew what each day would use, with the same
    deliveries, would end each day holding just what lasts until the next one."""
    lost = q(f"""select count(*) filter (where cashier <> 'kitchen'
                                         and substring(reason from 'of (.+) is in stock') in (select item from sim.supply)),
                        count(*) filter (where cashier <> 'kitchen' and reason like '%is in stock%'),
                        count(*) filter (where cashier = 'kitchen')
                   from sim.refused
                  where (at at time zone 'Asia/Baghdad')::date between '{first}' and '{last}'""", db, port)[0]
    items, used, came, opening = stock_story(db, port, first - dt.timedelta(days=1), last + dt.timedelta(days=60))
    held_v = need_v = 0.0
    per = []
    for name, price in items.items():
        days = [first + dt.timedelta(days=k) for k in range((last - first).days + 1)]
        horizon = [first + dt.timedelta(days=k) for k in range((last - first).days + 60)]
        arrivals = [d for d in horizon if came.get((name, d), 0) > 0]
        held, h, nv, hv = opening.get(name, 0.0), [], 0.0, 0.0
        for d in horizon:
            held += came.get((name, d), 0) - used.get((name, d), 0)
            h.append((d, held))
        for d, held in h:
            if d > last:
                break
            nxt = next((a for a in arrivals if a > d), None)
            if nxt is None:
                continue
            need = sum(used.get((name, d + dt.timedelta(days=k)), 0) for k in range(1, (nxt - d).days))
            hv += max(held, 0) * price
            nv += need * price
        held_v += hv
        need_v += nv
        per.append((name, hv / max(len(days), 1), nv / max(len(days), 1)))
    return dict(lost_bought=int(lost[0]), lost_any=int(lost[1]), kitchen=int(lost[2]),
                held=held_v / max((last - first).days + 1, 1), need=need_v / max((last - first).days + 1, 1),
                per=sorted(per, key=lambda r: -r[1]))


def buying(dbs):
    """Part 3's pass mark: nothing out of stock, at most 25% more stock held than needed."""
    start, end = year()
    first, last = start + dt.timedelta(days=35), end - dt.timedelta(days=7)
    print(f"Buying backtest: {first} to {last} (from the sixth week, when What to buy has four weeks behind it)\n")
    result = None
    for label, db, port in dbs:
        if not q("select 1 from pg_database where datname = '" + db + "'", "postgres", port):
            print(f"  {label}: no year in {db} (SIM_DB={db} scripts/sim/run.sh{' --buying drafts' if 'drafts' in db else ''})\n")
            continue
        r = buying_score(db, port, first, last)
        if not r["need"]:
            print(f"  {label} ({db}): its year has not reached {last} yet\n")
            continue
        extra = r["held"] / r["need"] - 1 if r["need"] else 0
        print(f"  {label} ({db}):")
        print(f"    sales lost to something bought running out: {r['lost_bought']}"
              f"  (to anything: {r['lost_any']}; batches the kitchen could not make: {r['kitchen']})")
        print(f"    stock held on average {money(r['held'])}, needed {money(r['need'])}: {extra * 100:+.0f}%")
        for name, hv, nv in r["per"][:6]:
            print(f"      {name:<32} held {money(hv):>14}  needed {money(nv):>14}")
        print()
        result = (r, extra)
    if result is None:
        return False
    r, extra = result
    passed = r["lost_bought"] == 0 and r["kitchen"] == 0 and extra <= 0.25
    print(f"  {'PASSES' if passed else 'DOES NOT PASS'} SMART_PLAN's mark for part 3 "
          f"(no sale lost to a shortage; at most 25% more stock than needed)")
    return passed


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
        buying([("The café's own habit", os.environ.get("SIM_DB", "sixties_sim"), None),
                ("What to buy's drafts (step 8)", os.environ.get("SIM_DRAFTS_DB", "sixties_sim_drafts"),
                 os.environ.get("SIM_DRAFTS_PORT"))])


if __name__ == "__main__":
    main()
