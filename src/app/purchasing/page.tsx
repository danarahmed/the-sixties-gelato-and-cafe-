import { getT } from "@/lib/i18n/server";
import { getItems, getSuppliers, getReceipts } from "@/lib/db/read";
import { fmtIQD } from "@/lib/format";
import { ReceiveStockForm } from "@/components/ReceiveStockForm";
import type { Dimension } from "@domain/units/units.js";

export const dynamic = "force-dynamic";

export default async function PurchasingPage() {
  const t = await getT();
  const [items, suppliers, receipts] = await Promise.all([
    getItems().catch(() => []),
    getSuppliers().catch(() => []),
    getReceipts(30).catch(() => []),
  ]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>🟢 Live database</div>
      <h1 style={{ margin: 0 }}>{t("nav.purchasing")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        Receive goods in packs (carton, case, kg) — the engine converts to the base unit, folds in
        freight/rebates as landed cost, recomputes the weighted-average cost, and appends a real
        <code> purchase_receipt</code> movement to the ledger.
      </p>

      <ReceiveStockForm
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          baseUnit: i.baseUnit,
          dimension: i.dimension as Dimension,
        }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent goods receipts</h3>
        {receipts.length === 0 ? (
          <p className="muted" style={{ fontSize: ".9rem" }}>No receipts yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Supplier</th>
                <th className="right">Lines</th>
                <th className="right">Goods value</th>
                <th className="right">Landed add-ons</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td className="muted mono" style={{ fontSize: ".8rem" }}>
                    {r.receivedAt.slice(0, 16).replace("T", " ")}
                  </td>
                  <td>{r.supplierName ?? "—"}</td>
                  <td className="right mono">{r.lineCount}</td>
                  <td className="right mono">{fmtIQD(r.goodsValue)}</td>
                  <td className="right mono">{fmtIQD(r.landed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
