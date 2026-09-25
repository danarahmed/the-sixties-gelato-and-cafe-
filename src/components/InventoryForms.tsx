"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adjustStockAction,
  createItemAction,
  recordOpeningStockAction,
  recordWasteAction,
} from "@/lib/actions/stock";
import { WASTE_TYPES, fmtIQD, movementLabel } from "@/lib/format";
import { Field, Notice, inputStyle } from "@/components/ui";

interface ItemOpt {
  id: string;
  name: string;
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
}

type Msg = { ok: boolean; text: string } | null;
const DEFAULT_BASE: Record<string, string> = { count: "each", mass: "g", volume: "ml" };

export function InventoryForms({
  items,
  unstocked,
  canAddItem,
  canWaste,
  canCorrect,
}: {
  items: ItemOpt[];
  /** Items with no stock history yet: they can be given their opening stock. */
  unstocked: ItemOpt[];
  canAddItem: boolean;
  canWaste: boolean;
  canCorrect: boolean;
}) {
  if (!canAddItem && !canWaste && !canCorrect) return null;
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}
    >
      {canAddItem && unstocked.length > 0 && <OpeningStock items={unstocked} />}
      {canAddItem && <AddItem />}
      {canWaste && <RecordWaste items={items} />}
      {canCorrect && <CorrectStock items={items} />}
    </div>
  );
}

function AddItem() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [dimension, setDimension] = useState<"count" | "mass" | "volume">("count");
  const [baseUnit, setBaseUnit] = useState("each");
  const empty = {
    name: "",
    nameAr: "",
    nameCkb: "",
    itemType: "ingredient",
    minLevel: "",
    openingQty: "",
    openingUnitCost: "",
  };
  const [f, setF] = useState(empty);
  const [returnable, setReturnable] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await createItemAction({
        name: f.name,
        nameAr: f.nameAr,
        nameCkb: f.nameCkb,
        itemType: f.itemType as "ingredient",
        baseUnit,
        dimension,
        minLevel: f.minLevel || null,
        openingQty: f.openingQty || null,
        openingUnitCost: f.openingUnitCost || null,
        returnable,
      });
      if (r.ok) {
        setMsg({ ok: true, text: `Added “${f.name}”.` });
        setF(empty);
        setReturnable(false);
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="card grid" style={{ gap: 10, alignContent: "start" }}>
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
              const d = e.target.value as "count" | "mass" | "volume";
              setDimension(d);
              setBaseUnit(DEFAULT_BASE[d] ?? "each");
            }}
          >
            <option value="count">Count (each)</option>
            <option value="mass">Mass (g)</option>
            <option value="volume">Volume (ml)</option>
          </select>
        </Field>
        <Field label="Base unit">
          <input
            style={inputStyle}
            value={baseUnit}
            onChange={(e) => setBaseUnit(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Field label={`Reorder level (${baseUnit})`}>
          <input
            style={inputStyle}
            value={f.minLevel}
            onChange={set("minLevel")}
            inputMode="decimal"
          />
        </Field>
        <Field label={`Opening stock (${baseUnit})`}>
          <input
            style={inputStyle}
            value={f.openingQty}
            onChange={set("openingQty")}
            inputMode="decimal"
          />
        </Field>
        <Field label={`Cost per ${baseUnit} (IQD)`}>
          <input
            style={inputStyle}
            value={f.openingUnitCost}
            onChange={set("openingUnitCost")}
            inputMode="decimal"
          />
        </Field>
      </div>
      <label style={{ fontSize: ".85rem", display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={returnable}
          onChange={(e) => setReturnable(e.target.checked)}
        />
        Goes back on the shelf when a sale is refunded (sealed goods only)
      </label>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        Opening stock is journaled: Dr 1200 Inventory / Cr 3000 Owner equity.
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

function UnitSelect({
  item,
  value,
  onChange,
}: {
  item: ItemOpt | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  const units = item?.units ?? [];
  return (
    <select style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
      {units.map((u) => (
        <option key={u.code} value={u.code}>
          {u.label}
          {u.factor !== 1 ? ` (${u.factor} ${item?.baseUnit})` : ""}
        </option>
      ))}
    </select>
  );
}

/**
 * Opening stock for an item that has none yet — at go-live, or for an item
 * added without it — at what it cost, so its sales are costed from the start.
 */
function OpeningStock({ items }: { items: ItemOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  // Once an item has its opening stock it leaves the list: fall back to the first.
  const item = items.find((i) => i.id === itemId) ?? items[0];
  const [unitChoice, setUnit] = useState(item?.baseUnit ?? "");
  const unit = item?.units.some((u) => u.code === unitChoice) ? unitChoice : (item?.baseUnit ?? "");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const unitLabel = item?.units.find((u) => u.code === unit)?.label ?? unit;
  const value =
    (Number(qty.replace(/[^0-9.]/g, "")) || 0) * (Number(unitCost.replace(/[^0-9.]/g, "")) || 0);

  function submit() {
    if (!item) return;
    setMsg(null);
    start(async () => {
      const r = await recordOpeningStockAction({
        itemId: item.id,
        qty,
        unitCode: unit || null,
        unitCost,
      });
      if (r.ok) {
        setMsg({
          ok: true,
          text: `Opening stock of ${item.name}: ${qty} ${unitLabel}, worth ${fmtIQD(r.data.value)} (journal ${r.data.journalNo ?? "—"}).`,
        });
        setQty("");
        setUnitCost("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (!item) return null;
  return (
    <div
      className="card grid"
      style={{ gap: 10, alignContent: "start" }}
      data-testid="opening-stock"
    >
      <h3 style={{ margin: 0 }}>📦 Opening stock</h3>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {items.length} item(s) have no stock recorded yet. Count what is on the shelf and enter it
        at what it cost, so every sale of it is costed.
      </p>
      <Field label="Item with no stock yet">
        <select
          style={inputStyle}
          value={item.id}
          onChange={(e) => {
            setItemId(e.target.value);
            setUnit(items.find((i) => i.id === e.target.value)?.baseUnit ?? "");
          }}
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Field label="Quantity on the shelf">
          <input
            style={inputStyle}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="Unit">
          <UnitSelect item={item} value={unit} onChange={setUnit} />
        </Field>
        <Field label={`Cost per ${unitLabel} (IQD)`}>
          <input
            style={inputStyle}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            inputMode="decimal"
          />
        </Field>
      </div>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {value > 0 ? `Worth ${fmtIQD(value)}. ` : ""}Journaled Dr 1200 Inventory / Cr 3000 Owner
        equity. Once an item has stock, it changes only by deliveries, sales, waste, counts and
        corrections.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={pending || !qty.trim() || !unitCost.trim()}
        >
          {pending ? "Recording…" : "Record opening stock"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

function RecordWaste({ items }: { items: ItemOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const item = items.find((i) => i.id === itemId);
  const [unit, setUnit] = useState(items[0]?.baseUnit ?? "");
  const [type, setType] = useState<(typeof WASTE_TYPES)[number]>("waste");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await recordWasteAction({ itemId, qty, unitCode: unit || null, type, reason });
      if (r.ok) {
        setMsg({
          ok: true,
          text: `Recorded${r.data.value !== undefined ? ` — ${fmtIQD(r.data.value)} written off` : ""} (journal ${r.data.journalNo ?? "—"}).`,
        });
        setQty("");
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (items.length === 0) return null;
  return (
    <div className="card grid" style={{ gap: 10, alignContent: "start" }}>
      <h3 style={{ margin: 0 }}>🗑️ Record waste</h3>
      <Field label="Item">
        <select
          style={inputStyle}
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            setUnit(items.find((i) => i.id === e.target.value)?.baseUnit ?? "");
          }}
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Field label="What happened">
          <select
            style={inputStyle}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            {WASTE_TYPES.map((w) => (
              <option key={w} value={w}>
                {movementLabel(w)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quantity lost">
          <input
            style={inputStyle}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="Unit">
          <UnitSelect item={item} value={unit} onChange={setUnit} />
        </Field>
      </div>
      <Field label="Why (required)">
        <input
          style={inputStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </Field>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        Taken out at average cost: Dr 5300 Waste / Cr 1200 Inventory. Large write-offs need a
        manager.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={pending || !qty || !reason.trim()}
        >
          {pending ? "Recording…" : "Record waste"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

function CorrectStock({ items }: { items: ItemOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const item = items.find((i) => i.id === itemId);
  const [unit, setUnit] = useState(items[0]?.baseUnit ?? "");
  const [delta, setDelta] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const adding = Number(delta.replace(/[^0-9.-]/g, "")) > 0;

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await adjustStockAction({
        itemId,
        delta,
        unitCode: unit || null,
        reason,
        unitCost: adding && unitCost ? unitCost : null,
      });
      if (r.ok) {
        setMsg({
          ok: true,
          text: `Corrected — ${fmtIQD(r.data.value)} (journal ${r.data.journalNo ?? "—"}).`,
        });
        setDelta("");
        setUnitCost("");
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (items.length === 0) return null;
  return (
    <div className="card grid" style={{ gap: 10, alignContent: "start" }}>
      <h3 style={{ margin: 0 }}>✏️ Correct stock (manager)</h3>
      <Field label="Item">
        <select
          style={inputStyle}
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            setUnit(items.find((i) => i.id === e.target.value)?.baseUnit ?? "");
          }}
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Field label="Change (− to reduce)">
          <input
            style={inputStyle}
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            inputMode="decimal"
            placeholder="-250"
          />
        </Field>
        <Field label="Unit">
          <UnitSelect item={item} value={unit} onChange={setUnit} />
        </Field>
        <Field label="Cost per base unit (additions)">
          <input
            style={inputStyle}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            inputMode="decimal"
            disabled={!adding}
            placeholder="average"
          />
        </Field>
      </div>
      <Field label="Why (required)">
        <input
          style={inputStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </Field>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        For corrections outside a count. Losses go out at average cost; posted against 5400
        Inventory count variance and written to the audit trail. Counted stock is corrected by
        approving a count.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={pending || !delta || !reason.trim()}
        >
          {pending ? "Posting…" : "Post correction"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
