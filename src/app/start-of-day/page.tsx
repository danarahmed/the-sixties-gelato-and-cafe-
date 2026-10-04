import Link from "next/link";
import Decimal from "decimal.js";
import type { ReactNode } from "react";
import { getMsg, getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getDrawerState } from "@/lib/db/cash";
import { getClockBoard } from "@/lib/db/staff";
import { getCurrentAlerts, getDailyBrief } from "@/lib/db/alerts";
import { getDailySalesTarget } from "@/lib/db/reports";
import { getItems, getStockBoard } from "@/lib/db/read";
import { getProductionPlan } from "@/lib/db/production";
import { getPurchaseOrders } from "@/lib/db/purchasing";
import { getPlaces, placeChoice, tillChoice } from "@/lib/place";
import { businessToday, dateTimeIn } from "@/lib/dates";
import { fmtIQD, fmtQty, unitName } from "@/lib/format";
import { firstFew, progress, waitingAlerts, type StepState } from "@/lib/endofday";
import { deliveriesDue, dueIn, toMake } from "@/lib/startofday";
import { weekdayOf } from "@/lib/production";
import { showNice } from "@/components/production/batchMath";
import { DrawerPanel } from "@/components/cash/DrawerPanel";
import { KeepShown } from "@/components/KeepShown";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

interface Step {
  key: string;
  title: string;
  state: StepState;
  /** What it comes to now, in a sentence. */
  say: string;
  /** What is still to do, the first few. */
  items: string[];
  more: number;
  note?: string;
  /** Where its work is done. */
  go?: { href: string; label: string }[];
  /** Its work, done here. */
  extra?: ReactNode;
}

/** A read the morning can do without: a step that cannot be read is left out, not the page. */
const orElse = <T,>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);

/**
 * The start of the day, step by step: the drawer opened and counted, everyone
 * due in clocked in, what the plan says to make, the deliveries due, nothing
 * low without an order, and the red alerts answered, each ticked once nothing
 * of it is left and each one tap from where its work is done (the drawer is
 * opened right here). Then the day ahead: the target, and what the same day
 * made last week and on a usual one. Nothing on it is new: it reads what the
 * screens behind it read.
 */
export default async function StartOfDayPage() {
  const profile = await requirePermission("day.close");
  const [t, msg] = await Promise.all([getT(), getMsg()]);
  const tz = profile.timezone;
  const nowIso = new Date().toISOString();
  const today = businessToday(tz);
  const time = (iso: string) => dateTimeIn(tz, iso).slice(11, 16);
  const weekday = weekdayOf(nowIso, tz);
  const sees = {
    drawer: has(profile, "cash.session") || has(profile, "cash.session.force"),
    staff:
      has(profile, "sale.create") ||
      has(profile, "staff.manage") ||
      has(profile, "attendance.edit"),
    make: has(profile, "production.record") || has(profile, "cost.view"),
    stock: has(profile, "cost.view"),
    alerts: has(profile, "profit.view"),
  };
  const [{ at: tillAt }, { at }, places] = await Promise.all([
    tillChoice(),
    placeChoice(),
    getPlaces(),
  ]);
  const none = { approveUpTo: null, orders: [] };
  const [drawer, boards, plan, items, board, pos, alerts, brief, target] = await Promise.all([
    sees.drawer ? orElse(getDrawerState(tillAt), null) : Promise.resolve(null),
    sees.staff
      ? orElse(Promise.all(places.map((p) => getClockBoard(p.id))), [])
      : Promise.resolve([]),
    sees.make ? orElse(getProductionPlan(today, at), null) : Promise.resolve(null),
    sees.make ? orElse(getItems(), []) : Promise.resolve([]),
    sees.stock ? orElse(getStockBoard(at), []) : Promise.resolve([]),
    sees.stock ? orElse(getPurchaseOrders(), none) : Promise.resolve(none),
    sees.alerts ? orElse(getCurrentAlerts(), []) : Promise.resolve([]),
    sees.alerts ? orElse(getDailyBrief(today), null) : Promise.resolve(null),
    sees.alerts ? orElse(getDailySalesTarget(profile.worksAt), 0) : Promise.resolve(0),
  ]);
  const steps: Step[] = [];

  // ------------------------------------------------------------ the drawer
  if (drawer) {
    const s = drawer.session;
    steps.push({
      key: "drawer",
      title: t("Drawer open and counted"),
      state: s ? "done" : "left",
      say: s
        ? t("Session {no} is open: {cashier}, since {time}.", {
            no: s.no,
            cashier: s.cashier,
            time: time(s.openedAt),
          })
        : t("The drawer is not open yet: count what is in it and open it here."),
      items: [],
      more: 0,
      // Opened here, it stays on the screen with the count's answer.
      extra: (
        <KeepShown show={!s && drawer.mayOpen}>
          <div className="eod-drawer" data-testid="sod-open-drawer">
            <DrawerPanel state={drawer} timezone={tz} />
          </div>
        </KeepShown>
      ),
    });
  }

  // ------------------------------------------------------------ the people
  const anyoneWorks = boards.some((b) => b.length > 0);
  if (sees.staff && anyoneWorks) {
    const due = dueIn(boards, new Date(nowIso));
    const few = firstFew(due.late);
    const later = due.later
      .slice(0, 4)
      .map((p) => (p.shiftStarts ? `${p.name} ${time(p.shiftStarts)}` : p.name));
    steps.push({
      key: "staff",
      title: t("Everyone due in is in"),
      state: due.late.length ? "left" : "done",
      say: due.late.length
        ? t("{n} due in and not clocked in yet.", { n: due.late.length })
        : due.inNow.length
          ? t("{n} clocked in.", { n: due.inNow.length })
          : t("Nobody is due in yet."),
      items: few.shown.map(
        (p) => `${p.name} · ${t("due {when}", { when: time(p.shiftStarts ?? nowIso) })}`,
      ),
      more: few.more,
      note: later.length
        ? t("Due later: {names}.", {
            names: `${later.join(", ")}${due.later.length > later.length ? "…" : ""}`,
          })
        : undefined,
      go: due.late.length ? [{ href: "/pos", label: t("Clock in on the till") }] : undefined,
    });
  }

  // ------------------------------------------------------------ what to make
  if (plan) {
    const make = toMake(plan.recipes);
    const units = new Map(items.map((i) => [i.id, i]));
    const short = plan.ingredients.filter((i) => i.short > 0);
    const few = firstFew(make);
    steps.push({
      key: "make",
      title: t("What to make today"),
      state: make.length ? "left" : "done",
      say: make.length
        ? t("{n} recipe(s) to make, {batches} batch(es) in all.", {
            n: make.length,
            batches: make.reduce((s, r) => s + r.batches, 0),
          })
        : plan.recipes.length
          ? t("Nothing needs making: the stock covers the day.")
          : t("Nothing is made in batches here."),
      items: few.shown.map(
        (r) =>
          `${r.recipe} · ${t("{n} batch(es): {qty}", {
            n: r.batches,
            qty: showNice(new Decimal(r.makes), units.get(r.itemId), r.baseUnit, t),
          })}`,
      ),
      more: few.more,
      note: short.length
        ? t("Short for the plan: {items}.", {
            items: short.map((i) => i.item).join(", "),
          })
        : undefined,
      go: plan.recipes.length
        ? [{ href: "/production#plan", label: t("Open the plan") }]
        : undefined,
    });
  }

  // ------------------------------------------------------------ deliveries
  if (sees.stock) {
    const here = at ? pos.orders.filter((o) => o.locationId === at) : pos.orders;
    const due = deliveriesDue(here, today);
    const few = firstFew(due);
    steps.push({
      key: "deliveries",
      title: t("Deliveries due"),
      state: due.length ? "left" : "done",
      say: due.length
        ? t("{n} order(s) due today or late.", { n: due.length })
        : t("No delivery is due today."),
      items: few.shown.map((o) =>
        [
          t("Order {no}", { no: o.poNo }),
          o.supplier,
          t("due {when}", { when: o.expectedOn === today ? t("Today") : (o.expectedOn ?? "") }),
        ].join(" · "),
      ),
      more: few.more,
      note: due.length
        ? t("Receive each against its order on Purchasing as it comes in.")
        : undefined,
      go: due.length ? [{ href: "/purchasing", label: t("Receive them") }] : undefined,
    });

    // -------------------------------------------------------- what to buy
    const onOrder = new Set(
      here
        .filter((o) => o.status === "draft" || o.status === "approved" || o.status === "sent")
        .flatMap((o) => o.lines.map((l) => l.itemId)),
    );
    const low = board.filter((r) => r.isLow || r.isNegative);
    const notOrdered = low.filter((r) => !onOrder.has(r.itemId));
    const fewLow = firstFew(notOrdered);
    steps.push({
      key: "buy",
      title: t("Nothing low without an order"),
      state: notOrdered.length ? "left" : "done",
      say: notOrdered.length
        ? t("{n} item(s) low and not on any order yet.", { n: notOrdered.length })
        : low.length
          ? t("{n} item(s) low, all on order.", { n: low.length })
          : t("Everything is above its reorder level."),
      items: fewLow.shown.map(
        (r) =>
          `${r.name} · ${fmtQty(r.onHandBase)}${
            r.reorderBase === null ? "" : ` / ${fmtQty(r.reorderBase)}`
          } ${unitName(r.unit, t)}`,
      ),
      more: fewLow.more,
      go: notOrdered.length
        ? [{ href: "/purchasing/buying-list", label: t("What to buy") }]
        : undefined,
    });
  }

  // ------------------------------------------------------------ the alerts
  if (sees.alerts) {
    const waiting = waitingAlerts(alerts);
    const few = firstFew(waiting.red);
    steps.push({
      key: "alerts",
      title: t("Red alerts answered"),
      state: waiting.red.length ? "left" : "done",
      say: waiting.red.length
        ? t("{n} red alert(s) wait for an answer.", { n: waiting.red.length })
        : t("No red alert waits."),
      items: few.shown.map((a) => msg(a.title)),
      more: few.more,
      note: waiting.orange.length
        ? t("{n} orange alert(s) can wait for a quiet moment.", { n: waiting.orange.length })
        : undefined,
      go: waiting.red.length
        ? [{ href: "/dashboard#needs-you", label: t("Answer them") }]
        : undefined,
    });
  }

  const p = progress(steps.map((s) => s.state));
  const ring = 2 * Math.PI * 16;

  // ------------------------------------------------------------ the day ahead
  const c = brief?.calculations;
  const ahead = [
    target > 0 ? t("Today's target: {amount}.", { amount: fmtIQD(target) }) : null,
    c && c.sameDayLastWeek > 0
      ? t("Last {weekday}: {amount}.", { weekday: t(weekday), amount: fmtIQD(c.sameDayLastWeek) })
      : null,
    c && c.usualForTheWeekday !== null
      ? t("A usual {weekday} (the four before): {amount}.", {
          weekday: t(weekday),
          amount: fmtIQD(c.usualForTheWeekday),
        })
      : null,
  ].filter((x): x is string => x !== null);

  return (
    <div className="grid eod" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.startOfDay")}</h1>
        <span className="sc">
          {t(weekday)} {today} · {time(nowIso)}
          {profile.worksAtName ? ` · ${profile.worksAtName}` : ""}
        </span>
      </div>

      <section
        className={`card eod-head sod-head${p.ready ? " ready" : ""}`}
        data-testid="sod-progress"
        data-done={p.done}
        data-total={p.total}
      >
        <svg className="eod-ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle className="eod-ring-track" cx="20" cy="20" r="16" />
          <circle
            className="eod-ring-done"
            cx="20"
            cy="20"
            r="16"
            strokeDasharray={`${p.total ? (ring * p.done) / p.total : 0} ${ring}`}
            transform="rotate(-90 20 20)"
          />
        </svg>
        <div>
          <h2>
            {p.ready
              ? t("Everything is ready: open the doors.")
              : t("{done} of {total} done", { done: p.done, total: p.total })}
          </h2>
          <p className="muted">
            {p.ready
              ? t("The till is ready for the first customer.")
              : t(
                  "Work down the list: each step opens where it is done, and is ticked here once it is.",
                )}
          </p>
        </div>
      </section>

      <ol className="eod-steps" aria-label={t("The steps")}>
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={`card eod-step ${s.state}`}
            data-step={s.key}
            data-state={s.state}
            data-testid={`sod-${s.key}`}
          >
            <span className="eod-dot" aria-hidden="true">
              {s.state === "done" ? <Icon name="check" size={16} /> : i + 1}
            </span>
            <div className="eod-body">
              <h3>
                {s.title}{" "}
                <span className="sr-only">{s.state === "done" ? t("Done") : t("Still to do")}</span>
              </h3>
              <p className="eod-say">{s.say}</p>
              {s.items.length > 0 && (
                <ul className="eod-items">
                  {s.items.map((x, j) => (
                    <li key={j}>{x}</li>
                  ))}
                  {s.more > 0 && <li className="muted">{t("…and {n} more", { n: s.more })}</li>}
                </ul>
              )}
              {s.note && <p className="muted eod-note">{s.note}</p>}
              {s.extra}
            </div>
            {s.go && (
              <div className="eod-go">
                {s.go.map((g) => (
                  <Link key={g.href} className="btn-soft" href={g.href}>
                    {g.label}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      {sees.alerts && (
        <section className="panel" data-testid="sod-ahead">
          <div className="panel-h">
            <h3>{t("The day ahead")}</h3>
            <div className="sp">
              <Link className="drill" href="/dashboard">
                {t("nav.dashboard")}
              </Link>
            </div>
          </div>
          <div className="panel-b">
            {ahead.length ? (
              <ul className="eod-items sod-ahead">
                {ahead.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {t("No sales yet to compare the day with.")}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
