import { getT } from "@/lib/i18n/server";
import { DEMO_PRODUCTS, DEMO_RECIPES, itemName } from "@/lib/demo/catalog";
import { productMargin, channelLabel, CHANNELS } from "@/lib/demo/data";

export default async function ProductsPage() {
  const t = await getT();
  const margins = productMargin();

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("nav.products")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        Each product has one recipe that serves every channel. Lines tagged to a channel only deduct
        on that channel — that is how packaging differs between dine-in, takeaway, and Talabat.
      </p>

      {DEMO_PRODUCTS.map((p) => {
        const recipe = DEMO_RECIPES[p.recipeId]!;
        const rows = margins.filter((m) => m.name === p.name);
        return (
          <div key={p.id} className="card">
            <h3 style={{ marginTop: 0 }}>{p.name}</h3>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <h4 className="muted" style={{ margin: "0 0 6px" }}>
                  Recipe
                </h4>
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
                        <td>{itemName(l.componentId)}</td>
                        <td className="right mono">
                          {String(l.quantity)} {l.unitCode}
                        </td>
                        <td className="muted" style={{ fontSize: ".85rem" }}>
                          {l.appliesToChannels
                            ? l.appliesToChannels.map((c) => channelLabel[c]).join(", ")
                            : "all channels"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="muted" style={{ margin: "0 0 6px" }}>
                  Price &amp; margin by channel
                </h4>
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
                    {CHANNELS.map((ch) => {
                      const m = rows.find((r) => r.channel === ch)!;
                      return (
                        <tr key={ch}>
                          <td>{channelLabel[ch]}</td>
                          <td className="right mono">{m.price.format()}</td>
                          <td className="right mono">{m.cost.format()}</td>
                          <td
                            className="right mono"
                            style={{ color: m.margin.isNegative() ? "var(--err)" : "var(--ok)" }}
                          >
                            {m.margin.format()} ({m.pct}%)
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
      })}
    </div>
  );
}
