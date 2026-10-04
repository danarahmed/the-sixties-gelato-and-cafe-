import Link from "next/link";
import type { ReactNode } from "react";
import { getDir, getLocale, getMsg, getT } from "@/lib/i18n/server";
import { isolateDates, wholeDates } from "@/lib/i18n/core";
import { has, requirePermission } from "@/lib/auth/session";
import { getOpenBills } from "@/lib/db/pos";
import { getCashSessions, getDrawerState } from "@/lib/db/cash";
import { getClockBoard } from "@/lib/db/staff";
import { getLossesWaiting } from "@/lib/db/rules";
import { getCurrentAlerts, getDailyBrief } from "@/lib/db/alerts";
import { getCardTakings, getPlatformMoney } from "@/lib/db/settlements";
import { getPaymentTakings } from "@/lib/db/reports";
import { getSalesAnalysis } from "@/lib/db/analysis";
import { namesIn } from "@/lib/analysis";
import { getPlaces, tillChoice } from "@/lib/place";
import { businessToday, dateTimeIn } from "@/lib/dates";
import { fmtIQD, fmtQty, tenderLabel, unitName } from "@/lib/format";
import { pctText } from "@/lib/insights";
import {
  closedOn,
  firstFew,
  openDrawers,
  progress,
  stillIn,
  waitingAlerts,
  type StepState,
} from "@/lib/endofday";
import { DrawerPanel } from "@/components/cash/DrawerPanel";
import { KeepShown } from "@/components/KeepShown";
import { ShareBar } from "@/components/charts/ShareBar";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { DaySlipButton, type DaySlipData, type DaySlipPart } from "@/components/endofday/DaySlip";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const WEEKDAY = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });

interface Step {
  key: string;
  title: string;
  state: StepState;
  /** What it comes to now, in a sentence. */
  say: string;
  /** What is still open, the first few. */
  items: string[];
  more: number;
  note?: string;
  /** Where its work is done. */
  go?: { href: string; label: string }[];
  /** Its work, done here. */
  extra?: ReactNode;
}

/**
 * The end of the day, step by step: the bills, the people clocked in, the
 * drawers, the losses waiting, the card and platform money and the red
 * alerts, each ticked once nothing of it is left, and each one tap from where
 * its work is done (the drawer is closed right here). Then the day in
 * numbers, to print and keep. Nothing on it is new: it reads what the screens
 * behind it read, and each step says it in a sentence.
 */
export default async function EndOfDayPage() {
  const profile = await requirePermission("day.close");
  const [t, msg, locale, dir] = await Promise.all([getT(), getMsg(), getLocale(), getDir()]);
  const tz = profile.timezone;
  const today = businessToday(tz);
  const now = dateTimeIn(tz, new Date().toISOString());
  const time = (iso: string) => dateTimeIn(tz, iso).slice(11, 16);
  const dayOf = (iso: string) => dateTimeIn(tz, iso).slice(0, 10);
  const weekday = WEEKDAY(today);
  // Someone who works at one place closes that place's day; anyone else, the café's.
  const place = profile.worksAt;
  const sees = {
    bills: has(profile, "sale.create"),
    staff:
      has(profile, "sale.create") ||
      has(profile, "staff.manage") ||
      has(profile, "attendance.edit"),
    losses: has(profile, "waste.approve"),
    alerts: has(profile, "profit.view"),
    money: has(profile, "cost.view"),
    drawer: has(profile, "cash.session") || has(profile, "cash.session.force"),
  };
  const [{ at: tillAt }, places] = await Promise.all([tillChoice(), getPlaces()]);
  const [bills, sessions, boards, losses, alerts, card, platforms, takings, brief, drawer, sold] =
    await Promise.all([
      sees.bills ? getOpenBills(place) : Promise.resolve([]),
      getCashSessions(today, today, place),
      sees.staff ? Promise.all(places.map((p) => getClockBoard(p.id))) : Promise.resolve([]),
      sees.losses ? getLossesWaiting() : Promise.resolve([]),
      sees.alerts ? getCurrentAlerts() : Promise.resolve([]),
      sees.money ? getCardTakings() : Promise.resolve(null),
      sees.money ? getPlatformMoney() : Promise.resolve(null),
      sees.money ? getPaymentTakings(today, today, place) : Promise.resolve([]),
      sees.alerts ? getDailyBrief(today) : Promise.resolve(null),
      sees.drawer ? getDrawerState(tillAt) : Promise.resolve(null),
      // What sold the most today, for the day's slip (round six).
      sees.money
        ? getSalesAnalysis({
            from: today,
            to: today,
            by: "product",
            then: null,
            channel: null,
            location: place,
            category: null,
            cashier: null,
          })
        : Promise.resolve(null),
    ]);
  const severalPlaces = places.length > 1;
  const waiting = waitingAlerts(alerts);
  const steps: Step[] = [];

  // ------------------------------------------------------------ the bills
  if (sees.bills) {
    const owed = bills.reduce((s, b) => s + b.total, 0);
    const few = firstFew(bills);
    steps.push({
      key: "bills",
      title: t("Bills paid"),
      state: bills.length ? "left" : "done",
      say: bills.length
        ? t("{n} bill(s) still open, {amount} in all.", { n: bills.length, amount: fmtIQD(owed) })
        : t("No bill is open."),
      items: few.shown.map((b) => {
        const name =
          b.tableName && b.label
            ? `${b.tableName} · ${b.label}`
            : (b.tableName ?? b.label ?? t("Bill"));
        return `${name} · ${fmtIQD(b.total)} · ${t("since {time}", { time: time(b.openedAt) })}`;
      }),
      more: few.more,
      note: bills.length
        ? t(
            "A bill left open is paid in the next session; one that will not be paid is cancelled by a manager, with the reason.",
          )
        : undefined,
      go: bills.length ? [{ href: "/pos", label: t("Open the till") }] : undefined,
    });
  }

  // ------------------------------------------------------------ the people
  const anyoneWorks = boards.some((b) => b.length > 0);
  if (sees.staff && anyoneWorks) {
    const inNow = stillIn(boards);
    const few = firstFew(inNow);
    steps.push({
      key: "staff",
      title: t("Everyone clocked out"),
      state: inNow.length ? "left" : "done",
      say: inNow.length
        ? t("{n} still clocked in.", { n: inNow.length })
        : t("Nobody is clocked in."),
      items: few.shown.map((p) => `${p.name} · ${t("since {time}", { time: time(p.inSince) })}`),
      more: few.more,
      note: inNow.length
        ? t(
            "Each clocks out on the till as they leave; a manager corrects forgotten hours on Staff.",
          )
        : undefined,
      go: inNow.length ? [{ href: "/staff#attendance", label: t("Open the hours") }] : undefined,
    });
  }

  // ------------------------------------------------------------ the drawers
  {
    const open = openDrawers(sessions);
    const closed = closedOn(sessions, today, dayOf);
    const few = firstFew(open);
    const counts =
      closed.counted === 0
        ? null
        : closed.difference === 0
          ? t("Counted today: {n}, and they agreed.", { n: closed.counted })
          : closed.difference < 0
            ? t("Counted today: {n}, {amount} short in all.", {
                n: closed.counted,
                amount: fmtIQD(-closed.difference),
              })
            : t("Counted today: {n}, {amount} over in all.", {
                n: closed.counted,
                amount: fmtIQD(closed.difference),
              });
    const uncounted = closed.closed - closed.counted;
    const here = drawer?.session && (drawer.mayClose || drawer.mayForce);
    steps.push({
      key: "tills",
      title: t("Drawers closed and counted"),
      state: open.length ? "left" : "done",
      say: open.length
        ? t("{n} drawer(s) still open.", { n: open.length })
        : [t("Every drawer is closed."), counts].filter(Boolean).join(" "),
      items: few.shown.map((s) =>
        [
          t("Session {no}", { no: s.no ?? "" }),
          s.cashier,
          t("since {time}", { time: time(s.openedAt) }),
          severalPlaces ? s.location : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      more: few.more,
      note:
        uncounted > 0
          ? t("{n} closed without a count: the next opening count finds what it held.", {
              n: uncounted,
            })
          : open.length
            ? t(
                "Count each drawer as it closes: what it should hold is shown once the count is in.",
              )
            : undefined,
      go: open.length ? [{ href: "/sales/sessions", label: t("All sessions") }] : undefined,
      extra: drawer ? (
        <KeepShown show={Boolean(here)}>
          <div className="eod-drawer" data-testid="eod-drawer">
            <DrawerPanel state={drawer} timezone={tz} />
          </div>
        </KeepShown>
      ) : undefined,
    });
  }

  // ------------------------------------------------------------ the losses
  if (sees.losses) {
    const few = firstFew(losses);
    const value = losses.reduce((s, l) => s + (l.value ?? 0), 0);
    steps.push({
      key: "losses",
      title: t("Losses approved"),
      state: losses.length ? "left" : "done",
      say: losses.length
        ? value > 0
          ? t("{n} loss(es) wait for a manager, {amount} in all.", {
              n: losses.length,
              amount: fmtIQD(value),
            })
          : t("{n} loss(es) wait for a manager.", { n: losses.length })
        : t("No loss waits for approval."),
      items: few.shown.map((l) =>
        [
          l.unit
            ? `${fmtQty(l.qty)} ${unitName(l.unit, t)} ${l.item}`
            : `×${fmtQty(l.qty)} ${l.item}`,
          l.recordedBy,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      more: few.more,
      note: losses.length
        ? t("A manager other than the one who recorded it approves each, or reverses it.")
        : undefined,
      go: losses.length
        ? [{ href: "/inventory#losses-waiting", label: t("Approve them") }]
        : undefined,
    });
  }

  // ------------------------------------------------------------ the money
  if (sees.money) {
    const cardToday = takings.find((r) => r.method === "card")?.net ?? 0;
    const cardWaiting = (card?.days ?? []).reduce((s, d) => s + d.amount, 0);
    const lines = [
      cardToday > 0
        ? t("Card today: {amount}. Check it against the terminal's own total for the day.", {
            amount: fmtIQD(cardToday),
          })
        : t("No card payments today."),
      cardWaiting > 0
        ? t("Card takings still to reach the bank: {amount} over {n} day(s).", {
            amount: fmtIQD(cardWaiting),
            n: card?.days.length ?? 0,
          })
        : null,
      platforms && platforms.waiting > 0
        ? t("Delivery platforms still owe {amount} for {n} order(s).", {
            amount: fmtIQD(platforms.waiting),
            n: platforms.orders.length,
          })
        : null,
    ].filter((x): x is string => x !== null);
    steps.push({
      key: "money",
      title: t("Card and platform money"),
      state: waiting.money.length ? "left" : "done",
      say: lines.join(" "),
      items: waiting.money.slice(0, 3).map((a) => msg(a.title)),
      more: Math.max(waiting.money.length - 3, 0),
      note: waiting.money.length
        ? t("Late: settle it on Sales, or record what the platform paid on Delivery Platforms.")
        : t("Nothing is late."),
      go: [
        { href: "/sales#card", label: t("Card Takings") },
        ...(platforms && platforms.platforms.length
          ? [{ href: "/platforms", label: t("nav.platforms") }]
          : []),
      ],
    });
  }

  // ------------------------------------------------------------ the alerts
  if (sees.alerts) {
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

  // ------------------------------------------------------------ the day
  const f = brief?.facts;
  const c = brief?.calculations;
  const paid = takings
    .filter((r) => r.net > 0)
    .sort((a, b) => b.net - a.net)
    .map((r) => ({
      key: r.method,
      label: t(tenderLabel(r.method)),
      value: r.net,
      valueText: fmtIQD(r.net),
      sub: t("{share}% of net sales", {
        share:
          pctText(
            r.net,
            takings.reduce((s, x) => s + Math.max(x.net, 0), 0),
          ) ?? 0,
      }),
    }));
  const reports = `/reports?from=${today}&to=${today}`;
  const orders = `/orders?from=${today}&to=${today}`;

  // ------------------------------------------------------------ the day's slip
  // The close on the receipt printer, to keep with the cash (round six): what
  // the page says, each part only for those the page shows it to.
  const drawersNow = openDrawers(sessions);
  const countedToday = closedOn(sessions, today, dayOf);
  const top = sold ? [...sold.rows].sort((a, b) => b.qty - a.qty || b.net - a.net).slice(0, 5) : [];
  const parts: (DaySlipPart | null)[] = [
    f
      ? {
          key: "sales",
          title: t("Sales"),
          rows: [
            { label: t("dash.orders"), value: String(f.sales) },
            ...(f.sales > 0
              ? [
                  {
                    label: t("An order on average"),
                    value: fmtIQD(Math.round(f.netSales / f.sales)),
                  },
                ]
              : []),
            { label: t("Voids and refunds"), value: fmtIQD(f.voided + f.refunded) },
            { label: t("Waste"), value: fmtIQD(f.waste) },
          ],
        }
      : null,
    paid.length
      ? {
          key: "paid",
          title: t("How it was paid"),
          rows: paid.map((x) => ({ label: x.label, value: x.valueText })),
        }
      : null,
    {
      key: "drawers",
      title: t("Drawers"),
      rows: [
        { label: t("Counted today"), value: String(countedToday.counted) },
        ...(countedToday.counted > 0
          ? [
              {
                label: t("Against what they should hold"),
                value:
                  countedToday.difference === 0
                    ? t("No difference")
                    : countedToday.difference < 0
                      ? t("{amount} short", { amount: fmtIQD(-countedToday.difference) })
                      : t("{amount} over", { amount: fmtIQD(countedToday.difference) }),
              },
            ]
          : []),
        ...(drawersNow.length
          ? [{ label: t("Still open"), value: String(drawersNow.length) }]
          : []),
      ],
    },
    top.length
      ? {
          key: "top",
          title: t("What sold the most"),
          rows: top.map((r) => ({ label: namesIn(r.names, locale), value: `×${fmtQty(r.qty)}` })),
        }
      : null,
  ];
  const slip: DaySlipData = {
    businessName: profile.businessName,
    kind: t("The day's close"),
    meta: [
      // Kept left to right among Arabic or Kurdish words, as a phrase's dates are.
      {
        label: t("Day"),
        value: `${t(weekday)} ${dir === "rtl" ? isolateDates(today) : wholeDates(today)}`,
      },
      { label: t("Printed at"), value: now.slice(11, 16) },
      ...(profile.worksAtName ? [{ label: t("Place"), value: profile.worksAtName }] : []),
      { label: t("Printed by"), value: profile.name },
    ],
    total: f ? { label: t("Net sales"), value: fmtIQD(f.netSales) } : null,
    parts: parts.filter((x): x is DaySlipPart => x !== null),
    checksTitle: t("The close, step by step"),
    checks: steps.map((s) => ({
      done: s.state === "done",
      text: s.state === "done" ? s.title : s.say,
    })),
    sign: [t("Closed by"), t("Checked by")],
  };

  return (
    <div className="grid eod" style={{ gap: 18 }}>
      <PrintHead
        business={profile.businessName}
        title={t("nav.endOfDay")}
        period={today}
        timezone={tz}
      />
      <div className="phead">
        <h1>{t("nav.endOfDay")}</h1>
        <span className="sc">
          {t(weekday)} {today} · {now.slice(11, 16)}
          {profile.worksAtName ? ` · ${profile.worksAtName}` : ""}
        </span>
        <div className="sp no-print eod-prints">
          <PrintButton />
          <DaySlipButton slip={slip} label={t("Print the slip for the till")} />
        </div>
      </div>

      <section
        className={`card eod-head${p.ready ? " ready" : ""}`}
        data-testid="eod-progress"
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
              ? t("Everything is done: the day can close.")
              : t("{done} of {total} done", { done: p.done, total: p.total })}
          </h2>
          <p className="muted">
            {p.ready
              ? t("Print the day below to keep it, or save it as a PDF.")
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
            data-testid={`eod-${s.key}`}
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
                  {/* In the page's direction: a line that starts with a name in
                      English is still a sentence in the reader's language. */}
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
              <div className="eod-go no-print">
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

      {f && c && (
        <section className="panel" id="the-day" data-testid="eod-day">
          <div className="panel-h">
            <h3>{t("The day in numbers")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("Today so far, as the books have it")}
            </span>
            <div className="sp no-print">
              <Link className="drill" href={reports}>
                {t("Today's reports")}
              </Link>
            </div>
          </div>
          <div className="panel-b grid" style={{ gap: 14 }}>
            <div className="kpis">
              <Link href={orders} className="card stat">
                <span className="label">{t("Net sales")}</span>
                <span className="value" data-testid="eod-net">
                  {fmtIQD(f.netSales)}
                </span>
                <span className="delta">{t("{n} order(s)", { n: f.sales })}</span>
              </Link>
              <Link href={reports} className="card stat">
                <span className="label">{t("dash.grossProfit")}</span>
                <span className={`value${c.grossProfit < 0 ? " err" : ""}`}>
                  {fmtIQD(c.grossProfit)}
                </span>
                <span className="delta">
                  {c.grossMarginPercent === null
                    ? t("after waste and every other cost of sales")
                    : t("{pct}% of net sales", {
                        pct: Number(c.grossMarginPercent.toFixed(1)),
                      })}
                </span>
              </Link>
              <Link href={orders} className="card stat">
                <span className="label">{t("Voids and refunds")}</span>
                <span className="value">{fmtIQD(f.voided + f.refunded)}</span>
                <span className="delta">
                  {t("{voids} void(s), {refunds} refund(s)", {
                    voids: f.voids,
                    refunds: f.refunds,
                  })}
                </span>
              </Link>
              <Link href={`${reports}#losses`} className="card stat">
                <span className="label">{t("Waste")}</span>
                <span className="value">{fmtIQD(f.waste)}</span>
                <span className="delta">{t("at what it cost")}</span>
              </Link>
            </div>
            {(c.sameDayLastWeek > 0 || c.usualForTheWeekday !== null) && (
              <p className="muted eod-against">
                {[
                  c.sameDayLastWeek > 0
                    ? c.changeFromLastWeekPercent === null
                      ? t("Last {weekday}: {amount}.", {
                          weekday: t(weekday),
                          amount: fmtIQD(c.sameDayLastWeek),
                        })
                      : t("Last {weekday}: {amount} ({change} since).", {
                          weekday: t(weekday),
                          amount: fmtIQD(c.sameDayLastWeek),
                          change: `${c.changeFromLastWeekPercent > 0 ? "+" : ""}${Number(c.changeFromLastWeekPercent.toFixed(1))}%`,
                        })
                    : null,
                  c.usualForTheWeekday !== null
                    ? t("A usual {weekday} (the four before): {amount}.", {
                        weekday: t(weekday),
                        amount: fmtIQD(c.usualForTheWeekday),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            )}
            {paid.length > 0 && (
              <div>
                <h4 className="eod-h4">{t("How it was paid")}</h4>
                <ShareBar parts={paid} label={t("How it was paid")} />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
