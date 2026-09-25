import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getDashboard, getReconciliation } from "@/lib/db/reports";
import { getSalesOrders, getStockBoard } from "@/lib/db/read";
import { getCurrentAlerts, getDailyBrief } from "@/lib/db/alerts";
import { fmtIQD, fmtQty } from "@/lib/format";
import { getChannelNames } from "@/lib/db/channels";
import { addDays, businessToday, dateTimeIn } from "@/lib/dates";
import { NeedsYou } from "@/components/dashboard/NeedsYou";
import { DailyBrief } from "@/components/dashboard/DailyBrief";

export const dynamic = "force-dynamic";

/**
 * Exceptions first (0029, the audit's P1-8): what needs someone, then
 * yesterday's brief, then today at a glance — all from the books, for the
 * people who run the business.
 */
export default async function DashboardPage() {
  const profile = await requirePermission("profit.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const [alerts, brief, d, rec, board, recent, channels] = await Promise.all([
    getCurrentAlerts(),
    getDailyBrief(addDays(today, -1)),
    getDashboard(today),
    getReconciliation(today),
    getStockBoard(),
    getSalesOrders(6),
    getChannelNames(),
  ]);
  const low = board.filter((s) => s.isLow || s.isNegative);
  const differences = rec.filter((r) => r.difference !== 0);

  // Each figure opens what is behind it (audit P1-2).
  const day = `from=${today}&to=${today}`;
  const kpis = [
    { label: t("dash.netSales"), value: fmtIQD(d.netRevenue), href: `/reports?${day}#channel` },
    {
      label: t("dash.grossProfit"),
      value: fmtIQD(d.grossProfit),
      tone: d.grossProfit < 0 ? "err" : "ok",
      href: `/reports?${day}#pnl`,
    },
    { label: t("dash.orders"), value: String(d.orders), href: `/orders?${day}` },
    { label: t("dash.avgOrder"), value: fmtIQD(d.averageOrder), href: `/orders?${day}` },
    { label: "Inventory (1200)", value: fmtIQD(d.inventoryValue), href: "/inventory" },
    {
      label: t("dash.lowStock"),
      value: String(d.lowStock),
      tone: d.lowStock ? "warn" : "ok",
      href: "/inventory",
    },
  ];

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="phead">
        <h1>{t("dash.title")}</h1>
        <span className="sc">
          {today} · {profile.timezone}
        </span>
        <div className="sp">
          <Link
            href="/reports#reconciliation"
            className={`badge ${differences.length ? "err" : "ok"}`}
          >
            {differences.length
              ? `${differences.length} reconciliation difference(s)`
              : "Books reconcile"}
          </Link>
        </div>
      </div>

      <NeedsYou
        alerts={alerts}
        canAct={has(profile, "sale.void") || has(profile, "accounting.post")}
        myId={profile.id}
        today={today}
        timezone={profile.timezone}
      />

      <DailyBrief
        brief={brief}
        heading={t("dash.yesterday")}
        labels={{
          facts: t("dash.facts"),
          calculations: t("dash.calculations"),
          toDo: t("dash.toDo"),
        }}
      />

      <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{t("dash.today")}</h2>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
      >
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card stat" style={{ color: "inherit" }}>
            <span className="label">{k.label}</span>
            <span
              className="value mono"
              style={{
                color:
                  k.tone === "ok"
                    ? "var(--ok)"
                    : k.tone === "warn"
                      ? "var(--warn)"
                      : k.tone === "err"
                        ? "var(--err)"
                        : undefined,
              }}
            >
              {k.value}
            </span>
          </Link>
        ))}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        Revenue and cost of sales are read from today&apos;s published journal lines — the same
        figures the profit and loss will show. Gross profit here is after everything in cost of
        sales: waste, count differences, purchase price differences and platform fees. Open a figure
        to see what is behind it.
      </p>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("dash.lowStock")}</h3>
          {board.length === 0 ? (
            <span className="muted">No items yet.</span>
          ) : low.length === 0 ? (
            <span className="badge ok">All above reorder level</span>
          ) : (
            low.map((s) => (
              <div key={s.itemId} className="deduction-row">
                <span>{s.name}</span>
                <span className={`badge mono ${s.isNegative ? "err" : "warn"}`}>
                  {fmtQty(s.onHandBase)} / {s.reorderBase === null ? "—" : fmtQty(s.reorderBase)}{" "}
                  {s.unit}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recent sales</h3>
          {recent.length === 0 ? (
            <span className="muted">No sales yet.</span>
          ) : (
            recent.map((o) => (
              <div key={o.id} className="deduction-row">
                <span>
                  <span className="badge">{channels.name(o.channel)}</span>{" "}
                  {o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ") || "—"}
                  <span className="muted" style={{ fontSize: ".75rem" }}>
                    {" "}
                    · {dateTimeIn(profile.timezone, o.placedAt).slice(11)}
                    {o.status !== "completed" ? ` · ${o.status}` : ""}
                  </span>
                </span>
                <span className="mono">{fmtIQD(o.net)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
