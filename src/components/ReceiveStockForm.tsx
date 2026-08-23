"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dimension } from "@domain/units/units.js";
import { createSupplierAction, receivePurchaseAction } from "@/lib/db/actions";
import { Field, Notice, inputStyle } from "@/components/ui";

interface ItemOpt {
  id: string;
  name: string;
  baseUnit: string;
  dimension: Dimension;
}
interface SupplierOpt {
  id: string;
  name: string;
}
interface LineDraft {
  itemId: string;
  qty: string;
  packSize: string; // base units per received pack (1 = base unit)
  goodsValue: string;
}

export function ReceiveStockForm({ items, suppliers }: { items: ItemOpt[]; suppliers: SupplierOpt[] }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 340px) 1fr", gap: 16 }}>
      <AddSupplier />
      <Receive items={items} suppliers={suppliers} />
    </div>
  );
}

function AddSupplier() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [f, setF] = useState({ name: "", contact: "", phone: "" });

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await createSupplierAction(f);
      if (r.ok) {
        setMsg({ ok: true, text: "Supplier added." });
        setF({ name: "", contact: "", phone: "" });
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div className="card grid" style={{ gap: 10, alignContent: "start" }}>
      <h3 style={{ margin: 0 }}>🏭 Add supplier</h3>
      <Field label="Name">
        <input style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Contact">
        <input style={inputStyle} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
      </Field>
      <Field label="Phone">
        <input style={inputStyle} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [supplier, setSupplier] = useState("");
  const [freight, setFreight] = useState("");
  const [other, setOther] = useState("");
  const [rebate, setRebate] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ itemId: items[0]?.id ?? "", qty: "", packSize: "1", goodsValue: "" }]);

  const itemById = (id: string) => items.find((i) => i.id === id);

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await receivePurchaseAction({
        supplierId: supplier || null,
        supplierName: supplier ? suppliers.find((s) => s.id === supplier)?.name ?? null : null,
        freight: Number(freight) || 0,
        other: Number(other) || 0,
        rebate: Number(rebate) || 0,
        lines: lines
          .filter((l) => l.itemId && Number(l.qty) > 0)
          .map((l) => {
            const it = itemById(l.itemId)!;
            const pack = Number(l.packSize) || 1;
            return {
              itemId: l.itemId,
              baseUnit: it.baseUnit,
              dimension: it.dimension,
              receivedQty: Number(l.qty),
              receivedUnit: pack === 1 ? it.baseUnit : `pack_${pack}`,
              unitFactorToBase: pack,
              goodsValue: Number(l.goodsValue) || 0,
            };
          }),
      });
      if (r.ok) {
        setMsg({ ok: true, text: "Received — stock and WAC updated." });
        setLines([{ itemId: items[0]?.id ?? "", qty: "", packSize: "1", goodsValue: "" }]);
        setFreight("");
        setOther("");
        setRebate("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>📦 Receive stock</h3>
        <p className="muted" style={{ fontSize: ".9rem" }}>Add stock items (Inventory) first.</p>
      </div>
    );
  }

  return (
    <div className="card grid" style={{ gap: 10 }}>
      <h3 style={{ margin: 0 }}>📦 Receive stock (goods receipt)</h3>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
        <Field label="Supplier">
          <select style={inputStyle} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">— none —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Freight (IQD)">
          <input style={inputStyle} value={freight} onChange={(e) => setFreight(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Other landed">
          <input style={inputStyle} value={other} onChange={(e) => setOther(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Rebate (−)">
          <input style={inputStyle} value={rebate} onChange={(e) => setRebate(e.target.value)} inputMode="decimal" />
        </Field>
      </div>

      <div className="grid" style={{ gap: 8 }}>
        {lines.map((l, idx) => {
          const it = itemById(l.itemId);
          return (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <label style={{ flex: 2, minWidth: 150 }}>
                <div className="muted" style={{ fontSize: ".78rem" }}>Item</div>
                <select
                  style={inputStyle}
                  value={l.itemId}
                  onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, itemId: e.target.value } : x)))}
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.baseUnit})</option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1, minWidth: 80 }}>
                <div className="muted" style={{ fontSize: ".78rem" }}>Packs / units</div>
                <input style={inputStyle} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))} inputMode="decimal" />
              </label>
              <label style={{ flex: 1, minWidth: 90 }}>
                <div className="muted" style={{ fontSize: ".78rem" }}>{it?.baseUnit ?? "base"} per pack</div>
                <input style={inputStyle} value={l.packSize} onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, packSize: e.target.value } : x)))} inputMode="decimal" />
              </label>
              <label style={{ flex: 1, minWidth: 100 }}>
                <div className="muted" style={{ fontSize: ".78rem" }}>Goods value (IQD)</div>
                <input style={inputStyle} value={l.goodsValue} onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, goodsValue: e.target.value } : x)))} inputMode="decimal" />
              </label>
              <button onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} disabled={lines.length === 1}>×</button>
            </div>
          );
        })}
        <button onClick={() => setLines((ls) => [...ls, { itemId: items[0]?.id ?? "", qty: "", packSize: "1", goodsValue: "" }])} style={{ alignSelf: "start" }}>
          + Add line
        </button>
      </div>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        Landed cost (freight + other − rebate) is allocated across lines by value, converted to base
        units, and folded into the moving weighted-average cost.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn-primary" onClick={submit} disabled={pending}>
          {pending ? "Receiving…" : "Receive goods"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
