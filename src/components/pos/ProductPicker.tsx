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
  sectionName,
  productName,
  searchedTimes,
  type AddonChoice,
  type AddonMenu,
} from "./model";
import { OptionsSheet } from "./OptionsSheet";
import { WeightSheet } from "./WeightSheet";

const ALL = "all";
const FAVOURITES = "fav";
const NONE = "none";
/** The section this till shows (0074), kept on the device: "all", or a section's id. */
const SECTION_KEY = "sixties.pos.section";

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
  decimals = 0,
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
  /** The currency's decimals: a weighing's amount is rounded as the database rounds it. */
  decimals?: number;
}) {
  const { t, locale, dir } = useT();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  // The café's and the bakery's products on one till (0074): every section, or
  // one, as this device was left. A product of no section shows in each.
  const [section, setSection] = useState<string>(ALL);
  useEffect(() => {
    try {
      setSection(localStorage.getItem(SECTION_KEY) ?? ALL);
    } catch {
      /* no storage: every section */
    }
  }, []);
  function chooseSection(id: string) {
    setSection(id);
    setCategory(ALL);
    try {
      localStorage.setItem(SECTION_KEY, id);
    } catch {
      /* kept for this visit only */
    }
  }
  const [choosing, setChoosing] = useState<{ product: Product; qty: number } | null>(null);
  // A size sold by weight (0075): how much it weighs is asked before it is added.
  const [weighing, setWeighing] = useState<{ item: PosItem; addons: AddonChoice[] } | null>(null);
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

  const everything = useMemo(() => {
    const byProduct = new Map<string, Product>();
    for (const i of sellable) {
      const p = byProduct.get(i.productId);
      if (p) p.variants.push(i);
      else byProduct.set(i.productId, { productId: i.productId, item: i, variants: [i] });
    }
    return [...byProduct.values()];
  }, [sellable]);

  const sections = useMemo(() => {
    const seen = new Map<string, { name: string; position: number; count: number }>();
    for (const p of everything) {
      const id = p.item.sectionId;
      if (!id) continue;
      const s = seen.get(id);
      if (s) s.count++;
      else
        seen.set(id, {
          name: sectionName(p.item, locale) ?? "",
          position: p.item.sectionPosition ?? 0,
          count: 1,
        });
    }
    return [...seen.entries()].sort((a, b) => a[1].position - b[1].position);
  }, [everything, locale]);
  const activeSection = section !== ALL && sections.some(([id]) => id === section) ? section : ALL;
  const products = useMemo(
    () =>
      activeSection === ALL
        ? everything
        : everything.filter((p) => !p.item.sectionId || p.item.sectionId === activeSection),
    [everything, activeSection],
  );

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
    // A search finds in every section; the chips show the one chosen.
    return (q ? everything : products).filter((p) => {
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
  }, [everything, products, query, activeCategory]);

  // The till's keys, from anywhere on it but a box being typed in or a dialog:
  // "/" goes to the search, a letter starts one, a number is how many of the
  // next product, Escape clears, "?" lists them.
  const free = !quiet && !choosing && !weighing;
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
    // One size and nothing to add to it: added as it is tapped; weighed first
    // when it is sold by weight.
    if (only && addons.groupsFor(only.productId, only.variantId).length === 0) {
      if (only.soldByWeight) setWeighing({ item: only, addons: [] });
      else onAdd(only.variantId, [], qty);
    } else setChoosing({ product: p, qty });
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
        {!query && sections.length > 1 && (
          <div
            className="seg section-seg"
            role="tablist"
            aria-label={t("Sections of the menu")}
            data-testid="till-sections"
          >
            <button
              role="tab"
              aria-selected={activeSection === ALL}
              className={activeSection === ALL ? "active" : ""}
              onClick={() => chooseSection(ALL)}
            >
              {t("pos.all")}
            </button>
            {sections.map(([id, s]) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeSection === id}
                className={activeSection === id ? "active" : ""}
                onClick={() => chooseSection(id)}
                data-testid="till-section"
              >
                <span dir="auto">{s.name}</span> <span className="chip-n">{s.count}</span>
              </button>
            ))}
          </div>
        )}
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
                      <span className="price mono">
                        {priceOf(p)}
                        {p.variants.length === 1 && p.item.soldByWeight ? ` / ${t("kg")}` : ""}
                      </span>
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
            const v = choosing.product.variants.find((x) => x.variantId === variantId);
            if (v?.soldByWeight) setWeighing({ item: v, addons: chosen });
            else onAdd(variantId, chosen, choosing.qty);
            setChoosing(null);
          }}
          onClose={() => setChoosing(null)}
        />
      )}
      {weighing && (
        <WeightSheet
          name={productName(weighing.item, locale)}
          perKg={weighing.item.prices[channel] ?? null}
          decimals={decimals}
          onAdd={(kg) => {
            onAdd(weighing.item.variantId, weighing.addons, kg);
            setWeighing(null);
          }}
          onClose={() => setWeighing(null)}
        />
      )}
    </div>
  );
}
