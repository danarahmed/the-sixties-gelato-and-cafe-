"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { PosItem } from "@/lib/db/pos";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import {
  categoryName,
  fold,
  productName,
  searchedTimes,
  type AddonChoice,
  type AddonMenu,
} from "./model";
import { OptionsSheet } from "./OptionsSheet";

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
  // One of the café's eight flavours, the same for every product of a
  // category (FNV-1a: categories spread over the eight, not bunched).
  let hash = 2166136261;
  for (const c of seed) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const h = (hash >>> 0) % 8;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return <span className={`tile-img tile-initials flavour-${h}`}>{initials}</span>;
}

/** The till's keys, as the "?" lists them: the key, and what it does. */
const KEYS: [string, string][] = [
  ["A–Z", "Find a product by its name"],
  ["↑ ↓", "Choose among what is found"],
  ["Enter", "Add it to the order"],
  ["1–9", "How many of the next one: 3, then a product, adds three"],
  ["F2", "Take cash: Enter then takes the exact amount"],
  ["F4", "Take a card"],
  ["Esc", "Clear what was typed"],
  ["/", "Go to the search"],
  ["?", "Show or hide these keys"],
];

/** Whether a key press is someone typing into a box, or a dialog's, not the till's. */
function typingElsewhere(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  const tag = el?.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(el?.isContentEditable) ||
    // Any dialog open over the till: the keys are its.
    document.querySelector('[aria-modal="true"]') !== null
  );
}

/**
 * The menu, built for a hundred products and more: favourites and categories
 * one tap away, a search that takes Arabic and Kurdish spellings, and a
 * picture on every tile. Only what can be sold on the channel is shown.
 *
 * With a keyboard (round five): a name typed anywhere on the till finds it,
 * the arrows choose among what is found and Enter adds it; a number typed
 * first adds that many of the next one; Escape clears; "?" lists the keys.
 */
export function ProductPicker({
  items,
  addons,
  channel,
  counts,
  disabled,
  quiet = false,
  onAdd,
}: {
  items: PosItem[];
  /** The add-ons, and which sizes offer them (0041). */
  addons: AddonMenu;
  channel: SalesChannel;
  /** How many of each product the order already holds, shown on its tile. */
  counts: Map<string, number>;
  disabled: boolean;
  /** One of the till's own dialogs is open: the keys are its. */
  quiet?: boolean;
  onAdd: (variantId: string, addons: AddonChoice[], qty: number) => void;
}) {
  const { t, locale, dir } = useT();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [choosing, setChoosing] = useState<{ product: Product; qty: number } | null>(null);
  // How many of the next product, typed as a number first.
  const [times, setTimes] = useState("");
  // Which of what is found Enter adds: the first, unless the arrows choose another.
  const [hl, setHl] = useState(0);
  const [help, setHelp] = useState(false);
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
    const count = new Map<string, number>();
    let uncategorised = 0;
    for (const p of products) {
      if (p.item.categoryId) {
        if (!seen.has(p.item.categoryId))
          seen.set(p.item.categoryId, categoryName(p.item, locale) ?? "");
        count.set(p.item.categoryId, (count.get(p.item.categoryId) ?? 0) + 1);
      } else uncategorised++;
    }
    return { list: [...seen.entries()], count, uncategorised };
  }, [products, locale]);
  const favourites = products.filter((p) => p.item.isFavourite).length;
  const hasFavourites = favourites > 0;

  // A category that has nothing on this channel falls back to everything.
  const activeCategory =
    category === ALL ||
    (category === FAVOURITES && hasFavourites) ||
    (category === NONE && categories.uncategorised > 0) ||
    categories.list.some(([id]) => id === category)
      ? category
      : ALL;

  // "3*latte": three of what is found for "latte".
  const asked = searchedTimes(query);
  const shown = useMemo(() => {
    const q = fold(searchedTimes(query).find);
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

  // The till's keys, from anywhere on it but a box being typed in or a dialog:
  // "/" goes to the search, a letter starts one, a number is how many of the
  // next product, Escape clears, "?" lists them.
  const free = !quiet && !choosing;
  useEffect(() => {
    if (!free) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typingElsewhere(e)) return;
      if (e.key === "/") {
        e.preventDefault();
        search.current?.focus();
      } else if (e.key === "?") {
        e.preventDefault();
        setHelp((h) => !h);
      } else if (e.key === "Escape") {
        setTimes("");
        setQuery("");
        setHelp(false);
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setTimes((n) => (n + e.key).replace(/^0+/, "").slice(0, 2));
      } else if (e.key === "Backspace" && times) {
        e.preventDefault();
        setTimes((n) => n.slice(0, -1));
      } else if (e.key.length === 1 && /\p{L}/u.test(e.key)) {
        e.preventDefault();
        setQuery(e.key);
        setHl(0);
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [free, times]);

  // A number typed first and left: gone after ten seconds, so a key pressed by
  // mistake never adds five of whatever is tapped next.
  useEffect(() => {
    if (!times) return;
    const gone = setTimeout(() => setTimes(""), 10_000);
    return () => clearTimeout(gone);
  }, [times]);

  /** Add a product: as many as typed first, or asked in the search; then the count is done with. */
  function pick(p: Product) {
    if (disabled) return;
    const qty = asked.times ?? (Number(times) || 1);
    setTimes("");
    const only = p.variants.length === 1 ? p.variants[0]! : null;
    // One size and nothing to add to it: added as it is tapped.
    if (only && addons.groupsFor(only.productId, only.variantId).length === 0)
      onAdd(only.variantId, [], qty);
    else setChoosing({ product: p, qty });
  }

  /** The arrows along what is found: the next one is to the right in English, to the left in Arabic and Kurdish. */
  function move(e: ReactKeyboardEvent<HTMLInputElement>) {
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    if (e.key === "ArrowDown" || e.key === forward)
      setHl((i) => Math.min(i + 1, Math.max(shown.length - 1, 0)));
    else if (e.key === "ArrowUp" || e.key === back) setHl((i) => Math.max(i - 1, 0));
    else return;
    e.preventDefault();
  }
  const lit = query.trim() !== "" ? Math.min(hl, Math.max(shown.length - 1, 0)) : -1;

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
        <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12.6 12.6l4.4 4.4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <input
          ref={search}
          type="search"
          value={query}
          placeholder={t("pos.search")}
          aria-label={t("pos.search")}
          onChange={(e) => {
            setQuery(e.target.value);
            setHl(0);
          }}
          onKeyDown={(e) => {
            const chosen = shown[lit];
            if (e.key === "Enter" && chosen) {
              e.preventDefault();
              pick(chosen);
              setQuery("");
              setHl(0);
            } else if (e.key === "Escape") {
              setQuery("");
              setTimes("");
            } else if (query.trim() !== "") move(e);
          }}
        />
        {(asked.times ?? Number(times)) > 0 && (
          <span className="kb-times" data-testid="kb-times" aria-live="polite">
            × {asked.times ?? Number(times)}
          </span>
        )}
        {query && (
          <button className="linklike" onClick={() => setQuery("")}>
            {t("pos.clearSearch")}
          </button>
        )}
        <button
          type="button"
          className="kb-help-button"
          aria-expanded={help}
          aria-controls="kb-help"
          aria-label={t("Keys on the till")}
          title={t("Keys on the till")}
          onClick={() => setHelp((h) => !h)}
        >
          ?
        </button>
      </div>
      {help && (
        <div id="kb-help" className="kb-help" role="note" data-testid="kb-help">
          <strong>{t("Keys on the till")}</strong>
          <dl>
            {KEYS.map(([k, what]) => (
              <div key={k}>
                <dt>
                  <kbd>{k}</kbd>
                </dt>
                <dd>{t(what)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="picker-body">
        {!query && (
          <div className="chips cat-rail" role="tablist" aria-label={t("pos.categories")}>
            <button
              role="tab"
              aria-selected={activeCategory === ALL}
              className={activeCategory === ALL ? "chip active" : "chip"}
              onClick={() => setCategory(ALL)}
            >
              <span className="chip-label">{t("pos.all")}</span>
              <span className="chip-n">{products.length}</span>
            </button>
            {hasFavourites && (
              <button
                role="tab"
                aria-selected={activeCategory === FAVOURITES}
                className={activeCategory === FAVOURITES ? "chip active" : "chip"}
                onClick={() => setCategory(FAVOURITES)}
              >
                <span className="chip-label">★ {t("pos.favourites")}</span>
                <span className="chip-n">{favourites}</span>
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
                <span className="chip-label">{name}</span>
                <span className="chip-n">{categories.count.get(id) ?? 0}</span>
              </button>
            ))}
            {categories.uncategorised > 0 && categories.list.length > 0 && (
              <button
                role="tab"
                aria-selected={activeCategory === NONE}
                className={activeCategory === NONE ? "chip active" : "chip"}
                onClick={() => setCategory(NONE)}
              >
                <span className="chip-label">{t("pos.otherCategory")}</span>
                <span className="chip-n">{categories.uncategorised}</span>
              </button>
            )}
          </div>
        )}

        <div className="picker-grid">
          {shown.length === 0 ? (
            <p className="muted" style={{ padding: "18px 4px" }}>
              {query ? t("pos.noMatch") : t("pos.noneOnChannel")}
            </p>
          ) : (
            <div className="product-grid">
              {shown.map((p, i) => {
                const name = productName(p.item, locale);
                const n = qtyOf(p);
                return (
                  <button
                    key={p.productId}
                    className={`product-tile${n > 0 ? " in-order" : ""}${i === lit ? " kb-on" : ""}`}
                    aria-current={i === lit ? "true" : undefined}
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
        </div>
      </div>

      {choosing && (
        <OptionsSheet
          variants={choosing.product.variants}
          channel={channel}
          addons={addons}
          onAdd={(variantId, chosen) => {
            onAdd(variantId, chosen, choosing.qty);
            setChoosing(null);
          }}
          onClose={() => setChoosing(null)}
        />
      )}
    </div>
  );
}
