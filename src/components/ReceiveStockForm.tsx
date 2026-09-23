"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupplierAction, receiveGoodsAction } from "@/lib/actions/purchasing";
import { fmtIQD } from "@/lib/format";
import { Field, Notice, inputStyle } from "@/components/ui";

interface ItemOpt {
  id: string;
  name: string;
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
}
interface SupplierOpt {
  id: string;
  name: string;
}
interface LineDraft {
  itemId: string;
  qty: string;
  unit: string;
  goodsValue: string;
}
type Msg = { ok: boolean; text: string } | null;

export function ReceiveStockForm({
  items,
  suppliers,
  canReceive,
  canAddSupplier,
}: {
  items: ItemOpt[];
  suppliers: SupplierOpt[];
  canReceive: boolean;
  canAddSupplier: boolean;
}) {
  if (!canReceive && !canAddSupplier) return null;
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}
    >
      {canAddSupplier && <AddSupplier />}
      {canReceive && <Receive items={items} suppliers={suppliers} />}
    </div>
  );
}

function AddSupplier() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [f, setF] = useState({ name: "", contact: "", phone: "" });

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await createSupplierAction(f);
      if (r.ok) {
        setMsg({ ok: true, text: "Supplier added." });
        setF({ name: "", contact: "", phone: "" });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="card grid" style={{ gap: 10, alignContent: "start" }}>
      <h3 style={{ margin: 0 }}>🏭 Add supplier</h3>
      <Field label="Name">
        <input
          style={inputStyle}
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
      </Field>
      <Field label="What they supply">
        <input
          style={inputStyle}
          value={f.contact}
          onChange={(e) => setF({ ...f, contact: e.target.value })}
        />
      </Field>
      <Field label="Phone">
        <input
          style={inputStyle}
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
        />
      </Field>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn-primary" onClick={submit} disabled={pending || !f.name.trim()}>
          {pending ? "…" : "Add"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

function Receive({ items, suppliers }: { items: ItemOpt[]; suppliers: SupplierOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [supplier, setSupplier] = useState(suppliers[0]?.id ?? "");
  const [freight, setFreight] = useState("");
  const [other, setOther] = useState("");
  const [rebate, setRebate] = useState("");
  const [note, setNote] = useState("");
  const blank = (): LineDraft => ({
    itemId: items[0]?.id ?? "",
    qty: "",
    unit: items[0]?.baseUnit ?? "",
    goodsValue: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([blank()]);

  const itemById = (id: string) => items.find((i) => i.id === id);
  const setLine = (idx: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await receiveGoodsAction({
        supplierId: supplier,
        freight: freight || "0",
        other: other || "0",
        rebate: rebate || "0",
        note,
        lines: lines
          .filter((l) => l.itemId && l.qty.trim() !== "")
          .map((l) => ({
            itemId: l.itemId,
            qty: l.qty,
            unitCode: l.unit,
            goodsValue: l.goodsValue || "0",
          })),
      });
      if (r.ok) {
        setMsg({
          ok: true,
          text: `Receipt ${r.data.receiptNo} — ${fmtIQD(r.data.value)} into stock, awaiting its bill.`,
        });
        setLines([blank()]);
        setFreight("");
        setOther("");
        setRebate("");
        setNote("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (items.length === 0 || suppliers.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>📦 Receive stock</h3>
        <p className="muted" style={{ fontSize: ".9rem" }}>
          {items.length === 0 ? "Add stock items on Inventory first." : "Add the supplier first."}
        </p>
      </div>
    );
  }

  return (
    <div className="card grid" style={{ gap: 10, gridColumn: "span 2" }}>
      <h3 style={{ margin: 0 }}>📦 Receive stock (goods receipt)</h3>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
        <Field label="Supplier">
          <select style={inputStyle} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Freight (IQD)">
          <input
            style={inputStyle}
            value={freight}
            onChange={(e) => setFreight(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="Other landed costs">
          <input
            style={inputStyle}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="Rebate (−)">
          <input
            style={inputStyle}
            value={rebate}
            onChange={(e) => setRebate(e.target.value)}
            inputMode="decimal"
          />
        </Field>
      </div>

      <div className="grid" style={{ gap: 8 }}>
        {lines.map((l, idx) => {
          const it = itemById(l.itemId);
          return (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <label style={{ flex: 2, minWidth: 150 }}>
                <div className="muted" style={{ fontSize: ".78rem" }}>
                  Item
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
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1, minWidth: 80 }}>
                <div className="muted" style={{ fontSize: ".78rem" }}>
                  Quantity
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
                  Unit
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
              <label style={{ flex: 1, minWidth: 110 }}>
                <div className="muted" style={{ fontSize: ".78rem" }}>
                  Goods value (IQD)
                </div>
                <input
                  style={inputStyle}
                  value={l.goodsValue}
                  onChange={(e) => setLine(idx, { goodsValue: e.target.value })}
                  inputMode="decimal"
                />
              </label>
              <button
                onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                disabled={lines.length === 1}
              >
                ×
              </button>
            </div>
          );
        })}
        <button onClick={() => setLines((ls) => [...ls, blank()])} style={{ alignSelf: "start" }}>
          + Add line
        </button>
      </div>
      <Field label="Note (delivery note number, etc.)">
        <input
          style={inputStyle}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
        />
      </Field>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn-primary" onClick={submit} disabled={pending || !supplier}>
          {pending ? "Receiving…" : "Receive goods"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
