import { getT } from "@/lib/i18n/server";
import { fetchStockBoard } from "@/lib/db/inventory";
import { getItems } from "@/lib/db/read";
import { CountClient } from "@/components/CountClient";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CountPage() {
  const t = await getT();
  const [board, items] = await Promise.all([
    fetchStockBoard().catch(() => []),
    getItems().catch(() => []),
  ]);
  const expected = new Map((board ?? []).map((b) => [b.itemId, b.onHandBase]));
  const rows = items.map((i) => ({
    itemId: i.id,
    name: i.name,
    unit: i.baseUnit,
    expectedBase: expected.get(i.id) ?? 0,
  }));

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 760 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>🟢 Live database</div>
      <h1 style={{ margin: 0 }}>{t("nav.count")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        <strong>Blind count:</strong> the expected quantity is hidden while you count. On submit the
        system posts a single <code>count_adjustment</code> movement per variance (counted − expected)
        — it never overwrites history.
      </p>

      {rows.length === 0 ? (
        <EmptyState title="No items to count" hint="Add stock items on the Inventory screen first." />
      ) : (
        <CountClient rows={rows} />
      )}
    </div>
  );
}
