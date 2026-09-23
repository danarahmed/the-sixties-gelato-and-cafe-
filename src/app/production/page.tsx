import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getProductionBatches } from "@/lib/db/read";
import { fmtQty } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const batches = await getProductionBatches(50);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.production")}</h1>
      <div className="card" style={{ borderColor: "var(--warn)" }}>
        <strong>Not built yet: recording a production batch.</strong>{" "}
        <span className="muted" style={{ fontSize: ".88rem" }}>
          The costing rule is designed and tested (ingredients out at average cost, output valued at
          what was consumed ÷ the actual yield), but there is no screen or database function to
          record a batch yet. Until there is, make-to-order items are sold through their recipe on{" "}
          <Link href="/products">Products</Link>, and batch-made stock should be entered on
          Inventory.
        </span>
      </div>

      {batches.length === 0 ? (
        <EmptyState
          title="No production batches"
          hint="Batches will be listed here once batch entry exists."
        />
      ) : (
        <div className="card tw">
          <table>
            <thead>
              <tr>
                <th>Recipe</th>
                <th className="right">Batches</th>
                <th className="right">Actual yield</th>
                <th>Status</th>
                <th>Produced</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.recipeName}</td>
                  <td className="right mono">{fmtQty(b.batches)}</td>
                  <td className="right mono">
                    {b.actualYield === null ? "—" : fmtQty(b.actualYield)}
                  </td>
                  <td>
                    <span className="badge">{b.status}</span>
                  </td>
                  <td className="muted mono" style={{ fontSize: ".8rem" }}>
                    {b.producedAt ? dateTimeIn(profile.timezone, b.producedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
