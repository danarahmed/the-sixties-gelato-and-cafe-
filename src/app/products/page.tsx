import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems } from "@/lib/db/read";
import {
  getMenuCosting,
  getMenuRecipeLines,
  type MenuCostRow,
  type RecipeLineRow,
} from "@/lib/db/reports";
import { channelLabel, fmtIQD, fmtQty } from "@/lib/format";
import { businessToday } from "@/lib/dates";
import { AddProductForm, PriceChange } from "@/components/AddProductForm";
import { EmptyState } from "@/components/ui";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const canEdit = has(profile, "recipe.edit");
  const [menu, lines, items] = await Promise.all([
    getMenuCosting(),
    getMenuRecipeLines(),
    canEdit ? getItems() : Promise.resolve([]),
  ]);

  const variants = new Map<
    string,
    { name: string; rows: MenuCostRow[]; recipe: RecipeLineRow[] }
  >();
  for (const m of menu) {
    const v = variants.get(m.variantId) ?? {
      name: m.variantName !== m.productName ? `${m.productName} — ${m.variantName}` : m.productName,
      rows: [],
      recipe: [],
    };
    v.rows.push(m);
    variants.set(m.variantId, v);
  }
  for (const l of lines) variants.get(l.variantId)?.recipe.push(l);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.products")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        One recipe serves every channel; lines tagged to a channel deduct only there — that is how
        the cup and lid are used for takeaway and delivery but not at a table. Prices and recipes
        change from a date, so every sale uses the price and recipe in force on its own day. Costs
        shown are today&apos;s, worked out exactly as a sale posts them.
      </p>

      {canEdit && (
        <AddProductForm
          items={items.map((i) => ({
            id: i.id,
            name: i.name,
            baseUnit: i.baseUnit,
            units: i.units,
          }))}
        />
      )}

      {variants.size === 0 ? (
        <EmptyState
          title="No products on sale"
          hint="A product appears here once it has at least one price."
        />
      ) : (
        [...variants.entries()].map(([id, v]) => (
          <div key={id} className="card">
            <h3 style={{ marginTop: 0 }}>{v.name}</h3>
            <div
              className="grid"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}
            >
              <div className="tw">
                <h4 className="muted" style={{ margin: "0 0 6px" }}>
                  Recipe in force
                  {v.recipe[0]
                    ? ` (version ${v.recipe[0].versionNo}, from ${v.recipe[0].effectiveFrom})`
                    : ""}
                </h4>
                {v.recipe.length === 0 ? (
                  <p className="muted" style={{ fontSize: ".85rem" }}>
                    No recipe — sold as bought, or not yet set up.
                  </p>
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
                      {v.recipe.map((l, i) => (
                        <tr key={i}>
                          <td>{l.component}</td>
                          <td className="right mono">
                            {fmtQty(l.quantity)} {l.unitCode}
                          </td>
                          <td className="muted" style={{ fontSize: ".85rem" }}>
                            {l.channels
                              ? l.channels
                                  .map((c) => channelLabel[c as SalesChannel] ?? c)
                                  .join(", ")
                              : "all channels"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="tw">
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
                    {v.rows.map((m) => {
                      const margin = m.unitCost === null ? null : m.price - m.unitCost;
                      return (
                        <tr key={m.channel}>
                          <td>{channelLabel[m.channel as SalesChannel] ?? m.channel}</td>
                          <td className="right mono">{fmtIQD(m.price)}</td>
                          <td className="right mono">
                            {m.unitCost === null ? "unknown" : fmtIQD(m.unitCost)}
                          </td>
                          <td
                            className="right mono"
                            style={{
                              color:
                                margin === null
                                  ? undefined
                                  : margin < 0
                                    ? "var(--err)"
                                    : "var(--ok)",
                            }}
                          >
                            {margin === null
                              ? "—"
                              : `${fmtIQD(margin)} (${m.price > 0 ? ((margin / m.price) * 100).toFixed(1) : "0"}%)`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {canEdit && <PriceChange variantId={id} today={today} />}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
