import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getBusinessConfig, getSuppliers } from "@/lib/db/read";
import { getPurchaseOrder } from "@/lib/db/purchasing";
import { fmtIQD, fmtQty, unitName } from "@/lib/format";
import { inOrderUnit, orderStage, STAGE_LABEL } from "@/lib/purchasing";
import { dateIn, dateTimeIn } from "@/lib/dates";
import { PrintDocument } from "@/components/PrintDocument";

export const dynamic = "force-dynamic";

/**
 * One purchase order (0044): what was ordered, from whom, for when and where,
 * who approved it, and what has come of each line so far. Printed, it is the
 * order the supplier is sent.
 */
export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [order, business, suppliers] = await Promise.all([
    getPurchaseOrder(id),
    getBusinessConfig(),
    getSuppliers(),
  ]);
  if (!order) notFound();
  const supplier = suppliers.find((s) => s.id === order.supplierId);
  const stage = orderStage(order);
  const day = (ts: string) => dateIn(profile.timezone, new Date(ts));

  // What the supplier is sent: the order as approved, nothing of what came since.
  const document = (
    <div>
      <h1>{business?.name ?? ""}</h1>
      <div style={{ fontSize: "15px", fontWeight: 700, margin: "6px 0" }}>
        {t("Purchase order {no}", { no: order.poNo })}
      </div>
      <div>
        {t("To")}: <strong>{order.supplier}</strong>
        {supplier?.contact ? ` · ${supplier.contact}` : ""}
        {supplier?.phone ? ` · ${supplier.phone}` : ""}
      </div>
      <div>
        {t("Ordered on {day}", { day: day(order.createdAt) })}
        {order.expectedOn ? ` · ${t("Expected by {day}", { day: order.expectedOn })}` : ""}
        {` · ${t("Deliver to {place}", { place: order.location })}`}
      </div>
      <table>
        <thead>
          <tr>
            <th>{t("Item")}</th>
            <th className="right">{t("Quantity")}</th>
            <th>{t("Unit")}</th>
            <th className="right">{t("Price per unit")}</th>
            <th className="right">{t("Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.lineId}>
              <td>{l.item}</td>
              <td className="right">{fmtQty(l.qty)}</td>
              <td>{l.unitCode}</td>
              <td className="right">{fmtIQD(l.unitPrice)}</td>
              <td className="right">{fmtIQD(l.amount)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4}>
              <strong>{t("Total")}</strong>
            </td>
            <td className="right">
              <strong>{fmtIQD(order.total)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      {order.note && <p>{order.note}</p>}
      {order.approvedBy && order.approvedAt && (
        <p>
          {t("Approved by {name} on {day}", { name: order.approvedBy, day: day(order.approvedAt) })}
        </p>
      )}
    </div>
  );

  return (
    <div className="grid" style={{ gap: 16 }} data-testid="po-page">
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>{t("Purchase order {no}", { no: order.poNo })}</h1>
        <span className="badge" data-testid="po-page-stage">
          {t(STAGE_LABEL[stage])}
        </span>
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 10 }}>
          {order.status !== "draft" && order.status !== "cancelled" && (
            <PrintDocument label={t("Print the order")}>{document}</PrintDocument>
          )}
          <Link href="/purchasing">{t("Back to Purchasing")}</Link>
        </span>
      </div>
      {order.status === "draft" && (
        <p className="muted" style={{ margin: 0 }}>
          {t("A draft is printed once a manager has approved it.")}
        </p>
      )}

      <div className="card tw">
        {document}
        <div className="muted" style={{ fontSize: ".82rem", marginTop: 8 }}>
          {t("Drafted by {name}, {when}", {
            name: order.createdBy ?? "—",
            when: dateTimeIn(profile.timezone, order.createdAt),
          })}
          {order.sentAt &&
            ` · ${t("Sent {when} by {name}", {
              when: dateTimeIn(profile.timezone, order.sentAt),
              name: order.sentBy ?? "—",
            })}`}
          {order.closedAt &&
            ` · ${t("Closed {when} by {name}", {
              when: dateTimeIn(profile.timezone, order.closedAt),
              name: order.closedBy ?? "—",
            })}${order.closeReason ? `: “${order.closeReason}”` : ""}`}
          {order.cancelledAt &&
            ` · ${t("Cancelled {when} by {name}", {
              when: dateTimeIn(profile.timezone, order.cancelledAt),
              name: order.cancelledBy ?? "—",
            })}: “${order.cancelReason ?? ""}”`}
        </div>
      </div>

      <div className="card tw" data-testid="po-received">
        <h3 style={{ marginTop: 0 }}>{t("What has come")}</h3>
        <table>
          <thead>
            <tr>
              <th>{t("Item")}</th>
              <th className="right">{t("Ordered")}</th>
              <th className="right">{t("Come")}</th>
              <th className="right">{t("Still to come")}</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={l.lineId}>
                <td>{l.item}</td>
                <td className="right mono">
                  {fmtQty(l.qty)} {l.unitCode}
                </td>
                <td className="right mono">
                  {fmtQty(inOrderUnit(l, l.receivedBase))} {l.unitCode}
                </td>
                <td className="right mono">
                  {fmtQty(inOrderUnit(l, l.outstandingBase))} {l.unitCode}
                </td>
              </tr>
            ))}
            {order.unexpected.map((u) => (
              <tr key={u.itemId}>
                <td>
                  {u.item} <span className="badge warn">{t("Not on the order")}</span>
                </td>
                <td className="right mono">—</td>
                <td className="right mono">
                  {fmtQty(u.baseQty)} {unitName(u.baseUnit, t)}
                </td>
                <td className="right mono">—</td>
              </tr>
            ))}
          </tbody>
        </table>
        {order.deliveries.length === 0 ? (
          <p className="muted" style={{ fontSize: ".85rem" }}>
            {t("Nothing has come against it yet.")}
          </p>
        ) : (
          <p className="muted" style={{ fontSize: ".85rem" }}>
            {t("Deliveries against it: {list}", {
              list: order.deliveries
                .map(
                  (d) =>
                    `${d.receiptNo ?? "—"} (${dateIn(profile.timezone, new Date(d.receivedAt))})`,
                )
                .join(", "),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
