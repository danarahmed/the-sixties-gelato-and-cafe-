"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SalesChannel } from "@domain/sales/recipe.js";
import {
  saveAddonAction,
  saveAddonGroupAction,
  setAddonPriceAction,
  setAddonRecipeAction,
} from "@/lib/actions/menu";
import type {
  AddonRecipeLine,
  MenuAddon,
  MenuAddonGroup,
  MenuProduct,
  ProductAddonOffer,
} from "@/lib/db/menu";
import { fmtIQD, fmtQty } from "@/lib/format";
import type { T } from "@/lib/i18n/core";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { useChannels } from "@/components/ChannelsProvider";
import { asks } from "@/components/pos/OptionsSheet";
import {
  NoCostYet,
  RecipeLinesEditor,
  ServingCost,
  filledLines,
  halfFilled,
  linesFrom,
  newLine,
  type ItemOpt,
  type LineDraft,
} from "@/components/menu/RecipeLines";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;
interface Names {
  name: string;
  ar: string;
  ckb: string;
}
/** For those who edit the menu: the items a recipe may use, costed. */
export interface Editor {
  items: ItemOpt[];
  decimals: number;
  today: string;
}
/** A size an add-on may have its own quantities for. */
export interface SizeOpt {
  id: string;
  label: string;
}

/** A whole number typed in a box, or NaN. */
const whole = (s: string) => (/^\s*\d+\s*$/.test(s) ? Number(s) : NaN);
const order = (s: string) => Math.min(999, Math.max(0, Math.trunc(Number(s) || 0)));

/** The three names, side by side. */
function NameFields({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: Names;
  onChange: (n: Names) => void;
  placeholder?: string;
}) {
  return (
    <div className="pf-names">
      <Field label={label}>
        <input
          style={inputStyle}
          value={value.name}
          maxLength={60}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </Field>
      <Field label="الاسم">
        <input
          style={inputStyle}
          dir="rtl"
          value={value.ar}
          maxLength={60}
          onChange={(e) => onChange({ ...value, ar: e.target.value })}
        />
      </Field>
      <Field label="ناو">
        <input
          style={inputStyle}
          dir="rtl"
          value={value.ckb}
          maxLength={60}
          onChange={(e) => onChange({ ...value, ckb: e.target.value })}
        />
      </Field>
    </div>
  );
}

/** What an add-on uses, in a line: for every size, then each size with its own. */
function recipeSummary(
  recipe: AddonRecipeLine[],
  labelOf: Map<string, string>,
  t: T,
): { key: string; who: string; what: string }[] {
  const bySize = new Map<string, AddonRecipeLine[]>();
  for (const l of recipe) {
    const k = l.variantId ?? "";
    bySize.set(k, [...(bySize.get(k) ?? []), l]);
  }
  const what = (ls: AddonRecipeLine[]) =>
    ls.map((l) => `${fmtQty(l.quantity)} ${l.unitCode} ${l.itemName}`).join(", ");
  return [...bySize]
    .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : 0))
    .map(([k, ls]) => ({
      key: k,
      who: k === "" ? t("Every size") : (labelOf.get(k) ?? t("A size")),
      what: what(ls),
    }));
}

/** A group of add-ons, new or changed: its names, and the fewest and the most a line takes. */
export function GroupForm({
  group,
  nextSort,
  onDone,
  onCreated,
}: {
  group: MenuAddonGroup | null;
  nextSort: number;
  onDone: () => void;
  /** A new group, made from a product's panel: that product offers it next. */
  onCreated?: (groupId: string) => Promise<string | null>;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [names, setNames] = useState<Names>({
    name: group?.name ?? "",
    ar: group?.nameAr ?? "",
    ckb: group?.nameCkb ?? "",
  });
  const [min, setMin] = useState(String(group?.min ?? 0));
  const [max, setMax] = useState(group ? (group.max === null ? "" : String(group.max)) : "1");
  const [sort, setSort] = useState(String(group?.sortOrder ?? nextSort));
  const [active, setActive] = useState(group?.isActive ?? true);
  const [msg, setMsg] = useState<Msg>(null);
  const fewest = whole(min.trim() === "" ? "0" : min);
  const most = max.trim() === "" ? null : whole(max);
  const readable =
    !Number.isNaN(fewest) &&
    (most === null || (!Number.isNaN(most) && most >= Math.max(1, fewest)));

  function save() {
    setMsg(null);
    if (Number.isNaN(fewest) || fewest > 20) {
      setMsg({ ok: false, text: t("The fewest to choose is a number from 0 to 20") });
      return;
    }
    if (most !== null && (Number.isNaN(most) || most < 1 || most > 20 || most < fewest)) {
      setMsg({
        ok: false,
        text: t("The most to choose is a number from 1 to 20, and no fewer than the fewest"),
      });
      return;
    }
    start(async () => {
      const r = await op.run(`saveAddonGroup:${group?.id ?? "new"}`, (key) =>
        saveAddonGroupAction(
          {
            groupId: group?.id ?? null,
            name: names.name,
            nameAr: names.ar,
            nameCkb: names.ckb,
            min: fewest,
            max: most,
            sort: order(sort),
            isActive: active,
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      if (!group && onCreated) {
        const failed = await onCreated(r.data.groupId);
        if (failed) {
          setMsg({ ok: false, text: failed });
          router.refresh();
          return;
        }
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="pf-change grid" style={{ gap: 10 }} data-testid="group-form">
      <NameFields
        label={t("Group name (English)")}
        value={names}
        onChange={setNames}
        placeholder={t("e.g. Milk")}
      />
      <div className="addon-counts">
        <Field label={t("Fewest a line takes")}>
          <input
            style={inputStyle}
            inputMode="numeric"
            value={min}
            aria-label={t("Fewest a line takes")}
            onChange={(e) => setMin(e.target.value)}
          />
        </Field>
        <Field label={t("Most a line takes")}>
          <input
            style={inputStyle}
            inputMode="numeric"
            value={max}
            placeholder={t("no limit")}
            aria-label={t("Most a line takes")}
            onChange={(e) => setMax(e.target.value)}
          />
        </Field>
        <Field label={t("pos.order")}>
          <input
            style={inputStyle}
            inputMode="numeric"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          />
        </Field>
        {group && (
          <label className="addon-active">
            <input
              type="checkbox"
              className="check"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />{" "}
            {t("On the till")}
          </label>
        )}
      </div>
      <p className="pf-hint">
        {t(
          "1 or more makes it a choice the till asks for (the milk, say); 0 makes it optional (extras). Leave the most empty for no limit.",
        )}{" "}
        {readable && (
          <strong>
            {t("The till says: {asks}", { asks: asks({ min: fewest, max: most }, t) })}
          </strong>
        )}
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          onClick={save}
          disabled={busy || !names.name.trim()}
          data-testid="group-save"
        >
          {busy ? t("Saving…") : group ? t("Save") : t("Add the group")}
        </button>
        <button onClick={onDone} disabled={busy}>
          {t("Cancel")}
        </button>
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
    </div>
  );
}

/** A new add-on in a group: its names, its prices on each channel, and what one uses. */
function AddonForm({
  group,
  editor,
  nextSort,
  onDone,
}: {
  group: MenuAddonGroup;
  editor: Editor;
  nextSort: number;
  onDone: () => void;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const { set, name: channelName } = useChannels();
  const [busy, start] = useTransition();
  const [names, setNames] = useState<Names>({ name: "", ar: "", ckb: "" });
  const [prices, setPrices] = useState<Record<SalesChannel, string>>({});
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [msg, setMsg] = useState<Msg>(null);

  function save() {
    setMsg(null);
    const half = halfFilled(lines);
    if (half >= 0) {
      setMsg({
        ok: false,
        text: t("Line {n}: choose the ingredient and its quantity, or remove the line.", {
          n: half + 1,
        }),
      });
      return;
    }
    start(async () => {
      const r = await op.run(`saveAddon:new:${group.id}`, (key) =>
        saveAddonAction(
          {
            modifierId: null,
            groupId: group.id,
            name: names.name,
            nameAr: names.ar,
            nameCkb: names.ckb,
            sort: nextSort,
            isActive: true,
            prices: Object.fromEntries(
              set.inUse.map((c) => [c, (prices[c] ?? "").trim()]).filter(([, p]) => p !== ""),
            ),
            recipe: filledLines(lines, set),
          },
          key,
        ),
      );
      if (r.ok) {
        router.refresh();
        onDone();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="pf-change grid" style={{ gap: 10 }} data-testid="addon-form">
      <NameFields
        label={t("Add-on name (English)")}
        value={names}
        onChange={setNames}
        placeholder={t("e.g. Oat milk")}
      />
      <div className="muted" style={{ fontSize: ".85rem" }}>
        {t("Prices (IQD)")}
      </div>
      <div className="pf-prices">
        {set.inUse.map((c) => (
          <Field key={c} label={channelName(c)}>
            <input
              style={inputStyle}
              inputMode="decimal"
              value={prices[c] ?? ""}
              aria-label={`${t("Price")} · ${channelName(c)}`}
              onChange={(e) => setPrices({ ...prices, [c]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <p className="pf-hint">
        {t(
          "0 makes it free. A channel left empty does not offer it; give it a price later to offer it there.",
        )}
      </p>
      <fieldset className="size-recipe">
        <legend className="muted">{t("What one uses, for every size")}</legend>
        <p className="pf-hint">
          {t(
            "For a choice such as the milk, take the milk out of the sizes' recipes and give each choice its own: then every cup counts the milk it was made with. Leave it empty if it uses no stock.",
          )}
        </p>
        <RecipeLinesEditor
          items={editor.items}
          lines={lines}
          onChange={setLines}
          decimals={editor.decimals}
          channels
        />
        <NoCostYet lines={lines} items={editor.items} />
      </fieldset>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          onClick={save}
          disabled={busy || !names.name.trim()}
          data-testid="addon-save"
        >
          {busy ? t("Saving…") : t("Add the add-on")}
        </button>
        <button onClick={onDone} disabled={busy}>
          {t("Cancel")}
        </button>
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
    </div>
  );
}

/** An add-on: its names and prices, what it uses, and the ways to change them. */
function AddonRow({
  addon,
  editor,
  sizes,
  labelOf,
}: {
  addon: MenuAddon;
  editor: Editor | null;
  /** The sizes offered it, for quantities of their own. */
  sizes: SizeOpt[];
  labelOf: Map<string, string>;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const { set, name: channelName } = useChannels();
  const [busy, start] = useTransition();
  const [mode, setMode] = useState<"none" | "edit" | "price" | "recipe">("none");
  const [msg, setMsg] = useState<Msg>(null);
  // Changing the names and the order, or taking it off the till.
  const [names, setNames] = useState<Names>({
    name: addon.name,
    ar: addon.nameAr ?? "",
    ckb: addon.nameCkb ?? "",
  });
  const [sort, setSort] = useState(String(addon.sortOrder));
  // A new price.
  const [channel, setChannel] = useState<SalesChannel>(set.inUse[0] ?? "dine_in");
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState(editor?.today ?? "");
  // What it uses: for every size ("") or a size's own.
  const [size, setSize] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);

  const linesOf = (variant: string) =>
    linesFrom(
      addon.recipe
        .filter((l) => (l.variantId ?? "") === variant)
        .map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitCode: l.unitCode,
          channels: l.channels,
        })),
      set,
    );
  // Sizes offered it, and any with quantities of their own that no longer are.
  const sizeOpts: SizeOpt[] = [
    ...sizes,
    ...[...new Set(addon.recipe.map((l) => l.variantId).filter((v): v is string => v !== null))]
      .filter((v) => !sizes.some((s) => s.id === v))
      .map((v) => ({ id: v, label: labelOf.get(v) ?? t("A size") })),
  ];

  function open(m: typeof mode) {
    setMsg(null);
    if (m === "edit") {
      setNames({ name: addon.name, ar: addon.nameAr ?? "", ckb: addon.nameCkb ?? "" });
      setSort(String(addon.sortOrder));
    }
    if (m === "price") {
      setPrice("");
      setFrom(editor?.today ?? "");
    }
    if (m === "recipe") {
      setSize("");
      setLines(linesOf(""));
    }
    setMode(m);
  }

  function saveAddon(isActive: boolean, n: Names, sortOrder: number) {
    setMsg(null);
    start(async () => {
      const r = await op.run(`saveAddon:${addon.id}`, (key) =>
        saveAddonAction(
          {
            modifierId: addon.id,
            groupId: addon.groupId,
            name: n.name,
            nameAr: n.ar,
            nameCkb: n.ckb,
            sort: sortOrder,
            isActive,
          },
          key,
        ),
      );
      if (r.ok) {
        setMode("none");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  function savePrice() {
    setMsg(null);
    start(async () => {
      const r = await op.run(`addonPrice:${addon.id}`, (key) =>
        setAddonPriceAction(
          { modifierId: addon.id, channel, price, effectiveFrom: from || null },
          key,
        ),
      );
      if (r.ok) {
        setMode("none");
        setMsg({
          ok: true,
          text:
            !from || from === editor?.today
              ? t("Price changed from today.")
              : t("New price takes effect on {date}.", { date: from }),
        });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  function saveRecipe() {
    setMsg(null);
    const half = halfFilled(lines);
    if (half >= 0) {
      setMsg({
        ok: false,
        text: t("Line {n}: choose the ingredient and its quantity, or remove the line.", {
          n: half + 1,
        }),
      });
      return;
    }
    start(async () => {
      const r = await op.run(`addonRecipe:${addon.id}`, (key) =>
        setAddonRecipeAction(
          { modifierId: addon.id, variantId: size || null, lines: filledLines(lines, set) },
          key,
        ),
      );
      if (r.ok) {
        setMode("none");
        setMsg({ ok: true, text: t("Saved “{name}”.", { name: addon.name }) });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  const uses = recipeSummary(addon.recipe, labelOf, t);
  return (
    <li
      className={addon.isActive ? "addon-row" : "addon-row faint"}
      data-testid="addon-row"
      data-addon={addon.name}
    >
      <div className="addon-row-main">
        <span>
          <strong>{addon.name}</strong>
          {(addon.nameAr || addon.nameCkb) && (
            <span className="muted">
              {" "}
              · {[addon.nameAr, addon.nameCkb].filter(Boolean).join(" · ")}
            </span>
          )}
          {!addon.isActive && <span className="badge warn"> {t("Off the till")}</span>}
        </span>
        <span className="addon-prices mono" data-testid="addon-prices">
          {set.inUse.map((c) => {
            const p = addon.prices[c];
            return (
              <span key={c}>
                {channelName(c)} {p === undefined ? "—" : p === 0 ? t("free") : fmtIQD(p)}
              </span>
            );
          })}
        </span>
        {addon.scheduled.map((s) => (
          <span
            key={`${s.channel}${s.effectiveFrom}`}
            className="muted"
            style={{ fontSize: ".8rem" }}
          >
            {t("{channel}: {price} from {date}", {
              channel: channelName(s.channel),
              price: s.price === 0 ? t("free") : fmtIQD(s.price),
              date: s.effectiveFrom,
            })}
          </span>
        ))}
        <span className="muted addon-uses">
          {uses.length === 0
            ? t("Uses no stock")
            : uses.map((u) => (
                <span key={u.key}>
                  {u.who}: {u.what}
                </span>
              ))}
        </span>
      </div>
      {editor && mode === "none" && (
        <span className="size-actions">
          <button className="linklike" onClick={() => open("edit")} disabled={busy}>
            {t("Rename…")}
          </button>
          <button className="linklike" onClick={() => open("price")} disabled={busy}>
            {t("Change a price…")}
          </button>
          <button className="linklike" onClick={() => open("recipe")} disabled={busy}>
            {t("What it uses…")}
          </button>
          <button
            className="linklike"
            onClick={() =>
              saveAddon(
                !addon.isActive,
                { name: addon.name, ar: addon.nameAr ?? "", ckb: addon.nameCkb ?? "" },
                addon.sortOrder,
              )
            }
            disabled={busy}
          >
            {addon.isActive ? t("Take it off the till") : t("Bring it back")}
          </button>
        </span>
      )}
      {editor && mode === "edit" && (
        <div className="pf-change grid" style={{ gap: 10 }}>
          <NameFields label={t("Add-on name (English)")} value={names} onChange={setNames} />
          <Field label={t("pos.order")} style={{ maxWidth: 120 }}>
            <input
              style={inputStyle}
              inputMode="numeric"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn-primary"
              onClick={() => saveAddon(addon.isActive, names, order(sort))}
              disabled={busy || !names.name.trim()}
            >
              {t("Save")}
            </button>
            <button onClick={() => setMode("none")} disabled={busy}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
      {editor && mode === "price" && (
        <div
          className="pf-change"
          style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
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
              aria-label={t("New price")}
              style={{ width: 110 }}
            />
          </label>
          <label>
            <div className="muted" style={{ fontSize: ".75rem" }}>
              {t("From")}
            </div>
            <input
              type="date"
              value={from}
              min={editor.today}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <button className="btn-primary" disabled={busy || !price.trim()} onClick={savePrice}>
            {busy ? "…" : t("Set price")}
          </button>
          <button onClick={() => setMode("none")} disabled={busy}>
            {t("Cancel")}
          </button>
        </div>
      )}
      {editor && mode === "recipe" && (
        <div className="pf-change">
          <label>
            <div className="muted" style={{ fontSize: ".75rem" }}>
              {t("Applies to")}
            </div>
            <select
              value={size}
              aria-label={t("Applies to")}
              onChange={(e) => {
                setSize(e.target.value);
                setLines(linesOf(e.target.value));
              }}
            >
              <option value="">{t("Every size")}</option>
              {sizeOpts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <p className="pf-hint">
            {size
              ? t(
                  "This size's own quantities, in place of those for every size (a bigger cup takes more syrup, say). Leave it empty to use those for every size.",
                )
              : t(
                  "What one of it uses, for every size that has no quantities of its own. From the next sale on: sales already made keep what they used.",
                )}
          </p>
          <RecipeLinesEditor
            items={editor.items}
            lines={lines}
            onChange={setLines}
            decimals={editor.decimals}
            channels
          />
          <ServingCost lines={lines} items={editor.items} decimals={editor.decimals} />
          <NoCostYet lines={lines} items={editor.items} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={saveRecipe} disabled={busy}>
              {busy ? t("Saving…") : t("Save")}
            </button>
            <button onClick={() => setMode("none")} disabled={busy}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </li>
  );
}

/** A group: what it asks for, who offers it, its add-ons, and a new one added. */
export function GroupCard({
  group,
  editor,
  sizes,
  offeredOn,
  labelOf,
  within,
}: {
  group: MenuAddonGroup;
  editor: Editor | null;
  sizes: SizeOpt[];
  /** The products that offer it (the others, seen from a product's panel). */
  offeredOn: string[];
  labelOf: Map<string, string>;
  /** Seen from this product's panel. */
  within?: string;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<"none" | "edit" | "add">("none");
  const nextSort = group.addons.reduce((m, a) => Math.max(m, a.sortOrder), 0) + 1;
  return (
    <section
      className={group.isActive ? "addon-group-card" : "addon-group-card faint"}
      data-testid="addon-group-card"
      data-group={group.name}
    >
      <div className="addon-group-head">
        <h4 style={{ margin: 0 }}>
          {group.name}
          {(group.nameAr || group.nameCkb) && (
            <span className="muted" style={{ fontWeight: 400 }}>
              {" "}
              · {[group.nameAr, group.nameCkb].filter(Boolean).join(" · ")}
            </span>
          )}{" "}
          <span className="muted" style={{ fontWeight: 400 }}>
            · {asks(group, t)}
          </span>{" "}
          {!group.isActive && <span className="badge warn">{t("Off the till")}</span>}
        </h4>
        {editor && mode === "none" && (
          <button className="linklike" onClick={() => setMode("edit")}>
            {t("Change the group…")}
          </button>
        )}
      </div>
      <p className="pf-hint" data-testid="group-shared">
        {within
          ? offeredOn.length === 0
            ? t("Only {product} offers it.", { product: within })
            : t("Also offered with {products}: a change here changes it there too.", {
                products: offeredOn.join(", "),
              })
          : offeredOn.length === 0
            ? t("No product offers it yet: choose it on a product's card, under Add-ons offered.")
            : t("Offered with {products}", { products: offeredOn.join(", ") })}
      </p>
      {editor && mode === "edit" && (
        <GroupForm group={group} nextSort={group.sortOrder} onDone={() => setMode("none")} />
      )}
      {group.addons.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {t("No add-ons in it yet.")}
        </p>
      ) : (
        <ul className="addon-list">
          {group.addons.map((a) => (
            <AddonRow key={a.id} addon={a} editor={editor} sizes={sizes} labelOf={labelOf} />
          ))}
        </ul>
      )}
      {editor &&
        group.isActive &&
        (mode === "add" ? (
          <AddonForm
            group={group}
            editor={editor}
            nextSort={nextSort}
            onDone={() => setMode("none")}
          />
        ) : (
          <div>
            <button
              onClick={() => setMode("add")}
              data-testid="addon-new"
              style={{ fontSize: ".85rem" }}
            >
              {t("+ Add an add-on to {group}", { group: group.name })}
            </button>
          </div>
        ))}
    </section>
  );
}

/**
 * Add-ons (0041): groups of choices the till offers with a product — the milk,
 * extra shots, toppings — each saying the fewest and the most a line takes;
 * each add-on's price on every channel, changed from a date, and what one uses,
 * for every size or a size's own. Products choose the groups they offer on
 * their own cards.
 */
/** Each size's label: "Latte · Large", or the product's name when it has one size. */
export function sizeLabels(products: MenuProduct[]): Map<string, string> {
  const labelOf = new Map<string, string>();
  for (const p of products)
    for (const v of p.variants)
      labelOf.set(
        v.id,
        p.variants.length > 1 || v.name !== p.name ? `${p.name} · ${v.name}` : p.name,
      );
  return labelOf;
}

/** The sizes a group is offered with, for an add-on's quantities of their own. */
export function groupSizes(
  groupId: string,
  products: MenuProduct[],
  offers: ProductAddonOffer[],
  labelOf: Map<string, string>,
): SizeOpt[] {
  const out = new Map<string, string>();
  for (const o of offers.filter((x) => x.groupId === groupId)) {
    const p = products.find((x) => x.id === o.productId);
    if (!p) continue;
    for (const v of p.variants)
      if (!v.soldAsBought && (o.variantId ? v.id === o.variantId : v.isActive))
        out.set(v.id, labelOf.get(v.id) ?? v.name);
  }
  return [...out].map(([id, label]) => ({ id, label }));
}

/** The products that offer a group, by name. */
export function groupProducts(
  groupId: string,
  products: MenuProduct[],
  offers: ProductAddonOffer[],
): MenuProduct[] {
  const ids = new Set(offers.filter((o) => o.groupId === groupId).map((o) => o.productId));
  return products.filter((p) => ids.has(p.id));
}

export function AddonsManager({
  groups,
  products,
  offers,
  editor,
}: {
  groups: MenuAddonGroup[];
  products: MenuProduct[];
  offers: ProductAddonOffer[];
  /** Null for those who may look but not change. */
  editor: Editor | null;
}) {
  const { t } = useT();
  const [adding, setAdding] = useState(false);
  const labelOf = sizeLabels(products);
  const nextSort = groups.reduce((m, g) => Math.max(m, g.sortOrder), 0) + 1;
  const sizesFor = (groupId: string) => groupSizes(groupId, products, offers, labelOf);
  const offeredOn = (groupId: string) =>
    groupProducts(groupId, products, offers).map((p) => p.name);

  if (groups.length === 0 && !editor) return null;
  return (
    <div className="card grid addons-manager" style={{ gap: 12 }} data-testid="addons-manager">
      <div>
        <h3 style={{ margin: 0 }}>{t("Add-ons")}</h3>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: ".85rem" }}>
          {t(
            "Choices the till offers with a product: the milk, an extra shot, a topping. A group says how many a line takes; each add-on has its price on every channel and what one uses. A product offers a group on its own card, under Add-ons offered.",
          )}
        </p>
      </div>
      {groups.map((g) => (
        <GroupCard
          key={g.id}
          group={g}
          editor={editor}
          sizes={sizesFor(g.id)}
          offeredOn={offeredOn(g.id)}
          labelOf={labelOf}
        />
      ))}
      {editor &&
        (adding ? (
          <GroupForm group={null} nextSort={nextSort} onDone={() => setAdding(false)} />
        ) : (
          <div>
            <button onClick={() => setAdding(true)} data-testid="group-new">
              {t("+ New group of add-ons")}
            </button>
          </div>
        ))}
    </div>
  );
}
