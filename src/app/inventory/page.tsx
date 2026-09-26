import Link from "next/link";
import { getMsg, getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems, getItemsOutOfUse, getMovements, getStockBoard } from "@/lib/db/read";
import { itemTypeLabel, movementLabel, fmtIQD, fmtQty } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { InventoryForms } from "@/components/InventoryForms";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const profile = await requirePermission("cost.view", "waste.record");
  const t = await getT();
  const msg = await getMsg();
  const seesCost = has(profile, "cost.view");
  const [items, allBoard, movements, outOfUse] = await Promise.all([
    getItems(),
    seesCost ? getStockBoard() : Promise.resolve([]),
    seesCost ? getMovements(60) : Promise.resolve([]),
    seesCost ? getItemsOutOfUse() : Promise.resolve([]),
  ]);
  // The board shows the items in use; one out of use has no stock left (0027).
  const inUse = new Set(items.map((i) => i.id));
  const board = allBoard.filter((r) => inUse.has(r.itemId));

  // An item with no movement at all is not on the board: it has no stock yet.
  const stocked = new Set(allBoard.map((r) => r.itemId));
  const unstocked = seesCost ? items.filter((i) => !stocked.has(i.id)) : [];
  const totalValue = board.reduce((s, r) => s + r.value, 0);
  const low = board.filter((r) => r.isLow).length;
  const negative = board.filter((r) => r.isNegative).length;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.inventory")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        <Rich
          text={t(
            "Stock on hand is <b>derived from the movement ledger</b> — there is no stock figure to edit. Every change below adds a movement, valued at the item's average cost by the database and journaled in the same step.",
          )}
        />
      </p>

      {seesCost && (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))" }}
        >
          <div className="card stat">
            <span className="label">{t("Items tracked")}</span>
            <span className="value">{board.length}</span>
          </div>
          <div className="card stat">
            <span className="label">{t("Stock value (ledger)")}</span>
            <span className="value mono">{fmtIQD(totalValue)}</span>
          </div>
          <div className="card stat">
            <span className="label">{t("Below reorder level")}</span>
            <span className="value" style={{ color: low ? "var(--warn)" : "var(--ok)" }}>
              {low}
            </span>
          </div>
          <div className="card stat">
            <span className="label">{t("Negative stock")}</span>
            <span className="value" style={{ color: negative ? "var(--err)" : "var(--ok)" }}>
              {negative}
            </span>
          </div>
        </div>
      )}

      <InventoryForms
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          nameAr: i.nameAr,
          nameCkb: i.nameCkb,
          baseUnit: i.baseUnit,
          units: i.units,
        }))}
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
        isOwner={profile.roles.includes("owner")}
      />

      {seesCost &&
        (board.length === 0 ? (
          <EmptyState
            title={items.length > 0 ? t("No stock recorded yet") : t("No stock items yet")}
            hint={
              items.length > 0
                ? t(
                    "Give each item its opening stock above: what is on the shelf, at what it cost.",
                  )
                : t("Add the first item above, with its opening stock.")
            }
          />
        ) : (
          <div className="card tw">
            <h3 style={{ marginTop: 0 }}>{t("Stock on hand")}</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: ".82rem" }}>
              {t(
                "Open an item for its stock card: what it opened with, what came in and went out, and what is left.",
              )}
            </p>
            <table>
              <thead>
                <tr>
                  <th>{t("Item")}</th>
                  <th>{t("Type")}</th>
                  <th className="right">{t("On hand")}</th>
                  <th>{t("Unit")}</th>
                  <th className="right">{t("Reorder")}</th>
                  <th className="right">{t("Avg cost")}</th>
                  <th className="right">{t("Value")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r) => (
                  <tr key={r.itemId}>
                    <td>
                      <Link
                        className="drill"
                        href={`/inventory/${r.itemId}`}
                        title={t("Its stock card")}
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="muted">{t(itemTypeLabel(r.itemType))}</td>
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
                      {/* i18n-ignore: a cost in IQD, the currency's code */}
                      {r.unitCost === null ? "—" : `${fmtQty(r.unitCost)} IQD`}
                    </td>
                    <td className="right mono">{fmtIQD(r.value)}</td>
                    <td>
                      {r.isNegative ? (
                        <span className="badge err">{t("negative")}</span>
                      ) : r.isLow ? (
                        <span className="badge warn">{t("low")}</span>
                      ) : (
                        <span className="badge ok">{t("ok")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {negative > 0 && (
              <p className="red" style={{ fontSize: ".8rem" }}>
                {t(
                  "Negative stock means more was sold or used than the ledger knows arrived — usually a receipt not yet entered. Sales from it are costed at the last purchase cost, never at zero; turn on “prevent negative stock” to refuse such sales instead.",
                )}
              </p>
            )}
          </div>
        ))}

      {seesCost && (unstocked.length > 0 || outOfUse.length > 0) && (
        <div className="card" data-testid="other-items" style={{ fontSize: ".88rem" }}>
          {unstocked.length > 0 && (
            <p style={{ marginTop: 0 }}>
              <strong>{t("No stock yet:")}</strong>{" "}
              {unstocked.map((i, n) => (
                <span key={i.id}>
                  {n > 0 && ", "}
                  <Link className="drill" href={`/inventory/${i.id}`}>
                    {i.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {outOfUse.length > 0 && (
            <p style={{ marginBottom: 0 }}>
              <strong>{t("Out of use:")}</strong>{" "}
              {outOfUse.map((i, n) => (
                <span key={i.id}>
                  {n > 0 && ", "}
                  <Link className="drill" href={`/inventory/${i.id}`}>
                    {i.name}
                  </Link>
                </span>
              ))}{" "}
              <span className="muted">
                · {t("kept for their history; open one to bring it back into use")}
              </span>
            </p>
          )}
        </div>
      )}

      {movements.length > 0 && (
        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            {t("Ledger browser — last {n} movements", { n: movements.length })}
          </summary>
          <div className="tw">
            <table style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>{t("When")}</th>
                  <th>{t("Item")}</th>
                  <th>{t("Type")}</th>
                  <th className="right">{t("Qty")}</th>
                  <th className="right">{t("Value")}</th>
                  <th>{t("Note")}</th>
                  <th>{t("By")}</th>
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
                      <span className="badge">{t(movementLabel(m.type))}</span>
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
                      {msg(m.reason ?? "")}
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
