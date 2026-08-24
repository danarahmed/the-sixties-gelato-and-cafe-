import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { loadCatalog } from "@/lib/db/catalog";
import { getSalesOrders } from "@/lib/db/read";
import { getAccountingOverview } from "@/lib/db/accounting";
import { getOpenBills, ageBills } from "@/lib/db/books";
import { channelLabel, fmtIQD, SELLABLE_CHANNELS } from "@/lib/format";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

/** Every report the books can produce, grouped the way an accountant looks for them. */
const GROUPS: { title: string; blurb: string; items: [string, string, string?][] }[] = [
  {
    title: "Business Overview",
    blurb: "The statements and the ledger behind them",
    items: [
      ["Profit & Loss", "Statement", "#pnl"],
      ["Trial Balance", "Ledger", "/accounting"],
      ["Chart of Accounts", "Ledger", "/accounting"],
      ["Journal Register", "Ledger", "/journals"],
      ["Balance Sheet", "Statement"],
      ["Cash Flow", "Statement"],
    ],
  },
  {
    title: "Sales",
    blurb: "From the daily till summaries",
    items: [
      ["Daily Sales Summary", "POS", "/sales"],
      ["Sales by Channel", "POS", "#channel"],
      ["Product Margin", "Cost", "#margin"],
      ["Cash Over / Short", "Control", "/sales"],
      ["Sales by Hour", "POS"],
      ["Discounts & Voids", "Control"],
    ],
  },
  {
    title: "Purchases & Vendors",
    blurb: "What the shop buys and owes",
    items: [
      ["Payable Ageing", "Ageing", "#ageing"],
      ["Vendor Statement", "Statement", "/vendors"],
      ["Goods Receipts", "Spend", "/purchasing"],
      ["Purchases by Vendor", "Spend"],
      ["Price Change History", "Cost"],
    ],
  },
  {
    title: "Expenses",
    blurb: "Where the money goes",
    items: [
      ["Expenses by Account", "Spend", "/expenses"],
      ["Expense Detail", "Detail", "/expenses"],
      ["Rent, Salaries & Utilities", "Fixed", "/expenses"],
    ],
  },
  {
    title: "Inventory & Cost",
    blurb: "Stock valued from the movement ledger",
    items: [
      ["Stock Valuation", "Cost", "/inventory"],
      ["Inventory Movement", "Ledger", "/inventory"],
      ["Recipe Cost & Margin", "Cost", "/products"],
      ["Stock Count Variance", "Control", "/count"],
      ["Waste & Spoilage", "Loss", "/inventory"],
    ],
  },
  {
    title: "Period & Audit",
    blurb: "Proof that the books are sound",
    items: [
      ["Closing Checklist", "Close", "/accounting"],
      ["Audit Trail", "Audit", "/accounting"],
      ["Locked Periods", "Close", "/accounting"],
    ],
  },
];

export default async function ReportsPage() {
  const t = await getT();
  const [cat, orders, overview, bills] = await Promise.all([
    loadCatalog().catch(() => null),
    getSalesOrders(500).catch(() => []),
    getAccountingOverview().catch(() => null),
    getOpenBills().catch(() => []),
  ]);
  const variants = cat?.variants ?? [];
  const ageing = ageBills(bills);

  const byChannel = new Map<string, { count: number; net: number; margin: number }>();
  for (const o of orders) {
    const cur = byChannel.get(o.channel) ?? { count: 0, net: 0, margin: 0 };
    byChannel.set(o.channel, {
      count: cur.count + 1,
      net: cur.net + o.net,
      margin: cur.margin + (o.net - o.cogs),
    });
  }

  const revenue = overview?.revenue ?? 0;
  const cogs = overview?.cogs ?? 0;
  const opex = (overview?.otherExpenses ?? 0) + (overview?.waste ?? 0);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.reports")}</h1>
        <span className="sc">Every statement in one place</span>
        <div className="sp">
          <span className="badge">{overview?.currentPeriodName ?? ""}</span>
        </div>
      </div>

      <div className="rgrid">
        {GROUPS.map((g) => (
          <div key={g.title} className="rgroup">
            <h4>{g.title}</h4>
            <div className="gs">{g.blurb}</div>
            {g.items.map(([name, tag, href]) => {
              const body = (
                <>
                  <span>{name}</span>
                  <span className="ref">{href ? tag : "soon"}</span>
                </>
              );
              return href ? (
                <Link key={name} href={href} className="rlink">
                  {body}
                </Link>
              ) : (
                <div key={name} className="rlink" style={{ opacity: 0.55 }}>
                  {body}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ---- Profit & Loss ---- */}
      <section className="panel" id="pnl">
        <div className="panel-h">
          <h3>Profit &amp; Loss</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {overview?.currentPeriodName} · from the ledger
          </span>
        </div>
        <div className="panel-b" style={{ maxWidth: 620 }}>
          <div className="st-row group">
            <span className="lbl">Income</span>
            <span className="amt" />
          </div>
          <div className="st-row indent">
            <span className="lbl">Net revenue</span>
            <span className="amt">{fmtIQD(revenue)}</span>
          </div>
          <div className="st-row group">
            <span className="lbl">Cost of sales</span>
            <span className="amt" />
          </div>
          <div className="st-row indent">
            <span className="lbl">Cost of goods sold</span>
            <span className="amt red">({fmtIQD(cogs)})</span>
          </div>
          <div className="rule-single" />
          <div className="st-row total">
            <span className="lbl">Gross profit</span>
            <span className="amt">{fmtIQD(revenue - cogs)}</span>
          </div>
          <div className="st-row group">
            <span className="lbl">Operating expenses</span>
            <span className="amt red">({fmtIQD(opex)})</span>
          </div>
          <div className="st-row total" style={{ marginBlockStart: 10 }}>
            <span className="lbl">Net {revenue - cogs - opex < 0 ? "loss" : "profit"}</span>
            <span className={`amt ${revenue - cogs - opex < 0 ? "red" : ""}`}>
              {fmtIQD(revenue - cogs - opex)}
            </span>
          </div>
          <div className="rule-double" />
        </div>
      </section>

      {/* ---- Payable ageing ---- */}
      <section className="panel" id="ageing">
        <div className="panel-h">
          <h3>Payable Ageing</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            What to pay first
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Invoice</th>
                <th>Due</th>
                <th className="right">Outstanding</th>
                <th className="right">Age</th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ fontStyle: "italic" }}>
                    Nothing outstanding — every bill is settled.
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id}>
                    <td>{b.supplierName}</td>
                    <td>{b.invoiceNo || "—"}</td>
                    <td>{b.dueDate ?? "—"}</td>
                    <td className="right money">{fmtIQD(b.outstanding)}</td>
                    <td className="right">
                      <span className={`ref ${b.daysOverdue > 0 ? "due" : ""}`}>
                        {b.daysOverdue > 0 ? `${b.daysOverdue}d over` : "Current"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
              {bills.length > 0 && (
                <tr className="grand">
                  <td />
                  <td>Total payable</td>
                  <td />
                  <td className="right money">{fmtIQD(ageing.total)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Product margin ---- */}
      <section className="panel" id="margin">
        <div className="panel-h">
          <h3>Product Margin by Channel</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Priced from the live weighted-average cost
          </span>
        </div>
        {variants.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              Add products with recipes and prices to see menu-engineering margins.
            </p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Channel</th>
                  <th className="right">Price</th>
                  <th className="right">Cost</th>
                  <th className="right">Margin</th>
                  <th className="right">%</th>
                </tr>
              </thead>
              <tbody>
                {variants.flatMap((v) =>
                  SELLABLE_CHANNELS.filter((ch) => v.priceByChannel[ch] != null).map((ch) => {
                    const price = v.priceByChannel[ch]!;
                    const cost = v.cogsByChannel[ch] ?? 0;
                    const margin = price - cost;
                    return (
                      <tr key={v.variantId + ch}>
                        <td>{v.productName}</td>
                        <td>
                          <span className="ref">{channelLabel[ch]}</span>
                        </td>
                        <td className="right money">{fmtIQD(price)}</td>
                        <td className="right money">{fmtIQD(cost)}</td>
                        <td className={`right money ${margin < 0 ? "red" : ""}`}>{fmtIQD(margin)}</td>
                        <td className="right money">
                          {price > 0 ? ((margin / price) * 100).toFixed(1) : "0.0"}%
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Channel mix ---- */}
      <section className="panel" id="channel">
        <div className="panel-h">
          <h3>Sales by Channel</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Recorded sales
          </span>
        </div>
        {orders.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              No sales recorded yet.
            </p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="right">Orders</th>
                  <th className="right">Net sales</th>
                  <th className="right">Gross profit</th>
                </tr>
              </thead>
              <tbody>
                {[...byChannel.entries()].map(([c, v]) => (
                  <tr key={c}>
                    <td>
                      <span className="ref">{channelLabel[c as SalesChannel] ?? c}</span>
                    </td>
                    <td className="right money">{v.count}</td>
                    <td className="right money">{fmtIQD(v.net)}</td>
                    <td className="right money">{fmtIQD(v.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
