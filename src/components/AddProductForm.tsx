"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { createProductAction, setPriceAction } from "@/lib/actions/menu";
import { channelLabel, fmtIQD, fmtQty, SELLABLE_CHANNELS } from "@/lib/format";
import { Field, Notice, inputStyle } from "@/components/ui";
import { parseNumber } from "@/components/pos/model";
import {
  channelsFor,
  lineCost,
  margin,
  servingCost,
  suggestedPrice,
  type CostedItem,
  type LineUse,
} from "@/components/menu/recipeCost";

interface ItemOpt extends CostedItem {
  name: string;
  units: { code: string; label: string; factor: number }[];
}
interface LineDraft {
  key: number;
  /** Empty until an ingredient is chosen. */
  itemId: string;
  quantity: string;
  unit: string;
  use: LineUse;
  /** The channels ticked when the line is used on "Some channels…". */
  ticked: SalesChannel[];
}
type Msg = { ok: boolean; text: string } | null;

const noPrices = (): Record<SalesChannel, string> => ({
  dine_in: "",
  takeaway: "",
  direct_delivery: "",
  talabat: "",
  careem: "",
  toters: "",
});

const USES: { value: LineUse; label: string }[] = [
  { value: "all", label: "Every order" },
  { value: "to_go", label: "Takeaway & delivery" },
  { value: "dine_in", label: "Dine-in only" },
  { value: "custom", label: "Some channels…" },
];

const iqd = (d: Decimal) => fmtIQD(d.toNumber());

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
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameCkb, setNameCkb] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [prices, setPrices] = useState(noPrices());
  const [target, setTarget] = useState("70");
  const seq = useRef(0);
  const blank = (): LineDraft => ({
    key: ++seq.current,
    itemId: "",
    quantity: "",
    unit: "",
    use: "all",
    ticked: [],
  });
  const [lines, setLines] = useState<LineDraft[]>(() => [blank()]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const setLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const toggle = (key: number, ch: SalesChannel) =>
    setLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? {
              ...l,
              ticked: l.ticked.includes(ch) ? l.ticked.filter((c) => c !== ch) : [...l.ticked, ch],
            }
          : l,
      ),
    );

  // The recipe as it will be saved, and what one serving of it costs on each channel.
  const recipe = lines.map((l) => ({
    itemId: l.itemId,
    quantity: l.quantity,
    unit: l.unit,
    channels: channelsFor(l.use, l.ticked, SELLABLE_CHANNELS),
  }));
  const costOf = (c: SalesChannel) => servingCost(recipe, byId, c, rules.decimals);
  const costed = recipe.filter((l) => lineCost(l, byId.get(l.itemId), rules.decimals) !== null);
  const noCostYet = [
    ...new Set(
      costed
        .map((l) => byId.get(l.itemId)!)
        .filter((i) => new Decimal(i.unitCost).isZero())
        .map((i) => i.name),
    ),
  ];
  const groups: { cost: Decimal; channels: SalesChannel[] }[] = [];
  for (const c of SELLABLE_CHANNELS) {
    const cost = costOf(c);
    const g = groups.find((x) => x.cost.eq(cost));
    if (g) g.channels.push(c);
    else groups.push({ cost, channels: [c] });
  }
  const targetMargin = parseNumber(target);

  function submit() {
    setMsg(null);
    const half = lines.findIndex((l) => !l.itemId !== (l.quantity.trim() === ""));
    if (half >= 0) {
      setMsg({
        ok: false,
        text: `Recipe line ${half + 1}: choose the ingredient and its quantity, or remove the line.`,
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
          SELLABLE_CHANNELS.filter((c) => prices[c].trim() !== "").map((c) => [c, prices[c]]),
        ),
        recipe: recipe
          .filter((l) => l.itemId && l.quantity.trim() !== "")
          .map((l) => ({
            itemId: l.itemId,
            qty: l.quantity,
            unitCode: l.unit,
            channels: l.channels,
          })),
      });
      if (r.ok) {
        setMsg({ ok: true, text: `Created “${name}”.` });
        setName("");
        setNameAr("");
        setNameCkb("");
        setPrices(noPrices());
        setLines([blank()]);
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
            <div className="pf-head" aria-hidden>
              <span>Ingredient</span>
              <span>Quantity</span>
              <span>Unit</span>
              <span>Used for</span>
              <span style={{ textAlign: "end" }}>Cost</span>
              <span />
            </div>
            {lines.map((l, idx) => {
              const it = byId.get(l.itemId);
              const n = idx + 1;
              const cost = lineCost(recipe[idx]!, it, rules.decimals);
              const unit = it?.units.find((u) => u.code === l.unit);
              const perUnit = it && unit ? new Decimal(it.unitCost).times(unit.factor) : null;
              const none = it !== undefined && new Decimal(it.unitCost).isZero();
              return (
                <div key={l.key} className="pf-line-wrap">
                  <div className="pf-line">
                    <select
                      className="pf-ing"
                      aria-label={`Ingredient ${n}`}
                      style={inputStyle}
                      value={l.itemId}
                      onChange={(e) =>
                        setLine(l.key, {
                          itemId: e.target.value,
                          unit: byId.get(e.target.value)?.baseUnit ?? "",
                        })
                      }
                    >
                      <option value="">Choose an ingredient…</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="pf-qty"
                      aria-label={`Quantity ${n}`}
                      placeholder="qty"
                      style={inputStyle}
                      value={l.quantity}
                      onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                      inputMode="decimal"
                    />
                    <select
                      className="pf-unit"
                      aria-label={`Unit ${n}`}
                      style={inputStyle}
                      value={l.unit}
                      onChange={(e) => setLine(l.key, { unit: e.target.value })}
                      disabled={!it}
                    >
                      {(it?.units ?? []).map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="pf-use"
                      aria-label={`Used for ${n}`}
                      style={inputStyle}
                      value={l.use}
                      onChange={(e) => setLine(l.key, { use: e.target.value as LineUse })}
                    >
                      {USES.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    <div className={`pf-cost mono${none ? " none" : ""}`} data-testid={`cost-${n}`}>
                      {cost === null ? "—" : iqd(cost)}
                      {it && (
                        <small>
                          {none
                            ? "no cost yet"
                            : perUnit && `${fmtQty(perUnit.toNumber())} IQD per ${unit!.label}`}
                        </small>
                      )}
                    </div>
                    <button
                      type="button"
                      className="pf-remove"
                      aria-label={`Remove line ${n}`}
                      title="Remove"
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      disabled={lines.length === 1}
                    >
                      ✕
                    </button>
                  </div>
                  {l.use === "custom" && (
                    <div className="pf-channels">
                      {SELLABLE_CHANNELS.map((c) => (
                        <label key={c}>
                          <input
                            type="checkbox"
                            checked={l.ticked.includes(c)}
                            onChange={() => toggle(l.key, c)}
                          />
                          {channelLabel[c]}
                        </label>
                      ))}
                      {l.ticked.length === 0 && (
                        <span className="muted">none ticked: used on every order</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, blank()])}
              style={{ alignSelf: "start" }}
            >
              + Add ingredient
            </button>
            <div className="pf-total" data-testid="serving-cost">
              {costed.length === 0 ? (
                <span className="muted">
                  Choose the ingredients and their quantities to see what one serving costs.
                </span>
              ) : (
                <>
                  <span>Cost of one serving</span>
                  <span className="pf-total-figs">
                    {groups.map((g) => (
                      <span key={g.channels.join()}>
                        <strong className="mono">{iqd(g.cost)}</strong>
                        {groups.length > 1 &&
                          ` ${g.channels.map((c) => channelLabel[c]).join(", ")}`}
                      </span>
                    ))}
                  </span>
                </>
              )}
            </div>
            {noCostYet.length > 0 && (
              <p className="pf-warn">
                ⚠ No cost yet for {noCostYet.join(", ")}: never bought, so counted as 0 here.
                Receive {noCostYet.length === 1 ? "it" : "them"} on Purchasing, or give an opening
                cost on Inventory, for a true cost.
              </p>
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
              {SELLABLE_CHANNELS.map((c) => {
                const cost = costOf(c);
                const price = parseNumber(prices[c]);
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
                      <span>{channelLabel[c]}</span>
                      {costed.length > 0 && <span className="mono">cost {iqd(cost)}</span>}
                    </div>
                    <input
                      aria-label={`${channelLabel[c]} price`}
                      style={inputStyle}
                      value={prices[c]}
                      onChange={(e) => setPrices({ ...prices, [c]: e.target.value })}
                      inputMode="decimal"
                    />
                    {m && costed.length > 0 && (
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
        <select value={channel} onChange={(e) => setChannel(e.target.value as SalesChannel)}>
          {SELLABLE_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {channelLabel[c]}
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
