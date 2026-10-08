import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/core";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems } from "@/lib/db/read";
import { getAddonSetup, getMenuSetup, type MenuProduct } from "@/lib/db/menu";
import {
  getItemCosts,
  getMenuBranchPrices,
  getMenuCosting,
  getMenuRecipeLines,
  getMenuScheduled,
  type BranchPrice,
  type MenuCostRow,
  type RecipeLineRow,
  type ScheduledChange,
} from "@/lib/db/reports";
import { getCafePlaces } from "@/lib/place";
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
import { SizesPanel } from "@/components/menu/SizesPanel";
import { ProductAddonGroups } from "@/components/menu/ProductAddons";
import { ProductGrid, type ProductTile, type TileSection } from "@/components/menu/ProductGrid";
import type { PanelTab } from "@/components/SidePanel";
import { EmptyState } from "@/components/ui";
import { namesMatch, SEARCH_MAX, searchText } from "@/lib/find";
import { MenuPhotos } from "@/components/menu/MenuPhotos";

export const dynamic = "force-dynamic";

interface Costing {
  rows: MenuCostRow[];
  recipe: RecipeLineRow[];
}

interface PartProps {
  /** The reader's words, from the page. */
  t: T;
  name: string | null;
  costing: Costing | undefined;
  variantId: string;
  canEdit: boolean;
  today: string;
  /** A channel's name in the reader's language. */
  channelName: (code: string) => string;
  /** The channels in use. */
  inUse: ReadonlySet<string>;
}

/** A size's recipe in force, what it warns of, and the way to change it. */
function RecipePart({
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
  channelName,
}: PartProps & {
  /** For those who edit recipes: the items a recipe may use, costed. Null when sold as bought. */
  editor: { items: ItemOpt[]; decimals: number } | null;
  soldAsBought: boolean;
  noStockReason: string | null;
  /** Each item's cost per base unit today, by id ("0" when it has none). */
  itemCosts: Map<string, string>;
}) {
  const recipe = costing?.recipe ?? [];
  const zeroCostItems = recipe
    .filter((l) => l.itemId !== null && Number(itemCosts.get(l.itemId) ?? "0") === 0)
    .map((l) => l.component);
  return (
    <div className="grid" style={{ gap: 8 }} data-testid="recipe-part">
      {name && <h4 style={{ margin: "6px 0 0" }}>{name}</h4>}
      {!soldAsBought && (
        <CostWarning
          variantId={variantId}
          noRecipe={recipe.length === 0}
          noStockReason={noStockReason}
          zeroCostItems={zeroCostItems}
          canEdit={canEdit}
        />
      )}
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

/** A size's price and margin on each channel, the way to change a price, and what waits. */
function PricesPart({
  t,
  name,
  costing,
  variantId,
  canEdit,
  today,
  scheduled,
  channelName,
  inUse,
  branchPrices,
  branches,
  priceStep,
}: PartProps & {
  scheduled: ScheduledChange[];
  /** Each branch's own price in force today (0055). */
  branchPrices: BranchPrice[];
  /** The café's branches, when it has more than one (0055). */
  branches: { id: string; name: string }[];
  /** The step a suggested price is rounded up to. */
  priceStep: number;
}) {
  // Priced where it sells today: a platform out of use sells nothing.
  const rows = (costing?.rows ?? []).filter((m) => inUse.has(m.channel));
  return (
    <div className="grid" style={{ gap: 8 }} data-testid="prices-part">
      {name && <h4 style={{ margin: "6px 0 0" }}>{name}</h4>}
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
        {branchPrices.length > 0 && (
          <ul
            className="muted"
            style={{ margin: "6px 0 0", paddingInlineStart: 18, fontSize: ".85rem" }}
            data-testid="branch-prices"
          >
            {branchPrices.map((b) => (
              <li key={`${b.channel}-${b.locationId}`}>
                {t("At {place}: {channel} {price}", {
                  place: b.location,
                  channel: channelName(b.channel),
                  price: fmtIQD(b.price),
                })}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <PriceChange
            variantId={variantId}
            today={today}
            branches={branches}
            costs={Object.fromEntries((costing?.rows ?? []).map((m) => [m.channel, m.unitCost]))}
            priceStep={priceStep}
          />
        )}
      </div>
      <ScheduledChanges changes={scheduled} canEdit={canEdit} />
    </div>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  // Find a product (the September audit's P2-20): by its name or a size's, in any language.
  const sp = await searchParams;
  const find = typeof sp.q === "string" ? (searchText(sp.q) ?? "") : "";
  const today = businessToday(profile.timezone);
  const canEdit = has(profile, "recipe.edit");
  const [menu, lines, items, itemCosts, setup, scheduled, channels, addons, branchPrices, places] =
    await Promise.all([
      getMenuCosting(),
      getMenuRecipeLines(),
      canEdit ? getItems() : Promise.resolve([]),
      getItemCosts(),
      getMenuSetup(),
      getMenuScheduled(),
      getChannelNames(),
      getAddonSetup(today),
      getMenuBranchPrices(),
      getCafePlaces(),
    ]);
  // A price can be one branch's own once the café has more than one (0055).
  const branches = places.filter((p) => p.kind === "branch");
  const branchChoice = branches.length > 1 ? branches.map((b) => ({ id: b.id, name: b.name })) : [];

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

  // Those a search names, or all of them.
  const listed = find
    ? products.filter((p) =>
        namesMatch(
          [
            p.name,
            p.nameAr,
            p.nameCkb,
            ...p.variants.flatMap((v) => [v.name, v.nameAr, v.nameCkb]),
          ],
          find,
        ),
      )
    : products;

  // The groups of add-ons each product offers.
  const offeredGroups = (p: MenuProduct) =>
    new Set(addons.offers.filter((o) => o.productId === p.id).map((o) => o.groupId)).size;
  const editor = canEdit ? { items: itemOpts, decimals } : null;
  const priceStep = profile.discountRoundTo;

  /** A product as a tile, and each part of its panel. */
  const tileOf = (p: MenuProduct): ProductTile => {
    const sizes = p.variants.filter((v) => v.isActive);
    const first = sizes[0] ?? null;
    // Its first size's price on the first channel in use that sells it.
    const row = first
      ? (costing.get(first.id)?.rows ?? []).find((m) => inUse.has(m.channel))
      : undefined;
    const costPct =
      row && row.unitCost !== null && row.price > 0 ? (row.unitCost / row.price) * 100 : null;
    const many = sizes.length > 1;
    const sizeName = (v: (typeof sizes)[number]) => (many || v.name !== p.name ? v.name : null);
    const tabs: PanelTab[] = [
      {
        id: "basics",
        label: t("Basics"),
        content: <ProductSetup product={p} categories={categories} canEdit={canEdit} />,
      },
      ...(p.isActive
        ? [
            {
              id: "recipe",
              label: t("Recipe"),
              content: (
                <div className="grid" style={{ gap: 16 }}>
                  {sizes.map((v) => (
                    <RecipePart
                      key={v.id}
                      t={t}
                      name={sizeName(v)}
                      costing={costing.get(v.id)}
                      variantId={v.id}
                      canEdit={canEdit}
                      today={today}
                      channelName={channels.name}
                      inUse={inUse}
                      editor={v.soldAsBought ? null : editor}
                      soldAsBought={v.soldAsBought}
                      noStockReason={v.noStockReason}
                      itemCosts={itemCosts}
                    />
                  ))}
                </div>
              ),
            },
            {
              id: "prices",
              label: t("Sizes & prices"),
              content: (
                <div className="grid" style={{ gap: 16 }}>
                  <SizesPanel product={p} items={itemOpts} decimals={decimals} canEdit={canEdit} />
                  {sizes.map((v) => (
                    <PricesPart
                      key={v.id}
                      t={t}
                      name={sizeName(v)}
                      costing={costing.get(v.id)}
                      variantId={v.id}
                      canEdit={canEdit}
                      today={today}
                      channelName={channels.name}
                      inUse={inUse}
                      scheduled={scheduled.filter((x) => x.variantId === v.id)}
                      branchPrices={branchPrices.filter(
                        (b) => b.variantId === v.id && inUse.has(b.channel),
                      )}
                      branches={branchChoice}
                      priceStep={priceStep}
                    />
                  ))}
                </div>
              ),
            },
            {
              id: "addons",
              label: t("Add-ons"),
              content: (
                <ProductAddonGroups
                  product={p}
                  groups={addons.groups}
                  offers={addons.offers}
                  products={products}
                  editor={canEdit ? { items: itemOpts, decimals, today } : null}
                />
              ),
            },
          ]
        : []),
    ];
    return {
      id: p.id,
      name: p.name,
      category: categories.find((c) => c.id === p.categoryId)?.name ?? null,
      categoryId: p.categoryId,
      imageUrl: p.imageUrl,
      isActive: p.isActive,
      isFavourite: p.isFavourite,
      price: row?.price ?? null,
      costPct,
      soldAsBought: first?.soldAsBought ?? false,
      sizes: Math.max(sizes.length, 1),
      addons: offeredGroups(p),
      tabs,
    };
  };

  // On the till, by category in the till's order; then everything hidden from it.
  const onTill = listed.filter((p) => p.isActive);
  const hidden = listed.filter((p) => !p.isActive);
  const sections: TileSection[] = [
    ...categories.map((c) => ({
      key: c.id,
      title: c.name,
      hidden: !c.isActive,
      tiles: onTill.filter((p) => p.categoryId === c.id).map(tileOf),
    })),
    {
      key: "none",
      title: t("No category"),
      hidden: false,
      tiles: onTill.filter((p) => !p.categoryId).map(tileOf),
    },
    {
      key: "hidden",
      title: t("Hidden from the till"),
      note: t(
        "Not offered on the till. Their recipes, prices and sales history are kept; tick “On the till” to sell one again.",
      ),
      hidden: false,
      tiles: hidden.map(tileOf),
    },
  ].filter((g) => g.tiles.length > 0);
  const chips = [...categories.filter((c) => onTill.some((p) => p.categoryId === c.id))].map(
    (c) => ({ id: c.id, name: c.name }),
  );
  if (onTill.some((p) => !p.categoryId)) chips.push({ id: "none", name: t("No category") });

  const search =
    products.length > 0 ? (
      <form role="search" className="menu-find">
        <input
          type="search"
          name="q"
          defaultValue={find}
          maxLength={SEARCH_MAX}
          dir="auto"
          aria-label={t("Find a product")}
          data-testid="find-product"
          placeholder={t("Part of its name, or a size's, in any language")}
        />
        <button type="submit">{t("Find")}</button>
        {find && (
          <Link className="badge" href="/products">
            {t("Every product")}
          </Link>
        )}
      </form>
    ) : null;

  return (
    <ChannelsProvider channels={channels.channels}>
      <div className="grid" style={{ gap: 16 }}>
        <h1 style={{ margin: 0 }}>{t("nav.products")}</h1>
        <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
          {t(
            "Tap a product to see and change its recipe, prices, sizes and add-ons. Costs are today's, worked out exactly as a sale posts them; a price or recipe changed from a date leaves the sales before it as they were.",
          )}
        </p>

        <ProductGrid
          sections={sections}
          categories={chips}
          search={search}
          newProduct={
            canEdit ? (
              <AddProductForm
                inPanel
                items={itemOpts}
                categories={categories
                  .filter((c) => c.isActive)
                  .map((c) => ({ id: c.id, name: c.name }))}
                money={{ decimals: profile.currencyDecimals, priceStep }}
              />
            ) : null
          }
        />

        {products.length === 0 ? (
          <EmptyState
            title={t("No products yet")}
            hint={canEdit ? t("Add the first one with Add menu product.") : undefined}
          />
        ) : (
          listed.length === 0 && (
            <EmptyState
              title={t("No product matches “{q}”", { q: find })}
              hint={t("Type part of its name, or of a size's, in English, Arabic or Kurdish.")}
            />
          )
        )}

        {canEdit && <MenuPhotos products={products} />}

        <CategoriesManager categories={categories} counts={counts} canEdit={canEdit} />
      </div>
    </ChannelsProvider>
  );
}
