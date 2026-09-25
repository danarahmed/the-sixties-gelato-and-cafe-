"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addItemUnitAction, updateItemAction } from "@/lib/actions/stock";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";

type Msg = { ok: boolean; text: string } | null;
type ItemType = "ingredient" | "packaging" | "consumable" | "finished_good" | "resale";

export interface EditableItem {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  itemType: string;
  baseUnit: string;
  minLevelBase: number | null;
  parLevelBase: number | null;
  isActive: boolean;
  units: { code: string; label: string; factor: number }[];
}

const TYPES: [ItemType, string][] = [
  ["ingredient", "Ingredient"],
  ["packaging", "Packaging"],
  ["consumable", "Consumable"],
  ["finished_good", "Finished good"],
  ["resale", "Resale"],
];

/**
 * An item corrected (0027): its names, type, levels and whether it is in use,
 * with why. The base unit stays, since the item's history is counted in it.
 * The database refuses a name another item in use has, and taking an item out
 * of use while it has stock or a recipe, the till or a batch needs it.
 */
export function EditItem({ item }: { item: EditableItem }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const initial = {
    name: item.name,
    nameAr: item.nameAr ?? "",
    nameCkb: item.nameCkb ?? "",
    itemType: (TYPES.some(([t]) => t === item.itemType) ? item.itemType : "ingredient") as ItemType,
    minLevel: item.minLevelBase === null ? "" : String(item.minLevelBase),
    parLevel: item.parLevelBase === null ? "" : String(item.parLevelBase),
    isActive: item.isActive,
  };
  const [f, setF] = useState(initial);
  const [reason, setReason] = useState("");
  const changed = JSON.stringify(f) !== JSON.stringify(initial);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await updateItemAction({
        itemId: item.id,
        name: f.name,
        nameAr: f.nameAr,
        nameCkb: f.nameCkb,
        itemType: f.itemType,
        minLevel: f.minLevel || null,
        parLevel: f.parLevel || null,
        isActive: f.isActive,
        reason,
      });
      if (r.ok) {
        setMsg({ ok: true, text: t("Saved, and on the audit trail.") });
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <section className="panel" data-testid="edit-item">
      <div className="panel-h">
        <h3>{t("Correct this item")}</h3>
        <span className="muted" style={{ fontSize: ".74rem" }}>
          {t("Every change goes on the audit trail, with its values before and after")}
        </span>
      </div>
      <div className="panel-b grid" style={{ gap: 10 }}>
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
          <Field label={t("Name (English)")}>
            <input
              style={inputStyle}
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </Field>
          <Field label={t("الاسم (Arabic)")}>
            <input
              style={inputStyle}
              value={f.nameAr}
              dir="rtl"
              onChange={(e) => setF({ ...f, nameAr: e.target.value })}
            />
          </Field>
          <Field label={t("ناو (Kurdish)")}>
            <input
              style={inputStyle}
              value={f.nameCkb}
              dir="rtl"
              onChange={(e) => setF({ ...f, nameCkb: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <Field label={t("Type")}>
            <select
              style={inputStyle}
              value={f.itemType}
              onChange={(e) => setF({ ...f, itemType: e.target.value as ItemType })}
            >
              {TYPES.map(([type, label]) => (
                <option key={type} value={type}>
                  {t(label)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Reorder level ({unit})", { unit: item.baseUnit })}>
            <input
              style={inputStyle}
              value={f.minLevel}
              inputMode="decimal"
              onChange={(e) => setF({ ...f, minLevel: e.target.value })}
            />
          </Field>
          <Field label={t("Par level ({unit})", { unit: item.baseUnit })}>
            <input
              style={inputStyle}
              value={f.parLevel}
              inputMode="decimal"
              onChange={(e) => setF({ ...f, parLevel: e.target.value })}
            />
          </Field>
        </div>
        <label style={{ fontSize: ".85rem", display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={f.isActive}
            onChange={(e) => setF({ ...f, isActive: e.target.checked })}
          />
          {t("In use: offered on deliveries, counts, recipes and the till")}
        </label>
        <Field label={t("Why (on the audit trail)")}>
          <input
            style={inputStyle}
            value={reason}
            maxLength={300}
            placeholder={
              f.isActive ? t("e.g. the supplier's name for it") : t("e.g. we stopped using it")
            }
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
          {t(
            "It stays counted in {unit}: its whole history is. No two items in use share a name, whatever the capitals, spaces or punctuation. An item is taken out of use only when it has no stock and no recipe, product or batch needs it.",
            { unit: item.baseUnit },
          )}
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn-primary"
            onClick={save}
            disabled={pending || !changed || !f.name.trim()}
          >
            {pending ? t("Saving…") : t("Save changes")}
          </button>
          <Notice msg={msg} />
        </div>
      </div>
    </section>
  );
}

/**
 * Pack sizes for an item (0027): a case of 24, a sleeve of 50. A unit in use
 * keeps its size for good, since every delivery and count in it was taken at
 * that size: a different size is a new unit, under its own name.
 */
export function PackUnits({ item, canAdd }: { item: EditableItem; canAdd: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [f, setF] = useState({ code: "", label: "", factor: "" });

  function add() {
    setMsg(null);
    start(async () => {
      const r = await addItemUnitAction({ itemId: item.id, ...f });
      if (r.ok) {
        setMsg({ ok: true, text: t("Added {name}.", { name: f.label || f.code }) });
        setF({ code: "", label: "", factor: "" });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <section className="panel" data-testid="pack-units">
      <div className="panel-h">
        <h3>{t("Units")}</h3>
        <span className="muted" style={{ fontSize: ".74rem" }}>
          {t("What it is delivered and counted in")}
        </span>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("Unit")}</th>
              <th>{t("Label")}</th>
              <th className="right">{t("Holds")}</th>
            </tr>
          </thead>
          <tbody>
            {item.units.map((u) => (
              <tr key={u.code}>
                <td className="mono">{u.code}</td>
                <td>{u.label}</td>
                <td className="right mono">
                  {u.factor === 1 && u.code === item.baseUnit
                    ? t("base unit")
                    : `${u.factor.toLocaleString("en-US")} ${item.baseUnit}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canAdd && (
        <div className="panel-b grid" style={{ gap: 10 }}>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Field label={t("New unit")}>
              <input
                style={inputStyle}
                value={f.code}
                placeholder="case_24" // i18n-ignore: an example code
                onChange={(e) => setF({ ...f, code: e.target.value })}
              />
            </Field>
            <Field label={t("Label")}>
              <input
                style={inputStyle}
                value={f.label}
                placeholder={t("Case of 24")}
                onChange={(e) => setF({ ...f, label: e.target.value })}
              />
            </Field>
            <Field label={t("Holds ({unit})", { unit: item.baseUnit })}>
              <input
                style={inputStyle}
                value={f.factor}
                inputMode="decimal"
                onChange={(e) => setF({ ...f, factor: e.target.value })}
              />
            </Field>
          </div>
          <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
            {t(
              "A unit keeps its size for good: every delivery and count in it was taken at that size. A different size is a new unit (case_12, not case_24 changed).",
            )}
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="btn-primary"
              onClick={add}
              disabled={pending || !f.code.trim() || !f.factor.trim()}
            >
              {pending ? t("Adding…") : t("Add unit")}
            </button>
            <Notice msg={msg} />
          </div>
        </div>
      )}
    </section>
  );
}
