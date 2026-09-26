"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createItemAction } from "@/lib/actions/stock";
import { lookAlikes, type LookAlike, type NamedItem } from "@/lib/names";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";

type Msg = { ok: boolean; text: string } | null;
type Dimension = "count" | "mass" | "volume";
const DEFAULT_BASE: Record<Dimension, string> = { count: "each", mass: "g", volume: "ml" };

/** An item just added, as a receipt line needs it. */
export interface CreatedItem {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  baseUnit: string;
  /** The pack it is bought in, when one was given: its code, its name, what it holds. */
  pack: { code: string; label: string; holds: number } | null;
}

/**
 * A new stock item: on Inventory, and on each line of a receipt (release H),
 * so whoever does the purchasing adds an item without leaving the delivery.
 * The items already there whose names look like the one typed are shown as it
 * is typed — the same name, which the database refuses, or a look-alike
 * ("Botled water" beside "Bottled water") — and adding it all the same is the
 * person's to say.
 */
export function NewItemForm({
  items,
  isOwner = false,
  onCreated,
  onUse,
  onCancel,
  submitLabel,
}: {
  /** The items in use, to find look-alikes among. */
  items: NamedItem[];
  /** Opening stock is the owner's capital (0027): offered to the owner, on Inventory. */
  isOwner?: boolean;
  onCreated?: (item: CreatedItem) => void;
  /** Take a look-alike instead (a receipt line); without it, a look-alike opens its page. */
  onUse?: (id: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [dimension, setDimension] = useState<Dimension>("count");
  const [baseUnit, setBaseUnit] = useState("each");
  const empty = {
    name: "",
    nameAr: "",
    nameCkb: "",
    itemType: "ingredient",
    minLevel: "",
    openingQty: "",
    openingUnitCost: "",
    openingReason: "",
    packLabel: "",
    packHolds: "",
  };
  const [f, setF] = useState(empty);
  const [returnable, setReturnable] = useState(false);
  // Look-alikes the database had that this screen did not know of when it opened.
  const [fromServer, setFromServer] = useState<LookAlike[]>([]);
  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setF({ ...f, [k]: e.target.value });
      setFromServer([]);
    };

  const similar = useMemo(() => {
    const here = lookAlikes({ name: f.name, nameAr: f.nameAr, nameCkb: f.nameCkb }, items);
    return [...here, ...fromServer.filter((s) => !here.some((h) => h.id === s.id))];
  }, [f.name, f.nameAr, f.nameCkb, items, fromServer]);
  const same = similar.find((s) => s.same);
  const packHalf = (f.packLabel.trim() === "") !== (f.packHolds.trim() === "");
  const unitWord = baseUnit.trim() || "each";

  function submit() {
    setMsg(null);
    const pack =
      f.packLabel.trim() && f.packHolds.trim() ? { label: f.packLabel, holds: f.packHolds } : null;
    start(async () => {
      const r = await createItemAction({
        name: f.name,
        nameAr: f.nameAr,
        nameCkb: f.nameCkb,
        itemType: f.itemType as "ingredient",
        baseUnit,
        dimension,
        minLevel: f.minLevel || null,
        openingQty: isOwner ? f.openingQty || null : null,
        openingUnitCost: isOwner ? f.openingUnitCost || null : null,
        openingReason: isOwner ? f.openingReason || null : null,
        returnable,
        pack,
        // The look-alikes are on the screen, and the person added it all the same.
        acceptSimilar: similar.length > 0,
      });
      if (r.ok) {
        onCreated?.({
          id: r.data.itemId,
          name: f.name.trim(),
          nameAr: f.nameAr.trim() || null,
          nameCkb: f.nameCkb.trim() || null,
          baseUnit: baseUnit.trim(),
          pack:
            r.data.unitCode && pack
              ? {
                  code: r.data.unitCode,
                  label: pack.label.trim(),
                  holds: Number(normaliseNumber(pack.holds)),
                }
              : null,
        });
        setMsg({ ok: true, text: t("Added “{name}”.", { name: f.name.trim() }) });
        setF(empty);
        setReturnable(false);
        setFromServer([]);
        router.refresh();
      } else if ("similar" in r) {
        setFromServer(r.similar);
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="new-item-form">
      <Field label={t("Name (English)")}>
        <input
          style={inputStyle}
          value={f.name}
          onChange={set("name")}
          placeholder={t("e.g. Milk")}
          autoComplete="off"
        />
      </Field>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field label={t("الاسم (Arabic)")}>
          <input style={inputStyle} value={f.nameAr} onChange={set("nameAr")} dir="rtl" />
        </Field>
        <Field label={t("ناو (Kurdish)")}>
          <input style={inputStyle} value={f.nameCkb} onChange={set("nameCkb")} dir="rtl" />
        </Field>
      </div>

      {similar.length > 0 && (
        <div
          className="card"
          role="alert"
          data-testid="look-alikes"
          style={{ borderColor: same ? "var(--err)" : "var(--warn)", padding: 10 }}
        >
          <div style={{ fontSize: ".86rem", fontWeight: 600 }}>
            {same
              ? t("There is already an item called “{name}”.", { name: same.name })
              : t("Is it one of these? Its name looks like:")}
          </div>
          <ul style={{ margin: "6px 0 0", paddingInlineStart: 18, fontSize: ".86rem" }}>
            {(same ? [same] : similar).map((s) => (
              <li key={s.id} style={{ marginBottom: 4 }}>
                <strong>{s.name}</strong>{" "}
                {onUse ? (
                  <button
                    type="button"
                    onClick={() => onUse(s.id)}
                    style={{ minHeight: 28, padding: "0 10px", fontSize: ".8rem" }}
                  >
                    {t("Use it")}
                  </button>
                ) : (
                  <Link href={`/inventory/${s.id}`}>{t("Open it")}</Link>
                )}
              </li>
            ))}
          </ul>
          {!same && (
            <p className="muted" style={{ fontSize: ".8rem", margin: "6px 0 0" }}>
              {t(
                "Check the name before adding it: two items for the same thing split its stock and its cost in two. If it is a different item, add it all the same.",
              )}
            </p>
          )}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Field label={t("Type")}>
          <select style={inputStyle} value={f.itemType} onChange={set("itemType")}>
            <option value="ingredient">{t("Ingredient")}</option>
            <option value="packaging">{t("Packaging")}</option>
            <option value="consumable">{t("Consumable")}</option>
            <option value="finished_good">{t("Finished good")}</option>
            <option value="resale">{t("Resale")}</option>
          </select>
        </Field>
        <Field label={t("Measured in")}>
          <select
            style={inputStyle}
            value={dimension}
            onChange={(e) => {
              const d = e.target.value as Dimension;
              setDimension(d);
              setBaseUnit(DEFAULT_BASE[d] ?? "each");
            }}
          >
            <option value="count">{t("Count (each)")}</option>
            <option value="mass">{t("Mass (g)")}</option>
            <option value="volume">{t("Volume (ml)")}</option>
          </select>
        </Field>
        <Field label={t("Base unit")}>
          <input
            style={inputStyle}
            value={baseUnit}
            onChange={(e) => setBaseUnit(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <Field label={t("The pack it is bought in (optional)")}>
          <input
            style={inputStyle}
            value={f.packLabel}
            onChange={set("packLabel")}
            placeholder={t("e.g. Carton of 24")}
            maxLength={60}
          />
        </Field>
        <Field label={t("Holds ({unit})", { unit: unitWord })}>
          <input
            style={inputStyle}
            value={f.packHolds}
            onChange={set("packHolds")}
            inputMode="decimal"
          />
        </Field>
      </div>
      {packHalf && (
        <p className="muted" style={{ fontSize: ".8rem", margin: 0, color: "var(--warn)" }}>
          {t("Give the pack both its name and how many {unit} it holds.", { unit: unitWord })}
        </p>
      )}
      <div
        className="grid"
        style={{ gridTemplateColumns: isOwner ? "1fr 1fr 1fr" : "1fr 2fr", gap: 8 }}
      >
        <Field label={t("Reorder level ({unit})", { unit: unitWord })}>
          <input
            style={inputStyle}
            value={f.minLevel}
            onChange={set("minLevel")}
            inputMode="decimal"
          />
        </Field>
        {isOwner ? (
          <>
            <Field label={t("Opening stock ({unit})", { unit: unitWord })}>
              <input
                style={inputStyle}
                value={f.openingQty}
                onChange={set("openingQty")}
                inputMode="decimal"
              />
            </Field>
            <Field label={t("Cost per {unit} (IQD)", { unit: unitWord })}>
              <input
                style={inputStyle}
                value={f.openingUnitCost}
                onChange={set("openingUnitCost")}
                inputMode="decimal"
              />
            </Field>
          </>
        ) : (
          <p className="muted" style={{ fontSize: ".8rem", margin: 0, alignSelf: "end" }}>
            {t(
              "Its stock comes in with a delivery. Opening stock, the owner's capital, is the owner's to record.",
            )}
          </p>
        )}
      </div>
      {isOwner && f.openingQty.trim() !== "" && (
        <Field label={t("Where the opening stock came from")}>
          <input
            style={inputStyle}
            value={f.openingReason}
            onChange={set("openingReason")}
            maxLength={300}
            placeholder={t("e.g. the opening count on the first day")}
          />
        </Field>
      )}
      <label style={{ fontSize: ".85rem", display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="checkbox"
          className="check"
          checked={returnable}
          onChange={(e) => setReturnable(e.target.checked)}
        />
        {t("Goes back on the shelf when a sale is refunded (sealed goods only)")}
      </label>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {t("No two items in use share a name, whatever the capitals, spaces or punctuation.")}
        {isOwner &&
          ` ${t("Opening stock is journaled: Dr 1200 Inventory / Cr 3000 Owner equity.")}`}
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={
            pending ||
            !f.name.trim() ||
            !!same ||
            packHalf ||
            (isOwner && f.openingQty.trim() !== "" && !f.openingReason.trim())
          }
        >
          {pending
            ? t("Saving…")
            : similar.length > 0
              ? t("It is a different item: add it")
              : (submitLabel ?? t("Add item"))}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={pending}>
            {t("Cancel")}
          </button>
        )}
        <Notice msg={msg} />
      </div>
    </div>
  );
}
