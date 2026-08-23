import { getT } from "@/lib/i18n/server";
import { loadCatalog } from "@/lib/db/catalog";
import { getItems } from "@/lib/db/read";
import { channelLabel, fmtIQD, SELLABLE_CHANNELS } from "@/lib/format";
import { AddProductForm } from "@/components/AddProductForm";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const t = await getT();
  const [cat, items] = await Promise.all([
    loadCatalog().catch(() => null),
    getItems().catch(() => []),
  ]);
  const variants = cat?.variants ?? [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>
        🟢 Live database
      </div>
      <h1 style={{ margin: 0 }}>{t("nav.products")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        Each product has one recipe that serves every channel. Lines tagged to a channel only deduct
        on that channel — that is how packaging differs between dine-in, takeaway, and Talabat.
      </p>

      <AddProductForm items={items.map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit }))} />

      {variants.length === 0 ? (
        <EmptyState
          title="No products yet"
          hint="Use “Add menu product” above. Products need at least one stock item to build a recipe."
        />
      ) : (
        variants.map((v) => {
          const recipe = v.recipeId ? cat!.recipes.get(v.recipeId) : undefined;
          return (
            <div key={v.variantId} className="card">
              <h3 style={{ marginTop: 0 }}>{v.productName}</h3>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <h4 className="muted" style={{ margin: "0 0 6px" }}>Recipe</h4>
                  {!recipe || recipe.lines.length === 0 ? (
                    <p className="muted" style={{ fontSize: ".85rem" }}>No recipe lines.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Component</th>
                          <th className="right">Qty</th>
                          <th>Applies to</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipe.lines.map((l, i) => (
                          <tr key={i}>
                            <td>{cat!.items.get(l.componentId)?.name ?? l.componentId}</td>
                            <td className="right mono">
                              {String(l.quantity)} {l.unitCode}
                            </td>
                            <td className="muted" style={{ fontSize: ".85rem" }}>
                              {l.appliesToChannels && l.appliesToChannels.length > 0
                                ? l.appliesToChannels.map((c) => channelLabel[c]).join(", ")
                                : "all channels"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  <h4 className="muted" style={{ margin: "0 0 6px" }}>Price &amp; margin by channel</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Channel</th>
                        <th className="right">Price</th>
                        <th className="right">Cost</th>
                        <th className="right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SELLABLE_CHANNELS.map((ch) => {
                        const price = v.priceByChannel[ch];
                        if (price == null) return null;
                        const cost = v.cogsByChannel[ch] ?? 0;
                        const margin = price - cost;
                        const pct = price > 0 ? ((margin / price) * 100).toFixed(1) : "0";
                        return (
                          <tr key={ch}>
                            <td>{channelLabel[ch]}</td>
                            <td className="right mono">{fmtIQD(price)}</td>
                            <td className="right mono">{fmtIQD(cost)}</td>
                            <td className="right mono" style={{ color: margin < 0 ? "var(--err)" : "var(--ok)" }}>
                              {fmtIQD(margin)} ({pct}%)
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
