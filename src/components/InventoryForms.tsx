"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dimension } from "@domain/units/units.js";
import { createItemAction, adjustStockAction } from "@/lib/db/actions";
import { Field, Notice, inputStyle } from "@/components/ui";

interface ItemOpt {
  id: string;
  name: string;
  baseUnit: string;
}

const DEFAULT_BASE: Record<Dimension, string> = { count: "each", mass: "g", volume: "ml" };

export function InventoryForms({ items }: { items: ItemOpt[] }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}>
      <AddItem />
      <AdjustStock items={items} />
    </div>
  );
}

function AddItem() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dimension, setDimension] = useState<Dimension>("count");
  const [baseUnit, setBaseUnit] = useState("each");
  const [f, setF] = useState({
    name: "",
    nameAr: "",
    nameCkb: "",
    itemType: "ingredient",
    minLevelBase: "",
    openingQty: "",
    openingUnitCost: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await createItemAction({
        name: f.name,
        nameAr: f.nameAr,
        nameCkb: f.nameCkb,
        itemType: f.itemType,
        baseUnit,
        dimension,
        minLevelBase: f.minLevelBase ? Number(f.minLevelBase) : null,
        openingQty: f.openingQty ? Number(f.openingQty) : null,
        openingUnitCost: f.openingUnitCost ? Number(f.openingUnitCost) : null,
      });
      if (r.ok) {
        setMsg({ ok: true, text: `Added “${f.name}”.` });
        setF({ name: "", nameAr: "", nameCkb: "", itemType: "ingredient", minLevelBase: "", openingQty: "", openingUnitCost: "" });
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div className="card grid" style={{ gap: 10 }}>
      <h3 style={{ margin: 0 }}>➕ Add stock item</h3>
      <Field label="Name (English)">
        <input style={inputStyle} value={f.name} onChange={set("name")} placeholder="e.g. Milk" />
      </Field>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field label="الاسم (Arabic)">
          <input style={inputStyle} value={f.nameAr} onChange={set("nameAr")} dir="rtl" />
        </Field>
        <Field label="ناو (Kurdish)">
          <input style={inputStyle} value={f.nameCkb} onChange={set("nameCkb")} dir="rtl" />
        </Field>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Field label="Type">
          <select style={inputStyle} value={f.itemType} onChange={set("itemType")}>
            <option value="ingredient">Ingredient</option>
            <option value="packaging">Packaging</option>
            <option value="consumable">Consumable</option>
            <option value="finished_good">Finished good</option>
            <option value="resale">Resale</option>
          </select>
        </Field>
        <Field label="Measured in">
          <select
            style={inputStyle}
            value={dimension}
            onChange={(e) => {
              const d = e.target.value as Dimension;
              setDimension(d);
              setBaseUnit(DEFAULT_BASE[d]);
            }}
          >
            <option value="count">Count (each)</option>
            <option value="mass">Mass (g)</option>
            <option value="volume">Volume (ml)</option>
          </select>
        </Field>
        <Field label="Base unit">
          <input style={inputStyle} value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} />
        </Field>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Field label={`Reorder level (${baseUnit})`}>
          <input style={inputStyle} value={f.minLevelBase} onChange={set("minLevelBase")} inputMode="decimal" />
        </Field>
        <Field label={`Opening qty (${baseUnit})`}>
          <input style={inputStyle} value={f.openingQty} onChange={set("openingQty")} inputMode="decimal" />
        </Field>
        <Field label="Cost / unit (IQD)">
          <input style={inputStyle} value={f.openingUnitCost} onChange={set("openingUnitCost")} inputMode="decimal" />
        </Field>
      </div>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        An opening quantity posts a real <code>opening_balance</code> movement to the ledger.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn-primary" onClick={submit} disabled={pending || !f.name.trim()}>
          {pending ? "Saving…" : "Add item"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

function AdjustStock({ items }: { items: ItemOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [type, setType] = useState("count_adjustment");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const item = items.find((i) => i.id === itemId);

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await adjustStockAction({
        itemId,
        deltaBase: Number(delta),
        type,
        reason,
      });
      if (r.ok) {
        setMsg({ ok: true, text: "Adjustment posted." });
        setDelta("");
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>✏️ Adjust / waste</h3>
        <p className="muted" style={{ fontSize: ".9rem" }}>Add an item first.</p>
      </div>
    );
  }

  return (
    <div className="card grid" style={{ gap: 10 }}>
      <h3 style={{ margin: 0 }}>✏️ Adjust / waste</h3>
      <Field label="Item">
        <select style={inputStyle} value={itemId} onChange={(e) => setItemId(e.target.value)}>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.baseUnit})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field label="Reason type">
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="count_adjustment">Count adjustment</option>
            <option value="manual_correction">Manual correction</option>
            <option value="waste">Waste</option>
            <option value="spoilage">Spoilage</option>
            <option value="expired">Expired</option>
          </select>
        </Field>
        <Field label={`Change (${item?.baseUnit ?? "base"}, − to reduce)`}>
          <input style={inputStyle} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. -250" inputMode="decimal" />
        </Field>
      </div>
      <Field label="Note (optional)">
        <input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        Stock is never edited directly — this appends a signed correction movement.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn-primary" onClick={submit} disabled={pending || !delta}>
          {pending ? "Posting…" : "Post movement"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
