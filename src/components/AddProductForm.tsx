"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Decimal from "decimal.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { createProductAction, setPriceAction } from "@/lib/actions/menu";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Rich } from "@/lib/i18n/Rich";
import { Field, Notice, inputStyle } from "@/components/ui";
import { useChannels } from "@/components/ChannelsProvider";
import { parseNumber } from "@/components/pos/model";
import { margin, servingCost, suggestedPrice } from "@/components/menu/recipeCost";
import {
  NoCostYet,
  RecipeLinesEditor,
  ServingCost,
  anyCosted,
  filledLines,
  halfFilled,
  iqd,
  newLine,
  toCostLines,
  type ItemOpt,
  type LineDraft,
} from "@/components/menu/RecipeLines";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { Icon } from "@/components/Icon";

type Msg = { ok: boolean; text: string } | null;

/** The margin a suggested price leaves, as the new-product form starts with it. */
const TARGET_MARGIN = 70;

/** A price typed for each channel, by its code; a channel left out is not sold there. */
type Prices = Record<SalesChannel, string>;

/**
 * A product, its recipe and its prices — created in one step, or not at all.
 * The recipe comes first and is costed as it is typed, at today's stock costs,
 * so the prices are chosen knowing what one serving costs.
 */
export function AddProductForm({
  items,
  categories = [],
  money: rules,
  inPanel = false,
}: {
  /** In its own panel (Products & Recipes, round thirteen): open, with no button to hide it. */
  inPanel?: boolean;
  items: ItemOpt[];
  categories?: { id: string; name: string }[];
  /** The currency's decimals, and the step suggested prices are rounded up to (250 IQD). */
  money: { decimals: number; priceStep: number };
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const { set, name: channelName } = useChannels();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [open, setOpen] = useState(inPanel);
  // A link to the form opens it: Getting set up's /products#add-product.
  useEffect(() => {
    if (inPanel || window.location.hash !== "#add-product") return;
    setOpen(true);
    document.getElementById("add-product")?.scrollIntoView({ block: "start" });
  }, [inPanel]);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameCkb, setNameCkb] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [prices, setPrices] = useState<Prices>({});
  const [target, setTarget] = useState(String(TARGET_MARGIN));
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  /** With no ingredients: why it uses no stock (a service charge, say). */
  const [noStock, setNoStock] = useState("");
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // What one serving of the recipe, as it will be saved, costs on each channel.
  const recipe = toCostLines(lines, set);
  const costOf = (c: SalesChannel) => servingCost(recipe, byId, c, rules.decimals);
  const costed = anyCosted(lines, items, rules.decimals);
  const targetMargin = parseNumber(target);

  function submit() {
    setMsg(null);
    const half = halfFilled(lines);
    if (half >= 0) {
      setMsg({
        ok: false,
        text: t("Recipe line {n}: choose the ingredient and its quantity, or remove the line.", {
          n: half + 1,
        }),
      });
      return;
    }
    const noRecipe = filledLines(lines, set).length === 0;
    if (noRecipe && !noStock.trim()) {
      setMsg({
        ok: false,
        text: t("List what one serving uses, or say why it uses no stock (a service charge, say)."),
      });
      return;
    }
    start(async () => {
      const r = await op.run("createProduct", (key) =>
        createProductAction(
          {
            name,
            nameAr,
            nameCkb,
            categoryId: categoryId || null,
            prices: Object.fromEntries(
              set.inUse.map((c) => [c, (prices[c] ?? "").trim()]).filter(([, p]) => p !== ""),
            ),
            recipe: filledLines(lines, set),
            noStockReason: noRecipe ? noStock : null,
          },
          key,
        ),
      );
      if (r.ok) {
        setMsg({ ok: true, text: t("Created “{name}”.", { name }) });
        setName("");
        setNameAr("");
        setNameCkb("");
        setPrices({});
        setLines([newLine()]);
        setNoStock("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (items.length === 0) {
    return (
      <div className={inPanel ? undefined : "card"} id="add-product">
        <strong>{t("Add a menu product")}</strong>
        <p className="muted" style={{ fontSize: ".9rem" }}>
          {t("First add stock items on Inventory, so the recipe has ingredients to use.")}
        </p>
        <Link href="/inventory#paste-items" className="btn-soft" data-testid="product-needs-items">
          <Icon name="plus" size={16} /> {t("Add stock items")}
        </Link>
      </div>
    );
  }

  return (
    <div className={inPanel ? "grid" : "card grid"} style={{ gap: 12 }} id="add-product">
      {!inPanel && (
        <button
          className="btn-primary"
          onClick={() => setOpen((o) => !o)}
          style={{ alignSelf: "start" }}
        >
          {open ? (
            <>
              <Icon name="close" size={16} /> {t("Hide product form")}
            </>
          ) : (
            <>
              <Icon name="plus" size={16} /> {t("Add menu product")}
            </>
          )}
        </button>
      )}
      {open && (
        <div className="pf">
          <section className="pf-step">
            <h3 className="pf-h">
              <span className="pf-n">1</span> {t("Name and category")}
            </h3>
            <div className="pf-names">
              <Field label={t("Product name (English)")}>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("e.g. Iced Latte")}
                />
              </Field>
              <Field label="الاسم">
                <input
                  style={inputStyle}
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  dir="rtl"
                />
              </Field>
              <Field label="ناو">
                <input
                  style={inputStyle}
                  value={nameCkb}
                  onChange={(e) => setNameCkb(e.target.value)}
                  dir="rtl"
                />
              </Field>
              {categories.length > 0 && (
                <Field label={t("Category on the till")}>
                  <select
                    style={inputStyle}
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">{t("— none —")}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </section>

          <section className="pf-step">
            <h3 className="pf-h">
              <span className="pf-n">2</span> {t("Recipe: what goes into one serving")}
            </h3>
            <p className="pf-hint">
              {t(
                "Costs are today's, from what the stock cost. Cups, lids and bags are used for takeaway and delivery only.",
              )}
            </p>
            <RecipeLinesEditor
              items={items}
              lines={lines}
              onChange={setLines}
              decimals={rules.decimals}
              channels
            />
            <ServingCost lines={lines} items={items} decimals={rules.decimals} />
            <NoCostYet lines={lines} items={items} />
            {filledLines(lines, set).length === 0 && (
              <label style={{ display: "block", marginBlockStart: 8 }}>
                <div className="pf-hint" style={{ marginBlockEnd: 4 }}>
                  {t("No ingredients? Then it sells at no cost: say why it uses no stock.")}
                </div>
                <input
                  aria-label={t("Why it uses no stock")}
                  value={noStock}
                  onChange={(e) => setNoStock(e.target.value)}
                  placeholder={t("A service charge")}
                  maxLength={200}
                  style={{ width: "100%", maxWidth: 360 }}
                />
              </label>
            )}
          </section>

          <section className="pf-step">
            <h3 className="pf-h">
              <span className="pf-n">3</span> {t("Prices (IQD)")}
            </h3>
            <p className="pf-hint">
              <Rich
                text={t(
                  "Leave a channel empty if the product is not sold there. Suggested prices leave a margin of <target></target>% and are rounded up to {step}. A delivery platform's commission is not in the cost.",
                  { step: fmtIQD(rules.priceStep) },
                )}
                tags={{
                  target: () => (
                    <input
                      className="pf-target"
                      aria-label={t("Target margin %")}
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      inputMode="decimal"
                    />
                  ),
                }}
              />
            </p>
            <div className="pf-prices">
              {set.inUse.map((c) => {
                const cost = costOf(c);
                const price = parseNumber(prices[c] ?? "");
                const m = price && price.gt(0) ? margin(price, cost) : null;
                const suggested =
                  targetMargin === null
                    ? null
                    : suggestedPrice(cost, targetMargin, rules.priceStep);
                const thin =
                  m !== null &&
                  targetMargin !== null &&
                  m.percent !== null &&
                  m.percent.lt(targetMargin);
                const tone = m === null ? "" : m.amount.lt(0) ? "err" : thin ? "warn" : "ok";
                return (
                  <div key={c} className="pf-price" data-channel={c}>
                    <div className="pf-price-top">
                      <span>{channelName(c)}</span>
                      {costed && (
                        <span className="mono">{t("cost {amount}", { amount: iqd(cost) })}</span>
                      )}
                    </div>
                    <input
                      aria-label={t("{channel} price", { channel: channelName(c) })}
                      style={inputStyle}
                      value={prices[c] ?? ""}
                      onChange={(e) => setPrices({ ...prices, [c]: e.target.value })}
                      inputMode="decimal"
                    />
                    {m && costed && (
                      <div className={`pf-margin ${tone}`}>
                        {m.amount.lt(0)
                          ? t("loss {amount}", { amount: iqd(m.amount.abs()) })
                          : t("margin {amount}", { amount: iqd(m.amount.abs()) })}
                        {m.percent && ` (${m.percent.toFixed(1)}%)`}
                      </div>
                    )}
                    {suggested && !(price && price.eq(suggested)) && (
                      <button
                        type="button"
                        className="pf-suggest"
                        onClick={() => setPrices({ ...prices, [c]: suggested.toString() })}
                      >
                        {t("Use {amount}", { amount: iqd(suggested) })}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={submit} disabled={pending || !name.trim()}>
              {pending ? t("Saving…") : t("Create product")}
            </button>
            <OperationStatus op={op} />
            <Notice msg={msg} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A new price from a date. The old price stays in force until then; history
 * is kept. With more than one branch, a price is every branch's or one's own
 * (0055).
 */
export function PriceChange({
  variantId,
  today,
  branches = [],
  costs = {},
  priceStep = 250,
}: {
  variantId: string;
  today: string;
  branches?: { id: string; name: string }[];
  /** What one serving costs today on each channel, to suggest a price from (null: unknown). */
  costs?: Record<string, number | null>;
  /** The step a suggested price is rounded up to (250 IQD). */
  priceStep?: number;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const { set, name: channelName } = useChannels();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  // A link to the form opens it: Getting set up's /products#add-product.
  useEffect(() => {
    if (window.location.hash !== "#add-product") return;
    setOpen(true);
    document.getElementById("add-product")?.scrollIntoView({ block: "start" });
  }, []);
  const [channel, setChannel] = useState<SalesChannel>("dine_in");
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState(today);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const cost = costs[channel];
  const suggested =
    cost === null || cost === undefined
      ? null
      : suggestedPrice(new Decimal(cost), new Decimal(TARGET_MARGIN), priceStep);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ marginBlockStart: 8, fontSize: ".8rem" }}>
        {t("Change a price…")}
      </button>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        flexWrap: "wrap",
        marginBlockStart: 8,
      }}
    >
      <label>
        <div className="muted" style={{ fontSize: ".75rem" }}>
          {t("Channel")}
        </div>
        <select value={channel} onChange={(e) => setChannel(e.target.value)}>
          {set.inUse.map((c) => (
            <option key={c} value={c}>
              {channelName(c)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <div className="muted" style={{ fontSize: ".75rem" }}>
          {t("New price")}
        </div>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          style={{ width: 110 }}
        />
        {suggested && (
          <button
            type="button"
            className="pf-suggest"
            data-testid="price-suggest"
            title={t("For a {pct}% margin, rounded up to {step}", {
              pct: TARGET_MARGIN,
              step: fmtIQD(priceStep),
            })}
            onClick={() => setPrice(suggested.toString())}
          >
            {t("Use {amount}", { amount: iqd(suggested) })}
          </button>
        )}
      </label>
      <label>
        <div className="muted" style={{ fontSize: ".75rem" }}>
          {t("From")}
        </div>
        <input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} />
      </label>
      {branches.length > 1 && (
        <label>
          <div className="muted" style={{ fontSize: ".75rem" }}>
            {t("At")}
          </div>
          <select
            value={placeId ?? ""}
            onChange={(e) => setPlaceId(e.target.value || null)}
            data-testid="price-at"
          >
            <option value="">{t("Every branch")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className="btn-primary"
        disabled={busy || !price.trim()}
        onClick={() =>
          start(async () => {
            const r = await op.run("setPrice", (key) =>
              setPriceAction({ variantId, channel, price, effectiveFrom: from, placeId }, key),
            );
            if (r.ok) {
              const place = branches.find((x) => x.id === placeId)?.name ?? null;
              setMsg({
                ok: true,
                text: place
                  ? from === today
                    ? t("Price at {place} changed from today.", { place })
                    : t("New price at {place} takes effect on {date}.", { place, date: from })
                  : from === today
                    ? t("Price changed from today.")
                    : t("New price takes effect on {date}.", { date: from }),
              });
              setPrice("");
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          })
        }
      >
        {busy ? "…" : t("Set price")}
      </button>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}
