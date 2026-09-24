import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems } from "@/lib/db/read";
import { getMenuSetup, type MenuProduct } from "@/lib/db/menu";
import {
  getMenuCosting,
  getMenuRecipeLines,
  type MenuCostRow,
  type RecipeLineRow,
} from "@/lib/db/reports";
import { channelLabel, fmtIQD, fmtQty } from "@/lib/format";
import { businessToday } from "@/lib/dates";
import { AddProductForm, PriceChange } from "@/components/AddProductForm";
import { CategoriesManager } from "@/components/menu/CategoriesManager";
import { ProductSetup } from "@/components/menu/ProductSetup";
import { EmptyState } from "@/components/ui";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

interface Costing {
  rows: MenuCostRow[];
  recipe: RecipeLineRow[];
}

function RecipeAndPrices({
  name,
  costing,
  variantId,
  canEdit,
  today,
}: {
  name: string | null;
  costing: Costing | undefined;
  variantId: string;
  canEdit: boolean;
  today: string;
}) {
  const recipe = costing?.recipe ?? [];
  const rows = costing?.rows ?? [];
  return (
    <div>
      {name && <h4 style={{ margin: "10px 0 4px" }}>{name}</h4>}
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}
      >
        <div className="tw">
          <h4 className="muted" style={{ margin: "0 0 6px" }}>
            Recipe in force
            {recipe[0] ? ` (version ${recipe[0].versionNo}, from ${recipe[0].effectiveFrom})` : ""}
          </h4>
          {recipe.length === 0 ? (
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
                {recipe.map((l, i) => (
                  <tr key={i}>
                    <td>{l.component}</td>
                    <td className="right mono">
                      {fmtQty(l.quantity)} {l.unitCode}
                    </td>
                    <td className="muted" style={{ fontSize: ".85rem" }}>
                      {l.channels
                        ? l.channels.map((c) => channelLabel[c as SalesChannel] ?? c).join(", ")
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
          {rows.length === 0 ? (
            <p className="muted" style={{ fontSize: ".85rem" }}>
              No price yet: the till cannot sell it until it has one.
            </p>
          ) : (
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
                {rows.map((m) => {
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
                            margin === null ? undefined : margin < 0 ? "var(--err)" : "var(--ok)",
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
          )}
          {canEdit && <PriceChange variantId={variantId} today={today} />}
        </div>
      </div>
    </div>
  );
}

export default async function ProductsPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const canEdit = has(profile, "recipe.edit");
  const [menu, lines, items, setup] = await Promise.all([
    getMenuCosting(),
    getMenuRecipeLines(),
    canEdit ? getItems() : Promise.resolve([]),
    getMenuSetup(),
  ]);

  const costing = new Map<string, Costing>();
  for (const m of menu) {
    const c = costing.get(m.variantId) ?? { rows: [], recipe: [] };
    c.rows.push(m);
    costing.set(m.variantId, c);
  }
  for (const l of lines) costing.get(l.variantId)?.recipe.push(l);

  const { categories, products } = setup;
  const counts = new Map<string, number>();
  for (const p of products)
    if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);

  // On the till, by category in the till's order; then everything hidden from it.
  const onTill = products.filter((p) => p.isActive);
  const groups: { key: string; title: string; hidden: boolean; products: MenuProduct[] }[] = [
    ...categories.map((c) => ({
      key: c.id,
      title: c.name,
      hidden: !c.isActive,
      products: onTill.filter((p) => p.categoryId === c.id),
    })),
    {
      key: "none",
      title: "No category",
      hidden: false,
      products: onTill.filter((p) => !p.categoryId),
    },
  ].filter((g) => g.products.length > 0);
  const hidden = products.filter((p) => !p.isActive);

  const card = (p: MenuProduct) => (
    <div key={p.id} className="card grid" style={{ gap: 8 }}>
      <ProductSetup product={p} categories={categories} canEdit={canEdit} />
      {p.isActive && (
        <details>
          <summary className="muted" style={{ fontSize: ".88rem" }}>
            Recipe, prices and margin
            {p.variants.length > 1 ? ` · ${p.variants.length} sizes or flavours` : ""}
          </summary>
          {p.variants
            .filter((v) => v.isActive)
            .map((v) => (
              <RecipeAndPrices
                key={v.id}
                name={p.variants.length > 1 || v.name !== p.name ? v.name : null}
                costing={costing.get(v.id)}
                variantId={v.id}
                canEdit={canEdit}
                today={today}
              />
            ))}
        </details>
      )}
    </div>
  );

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.products")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        One recipe serves every channel; lines tagged to a channel deduct only there — that is how
        the cup and lid are used for takeaway and delivery but not at a table. Prices and recipes
        change from a date, so every sale uses the price and recipe in force on its own day. Costs
        shown are today&apos;s, worked out exactly as a sale posts them. A photo, a category and a ★
        make a product quick to find on the till.
      </p>

      {canEdit && (
        <AddProductForm
          items={items.map((i) => ({
            id: i.id,
            name: i.name,
            baseUnit: i.baseUnit,
            units: i.units,
          }))}
          categories={categories.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name }))}
        />
      )}

      <CategoriesManager categories={categories} counts={counts} canEdit={canEdit} />

      {products.length === 0 ? (
        <EmptyState title="No products yet" hint="Add the first one above." />
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.key} className="grid" style={{ gap: 10 }}>
              <h2 style={{ margin: "8px 0 0" }}>
                {g.title}{" "}
                {g.hidden && <span className="badge warn">category hidden from the till</span>}
              </h2>
              {g.products.map(card)}
            </section>
          ))}
          {hidden.length > 0 && (
            <section className="grid" style={{ gap: 10 }}>
              <h2 style={{ margin: "8px 0 0" }}>Hidden from the till</h2>
              <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                Not offered on the till. Their recipes, prices and sales history are kept; tick “On
                the till” to sell one again.
              </p>
              {hidden.map(card)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
