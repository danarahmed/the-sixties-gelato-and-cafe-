"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { fmtIQD } from "@/lib/format";
import { ProductThumb } from "@/components/pos/ProductPicker";
import { PanelTabs, SidePanel, type PanelTab } from "@/components/SidePanel";
import { Icon } from "@/components/Icon";

/** A cost above this share of the price is worth a look; at the price or above, it sells at a loss. */
export const COST_WARN = 35;

export interface ProductTile {
  id: string;
  name: string;
  category: string | null;
  categoryId: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isFavourite: boolean;
  /** The first size's price on the first channel that sells it; null with none. */
  price: number | null;
  /** What one serving costs, as a share of that price; null when it cannot be costed. */
  costPct: number | null;
  /** Sold as bought: no recipe to cost. */
  soldAsBought: boolean;
  sizes: number;
  addons: number;
  /** Each part of its panel, drawn on the server. */
  tabs: PanelTab[];
}

export interface TileSection {
  key: string;
  title: string;
  note?: string;
  hidden: boolean;
  tiles: ProductTile[];
}

/** The tone a cost share earns: fine, worth a look, or a loss. */
export function costTone(pct: number | null): "ok" | "warn" | "err" | null {
  if (pct === null) return null;
  return pct >= 100 ? "err" : pct > COST_WARN ? "warn" : "ok";
}

/**
 * Products & Recipes as the owner chose (round thirteen): the menu as tiles —
 * each with its photo, its price and what it costs as a share of it — by the
 * till's categories; a tap opens the product beside the list, a tab for its
 * basics, its recipe, its sizes and prices and its add-ons. A new product
 * opens in the same panel.
 */
export function ProductGrid({
  sections,
  categories,
  search,
  newProduct,
}: {
  sections: TileSection[];
  /** The till's categories with products in them, to narrow the tiles to one. */
  categories: { id: string; name: string }[];
  /** The search box, as the page draws it. */
  search: ReactNode;
  /** The new product's form; null for those who may not add one. */
  newProduct: ReactNode | null;
}) {
  const { t } = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [only, setOnly] = useState<string | null>(null);
  // A link to the form opens it: Getting set up's /products#add-product.
  useEffect(() => {
    if (newProduct && window.location.hash === "#add-product") setCreating(true);
  }, [newProduct]);
  const all = sections.flatMap((s) => s.tiles);
  const open = all.find((p) => p.id === openId) ?? null;
  const shown = sections
    .map((s) => ({
      ...s,
      tiles: only ? s.tiles.filter((p) => (p.categoryId ?? "none") === only) : s.tiles,
    }))
    .filter((s) => s.tiles.length > 0);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="menu-tools">
        <div className="menu-search">{search}</div>
        {newProduct && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setCreating(true)}
            data-testid="new-product"
          >
            <Icon name="plus" size={16} /> {t("Add menu product")}
          </button>
        )}
      </div>
      {categories.length > 1 && (
        <div className="chips menu-chips" role="group" aria-label={t("Category")}>
          <button
            type="button"
            className={only === null ? "chip active" : "chip"}
            aria-pressed={only === null}
            onClick={() => setOnly(null)}
          >
            {t("All")}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={only === c.id ? "chip active" : "chip"}
              aria-pressed={only === c.id}
              onClick={() => setOnly(only === c.id ? null : c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      {shown.map((s) => (
        <section key={s.key} className="grid" style={{ gap: 10 }}>
          <h2 style={{ margin: "6px 0 0" }}>
            {s.title}{" "}
            {s.hidden && <span className="badge warn">{t("category hidden from the till")}</span>}
          </h2>
          {s.note && (
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {s.note}
            </p>
          )}
          <ul className="menu-grid">
            {s.tiles.map((p) => (
              <Tile key={p.id} p={p} onOpen={() => setOpenId(p.id)} />
            ))}
          </ul>
        </section>
      ))}
      {open && (
        <SidePanel
          key={open.id}
          label={open.name}
          testId="product-panel"
          wide
          onClose={() => {
            setOpenId(null);
            document
              .querySelector<HTMLButtonElement>(
                `[data-testid="product-card"][data-id="${open.id}"] button`,
              )
              ?.focus();
          }}
          head={
            <div className="side-panel-who">
              <ProductThumb
                name={open.name}
                imageUrl={open.imageUrl}
                seed={open.categoryId ?? open.id}
              />
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0 }}>
                  {open.isFavourite && <span aria-label={t("★ Favourite (shown first)")}>★ </span>}
                  {open.name}
                </h3>
                <span className="muted" style={{ fontSize: ".85rem" }}>
                  {[open.category ?? t("No category"), !open.isActive && t("Hidden from the till")]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            </div>
          }
        >
          <TileFacts p={open} />
          <PanelTabs tabs={open.tabs} label={open.name} />
        </SidePanel>
      )}
      {creating && newProduct && (
        <SidePanel
          label={t("Add a menu product")}
          testId="new-product-panel"
          wide
          onClose={() => {
            setCreating(false);
            if (window.location.hash === "#add-product")
              window.history.replaceState(
                window.history.state,
                "",
                window.location.pathname + window.location.search,
              );
          }}
          head={<h3 style={{ margin: 0 }}>{t("Add a menu product")}</h3>}
        >
          {newProduct}
        </SidePanel>
      )}
    </div>
  );
}

/** The price, the cost share and what the till asks for, as a product's panel opens. */
function TileFacts({ p }: { p: ProductTile }) {
  const { t } = useT();
  const tone = costTone(p.costPct);
  return (
    <dl className="panel-facts">
      <div>
        <dt>{t("Price")}</dt>
        <dd className="mono">{p.price === null ? t("No price yet") : fmtIQD(p.price)}</dd>
      </div>
      {!p.soldAsBought && (
        <div>
          <dt>{t("Cost of the price")}</dt>
          <dd className={tone ? `cost-${tone}` : undefined}>
            {p.costPct === null ? t("unknown") : `${Math.round(p.costPct)}%`}
          </dd>
        </div>
      )}
      <div>
        <dt>{t("Sizes")}</dt>
        <dd>{p.sizes}</dd>
      </div>
      <div>
        <dt>{t("Add-ons")}</dt>
        <dd>{p.addons === 0 ? "—" : t("{n} group(s)", { n: p.addons })}</dd>
      </div>
    </dl>
  );
}

/** One product, a tile: tapped, it opens the product's panel. */
function Tile({ p, onOpen }: { p: ProductTile; onOpen: () => void }) {
  const { t } = useT();
  const tone = costTone(p.costPct);
  return (
    <li
      className={p.isActive ? "menu-tile" : "menu-tile off"}
      data-testid="product-card"
      data-name={p.name}
      data-id={p.id}
    >
      <button type="button" onClick={onOpen} aria-label={t("{name}: open", { name: p.name })}>
        <span className="menu-tile-photo">
          <ProductThumb name={p.name} imageUrl={p.imageUrl} seed={p.categoryId ?? p.id} />
          {p.isFavourite && (
            <span className="menu-tile-star" aria-hidden="true">
              ★
            </span>
          )}
        </span>
        <span className="menu-tile-name">{p.name}</span>
        <span className="menu-tile-price mono">
          {p.price === null ? (
            <span className="badge warn">{t("No price yet")}</span>
          ) : (
            fmtIQD(p.price)
          )}
        </span>
        <span className="menu-tile-marks">
          {!p.soldAsBought &&
            (p.costPct === null ? (
              p.price !== null && <span className="badge warn">{t("Cost unknown")}</span>
            ) : (
              <span
                className={`badge ${tone}`}
                data-testid="tile-cost"
                title={t("What one serving costs, as a share of its price")}
              >
                {t("cost {pct}%", { pct: Math.round(p.costPct) })}
              </span>
            ))}
          {p.sizes > 1 && <span className="badge">{t("{n} size(s)", { n: p.sizes })}</span>}
          {p.addons > 0 && <span className="badge">{t("+ add-ons")}</span>}
        </span>
      </button>
    </li>
  );
}
