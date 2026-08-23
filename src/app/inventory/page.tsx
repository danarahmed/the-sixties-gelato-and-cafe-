import { getT } from "@/lib/i18n/server";
import { fetchStockBoard } from "@/lib/db/inventory";
import { getItems, getMovements } from "@/lib/db/read";
import { itemTypeLabel, movementLabel, fmtIQD } from "@/lib/format";
import { InventoryForms } from "@/components/InventoryForms";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const t = await getT();
  const [board, items, movements] = await Promise.all([
    fetchStockBoard().catch(() => null),
    getItems().catch(() => []),
    getMovements(60).catch(() => []),
  ]);

  if (board === null) {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <h1 style={{ margin: 0 }}>{t("nav.inventory")}</h1>
        <div className="demo-banner">Database is not configured for this deployment.</div>
      </div>
    );
  }

  const totalValue = board.reduce((s, r) => s + r.value, 0);
  const lowCount = board.filter((r) => r.isLow).length;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>
        🟢 Live database — stock is derived from the append-only ledger (Supabase)
      </div>
      <h1 style={{ margin: 0 }}>{t("nav.inventory")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        On-hand is <strong>derived from the movement ledger</strong> — there is no editable stock
        field. Every change below appends a movement.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))" }}>
        <div className="card stat">
          <span className="label">Items tracked</span>
          <span className="value">{board.length}</span>
        </div>
        <div className="card stat">
          <span className="label">Inventory value</span>
          <span className="value mono">{fmtIQD(totalValue)}</span>
        </div>
        <div className="card stat">
          <span className="label">Low stock</span>
          <span className="value" style={{ color: lowCount ? "var(--warn)" : "var(--ok)" }}>
            {lowCount}
          </span>
        </div>
      </div>

      <InventoryForms items={items.map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit }))} />

      {board.length === 0 ? (
        <EmptyState
          title="No stock items yet"
          hint="Use “Add stock item” above to create your first item and its opening balance."
        />
      ) : (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Stock on hand</h3>
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
              {board.map((r) => (
                <tr key={r.itemId}>
                  <td>{r.name}</td>
                  <td className="muted">{itemTypeLabel(r.itemType)}</td>
                  <td className="right mono">{r.onHandBase.toLocaleString()}</td>
                  <td className="muted">{r.unit}</td>
                  <td className="right mono muted">
                    {r.reorderBase === null ? "—" : r.reorderBase.toLocaleString()}
                  </td>
                  <td className="right mono">{r.unitCost} IQD</td>
                  <td className="right mono">{fmtIQD(r.value)}</td>
                  <td>
                    {r.isLow ? <span className="badge warn">low</span> : <span className="badge ok">ok</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {movements.length > 0 && (
        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Ledger browser — last {movements.length} movements
          </summary>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>When</th>
                <th>Item</th>
                <th>Type</th>
                <th className="right">Qty</th>
                <th className="right">Value</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="muted mono" style={{ fontSize: ".8rem" }}>
                    {m.occurredAt.slice(0, 16).replace("T", " ")}
                  </td>
                  <td>{m.itemName}</td>
                  <td>
                    <span className="badge">{movementLabel(m.type)}</span>
                  </td>
                  <td
                    className="right mono"
                    style={{ color: m.qty < 0 ? "var(--err)" : "var(--ok)" }}
                  >
                    {m.qty > 0 ? "+" : ""}
                    {m.qty.toLocaleString()}
                  </td>
                  <td className="right mono">{m.value === null ? "—" : fmtIQD(m.value)}</td>
                  <td className="muted" style={{ fontSize: ".85rem" }}>
                    {m.reason ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
