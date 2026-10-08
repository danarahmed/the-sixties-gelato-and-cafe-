import Link from "next/link";
import { Fragment } from "react";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { getLocale, getMsg, getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
import { has, requirePermission } from "@/lib/auth/session";
import { getDailySales, getVendorBook, ageBills, salesTotals } from "@/lib/db/books";
import {
  getDocumentProblems,
  getExceptions,
  getLossReport,
  getLegacyUnposted,
  getMenuCosting,
  getProfitAndLoss,
  getProfitAndLossByPlace,
  getReconciliation,
  getSizesAndAddons,
  getPaymentTakings,
  getUncostedSales,
  pnlTotals,
} from "@/lib/db/reports";
import { LegacyPostings } from "@/components/books/LegacyPostings";
import { Sayings, type Saying } from "@/components/Sayings";
import { StatusMark } from "@/components/Icon";
import { BarList } from "@/components/charts/BarList";
import { ShareBar } from "@/components/charts/ShareBar";
import { direction, percent } from "@/lib/dashboard";
import { change, largestExpense, pctText, previousPeriod, spending } from "@/lib/insights";
import { EXCEPTION_LABEL, NO_ONE, exceptionsByPerson, type ExceptionKind } from "@/lib/exceptions";
import { fmtIQD, fmtQty, movementLabel, tenderLabel, unitName } from "@/lib/format";
import { getDollarsReport } from "@/lib/db/fx";
import { getPurchasingReport } from "@/lib/db/purchasing";
import { getProductionReport } from "@/lib/db/production";
import { getStaffReport } from "@/lib/db/staff";
import { getCustomerReport } from "@/lib/db/customers";
import { getPurchases } from "@/lib/db/analysis";
import { itemNameIn } from "@/lib/analysis";
import { monthText, splitMinutes } from "@/lib/staff";
import { LOSS_ACCOUNT_NAME, giveawayLabel, kindShare } from "@/lib/losses";
import { CREDIT_KIND_LABEL, orderStage, STAGE_LABEL } from "@/lib/purchasing";
import { fmtRate, fmtUSD } from "@/lib/fx";
import { getChannelNames } from "@/lib/db/channels";
import { getPaymentMethodReport } from "@/lib/db/paymentMethods";
import { getCafePlaces } from "@/lib/place";
import { pnlByPlace } from "@/lib/pnl";
import {
  addDays,
  businessToday,
  dateIn,
  dateTimeIn,
  daysBetween,
  monthEnd,
  monthStart,
  parseDay,
  yearStart,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

// Where dollars were exchanged from and their dinars went (0043): phrases, shown through t().
const PLACE_LABEL: Record<string, string> = {
  till: "the till",
  safe: "the safe",
  bank: "the bank",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const msg = await getMsg();
  const locale = await getLocale();
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const from = parseDay(sp.from, monthStart(today));
  const to = parseDay(sp.to, today);
  const seesProfit = has(profile, "profit.view");
  const seesExceptions = has(profile, "audit.view");
  // The hours (0049): for those who keep the staff, their hours or their pay, a year at most.
  const seesStaff =
    has(profile, "staff.manage") || has(profile, "attendance.edit") || has(profile, "payroll.view");
  const staffDates = from <= to && daysBetween(from, to) <= 366;
  // Customers and their points (0050): for those who see customers.
  const seesCustomers = has(profile, "customer.view");
  // The place the reports are read for (0057): someone who works at one place
  // reads theirs; someone who works everywhere, the café's or the one chosen.
  const cafePlaces = await getCafePlaces();
  const place =
    profile.worksAt ??
    (typeof sp.place === "string" && cafePlaces.some((p) => p.id === sp.place) ? sp.place : null);
  const placeName = cafePlaces.find((p) => p.id === place)?.name ?? profile.worksAtName;
  const choosesPlace = profile.worksAt === null && cafePlaces.length > 1;
  const withPlace = place && profile.worksAt === null ? `&place=${place}` : "";
  const before = previousPeriod(from, to);
  const days = from <= to ? daysBetween(from, to) + 1 : 0;

  const [
    pnl,
    rec,
    sales,
    book,
    allMenu,
    unposted,
    uncosted,
    exceptions,
    channels,
    sized,
    takings,
    dollars,
    buying,
    made,
    lost,
    staff,
    loyalty,
    bought,
    byPlaceRows,
    pnlBefore,
    methodRows,
  ] = await Promise.all([
    seesProfit ? getProfitAndLoss(from, to, place) : Promise.resolve([]),
    getReconciliation(to),
    getDailySales(from, to, place),
    getVendorBook(today),
    getMenuCosting(),
    getLegacyUnposted(),
    getUncostedSales(from, to, place),
    seesExceptions ? getExceptions(from, to, 20_000, place) : Promise.resolve([]),
    getChannelNames(),
    getSizesAndAddons(from, to, place),
    getPaymentTakings(from, to, place),
    getDollarsReport(from, to, place),
    getPurchasingReport(from, to, place),
    getProductionReport(from, to, place),
    getLossReport(from, to, place),
    seesStaff && staffDates ? getStaffReport(from, to, place) : Promise.resolve(null),
    seesCustomers && from <= to ? getCustomerReport(from, to, place) : Promise.resolve(null),
    // What came in, by supplier and by item (0051).
    from <= to ? getPurchases(from, to, place) : Promise.resolve(null),
    // Each place's profit and loss side by side (0056), when the café's is read.
    seesProfit && place === null ? getProfitAndLossByPlace(from, to) : Promise.resolve([]),
    // The days just before, as many: what the period is compared with.
    seesProfit && from <= to
      ? getProfitAndLoss(before.from, before.to, place)
      : Promise.resolve([]),
    // Each of the café's own ways to pay (0069); none before it is applied.
    from <= to ? getPaymentMethodReport(from, to, place) : Promise.resolve([]),
  ]);
  // The ways to pay with something in the dates; each by its name in place of their one row.
  const methodsUsed = methodRows.filter(
    (m) => m.taken > 0 || m.refunded > 0 || (m.movedOut ?? 0) > 0 || (m.fees ?? 0) > 0,
  );
  const paidWays = [
    ...takings
      .filter((r) => r.method !== "other" || methodsUsed.length === 0)
      .map((r) => ({ key: r.method, name: t(tenderLabel(r.method)), net: r.net })),
    ...methodsUsed.map((m) => ({ key: `other:${m.method}`, name: m.name, net: m.net })),
  ];
  // The menu as it sells today: a platform out of use sells nothing.
  const menu = allMenu.filter((m) =>
    channels.channels.some((c) => c.code === m.channel && c.active),
  );
  const byPerson = exceptionsByPerson(exceptions);
  const toReview = exceptions.filter((e) => e.needsReview).length;
  const kinds = Object.keys(EXCEPTION_LABEL) as ExceptionKind[];
  const uncostedNet = uncosted.reduce((sum, u) => sum + u.net, 0);
  const totals = pnlTotals(pnl);
  // With more than one place, each one's column, the shared and the café's.
  const byPlace =
    seesProfit && place === null && choosesPlace ? pnlByPlace(byPlaceRows, cafePlaces) : null;
  const ageing = ageBills(book.openBills);
  const unreconciled = rec.filter((r) => r.difference !== 0);
  // The records the last check counts, each to be looked into (0038).
  const problems = rec.some((r) => r.key === "documents" && r.difference !== 0)
    ? await getDocumentProblems(to)
    : [];

  const byChannel = new Map<string, typeof sales>();
  for (const r of sales) byChannel.set(r.channel, [...(byChannel.get(r.channel) ?? []), r]);
  const allChannels = salesTotals(sales);

  // Each reconciliation line opens its two sides: the records, and the ledger.
  const recLinks: Record<string, { records: string; accounts: string }> = {
    inventory: { records: "/inventory", accounts: "1200" },
    payables: { records: "/vendors", accounts: "2000" },
    grni: { records: "/purchasing", accounts: "2050" },
    sales: { records: `/orders?from=${monthStart(to)}&to=${to}`, accounts: "4000,4100,4200" },
    card: { records: "/sales#card", accounts: "1010" },
    platform: { records: "/platforms#owed", accounts: "1100" },
    drawer: { records: "/sales/sessions", accounts: "1000" },
    safe: { records: "/sales", accounts: "1005" },
    transit: { records: "/inventory/transfers", accounts: "1210" },
  };
  // Where each kind of record is found, to look into it.
  const problemLink = (p: { kind: string; recordId: string; at: string }) => {
    const day = dateIn(profile.timezone, new Date(p.at));
    switch (p.kind) {
      case "sale":
      case "void":
      case "refund":
        return `/orders?from=${day}&to=${day}`;
      case "delivery":
      case "correction":
      case "return":
        return "/purchasing";
      case "bill":
      case "payment":
      case "credit":
        return "/vendors";
      case "expense":
        return "/expenses";
      case "stock":
        return "/inventory";
      case "count":
        return "/count";
      case "cash":
        return "/sales";
      case "session":
        return `/sales/sessions/${p.recordId}`;
      case "card":
        return "/sales#card";
      case "platform":
        return "/platforms#statement";
      case "transfer":
        return "/inventory/transfers";
      default:
        return `/journals?from=${day}&to=${day}`;
    }
  };
  const problemKind: Record<string, string> = {
    sale: t("Sale"),
    void: t("Void"),
    refund: t("Refund"),
    delivery: t("Delivery"),
    correction: t("Delivery correction"),
    bill: t("Bill"),
    payment: t("Payment"),
    expense: t("Expense"),
    stock: t("Stock"),
    count: t("Stock count"),
    cash: t("Cash moved"),
    session: t("Drawer session"),
    dollars: t("Dollars"),
    return: t("Return to a supplier"),
    credit: t("Supplier's credit"),
    card: t("Card settlement"),
    platform: t("Platform statement"),
    transfer: t("Transfer"),
    journal: t("Journal"),
  };
  const ledger = (accounts: string, f: string, tt: string, pnl = false) =>
    `/journals?account=${accounts}&from=${f}&to=${tt}${pnl ? "&pnl=1" : ""}`;

  // ------------------------------------------------ the period at a glance
  // Each figure against the days just before, as many; in words, with what
  // to do about it; and where each 1,000 IQD of net revenue went.
  const totalsBefore = pnlTotals(pnlBefore);
  const spend = seesProfit ? spending(pnl) : null;
  const marginNow = totals.revenue > 0 ? totals.grossProfit / totals.revenue : null;
  const marginBefore =
    totalsBefore.revenue > 0 ? totalsBefore.grossProfit / totalsBefore.revenue : null;
  const netShare = totals.revenue > 0 ? totals.net / totals.revenue : null;
  const netShareBefore = totalsBefore.revenue > 0 ? totalsBefore.net / totalsBefore.revenue : null;
  const mark = (dir: "up" | "down" | "same") => (dir === "up" ? "▲" : dir === "down" ? "▼" : "●");
  /** Against the days before, in words: more is better for these. */
  const versus = (c: number | null) => {
    const dir = direction(c);
    if (dir === null || c === null) return null;
    return (
      <span className={`delta ${dir}`}>
        <span aria-hidden="true">{mark(dir)}</span>{" "}
        {dir === "up"
          ? t("{pct}% more than the {n} day(s) before", { pct: percent(c), n: days })
          : dir === "down"
            ? t("{pct}% less than the {n} day(s) before", { pct: percent(c), n: days })
            : t("About as the {n} day(s) before", { n: days })}
      </span>
    );
  };
  /** A share of net revenue against the days before, in points: within one either way is as before. */
  const points = (now: number | null, then: number | null) => {
    if (now === null || then === null) return null;
    const d = Math.round((now - then) * 100);
    const dir = d >= 1 ? "up" : d <= -1 ? "down" : "same";
    return (
      <span className={`delta ${dir}`}>
        <span aria-hidden="true">{mark(dir)}</span>{" "}
        {dir === "up"
          ? t("{n} point(s) more than the {days} day(s) before", { n: Math.abs(d), days })
          : dir === "down"
            ? t("{n} point(s) less than the {days} day(s) before", { n: Math.abs(d), days })
            : t("About as the {n} day(s) before", { n: days })}
      </span>
    );
  };
  const ofRevenue = (n: number) =>
    totals.revenue > 0
      ? t("{pct}% of net revenue", { pct: pctText(n, totals.revenue) ?? "0" })
      : null;
  const glance =
    seesProfit && from <= to
      ? [
          {
            label: t("Net revenue"),
            value: fmtIQD(totals.revenue),
            href: "#pnl",
            note: null,
            delta: versus(change(totals.revenue, totalsBefore.revenue)),
          },
          {
            label: t("dash.grossProfit"),
            value: fmtIQD(totals.grossProfit),
            tone: totals.grossProfit < 0 ? "err" : undefined,
            href: "#pnl",
            note: ofRevenue(totals.grossProfit),
            delta: points(marginNow, marginBefore),
          },
          {
            label: totals.net < 0 ? t("Net loss") : t("Net profit"),
            value: fmtIQD(totals.net),
            tone: totals.net < 0 ? "err" : undefined,
            href: "#pnl",
            note: ofRevenue(totals.net),
            delta: points(netShare, netShareBefore),
          },
          {
            label: t("Losses"),
            value: fmtIQD(lost.total.value),
            href: "#losses",
            note: ofRevenue(lost.total.value),
            delta: null,
          },
        ]
      : [];

  const said: Saying[] = [
    unreconciled.length
      ? {
          tone: "warn",
          icon: "!",
          text: t(
            "{n} reconciliation difference(s): look into them before trusting these figures.",
            { n: unreconciled.length },
          ),
          href: "#reconciliation",
        }
      : {
          tone: "ok",
          icon: "✓",
          text: t("The books tie: every record agrees with its account."),
          href: "#reconciliation",
        },
  ];
  if (seesProfit && from <= to && totals.revenue > 0) {
    const c = change(totals.revenue, totalsBefore.revenue);
    const dir = direction(c);
    said.push({
      tone: dir === "up" ? "ok" : dir === "down" ? "warn" : "info",
      icon: mark(dir ?? "same"),
      text:
        c === null || dir === null
          ? t("Net revenue was {amount}; the {n} day(s) before had none to compare with.", {
              amount: fmtIQD(totals.revenue),
              n: days,
            })
          : dir === "up"
            ? t("Net revenue was {pct}% more than in the {n} day(s) before.", {
                pct: percent(c),
                n: days,
              })
            : dir === "down"
              ? t("Net revenue was {pct}% less than in the {n} day(s) before.", {
                  pct: percent(c),
                  n: days,
                })
              : t("Net revenue was about as in the {n} day(s) before.", { n: days }),
      detail:
        c === null
          ? undefined
          : t("{now} against {before}.", {
              now: fmtIQD(totals.revenue),
              before: fmtIQD(totalsBefore.revenue),
            }),
      href: `/reports/sales?from=${from}&to=${to}&by=date${withPlace.replace("place", "location")}`,
    });
    if (marginNow !== null) {
      const d = marginBefore === null ? 0 : Math.round((marginNow - marginBefore) * 100);
      said.push({
        tone: d <= -1 ? "warn" : d >= 1 ? "ok" : "info",
        icon: d <= -1 ? "▼" : d >= 1 ? "▲" : "●",
        text: t("You kept {pct}% of net revenue after the cost of sales.", {
          pct: Math.round(marginNow * 100),
        }),
        detail:
          marginBefore === null
            ? undefined
            : t("{pct}% in the {n} day(s) before.", {
                pct: Math.round(marginBefore * 100),
                n: days,
              }),
        href: "#pnl",
      });
    }
    said.push(
      totals.net >= 0
        ? {
            tone: "ok",
            icon: "✓",
            text: t("After every expense, the period made {amount}: {pct}% of net revenue.", {
              amount: fmtIQD(totals.net),
              pct: Math.round((totals.net / totals.revenue) * 100),
            }),
            href: "#pnl",
          }
        : {
            tone: "warn",
            icon: "▼",
            text: t("After every expense, the period lost {amount}.", {
              amount: fmtIQD(-totals.net),
            }),
            href: "#pnl",
          },
    );
    const big = largestExpense(pnl);
    if (big)
      said.push({
        tone: "info",
        icon: "●",
        text: t("{account} was the largest expense: {amount}, {pct}% of net revenue.", {
          account: msg(big.name),
          amount: fmtIQD(big.amount),
          pct: pctText(big.amount, totals.revenue) ?? 0,
        }),
        href: ledger(big.code, from, to, true),
      });
    const platforms = spend?.parts.find((x) => x.key === "platforms");
    if (platforms && platforms.amount >= totals.revenue * 0.01)
      said.push({
        tone: "info",
        icon: "●",
        text: t(
          "The delivery platforms' commission and fees came to {amount}: {pct}% of net revenue.",
          {
            amount: fmtIQD(platforms.amount),
            pct: pctText(platforms.amount, totals.revenue) ?? 0,
          },
        ),
        href: "/platforms",
      });
  }
  if (lost.total.value > 0) {
    const most = [...lost.byKind].sort((a, b) => b.value - a.value)[0];
    said.push({
      tone: "warn",
      icon: "!",
      text:
        allChannels.net > 0
          ? t("Losses came to {amount}, {pct}% of net sales.", {
              amount: fmtIQD(lost.total.value),
              pct: pctText(lost.total.value, allChannels.net) ?? 0,
            })
          : t("Losses came to {amount}.", { amount: fmtIQD(lost.total.value) }),
      detail: most
        ? t("The largest kind: {kind}, {amount}.", {
            kind: t(movementLabel(most.kind)),
            amount: fmtIQD(most.value),
          })
        : undefined,
      href: "#losses",
    });
  }
  const overdue = ageing.d1_15 + ageing.d16_30 + ageing.d31plus;
  if (overdue > 0)
    said.push({
      tone: "warn",
      icon: "!",
      text:
        ageing.d31plus > 0
          ? t("{amount} owed to suppliers is past due, {old} of it by more than 30 days.", {
              amount: fmtIQD(overdue),
              old: fmtIQD(ageing.d31plus),
            })
          : t("{amount} owed to suppliers is past due.", { amount: fmtIQD(overdue) }),
      href: "#ageing",
    });
  if (uncostedNet > 0)
    said.push({
      tone: "warn",
      icon: "!",
      text: t(
        "Sales of {amount} were costed at nothing: their profit is overstated until what they use has a cost.",
        { amount: fmtIQD(uncostedNet) },
      ),
      href: "#uncosted",
    });

  // Where each 1,000 IQD went, in the order drawn; what was kept, last.
  const SPENT_LABEL: Record<string, string> = {
    goods: t("What was sold cost"),
    platforms: t("Delivery platforms"),
    waste: t("Waste and stock differences"),
    staff: t("Staff"),
    running: t("Rent and running costs"),
  };
  const spentParts = spend
    ? [
        ...spend.parts.map((x) => ({
          key: x.key,
          label: SPENT_LABEL[x.key] ?? x.key,
          value: Math.max(x.perThousand, 0),
          valueText: fmtIQD(x.perThousand),
          sub: t("{amount} in all", { amount: fmtIQD(x.amount) }),
        })),
        {
          key: "kept",
          label: spend.net < 0 ? t("The period's loss") : t("Kept as profit"),
          value: Math.max(spend.netPerThousand, 0),
          valueText: fmtIQD(spend.netPerThousand),
          sub: t("{amount} in all", { amount: fmtIQD(spend.net) }),
        },
      ]
    : [];

  // The parts of the page, by what they are about, each a tap away.
  const jump = [
    ...(seesProfit
      ? [
          {
            label: t("Profit"),
            links: [
              { href: "#pnl", label: t("Profit & Loss") },
              ...(byPlace ? [{ href: "#pnl-places", label: t("Profit & Loss by place") }] : []),
            ],
          },
        ]
      : []),
    {
      label: t("Sales"),
      links: [
        { href: "#channel", label: t("Sales by Channel") },
        { href: "#margin", label: t("Product Margin by Channel") },
        { href: "#sizes", label: t("Sizes and add-ons") },
        { href: "#payments", label: t("Sales by payment method") },
        { href: "#dollars", label: t("Dollars") },
        ...(seesCustomers && loyalty
          ? [{ href: "#customers", label: t("Customers and loyalty") }]
          : []),
      ],
    },
    {
      label: t("Buying and stock"),
      links: [
        { href: "#purchasing", label: t("Purchasing") },
        { href: "#ageing", label: t("Payable Ageing") },
        { href: "#production", label: t("Production") },
        { href: "#losses", label: t("Losses") },
      ],
    },
    ...(seesStaff ? [{ label: t("People"), links: [{ href: "#staff", label: t("Staff") }] }] : []),
    {
      label: t("Checks"),
      links: [
        { href: "#reconciliation", label: t("Do the books tie?") },
        { href: "#uncosted", label: t("Uncosted Sales") },
        ...(seesExceptions ? [{ href: "#exceptions", label: t("Exceptions") }] : []),
      ],
    },
  ];
  const lastMonthEnd = addDays(monthStart(today), -1);
  const ranges: [string, string, string][] = [
    ["This month", monthStart(today), today],
    ["Last month", monthStart(lastMonthEnd), monthEnd(lastMonthEnd)],
    ["This year", yearStart(today), today],
  ];
  const section = (s: string) => pnl.filter((r) => r.section === s && r.amount !== 0);
  // Sizes of the products sold in more than one; then every add-on taken (0041).
  const sizeCount = new Map<string, number>();
  for (const r of sized)
    if (r.kind === "size") sizeCount.set(r.parent, (sizeCount.get(r.parent) ?? 0) + 1);
  const sizeRows = sized.filter((r) => r.kind === "size" && (sizeCount.get(r.parent) ?? 0) > 1);
  const addonRows = sized.filter((r) => r.kind === "addon");
  const pct = (part: number, whole: number) =>
    whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";

  return (
    <div className="grid" style={{ gap: 18 }}>
      <PrintHead
        business={profile.businessName}
        title={t("nav.reports")}
        period={t("{from} to {to}", { from, to }) + (placeName ? ` · ${placeName}` : "")}
        timezone={profile.timezone}
      />
      <div className="phead">
        <h1>
          {t("nav.reports")}
          {placeName && (
            <span className="muted" data-testid="reports-at">
              {" "}
              · {placeName}
            </span>
          )}
        </h1>
        <PrintButton />
        <span className="sc">
          <Rich
            text={t("{from} to {to} · from the ledger · <csv>every journal line (CSV)</csv>", {
              from,
              to,
            })}
            tags={{
              csv: (c) => (
                <a href={`/reports/export?report=journal_lines&from=${from}&to=${to}`}>{c}</a>
              ),
            }}
          />
        </span>
      </div>

      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">{t("From")}</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="sc">{t("To")}</div>
          <input type="date" name="to" defaultValue={to} />
        </label>
        {choosesPlace && (
          <label>
            <div className="sc">{t("Place")}</div>
            <select name="place" defaultValue={place ?? ""} data-testid="reports-place">
              <option value="">{t("The whole café")}</option>
              {cafePlaces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit">{t("Show")}</button>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ranges.map(([label, f, tt]) => (
            <Link key={label} className="badge" href={`/reports?from=${f}&to=${tt}${withPlace}`}>
              {t(label)}
            </Link>
          ))}
        </span>
      </form>

      {place && (
        <p
          className="muted"
          style={{ margin: 0, fontSize: ".8rem" }}
          data-testid="reports-place-note"
        >
          {t(
            "Read for {place}. These stay the whole café's: Do the books tie?, Payable Ageing, Product Margin by Channel, and the customers with the points they hold.",
            { place: placeName ?? "" },
          )}
        </p>
      )}

      {/* ---- The period at a glance: its figures against the days before, what they say, where the money went ---- */}
      <section className="rep-overview" aria-labelledby="rep-glance" data-testid="report-glance">
        <h2 id="rep-glance" className="dash-h">
          {t("The period at a glance")}
        </h2>
        {glance.length > 0 && (
          <div className="kpis">
            {glance.map((g) => (
              <a key={g.label} href={g.href} className="card stat">
                <span className="label">{g.label}</span>
                <span className={`value${g.tone ? ` ${g.tone}` : ""}`}>{g.value}</span>
                {g.note && <span className="delta">{g.note}</span>}
                {g.delta}
              </a>
            ))}
          </div>
        )}
        <div className="rep-insight">
          <section className="card" aria-labelledby="rep-say" data-testid="report-says">
            <h3 id="rep-say" className="viz-title">
              {t("What the period says")}
            </h3>
            <Sayings items={said} />
          </section>
          {spend && (
            <section className="card" aria-labelledby="rep-spent" data-testid="report-spent">
              <h3 id="rep-spent" className="viz-title">
                {t("Where each 1,000 IQD of net revenue went")}
              </h3>
              <ShareBar label={t("Where each 1,000 IQD of net revenue went")} parts={spentParts} />
              <p className="muted dash-note">
                {t(
                  "From the P&L: what was sold cost is the recipes' cost of goods; waste and stock differences are waste, preparation loss, count differences and price differences on deliveries; the staff are their pay and their meals.",
                )}
              </p>
            </section>
          )}
        </div>
      </section>

      <nav className="rep-nav no-print" aria-label={t("Parts of the reports")}>
        {jump.map((g) => (
          <span key={g.label} className="rep-nav-group">
            <span className="rep-nav-label">{g.label}</span>
            {g.links.map((l) => (
              <a key={l.href} href={l.href} className="rep-nav-link">
                {l.label}
              </a>
            ))}
          </span>
        ))}
      </nav>

      {/* ---- The analysis and the stock's value on a day (0051); the statements (0052) ---- */}
      <div
        className="card"
        style={{ display: "flex", gap: 16, flexWrap: "wrap" }}
        data-testid="report-pages"
      >
        <Link
          className="drill"
          href={`/reports/sales?from=${from}&to=${to}${place && profile.worksAt === null ? `&location=${place}` : ""}`}
          data-testid="to-analysis"
        >
          {t("Sales analysis: by hour, day, product, person, payment… →")}
        </Link>
        <Link
          className="drill"
          href={`/reports/week?end=${to > today ? today : to}${place && profile.worksAt === null ? `&location=${place}` : ""}`}
          data-testid="to-week"
        >
          {t("The week at a glance →")}
        </Link>
        <Link
          className="drill"
          href={`/reports/month?month=${(to > today ? today : to).slice(0, 7)}${place && profile.worksAt === null ? `&location=${place}` : ""}`}
          data-testid="to-month"
        >
          {t("The month at a glance →")}
        </Link>
        <Link className="drill" href="/reports/prices" data-testid="to-prices">
          {t("Price watch: what came in dearer →")}
        </Link>
        <Link
          className="drill"
          href={`/reports/menu${place && profile.worksAt === null ? `?location=${place}` : ""}`}
          data-testid="to-menu"
        >
          {t("Menu matrix: what to keep, reprice, show more or drop →")}
        </Link>
        {seesStaff && (
          <Link
            className="drill"
            href={`/reports/staffing${place && profile.worksAt === null ? `?location=${place}` : ""}`}
            data-testid="to-staffing"
          >
            {t("Staffed when busy? Orders an hour against who was on the clock →")}
          </Link>
        )}
        <Link
          className="drill"
          href={`/reports/waste${place && profile.worksAt === null ? `?location=${place}` : ""}`}
          data-testid="to-waste"
        >
          {t("Waste by recipe: made, sold and thrown away →")}
        </Link>
        <Link
          className="drill"
          href={`/reports/stock?on=${to}${withPlace}`}
          data-testid="to-stock-value"
        >
          {t("Stock value on a day →")}
        </Link>
        {seesProfit && (
          <Link
            className="drill"
            href={`/reports/statements?from=${from}&to=${to}`}
            data-testid="to-statements"
          >
            {t("Balance sheet and cash flow →")}
          </Link>
        )}
      </div>

      {seesProfit && (
        <h2 className="rep-group" id="g-profit">
          {t("Profit")}
        </h2>
      )}

      {/* ---- Profit & Loss ---- */}
      {seesProfit && (
        <section className="panel" id="pnl">
          <div className="panel-h">
            <h3>
              {placeName ? t("Profit & Loss at {place}", { place: placeName }) : t("Profit & Loss")}
            </h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              <Rich
                text={t("Published journal lines, {from} to {to} · <csv>CSV</csv>", { from, to })}
                tags={{
                  csv: (c) => (
                    <a href={`/reports/export?report=pnl&from=${from}&to=${to}${withPlace}`}>{c}</a>
                  ),
                }}
              />
            </span>
          </div>
          <div className="panel-b" style={{ maxWidth: 640 }}>
            <div className="st-row group">
              <span className="lbl">{t("Income")}</span>
              <span className="amt" />
            </div>
            {section("revenue").map((r) => (
              <div key={r.code} className="st-row indent">
                <span className="lbl">
                  <Link className="drill" href={ledger(r.code, from, to, true)}>
                    {r.code} {msg(r.name)}
                  </Link>
                </span>
                <span className={`amt ${r.amount < 0 ? "red" : ""}`}>{fmtIQD(r.amount)}</span>
              </div>
            ))}
            <div className="st-row total">
              <span className="lbl">{t("Net revenue")}</span>
              <span className="amt">{fmtIQD(totals.revenue)}</span>
            </div>
            <div className="st-row group">
              <span className="lbl">{t("Cost of sales")}</span>
              <span className="amt" />
            </div>
            {section("cost_of_sales").map((r) => (
              <div key={r.code} className="st-row indent">
                <span className="lbl">
                  <Link className="drill" href={ledger(r.code, from, to, true)}>
                    {r.code} {msg(r.name)}
                  </Link>
                </span>
                <span className="amt red">({fmtIQD(r.amount)})</span>
              </div>
            ))}
            <div className="rule-single" />
            <div className="st-row total">
              <span className="lbl">{t("dash.grossProfit")}</span>
              <span className="amt">{fmtIQD(totals.grossProfit)}</span>
            </div>
            <div className="st-row group">
              <span className="lbl">{t("Operating expenses")}</span>
              <span className="amt" />
            </div>
            {section("operating_expenses").map((r) => (
              <div key={r.code} className="st-row indent">
                <span className="lbl">
                  <Link className="drill" href={ledger(r.code, from, to, true)}>
                    {r.code} {msg(r.name)}
                  </Link>
                </span>
                <span className="amt red">({fmtIQD(r.amount)})</span>
              </div>
            ))}
            <div className="st-row total" style={{ marginBlockStart: 10 }}>
              <span className="lbl">{totals.net < 0 ? t("Net loss") : t("Net profit")}</span>
              <span className={`amt ${totals.net < 0 ? "red" : ""}`}>{fmtIQD(totals.net)}</span>
            </div>
            <div className="rule-double" />
          </div>
        </section>
      )}

      {/* ---- The profit and loss by place (0056) ---- */}
      {byPlace && (
        <section className="panel" id="pnl-places" data-testid="pnl-places">
          <div className="panel-h">
            <h3>{t("Profit & Loss by place")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              <Rich
                text={t("Published journal lines, {from} to {to} · <csv>CSV</csv>", { from, to })}
                tags={{
                  csv: (c) => (
                    <a href={`/reports/export?report=pnl_by_place&from=${from}&to=${to}`}>{c}</a>
                  ),
                }}
              />
            </span>
          </div>
          <div className="panel-b">
            <p className="muted" style={{ fontSize: ".78rem", marginBlockStart: 0 }}>
              {t(
                "Each line is at the place of its record: a sale at the branch that sold it, a loss where the stock was, an expense where it was recorded. A platform's payout is shared out by the branch of each order, a payroll by where each person works. Shared: what belongs to no one place, such as the bank's card fees and journals by hand.",
              )}
            </p>
            <div className="tw">
              <table className="pnl-places">
                <thead>
                  <tr>
                    <th>{t("Account")}</th>
                    {byPlace.columns.map((c) => (
                      <th key={c.id ?? "shared"} className="right">
                        {c.id === null ? t("Shared") : c.name}
                      </th>
                    ))}
                    <th className="right">{t("Café total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["revenue", "Income", "revenue", "Net revenue"],
                      ["cost_of_sales", "Cost of sales", "grossProfit", "dash.grossProfit"],
                      ["operating_expenses", "Operating expenses", "net", ""],
                    ] as const
                  ).map(([sec, head, key, label]) => (
                    <Fragment key={sec}>
                      <tr className="group">
                        <td colSpan={byPlace.columns.length + 2}>{t(head)}</td>
                      </tr>
                      {byPlace.lines
                        .filter((l) => l.section === sec)
                        .map((l) => (
                          <tr key={l.code} data-testid={`pnl-places-${l.code}`}>
                            <td>
                              <Link className="drill" href={ledger(l.code, from, to, true)}>
                                {l.code} {msg(l.name)}
                              </Link>
                            </td>
                            {[...l.amounts, l.total].map((a, i) => (
                              <td
                                key={i}
                                className={`right money ${sec !== "revenue" || a < 0 ? "red" : ""}`}
                              >
                                {a === 0 ? "—" : sec === "revenue" ? fmtIQD(a) : `(${fmtIQD(a)})`}
                              </td>
                            ))}
                          </tr>
                        ))}
                      <tr className="total" data-testid={`pnl-places-${key}`}>
                        <td>
                          {key === "net"
                            ? byPlace.total.net < 0
                              ? t("Net loss")
                              : t("Net profit")
                            : t(label)}
                        </td>
                        {[...byPlace.totals, byPlace.total].map((x, i) => (
                          <td key={i} className={`right money ${x[key] < 0 ? "red" : ""}`}>
                            {fmtIQD(x[key])}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <h2 className="rep-group" id="g-sales">
        {t("Sales")}
      </h2>

      {/* ---- Sales by channel ---- */}
      <section className="panel" id="channel">
        <div className="panel-h">
          <h3>{t("Sales by Channel")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Sales {from} to {to}, voids excluded; refunds on the day they were made", {
              from,
              to,
            })}
          </span>
        </div>
        {byChannel.size === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t("No sales in these dates.")}
            </p>
          </div>
        ) : (
          <>
            <div className="panel-b rep-chart">
              <BarList
                label={t("Net sales by channel")}
                rows={[...byChannel.entries()]
                  .map(([c, list]) => {
                    const v = salesTotals(list);
                    return {
                      key: c,
                      name: channels.name(c),
                      value: v.net,
                      valueText: fmtIQD(v.net),
                      sub: t("{share}% of net sales · margin {kept}%", {
                        share: pctText(v.net, allChannels.net) ?? 0,
                        kept: pctText(v.margin, v.net) ?? 0,
                      }),
                    };
                  })
                  .sort((x, y) => y.value - x.value)}
              />
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>{t("Channel")}</th>
                    <th className="right">{t("Orders")}</th>
                    <th className="right">{t("Sales")}</th>
                    <th className="right">{t("Refunds")}</th>
                    <th className="right">{t("Net sales")}</th>
                    <th className="right">{t("Sales margin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byChannel.entries()].map(([c, list]) => {
                    const v = salesTotals(list);
                    return (
                      <tr key={c}>
                        <td>
                          <span className="ref">{channels.name(c)}</span>
                        </td>
                        <td className="right money">
                          <Link
                            className="drill"
                            href={`/orders?from=${from}&to=${to}&channel=${encodeURIComponent(c)}`}
                          >
                            {list.reduce((s, r) => s + r.orders, 0)}
                          </Link>
                        </td>
                        <td className="right money">{fmtIQD(v.sold)}</td>
                        <td className="right money">
                          {v.refunds ? `(${fmtIQD(v.refunds)})` : "—"}
                        </td>
                        <td className="right money">{fmtIQD(v.net)}</td>
                        <td className="right money">{fmtIQD(v.margin)}</td>
                      </tr>
                    );
                  })}
                  <tr className="grand">
                    <td>{t("All channels")}</td>
                    <td className="right money">{sales.reduce((s, r) => s + r.orders, 0)}</td>
                    <td className="right money">{fmtIQD(allChannels.sold)}</td>
                    <td className="right money">
                      {allChannels.refunds ? `(${fmtIQD(allChannels.refunds)})` : "—"}
                    </td>
                    <td className="right money">{fmtIQD(allChannels.net)}</td>
                    <td className="right money">{fmtIQD(allChannels.margin)}</td>
                  </tr>
                </tbody>
              </table>
              <p
                className="muted"
                style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
              >
                {t(
                  "Net sales are what the P&L shows as net revenue for the same dates (4000 less 4100 and 4200). The sales margin is net sales less the recipe cost of what was sold; the P&L's gross profit also takes off waste, count differences, purchase price differences and platform fees.",
                )}
              </p>
            </div>
          </>
        )}
      </section>

      {/* ---- Product margin ---- */}
      <section className="panel" id="margin">
        <div className="panel-h">
          <h3>{t("Product Margin by Channel")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Today's prices and today's costs, costed exactly as a sale posts them")}
          </span>
        </div>
        {menu.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t("Add products with recipes and prices to see their margins.")}
            </p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Product")}</th>
                  <th>{t("Channel")}</th>
                  <th className="right">{t("Price")}</th>
                  <th className="right">{t("Cost")}</th>
                  <th className="right">{t("Margin")}</th>
                  <th className="right">%</th>
                </tr>
              </thead>
              <tbody>
                {menu.map((m) => {
                  const margin = m.unitCost === null ? null : m.price - m.unitCost;
                  return (
                    <tr key={m.variantId + m.channel}>
                      <td>
                        {m.productName}
                        {m.variantName !== m.productName ? ` — ${m.variantName}` : ""}
                      </td>
                      <td>
                        <span className="ref">{channels.name(m.channel)}</span>
                      </td>
                      <td className="right money">{fmtIQD(m.price)}</td>
                      <td className="right money">
                        {m.unitCost === null ? t("unknown") : fmtIQD(m.unitCost)}
                      </td>
                      <td className={`right money ${margin !== null && margin < 0 ? "red" : ""}`}>
                        {margin === null ? "—" : fmtIQD(margin)}
                      </td>
                      <td className="right money">
                        {margin === null || m.price <= 0
                          ? "—"
                          : `${((margin / m.price) * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Sizes and add-ons (0041) ---- */}
      <section className="panel" id="sizes" data-testid="sizes-report">
        <div className="panel-h">
          <h3>{t("Sizes and add-ons")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Sold {from} to {to}, at the prices and costs of each sale; voids left out", {
              from,
              to,
            })}
          </span>
        </div>
        {sizeRows.length === 0 && addonRows.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t(
                "No product was sold in more than one size, and no add-on was taken, in these dates.",
              )}
            </p>
          </div>
        ) : (
          <>
            {sizeRows.length > 0 && (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Product")}</th>
                      <th>{t("Size")}</th>
                      <th className="right">{t("Qty")}</th>
                      <th className="right">{t("Net sales")}</th>
                      <th className="right">{t("Cost")}</th>
                      <th className="right">{t("Margin")}</th>
                      <th className="right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sizeRows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.parent}</td>
                        <td>{r.name}</td>
                        <td className="right mono">{r.qty}</td>
                        <td className="right money">{fmtIQD(r.sales)}</td>
                        <td className="right money">{fmtIQD(r.cost)}</td>
                        <td className={`right money ${r.margin < 0 ? "red" : ""}`}>
                          {fmtIQD(r.margin)}
                        </td>
                        <td className="right money">{pct(r.margin, r.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {addonRows.length > 0 && (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Group")}</th>
                      <th>{t("Add-on")}</th>
                      <th className="right">{t("Qty")}</th>
                      <th className="right">{t("On lines")}</th>
                      <th className="right">{t("Of the lines offered it")}</th>
                      <th className="right">{t("Net sales")}</th>
                      <th className="right">{t("Cost")}</th>
                      <th className="right">{t("Margin")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {addonRows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.parent}</td>
                        <td>{r.name}</td>
                        <td className="right mono">{r.qty}</td>
                        <td className="right mono">{r.lines}</td>
                        <td className="right mono">{pct(r.lines, r.offered ?? 0)}</td>
                        <td className="right money">{fmtIQD(r.sales)}</td>
                        <td className="right money">{fmtIQD(r.cost)}</td>
                        <td className={`right money ${r.margin < 0 ? "red" : ""}`}>
                          {fmtIQD(r.margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p
              className="muted"
              style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
            >
              {t(
                "A size's figures leave out its add-ons, which are counted on their own, each with its share of the line's discount. Refunds are not taken off here: Sales by Channel has them. How often an add-on is taken is out of the lines of the products that offer it today.",
              )}
            </p>
          </>
        )}
      </section>

      {/* ---- Sales by payment method (0042) ---- */}
      <section className="panel" id="payments" data-testid="payments-report">
        <div className="panel-h">
          <h3>{t("Sales by payment method")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Sales {from} to {to}, voids excluded; refunds on the day they were made", {
              from,
              to,
            })}
          </span>
        </div>
        {takings.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t("No sales in these dates.")}
            </p>
          </div>
        ) : (
          <>
            <div className="panel-b rep-chart">
              <BarList
                label={t("Net sales by payment method")}
                rows={[...paidWays]
                  .sort((x, y) => y.net - x.net)
                  .map((r) => ({
                    key: r.key,
                    name: r.name,
                    value: r.net,
                    valueText: fmtIQD(r.net),
                    sub: t("{share}% of net sales", {
                      share:
                        pctText(
                          r.net,
                          takings.reduce((sum, x) => sum + x.net, 0),
                        ) ?? 0,
                    }),
                  }))}
              />
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>{t("Paid by")}</th>
                    <th className="right">{t("Sales")}</th>
                    <th className="right">{t("Takings")}</th>
                    <th className="right">{t("Refunds")}</th>
                    <th className="right">{t("Net")}</th>
                    <th className="right">{t("Change given")}</th>
                  </tr>
                </thead>
                <tbody>
                  {takings.map((r) => (
                    <tr key={r.method} data-testid={`payments-${r.method}`}>
                      <td>{t(tenderLabel(r.method))}</td>
                      <td className="right money">
                        {r.sales}
                        {r.splitSales > 0 && (
                          <div className="muted" style={{ fontSize: ".72rem" }}>
                            {t("{n} paid two ways", { n: r.splitSales })}
                          </div>
                        )}
                      </td>
                      <td className="right money">{fmtIQD(r.taken)}</td>
                      <td className="right money">
                        {r.refunded ? `(${fmtIQD(r.refunded)})` : "—"}
                      </td>
                      <td className="right money">{fmtIQD(r.net)}</td>
                      <td className="right money">{r.changeGiven ? fmtIQD(r.changeGiven) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="grand">
                    <td>{t("All payments")}</td>
                    <td className="right money" />
                    <td className="right money">
                      {fmtIQD(takings.reduce((s, r) => s + r.taken, 0))}
                    </td>
                    <td className="right money">
                      {takings.some((r) => r.refunded)
                        ? `(${fmtIQD(takings.reduce((s, r) => s + r.refunded, 0))})`
                        : "—"}
                    </td>
                    <td className="right money">
                      {fmtIQD(takings.reduce((s, r) => s + r.net, 0))}
                    </td>
                    <td className="right money" />
                  </tr>
                </tbody>
              </table>
              <p
                className="muted"
                style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
              >
                {t(
                  "A sale paid part in cash and part by card counts under each, for the part it paid. Cash is what the sale kept: the change went back to the customer. The net matches the sales by channel.",
                )}
              </p>
            </div>
            {methodRows.length > 0 && (
              <div className="tw" data-testid="payments-by-way">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Way to pay")}</th>
                      <th className="right">{t("Sales")}</th>
                      <th className="right">{t("Takings")}</th>
                      <th className="right">{t("Refunds")}</th>
                      <th className="right">{t("Net")}</th>
                      {place === null && (
                        <>
                          <th className="right">{t("Moved out")}</th>
                          <th className="right">{t("Fees")}</th>
                          <th className="right">{t("In its account on {day}", { day: to })}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {methodRows.map((m) => (
                      <tr key={m.method} data-testid="payments-way">
                        <td dir="auto">
                          {m.name}
                          {!m.active && <span className="muted"> · {t("out of use")}</span>}
                        </td>
                        <td className="right money">{m.sales}</td>
                        <td className="right money">{fmtIQD(m.taken)}</td>
                        <td className="right money">
                          {m.refunded ? `(${fmtIQD(m.refunded)})` : "—"}
                        </td>
                        <td className="right money">{fmtIQD(m.net)}</td>
                        {place === null && (
                          <>
                            <td className="right money">{m.movedOut ? fmtIQD(m.movedOut) : "—"}</td>
                            <td className="right money">{m.fees ? fmtIQD(m.fees) : "—"}</td>
                            <td className="right money">{fmtIQD(m.balance ?? 0)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p
                  className="muted"
                  style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
                >
                  {place === null
                    ? t(
                        "The café's own ways to pay, each with its own account: what it took, what refunds gave back by it, what was moved out of its account in the dates and the fees the bank or the app kept, and what the account held at the end. Money is moved on Sales → Ways to Pay.",
                      )
                    : t(
                        "The café's own ways to pay, at this place: what each took, and what refunds gave back by it. Their accounts are the café's: see them for all places.",
                      )}
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* ---- Dollars (0043) ---- */}
      <section className="panel" id="dollars" data-testid="dollars-report">
        <div className="panel-h">
          <h3>{t("Dollars")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Taken, counted and exchanged {from} to {to}; held now", { from, to })}
          </span>
        </div>
        <div className="panel-b grid" style={{ gap: 10 }}>
          <p style={{ margin: 0, fontSize: ".9rem" }} data-testid="dollars-taken">
            {dollars.taken.sales === 0
              ? t("No sale was paid in dollars in these dates.")
              : t(
                  "{sales} sale(s) paid in dollars: {usd}, taken at {value}; they paid {paid}, and {change} went back as change in dinars.",
                  {
                    sales: dollars.taken.sales,
                    usd: fmtUSD(dollars.taken.usd),
                    value: fmtIQD(dollars.taken.value),
                    paid: fmtIQD(dollars.taken.paid),
                    change: fmtIQD(dollars.taken.change),
                  },
                )}
          </p>
          {dollars.byRate.length > 0 && (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th className="right">{t("Dinars a dollar")}</th>
                    <th className="right">{t("Sales")}</th>
                    <th className="right">{t("Dollars")}</th>
                    <th className="right">{t("Taken at")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dollars.byRate.map((r) => (
                    <tr key={r.rate}>
                      <td className="right money">{fmtRate(r.rate)}</td>
                      <td className="right money">{r.sales}</td>
                      <td className="right money">{fmtUSD(r.usd)}</td>
                      <td className="right money">{fmtIQD(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dollars.exchanges.length > 0 && (
            <div className="tw">
              <table data-testid="dollars-exchanges">
                <thead>
                  <tr>
                    <th>{t("When")}</th>
                    <th>{t("From")}</th>
                    <th>{t("Into")}</th>
                    <th className="right">{t("Dollars")}</th>
                    <th className="right">{t("Taken at")}</th>
                    <th className="right">{t("Dinars received")}</th>
                    <th className="right">{t("Difference")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dollars.exchanges.map((x) => (
                    <tr key={x.id}>
                      <td className="when">{dateTimeIn(profile.timezone, x.at)}</td>
                      <td>{t(PLACE_LABEL[x.from] ?? x.from)}</td>
                      <td>{t(PLACE_LABEL[x.to] ?? x.to)}</td>
                      <td className="right money">{fmtUSD(x.usd)}</td>
                      <td className="right money">{fmtIQD(x.value)}</td>
                      <td className="right money">{fmtIQD(x.received)}</td>
                      <td className={`right money ${x.difference < 0 ? "red" : ""}`}>
                        {x.difference < 0 ? `(${fmtIQD(-x.difference)})` : fmtIQD(x.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dollars.counts.length > 0 && (
            <div className="tw">
              <table data-testid="dollars-counts">
                <thead>
                  <tr>
                    <th>{t("Session")}</th>
                    <th>{t("Branch")}</th>
                    <th className="right">{t("Should have held")}</th>
                    <th className="right">{t("Counted")}</th>
                    <th className="right">{t("Difference")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dollars.counts.map((c) => (
                    <tr key={c.sessionId}>
                      <td>
                        <Link className="drill" href={`/sales/sessions/${c.sessionId}`}>
                          {c.sessionNo ?? "—"}
                        </Link>
                      </td>
                      <td>{c.location}</td>
                      <td className="right money">{fmtUSD(c.expected)}</td>
                      <td className="right money">
                        {c.counted === null ? t("Not counted") : fmtUSD(c.counted)}
                      </td>
                      <td className={`right money ${c.varianceValue < 0 ? "red" : ""}`}>
                        {c.variance === null || c.variance === 0
                          ? "—"
                          : `${fmtUSD(c.variance)} (${fmtIQD(c.varianceValue)})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted" style={{ margin: 0, fontSize: ".82rem" }}>
            {t(
              "Exchange differences {exchanges} (6950) · dollars counted over or short {counts} (6300) · held now: the safe {safe}",
              {
                exchanges: fmtIQD(dollars.differences.exchanges),
                counts: fmtIQD(dollars.differences.counts),
                safe: fmtUSD(dollars.held.safe.usd),
              },
            )}
            {dollars.held.tills.map((x) => (
              <span key={x.locationId}>
                {" · "}
                {t("{place}'s till: {usd} (taken at {amount})", {
                  place: x.location,
                  usd: fmtUSD(x.usd),
                  amount: fmtIQD(x.value),
                })}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ---- Customers and their points (0050) ---- */}
      {seesCustomers && loyalty && (
        <section className="panel" id="customers" data-testid="customer-report">
          <div className="panel-h">
            <h3>{t("Customers and loyalty")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("Points earned and spent {from} to {to}, and who bought the most", { from, to })}
            </span>
          </div>
          <div className="panel-b grid" style={{ gap: 6 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span data-testid="loyalty-earned">
                {t("Points earned: {n}", { n: String(loyalty.points.earned) })}
              </span>
              <span data-testid="loyalty-rewards">
                {t("Rewards taken: {n}, {amount} off", {
                  n: String(loyalty.points.rewards),
                  amount: fmtIQD(loyalty.points.rewardsValue),
                })}
              </span>
              <span>
                {t("Taken back on voids and refunds: {n}; given back: {m}", {
                  n: String(loyalty.points.takenBack),
                  m: String(loyalty.points.givenBack),
                })}
              </span>
              <span>
                {t("By hand: {plus} given, {minus} taken", {
                  plus: String(loyalty.points.givenByHand),
                  minus: String(loyalty.points.takenByHand),
                })}
              </span>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span data-testid="loyalty-outstanding">
                {t("Customers hold {n} points now, worth {amount} in rewards", {
                  n: String(loyalty.outstanding),
                  amount: fmtIQD(loyalty.outstandingValue),
                })}
              </span>
              <span>
                {t("{n} customers, {m} new in these dates", {
                  n: String(loyalty.customers),
                  m: String(loyalty.newCustomers),
                })}
              </span>
              <span>
                {t("Their sales: {n}, {amount}", {
                  n: String(loyalty.sales.orders),
                  amount: fmtIQD(loyalty.sales.net),
                })}
              </span>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
              {t(
                "A reward is a discount on 4100, like any other: the points are no liability in the books, only what customers hold here.",
              )}
            </p>
          </div>
          {loyalty.top.length > 0 && (
            <div className="tw">
              <table data-testid="customer-top">
                <thead>
                  <tr>
                    <th>{t("Customer")}</th>
                    <th className="right">{t("Orders")}</th>
                    <th className="right">{t("Bought")}</th>
                    <th className="right">{t("Points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loyalty.top.map((c) => (
                    <tr key={c.customerId} data-testid="customer-top-row" data-name={c.name}>
                      <td>
                        <Link href={`/customers/${c.customerId}`}>{c.name}</Link>
                      </td>
                      <td className="right mono">{c.orders}</td>
                      <td className="right mono">{fmtIQD(c.spent)}</td>
                      <td className="right mono">{c.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <h2 className="rep-group" id="g-buying">
        {t("Buying and stock")}
      </h2>

      {/* ---- Purchasing (0044) ---- */}
      <section className="panel" id="purchasing" data-testid="purchasing-report">
        <div className="panel-h">
          <h3>{t("Purchasing")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Orders, prices, returns and credits, {from} to {to}", { from, to })}
          </span>
        </div>
        <div className="panel-b grid" style={{ gap: 12 }}>
          {buying.orders.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
              {t("No purchase order was made in these dates.")}
            </p>
          ) : (
            <div className="tw">
              <table data-testid="purchasing-orders">
                <thead>
                  <tr>
                    <th>{t("Order")}</th>
                    <th>{t("Supplier")}</th>
                    <th>{t("Stage")}</th>
                    <th className="right">{t("Ordered")}</th>
                    <th className="right">{t("Received")}</th>
                  </tr>
                </thead>
                <tbody>
                  {buying.orders.map((o) => (
                    <tr key={o.poId}>
                      <td className="mono">
                        <Link href={`/purchasing/orders/${o.poId}`}>{o.poNo}</Link>
                      </td>
                      <td>{o.supplier}</td>
                      <td>{t(STAGE_LABEL[orderStage(o)])}</td>
                      <td className="right money">{fmtIQD(o.ordered)}</td>
                      <td className="right money">{fmtIQD(o.received)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {buying.open.length > 0 && (
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t("{n} order(s) open, waiting for goods: {list}", {
                n: buying.open.length,
                list: buying.open.map((o) => `${o.poNo} (${o.supplier})`).join(", "),
              })}
            </p>
          )}
          {buying.priceChanges.length > 0 && (
            <div className="tw">
              <div className="sc">
                {t("Prices that changed from the supplier's delivery before")}
              </div>
              <table data-testid="purchasing-prices">
                <thead>
                  <tr>
                    <th>{t("Delivery")}</th>
                    <th>{t("Supplier")}</th>
                    <th>{t("Item")}</th>
                    <th className="right">{t("Before")}</th>
                    <th className="right">{t("Now")}</th>
                    <th className="right">{t("Change")}</th>
                  </tr>
                </thead>
                <tbody>
                  {buying.priceChanges.map((p, i) => (
                    <tr key={i}>
                      <td className="mono">{p.receiptNo ?? "—"}</td>
                      <td>{p.supplier}</td>
                      <td>{p.item}</td>
                      <td className="right mono">
                        {t("{cost} a {unit}", { cost: p.before, unit: p.unit })}
                      </td>
                      <td className="right mono">
                        {t("{cost} a {unit}", { cost: p.now, unit: p.unit })}
                      </td>
                      <td
                        className="right mono"
                        style={{ color: p.changePercent > 0 ? "var(--err)" : undefined }}
                      >
                        {p.changePercent > 0 ? "+" : ""}
                        {p.changePercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {buying.returns.length > 0 && (
            <div className="tw">
              <div className="sc">{t("Returns to suppliers")}</div>
              <table data-testid="purchasing-returns">
                <thead>
                  <tr>
                    <th>{t("No.")}</th>
                    <th>{t("Supplier")}</th>
                    <th>{t("Delivery")}</th>
                    <th>{t("Why")}</th>
                    <th className="right">{t("Owed back")}</th>
                    <th className="right">{t("Stock value")}</th>
                    <th>{t("How")}</th>
                  </tr>
                </thead>
                <tbody>
                  {buying.returns.map((x) => (
                    <tr key={x.returnId}>
                      <td className="mono">{x.returnNo}</td>
                      <td>{x.supplier}</td>
                      <td className="mono">{x.receiptNo ?? "—"}</td>
                      <td>{x.reason}</td>
                      <td className="right money">{fmtIQD(x.value)}</td>
                      <td className="right money">{fmtIQD(x.stockValue)}</td>
                      <td>
                        {x.against === "delivery"
                          ? t("Off the delivery's bill")
                          : x.creditNo !== null
                            ? t("Credit {no} on the account", { no: x.creditNo })
                            : t("On the account")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {buying.credits.length > 0 && (
            <div className="tw">
              <div className="sc">{t("Suppliers' credits")}</div>
              <table data-testid="purchasing-credits">
                <thead>
                  <tr>
                    <th>{t("No.")}</th>
                    <th>{t("Supplier")}</th>
                    <th>{t("For")}</th>
                    <th>{t("Their note")}</th>
                    <th className="right">{t("Amount")}</th>
                    <th className="right">{t("Left")}</th>
                  </tr>
                </thead>
                <tbody>
                  {buying.credits.map((c) => (
                    <tr key={c.creditId}>
                      <td className="mono">{c.creditNo}</td>
                      <td>{c.supplier}</td>
                      <td>{t(CREDIT_KIND_LABEL[c.kind])}</td>
                      <td>{c.supplierRef ?? t("Awaiting their note")}</td>
                      <td className="right money">{fmtIQD(c.amount)}</td>
                      <td className="right money">{fmtIQD(c.left)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p
            className="muted"
            style={{ margin: 0, fontSize: ".82rem" }}
            data-testid="purchasing-totals"
          >
            {t(
              "Returned {returned} · credited {credited} · credits not yet set against a bill {left}",
              {
                returned: fmtIQD(buying.totals.returned),
                credited: fmtIQD(buying.totals.credited),
                left: fmtIQD(buying.totals.creditsLeft),
              },
            )}
          </p>
          {bought && (bought.suppliers.length > 0 || bought.items.length > 0) && (
            <>
              <h4 style={{ margin: "6px 0 0" }}>{t("What came in, by supplier")}</h4>
              <div className="tw">
                <table data-testid="purchases-suppliers">
                  <thead>
                    <tr>
                      <th>{t("Supplier")}</th>
                      <th className="right">{t("Deliveries")}</th>
                      <th className="right">{t("Received")}</th>
                      <th className="right">{t("Sent back")}</th>
                      <th className="right">{t("Credited for price")}</th>
                      <th className="right">{t("Net")}</th>
                      <th className="right">{t("Billed")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bought.suppliers.map((x) => (
                      <tr key={x.supplierId} data-testid="purchases-supplier" data-name={x.name}>
                        <td>
                          <Link
                            className="drill"
                            href={`/vendors/${x.supplierId}/statement?from=${from}&to=${to}`}
                          >
                            {x.name}
                          </Link>
                        </td>
                        <td className="right money">{x.deliveries}</td>
                        <td className="right money">{fmtIQD(x.received)}</td>
                        <td className="right money">
                          {x.returned ? `(${fmtIQD(x.returned)})` : "—"}
                        </td>
                        <td className="right money">
                          {x.priceCredits ? `(${fmtIQD(x.priceCredits)})` : "—"}
                        </td>
                        <td className="right money">{fmtIQD(x.net)}</td>
                        <td className="right money">{x.bills ? fmtIQD(x.billed) : "—"}</td>
                      </tr>
                    ))}
                    <tr className="grand">
                      <td>{t("All")}</td>
                      <td className="right money">{bought.total.deliveries}</td>
                      <td className="right money">{fmtIQD(bought.total.received)}</td>
                      <td className="right money">
                        {bought.total.returned ? `(${fmtIQD(bought.total.returned)})` : "—"}
                      </td>
                      <td className="right money">
                        {bought.total.priceCredits ? `(${fmtIQD(bought.total.priceCredits)})` : "—"}
                      </td>
                      <td className="right money">{fmtIQD(bought.total.net)}</td>
                      <td className="right money">{fmtIQD(bought.total.billed)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <h4 style={{ margin: "6px 0 0" }}>{t("What came in, by item")}</h4>
              <div className="tw">
                <table data-testid="purchases-items">
                  <thead>
                    <tr>
                      <th>{t("Item")}</th>
                      <th className="right">{t("Came in")}</th>
                      <th className="right">{t("Cost of one")}</th>
                      <th className="right">{t("Received")}</th>
                      <th className="right">{t("Sent back")}</th>
                      <th className="right">{t("Net")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bought.items.map((i) => (
                      <tr key={i.itemId} data-testid="purchases-item" data-name={i.name}>
                        <td>
                          <Link className="drill" href={`/inventory/${i.itemId}`}>
                            {itemNameIn(i, locale)}
                          </Link>
                        </td>
                        <td className="right money">
                          {fmtQty(i.qty)} {unitName(i.unit, t)}
                        </td>
                        <td className="right money">
                          {i.unitCost === null ? "—" : fmtQty(i.unitCost)}
                        </td>
                        <td className="right money">{fmtIQD(i.received)}</td>
                        <td className="right money">
                          {i.returned ? `(${fmtIQD(i.returned)})` : "—"}
                        </td>
                        <td className="right money">{fmtIQD(i.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: ".76rem", lineHeight: 1.7 }}>
                {t(
                  "The deliveries received in the dates, as their corrections left them, their landed costs shared in; what went back to the suppliers in the dates, at what they owe back; the credits suppliers gave for price; and the bills dated in the dates.",
                )}{" "}
                <a href={`/reports/export?report=purchases&from=${from}&to=${to}${withPlace}`}>
                  {t("CSV")}
                </a>
              </p>
            </>
          )}
        </div>
      </section>

      {/* ---- Payable ageing ---- */}
      <section className="panel" id="ageing">
        <div className="panel-h">
          <h3>{t("Payable Ageing")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Today · what to pay first")}
          </span>
        </div>
        {ageing.total > 0 && (
          <div className="panel-b rep-chart">
            <BarList
              label={t("What is owed, by how late it is")}
              rows={[
                { key: "current", name: t("Not yet due"), value: ageing.current },
                { key: "1-15", name: t("1 to 15 days late"), value: ageing.d1_15 },
                { key: "16-30", name: t("16 to 30 days late"), value: ageing.d16_30 },
                { key: "31+", name: t("More than 30 days late"), value: ageing.d31plus },
              ].map((r) => ({
                ...r,
                valueText: fmtIQD(r.value),
                sub: t("{share}% of what is owed", { share: pctText(r.value, ageing.total) ?? 0 }),
              }))}
            />
          </div>
        )}
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>{t("Vendor")}</th>
                <th>{t("Invoice")}</th>
                <th>{t("Due")}</th>
                <th className="right">{t("Outstanding")}</th>
                <th className="right">{t("Age")}</th>
              </tr>
            </thead>
            <tbody>
              {book.openBills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ fontStyle: "italic" }}>
                    {t("Nothing outstanding — every bill is settled.")}
                  </td>
                </tr>
              ) : (
                book.openBills.map((b) => (
                  <tr key={b.id}>
                    <td>{b.supplierName}</td>
                    <td>{b.invoiceNo || "—"}</td>
                    <td>{b.dueDate ?? "—"}</td>
                    <td className="right money">{fmtIQD(b.outstanding)}</td>
                    <td className="right">
                      <span className={`ref ${b.daysOverdue > 0 ? "due" : ""}`}>
                        {b.daysOverdue > 0 ? t("{n}d over", { n: b.daysOverdue }) : t("Current")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
              {book.openBills.length > 0 && (
                <tr className="grand">
                  <td />
                  <td>{t("Total payable")}</td>
                  <td />
                  <td className="right money">{fmtIQD(ageing.total)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Production (0046) ---- */}
      <section className="panel" id="production" data-testid="production-report">
        <div className="panel-h">
          <h3>{t("Production")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Batches made {from} to {to}: what came out, and what became of it", { from, to })}
          </span>
        </div>
        {made.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
              {t("No batch was made in these dates.")}
            </p>
          </div>
        ) : (
          <div className="tw">
            <table data-testid="production-batches">
              <thead>
                <tr>
                  <th>{t("Batch")}</th>
                  <th>{t("What")}</th>
                  <th className="right">{t("Came out")}</th>
                  <th className="right">{t("Of the recipe")}</th>
                  <th className="right">{t("Quantity sold")}</th>
                  <th className="right">{t("Lost")}</th>
                  <th className="right">{t("Still in stock")}</th>
                  <th className="right">{t("Cost")}</th>
                </tr>
              </thead>
              <tbody>
                {made.map((b) => {
                  const q = (n: number) => `${fmtQty(n)} ${unitName(b.baseUnit, t)}`;
                  return (
                    <tr
                      key={b.batchId}
                      className={b.status === "cancelled" ? "pr-cancelled" : undefined}
                    >
                      <td className="mono">
                        <Link href={`/production/batches/${b.batchId}`}>{b.batchNo}</Link>
                      </td>
                      <td>
                        {b.recipe}
                        {b.status === "cancelled" && (
                          <>
                            {" "}
                            <span className="badge warn">{t("cancelled")}</span>
                          </>
                        )}
                      </td>
                      <td className="right mono">{q(b.actual)}</td>
                      <td className="right mono">{b.yieldPct === null ? "—" : `${b.yieldPct}%`}</td>
                      <td className="right mono">{b.story ? q(b.story.sold) : "—"}</td>
                      <td className="right mono">{b.story ? q(b.story.lost) : "—"}</td>
                      <td className="right mono">{b.story ? q(b.story.left) : "—"}</td>
                      <td className="right money">{fmtIQD(b.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Losses and giveaways (0048) ---- */}
      <section className="panel" id="losses" data-testid="loss-report">
        <div className="panel-h">
          <h3>{t("Losses")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("What was lost or given away {from} to {to}, and where it was charged", {
              from,
              to,
            })}
          </span>
        </div>
        {lost.total.count === 0 && lost.total.reversedCount === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
              {t("Nothing was lost in these dates.")}
            </p>
          </div>
        ) : (
          <>
            <div className="panel-b">
              <p style={{ margin: 0 }} data-testid="loss-total">
                {t("{n} loss(es), {value} in all.", {
                  n: lost.total.count,
                  value: fmtIQD(lost.total.value),
                })}
                {lost.total.pendingCount > 0 && (
                  <>
                    {" "}
                    {t("{n} of them wait for a manager ({value}).", {
                      n: lost.total.pendingCount,
                      value: fmtIQD(lost.total.pendingValue),
                    })}
                  </>
                )}
                {lost.total.reversedCount > 0 && (
                  <>
                    {" "}
                    {t("{n} reversed, as they did not happen ({value}): left out.", {
                      n: lost.total.reversedCount,
                      value: fmtIQD(lost.total.reversedValue),
                    })}
                  </>
                )}
              </p>
            </div>
            <div className="panel-b rep-chart">
              <BarList
                label={t("Losses by kind")}
                rows={[...lost.byKind]
                  .sort((x, y) => y.value - x.value)
                  .map((k) => ({
                    key: `${k.kind}:${k.account}`,
                    name: t(movementLabel(k.kind)),
                    value: k.value,
                    valueText: fmtIQD(k.value),
                    sub: `${kindShare(k.value, lost.total.value)}% · ${k.account} ${msg(k.accountName ?? LOSS_ACCOUNT_NAME[k.account] ?? "")}`,
                  }))}
              />
            </div>
            <div className="tw">
              <table data-testid="loss-by-kind">
                <thead>
                  <tr>
                    <th>{t("Kind")}</th>
                    <th>{t("Account")}</th>
                    <th className="right">{t("Losses")}</th>
                    <th className="right">{t("Value")}</th>
                    <th className="right">{t("Share")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lost.byKind.map((k) => (
                    <tr key={`${k.kind}:${k.account}`}>
                      <td>{t(movementLabel(k.kind))}</td>
                      <td>
                        <span className="mono">{k.account}</span>{" "}
                        {msg(k.accountName ?? LOSS_ACCOUNT_NAME[k.account] ?? "")}
                      </td>
                      <td className="right mono">{k.count}</td>
                      <td className="right money">{fmtIQD(k.value)}</td>
                      <td className="right mono">{kindShare(k.value, lost.total.value)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lost.giveaways.length > 0 && (
              <div className="panel-b">
                <p style={{ margin: 0 }} data-testid="loss-giveaways">
                  <b>{t("Given away at the till")}:</b>{" "}
                  {lost.giveaways
                    .map((g) =>
                      t("{what}: {n}, {value}", {
                        what: t(giveawayLabel(g.kind)),
                        n: g.count,
                        value: fmtIQD(g.value),
                      }),
                    )
                    .join(" · ")}
                </p>
              </div>
            )}
            <div
              className="grid"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 0 }}
            >
              <div className="tw">
                <table data-testid="loss-by-item">
                  <thead>
                    <tr>
                      <th>{t("Item")}</th>
                      <th className="right">{t("Quantity lost")}</th>
                      <th className="right">{t("Value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lost.byItem.slice(0, 10).map((i) => (
                      <tr key={i.itemId}>
                        <td>
                          <Link href={`/inventory/${i.itemId}`}>{i.item}</Link>
                        </td>
                        <td className="right mono">
                          {fmtQty(i.qty)} {unitName(i.unit, t)}
                        </td>
                        <td className="right money">{fmtIQD(i.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tw">
                <table data-testid="loss-by-person">
                  <thead>
                    <tr>
                      <th>{t("Recorded by")}</th>
                      <th className="right">{t("Losses")}</th>
                      <th className="right">{t("Value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lost.byPerson.map((p) => (
                      <tr key={p.personId ?? "—"}>
                        <td>{p.person ?? "—"}</td>
                        <td className="right mono">{p.count}</td>
                        <td className="right money">{fmtIQD(p.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="tw">
              <table data-testid="loss-list">
                <thead>
                  <tr>
                    <th>{t("When")}</th>
                    <th>{t("Kind")}</th>
                    <th>{t("What")}</th>
                    <th className="right">{t("Value")}</th>
                    <th>{t("Why")}</th>
                    <th>{t("Recorded by")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lost.losses.slice(0, 50).map((l) => (
                    <tr
                      key={l.lossId ?? l.movementId ?? l.at}
                      className={l.reversed ? "pr-cancelled" : undefined}
                      data-testid="loss-row"
                    >
                      <td className="mono muted" style={{ fontSize: ".8rem" }}>
                        {dateTimeIn(profile.timezone, l.at)}
                      </td>
                      <td>
                        {t(movementLabel(l.kind))}
                        {l.atTill && (
                          <>
                            {" "}
                            <span className="badge">
                              {l.turnNo !== null
                                ? t("at the till, number {n}", { n: l.turnNo })
                                : t("at the till")}
                            </span>
                          </>
                        )}
                        {l.pending && (
                          <>
                            {" "}
                            <span className="badge warn">{t("waiting for a manager")}</span>
                          </>
                        )}
                        {l.reversed && (
                          <>
                            {" "}
                            <span className="badge warn">{t("reversed")}</span>
                          </>
                        )}
                      </td>
                      <td>
                        {l.what
                          .map(
                            (w) =>
                              `${w.unit ? `${fmtQty(w.qty)} ${unitName(w.unit, t)}` : `${fmtQty(w.qty)} ×`} ${w.name}${
                                w.size ? ` — ${w.size}` : ""
                              }${w.addons.length > 0 ? ` (${w.addons.join(", ")})` : ""}${
                                w.batchNo !== null ? ` · ${t("Batch {n}", { n: w.batchNo })}` : ""
                              }`,
                          )
                          .join("; ")}
                      </td>
                      <td className="right money">{fmtIQD(l.value)}</td>
                      <td>{l.reason ? msg(l.reason) : "—"}</td>
                      <td>
                        {l.person ?? "—"}
                        {l.approvedBy && l.approvedBy !== l.person && (
                          <span className="muted" style={{ fontSize: ".8rem" }}>
                            {" "}
                            · {t("approved by {name}", { name: l.approvedBy })}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {seesStaff && (
        <h2 className="rep-group" id="g-people">
          {t("People")}
        </h2>
      )}

      {/* ---- Staff: their hours, and what they cost (0049) ---- */}
      {seesStaff && (
        <section className="panel" id="staff" data-testid="staff-report">
          <div className="panel-h">
            <h3>{t("Staff")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("The hours worked {from} to {to}, lateness, leaving early and absence", {
                from,
                to,
              })}
            </span>
          </div>
          {staff === null ? (
            <div className="panel-b">
              <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
                {t("Choose up to a year to see the hours.")}
              </p>
            </div>
          ) : staff.people.length === 0 ? (
            <div className="panel-b">
              <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
                {t("Nobody worked or was on the schedule in these dates.")}
              </p>
            </div>
          ) : (
            <div className="tw">
              <table data-testid="staff-hours">
                <thead>
                  <tr>
                    <th>{t("Who")}</th>
                    <th className="right">{t("Days on the schedule")}</th>
                    <th className="right">{t("Days worked")}</th>
                    <th className="right">{t("Hours")}</th>
                    <th className="right">{t("Overtime")}</th>
                    <th className="right">{t("Lateness")}</th>
                    <th className="right">{t("Left early")}</th>
                    <th className="right">{t("Absent")}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.people.map((p) => {
                    const hours = (minutes: number) => {
                      const { h, m } = splitMinutes(minutes);
                      return m === 0
                        ? t("{h} h", { h: String(h) })
                        : t("{h} h {m} min", { h: String(h), m: String(m) });
                    };
                    const times = (n: number, minutes: number) =>
                      n === 0
                        ? "—"
                        : t("{n} times, {minutes} min", { n: String(n), minutes: String(minutes) });
                    return (
                      <tr key={p.employeeId} data-testid="staff-hours-row" data-name={p.name}>
                        <td>
                          {p.name}
                          {p.title && (
                            <div className="muted" style={{ fontSize: ".8rem" }}>
                              {p.title}
                            </div>
                          )}
                        </td>
                        <td className="right mono">{p.daysScheduled}</td>
                        <td className="right mono">{p.daysWorked}</td>
                        <td className="right mono">{hours(p.minutes)}</td>
                        <td className="right mono">
                          {p.overtimeMinutes ? hours(p.overtimeMinutes) : "—"}
                        </td>
                        <td className="right mono">{times(p.timesLate, p.minutesLate)}</td>
                        <td className="right mono">{times(p.timesEarly, p.minutesEarly)}</td>
                        <td className="right mono">{p.daysAbsent || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {staff?.labour && staff.labour.length > 0 && (
            <div className="tw">
              <table data-testid="staff-labour">
                <thead>
                  <tr>
                    <th>{t("Month")}</th>
                    <th className="right">{t("Salaries (6100)")}</th>
                    <th className="right">{t("Sales")}</th>
                    <th className="right">{t("Of sales")}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.labour.map((m) => (
                    <tr key={m.month}>
                      <td className="mono">{monthText(m.month)}</td>
                      <td className="right money">{fmtIQD(m.cost)}</td>
                      <td className="right money">{fmtIQD(m.sales)}</td>
                      <td className="right mono">{m.percent === null ? "—" : `${m.percent}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ margin: "6px 16px", fontSize: ".8rem" }}>
                {t(
                  "What staff cost is what 6100 Salaries holds for the month: the payroll approved for it, and any salary recorded as an expense. The sales are the month's, less refunds.",
                )}
              </p>
            </div>
          )}
        </section>
      )}

      <h2 className="rep-group" id="g-checks">
        {t("Checks")}
      </h2>

      {/* ---- Reconciliation ---- */}
      <section className="panel" id="reconciliation">
        <div className="panel-h">
          <h3>{t("Do the books tie?")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            <Rich
              text={t(
                "Each subledger against its control account, as at the end of {to} · <csv>CSV</csv>",
                { to },
              )}
              tags={{
                csv: (c) => <a href={`/reports/export?report=reconciliation&to=${to}`}>{c}</a>,
              }}
            />
          </span>
        </div>
        {/* All tie: one line, the checks a click away. A check that fails opens them. */}
        <details className="rec-details" open={unreconciled.length > 0 || problems.length > 0}>
          <summary data-testid="rec-summary" data-ok={unreconciled.length === 0}>
            {unreconciled.length === 0 ? (
              <>
                <StatusMark state="ok" label={t("Ties")} />{" "}
                {t("Every subledger agrees with its control account.")}
              </>
            ) : (
              <>
                <StatusMark state="bad" label={t("Does not tie")} />{" "}
                {t("{n} of {total} checks do not tie", {
                  n: unreconciled.length,
                  total: rec.length,
                })}
              </>
            )}
          </summary>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Check")}</th>
                  <th className="right">{t("Subledger")}</th>
                  <th className="right">{t("Ledger")}</th>
                  <th className="right">{t("Difference")}</th>
                </tr>
              </thead>
              <tbody>
                {rec.map((r) =>
                  r.key === "documents" ? (
                    // A count of records, not money.
                    <tr key={r.key} data-testid="rec-documents" data-ok={r.difference === 0}>
                      <td>
                        <StatusMark
                          state={r.difference === 0 ? "ok" : "bad"}
                          label={r.difference === 0 ? t("Ties") : t("Does not tie")}
                        />{" "}
                        {msg(r.label)}
                      </td>
                      <td className="right mono">
                        {r.subledger === 0 ? (
                          t("none")
                        ) : (
                          <a className="drill" href="#documents">
                            {t("{n} record(s)", { n: r.subledger })}
                          </a>
                        )}
                      </td>
                      <td className="right mono">—</td>
                      <td className={`right mono ${r.difference !== 0 ? "red" : ""}`}>
                        {r.difference}
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.key} data-testid={`rec-${r.key}`} data-ok={r.difference === 0}>
                      <td>
                        <StatusMark
                          state={r.difference === 0 ? "ok" : "bad"}
                          label={r.difference === 0 ? t("Ties") : t("Does not tie")}
                        />{" "}
                        {msg(r.label)}
                      </td>
                      <td className="right money">
                        {recLinks[r.key] ? (
                          <Link className="drill" href={recLinks[r.key]!.records}>
                            {fmtIQD(r.subledger)}
                          </Link>
                        ) : (
                          fmtIQD(r.subledger)
                        )}
                      </td>
                      <td className="right money">
                        {recLinks[r.key] ? (
                          <Link
                            className="drill"
                            href={ledger(recLinks[r.key]!.accounts, monthStart(to), to)}
                          >
                            {fmtIQD(r.ledger)}
                          </Link>
                        ) : (
                          fmtIQD(r.ledger)
                        )}
                      </td>
                      <td className={`right money ${r.difference !== 0 ? "red" : ""}`}>
                        {fmtIQD(r.difference)}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {problems.length > 0 && (
            <div className="tw" id="documents" style={{ padding: "0 16px" }}>
              <h4 style={{ margin: "12px 0 6px" }}>{t("Records to look into")}</h4>
              <table data-testid="document-problems">
                <thead>
                  <tr>
                    <th>{t("When")}</th>
                    <th>{t("Record")}</th>
                    <th>{t("What is wrong")}</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((p) => (
                    <tr key={`${p.kind}-${p.recordId}-${p.problem}`}>
                      <td className="muted mono" style={{ fontSize: ".8rem" }}>
                        {dateTimeIn(profile.timezone, p.at)}
                      </td>
                      <td>
                        <Link className="drill" href={problemLink(p)}>
                          {problemKind[p.kind] ?? p.kind}
                        </Link>
                      </td>
                      <td>{msg(p.problem)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
        {unreconciled.length > 0 && (
          <p
            className="muted"
            style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
          >
            {t(
              "{n} difference(s). A period cannot be locked while its checks fail. Differences that predate the controls are explained in docs/REMEDIATION.md and are corrected by new, dated entries — reversals, cancelled bills, the owner's corrections — never by editing history.",
              { n: unreconciled.length },
            )}
          </p>
        )}
        <LegacyPostings
          records={unposted}
          canPost={has(profile, "accounting.period.unlock")}
          timezone={profile.timezone}
        />
      </section>

      {/* ---- Sales costed at nothing (0025) ---- */}
      <section className="panel" id="uncosted">
        <div className="panel-h">
          <h3>{t("Uncosted Sales")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Sales {from} to {to} with no cost, or part of it missing", { from, to })}
          </span>
        </div>
        {uncosted.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              <StatusMark state="ok" label={t("All good")} />{" "}
              {t("Every sale in these dates carries its cost.")}
            </p>
          </div>
        ) : (
          <>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>{t("When")}</th>
                    <th>{t("Products")}</th>
                    <th>{t("Channel")}</th>
                    <th className="right">{t("Net sales")}</th>
                    <th className="right">{t("Cost recorded")}</th>
                    <th>{t("Why")}</th>
                  </tr>
                </thead>
                <tbody>
                  {uncosted.map((u) => (
                    <tr key={u.orderId}>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>
                        {dateTimeIn(profile.timezone, u.placedAt)}
                      </td>
                      <td>{u.products}</td>
                      <td>
                        <span className="ref">{channels.name(u.channel)}</span>
                      </td>
                      <td className="right money">{fmtIQD(u.net)}</td>
                      <td className="right money">{fmtIQD(u.cogs)}</td>
                      <td style={{ fontSize: ".82rem", color: "var(--warn)" }}>{msg(u.reasons)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p
              className="muted"
              style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
            >
              <StatusMark state="warn" label={t("Warning")} />{" "}
              <Rich
                text={t(
                  "{n} sale(s), {amount} of sales: their profit is overstated by what went into them uncosted. A sale keeps the cost it was recorded with. To cost the next ones, give the product its recipe on <products>Products</products> (or say why it uses no stock), and give an item with no cost its opening stock or its first delivery on <inventory>Inventory</inventory>.",
                  { n: uncosted.length, amount: fmtIQD(uncostedNet) },
                )}
                tags={{
                  products: (c) => <Link href="/products">{c}</Link>,
                  inventory: (c) => <Link href="/inventory">{c}</Link>,
                }}
              />
            </p>
          </>
        )}
      </section>

      {/* ---- Exceptions, by person (0028) ---- */}
      {seesExceptions && (
        <section className="panel" id="exceptions" data-testid="exceptions">
          <div className="panel-h">
            <h3>{t("Exceptions")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              <Rich
                text={t(
                  "Voids, refunds, discounts, cancelled bills, items taken off bills and wrong PINs, {from} to {to} · <csv>CSV</csv>",
                  { from, to },
                )}
                tags={{
                  csv: (c) => (
                    <a href={`/reports/export?report=exceptions&from=${from}&to=${to}${withPlace}`}>
                      {c}
                    </a>
                  ),
                }}
              />
            </span>
          </div>
          {exceptions.length === 0 ? (
            <div className="panel-b">
              <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                <StatusMark state="ok" label={t("All good")} />{" "}
                {t(
                  "Nothing was voided, refunded, discounted, cancelled or taken off a bill in these dates.",
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="tw">
                <table data-testid="exceptions-by-person">
                  <thead>
                    <tr>
                      <th>{t("Person")}</th>
                      {kinds.map((k) => (
                        <th key={k} className="right">
                          {t(EXCEPTION_LABEL[k])}
                        </th>
                      ))}
                      <th className="right">{t("Money involved")}</th>
                      <th className="right">{t("For review")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPerson.map((p) => (
                      <tr key={p.person}>
                        <td>{p.person === NO_ONE ? t(NO_ONE) : p.person}</td>
                        {kinds.map((k) => (
                          <td key={k} className="right mono">
                            {p.counts[k] ?? "—"}
                          </td>
                        ))}
                        <td className="right money">{fmtIQD(p.amount)}</td>
                        <td
                          className="right mono"
                          style={{ color: p.review > 0 ? "var(--warn)" : undefined }}
                        >
                          {p.review || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tw">
                <table data-testid="exceptions-list">
                  <thead>
                    <tr>
                      <th>{t("When")}</th>
                      <th>{t("What")}</th>
                      <th>{t("Who")}</th>
                      <th className="right">{t("Amount")}</th>
                      <th>{t("Why")}</th>
                      <th>{t("Approved by")}</th>
                      <th>{t("About")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map((e, i) => (
                      <tr key={i} data-kind={e.kind} data-review={e.needsReview ? "1" : "0"}>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>
                          {dateTimeIn(profile.timezone, e.at)}
                        </td>
                        <td>
                          {t(EXCEPTION_LABEL[e.kind] ?? e.kind)}
                          {e.needsReview && (
                            <span className="badge warn" style={{ marginInlineStart: 6 }}>
                              {t("review")}
                            </span>
                          )}
                        </td>
                        <td>{e.person ?? "—"}</td>
                        <td className="right money">
                          {e.amount === null ? "—" : fmtIQD(e.amount)}
                        </td>
                        <td style={{ fontSize: ".82rem" }}>{msg(e.reason ?? "—")}</td>
                        <td>{e.approvedBy ?? "—"}</td>
                        <td className="muted" style={{ fontSize: ".78rem" }}>
                          {msg(e.detail ? `${e.reference} · ${e.detail}` : e.reference)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p
                className="muted"
                style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
              >
                {toReview > 0 ? (
                  <>
                    <StatusMark state="warn" label={t("Warning")} />{" "}
                    {t(
                      "{n} wait for your review: a void or refund nobody else approved, a wrong PIN, or a discount over the cap given before discounts were checked. Discounts over the cap need a manager's approval on the till; a void or refund may be approved there by a second person with their name and PIN.",
                      { n: toReview },
                    )}
                  </>
                ) : (
                  t(
                    "a void or refund nobody else approved, a wrong PIN, or a discount over the cap given before discounts were checked. Discounts over the cap need a manager's approval on the till; a void or refund may be approved there by a second person with their name and PIN.",
                  )
                )}
              </p>
            </>
          )}
        </section>
      )}

      <p className="muted" style={{ fontSize: ".78rem" }}>
        {t("Also:")} <Link href="/accounting">{t("Trial balance")}</Link> ·{" "}
        <Link href="/journals">{t("Journal register")}</Link> ·{" "}
        <Link href="/sales">{t("Daily sales & cash over/short")}</Link> ·{" "}
        <Link href="/vendors">{t("Vendor statements")}</Link> ·{" "}
        <Link href="/inventory">{t("Stock valuation")}</Link> ·{" "}
        <Link href="/count">{t("Count variances")}</Link>.
      </p>
    </div>
  );
}
