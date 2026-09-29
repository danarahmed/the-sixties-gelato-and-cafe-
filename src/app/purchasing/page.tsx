import { Fragment } from "react";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems, getItemsOutOfUse, getReceipts, getSuppliers } from "@/lib/db/read";
import { getItemCosts } from "@/lib/db/reports";
import { getPurchaseOrders, getSupplierReturns } from "@/lib/db/purchasing";
import { isOpen } from "@/lib/purchasing";
import { fmtIQD } from "@/lib/format";
import { businessToday, dateIn, dateTimeIn, monthEnd, monthStart } from "@/lib/dates";
import { ReceiveStockForm } from "@/components/ReceiveStockForm";
import { CorrectionCatalogue, ReceiptCorrection } from "@/components/ReceiptCorrection";
import { PurchaseOrders } from "@/components/purchasing/PurchaseOrders";
import { ReturnGoods } from "@/components/purchasing/ReturnGoods";
import { DocumentsLink } from "@/components/documents/DocumentsLink";
import { getDocumentCounts } from "@/lib/db/documents";
import { PlaceSwitch } from "@/components/PlaceSwitch";
import { placeChoice } from "@/lib/place";

export const dynamic = "force-dynamic";

export default async function PurchasingPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  // A delivery entered wrong is corrected, or reversed, by whoever approves stock adjustments (0038).
  const canCorrect = has(profile, "inventory.adjust.approve");
  const canCreate = has(profile, "purchase.create");
  const canApprove = has(profile, "purchase.approve");
  const canReceive = has(profile, "purchase.receive");
  // A delivery with no order, a new order and a return not named against a
  // delivery are for this device's place (AB).
  const { places, place } = await placeChoice();
  const [items, suppliers, receipts, costs, outOfUse, { orders, approveUpTo }, returns] =
    await Promise.all([
      getItems(),
      getSuppliers(),
      getReceipts(40),
      getItemCosts(),
      canCorrect ? getItemsOutOfUse() : Promise.resolve([]),
      getPurchaseOrders(),
      getSupplierReturns(20),
    ]);
  // The documents kept with each delivery and return (0053).
  const [receiptDocs, returnDocs] = await Promise.all([
    getDocumentCounts(
      "goods_receipt",
      receipts.map((r) => r.id),
    ),
    getDocumentCounts(
      "supplier_return",
      returns.map((x) => x.id),
    ),
  ]);
  const today = businessToday(profile.timezone);
  const itemName = new Map([...items, ...outOfUse].map((i) => [i.id, i.name]));
  const kindLabel = (k: string) =>
    ({
      quantity: t("the quantity"),
      price: t("the price"),
      item: t("the item"),
      supplier: t("the supplier"),
      date: t("the date"),
      reversed: t("reversed"),
    })[k] ?? k;
  const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmtIQD(Math.abs(n));
  const columns = canCorrect ? 9 : 8;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="title-row">
        <h1>{t("nav.purchasing")}</h1>
        <PlaceSwitch places={places} current={place?.id ?? null} />
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        <Rich
          text={t(
            "Receiving brings the stock in at its landed cost — freight and other costs less rebates, spread over the lines by value — and posts <b>Dr 1200 Inventory / Cr 2050 Goods received not invoiced</b>. The supplier's bill, recorded on <vendors>Vendors</vendors>, clears 2050 and raises the payable, so the purchase is never counted twice. Each line is entered at its price per unit, as the invoice gives it; a price more than 25% away from what the item costs now is asked about before anything is received.",
          )}
          tags={{ vendors: (c) => <Link href="/vendors">{c}</Link> }}
        />
      </p>

      <div
        className="card"
        style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
        data-testid="buying-link"
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <strong>{t("What to buy")}</strong>
          <div className="muted" style={{ fontSize: ".85rem" }}>
            {t(
              "Each item's stock, use and orders, and so how much of it to order and from whom, with why: the lines chosen become a draft order for each supplier.",
            )}
          </div>
        </div>
        <Link
          href="/purchasing/buying-list"
          className="btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 34,
            padding: "0 13px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--brand)",
            fontWeight: 600,
            fontSize: ".86rem",
            textDecoration: "none",
          }}
        >
          {t("Open What to buy")}
        </Link>
      </div>

      <PurchaseOrders
        orders={orders}
        approveUpTo={approveUpTo}
        items={items.map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit, units: i.units }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        canCreate={canCreate}
        canApprove={canApprove}
      />

      <ReceiveStockForm
        orders={orders.filter(isOpen)}
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          nameAr: i.nameAr,
          nameCkb: i.nameCkb,
          baseUnit: i.baseUnit,
          units: i.units,
          // What a base unit costs now, to set each delivery's price against (0027).
          costNow: Number(costs.get(i.id) ?? 0) || null,
        }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        canReceive={canReceive}
        canAddSupplier={has(profile, "purchase.create")}
        // As on Inventory, and as create_item() allows (0027).
        canAddItem={
          has(profile, "settings.manage") ||
          has(profile, "purchase.create") ||
          has(profile, "inventory.adjust.approve")
        }
      />

      {(canReceive || canCreate) && suppliers.length > 0 && (
        <ReturnGoods
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          items={items.map((i) => ({
            id: i.id,
            name: i.name,
            baseUnit: i.baseUnit,
            units: i.units,
          }))}
          deliveries={receipts.map((r) => ({
            id: r.id,
            receiptNo: r.receiptNo,
            supplierId: r.supplierId,
            receivedOn: r.receivedOn ?? dateIn(profile.timezone, new Date(r.receivedAt)),
            billed: r.billed,
            usable: !r.legacy && !r.reversed && !r.unjournaled,
            itemIds: [...new Set(r.lines.map((l) => l.itemId))],
          }))}
        />
      )}

      {returns.length > 0 && (
        <div className="card tw" data-testid="returns-list">
          <h3 style={{ marginTop: 0 }}>{t("Recent returns to suppliers")}</h3>
          <table>
            <thead>
              <tr>
                <th>{t("No.")}</th>
                <th>{t("When")}</th>
                <th>{t("Supplier")}</th>
                <th>{t("Delivery")}</th>
                <th>{t("What went back")}</th>
                <th className="right">{t("Owed back")}</th>
                <th>{t("How")}</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((x) => (
                <tr key={x.id} data-testid="return-row" data-return={x.returnNo}>
                  <td className="mono">
                    {x.returnNo}
                    <DocumentsLink kind="supplier_return" id={x.id} count={returnDocs[x.id] ?? 0} />
                  </td>
                  <td className="muted mono" style={{ fontSize: ".8rem" }}>
                    {dateTimeIn(profile.timezone, x.createdAt)}
                  </td>
                  <td>{x.supplier}</td>
                  <td className="mono">{x.receiptNo ?? "—"}</td>
                  <td style={{ fontSize: ".8rem" }}>
                    {x.lines.map((l, i) => (
                      <div key={i}>
                        {itemName.get(l.itemId) ?? "—"} {l.qty} {l.unitCode}
                      </div>
                    ))}
                    <div className="muted">“{x.reason}”</div>
                  </td>
                  <td className="right mono">{fmtIQD(x.value)}</td>
                  <td style={{ fontSize: ".8rem" }}>
                    {x.against === "delivery"
                      ? t("Off the delivery's bill")
                      : x.creditNo !== null
                        ? t("Credit {no} on the account", { no: x.creditNo })
                        : t("On the account")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CorrectionCatalogue
        items={
          canCorrect
            ? items.map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit, units: i.units }))
            : []
        }
        suppliers={canCorrect ? suppliers.map((s) => ({ id: s.id, name: s.name })) : []}
      >
        <div className="card tw">
          <h3 style={{ marginTop: 0 }}>{t("Recent goods receipts")}</h3>
          {canCorrect && receipts.length > 0 && (
            <p className="muted" style={{ marginTop: 0, fontSize: ".85rem" }}>
              {t(
                "A delivery entered wrong is corrected here until it is billed: its quantities, prices, items, supplier or date, or all of it reversed. What was entered first is kept, and each correction is a document of its own, with its journal.",
              )}
            </p>
          )}
          {receipts.length === 0 ? (
            <p className="muted" style={{ fontSize: ".9rem" }}>
              {t("No receipts yet.")}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("No.")}</th>
                  <th>{t("When")}</th>
                  <th>{t("Supplier")}</th>
                  <th className="right">{t("Lines")}</th>
                  <th className="right">{t("Goods")}</th>
                  <th className="right">{t("Landed extras")}</th>
                  <th className="right">{t("Into stock")}</th>
                  <th>{t("Bill")}</th>
                  {canCorrect && <th />}
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => {
                  const entered = dateIn(profile.timezone, new Date(r.receivedAt));
                  const lastDay = monthEnd(entered) < today ? monthEnd(entered) : today;
                  return (
                    <Fragment key={r.id}>
                      <tr data-testid="receipt-row" data-receipt={r.receiptNo ?? ""}>
                        <td className="mono">
                          {r.receiptNo ?? "—"}
                          <DocumentsLink
                            kind="goods_receipt"
                            id={r.id}
                            count={receiptDocs[r.id] ?? 0}
                          />
                        </td>
                        <td className="muted mono" style={{ fontSize: ".8rem" }}>
                          {r.receivedOn && r.receivedOn !== entered ? (
                            <span
                              title={t("Entered {when}", {
                                when: dateTimeIn(profile.timezone, r.receivedAt),
                              })}
                            >
                              {r.receivedOn}
                            </span>
                          ) : (
                            dateTimeIn(profile.timezone, r.receivedAt)
                          )}
                        </td>
                        <td>
                          {r.supplierName ??
                            (r.note ? <span className="muted">{r.note}</span> : "—")}
                        </td>
                        <td className="right mono">{r.lineCount}</td>
                        <td className="right mono">{fmtIQD(r.goodsValue)}</td>
                        <td className="right mono">{fmtIQD(r.landedExtras)}</td>
                        <td className="right mono">{fmtIQD(r.value)}</td>
                        <td>
                          {r.reversed ? (
                            <span className="badge err">{t("Reversed")}</span>
                          ) : r.billed ? (
                            <span className="badge ok">{t("Billed")}</span>
                          ) : r.billable ? (
                            <span
                              className="badge warn"
                              title={
                                r.legacy
                                  ? t(
                                      "Received before the controls, which posted its payable then; its bill is recorded against that payable",
                                    )
                                  : undefined
                              }
                            >
                              {t("Awaiting bill")}
                            </span>
                          ) : r.unjournaled ? (
                            <span
                              className="badge err"
                              title={t(
                                "Received before the controls and never journaled. The owner posts its journal from Reports → Do the books tie?",
                              )}
                            >
                              {t("Not journaled")}
                            </span>
                          ) : (
                            <span
                              className="badge"
                              title={t(
                                "Received before the controls; its journal has been reversed",
                              )}
                            >
                              {t("Before controls")}
                            </span>
                          )}
                        </td>
                        {canCorrect && (
                          <td>
                            {!r.legacy && (
                              <ReceiptCorrection
                                correctable={!r.billed && !r.reversed}
                                receipt={{
                                  id: r.id,
                                  receiptNo: r.receiptNo,
                                  receivedOn: r.receivedOn ?? entered,
                                  firstDay: monthStart(entered),
                                  lastDay,
                                  supplierId: r.supplierId,
                                  supplierName: r.supplierName,
                                  lines: r.lines.map((l) => ({
                                    ...l,
                                    itemName: itemName.get(l.itemId) ?? "—",
                                  })),
                                }}
                              />
                            )}
                          </td>
                        )}
                      </tr>
                      {r.corrections.length > 0 && (
                        <tr data-testid="receipt-corrections">
                          <td
                            colSpan={columns}
                            className="muted"
                            style={{ fontSize: ".8rem", paddingTop: 0 }}
                          >
                            {r.corrections.map((c) => (
                              <div key={c.no}>
                                {t("Correction {no}", { no: c.no })} ·{" "}
                                {dateTimeIn(profile.timezone, c.at)}
                                {c.by ? ` · ${c.by}` : ""} · {c.kinds.map(kindLabel).join(", ")} · “
                                {c.reason}”{" · "}
                                {c.journalNo !== null
                                  ? t(
                                      "stock {stock}, owed for it {grni}, price variance {variance} (journal {journal})",
                                      {
                                        stock: signed(c.stock),
                                        grni: signed(c.grni),
                                        variance: signed(c.variance),
                                        journal: c.journalNo,
                                      },
                                    )
                                  : t("nothing to post")}
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </CorrectionCatalogue>
    </div>
  );
}
