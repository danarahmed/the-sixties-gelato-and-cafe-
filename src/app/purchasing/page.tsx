import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems, getReceipts, getSuppliers } from "@/lib/db/read";
import { getItemCosts } from "@/lib/db/reports";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { ReceiveStockForm } from "@/components/ReceiveStockForm";

export const dynamic = "force-dynamic";

export default async function PurchasingPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const [items, suppliers, receipts, costs] = await Promise.all([
    getItems(),
    getSuppliers(),
    getReceipts(40),
    getItemCosts(),
  ]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.purchasing")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        Receiving brings the stock in at its landed cost — freight and other costs less rebates,
        spread over the lines by value — and posts{" "}
        <strong>Dr 1200 Inventory / Cr 2050 Goods received not invoiced</strong>. The
        supplier&apos;s bill, recorded on <Link href="/vendors">Vendors</Link>, clears 2050 and
        raises the payable, so the purchase is never counted twice. Each line is entered at its
        price per unit, as the invoice gives it; a price more than 25% away from what the item costs
        now is asked about before anything is received.
      </p>

      <ReceiveStockForm
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          baseUnit: i.baseUnit,
          units: i.units,
          // What a base unit costs now, to set each delivery's price against (0027).
          costNow: Number(costs.get(i.id) ?? 0) || null,
        }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        canReceive={has(profile, "purchase.receive")}
        canAddSupplier={has(profile, "purchase.create")}
      />

      <div className="card tw">
        <h3 style={{ marginTop: 0 }}>Recent goods receipts</h3>
        {receipts.length === 0 ? (
          <p className="muted" style={{ fontSize: ".9rem" }}>
            No receipts yet.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>When</th>
                <th>Supplier</th>
                <th className="right">Lines</th>
                <th className="right">Goods</th>
                <th className="right">Landed extras</th>
                <th className="right">Into stock</th>
                <th>Bill</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.receiptNo ?? "—"}</td>
                  <td className="muted mono" style={{ fontSize: ".8rem" }}>
                    {dateTimeIn(profile.timezone, r.receivedAt)}
                  </td>
                  <td>
                    {r.supplierName ?? (r.note ? <span className="muted">{r.note}</span> : "—")}
                  </td>
                  <td className="right mono">{r.lineCount}</td>
                  <td className="right mono">{fmtIQD(r.goodsValue)}</td>
                  <td className="right mono">{fmtIQD(r.landedExtras)}</td>
                  <td className="right mono">{fmtIQD(r.value)}</td>
                  <td>
                    {r.billed ? (
                      <span className="badge ok">Billed</span>
                    ) : r.billable ? (
                      <span
                        className="badge warn"
                        title={
                          r.legacy
                            ? "Received before the controls, which posted its payable then; its bill is recorded against that payable"
                            : undefined
                        }
                      >
                        Awaiting bill
                      </span>
                    ) : r.unjournaled ? (
                      <span
                        className="badge err"
                        title="Received before the controls and never journaled. The owner posts its journal from Reports → Do the books tie?"
                      >
                        Not journaled
                      </span>
                    ) : (
                      <span
                        className="badge"
                        title="Received before the controls; its journal has been reversed"
                      >
                        Before controls
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
