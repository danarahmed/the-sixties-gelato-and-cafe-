import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getProductionBatches } from "@/lib/db/read";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const t = await getT();
  const batches = await getProductionBatches(50).catch(() => []);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>🟢 Live database</div>
      <h1 style={{ margin: 0 }}>{t("nav.production")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        Production batches consume raw materials and output finished goods valued at{" "}
        <strong>actual consumed cost ÷ actual yield</strong> — the tested engine that drives this is
        in the domain core. Batch entry (a production recipe with an output item + yield) is the next
        increment; this screen reads the live <code>production_batch</code> table.
      </p>

      {batches.length === 0 ? (
        <EmptyState
          title="No production batches yet"
          hint="Meanwhile you can add finished-good stock directly on Inventory, or sell made-to-order items via a recipe on Products."
        />
      ) : (
        <div className="card">
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
                  <td className="right mono">{b.batches}</td>
                  <td className="right mono">{b.actualYield?.toLocaleString() ?? "—"}</td>
                  <td><span className="badge">{b.status}</span></td>
                  <td className="muted mono" style={{ fontSize: ".8rem" }}>
                    {b.producedAt ? b.producedAt.slice(0, 16).replace("T", " ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted" style={{ fontSize: ".85rem" }}>
        See <Link href="/inventory">Inventory</Link> for live stock and <Link href="/products">Products</Link> for recipes.
      </p>
    </div>
  );
}
