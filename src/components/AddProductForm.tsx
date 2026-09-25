"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { createProductAction, setPriceAction } from "@/lib/actions/menu";
import { fmtIQD } from "@/lib/format";
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

type Msg = { ok: boolean; text: string } | null;

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
}: {
  items: ItemOpt[];
  categories?: { id: string; name: string }[];
  /** The currency's decimals, and the step suggested prices are rounded up to (250 IQD). */
  money: { decimals: number; priceStep: number };
}) {
  const router = useRouter();
  const { set, name: channelName } = useChannels();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameCkb, setNameCkb] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [prices, setPrices] = useState<Prices>({});
  const [target, setTarget] = useState("70");
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
        text: `Recipe line ${half + 1}: choose the ingredient and its quantity, or remove the line.`,
      });
      return;
    }
    const noRecipe = filledLines(lines, set).length === 0;
    if (noRecipe && !noStock.trim()) {
      setMsg({
        ok: false,
        text: "List what one serving uses, or say why it uses no stock (a service charge, say).",
      });
      return;
    }
    start(async () => {
      const r = await createProductAction({
        name,
        nameAr,
        nameCkb,
        categoryId: categoryId || null,
        prices: Object.fromEntries(
          set.inUse.map((c) => [c, (prices[c] ?? "").trim()]).filter(([, p]) => p !== ""),
        ),
        recipe: filledLines(lines, set),
        noStockReason: noRecipe ? noStock : null,
      });
      if (r.ok) {
        setMsg({ ok: true, text: `Created “${name}”.` });
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
      <div className="card">
        <strong>Add a menu product</strong>
        <p className="muted" style={{ fontSize: ".9rem" }}>
          First add stock items on Inventory, so the recipe has ingredients to use.
        </p>
      </div>
    );
  }

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <button
        className="btn-primary"
        onClick={() => setOpen((o) => !o)}
        style={{ alignSelf: "start" }}
      >
        {open ? "▾ Hide product form" : "➕ Add menu product"}
      </button>
      {open && (
        <div className="pf">
          <section className="pf-step">
            <h3 className="pf-h">
              <span className="pf-n">1</span> Name and category
            </h3>
            <div className="pf-names">
              <Field label="Product name (English)">
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Iced Latte"
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
                <Field label="Category on the till">
                  <select
                    style={inputStyle}
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">— none —</option>
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
              <span className="pf-n">2</span> Recipe: what goes into one serving
            </h3>
            <p className="pf-hint">
              Costs are today&apos;s, from what the stock cost. Cups, lids and bags are used for
              takeaway and delivery only.
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
                  No ingredients? Then it sells at no cost: say why it uses no stock.
                </div>
                <input
                  aria-label="Why it uses no stock"
                  value={noStock}
                  onChange={(e) => setNoStock(e.target.value)}
                  placeholder="A service charge"
                  maxLength={200}
                  style={{ width: "100%", maxWidth: 360 }}
                />
              </label>
            )}
          </section>

          <section className="pf-step">
            <h3 className="pf-h">
              <span className="pf-n">3</span> Prices (IQD)
            </h3>
            <p className="pf-hint">
              Leave a channel empty if the product is not sold there. Suggested prices leave a
              margin of{" "}
              <input
                className="pf-target"
                aria-label="Target margin %"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="decimal"
              />
              % and are rounded up to {fmtIQD(rules.priceStep)}. A delivery platform&apos;s
              commission is not in the cost.
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
                      {costed && <span className="mono">cost {iqd(cost)}</span>}
                    </div>
                    <input
                      aria-label={`${channelName(c)} price`}
                      style={inputStyle}
                      value={prices[c] ?? ""}
                      onChange={(e) => setPrices({ ...prices, [c]: e.target.value })}
                      inputMode="decimal"
                    />
                    {m && costed && (
                      <div className={`pf-margin ${tone}`}>
                        {m.amount.lt(0) ? "loss" : "margin"} {iqd(m.amount.abs())}
                        {m.percent && ` (${m.percent.toFixed(1)}%)`}
                      </div>
                    )}
                    {suggested && (!m || thin || m.amount.lt(0)) && (
                      <button
                        type="button"
                        className="pf-suggest"
                        onClick={() => setPrices({ ...prices, [c]: suggested.toString() })}
                      >
                        Use {iqd(suggested)}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={submit} disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Create product"}
            </button>
            <Notice msg={msg} />
          </div>
        </div>
      )}
    </div>
  );
}

/** A new price from a date. The old price stays in force until then; history is kept. */
export function PriceChange({ variantId, today }: { variantId: string; today: string }) {
  const router = useRouter();
  const { set, name: channelName } = useChannels();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<SalesChannel>("dine_in");
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState(today);
  const [msg, setMsg] = useState<Msg>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ marginBlockStart: 8, fontSize: ".8rem" }}>
        Change a price…
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
          Channel
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
          New price
        </div>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          style={{ width: 110 }}
        />
      </label>
      <label>
        <div className="muted" style={{ fontSize: ".75rem" }}>
          From
        </div>
        <input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <button
        className="btn-primary"
        disabled={busy || !price.trim()}
        onClick={() =>
          start(async () => {
            const r = await setPriceAction({ variantId, channel, price, effectiveFrom: from });
            if (r.ok) {
              setMsg({
                ok: true,
                text:
                  from === today
                    ? "Price changed from today."
                    : `New price takes effect on ${from}.`,
              });
              setPrice("");
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          })
        }
      >
        {busy ? "…" : "Set price"}
      </button>
      <Notice msg={msg} />
    </div>
  );
}
