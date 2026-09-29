import Link from "next/link";
import { getMsg, getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems, getItemsOutOfUse, getMovements, getStockBoard } from "@/lib/db/read";
import { itemTypeLabel, movementLabel, fmtIQD, fmtQty } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { InventoryForms } from "@/components/InventoryForms";
import { LossesWaiting } from "@/components/LossesWaiting";
import { getLossesWaiting } from "@/lib/db/rules";
import { getPosCatalogue } from "@/lib/db/pos";
import { getProductionLots } from "@/lib/db/production";
import { EmptyState } from "@/components/ui";
import { PlaceSwitch } from "@/components/PlaceSwitch";
import { placeChoice } from "@/lib/place";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const profile = await requirePermission("cost.view", "waste.record");
  const t = await getT();
  const msg = await getMsg();
  const seesCost = has(profile, "cost.view");
  const approvesLosses = has(profile, "waste.approve");
  const recordsLosses = has(profile, "waste.record");
  // Where this device does its stock work, when the café has more than one place (AB).
  const { places, place, at } = await placeChoice();
  const [items, allBoard, movements, outOfUse, waiting, catalogue, lots] = await Promise.all([
    getItems(),
    seesCost ? getStockBoard(at) : Promise.resolve([]),
    seesCost ? getMovements(60, at) : Promise.resolve([]),
    seesCost ? getItemsOutOfUse() : Promise.resolve([]),
    approvesLosses ? getLossesWaiting() : Promise.resolve([]),
    // A product lost as made, and the batch an item is lost from (0048).
    recordsLosses && has(profile, "sale.create") ? getPosCatalogue() : Promise.resolve([]),
    recordsLosses && (has(profile, "production.record") || seesCost)
      ? getProductionLots(at)
      : Promise.resolve([]),
  ]);
  const sizes = new Map<string, number>();
  for (const p of catalogue) sizes.set(p.productId, (sizes.get(p.productId) ?? 0) + 1);
  const products = catalogue
    .map((p) => ({
      variantId: p.variantId,
      name:
        (sizes.get(p.productId) ?? 0) > 1 ? `${p.productName} — ${p.variantName}` : p.productName,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
      <div className="title-row">
        <h1>{t("nav.inventory")}</h1>
        <PlaceSwitch places={places} current={place?.id ?? null} />
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        <Rich
          text={t(
            "Stock here is added up from everything recorded — deliveries, sales, counts, losses and transfers — so there is no figure to type over. Each change below is recorded, costed and booked in one step.",
          )}
        />
        {seesCost && (
          <>
            {" "}
            <Rich
              text={t(
                "<usage>Usage</usage> sets what each item used between two counts against what its recipes say.",
              )}
              tags={{ usage: (c) => <Link href="/inventory/usage">{c}</Link> }}
            />
          </>
        )}
        {places.length > 1 && (seesCost || has(profile, "stock.transfer")) && (
          <>
            {" "}
            <Rich
              text={t(
                "<transfers>Transfers</transfers> send stock from one of the café's places to another.",
              )}
              tags={{
                transfers: (c) => (
                  <Link href="/inventory/transfers" data-testid="to-transfers">
                    {c}
                  </Link>
                ),
              }}
            />
          </>
        )}
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

      <LossesWaiting losses={waiting} myId={profile.id} timezone={profile.timezone} />

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
        products={products}
        lots={lots.map((l) => ({
          lotId: l.lotId,
          lot: l.lot,
          itemId: l.itemId,
          batchNo: l.batchNo,
          left: l.left,
          status: l.status,
        }))}
        canWaste={recordsLosses}
        canCorrect={has(profile, "inventory.adjust.approve")}
        isOwner={profile.roles.includes("owner")}
        lossLimit={profile.wasteApprovalOver}
        lossWindow={profile.wasteApprovalWindow}
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
            <table data-testid="stock-board">
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
