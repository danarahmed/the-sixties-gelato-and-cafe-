import { getT } from "@/lib/i18n/server";
import { stockStatus } from "@/lib/demo/data";
import { Money, IQD } from "@domain/money/money.js";

export default async function InventoryPage() {
  const t = await getT();
  const rows = stockStatus();
  const totalValue = Money.sum(
    rows.map((r) => Money.of(r.value, IQD)),
    IQD,
  ).quantize();
  const lowCount = rows.filter((r) => r.low).length;
  const expiringCount = rows.filter((r) => r.expiringSoon).length;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("nav.inventory")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        On-hand is <strong>derived from the movement ledger</strong> — there is no editable stock
        field. Corrections post reversals/adjustments.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))" }}>
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
        <div className="card stat">
          <span className="label">Expiring ≤ 3 days</span>
          <span className="value" style={{ color: expiringCount ? "var(--err)" : "var(--ok)" }}>
            {expiringCount}
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
              <tr key={r.itemId}>
                <td>{r.name}</td>
                <td className="muted">{r.category}</td>
                <td className="right mono">{r.onHandBase.toLocaleString()}</td>
                <td className="muted">{r.unit}</td>
                <td className="right mono muted">{r.reorderBase.toLocaleString()}</td>
                <td className="right mono">{r.unitCost} IQD</td>
                <td className="right mono">{Money.of(r.value, IQD).format()}</td>
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
