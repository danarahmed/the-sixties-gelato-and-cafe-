"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { PosItem } from "@/lib/db/pos";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { categoryName, fold, productName, variantLabel } from "./model";

const ALL = "all";
const FAVOURITES = "fav";
const NONE = "none";

interface Product {
  productId: string;
  item: PosItem;
  variants: PosItem[];
}

/** A picture, or the product's initials on a colour of its own when there is none. */
export function ProductThumb({
  name,
  imageUrl,
  seed,
}: {
  name: string;
  imageUrl: string | null;
  seed: string;
}) {
  const [broken, setBroken] = useState(false);
  if (imageUrl && !broken) {
    return (
      <img
        className="tile-img"
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    );
  }
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="tile-img tile-initials"
      style={{ background: `hsl(${h} 45% 88%)`, color: `hsl(${h} 45% 28%)` }}
    >
      {initials}
    </span>
  );
}

/**
 * The menu, built for a hundred products and more: favourites and categories
 * one tap away, a search that takes Arabic and Kurdish spellings, and a
 * picture on every tile. Only what can be sold on the channel is shown.
 */
export function ProductPicker({
  items,
  channel,
  counts,
  disabled,
  onAdd,
}: {
  items: PosItem[];
  channel: SalesChannel;
  /** How many of each product the order already holds, shown on its tile. */
  counts: Map<string, number>;
  disabled: boolean;
  onAdd: (variantId: string) => void;
}) {
  const { t, locale } = useT();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [choosing, setChoosing] = useState<Product | null>(null);
  const search = useRef<HTMLInputElement>(null);

  const sellable = useMemo(
    () => items.filter((i) => i.prices[channel] !== undefined),
    [items, channel],
  );

  const products = useMemo(() => {
    const byProduct = new Map<string, Product>();
    for (const i of sellable) {
      const p = byProduct.get(i.productId);
      if (p) p.variants.push(i);
      else byProduct.set(i.productId, { productId: i.productId, item: i, variants: [i] });
    }
    return [...byProduct.values()];
  }, [sellable]);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    let uncategorised = false;
    for (const p of products) {
      if (p.item.categoryId) {
        if (!seen.has(p.item.categoryId))
          seen.set(p.item.categoryId, categoryName(p.item, locale) ?? "");
      } else uncategorised = true;
    }
    return { list: [...seen.entries()], uncategorised };
  }, [products, locale]);
  const hasFavourites = products.some((p) => p.item.isFavourite);

  // A category that has nothing on this channel falls back to everything.
  const activeCategory =
    category === ALL ||
    (category === FAVOURITES && hasFavourites) ||
    (category === NONE && categories.uncategorised) ||
    categories.list.some(([id]) => id === category)
      ? category
      : ALL;

  const shown = useMemo(() => {
    const q = fold(query);
    return products.filter((p) => {
      if (q) {
        const names = p.variants.flatMap((v) => [
          v.productName,
          v.variantName,
          v.nameAr ?? "",
          v.nameCkb ?? "",
        ]);
        return names.some((n) => fold(n).includes(q));
      }
      if (activeCategory === FAVOURITES) return p.item.isFavourite;
      if (activeCategory === NONE) return !p.item.categoryId;
      if (activeCategory !== ALL) return p.item.categoryId === activeCategory;
      return true;
    });
  }, [products, query, activeCategory]);

  // "/" jumps to the search from anywhere on the till, as on most tills with a keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pick(p: Product) {
    if (disabled) return;
    if (p.variants.length === 1) onAdd(p.variants[0]!.variantId);
    else setChoosing(p);
  }

  const qtyOf = (p: Product) => p.variants.reduce((n, v) => n + (counts.get(v.variantId) ?? 0), 0);
  const priceOf = (p: Product) => {
    const prices = p.variants.map((v) => v.prices[channel]!).sort((a, b) => a - b);
    return prices.length > 1 && prices[0] !== prices[prices.length - 1]
      ? `${t("pos.from")} ${fmtIQD(prices[0]!)}`
      : fmtIQD(prices[0]!);
  };

  return (
    <div className="picker">
      <div className="picker-search">
        <input
          ref={search}
          type="search"
          value={query}
          placeholder={t("pos.search")}
          aria-label={t("pos.search")}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && shown[0]) {
              e.preventDefault();
              pick(shown[0]);
              setQuery("");
            }
            if (e.key === "Escape") setQuery("");
          }}
        />
        {query && (
          <button className="linklike" onClick={() => setQuery("")}>
            {t("pos.clearSearch")}
          </button>
        )}
      </div>

      {!query && (
        <div className="chips" role="tablist" aria-label={t("pos.categories")}>
          <button
            role="tab"
            aria-selected={activeCategory === ALL}
            className={activeCategory === ALL ? "chip active" : "chip"}
            onClick={() => setCategory(ALL)}
          >
            {t("pos.all")} <span className="chip-n">{products.length}</span>
          </button>
          {hasFavourites && (
            <button
              role="tab"
              aria-selected={activeCategory === FAVOURITES}
              className={activeCategory === FAVOURITES ? "chip active" : "chip"}
              onClick={() => setCategory(FAVOURITES)}
            >
              ★ {t("pos.favourites")}
            </button>
          )}
          {categories.list.map(([id, name]) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeCategory === id}
              className={activeCategory === id ? "chip active" : "chip"}
              onClick={() => setCategory(id)}
            >
              {name}
            </button>
          ))}
          {categories.uncategorised && categories.list.length > 0 && (
            <button
              role="tab"
              aria-selected={activeCategory === NONE}
              className={activeCategory === NONE ? "chip active" : "chip"}
              onClick={() => setCategory(NONE)}
            >
              {t("pos.otherCategory")}
            </button>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="muted" style={{ padding: "18px 4px" }}>
          {query ? t("pos.noMatch") : t("pos.noneOnChannel")}
        </p>
      ) : (
        <div className="product-grid">
          {shown.map((p) => {
            const name = productName(p.item, locale);
            const n = qtyOf(p);
            return (
              <button
                key={p.productId}
                className="product-tile"
                onClick={() => pick(p)}
                disabled={disabled}
              >
                <ProductThumb
                  name={name}
                  imageUrl={p.item.imageUrl}
                  seed={p.item.categoryId ?? p.productId}
                />
                {n > 0 && <span className="tile-count">{n}</span>}
                {p.item.isFavourite && (
                  <span className="tile-fav" aria-hidden>
                    ★
                  </span>
                )}
                <span className="tile-name">{name}</span>
                <span className="tile-meta">
                  {p.variants.length > 1 && (
                    <span className="muted">
                      {p.variants.length} {t("pos.options")}
                    </span>
                  )}
                  <span className="price mono">{priceOf(p)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {choosing && (
        <div className="pos-modal-back" onClick={() => setChoosing(null)}>
          <div
            className="pos-modal"
            role="dialog"
            aria-modal="true"
            aria-label={productName(choosing.item, locale)}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>{productName(choosing.item, locale)}</h3>
            <div className="variant-list">
              {choosing.variants.map((v) => (
                <button
                  key={v.variantId}
                  className="variant-btn"
                  onClick={() => {
                    onAdd(v.variantId);
                    setChoosing(null);
                  }}
                >
                  <span>{variantLabel(v) ?? productName(v, locale)}</span>
                  <span className="price mono">{fmtIQD(v.prices[channel]!)}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setChoosing(null)}>{t("pos.close")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
