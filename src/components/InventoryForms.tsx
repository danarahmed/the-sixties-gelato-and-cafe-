"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adjustStockAction,
  recordOpeningStockAction,
  recordWasteAction,
} from "@/lib/actions/stock";
import { WASTE_TYPES, fmtIQD, movementLabel } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { NewItemForm } from "@/components/NewItemForm";

interface ItemOpt {
  id: string;
  name: string;
  /** Its Arabic and Kurdish names, to find look-alikes of a new item among. */
  nameAr?: string | null;
  nameCkb?: string | null;
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
}

type Msg = { ok: boolean; text: string } | null;

export function InventoryForms({
  items,
  unstocked,
  canAddItem,
  canWaste,
  canCorrect,
  isOwner,
}: {
  items: ItemOpt[];
  /** Items with no stock history yet: they can be given their opening stock. */
  unstocked: ItemOpt[];
  canAddItem: boolean;
  canWaste: boolean;
  canCorrect: boolean;
  /** Opening stock is capital the owner puts in: the owner's alone (0027). */
  isOwner: boolean;
}) {
  if (!canAddItem && !canWaste && !canCorrect) return null;
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}
    >
      {isOwner && unstocked.length > 0 && <OpeningStock items={unstocked} />}
      {canAddItem && <AddItem isOwner={isOwner} items={items} />}
      {canWaste && <RecordWaste items={items} />}
      {canCorrect && <CorrectStock items={items} />}
    </div>
  );
}

function AddItem({ isOwner, items }: { isOwner: boolean; items: ItemOpt[] }) {
  const { t } = useT();
  return (
    <div className="card grid" style={{ gap: 10, alignContent: "start" }}>
      <h3 style={{ margin: 0 }}>➕ {t("Add stock item")}</h3>
      <NewItemForm items={items} isOwner={isOwner} />
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
  const { t } = useT();
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
  const [reason, setReason] = useState("");
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
        reason,
      });
      if (r.ok) {
        setMsg({
          ok: true,
          text: t("Opening stock of {name}: {qty} {unit}, worth {value} (journal {journal}).", {
            name: item.name,
            qty,
            unit: unitLabel,
            value: fmtIQD(r.data.value),
            journal: r.data.journalNo ?? "—",
          }),
        });
        setQty("");
        setUnitCost("");
        setReason("");
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
      <h3 style={{ margin: 0 }}>📦 {t("Opening stock")}</h3>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {t(
          "{n} item(s) have no stock recorded yet. Count what is on the shelf and enter it at what it cost, so every sale of it is costed.",
          { n: items.length },
        )}
      </p>
      <Field label={t("Item with no stock yet")}>
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
        <Field label={t("Quantity on the shelf")}>
          <input
            style={inputStyle}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label={t("Unit")}>
          <UnitSelect item={item} value={unit} onChange={setUnit} />
        </Field>
        <Field label={t("Cost per {unit} (IQD)", { unit: unitLabel })}>
          <input
            style={inputStyle}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            inputMode="decimal"
          />
        </Field>
      </div>
      <Field label={t("Where it came from")}>
        <input
          style={inputStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          placeholder={t("e.g. the opening count on the first day")}
        />
      </Field>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {value > 0 ? `${t("Worth {value}.", { value: fmtIQD(value) })} ` : ""}
        {t(
          "It is capital you put into the business: journaled Dr 1200 Inventory / Cr 3000 Owner equity, and on the audit trail with where it came from. Once an item has stock, it changes only by deliveries, sales, waste, counts and corrections.",
        )}
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={pending || !qty.trim() || !unitCost.trim() || !reason.trim()}
        >
          {pending ? t("Recording…") : t("Record opening stock")}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

function RecordWaste({ items }: { items: ItemOpt[] }) {
  const { t } = useT();
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
          text:
            r.data.value !== undefined
              ? t("Recorded — {value} written off (journal {journal}).", {
                  value: fmtIQD(r.data.value),
                  journal: r.data.journalNo ?? "—",
                })
              : t("Recorded (journal {journal}).", { journal: r.data.journalNo ?? "—" }),
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
      <h3 style={{ margin: 0 }}>🗑️ {t("Record waste")}</h3>
      <Field label={t("Item")}>
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
        <Field label={t("What happened")}>
          <select
            style={inputStyle}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            {WASTE_TYPES.map((w) => (
              <option key={w} value={w}>
                {t(movementLabel(w))}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Quantity lost")}>
          <input
            style={inputStyle}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label={t("Unit")}>
          <UnitSelect item={item} value={unit} onChange={setUnit} />
        </Field>
      </div>
      <Field label={t("Why (required)")}>
        <input
          style={inputStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </Field>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {t(
          "Taken out at average cost: Dr 5300 Waste / Cr 1200 Inventory. Large write-offs need a manager.",
        )}
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={pending || !qty || !reason.trim()}
        >
          {pending ? t("Recording…") : t("Record waste")}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

function CorrectStock({ items }: { items: ItemOpt[] }) {
  const { t } = useT();
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
          text: t("Corrected — {value} (journal {journal}).", {
            value: fmtIQD(r.data.value),
            journal: r.data.journalNo ?? "—",
          }),
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
      <h3 style={{ margin: 0 }}>✏️ {t("Correct stock (manager)")}</h3>
      <Field label={t("Item")}>
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
        <Field label={t("Change (− to reduce)")}>
          <input
            style={inputStyle}
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            inputMode="decimal"
            placeholder="-250"
          />
        </Field>
        <Field label={t("Unit")}>
          <UnitSelect item={item} value={unit} onChange={setUnit} />
        </Field>
        <Field label={t("Cost per base unit (additions)")}>
          <input
            style={inputStyle}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            inputMode="decimal"
            disabled={!adding}
            placeholder={t("average")}
          />
        </Field>
      </div>
      <Field label={t("Why (required)")}>
        <input
          style={inputStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </Field>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {t(
          "For corrections outside a count. Losses go out at average cost; posted against 5400 Inventory count variance and written to the audit trail. Counted stock is corrected by approving a count.",
        )}
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={pending || !delta || !reason.trim()}
        >
          {pending ? t("Posting…") : t("Post correction")}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
