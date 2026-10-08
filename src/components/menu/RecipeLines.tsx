"use client";
/**
 * A recipe's lines as they are typed — the item, how much, in which unit and,
 * for a product, what it is used for — each with what it costs today. Shared by
 * the new-product form, a product's recipe change and a batch recipe.
 */
import { useId, useState } from "react";
import Decimal from "decimal.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { NO_CHANNELS, type ChannelSet } from "@/lib/channels";
import { fmtIQD, fmtQty, unitName } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
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
import { Icon, StatusMark } from "@/components/Icon";
import { namesMatch, searchText } from "@/lib/find";

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

export const iqd = (d: Decimal) => fmtIQD(d.toNumber());

/** How many matches the list shows at once. */
const PICK_MAX = 8;

/**
 * An ingredient found by typing part of its name (round thirteen), in place of
 * scrolling a long list: the matches show as it is typed, arrows and Enter
 * pick one, and the line takes the item's own unit.
 */
export function ItemPicker({
  items,
  value,
  label,
  onPick,
}: {
  items: ItemOpt[];
  value: string;
  label: string;
  onPick: (itemId: string) => void;
}) {
  const { t } = useT();
  const list = useId();
  const chosen = items.find((i) => i.id === value) ?? null;
  const [typed, setTyped] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const open = typed !== null;
  const q = searchText(typed ?? "");
  const matches = (q ? items.filter((i) => namesMatch([i.name], q)) : items).slice(0, PICK_MAX);
  const pick = (i: ItemOpt | undefined) => {
    if (i) onPick(i.id);
    setTyped(null);
  };
  return (
    <div className="pf-ing item-pick">
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={list}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${list}-${active}` : undefined}
        autoComplete="off"
        dir="auto"
        style={inputStyle}
        placeholder={t("Type to find an ingredient…")}
        value={typed ?? chosen?.name ?? ""}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setTyped(e.target.value);
          setActive(0);
        }}
        onBlur={() => setTyped(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setTyped("");
            else setActive((a) => Math.min(a + 1, Math.max(matches.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setTyped(null);
          }
        }}
      />
      {open && (
        <ul className="item-pick-list" id={list} role="listbox" aria-label={label}>
          {matches.length === 0 ? (
            <li className="muted item-pick-none">{t("No stock item by that name.")}</li>
          ) : (
            matches.map((i, k) => (
              <li
                key={i.id}
                id={`${list}-${k}`}
                role="option"
                data-name={i.name}
                aria-selected={k === active}
                className={k === active ? "on" : undefined}
                onMouseDown={(e) => {
                  // Picked before the box loses its focus and closes the list.
                  e.preventDefault();
                  pick(i);
                }}
                onMouseEnter={() => setActive(k)}
              >
                {i.name}
                <span className="muted">
                  {unitName(i.units.find((u) => u.code === i.baseUnit)?.label ?? i.baseUnit, t)}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function RecipeLinesEditor({
  items,
  lines,
  onChange,
  decimals,
  channels,
  addLabel,
}: {
  items: ItemOpt[];
  lines: LineDraft[];
  onChange: (update: (lines: LineDraft[]) => LineDraft[]) => void;
  decimals: number;
  /** A product's lines say what they are used for; a batch's do not. */
  channels: boolean;
  /** The add button's words, translated; "+ Add ingredient" when not given. */
  addLabel?: string;
}) {
  const { t } = useT();
  const USES: { value: LineUse; label: string }[] = [
    { value: "all", label: t("Every order") },
    { value: "to_go", label: t("Takeaway & delivery") },
    { value: "dine_in", label: t("Dine-in only") },
    { value: "custom", label: t("Some channels…") },
  ];
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
        <span>{t("Ingredient")}</span>
        <span>{t("Quantity")}</span>
        <span>{t("Unit")}</span>
        {channels && <span>{t("Used for")}</span>}
        <span style={{ textAlign: "end" }}>{t("Cost")}</span>
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
              <ItemPicker
                items={items}
                value={l.itemId}
                label={t("Ingredient {n}", { n })}
                onPick={(id) => setLine(l.key, { itemId: id, unit: byId.get(id)?.baseUnit ?? "" })}
              />
              <input
                className="pf-qty"
                aria-label={t("Quantity {n}", { n })}
                placeholder={t("qty")}
                style={inputStyle}
                value={l.quantity}
                onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                inputMode="decimal"
              />
              <select
                className="pf-unit"
                aria-label={t("Unit {n}", { n })}
                style={inputStyle}
                value={l.unit}
                onChange={(e) => setLine(l.key, { unit: e.target.value })}
                disabled={!it}
              >
                {(it?.units ?? []).map((u) => (
                  <option key={u.code} value={u.code}>
                    {unitName(u.label, t)}
                  </option>
                ))}
              </select>
              {channels && (
                <select
                  className="pf-use"
                  aria-label={t("Used for {n}", { n })}
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
                      ? t("no cost yet")
                      : perUnit &&
                        t("{qty} IQD per {unit}", {
                          qty: fmtQty(perUnit.toNumber()),
                          unit: unitName(unit!.label, t),
                        })}
                  </small>
                )}
              </div>
              <button
                type="button"
                className="pf-remove"
                aria-label={t("Remove line {n}", { n })}
                title={t("Remove")}
                onClick={() => onChange((ls) => ls.filter((x) => x.key !== l.key))}
                disabled={lines.length === 1}
              >
                <Icon name="close" size={16} />
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
                  <span className="muted">{t("none ticked: used on every order")}</span>
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
        {addLabel ?? t("+ Add ingredient")}
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
  const { t } = useT();
  const { set, name } = useChannels();
  const groups = servingGroups(lines, items, decimals, set);
  return (
    <div className="pf-total" data-testid="serving-cost">
      {!anyCosted(lines, items, decimals) ? (
        <span className="muted">
          {t("Choose the ingredients and their quantities to see what one serving costs.")}
        </span>
      ) : (
        <>
          <span>{t("Cost of one serving")}</span>
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
  const { t } = useT();
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
      <StatusMark state="warn" label={t("Warning")} />{" "}
      {names.length === 1
        ? t(
            "No cost yet for {names}: never bought or made, so counted as 0 here. Receive it on Purchasing, make a batch on Production, or give an opening cost on Inventory, for a true cost.",
            { names: names.join(", ") },
          )
        : t(
            "No cost yet for {names}: never bought or made, so counted as 0 here. Receive them on Purchasing, make a batch on Production, or give an opening cost on Inventory, for a true cost.",
            { names: names.join(", ") },
          )}
    </p>
  );
}
