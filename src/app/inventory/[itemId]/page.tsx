import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { getItem } from "@/lib/db/read";
import { getStockCard, type StockCardKind, type StockCardRow } from "@/lib/db/reports";
import { fmtIQD, fmtQty, movementLabel } from "@/lib/format";
import { businessToday, dateTimeIn, monthStart, parseDay } from "@/lib/dates";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

/** The card's lines, in the order a stock-taker reads them. */
const LINES: { kind: StockCardKind; label: string }[] = [
  { kind: "opening_stock", label: "Opening stock recorded" },
  { kind: "received", label: "Received (less returns to suppliers)" },
  { kind: "sold", label: "Sold (less voids and refunds back on the shelf)" },
  { kind: "batches", label: "Used in batches" },
  { kind: "made", label: "Made" },
  { kind: "wasted", label: "Wasted, spoiled, given away" },
  { kind: "counted", label: "Stock counts" },
  { kind: "corrected", label: "Corrections" },
  { kind: "transferred", label: "Moved between locations" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An item's stock card (audit P1-2): what it opened with, each kind of
 * movement in the dates, and what it closed with, which is what the stock
 * board shows at the end of the last day; then every movement, with the
 * balance after it.
 */
export default async function StockCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const { itemId } = await params;
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const to = parseDay(sp.to, today);
  const from = parseDay(sp.from, monthStart(to));
  const item = UUID.test(itemId) ? await getItem(itemId) : null;
  if (!item) {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <h1 style={{ margin: 0 }}>Stock card</h1>
        <EmptyState title="Item not found" hint="Choose an item on Inventory." />
        <Link href="/inventory">Back to Inventory</Link>
      </div>
    );
  }
  const card = await getStockCard(item.id, from, to);
  const opening = card.find((r) => r.seq === 0);
  const moves = card.filter((r) => r.seq > 0);
  const last: StockCardRow | undefined = card[card.length - 1];
  const totals = new Map<StockCardKind, { qty: number; value: number }>();
  for (const m of moves) {
    const t = totals.get(m.kind) ?? { qty: 0, value: 0 };
    totals.set(m.kind, { qty: t.qty + m.qty, value: t.value + m.value });
  }
  const unit = item.baseUnit;
  const q = (n: number) => `${n > 0 ? "+" : ""}${fmtQty(n)}`;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>Stock card: {item.name}</h1>
        <span className="sc">
          {from} to {to} · in {unit}
        </span>
      </div>

      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">From</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="sc">To</div>
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit">Show</button>
        <Link href="/inventory" className="badge">
          Back to Inventory
        </Link>
      </form>

      <section className="panel" data-testid="stock-card">
        <div className="panel-h">
          <h3>Opening to closing</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Every movement of the stock ledger, at the value it was recorded with
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th />
                <th className="right">Quantity ({unit})</th>
                <th className="right">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>On hand when {from} began</td>
                <td className="right mono">{fmtQty(opening?.qty ?? 0)}</td>
                <td className="right money">{fmtIQD(opening?.value ?? 0)}</td>
              </tr>
              {LINES.filter((l) => totals.has(l.kind)).map((l) => (
                <tr key={l.kind} data-kind={l.kind}>
                  <td>{l.label}</td>
                  <td className="right mono">{q(totals.get(l.kind)!.qty)}</td>
                  <td className="right money">{fmtIQD(totals.get(l.kind)!.value)}</td>
                </tr>
              ))}
              <tr className="grand">
                <td>On hand at the end of {to}</td>
                <td className="right mono">{fmtQty(last?.balanceQty ?? 0)}</td>
                <td className="right money">{fmtIQD(last?.balanceValue ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">
          <h3>Movements</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {moves.length} in these dates
          </span>
        </div>
        {moves.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              Nothing moved in these dates.
            </p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>What</th>
                  <th className="right">Qty</th>
                  <th className="right">Value</th>
                  <th className="right">On hand</th>
                  <th className="right">Worth</th>
                  <th>Note</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.seq}>
                    <td className="mono muted" style={{ fontSize: ".8rem", whiteSpace: "nowrap" }}>
                      {dateTimeIn(profile.timezone, m.occurredAt)}
                    </td>
                    <td>
                      <span className="badge">{m.movement ? movementLabel(m.movement) : "—"}</span>
                    </td>
                    <td
                      className="right mono"
                      style={{ color: m.qty < 0 ? "var(--err)" : "var(--ok)" }}
                    >
                      {q(m.qty)}
                    </td>
                    <td className="right mono">{fmtIQD(m.value)}</td>
                    <td className="right mono">{fmtQty(m.balanceQty)}</td>
                    <td className="right mono">{fmtIQD(m.balanceValue)}</td>
                    <td className="muted" style={{ fontSize: ".85rem" }}>
                      {m.reason ?? ""}
                    </td>
                    <td className="muted" style={{ fontSize: ".85rem" }}>
                      {m.by ?? ""}
                    </td>
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
