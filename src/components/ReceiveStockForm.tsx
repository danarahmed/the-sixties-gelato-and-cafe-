"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupplierAction, receiveGoodsAction } from "@/lib/actions/purchasing";
import { fmtIQD, fmtQty } from "@/lib/format";
import { deliveryLineCost, needsPriceConfirmation, priceGap } from "@/lib/receiving";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { NewItemForm, type CreatedItem } from "@/components/NewItemForm";

interface ItemOpt {
  id: string;
  name: string;
  /** Its Arabic and Kurdish names, to find look-alikes of a new item among. */
  nameAr: string | null;
  nameCkb: string | null;
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
  /** What one base unit costs now; null before its first delivery. */
  costNow: number | null;
}
interface SupplierOpt {
  id: string;
  name: string;
}
interface LineDraft {
  itemId: string;
  qty: string;
  unit: string;
  /** The price of one of the unit received, as the invoice has it. */
  unitPrice: string;
}
type Msg = { ok: boolean; text: string } | null;
/** A line whose item is being added (release H): not yet an item to receive. */
const NEW_ITEM = "__new__";

export function ReceiveStockForm({
  items,
  suppliers,
  canReceive,
  canAddSupplier,
  canAddItem,
}: {
  items: ItemOpt[];
  suppliers: SupplierOpt[];
  canReceive: boolean;
  canAddSupplier: boolean;
  /** An item not in Inventory yet can be added from the receipt itself (release H). */
  canAddItem: boolean;
}) {
  if (!canReceive && !canAddSupplier) return null;
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}
    >
      {canAddSupplier && <AddSupplier />}
      {canReceive && <Receive items={items} suppliers={suppliers} canAddItem={canAddItem} />}
    </div>
  );
}

function AddSupplier() {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [f, setF] = useState({ name: "", contact: "", phone: "" });

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await createSupplierAction(f);
      if (r.ok) {
        setMsg({ ok: true, text: t("Supplier added.") });
        setF({ name: "", contact: "", phone: "" });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="card grid" style={{ gap: 10, alignContent: "start" }}>
      <h3 style={{ margin: 0 }}>🏭 {t("Add supplier")}</h3>
      <Field label={t("Name")}>
        <input
          style={inputStyle}
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
      </Field>
      <Field label={t("What they supply")}>
        <input
          style={inputStyle}
          value={f.contact}
          onChange={(e) => setF({ ...f, contact: e.target.value })}
        />
      </Field>
      <Field label={t("Phone")}>
        <input
          style={inputStyle}
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
        />
      </Field>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn-primary" onClick={submit} disabled={pending || !f.name.trim()}>
          {pending ? "…" : t("Add")}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

function Receive({
  items: listed,
  suppliers,
  canAddItem,
}: {
  items: ItemOpt[];
  suppliers: SupplierOpt[];
  canAddItem: boolean;
}) {
  const { t, msg: say } = useT();
  // Items added on this receipt, until the page's list brings them.
  const [added, setAdded] = useState<ItemOpt[]>([]);
  const items = [...listed, ...added.filter((a) => !listed.some((i) => i.id === a.id))];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  // The database's question about a price far from the item's cost now (0027).
  const [check, setCheck] = useState<string | null>(null);
  const [supplier, setSupplier] = useState(suppliers[0]?.id ?? "");
  const [freight, setFreight] = useState("");
  const [other, setOther] = useState("");
  const [rebate, setRebate] = useState("");
  const [note, setNote] = useState("");
  const blank = (): LineDraft => ({
    itemId: items[0]?.id ?? (canAddItem ? NEW_ITEM : ""),
    qty: "",
    unit: items[0]?.baseUnit ?? "",
    unitPrice: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([blank()]);

  const itemById = (id: string) => items.find((i) => i.id === id);
  const setLine = (idx: number, patch: Partial<LineDraft>) => {
    setCheck(null);
    setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };
  const n = (v: string) => Number(normaliseNumber(v)) || 0;
  const goods = lines.reduce((t, l) => t + n(l.qty) * n(l.unitPrice), 0);
  const adding = lines.some((l) => l.itemId === NEW_ITEM);

  /** The item just added takes its line, by the pack it is bought in if it has one. */
  function created(idx: number, c: CreatedItem) {
    const units = [{ code: c.baseUnit, label: c.baseUnit, factor: 1 }];
    if (c.pack) units.push({ code: c.pack.code, label: c.pack.label, factor: c.pack.holds });
    setAdded((a) => [
      ...a,
      {
        id: c.id,
        name: c.name,
        nameAr: c.nameAr,
        nameCkb: c.nameCkb,
        baseUnit: c.baseUnit,
        units,
        costNow: null,
      },
    ]);
    setLine(idx, { itemId: c.id, unit: c.pack?.code ?? c.baseUnit });
    setMsg({
      ok: true,
      text: t("Added “{name}” to Inventory: its stock comes in with this delivery.", {
        name: c.name,
      }),
    });
  }

  function submit(confirm: boolean) {
    setMsg(null);
    start(async () => {
      const r = await receiveGoodsAction({
        supplierId: supplier,
        freight: freight || "0",
        other: other || "0",
        rebate: rebate || "0",
        note,
        confirm,
        lines: lines
          .filter((l) => l.itemId && l.itemId !== NEW_ITEM && l.qty.trim() !== "")
          .map((l) => ({
            itemId: l.itemId,
            qty: l.qty,
            unitCode: l.unit,
            unitPrice: l.unitPrice,
          })),
      });
      if (r.ok) {
        setCheck(null);
        setMsg({
          ok: true,
          text: t("Receipt {no} — {value} into stock, awaiting its bill.", {
            no: r.data.receiptNo,
            value: fmtIQD(r.data.value),
          }),
        });
        setLines([blank()]);
        setFreight("");
        setOther("");
        setRebate("");
        setNote("");
        router.refresh();
      } else if (!confirm && needsPriceConfirmation(r.error)) {
        setCheck(r.error);
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if ((items.length === 0 && !canAddItem) || suppliers.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>📦 {t("Receive stock")}</h3>
        <p className="muted" style={{ fontSize: ".9rem" }}>
          {items.length === 0
            ? t("Add stock items on Inventory first.")
            : t("Add the supplier first.")}
        </p>
      </div>
    );
  }

  return (
    <div className="card grid" style={{ gap: 10, gridColumn: "span 2" }} data-testid="receive">
      <h3 style={{ margin: 0 }}>📦 {t("Receive stock (goods receipt)")}</h3>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
        <Field label={t("Supplier")}>
          <select
            style={inputStyle}
            value={supplier}
            onChange={(e) => {
              setCheck(null);
              setSupplier(e.target.value);
            }}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Freight (IQD)")}>
          <input
            style={inputStyle}
            value={freight}
            onChange={(e) => setFreight(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label={t("Other landed costs")}>
          <input
            style={inputStyle}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label={t("Rebate (−)")}>
          <input
            style={inputStyle}
            value={rebate}
            onChange={(e) => setRebate(e.target.value)}
            inputMode="decimal"
          />
        </Field>
      </div>

      <div className="grid" style={{ gap: 10 }}>
        {lines.map((l, idx) => {
          const it = itemById(l.itemId);
          const unit = it?.units.find((u) => u.code === l.unit);
          const cost = deliveryLineCost(n(l.qty), unit?.factor ?? 1, n(l.unitPrice));
          const gap =
            l.qty.trim() && l.unitPrice.trim() ? priceGap(cost.perBase, it?.costNow ?? null) : null;
          const far = gap !== null && Math.abs(gap) > 0.25;
          return (
            <div key={idx} className="grid" style={{ gap: 4 }} data-testid="receive-line">
              <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                <label style={{ flex: 2, minWidth: 150 }}>
                  <div className="muted" style={{ fontSize: ".78rem" }}>
                    {t("Item")}
                  </div>
                  <select
                    style={inputStyle}
                    value={l.itemId}
                    onChange={(e) =>
                      setLine(idx, {
                        itemId: e.target.value,
                        unit: itemById(e.target.value)?.baseUnit ?? "",
                      })
                    }
                  >
                    {canAddItem && (
                      <option value={NEW_ITEM}>{t("+ New item (not in Inventory yet)…")}</option>
                    )}
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ flex: 1, minWidth: 80 }}>
                  <div className="muted" style={{ fontSize: ".78rem" }}>
                    {t("Quantity")}
                  </div>
                  <input
                    style={inputStyle}
                    value={l.qty}
                    onChange={(e) => setLine(idx, { qty: e.target.value })}
                    inputMode="decimal"
                  />
                </label>
                <label style={{ flex: 1, minWidth: 110 }}>
                  <div className="muted" style={{ fontSize: ".78rem" }}>
                    {t("Unit")}
                  </div>
                  <select
                    style={inputStyle}
                    value={l.unit}
                    onChange={(e) => setLine(idx, { unit: e.target.value })}
                  >
                    {(it?.units ?? []).map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.label}
                        {u.factor !== 1 ? ` (${u.factor} ${it?.baseUnit})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ flex: 1, minWidth: 120 }}>
                  <div className="muted" style={{ fontSize: ".78rem" }}>
                    {t("Price per {unit} (IQD)", { unit: unit?.label ?? l.unit })}
                  </div>
                  <input
                    style={inputStyle}
                    value={l.unitPrice}
                    onChange={(e) => setLine(idx, { unitPrice: e.target.value })}
                    inputMode="decimal"
                  />
                </label>
                <button
                  onClick={() => {
                    setCheck(null);
                    setLines((ls) => ls.filter((_, i) => i !== idx));
                  }}
                  disabled={lines.length === 1}
                >
                  ×
                </button>
              </div>
              {l.itemId === NEW_ITEM && (
                <div
                  className="card"
                  data-testid="new-item"
                  style={{ background: "var(--surface)", borderStyle: "dashed" }}
                >
                  <h4 style={{ margin: "0 0 4px" }}>➕ {t("A new stock item")}</h4>
                  <p className="muted" style={{ fontSize: ".8rem", margin: "0 0 8px" }}>
                    {t(
                      "It goes into Inventory with its name in each language, and its stock comes in with this delivery. Its price is entered on the line, as the invoice has it.",
                    )}
                  </p>
                  <NewItemForm
                    items={items}
                    submitLabel={t("Add the item")}
                    onCreated={(c) => created(idx, c)}
                    onUse={(id) => setLine(idx, { itemId: id, unit: itemById(id)?.baseUnit ?? "" })}
                    onCancel={
                      items.length > 0
                        ? () => setLine(idx, { itemId: items[0]!.id, unit: items[0]!.baseUnit })
                        : undefined
                    }
                  />
                </div>
              )}
              {l.qty.trim() !== "" && l.unitPrice.trim() !== "" && l.itemId !== NEW_ITEM && (
                <div
                  className="muted"
                  style={{ fontSize: ".78rem", color: far ? "var(--warn)" : undefined }}
                  data-testid="receive-line-cost"
                >
                  {fmtQty(n(l.qty))} × {fmtQty(n(l.unitPrice))} = {fmtIQD(cost.total)}
                  {cost.perBase !== null && it
                    ? ` · ${t("{cost} IQD a {unit}", {
                        cost: fmtQty(Number(cost.perBase.toFixed(4))),
                        unit: it.baseUnit,
                      })}`
                    : ""}
                  {it?.costNow
                    ? ` · ${t("it costs {cost} a {unit} now", {
                        cost: fmtQty(Number(it.costNow.toFixed(4))),
                        unit: it.baseUnit,
                      })}`
                    : ` · ${t("its first delivery: no cost to compare yet")}`}
                  {gap !== null && far
                    ? ` — ${
                        gap > 0
                          ? t("{pct}% above: check it", { pct: Math.round(Math.abs(gap) * 100) })
                          : t("{pct}% below: check it", { pct: Math.round(Math.abs(gap) * 100) })
                      }`
                    : ""}
                </div>
              )}
            </div>
          );
        })}
        <button
          onClick={() => {
            setCheck(null);
            setLines((ls) => [...ls, blank()]);
          }}
          style={{ alignSelf: "start" }}
        >
          + {t("Add line")}
        </button>
      </div>
      <Field label={t("Note (delivery note number, etc.)")}>
        <input
          style={inputStyle}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
        />
      </Field>
      {check && (
        <div
          className="card"
          role="alert"
          data-testid="price-check"
          style={{ borderColor: "var(--warn)" }}
        >
          <p style={{ marginTop: 0, fontSize: ".88rem" }}>
            <strong>
              {say(check.replace(/\. If it is right, confirm it and receive again$/, "."))}
            </strong>
          </p>
          <p className="muted" style={{ fontSize: ".8rem" }}>
            {t(
              "A price typed per gram instead of per kilogram, or a digit too many, would cost every sale of it wrongly. If the invoice says so, receive it as it is: your confirmation goes on the audit trail.",
            )}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => submit(true)} disabled={pending}>
              {pending ? t("Receiving…") : t("The price is right: receive it")}
            </button>
            <button onClick={() => setCheck(null)} disabled={pending}>
              {t("Let me correct it")}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          onClick={() => submit(false)}
          disabled={pending || !supplier || check !== null || adding}
        >
          {pending ? t("Receiving…") : t("Receive goods")}
        </button>
        {adding && (
          <span className="muted" style={{ fontSize: ".85rem" }}>
            {t("Add the new item first, or choose one from the list.")}
          </span>
        )}
        {goods > 0 && (
          <span className="muted" style={{ fontSize: ".85rem" }}>
            {t("Goods {value}", { value: fmtIQD(goods) })}
          </span>
        )}
        <Notice msg={msg} />
      </div>
    </div>
  );
}
