import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/core";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems } from "@/lib/db/read";
import { getMenuSetup, type MenuProduct } from "@/lib/db/menu";
import {
  getItemCosts,
  getMenuCosting,
  getMenuRecipeLines,
  getMenuScheduled,
  type MenuCostRow,
  type RecipeLineRow,
  type ScheduledChange,
} from "@/lib/db/reports";
import { fmtIQD, fmtQty } from "@/lib/format";
import { getChannelNames } from "@/lib/db/channels";
import { ChannelsProvider } from "@/components/ChannelsProvider";
import { businessToday } from "@/lib/dates";
import { AddProductForm, PriceChange } from "@/components/AddProductForm";
import { ChangeRecipe } from "@/components/menu/ChangeRecipe";
import type { ItemOpt } from "@/components/menu/RecipeLines";
import { CategoriesManager } from "@/components/menu/CategoriesManager";
import { CostWarning, ScheduledChanges } from "@/components/menu/MenuChanges";
import { ProductSetup } from "@/components/menu/ProductSetup";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

interface Costing {
  rows: MenuCostRow[];
  recipe: RecipeLineRow[];
}

function RecipeAndPrices({
  t,
  name,
  costing,
  variantId,
  canEdit,
  today,
  editor,
  soldAsBought,
  noStockReason,
  itemCosts,
  scheduled,
  channelName,
  inUse,
}: {
  /** The reader's words, from the page. */
  t: T;
  name: string | null;
  costing: Costing | undefined;
  variantId: string;
  canEdit: boolean;
  today: string;
  /** For those who edit recipes: the items a recipe may use, costed. Null when sold as bought. */
  editor: { items: ItemOpt[]; decimals: number } | null;
  soldAsBought: boolean;
  noStockReason: string | null;
  /** Each item's cost per base unit today, by id ("0" when it has none). */
  itemCosts: Map<string, string>;
  scheduled: ScheduledChange[];
  /** A channel's name in the reader's language. */
  channelName: (code: string) => string;
  /** The channels in use. */
  inUse: ReadonlySet<string>;
}) {
  const recipe = costing?.recipe ?? [];
  // Priced where it sells today: a platform out of use sells nothing.
  const rows = (costing?.rows ?? []).filter((m) => inUse.has(m.channel));
  const zeroCostItems = recipe
    .filter((l) => l.itemId !== null && Number(itemCosts.get(l.itemId) ?? "0") === 0)
    .map((l) => l.component);
  return (
    <div>
      {name && <h4 style={{ margin: "10px 0 4px" }}>{name}</h4>}
      {!soldAsBought && (
        <CostWarning
          variantId={variantId}
          noRecipe={recipe.length === 0}
          noStockReason={noStockReason}
          zeroCostItems={zeroCostItems}
          canEdit={canEdit}
        />
      )}
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}
      >
        <div className="tw">
          <h4 className="muted" style={{ margin: "0 0 6px" }}>
            {recipe[0]
              ? t("Recipe in force (version {version}, from {from})", {
                  version: recipe[0].versionNo,
                  from: recipe[0].effectiveFrom,
                })
              : t("Recipe in force")}
          </h4>
          {recipe.length === 0 ? (
            <p className="muted" style={{ fontSize: ".85rem" }}>
              {t("No recipe — sold as bought, or not yet set up.")}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("Component")}</th>
                  <th className="right">{t("Qty")}</th>
                  <th>{t("Applies to")}</th>
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
                      {l.channels ? l.channels.map(channelName).join(", ") : t("all channels")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="tw">
          <h4 className="muted" style={{ margin: "0 0 6px" }}>
            {t("Price & margin by channel")}
          </h4>
          {rows.length === 0 ? (
            <p className="muted" style={{ fontSize: ".85rem" }}>
              {t("No price yet: the till cannot sell it until it has one.")}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("Channel")}</th>
                  <th className="right">{t("Price")}</th>
                  <th className="right">{t("Cost")}</th>
                  <th className="right">{t("Margin")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const margin = m.unitCost === null ? null : m.price - m.unitCost;
                  return (
                    <tr key={m.channel}>
                      <td>{channelName(m.channel)}</td>
                      <td className="right mono">{fmtIQD(m.price)}</td>
                      <td className="right mono">
                        {m.unitCost === null ? t("unknown") : fmtIQD(m.unitCost)}
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
      <ScheduledChanges changes={scheduled} canEdit={canEdit} />
      {editor && (
        <ChangeRecipe
          variantId={variantId}
          current={recipe.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            unitCode: l.unitCode,
            channels: l.channels,
          }))}
          items={editor.items}
          decimals={editor.decimals}
          today={today}
        />
      )}
    </div>
  );
}

export default async function ProductsPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const canEdit = has(profile, "recipe.edit");
  const [menu, lines, items, itemCosts, setup, scheduled, channels] = await Promise.all([
    getMenuCosting(),
    getMenuRecipeLines(),
    canEdit ? getItems() : Promise.resolve([]),
    getItemCosts(),
    getMenuSetup(),
    getMenuScheduled(),
    getChannelNames(),
  ]);

  const inUse = new Set(channels.channels.filter((c) => c.active).map((c) => c.code));
  const costing = new Map<string, Costing>();
  for (const m of menu) {
    const c = costing.get(m.variantId) ?? { rows: [], recipe: [] };
    c.rows.push(m);
    costing.set(m.variantId, c);
  }
  for (const l of lines) costing.get(l.variantId)?.recipe.push(l);

  const itemOpts: ItemOpt[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    baseUnit: i.baseUnit,
    units: i.units,
    unitCost: itemCosts.get(i.id) || "0",
  }));
  const decimals = profile.currencyDecimals;

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
      title: t("No category"),
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
            {p.variants.length > 1
              ? t("Recipe, prices and margin · {n} sizes or flavours", { n: p.variants.length })
              : t("Recipe, prices and margin")}
          </summary>
          {p.variants
            .filter((v) => v.isActive)
            .map((v) => (
              <RecipeAndPrices
                t={t}
                key={v.id}
                name={p.variants.length > 1 || v.name !== p.name ? v.name : null}
                costing={costing.get(v.id)}
                variantId={v.id}
                canEdit={canEdit}
                today={today}
                editor={canEdit && !v.soldAsBought ? { items: itemOpts, decimals } : null}
                soldAsBought={v.soldAsBought}
                noStockReason={v.noStockReason}
                itemCosts={itemCosts}
                scheduled={scheduled.filter((s) => s.variantId === v.id)}
                channelName={channels.name}
                inUse={inUse}
              />
            ))}
        </details>
      )}
    </div>
  );

  return (
    <ChannelsProvider channels={channels.channels}>
      <div className="grid" style={{ gap: 16 }}>
        <h1 style={{ margin: 0 }}>{t("nav.products")}</h1>
        <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
          {t(
            "One recipe serves every channel; lines tagged to a channel deduct only there — that is how the cup and lid are used for takeaway and delivery but not at a table. Prices and recipes change from a date, so every sale uses the price and recipe in force on its own day. Costs shown are today's, worked out exactly as a sale posts them. A photo, a category and a ★ make a product quick to find on the till.",
          )}
        </p>

        {canEdit && (
          <AddProductForm
            items={itemOpts}
            categories={categories
              .filter((c) => c.isActive)
              .map((c) => ({ id: c.id, name: c.name }))}
            money={{ decimals: profile.currencyDecimals, priceStep: profile.discountRoundTo }}
          />
        )}

        <CategoriesManager categories={categories} counts={counts} canEdit={canEdit} />

        {products.length === 0 ? (
          <EmptyState title={t("No products yet")} hint={t("Add the first one above.")} />
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.key} className="grid" style={{ gap: 10 }}>
                <h2 style={{ margin: "8px 0 0" }}>
                  {g.title}{" "}
                  {g.hidden && (
                    <span className="badge warn">{t("category hidden from the till")}</span>
                  )}
                </h2>
                {g.products.map(card)}
              </section>
            ))}
            {hidden.length > 0 && (
              <section className="grid" style={{ gap: 10 }}>
                <h2 style={{ margin: "8px 0 0" }}>{t("Hidden from the till")}</h2>
                <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                  {t(
                    "Not offered on the till. Their recipes, prices and sales history are kept; tick “On the till” to sell one again.",
                  )}
                </p>
                {hidden.map(card)}
              </section>
            )}
          </>
        )}
      </div>
    </ChannelsProvider>
  );
}
