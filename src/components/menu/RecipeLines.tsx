"use client";
/**
 * A recipe's lines as they are typed — the item, how much, in which unit and,
 * for a product, what it is used for — each with what it costs today. Shared by
 * the new-product form, a product's recipe change and a batch recipe.
 */
import Decimal from "decimal.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { NO_CHANNELS, type ChannelSet } from "@/lib/channels";
import { fmtIQD, fmtQty } from "@/lib/format";
import { inputStyle } from "@/components/ui";
import { useChannels } from "@/components/ChannelsProvider";
import {
  channelsFor,
  lineCost,
  servingCost,
  type CostLine,
  type CostedItem,
  type LineUse,
} from "@/components/menu/recipeCost";

export interface ItemOpt extends CostedItem {
  name: string;
  units: { code: string; label: string; factor: number }[];
}

export interface LineDraft {
  key: number;
  /** Empty until an item is chosen. */
  itemId: string;
  quantity: string;
  unit: string;
  use: LineUse;
  /** The channels ticked when the line is used on "Some channels…". */
  ticked: SalesChannel[];
}

let seq = 0;
export const newLine = (): LineDraft => ({
  key: ++seq,
  itemId: "",
  quantity: "",
  unit: "",
  use: "all",
  ticked: [],
});

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * Lines to edit, from a recipe as saved: its channels read back as the choice
 * they came from. A line's channels out of use stay ticked, so saving it
 * unchanged keeps them.
 */
export function linesFrom(
  saved: { itemId: string; quantity: number; unitCode: string; channels?: string[] | null }[],
  set: ChannelSet,
): LineDraft[] {
  if (saved.length === 0) return [newLine()];
  return saved.map((s) => {
    const ch = s.channels ?? [];
    const use: LineUse =
      ch.length === 0
        ? "all"
        : sameSet(ch, set.toGo)
          ? "to_go"
          : sameSet(ch, ["dine_in"])
            ? "dine_in"
            : "custom";
    return {
      ...newLine(),
      itemId: s.itemId,
      quantity: fmtQty(s.quantity).replace(/,/g, ""),
      unit: s.unitCode,
      use,
      ticked: use === "custom" ? ch : [],
    };
  });
}

/** The lines as they will be saved and costed. */
export function toCostLines(lines: LineDraft[], set: ChannelSet): CostLine[] {
  return lines.map((l) => ({
    itemId: l.itemId,
    quantity: l.quantity,
    unit: l.unit,
    channels: channelsFor(l.use, l.ticked, set),
  }));
}

/** The first line with an item but no quantity, or a quantity but no item (-1 if none). */
export function halfFilled(lines: LineDraft[]): number {
  return lines.findIndex((l) => !l.itemId !== (l.quantity.trim() === ""));
}

/** The lines to send: those with both an item and a quantity. */
export function filledLines(lines: LineDraft[], set: ChannelSet) {
  return toCostLines(lines, set)
    .filter((l) => l.itemId && l.quantity.trim() !== "")
    .map((l) => ({ itemId: l.itemId, qty: l.quantity, unitCode: l.unit, channels: l.channels }));
}

const USES: { value: LineUse; label: string }[] = [
  { value: "all", label: "Every order" },
  { value: "to_go", label: "Takeaway & delivery" },
  { value: "dine_in", label: "Dine-in only" },
  { value: "custom", label: "Some channels…" },
];

export const iqd = (d: Decimal) => fmtIQD(d.toNumber());

export function RecipeLinesEditor({
  items,
  lines,
  onChange,
  decimals,
  channels,
  addLabel = "+ Add ingredient",
}: {
  items: ItemOpt[];
  lines: LineDraft[];
  onChange: (update: (lines: LineDraft[]) => LineDraft[]) => void;
  decimals: number;
  /** A product's lines say what they are used for; a batch's do not. */
  channels: boolean;
  addLabel?: string;
}) {
  const { set, name } = useChannels();
  const byId = new Map(items.map((i) => [i.id, i]));
  const costLines = toCostLines(lines, channels ? set : NO_CHANNELS);
  const setLine = (key: number, patch: Partial<LineDraft>) =>
    onChange((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const toggle = (key: number, ch: SalesChannel) =>
    onChange((ls) =>
      ls.map((l) =>
        l.key === key
          ? {
              ...l,
              ticked: l.ticked.includes(ch) ? l.ticked.filter((c) => c !== ch) : [...l.ticked, ch],
            }
          : l,
      ),
    );

  return (
    <div className={`pf-lines${channels ? "" : " no-use"}`}>
      <div className="pf-head" aria-hidden>
        <span>Ingredient</span>
        <span>Quantity</span>
        <span>Unit</span>
        {channels && <span>Used for</span>}
        <span style={{ textAlign: "end" }}>Cost</span>
        <span />
      </div>
      {lines.map((l, idx) => {
        const it = byId.get(l.itemId);
        const n = idx + 1;
        const cost = lineCost(costLines[idx]!, it, decimals);
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
              {channels && (
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
              )}
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
                onClick={() => onChange((ls) => ls.filter((x) => x.key !== l.key))}
                disabled={lines.length === 1}
              >
                ✕
              </button>
            </div>
            {channels && l.use === "custom" && (
              <div className="pf-channels">
                {[...set.inUse, ...l.ticked.filter((c) => !set.inUse.includes(c))].map((c) => (
                  <label key={c}>
                    <input
                      type="checkbox"
                      checked={l.ticked.includes(c)}
                      onChange={() => toggle(l.key, c)}
                    />
                    {name(c)}
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
        onClick={() => onChange((ls) => [...ls, newLine()])}
        style={{ alignSelf: "start" }}
      >
        {addLabel}
      </button>
    </div>
  );
}

/** What one serving costs on each channel, one figure where the packaging makes no difference. */
export function servingGroups(
  lines: LineDraft[],
  items: ItemOpt[],
  decimals: number,
  set: ChannelSet,
): { cost: Decimal; channels: SalesChannel[] }[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const costLines = toCostLines(lines, set);
  const groups: { cost: Decimal; channels: SalesChannel[] }[] = [];
  for (const c of set.inUse) {
    const cost = servingCost(costLines, byId, c, decimals);
    const g = groups.find((x) => x.cost.eq(cost));
    if (g) g.channels.push(c);
    else groups.push({ cost, channels: [c] });
  }
  return groups;
}

/** True once any line has an item and a quantity to cost. */
export function anyCosted(lines: LineDraft[], items: ItemOpt[], decimals: number): boolean {
  const byId = new Map(items.map((i) => [i.id, i]));
  return toCostLines(lines, NO_CHANNELS).some(
    (l) => lineCost(l, byId.get(l.itemId), decimals) !== null,
  );
}

/** The cost of one serving, under a product's recipe lines. */
export function ServingCost({
  lines,
  items,
  decimals,
}: {
  lines: LineDraft[];
  items: ItemOpt[];
  decimals: number;
}) {
  const { set, name } = useChannels();
  const groups = servingGroups(lines, items, decimals, set);
  return (
    <div className="pf-total" data-testid="serving-cost">
      {!anyCosted(lines, items, decimals) ? (
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
                {groups.length > 1 && ` ${g.channels.map(name).join(", ")}`}
              </span>
            ))}
          </span>
        </>
      )}
    </div>
  );
}

/** Items in the lines that have no cost yet: never bought or made, so counted as nothing. */
export function NoCostYet({ lines, items }: { lines: LineDraft[]; items: ItemOpt[] }) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const names = [
    ...new Set(
      lines
        .filter((l) => l.itemId && l.quantity.trim() !== "")
        .map((l) => byId.get(l.itemId))
        .filter((i): i is ItemOpt => i !== undefined && new Decimal(i.unitCost).isZero())
        .map((i) => i.name),
    ),
  ];
  if (names.length === 0) return null;
  return (
    <p className="pf-warn">
      ⚠ No cost yet for {names.join(", ")}: never bought or made, so counted as 0 here. Receive{" "}
      {names.length === 1 ? "it" : "them"} on Purchasing, make a batch on Production, or give an
      opening cost on Inventory, for a true cost.
    </p>
  );
}
