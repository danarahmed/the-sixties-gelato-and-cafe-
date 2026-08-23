import { getT } from "@/lib/i18n/server";
import { stockStatus } from "@/lib/demo/data";
import { fetchStockBoard, itemTypeLabel } from "@/lib/db/inventory";
import { Money, IQD } from "@domain/money/money.js";

export const dynamic = "force-dynamic";

interface Row {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  onHandBase: number;
  reorderBase: number | null;
  unitCost: number;
  value: number;
  low: boolean;
  expiry?: string;
  expiringSoon?: boolean;
}

export default async function InventoryPage() {
  const t = await getT();

  // Prefer the live database; fall back to demo data when it is not configured.
  const dbRows = await fetchStockBoard().catch(() => null);
  const live = dbRows !== null;

  const rows: Row[] = live
    ? dbRows!.map((r) => ({
        itemId: r.itemId,
        name: r.name,
        category: itemTypeLabel(r.itemType),
        unit: r.unit,
        onHandBase: r.onHandBase,
        reorderBase: r.reorderBase,
        unitCost: r.unitCost,
        value: r.value,
        low: r.isLow,
      }))
    : stockStatus().map((r) => ({
        itemId: r.itemId,
        name: r.name,
        category: r.category,
        unit: r.unit,
        onHandBase: r.onHandBase,
        reorderBase: r.reorderBase,
        unitCost: r.unitCost,
        value: r.value,
        low: r.low,
        expiry: r.expiry,
        expiringSoon: r.expiringSoon,
      }));

  const totalValue = Money.sum(
    rows.map((r) => Money.of(Math.round(r.value), IQD)),
    IQD,
  ).quantize();
  const lowCount = rows.filter((r) => r.low).length;

  return (
    <div className="grid" style={{ gap: 16 }}>
      {live ? (
        <div className="badge ok" style={{ alignSelf: "start" }}>
          🟢 Live database — stock derived from the real ledger (Supabase)
        </div>
      ) : (
        <div className="demo-banner">⚠️ {t("common.demo")}</div>
      )}
      <h1 style={{ margin: 0 }}>{t("nav.inventory")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        On-hand is <strong>derived from the movement ledger</strong> — there is no editable stock
        field. Corrections post reversals/adjustments.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))" }}>
        <div className="card stat">
          <span className="label">Items tracked</span>
          <span className="value">{rows.length}</span>
        </div>
        <div className="card stat">
          <span className="label">Inventory value</span>
          <span className="value mono">{totalValue.format()}</span>
        </div>
        <div className="card stat">
          <span className="label">Low stock</span>
          <span className="value" style={{ color: lowCount ? "var(--warn)" : "var(--ok)" }}>
            {lowCount}
          </span>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th className="right">On hand</th>
              <th>Unit</th>
              <th className="right">Reorder</th>
              <th className="right">Unit cost</th>
              <th className="right">Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.itemId + r.unit}>
                <td>{r.name}</td>
                <td className="muted">{r.category}</td>
                <td className="right mono">{r.onHandBase.toLocaleString()}</td>
                <td className="muted">{r.unit}</td>
                <td className="right mono muted">
                  {r.reorderBase === null ? "—" : r.reorderBase.toLocaleString()}
                </td>
                <td className="right mono">{r.unitCost} IQD</td>
                <td className="right mono">{Money.of(Math.round(r.value), IQD).format()}</td>
                <td>
                  {r.low && <span className="badge warn">low</span>}{" "}
                  {r.expiringSoon && <span className="badge err">expiring {r.expiry}</span>}
                  {!r.low && !r.expiringSoon && <span className="badge ok">ok</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
