import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems, getMovements, getStockBoard } from "@/lib/db/read";
import { itemTypeLabel, movementLabel, fmtIQD, fmtQty } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { InventoryForms } from "@/components/InventoryForms";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const profile = await requirePermission("cost.view", "waste.record");
  const t = await getT();
  const seesCost = has(profile, "cost.view");
  const [items, board, movements] = await Promise.all([
    getItems(),
    seesCost ? getStockBoard() : Promise.resolve([]),
    seesCost ? getMovements(60) : Promise.resolve([]),
  ]);

  // An item with no movement at all is not on the board: it has no stock yet.
  const stocked = new Set(board.map((r) => r.itemId));
  const unstocked = seesCost ? items.filter((i) => !stocked.has(i.id)) : [];
  const totalValue = board.reduce((s, r) => s + r.value, 0);
  const low = board.filter((r) => r.isLow).length;
  const negative = board.filter((r) => r.isNegative).length;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.inventory")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        Stock on hand is <strong>derived from the movement ledger</strong> — there is no stock
        figure to edit. Every change below adds a movement, valued at the item&apos;s average cost
        by the database and journaled in the same step.
      </p>

      {seesCost && (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))" }}
        >
          <div className="card stat">
            <span className="label">Items tracked</span>
            <span className="value">{board.length}</span>
          </div>
          <div className="card stat">
            <span className="label">Stock value (ledger)</span>
            <span className="value mono">{fmtIQD(totalValue)}</span>
          </div>
          <div className="card stat">
            <span className="label">Below reorder level</span>
            <span className="value" style={{ color: low ? "var(--warn)" : "var(--ok)" }}>
              {low}
            </span>
          </div>
          <div className="card stat">
            <span className="label">Negative stock</span>
            <span className="value" style={{ color: negative ? "var(--err)" : "var(--ok)" }}>
              {negative}
            </span>
          </div>
        </div>
      )}

      <InventoryForms
        items={items.map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit, units: i.units }))}
        unstocked={unstocked.map((i) => ({
          id: i.id,
          name: i.name,
          baseUnit: i.baseUnit,
          units: i.units,
        }))}
        canAddItem={
          has(profile, "settings.manage") ||
          has(profile, "purchase.create") ||
          has(profile, "inventory.adjust.approve")
        }
        canWaste={has(profile, "waste.record")}
        canCorrect={has(profile, "inventory.adjust.approve")}
      />

      {seesCost &&
        (board.length === 0 ? (
          <EmptyState
            title={items.length > 0 ? "No stock recorded yet" : "No stock items yet"}
            hint={
              items.length > 0
                ? "Give each item its opening stock above: what is on the shelf, at what it cost."
                : "Add the first item above, with its opening stock."
            }
          />
        ) : (
          <div className="card tw">
            <h3 style={{ marginTop: 0 }}>Stock on hand</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th className="right">On hand</th>
                  <th>Unit</th>
                  <th className="right">Reorder</th>
                  <th className="right">Avg cost</th>
                  <th className="right">Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r) => (
                  <tr key={r.itemId}>
                    <td>{r.name}</td>
                    <td className="muted">{itemTypeLabel(r.itemType)}</td>
                    <td
                      className="right mono"
                      style={{ color: r.isNegative ? "var(--err)" : undefined }}
                    >
                      {fmtQty(r.onHandBase)}
                    </td>
                    <td className="muted">{r.unit}</td>
                    <td className="right mono muted">
                      {r.reorderBase === null ? "—" : fmtQty(r.reorderBase)}
                    </td>
                    <td className="right mono">
                      {r.unitCost === null ? "—" : `${fmtQty(r.unitCost)} IQD`}
                    </td>
                    <td className="right mono">{fmtIQD(r.value)}</td>
                    <td>
                      {r.isNegative ? (
                        <span className="badge err">negative</span>
                      ) : r.isLow ? (
                        <span className="badge warn">low</span>
                      ) : (
                        <span className="badge ok">ok</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {negative > 0 && (
              <p className="red" style={{ fontSize: ".8rem" }}>
                Negative stock means more was sold or used than the ledger knows arrived — usually a
                receipt not yet entered. Sales from it are costed at the last purchase cost, never
                at zero; turn on &ldquo;prevent negative stock&rdquo; to refuse such sales instead.
              </p>
            )}
          </div>
        ))}

      {movements.length > 0 && (
        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Ledger browser — last {movements.length} movements
          </summary>
          <div className="tw">
            <table style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th className="right">Qty</th>
                  <th className="right">Value</th>
                  <th>Note</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="muted mono" style={{ fontSize: ".8rem", whiteSpace: "nowrap" }}>
                      {dateTimeIn(profile.timezone, m.occurredAt)}
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
                      {fmtQty(m.qty)}
                    </td>
                    <td className="right mono">{m.value === null ? "—" : fmtIQD(m.value)}</td>
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
        </details>
      )}
    </div>
  );
}
